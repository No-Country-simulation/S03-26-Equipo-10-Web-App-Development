# Redis para cuotas y caché pública

**Estado:** implementación local de la fase 4; no implica despliegue. Redis no procesa el outbox: las entregas siguen en PostgreSQL.

## Configuración

- Compose incorpora `redis:7-alpine`, sin puerto público. La API recibe `REDIS_URL=redis://redis:6379` y espera el health check.
- Terraform define ElastiCache Redis OSS 7 en subredes privadas de datos, con TLS, cifrado en reposo, AUTH generado y security group que acepta solo la API. La ACL de aplicación permite únicamente TCP 6379 hacia esas subredes. Staging usa un nodo; producción agrega una réplica y failover. La URL cifrada se entrega a ECS desde Secrets Manager.
- Para desarrollo fuera de Compose, configurar `REDIS_URL` y `TEST_REDIS_URL` según la instancia descartable. CI crea un servicio Redis 7. No registrar URLs con credenciales en logs.

## Comportamiento

`RateLimitGuard` usa la IP efectiva de Express, calculada con `TRUST_PROXY_HOPS`, y toma cuotas atómicas por ruta/IP, tenant o slug y clave API (ID persistido en el formato legado; public ID cuando exista en la fase 6). Lua comprueba todas las dimensiones y las incrementa con TTL en una operación. El contador de fallos de login usa otra clave con TTL de 15 minutos, derivada del hash del correo. Si Redis falla, login y otras mutaciones con cuota responden 503; las lecturas pueden continuar sin cuota.

La lista pública usa claves `public-cache:v1:<tenant>:<version>:<hash de consulta>`, TTL de 60 segundos y máximo 256 KiB por respuesta. Un lock `SET NX PX` coordina cálculos entre réplicas. Al publicar, se incrementa la versión del tenant; las entradas de otros tenants no cambian. Si falla la caché, se lee PostgreSQL. Si Redis falla justo después de confirmar una publicación, la invalidación se registra como error y una respuesta anterior podría permanecer hasta el TTL; verificar ese caso en staging antes del despliegue gradual.

## Secuencia de despliegue

1. Provisionar Redis y conectividad; comprobar TLS/AUTH, SG y ACL en staging. No ejecutar `terraform apply` sin autorización.
2. Desplegar la API con `REDIS_URL` y retirar las réplicas antiguas que usan `Map`; mientras conviven, las cuotas no son globales.
3. Verificar con dos instancias: cinco fallos de login bloquean en ambas, el límite por API key/tenant/IP se comparte, y una publicación invalida la lista cacheada en la otra instancia.
4. Monitorear errores de Redis, 503 de cuotas, latencia de caché y memoria/evicciones. Con `noeviction`, un Redis lleno hará fallar las mutaciones protegidas en lugar de permitirlas sin cuota.
