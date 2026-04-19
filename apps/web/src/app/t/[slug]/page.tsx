'use client';

import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { useParams } from 'next/navigation';
import { Eye, MousePointerClick, Play, Quote, Star } from 'lucide-react';
import { NoiseOverlay } from '@/components/ui/NoiseOverlay';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { ApiEnvelope, getApiBaseUrl } from '@/lib/api';

const API_URL = getApiBaseUrl();

type AnalyticsEventType = 'view' | 'click' | 'play';

interface PublicTestimonial {
  id: string;
  authorName: string;
  content: string;
  rating: number;
  score: number;
  imageUrl?: string | null;
  videoUrl?: string | null;
  videoTitle?: string | null;
  videoThumbnailUrl?: string | null;
  publishedAt?: string | null;
}

declare global {
  interface Window {
    YT?: {
      Player: new (
        elementId: string,
        config: {
          videoId: string;
          playerVars?: Record<string, unknown>;
          events?: {
            onStateChange?: (event: { data: number }) => void;
          };
        },
      ) => {
        destroy: () => void;
      };
      PlayerState: {
        PLAYING: number;
      };
    };
    onYouTubeIframeAPIReady?: () => void;
  }
}

let youtubeApiPromise: Promise<void> | null = null;

function loadYouTubeApi(): Promise<void> {
  if (typeof window === 'undefined') {
    return Promise.resolve();
  }

  if (window.YT?.Player) {
    return Promise.resolve();
  }

  if (youtubeApiPromise) {
    return youtubeApiPromise;
  }

  youtubeApiPromise = new Promise((resolve) => {
    const existingScript = document.querySelector<HTMLScriptElement>(
      'script[src="https://www.youtube.com/iframe_api"]',
    );

    const previousReady = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      previousReady?.();
      resolve();
    };

    if (existingScript) {
      return;
    }

    const script = document.createElement('script');
    script.src = 'https://www.youtube.com/iframe_api';
    script.async = true;
    document.body.appendChild(script);
  });

  return youtubeApiPromise;
}

function getSessionKey(slug: string, testimonialId: string, eventType: AnalyticsEventType) {
  return `analytics:${slug}:${testimonialId}:${eventType}`;
}

function wasTracked(slug: string, testimonialId: string, eventType: AnalyticsEventType) {
  if (typeof window === 'undefined') return false;
  return sessionStorage.getItem(getSessionKey(slug, testimonialId, eventType)) === '1';
}

function markTracked(slug: string, testimonialId: string, eventType: AnalyticsEventType) {
  if (typeof window === 'undefined') return;
  sessionStorage.setItem(getSessionKey(slug, testimonialId, eventType), '1');
}

function extractYouTubeVideoId(url: string) {
  try {
    const parsed = new URL(url);
    if (parsed.hostname.includes('youtu.be')) {
      return parsed.pathname.replace('/', '');
    }

    if (parsed.hostname.includes('youtube.com')) {
      return parsed.searchParams.get('v');
    }
  } catch {
    return null;
  }

  return null;
}

async function trackPublicEvent(
  slug: string,
  testimonialId: string,
  eventType: AnalyticsEventType,
  source = 'public-page',
) {
  if (wasTracked(slug, testimonialId, eventType)) {
    return;
  }

  markTracked(slug, testimonialId, eventType);

  try {
    const response = await fetch(`${API_URL}/public/analytics/tenants/${slug}/events`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        testimonialId,
        eventType,
        source,
      }),
      cache: 'no-store',
      keepalive: true,
    });

    if (!response.ok) {
      sessionStorage.removeItem(getSessionKey(slug, testimonialId, eventType));
    }
  } catch {
    sessionStorage.removeItem(getSessionKey(slug, testimonialId, eventType));
  }
}

