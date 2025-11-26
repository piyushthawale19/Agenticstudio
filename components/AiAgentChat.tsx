"use client";

import { useChat } from "@ai-sdk/react";
import Image from "next/image";
import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import { Button } from "./ui/button";
import { FeatureFlag } from "@/features/flags";
import { useSchematicFlag } from "@schematichq/schematic-react";
import { FileText, Pen, Image as IconImage, BotIcon } from "lucide-react";
import { toast } from "sonner";
// import { useEffect } from "react";

type ChannelSnapshot = {
    title?: string;
    thumbnail?: string;
    subscribers?: string;
};

type VideoDetailsPayload = {
    title?: string;
    thumbnail?: string;
    publishedAt?: string;
    views?: string;
    likes?: string;
    comments?: string;
    channel?: ChannelSnapshot;
};

type GenerateImagePayload = {
    image?: {
        imageUrl?: string;
        storageId?: string;
    };
    message?: string;
    error?: string;
};

type GenerateTitlePayload = {
    title?: string;
    message?: string;
    error?: string;
};

interface ToolInvocation {
    toolCallId: string;
    toolName: string;
    result?: Record<string, unknown>;
}

interface ToolPart {
    type: "tool-invocation";
    toolInvocation: ToolInvocation;
}

const friendlyNumber = (value?: string | number) => {
    const numericValue = typeof value === "string" ? Number(value) : value;
    if (!Number.isFinite(numericValue as number)) {
        return value ?? "–";
    }
    return new Intl.NumberFormat("en", {
        notation: "compact",
        maximumFractionDigits: 1,
    }).format(numericValue as number);
};

const friendlyDate = (iso?: string) => {
    if (!iso) return "Unknown";
    const parsed = new Date(iso);
    if (Number.isNaN(parsed.getTime())) {
        return iso;
    }
    return parsed.toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
        year: "numeric",
    });
};

const deriveFriendlyError = (err?: Error) => {
    if (!err) return null;
    const message = err.message || "";
    const lower = message.toLowerCase();
    if (lower.includes("model is overloaded") || lower.includes("503") || lower.includes("unavailable")) {
        return "The AI model is busy right now. Please wait a few seconds and try again.";
    }
    if (lower.includes("rate limit")) {
        return "We’re hitting a temporary rate limit. Slow down for a moment and retry.";
    }
    return message || "Something went wrong while generating the response. Please try again.";
};

