# Plan HITL: remediación del código frente a diez skills web

**Fecha de inicio:** 2026-10-05  
**Estado global:** En progreso; fase 3 lista para revisión humana con integración PostgreSQL pendiente
**Alcance:** Código activo de `apps/api` y `apps/web`, pruebas y documentación de los contratos modificados. El plan no incorpora por sí mismo capacidades SEO futuras.

## Contexto y restricciones

- Leer `AGENTS.md`, `llm.txt`, `docs/technical/01_architecture.md`, `docs/domain/business_rules.md`, los módulos afectados y las diez skills de la matriz antes de implementar una fase.
- Baseline vigente: Node.js 24.21.0 y npm 11.19.0 declarados; NestJS 11/Express/Prisma 6.5, Next.js 15, React 18 y Tailwind 3. NestJS autoriza, aplica negocio y persiste; Next.js consume la API. El muro `/t/[slug]` y la captura `/p/[slug]` cargan datos en cliente.
- Este plan se basa en una auditoría estática y checks de ambos workspaces. La validación con Node 24.19.0 fue provisional, por ser inferior al mínimo declarado. Sin navegador, despliegue o medición de campo no se certifican WCAG 2.2 AA, indexabilidad ni Core Web Vitals.
- Ejecutar **solo la fase `[Actual]` por turno**. Presentar evidencia y commit sugerido y detenerse; el humano revisa y da ACK antes de marcar la siguiente fase como `[Actual]`.
- Un ACK de avance de fase **no autoriza por sí solo** modificar `apps/api/prisma/schema.prisma`: para la fase 3 se requiere además ACK humano explícito para ese archivo. No ejecutar `prisma migrate deploy` ni `db push`. No alterar `docker-compose.yml`, `infra/`, `.husky/` ni `package.json` raíz sin su propio ACK explícito. Preservar cambios ajenos y no guardar secretos ni PII en archivos de contexto.
- Conservar la identidad editorial y los tokens actuales; no introducir Next 16, React 19, Tailwind 4, un worker separado ni Prisma en Next. SSR público, canonical, sitemap, robots e indexación requieren otra tarea una vez definidos host y política de producto.

## Matriz inicial frente a las skills

El estado indica **cumplimiento del código observado**, no calidad de la skill. `Parcial` significa que hay una práctica vigente junto con al menos un defecto concreto; `no verificable` se reserva para resultados que necesitan ejecución o medición. Las rutas indicadas son evidencia para profundizar en la fase correspondiente, no un recuento exhaustivo de cada pantalla.

| Skill | Estado inicial | Evidencia y trabajo principal |
| --- | --- | --- |
| [Cognitive Interface](../../.agents/skills/cognitive-interface-engineering/SKILL.md) | Parcial | La captura muestra éxito tras cualquier respuesta resuelta, aunque la API puede suprimir la escritura; corregir feedback y recuperación. |
| [CSS Architecture](../../.agents/skills/css-architecture-engineering/SKILL.md) | Parcial | Tokens claros de `globals.css` dan contraste insuficiente para texto normal; falta alternativa de movimiento reducido para `animate-fade-in-up`. |
| [JavaScript/TypeScript](../../.agents/skills/javascript-typescript-engineering/SKILL.md) | Parcial | `tap(async ...)` no espera la persistencia; el adaptador de captura acepta `object` y hay cargas cliente sin protección contra respuestas obsoletas. |
| [Next.js Frontend](../../.agents/skills/nextjs-frontend-engineering/SKILL.md) | Parcial | Rutas y adaptadores respetan NestJS, pero varias pantallas convierten fallas de carga en estados vacíos; el dashboard conserva un margen lateral fijo en móvil. |
| [Next.js Architecture](../../.agents/skills/nextjs-architecture-engineering/SKILL.md) | Cumple parcialmente | La frontera Next/NestJS es correcta; revisar los límites de caché, CSP y metadata sin convertir SSR público en requisito vigente. |
| [Node/Next API](../../.agents/skills/node-next-api-engineering/SKILL.md) | No cumple | La etiqueta `@Idempotent()` promete una garantía que el interceptor no da bajo concurrencia o fallo de guardado; una captura repetida recibe éxito sin escritura. |
| [React Interface](../../.agents/skills/react-interface-engineering/SKILL.md) | Parcial | Hay estado y componentes por feature, pero cargas cliente sin limpieza y errores silenciosos afectan la UI. |
| [Tailwind Architecture](../../.agents/skills/tailwind-architecture-engineering/SKILL.md) | Parcial | Se usan utilidades y tokens de Tailwind 3; controles concretos quitan el outline sin indicador de foco equivalente. |
| [SEO y Accessibility](../../.agents/skills/web-seo-accessibility-engineering/SKILL.md) | Parcial; indexación no verificable | Metadata global con URL no confirmada, captura con controles sin nombre/etiqueta asociados y muro con testimonios cargados en cliente. La indexación queda condicionada. |
| [Web Rendering](../../.agents/skills/web-rendering-performance-engineering/SKILL.md) | Parcial; métricas no verificables | El muro obtiene contenido después de hidratar; revisar errores, carreras, medios y CSP. No afirmar un problema de Core Web Vitals sin medición. |

