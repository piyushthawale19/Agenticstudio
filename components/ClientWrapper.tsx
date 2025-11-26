'use client';

// import { ClerkProvider } from "@clerk/nextjs";
import { SchematicProvider } from "@schematichq/schematic-react";
import SchematicWrapper from "./SchematicWrapper";
import { ConvexClientProvider } from "./ConvexClientProvider";
// import "@/lib/i18n";

export default function ClientWrapper({
    children,
}: Readonly<{
    children: React.ReactNode;
}>) {
    const schematicPubKey = process.env.NEXT_PUBLIC_SCHEMATIC_PUBLISHABLE_KEY;
    const clerkPubKey = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;

    if (!schematicPubKey) {
        throw new Error(
            "No Schematic Publishable Key found. Please add it to your .env.local file."
        );
    }

    if (!clerkPubKey) {
        throw new Error(
            "No Clerk Publishable Key found. Please add it to your .env.local file."
        );
    }

    return (
        <ConvexClientProvider>
            <SchematicProvider publishableKey={schematicPubKey}>
                <SchematicWrapper>
                    {children}
                </SchematicWrapper>
            </SchematicProvider>
        </ConvexClientProvider>
    );
}
