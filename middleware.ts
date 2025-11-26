import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";

// /video/jfhsdjfyjk/analysis protected page
const isProtectedRoute = createRouteMatcher(["/video(.*)"]);

export default clerkMiddleware(async (auth, req) => {
  const { userId, redirectToSignIn } = await auth();

  if (!userId && isProtectedRoute(req)) {
    return redirectToSignIn();
  }
});

export const config = {
  matcher: [
    // Skip Next.js internals and all static files, unless found in search params
    "/((?!_next|[^.]*\\..*).*)",
    // Always run for API routes
    "/(api|trpc)(.*)",
  ],
};