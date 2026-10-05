---
name: nextjs-architecture-engineering
description: >-
  Arquitectura de la aplicación Next.js 15 del Testimonial CMS (SKL-NEXT-ARCH-001). Usar para decidir fronteras entre App Router, features y API NestJS; composición Server/Client, adaptadores HTTP, sesión, caché y despliegue. Distingue reglas vigentes, opciones contextuales y migraciones futuras.
---

# SKL-NEXT-ARCH-001 — Arquitectura Next.js

## Propósito y fuentes

Esta guía orienta decisiones estructurales de la web. Leer primero `AGENTS.md`, `llm.txt`, `docs/technical/01_architecture.md`, el plan HITL activo y el código afectado. Si difiere de ellos, prevalece el estado ejecutable del repositorio.

| Estado | Criterio |
| --- | --- |
| **Vigente** | Next.js 15.5 App Router, React 18.3, npm workspaces y API NestJS independiente. |
| **Opción contextual** | Server Components con fetch a NestJS, Route Handlers BFF, Server Actions, renderizado estático y revalidación por tiempo, tras revisar sesión y despliegue. |
| **Migración futura** | Next.js 16 `cacheComponents`, `cacheLife` y `cacheTag`; no están configurados. |

## Frontera del sistema

1. NestJS es la autoridad de autenticación, autorización, tenants, reglas de negocio, persistencia, cuotas, outbox y webhooks.
2. Next.js compone rutas, UI, navegación, metadata y adaptadores HTTP; no ejecuta casos de uso del dominio.
3. La web consume `/api/v1/` de NestJS. El cliente vigente obtiene la base de `NEXT_PUBLIC_API_URL` en `apps/web/src/lib/api.ts`.
4. Un permiso mostrado en la UI mejora la experiencia; cada operación se autoriza de nuevo en NestJS.
5. La identidad del tenant procede de la credencial verificada por la API. Nunca aceptar un `tenantId` del navegador como prueba de acceso.
6. Los recursos del tenant se filtran por `tenantId` en la API; Next no puede compensar una consulta sin aislamiento.
7. Redis compartido pertenece a cuotas y caché pública de NestJS. Los webhooks se entregan mediante polling PostgreSQL dentro de la API.

```text
Browser → Next.js App Router / Client Components → API HTTP NestJS
                                                → PostgreSQL + Redis
```

## Mapa de código vigente

- `apps/web/src/app/`: composición de rutas, layouts y estados de carga/error.
- `apps/web/src/features/`: pantallas, componentes y adaptadores HTTP por capacidad.
- `apps/web/src/hooks/use-session.ts`: sesión de rutas activas en cliente, recuperación, redirección y wrapper autenticado.
- `apps/web/src/features/auth/api.ts`: cookies de sesión, CSRF, refresh, login y logout mediante NestJS.
- `apps/web/src/lib/api.ts`: transporte HTTP vigente con `credentials: 'include'`, `cache: 'no-store'`, envelope y Problem Details.
- `apps/web/src/lib/api/validated-response.ts`: validación Zod en adaptadores de features.
- `apps/web/src/lib/api/api-client.ts`: marcador preparatorio; no describirlo como cliente operativo.

No mover código por preferencia arquitectónica si el feature actual ya ofrece un límite claro. Las rutas simples preparatorias pueden permanecer en `app/`.

## Decisión de ubicación

| Necesidad | Lugar preferido | Razón |
| --- | --- | --- |
| Navegación y composición | `app/**/page.tsx` y `layout.tsx` | Convenciones App Router. |
| Pantalla o interacción | `features/<feature>/screens` o `components` | Cohesión del feature. |
| Endpoint y esquema de respuesta | `features/<feature>/api.ts` | Transporte fuera de presentación. |
| Transición, RBAC o acceso a datos | `apps/api/src/modules/<module>` | NestJS tiene la autoridad. |
| Utilidad transversal real | `apps/web/src/lib` o `components/ui` | Reutilización comprobada. |
| Lógica solo de servidor futura | Módulo `server-only` | Evitar exposición al bundle cliente. |

`'use client'` marca una frontera de módulos. Todo lo importado por un Client Component debe ser seguro para navegador. No poner esa directiva en un layout amplio si solo un control necesita interactividad. Un Server Component puede renderizar un Client Component y pasarle props serializables.

## Server Components según la ruta