## Hallazgos priorizados y contratos afectados

| Prioridad | Evidencia | Impacto | Corrección y fase |
| --- | --- | --- | --- |
| P1 | `apps/api/src/common/interceptors/idempotency.interceptor.ts:81`, `apps/api/src/common/repositories/idempotency.repository.ts:49` | `tap(async ...)` no bloquea la respuesta y `get` + `upsert` permite ejecutar dos mutaciones con la misma clave. | Diseñar y aplicar un protocolo transaccional acotado a las rutas que puedan sostenerlo; fases 2–3. |
| P1 | `apps/api/src/modules/testimonials/controllers/public-testimonials.controller.ts:77`, `apps/web/src/features/public-capture/screens/capture-screen.tsx:60` | La repetición por cookie puede responder `received` sin persistir, pero la web confirma recepción. | Contrato explícito de repetición y mensaje veraz; fases 2–4. |
| P2 | `apps/web/src/features/public-capture/screens/capture-screen.tsx:184`, `apps/web/src/app/globals.css:83` | Calificación y campos requieren mejor foco, nombre y movimiento reducido; los pares claros de botones requieren contraste normal. | Corregir semántica, estados, tokens y movimiento; fase 4. |
| P2 | `apps/web/src/features/auth/screens/dashboard-shell.tsx:36`, `apps/web/src/features/testimonials/screens/testimonials-screen.tsx:37` | Un margen lateral fijo dificulta 320 px; errores de red pueden verse como listas vacías. | Navegación móvil y estados diferenciados con reintento; fase 4. |
| P2 | `apps/web/next.config.mjs:22`, `apps/web/src/features/public-testimonials/screens/public-testimonials-screen.tsx:80` | La CSP no declara todos los orígenes usados por API/medios y permite `unsafe-eval` en producción. | Verificar recursos en navegador y acotar orígenes por entorno; fase 5. |
| P3 | `apps/web/src/app/layout.tsx:48`, `apps/web/src/tests/e2e/README.md` | La URL Open Graph no acredita dominio productivo y faltan pruebas de navegador implementadas. | Corregir metadata verificable y añadir pruebas; fases 5–6. |

La fase 2 fijará el contrato de `Idempotency-Key`: sin clave no se anuncia garantía; en las rutas elegibles, la misma clave y el mismo payload devuelven estado y cuerpo originales, y un payload distinto produce conflicto. Auth registration y analítica pública no se presentarán como idempotentes sin un scope seguro y transacción compatible. La captura repetida tendrá un error estable distinto de recepción confirmada; el límite de tasa conservará su semántica de `429`. La web reutilizará una clave solo para reintentar la misma operación.

