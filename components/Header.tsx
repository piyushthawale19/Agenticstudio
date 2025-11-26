"use client";

import Link from "next/link";
import AgentPulse from "./AgentPluse";
import { SignedIn, SignedOut, SignInButton, UserButton } from "@clerk/nextjs";
import { Button } from "./ui/button";

function Header() {
    return (
        <header className="sticky top-0  left-0 right-0 md:px-4 py-2 bg-white/70 backdrop-blur-sm border-b border-gray-200 z-50">
            <div className="container mx-auto ">
                <div className="flex items-center justify-between h-16">


                    {/* left */}
                    <div className="flex items-center justify-between h-16">
                        <Link href="/" className="flex items-center gap-4">
                            <AgentPulse size="small" color="purple" />
                            <h1 className="text-xl font-semibold bg-gradient-to-r from-purple-600 to-purple-400 bg-clip-text text-transparent">
                                AgentTube
                            </h1>
                        </Link>
                    </div>
                    {/* Right */}
                    <div className="flex items-center gap-4">
                        <SignedIn>
                            <Link href="/manage-plan">
                                <Button
                                    variant="outline"
                                    className="mr-4 bg-gradient-to-r from-purple-600 to-purple-400
                              text-transparent bg-clip-text cursor-pointer  border-purple-100 border-2 hover:border-purple-200 hover:text-purple-400 transition-colors duration-300 ease-in-out"
                                >
                                    Manage Plan
                                </Button>
                            </Link>
                            <div className="p-2 w-10 flex items-center justify-center rounded-full hover:bg-purple-100  bg-purple-50 cursor-pointer">
                                <UserButton />
                            </div>
                        </SignedIn>

                        <SignedOut>
                            <SignInButton mode="modal" >
                                <Button variant="ghost"
                                    className="mr-4 bg-gradient-to-r from-purple-600 to-purple-400
                              text-transparent bg-clip-text cursor-pointer  border-purple-100 border-2 hover:border-purple-200 hover:text-purple-400 transition-colors duration-300 ease-in-out"

                                >Sign In</Button>
                            </SignInButton>
                        </SignedOut>
                    </div>
                </div>
            </div>
        </header>
    );
}

export default Header;
