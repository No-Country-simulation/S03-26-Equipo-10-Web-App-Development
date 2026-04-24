# Especificación técnica de habilidad: metodologías de testing y calidad de código

**Código de Skill:** SKL-QA-001

**Versión:** 1.1.0

**Estándar:** ISO/IEC 25010 (Calidad de Software) / ISO/IEC 26514 / Agile DoD

---

## 1. Ficha de Identificación del Skill

| **Atributo** | **Definición Técnica** |
| --- | --- |
| **Habilidad Principal** | **Ingeniería de Calidad Integral (Full-Cycle Testing)** |
| **Objetivo de Dominio** | Capacitar al usuario para implementar una estrategia de calidad de 360°, desde el análisis estático hasta pruebas E2E, asegurando un código mantenible y libre de regresiones. |
| **Tipo de Proyecto** | Ciclo de Vida de Desarrollo de Software (SDLC) / CI/CD Pipelines. |
| **Complejidad** | **Alta** (Requiere balancear velocidad de entrega con rigor técnico). |

---

## 2. Descripción y Filosofía de Diseño

El skill de **Testing y Calidad** se basa en la premisa de que **"la calidad no se inspecciona, se construye"**. Se prioriza la detección temprana de errores (Shift-Left) y se utiliza la **Pirámide de Testing** para optimizar el retorno de inversión (ROI) de los esfuerzos de automatización.

- **Modularidad:** Pruebas unitarias aisladas mediante el uso de Mocks y Stubs.
- **Idempotencia:** Los tests deben ser deterministas; ejecutarlos 100 veces debe dar el mismo resultado si el código no cambia (evitar *Flaky Tests*).
- **Reusabilidad:** Creación de *Page Object Models* (POM) y *Factories* de datos para pruebas compartidas.

## 2.1. Resiliencia y Observabilidad (Patrones Aplicables)

- **Flujo de Control:** Implementación de **Retry Logic** solo para pruebas E2E inestables y gestión de timeouts.
- **Trazabilidad:** Integración de reportes de cobertura (Codecov/LCOV) y logs detallados en fallos de CI.
- **Confiabilidad:** Uso de **Mutation Testing** para evaluar la efectividad de los tests actuales (¿realmente el test detecta cambios en la lógica?).
- **Métricas de Calidad:** Monitoreo de la "Deuda Técnica" y el "Defect Leakage Rate".

---

## 3. Requerimientos del Skill

## 3.1. Requerimientos Funcionales (RF)

- **[RF-01]:** Configurar linters y formateadores automáticos (ESLint, Prettier, Sonar) para asegurar un estándar visual y sintáctico.
- **[RF-02]:** Implementar pruebas unitarias que cubran el 100% de la lógica de negocio crítica.
- **[RF-03]:** Desarrollar pruebas de integración que validen la comunicación entre módulos y servicios externos (APIs/DB).
- **[RF-04]:** Automatizar pruebas de extremo a extremo (E2E) para los flujos de usuario más importantes (Happy Paths).

## 3.2. Requerimientos No Funcionales (RNF)

- **[RNF-01] Velocidad:** La suite de pruebas unitarias debe ejecutarse en menos de 2 minutos para no bloquear el flujo del desarrollador.
- **[RNF-02] Aislamiento:** Las pruebas no deben depender de estados externos no controlados (usar contenedores efímeros para DB).
- **[RNF-03] Mantenibilidad:** El código de test debe ser tan limpio como el código de producción (evitar *spaghetti testing*).

---

## 4. Criterios de Aceptación (Definition of Done)

1. **Validación Lógica:** El 100% de los casos de uso definidos tienen al menos una prueba automatizada asociada.
2. **Umbral de Cobertura:** El reporte de cobertura indica un mínimo de 80% en líneas de código y 90% en lógica crítica.
3. **Calidad Estática:** El análisis de SonarQube o similar indica "0 Code Smells" y "0 Vulnerabilidades Críticas".
4. **Autonomía:** El pipeline de CI detiene automáticamente cualquier despliegue si una sola prueba falla o la calidad disminuye.

---

## 5. Ecosistema de Herramientas (Stack)

- **Análisis Estático:** ESLint, SonarCloud, Husky (Git Hooks).
- **Unit & Integration:** Jest, Vitest, JUnit o PyTest (según lenguaje).
- **E2E Testing:** Playwright (Recomendado 2026), Cypress o Selenium.
- **Performance:** k6 o JMeter.
- **CI/CD:** GitHub Actions, GitLab CI o Jenkins.

---

## 6. Metodología de Práctica (Paso a Paso)

1. **Fase de Setup:** Configurar Git Hooks con Husky para impedir commits que no pasen el linter o tests unitarios locales.
2. **Fase de Construcción:** Adoptar **TDD (Test Driven Development)**: escribir la prueba, verla fallar, escribir el código mínimo para que pase, y refactorizar.
3. **Fase de Refactor:** Implementar pruebas de integración para asegurar que los módulos refactorizados siguen "hablando" el mismo idioma.
4. **Fase de QA:** Ejecutar pruebas de regresión automatizadas en el pipeline antes de cada merge a `main`.

---

## 7. Antipatrones (Lo que NO se debe hacer)

- ⚠️ **[Antipatrón 1]:** Tratar de alcanzar el 100% de cobertura testeando getters/setters o código trivial (pérdida de tiempo).
- ⚠️ **[Antipatrón 2]:** Depender excesivamente de pruebas E2E (son lentas, costosas y difíciles de mantener).
- ⚠️ **[Antipatrón 3]:** Ignorar los tests "flaky" (que a veces pasan y a veces fallan). Esto destruye la confianza en el sistema.
- ⚠️ **[Antipatrón 4]:** Testear detalles de implementación en lugar de comportamientos. Si cambias el nombre de una variable y el test falla, el test está mal diseñado.

---

## 8. Evaluación y KPIs

| **Métrica** | **Meta** |
| --- | --- |
| **Code Coverage** | > 80% General |
| **Defect Leakage Rate** | < 5% (Errores que llegan a Prod) |
| **Build Success Rate** | > 95% |
| **Time to Test** | < 10 min en CI (Total) |

---

## 9. Recursos Adicionales

- [Google Testing Blog - The Testing Pyramid](https://testing.googleblog.com/2015/04/just-say-no-to-more-end-to-end-tests.html)
- [Clean Code por Robert C. Martin (Capítulo de Testing)](https://www.oreilly.com/library/view/clean-code-a/9780136083238/)
- [OWASP Testing Guide for Security](https://owasp.org/www-project-web-security-testing-guide/)
