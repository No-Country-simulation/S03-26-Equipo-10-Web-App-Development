---
name: node-next-api-engineering
description: >-
  Diseño y revisión de APIs HTTP NestJS 11/Express y consumo desde Next.js 15 del Testimonial CMS (SKL-API-NODE-NEXT-001). Usar para contratos, DTOs nestjs-zod, Problem Details, autorización multi-tenant, idempotencia, paginación, caché y resiliencia. Separa reglas vigentes, opciones contextuales y migraciones futuras.
---

# SKL-API-NODE-NEXT-001 — APIs Node/NestJS y frontera Next

## Propósito y fuentes

Usar esta skill para diseñar o revisar endpoints y su consumo web. Leer `AGENTS.md`, `llm.txt`, `docs/technical/01_architecture.md`, `docs/domain/business_rules.md`, el plan HITL activo y el módulo afectado. Los contratos reales del código prevalecen sobre ejemplos genéricos.

| Estado | Criterio |
| --- | --- |
| **Vigente** | Node 24, NestJS 11 con Express, `nestjs-zod`, `/api/v1/`, JWT/cookie o Bearer explícito, Prisma solo en API. |
| **Vigente** | `ApiExceptionFilter`, `ApiResponseInterceptor`, `IdempotencyInterceptor`, Pino, métricas y outbox PostgreSQL. |
| **Opción contextual** | Cursor pagination, ETag, nuevos BFF/Route Handlers, circuit breaker; introducir según necesidad y contrato. |
| **Migración futura** | Worker separado, BullMQ, gateway independiente o semántica avanzada de caché Next 16. |

## Reparto de responsabilidades

- NestJS define rutas, valida entrada, autentica, autoriza, aplica negocio, transacciona y emite eventos durables.
- Next.js llama a la API por HTTP; sus Route Handlers no reemplazan los controladores NestJS.
- PostgreSQL persiste dominio, ledger e idempotencia; Redis sirve cuotas y caché pública, no entrega durable.
- Los repositorios de la API encapsulan Prisma. Un controlador no lo usa para consultar recursos del tenant.
- Toda operación sobre un recurso del tenant filtra por `tenantId` verificado, incluidos updates, deletes, asociaciones y búsquedas por ID.
- Ocultar una acción en React no concede ni revoca acceso. La autorización del endpoint debe fallar cerrada.

## Contrato HTTP actual

| Situación | Respuesta esperada |
| --- | --- |
| Creación confirmada | 201 si el controlador declara creación; body según envelope real. |
| Lectura o mutación exitosa | 2xx y `{ success: true, data, meta? }` por `ApiResponseInterceptor`. |
| Entrada inválida | 400/422 según el contrato del endpoint; `application/problem+json`. |
| Sin credencial válida | 401. |
| Credencial válida sin permiso | 403, o 404 para no revelar existencia de recurso ajeno. |
| Recurso no visible en tenant | 404. |
| Estado incompatible o conflicto | 409. |
| Límite de tasa o cuota | 429 o código acordado; no inventar respuesta de éxito. |
| Dependencia indispensable caída | 503 cuando el flujo debe fallar cerrado. |

Confirmar status reales del controlador antes de documentar un endpoint. `ApiExceptionFilter` transforma `ApplicationError`/`HttpException` a Problem Details con `type`, `title`, `status`, `detail`, `instance`, `code`, `traceId` y `timestamp`; puede incluir `invalidParams`. No copiar una implementación alternativa de filtro por endpoint.

## Diseño de rutas

- Modelar recursos: `/api/v1/testimonials`, `/api/v1/testimonials/:testimonial_id`, acciones de transición existentes bajo el recurso.
- Respetar semántica de métodos HTTP. GET no muta dominio; POST puede crear o iniciar una transición.
- No cambiar nombres o parámetros sin revisar consumidores en `apps/web/src/features/` y documentación OpenAPI.
- Validar y acotar `limit`, filtros y orden. Estabilizar orden para paginación.
- Si la paginación actual usa página/offset, no documentarla como cursor implementado.
- Cursor es opción contextual para listas grandes o mutables; requiere orden estable, token opaco y tenant en la consulta.
- Elegir errores consistentes y específicos; no filtrar detalles internos, SQL o secretos al cliente.
- Documentar `Idempotency-Key` solo en rutas que realmente usan `@Idempotent()` y con sus garantías comprobadas.

## Validación de fronteras

