# Mejores Prácticas de Indexación en PostgreSQL

Esta referencia detalla las estrategias de indexación críticas para cumplir con el Skill **SKL-DB-001**.

## 1. Tipos de Índices

- **B-Tree**: El estándar para comparaciones de igualdad y rango (`<`, `<=`, `=`, `>=`, `>`).
- **GIN (Generalized Inverted Index)**: Ideal para tipos de datos complejos como `JSONB` o búsquedas de texto completo (`tsvector`).
- **GiST**: Útil para datos geométricos o rangos de tiempo (con `btree_gist`).
- **BRIN**: Para tablas masivas ordenadas cronológicamente (ahorra mucho espacio).

## 2. Estrategias Avanzadas

- **Partial Indexes**: Indexa solo una parte de la tabla usando una cláusula `WHERE`.
  - *Ej:* `CREATE INDEX idx_active_users ON users (id) WHERE active IS TRUE;`
- **Covering Indexes (INCLUDE)**: Incluye columnas adicionales en el índice para permitir "Index Only Scans".
  - *Ej:* `CREATE INDEX idx_user_email_id ON users (email) INCLUDE (id);`
- **Expression Indexes**: Indexa el resultado de una función.
  - *Ej:* `CREATE INDEX idx_lower_email ON users (LOWER(email));`

## 3. Mantenimiento y Rendimiento

- **EXPLAIN ANALYZE**: Úsalo siempre para verificar si Postgres está usando el índice como esperas.
- **Index Hit Rate**: Monitorea que la mayoría de tus lecturas provengan de la memoria (índices) y no de disco.
- **Evitar Redundancia**: No crees índices que ya están cubiertos por una clave primaria o un índice compuesto.

---

## Antipatrones a Evitar

- [ ] Indexar columnas con muy baja selectividad (ej: booleanos sin filtro parcial).
- [ ] Olvidar indexar las claves foráneas (Foreign Keys).
- [ ] Crear demasiados índices en tablas con alta tasa de escritura (INSERT/UPDATE).