function AiAgentChat({ videoId }: { videoId: string }) {
    const { messages, sendMessage, error, setMessages, status } = useChat({
        api: "/api/chat",
        body: { videoId },
        headers: {
            "x-video-id": videoId,
        },
        fetch: async (input: RequestInfo, init?: RequestInit) => {
            let updatedBody = init?.body;

            if (typeof updatedBody === "string") {
                try {
                    const parsed = JSON.parse(updatedBody);
                    if (!parsed.videoId) {
                        parsed.videoId = videoId;
                    }
                    updatedBody = JSON.stringify(parsed);
                } catch {
                    // Ignore JSON parse errors and send body untouched
                }
            }

            const headers = new Headers(init?.headers || {});
            headers.set("x-video-id", videoId);

            return fetch(input, {
                ...init,
                headers,
                body: updatedBody,
            });
        },
        onError: (err: unknown) => console.error("Chat error:", err),
    } as any);

    const [input, setInput] = useState("");
    const scrollAnchorRef = useRef<HTMLDivElement | null>(null);
    const lastErrorSignatureRef = useRef<string | null>(null);
    const friendlyError = useMemo(() => deriveFriendlyError(error), [error]);

    useEffect(() => {
        if (!error) {
            lastErrorSignatureRef.current = null;
            return;
        }
        console.error("AiAgentChat error", error);
    }, [error]);

    useEffect(() => {
        if (!error) return;
        const signature = `${error.name ?? "Error"}:${error.message ?? ""}`;
        if (signature === lastErrorSignatureRef.current) {
            return;
        }
        lastErrorSignatureRef.current = signature;
        const fallbackText = `## Quick pause ⚠️

${friendlyError || "The AI model couldn't respond just now."}

I'm still tracking this video${videoId ? ` (${videoId})` : ""}, so give it a few seconds and try again or break the request into smaller questions.`;
        setMessages((prev) => [
            ...prev,
            {
                id: `fallback-${Date.now()}`,
                role: "assistant",
                parts: [{ type: "text", text: fallbackText }],
            },
        ]);
    }, [error, friendlyError, setMessages, videoId]);

    useEffect(() => {
        if (!scrollAnchorRef.current) return;
        // Keep newest chat activity in view without manual scrolling.
        scrollAnchorRef.current.scrollIntoView({ behavior: "smooth", block: "end" });
    }, [messages]);

    const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        if (!input.trim()) return;
        sendMessage({
            text: input,
            data: { videoId }
        } as any);
        setInput("");
    };

    const isScriptGenerationEnabled = useSchematicFlag(
        FeatureFlag.SCRIPT_GENERATION
    );

    const isImageGenerationEnabled = useSchematicFlag(
        FeatureFlag.IMAGE_GENERATION
    );

    const isTitleGenerationEnabled = useSchematicFlag(
        FeatureFlag.TITLE_GENERATIONS
    );

    const isVideoAnalysisEnabled = useSchematicFlag(FeatureFlag.ANALYSE_VIDEO);

    useEffect(() => {
        let toastId: string | number | undefined;

        switch (status) {
            case "submitted":
                toastId = toast("Agent is thinking....", {
                    id: toastId,
                    icon: <BotIcon className="w-4 h-4" />,
                });
                break;
            case "streaming":
                toastId = toast("Agent is replying....", {
                    id: toastId,
                    icon: <BotIcon className="w-4 h-4" />,
                });
                break;
            case "error":
                toastId = toast("Whoops : Something went wrong, Please Try Again!!", {
                    id: toastId,
                    icon: <BotIcon className="w-4 h-4" />
                });
                break;
            case "ready":
                toast.dismiss(toastId);
                break;
        }
    }, [status]);

    const generateScript = async () => {
        const scriptPrompt = "Generate a step-by-step shooting script for this video that I can use on my own channel to produce a video that is similar to this one, dont do any other steps such as generating a image, just generate the script only";
        sendMessage({
            text: scriptPrompt,
            data: { videoId }
        } as any);
    };

    const generateTitle = async () => {
        const titlePrompt = "Generate a title for this video that I can use on my own channel to produce a video that is similar to this one, dont do any other steps such as generating a image, just generate the title only";
        sendMessage({
            text: titlePrompt,
            data: { videoId }
        } as any);
    };

    const generateImage = async () => {
        const imagePrompt = "Generate a thumbnail image for this video that I can use on my own channel to produce a video that is similar to this one, dont do any other steps such as generating a title, just generate the image only";
        sendMessage({
            text: imagePrompt,
            data: { videoId }
        } as any);
    };


    return (
        <div className="flex flex-col h-full">
            <div className="hidden lg:block px-4 pb-3 border-b border-gray-200 pt-3">
                <h2 className="text-lg font-semibold text-gray-800">AI Agent Chat</h2>
            </div>

            <div className="flex-1 overflow-y-auto px-4 py-4">
                <div className="space-y-6">
                    {messages.length === 0 && !friendlyError && (
                        <div className="flex items-center justify-center h-full min-h-[200px]">
                            <div className="text-center space-y-2">
                                <h3 className="text-lg font font-medium text-gray-700">
                                    Welcome to AI Agent Chat
                                </h3>
                                <p className="text-sm text-gray-500">
                                    Ask any question about your video!
                                </p>
                            </div>
                        </div>
                    )}

                    {friendlyError && (
                        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                            <p className="text-red-700 text-sm">{friendlyError}</p>
                        </div>
                    )}

                    {messages.map((m) => (
                        <div
                            key={m.id}
                            className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}
                        >
                            <div
                                className={`max-w-[80%] rounded-lg px-4 py-2 ${m.role === "user"
                                    ? "bg-purple-500 text-white"
                                    : "bg-gray-100 text-gray-900"
                                    }`}
                            >
                                {m.parts ? (
                                    m.parts.map((part, index) => {
                                        if (part.type === "tool-invocation") {
                                            const toolPart = part as unknown as ToolPart;
                                            const toolName = toolPart.toolInvocation?.toolName;
                                            const toolResult = toolPart.toolInvocation?.result as
                                                | GenerateImagePayload
                                                | GenerateTitlePayload
                                                | { videoDetails?: VideoDetailsPayload }
                                                | undefined;

                                            if (toolName === "generateImage") {
                                                const hasImage = Boolean((toolResult as GenerateImagePayload | undefined)?.image?.imageUrl);
                                                return (
                                                    <div
                                                        key={`tool-${m.id}-${index}`}
                                                        className="mt-3 rounded-xl bg-white/80 p-3 text-gray-900 shadow-sm"
                                                    >
                                                        <p className="text-xs font-semibold uppercase tracking-wide text-fuchsia-600">
                                                            Thumbnail Generated
                                                        </p>
                                                        {!toolResult && (
                                                            <p className="mt-2 text-sm font-semibold text-gray-700">
                                                                <strong>Hang tight ⏳</strong> Thumbnail is generating...
                                                            </p>
                                                        )}
                                                        {((toolResult as GenerateImagePayload | GenerateTitlePayload | undefined)?.message) && (
                                                            <p className="mt-1 text-sm text-gray-800">
                                                                {(toolResult as GenerateImagePayload | GenerateTitlePayload).message}
                                                            </p>
                                                        )}
                                                        {((toolResult as GenerateImagePayload | GenerateTitlePayload | undefined)?.error) && (
                                                            <p className="mt-2 rounded bg-red-50 px-3 py-2 text-xs text-red-600">
                                                                {(toolResult as GenerateImagePayload | GenerateTitlePayload).error}
                                                            </p>
                                                        )}
                                                        {hasImage && (
                                                            <div className="mt-3 overflow-hidden rounded-lg border border-gray-200">
                                                                <Image
                                                                    src={(toolResult as GenerateImagePayload).image!.imageUrl!}
                                                                    alt="Generated thumbnail preview"
                                                                    width={360}
                                                                    height={180}
                                                                    className="h-auto w-full object-cover"
                                                                    unoptimized
                                                                />
                                                            </div>
                                                        )}
                                                        <p className="mt-2 text-xs text-gray-600">
                                                            {hasImage ? (
                                                                <span>
                                                                    Saved automatically under <strong>Thumbnail Generation</strong> for video <strong>{videoId}</strong>. Grab it there anytime 👇
                                                                </span>
                                                            ) : (
                                                                <span>
                                                                    We’ll drop it into <strong>Thumbnail Generation</strong> as soon as it finishes rendering.
                                                                </span>
                                                            )}
                                                        </p>
                                                    </div>
                                                );
                                            }

                                            if (toolName === "generateTitle") {
                                                const generatedTitle = (toolResult as { title?: string })?.title;
                                                const statusMessage = (toolResult as { message?: string })?.message;
                                                const errorMessage = (toolResult as { error?: string })?.error;
                                                return (
                                                    <div
                                                        key={`tool-${m.id}-${index}`}
                                                        className="mt-3 rounded-xl bg-white/80 p-3 text-gray-900 shadow-sm"
                                                    >
                                                        <p className="text-xs font-semibold uppercase tracking-wide text-emerald-600">
                                                            Title Crafted
                                                        </p>
                                                        {!toolResult && (
                                                            <p className="mt-2 text-sm font-semibold text-gray-700">
                                                                <strong>Hang tight ✍️</strong> Brainstorming the perfect hook...
                                                            </p>
                                                        )}
                                                        {generatedTitle && (
                                                            <div className="mt-3 rounded-lg border border-emerald-100 bg-white/90 p-3">
                                                                <p className="text-base font-semibold text-gray-900">
                                                                    {generatedTitle}
                                                                </p>
                                                                <p className="mt-1 text-xs text-gray-500">
                                                                    Drop this into your video planner or tweak a word for your brand voice.
                                                                </p>
                                                            </div>
                                                        )}
                                                        {statusMessage && (
                                                            <p className="mt-2 text-xs text-gray-600">
                                                                {statusMessage}
                                                            </p>
                                                        )}
                                                        {errorMessage && (
                                                            <p className="mt-2 rounded bg-red-50 px-3 py-2 text-xs text-red-600">
                                                                {errorMessage}
                                                            </p>
                                                        )}
                                                        {!generatedTitle && toolResult && !errorMessage && (
                                                            <p className="mt-2 text-xs text-gray-600">
                                                                Title request finished but no text returned—try again or tweak the prompt.
                                                            </p>
                                                        )}
                                                        {generatedTitle && (
                                                            <p className="mt-2 text-xs text-gray-500">
                                                                Saved automatically under <strong>Titles</strong> for video <strong>{videoId}</strong> so you can reuse it anytime.
                                                            </p>
                                                        )}
                                                    </div>
                                                );
                                            }

                                            if (toolName === "getVideoDetails") {
                                                const videoDetails = (toolResult as { videoDetails?: VideoDetailsPayload })?.videoDetails;
                                                return (
                                                    <div
                                                        key={`tool-${m.id}-${index}`}
                                                        className="mt-3 rounded-xl bg-white/80 p-3 text-gray-900 shadow-sm"
                                                    >
                                                        <p className="text-xs font-semibold uppercase tracking-wide text-indigo-600">
                                                            Video Snapshot
                                                        </p>
                                                        {!videoDetails ? (
                                                            <p className="mt-2 text-sm font-semibold text-gray-700">
                                                                <strong>Fetching details…</strong> Give me a sec while I pull the latest stats.
                                                            </p>
                                                        ) : (
                                                            <div className="mt-3 space-y-3">
                                                                <div className="flex gap-3">
                                                                    {videoDetails.thumbnail && (
                                                                        <div className="relative h-20 w-32 overflow-hidden rounded-md border border-gray-200">
                                                                            <Image
                                                                                src={videoDetails.thumbnail}
                                                                                alt={videoDetails.title ?? "Video thumbnail"}
                                                                                fill
                                                                                className="object-cover"
                                                                                sizes="128px"
                                                                                unoptimized
                                                                            />
                                                                        </div>
                                                                    )}
                                                                    <div className="flex-1">
                                                                        <p className="text-sm font-semibold text-gray-900">
                                                                            {videoDetails.title ?? "Untitled video"}
                                                                        </p>
                                                                        <p className="text-xs text-gray-500">
                                                                            Published {friendlyDate(videoDetails.publishedAt)} • {friendlyNumber(videoDetails.views)} views
                                                                        </p>
                                                                    </div>
                                                                </div>
                                                                <div className="grid grid-cols-3 gap-2 text-center text-xs">
                                                                    <div className="rounded-lg bg-gray-50 p-2">
                                                                        <p className="text-[11px] uppercase text-gray-500">Likes</p>
                                                                        <p className="text-sm font-semibold text-gray-900">{friendlyNumber(videoDetails.likes)}</p>
                                                                    </div>
                                                                    <div className="rounded-lg bg-gray-50 p-2">
                                                                        <p className="text-[11px] uppercase text-gray-500">Comments</p>
                                                                        <p className="text-sm font-semibold text-gray-900">{friendlyNumber(videoDetails.comments)}</p>
                                                                    </div>
                                                                    <div className="rounded-lg bg-gray-50 p-2">
                                                                        <p className="text-[11px] uppercase text-gray-500">Channel Subs</p>
                                                                        <p className="text-sm font-semibold text-gray-900">{friendlyNumber(videoDetails.channel?.subscribers)}</p>
                                                                    </div>
                                                                </div>
                                                                {videoDetails.channel && (
                                                                    <div className="flex items-center gap-2 rounded-lg bg-gradient-to-r from-indigo-50 to-white p-2">
                                                                        {videoDetails.channel.thumbnail && (
                                                                            <div className="relative h-8 w-8 overflow-hidden rounded-full border border-white/70">
                                                                                <Image
                                                                                    src={videoDetails.channel.thumbnail}
                                                                                    alt={videoDetails.channel.title ?? "Channel avatar"}
                                                                                    fill
                                                                                    className="object-cover"
                                                                                    sizes="32px"
                                                                                    unoptimized
                                                                                />
                                                                            </div>
                                                                        )}
                                                                        <div>
                                                                            <p className="text-xs font-semibold text-gray-900">{videoDetails.channel.title ?? "Unknown channel"}</p>
                                                                            <p className="text-[11px] uppercase tracking-wide text-gray-500">Channel overview</p>
                                                                        </div>
                                                                    </div>
                                                                )}
                                                            </div>
                                                        )}
                                                    </div>
                                                );
                                            }

                                            return (
                                                <div
                                                    key={`tool-${m.id}-${index}`}
                                                    className="mt-2 rounded-lg bg-white/70 p-3 text-gray-900"
                                                >
                                                    <p className="text-xs font-semibold uppercase tracking-wide text-gray-600">
                                                        {toolName || "Tool Response"}
                                                    </p>
                                                    {toolResult ? (
                                                        <pre className="mt-2 max-h-40 overflow-auto whitespace-pre-wrap rounded bg-white/90 p-2 text-xs">
                                                            {JSON.stringify(toolResult, null, 2)}
                                                        </pre>
                                                    ) : (
                                                        <p className="text-xs text-gray-700 mt-2">
                                                            Waiting for tool output...
                                                        </p>
                                                    )}
                                                </div>
                                            );
                                        }

                                        if (part.type !== "text") {
                                            return null;
                                        }

                                        if (m.role === "assistant") {
                                            return (
                                                <div
                                                    key={`text-${m.id}-${index}`}
                                                    className="prose prose-sm whitespace-pre-wrap"
                                                >
                                                    <ReactMarkdown>
                                                        {part.text || ""}
                                                    </ReactMarkdown>
                                                </div>
                                            );
                                        }

                                        return (
                                            <p key={`text-${m.id}-${index}`} className="whitespace-pre-wrap text-sm">
                                                {part.text}
                                            </p>
                                        );
                                    })
                                ) : (
                                    <p className="whitespace-pre-wrap text-sm">
                                        {(m as { text?: string }).text || ""}
                                    </p>
                                )}
                            </div>
                        </div>
                    ))}
                    <div ref={scrollAnchorRef} />
                </div>
            </div>

            <div className="border-t border-gray-200 p-4 bg-white">
                <form onSubmit={handleSubmit} className="flex gap-2">
                    <input
                        className="flex-1 px-4 py-2 text-sm border border-gray-200 rounded-full focus:outline-none focus:ring-2 focus:ring-fuchsia-500 focus:border-transparent"
                        type="text"
                        value={input}
                        onChange={(event) => setInput(event.target.value)}
                        placeholder={
                            !isVideoAnalysisEnabled ? "Upgrade to ask anything about your video...." : "Ask anything about your video...."
                        }
                    />

                    <Button
                        type="submit"
                        className="cursor-pointer px-4 py-2 bg-purple-500 text-white text-sm rounded-full hover:bg-purple-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        disabled={(status === "streaming" || status === "submitted") || !isVideoAnalysisEnabled || !input.trim()}
                    >
                        {status === "streaming" ? "AI is replying..."
                            : status === "submitted" ? "AI is thinking..."
                                : "Send"}
                    </Button>
                </form>
                <div className="flex gap-2 mt-2">
                    <button
                        className="text-xs xl:text-sm w-full flex items-center justify-center gap-2 py-2 px-4
               bg-gray-100 hover:bg-gray-200 rounded-full transition-colors
               disabled:opacity-50 disabled:cursor-not-allowed"
                        onClick={generateScript}
                        type="button"
                        disabled={!isScriptGenerationEnabled || status === "streaming" || status === "submitted"}
                    >
                        <FileText className="h-4 w-4" />
                        {isScriptGenerationEnabled ? (
                            <span>Generate Script</span>
                        ) : (
                            <span>Upgrade to generate a script</span>
                        )}
                    </button>
                    <button
                        className="text-xs xl:text-sm w-full flex items-center justify-center gap-2 py-2 px-4
               bg-gray-100 hover:bg-gray-200 rounded-full transition-colors
               disabled:opacity-50 disabled:cursor-not-allowed"
                        onClick={generateTitle}
                        type="button"
                        disabled={!isTitleGenerationEnabled || status === "streaming" || status === "submitted"}
                    >
                        <Pen className="h-4 w-4" />
                        {isTitleGenerationEnabled ? (
                            <span>Generate Title</span>
                        ) : (
                            <span>Upgrade to generate a title</span>
                        )}
                    </button>
                    <button
                        className="text-xs xl:text-sm w-full flex items-center justify-center gap-2 py-2 px-4
               bg-gray-100 hover:bg-gray-200 rounded-full transition-colors
               disabled:opacity-50 disabled:cursor-not-allowed"
                        onClick={generateImage}
                        type="button"
                        disabled={!isImageGenerationEnabled || status === "streaming" || status === "submitted"}
                    >
                        <IconImage className="h-4 w-4" />
                        {isImageGenerationEnabled ? (
                            <span>Generate Image</span>
                        ) : (
                            <span>Upgrade to generate an image</span>
                        )}
                    </button>
                </div>

            </div>
        </div>
    );
}

export default AiAgentChat;
