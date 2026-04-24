"use client";

import { ArrowRight, ArrowDown, Key, Webhook, TrendingUp, Shield } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import useEmblaCarousel from "embla-carousel-react";
import Autoplay from "embla-carousel-autoplay";
import { useCallback, useEffect, useState } from "react";

const carouselSlides = [
  {
    id: 1,
    title: "API-First Design",
    description: "Integra testimonios dinámicos en cualquier framework o plataforma en minutos. Tu contenido viaja donde tu producto lo necesite.",
    icon: <Key className="h-6 w-6 text-primary" />,
    badge: "Developers"
  },
  {
    id: 2,
    title: "Webhooks en Tiempo Real",
    description: "Configura disparadores automáticos. Notifica a tu equipo en Slack o sincroniza con tu CRM en el instante que apruebas un testimonio.",
    icon: <Webhook className="h-6 w-6 text-primary" />,
    badge: "Integrations"
  },
  {
    id: 3,
    title: "Scoring Algorítmico",
    description: "Olvídate del orden manual. Nuestro algoritmo clasifica y expone primero las reseñas con mayor peso semántico y conversión.",
    icon: <TrendingUp className="h-6 w-6 text-primary" />,
    badge: "Intelligence"
  },
  {
    id: 4,
    title: "Gestión Multi-Tenant",
    description: "Control absoluto para empresas. Asigna roles granulares (Admin, Editor) y administra docenas de marcas desde un único panel central.",
    icon: <Shield className="h-6 w-6 text-primary" />,
    badge: "Enterprise"
  }
];

