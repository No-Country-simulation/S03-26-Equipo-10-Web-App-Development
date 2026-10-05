---
name: web-rendering-performance-engineering
description: >-
  Selección y verificación de estrategias de renderizado y rendimiento web para Testimonial CMS (SKL-FE-ARCH-002). Usar para decidir CSR, SSR, contenido estático, streaming, caché y Core Web Vitals en Next.js 15/React 18 con API NestJS. Separa estado vigente, opciones contextuales y migraciones futuras.
---

# SKL-FE-ARCH-002 — Renderizado y rendimiento web

## Propósito y estado

Esta guía ayuda a elegir una estrategia por ruta y dato. Leer `AGENTS.md`, `llm.txt`, `docs/technical/01_architecture.md`, la ruta y su feature antes de decidir. No inferir despliegue de producción desde documentación objetivo.

| Estado | Implementación o condición |
| --- | --- |
| **Vigente** | Next.js 15.5 App Router, React 18.3, pantallas públicas y privadas activas mayormente con carga cliente, `requestApi` con `no-store`. |
| **Vigente** | NestJS ofrece caché pública Redis con TTL y versión por tenant; el outbox usa PostgreSQL y polling dentro de la API. |
| **Opción contextual** | SSR, SSG, revalidación por tiempo, streaming y RUM tras cambiar ruta, contrato y operación correspondientes. |
| **Migración futura** | ISR guiada por eventos desde NestJS, `/api/revalidate`, Next 16 Cache Components, workers separados o arquitectura CDN explícita. |

## Cinco decisiones independientes

1. **Quién genera HTML:** servidor Next o navegador.
2. **Cuándo:** build, solicitud o después de montar un Client Component.
3. **Qué se cachea:** resultado de NestJS, fetch de Next, HTML o assets.
4. **Cuánta frescura admite el dato:** inmediata, segundos definidos o hasta un evento.
5. **Cuánta interactividad:** ninguna, control local o pantalla cliente completa.

No llamar SSR a una página solo porque `page.tsx` sea un Server Component. Si la página devuelve una pantalla cliente que hace fetch tras hidratar, el HTML inicial no contiene los testimonios. Separar shell HTML de contenido remoto.

## Rutas actuales: observación, no promesa

| Ruta | Composición vigente | Riesgo o decisión |
| --- | --- | --- |
| `/` | Página pública en App Router | Verificar HTML real antes de calificar SEO o generación estática. |
| `/t/[slug]` | Server Component que compone `PublicTestimonialsScreen` cliente | Testimonios cargados por adaptador público; revisar LCP/SEO si se mueve el fetch. |
| `/p/[slug]` | Server Component que compone captura pública cliente | Interacción de formulario y respuesta de API. |
| `/admin/**` | Layout con `DashboardShell` cliente y `useSession` | Privado: aislar sesión y respuestas; evitar caché compartida. |
| `/health` | Route Handler operativo | No usarlo como plantilla de BFF de dominio. |

El mapa puede cambiar; confirmar los archivos antes de aplicarlo. No usar rutas ficticias `/t/[id]` o `/api/revalidate` como prueba de implementación.

## Árbol de decisión para un dato

1. ¿Es privado o específico de usuario/tenant? Elegir `no-store` y verificar autorización en NestJS.
2. ¿El HTML inicial de ese dato importa para SEO o percepción? Considerar Server Component con fetch directo a NestJS y validación de contrato.
3. ¿La sesión actual permite ese fetch en servidor? Si no, mantener cliente o diseñar explícitamente el mecanismo.
4. ¿Puede estar desactualizado? Definir segundos tolerables con producto antes de elegir revalidación.
5. ¿Hay contenido costoso independiente? Considerar `Suspense` y streaming con fallback estable.
6. ¿Una capa ya cachea la respuesta? Revisar NestJS/Redis antes de sumar Next o CDN.
7. ¿Qué ocurre si la API falla o está lenta? Definir error visible y límites de timeout.

## Estrategias disponibles en Next.js 15

### Carga cliente (CSR del contenido)

Adecuada para paneles privados y flujos dependientes de `useSession` vigente. El shell puede tener HTML inicial; los datos se solicitan luego. Mostrar loading, empty, error y success. Medir tiempo hasta contenido útil y costo de hidratación. No usar CSR como explicación suficiente de por qué una página pública será indexada.

### Render en servidor por solicitud

**Opción contextual:** usar un Server Component que llame a NestJS. Para datos privados, definir reenvío de cookie/session, 401/refresh y caché por usuario. No extraer `tenantId` de la URL para autenticar. Para datos públicos, validar envelope con Zod o contrato equivalente. Configurar `cache: 'no-store'` si se necesita frescura en cada solicitud.

