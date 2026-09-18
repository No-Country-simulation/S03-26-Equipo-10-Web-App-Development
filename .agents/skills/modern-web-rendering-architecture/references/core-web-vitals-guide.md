# Guía de Optimización: Core Web Vitals (2026)

Esta referencia detalla las métricas críticas para cumplir con el Skill **SKL-FE-ARCH-002**.

## 1. LCP (Largest Contentful Paint)
- **Meta:** < 2.5s.
- **Qué mide:** El tiempo que tarda en renderizarse el elemento más grande visible (usualmente una imagen o un encabezado H1).
- **Cómo optimizar:**
  - Prioriza la carga de imágenes críticas con `priority` en Next.js.
  - Elimina recursos que bloqueen el renderizado en el `<head>`.
  - Usa una CDN para reducir la latencia del primer byte (TTFB).

## 2. INP (Interaction to Next Paint)
- **Meta:** < 200ms.
- **Qué mide:** La capacidad de respuesta a las interacciones del usuario a lo largo de toda la visita. Sustituyó al FID.
- **Cómo optimizar:**
  - Evita bloquear el hilo principal con tareas pesadas de JavaScript.
  - Usa `web workers` para lógica compleja.
  - Rompe tareas largas en pequeñas partes (`yield to main thread`).

## 3. CLS (Cumulative Layout Shift)
- **Meta:** < 0.1.
- **Qué mide:** La estabilidad visual de la página. Evita que los elementos "salten" mientras cargan.
- **Cómo optimizar:**
  - Reserva espacio para imágenes y anuncios usando dimensiones fijas (`width` y `height`).
  - Evita insertar contenido encima del contenido existente dinámicamente.
  - Usa `font-display: swap` para evitar el parpadeo de fuentes (FOIT).

---

## Herramientas de Medición
- **Lighthouse:** Para auditorías en local.
- **PageSpeed Insights:** Para datos de campo reales (CrUX).
- **Vercel Analytics:** Para monitoreo en tiempo real de usuarios reales.
