# Seguridad HTTP y proxies — Fase 1

La API distingue tres mutaciones:

| Ruta | Control de CSRF |
| --- | --- |
| Login, registro, refresh/logout legado, formulario y analítica públicos por slug | `Origin` igual a `CORS_ORIGIN` o al origen del host recibido; un navegador con `Sec-Fetch-Site` externo no puede omitir `Origin`. |
| Analítica autenticada por API key | La credencial explícita se verifica en `ApiKeyGuard`; no usa cookie de sesión. |
| Rutas protegidas por sesión | Bearer explícito tiene precedencia sobre cookie. Si se usa `accessToken` por cookie, se exige `x-csrf-token` igual a la cookie CSRF y se valida `Origin` cuando existe. |

Los clientes de servidor sin `Origin` pueden seguir usando Bearer o API key. La fase de sesión web reemplazará el doble envío actual por un token CSRF ligado criptográficamente a la sesión y revisará refresh/logout para el modo cookie.

`RateLimitGuard` usa `request.ip` de Express. `TRUST_PROXY_HOPS=0` es el valor de desarrollo directo; en producción, donde la API está detrás de un único Nginx o ALB y la entrada directa está cerrada, el valor por defecto es `1`. Si cambia la topología, el operador debe ajustar el número de saltos confiables y mantener cerrada la entrada directa. No se toma el primer elemento de `X-Forwarded-For` suministrado por el cliente.

El run de CI #8 identificó dos fallos PostgreSQL de rollback ante un payload de outbox con `BigInt`. El repositorio ahora serializa el payload JSON dentro de la transacción, de modo que un valor no serializable la aborta. La verificación local pasa typecheck, lint, build y tests API; las cinco pruebas PostgreSQL permanecen pendientes de una nueva ejecución de CI sobre base descartable.