```ts
// Opción contextual para un adaptador server-only público.
export async function readPublicJson(url: URL): Promise<unknown> {
  const response = await fetch(url, { cache: 'no-store' });
  if (!response.ok) throw new Error('La API pública no respondió correctamente');
  return response.json(); // Validar el unknown con el esquema del feature.
}
```

No llamar a una URL relativa de un Route Handler propio para llegar a la API desde el servidor. Resolver el origen NestJS desde configuración confiable y mantener el módulo en imports solo de servidor. El marcador `server-only` puede añadirse después de declararlo como dependencia. El ejemplo no debe recibir una URL construida desde entrada arbitraria; el llamador fija el origen y codifica el slug.

### Generación estática y revalidación temporal

**Opción contextual:** adecuada cuando el contenido es público, compartible y admite desfase. En Next 15, `fetch(url, { next: { revalidate: 60 } })` puede revalidar datos según la política del framework. Probar el comportamiento de ruta completa, fetch y despliegue antes de prometer un TTL efectivo. No usarlo para paneles privados.

La API NestJS puede devolver una respuesta desde Redis con TTL propio. La frescura percibida puede incluir ambos TTL y el tiempo de propagación; medir el recorrido completo. Un `revalidatePath` ejecutado en Next no invalida la caché Redis de NestJS. La publicación en NestJS ya gobierna su versión de caché pública, no una caché Next futura.

### Streaming y Suspense

**Opción contextual:** aislar un subárbol que espera datos para enviar primero una parte útil de la página. `Suspense` no elimina el tiempo total del backend. El fallback debe conservar tamaño y jerarquía visual para evitar CLS. Si los datos se cargan exclusivamente tras montar un componente cliente, agregar `Suspense` al shell no los convierte en SSR.

Una composición posible usa `<Suspense fallback={<LoadingPublicList />}>` alrededor de un Server Component asíncrono que consulta NestJS. Ambos componentes y el adaptador tendrían que implementarse; esta descripción no corresponde al código actual de `/t/[slug]`.

## Caché: propietario y límites

| Capa | Estado | Precaución |
| --- | --- | --- |
| `requestApi` en navegador | `cache: 'no-store'` vigente | No confundir con borrado de Redis o Data Cache de Next. |
| Redis en API | Público, TTL y versión por tenant vigentes | NestJS controla clave, aislamiento e invalidación. |
| Data Cache/Full Route Cache Next | Uso contextual | Revisar datos privados, `cookies()`, generación y self-hosting. |
| Caché de navegador/CDN | Depende de headers y despliegue | No afirmar una configuración que no se verificó. |

- No cachear respuesta privada usando solo ruta o slug como clave.
- No enviar `public, max-age` para una respuesta dependiente de cookie sin diseño y prueba específicos.
- Un 401/403 no se transforma en HTML privado parcialmente generado para otro usuario.
- Antes de sumar caché, escribir el presupuesto de desfase: desde mutación confirmada hasta vista pública correcta.
- Probar al menos dos tenants para descartar mezcla de datos; si se cachea por usuario, probar dos usuarios del mismo tenant.
- Verificar cómo se invalida cada capa en varias instancias. No asumir Redis pub/sub para Next.
- Fallar de forma segura si una política de caché privada no se puede demostrar.

## Interactividad e hidratación

- Un Server Component no envía su código de render al navegador; los Client Components sí requieren JavaScript e hidratación.
- Mantener interactividad en componentes que la necesitan y evitar `'use client'` en el árbol completo sin motivo.
- Evitar valores no deterministas en el primer render cliente si difieren del HTML del servidor.
- No ocultar un mismatch con `suppressHydrationWarning` sin entender su causa.
- `useEffect` sincroniza sistemas externos; no es herramienta para corregir todo desacuerdo de HTML.
- Cargar bibliotecas pesadas solo donde se usan; medir el bundle y las interacciones.
- Prefetch de enlaces no justifica descargar datos privados innecesarios.
- No exigir arquitectura de islands o resumability: no son mecanismos implementados en esta app Next/React.

## Core Web Vitals y medición

| Métrica | Qué revisar en una ruta real |
| --- | --- |
| LCP | HTML/contenido inicial, imagen principal, TTFB, CSS y API si bloquea el elemento. |
| INP | Coste de handler, render React y trabajo largo en hilo principal. |
| CLS | Dimensiones reservadas para imágenes, skeletons, fuentes y contenido asíncrono. |

