---
name: javascript-typescript-engineering
description: >-
  Escritura y revisión de JavaScript/TypeScript del Testimonial CMS (SKL-JSTS-PRO-001). Usar para tipos estrictos, validación de datos externos, flujo de control, asincronía, errores, concurrencia y límites entre Next.js y NestJS según los tsconfig y dependencias instalados.
---

# SKL-JSTS-PRO-001 — JavaScript y TypeScript

## Propósito y fuentes

Aplicar esta guía a cambios JS/TS en `apps/web` y `apps/api`. Leer `AGENTS.md`, `llm.txt`, el plan HITL activo, `tsconfig.base.json`, el `tsconfig` del workspace y el módulo afectado. No convertir recomendaciones generales en nuevas dependencias o cambios de configuración implícitos.

| Estado | Regla |
| --- | --- |
| **Vigente** | Node 24.21.0, TypeScript 5.8, `strict: true`, target ES2022 y npm workspaces. |
| **Vigente** | API: CommonJS/Node, decoradores NestJS, `noUncheckedIndexedAccess` y `exactOptionalPropertyTypes` activos. |
| **Vigente** | Web: ESNext/Bundler, JSX de Next, aliases `@/*`; esas dos opciones adicionales no están activadas allí. |
| **Opción contextual** | Concurrencia limitada, streams, workers, más flags TS o librería nueva solo si el caso y despliegue lo justifican. |
| **Migración futura** | Cambiar `tsconfig` base/web, runtime o contratos compartidos; requiere evaluación separada. |

## Tipos y fronteras

- Escribir tipos que reflejen estados válidos, no propiedades opcionales para todo.
- Preferir `unknown` para datos de red, JSON, errores atrapados y entradas externas hasta validarlos.
- Evitar `any` porque desactiva comprobación; usarlo solo en un límite documentado donde no haya alternativa razonable.
- No usar `as SomeType` como validación de runtime.
- `satisfies` comprueba forma estática sin ampliar innecesariamente el tipo inferido.
- Elegir `type` o `interface` por claridad y necesidades de extensión; no imponer una regla universal.
- Usar uniones discriminadas cuando impiden combinaciones inválidas de estados.
- Mantener funciones de dominio y DTOs diferenciados cuando sus invariantes difieren.

```ts
type LoadState<T> =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'ready'; data: T }
  | { status: 'failed'; message: string };

function describe<T>(state: LoadState<T>): string {
  switch (state.status) {
    case 'idle': return 'Sin iniciar';
    case 'loading': return 'Cargando';
    case 'ready': return 'Disponible';
    case 'failed': return state.message;
  }
}
```

En TypeScript estricto, la unión permite narrowing por `status`. Para un estado de dos valores, un booleano puede ser más claro. No introducir una máquina de estados ceremonial para un diálogo simple.

## Diferencia entre configuraciones

`tsconfig.base.json` activa `strict`, `esModuleInterop`, `forceConsistentCasingInFileNames`, `skipLibCheck` y `resolveJsonModule`. Apunta a ES2022 y resolución Bundler; la API sobrescribe módulo/resolución a CommonJS/Node y habilita decoradores. La web conserva ESNext/Bundler y `isolatedModules`.

`noUncheckedIndexedAccess` hace que una lectura por índice pueda incluir `undefined`; `exactOptionalPropertyTypes` distingue propiedad ausente de propiedad presente con `undefined`. Ambas rigen **ya en la API**. No escribir ejemplos de backend que dependan de tenerlas desactivadas. Adoptarlas en web o base sería cambio opcional de configuración que puede producir errores nuevos: planificar migración y no modificar `tsconfig` como efecto lateral de una tarea de feature.

```ts
const first = ['draft', 'pending'][0];
if (first !== undefined) {
  // Esta comprobación sigue siendo segura con noUncheckedIndexedAccess.
  first.toUpperCase();
}
```

