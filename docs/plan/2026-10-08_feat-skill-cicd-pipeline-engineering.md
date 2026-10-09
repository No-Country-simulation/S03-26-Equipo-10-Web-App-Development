# Plan de Ejecución: Skill CI/CD para Testimonial CMS

**Fecha de Inicio**: 2026-10-08  
**Estado Global**: `En Progreso`  
**Ticket / Issue Vinculado**: No asignado  
**Rama Git**: Se conserva la rama actual; este plan no crea ramas ni commits.

## 1. Contexto y Restricciones

Incorporar `cicd-pipeline-engineering`, código **SKL-DEVOPS-CICD-001**, versión inicial 1.0.0, basada en la especificación técnica adjunta por el usuario. La elección confirmada es una skill adaptada al proyecto y compatibilidad con videos de YouTube dentro de testimonios.

Lecturas de contexto:

- [AGENTS.md](../../AGENTS.md), especialmente secciones 5, 8 y 9; [llm.txt](../../llm.txt).
- [Arquitectura](../technical/01_architecture.md), [reglas de negocio](../domain/business_rules.md) y [diccionario de datos](../domain/diccionario_de_dato.md).
- [CI existente](../../.github/workflows/ci.yml); skills locales de GitHub, configuración reproducible, Docker, Supabase y Vercel según el tema tratado.
- Skill `skill-creator` disponible en la sesión: frontmatter válido, instrucciones proporcionales y referencias de lectura progresiva.

La especificación fuente es el adjunto «Especificación técnica de habilidad», código SKL-DEVOPS-CICD-001, versión 1.0.0. Usarlo como fuente durante la fase 2; el resultado debe ser autocontenido y no depender de una ruta de adjuntos externa al repositorio.

**Alcance autorizado:** documentación del plan, nueva habilidad y sus referencias, registro en AGENTS.md y llm.txt e índice de planes. No modificar aplicaciones, workflows, dependencias, hooks, infraestructura o esquemas; no desplegar, ejecutar migraciones, crear recursos externos ni persistir secretos o PII.

**Integridad HITL:** ejecutar únicamente la fase `[Actual]`, proponer commit y detenerse. Esperar ACK humano antes de avanzar. No registrar aprobaciones humanas ni commits que no hayan ocurrido. La solicitud de implementar este plan autoriza la fase 1, no agrupar ambas fases.

## 2. Decisiones de Diseño

- Crear `.agents/skills/cicd-pipeline-engineering/SKILL.md` con nombre y descripción de activación, identificación, contexto vigente, restricciones, procedimiento de diseño/revisión/validación y enlaces a referencias temáticas.
- Mantener en `references/requisitos-y-aceptacion.md` los RF-01 a RF-18, RNF-01 a RNF-10, criterios de aceptación y pruebas de resiliencia del adjunto; distinguir requisitos del proyecto, recomendaciones y controles condicionados.
- Mantener el catálogo de antipatrones, evaluación y checklists del adjunto en `references/antipatrones-y-evaluacion.md`, conservando sus identificadores y adaptando detección y remediación al repositorio.
- Documentar la guía operativa de proveedores en `references/despliegue-demo.md`; no copiar manuales completos ni generar scripts, plantillas o metadatos UI sin necesidad concreta.
- Partir del CI existente: npm workspaces, versiones de runtime del repositorio, `npm ci`, tipos, lint, tests, builds, auditoría, escaneo de secretos, SBOM y smoke tests. Describir controles realmente implementados y brechas sin presentarlas como resueltas.
- Evitar obligaciones universales de Kubernetes, múltiples entornos, canary, OIDC o attestations; seleccionar controles según plataforma, riesgo y alcance autorizado.
- Registrar la habilidad como la número 25 del catálogo propio de ingeniería SKL, previa verificación de su inventario. Aclarar que ese número no incluye otras habilidades instaladas en `.agents/skills/`.

### Destinos previstos y límites de compatibilidad

- Vercel para Next.js; Supabase como PostgreSQL consumido desde NestJS/Prisma. Conservar autenticación propia y aislamiento por tenant. Verificar compatibilidad con Prisma 6.5 y versión real de PostgreSQL del destino, sin adoptar ejemplos de otra versión automáticamente.
- Documentar conexión directa o pooler según runtime/red y conexiones/roles separados para ejecución y migraciones. Revisar exposición por Data API, permisos y RLS cuando corresponda; no asumir que alojar PostgreSQL en Supabase protege automáticamente las tablas del CMS.
- Exigir que futuros planes resuelvan alojamiento de API, polling de webhooks, limpieza durable Cloudinary, ETL horario, warehouse en instancia separada y Redis. Los proveedores de procesos persistentes y Redis quedan pendientes para ese futuro plan; no declarar desplegado todo el sistema por publicar la web.
- Incluir HTTPS, CORS, cookies, CSRF, CSP, secretos por entorno, trazabilidad y recuperación. Las variables `NEXT_PUBLIC_*` pueden requerir builds diferentes por entorno: verificar antes de prometer promoción del mismo artefacto.
- Cloudinary conserva imágenes y limpieza durable. YouTube requiere validación de enlaces, metadatos con credencial exclusiva del backend, miniaturas, reproducción embebida y estados de video no disponible. No agregar subida a YouTube ni guía de grabación.
- Los smoke tests externos pertenecen a un despliegue futuro; no declarar compatibilidad remota verificada en esta incorporación documental.