La API registra `ZodValidationPipe` global de `nestjs-zod`. DTOs existentes usan `createZodDto`; `LoginDto` es un ejemplo. No reemplazarlo con un `ValidationPipe` de `class-validator` en instrucciones de este repositorio.

```ts
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

const CreateLabelSchema = z.object({
  name: z.string().trim().min(1).max(120),
});

export class CreateLabelDto extends createZodDto(CreateLabelSchema) {}
```

El ejemplo muestra la forma de un DTO, no propone un endpoint nuevo. En producción, usar límites y reglas del módulo afectado. Zod valida la entrada HTTP; no reemplaza constraints de base de datos ni reglas de aplicación. La web valida las respuestas importantes con Zod porque TypeScript no verifica JSON recibido.

## Autenticación y autorización

1. `JwtAuthGuard` verifica JWT, usuario activo, tenant y sesión cuando aplica. Bearer explícito tiene precedencia; si no, lee cookie HttpOnly.
2. `RolesGuard` revisa `@Roles`, y otros guards revisan flags o scopes según ruta.
3. Un rol permite intentar una acción; la propiedad, estado y pertenencia se verifican en servicio/repositorio.
4. `@CurrentTenantId()` procede del contexto autenticado, no de body, query ni un header autodeclarado.
5. Para lecturas, usar una búsqueda `where: { id, tenantId }`; para mutaciones, filtrar también el estado esperado cuando sea necesario.
6. Para relaciones, verificar que ambos extremos pertenecen al mismo tenant antes de asociarlos.
7. Ante ausencia o pertenencia ajena, negar con error tipado. Nunca retornar `true` por defecto si falta una comprobación.
8. No loguear credenciales ni datos privados para investigar una denegación.

### Patrón de consulta que falla cerrado

```ts
// Dentro de un repositorio NestJS; Prisma no se expone al controlador ni a Next.
async function findVisibleTestimonial(
  prisma: PrismaService,
  tenantId: string,
  testimonialId: string,
) {
  return prisma.testimonial.findFirst({
    where: { id: testimonialId, tenantId },
  });
}
```

El llamador debe convertir `null` en un error `not_found` antes de usar el recurso. Para UPDATE/DELETE, no hacer primero una lectura y luego mutar solo por ID: incluir `tenantId` en el predicado de escritura y revisar filas afectadas. Si hay condición de estado, incluirla en el mismo predicado o transacción.

```ts
// Fragmento del controlador existente: tenant verificado pasa a aplicación.
class TestimonialsController {
  constructor(private readonly testimonialsService: TestimonialsService) {}

  @Get(':testimonial_id')
  getOne(
    @CurrentTenantId() tenantId: string,
    @Param('testimonial_id') testimonialId: string,
  ) {
    return this.testimonialsService.getTestimonial(tenantId, testimonialId);
  }
}
```

El servicio y repositorio de testimonios aplican aislamiento; el decorador por sí solo no prueba propiedad. No presentar un guard con `return true` tras leer un ID como mitigación BOLA.

## Idempotencia: garantía y límite actual

`IdempotencyInterceptor` se registra globalmente y actúa en rutas `@Idempotent()`. Busca por clave, tenant, método y ruta en PostgreSQL. **Límite comprobado:** en el miss actual usa `tap(async body => await repository.save(...))`. RxJS `tap` no espera esa promesa antes de emitir la respuesta. Además, un get seguido de upsert no reserva en forma atómica la clave; dos solicitudes concurrentes pueden ejecutar la mutación. La guía no debe presentarlo como idempotencia durable completa.

Para una implementación con garantía fuerte, diseñar y probar este protocolo antes de cambiar el código:

1. Exigir `Idempotency-Key` en la operación que la necesita; validar formato, longitud y expiración.
2. Autenticar antes de resolver la clave; ligar su namespace a tenant y, cuando aplique, actor, método y ruta.
3. Calcular fingerprint canónico del payload relevante; reutilizar clave con payload distinto debe producir conflicto.
4. Reservar la clave de manera atómica con unicidad en PostgreSQL; resolver concurrencia sin ejecutar dos veces la operación.
5. Vincular la mutación y el resultado durable en una transacción cuando el caso de uso lo permita, o definir recuperación explícita tras caída.
6. Esperar la persistencia necesaria antes de responder éxito; no usar `tap(async ...)` para esa garantía.
7. Repetir una solicitud terminada devolviendo status y body originales; una solicitud en curso recibe una respuesta definida, no una segunda ejecución.
8. Verificar conflictos, expiración, reinicio del proceso y dos réplicas mediante pruebas concurrentes.

