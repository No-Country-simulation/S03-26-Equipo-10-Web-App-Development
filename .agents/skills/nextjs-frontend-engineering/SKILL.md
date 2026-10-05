---
name: nextjs-frontend-engineering
description: >-
  Implementación de interfaces Next.js 15 y React 18 del Testimonial CMS (SKL-NEXT-FRONTEND-001). Usar para composición App Router, features, adaptadores HTTP a NestJS, sesión cliente actual, estado, accesibilidad y rendimiento de pantallas. Distingue reglas vigentes, opciones contextuales y migraciones futuras.
---

# SKL-NEXT-FRONTEND-001 — Frontend Next.js

## Propósito y baseline

Aplicar esta guía al crear o revisar pantallas de `apps/web`. Antes de cambiar código, leer `AGENTS.md`, `llm.txt`, el plan HITL activo y los archivos del feature. La skill de [arquitectura Next.js](../nextjs-architecture-engineering/SKILL.md) trata los límites de sistema; aquí se decide la implementación de UI.

| Estado | Uso |
| --- | --- |
| **Vigente** | Next.js 15.5, React 18.3, TypeScript, Tailwind 3.4, Radix, App Router, sesiones web mediante `useSession`. |
| **Opción contextual** | Fetch en Server Component, SSR privado, SWR/TanStack Query, Server Actions y BFF solo con contrato y necesidad explícitos. |
| **Migración futura** | Next 16 Cache Components y React 19; no asumir sus APIs en ejemplos de trabajo actual. |

## Contrato del frontend

- Mostrar, navegar, capturar entrada y adaptar respuestas de NestJS; no adjudicar permisos ni persistir dominio.
- Consumir `/api/v1/` mediante los adaptadores existentes; verificar rutas y tipos reales antes de reutilizar un ejemplo.
- NestJS aplica reglas de negocio, tenant, roles, scopes, feature flags y cuotas.
- No importar Prisma en web ni escribir una segunda implementación del lifecycle de testimonios.
- Una opción visible para admin o editor no sustituye autorización de la API.
- Dar feedback fiel a la respuesta real: loading, error, empty y success.

## Organización vigente

```text
apps/web/src/app/              rutas, layouts y estados Next
apps/web/src/features/<name>/   pantallas, componentes y adaptador api.ts
apps/web/src/hooks/use-session.ts
apps/web/src/lib/api.ts         transporte y Problem Details
apps/web/src/lib/api/validated-response.ts
apps/web/src/components/ui/    primitivas compartidas
```

Las rutas activas de `/admin` componen pantallas de feature. Las rutas `/t/[slug]` y `/p/[slug]` componen pantallas públicas. No declarar que esas páginas precargan datos en servidor: hoy sus pantallas gestionan la carga. Los archivos `apps/web/src/lib/api/api-client.ts` y `apps/web/src/styles/tokens.css` son preparatorios, no autoridad de implementación.

## Composición Server/Client

1. Una página de App Router es Server Component por defecto.
2. Si la pantalla usa estado, efectos, eventos o `useSession`, el componente interactivo requiere `'use client'`.
3. Mantener la frontera cliente tan pequeña como permita la implementación, sin romper el flujo actual.
4. Pasar del servidor al cliente solo props serializables y sin credenciales.
5. Evitar una cadena de wrappers globales si un proveedor puede vivir en el subárbol que lo usa.
6. No mover fetch privado a un Server Component sin diseñar reenvío seguro de sesión, caché y refresh.
7. Para datos públicos puede ser razonable un fetch de servidor; decidirlo según SEO, frescura y error.
8. No usar un `useEffect` para derivar valores que pueden calcularse durante render.

```tsx
// Patrón de composición vigente; el fetch queda en la pantalla cliente.
import PublicTestimonialsScreen from '@/features/public-testimonials/screens/public-testimonials-screen';

export default function Page() {
  return <PublicTestimonialsScreen />;
}
```

## Sesión y mutaciones privadas

