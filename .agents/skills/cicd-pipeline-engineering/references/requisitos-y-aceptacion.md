# Requisitos y aceptación

Adaptación de SKL-DEVOPS-CICD-001 v1.0.0. Se conservan los identificadores RF/RNF; la matriz guía la implementación y no acredita cumplimiento actual.

**Vigente:** regla aplicable al trabajo autorizado. **Recomendado:** mejora cuya necesidad debe verificarse. **Condicionado:** aplica al existir entorno, servicio o política correspondiente. Una condición pendiente no se reporta aprobada.

## Requerimientos funcionales

| Código | Capacidad original | Aplicación al CMS |
|---|---|---|
| RF-01 | Automatización por eventos de Git | Vigente: PR y push a main como CI actual. Condicionado: releases/CD. Verificar checks requeridos remotos antes de afirmar bloqueo de merge. |
| RF-02 | Validación de calidad | Vigente: tipos, lint, tests pertinentes, integración y build. Formato/cobertura según scripts y política real, sin umbrales inventados. |
| RF-03 | Modularización de pipelines | Recomendado: jobs independientes, paralelismo, `needs` y reutilización útil. El verify secuencial no es por sí solo un defecto. |
| RF-04 | Dependencias reproducibles | Vigente: `npm ci`, lockfile sin cambios y runtime versionado. Instalar npm global fijado no sustituye la instalación determinista de dependencias. |
| RF-05 | Optimización de tiempo | Recomendado: cachés por lockfile, capas Docker, cancelación de CI obsoleto y presupuestos medidos; separar cachés confiables de PR externos. |
| RF-06 | Escaneo automatizado | Vigente: preservar SCA, firmas de dependencias, secretos e imágenes y gates actuales. Condicionado: SAST dedicado, IaC scanning y DAST según superficie/entorno; ESLint no demuestra cobertura SAST completa. |
| RF-07 | Autenticación temporal | Condicionado: OIDC con soporte y confianza restringida. Vigente: gestor externo, alcance mínimo y rotación para secretos inevitables. |
| RF-08 | Seguridad de ejecución | Vigente: mínimo privilegio y aislamiento externo. Recomendado: SHA completo revisado y actualización controlada; reportar tags pendientes. |
| RF-09 | Integridad de artefactos | Vigente al publicar: identidad, commit y evidencia verificables. CI ya genera SBOM de imágenes. Condicionado: firmas/procedencia/attestations con política de verificación. |
| RF-10 | Artefactos inmutables | Vigente al promover: mismo digest si configuración es externa al build. Adaptación: builds distintos por `NEXT_PUBLIC_*`/CSP cambiante, identidad y validación de cada uno. |
| RF-11 | Despliegues por entorno | Condicionado al CD: permisos/configuración/recursos aislados por entorno. Workflows separados o parametrizados; no exigir cuatro entornos. |
| RF-12 | Versionado/publicación | Condicionado: semver y releases autorizadas vinculadas a commit y gates. Un tag no acredita validación ni acceso productivo. |
| RF-13 | Aprobaciones/separación de funciones | Vigente: HITL y ACK de operaciones restringidas. Condicionado: protección productiva según riesgo y prestaciones reales de GitHub, incluida prevención de autoaprobación cuando aplique. |
| RF-14 | Despliegue progresivo | Condicionado: rolling, blue-green, canary o mecanismo equivalente de plataforma con validación/retorno. No exigir porcentajes fijos ni canary sin métricas. |
| RF-15 | Feature flags | Recomendado cuando separe entrega y activación: aprovechar módulo existente, responsable, estado y retiro; no imponer otro proveedor. |
| RF-16 | Rollback/recuperación | Vigente al desplegar: referencia estable, ensayo y compatibilidad datos/infraestructura. Expand-contract y restauración autorizada; no revertir automáticamente migraciones destructivas. |
| RF-17 | Observabilidad posterior | Vigente al desplegar: health checks, smoke tests y señales de API, procesos persistentes y demo completa. |
| RF-18 | Notificaciones/auditoría | Vigente: registrar resultados, versiones, errores, autorizaciones y recuperación sin secretos/PII. Condicionado: mensajes externos sólo a canales establecidos y con autorización explícita. |