No copiar un fragmento de interceptor parcial como patrón listo para producción: la reserva, negocio y respuesta deben diseñarse juntos. El outbox transaccional es otro mecanismo; no reemplaza idempotencia HTTP.

## Webhooks y trabajo asíncrono

- La API escribe evento y entregas lógicas junto con la mutación de dominio en PostgreSQL.
- `OutboxProcessor` reclama entregas por polling y lease; registra intentos y reintenta según política.
- El destino recibe semántica at least once; el consumidor debe deduplicar por identificador de evento.
- La firma versionada usa bytes exactos y secreto cifrado por destino; no reconstruir JSON para verificarla.
- Next.js no publica ni entrega los webhooks por su cuenta.
- No describir un worker separado, BullMQ o cola Redis como implementación actual.
- Una respuesta 2xx del endpoint de dominio confirma su contrato, no que todos los destinos webhook recibieron el evento.

## Caché y cuotas

- La caché pública Redis en NestJS tiene TTL y claves versionadas por tenant. Revisar implementación antes de alterar política.
- Una lectura puede volver a PostgreSQL si Redis falla, según el flujo existente.
- Una mutación protegida por cuota falla cerrada si Redis no permite verificar contador.
- No cachear respuestas privadas en una clave pública ni compartirlas entre tenants.
- ETag, `Cache-Control`, `stale-while-revalidate` y CDN son opciones de contrato, no defaults implementados.
- Un `revalidateTag` de Next no invalida automáticamente Redis en NestJS.
- Al añadir caché, declarar clave, propietario, TTL, invalidación, comportamiento ante fallo y prueba entre tenants.

## Resiliencia HTTP

- Definir timeouts para llamadas salientes y propagación de cancelación cuando sea posible.
- Reintentar solo errores transitorios y operaciones idempotentes o protegidas por un protocolo comprobado.
- Usar backoff acotado con jitter en procesos de entrega; no bloquear el Event Loop con espera sincrónica.
- Acotar tamaño de body y concurrencia antes de procesar cargas costosas; `main.ts` ya aplica límites de JSON/form.
- Para grandes archivos, preferir streaming cuando el módulo lo requiera, con límites de tamaño y tipo.
- No añadir un circuit breaker sin un fallo repetido medido y una política de fallback clara.
- Si una dependencia indispensable de autorización/cuota falla, denegar o responder indisponible; no conceder acceso por omisión.

## Observabilidad y errores

- `ApiExceptionFilter` es el traductor global; aplicación/repositorio usan errores internos tipados.
- `ApiResponseInterceptor` envuelve éxitos. No envolver un Problem Details en envelope de éxito.
- Pino, métricas RED y contexto de correlación están en la API; la exportación OTLP puede depender del entorno.
- Mantener `traceId` y código estable para diagnóstico sin exponer stack, SQL ni secretos.
- Usar etiquetas acotadas en métricas; no poner URL con IDs o tenant como cardinalidad ilimitada.
- Liveness y readiness son distintos; readiness comprueba dependencias según el módulo de health.
- No afirmar SLO, alertas o despliegue de observabilidad que no estén verificados.

## Revisión de endpoint

1. Confirmar módulo, ruta, método y DTO existente.
2. Trazar autenticación, rol/scope/flag y tenant hasta el predicado de persistencia.
3. Revisar transición de negocio, constraints y transacción si escribe más de un registro.
4. Revisar status, envelope, Problem Details y consumidor frontend.
5. Decidir si requiere idempotencia real; no confiar en la etiqueta `@Idempotent()` para concurrencia.
6. Revisar caché y cuota, con fallo seguro y separación pública/privada.
7. Verificar timeout, límites y logging sin datos sensibles.
8. Probar acceso ajeno, entrada inválida, conflicto y concurrencia cuando el riesgo lo exige.

## Ejemplos de decisión por operación

### Crear un recurso del tenant

- Autenticar primero; obtener `tenantId` del contexto validado.
- Validar DTO con `nestjs-zod` y aplicar límites de longitud/tamaño.
- Comprobar referencias como categoría y tags dentro del mismo tenant.
- Persistir dominio y evento outbox en una transacción si el caso de uso emite evento.
- Definir status y envelope después de confirmar escritura.
- Si se declara idempotencia, resolver reserva y duplicados con garantía transaccional comprobada.
- No reutilizar `Idempotency-Key` entre payloads diferentes como si fueran equivalentes.

### Actualizar o moderar