- `useSession()` recupera sesión y ofrece `fetchApi`, `logout`, `hasRole` e `isAdmin`.
- `apps/web/src/features/auth/api.ts` implementa recuperación, refresh de cookies y CSRF para mutaciones.
- `requestApi()` usa `credentials: 'include'` y `cache: 'no-store'`.
- Usar `fetchApi` para llamadas privadas desde pantallas que dependen de sesión; no inventar otro almacén de JWT.
- Si una respuesta es 401, el wrapper intenta la recuperación definida; si no puede, el hook cierra y redirige.
- Tratar 403 como denegación de la operación. No ocultarlo detrás de un error genérico ni reintentar indefinidamente.
- Antes de una mutación, deshabilitar dobles envíos o usar la idempotencia acordada por la API; no suponer que todas las rutas son idempotentes.
- No guardar cookies HttpOnly, refresh tokens o secretos en `localStorage`.
- El `tenantId` de la sesión sirve para presentar contexto, no como prueba de autorización.

## Adaptadores HTTP

Un adaptador del feature contiene ruta, método, payload y esquema de respuesta. La lógica de presentación solo llama funciones con nombres de negocio. Antes de crear un adaptador nuevo, revisar `features/<feature>/api.ts` y `lib/api/validated-response.ts`.

```ts
// Ejemplo alineado con el adaptador público existente.
import { z } from 'zod';
import { publicRequest } from '@/lib/api/validated-response';

const summarySchema = z.object({
  id: z.string(),
  content: z.string(),
  rating: z.number(),
}).passthrough();

export async function loadPublicSummaries(slug: string) {
  const result = await publicRequest(
    `/public/testimonials/tenants/${encodeURIComponent(slug)}`,
    z.array(summarySchema),
  );
  return result.data;
}
```

El ejemplo representa un adaptador posible y usa un endpoint vigente; no sustituye `features/public-testimonials/api.ts`. Zod valida la red en runtime. `requestApi<T>` por sí solo valida la forma básica del envelope, no el valor de `T`.

- Reutilizar `ApiError` y Problem Details; no descartar `status`, `code` o causa al convertir errores.
- No convertir una respuesta malformada en éxito silencioso.
- Validar entradas y salida según confianza y criticidad; no duplicar todos los esquemas del backend sin necesidad.
- Codificar segmentos dinámicos. Para query strings, usar `URLSearchParams` con valores permitidos.
- Cuidar `AbortController` en búsquedas o requests cancelables que puedan solaparse.
- No registrar tokens, cookies ni cuerpos con PII para depurar adaptadores.

## Estado: dónde vive

| Estado | Ubicación preferida |
| --- | --- |
| Búsqueda, filtro y página compartibles | URL si la ruta ya soporta parámetros. |
| Lista o detalle remoto | Respuesta NestJS y estado de carga/error en el feature. |
| Campo, diálogo, foco, expansión | Estado local del componente. |
| Sesión | `useSession` y adaptadores de auth vigentes. |
| Tema | Proveedor de tema existente. |

No introducir Redux/Zustand/TanStack Query por una sola pantalla. Si se añade una librería de datos, definir cómo convive con `useSession`, refresh y caché de requests. No crear dos propietarios para la misma lista.

## Formularios y flujos

- Usar una entrada etiquetada y un mensaje de error asociado a cada campo.
- Validar formato en cliente para feedback temprano; NestJS vuelve a validar y decide el resultado.
- Deshabilitar envío durante una operación pendiente cuando corresponda y anunciar el resultado.
- Conservar los valores tras un fallo recuperable; no borrar un formulario por 409 o 503.
- Si se usa React Hook Form y Zod, mantener el esquema de UI en el feature y mapear errores de API con cuidado.
- Un 409 puede indicar transición de estado o versión conflictiva; ofrecer actualización de datos antes de reintentar.
- Confirmar una acción destructiva con la información necesaria, sin imponer diálogos a operaciones reversibles triviales.
- Respetar `draft → pending → approved → published | rejected`; no permitir un salto porque un botón esté visible.
- No tomar una respuesta optimista como confirmación durable de publicación o webhook.

## Estados de pantalla

1. **Loading:** mostrar estructura estable, botón ocupado y texto comprensible si la espera importa.
2. **Empty:** explicar que no hay datos y ofrecer la siguiente acción permitida.
3. **Error:** conservar contexto, mostrar mensaje seguro y reintento cuando la operación lo admite.
4. **Success:** mostrar resultado confirmado por la API y actualizar la vista o navegación.

