import Link, { LinkProps } from "next/link";
import { usePathname } from "next/navigation";
import { forwardRef } from "react";
import { cn } from "@/lib/utils";

interface NavLinkCompatProps extends Omit<LinkProps, "className" | "to"> {
  className?: string;
  activeClassName?: string;
  pendingClassName?: string;
  to: string;
  children?: React.ReactNode;
}

const NavLink = forwardRef<HTMLAnchorElement, NavLinkCompatProps>(
  ({ className, activeClassName, pendingClassName, to, children, ...props }, ref) => {
    const pathname = usePathname();
    const isActive = pathname === to || pathname.startsWith(to + '/');
    const isPending = false; // Note: Next.js transitions do not expose pending state trivially without useTransition

    return (
      <Link
        ref={ref}
        href={to}
        className={cn(className, isActive && activeClassName, isPending && pendingClassName)}
        {...props}
      >
        {children}
      </Link>
    );
  },
);

NavLink.displayName = "NavLink";

export { NavLink };