Referencias oficiales para verificar instrucciones al redactar y al desplegar:

- [Prisma y Supabase](https://supabase.com/docs/guides/database/prisma).
- [Límites de Vercel Functions](https://vercel.com/docs/functions/limitations).
- [YouTube IFrame API](https://developers.google.com/youtube/iframe_api_reference).

## 3. Fases de Ejecución

### `[Completada]` Fase 1: Plan y Registro

**Estado de ejecución**: Terminada y aprobada. Commit verificado en Git: `c817a17`, `docs(plan): incorporá el plan HITL de la skill de CI/CD`.

- [x] Crear este plan con contexto, restricciones, decisiones y fases.
- [x] Incorporarlo al índice de planes como `En Progreso`.
- [x] Revisar enlaces locales y whitespace del diff; confirmar que sólo cambian el plan y su índice.

**Criterio de completitud**: Plan e índice coherentes y revisados; fase 2 habilitada por ACK humano.

**Review Humano (ACK)**: `Aprobado` — mensaje «continua» del usuario, recibido el 2026-10-09 después de la entrega de fase 1.

**Commit sugerido**:

```text
docs(plan): incorporá el plan HITL de la skill de CI/CD
```

### `[Actual]` Fase 2: Skill y Validación

**Estado de ejecución**: Terminada el 2026-10-09; pendiente de revisión humana y commit. Se conserva `[Actual]` hasta el ACK final.

- [x] Tras ACK explícito, marcar fase 1 completada y fase 2 actual, conservando evidencia real de revisión.
- [x] Leer íntegramente el adjunto y crear la skill con sus tres referencias según las decisiones anteriores.
- [x] Actualizar catálogo y conteos propios en AGENTS.md y llm.txt, sin afirmar que el despliegue está realizado.
- [x] Ejecutar `quick_validate.py` de skill-creator sobre el directorio nuevo; revisar frontmatter, enlaces, identificadores de la especificación fuente y ausencia de placeholders.
- [x] Revisar escenarios documentales: PR externo sin secretos, checks fallidos, rollback compatible con datos y reproducción YouTube fallida. Confirmar que la guía produce decisiones compatibles con las restricciones del proyecto.
- [x] Revisar diff y límites de alcance; registrar resultados reales en este plan y actualizar el índice a pendiente de revisión de fase 2.
- [x] Preparar commit sugerido para la entrega y detener el avance de fases; estado global `En Progreso` hasta el ACK final. El cierre documental posterior registrará sólo aprobaciones y commits efectivamente realizados.

**Validación realizada**:

- `quick_validate.py`: `Skill is valid!`; enlaces locales de la skill y del plan resueltos, sin placeholders.
- Cobertura documental: RF 18/18, RNF 10/10, antipatrones 20/20, diez criterios técnicos, ocho escenarios de resiliencia y diez capacidades de evaluación. El adjunto no asigna códigos de antipatrón: se conservaron sus nombres originales.
- Inventario: 25 entradas propias SKL con archivo existente; 42 habilidades instaladas en total tras agregar ésta. El catálogo explicita la distinción.
- Revisión documental de PR externo: separación de validación/publicación y prohibición de secretos y ejecución privilegiada de código no confiable.
- Revisión documental de checks fallidos: conservar fallo en gates, comprobar branch protection remota antes de afirmar bloqueo de merge.
- Revisión documental de rollback: esquema compatible, expand-contract, recuperación autorizada y ausencia de reversión destructiva automática.
- Revisión documental de YouTube fallido: URL inválida, ausencia de clave/item, error HTTP y restricciones de embed tratados como casos distintos; smoke tests remotos pendientes.
- Diff limitado a skill/referencias, AGENTS.md, llm.txt, plan e índice; sin cambios de runtime, workflows, esquemas, infraestructura o dependencias. `git diff --check` sin errores.
- Documentación oficial consultada para Supabase/Prisma, Vercel Functions, YouTube IFrame y Cloudinary. El endpoint Markdown del changelog Supabase no pudo leerse con el navegador; la guía requiere verificar changelog y capacidades al implementar un despliegue real.
- No se ejecutaron pruebas de aplicación ni pruebas externas: cambios exclusivamente documentales; no se acredita compatibilidad remota ni despliegue.

**Criterio de completitud**: Skill válida, referencias accesibles, registros coherentes y ninguna modificación fuera del alcance documental.

**Review Humano (ACK)**: `Pendiente`

**Commit sugerido**:

```text
feat(skills): agregá la skill de CI/CD adaptada al Testimonial CMS
```

## 4. Criterios de Aceptación Finales

- [x] La skill preserva requisitos, antipatrones y criterios del adjunto con adaptación explícita al proyecto.
- [x] Las restricciones HITL, de infraestructura, migraciones y secretos permanecen vigentes.
- [x] La guía distingue estado local implementado, destinos previstos y despliegue externo verificado.
- [x] Validación sintáctica, enlaces y escenarios documentales revisados; no corresponde ejecutar tests de aplicación por cambios únicamente documentales.
- [x] Catálogo propio SKL actualizado sin confundirlo con el total de habilidades instaladas.
- [ ] Ambas fases cuentan con revisión humana; el cierre no inventa ACK ni commits.
