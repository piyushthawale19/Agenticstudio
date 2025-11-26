"use server";

import { api } from "@/convex/_generated/api";
import { Doc } from "@/convex/_generated/dataModel";
import { FeatureFlag, featureFlagEvents } from "@/features/flags";
import { checkFeatureUsageLimit } from "@/lib/checkFeatureUsageLimit";
import { getConvexClient } from "@/lib/convex";
import { ensureSchematicIdentity } from "@/lib/ensureSchematicIdentity";
import { client } from "@/lib/schematic";
import { currentUser } from "@clerk/nextjs/server";

export interface VideoResponse {
  success: boolean;
  data?: Doc<"videos">;
  error?: string;
  isNew?: boolean;
}

export const createOrGetVideo = async (
  videoId: string,
  userId: string,
  shouldProcess: boolean = true
): Promise<VideoResponse> => {
  const convex = getConvexClient();
  let user = null;
  try {
    user = await currentUser();
  } catch (authError) {
    const clerkStatus = getClerkErrorStatus(authError);
    if (clerkStatus) {
      console.warn(
        `Clerk error while fetching current user (status ${clerkStatus})`,
        authError
      );
      return {
        success: false,
        error:
          clerkStatus === 429
            ? "You're making requests too quickly. Please wait a few seconds before trying again."
            : "Authentication service is temporarily unavailable. Please wait a moment and try again.",
      };
    }
    throw authError;
  }

  if (!user) {
    return {
      success: false,
      error: "User not authenticated",
    };
  }

  try {
    let existingVideo = null;
    try {
      existingVideo = await convex.query(api.videos.getVideoById, {
        videoId,
        userId,
      });
    } catch (convexError: any) {
      // Check if it's a Convex connection error
      const errorMessage = convexError?.message || String(convexError || "");
      if (
        errorMessage.includes("Could not find public function") ||
        errorMessage.includes("Server Error") ||
        errorMessage.includes("ECONNREFUSED")
      ) {
        console.warn(
          "Convex connection issue - ensure Convex dev server is running"
        );
        return {
          success: false,
          error:
            "Database connection error. Please ensure the database is running.",
        };
      }
      // Re-throw if it's a different error
      throw convexError;
    }

    if (existingVideo) {
      console.log(`Video ${videoId} already exists in database`);
      return {
        success: true,
        data: existingVideo,
        isNew: false,
      };
    }

    // Only check limits and create video if shouldProcess is true
    // This prevents token burn on page refresh or direct navigation without from=home
    // shouldProcess will be true only when:
    // 1. User navigated from home page (from=home in URL)
    // 2. Video hasn't been processed in this session (not in sessionStorage)
    if (!shouldProcess) {
      // Video doesn't exist but we shouldn't process (refresh or direct navigation scenario)
      // Return undefined to indicate no video exists, but don't show error
      // The UI will check sessionStorage to show appropriate status
      return {
        success: true,
        data: undefined,
        isNew: false,
      };
    }

    // shouldProcess is true - this is a fresh navigation from home
    // Check feature limits and create video
    const featureCheck = await checkFeatureUsageLimit(
      user.id,
      featureFlagEvents[FeatureFlag.ANALYSE_VIDEO].event
    );

    if (!featureCheck.success) {
      return {
        success: false,
        error: featureCheck.error,
      };
    }

    console.log(`Analyse event for new video ${videoId} - burning token`);

    // Create video entry
    try {
      await convex.mutation(api.videos.createVideoEntry, {
        videoId,
        userId,
      });

      // Fetch the created video
      const createdVideo = await convex.query(api.videos.getVideoById, {
        videoId,
        userId,
      });

      // Track usage AFTER successful creation
      await trackAnalyseUsage(user.id);

      return {
        success: true,
        data: createdVideo ?? undefined,
        isNew: true,
      };
    } catch (mutationError: any) {
      console.error("Error creating video entry:", mutationError);
      // If mutation fails, don't track usage
      throw mutationError;
    }
  } catch (error: any) {
    console.error("Error creating or getting video:", error);

    // Provide more specific error messages
    const errorMessage = error?.message || String(error || "");
    const clerkStatus = getClerkErrorStatus(error);
    if (clerkStatus) {
      return {
        success: false,
        error:
          clerkStatus === 429
            ? "You're making requests too quickly. Please wait a few seconds before trying again."
            : "Authentication service is temporarily unavailable. Please wait a moment and try again.",
      };
    }
    if (
      errorMessage.includes("Could not find public function") ||
      errorMessage.includes("Server Error")
    ) {
      return {
        success: false,
        error:
          "Database connection error. Please ensure Convex dev server is running (npx convex dev).",
      };
    }

    return {
      success: false,
      error: "An unexpected error occurred. Please try again later.",
    };
  }
};

async function trackAnalyseUsage(userId: string) {
  console.log("Tracking analyse video event for", userId);
  try {
    await ensureSchematicIdentity(userId);
    await client.track({
      event: featureFlagEvents[FeatureFlag.ANALYSE_VIDEO].event,
      company: { id: userId },
      user: { userId },
    });
  } catch (trackError) {
    console.warn(
      "Failed to track analyse video event (continuing without usage update):",
      trackError
    );
  }
}

function getClerkErrorStatus(error: unknown): number | null {
  if (!error || typeof error !== "object") {
    return null;
  }
  const maybeError = error as { clerkError?: boolean; status?: number };
  if (!maybeError?.clerkError) {
    return null;
  }
  return typeof maybeError.status === "number" ? maybeError.status : null;
}
