"use client";

import { useUser } from "@clerk/nextjs";
import Usage from "./Usage";
import { FeatureFlag } from "@/features/flags";
import { useSchematicEntitlement } from "@schematichq/schematic-react";
import { Copy, RotateCw } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useConvex } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { toast } from "sonner";

type StoredTitle = {
  _id: Id<"titles">;
  title: string;
  userId: string;
  videoId: string;
  _creationTime: number;
};

// const POLL_INTERVAL_MS = 15000; // unused for now

function TitleGenerations({ videoId }: { videoId: string }) {
  const { user, isLoaded } = useUser();
  const convex = useConvex();
  const [titles, setTitles] = useState<StoredTitle[]>([]);
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pollTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const loadTitles = useCallback(
    async (mode: "initial" | "refresh" = "initial") => {
      if (!user?.id) {
        return;
      }

      if (mode === "initial") {
        setIsInitialLoading(true);
      } else {
        setIsRefreshing(true);
      }

      try {
        const data =
          (await convex.query(api.titles.list, {
            videoId,
            userId: user.id,
          })) ?? [];
        const sorted = [...data].sort(
          (a, b) => b._creationTime - a._creationTime
        );
        setTitles(sorted);
        setError(null);
      } catch (err) {
        console.error("Failed to load titles", err);
        // Only show error on refresh, not initial load
        if (mode === "refresh") {
          setError("Unable to load titles right now. Please try again.");
        }
      } finally {
        if (mode === "initial") {
          setIsInitialLoading(false);
        } else {
          setIsRefreshing(false);
        }
      }
    },
    [convex, user?.id, videoId]
  );

  useEffect(() => {
    if (!isLoaded || !user?.id) {
      return;
    }

    let cancelled = false;

    const kickoff = async () => {
      await loadTitles("initial");
      if (cancelled) {
        return;
      }
      // Faster polling for real-time updates (3 seconds)
      pollTimerRef.current = setInterval(() => {
        loadTitles("refresh");
      }, 3000);
    };

    kickoff();

    return () => {
      cancelled = true;
      if (pollTimerRef.current) {
        clearInterval(pollTimerRef.current);
      }
    };
  }, [isLoaded, user?.id, loadTitles]);


  // Feature flag entitlement
  const { value: isTitleGenerationEnabled } = useSchematicEntitlement(
    FeatureFlag.TITLE_GENERATIONS
  );

  // Copy function
  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success("Copied To Clickboard");
    } catch (err) {
      console.error("Failed to copy:", err);
    }
  };

  const hasTitles = titles.length > 0;
  const showSkeleton = isInitialLoading;

  const skeletonList = useMemo(
    () => (
      <div className="space-y-3 mt-4">
        {Array.from({ length: 3 }).map((_, index) => (
          <div
            key={`title-skeleton-${index}`}
            className="h-16 rounded-lg bg-gradient-to-r from-gray-100 via-gray-200 to-gray-100 animate-pulse"
          />
        ))}
      </div>
    ),
    []
  );

  return (
    <div className="p-4 border border-gray-200 rounded-xl bg-white shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-52">
          <Usage
            featureFlag={FeatureFlag.TITLE_GENERATIONS}
            title="Titles"
          />
        </div>
        <button
          onClick={() => loadTitles("refresh")}
          disabled={isRefreshing || isInitialLoading}
          className="inline-flex items-center gap-2 rounded-full border border-emerald-200 px-4 py-2 text-xs font-medium text-emerald-700 hover:bg-emerald-50 transition disabled:opacity-50"
        >
          <RotateCw className={`h-3.5 w-3.5 ${isRefreshing ? "animate-spin" : ""}`} />
          {isRefreshing ? "Refreshing…" : "Refresh"}
        </button>
      </div>

      {error && (
        <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {showSkeleton && skeletonList}

      {!showSkeleton && hasTitles && (
        <div className="space-y-3 mt-4 max-h-[280px] overflow-y-auto pr-1">
          {titles.map((title) => (
            <div
              key={title._id}
              className="group relative p-4 rounded-lg border border-gray-100 bg-gray-50 hover:border-blue-100 hover:bg-blue-50 transition-all duration-200"
            >
              <div className="flex items-start justify-between gap-4">
                <p className="text-sm text-gray-900 leading-relaxed">
                  {title.title}
                </p>

                <button
                  onClick={() => copyToClipboard(title.title)}
                  className="opacity-0 group-hover:opacity-100 transition-opacity duration-200 p-1.5 hover:bg-blue-100 rounded-md"
                  title="Copy to clipboard"
                >
                  <Copy className="w-4 h-4 text-purple-600 hover:text-green-600" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {!showSkeleton && !hasTitles && isTitleGenerationEnabled && !error && (
        <div className="text-center py-8 px-4 rounded-lg mt-4 border-2 border-dashed border-gray-200">
          <p className="text-gray-600">You haven&apos;t generated any titles yet. Click &quot;Generate Title&quot; to get started!</p>
          <p className="text-sm text-gray-400 mt-1">
            Ask the AI for a title (e.g., &quot;Give me a funny title&quot;) and it will appear here.
          </p>
        </div>
      )}
    </div>
  );
}

export default TitleGenerations;