Evitar `value!` para callar una frontera incierta. Si un índice debe existir por invariante, comprobarlo y producir error útil. Si una propiedad es opcional, decidir entre omitirla y pasar `undefined` según el contrato real.

## Validación runtime

Los genéricos de `fetch` y los casts TypeScript no inspeccionan JSON. En la web, `requestApi` valida la forma básica del envelope y los adaptadores usan `publicRequest` o `sessionRequest` con Zod para datos importantes. La API usa `nestjs-zod` y DTOs con `createZodDto`.

- Validar entradas en el borde HTTP antes de llamar lógica de aplicación.
- Validar respuestas externas antes de confiar en su forma.
- Mantener reglas de negocio también en NestJS y constraints de persistencia cuando aplican.
- No duplicar esquemas enteros entre apps sin una estrategia de compatibilidad.
- Web usa Zod 3.25; API usa Zod 4.3: revisar cambios de API antes de compartir código.
- Informar errores de contrato sin convertirlos en éxito vacío.
- No registrar payloads con PII en errores de validación.

```ts
import { z } from 'zod';

const publishedSchema = z.object({
  id: z.string(),
  content: z.string(),
  rating: z.number().int().min(1).max(5),
});

function parsePublished(value: unknown) {
  return publishedSchema.parse(value);
}
```

El ejemplo valida solo un fragmento público; ampliar campos según el endpoint real. No tomar este esquema como DTO completo de NestJS o contrato de todos los testimonios.

## Control de flujo

- Usar guard clauses para rechazar entradas inválidas y mantener el camino principal legible.
- Evitar anidación profunda cuando una condición temprana permite salir.
- No esconder un error con `catch { return [] }` si el usuario debe distinguir fallo de vacío.
- Un `switch` sobre unión discriminada puede hacer visible cada estado permitido.
- No usar excepciones para flujo normal de una búsqueda que retorna `null`, salvo contrato del módulo.
- Propagar errores tipados entre capas; la API los traduce en `ApiExceptionFilter`.
- En web, `ApiError` conserva status/code y se interpreta según pantalla.

## Promesas y concurrencia

`Promise.all` falla temprano cuando una promesa rechaza; las otras siguen ejecutándose. `Promise.allSettled` espera todos los resultados y sirve cuando se necesitan éxitos y errores individuales. Elegir según dependencia entre operaciones, no por una preferencia de estilo.

```ts
async function loadIndependent<T>(tasks: Array<() => Promise<T>>) {
  const results = await Promise.allSettled(tasks.map(task => task()));
  return results.map(result =>
    result.status === 'fulfilled'
      ? { ok: true as const, value: result.value }
      : { ok: false as const, reason: result.reason as unknown },
  );
}
```

Este ejemplo lanza todas las tareas a la vez: usarlo solo para un conjunto pequeño y conocido. Para miles de entradas, procesar en lotes o implementar concurrencia acotada y backpressure. `p-limit` no está en los manifiestos actuales; no presentarlo como dependencia disponible ni instalarlo por defecto.

- No dejar una promesa flotante si su error afecta la respuesta o consistencia.
- `void` documenta una operación intencionalmente desacoplada, pero necesita manejo de error.
- Para una escritura requerida antes de responder, usar `await` en la cadena que determina la respuesta.
- `tap(async ...)` de RxJS no espera la promesa; no ofrece durabilidad para idempotencia HTTP.
- Cancelar o ignorar respuestas obsoletas de una búsqueda cliente cuando cambian los criterios.
- Si dos requests pueden mutar el mismo recurso, resolver concurrencia en la API/DB, no con un booleano de React.

## Event Loop y recursos

Node ejecuta JavaScript de una solicitud en el Event Loop. Evitar CPU pesada, JSON enorme o loops sin ceder control dentro de un handler. Medir antes de extraer trabajo a Worker Threads. El outbox vigente se procesa por polling PostgreSQL dentro de NestJS; no hay servicio worker separado.

