# Especificación Técnica de Habilidad: Autenticación y Gestión de Sesiones

**Código de Skill:** SKL-SEC-001

**Versión:** 1.1.0

**Estándar:** ISO/IEC 26514 / IEEE 29148 / OWASP ASVS v4.0

---

## 1. Ficha de Identificación del Skill

| **Atributo** | **Definición Técnica** |
| --- | --- |
| **Habilidad Principal** | **Autenticación (AuthN) y Persistencia de Sesión** |
| **Objetivo de Dominio** | Capacitar al usuario para implementar flujos de identidad seguros, comprendiendo las compensaciones (*trade-offs*) entre el uso de Cookies (Stateful) y JWT (Stateless). |
| **Tipo de Proyecto** | Arquitectura de Microservicios, SaaS, Aplicaciones Web Seguras. |
| **Complejidad** | **Alta** (Debido a vectores de ataque como XSS, CSRF y Replay Attacks). |

---

## 2. Descripción y Filosofía de Diseño

El skill de **Autenticación y Sesiones** se enfoca en la validación de la identidad del usuario y el mantenimiento de dicha identidad a través del tiempo. Se basa en el principio de **Defensa en Capas**:

- **Modularidad:** Separación estricta entre el *Identity Provider* (quien valida credenciales) y el *Service Provider* (quien consume la sesión).
- **Idempotencia:** La validación de un JWT debe ser pura (sin efectos secundarios); el refresco de un token debe ser controlado para evitar múltiples sesiones activas innecesarias.
- **Reusabilidad:** Implementación de adaptadores de Auth que permitan cambiar entre sesiones en Redis o Tokens firmados sin reescribir la lógica de negocio.

## 2.1. Resiliencia y Observabilidad (Patrones Aplicables)

- **Flujo de Control:** Implementación de **Refresh Token Rotation** (un refresh token solo sirve una vez) y lógica de reintento con *Exponential Backoff* para servicios de MFA.
- **Persistencia y Fallos:** Uso de **Dead Letter Queues (DLQ)** para capturar intentos de login sospechosos o fallos masivos en el proveedor de identidad.
- **Trazabilidad:** Inyección de **Correlation IDs** en los tokens para rastrear cada petición a través de los logs estructurados del backend.
- **Métricas de Éxito:** Monitoreo de *Auth Latency* y *Failure Rate* (distinguiendo entre errores de usuario y errores del sistema).

---

## 3. Requerimientos del Skill

## 3.1. Requerimientos Funcionales (RF)

- **[RF-01]:** Cifrado de credenciales mediante algoritmos de hashing modernos (Argon2id o Bcrypt con salt dinámico).
- **[RF-02]:** Gestión de **Cookies Seguras**: Configuración de flags `HttpOnly`, `Secure` y `SameSite=Strict`.
- **[RF-03]:** Implementación de **JWT (Stateless)**: Firma mediante algoritmos asimétricos (RS256 o EdDSA) y validación de *claims* estándar (`exp`, `iat`, `aud`).
- **[RF-04]:** Mecanismo de **Revocación de Sesión**: Capacidad de invalidar tokens antes de su expiración (vía Blacklist en Redis o Base de Datos).

## 3.2. Requerimientos No Funcionales (RNF)

- **[RNF-01] Escalabilidad:** Los flujos con JWT deben permitir el escalamiento horizontal sin necesidad de compartir memoria entre servidores.
- **[RNF-02] Seguridad:** Mitigación de **XSS** mediante el almacenamiento de tokens en cookies `HttpOnly` (no accesibles por JS) y de **CSRF** mediante validación de tokens Anti-CSRF.
- **[RNF-03] Disponibilidad:** El sistema de sesiones (si es *stateful*) debe contar con alta disponibilidad (Redis Cluster).

---

## 4. Criterios de Aceptación (Definition of Done)

1. **Validación Lógica:** El sistema deniega el acceso con tokens expirados, alterados o mal firmados.
2. **Resiliencia:** El sistema maneja correctamente el flujo de "Token Expirado" renovando el acceso sin cerrar la sesión del usuario (si el *Refresh Token* es válido).
3. **Calidad Técnica:** Los JWT no contienen información sensible (PII) en el payload y pasan revisiones de seguridad automatizadas.
4. **Autonomía:** El desarrollador puede explicar la diferencia técnica entre un flujo basado en servidor y uno basado en cliente, justificando la elección para el proyecto.

---

## 5. Ecosistema de Herramientas (Stack)

- **Herramientas de Hashing:** Argon2, Bcrypt.
- **Librerías JWT:** `jsonwebtoken` (Node), `PyJWT` (Python), `paseto` (alternativa más segura).
- **Gestión de Estado:** Redis (para Blacklists o Sesiones tradicionales).
- **Middleware de Seguridad:** Helmet.js, Passport.js, NextAuth.js (Auth.js).

---

## 6. Metodología de Práctica (Paso a Paso)

1. **Fase de Setup:** Configurar un servidor HTTPS y definir la estrategia de almacenamiento de secretos (Variables de entorno).
2. **Fase de Construcción:**
    - Crear el endpoint de Login que devuelva una **Cookie HttpOnly**.
    - Implementar un middleware que verifique la firma del JWT en cada petición.
3. **Fase de Refactor:** Implementar la **Rotación de Refresh Tokens** para aumentar la seguridad en caso de robo de token.
4. **Fase de QA:** Simular ataques de inyección de scripts para verificar que el token no puede ser extraído del navegador.

---

## 7. Antipatrones (Lo que NO se debe hacer)

- ⚠️ **[Antipatrón 1]:** Almacenar JWT en `localStorage` o `sessionStorage` (Vulnerable a XSS).
- ⚠️ **[Antipatrón 2]:** Usar el algoritmo `HS256` (Simétrico) cuando el verificador y el emisor son servicios distintos (Riesgo de compromiso de clave).
- ⚠️ **[Antipatrón 3]:** No definir una fecha de expiración corta en los Access Tokens.
- ⚠️ **[Antipatrón 4]:** Confiar en el ID de usuario que viene en la URL sin validar el token que lo acompaña.

---

## 8. Evaluación y KPIs

| **Métrica** | **Meta** |
| --- | --- |
| **Tiempo de Revocación** | < 1 segundo (Blacklist latency) |
| **Seguridad de Token** | 0 vulnerabilidades de tipo "None algorithm" |
| **Ratio de Login Exitoso** | > 98% (Excluyendo errores de contraseña) |

---

## 9. Recursos Adicionales

- [OWASP - Authentication Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html)
- [JWT.io - Debugger y Estándares](https://jwt.io/)
- [RFC 7519 - JSON Web Token Specification](https://datatracker.ietf.org/doc/html/rfc7519)
