# Especificación Técnica de Habilidad: HTTPS, TLS y Gestión de Certificados (PKI)

**Código de Skill:** SKL-NET-003

**Versión:** 1.1.0

**Estándar:** ISO/IEC 26514 / IEEE 29148 / Agile DoD / RFC 8446 (TLS 1.3)

---

## 1. Ficha de Identificación del Skill

| **Atributo** | **Definición Técnica** |
| --- | --- |
| **Habilidad Principal** | **Cifrado de Capa de Transporte y Arquitectura PKI** |
| **Objetivo de Dominio** | Capacitar al usuario para asegurar la integridad, confidencialidad y autenticidad de los datos en tránsito mediante la implementación de TLS y la gestión de Autoridades de Certificación (CA). |
| **Tipo de Proyecto** | Infraestructura Cloud, Seguridad de APIs, DevOps (DevSecOps). |
| **Complejidad** | **Media-Alta** (Requiere entender criptografía asimétrica y la cadena de confianza). |

---

## 2. Descripción y Filosofía de Diseño

El skill de **Seguridad de Capa de Transporte** se basa en la eliminación de la confianza ciega en la red. Se enfoca en el establecimiento de un canal cifrado donde la identidad del servidor (y opcionalmente del cliente) sea verificada criptográficamente por una **Certificate Authority (CA)** de confianza.

- **Modularidad:** Separación entre el motor de terminación TLS (Nginx, Traefik, ALB) y la lógica de negocio.
- **Idempotencia:** Procesos de renovación de certificados (vía ACME) que pueden ejecutarse repetidamente sin afectar la disponibilidad.
- **Reusabilidad:** Implementación de políticas de cifrado (*Cipher Suites*) estandarizadas para toda la organización.

## 2.1. Resiliencia y Observabilidad (Patrones Aplicables)

- **Flujo de Control:** Negociación automática de la versión más segura de TLS soportada; degradación controlada o denegación si no se cumplen los mínimos de seguridad.
- **Persistencia y Fallos:** Implementación de **OCSP Stapling** para verificar la validez del certificado incluso si la CA está temporalmente caída.
- **Trazabilidad:** Monitoreo de fechas de expiración y auditoría de protocolos utilizados mediante logs de terminación TLS.
- **Métricas de Éxito:** Latencia del *handshake* (priorizando 0-RTT en TLS 1.3) y cumplimiento del 100% de certificados válidos.

---

## 3. Requerimientos del Skill

## 3.1. Requerimientos Funcionales (RF)

- **[RF-01]:** Generación de **CSR (Certificate Signing Request)** y manejo de llaves privadas protegidas.
- **[RF-02]:** Configuración de servidores web para soportar protocolos modernos (TLS 1.2 y 1.3 exclusivamente).
- **[RF-03]:** Implementación de la **Cadena de Confianza**: Instalación correcta de certificados raíz, intermedios y de dominio.
- **[RF-04]:** Automatización de la renovación mediante protocolo **ACME** (Let's Encrypt).

## 3.2. Requerimientos No Funcionales (RNF)

- **[RNF-01] Seguridad:** Uso de llaves **RSA de 2048/4096 bits** o **ECC (Elliptic Curve Cryptography)** para mayor eficiencia.
- **[RNF-02] Rendimiento:** Optimización de la sesión TLS mediante *Session Resumption* para reducir la carga de CPU.
- **[RNF-03] Disponibilidad:** Renovación anticipada (ej. 30 días antes del vencimiento) para evitar interrupciones de servicio.

---

## 4. Criterios de Aceptación (Definition of Done)

1. **Validación Lógica:** El navegador/cliente muestra el "candado verde" y no hay advertencias de "Conexión no segura".
2. **Resiliencia:** El sistema se renueva automáticamente sin intervención humana y sin caídas de servicio.
3. **Calidad Técnica:** La calificación en **SSL Labs** (o herramientas similares) es de **A o A+**.
4. **Autonomía:** El usuario puede explicar la diferencia entre cifrado simétrico y asimétrico en el contexto del *handshake* TLS.

---

## 5. Ecosistema de Herramientas (Stack)

- **Herramienta Principal:** OpenSSL (Manipulación de certificados).
- **Librerías / Dependencias:** `Certbot` (Automatización), `Mkcert` (Certificados locales seguros).
- **Infraestructura:** Nginx, Apache, Cloudflare, AWS Certificate Manager (ACM).
- **Entorno de Ejecución:** Servidores Linux, Balanceadores de Carga, Terminal.

---

## 6. Metodología de Práctica (Paso a Paso)

## Fase 1: Entendimiento de la CA (Trust)
Visualizar cómo una CA firma un certificado para validar que "Tú eres quien dices ser".

## Fase 2: Generación y Firma
1. Generar una llave privada secreta.
2. Crear un CSR y enviarlo a la CA (o usar Let's Encrypt).
3. Validar el dominio (vía DNS o HTTP).

## Fase 3: Hardening de Servidor
Configurar el servidor para deshabilitar protocolos obsoletos (SSLv2, SSLv3, TLS 1.0, 1.1) y cifradores débiles (DES, RC4).

## Fase 4: Monitoreo y Renovación
Implementar un *cron job* o bot que avise 15 días antes si la renovación automática falló.

---

## 7. Antipatrones (Lo que NO se debe hacer)

- ⚠️ **[Antipatrón 1]:** Compartir la **Llave Privada** o subirla a repositorios de código (Git).
- ⚠️ **[Antipatrón 2]:** Usar certificados **Auto-firmados** en entornos de producción (Destruye la confianza del usuario).
- ⚠️ **[Antipatrón 3]:** Ignorar las advertencias de "Protocolo Obsoleto". TLS 1.0 y 1.1 ya no son seguros.
- ⚠️ **[Antipatrón 4]:** No incluir la cadena de certificados intermedios (Causa errores en dispositivos móviles).

---

## 8. Evaluación y KPIs

| **Métrica** | **Meta** |
| --- | --- |
| **Calificación SSL Labs** | A+ |
| **Handshake Time** | < 150ms |
| **Días para Vencimiento** | > 15 días siempre |
| **Uso de TLS 1.3** | > 80% del tráfico |

---

## 9. Recursos Adicionales

- [Mozilla SSL Configuration Generator](https://ssl-config.mozilla.org/)
- [Let's Encrypt - How It Works](https://letsencrypt.org/how-it-works/)
- [Qualys SSL Labs - Test Server](https://www.ssllabs.com/ssltest/)
