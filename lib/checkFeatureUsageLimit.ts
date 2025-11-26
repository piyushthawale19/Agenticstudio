import { featureFlagEvents } from "@/features/flags";
import { client } from "@/lib/schematic";

export async function checkFeatureUsageLimit(
  userId: string,
  eventSubtype: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const entitlements = await client.entitlements.getFeatureUsageByCompany({
      keys: {
        id: userId,
      },
    });

    const feature = entitlements.data.features.find(
      (entitlement) => entitlement.feature?.eventSubtype === eventSubtype
    );

    if (!feature) {
      return {
        success: false,
        error:
          "This feature is not available on your current plan, please upgrade to continue.",
      };
    }

    const { usage, allocation } = feature;

    if (usage === undefined || allocation === undefined) {
      return {
        success: false,
        error: "System Error - Constact support.",
      };
    }

    const hasExceededUsageLimit = usage >= allocation;

    if (hasExceededUsageLimit) {
      const featureName =
        Object.entries(featureFlagEvents).find(
          ([, value]) => value.event === eventSubtype
        )?.[0] || eventSubtype;

      return {
        success: false,
        error: `You have reached your${featureName} limit. Please upgrade your plan to continue using this feature.`,
      };
    }

    return { success: true };
  } catch (error) {
    console.error("Error checking feature usage limit:", error);

    if (isCompanyNotFound(error)) {
      console.warn(
        "Schematic company record missing for user",
        userId,
        "— allowing request and will create usage on first successful track event."
      );
      return { success: true };
    }

    return {
      success: false,
      error: "Error checking feature usage limit",
    };
  }
}

function isCompanyNotFound(error: unknown): boolean {
  if (!error || typeof error !== "object") {
    return false;
  }

  const statusCode = (error as { statusCode?: number }).statusCode;
  if (statusCode !== 404) {
    return false;
  }

  const body = (error as { body?: unknown }).body;
  if (!body || typeof body !== "object") {
    return false;
  }

  const message = (body as { error?: string }).error;
  return message === "company not found";
}
