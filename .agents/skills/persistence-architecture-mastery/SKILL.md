# Especificación técnica de habilidad: Arquitectura de Persistencia Desacoplada

---

**Código de Skill:** SKL-ARCH-DB-001  
**Versión:** 1.1.0  
**Estándar:** ISO/IEC 26514 / IEEE 29148 / Agile DoD  

---

## 1. Ficha de Identificación del Skill
| Atributo | Definición Técnica |
| :--- | :--- |
| **Habilidad Principal** | Arquitectura de Persistencia Desacoplada (ORM, Migraciones y Seeds). |
| **Objetivo de Dominio** | Capacitar al usuario para diseñar, implementar y evolucionar capas de datos robustas, garantizando la integridad, trazabilidad y el desacoplamiento de la lógica de negocio del mecanismo de persistencia. |
| **Tipo de Proyecto** | Desarrollo de Software / Arquitectura de Backend. |
| **Complejidad** | **Alta** |

---

## 2. Descripción y Filosofía de Diseño
El skill de persistencia se enfoca en la creación de soluciones basadas en el **patrón de repositorio y la evolución controlada del esquema**, bajo los siguientes principios:

* **Modularidad:** Capas de persistencia desacopladas de las entidades de dominio mediante interfaces.
* **Idempotencia:** Scripts de migración y seeding que pueden ejecutarse repetidamente sin alterar el estado final deseado o duplicar datos.
* **Reusabilidad:** Lógica de acceso a datos genérica que minimiza el código repetitivo (*boilerplate*).

### 2.1. Resiliencia y Observabilidad (Patrones Aplicables)
Dependiendo del contexto de la persistencia, se deben integrar los siguientes mecanismos:

* **Flujo de Control:** Implementación de *Connection Pooling* y *Retry Logic* con *Exponential Backoff* en fallos transitorios.
* **Persistencia y Fallos:** **Transactional Outbox Pattern** para asegurar que los eventos de dominio se disparen solo si la transacción en la DB fue exitosa.
* **Trazabilidad:** Inclusión de metadatos en migraciones y uso de *Structured Logging* para auditar cambios en el esquema.
* **Métricas de Éxito:** Monitoreo del tiempo de respuesta de consultas (P99) y tasa de errores de conexión.

---

## 3. Requerimientos del Skill

### 3.1. Requerimientos Funcionales (RF)
* **[RF-01]:** Inicializar un entorno de persistencia con soporte para versiones de esquema (ej. Prisma en Node.js o Alembic en Python).
* **[RF-02]:** Definir entidades de dominio puras que luego se mapean al ORM (Data Mapper Pattern) para evitar que la lógica de negocio dependa del motor de DB.
* **[RF-03]:** Generar un esquema (DDL) consistente con los estándares de normalización (3NF) o desnormalización estratégica según el caso de uso.

### 3.2. Requerimientos No Funcionales (RNF)
* **[RNF-01] Escalabilidad:** La capa de datos debe soportar *Connection Pooling* para manejar picos de tráfico eficientemente.
* **[RNF-02] Mantenibilidad:** Cualquier cambio en el esquema debe ser reversible (*Rollback*) de forma controlada.
* **[RNF-03] Seguridad:** Aplicación de validación de esquemas y sanitización automática de queries (prevención de SQLi).
* **[RNF-04] Disponibilidad:** Uso de migraciones que minimicen el bloqueo de tablas para evitar *downtime* en producción.

---

## 4. Criterios de Aceptación (Definition of Done)
Se considera que el dominio es completo si:

* **Validación Lógica:** El esquema en la DB refleja fielmente las definiciones del código y cumple con los RF.
* **Resiliencia:** El sistema maneja fallos de conexión mediante reintentos sin bloquear los hilos principales de ejecución.
* **Calidad Técnica:** Los seeds son deterministas, idempotentes y no dependen de IDs manuales.
* **Autonomía:** Se puede recrear la base de datos completa (Reset, Migrate, Seed) de forma 100% automatizada.

---

## 5. Ecosistema de Herramientas (Stack)
* **Herramienta Principal:** Prisma (Node.js) / SQLAlchemy (Python).
* **Base de Datos:** PostgreSQL (Preferido) / MySQL.
* **Librerías Auxiliares:** Zod/Pydantic (Validación), Faker (Generación de datos para seeds).
* **Entorno:** Docker para contenedores de base de datos.

---

## 6. Metodología de Práctica (Paso a Paso)

1.  **Fase de Setup:** Configuración del motor de DB y gestor de migraciones. Gestión de secretos mediante variables de entorno.
2.  **Fase de Construcción:**
    * Implementación de modelos y esquemas.
    * Creación de interfaces para el patrón **Repository**.
    * Generación y aplicación de migraciones.
    * Escritura de **Seeds** idempotentes para datos maestros.
3.  **Fase de Refactor:** Aplicación del patrón **Unit of Work** para gestionar transacciones atómicas complejas.
4.  **Fase de QA:** Verificación de integridad mediante tests de integración utilizando contenedores (Testcontainers o similar).

---

## 7. Antipatrones (Lo que NO se debe hacer)
* ⚠️ **[Antipatrón 1]:** Mezclar lógica de negocio pesada dentro de los modelos del ORM (Active Record excesivo).
* ⚠️ **[Antipatrón 2]:** Realizar cambios manuales en la base de datos (vía consola o UI) ignorando el sistema de migraciones.
* ⚠️ **[Antipatrón 3]:** Seeds que fallan si se ejecutan por segunda vez o que dependen de un orden específico frágil.
* ⚠️ **[Antipatrón 4]:** Ignorar el problema de $N+1$ por no utilizar *Eager Loading* o uniones de tablas adecuadas.

---

## 8. Evaluación y KPIs
| Métrica | Meta |
| :--- | :--- |
| **Tasa de Error en Migraciones** | < 1% en CI/CD |
| **Tiempo de Entrega de Schema** | < 1 hora (incluyendo documentación y tests) |
| **Integridad de Datos** | 100% de cumplimiento de constraints en DB |

---

## 9. Recursos Adicionales
* [Patterns of Enterprise Application Architecture (Martin Fowler)]
* [Clean Architecture - Robert C. Martin]
* [Prisma Documentation - Production Checklist](https://www.prisma.io/docs/guides/other/production-checklist)
