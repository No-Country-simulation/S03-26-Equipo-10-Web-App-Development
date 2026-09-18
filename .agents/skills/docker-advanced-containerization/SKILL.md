# Especificación Técnica de Habilidad: Docker (Containerización Avanzada)

**Código de Skill:** SKL-PRO-002

**Versión:** 1.1.0

**Estándar:** ISO/IEC 26514 / IEEE 29148 / Agile DoD

---

## 1. Ficha de Identificación del Skill

| **Atributo** | **Definición Técnica** |
| --- | --- |
| **Habilidad Principal** | **Docker y Orquestación de Contenedores** |
| **Objetivo de Dominio** | Capacitar al usuario para diseñar, construir y asegurar artefactos de software inmutables, optimizando la cadena de suministro y la eficiencia de recursos. |
| **Tipo de Proyecto** | Arquitectura Cloud-Native / DevOps / Microservicios. |
| **Complejidad** | **Alta** (Enfoque en Seguridad y Optimización extrema). |

---

## 2. Descripción y Filosofía de Diseño

El skill de **Docker** se aleja del simple empaquetado para centrarse en la **Inmutabilidad** y el **Ciclo de Vida Efímero**. Se fundamenta en los principios de *Cloud-Native 12-Factor App*: tratar los contenedores como unidades de ejecución sin estado y de responsabilidad única.

## 2.1. Resiliencia y Observabilidad (Patrones Aplicables)

Para que un stack de Docker sea robusto en 2026, debe implementar:

- **Flujo de Control:** Uso de `HEALTHCHECK` para que el orquestador sepa cuándo aplicar un *Restart* o *Retry*.
- **Trazabilidad:** Implementación de **Structured Logging** (JSON) hacia `stdout/stderr` y el uso de **Labels** estandarizadas para metadatos.
- **Confiabilidad:** **Graceful Shutdown** mediante el manejo correcto de señales `SIGTERM` para permitir el cierre de conexiones activas.
- **Persistencia:** Uso estricto de **Named Volumes** para asegurar la consistencia de datos ante fallos del contenedor.

---

## 3. Requerimientos del Skill

## 3.1. Requerimientos Funcionales (RF)

- **[RF-01]:** Capacidad de crear entornos aislados y reproducibles mediante Docker Compose.
- **[RF-02]:** Implementación de **Multi-Stage Builds** para reducir el tamaño de imagen y separar dependencias de desarrollo de las de runtime.
- **[RF-03]:** Gestión de secretos mediante montajes en memoria o proveedores externos, evitando variables `ENV` para datos sensibles.
- **[RF-04]:** Orquestación local de múltiples servicios con redes personalizadas aisladas.

## 3.2. Requerimientos No Funcionales (RNF)

- **[RNF-01] Seguridad:** Las imágenes finales deben ser **Distroless** o basadas en Alpine, ejecutándose siempre como usuario `nonroot`.
- **[RNF-02] Eficiencia:** El tamaño de la imagen final debe estar optimizado (eliminación de caché de gestores de paquetes, sin capas innecesarias).
- **[RNF-03] Disponibilidad:** Definición de límites de recursos (`deploy.resources.limits`) para evitar que un contenedor agote el host.

---

## 4. Criterios de Aceptación (Definition of Done)

1. **Validación Lógica:** El contenedor inicia, responde a peticiones y se comunica con sus dependencias en redes aisladas.
2. **Resiliencia:** El contenedor sobrevive a un reinicio del motor de Docker y gestiona el cierre limpio de procesos.
3. **Calidad Técnica:** El Dockerfile pasa el análisis de **Hadolint** sin advertencias críticas y el escaneo de **Trivy** no arroja CVEs de nivel "High" o "Critical".
4. **Autonomía:** El usuario puede desplegar un stack completo de microservicios con balanceador de carga en menos de 10 minutos.

---

## 5. Ecosistema de Herramientas (Stack)

| **Categoría** | **Herramienta** | **Función** |
| --- | --- | --- |
| **Motor Principal** | Docker Engine / Buildx | Core y construcción multiplataforma. |
| **Seguridad** | Trivy / Grype | Escaneo de vulnerabilidades en imágenes. |
| **Optimización** | Dive | Inspección de capas para reducción de tamaño. |
| **Calidad** | Hadolint | Linter para mejores prácticas de Dockerfile. |
| **Gestión** | Lazydocker | Dashboard interactivo en terminal. |

---

## 6. Metodología de Práctica (Paso a Paso)

1. **Fase de Setup:** Instalación de Docker Desktop/Engine e integración de `Buildx` y `Hadolint` en el IDE.
2. **Fase de Construcción:** Desarrollo de un Dockerfile multi-etapa. Ejemplo: Etapa de compilación con SDK pesado y etapa de runtime con Distroless.
3. **Fase de Refactor:** Aplicación de seguridad (cambio a usuario `nonroot`) y optimización de capas (unión de comandos `RUN` y limpieza de caché).
4. **Fase de QA:** Ejecución de `docker scan` y pruebas de carga limitando CPU/RAM.

---

## 7. Antipatrones (Lo que NO se debe hacer)

- ⚠️ **[Antipatrón 1]:** Usar el tag `:latest` en producción (rompe la idempotencia y reproducibilidad).
- ⚠️ **[Antipatrón 2]:** Instalar SSH o múltiples servicios en un solo contenedor (rompe el Principio de Responsabilidad Única).
- ⚠️ **[Antipatrón 3]:** Almacenar datos persistentes dentro de la capa de escritura del contenedor (pérdida de datos garantizada).
- ⚠️ **[Antipatrón 4]:** Ejecutar procesos como `root` por conveniencia.

---

## 8. Evaluación y KPIs

| **Métrica** | **Meta** |
| --- | --- |
| **Tamaño de Imagen** | < 200MB (para la mayoría de apps de lenguaje interpretado) |
| **Vulnerabilidades Críticas** | 0 |
| **Tiempo de Build (Cacheado)** | < 30 segundos |
| **Uso de Memoria en Idle** | Optimizado según el runtime (ej. Node.js < 50MB) |

---

## 9. Recursos Adicionales

- [Docker Documentation - Best Practices](https://docs.docker.com/develop/develop-images/dockerfile_best-practices/)
- [Google Container Tools - Distroless](https://github.com/GoogleContainerTools/distroless)
- [Hadolint Rules Library](https://github.com/hadolint/hadolint#rules)