Usar herramientas de navegador, Lighthouse o medición en campo si están disponibles. Registrar dispositivo, conexión, ruta y estado de sesión. No presentar p75, RUM, Server-Timing o SLO como instrumentación activa de la web sin verificarla. La API sí tiene métricas y trazas opcionales; eso no equivale a telemetría de navegador desplegada.

### Secuencia de diagnóstico

1. Reproducir una ruta y estado concreto: público, admin, loading o error.
2. Capturar waterfall de red y HTML inicial; distinguir espera del servidor de espera del fetch cliente.
3. Identificar elemento LCP y layout shifts con evidencia.
4. Analizar tamaño y ejecución del JavaScript cliente solo si el perfil apunta a ello.
5. Revisar caché de API, Next y navegador por separado.
6. Cambiar una causa medida y repetir el escenario comparable.
7. Mantener una mejora solo si no degrada frescura, aislamiento o accesibilidad.

## Recursos y entrega

- Dar prioridad a contenido crítico; diferir imágenes y código fuera de pantalla cuando tenga sentido.
- Reservar dimensiones o relación de aspecto de medios para estabilizar layout.
- Revisar dominios y políticas de imagen antes de usar optimización automática.
- Evitar scripts de terceros en la ruta crítica si no aportan al flujo.
- No establecer un presupuesto de KB o milisegundos como hecho logrado sin datos de baseline.
- La autoalojación con `output: 'standalone'` está configurada; CDN, edge y multi-instancia requieren comprobación operativa separada.

## Fallas y resiliencia

- `loading.tsx` representa carga de segmento; estados cliente requieren feedback propio.
- `error.tsx` cubre renderizado; errores de fetch gestionados en cliente deben tratarse allí.
- Respetar 429 y `Retry-After` cuando la API lo entregue; no reintentar una mutación no idempotente a ciegas.
- Un contenido público stale puede ser aceptable solo si el producto define duración y no compromete moderación.
- Un dato privado stale podría mostrar estado revocado; usar política conservadora.
- El outbox durable está en NestJS/PostgreSQL; no usar invalidación Next como señal de entrega webhook.

## Matriz de frescura para revisión de producto

| Dato | Pregunta antes de cachear | Decisión conservadora |
| --- | --- | --- |
| Rol o sesión | ¿Puede revocarse mientras la página está abierta? | Consultar autoridad y evitar caché compartida. |
| Testimonio publicado | ¿Cuánto tarda en hacerse visible un cambio de moderación? | Empezar sin caché Next adicional. |
| Lista pública | ¿Es aceptable mostrar una versión anterior por segundos? | Medir caché NestJS actual. |
| Analítica admin | ¿Cuánto retraso tolera una cifra? | Mostrar fecha/estado si se admite retraso. |
| Configuración de webhook | ¿Afecta un destino activo? | Preferir datos frescos y controles de permiso. |

La tabla no fija TTL nuevos. El producto y el endpoint deben definirlos. Si una baja o rechazo de testimonio debe reflejarse con rapidez, el presupuesto de desfase incluye caché API, caché Next eventual, navegador y CDN. Ninguna capa puede prometer por sí sola frescura extremo a extremo.

## Comprobación de HTML y SEO

1. Abrir una ruta pública sin JavaScript y observar qué texto existe en el HTML recibido.
2. Verificar título, descripción y contenido visible a un crawler según la ruta real.
3. Identificar si el dato llega en HTML inicial, payload de RSC o fetch cliente posterior.
4. Revisar status HTTP: una página 200 con contenido “no encontrado” puede confundir indexación.
5. Evitar metadata genérica para todas las páginas públicas si hay datos seguros disponibles.
6. Definir canonical y robots según producto, no a partir de una URL de entrada sin validar.
7. Comprobar que ningún dato privado aparece en HTML, metadata o prefetch público.
8. Medir costo de una consulta extra en `generateMetadata` antes de adoptarla.

La decisión de pasar `/t/[slug]` a SSR no está incluida en esta corrección documental. Requiere modificar aplicación, probar caché y ver cómo NestJS resuelve slugs públicos.

## Revisión de carga en navegador

