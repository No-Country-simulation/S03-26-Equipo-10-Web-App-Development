# Especificación Técnica de Habilidad: Modelado y Diagramación de Sistemas

**Código de Skill:** SKL-ARC-002 | **Versión:** 1.1.0

**Estándar:** ISO/IEC 26514 / IEEE 29148 / UML 2.5 / C4 Model

---

## 1. Ficha de Identificación del Skill

| **Atributo** | **Definición Técnica** |
| --- | --- |
| **Habilidad Principal** | **Modelado Visual y Arquitectura de Perspectivas** |
| **Objetivo de Dominio** | Capacitar al usuario para abstraer la complejidad de un sistema en representaciones visuales estandarizadas, permitiendo la comunicación efectiva entre diferentes perfiles (negocio, desarrollo, infraestructura). |
| **Tipo de Proyecto** | Diseño de Sistemas / Documentación Técnica / Auditoría de Arquitectura. |
| **Complejidad** | **Media-Alta** (Requiere entender diferentes niveles de abstracción). |

---

## 2. Descripción y Filosofía de Diseño

El skill de **Diagramación** se basa en la premisa de que **"una arquitectura que no se puede dibujar, no se puede construir"**. Se enfoca en el uso de lenguajes visuales para reducir la carga cognitiva y asegurar que todos los miembros del equipo compartan el mismo modelo mental del proyecto.

## 2.1. Perspectivas del Modelado

Un proyecto debe verse desde cuatro ángulos críticos para considerarse bien documentado:

1. **Perspectiva de Negocio (Contexto):** ¿Cómo encaja el sistema en el mundo? (Diagramas de Contexto C4).
2. **Perspectiva Funcional (Lógica):** ¿Cómo fluye la información? (Diagramas de Secuencia, Actividad).
3. **Perspectiva de Datos (Estructura):** ¿Cómo se organiza el conocimiento? (ERD - Entidad Relación).
4. **Perspectiva de Despliegue (Infraestructura):** ¿Dónde vive el código? (Diagramas de Despliegue, Nube).

## 2.2. Resiliencia y Observabilidad Documental

- **Idempotencia:** Los diagramas deben ser generados a partir de texto (**Mermaid/PlantUML**) para que la salida sea consistente y versionable en Git.
- **Trazabilidad:** Cada componente en un diagrama de arquitectura debe mapearse a un repositorio o módulo real en el código.
- **Métricas de Éxito:** Reducción en el tiempo de resolución de dudas técnicas y velocidad de onboarding de nuevos desarrolladores.

---

## 3. Requerimientos del Skill

## 3.1. Requerimientos Funcionales (RF)

- **[RF-01]:** Identificar el nivel de abstracción necesario según el interlocutor (Senior Dev vs Product Owner).
- **[RF-02]:** Representar flujos asíncronos y síncronos mediante **Diagramas de Secuencia**.
- **[RF-03]:** Modelar la persistencia de datos mediante **Diagramas de Clase** o **ERD**.
- **[RF-04]:** Documentar la topología de red y servicios mediante **Diagramas de Contenedores (C4 Level 2)**.

## 3.2. Requerimientos No Funcionales (RNF)

- **[RNF-01] Mantenibilidad:** Uso de herramientas de "Diagram as Code" para evitar que el diagrama quede obsoleto respecto al código.
- **[RNF-02] Estandarización:** Uso de simbología estándar (UML para lógica, C4 para arquitectura) para evitar ambigüedades.
- **[RNF-03] Legibilidad:** Un diagrama no debe tener más de 15-20 elementos principales para evitar la saturación visual.

---

## 4. Criterios de Aceptación (Definition of Done)

1. **Validación Lógica:** El diagrama refleja fielmente el comportamiento del código actual (Consistencia).
2. **Multiperspectiva:** El proyecto cuenta al menos con un diagrama de Contexto (Negocio), uno de Secuencia (Lógica) y uno de Datos (Estructura).
3. **Calidad Técnica:** Los diagramas están integrados en el `README.md` del proyecto mediante bloques de código Mermaid.
4. **Autonomía:** Un perfil no técnico puede explicar qué hace el sistema mirando el diagrama de Contexto.

---

## 5. Ecosistema de Herramientas (Stack)

- **Generación por Código:** Mermaid.js (Preferido por integración en GitHub/GitLab), PlantUML.
- **Arquitectura de Alto Nivel:** C4 Model (Estructura jerárquica).
- **Herramientas de Diseño Rápido:** Excalidraw (Bocetos), Draw.io (Diagramas formales).
- **Entorno de Ejecución:** Visual Studio Code con extensiones de Mermaid/UML.

---

## 6. Metodología de Práctica (Paso a Paso)

## Fase 1: Definición del Alcance (Nivel 1 C4)

Dibujar el sistema como una "caja negra" y sus interacciones con usuarios y otros sistemas.

- *Objetivo:* Alineación con Stakeholders y Reclutadores.

## Fase 2: Modelado de Flujo (Secuencia y Actividad)

Documentar un caso de uso crítico (ej. el proceso de Login o una Compra).

- *Objetivo:* Claridad para desarrolladores sobre el orden de ejecución y manejo de errores.

## Fase 3: Estructuración de Datos (ERD)

Definir tablas, llaves primarias, foráneas y cardinalidad.

- *Objetivo:* Base sólida para el equipo de Backend y DBA.

## Fase 4: Refactor y Sincronización

Revisar si los diagramas siguen vigentes tras un cambio en el código y actualizar el archivo `.mmd` (Mermaid) correspondiente.

---

## 7. Antipatrones (Lo que NO se debe hacer)

- ⚠️ **[Antipatrón 1] El "Mapa del Tesoro":** Hacer un único diagrama gigante que intenta explicar todo (Ininteligible).
- ⚠️ **[Antipatrón 2] Diagramas de Fantasía:** Dibujar arquitecturas que no existen o que el equipo no planea construir (Vaporware).
- ⚠️ **[Antipatrón 3] Ignorar Estándares:** Usar flechas y colores sin una leyenda o significado claro (Ambigüedad).
- ⚠️ **[Antipatrón 4] Documentación Muerta:** Usar imágenes `.png` que nadie puede editar porque se perdió el archivo original.

---

## 8. Evaluación y KPIs

| **Métrica** | **Meta** |
| --- | --- |
| **Tiempo de Comprensión** | < 2 min para entender el flujo principal |
| **Ratio Doc/Código** | Al menos 1 diagrama por cada módulo crítico |
| **Precisión Técnica** | 0 discrepancias entre el ERD y el esquema de DB |

---

## 9. Recursos Adicionales

- [C4 Model Official Site](https://c4model.com/)
- [Mermaid.js Documentation](https://mermaid.js.org/)
- [UML Distilled por Martin Fowler](https://martinfowler.com/books/uml.html)
