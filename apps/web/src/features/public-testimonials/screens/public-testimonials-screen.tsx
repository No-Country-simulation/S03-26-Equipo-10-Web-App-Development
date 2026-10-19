'use client';

import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useParams } from 'next/navigation';
import { Play, Quote } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { RatingDisplay } from '@/features/shared/rating-display';
import { cn } from '@/lib/utils';
import {
  trackPublicEvent as sendPublicEvent,
  type PublicTestimonial,
} from '../api';
import { LoadFailure } from '@/features/shared/load-failure';
import { LoadingState } from '@/features/shared/feedback';
import { trackingStorage } from '@/lib/preference-storage';
import { getFormInfo } from '@/features/public-capture/api';
import { TenantLogo } from '@/features/shared/tenant-logo';
import {
  youtubeVideoId,
  safePublicMediaUrl,
} from '@/features/shared/public-media';
import { usePublicGallery } from '../use-public-gallery';
import { useRemoteResource } from '@/features/shared/use-remote-resource';

type AnalyticsEventType = 'view' | 'click' | 'play';

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

  youtubeApiPromise = new Promise((resolve, reject) => {
    const existingScript = document.querySelector<HTMLScriptElement>(
      'script[src="https://www.youtube.com/iframe_api"]',
    );
    const previousReady = window.onYouTubeIframeAPIReady;
    const fail = () => {
      window.clearTimeout(timeout);
      window.onYouTubeIframeAPIReady = previousReady;
      script.remove();
      youtubeApiPromise = null;
      reject(new Error('No se pudo cargar el reproductor de YouTube'));
    };
    const timeout = window.setTimeout(fail, 15000);
    window.onYouTubeIframeAPIReady = () => {
      window.clearTimeout(timeout);
      window.onYouTubeIframeAPIReady = previousReady;
      script.removeEventListener('error', fail);
      resolve();
      previousReady?.();
    };
    const script = existingScript ?? document.createElement('script');
    script.addEventListener('error', fail, { once: true });
    if (!existingScript) {
      script.src = 'https://www.youtube.com/iframe_api';
      script.async = true;
      document.body.appendChild(script);
    }
  });

  return youtubeApiPromise;
}

function getSessionKey(
  slug: string,
  testimonialId: string,
  eventType: AnalyticsEventType,
) {
  return `analytics:${slug}:${testimonialId}:${eventType}`;
}

function wasTracked(
  slug: string,
  testimonialId: string,
  eventType: AnalyticsEventType,
) {
  if (typeof window === 'undefined') return false;
  return (
    trackingStorage.get(getSessionKey(slug, testimonialId, eventType)) === '1'
  );
}

function markTracked(
  slug: string,
  testimonialId: string,
  eventType: AnalyticsEventType,
) {
  if (typeof window === 'undefined') return;
  trackingStorage.set(getSessionKey(slug, testimonialId, eventType), '1');
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
    await sendPublicEvent(slug, testimonialId, eventType, source);
  } catch {
    trackingStorage.remove(getSessionKey(slug, testimonialId, eventType));
  }
}