- `page.tsx` y `layout.tsx` son Server Components por defecto en Next.js 15.
- Las rutas `/admin` actuales delegan a pantallas cliente y `useSession`. No asumir que un server fetch puede usar automáticamente la cookie del navegador.
- Una ruta pública puede consultar NestJS desde un Server Component si el endpoint es público y se definen errores y caché.
- Para una ruta privada, definir primero transferencia de sesión a NestJS, protección entre usuarios y tratamiento de refresh/CSRF. Si eso no existe, conservar el flujo cliente.
- `cookies()` no sustituye la verificación de credencial y tenant que hace NestJS.
- No serializar secretos, JWT ni datos privados de otros usuarios en props o HTML.
- No llamar a un Route Handler propio desde un Server Component solo para llegar a NestJS; usar un adaptador server-only cuando el contrato de autenticación está resuelto.

### Composición vigente

```tsx
// apps/web/src/app/t/[slug]/page.tsx
import PublicTestimonialsScreen from '@/features/public-testimonials/screens/public-testimonials-screen';

export default function Page() {
  return <PublicTestimonialsScreen />;
}
```

Esta página es un Server Component que compone una pantalla cliente. No implica SSR de testimonios: los datos se obtienen mediante el flujo de esa pantalla.

### Alternativa contextual para datos públicos

Si un feature pasa a consultar NestJS en servidor, mantener el adaptador fuera de `app/`, validar el envelope y declarar la política de caché. Esto no describe el estado actual de `/t/[slug]`:

```ts
import { z } from 'zod';

const responseSchema = z.object({
  success: z.literal(true),
  data: z.array(z.object({ id: z.string(), content: z.string() })),
});

export async function getPublicTestimonials(apiBaseUrl: string, slug: string) {
  const response = await fetch(
    `${apiBaseUrl}/public/testimonials/tenants/${encodeURIComponent(slug)}`,
    { cache: 'no-store' },
  );
  if (!response.ok) throw new Error('No se pudo obtener la lista pública');
  return responseSchema.parse(await response.json()).data;
}
```

`apiBaseUrl` debe proceder de configuración confiable del servidor. El módulo del ejemplo se importa solo desde Server Components; el marcador `server-only` requiere declararlo como dependencia antes de usarlo. El ejemplo omite credenciales porque el endpoint es público. No reutilizarlo en rutas privadas sin revisar sesión y caché.

## Adaptadores HTTP y contratos

- Un adaptador conoce ruta, método, payload, esquema y errores recuperables; no calcula reglas de negocio.
- `requestApi` trata `application/problem+json` y verifica el envelope. El genérico `T` no valida datos: usar `sessionRequest` o `publicRequest` con Zod.
- Tratar contenido de red como `unknown` hasta validarlo. No convertir un error de contrato en lista vacía o éxito aparente.
- Mantener `credentials: 'include'` y CSRF del flujo vigente para mutaciones privadas; no añadir Bearer del navegador por comodidad.
- Codificar segmentos externos con `encodeURIComponent`; no construir URLs desde orígenes controlados por usuario.
- Las llamadas privadas usan `cache: 'no-store'` en el cliente actual. Al migrar un fetch al servidor, especificar de nuevo la caché.

## Server Actions y Route Handlers

**Opción contextual:** Server Actions son transporte de una interacción de Next, no capa de dominio. Validar entrada, autenticar y delegar a NestJS; la API vuelve a verificar autorización y tenant. Revisar CSRF, cookies y entorno de despliegue.

**Opción contextual:** Route Handlers sirven para callbacks o un BFF con beneficio concreto: ocultar una credencial server-only, transformar un contrato o resolver un requisito de origen. No replicar `/api/v1/` completo. `apps/web/src/app/health/route.ts` es la excepción operativa vigente.

Si un Route Handler reenvía un request privado, definir cookies, headers, timeout, tamaño de cuerpo y errores permitidos. No copiar ciegamente `Cookie`, `Authorization` ni un cuerpo hacia destinos controlados por usuario.

## Caché y frescura en Next.js 15

| Dato | Regla vigente o decisión |
| --- | --- |
| Panel autenticado | No compartir entre usuarios o tenants; cliente HTTP actual usa `no-store`. |
| Contenido público en NestJS | La API usa Redis con TTL y versión por tenant; revisar headers y contrato antes de sumar caché. |
| Server fetch público futuro | Elegir `cache: 'no-store'` inicialmente; `next: { revalidate: segundos }` solo con desfase aceptado y probado. |
| Mutación | NestJS confirma el cambio; refrescar UI tras éxito. La invalidación Next no invalida Redis. |

