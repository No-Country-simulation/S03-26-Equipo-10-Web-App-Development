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
    <section className="relative min-h-[90vh] flex items-center overflow-hidden border-b py-20">
      <div className="absolute inset-0 bg-background/5" />
      
      <div className="container relative z-10 grid gap-12 lg:grid-cols-[1fr,400px] xl:grid-cols-[1fr,500px]">
        
        {/* Left Column: Massive Editorial Typography */}
        <article className="flex flex-col justify-center animate-fade-in-up stagger-1">
          <header className="flex items-center gap-4 mb-8">
            <span className="h-px w-12 bg-primary"></span>
            <span className="font-body text-sm font-bold uppercase tracking-widest text-primary">Testimonial CMS</span>
          </header>
          
          <h1 className="font-caption text-6xl font-normal leading-[1.1] tracking-tight text-foreground md:text-8xl lg:text-[7rem] text-balance">
            Voces que<br />
            <em className="text-primary italic">convierten.</em>
          </h1>
          
          <p className="mt-8 max-w-xl font-body text-lg font-light leading-relaxed text-muted-foreground md:text-xl text-balance">
            Gestiona, modera y despliega testimonios de forma sencilla. Olvida las plantillas genéricas: construye autoridad con una estética que inspira confianza profunda.
          </p>
          
          <footer className="mt-12 flex flex-col gap-4 sm:flex-row sm:items-center">
            <Button size="lg" className="h-14 bg-primary px-8 font-body text-sm uppercase tracking-wider text-primary-foreground hover:bg-primary/90 transition-transform hover:-translate-y-1">
              Comenzar Ahora <ArrowRight className="ml-3 h-4 w-4" />
            </Button>
            <Button variant="ghost" size="lg" className="h-14 px-8 font-body text-sm uppercase tracking-wider transition-colors hover:bg-accent/10">
              Ver Manifestos <ArrowDown className="ml-3 h-4 w-4" />
            </Button>
          </footer>
        </article>

        {/* Right Column: Embla Carousel with Brutalist Cards */}
        <aside className="relative hidden w-full lg:flex lg:items-center lg:justify-center animate-fade-in-up stagger-3 h-full">
          
          <div className="w-[120%] absolute right-[-10%] overflow-hidden" ref={emblaRef}>
            <div className="flex touch-pan-y flex-row">
              {carouselSlides.map((slide, index) => (
                <div key={slide.id} className="flex-[0_0_100%] min-w-0 pl-4 pr-4 py-8">
                  <div className="relative border bg-card p-10 shadow-soft-lg transition-transform duration-500 min-h-[340px] flex flex-col justify-between group">
                    <div>
                      <div className="flex items-center justify-between mb-8">
                        <div className="h-12 w-12 border border-primary bg-primary/10 flex items-center justify-center transition-transform duration-500 group-hover:scale-110">
                          {slide.icon}
                        </div>
                        <span className="font-body text-[10px] font-bold uppercase tracking-widest bg-muted px-2 py-1 text-muted-foreground">
                          {slide.badge}
                        </span>
                      </div>
                      
                      <h3 className="font-caption text-3xl italic mb-4 text-foreground">
                        {slide.title}
                      </h3>
                      <p className="font-body text-sm leading-relaxed text-muted-foreground">
                        {slide.description}
                      </p>
                    </div>
                    
                    <div className="mt-8 pt-6 border-t flex items-center justify-between">
                      <span className="font-body text-xs font-bold uppercase tracking-widest text-primary">Core Feature</span>
                      <span className="font-caption text-4xl italic text-foreground/10 font-bold">{String(index + 1).padStart(2, '0')}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Carousel Controls */}
          <div className="absolute -bottom-4 right-0 flex gap-2 z-20">
            {carouselSlides.map((_, index) => (
              <button
                key={index}
                onClick={() => emblaApi?.scrollTo(index)}
                className={cn(
                  "h-1 transition-all duration-300 rounded-full",
                  index === selectedIndex ? "w-8 bg-primary" : "w-4 bg-primary/20 hover:bg-primary/40"
                )}
                aria-label={`Ir a diapositiva ${index + 1}`}
              />
            ))}
          </div>
          
          {/* Accent block behind the carousel */}
          <div className="absolute right-[-2rem] top-[calc(50%+2rem)] -z-10 h-64 w-64 -translate-y-1/2 bg-primary/20 backdrop-blur-3xl rounded-full mix-blend-multiply pointer-events-none" />
        </aside>
        
      </div>
    </section>
  );
};
