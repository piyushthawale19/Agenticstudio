"use server";

import { google } from 'googleapis';
import { VideoDetails } from '@/types/types';

const youtube = google.youtube({
    version: 'v3',
    auth: process.env.YOUTUBE_API_KEY,
});
export async function getVideoDetails(videoId: string) {
    if (!videoId) {
        console.error("❌ No videoId provided");
        return null;
    }

    console.log("🔍 Starting getVideoDetails for:", videoId);

    try {
        const videoResponse = await youtube.videos.list({
            part: ["statistics", "snippet"],
            id: [videoId],
        });

        console.log("📹 YouTube API response received");

        const videoDetails = videoResponse.data.items?.[0];

        if (!videoDetails) {
            console.error("❌ No video found for ID:", videoId);
            throw new Error("Video not found");
        }

        console.log("✅ Video found:", videoDetails.snippet?.title);

        const channelResponse = await youtube.channels.list({
            part: ["snippet", "statistics"],
            id: [videoDetails.snippet?.channelId || ""],
        });

        const channnelDetails = channelResponse.data.items?.[0];

        // console.log("📺 Video details fetched:", videoDetails);

        const video: VideoDetails = {
            // Video Info
            title: videoDetails.snippet?.title || "Unknown Title",
            thumbnail:
                videoDetails.snippet?.thumbnails?.maxres?.url ||
                videoDetails.snippet?.thumbnails?.high?.url ||
                videoDetails.snippet?.thumbnails?.default?.url ||
                "",
            publishedAt:
                videoDetails.snippet?.publishedAt || new Date().toISOString(),

            //Video Metrics
            views: videoDetails.statistics?.viewCount || "0",
            likes: videoDetails.statistics?.likeCount || "Not Available",
            comments: videoDetails.statistics?.commentCount || "Not Available",

            //channel Info
            channel: {
                title: channnelDetails?.snippet?.title || "Unknown Channel",
                thumbnail: channnelDetails?.snippet?.thumbnails?.default?.url || "",
                subscribers: channnelDetails?.statistics?.subscriberCount || "0",
            },

        };
        return video;

    } catch (error) {
        console.error("❌ Error fetching video details:", error);
        return null;
    }
}