`loading.tsx` es útil para segmentos suspendidos. Para fetch realizado en un Client Component, el estado de carga propio del feature sigue siendo necesario. `error.tsx` captura errores de renderizado, no todos los errores de formularios o HTTP gestionados en cliente.

## Accesibilidad y semántica

- Usar `button` para acciones y `a`/`Link` para navegación.
- Conservar orden de tabulación y foco visible; no ocultar el outline sin reemplazo equivalente.
- Etiquetar controles y asociar errores con `aria-describedby` o patrones de las primitivas existentes.
- Gestionar foco al abrir/cerrar diálogos; preferir Radix ya presente para patrones complejos.
- Usar HTML semántico y jerarquía de encabezados coherente con la pantalla.
- Comunicar estados asíncronos con texto y, cuando haga falta, una región viva no invasiva.
- Revisar contraste, zoom al 200 %, navegación por teclado y móvil; consultar [SEO y accesibilidad](../web-seo-accessibility-engineering/SKILL.md) si el alcance es mayor.
- Evitar que un skeleton cambie drásticamente la geometría y provoque CLS.

## Rendimiento y caché

- Medir el problema antes de introducir memoización o librerías de estado.
- Reducir Client Components grandes y dependencias importadas por ellos; analizar el bundle si crece.
- Cargar imágenes con dimensiones/relación conocidas para evitar saltos visuales.
- `next/image` puede ayudar en imágenes soportadas por el despliegue, pero revisar dominios y políticas del proyecto.
- Prefetch de enlaces solo si el costo y la sensibilidad de datos lo permiten.
- Las lecturas privadas actuales usan `no-store`; no cachear respuestas por slug o ruta sin identidad del usuario.
- La caché pública Redis de NestJS es distinta de la caché Next. Una mutación confirmada no invalida automáticamente ambas.
- Para un fetch servidor futuro en Next 15, elegir `cache: 'no-store'` o `next: { revalidate: segundos }` según frescura aceptada.
- `use cache`, `cacheLife` y Cache Components no son la política vigente en este repositorio.

## SEO y rutas públicas

- Las páginas públicas pueden beneficiarse de HTML inicial y metadata específica, pero la estrategia requiere cambiar el flujo de datos actual.
- No declarar indexable un contenido que solo aparece tras un fetch cliente sin verificar HTML renderizado y reglas de robots.
- Mantener slugs codificados y rutas canónicas definidas por producto; no generar canonicals con entrada no confiable.
- Las páginas privadas no requieren SEO público; metadata puede priorizar claridad de navegación.
- Usar `generateMetadata` solo cuando los datos y la estrategia de carga están definidos; evitar una llamada duplicada costosa sin caché compartida.

## Procedimiento de cambio de pantalla

1. Identificar el flujo y leer la ruta, pantalla, adaptador, DTO NestJS y regla de negocio.
2. Definir estados UI y quién posee cada dato.
3. Construir semántica y teclado antes de pulir estilos.
4. Conectar adaptador existente o crear uno con validación runtime proporcionada.
5. Manejar 401, 403, 409, 429 y fallas 5xx según el flujo real.
6. Probar al menos un éxito y un error material; para cambios sensibles, dos tenants o roles.
7. Revisar la salida visual en móvil y escritorio sin imponer otra identidad visual.
8. Si se altera renderizado o caché, verificar HTML, frescura y sesión en ejecución.

## Decisiones frecuentes de UI

### Listados administrativos

- Partir del endpoint existente y sus parámetros reales; no mostrar un selector de orden que la API ignora.
- Mantener filtro y página en URL cuando se espera compartir o recuperar la vista; si la ruta actual no lo hace, planificar el cambio completo.
- Mostrar total y rango solo cuando la API devuelve `meta` fiable.
- Al crear o eliminar, recargar la lista desde NestJS antes de afirmar el estado final.
- Un elemento puede desaparecer por cambio de estado o permisos; distinguir lista vacía de error de red.
- No traer todos los tenants para filtrar en navegador: el backend consulta dentro del tenant autenticado.
- Evitar claves de React basadas en índice cuando las filas pueden cambiar de orden.
- En una tabla densa, conservar encabezados y nombre accesible de acciones por fila.

