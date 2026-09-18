---
name: javascript-typescript-engineering
description: >-
  Diseño, generación, revisión y refactorización de código JavaScript y TypeScript profesional (código SKL-JSTS-PRO-001). Usar cuando se requiera escribir TypeScript estricto, modelado de tipos con discriminated unions, validación de fronteras en runtime con Zod, control de flujo con guard clauses y early returns, concurrencia acotada (p-limit, streams, Promise.all vs allSettled), Event Loop no bloqueante, manejo robusto de errores con cause, logging estructurado y hardening OWASP.
---

# Especificación Técnica de Habilidad: Professional JavaScript & TypeScript Engineering

---

**Código de Skill:** SKL-JSTS-PRO-001  
**Nombre:** Professional JavaScript & TypeScript Engineering  
**Versión:** 1.0.0  
**Estándar:** ISO/IEC 26514 / IEEE 29148 / Clean Code / SOLID / OWASP / Agile Definition of Done  
**Nivel:** Intermedio-Avanzado / Senior  
**Dominio:** Ingeniería de Software / Backend / Frontend / Node.js / TypeScript  

---

## 1. Ficha de Identificación del Skill

| Atributo | Definición Técnica |
| :--- | :--- |
| **Habilidad Principal** | Diseño, generación, revisión y refactorización de código JavaScript y TypeScript profesional. |
| **Objetivo de Dominio** | Capacitar al sistema para producir soluciones elegantes, concisas, seguras, eficientes, mantenibles y preparadas para producción utilizando JavaScript y TypeScript. |
| **Lenguajes Objetivo** | JavaScript ES2022+ / TypeScript 5+ |
| **Entornos Principales** | Node.js, APIs REST, servicios backend, aplicaciones web, workers, procesamiento de datos. |
| **Tipo de Proyecto** | Desarrollo de Software / Backend / Frontend / APIs / Sistemas Distribuidos. |
| **Complejidad** | Alta. |
| **Nivel Esperado de Código** | Producción / Senior. |
| **Paradigmas** | Programación funcional, orientación a objetos pragmática, composición, programación asíncrona, arquitectura modular. |
| **Prioridad Técnica** | Correctitud → Seguridad → Legibilidad → Mantenibilidad → Rendimiento → Concisión. |

---

## 2. Descripción y Filosofía de Diseño

El Skill se especializa en escribir JavaScript y TypeScript siguiendo estándares profesionales de ingeniería de software. Su objetivo no es producir simplemente código que funcione, sino código que pueda ser leído, modificado, probado, monitorizado y operado por otros desarrolladores dentro de un sistema real.

> **Filosofía fundamental:** El mejor código no es el más corto ni el más sofisticado, sino aquel cuya intención es evidente, cuyo comportamiento es predecible y cuyo coste de mantenimiento es mínimo.

El Skill priorizará las siguientes propiedades:
- **Claridad:** La intención del código debe comprenderse sin necesidad de reconstruir mentalmente múltiples niveles de control de flujo.
- **Simplicidad:** Elegir la solución técnicamente más simple que resuelva correctamente el problema, evitando abstracciones prematuras.
- **Tipado fuerte:** TypeScript será utilizado como mecanismo de diseño y seguridad, no simplemente como JavaScript con anotaciones.
- **Composición:** Priorizar funciones pequeñas, módulos cohesivos y componentes componibles frente a funciones monolíticas.
- **Seguridad:** Todo dato proveniente del exterior será considerado no confiable hasta ser validado.
- **Eficiencia:** Las decisiones sobre concurrencia, memoria, CPU y operaciones I/O deberán considerar explícitamente el modelo de ejecución de JavaScript.
- **Observabilidad:** Los errores, operaciones relevantes y fallos externos deben poder reconstruirse mediante logs, métricas y contexto operacional.
- **Mantenibilidad:** Se optimizará principalmente para el desarrollador que tendrá que modificar el código dentro de seis meses.

