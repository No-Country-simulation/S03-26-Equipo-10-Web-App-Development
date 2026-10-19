# Landing, ayuda y aliases de navegación

**Alcance:** fase 11 del [plan de mejoras integrales](../plan/2026-10-14_feat-mejoras-integrales-frontend.md). Rutas `/`, `/docs` y entradas preparatorias. No cambia autenticación, permisos, API ni infraestructura.

## Portada y contenido publicable

`app/page.tsx` compone `features/landing/screens/landing-screen.tsx`. Conserva crema/terracota, tipografía editorial y esquinas rectas. La portada explica recepción → revisión → publicación y dirige a registro, al proceso o a ayuda. Header y footer comparten destinos reales; el header mantiene acceso de usuario y tema. Sus enlaces de producto usan `/#...` para funcionar también desde `/docs`. El salto al contenido apunta al `main` de cada superficie.

Se retiran las promesas de widget, conversión/tiempos de integración, selectores multiempresa, integraciones preconfiguradas y planes no acreditados. El scoring se describe con los factores del servicio vigente: valoración, vistas/clics y antigüedad. El detalle de esa fórmula no se presenta como análisis semántico ni predicción de ventas. La portada no garantiza disponibilidad operativa de un despliegue todavía no aceptado.

Los componentes comerciales originales se conservan en `components/landing/drafts/`: `PricingSection`, `TestimonialsSection` y `CommercialCTADraft`. Contienen material pendiente de respaldo y no están importados por rutas públicas ni tienen URL. No se sustituyeron precios, clientes o condiciones por afirmaciones inventadas. Se retiran enlaces legales, contacto, redes, blog y changelog sin contenido/destino aprobado.

Se reemplaza la rotación automática por información estática visible también en móvil. No hay autoplay ni controles diminutos de carrusel en la portada. La reducción de movimiento conserva el comportamiento global del proyecto; no se añaden animaciones o gestos personalizados. El overlay global y la revisión de costos de producción permanecen en la fase 12.

## Ayuda

`/docs` compone `features/help/screens/help-screen.tsx`, con título/descripción propios y cinco temas enlazables: captura, moderación, publicación, API keys y webhooks. Describe los estados y controles realmente disponibles, la recepción parcial sin reenviar texto, las limitaciones de métricas, el acceso desde servidor por API, revelación única, gracia acotada, firma/deduplicación y prueba encolada frente a entrega confirmada. Los ejemplos de rutas no contienen claves, tokens, contraseñas ni datos de clientes.

El contenido es público y estático; acceder desde un enlace administrativo no concede permisos. Las acciones llevan a las pantallas vigentes y usan su sesión/autoridad API. No se crea un widget ni se promete recuperación de contraseña o invitación por email. La metadata no agrega host canónico, sitemap o política nueva de indexación.

## Entradas preparatorias

| URL anterior              | Destino o contenido                                                          |
| ------------------------- | ---------------------------------------------------------------------------- |
| `/login`                  | `/admin/login`                                                               |
| `/dashboard`              | `/admin`                                                                     |
| `/analytics`              | `/admin/analytics`                                                           |
| `/testimonials`           | `/admin/testimonials`                                                        |
| `/testimonials/[id]`      | `/admin/testimonials?page=1&testimonial=<uuid>`                              |
| `/testimonials/[id]/edit` | La misma revisión contextual; la acción Editar conserva las reglas vigentes. |
| `/settings/users`         | `/admin/users`                                                               |
| `/settings/webhooks`      | `/admin/webhooks`                                                            |
| `/settings/api-keys`      | `/admin/api-keys`                                                            |
| `/settings/feature-flags` | `/admin/settings#capabilities`                                               |
| `/settings/integrations`  | `/admin/settings#integrations`                                               |
| `/docs`                   | Ayuda real, sin placeholder.                                                 |

Son páginas Server Component que usan `redirect`, sin sesión alternativa ni consultas privadas de servidor. No aceptan destinos externos ni copian parámetros arbitrarios de query. Los identificadores dinámicos se validan como UUID y se normalizan a minúsculas; un valor inválido invoca `notFound()` antes de consultar recursos. El detalle vigente recupera el recurso fuera de la página inicial y la API aplica tenant, rol, propiedad y estado. Un alias `/edit` no activa permisos, no habilita edición de publicados y no evade una denegación de recurso ajeno. Se abre el detalle y se usa Editar cuando corresponde.

Con el streaming de App Router, el documento puede empezar como HTTP 200 y emitir la redirección mediante metadata, en vez de un 307 antes de enviar HTML. La verificación debe comprobar el destino y la navegación final, no asumir un status previo a la renderización. Los redirects no se declaran permanentes. Un `notFound()` emitido después del inicio del stream también puede conservar 200; la UI de ausencia no revela recurso privado.

Configuración incorpora una sección de integraciones con accesos a claves, webhooks y ayuda. `#capabilities` mantiene los parámetros reales de la fase 7. Los anchors esperan la lectura inicial del espacio y reciben foco sin repetir el salto en posteriores refrescos. Ambos destinos permanecen restringidos a administración; la pantalla explica la restricción al editor y la API mantiene la autoridad.

## Verificación y límites

Las pruebas de contenido/destinos, UUID, ayuda, hero y configuración se ejecutan en Vitest/Testing Library; los redirects Next están simulados en las pruebas unitarias. Se amplían E2E-SESSION para `/login` y E2E-PUBLISH para el alias de edición de una historia publicada, conservando seis recorridos y sus gates. El harness local requiere sus servicios descartables; un bloqueo Docker impide afirmar su aceptación.

La revisión local con Chromium verifica layout, teclado, anchors y navegación con transporte sintético en claro/oscuro y tamaños 320/375/768/1440 px. La comprobación de reflow de 720 CSS px con DPR 2 representa el espacio equivalente a 200% sobre 1440 px físicos; no es un dispositivo ni un gesto de zoom nativo. No acredita backend/servicios reales, otros motores, hardware físico, lector de pantalla ni auditoría WCAG completa. Resultados concretos y pendientes en el registro del plan.