- Usar APIs asíncronas de I/O cuando el trabajo puede bloquear el proceso.
- Acotar tamaño de entrada, tiempo y concurrencia de llamadas externas.
- Usar streams para datos grandes si el contrato permite procesarlos progresivamente.
- Respetar backpressure; no cargar un archivo completo en memoria por rutina.
- Un Worker Thread ayuda a CPU pesada, no a I/O HTTP convencional.
- Un pool o paquete nuevo requiere justificación, pruebas y operación definida.
- No mezclar el worker interno de libuv con una arquitectura de cola durable.

## Errores y observabilidad

- Capturar `unknown`; comprobar `instanceof Error` antes de leer `message`.
- Conservar causa cuando se agrega contexto, sin exponerla al cliente.
- Dar mensajes seguros y códigos estables en la frontera HTTP.
- Registrar identificadores de correlación y contexto operativo acotado.
- No registrar cookies, JWT, API keys, secretos webhook, contraseñas ni PII.
- Evitar logs por cada iteración de una ruta caliente; usar métricas o muestreo cuando corresponde.
- Un error de red no prueba que una mutación falló; puede haberse confirmado en DB.

```ts
function toMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Fallo desconocido';
}
```

La función es útil para diagnóstico interno; no devolver `error.message` arbitrario al navegador. `ApiExceptionFilter` ya controla el detalle seguro de errores HTTP en NestJS.

## Seguridad y aislamiento

- Nunca confiar en un `tenantId` enviado por cliente para autorizar una operación.
- La API deriva el tenant de credencial verificada y lo incluye en cada predicado de recurso.
- Un tipo `TenantId` no impide por sí solo una consulta sin filtro; revisar query real.
- No concatenar SQL, rutas externas o comandos desde strings no validados.
- Usar APIs de Prisma en repositorios de NestJS; no importar Prisma desde Next.
- Para URLs salientes de webhooks, aplicar política SSRF del módulo; no basta `new URL()`.
- Tratar HTML de testimonios como texto escapado salvo sanitización deliberada.
- No convertir un error de autorización en `true` o fallback que concede acceso.

## Dependencias y módulos

- Importar por límites del feature o módulo, no desde archivos profundos de otro dominio por comodidad.
- En la web, no incluir módulo server-only en un import transitivo de `'use client'`.
- En API, respetar capas Controller → Application/Service → Repository según módulo.
- Reutilizar utilidades del workspace cuando ya expresan el contrato.
- Evitar una abstracción compartida que acople Zod 3 web con Zod 4 API sin estrategia.
- Confirmar que una librería está declarada en el workspace antes de usarla en un ejemplo ejecutable.
- No introducir workers, colas o bibliotecas de concurrencia por una recomendación genérica.

## Verificación de cambios de código

1. Leer el `tsconfig` de la app antes de interpretar un error de tipos.
2. Comprobar si la entrada es confiable o necesita validación runtime.
3. Revisar invariantes de tenant, estado y error antes de optimizar.
4. Elegir concurrencia según independencia y tamaño del lote.
5. Confirmar que todas las escrituras necesarias se esperan antes de responder.
6. Revisar logs para evitar secretos y cardinalidad excesiva.
7. Ejecutar typecheck/test del workspace afectado cuando se cambie código.
8. Para una edición solo documental, validar ejemplos y enlaces sin exigir tests de app.

## Casos de revisión por workspace

### En `apps/web`

- Un componente con `'use client'` no debe importar transitivamente secretos ni código Node-only.
- La respuesta de `fetch` llega como JSON desconocido aunque se anote `requestApi<T>`.
- El adaptador valida `data` con el esquema Zod del feature cuando el contrato lo necesita.
- Un error de sesión conserva `status` y `code` para que la pantalla decida recuperación.
- No añadir `window` o `localStorage` durante render de un Server Component.
- Evitar clases Tailwind construidas por concatenación dinámica no detectable.
- Un slug de URL se codifica en el adaptador antes de componer una ruta.
- Un estado de React no sustituye comprobaciones de tenant de NestJS.

