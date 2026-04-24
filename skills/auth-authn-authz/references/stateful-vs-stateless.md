# Comparativa: Autenticación Stateful vs Stateless

Esta referencia detalla los criterios de decisión para elegir entre un modelo de sesión (Stateful) o un modelo basado en tokens (Stateless).

## 1. Modelo Stateful (Sesiones Tradicionales)

En este modelo, el servidor mantiene un registro de la sesión en una base de datos o almacenamiento rápido (como Redis).

### Ventajas
- **Revocación inmediata:** Si un usuario pierde su dispositivo, puedes borrar la sesión de la base de datos y el acceso se invalida al instante.
- **Seguridad simplificada:** El ID de sesión es un simple string aleatorio sin información sensible.
- **Control total:** Es más fácil implementar límites de "una sesión por usuario".

### Desventajas
- **Escalabilidad:** Requiere una base de datos compartida si tienes múltiples servidores.
- **Latencia:** Cada petición requiere un lookup en la base de datos para validar la sesión.

---

## 2. Modelo Stateless (JWT / Tokens)

La información del usuario y sus permisos están contenidos dentro del token, el cual está firmado criptográficamente.

### Ventajas
- **Escalabilidad masiva:** El servidor no necesita guardar nada; solo verifica la firma. Ideal para microservicios.
- **Portabilidad:** Un solo token puede ser usado en diferentes dominios o servicios (SSO).
- **Rendimiento:** No hay consultas a la base de datos para verificar el estado (solo verificación de firma local).

### Desventajas
- **Revocación difícil:** Un JWT es válido hasta que expira. Para invalidarlo antes, se requiere una "Lista Negra" (Blacklist), lo que lo vuelve parcialmente stateful.
- **Seguridad del cliente:** Vulnerable si se guarda en `localStorage`. Debe usarse estrictamente con cookies `HttpOnly`.

---

## Cuadro de Decisión

| Necesidad | Recomendación |
| --- | --- |
| Control de revocación estricto | **Stateful** |
| Arquitectura de Microservicios | **Stateless** |
| Alta escalabilidad / Pocos recursos | **Stateless** |
| Aplicación Monolítica / Web simple | **Stateful** |
