# Plan HITL: retiro de infraestructura obsoleta y preparación de la demostración

**Fecha de inicio:** 2026-10-02
**Estado global:** Completado; las tres fases recibieron ACK y tienen commits registrados

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

### `[Completada]` Fase 2: retirar archivos y corregir documentación

- Eliminar los 52 archivos del árbol de IaC anterior y el placeholder de Kubernetes.
- Sustituir las guías de infraestructura y despliegue AWS/Kubernetes por documentación del estado local y de CI, sin atribuir al proyecto recursos o controles no desplegados.
- Limpiar todas las referencias versionadas a la herramienta retirada en arquitectura, resúmenes, runbooks, cumplimiento, skill local e historial HITL. Preservar los resultados históricos de pruebas de la aplicación y señalar con precisión las verificaciones de despliegue pendientes.
- Registrar en la documentación las necesidades de la futura demostración: PostgreSQL, Redis, API NestJS y polling del outbox, secretos y variables, conexión web–API, migraciones autorizadas, protección de webhooks y observabilidad. Mantener abierta la fase 8 del plan de seguridad hasta contar con evidencia del entorno elegido.
- **Salida:** retiro y documentación coherentes en un mismo cambio; commit sugerido y detención para ACK.

**Implementación local para revisión:** se retiraron los 52 archivos del árbol de IaC anterior y el placeholder de Kubernetes. Las guías de infraestructura y despliegue ahora describen Compose, la CI descartable y las dependencias de la demostración sin presentar recursos cloud como activos. Arquitectura, runbooks, cumplimiento, resúmenes, skill local y plan histórico se ajustaron al estado real; la fase 8 de seguridad continúa abierta.

**Verificación de esta fase:** búsqueda del árbol de trabajo sin nombres, archivos ni referencias de la herramienta retirada; `git diff --check` sin errores; los enlaces locales de las guías sustituidas y del diagrama de flujos existen. Solo cambiaron documentación y archivos de infraestructura retirados: no se ejecutaron pruebas de aplicación ni se desplegó ningún entorno. La revisión documental integral y el cierre corresponden a la fase 3.

**Commit sugerido:** `chore(infra): retirá IaC anterior y actualizá guías de despliegue`.

**ACK:** recibido mediante «Continua con la fase 3». Commit de la fase: 4b9eab5.

### `[Completada]` Fase 3: verificar y cerrar

- Comprobar que no quedan archivos, rutas, menciones versionadas ni enlaces rotos asociados con la herramienta retirada; revisar que las guías distingan ejecución local, requisitos futuros y controles sin verificar.
- Ejecutar `git diff --check` y comprobaciones documentales pertinentes. Ejecutar pruebas de aplicación solo si se modifica código ejecutable.
- Registrar resultados y límites de la evidencia, proponer el commit de cierre y detenerse para ACK. La configuración real de Supabase, Vercel, API y Redis tendrá otro plan.

**Verificación de cierre local:** el árbol y el índice versionados no contienen archivos, rutas ni menciones de la herramienta retirada, incluidos nombres de estado y variables asociados. Tampoco quedan enlaces a la ubicación retirada. Las guías vigentes separan Compose y CI de los requisitos futuros; no acreditan recursos AWS/Kubernetes, egreso de red, alertas o staging como activos. `git diff --check` y la comprobación de enlaces locales de los documentos afectados pasaron. No cambió código ejecutable, por lo que no se repitió la suite de aplicación ni se desplegó un entorno.

**Límite de la auditoría:** una búsqueda general detectó 35 enlaces de ejemplo o preexistentes en otros documentos, sin relación con la infraestructura retirada. No constituyen evidencia de esta migración ni se corrigieron en este plan. La configuración real de Supabase, Vercel y del alojamiento de API/Redis sigue pendiente de un trabajo separado.

**Commit sugerido:** `docs(infra): verificá el retiro y registrá el cierre local`.

**ACK final:** recibido mediante «Continua». Commit de la fase: 8658345.

## Criterios de aceptación

- El árbol versionado actual no contiene la configuración ni referencias directas a la herramienta de IaC retirada.
- La documentación vigente no presenta AWS o Kubernetes como despliegues existentes ni controles de red o alertas sin verificar como activos.
- Los requisitos para la demostración quedan identificados sin afirmar que la nueva plataforma ya funciona.
- Cada fase tiene su propio commit y ACK antes de comenzar la siguiente.
