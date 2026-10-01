# Corte de sesiones web a cookies HttpOnly

## Preparación

1. Aplicar la migración de expansión `20261001000000_refresh_session_expand` mediante el procedimiento autorizado. No quitar `family_id` nullable durante la convivencia con réplicas antiguas.
2. Configurar `AUTH_LEGACY_STARTED_AT` con la fecha y hora UTC del **primer despliegue compatible** (`YYYY-MM-DDTHH:mm:ssZ`). El modo implícito vence a los 30 días. En producción, sin fecha se exige `X-Auth-Mode` explícito.
3. Mantener el lector de refresh tokens legados durante toda la ventana. Los nuevos JWT incluyen `sid`; los JWT previos sin `sid` conservan su validez hasta su expiración original de 15 minutos.
4. En un despliegue gradual, instalar primero la API compatible y después la web. Mantener `CORS_ORIGIN` apuntando al origen exacto de la web y `credentials: true`; servir ambos por HTTPS en producción.

## Contrato

- La web usa `X-Auth-Mode: cookie`, `credentials: include` y no recibe tokens en login, registro ni refresh.
- `GET /api/v1/auth/csrf` devuelve `{ csrfToken }` para un refresh cookie activo. El valor es un HMAC ligado al refresh token y cambia al rotarlo.
- Toda mutación autenticada por cookie envía `x-csrf-token`. Refresh y logout también requieren Origin permitido. Bearer explícito mantiene el contrato `{ user, tokens }` y no establece cookies.
- `POST /api/v1/auth/upgrade-session` consume el refresh token de `testimonial-cms.session` una sola vez, establece cookies y devuelve solo usuario. La web borra esa entrada de `localStorage` antes de enviar el token.

## Verificaciones y retirada

- Probar login, recuperación, refresh, logout, CSRF inválido, reutilización y acceso entre tenants en staging con navegador y API reales. Confirmar que `localStorage` no contiene tokens.
- Revisar auditorías `REFRESH_TOKEN_REUSE` sin registrar hashes ni tokens. Un replay revoca la familia; una carrera simultánea produce una sola inserción nueva y puede provocar esta revocación protectora.
- Observar uso del modo implícito y de `upgrade-session` durante 30 días. Retirar el lector y los headers legados solo cuando no haya uso y se haya cumplido el plazo.
- Un rollback después de emitir familias nuevas debe mantener lectura de ambos formatos y el esquema de expansión.

Esta fase se probó solo en PostgreSQL y Redis descartables. No se aplicó la migración a bases persistentes ni se desplegó en staging o producción.
