import { ArrowRight, ArrowDown } from "lucide-react";
import { Button } from "@/components/ui/button";

export const HeroSection = () => {
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

        {/* Right Column: Brutalist / Asymmetrical Floating Testimonial */}
        <aside className="relative hidden w-full lg:block animate-fade-in-up stagger-3">
          <div className="absolute right-0 top-1/2 -translate-y-1/2 w-[120%] border bg-card p-10 shadow-soft-lg transition-transform hover:-translate-x-2 hover:-translate-y-[calc(50%+0.5rem)] duration-500">
            <div className="mb-6 flex gap-1">
              {[1, 2, 3, 4, 5].map((star) => (
                <svg key={star} className="h-5 w-5 text-primary" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                </svg>
              ))}
            </div>
            <blockquote className="font-caption text-2xl italic leading-relaxed text-card-foreground">
              &ldquo;Implementar Testimonial CMS no solo subió nuestras conversiones un 34%, sino que elevó por completo la percepción de nuestra marca. Absolutamente impecable.&rdquo;
            </blockquote>
            <figcaption className="mt-8 flex items-center gap-4">
              <div className="h-12 w-12 border border-primary bg-primary/10"></div>
              <div>
                <p className="font-body text-sm font-bold uppercase tracking-wider text-foreground">Laura H.</p>
                <p className="font-body text-xs text-muted-foreground uppercase tracking-widest">Directora Creativa, Studio X</p>
              </div>
            </figcaption>
          </div>
          
          {/* Accent block behind the card */}
          <div className="absolute right-[-2rem] top-[calc(50%+2rem)] -z-10 h-64 w-64 -translate-y-1/2 bg-primary/20 backdrop-blur-3xl rounded-full mix-blend-multiply" />
        </aside>
        
      </div>
    </section>
  );
};
