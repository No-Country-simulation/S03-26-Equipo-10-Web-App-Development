# Especificación Técnica de Habilidad: Blueprint de Configuración Maestro (Seguridad y Robustez)

**Código de Skill:** SKL-SEC-002

**Versión:** 1.1.0

**Estándar:** ISO/IEC 26514 / IEEE 29148 / Zero-Trust Architecture

---

## 1. Ficha de Identificación del Skill

| **Atributo** | **Definición Técnica** |
| --- | --- |
| **Habilidad Principal** | **Configuración Maestra de Seguridad y Robustez** |
| **Objetivo de Dominio** | Implementar un marco de defensa integral en aplicaciones TypeScript, blindando la cadena de suministro, el entorno de ejecución y la integridad de los datos en tiempo real. |
| **Tipo de Proyecto** | Arquitecturas de Alto Rendimiento / Fintech / Sistemas Críticos. |
| **Complejidad** | **Alta** (Enfoque en seguridad proactiva y arquitectura Zero-Trust). |

---

## 2. Descripción y Filosofía de Diseño

El **Blueprint de Configuración Maestro** se aleja del desarrollo convencional para adoptar una postura de **Defensa en Profundidad**. Se basa en la premisa de que el entorno es hostil y la cadena de suministro es vulnerable.

- **Fronteras de Confianza:** Validación estricta en los puntos de entrada (API/DB) para tratar los datos internos como inmutables y seguros.
- **Seguridad por Defecto:** Configuración de cabeceras, tipos y validaciones que impiden errores por omisión.
- **Inmutabilidad:** Uso de patrones que aseguran que una vez validado, el estado no cambie de forma impredecible.

## 2.1. Resiliencia y Observabilidad (Patrones Aplicables)

- **Flujo de Control:** Implementación de "Fail Fast" mediante validación de esquemas (Zod) en el primer contacto con datos externos.
- **Trazabilidad:** Uso de logs estructurados (Pino) en formato JSON para facilitar el monitoreo proactivo y la respuesta ante incidentes.
- **Confiabilidad:** Auditoría continua de dependencias para mitigar ataques de cadena de suministro (Supply Chain Attacks).

---

## 3. Requerimientos del Skill

## 3.1. Requerimientos Funcionales (RF)

- **[RF-01]:** Blindaje de dependencias mediante el uso de versiones exactas y gestores de paquetes seguros (pnpm).
- **[RF-02]:** Implementación de seguridad activa en el runtime mediante Helmet.js y Content Security Policy (CSP).
- **[RF-03]:** Validación de esquemas en runtime para toda entrada externa (Zod).
- **[RF-04]:** Configuración de auditoría automática de vulnerabilidades en el pipeline de CI/CD.

## 3.2. Requerimientos No Funcionales (RNF)

- **[RNF-01] Seguridad:** Eliminación de secretos "hardcoded" y detección de fugas mediante herramientas como Gitleaks.
- **[RNF-02] Calidad:** Configuración de TypeScript en modo estricto (`strict: true`) y linters de seguridad (`eslint-plugin-security`).
- **[RNF-03] Robustez:** Manejo de errores centralizado y profesional (evitar `console.log` en favor de niveles de log).

---

## 4. Criterios de Aceptación (Definition of Done)

1. **Validación Lógica:** Toda variable de entorno y entrada de API pasa por un validador de esquema antes de ser utilizada.
2. **Resiliencia:** El sistema detecta y bloquea intentos de inyección (XSS/CSRF) mediante cabeceras configuradas correctamente.
3. **Calidad Técnica:** El comando `audit` del gestor de paquetes arroja 0 vulnerabilidades críticas.
4. **Autonomía:** El desarrollador puede explicar el flujo de un dato desde una "Frontera de Confianza" hasta su persistencia.

---

## 5. Ecosistema de Herramientas (Stack)

- **Gestión de Dependencias:** pnpm (Non-flat node_modules).
- **Seguridad Runtime:** Helmet.js, Content Security Policy (CSP).
- **Validación:** Zod (Type-safe schemas).
- **Observabilidad:** Pino (Structured logging).
- **Calidad/Linting:** TypeScript (Strict), Husky, lint-staged, eslint-plugin-security.
- **Auditoría:** Snyk, pnpm audit, Gitleaks.

---

## 6. Metodología de Práctica (Paso a Paso)

1. **Fase de Setup:** Configurar `pnpm` y establecer versiones exactas en `package.json`.
2. **Fase de Construcción:** Configurar `tsconfig.json` con flags de seguridad y `helmet` en el servidor.
3. **Fase de Refactor:** Reemplazar validaciones manuales por esquemas de **Zod** y `console.log` por **Pino**.
4. **Fase de QA:** Ejecutar checklist de seguridad pre-producción (Gitleaks, audit, CSP validation).

---

## 7. Antipatrones (Lo que NO se debe hacer)

- ⚠️ **[Antipatrón 1]:** Usar versiones con `^` o `~` en dependencias críticas de producción.
- ⚠️ **[Antipatrón 2]:** Guardar secretos en el código fuente o archivos `.env` sin cifrar en el repositorio.
- ⚠️ **[Antipatrón 3]:** Confiar en el tipado de TypeScript en tiempo de ejecución (Recordar: TS se borra al compilar).
- ⚠️ **[Antipatrón 4]:** No configurar CSP, permitiendo ataques de inyección de scripts externos.

---

## 8. Evaluación y KPIs

| **Métrica** | **Meta** |
| --- | --- |
| **Vulnerabilidades Críticas** | 0 |
| **Cobertura de Validación** | 100% de entradas externas |
| **Calificación de Seguridad** | A+ en SecurityHeaders.com |
| **Tiempo de Auditoría** | Integrado en cada commit (Husky/CI) |

---

## 9. Recursos Adicionales

- [OWASP Top 10 - Vulnerabilidades Web](https://owasp.org/www-project-top-ten/)
- [Snyk - Security Best Practices](https://snyk.io/learn/)
- [Zod Documentation](https://zod.dev/)
