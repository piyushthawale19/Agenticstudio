"use client";

import { FeatureFlag } from "@/features/flags";
import { useSchematicEntitlement } from "@schematichq/schematic-react";
import { useUser } from "@clerk/nextjs";
import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import Usage from "./Usage";
import { Copy, Check } from "lucide-react";
import { toast } from "sonner";

interface TranscriptEntry {
  text: string;
  timestamp: string;
}

function Transcription({ videoId }: { videoId: string }) {
  const { user } = useUser();
  const searchParams = useSearchParams();
  const [transcript, setTranscript] = useState<{
    transcript: TranscriptEntry[];
    cache: string;
    isNew?: boolean;
  } | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isNewTranscription, setIsNewTranscription] = useState<boolean | null>(null);
  const [copied, setCopied] = useState(false);
  const hasInitializedRef = useRef(false);

  const { featureUsageExceeded } = useSchematicEntitlement(
    FeatureFlag.TRANSCRIPTION
  );

  const handleCopyAll = useCallback(() => {
    if (!transcript?.transcript) return;
    
    const fullText = transcript.transcript
      .map((entry) => `[${entry.timestamp}] ${entry.text}`)
      .join("\n");
    
    navigator.clipboard.writeText(fullText).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      toast.success("All Copied To Clickboard");
    }).catch((err) => {
      console.error("Failed to copy transcript:", err);
    });
  }, [transcript]);

  const handleGenerateTranscription = useCallback(async () => {
    if (!videoId || featureUsageExceeded || !user?.id) {
      return;
    }

    // Check if we've already processed this transcription in this session
    const sessionKey = `transcription_${user.id}_${videoId}`;
    const isFromHome = searchParams.get('from') === 'home';
    
    // Check sessionStorage to prevent duplicate token burns on refresh
    const alreadyProcessed = typeof window !== 'undefined' 
      ? sessionStorage.getItem(sessionKey) === 'processed'
      : false;

    // Only process (burn token) if it's a fresh navigation from home page, not a refresh
    // Always fetch transcript (to check if it exists in DB), but only burn token if shouldProcess is true
    const shouldProcess = isFromHome && !alreadyProcessed;

    try {
      setIsLoading(true);
      setError(null);
      // Don't clear transcript on refresh - we want to show it if it exists

      const response = await fetch("/api/transcript", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ videoId, shouldProcess }),
      });

      if (!response.ok) {
        let message = "Unable to fetch transcript right now.";
        try {
          const data = await response.json();
          if (typeof data?.error === "string") {
            message = data.error;
          }
        } catch {
          // ignore JSON parse errors
        }
        setError(message);
        setTranscript(null);
        setIsNewTranscription(null);
        return;
      }

      const result = await response.json();
      
      // If we got transcript data, use it
      if (result.transcript && Array.isArray(result.transcript) && result.transcript.length > 0) {
        setTranscript(result);
        setIsNewTranscription(Boolean(result.isNew));
        
        // Mark as processed in sessionStorage to prevent token burn on refresh
        // Only mark if we actually created a new transcription (isNew = true)
        if (typeof window !== 'undefined' && result.isNew) {
          sessionStorage.setItem(sessionKey, 'processed');
        }
      } else {
        // No transcript data - check if it was processed in this session
        if (alreadyProcessed) {
          // Was processed but no data - might be DB issue, show as existing
          setTranscript({ transcript: [], cache: "", isNew: false });
          setIsNewTranscription(false);
        } else {
          // Not processed - no transcript available
          setTranscript(null);
          setIsNewTranscription(null);
        }
      }
    } catch (err) {
      console.error("Failed to fetch transcript", err);
      setError("Unable to fetch transcript right now.");
      setTranscript(null);
      setIsNewTranscription(null);
    } finally {
      setIsLoading(false);
    }
  }, [featureUsageExceeded, videoId, user?.id, searchParams]);

  useEffect(() => {
    if (!videoId || !user?.id) return;
    if (hasInitializedRef.current) return;
    
    hasInitializedRef.current = true;
    handleGenerateTranscription();
  }, [handleGenerateTranscription, videoId, user?.id]);

  const TranscriptionStatus = (() => {
    if (isLoading) {
      return (
        <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-gray-50 border border-gray-200 rounded-full">
          <div className="w-2 h-2 bg-gray-400 rounded-full animate-pulse" />
          <span className="text-sm text-gray-700">Loading transcription status…</span>
        </div>
      );
    }

    if (error) {
      return (
        <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-red-50 border border-red-200 rounded-full">
          <div className="w-2 h-2 bg-red-400 rounded-full" />
          <span className="text-sm text-red-700">{error}</span>
        </div>
      );
    }

    if (isNewTranscription) {
      return (
        <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-amber-50 border border-amber-200 rounded-full">
          <div className="w-2 h-2 bg-amber-400 rounded-full animate-pulse" />
          <span className="text-sm text-amber-700">
            This is your first time transcribing this video – your 1 token burn.
            <br />
            <span className="font-semibold">1 transcription token is being used!</span>
          </span>
        </div>
      );
    }

    if (transcript && transcript.transcript && transcript.transcript.length > 0) {
      return (
        <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-green-50 border border-green-200 rounded-full">
          <div className="w-2 h-2 bg-green-400 rounded-full" />
          <p className="text-sm text-green-700">
            Transcription exists for this video – no additional tokens needed in future calls!
          </p>
        </div>
      );
    }

    // No transcript available - check if it was processed in this session
    if (!isLoading && !error && (!transcript || !transcript.transcript || transcript.transcript.length === 0)) {
      const sessionKey = typeof window !== 'undefined' ? `transcription_${user?.id}_${videoId}` : null;
      const wasProcessed = typeof window !== 'undefined' && sessionKey 
        ? sessionStorage.getItem(sessionKey) === 'processed'
        : false;

      if (wasProcessed) {
        // Was processed in this session but not in DB - might be pending or DB issue
        return (
          <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-green-50 border border-green-200 rounded-full">
            <div className="w-2 h-2 bg-green-400 rounded-full" />
            <p className="text-sm text-green-700">
              Transcription exists for this video – no additional tokens needed in future calls!
            </p>
          </div>
        );
      }

      // Not processed - user needs to navigate from home
      return (
        <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-gray-50 border border-gray-200 rounded-full">
          <div className="w-2 h-2 bg-gray-400 rounded-full" />
          <span className="text-sm text-gray-700">
            No transcription found. Navigate from home page to transcribe this video.
          </span>
        </div>
      );
    }

    return null;
  })();

  return (
    <div className="border p-4 rounded-xl gap-4 flex flex-col">
      <Usage featureFlag={FeatureFlag.TRANSCRIPTION} title="Transcription" />
      
      {/* Transcription Status */}
      {TranscriptionStatus}

      {/* Transcription Content */}
      {!featureUsageExceeded ? (
        <div className="flex flex-col gap-2">
          <div className="flex justify-between items-center mb-2">
            <h3 className="text-sm font-semibold text-gray-700">Transcript</h3>
            {transcript?.transcript && transcript.transcript.length > 0 && (
              <button
                onClick={handleCopyAll}
                className="flex items-center gap-2 px-3 py-1.5 text-sm bg-purple-50 hover:bg-purple-100 text-purple-700 border border-purple-200 rounded-lg transition-colors"
              >
                {copied ? (
                  <>
                    <Check className="w-4 h-4" />
                    <span>Copied!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4" />
                    <span>Copy All</span>
                  </>
                )}
              </button>
            )}
          </div>
          <div className="flex flex-col gap-2 max-h-[250px] overflow-y-auto rounded-md p-4 bg-gray-50">
            {isLoading ? (
              <p className="text-sm text-gray-500">Fetching transcript…</p>
            ) : error ? (
              <p className="text-sm text-red-600">{error}</p>
            ) : transcript?.transcript && transcript.transcript.length > 0 ? (
              transcript.transcript.map((entry, index) => (
                <div key={index} className="flex gap-2">
                  <span className="text-sm text-gray-400 min-w-[50px]">
                    {entry.timestamp}
                  </span>
                  <p className="text-sm text-gray-700">{entry.text}</p>
                </div>
              ))
            ) : (
              <p className="text-sm text-gray-500">No transcription available</p>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}

export default Transcription;