function TrackedYouTubePlayer({
  slug,
  testimonial,
}: {
  slug: string;
  testimonial: PublicTestimonial;
}) {
  const [showPlayer, setShowPlayer] = useState(false);
  const playerId = useId().replace(/:/g, '-');
  const videoId = useMemo(
    () => (testimonial.videoUrl ? extractYouTubeVideoId(testimonial.videoUrl) : null),
    [testimonial.videoUrl],
  );

  useEffect(() => {
    if (!showPlayer || !videoId) {
      return;
    }

    let mounted = true;
    let player: { destroy: () => void } | null = null;

    void loadYouTubeApi().then(() => {
      if (!mounted || !window.YT?.Player) {
        return;
      }

      player = new window.YT.Player(playerId, {
        videoId,
        playerVars: {
          autoplay: 1,
          rel: 0,
        },
        events: {
          onStateChange: (event) => {
            if (event.data === window.YT?.PlayerState.PLAYING) {
              void trackPublicEvent(slug, testimonial.id, 'play');
            }
          },
        },
      });
    });

    return () => {
      mounted = false;
      player?.destroy();
    };
  }, [playerId, showPlayer, slug, testimonial.id, videoId]);

  if (!videoId) {
    return null;
  }

  if (showPlayer) {
    return <div id={playerId} className="aspect-video w-full" />;
  }

  const thumbnail = testimonial.videoThumbnailUrl ?? `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;

  return (
    <button
      type="button"
      onClick={() => setShowPlayer(true)}
      className="group relative block aspect-video w-full overflow-hidden border"
    >
      <img
        src={thumbnail}
        alt={testimonial.videoTitle ?? `Video de ${testimonial.authorName}`}
        className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.02]"
      />
      <div className="absolute inset-0 bg-black/25" />
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="flex h-16 w-16 items-center justify-center rounded-full bg-background/90 text-foreground shadow-lg">
          <Play className="ml-1 h-7 w-7" />
        </span>
      </div>
    </button>
  );
}

function TestimonialCard({
  slug,
  testimonial,
}: {
  slug: string;
  testimonial: PublicTestimonial;
}) {
  const cardRef = useRef<HTMLElement | null>(null);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    const node = cardRef.current;
    if (!node || wasTracked(slug, testimonial.id, 'view')) {
      return;
    }

    let timeoutId: number | null = null;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry?.isIntersecting || entry.intersectionRatio < 0.5) {
          if (timeoutId) {
            window.clearTimeout(timeoutId);
            timeoutId = null;
          }
          return;
        }

        if (timeoutId) {
          return;
        }

        timeoutId = window.setTimeout(() => {
          void trackPublicEvent(slug, testimonial.id, 'view');
        }, 1000);
      },
      { threshold: [0.5] },
    );

    observer.observe(node);

    return () => {
      observer.disconnect();
      if (timeoutId) {
        window.clearTimeout(timeoutId);
      }
    };
  }, [slug, testimonial.id]);

  const handleExpand = () => {
    if (!expanded) {
      void trackPublicEvent(slug, testimonial.id, 'click');
    }
    setExpanded((current) => !current);
  };

  return (
    <article
      ref={cardRef}
      className="border bg-background/80 p-6 shadow-sm backdrop-blur-sm transition-colors hover:bg-card"
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="font-body text-[10px] font-bold uppercase tracking-[0.2em] text-primary">
            Testimonio publicado
          </p>
          <h2 className="mt-2 font-caption text-3xl italic text-foreground">
            {testimonial.authorName}
          </h2>
        </div>
        <Quote className="h-8 w-8 text-primary/30" />
      </div>

      <div className="mt-4 flex items-center gap-1">
        {Array.from({ length: 5 }).map((_, index) => (
          <Star
            key={index}
            className={cn(
              'h-4 w-4',
              index < testimonial.rating ? 'fill-primary text-primary' : 'text-muted-foreground/20',
            )}
          />
        ))}
      </div>

      <p className={cn('mt-5 font-body text-sm leading-7 text-muted-foreground', !expanded && 'line-clamp-4')}>
        {testimonial.content}
      </p>

      {(testimonial.imageUrl || testimonial.videoUrl) && (
        <div className="mt-6">
          {testimonial.videoUrl ? (
            <TrackedYouTubePlayer slug={slug} testimonial={testimonial} />
          ) : testimonial.imageUrl ? (
            <div className="overflow-hidden border">
              <img
                src={testimonial.imageUrl}
                alt={`Imagen del testimonio de ${testimonial.authorName}`}
                className="h-auto w-full object-cover"
              />
            </div>
          ) : null}
        </div>
      )}

      <div className="mt-6 flex items-center justify-between gap-4 border-t pt-4">
        <div className="flex items-center gap-4 font-body text-[11px] uppercase tracking-wider text-muted-foreground">
          <span className="inline-flex items-center gap-1.5">
            <Eye className="h-3.5 w-3.5" />
            View
          </span>
          <span className="inline-flex items-center gap-1.5">
            <MousePointerClick className="h-3.5 w-3.5" />
            Click
          </span>
          {testimonial.videoUrl && (
            <span className="inline-flex items-center gap-1.5">
              <Play className="h-3.5 w-3.5" />
              Play
            </span>
          )}
        </div>
        <Button
          type="button"
          variant="ghost"
          onClick={handleExpand}
          className="h-10 font-body text-[11px] uppercase tracking-[0.18em]"
        >
          {expanded ? 'Ocultar detalle' : 'Ver detalle'}
        </Button>
      </div>
    </article>
  );
}

export default function PublicTestimonialsPage() {
  const params = useParams();
  const slug = params.slug as string;
  const [testimonials, setTestimonials] = useState<PublicTestimonial[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadTestimonials() {
      setLoading(true);
      setError(null);

      try {
        const response = await fetch(`${API_URL}/public/testimonials/tenants/${slug}`, {
          cache: 'no-store',
        });

        const payload = (await response.json()) as ApiEnvelope<{
          items: PublicTestimonial[];
          meta: { total: number; page: number; limit: number };
        }>;

        if (!response.ok) {
          throw new Error('No se pudieron cargar los testimonios');
        }

        setTestimonials(payload.data.items);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'No se pudieron cargar los testimonios');
      } finally {
        setLoading(false);
      }
    }

    void loadTestimonials();
  }, [slug]);

  return (
    <div className="relative min-h-screen overflow-hidden bg-background">
      <NoiseOverlay />
      <main className="relative z-10 mx-auto max-w-6xl px-6 py-16 sm:px-8 lg:px-12">
        <div className="mx-auto max-w-2xl text-center">
          <p className="font-body text-[10px] font-bold uppercase tracking-[0.28em] text-primary">
            Social proof en vivo
          </p>
          <h1 className="mt-4 font-caption text-5xl italic leading-tight text-foreground sm:text-6xl">
            Testimonios publicados
          </h1>
          <p className="mt-6 font-body text-sm leading-7 text-muted-foreground">
            Esta vista pública carga testimonios publicados del tenant y registra interacciones reales
            de visualización, clic y reproducción.
          </p>
        </div>

        {loading ? (
          <div className="flex min-h-[40vh] items-center justify-center">
            <div className="h-8 w-8 animate-spin border-2 border-primary border-t-transparent" />
          </div>
        ) : error ? (
          <div className="mx-auto mt-16 max-w-2xl border border-dashed p-10 text-center">
            <p className="font-body text-xs uppercase tracking-[0.18em] text-destructive">Error</p>
            <p className="mt-4 font-body text-sm leading-7 text-muted-foreground">{error}</p>
          </div>
        ) : testimonials.length === 0 ? (
          <div className="mx-auto mt-16 max-w-2xl border border-dashed p-10 text-center">
            <p className="font-body text-xs uppercase tracking-[0.18em] text-muted-foreground">
              Sin testimonios publicados
            </p>
          </div>
        ) : (
          <div className="mt-16 grid gap-8 lg:grid-cols-2">
            {testimonials.map((testimonial) => (
              <TestimonialCard key={testimonial.id} slug={slug} testimonial={testimonial} />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
