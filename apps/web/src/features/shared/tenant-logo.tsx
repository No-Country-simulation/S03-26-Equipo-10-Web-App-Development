'use client';

import { useState } from 'react';
import { cn } from '@/lib/utils';

export function TenantLogo({ name, logoUrl, className }: { name: string; logoUrl: string | null; className?: string }) {
  // A new URL remounts the image state; a failure never follows another tenant.
  return <LogoImage key={`${name}:${logoUrl ?? ''}`} name={name} logoUrl={logoUrl} className={className} />;
}

function LogoImage({ name, logoUrl, className }: { name: string; logoUrl: string | null; className?: string }) {
  const [failed, setFailed] = useState(false);
  const initials = name.trim().split(/\s+/).slice(0, 2).map(word => word[0] ?? '').join('').toUpperCase() || 'M';
  return (
    <div className={cn('flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden border bg-card text-primary', className)}>
      {logoUrl && !failed ? (
        // Cloudinary and local previews use their original URL; no Next image proxy.
        // eslint-disable-next-line @next/next/no-img-element
        <img src={logoUrl} width={80} height={80} alt={`Logo de ${name}`} className="h-full w-full object-contain"
          onError={() => setFailed(true)} />
      ) : <span role="img" aria-label={`Iniciales de ${name}`} className="font-caption text-2xl italic">{initials}</span>}
    </div>
  );
}