No habilitar `cacheComponents` en el proyecto actual. En Next.js 15, `use cache` fue experimental y requiere configuración y análisis de despliegue. No presentarlo como sustituto listo para `fetch` y `next: { revalidate }`. `revalidatePath`/`revalidateTag` afectan la caché Next pertinente; no garantizan frescura en NestJS ni propagación entre réplicas sin diseño adicional.

## Seguridad de fronteras

1. Nunca importar `@prisma/client` desde `apps/web` ni abrir conexiones PostgreSQL en Next.
2. `NEXT_PUBLIC_` indica valor visible en cliente; no contiene secretos. La URL de API es pública.
3. Ante 401, usar recuperación o cierre de sesión del adaptador vigente; ante 403, mostrar acceso denegado.
4. Un role flag de React no decide acceso final. Roles, scopes, flags y propiedad se verifican en NestJS.
5. No interpolar HTML no confiable sin sanitización deliberada. Preferir texto escapado por React.
6. No cachear una respuesta con cookie privada en una clave global o solo por slug.
7. En enlaces públicos, la API valida slug, identificador y pertenencia al tenant consultado.
8. No registrar cookies, tokens, claves ni payloads con PII en logs.

## Fallas y operación

- Diseñar estados de carga, vacío, error y éxito, con reintento solo cuando sea seguro.
- Un timeout de Next no reemplaza timeout de NestJS. Definir cancelación para nuevos adaptadores cuando corresponda.
- Evitar cascadas de `fetch` independientes si pueden resolverse en paralelo.
- `loading.tsx` y `Suspense` muestran progreso, pero su límite debe corresponder a una operación asíncrona real.
- `error.tsx` captura errores de render del segmento; no sustituye la presentación de Problem Details en formularios.
- Revisar respuesta y caché con dos tenants distintos antes de activar renderizado compartido.
- En varias instancias de Next, verificar la caché e invalidación en el entorno real; no asumir un bus Redis configurado para Next.

## Reglas de composición de rutas

- Mantener `page.tsx` pequeño: recibir params, componer pantalla y delegar el resto al feature.
- Un `layout.tsx` conserva UI entre navegaciones; no guardar allí estado que debe reiniciarse por entidad.
- Usar route groups solo cuando cambian layouts o límites de navegación, sin cambiar la URL pública.
- Evitar que un layout admin consulte NestJS por cada subruta si `useSession` ya recupera la sesión en el shell.
- Colocar `loading.tsx` cerca de la parte que puede suspender, no como decoración global permanente.
- Colocar `error.tsx` donde la recuperación tiene sentido; preservar el error de contrato para diagnóstico seguro.
- Usar `not-found.tsx` para ausencia real o recurso no visible; no capturar todo 5xx y mostrar 404.
- Una página pública puede devolver `notFound()` tras respuesta 404 validada, sin revelar otros tenants.
- No usar `generateStaticParams` para enumerar tenants si el número, privacidad o frescura no lo justifican.
- Revisar `generateMetadata` y la carga de datos para evitar dos consultas costosas a la misma API.
- No crear una ruta de API en Next para envolver cada adaptador de feature: añade latencia y otra frontera de fallos.
- Si hay un callback externo hacia Next, comprobar por qué no termina directamente en NestJS, que posee el dominio.

## Contrato de sesión antes de mover datos al servidor

Una migración de pantalla admin a Server Components debe responder estas preguntas con código y pruebas:

1. ¿Qué cookie llega a Next y cuál puede reenviarse a NestJS sin exponerla a otro origen?
2. ¿Cómo se obtiene un access token válido si expiró antes del render?
3. ¿Cómo se emite una cookie renovada al navegador si el refresh ocurre en un contexto de servidor?
4. ¿Cómo se protege CSRF cuando el flujo agrega una Server Action o Route Handler?
5. ¿Qué respuesta produce NestJS si el usuario fue desactivado o cambió de tenant?
6. ¿Qué datos se cachean y con qué identidad de usuario/tenant como clave?
7. ¿Qué ocurre si dos requests simultáneos intentan refresh de la misma familia?
8. ¿Cómo se redirige sin crear un loop entre login, layout y API?
9. ¿Cómo se evita serializar la credencial en props, logs o páginas de error?
10. ¿Qué pruebas ejercitan 401, 403 y cambio de usuario en la misma instancia?

Si falta una respuesta, conservar el flujo `useSession` actual. La migración no debe ocurrir por una regla genérica de “server first”.

## Contrato de multi-tenant en la web

