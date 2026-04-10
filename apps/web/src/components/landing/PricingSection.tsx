import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const plans = [
  {
    name: "Básico",
    price: "$29",
    period: "/mes",
    description: "Para emprendedores y sitios web pequeños.",
    features: ["1 sitio web", "100 testimonios", "Widget básico", "API limitada", "Soporte por email"],
    cta: "Elegir Plan",
    featured: false,
  },
  {
    name: "Profesional",
    price: "$99",
    period: "/mes",
    description: "Para equipos de marketing en crecimiento.",
    features: ["3 sitios web", "Testimonios ilimitados", "Analítica avanzada", "Webhooks", "Widget personalizable", "Soporte prioritario"],
    cta: "Elegir Plan",
    featured: true,
  },
  {
    name: "Empresa",
    price: "Custom",
    period: "",
    description: "Para agencias y grandes organizaciones.",
    features: ["Multi-tenant", "Integraciones a medida", "SLA garantizado", "Soporte dedicado", "API sin límites", "Onboarding personalizado"],
    cta: "Contactar",
    featured: false,
  },
];

export const PricingSection = () => {
  return (
    <section id="precios" className="bg-section-alt py-32">
      <div className="container">
        <div className="mb-20 flex flex-col gap-6 md:flex-row md:items-end md:justify-between border-b border-foreground/10 pb-16">
          <div className="max-w-2xl">
            <span className="font-body text-xs font-bold uppercase tracking-widest text-primary">Precios</span>
            <h2 className="mt-4 font-caption text-4xl font-light italic leading-tight text-foreground md:text-6xl">
              Inversión <br />
              <strong className="font-body font-bold not-italic">transparente.</strong>
            </h2>
          </div>
          <p className="max-w-xs font-body text-sm text-muted-foreground uppercase tracking-widest font-medium">
            Sin contratos. Cancela cuando quieras.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          {plans.map((plan) => (
            <div
              key={plan.name}
              className={cn(
                "group relative flex flex-col justify-between p-10 transition-transform duration-300 hover:-translate-y-2",
                plan.featured
                  ? "bg-primary text-primary-foreground"
                  : "border bg-card text-card-foreground"
              )}
            >
              {plan.featured && (
                <div className="absolute -top-px left-0 right-0 h-1 bg-primary-foreground/30" />
              )}
              
              <div>
                <h3 className="font-body text-sm font-bold uppercase tracking-widest">{plan.name}</h3>
                <div className="mt-6 flex items-baseline gap-1">
                  <span className="font-caption text-5xl font-light italic">{plan.price}</span>
                  {plan.period && <span className="font-body text-sm opacity-60">{plan.period}</span>}
                </div>
                <p className="mt-3 font-body text-sm opacity-70">{plan.description}</p>
                
                <ul className="mt-10 space-y-4">
                  {plan.features.map((f) => (
                    <li key={f} className="flex items-start gap-3 font-body text-sm">
                      <Check className={cn(
                        "mt-0.5 h-4 w-4 shrink-0",
                        plan.featured ? "text-primary-foreground" : "text-primary"
                      )} />
                      {f}
                    </li>
                  ))}
                </ul>
              </div>
              
              <Button 
                className={cn(
                  "mt-12 w-full h-12 font-body text-xs uppercase tracking-wider",
                  plan.featured 
                    ? "bg-primary-foreground text-primary hover:bg-primary-foreground/90" 
                    : "bg-primary text-primary-foreground hover:bg-primary/90"
                )}
              >
                {plan.cta}
              </Button>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};
