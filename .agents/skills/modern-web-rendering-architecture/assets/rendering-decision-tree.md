# Árbol de Decisión: Estrategias de Renderizado
# Skill: SKL-FE-ARCH-002

Para elegir la mejor estrategia de renderizado, sigue este flujo lógico:

1. **¿El contenido es privado (detrás de un login)?**
   - **SÍ:** Usa **CSR** (Client-Side Rendering) con un esqueleto de carga. El cliente consume la API de **NestJS** directamente o vía un Proxy en Next.js.
   - **NO:** Pasa a la siguiente pregunta.

2. **¿Los datos cambian en cada petición (ej: Dashboard en tiempo real)?**
   - **SÍ:** Usa **SSR** o **Streaming RSC**. Next.js solicita los datos a NestJS en tiempo de renderizado.
   - **NO:** Pasa a la siguiente pregunta.

3. **¿La cantidad de páginas es finita y conocida (ej: blog de 100 posts)?**
   - **SÍ:** Usa **SSG** (Static Site Generation).
   - **NO:** Pasa a la siguiente pregunta.

4. **¿Los datos cambian ocasionalmente (ej: catálogo de miles de productos)?**
   - **SÍ:** Usa **ISR** (Incremental Static Regeneration).
   - **NO:** Reevalúa la volatilidad de los datos.

---

## Matriz de Resumen

| Estrategia | Tiempo de Build | TTFB | Frescura de Datos | SEO |
| --- | --- | --- | --- | --- |
| **CSR** | Rápido | Instantáneo | Alta (vía API) | Pobre |
| **SSR** | Rápido | Lento | Máxima | Excelente |
| **SSG** | Lento | Instantáneo | Baja | Excelente |
| **ISR** | Medio | Instantáneo | Media-Alta | Excelente |