## Fases de ejecución

### `[Completada]` Fase 1: registrar el plan

- [x] Registrar baseline, matriz, hallazgos, prioridades, contratos y criterios de cierre.
- [x] Incorporar este plan al índice de `docs/plan/`.
- [x] Limitar esta fase a documentación; no modificar código, esquema ni dependencias.

**Criterio de salida:** el plan y el índice existen, los enlaces locales resuelven y `git diff --check` no reporta errores.  
**Review humano (ACK):** Recibido el 2026-10-05: «Continua». Commit observado: `8d59aec`.
**Commit sugerido:** `docs(plan): registrá la remediación de las diez skills web`.

### `[Completada]` Fase 2: diseñar API y migración

- [x] Especificar rutas elegibles, scope de actor y tenant, huella canónica del payload, reserva atómica, respuesta repetida, conflicto y manejo de fallos en `docs/technical/08_http_idempotency_contract.md`.
- [x] Preparar el borrador SQL y la estrategia para filas legadas en `docs/plan/2026-10-05_fix-remediacion-codigo-web_idempotencia-borrador.sql`, fuera de las migraciones activas y sin modificar `schema.prisma`.
- [x] Definir `409 PUBLIC_SUBMISSION_RECENT_BROWSER` para captura repetida, diferente de `429` por cuota. Alinear los módulos afectados y retirar de las guías técnicas los ejemplos `get` + `save` que prometían seguridad concurrente.
- [x] Clasificar registro y analítica como rutas cuyo `@Idempotent()` se retirará en la fase 3; reservar la garantía para creación/publicación de testimonios y prueba/replay de webhooks transaccionales.

**Criterio de salida:** contrato y SQL revisables; la documentación modificada distingue claramente estado vigente de garantía futura y no presenta los decoradores actuales como prueba suficiente. El código aún conserva el interceptor inseguro hasta la fase 3.
**Salida para revisión:** contrato técnico, borrador SQL, módulos de auth/testimonios/webhooks y dos secciones técnicas históricas actualizadas. Se comprobaron rutas y transacciones reales, enlaces locales de los documentos nuevos, búsqueda dirigida de ejemplos inseguros y `git diff --check`. No se ejecutaron tests de aplicaciones ni SQL porque el alcance de esta fase es documental.
**Review humano (ACK):** Recibido el 2026-10-05: «Continua», tras solicitar expresamente el ACK de esta fase y autorización para modificar `apps/api/prisma/schema.prisma`. Commit observado: `50a1fbe`.
**Commit sugerido:** `docs(api): definí los contratos de idempotencia y captura`.

### `[Actual]` Fase 3: corregir API y persistencia

- [x] Implementar el protocolo en cuatro rutas con tenant y actor autenticados; reserva, mutación/outbox y resultado comparten transacción PostgreSQL. Retirar el interceptor anterior y `@Idempotent()` de registro y analítica pública.
- [x] Actualizar `schema.prisma`, preparar migración, controladores, repositorios, OpenAPI y pruebas sin aplicar SQL a ningún entorno.
- [x] Responder `409 PUBLIC_SUBMISSION_RECENT_BROWSER` ante la cookie exacta de captura, sin simular recepción. Conservar `429` de cuota y traducción Problem Details.
- [x] Revisar las consultas y escrituras tocadas con `tenantId` verificado, estados `201`/`202`, actor y ruta concreta como parte del scope.

**Criterio de salida:** concurrencia, conflicto, repetición, fallo/reinicio y aislamiento entre tenants probados; no hay éxito antes de la escritura requerida. No aplicar migraciones a ningún entorno.  
**Evidencia local:** typecheck, lint (0 errores, 2 advertencias), build y `prisma validate` pasan con Node 24.19.0, inferior al mínimo declarado. Se ejecutaron 25 pruebas dirigidas con 6 suites correctas; la suite PostgreSQL tiene 3 pruebas preparadas pero se omite sin `TEST_DATABASE_URL`. Se añadieron casos de concurrencia entre dos clientes, replay `201`/`202`, conflicto, rollback y aislamiento por actor/tenant para ejecutar en una base aislada ya migrada. La suite completa tiene pruebas HTTP que no pueden abrir sockets en este sandbox (`listen EPERM`). No se ejecutó migración ni se certifica la concurrencia en PostgreSQL por inferencia.

