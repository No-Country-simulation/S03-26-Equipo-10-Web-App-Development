---
name: react-interface-engineering
description: >-
  Implementación y revisión de interfaces React 18.3 del Testimonial CMS (SKL-REACT-UI-001). Usar para composición, render puro, estado local, Effects que sincronizan sistemas externos, formularios, accesibilidad y pruebas de comportamiento; distinguir React Compiler y React 19 como adopciones futuras.
---

# SKL-REACT-UI-001 — Interfaces React

## Propósito y fuentes

Esta skill guía componentes y hooks de `apps/web`. Leer `AGENTS.md`, `llm.txt`, el plan HITL activo, la ruta y el feature afectado. Para App Router y fronteras Server/Client, consultar [Next.js Frontend](../nextjs-frontend-engineering/SKILL.md); para estilo y heurísticas de interacción, usar sus skills específicas cuando el trabajo lo requiera.

| Estado | Regla |
| --- | --- |
| **Vigente** | React 18.3.1, Next.js 15.5, TypeScript estricto, Radix, React Hook Form, Zod, Vitest y Testing Library. |
| **Vigente** | Rutas admin activas componen pantallas cliente que usan `useSession` y adaptadores HTTP a NestJS. |
| **Opción contextual** | `useReducer`, Context, React Hook Form, memoización, Error Boundary o biblioteca de caché solo según complejidad real. |
| **Migración futura** | React 19 y React Compiler; el compilador requiere instalación/configuración explícita, y React 18 necesita runtime/target compatibles. |

## Frontera de responsabilidades

- React representa estado de UI, interacción y presentación.
- NestJS valida credenciales, tenant, roles, reglas de negocio y persistencia.
- Una bandera `isAdmin` permite adaptar la UI, pero no concede acceso al endpoint.
- No duplicar el lifecycle de testimonios en un reducer o componente como autoridad.
- Las respuestas de red se adaptan y validan en `features/<feature>/api.ts` y utilidades HTTP existentes.
- La sesión vigente se recupera con `apps/web/src/hooks/use-session.ts`; no crear un segundo almacén de tokens.

## Render puro

Un render debe calcular JSX a partir de props y estado sin mutar objetos externos, iniciar requests, tocar el DOM o emitir logs sensibles. React puede renderizar de nuevo o descartar un render; un efecto de negocio dentro del cuerpo puede repetirse inesperadamente.

```tsx
type Testimonial = { id: string; content: string; status: string };

function VisibleCount({ items }: { items: Testimonial[] }) {
  const published = items.filter(item => item.status === 'published');
  return <span>{published.length} publicados</span>;
}
```

El valor derivado se calcula en render; no hace falta `useEffect` más `setState`. Si el cálculo es costoso, medirlo antes de introducir `useMemo`.

### Evitar estado duplicado

- Si `selectedTestimonialId` determina el registro, buscarlo en la lista actual en vez de mantener una copia editable sin reconciliación.
- Si el total viene de `meta` de la API, no recalcularlo desde una página parcial.
- Un filtro local puede derivarse de la lista cargada; distinguirlo de filtro paginado en servidor.
- Si una prop cambia y requiere reinicio de estado, definir ownership y ciclo de vida del componente.
- No usar un Effect para copiar props a estado en cada render sin necesidad de edición independiente.
- Mantener un solo propietario de la sesión y limpiar vistas privadas al cerrar sesión.

## Evento, Effect o carga de servidor

| Necesidad | Lugar preferido |
| --- | --- |
| Enviar formulario por click | Handler del evento. |
| Calcular etiqueta o lista filtrada | Render o función pura. |
| Sincronizar listener, timer, widget externo o DOM no declarativo | `useEffect` con cleanup cuando corresponda. |
| Recuperar sesión en pantallas cliente actuales | Hook `useSession` existente. |
| Cargar dato público en Server Component nuevo | Función asíncrona de servidor Next, con contrato y caché definidos. |
| Cargar dato cliente al montar una pantalla vigente | Effect o mecanismo de datos del feature con cancelación/ignorar resultado obsoleto. |