function TrackedYouTubePlayer({
  slug,
  testimonial,
}: {
  slug: string;
  testimonial: PublicTestimonial;
}) {
  const [playerReady, setPlayerReady] = useState(false);
  const [showPlayer, setShowPlayer] = useState(false);
  const [playerUnavailable, setPlayerUnavailable] = useState(false);
  const playerId = useId().replace(/:/g, '-');
  const videoId = useMemo(
    () => (testimonial.videoUrl ? youtubeVideoId(testimonial.videoUrl) : null),
    [testimonial.videoUrl],
  );

  useEffect(() => {
    if (!showPlayer || !videoId) {
      return;
    }

    let mounted = true;
    let player: { destroy: () => void } | null = null;

    void loadYouTubeApi()
      .then(() => {
        if (!mounted || !window.YT?.Player) {
          if (mounted) setPlayerUnavailable(true);
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
        setPlayerReady(true);
      })
      .catch(() => {
        if (mounted) setPlayerUnavailable(true);
      });

    return () => {
      mounted = false;
      player?.destroy();
    };
  }, [playerId, showPlayer, slug, testimonial.id, videoId]);

  if (!videoId) {
    const externalUrl = safePublicMediaUrl(testimonial.videoUrl);
    if (!externalUrl)
      return <p className="font-body text-sm">El video no está disponible.</p>;
    return (
      <a
        href={externalUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex min-h-11 items-center font-body text-sm text-primary underline"
      >
        Abrir video original
      </a>
    );
  }

  if (showPlayer) {
    if (playerUnavailable) {
      return (
        <div className="flex aspect-video flex-col items-center justify-center gap-3 border bg-muted/20 p-4 text-center font-body text-sm">
          <p>No se pudo cargar el reproductor.</p>
          <a
            href={`https://www.youtube.com/watch?v=${videoId}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex min-h-11 items-center text-primary underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
          >
            Abrir video en YouTube
          </a>
        </div>
      );
    }
    return (
      <div>
        <div id={playerId} className="aspect-video w-full" />
        {!playerReady && (
          <p role="status" className="mt-2 font-body text-sm">
            Cargando reproductor…
          </p>
        )}
      </div>
    );
  }

  const thumbnail =
    safePublicMediaUrl(testimonial.videoThumbnailUrl) ??
    `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;

  return (
    <button
      type="button"
      aria-label={`Reproducir video de ${testimonial.authorName}`}
      onClick={() => setShowPlayer(true)}
      className="group relative block aspect-video w-full overflow-hidden border focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
    >
      <img
        src={thumbnail}
        alt={testimonial.videoTitle ?? `Video de ${testimonial.authorName}`}
        loading="lazy"
        decoding="async"
        className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.02] motion-reduce:transform-none"
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
  const [imageUnavailable, setImageUnavailable] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const contentId = useId();

  useEffect(() => {
    const node = cardRef.current;
    if (typeof IntersectionObserver !== 'function') return;
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
      aria-labelledby={`public-testimonial-${testimonial.id}`}
      className="min-w-0 border bg-card p-6"
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h2
            id={`public-testimonial-${testimonial.id}`}
            tabIndex={-1}
            className="break-words font-caption text-3xl italic text-foreground"
          >
            {testimonial.authorName}
          </h2>
        </div>
        <Quote
          aria-hidden="true"
          className="h-8 w-8 shrink-0 text-primary/30"
        />
      </div>

      <RatingDisplay rating={testimonial.rating} className="mt-4" />

      <blockquote
        id={contentId}
        className={cn(
          'mt-5 break-words font-caption text-xl leading-relaxed text-foreground',
          !expanded && 'line-clamp-4',
        )}
      >
        {testimonial.content}
      </blockquote>

      {(testimonial.imageUrl || testimonial.videoUrl) && (
        <div className="mt-6">
          {testimonial.videoUrl ? (
            <TrackedYouTubePlayer slug={slug} testimonial={testimonial} />
          ) : testimonial.imageUrl ? (
            <div
              className={cn(
                'overflow-hidden border bg-muted/20',
                !imageUnavailable &&
                  safePublicMediaUrl(testimonial.imageUrl) &&
                  'aspect-[4/3]',
              )}
            >
              {imageUnavailable || !safePublicMediaUrl(testimonial.imageUrl) ? (
                <p className="p-4 font-body text-sm">
                  La imagen no está disponible.
                </p>
              ) : (
                <img
                  onError={() => setImageUnavailable(true)}
                  src={safePublicMediaUrl(testimonial.imageUrl) ?? undefined}
                  alt={`Imagen del testimonio de ${testimonial.authorName}`}
                  loading="lazy"
                  decoding="async"
                  className="h-full w-full object-contain"
                />
              )}
            </div>
          ) : null}
        </div>
      )}

      <div className="mt-6 flex items-center justify-between gap-4 border-t pt-4">
        <Button
          type="button"
          variant="ghost"
          onClick={handleExpand}
          aria-label={`${expanded ? 'Ocultar detalle' : 'Ver detalle'} de ${testimonial.authorName}`}
          aria-expanded={expanded}
          aria-controls={contentId}
          className="h-auto min-h-11 whitespace-normal font-body text-sm transition-none"
        >
          {expanded ? 'Ocultar detalle' : 'Ver detalle'}
        </Button>
      </div>
    </article>
  );
}

function PublicGallery({ slug }: { slug: string }) {
  const { data, loading, error, loadNext } = usePublicGallery(slug);
  const loadBrand = useCallback(() => getFormInfo(slug), [slug]);
  const brand = useRemoteResource(loadBrand, true);
  const resultRef = useRef<HTMLParagraphElement>(null);
  useEffect(() => {
    if (data?.focusId != null) {
      if (data.focusId)
        document.getElementById(`public-testimonial-${data.focusId}`)?.focus();
      else resultRef.current?.focus();
    }
  }, [data?.focusId, data?.meta.page]);
  const hasMore =
    data &&
    data.meta.page * data.meta.limit < data.meta.total &&
    data.meta.page < 10000;
  return (
    <div className="relative min-h-screen bg-background">
      <main className="relative z-10 mx-auto max-w-6xl px-6 py-12 sm:px-8 lg:px-12">
        <header className="mx-auto max-w-2xl text-center">
          {brand.state.status === 'success' ? (
            <div className="mb-6 flex flex-col items-center gap-4">
              <TenantLogo
                name={brand.state.data.name}
                logoUrl={brand.state.data.logoUrl}
              />
              <h1 className="max-w-full break-words font-caption text-4xl italic sm:text-5xl">
                {brand.state.data.name}
              </h1>
            </div>
          ) : (
            <h1 className="font-caption text-4xl italic sm:text-5xl">
              Testimonios publicados
            </h1>
          )}
          {brand.state.status === 'loading' && (
            <p role="status" className="mt-3 font-body text-sm">
              Cargando marca…
            </p>
          )}
          {brand.state.status === 'error' && (
            <div className="mt-4 font-body text-sm">
              <p>No pudimos cargar la marca de este espacio.</p>
              <Button
                type="button"
                variant="outline"
                className="mt-3"
                onClick={brand.reload}
              >
                Reintentar marca
              </Button>
            </div>
          )}
          <p className="mt-3 font-body text-base text-muted-foreground">
            Experiencias que este espacio eligió publicar. Ordenadas por
            relevancia.
          </p>
        </header>
        {loading && !data && (
          <LoadingState className="justify-center">
            Cargando testimonios publicados…
          </LoadingState>
        )}
        {error != null && (
          <div className="mx-auto mt-8 max-w-2xl">
            <LoadFailure
              error={error}
              resource="los testimonios publicados"
              onRetry={loadNext}
            />
          </div>
        )}
        {data && (
          <>
            <p
              ref={resultRef}
              tabIndex={-1}
              role="status"
              aria-atomic="true"
              className="mt-8 font-body text-sm text-muted-foreground"
            >
              {data.items.length <= data.meta.total
                ? `Mostrando ${data.items.length} de ${data.meta.total} testimonios publicados.`
                : `Cargaste ${data.items.length} testimonios. La última consulta informa ${data.meta.total} publicados.`}
            </p>
            {data.items.length === 0 ? (
              <p className="my-12 border-y py-8 font-body text-base">
                Todavía no hay testimonios publicados en este espacio.
              </p>
            ) : (
              <div className="mt-6 grid gap-8 lg:grid-cols-2">
                {data.items.map((testimonial) => (
                  <TestimonialCard
                    key={testimonial.id}
                    slug={slug}
                    testimonial={testimonial}
                  />
                ))}
              </div>
            )}
            {loading && <LoadingState>Cargando más testimonios…</LoadingState>}
            {hasMore && error == null && (
              <div className="mt-8 text-center">
                <Button type="button" disabled={loading} onClick={loadNext}>
                  Cargar más
                </Button>
              </div>
            )}
            {!hasMore && data.items.length > 0 && (
              <p className="mt-8 font-body text-sm text-muted-foreground">
                Llegaste al final de los testimonios disponibles.
              </p>
            )}
            {data.meta.page >= 10000 &&
              data.meta.page * data.meta.limit < data.meta.total && (
                <p className="mt-3 font-body text-sm">
                  Alcanzaste el límite de páginas disponibles en esta consulta.
                </p>
              )}
          </>
        )}
      </main>
    </div>
  );
}
export default function PublicTestimonialsPage() {
  const params = useParams();
  const slug = typeof params.slug === 'string' ? params.slug : '';
  return <PublicGallery key={slug} slug={slug} />;
}