- Leer o actualizar usando `id` y `tenantId`, no `id` aislado.
- Incluir estado esperado en escritura condicional para impedir transiciones inválidas por carrera.
- Tratar cero filas afectadas como ausencia o conflicto según una comprobación segura.
- Aplicar roles y permisos antes de exponer campos sensibles de la entidad.
- Verificar de nuevo las relaciones añadidas: un tag válido globalmente puede pertenecer a otro tenant.
- Devolver 409 si el estado ya cambió y el contrato lo prevé; no repetir el update silenciosamente.
- Nunca publicar un testimonio solo por una bandera del frontend.

### Lectura pública

- Resolver slug a tenant y filtrar testimonios por tenant y estado publicado.
- Aplicar paginación/límite para impedir respuesta desmesurada.
- Seleccionar solo campos públicos; no enviar PII administrativa o drafts.
- La caché pública usa claves versionadas por tenant según implementación NestJS.
- La web valida la estructura de respuesta antes de renderizar.
- Una API key pública, cuando aplique, usa scopes y credencial verificada; no se incrusta en `NEXT_PUBLIC_`.

## Paginación y filtros

El administrador usa `parseAdminPage` y respuestas con `meta`; partir de esa forma actual. Para cada parámetro:

1. Definir default y máximo de `limit`.
2. Validar sort contra una allowlist y agregar desempate estable.
3. Aplicar filtro `tenantId` antes de contar y paginar.
4. Evitar `orderBy` construido con una cadena arbitraria del usuario.
5. Dar `total` solo si se calculó para el mismo filtro y tenant.
6. Decidir si `page` fuera de rango devuelve vacío o error y reflejarlo en UI.
7. Si se migra a cursor, conservar un orden único y documentar expiración del cursor.
8. Probar inserciones concurrentes si la consistencia del listado importa.

## Reintentos y efectos secundarios

| Operación | Reintento automático |
| --- | --- |
| GET público | Posible con timeout y backoff acotados. |
| GET privado | Posible tras recuperar sesión; no copiar credencial a otro origen. |
| POST de tracking | Evaluar si duplicado afecta analítica; no asumir inocuidad. |
| POST de creación | Solo con protocolo de idempotencia efectivo o confirmación del estado. |
| Publicación | Confirmar estado antes de reintentar; puede disparar outbox. |
| Entrega webhook | At least once y deduplicación del receptor por ID. |

Un timeout del cliente no prueba que la mutación falló: puede haberse confirmado en PostgreSQL. La UI debe evitar afirmar “no se guardó” sin consulta de estado. Una clave de idempotencia parcial tampoco garantiza ausencia de duplicados ante dos réplicas.

## Pruebas enfocadas por riesgo

- Un usuario de tenant A no lee, edita, elimina ni asocia recursos de B.
- Admin/editor difieren donde el contrato lo exige; un rol ausente produce 403.
- Usuario inactivo, sesión revocada y Bearer inválido producen 401.
- Un 409 no deja evento outbox inconsistente.
- Dos publicaciones concurrentes no producen dos transiciones de dominio.
- Si se afirma idempotencia fuerte, dos requests simultáneos con igual clave ejecutan una sola mutación.
- Igual clave con distinto payload produce conflicto definido.
- La respuesta Problem Details no expone SQL, stack ni secretos en producción.
- Caché pública de A no aparece en B, incluso tras invalidación y reinicio.
- Cuota protegida falla cerrada cuando Redis no puede confirmar el contador.

Ejecutar solo las pruebas pertinentes al cambio real. La fase documental de esta revisión no modifica los tests ni prueba de nuevo el runtime completo.

## Migración futura

Cursor, ETag, gateway, BFF y circuit breaker se justifican por casos observados. Worker separado o BullMQ requieren rediseñar operación durable y despliegue. Una actualización de Next 16 no cambia la semántica ni la autoridad de la API NestJS. Ninguna de estas opciones se documenta como completada hasta contar con código y pruebas.

## Definition of Done

- El endpoint valida entrada con el mecanismo vigente y devuelve éxito/error según contrato HTTP real.
- Toda operación tenant-owned filtra por tenant autenticado, incluyendo referencias y escrituras.
- Roles, scopes y propiedad fallan cerrados; no hay guard de ejemplo que conceda acceso por omisión.
- La idempotencia declarada tiene garantía verificada o su límite actual queda explícito.
- Caché, cuota, timeouts y reintentos se aplican según necesidad y sin fugas de datos.
- El consumidor Next y la documentación OpenAPI reflejan el contrato cuando este cambia.
