import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import type { ReactNode } from 'react';

export function AuthPageLayout({
  title,
  introduction,
  sideTitle,
  sideDescription,
  children,
  footer,
}: {
  title: string;
  introduction: string;
  sideTitle: ReactNode;
  sideDescription: string;
  children: ReactNode;
  footer: ReactNode;
}) {
  return (
    <div className="grid min-h-screen grid-cols-1 lg:grid-cols-2">
      <aside
        className="surface-inverse hidden min-w-0 flex-col justify-between gap-12 bg-foreground p-12 text-background lg:flex"
        aria-label="Testimonial CMS"
      >
        <span className="font-body text-sm font-bold uppercase tracking-widest text-primary">
          Testimonial CMS
        </span>
        <div>
          <h2 className="font-caption text-6xl italic leading-tight text-background xl:text-7xl">
            {sideTitle}
          </h2>
          <p className="mt-6 max-w-sm font-body text-base leading-relaxed text-background/80">
            {sideDescription}
          </p>
        </div>
        <p className="font-body text-sm text-background/80">
          Testimonios que podés revisar y publicar.
        </p>
      </aside>
      <main
        className="flex min-w-0 flex-col bg-background px-6 py-6 sm:px-8 lg:px-12 lg:py-8"
        aria-labelledby="auth-task-title"
      >
        <Link
          href="/"
          className="inline-flex min-h-11 w-fit items-center gap-2 font-body text-sm underline-offset-4 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          Volver al inicio
        </Link>
        <div className="mx-auto w-full max-w-md flex-1 py-8 lg:flex lg:flex-col lg:justify-center lg:py-10">
          <p className="mb-6 font-body text-sm font-bold text-primary lg:hidden">
            Testimonial CMS
          </p>
          <h1
            id="auth-task-title"
            className="font-caption text-4xl text-foreground"
          >
            {title}
          </h1>
          <p className="mb-7 mt-3 font-body text-sm leading-relaxed text-muted-foreground">
            {introduction}
          </p>
          {children}
          <div className="mt-8 border-t pt-5 font-body text-sm text-muted-foreground">
            {footer}
          </div>
        </div>
      </main>
    </div>
  );
}