### Detalles y modales

- El modal recibe un ID y datos existentes solo como punto de partida; para cambios sensibles, validar estado fresco.
- Abrirlo desde un botón con nombre claro y devolver foco al disparador al cerrar.
- Manejar Escape y bloqueo de foco mediante la primitiva Radix existente.
- No usar un modal para ocultar un error 403 o 409; explicar la causa que permita actuar.
- Si hay formularios largos, decidir si una página dedicada preserva mejor navegación y recuperación.
- Evitar duplicar el estado de un registro completo en varios componentes si puede derivarse de una fuente.

### Moderación de testimonios

- Mostrar estado actual y acciones permitidas de forma comprensible; la API confirma transición.
- No actualizar visualmente `published` hasta recibir éxito de NestJS.
- Tras 409, refrescar el testimonio: otro actor pudo cambiar su estado.
- Tras 403, retirar la acción o explicar que faltan permisos; no reenviar con otro tenant.
- El rechazo puede requerir motivo según contrato; validar entrada sin inventar una regla distinta a la API.
- Si se asocia tag/categoría, NestJS verifica pertenencia de ambos extremos al tenant.
- No mostrar un toast de “webhook entregado” al publicar: el outbox entrega después, al menos una vez.

### Captura pública

- Validar campos localmente para reducir errores, pero tratar la respuesta NestJS como decisión final.
- Preservar entrada ante una falla temporal sin guardar PII en almacenamiento persistente por defecto.
- Evitar dobles envíos mientras se espera respuesta, sin afirmar idempotencia fuerte si no está probada.
- Comunicar qué ocurrió después de enviar y cómo continuar si la operación no terminó.
- Medir accesibilidad de teclado y pantalla pequeña en los campos y estados de error.

## Manejo de respuestas y fallas

| Respuesta | Tratamiento de UI |
| --- | --- |
| 400/422 | Asociar errores válidos a campos; mantener valores. |
| 401 | Seguir recuperación/cierre de sesión del adaptador vigente. |
| 403 | Indicar permiso insuficiente y no repetir automáticamente. |
| 404 | Mostrar ausencia o recurso no visible; no reutilizar datos previos. |
| 409 | Refrescar estado antes de ofrecer otro intento. |
| 429 | Mostrar límite y tiempo de espera si la API lo comunica. |
| 5xx/red | Mensaje recuperable y reintento solo si no puede duplicar una mutación. |

Los Problem Details contienen `code` y `traceId`; mostrar al usuario el mensaje apropiado y conservar el identificador para soporte si el diseño lo requiere. No exponer payloads internos ni stack traces.

## Revisión de datos sensibles

- Confirmar que ninguna prop serializada de Server Component contenga cookies, access token o API key.
- Confirmar que screenshots, pruebas y logs no impriman credenciales reales.
- Limpiar estado de feature al salir de sesión si podría quedar información privada visible.
- Evitar que una caché de biblioteca cliente comparta datos entre cuentas en la misma pestaña.
- Tratar enlaces externos y URLs de medios como datos no confiables; validar origen y esquema donde corresponda.
- No insertar `dangerouslySetInnerHTML` con contenido de un testimonio sin política de sanitización.
- Una página pública puede mostrar contenido aprobado, pero no debe exponer drafts o pending por error de adaptador.

## Migraciones futuras

Next 16 y React 19 requieren actualización deliberada de dependencias, configuración y pruebas. Cache Components no se habilita con una frase en una skill. Un traslado de panel privado al servidor requiere contrato de cookies, CSRF, refresh y caché por usuario. Nuevos archivos de tokens o Tailwind 4 pertenecen a otra migración; `globals.css` y Tailwind 3 siguen vigentes.

## Definition of Done

- Pantalla y adaptador respetan los límites de feature y delegan negocio y autorización a NestJS.
- Sesión, tenant y CSRF siguen el mecanismo vigente; datos de red importantes se validan.
- Carga, vacío, error y éxito son utilizables, accesibles y fieles a la API.
- Renderizado y caché declarados corresponden al código Next.js 15.5 que se ejecuta.
- Se verificaron teclado, foco, móvil y los casos de error material del cambio.
- Capacidades futuras aparecen como migración, nunca como funcionalidad instalada.
