import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

const plans = [
  {
    name: "Básico",
    price: "$29",
    period: "/mes",
    description: "Para emprendedores y sitios web pequeños.",
    features: ["1 sitio web", "100 testimonios", "Widget básico", "API limitada", "Soporte por email"],
    cta: "Elegir plan",
    popular: false,
  },
  {
    name: "Profesional",
    price: "$99",
    period: "/mes",
    description: "Para equipos de marketing en crecimiento.",
    features: ["3 sitios web", "Testimonios ilimitados", "Analítica avanzada", "Webhooks", "Widget personalizable", "Soporte prioritario"],
    cta: "Elegir plan",
    popular: true,
  },
  {
    name: "Empresa",
    price: "Personalizado",
    period: "",
    description: "Para agencias y grandes organizaciones.",
    features: ["Multi‑tenant", "Integraciones a medida", "SLA garantizado", "Soporte dedicado", "API sin límites", "Onboarding personalizado"],
    cta: "Contactar",
    popular: false,
  },
];

export const PricingSection = () => {
  return (
    <section id="precios" className="bg-section-alt py-20">
      <div className="container">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="font-heading text-3xl font-semibold text-foreground md:text-4xl">
            Planes y precios
          </h2>
          <p className="mt-4 text-muted-foreground">
            Elige el plan que mejor se adapte a tus necesidades. Sin contratos, cancela cuando quieras.
          </p>
        </div>
        <div className="mt-14 grid gap-6 md:grid-cols-3">
          {plans.map((plan) => (
            <div
              key={plan.name}
              className={`relative flex flex-col rounded-lg border bg-card p-6 shadow-soft transition-shadow hover:shadow-soft-lg ${
                plan.popular ? "border-primary ring-2 ring-primary/20" : ""
              }`}
            >
              {plan.popular && (
                <Badge className="absolute -top-3 left-1/2 -translate-x-1/2">
                  Más popular
                </Badge>
              )}
              <h3 className="font-heading text-xl font-semibold text-foreground">{plan.name}</h3>
              <div className="mt-4 flex items-baseline gap-1">
                <span className="font-heading text-4xl font-bold text-foreground">{plan.price}</span>
                {plan.period && <span className="text-sm text-muted-foreground">{plan.period}</span>}
              </div>
              <p className="mt-2 text-sm text-muted-foreground">{plan.description}</p>
              <ul className="mt-6 flex-1 space-y-3">
                {plan.features.map((f) => (
                  <li key={f} className="flex items-start gap-2 text-sm text-foreground">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                    {f}
                  </li>
                ))}
              </ul>
              <Button className="mt-8 w-full" variant={plan.popular ? "default" : "outline"}>
                {plan.cta}
              </Button>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};
