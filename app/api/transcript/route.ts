import { NextResponse } from "next/server";
import {
  TranscriptUnavailableError,
  getYoutubeTranscript,
} from "@/actions/getYoutubeTranscript";

export async function POST(req: Request) {
  try {
    const { videoId, shouldProcess } = await req.json();

    if (!videoId || typeof videoId !== "string") {
      return NextResponse.json(
        { error: "A valid videoId is required" },
        { status: 400 }
      );
    }

    const result = await getYoutubeTranscript(videoId, {
      trackUsage: shouldProcess !== false,
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error("/api/transcript error", error);

    if (error instanceof TranscriptUnavailableError) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }

    return NextResponse.json(
      { error: "Failed to fetch transcript" },
      { status: 500 }
    );
  }
}