### En `apps/api`

- DTOs HTTP usan `nestjs-zod` y quedan separados de entidades/repo cuando difieren sus invariantes.
- `@CurrentTenantId()` procede de credencial validada; una query por recurso filtra por ese tenant.
- Una escritura condicionada incluye tenant y estado esperado si la transición es concurrente.
- `noUncheckedIndexedAccess` exige revisar acceso por índice y mapas parciales.
- `exactOptionalPropertyTypes` exige distinguir ausencia de un campo y asignación a `undefined`.
- Un `catch` que traduce errores no debe convertir un 403 en 200 por fallback.
- El `ApiExceptionFilter` traduce errores a Problem Details; no devolver stack en un DTO.
- La respuesta HTTP no se confirma antes de persistencia requerida y outbox transaccional.

## Ejemplo de frontera opcional

```ts
type UpdateInput = { title?: string };

function updateTitle(input: UpdateInput) {
  if (!Object.prototype.hasOwnProperty.call(input, 'title')) {
    return { changed: false as const };
  }
  if (input.title === undefined) {
    return { changed: false as const };
  }
  return { changed: true as const, value: input.title };
}
```

La distinción importa cuando un PATCH permite omitir un campo. Con `exactOptionalPropertyTypes` en API, `{ title: undefined }` no satisface `UpdateInput` al construir un valor tipado. Un JSON recibido puede requerir validación y política explícita; no asumir que TypeScript valida la petición.

## Elegir el nivel de abstracción

- Extraer una función cuando elimina duplicación de regla, no solo dos líneas parecidas.
- Mantener los errores del dominio donde pertenecen y mapearlos en la frontera HTTP.
- Una interfaz de repositorio aporta valor si separa una dependencia real y facilita pruebas.
- No crear un framework de tipos genéricos para un único endpoint.
- Preferir nombres de negocio (`publishTestimonial`) a nombres vagos (`processData`).
- Una utilidad compartida entre web/API requiere revisar versiones de Zod y dependencia de runtime.
- Evitar parametrizar cada detalle de un caso único hasta que aparezca otro consumidor.

## Concurrencia con efectos durables

Antes de usar `Promise.all` para mutaciones, comprobar si el orden importa, si comparten transacción y cómo se recupera un fallo parcial. En el outbox, un evento de dominio y sus entregas lógicas se guardan en la misma transacción de PostgreSQL; paralelizar escrituras fuera de ella rompe la garantía. Para HTTP externo, los reintentos siguen la política del dispatcher, no una promesa lanzada desde Next.

Una operación de cuota que depende de Redis no debe conceder acceso si falla la verificación. Un error de red al responder puede ocurrir después del commit; por eso una UI no debe repetir automáticamente una mutación sin contrato idempotente comprobado.

## Migraciones futuras

Habilitar `noUncheckedIndexedAccess` o `exactOptionalPropertyTypes` en web/base requiere evaluar errores resultantes, contratos opcionales y pruebas. Cambiar versión de Zod compartida requiere compatibilidad entre apps. Añadir un pool de workers, una cola o un paquete como `p-limit` requiere necesidad medida y operación definida. Estas decisiones no forman parte del baseline por figurar en esta skill.

## Definition of Done

- El cambio respeta el `tsconfig` y las dependencias reales del workspace.
- Datos externos se validan antes de tratarlos como tipos confiables.
- Estados inválidos y errores materiales se representan y manejan sin fallar abiertos.
- Concurrencia, promesas y recursos tienen límites acordes al caso y escrituras requeridas esperadas.
- La API conserva aislamiento por tenant y los logs no exponen secretos ni PII.
- Opciones de configuración y arquitectura futura están etiquetadas, no descritas como instaladas.
