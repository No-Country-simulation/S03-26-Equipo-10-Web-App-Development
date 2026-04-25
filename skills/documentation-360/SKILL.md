# Especificación Técnica de Habilidad: Documentación Técnica 360°

**Código de Skill:** SKL-DOC-001

**Versión:** 1.1.0

**Estándar:** ISO/IEC 26514 / IEEE 29148 / Agile DoD

---

## 1. Ficha de Identificación del Skill

| **Atributo** | **Definición Técnica** |
| --- | --- |
| **Habilidad Principal** | **Documentación Técnica y Narrativa de Arquitectura** |
| **Objetivo de Dominio** | Capacitar al usuario para comunicar la arquitectura, decisiones y operación de un sistema mediante estándares de documentación en código y Markdown, facilitando el onboarding y la transferencia de conocimiento. |
| **Tipo de Proyecto** | Auditoría de Software / Portafolios Profesionales / Onboarding Técnico. |
| **Complejidad** | **Media** (Requiere balancear síntesis, precisión y empatía con el lector). |

---

## 2. Descripción y Filosofía de Diseño

El skill de **Documentación 360°** se aleja de la escritura pasiva. Se enfoca en la **Documentación como Código (DaC)**, donde la explicación del sistema es tan modular y versionable como el software mismo. Su filosofía es la **Accesibilidad Multicapa**:

- **Capa Ejecutiva (Recrutadores/Managers):** El "Qué" y el "Por qué" (Valor, tecnologías, decisiones).
- **Capa Técnica (Devs/DevOps):** El "Cómo" (Instalación, API, diagramas, lógica interna).

## 2.1. Resiliencia y Observabilidad de la Doc (Patrones Aplicables)

- **Trazabilidad:** Uso de **ADR (Architectural Decision Records)** para documentar por qué se eligió una tecnología sobre otra, evitando el "conocimiento perdido".
- **Visualización:** Empleo de **Mermaid.js** para diagramas que viven en el repo y se actualizan con el código (Flowcharts, Sequence, Entity-Relationship).
- **Consistencia:** Aplicación de **JSDoc/TSDoc** para que la documentación del código sea extraíble y auto-generada.
- **Métricas de Éxito:** Tiempo de Onboarding (¿Cuánto tarda un dev nuevo en levantar el proyecto?).

---

## 3. Requerimientos del Skill

## 3.1. Requerimientos Funcionales (RF)

- **[RF-01]:** Crear un `README.md` de alto impacto que incluya: Stack tecnológico con versiones, instrucciones de ejecución y descripción del problema resuelto.
- **[RF-02]:** Implementar comentarios de código descriptivos (¿Por qué se hizo esto?) y documentación de interfaz (Parámetros, Retornos, Excepciones).
- **[RF-03]:** Diseñar diagramas de flujo y arquitectura utilizando sintaxis **Mermaid**.
- **[RF-04]:** Redactar una sección de "Decisiones Técnicas" justificando el uso de librerías y metodologías (ej. TDD, Clean Architecture).

## 3.2. Requerimientos No Funcionales (RNF)

- **[RNF-01] Mantenibilidad:** La documentación debe ser modular; cambios en un componente solo deben requerir cambios en su sección correspondiente.
- **[RNF-02] Legibilidad:** Uso de formato Markdown avanzado (Tablas, Listas, Code Blocks con resaltado de sintaxis).
- **[RNF-03] Estándar Visual:** Coherencia en la nomenclatura y estructura de carpetas de documentación.

---

## 4. Criterios de Aceptación (Definition of Done)

1. **Validación Lógica:** Un usuario externo puede levantar el proyecto siguiendo *únicamente* las instrucciones del `README.md`.
2. **Claridad Narrativa:** El documento explica claramente la jerarquía de carpetas y el flujo de datos principal.
3. **Calidad Visual:** Los diagramas Mermaid son legibles y representan fielmente la realidad del código.
4. **Autonomía:** El reclutador entiende el alcance y valor del proyecto en los primeros 30 segundos de lectura.

---

## 5. Ecosistema de Herramientas (Stack)

- **Lenguaje de Marcado:** Markdown (GitHub Flavored).
- **Visualización:** Mermaid.js (Diagramas de secuencia, clases y estados).
- **Doc-in-Code:** JSDoc (JavaScript), TSDoc (TypeScript), Docstrings (Python).
- **Generadores de Sitios (Opcional):** Docusaurus, VitePress o GitHub Wiki.
- **Linter de Prosa:** Markdownlint.

---

## 6. Metodología de Práctica (Paso a Paso)

## Fase 1: Setup de la Narrativa (Executive Summary)

Escribir el encabezado del proyecto, el stack tecnológico con versiones (ej. `Node.js v20.x`, `PostgreSQL 16`) y el objetivo del negocio. Esto es lo que lee el reclutador.

## Fase 2: Construcción de la Arquitectura Visual

Crear diagramas en Mermaid dentro del Markdown.

- *Diagrama de Arquitectura:* Para entender los componentes.
- *Diagrama de Entidad-Relación:* Para entender los datos.

## Fase 3: Documentación de la Lógica (Deep Dive)

Insertar comentarios en el código que expliquen la complejidad no evidente. No documentar lo obvio (ej. `x = x + 1`), sino la decisión (ej. `// Se aplica Exponential Backoff para mitigar límites de API externa`).

## Fase 4: QA de Ejecución (The Manual)

Proporcionar comandos claros:

```bash
# Instalación
npm install
# Ejecución en modo dev
npm run dev
```

---

## 7. Antipatrones (Lo que NO se debe hacer)

- ⚠️ **[Antipatrón 1]:** Comentarios que explican el "Qué" pero no el "Por qué".
- ⚠️ **[Antipatrón 2]:** Documentación desactualizada (Doc Drift). Es mejor no documentar algo que dejar información falsa.
- ⚠️ **[Antipatrón 3]:** "Muros de texto" sin imágenes o diagramas. Los reclutadores escanean, no leen párrafos densos.
- ⚠️ **[Antipatrón 4]:** No incluir capturas de pantalla o GIFs si el proyecto tiene interfaz visual.

---

## 8. Evaluación y KPIs

| **Métrica** | **Meta** |
| --- | --- |
| **Tiempo de Setup** | < 5 minutos para un dev nuevo |
| **Índice de Claridad** | Comprensión total por personal no técnico del objetivo del proyecto |
| **Cobertura de ADRs** | Al menos 3 decisiones clave justificadas técnica y económicamente |

---

## 9. Recursos Adicionales

- [Documenting Software Architectures (SEI)](https://www.google.com/search?q=https://resources.sei.cmu.edu/library/asset-view.cfm%3Fassetid%3D513880)
- [Mermaid.js Official Live Editor](https://mermaid.live/)
- [Keep a Changelog](https://keepachangelog.com/en/1.0.0/)