- El slug público identifica el tenant para búsqueda pública; no confiere permisos de administración.
- La sesión privada contiene tenant y roles para mostrar contexto, pero NestJS vuelve a verificarlos.
- Una lista obtenida para un tenant no debe permanecer visible tras logout o cambio de cuenta.
- Un cache key de cliente, si se introduce, debe incluir identidad y condiciones de consulta pertinentes.
- Las relaciones como tags/categorías se validan en NestJS para el mismo tenant del testimonio.
- No permitir que un parámetro de URL sustituya `@CurrentTenantId()` en los controladores privados.
- Ante 404 de un recurso ajeno, no mostrar metadatos obtenidos en una solicitud previa de otro tenant.
- Los componentes públicos no deben reutilizar endpoints privados con una API key incrustada en el bundle.

## Cambios de frontera y evidencia

| Cambio propuesto | Evidencia mínima |
| --- | --- |
| Client fetch → server fetch público | HTML inicial, errores, endpoint, validación y frescura comprobados. |
| Client fetch → server fetch privado | Contrato de sesión, caché por identidad y 401/403 probados. |
| Añadir BFF | Razón concreta, headers permitidos, timeout y manejo de credenciales. |
| Añadir caché Next | TTL, clave, invalidación, despliegue y prueba entre tenants. |
| Dividir un feature | Dependencias y ownership más claros, sin duplicar adaptadores. |
| Extraer paquete compartido | Al menos dos consumidores reales y política de versiones. |

Antes de declarar “escalable” una variante, verificar que la instancia/almacenamiento objetivo exista. `output: 'standalone'` prepara el artefacto; no prueba balanceador, CDN, caché distribuida ni producción.

## Procedimiento de decisión

1. Identificar ruta, tipo de dato, necesidad de SEO, interacción y actor público o autenticado.
2. Leer feature, `requestApi`, `useSession` y endpoint NestJS correspondientes.
3. Declarar propietario de cada estado: URL, respuesta NestJS o UI local.
4. Elegir Server/Client Component según sesión y momento de carga.
5. Elegir caché y frescura por dato; documentar desfase aceptable y quién invalida.
6. Revisar autorización, tenant y errores en NestJS.
7. Añadir pruebas específicas de contrato o frontera cuando una modificación real lo justifique.
8. No marcar una opción como implementada hasta que el código y despliegue la sostengan.

## Migración futura

Next.js 16 ofrece `cacheComponents` y directivas de caché más granulares. Migrar exige actualizar dependencias/configuración, revisar firmas, verificar sesiones privadas, invalidación entre instancias y pruebas de frescura. Un backend dentro de Next, un worker externo o Prisma desde web requerirían otra decisión arquitectónica; no se infieren de esta skill.

### Comprobación previa a una migración de versión

1. Registrar versiones exactas de Next, React, Node y TypeScript en los manifiestos.
2. Leer la guía oficial de actualización y los cambios de comportamiento de caché.
3. Revisar `next.config.mjs`, rutas dinámicas, metadata y Route Handlers existentes.
4. Verificar que todas las dependencias de React soporten la versión objetivo.
5. Ejecutar build y typecheck en el monorepo con npm, no un gestor alternativo.
6. Probar login, refresh, logout y mutaciones con CSRF de extremo a extremo.
7. Probar dos tenants y dos usuarios contra cualquier caché de respuesta privada.
8. Confirmar que los endpoints NestJS no cambian de autoridad por la actualización.
9. Medir HTML y bundle cliente de rutas públicas antes y después.
10. Verificar `output: 'standalone'` en el entorno de despliegue previsto.
11. Registrar rollback de configuración y datos si el cambio toca contratos.
12. Actualizar esta skill solo tras comprobar el estado instalado.

La migración de framework no autoriza modificar Prisma, infraestructura o dependencias protegidas por `AGENTS.md` sin el ACK que esas modificaciones requieren.

## Definition of Done

- La ruta conserva límites `app`/feature y el caso de uso sigue en NestJS.
- Sesión, CSRF, RBAC y aislamiento por tenant se comprueban en backend; la UI no concede acceso por sí sola.
- Toda respuesta HTTP externa se trata según contrato y los datos necesarios se validan en runtime.
- Renderizado, caché, frescura y error están definidos para la ruta afectada.
- Los ejemplos usan APIs compatibles con Next.js 15.5; capacidades futuras están etiquetadas.
- La verificación es proporcional al cambio y no deja credenciales ni datos privados en caché o logs.