- Registrar cuántos requests dispara una navegación, desde el primer HTML hasta datos y medios.
- Separar recursos bloqueantes de recursos que aparecen después de interacción.
- Medir compresión y tamaños transferidos reales, no solo tamaño de archivo fuente.
- Revisar si una dependencia entra al bundle cliente por un import en un componente con `'use client'`.
- Identificar tareas largas que bloquean un click o un teclado antes de añadir `memo`.
- Si una imagen es LCP, confirmar dimensiones, origen y prioridad efectiva en red.
- Si una fuente cambia geometría, revisar estrategia de carga y fallback.
- Si un skeleton difiere del contenido final, revisar ancho/alto reservado.
- Si un gráfico de admin pesa mucho, evaluar carga bajo demanda del módulo que lo usa.
- Una petición pública de tracking no debe bloquear el contenido principal.
- Mantener mensajes de error y controles utilizables en red lenta o respuesta 503.
- Revisar móvil con CPU y red limitadas; escritorio rápido puede ocultar el cuello de botella.

## Validación de un cambio de caché

Antes de activar otra capa, registrar una secuencia reproducible:

1. Tenant A publica o retira un testimonio y recibe respuesta confirmada.
2. Cliente anónimo consulta A desde una instancia web y observa versión esperada.
3. Otro cliente consulta A desde otra instancia, si ese despliegue existe.
4. Cliente consulta tenant B y verifica que no aparezcan datos de A.
5. Un editor de A consulta el panel y no recibe datos privados cacheados de otro actor.
6. Se repite con Redis disponible y, cuando el contrato lo permita, con fallo de caché.
7. Se mide el desfase máximo observado y se compara con el presupuesto de producto.

No convertir esta secuencia en prueba de multi-instancia si el entorno solo ejecuta una instancia. Documentar el límite de la verificación.

## Migraciones futuras

ISR por eventos requeriría emisor autorizado desde NestJS, endpoint Next protegido, mapeo de tags/rutas, invalidación entre instancias, manejo de reintentos y pruebas de frescura. `/api/revalidate` no existe hoy. Next 16 Cache Components y React 19 exigen actualizar dependencias y revisar APIs. Un worker separado o acceso Prisma desde Next contradicen la topología vigente y necesitan otra decisión arquitectónica.

### Condiciones para revalidación por eventos

1. La mutación NestJS confirma primero el cambio de dominio y la política de caché pública de la API.
2. Un evento identifica tenant y recurso sin transportar secretos o PII innecesarios.
3. Un canal autenticado comunica el evento a Next sin permitir purgar rutas arbitrarias.
4. La ruta/tags afectados están mapeados y codificados; no se construyen desde entrada no confiable.
5. La invalidación se propaga a todas las instancias Next del despliegue real.
6. Los fallos de invalidación se reintentan o se acotan por TTL conocido.
7. Una revocación de contenido público no queda visible más allá del límite acordado.
8. Dos tenants con slugs distintos mantienen claves separadas.
9. La operación puede observar latencia, error y retraso de invalidación.
10. Hay prueba de publicación, edición y retirada desde API hasta HTML servido.

Hasta cumplir esas condiciones, no recomendar `revalidateTag` aislado como solución completa de frescura.

### Condiciones para medición en campo

- Definir qué rutas y dispositivos se observan y qué población queda fuera.
- Evitar PII, identificadores de sesión y URLs con datos sensibles en payloads.
- Elegir muestreo y retención antes de desplegar un script nuevo.
- Diferenciar datos de laboratorio y datos de usuarios reales.
- Mirar p75 por segmento solo con volumen suficiente y periodo explícito.
- Comparar cambios con igual conjunto de rutas, dispositivos y condiciones.
- Correlacionar métricas de navegador con API solo mediante IDs seguros.
- Usar hallazgos para corregir causas, no para perseguir un número sin contexto.

### Antes de declarar una optimización terminada

- Guardar la medición anterior y posterior con URL, entorno y fecha.
- Confirmar que la respuesta NestJS conserva status y contenido correctos.
- Confirmar que no aparecen datos de un tenant en el HTML o caché de otro.
- Comprobar teclado, zoom y lectura mientras la pantalla carga.
- Observar el caso de error, no solo el camino de éxito.
- Documentar toda dependencia de CDN, proxy o varias instancias como comprobada o pendiente.
- Si el resultado no es reproducible, mantenerlo como hipótesis y seguir midiendo.

## Definition of Done

- La estrategia elegida describe el HTML y los requests que la ruta realmente produce.
- Datos privados mantienen aislamiento y política `no-store` o equivalente demostrada.
- Cada capa de caché tiene propietario, TTL/frescura y mecanismo de invalidación conocido.
- Carga, error y contenido final conservan accesibilidad y geometría estable.
- Cualquier mejora de LCP, INP o CLS se evalúa con escenario comparable y sin promesas no medidas.
- Opciones y migraciones se distinguen del estado vigente de Next 15 y NestJS.
