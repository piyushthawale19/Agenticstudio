"use server";

import { getVideoIdFromUrl } from "@/lib/getVideoldFromUrl";
import { redirect } from "next/navigation";

export async function analyseYoutubeVideo(formData: FormData) {
  const url = formData.get("url")?.toString();
  if (!url) return;

  const videoId = getVideoIdFromUrl(url); 
  // console.log("Extracted video ID:>>>>>>>>", videoId);
  if (!videoId) return;

  // Redirect to the analysis page with from=home parameter
  redirect(`/video/${videoId}/analysis?from=home`);
}
