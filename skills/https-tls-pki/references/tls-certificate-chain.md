# La Cadena de Confianza (Certificate Chain)

Esta referencia explica cómo se establece la confianza en una conexión TLS (Skill **SKL-NET-003**).

## 1. El Certificado Raíz (Root CA)
- Es el ancla de confianza.
- Está pre-instalado en los navegadores y sistemas operativos.
- Se auto-firma a sí mismo.

## 2. El Certificado Intermedio (Intermediate CA)
- Firmado por la Root CA.
- Actúa como un búfer de seguridad; si se compromete, la Root CA puede revocarlo sin afectar a toda la jerarquía.
- Es el que firma los certificados finales de dominio.

## 3. El Certificado de Entidad Final (End-Entity / Domain)
- Firmado por la Intermediate CA.
- Contiene tu nombre de dominio (CN) o Subject Alternative Names (SAN).

---

## Por qué es importante el "Full Chain"
Muchos errores de conexión en dispositivos móviles ocurren porque el servidor solo envía su certificado final, olvidando el intermedio. El cliente no puede vincular tu certificado con la Root CA y lanza un error de "Certificado no confiable".

**Regla de Oro:** Siempre configura tu servidor para usar el archivo `fullchain.pem` (o equivalente) que incluye tanto tu certificado como los intermedios.
