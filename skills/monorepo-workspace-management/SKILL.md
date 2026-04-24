# Especificación técnica de habilidad: Configuración y Gestión de Monorepositorios Multipaquete

**Código de Skill:** SKL-PRO-001  
**Versión:** 1.1.0  
**Estándar:** ISO/IEC 26514 / IEEE 29148 / Agile DoD  

### 1. Ficha de Identificación del Skill

| Atributo | Definición Técnica |
| :--- | :--- |
| **Habilidad Principal** | Configuración y Gestión de Monorepositorios Multipaquete |
| **Objetivo de Dominio** | Capacitar al usuario para ejecutar, iterar y optimizar la orquestación de múltiples paquetes de software dentro de un único repositorio, garantizando eficiencia en el desarrollo (DX) y consistencia en las dependencias. |
| **Tipo de Proyecto** | Desarrollo de Software / Arquitectura de Sistemas |
| **Complejidad** | Media |

---

### 2. Descripción y Filosofía de Diseño
El skill de **Monorepositorios** se enfoca en la creación de soluciones basadas en la centralización de código fuente para proyectos interdependientes, bajo los siguientes principios:

* **Modularidad:** División de la lógica de negocio en paquetes desacoplados (e.g., `/backend`, `/frontend`, `/shared-ui`).
* **Idempotencia:** Garantizar que la ejecución de `npm install` en la raíz produzca un árbol de dependencias consistente y predecible en todos los paquetes.
* **Reusabilidad:** Facilitar el uso de componentes o tipos comunes sin duplicar código en el sistema de archivos.

#### 2.1. Resiliencia y Observabilidad (Patrones Aplicables)
Para garantizar que el monorepositorio sea robusto a largo plazo:
* **Flujo de Control:** Uso de scripts centralizados en el `package.json` raíz que orquestan el ciclo de vida de cada workspace mediante flags específicos (e.g., `--workspace`).
* **Trazabilidad:** Implementación de prefijos en los logs de salida para identificar de qué paquete proviene cada línea de ejecución en la terminal.
* **Métricas de Éxito:** Tiempo de inicialización del entorno (Build time) y duplicidad de dependencias (Bundle size).

---

### 3. Requerimientos del Skill

#### 3.1. Requerimientos Funcionales (RF)
* **[RF-01]:** El practicante debe ser capaz de inicializar un entorno base mediante la definición de la propiedad `workspaces` en el manifiesto raíz.
* **[RF-02]:** El sistema debe permitir la ejecución concurrente o selectiva de scripts (build, dev, test) para paquetes específicos desde el directorio raíz.
* **[RF-03]:** Debe generar una estructura de `node_modules` unificada (hoisting) compatible con los estándares de la industria (npm/pnpm).

#### 3.2. Requerimientos No Funcionales (RNF)
* **[RNF-01] Escalabilidad:** La arquitectura debe permitir la adición de nuevos paquetes (servicios, librerías) sin degradar el rendimiento de la instalación de dependencias.
* **[RNF-02] Mantenibilidad:** El proceso de configuración debe ser entendible por un nuevo desarrollador en menos de **10 min**.
* **[RNF-03] Seguridad:** Evitar la fuga de secretos compartiendo archivos `.env` globales; cada workspace debe manejar su propia configuración sensible.

---

### 4. Criterios de Aceptación (Definition of Done)
Se considera que el dominio es completo si:
1.  **Validación Lógica:** El comando `npm install` en la raíz instala todas las dependencias de los subpaquetes exitosamente.
2.  **Resiliencia:** El sistema maneja fallos de compilación en un paquete sin detener el proceso de los demás (en ejecución paralela controlada).
3.  **Calidad Técnica:** Los scripts raíz están estandarizados (e.g., `npm run dev:backend`).
4.  **Autonomía:** El usuario replica la estructura desde cero y levanta un sistema Fullstack funcional en menos de **5 min**.

---

### 5. Ecosistema de Herramientas (Stack)
* **Herramienta Principal:** npm (v7+) / pnpm / Yarn Workspaces.
* **Librerías / Dependencias:** `concurrently` (para ejecución paralela), `turbo` o `nx` (opcionales para optimización de caché).
* **Entorno de Ejecución:** Terminal / VS Code.

---

### 6. Metodología de Práctica (Paso a Paso)

1.  **Fase de Setup:** Creación del `package.json` raíz e inclusión de la propiedad `"workspaces": ["apps/*", "packages/*"]`.
2.  **Fase de Construcción:** Migración de proyectos existentes a sus respectivas subcarpetas y unificación de dependencias comunes.
3.  **Fase de Refactor:** Implementación de scripts orquestadores en la raíz:
    > `"dev:back": "npm run watch --workspace=backend"`
4.  **Fase de QA:** Verificación de que no existan `node_modules` redundantes dentro de las subcarpetas que puedan causar conflictos de versión.

---

### 7. Antipatrones (Lo que NO se debe hacer)
* ⚠️ **[Antipatrón 1]:** Instalación manual de dependencias dentro de cada subcarpeta (rompe la unificación del monorepo).
* ⚠️ **[Antipatrón 2]:** Acoplamiento circular (el paquete A depende del B y el B del A).
* ⚠️ **[Antipatrón 3]:** Ignorar el archivo `.gitignore` raíz, subiendo archivos temporales de todos los paquetes al repositorio.

---

### 8. Evaluación y KPIs

| Métrica | Meta |
| :--- | :--- |
| **Tasa de Error en Build** | < 5% |
| **Tiempo de Setup Inicial** | < 15 minutos |
| **Cumplimiento de RF** | 100% |

---

### 9. Recursos Adicionales
* [Documentación Oficial de npm Workspaces](https://docs.npmjs.com/cli/v7/using-npm/workspaces)
* [Análisis de midudev sobre Monorepos](https://www.youtube.com/watch?v=T0VlcnJ9r5A)
