"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/ThemeToggle";

export function Header() {
  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-16 items-center justify-between">
        <Link href="/" className="flex items-center gap-3 group">
          <span className="h-2 w-2 bg-primary transition-transform group-hover:scale-150"></span>
          <span className="font-body text-sm font-bold uppercase tracking-[0.2em] text-foreground">
            Testimonial CMS
          </span>
        </Link>

        <nav className="flex items-center gap-6">
          <Link 
            href="#producto" 
            className="hidden font-body text-xs font-medium uppercase tracking-widest text-muted-foreground transition-colors hover:text-foreground sm:inline"
          >
            Producto
          </Link>
          <Link 
            href="#precios" 
            className="hidden font-body text-xs font-medium uppercase tracking-widest text-muted-foreground transition-colors hover:text-foreground sm:inline"
          >
            Precios
          </Link>
          <Link 
            href="/admin/login" 
            className="font-body text-xs font-medium uppercase tracking-widest text-muted-foreground transition-colors hover:text-foreground"
          >
            Login
          </Link>
          <Button asChild size="sm" className="h-9 bg-primary px-5 font-body text-xs uppercase tracking-wider text-primary-foreground hover:bg-primary/90">
            <Link href="/admin/register">Comenzar</Link>
          </Button>
          <ThemeToggle />
        </nav>
      </div>
    </header>
  );
}
