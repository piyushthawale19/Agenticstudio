"use client ";

import { ReactNode } from "react";
import { ClerkProvider, useAuth } from "@clerk/nextjs";
import { ConvexProviderWithClerk } from "convex/react-clerk";
import { ConvexReactClient } from "convex/react";

export const convex = new ConvexReactClient(
    process.env.NEXT_PUBLIC_CONVEX_URL!
);

export function ConvexClientProvider({ children }: { children: ReactNode }) {
    // Wrap Convex with Clerk so auth context is ready for any client components.
    return (
    <ClerkProvider afterSignOutUrl="/" >
        <ConvexProviderWithClerk useAuth={useAuth} client={convex}>
            {children}
        </ConvexProviderWithClerk>
    </ClerkProvider>
    );
}