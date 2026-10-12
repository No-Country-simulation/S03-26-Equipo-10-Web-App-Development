# Recorridos de navegador

La suite web ejecutable vive en los archivos `*.test.tsx` de cada feature. Esos tests cubren nombres accesibles, foco del menú móvil, captura, errores y moderación con Testing Library. Este directorio conserva el recorrido exploratorio histórico de la fase 6. El runner Playwright de fase 2 vive en `apps/web/e2e/`, con configuración `apps/web/playwright.config.ts`; consultá [preparación, contratos y evidencia](../../../../../docs/technical/e2e.md). Su ejecución completa se registra en el plan activo; integración como gate CI en fase 3 pendiente. No hay una integración de axe en CI.

## Recorrido local de la fase 6

Con el build de Next.js 15 servido en `127.0.0.1:3100` y una API simulada de datos ficticios en `localhost:4000`, se probaron `/p/demo`, `/t/demo` y `/admin/testimonials` en un navegador a 320 × 700 px:

1. Comprobar que `document.documentElement.scrollWidth <= innerWidth` tras la carga de cada ruta. La tabla de administración puede desplazarse dentro de su contenedor.
2. En captura, buscar un único `main`, nombres para campos, radios y botones, y `alt` en imágenes. Tabular desde el testimonio hasta el nombre y comprobar el indicador visible de foco.
3. Abrir el menú móvil con Enter, cerrarlo con Escape y comprobar que el foco vuelve a «Abrir menú del panel».
4. Cambiar el tema desde el menú y revisar visualmente ambos temas. Inspeccionar la calificación, mensajes de error y contraste de texto legible.
5. Confirmar que el muro muestra solo testimonios públicos simulados y que la estructura conserva un `h1`, artículos y botones con nombre.

Estas comprobaciones no certifican WCAG 2.2 AA: faltan lector de pantalla, auditoría completa de contraste, flujos con API real y ejecución en dispositivos y navegadores adicionales. El nuevo runner usa servicios reales descartables y no una cuenta ni una base productiva; esta exploración histórica con API simulada conserva su límite y no se presenta como evidencia del nuevo E2E.
