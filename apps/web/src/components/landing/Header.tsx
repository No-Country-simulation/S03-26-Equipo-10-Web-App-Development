"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/ThemeToggle";
import { useSession } from "@/hooks/use-session";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { User, LogOut, LayoutDashboard, MessageSquareQuote, KeyRound, Webhook } from "lucide-react";

export function Header() {
  const { session, logout } = useSession({ redirectTo: null });
  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-16 items-center justify-between">
        <Link href="/" className="flex items-center gap-3 group">
          <img 
            src="/favicon.ico" 
            alt="Testimonial CMS Logo" 
            className="h-6 w-6 transition-transform duration-300 group-hover:scale-110 group-hover:rotate-6"
          />
          <span className="font-body text-sm font-bold uppercase tracking-[0.2em] text-foreground transition-all duration-300 group-hover:underline group-hover:underline-offset-4">
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
          {session ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="icon" className="h-9 w-9 rounded-full border-border bg-background hover:bg-muted">
                  <User className="h-4 w-4 text-foreground" />
                  <span className="sr-only">Menú de usuario</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56 font-body rounded-none border-border">
                <DropdownMenuLabel className="font-normal">
                  <div className="flex flex-col space-y-1">
                    <p className="text-sm font-medium leading-none">Mi Perfil</p>
                    <p className="text-xs leading-none text-muted-foreground truncate">
                      {session.user.email}
                    </p>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild className="cursor-pointer rounded-none">
                  <Link href="/admin">
                    <LayoutDashboard className="mr-2 h-4 w-4" />
                    <span>Panel de Control</span>
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild className="cursor-pointer rounded-none">
                  <Link href="/admin/testimonials">
                    <MessageSquareQuote className="mr-2 h-4 w-4" />
                    <span>Testimonios</span>
                  </Link>
                </DropdownMenuItem>
                {session.user.roles.includes('admin') && (
                  <>
                    <DropdownMenuItem asChild className="cursor-pointer rounded-none">
                      <Link href="/admin/api-keys">
                        <KeyRound className="mr-2 h-4 w-4" />
                        <span>API Keys</span>
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild className="cursor-pointer rounded-none">
                      <Link href="/admin/webhooks">
                        <Webhook className="mr-2 h-4 w-4" />
                        <span>Webhooks</span>
                      </Link>
                    </DropdownMenuItem>
                  </>
                )}
                <DropdownMenuSeparator />
                <DropdownMenuItem 
                  onClick={logout}
                  className="cursor-pointer text-destructive focus:text-destructive focus:bg-destructive/10 rounded-none"
                >
                  <LogOut className="mr-2 h-4 w-4" />
                  <span>Cerrar Sesión</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <>
              <Link 
                href="/admin/login" 
                className="font-body text-xs font-medium uppercase tracking-widest text-muted-foreground transition-colors hover:text-foreground"
              >
                Login
              </Link>
              <Button asChild size="sm" className="h-9 bg-primary px-5 font-body text-xs uppercase tracking-wider text-primary-foreground hover:bg-primary/90">
                <Link href="/admin/register">Comenzar</Link>
              </Button>
            </>
          )}
          <ThemeToggle />
        </nav>
      </div>
    </header>
  );
}
