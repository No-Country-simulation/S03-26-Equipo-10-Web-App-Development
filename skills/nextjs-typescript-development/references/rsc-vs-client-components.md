# RSC vs Client Components: ¿Cuándo usar cada uno?

Esta referencia detalla los criterios de decisión para el renderizado híbrido en Next.js (Skill **SKL-JS-002**).

## React Server Components (RSC) - Por Defecto

Los RSC se ejecutan exclusivamente en el servidor y no envían JavaScript al cliente.

### Cuándo usarlos:
- Fetching de datos (acceso directo a DB o APIs).
- Mantener secretos y API keys protegidos.
- Renderizar componentes pesados que no necesitan interactividad.
- Mejorar el SEO y el rendimiento (LCP).

---

## Client Components (`'use client'`)

Los Client Components se hidratan en el navegador y permiten interactividad.

### Cuándo usarlos:
- Interactividad (onClick, onChange, etc.).
- Uso de Hooks de React (`useState`, `useEffect`, `useContext`).
- Uso de Browser APIs (`window`, `localStorage`, `geolocation`).
- Componentes que dependen de librerías de cliente (ej: Framer Motion).

---

## Estrategia Recomendada: "Mover el Cliente a las Hojas"

Para optimizar el rendimiento, mantén la mayoría de la aplicación como **Server Components** y usa **Client Components** solo para las "hojas" del árbol de componentes (ej: botones, formularios interactivos, carruseles).

| Característica | Server Component | Client Component |
| --- | --- | --- |
| Fetching de datos | ✅ Recomendado | ❌ Evitar |
| Acceso a DB/Secretos | ✅ Seguro | ❌ Prohibido |
| Interactividad | ❌ No disponible | ✅ Sí |
| Tamaño de JS enviado | 0 bytes | Variable |
