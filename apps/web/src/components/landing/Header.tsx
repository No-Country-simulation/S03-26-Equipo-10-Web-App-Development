"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/ThemeToggle";

export function Header() {
  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-14 items-center justify-between">
        <div className="flex items-center space-x-4">
          <Link href="/" className="font-bold flex items-center gap-2">
            <span className="bg-primary text-primary-foreground px-2 py-0.5 rounded-sm">Testimonial</span>
            CMS
          </Link>
        </div>

        <nav className="flex items-center space-x-4">
          <Link href="/admin/login" className="text-sm font-medium hover:underline underline-offset-4">
            Login
          </Link>
          <Button asChild variant="default" size="sm">
            <Link href="/admin/register">Get Started</Link>
          </Button>
          <ThemeToggle />
        </nav>
      </div>
    </header>
  );
}
