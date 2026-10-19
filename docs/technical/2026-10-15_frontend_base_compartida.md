# Base compartida del frontend — fase 2

Actualización: 2026-10-15. Alcance y aceptación en el [plan integral](../plan/2026-10-14_feat-mejoras-integrales-frontend.md). Conserva Next.js 15, React 18, Tailwind 4, Radix e identidad editorial.

## Colores y tipografía

`apps/web/src/app/globals.css` sigue siendo la autoridad de tokens HSL; `tailwind.config.ts` los expone a las utilidades. Se añadieron `success`, `warning` e `info` con sus foregrounds. `destructive` sirve tanto para texto de error como para botón destructivo con foreground apropiado al tema. Se usan tintes del 10 % en los badges modificados; un foreground legible sobre un fondo sólido no garantiza contraste sobre cualquier combinación de alpha.

La barra lateral usa `sidebar-*` de forma consistente y conserva la inversión editorial: oscura con tema claro y clara con tema oscuro. El elemento activo usa `sidebar-accent` y `sidebar-accent-foreground`, además del indicador terracota. `.surface-inverse` da a los paneles editoriales invertidos de acceso, registro y landing la paleta de acción correspondiente a su superficie; no altera sus textos, destinos ni capacidades.

Los controles y datos usan sans; las cifras de resumen y tablas usan números tabulares. Las familias Tailwind ahora consumen las variables cargadas por `next/font`, en lugar de depender del nombre de una fuente que quizá no estuviera instalada. Citas y títulos conservan su serif editorial.

Los 40 pares de tokens evaluados incluyen texto de acción/estado sobre fondo y card con tinte de 10 %, foreground sobre botón sólido, muted y navegación. Mínimo calculado: **5,13:1**. La comprobación de estilos en navegador complementa el cálculo; no equivale a verificar todas las combinaciones, opacidades, medios o estados posibles del sitio.

## Componentes activos

| Pieza                                            | Comportamiento                                                                                                                                                                                               |
| ------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `features/shared/feedback.tsx`                   | `LoadingState` anuncia la carga con `status`; spinner decorativo y alternativa sin movimiento. `ActionFeedback` presenta error con `alert` y éxito/información con `status`, texto legible y borde semántico |
| `features/shared/use-action-confirmation.tsx`    | AlertDialog real con objeto y consecuencias, Cancelar enfocado, bloqueo síncrono y controles ocupados; error en contexto sin reintento automático                                                            |
| `features/shared/use-dialog-focus.ts`            | Guarda el control que abrió el diálogo y devuelve el foco al cerrar; si desapareció, usa `main-content` cuando está disponible                                                                               |
| `features/shared/rating-display.tsx`             | Valoración textual visible y nombre accesible «N de 5 estrellas», con iconos decorativos                                                                                                                     |
| `features/shared/pagination.tsx`                 | Botones sin submit, contenido que se adapta al ancho y anuncio de página/total                                                                                                                               |
| Dialog/Sheet/AlertDialog y Button/Input/Textarea | Cierres en español; objetivos de cierre y botones de 44 px; foco y tipografía compartidos; campos legibles en móvil                                                                                          |

Se reemplazaron confirmaciones nativas ya existentes en eliminación de usuarios, revocación de API keys y eliminación/rotación de webhooks. No se añadieron endpoints ni se adelantaron renombrado, pausa, activación, nuevos permisos o políticas de credenciales. Las confirmaciones específicas de clasificación y logo se completan en fases 4 y 7.

El shell administrativo ofrece «Saltar al contenido» con destino enfocable. Las tablas operativas principales tienen región de scroll con nombre, foco de teclado, caption y encabezados de columna. El menú móvil mantiene el foco, Escape y `aria-expanded`, y el cierre queda accesible a 320 px. La galería usa `aria-expanded`/`aria-controls` para el detalle; la navegación de sus páginas sigue pendiente de fase 9.

La preferencia de movimiento reducido desactiva animación y transición únicamente en overlays/diálogos/paneles compartidos, y evita scroll suave. Se mantiene el estado visible, sin un temporizador global de 0,01 ms que destruya el feedback.

## Storage bloqueado

- El tema consulta/escribe storage dentro de `try/catch`; si falla, usa preferencia del sistema y estado React en memoria.
- El lector legado de sesión sólo devuelve una credencial después de leerla y eliminarla correctamente. Si no puede consumirla, devuelve `null` y permite la recuperación por cookies. La limpieza legada no interrumpe logout o recuperación. No se crea un almacén de credenciales de reemplazo.
- `lib/preference-storage.ts` mantiene en memoria únicamente marcadores de tracking no sensibles. Captura fallas del getter y de get/set/remove. Una eliminación fallida deja un marcador nulo en memoria, evitando que reaparezca un valor viejo de storage.
- Un fallo de tracking no impide leer o expandir un testimonio; permite un intento posterior. No se registran payloads, credenciales ni cuerpos de testimonios para depurar.

## Verificación y límites

La suite completa se amplió de 192 a **204 tests**. Las nuevas pruebas cubren storage, consumo legado seguro, cierre y foco, bloqueo de confirmaciones, tres hosts reales con adaptadores validados, y galería ante tracking fallido. Se observaron cuatro fallos Red antes de corregir producción y un fallo posterior de retorno de foco en la confirmación nueva, corregido con el hook compartido. Las pruebas de ampliación posteriores no se presentan como Red previo.

Navegador: Chrome instalado con Playwright, Next dev, respuestas API sintéticas, escritorio/móvil, claro/oscuro y storage denegado. Se verificaron teclado, foco, diálogo con error, cancelaciones sin DELETE, lectura/expansión, fuentes y colores calculados. El script corrigió una referencia al botón que cambia de nombre al expandirse; no se atribuye ese error a la aplicación. La inspección detectó el solapamiento del cierre y se corrigió en bloque antes de confirmar.

No se ejecutaron migraciones, integración con PostgreSQL/Redis, E2E con servicios reales, build de producción ni CI. No se certifica WCAG, lector de pantalla, dispositivo físico o zoom integral. El logo predeterminado faltante, borrados de clasificación, credenciales, formularios de autenticación, galería completa y siete flujos BI conservan sus fases propias. La aplicación del plan no habilita capacidades publicitarias todavía no acreditadas.
