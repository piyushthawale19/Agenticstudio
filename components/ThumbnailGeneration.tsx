"use client";

import { useUser } from "@clerk/nextjs";
import Usage from "./Usage";
import { FeatureFlag } from "@/features/flags";
import Image from "next/image";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useConvex } from "convex/react";

type GeneratedImage = {
  _id: Id<"images">;
  storageId: Id<"_storage">;
  userId: string;
  videoId: string;
  url: string | null;
};

// const POLL_INTERVAL_MS = 20000; // unused for now

function ThumbnailGeneration({ videoId }: { videoId: string }) {
  const { user, isLoaded } = useUser();
  const convex = useConvex();
  const [images, setImages] = useState<GeneratedImage[]>([]);
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pollTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const loadImages = useCallback(
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
          (await convex.query(api.images.getImages, {
            videoId,
            userId: user.id,
          })) ?? [];
        setImages(data);
        setError(null);
      } catch (err) {
        console.error("Failed to load thumbnails", err);
        setError("Unable to load thumbnails right now. Please try again.");
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

    const kickOff = async () => {
      await loadImages("initial");
      if (cancelled) return;
      // Faster polling for real-time updates (5 seconds)
      pollTimerRef.current = setInterval(() => {
        loadImages("refresh");
      }, 5000);
    };

    kickOff();

    return () => {
      cancelled = true;
      if (pollTimerRef.current) {
        clearInterval(pollTimerRef.current);
      }
    };
  }, [isLoaded, user?.id, loadImages]);

  const hasImages = images.length > 0;
  const showSkeleton = isInitialLoading;

  const gridContent = useMemo(() => {
    if (showSkeleton) {
      return (
        <div className="mt-4 grid grid-cols-2 gap-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <div
              key={`skeleton-${index}`}
              className="h-28 rounded-xl bg-gradient-to-r from-gray-100 via-gray-200 to-gray-100 animate-pulse"
            />
          ))}
        </div>
      );
    }

    if (!hasImages) {
      return (
        <div className="text-center py-8 px-4 rounded-lg mt-4 border-2 border-dashed border-gray-200">
          <div className="flex items-center justify-center gap-2 text-gray-500">
            <span className="h-3 w-3 rounded-full bg-purple-400 animate-ping" />
            <p>Waiting for your first thumbnail…</p>
          </div>
          <p className="text-sm text-gray-400 mt-2">
            Thumbnails typically generate in 15-45 seconds. They&apos;ll appear here
            automatically as soon as ready.
          </p>
        </div>
      );
    }

    return (
      <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-4 mt-4">
        {images.map(
          (image) =>
            image.url && (
              <div
                key={image._id}
                className="relative overflow-hidden rounded-xl border bg-gray-50"
              >
                <Image
                  src={image.url}
                  alt="Generated Thumbnail"
                  width={320}
                  height={180}
                  className="h-full w-full object-cover"
                  unoptimized
                />
              </div>
            )
        )}
      </div>
    );
  }, [showSkeleton, hasImages, images]);

  return (
    <div className="rounded-xl flex flex-col p-4 border bg-white">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-52">
          <Usage
            featureFlag={FeatureFlag.IMAGE_GENERATION}
            title="Thumbnail Generation"
          />
        </div>
        <button
          onClick={() => loadImages("refresh")}
          disabled={isRefreshing || isInitialLoading}
          className="px-4 py-2 text-sm rounded-full border border-purple-200 text-purple-600 hover:bg-purple-50 transition disabled:opacity-50"
        >
          {isRefreshing ? "Refreshing…" : "Refresh previews"}
        </button>
      </div>

      {error && (
        <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {gridContent}

      {hasImages && (
        <p className="text-xs text-gray-400 mt-3">
          Updated automatically every 5 seconds. Generating a new thumbnail
          typically takes 15-45 seconds.
        </p>
      )}
    </div>
  );
}

export default ThumbnailGeneration;
