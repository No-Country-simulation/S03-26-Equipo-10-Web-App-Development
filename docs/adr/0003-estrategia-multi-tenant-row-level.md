# ADR 0003: Estrategia Multi-Tenant de Fila Única (Row-Level)

**Fecha:** 2026-04-25  
**Estado:** Aceptado

## Contexto

El proyecto Testimonial CMS es un SaaS B2B donde distintas empresas (inquilinos/tenants) utilizarán el sistema. Cada inquilino necesita gestionar sus propios testimonios, usuarios, configuraciones y webhooks sin que sus datos se mezclen o sean accesibles para otros inquilinos.

Existen tres formas principales de aislar datos en PostgreSQL:
1. **Database-level:** Una base de datos física separada por cada inquilino.
2. **Schema-level:** Un esquema diferente dentro de la misma base de datos para cada inquilino.
3. **Row-level:** Una única base de datos y un único esquema, donde todas las tablas tienen una columna `tenant_id` que filtra la información.

## Decisión

Hemos seleccionado la estrategia **Row-Level (Fila Única)** mediante el uso generalizado de la columna `tenant_id` en todas las tablas del sistema (ver `diccionario_de_dato.md`).

## Justificación

- **Simplicidad Operativa:** Para un MVP SaaS, mantener migraciones sincronizadas en cientos de bases de datos o esquemas es un dolor de cabeza operativo. Un único esquema permite que herramientas como Prisma ORM apliquen las migraciones en un solo paso.
- **Uso Eficiente de Recursos:** Compartir un único Pool de conexiones y una única memoria caché en la base de datos es mucho más eficiente que dividir los recursos.
- **Aislamiento Lógico Suficiente:** Dado el nivel de sensibilidad de los testimonios (la mayoría serán públicos), el aislamiento a nivel de aplicación (Row-Level) es suficiente y no requiere el aislamiento a nivel físico de la base de datos, siempre y cuando se sigan prácticas estrictas de validación.

## Consecuencias (Trade-offs)

- **Positivas:** Bajo costo de mantenimiento y despliegue rápido. Fácil agregación de datos y reportes a nivel global si fuera necesario (ej. "total de testimonios en toda la plataforma").
- **Negativas:** Existe riesgo de filtrado cruzado (Cross-Tenant Data Leak) si un desarrollador olvida añadir el filtro `WHERE tenant_id = X` en una consulta.
- **Mitigaciones:**
  - Implementación de middlewares/interceptores en NestJS que fuercen o validen la presencia del `tenant_id` del usuario autenticado en todas las operaciones.
  - Revisiones de código estrictas para asegurar la inclusión del filtro.
  - Futuro: Habilitar "Row Level Security" (RLS) nativo de PostgreSQL si la aplicación migra a accesos directos desde clientes, aunque con NestJS en el medio el control por aplicación suele ser más manejable.
