'use client'
import { createOrGetVideo } from '@/actions/createOrGetVideo';
import AiAgentChat from '@/components/AiAgentChat';
import ThumbnailGeneration from '@/components/ThumbnailGeneration';
import TitleGeneration from '@/components/TitleGeneration';
import Transcription from '@/components/Transcription';
import Usage from '@/components/Usage'
import YoutubeVideoDetails from '@/components/YoutubeVideoDetails';
import { Doc } from '@/convex/_generated/dataModel';
import { FeatureFlag } from '@/features/flags'
import { useUser } from '@clerk/nextjs';
import { useParams, useSearchParams } from 'next/navigation'
import { useEffect, useRef, useState } from 'react';

function AnalysisPage() {
    const params = useParams<{ videoId: string }>();
    const searchParams = useSearchParams();
    const { videoId } = params;
    const { user } = useUser();
    const [videoRecord, setVideoRecord] = useState<Doc<"videos"> | null>(null);
    const [isNewAnalysis, setIsNewAnalysis] = useState<boolean | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const hasInitializedRef = useRef<string | null>(null);

    useEffect(() => {
        if (!user?.id || !videoId) {
            setIsLoading(false);
            return;
        }

        // Reset initialization if videoId or userId changes
        const initKey = `${user.id}_${videoId}`;
        if (hasInitializedRef.current === initKey) {
            return;
        }

        hasInitializedRef.current = initKey;

        // Check if we've already processed this video in this session
        const sessionKey = `analysis_${user.id}_${videoId}`;
        const isFromHome = searchParams.get('from') === 'home';

        // Check sessionStorage to prevent duplicate token burns on refresh
        const alreadyProcessed = typeof window !== 'undefined'
            ? sessionStorage.getItem(sessionKey) === 'processed'
            : false;

        // Determine if we should process (burn token):
        // 1. If navigating from home page (isFromHome = true) AND not already processed -> burn token
        // 2. If already processed in this session -> don't burn (refresh scenario)
        // 3. If not from home but not processed -> don't burn (direct navigation, but we'll check DB first)
        // The key is: only burn token on first visit from home, never on refresh
        const shouldProcess = isFromHome && !alreadyProcessed;

        let isCancelled = false;
        setIsLoading(true);
        setError(null);
        setVideoRecord(null);
        setIsNewAnalysis(null);

        const fetchVideo = async () => {
            try {
                // Always try to fetch existing video first (even on refresh)
                // Pass shouldProcess flag to determine if token should be burned
                const response = await createOrGetVideo(
                    videoId as string,
                    user.id,
                    shouldProcess
                );

                if (isCancelled) {
                    setIsLoading(false);
                    return;
                }

                if (!response.success) {
                    setVideoRecord(null);
                    setIsNewAnalysis(null);
                    setError(response.error ?? "Unable to load analysis status.");
                } else {
                    // IMPORTANT: Handle isNew status first to show amber status on first visit
                    // Set isNewAnalysis based on response
                    if (response.isNew === true) {
                        setIsNewAnalysis(true);
                        // Mark as processed in sessionStorage immediately to prevent duplicate burns
                        if (typeof window !== 'undefined') {
                            sessionStorage.setItem(sessionKey, 'processed');
                        }
                    } else {
                        // On refresh or existing video, set isNewAnalysis to false
                        // This ensures green status shows on refresh, not amber
                        setIsNewAnalysis(false);
                    }

                    // Set video record (may be null if just created and DB is syncing)
                    setVideoRecord(response.data ?? null);
                    setError(null);
                }
            } catch (err) {
                if (isCancelled) {
                    setIsLoading(false);
                    return;
                }
                console.error("Failed to load analysis status", err);
                setVideoRecord(null);
                setIsNewAnalysis(null);
                setError("Unexpected error while loading analysis status.");
            } finally {
                if (!isCancelled) {
                    setIsLoading(false);
                }
            }
        }

        fetchVideo();

        return () => {
            isCancelled = true;
        }

    }, [videoId, user?.id, searchParams]);

    // Check sessionStorage for processed status (used in status display)
    const sessionKey = typeof window !== 'undefined' && user?.id ? `analysis_${user.id}_${videoId}` : null;
    const wasProcessedInSession = typeof window !== 'undefined' && sessionKey
        ? sessionStorage.getItem(sessionKey) === 'processed'
        : false;

    // Analysis Video Status Component - Only 3 stages: Loading, Error (Red), Green
    const AnalysisVideoStatus = (() => {
        // Stage 1: Loading state - show loading indicator with pulse animation
        if (isLoading) {
            return (
                <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-gray-50 border border-gray-200 rounded-full">
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-pulse" />
                    <span className="text-sm text-gray-700">Loading analysis status…</span>
                </div>
            );
        }

        // Stage 2: Error state - show error message (RED STATUS)
        if (error) {
            return (
                <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-red-50 border border-red-200 rounded-full">
                    <div className="w-2 h-2 bg-red-400 rounded-full" />
                    <span className="text-sm text-red-700">{error}</span>
                </div>
            );
        }

        // Stage 3: Green status - show for both first visit and refresh
        // First visit: Show token burn message
        // Refresh: Show existing analysis message
        if (isNewAnalysis === true) {
            // First time visit - show green with token burn message
            return (
                <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-green-50 border border-green-200 rounded-full">
                    <div className="w-2 h-2 bg-green-400 rounded-full" />
                    <span className="text-sm text-green-700">
                        This is your first time analyzing this video – your 1 token burn.
                        <br />
                        <span className="font-semibold">1 analysis token is being used!</span>
                    </span>
                </div>
            );
        }

        // Refresh or existing video - show green with existing message
        if (videoRecord || wasProcessedInSession) {
            return (
                <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-green-50 border border-green-200 rounded-full">
                    <div className="w-2 h-2 bg-green-400 rounded-full" />
                    <p className="text-sm text-green-700">
                        Analysis exists for this video – no additional tokens needed in future calls!
                    </p>
                </div>
            );
        }

        // Fallback: No analysis found (should not show if user navigates from home)
        return (
            <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-gray-50 border border-gray-200 rounded-full">
                <div className="w-2 h-2 bg-gray-400 rounded-full" />
                <span className="text-sm text-gray-700">
                    No analysis found. Navigate from home page to analyze this video.
                </span>
            </div>
        );
    })();




    return (
        <div className='xl:container mx-auto px-4 md:px-0'>
            <div className='grid grid-cols-1 lg:grid-cols-2 gap-4'>
                {/* Left Side */}
                <div className='order-2 lg:order-1 flex flex-col gap-4 bg-white lg:border-r border-gray-200 p-6'>
                    {/* Analysis Content */}
                    <div className='flex flex-col gap-4 p-4 border border-gray-200 rounded-xl'>
                        <Usage
                            featureFlag={FeatureFlag.ANALYSE_VIDEO}
                            title="Analysis Video "
                        />

                        {/* Analysis Video Status */}
                        {AnalysisVideoStatus}
                    </div>


                    {/* YouTube Video details  */}
                    <YoutubeVideoDetails videoId={videoId} />
                    {/* Thumbnail Generation */}
                    <ThumbnailGeneration videoId={videoId} />

                    {/* Title Generation */}
                    <TitleGeneration videoId={videoId} />


                    {/* Transcript Generation */}
                    <Transcription videoId={videoId} />
                </div>


                {/* Right side */}
                <div className='order-1 lg:order-2 lg:sticky lg:top-20 h-[500px] md:h-[calc(100vh-6rem)]'>
                    {/* Ai agent chat Section */}
                    <AiAgentChat videoId={videoId} />
                </div>
            </div>
        </div>
    )
}

export default AnalysisPage