## Requerimientos no funcionales

| Código | Atributo | Aplicación y evidencia |
|---|---|---|
| RNF-01 | Seguridad | Permisos mínimos por job, sin secretos productivos en PR externos. |
| RNF-02 | Reproducibilidad | Dependencias fijadas e identidad de artefacto/configuración verificable. |
| RNF-03 | Escalabilidad | Capacidad ajustada a carga medida, sin exigir self-hosted. |
| RNF-04 | Rendimiento | Presupuestos derivados de duración por clase de pipeline. |
| RNF-05 | Mantenibilidad | Responsabilidades explícitas y reutilización útil, sin duplicación. |
| RNF-06 | Disponibilidad | Recuperación/despliegue conforme a SLO acordados, sin prometer alta disponibilidad. |
| RNF-07 | Auditabilidad | Commit, run, artefacto, configuración, autorización y destino vinculados. |
| RNF-08 | Resiliencia | Procedimientos probados de mitigación/recuperación. |
| RNF-09 | Portabilidad | Evitar acoplamiento innecesario sin cambiar stack por defecto. |
| RNF-10 | Consistencia | Configuración no sensible versionada, aislamiento y diferencias explícitas. |

## Diez criterios técnicos de aceptación originales

Evaluarlos al implementar/desplegar; para documentación sólo revisar cobertura de instrucciones.

1. Integración protegida: PR con checks requeridos fallidos no se fusiona; comprobar configuración remota y resultado.
2. Ejecución automatizada: eventos definidos disparan controles, sin exigir eventos fuera del alcance.
3. Calidad: pruebas, análisis y build obligatorios correctos, con evidencia.
4. Artefacto reproducible: commit, digest/identidad, dependencias y versión trazables.
5. Seguridad: violaciones bloquean; excepciones con autorización, responsable y vencimiento.
6. Separación de privilegios: PR externos sin credenciales productivas ni publicación.
7. Promoción consistente: mismo artefacto si es reutilizable; builds específicos registran identidad/configuración y gates propios.
8. Despliegue protegido: versiones sin autorización no acceden al destino.
9. Validación operativa: health checks/smoke tests del destino real, incluidas dependencias y pollers.
10. Recuperación: restaurar o mitigar versión defectuosa, verificando datos y servicio.

## Pruebas de resiliencia originales

| Escenario | Resultado al implementar | Evidencia |
|---|---|---|
| PR con tests fallidos | CI falla y protección remota bloquea merge. | Run y checks requeridos configurados. |
| Credencial ficticia detectada | Fixture sintética detectada por política, sin credenciales reales. | Resultado acorde a detector/modo; un scanner de secretos verificados no detecta cualquier string ficticia. |
| Vulnerabilidad supera umbral | Gate bloquea o excepción formal vigente. | Hallazgo redactado, gate y autorización si aplica. |
| Despliegue no autorizado | Denegación sin efectos reales. | Prueba controlada de permisos/destino. |
| Health check fallido | Detener promoción o recuperar; no declarar éxito. | Estado y verificación posterior. |
| Métricas degradadas | Alerta/mitigación según umbrales acordados. | Señales y decisión trazable. |
| Despliegues incompatibles simultáneos | Serializar sin cancelar migración/recuperación a mitad. | Orden y estados de ejecuciones. |
| Dependencia externa transitoria | Reintento acotado o error explícito, sin ocultar fallo permanente. | Logs redactados y resultado final. |

Conservar evidencia del 100% de escenarios obligatorios del entorno autorizado. Sin entorno apropiado registrar pendiente o no aplicable justificado; una revisión textual no cuenta como prueba operacional.