### 2.1. Jerarquía de Decisiones
Cuando existan varias implementaciones válidas, priorizar en este orden:
```text
1. Correctitud
2. Seguridad
3. Legibilidad
4. Simplicidad
5. Mantenibilidad
6. Observabilidad
7. Rendimiento
8. Concisión
9. Sofisticación arquitectónica
```
*Nunca deberá sacrificarse claridad únicamente para reducir líneas de código.*

### 2.2. Principios Arquitectónicos
El código producido deberá satisfacer:
- **SRP (Single Responsibility):** Una unidad de código debe tener una responsabilidad predominante.
- **OCP (Open/Closed):** Nuevos comportamientos deberían poder incorporarse sin modificar grandes bloques condicionales existentes.
- **LSP (Liskov Substitution):** Implementaciones intercambiables deben respetar el contrato esperado.
- **ISP (Interface Segregation):** Evitar interfaces excesivamente grandes; segregar por uso.
- **DIP (Dependency Inversion):** La lógica de negocio dependerá de abstracciones o contratos ante dependencias externas significativas.
- **DRY (Don't Repeat Yourself):** Evitar duplicación significativa de conocimiento.
- **KISS (Keep It Simple):** Evitar complejidad accidental.
- **YAGNI (You Aren't Gonna Need It):** No introducir infraestructura o abstracciones sin necesidad actual demostrable.

### 2.3. Resiliencia y Observabilidad
El Skill tratará errores y estados inesperados como parte normal del diseño del sistema:
- Timeouts y cancelaciones (`AbortSignal`).
- Reintentos exponenciales con jitter e idempotencia.
- Límites de concurrencia y circuit breakers.
- Degradación controlada (*graceful degradation*).
- Tipificación clara de errores (infraestructura, dominio, validación, programación).
- Logging estructurado, correlation IDs y métricas.

---

## 3. Requerimientos del Skill

### 3.1. Requerimientos Funcionales: Control de Flujo y Código Limpio

#### [RF-01] Generación de Código Limpio
El código debe estructurarse con: responsabilidades delimitadas, funciones pequeñas y cohesivas, nombres descriptivos, mínima duplicación, control de flujo simple y dependencias explícitas.

#### [RF-02] Reducción de Anidamiento (Guard Clauses y Early Returns)
Priorizar guard clauses y retornos tempranos para aplanar la complejidad ciclomática:

```typescript
// ❌ MALO: Pirámide de anidamiento difícil de leer
function processOrder(order: Order): void {
  if (order) {
    if (order.user) {
      if (order.items.length > 0) {
        if (order.status === 'pending') {
          executeOrder(order);
        }
      }
    }
  }
}

// ✅ BUENO: Retornos tempranos (Guard Clauses)
function processOrder(order: Order): void {
  if (!order.user) return;
  if (order.items.length === 0) return;
  if (order.status !== 'pending') return;

  executeOrder(order);
}
```
*Motivo:* Reduce la complejidad ciclomática y expone inmediatamente las precondiciones de ejecución.

#### [RF-03] Eliminación de Condicionales Repetitivos (Dispatch Maps)
Cuando una condición represente selección de comportamiento, evaluar el uso de diccionarios o *dispatch maps*:

```typescript
// ❌ MALO: Cascada de if/else difícil de extender
function calculateFee(type: string, amount: number): number {
  if (type === 'standard') return amount * 0.05;
  if (type === 'premium') return amount * 0.02;
  if (type === 'enterprise') return amount * 0.01;
  throw new Error('Unsupported account type');
}

// ✅ BUENO: Dispatch Map explícito y extensible
type AccountType = 'standard' | 'premium' | 'enterprise';

const feeByAccount: Record<AccountType, number> = {
  standard: 0.05,
  premium: 0.02,
  enterprise: 0.01,
};

function calculateFee(type: AccountType, amount: number): number {
  return amount * feeByAccount[type];
}
```
*Motivo:* Convierte comportamiento implícito en configuración explícita y elimina ramas innecesarias.

---

### 3.2. Tipado Fuerte y Explícito

#### [RF-04] Modo Estricto Obligatorio
Todo proyecto TypeScript debe asumir:
```json
{
  "compilerOptions": {
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "exactOptionalPropertyTypes": true
  }
}
```
*No desactivar reglas estrictas simplemente para hacer compilar código mal modelado.*

#### [RF-05] Prohibición Práctica de `any`
`any` debe considerarse una vía de escape excepcional y prohibida en código de dominio:

```typescript
// ❌ MALO: Se anula el type-checking
function getUserEmail(user: any) {
  return user.profile.email;
}

// ✅ BUENO: Tipado formal explícito
interface UserProfile {
  readonly email: string;
}

interface User {
  readonly profile: UserProfile;
}

function getUserEmail(user: User): string {
  return user.profile.email;
}
```

#### [RF-06] Uso Correcto de `unknown` y Type Narrowing
`unknown` debe utilizarse cuando el tipo realmente sea desconocido en los bordes del sistema, exigiendo validación antes de su uso:

```typescript
// ❌ MALO: Casteo forzado sin comprobar
function processValue(value: unknown) {
  return (value as string).toUpperCase();
}

// ✅ BUENO: Type narrowing defensivo
function processValue(value: unknown): string {
  if (typeof value !== 'string') {
    throw new TypeError('Expected a string');
  }
  return value.toUpperCase();
}
```

#### [RF-07] Validación en Bordes del Sistema (Runtime Validation)
Todo dato proveniente de APIs, archivos, colas, bases de datos no controladas o variables de entorno **es no confiable**:

```typescript
// ❌ MALO: Confianza ciega en un casteo de TypeScript (inútil en runtime)
const response = await fetch('/api/user/1');
const user = (await response.json()) as User;
return user.email;

// ✅ BUENO: Validación en tiempo de ejecución con Zod
import { z } from 'zod';

const UserSchema = z.object({
  id: z.string().uuid(),
  email: z.string().email(),
});

type User = z.infer<typeof UserSchema>;

async function getUser(id: string): Promise<User> {
  const response = await fetch(`/api/users/${id}`);
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }
  const payload: unknown = await response.json();
  return UserSchema.parse(payload);
}
```

#### [RF-08] Modelado Mediante Tipos Semánticos y Discriminated Unions
Favorecer tipos que hagan **imposibles de representar los estados inválidos**:

```typescript
// ✅ Modelado seguro mediante Discriminated Unions
type Payment =
  | {
      readonly status: 'pending';
      readonly paymentId: string;
    }
  | {
      readonly status: 'completed';
      readonly paymentId: string;
      readonly transactionId: string;
    }
  | {
      readonly status: 'failed';
      readonly paymentId: string;
      readonly reason: string;
    };
```

#### [RF-09] Genéricos con Propósito Real
Los genéricos deben representar relaciones estructurales reales entre tipos, nunca utilizarse para enmascarar casteos inseguros:

```typescript
// ❌ MALO: Casteo inseguro encubierto
function transform<T, U>(value: T): U {
  return value as unknown as U;
}

// ✅ BUENO: Relación tipo-retorno verificada
function first<T>(values: readonly T[]): T | undefined {
  return values[0];
}
```

---

### 3.3. Programación Síncrona y Asíncrona

#### [RF-10] Distinguir CPU-Bound e I/O-Bound
- **I/O-Bound:** HTTP, filesystem, base de datos, Redis, colas, sockets.  
  *Estrategia:* APIs asíncronas no bloqueantes, connection pools, timeouts y concurrencia controlada.
- **CPU-Bound:** Procesamiento de imágenes, compresión, hashing criptográfico pesado, parsing masivo de JSONs gigantes.  
  *Estrategia:* Worker Threads, worker pools dedicados o servicios externos.

#### [RF-11] Evitar Secuencialidad Accidental

```typescript
// ❌ MALO: Peticiones secuenciales innecesarias (acumula latencias)
const user = await getUser();
const products = await getProducts();
const configuration = await getConfiguration();

// ✅ BUENO: Peticiones concurrentes en paralelo
const [user, products, configuration] = await Promise.all([
  getUser(),
  getProducts(),
  getConfiguration(),
]);
```

#### [RF-12] Selección Correcta de Estrategia de Promesas
- `Promise.all`: Cuando todas las operaciones deben completarse exitosamente y el fallo de una anula el conjunto (*fail-fast*).
- `Promise.allSettled`: Cuando deben obtenerse resultados parciales aunque algunas operaciones fallen individualmente.
- Secuencial con bucle `for...of`: Cuando el paso $N+1$ dependa estrictamente del resultado del paso $N$.

#### [RF-13] Concurrencia Limitada (`p-limit`)
`Promise.all` no debe ejecutarse sobre colecciones no acotadas:

```typescript
// ❌ RIESGOSO: Saturación de sockets, memoria y rate-limits
await Promise.all(millionUsers.map(user => sendEmail(user)));

// ✅ BUENO: Concurrencia acotada con p-limit
import pLimit from 'p-limit';

const limit = pLimit(10); // Máximo 10 simultáneas

await Promise.all(
  users.map(user => limit(() => sendEmail(user))),
);
```

#### [RF-14] Streams para Grandes Volúmenes de Datos

```typescript
// ❌ MALO: Carga de archivos gigantes en memoria RAM
const content = await fs.promises.readFile('10gb.log', 'utf8');

// ✅ BUENO: Procesamiento incremental línea a línea con Streams
import { createReadStream } from 'node:fs';
import { createInterface } from 'node:readline';

async function processLog(path: string): Promise<void> {
  const stream = createReadStream(path);
  const lines = createInterface({ input: stream, crlfDelay: Infinity });

  for await (const line of lines) {
    processLine(line);
  }
}
```

#### [RF-15] Gestión de Contrapresión (Backpressure)
Utilizar `pipeline` de `node:stream/promises` para coordinar flujos productor-consumidor garantizando el drenado adecuado de buffers:
```typescript
import { pipeline } from 'node:stream/promises';

await pipeline(sourceStream, transformStream, destinationStream);
```

---

### 3.4. Eficiencia y Uso de Recursos

#### [RF-16] Protección del Event Loop
No ejecutar operaciones CPU-bound prolongadas en el hilo principal de JavaScript:
```typescript
// ❌ MALO: Congela el Event Loop para todos los clientes
app.get('/report', (_req, res) => {
  const report = generateHugeReport();
  res.json(report);
});

// ✅ BUENO: Delegación en Worker Pool
const report = await workerPool.execute({
  operation: 'generate-report',
  payload,
});
```

#### [RF-17] Worker Threads
Utilizar `worker_threads` para cálculos intensivos en CPU, nunca para I/O tradicional. Reutilizar hilos mediante pools de workers pre-inicializados.

#### [RF-18] Gestión Eficiente de Memoria
Evitar cachés en memoria ilimitadas (`new Map()`), fugas por event listeners no eliminados y copias innecesarias de arrays grandes. Usar siempre límites máximos, TTL y algoritmos LRU.

#### [RF-19] Análisis de Complejidad Algorítmica

```typescript
// ❌ MALO: Complejidad cuadrática O(users × permissions)
for (const user of users) {
  const permission = permissions.find(p => p.userId === user.id);
}

// ✅ BUENO: Complejidad lineal O(users + permissions) mediante Map
const permissionsByUser = new Map(
  permissions.map(p => [p.userId, p]),
);

for (const user of users) {
  const permission = permissionsByUser.get(user.id);
}
```

---

### 3.5. Profesionalismo en Operaciones y Monitoreo

#### [RF-20] Logging Estructurado (JSON)
No utilizar `console.log` en producción:
```typescript
// ❌ MALO: String plano sin estructura ni correlación
console.log(`Error processing payment ${paymentId}: ${error}`);

// ✅ BUENO: Log estructurado JSON con contexto operacional
logger.error(
  {
    err: error,
    paymentId,
    userId,
    requestId,
  },
  'Payment processing failed',
);
```

#### [RF-21] Niveles Semánticos de Logging
- `trace`: Diagnóstico paso a paso extremadamente detallado.
- `debug`: Información contextual durante desarrollo.
- `info`: Hitos normales relevantes del ciclo de negocio.
- `warn`: Situaciones anómalas recuperables automáticamente.
- `error`: Operación fallida que requiere atención o investigación.
- `fatal`: Fallo crítico que impide la continuidad del proceso.

#### [RF-22] Protección de Información Sensible
**Nunca registrar en logs:** contraseñas, tokens de sesión o acceso, claves privadas, números de tarjetas de crédito completos o información personal identificable (PII).

#### [RF-23] Jerarquía de Errores Tipados
```typescript
export class AppError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly statusCode: number,
    options?: ErrorOptions,
  ) {
    super(message, options);
    this.name = new.target.name;
  }
}

export class NotFoundError extends AppError {
  constructor(resource: string) {
    super(`${resource} not found`, 'RESOURCE_NOT_FOUND', 404);
  }
}
```

#### [RF-24] Preservar la Causa Original del Error (`Error.cause`)

```typescript
// ❌ MALO: Destruye el stack trace y contexto original
try {
  await repository.save(user);
} catch {
  throw new Error('Database failed');
}

// ✅ BUENO: Error wrapping preservando la causa
try {
  await repository.save(user);
} catch (error) {
  throw new Error(`Failed to persist user ${user.id}`, { cause: error });
}
```

#### [RF-25] No Capturar Errores sin Propósito
Evitar bloques `try/catch` vacíos o que simplemente relanzan el error sin añadir valor:
```typescript
// ❌ ANTIPATRÓN: Catch pasamanos inútil
try {
  await operation();
} catch (error) {
  throw error;
}
```

---

### 3.6. Código Limpio y Mantenible

#### [RF-26] Nomenclatura Expresiva
Los nombres deben expresar intención: `retryCount`, `userRepository`, `calculateTotalPrice`, `isAuthenticated`.  
*Evitar nombres crípticos: `x`, `tmp`, `data2`, `obj`, `stuff`, `handleThing`.*

#### [RF-27] Funciones con Propósito Único
Una función debe tener un único nivel de abstracción y no mezclar persistencia, logging, notificaciones y cálculos en un bloque monolítico.

#### [RF-28] Inmutabilidad por Defecto
Favorecer `const`, `readonly`, `ReadonlyArray` y estructuras inmutables para evitar efectos secundarios ocultos:
```typescript
interface User {
  readonly id: string;
  readonly email: string;
}

function calculateTotal(items: readonly CartItem[]): number {
  return items.reduce((total, item) => total + item.price, 0);
}
```

#### [RF-29] Organización Modular Adaptativa
Organizar el código en módulos cohesivos adaptados al tamaño real del sistema, sin imponer arquitecturas empresariales ceremoniales a proyectos pequeños.

---

### 3.7. SOLID Aplicado a JavaScript / TypeScript

#### [RF-30] Single Responsibility Principle (SRP)
Separar responsabilidades por dominio: `UserService`, `EmailService`, `ReportService`, `StorageService`.

#### [RF-31] Dependency Inversion Principle (DIP)
Depender de contratos o interfaces para desacoplar la lógica de dominio de los detalles de infraestructura:
```typescript
interface UserRepository {
  findById(id: string): Promise<User | null>;
}

class UserService {
  constructor(private readonly users: UserRepository) {}
}
```

---

### 3.8. Seguridad

#### [RF-32] Prevención de Inyecciones SQL
Utilizar siempre consultas parametrizadas o prepared statements:
```typescript
// ❌ CRÍTICO: Vulnerable a SQL Injection
const query = `SELECT * FROM users WHERE email = '${email}'`;

// ✅ SEGURO: Consulta parametrizada
const result = await db.query('SELECT * FROM users WHERE email = $1', [email]);
```

#### [RF-33] Prevención de Cross-Site Scripting (XSS)
Nunca insertar datos externos no confiables directamente mediante `innerHTML`:
```typescript
// ❌ VULNERABLE:
element.innerHTML = userInput;

// ✅ SEGURO:
element.textContent = userInput;
```

#### [RF-34] Gestión Segura de Secretos
Los secretos deben inyectarse mediante variables de entorno o gestores de secretos. **Nunca almacenar claves en texto plano en el código.**

#### [RF-35] Diferenciación entre Autenticación y Autorización
- **AuthN:** ¿Quién es el usuario?
- **AuthZ:** ¿Tiene permiso para ejecutar esta acción sobre este recurso específico?  
*Una ruta autenticada no debe considerarse automáticamente autorizada.*

---

## 4. Requerimientos No Funcionales

- **[RNF-01] Legibilidad:** El código debe comprenderse por sus nombres, estructura y tipos sin depender de comentarios que narren lo evidente.
- **[RNF-02] Mantenibilidad:** Decisiones propensas a cambios deben permanecer desacopladas de las reglas centrales de negocio.
- **[RNF-03] Seguridad:** Todo input externo es hostil por defecto.
- **[RNF-04] Rendimiento:** Prohibida la micro-optimización prematura sin mediciones reales del Event Loop, CPU y memoria.
- **[RNF-05] Testabilidad:** La lógica de negocio debe poder probarse de forma aislada sin levantar bases de datos ni redes reales.
- **[RNF-06] Observabilidad:** Las operaciones deben incluir contexto operacional (`requestId`, `traceId`, `userId`, `duration`).
- **[RNF-07] Compatibilidad:** Respetar la versión de Node.js, `tsconfig` y el sistema de módulos (ESM/CJS) del proyecto.

---

## 5. Criterios de Aceptación — Definition of Done (DoD)

Una implementación se considera **Production-Ready** cuando cumple:

1. **Correctitud:** El comportamiento solicitado está resuelto; edge cases cubiertos; 0 errores de compilación TypeScript.
2. **Tipado:** Compatible con modo `strict`; 0 `any` injustificados; contratos externos validados en runtime.
3. **Código:** Control de flujo plano sin anidamientos innecesarios; funciones con responsabilidad única.
4. **Asincronía:** Concurrencia acotada; Event Loop libre de bloqueos CPU-bound; recursos y listeners liberados.
5. **Errores:** Errores tipados con semántica clara; causa original preservada con `cause`; cero bloques `catch` vacíos.
6. **Seguridad:** Consultas SQL parametrizadas; HTML externo sanitizado; cero secretos en código o logs; AuthN y AuthZ diferenciadas.
7. **Observabilidad:** Logs estructurados en JSON con contexto; cero datos sensibles en telemetría.
8. **Calidad de Entrega:** Pasa exitosamente `typecheck`, `lint` y suite de `tests`.

---

## 6. Ecosistema de Herramientas Recomendado

| Categoría | Herramientas Primarias |
| :--- | :--- |
| **Lenguaje & Runtime** | TypeScript 5+, JavaScript ES2022+, Node.js LTS. |
| **Calidad & Formato** | TypeScript Compiler (`tsc`), ESLint, Biome, Prettier. |
| **Validación Runtime** | Zod, Valibot, ArkType. |
| **Logging** | Pino, Winston. |
| **Testing** | Vitest, Jest, `node:test`. |
| **Seguridad** | `npm audit`, Dependabot, Snyk, Semgrep. |
| **Concurrencia & Streams** | `p-limit`, `node:stream/promises`, `node:worker_threads`. |

---

## 7. Metodología de Práctica en 11 Fases

1. **Fase 1 — Comprender el dominio:** Identificar entradas, salidas, reglas, efectos secundarios y errores previstos.
2. **Fase 2 — Modelar los tipos:** Definir entidades, contratos y discriminated unions para imposibilitar estados inválidos.
3. **Fase 3 — Diseñar límites de confianza:** Identificar bordes de red, archivos o colas y aplicar validación runtime.
4. **Fase 4 — Implementar el happy path:** Construir primero el flujo principal de manera simple y directa.
5. **Fase 5 — Aplanar control de flujo:** Sustituir condicionales anidados con guard clauses y dispatch maps.
6. **Fase 6 — Revisar asincronía:** Evitar secuencialidad accidental y acotar la concurrencia en colecciones.
7. **Fase 7 — Revisar CPU y memoria:** Clasificar I/O vs CPU; aplicar streams ante grandes volúmenes.
8. **Fase 8 — Diseñar errores:** Modelar errores tipados preservando la causalidad original.
9. **Fase 9 — Añadir observabilidad:** Incorporar logs estructurados con identificadores de correlación.
10. **Fase 10 — Revisión de seguridad:** Auditar inyecciones SQL, XSS, secretos, serialización y autorización.
11. **Fase 11 — Refactor final:** Eliminar comentarios obvios, código muerto y abstracciones prematuras.

---

## 8. Protocolo de Generación de Código

### 8.1. Regla de Concisión
El código elegante **no es code golf**. Evitar expresiones ternarias incomprensibles encadenadas si reducen la legibilidad. Preferir claridad de intención.

### 8.2. Convención de Comentarios
No comentar lo que una línea evidente ya expresa (`count++`). Comentar exclusivamente **decisiones técnicas, restricciones, compensaciones o comportamientos no evidentes**:
```typescript
// Stripe puede entregar el mismo webhook más de una vez.
// Persistimos el ID del evento para garantizar idempotencia.
if (await processedEvents.exists(event.id)) {
  return;
}
```

### 8.3. Criterio de Abstracciones
Crear abstracciones únicamente ante duplicación demostrada, comportamiento intercambiable justificado o necesidad de aislamiento para testing.

---

## 9. Catálogo de Antipatrones Críticos

| Código | Antipatrón | Riesgo e Impacto |
| :--- | :--- | :--- |
| ⚠️ **ANTI-01** | `any` como solución rápida | Desactiva el sistema de tipos de TypeScript. |
| ⚠️ **ANTI-02** | Casteo (`as Type`) para silenciar errores | Da una falsa sensación de tipado que revienta en runtime. |
| ⚠️ **ANTI-03** | Nested Hell (Pirámide de `if`) | Complejidad ciclomática inmanejable. |
| ⚠️ **ANTI-04** | `await` dentro de bucles innecesarios | Serialización accidental que degrada el rendimiento. |
| ⚠️ **ANTI-05** | `Promise.all` ilimitado | Agotamiento de sockets, memoria y saturación de APIs. |
| ⚠️ **ANTI-06** | Datasets masivos en memoria RAM | Out-Of-Memory inevitable; usar streams. |
| ⚠️ **ANTI-07** | CPU pesada en el Event Loop | Bloqueo general del servidor para todos los clientes. |
| ⚠️ **ANTI-08** | `console.log` en producción | Ceguera operativa sin estructura JSON ni niveles. |
| ⚠️ **ANTI-09** | `catch` que destruye información | Pérdida irrecuperable de la causa del fallo. |
| ⚠️ **ANTI-10** | God Classes / God Functions | Monolitos con demasiadas razones para cambiar. |
| ⚠️ **ANTI-11** | Patrones de diseño por ritual | Complejidad accidental sin problema real que resolver. |
| ⚠️ **ANTI-12** | SQL dinámico concatenado | Brecha crítica de SQL Injection. |
| ⚠️ **ANTI-13** | `innerHTML` con entrada externa | Brecha crítica de Cross-Site Scripting (XSS). |
| ⚠️ **ANTI-14** | Secretos en código o logs | Filtración de credenciales en repositorios y telemetría. |
| ⚠️ **ANTI-15** | Optimización prematura | Código críptico sin evidencia de un cuello de botella real. |

---

## 10. Indicadores Clave de Desempeño (KPIs)

| Métrica de Calidad | Meta en Producción |
| :--- | :--- |
| **Errores de compilación TypeScript** | **0** |
| **Uso injustificado de `any`** | **0** |
| **Casteos forzados inseguros evitables** | **0** |
| **Entradas externas no validadas en runtime** | **0** |
| **Vulnerabilidades críticas conocidas (OWASP)** | **0** |
| **Consultas SQL vulnerables a inyección** | **0** |
| **Secretos expuestos en código o logs** | **0** |
| **Errores capturados silenciosamente** | **0** |
| **Operaciones CPU-bound críticas en el Event Loop** | **0** |
| **Cumplimiento de reglas de linting y formateo** | **100%** |
| **Pruebas automatizadas críticas aprobadas** | **100%** |
| **Operaciones relevantes con trazabilidad estructurada** | **100%** |

---

## 11. Heurísticas de Revisión Senior

Antes de aprobar una implementación, responder mentalmente:
1. **Diseño:** ¿Es esta la solución más simple y correcta? ¿Existe alguna abstracción innecesaria?
2. **Tipado:** ¿TypeScript imposibilita estados incorrectos? ¿Hay algún `any` o casteo forzado? ¿Se validan datos externos?
3. **Asincronía:** ¿Hay operaciones independientes corriendo secuencialmente? ¿La concurrencia está acotada?
4. **Recursos:** ¿Cuánto puede crecer este array en memoria? ¿Puede usarse streaming? ¿La caché tiene límites?
5. **Errores:** ¿El error contiene contexto suficiente? ¿Se preservó la causa original con `cause`?
6. **Seguridad:** ¿Hay datos externos concatenados en SQL o HTML? ¿La autorización está comprobada?

---

## 12. Cheat Sheet — Las 15 Reglas Esenciales

1. **TypeScript estricto siempre:** Mantener `strict: true` sin desactivar comprobaciones.
2. **`any` es excepcional:** Modelar el tipo explícitamente o usar `unknown` con type narrowing.
3. **Validar todo dato externo:** TypeScript no valida JSON, APIs ni variables de entorno en runtime.
4. **Hacer inválidos los estados inválidos:** Usar discriminated unions y tipos semánticos.
5. **Usar guard clauses:** Mantener el happy path visible y eliminar el anidamiento.
6. **Composición sobre condicionales:** Reemplazar switch/ifs extensos por dispatch maps o polimorfismo.
7. **No serializar I/O innecesariamente:** Ejecutar tareas independientes en paralelo (`Promise.all`).
8. **Controlar la concurrencia:** `Promise.all` no es infinito; usar `p-limit` para grandes volúmenes.
9. **Usar streams para datos masivos:** Procesar incrementalmente en lugar de saturar la RAM.
10. **Mantener libre el Event Loop:** Delegar tareas intensivas de CPU a Worker Threads.
11. **Loggear contexto, no frases:** Usar logs estructurados en JSON con correlación.
12. **Los errores son arquitectura:** Crear errores tipados y preservar siempre `cause`.
13. **SOLID pragmático:** Diseñar abstracciones cuando desacoplen dependencias reales, no por dogma.
14. **Nunca confiar en input externo:** Parametrizar SQL, sanitizar contenido y comprobar autorización.
15. **Optimizar para mantenimiento:** El código evidente y claro siempre supera al código corto pero críptico.

---

## 13. Resultado Esperado de la Skill

Una implementación producida bajo **SKL-JSTS-PRO-001** es:
```text
Simple
Typed
Explicit
Composable
Testable
Observable
Secure
Efficient
Maintainable
Production-ready
```

> **Criterio Rector:** Diseñar la solución más simple que preserve correctamente los invariantes del dominio, haga explícitos sus contratos, controle sus efectos secundarios y continúe siendo comprensible cuando el sistema crezca.
