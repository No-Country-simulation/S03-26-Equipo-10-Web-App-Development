# Antipatrones y evaluación

Catálogo completo adaptado de SKL-DEVOPS-CICD-001 v1.0.0. El adjunto no asigna códigos: conservar los nombres como identificadores, sin atribuirle numeración nueva.

## Catálogo

| Antipatrón original | Detección e impacto | Remediación contextual |
|---|---|---|
| Pipeline monolítico | Esperas y responsabilidades mezcladas. | Modularizar por dependencia real; medir antes de dividir verify. |
| Secrets hardcoded | Credenciales en archivos, comandos, cachés o reportes. | Gestor externo, mínimo alcance; OIDC si viable. |
| Docker `latest` | Dependencia mutable sin identidad. | Referencia verificable y actualización controlada. |
| Rebuild por entorno | Reconstrucción no registrada cambia artefactos. | Promover digest reutilizable; builds Next.js específicos pueden ser necesarios, registrar/validar cada uno. |
| Deploy manual por SSH | Cambios sin gates o auditoría. | Operación reproducible autorizada por pipeline/plataforma, sin exigir GitOps. |
| Tests flaky ignorados | Reintentos ocultan regresiones. | Responsable, plazo y seguimiento; cuarentena temporal con cobertura crítica alternativa. |
| Acceso privilegiado desde PR | Código externo usa secretos/permisos. | Separar validación y publicación; evitar checkout no confiable en eventos privilegiados. |
| Acciones externas sin control | Tags mutables/fuentes no revisadas. | SHA revisado, actualización mantenida y brechas explícitas. |
| Self-hosted runners persistentes sin aislamiento | Contaminación entre runs. | GitHub-hosted si alcanza; runners efímeros/segmentados si se justifica self-hosted. |
| Despliegues simultáneos | Carreras en migración/promoción. | Serializar por destino; no cancelar operaciones críticas. |
| Producción sin health checks | Web responde con API/pollers caídos. | Smoke tests de topología completa. |
| Rollback no probado | Versión previa incompatible con datos. | Ensayar recuperación autorizada y conservar referencia estable. |
| Migraciones destructivas inmediatas | Rompen versiones previas/restauración. | Expand-contract, backup/restauración ensayados y ACK. |
| Staging sin equivalencia funcional | Omite dependencias y seguridad. | Topología crítica representativa, escala menor y diferencias documentadas. |
| Seguridad únicamente al final | Hallazgos tras publicación. | Gates PR/build y controles según superficie. |
| Permisos excesivos del token | Impacto más allá del job. | Permisos por job y roles/credenciales por entorno. |
| Canary sin observabilidad | Promoción/reversión sin criterio. | SLIs, límites y observación antes de elegir canary. |
| Feature Flags permanentes | Deuda y estado desconocido. | Responsable, retiro y kill switch si necesario. |
| Optimización prematura | Coste sin beneficio medido. | Medir jobs/coste/cola; no instalar Kubernetes/ARC/Terraform por catálogo. |
| Acceso de emergencia sin auditoría | Sin control ni trazabilidad. | Break-glass autorizado, registro redactado y verificación posterior. |

## KPIs

Medir línea base antes de fijar umbrales. Los 5–10 minutos del adjunto son referencia para validaciones rápidas de PR, no límite vigente de tests extensos/E2E/scans profundos.

Objetivos originales: checks obligatorios en 100% de cambios sujetos a política; 0 integraciones con checks fallidos; 0 credenciales persistentes innecesarias; 0 acciones externas no controladas en pipelines protegidos; 100% de artefactos publicados trazables; 0 tests inestables sin seguimiento; 100% de cumplimiento o excepciones explícitas. No presentarlos como métricas medidas del CMS.

Conservar los cinco indicadores del adjunto: Deployment Frequency, Change Lead Time, Failed Deployment Recovery Time, Change Fail Rate y Deployment Rework Rate. Representan frecuencia, tiempo de commit a producción, recuperación de despliegues fallidos, proporción de cambios fallidos y proporción de despliegues correctivos no planificados. Verificar definiciones/ventanas vigentes en [DORA](https://dora.dev/guides/dora-metrics/) antes de instrumentar; no clasificar previews como producción sin acordarlo.

Complementar con Pipeline Success Rate, Queue Time, Build Duration, Test Flakiness Rate, Rollback Success Rate, Deployment Validation Time, Vulnerability Remediation Time y Pipeline Cost per Run. Metas derivadas de evidencia, sin valores inventados.

## Evaluación final: diez capacidades del adjunto

- [ ] PR validado automáticamente.
- [ ] Integración bloqueada por incumplir política.
- [ ] Artefacto construido/publicado con identidad verificable.
- [ ] Promoción sin recompilar si es posible; builds específicos trazables cuando la configuración lo requiera.
- [ ] Acceso/credenciales de producción protegidos.
- [ ] Estrategia progresiva o equivalente de plataforma validada según alcance.
- [ ] Despliegue defectuoso detectado.
- [ ] Recuperación ejecutada y verificada con compatibilidad de datos.
- [ ] Logs/métricas consultables sin secretos/PII.
- [ ] Entrega/operación documentada para otro desarrollador.

Esta lista evalúa CI/CD implementado. Al incorporar una skill revisar cobertura de instrucciones sin marcar pruebas operacionales ejecutadas.

## Checklists de operación

Antes: confirmar fase/ACK, destino real, confianza del código, permisos, gates, identidad/configuración, migraciones compatibles y recuperación. Después: salud, smoke tests, evidencia, estado de promoción y pendientes; detenerse según HITL.

Las herramientas del adjunto son alternativas: GitHub Actions/Docker ya existen; registros de imágenes, IaC, SAST dedicado, GitOps, runners propios y gestores sólo se incorporan ante necesidad concreta. Aprovechar flags, métricas y scripts existentes antes de otro producto.
