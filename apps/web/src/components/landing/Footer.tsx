const links = {
  Producto: ["Características", "Precios", "Integraciones", "API"],
  Recursos: ["Documentación", "Blog", "Changelog", "Contacto"],
  Legal: ["Términos de servicio", "Política de privacidad", "Cookies"],
};

export const Footer = () => {
  return (
    <footer className="border-t py-20">
      <div className="container">
        <div className="grid gap-12 md:grid-cols-[2fr,1fr,1fr,1fr]">
          {/* Brand column */}
          <div>
            <div className="flex items-center gap-3">
              <span className="h-2 w-2 bg-primary"></span>
              <span className="font-body text-sm font-bold uppercase tracking-[0.2em] text-foreground">
                Testimonial CMS
              </span>
            </div>
            <p className="mt-6 max-w-xs font-body text-sm leading-relaxed text-muted-foreground">
              La plataforma todo-en-uno para gestionar, moderar y distribuir testimonios de clientes a escala global.
            </p>
          </div>
          
          {/* Link columns */}
          {Object.entries(links).map(([category, items]) => (
            <div key={category}>
              <h4 className="font-body text-xs font-bold uppercase tracking-widest text-foreground">{category}</h4>
              <ul className="mt-6 space-y-3">
                {items.map((item) => (
                  <li key={item}>
                    <a href="#" className="font-body text-sm text-muted-foreground transition-colors hover:text-primary">
                      {item}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        
        <div className="mt-20 flex flex-col items-center justify-between gap-4 border-t pt-8 md:flex-row">
          <p className="font-body text-xs uppercase tracking-widest text-muted-foreground">
            © {new Date().getFullYear()} Testimonial CMS. Todos los derechos reservados.
          </p>
          <div className="flex gap-6">
            <a href="#" className="font-body text-xs uppercase tracking-widest text-muted-foreground transition-colors hover:text-primary">Twitter</a>
            <a href="#" className="font-body text-xs uppercase tracking-widest text-muted-foreground transition-colors hover:text-primary">GitHub</a>
            <a href="#" className="font-body text-xs uppercase tracking-widest text-muted-foreground transition-colors hover:text-primary">LinkedIn</a>
          </div>
        </div>
      </div>
    </footer>
  );
};