**Riesgo pendiente:** la garantía depende de aplicar la migración en un despliegue coordinado y verificar la suite PostgreSQL; la caída real de proceso y el recorrido HTTP esperan un entorno de integración. La interfaz aún debe presentar el nuevo `409` de forma comprensible en la fase 4.

**Review humano (ACK):** Pendiente.  
**Commit sugerido:** `fix(api): asegurá la idempotencia y la respuesta de captura`.

### `[Pendiente]` Fase 4: interfaz y consumo HTTP

- Corregir controles y feedback de captura, contraste, foco, movimiento reducido y navegación móvil con teclado y gestión de foco.
- Diferenciar vacío, ausencia, permiso, límite y fallo recuperable en pantallas activas; añadir reintento, cancelación o descarte de respuestas obsoletas, tipos y validación de datos externos pertinentes.

**Criterio de salida:** no hay éxito falso, control sin nombre accesible, fallo mostrado como vacío ni desbordamiento del dashboard a 320 px en las rutas verificadas.  
**Review humano (ACK):** Pendiente.  
**Commit sugerido:** `fix(web): corregí accesibilidad, estados y navegación móvil`.

### `[Pendiente]` Fase 5: carga, CSP y SEO vigente

- Verificar CSP en navegador y permitir solo los orígenes necesarios de API y medios; retirar `unsafe-eval` de producción si la aplicación funciona sin él.
- Revisar dimensiones/carga de imágenes y videos, metadata y semántica de rutas actuales. Mantener CSR del muro; no añadir canonical, sitemap, robots ni SSR sin dominio y política de indexación confirmados en otra tarea.

**Criterio de salida:** recursos necesarios cargan sin ampliar la CSP a hosts arbitrarios; metadata no afirma un dominio no confirmado y no se inventa indexabilidad.  
**Review humano (ACK):** Pendiente.  
**Commit sugerido:** `perf(web): ajustá carga pública, CSP y metadata vigente`.

### `[Pendiente]` Fase 6: pruebas y reevaluación

- Añadir pruebas API de concurrencia, conflicto, repetición y aislamiento; pruebas web de captura, errores, navegación y moderación; pruebas de navegador y accesibilidad automatizada para flujos principales.
- Revisar manualmente teclado, foco, 320 px y temas. Ejecutar typecheck, lint, tests y builds de ambos workspaces con Node >=24.21.0 y npm 11.19.0. Usar PostgreSQL/Redis de prueba solo si están disponibles y sin migrar entornos ajenos.
- Repetir la matriz de las diez skills, registrar evidencia y aspectos no verificables. Actualizar documentación de contratos y `llm.txt` solo si la arquitectura realmente cambió.

**Criterio de salida:** cero hallazgos P1/P2 verificables abiertos, checks ejecutados o bloqueo explicado, matriz final con límites de evidencia. No declarar conformidad WCAG, indexabilidad ni Core Web Vitals sin pruebas suficientes.  
**Review humano (ACK):** Pendiente; cerrar el plan solo tras recibirlo.  
**Commit sugerido:** `test(web): incorporá pruebas de flujos y accesibilidad`.

## Regla de cierre

Al final de cada fase, registrar archivos modificados, comandos y resultados, riesgos remanentes y commit sugerido. El humano da ACK y marca la fase siguiente como `[Actual]`; no agrupar fases. Un resultado `no verificable` conserva su motivo y no se convierte en `cumple` por ausencia de fallos observados.
