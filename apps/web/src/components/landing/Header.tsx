'use client';

import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { ThemeToggle } from '@/components/ThemeToggle';
import { useSession } from '@/hooks/use-session';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  User,
  LogOut,
  LayoutDashboard,
  MessageSquareQuote,
  KeyRound,
  Webhook,
} from 'lucide-react';

export function Header() {
  const { session, logout } = useSession({ redirectTo: null });
  return (
    <>
      <a
        href="#main-content"
        className="sr-only z-[60] bg-background p-4 font-body text-foreground focus:not-sr-only focus:fixed focus:left-4 focus:top-4"
      >
        Saltar al contenido
      </a>
      <header className="z-50 w-full border-b bg-background lg:sticky lg:top-0">
        <div className="container grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-2 py-3 lg:grid-cols-[auto_minmax(0,1fr)_auto]">
          <Link
            href="/"
            className="inline-flex min-h-11 min-w-0 items-center gap-2 font-body text-sm font-semibold tracking-wide"
          >
            <MessageSquareQuote
              aria-hidden="true"
              className="h-5 w-5 shrink-0 text-primary"
            />
            <span>Testimonial CMS</span>
          </Link>
          <nav
            aria-label="Navegación principal"
            className="col-span-2 row-start-2 flex flex-wrap items-center justify-end gap-x-4 gap-y-1 font-body text-sm lg:col-span-1 lg:col-start-2 lg:row-start-1"
          >
            <Link
              href="/#producto"
              className="inline-flex min-h-11 items-center hover:underline underline-offset-4"
            >
              Producto
            </Link>
            <Link
              href="/docs"
              className="inline-flex min-h-11 items-center hover:underline underline-offset-4"
            >
              Ayuda
            </Link>
            {session ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    type="button"
                    variant="outline"
                    className="rounded-none transition-none"
                  >
                    <User aria-hidden="true" />
                    Mi espacio
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  align="end"
                  className="w-64 rounded-none transition-none font-body"
                >
                  <DropdownMenuLabel className="break-words font-normal">
                    {session.user.tenantName}
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem asChild>
                    <Link className="min-h-11" href="/admin">
                      <LayoutDashboard
                        aria-hidden="true"
                        className="mr-2 h-4 w-4"
                      />
                      Ir al panel
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link className="min-h-11" href="/admin/testimonials">
                      <MessageSquareQuote
                        aria-hidden="true"
                        className="mr-2 h-4 w-4"
                      />
                      Testimonios
                    </Link>
                  </DropdownMenuItem>
                  {session.user.roles.includes('admin') && (
                    <>
                      <DropdownMenuItem asChild>
                        <Link className="min-h-11" href="/admin/api-keys">
                          <KeyRound
                            aria-hidden="true"
                            className="mr-2 h-4 w-4"
                          />
                          API keys
                        </Link>
                      </DropdownMenuItem>
                      <DropdownMenuItem asChild>
                        <Link className="min-h-11" href="/admin/webhooks">
                          <Webhook
                            aria-hidden="true"
                            className="mr-2 h-4 w-4"
                          />
                          Webhooks
                        </Link>
                      </DropdownMenuItem>
                    </>
                  )}
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onSelect={() => void logout()}
                    className="min-h-11 cursor-pointer"
                  >
                    <LogOut aria-hidden="true" className="mr-2 h-4 w-4" />
                    Cerrar sesión
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <Button
                asChild
                variant="outline"
                className="rounded-none transition-none"
              >
                <Link href="/admin/login">Ingresar</Link>
              </Button>
            )}
          </nav>
          <div className="col-start-2 row-start-1 lg:col-start-3">
            <ThemeToggle className="rounded-none transition-none" />
          </div>
        </div>
      </header>
    </>
  );
}
