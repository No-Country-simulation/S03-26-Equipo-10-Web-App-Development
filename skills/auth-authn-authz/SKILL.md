# Especificación Técnica de Habilidad: Autenticación y Autorización en Desarrollo Web

**Código de Skill:** SKL-PRO-001 

**Versión:** 1.1.0

**Estándar:** ISO/IEC 26514 / IEEE 29148 / Agile DoD

---

## 1. Ficha de Identificación del Skill

| **Atributo** | **Definición Técnica** |
| --- | --- |
| **Habilidad Principal** | **Autenticación (AuthN) y Autorización (AuthZ)** |
| **Objetivo de Dominio** | Capacitar al usuario para diseñar e implementar flujos de identidad seguros, diferenciando entre arquitecturas Stateful y Stateless según las necesidades del proyecto. |
| **Tipo de Proyecto** | Desarrollo de Software (Web/Mobile) / Arquitectura de Seguridad. |
| **Complejidad** | **Alta** (Debido a las implicaciones de seguridad y gestión de vectores de ataque). |

---

## 2. Descripción y Filosofía de Diseño

El skill se centra en la gestión de la identidad digital. Se basa en la premisa de que **la seguridad no es un producto, sino un proceso** de capas superpuestas.

- **AuthN (¿Quién eres?):** Validación de credenciales para emitir un artefacto de confianza (Token/Sesión).
- **AuthZ (¿Qué puedes hacer?):** Verificación de permisos y roles (RBAC/ABAC) en cada punto de entrada del sistema.

## 2.1. El Paradigma de Estado

- **Stateless (JWT/PASETO):** Ideal para arquitecturas distribuidas y microservicios. La confianza está contenida en la firma criptográfica del token. Se prefiere para escalabilidad masiva.
- **Stateful (Sesiones tradicionales):** Ideal para aplicaciones monolíticas o aplicaciones web con frontend y backend acoplados. Permite una revocación inmediata de acceso, ofreciendo un control superior en tiempo real.

## 2.2. Resiliencia y Observabilidad (Patrones Aplicables)

- **Flujo de Control:** Implementación de **Refresh Token Rotation** para mitigar el robo de tokens y uso de **Exponential Backoff** en servicios de MFA externos.
- **Trazabilidad:** Uso de **Correlation IDs** en los headers de autenticación para rastrear peticiones maliciosas a través de los logs.
- **Confiabilidad:** Implementación de **Graceful Shutdown** para cerrar conexiones de Redis (donde se guardan sesiones o listas negras de JWT) de forma segura.

---

## 3. Requerimientos del Skill

## 3.1. Requerimientos Funcionales (RF)

- **[RF-01]:** El sistema debe cifrar las contraseñas utilizando algoritmos de hashing resistentes (Bcrypt/Argon2) antes de persistirlas.
- **[RF-02]:** El servicio de Auth debe ser capaz de emitir y validar tokens (JWT/PASETO) o IDs de sesión.
- **[RF-03]:** Debe existir un Middleware de Autorización que intercepte peticiones y verifique permisos antes de ejecutar la lógica de negocio.
- **[RF-04]:** Implementación de flujos de recuperación de cuenta y MFA (Multi-Factor Authentication).

## 3.2. Requerimientos No Funcionales (RNF)

- **[RNF-01] Seguridad:** Los tokens no deben exponer información sensible (PII) en su payload. Uso de cookies `HttpOnly`, `Secure` y `SameSite` para mitigar XSS y CSRF.
- **[RNF-02] Rendimiento:** La verificación de la firma de un token no debe añadir más de 50ms de latencia al request.
- **[RNF-03] Disponibilidad:** En arquitecturas de sesión, el almacenamiento (Redis) debe contar con alta disponibilidad para evitar "Logouts" masivos.

---

## 4. Criterios de Aceptación (Definition of Done)

1. **Validación Lógica:** El flujo de login rechaza credenciales inválidas y el middleware bloquea accesos no permitidos por rol.
2. **Prueba de Revocación:** Se ha implementado un método funcional para invalidar el acceso (ya sea borrando la sesión en DB o usando una lista negra para JWT).
3. **Calidad Técnica:** Los JWT deben estar firmados con algoritmos seguros (RS256 o EdDSA); nunca usar `alg: none`.
4. **Autonomía:** El desarrollador puede implementar un flujo completo de "Refresh Token" sin supervisión.

---

## 5. Ecosistema de Herramientas (Stack)

- **Lenguajes:** Node.js, Go, Python o Java.
- **Librerías Recomendadas:**
    - **JWT:** `jsonwebtoken` (Node), `PyJWT` (Python).
    - **PASETO:** `paseto.js` (alternativa superior en seguridad).
    - **Frameworks de Auth:** `Passport.js`, `Lucia Auth`, `NextAuth.js` (Auth.js), `Keycloak` (Enterprise).
    - **Almacenamiento:** Redis (para sesiones o listas negras).

---

## 6. Metodología de Práctica (Paso a Paso)

1. **Fase de Setup:** Configurar un servidor con HTTPS y una base de datos para usuarios.
2. **Fase de Construcción:**
    - Implementar registro con hash de contraseña.
    - Generar JWT tras login exitoso.
    - Crear middleware `isAuthorized(role)` para proteger rutas.
3. **Fase de Refactor:** Migrar de `localStorage` a Cookies `HttpOnly` e implementar lógica de Refresh Tokens.
4. **Fase de QA:** Testear ataques de inyección de tokens y expiración forzada.

---

## 7. Antipatrones (Lo que NO se debe hacer)

- ⚠️ **[Antipatrón 1]:** Guardar JWT con información sensible en `localStorage` (vulnerable a XSS).
- ⚠️ **[Antipatrón 2]:** Usar secretos débiles para firmar tokens (siempre usar variables de entorno con claves largas y aleatorias).
- ⚠️ **[Antipatrón 3]:** No establecer un tiempo de expiración (TTL) corto en los Access Tokens.
- ⚠️ **[Antipatrón 4]:** Confiar ciegamente en el cliente; siempre re-validar la autorización en el lado del servidor.

---

## 8. Evaluación y KPIs

| **Métrica** | **Meta** |
| --- | --- |
| **Fugas de Seguridad** | 0 incidentes en producción |
| **Latencia de Auth** | < 100ms (incluyendo DB lookup) |
| **Tiempo de Revocación** | < 1s (en sistemas stateful) |

---

## 9. Recursos Adicionales

- [OWASP Top 10 - Broken Access Control](https://owasp.org/www-project-top-ten/2017/A5_2017-Broken_Access_Control)
- [JWT.io Debugger](https://jwt.io/)
- [Paseto.io Documentation](https://paseto.io/)
