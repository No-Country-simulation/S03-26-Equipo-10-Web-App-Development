# Resumen OWASP ASVS v4.0: Gestión de Sesiones

Esta referencia resume los puntos clave del estándar **Application Security Verification Standard (ASVS)** relacionados con el Skill **SKL-SEC-001**.

## V3: Session Management Verification Requirements

### 3.1 Session Handling
- **3.1.1**: Generar IDs de sesión con al menos 128 bits de entropía.
- **3.1.2**: Cambiar el ID de sesión tras el login (Previene *Session Fixation*).

### 3.2 Token-based Session Management
- **3.2.1**: Asegurar que los tokens se envíen solo a través de canales cifrados (HTTPS).
- **3.2.2**: Los JWT deben usar firmas digitales fuertes (RS256, ES256). Nunca permitir `alg: none`.

### 3.3 Cookie-based Session Management
- **3.3.1**: Usar el atributo `HttpOnly`.
- **3.3.2**: Usar el atributo `Secure`.
- **3.3.3**: Usar el atributo `SameSite` (Lax o Strict).

### 3.4 Session Timeout
- **3.4.1**: Implementar tiempos de inactividad razonables (ej: 15-30 minutos para apps sensibles).
- **3.4.2**: Permitir al usuario cerrar sesión (Logout) de forma efectiva, invalidando el token en el servidor.

---

## Mitigación de Vectores de Ataque

| Ataque | Técnica de Mitigación | Cumplimiento ASVS |
| --- | --- | --- |
| **XSS** | Cookies `HttpOnly` + CSP Headers | Sí |
| **CSRF** | Cookies `SameSite=Strict` + Anti-CSRF Tokens | Sí |
| **Fixation** | Regenerar Session ID tras Login | Sí |
| **Brute Force** | Rate Limiting + Account Lockout | Sí |
