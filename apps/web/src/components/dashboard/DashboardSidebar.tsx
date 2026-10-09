'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  MessageSquareQuote,
  Users,
  FolderOpen,
  Tag,
  BarChart3,
  Webhook,
  KeyRound,
  Settings,
  LogOut,
  Menu,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { ThemeToggle } from '@/components/ThemeToggle';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetDescription, SheetTitle, SheetTrigger } from '@/components/ui/sheet';

interface NavItem {
  label: string;
  href: string;
  icon: React.ElementType;
  adminOnly?: boolean;
}

const navItems: NavItem[] = [
  { label: 'Inicio', href: '/admin', icon: LayoutDashboard },
  { label: 'Testimonios', href: '/admin/testimonials', icon: MessageSquareQuote },
  { label: 'Categorías', href: '/admin/categories', icon: FolderOpen },
  { label: 'Etiquetas', href: '/admin/tags', icon: Tag },
  { label: 'Analítica', href: '/admin/analytics', icon: BarChart3 },
  { label: 'Inteligencia de negocio', href: '/admin/business-intelligence', icon: BarChart3 },
  { label: 'Usuarios', href: '/admin/users', icon: Users, adminOnly: true },
  { label: 'Webhooks', href: '/admin/webhooks', icon: Webhook, adminOnly: true },
  { label: 'APIs Keys', href: '/admin/api-keys', icon: KeyRound, adminOnly: true },
  { label: 'Configuración', href: '/admin/settings', icon: Settings, adminOnly: true },
];

interface DashboardSidebarProps {
  userEmail?: string;
  userRoles?: string[];
  isAdmin: boolean;
  onLogout: () => void;
}

function SidebarContent({ userEmail, userRoles, isAdmin, onLogout, onNavigate }: DashboardSidebarProps & { onNavigate?: () => void }) {
  const pathname = usePathname();

  const visibleItems = navItems.filter((item) => !item.adminOnly || isAdmin);

  return (
    <div className="flex h-full flex-col bg-foreground text-background">
      {/* Brand */}
      <div className="flex h-16 items-center border-b border-background/10 px-6">
        <Link href="/" onClick={onNavigate} className="flex items-center gap-3 group w-full focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sidebar-primary">
          <img 
            src="/favicon.ico" 
            alt=""
            className="h-6 w-6 transition-transform duration-300 group-hover:scale-110 group-hover:rotate-6"
          />
          <span className="font-body text-xs font-bold uppercase tracking-[0.2em] transition-all duration-300 group-hover:underline group-hover:underline-offset-4">
            Testimonial CMS
          </span>
        </Link>
      </div>

      {/* Navigation */}
      <nav aria-label="Navegación del panel" className="flex-1 overflow-y-auto py-6">
        <div className="px-3">
          <p className="mb-3 px-3 font-body text-[10px] font-bold uppercase tracking-widest text-background/70">
            Panel
          </p>
          {visibleItems.filter(item => !item.adminOnly).map((item) => {
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onNavigate}
                aria-current={isActive ? 'page' : undefined}
                className={cn(
                  'group relative flex items-center gap-3 px-3 py-2.5 font-body text-sm transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sidebar-primary',
                  isActive
                    ? 'bg-background/10 text-sidebar-primary font-medium'
                    : 'text-background/60 hover:bg-background/5 hover:text-background',
                )}
              >
                {isActive && (
                  <span className="absolute left-0 top-1/2 h-6 w-0.5 -translate-y-1/2 bg-sidebar-primary" />
                )}
                <item.icon className="h-4 w-4 shrink-0" />
                {item.label}
              </Link>
            );
          })}
        </div>

        {isAdmin && (
          <div className="mt-6 px-3">
            <p className="mb-3 px-3 font-body text-[10px] font-bold uppercase tracking-widest text-background/70">
              Administración
            </p>
            {visibleItems.filter(item => item.adminOnly).map((item) => {
              const isActive = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={onNavigate}
                  aria-current={isActive ? 'page' : undefined}
                  className={cn(
                    'group relative flex items-center gap-3 px-3 py-2.5 font-body text-sm transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sidebar-primary',
                    isActive
                      ? 'bg-background/10 text-sidebar-primary font-medium'
                      : 'text-background/60 hover:bg-background/5 hover:text-background',
                  )}
                >
                  {isActive && (
                      <span className="absolute left-0 top-1/2 h-6 w-0.5 -translate-y-1/2 bg-sidebar-primary" />
                  )}
                  <item.icon className="h-4 w-4 shrink-0" />
                  {item.label}
                </Link>
              );
            })}
          </div>
        )}
      </nav>

      {/* User Footer */}
      <div className="border-t border-background/10 p-4">
        <div className="mb-3 flex items-center justify-between">
          <div className="min-w-0">
            <p className="truncate font-body text-xs font-medium text-background/80">{userEmail}</p>
            <div className="mt-1 flex gap-1.5">
              {userRoles?.map((role) => (
                <span
                  key={role}
                  className={cn(
                    'inline-block px-1.5 py-0.5 font-body text-[10px] font-bold uppercase tracking-wider',
                    role === 'admin'
                      ? 'bg-sidebar-primary/20 text-sidebar-primary'
                      : 'bg-background/10 text-background/60',
                  )}
                >
                  {role}
                </span>
              ))}
            </div>
          </div>
          <ThemeToggle />
        </div>
        <button
          onClick={() => { onNavigate?.(); onLogout(); }}
          className="flex w-full items-center justify-center gap-2 border border-background/20 py-2 font-body text-xs uppercase tracking-wider text-background transition-colors hover:bg-background/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sidebar-primary"
        >
          <LogOut className="h-3.5 w-3.5" />
          Cerrar Sesión
        </button>
      </div>
    </div>
  );
}

export function DashboardSidebar(props: DashboardSidebarProps) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const pathname = usePathname();
  useEffect(() => { setMobileOpen(false); }, [pathname]);

  return (
    <>
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 lg:block">
        <SidebarContent {...props} />
      </aside>
      <div className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b bg-background px-4 lg:hidden">
        <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
          <SheetTrigger asChild>
            <Button type="button" variant="outline" size="icon" aria-label="Abrir menú del panel" aria-expanded={mobileOpen}>
              <Menu className="h-5 w-5" aria-hidden="true" />
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="w-64 p-0 bg-foreground text-background [&>button]:text-background">
            <SheetTitle className="sr-only">Navegación del panel</SheetTitle>
            <SheetDescription className="sr-only">Enlaces a las secciones del panel de administración.</SheetDescription>
            <SidebarContent {...props} onNavigate={() => setMobileOpen(false)} />
          </SheetContent>
        </Sheet>
        <span className="font-body text-xs font-bold uppercase tracking-widest">Testimonial CMS</span>
      </div>
    </>
  );
}
