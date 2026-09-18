# La Pirámide de Testing: Estrategia de Inversión

Esta referencia detalla cómo distribuir los esfuerzos de automatización para maximizar la calidad y minimizar los costos (Skill **SKL-QA-001**).

## 1. Unit Tests (Base de la Pirámide)
- **Cantidad:** Muchos.
- **Velocidad:** Muy rápidos (milisegundos).
- **Costo:** Bajo.
- **Objetivo:** Validar lógica pequeña y aislada (funciones, clases).

## 2. Integration Tests (Capa Media)
- **Cantidad:** Algunos.
- **Velocidad:** Medios (segundos).
- **Costo:** Medio.
- **Objetivo:** Validar que dos o más componentes funcionan juntos (ej: API + Base de Datos).

## 3. E2E Tests (Cúspide de la Pirámide)
- **Cantidad:** Pocos (solo flujos críticos).
- **Velocidad:** Lentos (segundos/minutos).
- **Costo:** Alto.
- **Objetivo:** Validar la aplicación completa desde el punto de vista del usuario (ej: Login -> Dashboard -> Checkout).

---

## El "Cono de Helado" (Antipatrón)
Ocurre cuando tienes muchas pruebas E2E y pocas pruebas unitarias. Esto hace que la suite sea:
- Difícil de mantener.
- Muy lenta.
- Inestable (Flaky tests).

**Regla de Oro:** Si puedes probar algo con un Unit Test, no uses un Integration Test. Si puedes probarlo con un Integration Test, no uses un E2E Test.
