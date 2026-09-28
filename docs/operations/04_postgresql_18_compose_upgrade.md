# Actualización local de PostgreSQL 16 a 18 en Docker Compose

El Compose actual usa `postgres:18-alpine` y el volumen nuevo `postgres18-data` montado en `/var/lib/postgresql`. La [imagen oficial de PostgreSQL](https://github.com/docker-library/docs/blob/master/postgres/content.md#pgdata) usa `/var/lib/postgresql/18/docker` como `PGDATA` desde PostgreSQL 18. El volumen anterior `postgres-data` no se monta ni se elimina: conserva los datos de PostgreSQL 16 para una reversión.

## Instalación sin datos previos

Si nunca se inició el servicio PostgreSQL 16 de este proyecto, levantá normalmente `docker compose up -d postgres`. No ejecutes los pasos de restauración.

## Migración de un volumen existente

Realizá estos pasos desde la raíz del repositorio en el host que contiene el volumen anterior y en una misma sesión de shell para conservar las variables del respaldo. Empezá mientras el Compose de PostgreSQL 16 todavía está activo y antes de recrear el servicio con la imagen 18. No uses `docker compose down -v` ni borres volúmenes.

1. Detené los procesos que escriben en la base y generá un respaldo fuera del repositorio. El contenedor PostgreSQL 16 debe seguir en ejecución durante el volcado:

   ```bash
   docker compose stop api web nginx pgadmin
   umask 077
   backup_dir="$HOME/.local/share/testimonial-cms/backups"
   mkdir -p "$backup_dir"
   backup_file="$backup_dir/postgresql16_$(date +%Y%m%dT%H%M%S).dump"
   counts_file="${backup_file}.counts"
   docker compose exec -T postgres sh -c 'exec pg_dump -Fc -U "$POSTGRES_USER" -d "$POSTGRES_DB"' > "$backup_file"
   test -s "$backup_file"
   docker compose exec -T postgres sh -c 'exec psql -At -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c "SELECT (SELECT count(*) FROM tenants), (SELECT count(*) FROM testimonials), (SELECT count(*) FROM outbox_events)"' > "$counts_file"
   ```

2. Detené PostgreSQL 16, actualizá el repositorio a la versión con `postgres:18-alpine` y levantá únicamente la base nueva. Compose creará `postgres18-data`; el volumen `postgres-data` permanecerá intacto:

   ```bash
   docker compose stop postgres
   # Actualizá el checkout al commit que contiene el Compose de PostgreSQL 18.
   docker compose up -d postgres
   docker compose exec -T postgres sh -c 'exec psql -At -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c "SHOW server_version"'
   ```

3. Restaurá el respaldo en la base nueva y compará los conteos antes de reabrir las escrituras:

   ```bash
   docker compose exec -T postgres sh -c 'exec pg_restore --exit-on-error --clean --if-exists --no-owner --no-acl -U "$POSTGRES_USER" -d "$POSTGRES_DB"' < "$backup_file"
   docker compose exec -T postgres sh -c 'exec psql -At -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c "SELECT (SELECT count(*) FROM tenants), (SELECT count(*) FROM testimonials), (SELECT count(*) FROM outbox_events)"' > "${backup_file}.restored-counts"
   cmp "$counts_file" "${backup_file}.restored-counts"
   ```

4. Revisá que la tabla `_prisma_migrations` esté presente y que los endpoints `/api/v1/health/live` y `/api/v1/health/ready` respondan tras iniciar la API. Luego levantá web y nginx. Conservá el respaldo y el volumen PostgreSQL 16 hasta completar la revisión funcional:

   ```bash
   docker compose up -d api
   docker compose up -d web nginx
   ```

Si la restauración o las comprobaciones fallan, mantené detenidos los servicios que escriben. El volumen anterior sigue disponible para reiniciar PostgreSQL 16 con el Compose previo; no intentes abrir ambas versiones contra el mismo volumen. Este procedimiento no ejecuta migraciones Prisma sobre una base persistente.
