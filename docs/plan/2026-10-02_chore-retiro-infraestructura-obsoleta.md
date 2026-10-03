# Plan HITL: retiro de infraestructura obsoleta y preparación de la demostración

**Fecha de inicio:** 2026-10-02
**Estado global:** En progreso; fase 2 lista para revisión

## Contexto y restricciones

- El usuario confirmó que la configuración anterior de infraestructura como código nunca se aplicó ni creó recursos AWS de este proyecto. El retiro se limita al árbol versionado actual; no reescribe el historial Git ni elimina recursos externos.
- Inventario inicial: 52 archivos versionados en el árbol de IaC anterior, con módulos de red, seguridad, base de datos, Redis, contenedores, DNS, CDN, secretos, observabilidad y dos entornos; 11 archivos adicionales contienen referencias directas. También existe un placeholder de Kubernetes. La CI actual no ejecuta aprovisionamiento.
- El estado ejecutable es Compose para desarrollo local y CI con PostgreSQL y Redis descartables. No hay evidencia de staging o producción desplegados. La API NestJS procesa el outbox por polling y requiere PostgreSQL y Redis según sus flujos actuales.
- No modificar el esquema Prisma, migrar bases persistentes, desplegar servicios ni configurar Supabase o Vercel en este plan. La ubicación futura de la API y Redis se decidirá en un trabajo posterior.
- `AGENTS.md` exige ACK explícito para alterar `infra/` y una sola fase `[Actual]` por ejecución. Al cerrar cada fase, presentar evidencia y commit, y detenerse hasta recibir el siguiente ACK.
- Leer `llm.txt`, `docs/technical/01_architecture.md`, `docs/domain/business_rules.md` y las guías operativas afectadas antes de ejecutar la fase 2. Aplicar el skill de arquitectura de monorepo para mantener separadas las aplicaciones y sus necesidades de despliegue.

## Fases

### `[Completada]` Fase 1: registrar el retiro

- Crear este plan con el inventario y la confirmación del estado externo.
- Incorporarlo al índice de planes y versionar únicamente estos cambios de planificación.
- **Salida:** plan y commit disponibles para revisión humana; ningún archivo de infraestructura o guía operativa retirado todavía.
- **ACK:** recibido por instrucción expresa del usuario para continuar con la fase 2. Commit de la fase: 8f080c2.

### `[Actual: lista para revisión]` Fase 2: retirar archivos y corregir documentación

- Eliminar los 52 archivos del árbol de IaC anterior y el placeholder de Kubernetes.
- Sustituir las guías de infraestructura y despliegue AWS/Kubernetes por documentación del estado local y de CI, sin atribuir al proyecto recursos o controles no desplegados.
- Limpiar todas las referencias versionadas a la herramienta retirada en arquitectura, resúmenes, runbooks, cumplimiento, skill local e historial HITL. Preservar los resultados históricos de pruebas de la aplicación y señalar con precisión las verificaciones de despliegue pendientes.
- Registrar en la documentación las necesidades de la futura demostración: PostgreSQL, Redis, API NestJS y polling del outbox, secretos y variables, conexión web–API, migraciones autorizadas, protección de webhooks y observabilidad. Mantener abierta la fase 8 del plan de seguridad hasta contar con evidencia del entorno elegido.
- **Salida:** retiro y documentación coherentes en un mismo cambio; commit sugerido y detención para ACK.

**Implementación local para revisión:** se retiraron los 52 archivos del árbol de IaC anterior y el placeholder de Kubernetes. Las guías de infraestructura y despliegue ahora describen Compose, la CI descartable y las dependencias de la demostración sin presentar recursos cloud como activos. Arquitectura, runbooks, cumplimiento, resúmenes, skill local y plan histórico se ajustaron al estado real; la fase 8 de seguridad continúa abierta.

**Verificación de esta fase:** búsqueda del árbol de trabajo sin nombres, archivos ni referencias de la herramienta retirada; `git diff --check` sin errores; los enlaces locales de las guías sustituidas y del diagrama de flujos existen. Solo cambiaron documentación y archivos de infraestructura retirados: no se ejecutaron pruebas de aplicación ni se desplegó ningún entorno. La revisión documental integral y el cierre corresponden a la fase 3.

**Commit sugerido:** `chore(infra): retirá IaC anterior y actualizá guías de despliegue`.

**ACK:** pendiente antes de la fase 3.

### `[Pendiente]` Fase 3: verificar y cerrar

- Comprobar que no quedan archivos, rutas, menciones versionadas ni enlaces rotos asociados con la herramienta retirada; revisar que las guías distingan ejecución local, requisitos futuros y controles sin verificar.
- Ejecutar `git diff --check` y comprobaciones documentales pertinentes. Ejecutar pruebas de aplicación solo si se modifica código ejecutable.
- Registrar resultados y límites de la evidencia, proponer el commit de cierre y detenerse para ACK. La configuración real de Supabase, Vercel, API y Redis tendrá otro plan.

## Criterios de aceptación

- El árbol versionado actual no contiene la configuración ni referencias directas a la herramienta de IaC retirada.
- La documentación vigente no presenta AWS o Kubernetes como despliegues existentes ni controles de red o alertas sin verificar como activos.
- Los requisitos para la demostración quedan identificados sin afirmar que la nueva plataforma ya funciona.
- Cada fase tiene su propio commit y ACK antes de comenzar la siguiente.
