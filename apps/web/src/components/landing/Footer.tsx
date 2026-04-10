import { MessageSquareQuote } from "lucide-react";

const links = {
  Producto: ["Características", "Precios", "Integraciones", "API"],
  Recursos: ["Documentación", "Blog", "Changelog", "Contacto"],
  Legal: ["Términos de servicio", "Política de privacidad", "Cookies"],
};

export const Footer = () => {
  return (
    <footer className="border-t bg-section-alt py-12">
      <div className="container">
        <div className="grid gap-8 md:grid-cols-4">
          <div>
            <a href="/" className="flex items-center gap-2 font-heading text-lg font-bold text-foreground">
              <MessageSquareQuote className="h-5 w-5 text-primary" />
              Testimonial CMS
            </a>
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
              La plataforma todo en uno para gestionar, moderar y distribuir testimonios de clientes.
            </p>
          </div>
          {Object.entries(links).map(([category, items]) => (
            <div key={category}>
              <h4 className="font-heading text-sm font-semibold text-foreground">{category}</h4>
              <ul className="mt-3 space-y-2">
                {items.map((item) => (
                  <li key={item}>
                    <a href="#" className="text-sm text-muted-foreground transition-colors hover:text-foreground">
                      {item}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <div className="mt-10 border-t pt-6 text-center text-xs text-muted-foreground">
          © {new Date().getFullYear()} Testimonial CMS. Todos los derechos reservados.
        </div>
      </div>
    </footer>
  );
};