Los [Effects sincronizan sistemas externos](https://react.dev/learn/synchronizing-with-effects). Un fetch cliente es una interacción con la red y puede requerir un Effect en el flujo actual; eso no lo convierte en la única forma de cargar datos en Next. Un Server Component puede esperar un fetch durante el render en servidor, fuera del modelo de Effects cliente.

```tsx
'use client';

import { useEffect, useState } from 'react';

function OnlineStatus() {
  const [online, setOnline] = useState(true);
  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    update();
    window.addEventListener('online', update);
    window.addEventListener('offline', update);
    return () => {
      window.removeEventListener('online', update);
      window.removeEventListener('offline', update);
    };
  }, []);
  return <span>{online ? 'Con conexión' : 'Sin conexión'}</span>;
}
```

El ejemplo sincroniza un estado del navegador. No copiarlo como indicador de disponibilidad de NestJS: tener red no demuestra que la API responda. En Strict Mode de desarrollo, React puede ejecutar setup/cleanup adicional para detectar errores; un Effect correcto debe tolerarlo.

## Datos cliente y carreras

- En una carga dependiente de sesión, no lanzar requests privados antes de tener identidad válida.
- Si una búsqueda cambia rápido, cancelar con `AbortController` o ignorar respuestas obsoletas.
- Un cleanup evita actualizar estado desde una solicitud que ya no corresponde a la pantalla.
- Distinguir `loading` inicial de `refreshing` si el contenido previo permanece visible.
- No convertir error de red en lista vacía; eso oculta la diferencia entre ausencia y fallo.
- Tras 401, seguir recuperación de sesión existente; tras 403, explicar permiso insuficiente.
- Tras 409, refrescar recurso antes de proponer otra transición.
- No reintentar automáticamente una mutación que podría haberse confirmado tras timeout.
- Si se introduce SWR/TanStack Query, definir convivencia con cookies, CSRF, tenant y cache key.

## Estado local y composición

`useState` cubre campos, diálogos, selección y carga sencillos. `useReducer` ayuda cuando varias transiciones locales se relacionan y un estado no debe combinarse con otro. Context sirve para valores compartidos por un subárbol; no usarlo como reemplazo automático de props o respuesta de servidor.

- Colocar estado en el ancestro común más cercano que realmente lo necesita.
- Pasar children para composición antes de añadir una matriz de props booleanas.
- Usar primitiva Radix cuando se necesita foco, teclado y semántica de un patrón complejo.
- No recrear un modal, menú o select desde cero por una diferencia visual pequeña.
- Si un componente tiene demasiadas responsabilidades, separar interacción, adaptador y presentación.
- Un custom hook debe capturar un comportamiento reutilizable, no ocultar todo el feature.
- Evitar props que permiten estados imposibles; modelar alternativas con una unión discriminada cuando simplifica.

```ts
type RequestState<T> =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'success'; data: T }
  | { status: 'error'; message: string };
```

La unión evita `loading: true` y `data` final contradictorios en un estado local. No imponerla a cada control sencillo; un booleano puede ser suficiente para un diálogo abierto/cerrado.

## Formularios proporcionales

- Un formulario de uno o dos campos puede usar estado local si validación y errores siguen claros.
- React Hook Form con Zod conviene cuando hay varios campos, validación cruzada o errores complejos.
- La validación de cliente da feedback; NestJS sigue siendo autoridad de contrato y negocio.
- Etiquetar cada campo y asociar ayuda/error en DOM, no solo por color.
- Conservar valores ante error recuperable y bloquear doble envío mientras una operación está pendiente.
- No borrar el formulario tras 409; mostrar estado actualizado o una acción de recuperación.
- Para archivos o medios, revisar límites y origen de datos antes de mantenerlos en estado React.
- No guardar contraseña, token o contenido con PII en almacenamiento persistente por comodidad.

## Moderación y acciones sensibles

- Mostrar estado actual y consecuencia antes de aprobar, rechazar o publicar.
- La UI puede esconder acciones inválidas, pero NestJS debe rechazar una llamada forzada.
- No adelantar `published` de forma optimista cuando el backend todavía puede devolver conflicto.
- Un éxito de publicación no equivale a entrega del webhook; el outbox procesa después.
- Si un editor cambia un recurso mientras otro lo modera, tratar la respuesta de conflicto.
- Un botón disabled representa espera local; no es control de concurrencia en la API.
- Las listas se refrescan tras confirmación de mutación, sin filtrar otro tenant en cliente.

## Accesibilidad en React

- Usar elemento nativo correcto: `button` para acción y `Link`/`a` para navegación.
- Mantener foco visible y devolverlo tras cerrar un diálogo.
- Usar `aria-*` para describir estado real, no para compensar HTML incorrecto.
- Dar nombre accesible a controles solo con icono.
- Asociar errores con campos y anunciar resultado asíncrono cuando importa.
- Probar teclado y lectores de pantalla para diálogos, menús y tablas afectadas.
- Evitar que un skeleton cambie la geometría de la pantalla al cargar.
- Respetar reducción de movimiento; no animar confirmaciones que oculten errores.
- Revisar objetivos de puntero según WCAG 2.2 y sus excepciones, no un tamaño universal inventado.

## Rendimiento basado en evidencia

- Medir render y bundle antes de añadir `memo`, `useMemo` o `useCallback` por rutina.
- Una función nueva en props no causa por sí sola un problema material.
- Mantener Client Components acotados para no enviar código innecesario al navegador.
- Dividir carga pesada por ruta o interacción cuando un perfil muestre ese costo.
- Usar keys estables de entidad en listas que cambian; evitar índices para filas reordenables.
- Evitar trabajo costoso en render si puede prepararse una vez o en el servidor.
- No introducir estado global para “optimizar” una pantalla sin medir el problema.

La [configuración de React Compiler](https://react.dev/reference/react-compiler/configuration) exige una adopción explícita. En React 18 necesita target y runtime compatibles. El proyecto no lo tiene configurado; no prometer memoización automática ni eliminar optimizaciones justificadas suponiendo que se ejecuta.

## Pruebas de comportamiento

Vitest y Testing Library están instalados. Probar lo que observa una persona: texto, roles accesibles, interacciones y resultado, no detalles internos de hooks. Elegir pruebas para fallos que el cambio puede introducir.

- Un formulario conserva datos y muestra error tras rechazo de API.
- Una acción de moderación no declara éxito antes de confirmación.
- Un 401 conduce al flujo de sesión y un 403 conserva denegación.
- Un diálogo abre, recibe foco y lo devuelve al cerrar.
- Un filtro local muestra selección y modo de limpiarlo.
- Un cambio de estado no mezcla datos de dos tenants tras logout/login.
- No escribir pruebas que solo repiten un `className` o un `useState` sin riesgo.

## Revisión de un componente

1. Identificar actor, tarea y lugar en el feature.
2. Decidir qué datos son props, estado local, sesión o respuesta API.
3. Confirmar que render es puro y que handlers contienen acciones de usuario.
4. Revisar cada Effect: sistema externo, dependencias, cleanup y carreras.
5. Usar la primitiva y tokens existentes antes de inventar otra.
6. Cubrir carga, vacío, error y éxito donde el componente consulta datos.
7. Verificar semántica, foco y teclado en los estados afectados.
8. Añadir prueba de comportamiento proporcional al riesgo.

## Decisiones por tipo de componente

### Pantalla de lista

- La lista remota pertenece al adaptador y la API; los filtros locales pertenecen a la pantalla.
- Si la API pagina, no presentar conteos de la página como totales del tenant.
- Una búsqueda local se deriva del conjunto cargado; indicar su alcance al usuario.
- Tras una mutación confirmada, actualizar o recargar la lista sin perder foco innecesariamente.
- Conservar keys por ID estable; no por posición visible tras ordenar.
- Mostrar vacío por filtro separado de vacío por ausencia de datos.
- Un error al cargar no debe dejar una lista vacía con mensaje de éxito.
- La tabla y sus acciones deben conservar asociación de encabezados y fila.

### Diálogo

- Dejar que Radix gestione foco y Escape cuando se usa una primitiva de diálogo.
- Abrirlo por una acción de usuario; no necesitar un Effect que observe un booleano para “hacer click”.
- Conservar borrador local mientras el diálogo está abierto según la tarea.
- Definir si cerrar cancela, conserva o descarta cambios; no sorprender al usuario.
- Al completar una mutación, cerrar solo tras respuesta positiva de NestJS.
- Al fallar, mantener el mensaje y los campos para corrección.
- Devolver foco al control que abrió el diálogo o a un punto útil si desapareció.

### Formulario de captura

- Estado local simple es suficiente para un campo independiente y un error claro.
- Si hay validación cruzada, pasos o muchos errores, React Hook Form puede reducir coordinación manual.
- Zod de cliente no sustituye el DTO `nestjs-zod` de la API.
- Un request de envío va en el handler, no en un Effect disparado por `submitted: true`.
- Deshabilitar envío repetido mientras espera, pero no asumir idempotencia fuerte del backend.
- Una respuesta 503 permite conservar datos y mostrar recuperación; no guardar PII por defecto.

## Preguntas para cada Effect

1. ¿Qué sistema fuera de React se sincroniza: navegador, red, widget o suscripción?
2. ¿La acción pertenece realmente a un evento de usuario?
3. ¿Puede calcularse el resultado durante render sin estado duplicado?
4. ¿Cuáles valores reactivos usa y están en dependencias?
5. ¿Qué ocurre si React monta, limpia y vuelve a montar en desarrollo?
6. ¿Debe cancelarse o ignorarse una respuesta que llega tarde?
7. ¿Puede el Effect producir una escritura de dominio duplicada?
8. ¿Qué sucede si sesión o tenant cambian mientras está activo?

Un Effect que instala listener siempre remueve ese listener. Un Effect que solo calcula `fullName` desde `firstName` y `lastName` debe ser una expresión de render. Un fetch cliente requiere tratamiento de red, cleanup y respuesta obsoleta; un fetch de Server Component pertenece a otra frontera.

## Revisar estados imposibles

- `loading` y `error` simultáneos pueden ser válidos solo si se definió una recarga con error parcial.
- Una lista vacía con status `success` es distinta de una lista no solicitada.
- Un testimonio seleccionado debe pertenecer a la lista/tenant actual o recargarse.
- Un modal de publicación no debe ofrecerse para un estado que la API no acepta.
- Un botón “Guardar” no debe quedar activo si el formulario carece de datos requeridos.
- Una acción async puede terminar tras un logout; no aplicar su resultado a la cuenta nueva.
- La unión discriminada ayuda si estas combinaciones aparecen; no es obligación para todo estado.

## Límites de memoización

`useCallback` puede estabilizar una función utilizada por un Effect o componente memorizado, pero también añade complejidad. Revisar dependencias completas y medir. `useMemo` evita un cálculo repetido costoso, no sirve como garantía de identidad de negocio. React Compiler no se ejecuta en esta app; una adopción futura no justifica quitar comprobaciones de rendimiento actuales.

## Migraciones futuras

React 19 y React Compiler requieren actualización deliberada de dependencias y pruebas; no son el baseline. Una migración de una pantalla cliente a Server Components requiere resolver sesión, CSRF, caché y contratos con NestJS antes de mover el fetch. Una biblioteca de estado o formularios adicional necesita un problema concreto; su presencia en el ecosistema no justifica instalarla.

## Definition of Done

- Render puro y estado con propietario claro, sin efectos para derivaciones locales.
- Effects sincronizan sistemas externos y limpian suscripciones o resultados obsoletos.
- La interacción usa sesión y adaptadores vigentes; autorización y tenant permanecen en NestJS.
- Formularios y estados de error son recuperables y accesibles.
- Pruebas cubren el comportamiento de riesgo, sin depender de implementación interna.
- React Compiler y React 19 se describen como migraciones, no como capacidades activas.