export const HeroSection = () => {
  const [emblaRef, emblaApi] = useEmblaCarousel({ loop: true, align: "center" }, [
    Autoplay({ delay: 5000, stopOnInteraction: true, stopOnMouseEnter: true })
  ]);
  
  const [selectedIndex, setSelectedIndex] = useState(0);

  const onSelect = useCallback(() => {
    if (!emblaApi) return;
    setSelectedIndex(emblaApi.selectedScrollSnap());
  }, [emblaApi, setSelectedIndex]);

  useEffect(() => {
    if (!emblaApi) return;
    onSelect();
    emblaApi.on("select", onSelect);
    emblaApi.on("reInit", onSelect);
  }, [emblaApi, onSelect]);
  return (
    <section className="relative min-h-[95vh] flex items-center overflow-hidden border-b-[0.5px] border-primary/20 py-24">
      {/* Ruido y gradientes sutiles de fondo */}
      <div className="absolute inset-0 bg-background" />
      <div className="absolute inset-0 opacity-[0.03] mix-blend-overlay pointer-events-none" style={{ backgroundImage: 'url("data:image/svg+xml,%3Csvg viewBox=%220 0 200 200%22 xmlns=%22http://www.w3.org/2000/svg%22%3E%3Cfilter id=%22noiseFilter%22%3E%3CfeTurbulence type=%22fractalNoise%22 baseFrequency=%220.85%22 numOctaves=%223%22 stitchTiles=%22stitch%22/%3E%3C/filter%3E%3Crect width=%22100%25%22 height=%22100%25%22 filter=%22url(%23noiseFilter)%22/%3E%3C/svg%3E")' }}></div>
      <div className="absolute top-0 right-0 w-1/2 h-full bg-gradient-to-l from-primary/[0.02] to-transparent" />
      
      <div className="container relative z-10 grid gap-16 lg:grid-cols-[1.2fr,1fr] xl:grid-cols-[1.5fr,1fr] items-center">
        
        {/* Left Column: Massive Editorial Typography */}
        <article className="flex flex-col justify-center">
          <header className="flex items-center gap-6 mb-12 animate-in fade-in slide-in-from-bottom-8 duration-1000 fill-mode-both">
            <span className="h-[0.5px] w-24 bg-primary"></span>
            <span className="font-body text-xs font-semibold uppercase tracking-[0.3em] text-primary">Testimonial CMS</span>
          </header>
          
          <h1 className="font-caption text-6xl md:text-8xl lg:text-[8rem] xl:text-[9.5rem] font-light leading-[0.9] tracking-tighter text-foreground text-balance animate-in fade-in slide-in-from-bottom-8 duration-1000 delay-300 fill-mode-both -ml-2">
            Voces que<br />
            <em className="text-primary italic font-serif">convierten.</em>
          </h1>
          
          <p className="mt-10 max-w-xl font-body text-lg md:text-xl font-light leading-relaxed text-muted-foreground text-balance animate-in fade-in slide-in-from-bottom-8 duration-1000 delay-500 fill-mode-both pl-4 border-l-[0.5px] border-primary/30">
            Gestiona, modera y despliega testimonios de forma sencilla. Olvida las plantillas genéricas: construye autoridad con una estética que inspira confianza profunda.
          </p>
          
          <footer className="mt-16 flex flex-col gap-6 sm:flex-row sm:items-center animate-in fade-in slide-in-from-bottom-8 duration-1000 delay-700 fill-mode-both">
            <Button size="lg" className="h-16 bg-primary px-10 font-body text-sm font-semibold uppercase tracking-[0.2em] text-primary-foreground hover:bg-primary/90 transition-all hover:pl-12 hover:-translate-y-1 rounded-none shadow-[4px_4px_0px_0px_hsl(var(--foreground))] hover:shadow-[6px_6px_0px_0px_hsl(var(--foreground))]">
              Comenzar Ahora <ArrowRight className="ml-4 h-4 w-4" />
            </Button>
            <Button variant="ghost" size="lg" className="h-16 px-8 font-body text-sm uppercase tracking-[0.1em] transition-colors hover:bg-accent/5 rounded-none border border-transparent hover:border-border">
              Ver Manifestos <ArrowDown className="ml-3 h-4 w-4" />
            </Button>
          </footer>
        </article>

        {/* Right Column: Embla Carousel with Brutalist Cards */}
        <aside className="relative hidden w-full lg:flex lg:items-center lg:justify-center h-full animate-in fade-in slide-in-from-right-16 duration-1000 delay-[800ms] fill-mode-both">
          
          <div className="w-[130%] absolute right-[-15%] overflow-hidden" ref={emblaRef}>
            <div className="flex touch-pan-y flex-row items-center">
              {carouselSlides.map((slide, index) => (
                <div key={slide.id} className="flex-[0_0_100%] min-w-0 pl-4 pr-4 py-12">
                  <div 
                    className={cn(
                      "relative border-[0.5px] border-primary/20 bg-background p-12 transition-all duration-700 flex flex-col justify-between group",
                      "min-h-[420px]",
                      index === selectedIndex ? "scale-100 shadow-[8px_8px_0px_0px_hsl(var(--primary)/0.1)] opacity-100" : "scale-[0.92] opacity-40 grayscale hover:grayscale-0"
                    )}
                  >
                    <div>
                      <div className="flex items-center justify-between mb-12">
                        <div className="h-14 w-14 border-[0.5px] border-primary/30 flex items-center justify-center transition-transform duration-700 group-hover:-rotate-12 bg-background">
                          {slide.icon}
                        </div>
                        <span className="font-body text-[9px] font-bold uppercase tracking-[0.2em] border-[0.5px] border-border px-3 py-1.5 text-muted-foreground">
                          {slide.badge}
                        </span>
                      </div>
                      
                      <h3 className="font-caption text-4xl italic mb-6 text-foreground tracking-tight">
                        {slide.title}
                      </h3>
                      <p className="font-body text-sm leading-relaxed text-muted-foreground/80 font-light">
                        {slide.description}
                      </p>
                    </div>
                    
                    <div className="mt-12 pt-8 border-t-[0.5px] border-primary/10 flex items-center justify-between">
                      <span className="font-body text-[10px] font-bold uppercase tracking-[0.2em] text-primary/60">Core Feature</span>
                      <span className="font-caption text-6xl italic text-primary/[0.03] font-black tracking-tighter leading-none -mb-4">
                        {String(index + 1).padStart(2, '0')}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Minimalist Carousel Controls */}
          <div className="absolute -bottom-8 right-0 flex gap-4 z-20 items-center">
            {carouselSlides.map((_, index) => (
              <button
                key={index}
                onClick={() => emblaApi?.scrollTo(index)}
                className={cn(
                  "transition-all duration-500 rounded-none border-[0.5px]",
                  index === selectedIndex 
                    ? "w-12 h-1 bg-primary border-primary" 
                    : "w-4 h-[1px] bg-transparent border-primary/30 hover:border-primary/80"
                )}
                aria-label={`Ir a diapositiva ${index + 1}`}
              />
            ))}
          </div>
          
          {/* Accent block behind the carousel (Asymmetric shape) */}
          <div className="absolute right-[-10%] top-[30%] -z-10 h-[120%] w-[80%] bg-accent/20 blur-3xl mix-blend-multiply rounded-[100%_40%_100%_0%] rotate-12 pointer-events-none" />
        </aside>
        
      </div>
    </section>
  );
};
