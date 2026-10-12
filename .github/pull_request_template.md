## Problema y cambio

Describí el comportamiento observado, el esperado y el resultado del cambio. Vinculá issue, contrato o decisión aprobada. Indicá alcance y riesgos relevantes.

## Evidencia de verificación

Completá con resultados reales; borrá ejemplos/instrucciones sin reemplazarlos por aprobaciones supuestas.

| Contrato/riesgo y escenario | Prueba/nivel | Dependencias reales y simuladas | Comando/entorno | Resultado y omisiones |
| --------------------------- | ------------ | ------------------------------- | --------------- | --------------------- |
|                             |              |                                 |                 |                       |

- Red/Green: indicá fallo funcional observado y corrección, o justificá por qué el cambio admite caracterización/validación sin TDD estricto.
- SHA y run de CI: vinculá el run del commit final. Si aún no existe o falló, declaralo pendiente.
- Reportes: revisá JSON API/web y cobertura en los artefactos del run; declará límites de la ejecución local. La cobertura no sustituye escenarios/assertions.
- Negativos/límites/efectos persistidos: señalá los que aplican, incluyendo rol, tenant, CSRF, rollback o concurrencia cuando corresponda.

## Revisión y entrega

- [ ] Contrato y comportamiento contrastados; pruebas proporcionales al riesgo y mocks declarados.
- [ ] Tipos/lint y checks requeridos aprobados para el SHA final; sin foco, fallos, skips/todo ni reducción de la selección CI.
- [ ] Documentación afectada actualizada y evidencia sin credenciales/PII.
- [ ] Revisión de otra persona solicitada; restricciones HITL respetadas cuando aplican.

Indicá cambios de dependencias/configuración/datos y su autorización cuando corresponda. Si afecta entrega o migraciones, vinculá el plan/runbook, compatibilidad y recuperación; el PR no habilita por sí solo despliegues ni migraciones.
