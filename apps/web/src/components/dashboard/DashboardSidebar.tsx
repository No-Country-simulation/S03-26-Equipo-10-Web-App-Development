'use client';

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
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { ThemeToggle } from '@/components/ThemeToggle';

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
  { label: 'Usuarios', href: '/admin/users', icon: Users, adminOnly: true },
  { label: 'Webhooks', href: '/admin/webhooks', icon: Webhook, adminOnly: true },
  { label: 'API Keys', href: '/admin/api-keys', icon: KeyRound, adminOnly: true },
  { label: 'Configuración', href: '/admin/settings', icon: Settings, adminOnly: true },
];

interface DashboardSidebarProps {
  userEmail?: string;
  userRoles?: string[];
  isAdmin: boolean;
  onLogout: () => void;
}

export function DashboardSidebar({ userEmail, userRoles, isAdmin, onLogout }: DashboardSidebarProps) {
  const pathname = usePathname();

  const visibleItems = navItems.filter((item) => !item.adminOnly || isAdmin);

  return (
    <aside className="fixed inset-y-0 left-0 z-40 flex w-64 flex-col bg-foreground text-background">
      {/* Brand */}
      <div className="flex h-16 items-center gap-3 border-b border-background/10 px-6">
        <span className="h-2 w-2 bg-primary" />
        <span className="font-body text-xs font-bold uppercase tracking-[0.2em]">
          Testimonial CMS
        </span>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-6">
        <div className="px-3">
          <p className="mb-3 px-3 font-body text-[10px] font-bold uppercase tracking-widest text-background/40">
            Panel
          </p>
          {visibleItems.slice(0, 5).map((item) => {
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'group relative flex items-center gap-3 px-3 py-2.5 font-body text-sm transition-colors',
                  isActive
                    ? 'bg-background/10 text-primary font-medium'
                    : 'text-background/60 hover:bg-background/5 hover:text-background',
                )}
              >
                {isActive && (
                  <span className="absolute left-0 top-1/2 h-6 w-0.5 -translate-y-1/2 bg-primary" />
                )}
                <item.icon className="h-4 w-4 shrink-0" />
                {item.label}
              </Link>
            );
          })}
        </div>

        {isAdmin && (
          <div className="mt-6 px-3">
            <p className="mb-3 px-3 font-body text-[10px] font-bold uppercase tracking-widest text-background/40">
              Administración
            </p>
            {visibleItems.slice(5).map((item) => {
              const isActive = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    'group relative flex items-center gap-3 px-3 py-2.5 font-body text-sm transition-colors',
                    isActive
                      ? 'bg-background/10 text-primary font-medium'
                      : 'text-background/60 hover:bg-background/5 hover:text-background',
                  )}
                >
                  {isActive && (
                    <span className="absolute left-0 top-1/2 h-6 w-0.5 -translate-y-1/2 bg-primary" />
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
                      ? 'bg-primary/20 text-primary'
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
          onClick={onLogout}
          className="flex w-full items-center justify-center gap-2 border border-background/20 py-2 font-body text-xs uppercase tracking-wider text-background/60 transition-colors hover:bg-background/10 hover:text-background"
        >
          <LogOut className="h-3.5 w-3.5" />
          Cerrar Sesión
        </button>
      </div>
    </aside>
  );
}
