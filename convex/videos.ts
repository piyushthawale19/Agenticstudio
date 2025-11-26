import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

export const getVideoById = query({
  args: { videoId: v.string(), userId: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("videos")
      .withIndex("by_user_and_video", (q) =>
        q.eq("userId", args.userId).eq("videoId", args.videoId)
      )
      .unique();
  },
});
export const createVideoEntry = mutation({
  args: {
    videoId: v.string(),
    userId: v.string(),
  },
  handler: async (ctx, args) => {
    const video = await ctx.db.insert("videos", {
      videoId: args.videoId,
      userId: args.userId,
    });

    return video;
  },
});

export const getOrCreateVideo = mutation({
  args: {
    videoId: v.string(),
    userId: v.string(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("videos")
      .withIndex("by_user_and_video", (q) =>
        q.eq("userId", args.userId).eq("videoId", args.videoId)
      )
      .unique();

    if (existing) {
      return { video: existing, created: false };
    }

    const video = await ctx.db.insert("videos", {
      videoId: args.videoId,
      userId: args.userId,
    });

    return { video, created: true };
  },
});

export const deleteVideoById = mutation({
  args: { videoId: v.string(), userId: v.string() },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("videos")
      .withIndex("by_user_and_video", (q) =>
        q.eq("userId", args.userId).eq("videoId", args.videoId)
      )
      .unique();

    if (!existing) return null;

    await ctx.db.delete(existing._id);
    return existing;
  },
});
