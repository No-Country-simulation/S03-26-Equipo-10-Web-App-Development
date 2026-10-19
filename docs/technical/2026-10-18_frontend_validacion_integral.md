# Frontend integral — validación de fase 12

**Fecha:** 2026-10-18. **Rama:** `codex/mejoras-integrales-frontend`. **Base de medición:** `fa7838b5feab8d699087a9eb10576f910ef115e3`. **Implementación registrada:** `b14c1bef5e8797011f7f224fd7290fb4de60140a`, con ACK humano recibido el 2026-10-18. Este informe acompaña el [plan HITL](../plan/2026-10-14_feat-mejoras-integrales-frontend.md); no declara aceptación de integración ni despliegue.

## Resultado y alcance

Las fases 0–12 están registradas y su implementación está aprobada por el usuario; la aceptación integral conserva los gates pendientes. La fase 12 elimina una duplicación comprobada: captura y galería montaban una segunda textura fija con mezcla sobre la textura del layout raíz. Se conserva únicamente la capa global, incluida la presentación de carga, error y confirmación de captura. Se retira el mock unitario que ya no corresponde. No se cambian contratos, caché, sesión, permisos ni dependencias.

Se aplicaron los playbooks **optimize**, **polish** y **audit** de [Impeccable](../../.agents/skills/impeccable/SKILL.md), con lectura de craft-floor inmediatamente antes de editar UI. El contexto de la skill ya se había cargado en esta sesión. `critique-storage latest apps/web/src` devolvió 2: el helper no proporciona un snapshot vigente para ese target de directorio; su marcado automático se revirtió para preservar el informe histórico. La evaluación del 14/10 se leyó como antecedente; no se declara cerrado ese snapshot mediante el helper ni se compara su 22/40 heurístico con esta auditoría técnica.

Sus cinco prioridades tienen implementación local y regresiones: acciones reales/ayuda (fase 11), búsqueda global (3), detalle reconciliado (1), registro vacío/borradores protegidos (1/8), responsive/contraste/movimiento (2/11). La búsqueda y la integridad de tenant aún requieren las integraciones reales listadas abajo.

## Producción y costo demostrado

Se compiló Next.js 15.5.27 real, sin sustituir fuentes ni desactivar validación. Configuración de laboratorio: `NEXT_PUBLIC_API_URL=/api/v1`, `API_BACKEND_ORIGIN=http://127.0.0.1:3001`, telemetría de Next desactivada. NestJS no está detrás de ese origen; el navegador intercepta HTTP con fixtures exclusivamente sintéticas. No se trata de aceptación de integración ni de un despliegue.

| Medición                                 | Antes           | Después         | Interpretación                                     |
| ---------------------------------------- | --------------- | --------------- | -------------------------------------------------- |
| Texturas fijas en `/`                    | 1               | 1               | Control sin duplicación inicial                    |
| Texturas fijas en `/p/synthetic`         | 2               | 1               | Se elimina una capa de mezcla de pantalla completa |
| Texturas fijas en `/t/synthetic`         | 2               | 1               | Se elimina una capa de mezcla de pantalla completa |
| Iframes de galería antes de pulsar video | 0               | 0               | Se conserva carga bajo demanda                     |
| Imagen de galería                        | `lazy`, `async` | `lazy`, `async` | Se conserva lectura diferida                       |

El baseline aislado registró navegación de 572,2 ms en portada, 446,2 ms en captura y 352,6 ms en galería. Son muestras individuales de laboratorio, sin throttling ni servicios reales: **no son Core Web Vitals, p75 ni evidencia de mejora de latencia**. La reducción demostrada es de dos a una capas; no se le asigna una ganancia porcentual de velocidad, memoria o GPU. La muestra posterior registró 888,6/330,6/435,1 ms respectivamente, con la matriz ejecutándose en paralelo: son condiciones distintas y no permiten atribuir variaciones a la corrección. No se introducen memoización, lazy imports ni refactors especulativos.

| Ruta                           | First Load JS anterior | First Load JS final |
| ------------------------------ | ---------------------- | ------------------- |
| `/` y `/docs`                  | 163 kB                 | 163 kB              |
| `/admin`                       | 167 kB                 | 167 kB              |
| `/admin/testimonials`          | 159 kB                 | 159 kB              |
| `/admin/business-intelligence` | 165 kB                 | 165 kB              |
| `/admin/settings`              | 155 kB                 | 155 kB              |
| `/p/[slug]`                    | 137 kB                 | 137 kB              |
| `/t/[slug]`                    | 134 kB                 | 134 kB              |

El tamaño propio de ruta baja de 7,59 a 7,29 kB en captura y de 8,51 a 8,22 kB en galería; First Load JS redondeado permanece igual. Compilación webpack: 22,8 s antes y 27,5 s después, bajo distinta carga local; no se interpreta como comparación de velocidad.

La tabla corresponde al reporte de Next, no al total de red del producto. Compartidos: 103 kB; middleware: 33 kB tanto antes como después. Landing/ayuda tienen contenido prerenderizado; captura/galería consultan su contenido después de hidratar. No se afirma SSR de los testimonios ni una nueva política de indexación. Las consultas privadas siguen con `no-store`; no se agrega caché compartida.

## Matriz de inspección del navegador

Chromium instalado en `/opt/google/chrome/chrome`, headless Linux, build de producción, fixtures sintéticas, `prefers-reduced-motion: reduce`. Ronda inicial agrupada: **140 casos**. Se registraron DOM, nombres de controles, texto/contraste compuesto sRGB, desbordes y excepciones de JavaScript. Las capturas agrupadas se inspeccionaron, incluidos desktop oscuro, formularios, tablas móviles y las siete vistas BI. La única confirmación posterior completó otros **140/140 casos**, con sesión resuelta: una sola capa en todos los casos, un main por página, documento/cuerpo contenidos, cero fallas del contraste medido, controles sin nombre, peticiones de fixture sin manejar ni excepciones JavaScript. Se inspeccionaron las capturas finales de confirmación; no se hicieron nuevas ediciones de UI ni ciclos de microajustes.

La distribución es explícita: 22 superficies × 1440/320 px × claro/oscuro = 88; 18 superficies con datos × vacío/error a 768 px claro = 36; 16 superficies privadas con editor a 320 px oscuro = 16. No es el producto cartesiano de todos los roles, estados y tamaños. El caso «vacío» vacía colecciones; las vistas de detalle/configuración conservan su recurso válido, pues un detalle vacío sería un contrato inválido. Algunos casos editor de la primera ronda todavía estaban en carga al observarlos: la confirmación espera la sesión resuelta antes de registrar resultados.

| Superficie                 | 320/1440, claro/oscuro | 768, vacío/error      | Editor 320 oscuro   |
| -------------------------- | ---------------------- | --------------------- | ------------------- |
| Landing `/`                | Inspeccionada          | No aplica             | Pública             |
| Ayuda `/docs`              | Inspeccionada          | No aplica             | Pública             |
| Login                      | Inspeccionada, anónimo | Validación en suite   | Anónimo             |
| Registro                   | Inspeccionada, anónimo | Validación en suite   | Anónimo             |
| Captura `/p/[slug]`        | Inspeccionada          | Carga de datos/error  | Pública             |
| Galería `/t/[slug]`        | Inspeccionada          | Colección vacía/error | Pública             |
| Inicio administrativo      | Inspeccionada          | Inspeccionados        | Incluido            |
| Testimonios                | Inspeccionada          | Inspeccionados        | Incluido            |
| Categorías                 | Inspeccionada          | Inspeccionados        | Incluido            |
| Etiquetas                  | Inspeccionada          | Inspeccionados        | Incluido            |
| Usuarios                   | Inspeccionada          | Inspeccionados        | Acceso denegado     |
| API keys                   | Inspeccionada          | Inspeccionados        | Acceso denegado     |
| Webhooks                   | Inspeccionada          | Inspeccionados        | Acceso denegado     |
| Analítica                  | Inspeccionada          | Inspeccionados        | Incluido            |
| Configuración              | Inspeccionada          | Inspeccionados        | Acceso denegado     |
| BI resumen                 | Inspeccionada          | Colecciones/error     | Incluido            |
| BI ejecuciones/solicitudes | Inspeccionada          | Colecciones/error     | Incluido            |
| BI operación               | Inspeccionada          | Recurso/error         | Incluido            |
| BI configuración           | Inspeccionada          | Recurso/error         | Lectura restringida |
| BI auditoría               | Inspeccionada          | Colección/error       | Acceso denegado     |
| BI detalle ejecución       | Inspeccionada          | Recurso/error         | Incluido            |
| BI detalle solicitud       | Inspeccionada          | Recurso/error         | Incluido            |

Los once aliases preparatorios se comprueban contra destinos exactos; `/docs` es la duodécima decisión, con contenido propio. La entrada contextual no concede permisos. Se conserva el transporte de redirect que produzca Next (header o metadata de streaming); no se promete un status fijo para todos los modos.

No se detectaron en la primera ronda desbordes de documento/cuerpo, texto visible bajo su umbral medido, controles botón/enlace sin nombre ni excepciones JavaScript. Las tablas conservan su scroll interno. La medición excluye texto oculto, deshabilitado y ancestros con opacidad/transparencias que no puede resolver; no cubre todos los hovers/focos ni fondos de imagen. El alto de los controles compartidos y navegación BI conserva `min-h-11`. Los inputs nativos siguen la localización del navegador.

No se certifica WCAG: faltan lector de pantalla, Safari/Firefox, dispositivos físicos, gestos táctiles reales y zoom nativo. La equivalencia de reflow a 200% de fase 11 se mantiene como evidencia acotada de aquella fase; no se presenta como una medición nueva de todas las rutas. Las fixtures y las imágenes sintéticas no representan clientes ni proveedores reales.

La confirmación funcional de producción verificó once destinos de alias exactos; apertura del menú móvil con Enter, cierre con Escape y retorno del foco; ausencia de iframe/script YouTube previo al click, imagen lazy y fallback externo tras abortar el script; cancelación de salida BI conservando la frecuencia editada; una lectura adicional de `/bi/status` en 31,5 s con el módulo en reposo; lectura pública y redirección anónima con Storage denegado. Sin excepciones JavaScript. El polling activo a 5 s y la suspensión/retorno de pestaña siguen cubiertos por pruebas con timers, no por una medición física de dispositivo.

## Auditoría técnica final de Impeccable

Dictamen de integridad: **coherente en el alcance local inspeccionado**. El producto conserva crema/terracota, citas y títulos editoriales, controles/datos sans, vocabulario de moderación y organización persistente. Landing conduce a registro/ayuda reales; las condiciones, precios y testimonios comerciales no acreditados siguen como borradores no montados. Las acciones administrativas usan contratos y permisos vigentes, sin fabricar membresías, IA semántica ni efecto de flags.

| Dimensión                     | Criterio provisional 0–4 | Evidencia y límite                                                                                              |
| ----------------------------- | ------------------------ | --------------------------------------------------------------------------------------------------------------- |
| Accesibilidad                 | 3                        | Semántica, nombres, feedback y teclado representativo; faltan lector de pantalla y estados visuales exhaustivos |
| Rendimiento                   | 2                        | Build real, menor JS de rutas públicas y duplicación removida; faltan CWV y latencia con servicios reales       |
| Temas                         | 3                        | Tokens y contraste de texto observado en claro/oscuro; no se certifican todas las combinaciones interactivas    |
| Responsive                    | 3                        | 320/768/1440 y tablas contenidas; faltan dispositivos y gestos físicos, otros motores y zoom nativo             |
| Integridad de implementación  | 4                        | Recorridos propios del CMS, contratos/etapas fieles y detector `[]`; aceptación API persistente separada        |
| Total técnico de este alcance | **15/20**                | Juicio experto local, no porcentaje de cumplimiento ni comparación con la crítica heurística del 14/10          |

No se hallaron defectos de implementación nuevos que justifiquen ampliar la corrección acotada. El bloqueante de aceptación es la validación de servicios/CI; los límites de navegador/CWV se conservan como trabajo de verificación, sin disfrazarlos como correcciones ya realizadas. No se recomienda introducir arquitectura de caché, nueva dependencia ni rediseño para mejorar artificialmente este puntaje.

## Regresiones obligatorias y trazabilidad

Los nombres siguientes identifican archivos de pruebas existentes bajo `apps/web/src/features/`, salvo indicación API. El [plan](../plan/2026-10-14_feat-mejoras-integrales-frontend.md#4-matriz-de-hallazgos-f01f24) conserva las 24 filas y sus fases propietarias.

| Hallazgos/escenario                                       | Evidencia automatizada                                                                                                                                                                         | Límite real                                                                                         |
| --------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| F01/F04: editor modera; detalle reconciliado              | `testimonials/components/testimonial-interactions.test.tsx`, `testimonials/screens/testimonials-screen.test.tsx`; API `testimonial-admin-http.spec.ts`                                         | Aislamiento persistente pendiente                                                                   |
| F02/F05: paginar no envía; retry/cierre preserva borrador | `testimonials/components/testimonial-interactions.test.tsx`, `shared/pagination.test.ts`                                                                                                       | En memoria; recarga completa no persiste borradores                                                 |
| F03: búsqueda fuera de página, URL y siguiente/anterior   | `testimonials/screens/testimonials-screen.test.tsx`; API `admin-search.spec.ts`, `testimonial-persistence.integration.spec.ts`                                                                 | PostgreSQL pendiente                                                                                |
| F06/F17: borrado informado; página válida                 | `catalog/screens/catalog-screen.test.tsx`, `testimonials/screens/testimonials-screen.test.tsx`; API `catalog-admin.integration.spec.ts`                                                        | Asociaciones reales pendientes                                                                      |
| Eliminación con actividad                                 | API `testimonial-removal.spec.ts`, `testimonial-persistence.integration.spec.ts`                                                                                                               | Actividad conservada; rechazo de borrado persistente pendiente de PG                                |
| F08/F14/F15: UTC exacto, estados y revelación protegida   | `api-keys/screens/api-keys-screen.test.tsx`, `api-keys/key-form.test.ts`                                                                                                                       | Sin claves reales; integración PG pendiente                                                         |
| F07/F20: una rotación, contexto y entregas                | `webhooks/screens/webhooks-screen.test.tsx`                                                                                                                                                    | Firma, ledger y concurrencia reales requieren servicios                                             |
| F16/F18: crear usuario, roles y acceso suspendido         | `users/screens/users-screen.test.tsx`; API `user-access-http.spec.ts`, `user-history.spec.ts`                                                                                                  | Sesión persistente/PG pendiente                                                                     |
| F19: configuración independiente y slug preservado        | `settings/screens/settings-screen.test.tsx`                                                                                                                                                    | Cloudinary real pendiente                                                                           |
| F10: registro vacío y errores asociados                   | `auth/components/register-admin-form.test.tsx`, `auth/screens/login-screen.test.tsx`                                                                                                           | Registro E2E real pendiente                                                                         |
| F09: publicación 21 accesible                             | `public-testimonials/screens/public-testimonials-screen.test.tsx`; API `testimonial-persistence.integration.spec.ts`                                                                           | PG/paginación real pendiente                                                                        |
| F13/F22: storage denegado, foco y feedback                | `public-testimonials/screens/public-testimonials-screen.test.tsx`, `public-capture/screens/capture-screen.test.tsx`, `shared/confirmation-hosts.test.tsx`, `components/ThemeProvider.test.tsx` | Inspección no equivale a WCAG completa                                                              |
| F11/F12/F23: CTA, responsive, ayuda y aliases             | `landing/screens/landing-screen.test.tsx`, `help/screens/help-screen.test.tsx`, `legacy-routes/aliases.test.ts`                                                                                | E2E real pendiente                                                                                  |
| F21: acumulado, observación y contexto autorizado         | `analytics/screens/analytics-screen.test.tsx`; API `analytics-dashboard.spec.ts`, `testimonial-persistence.integration.spec.ts`                                                                | 51 eventos/dos tenants pendiente en PG                                                              |
| F24: BI draft, conflicto y respuesta incierta             | `business-intelligence/screens/bi-screen.test.tsx`, `use-settings-exit-guard.test.tsx`, `use-bi-resource.test.tsx`                                                                             | Warehouse real pendiente                                                                            |
| Medios/polling                                            | Suites públicas y `business-intelligence/use-bi-resource.test.tsx`                                                                                                                             | Serialización, aborto/retorno de pestaña y 5/30 s verificados con timers; no benchmark de warehouse |

No se incorporan moderación masiva, invitaciones por email, recuperación de contraseña ni widget nuevo: son exclusiones humanas del plan. Analytics/Webhooks siguen siendo parámetros técnicos editables que no aplican un control de acceso por flag, según ACK explícito. No hay exclusiones nuevas de F01–F24; quedan comprobaciones pendientes, no hallazgos borrados del alcance.

## Comandos y resultados

| Comando                                                                                                                                              | Resultado local                                                         |
| ---------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| `npm test --workspace @testimonial-cms/web -- --maxWorkers=2 --reporter=default --reporter=json --outputFile=/tmp/frontend-phase12-web-results.json` | 363/363, 57 archivos, cero omisiones                                    |
| `node scripts/testing/check-results.mjs vitest /tmp/frontend-phase12-web-results.json`                                                               | Aprobado: 363 pruebas / 93 suites contando describe                     |
| `npm test --workspace @testimonial-cms/api -- --json --outputFile=/tmp/frontend-phase12-api-results.json`                                            | 358 aprobadas, 174 omitidas; 61 archivos aprobados / 20 suites omitidas |
| `node scripts/testing/check-results.mjs jest /tmp/frontend-phase12-api-results.json`                                                                 | Rechazado correctamente, exit 1, reporte incompleto por omisiones       |
| `npm run typecheck`                                                                                                                                  | Ambos workspaces aprobados; el build final también comprueba tipos web  |
| `npm run lint`                                                                                                                                       | Cero errores, ocho advertencias web preexistentes                       |
| `npm run build --workspace @testimonial-cms/api`                                                                                                     | Aprobado                                                                |
| Build web de producción anterior y final                                                                                                             | Aprobados; 27/27 páginas generadas                                      |
| `node --test scripts/testing/*.test.mjs scripts/e2e/*.test.mjs scripts/test-next-eslint-glob.mjs`                                                    | 102/102, sin omisiones                                                  |
| `node --test --test-isolation=none scripts/release/*.test.mjs`                                                                                       | 63/63, sin omisiones                                                    |
| `npm run test:e2e:list --workspace @testimonial-cms/web`                                                                                             | Seis recorridos obligatorios, sin desactivarlos                         |
| `E2E_ALLOW_DISPOSABLE_MIGRATIONS=1 npm run test:e2e --workspace @testimonial-cms/web`                                                                | Bloqueado antes de servicios: daemon Docker ausente                     |
| `impeccable detect --json apps/web/src`                                                                                                              | Exit 0, `[]`, stderr vacío                                              |

Los controles nativos ejecutados dentro del sandbox tuvieron fallos de entorno: 4/10 archivos y un control release. La repetición con procesos/sockets locales permitidos aprobó los 102 y 63 casos respectivos, sin cambiar sus assertions. El primer build sin variables válidas falló en configuración; el siguiente dentro del sandbox falló en webpack sin detalle útil. Los dos builds con la configuración de laboratorio y permisos necesarios aprobaron; no se desactivaron tipos/lint ni se sustituyeron fuentes. La suite API HTTP también se ejecutó con sockets locales permitidos.

No se recogió cobertura porcentual nueva; CI conserva sus reportes Jest/V8 obligatorios. No se adopta la sugerencia de Vitest de compartir jsdom/isolate=false: cambiar aislamiento para acelerar tests no es parte de la optimización del frontend.

Las ocho advertencias existentes corresponden a TestimonialSheet (import/catch), calendar (dos parámetros), chart (un parámetro), use-toast (tipo) y dos imágenes públicas. Estas últimas conservan `lazy`/`async` y tamaño/aspecto reservado; no se introduce un proxy de medios sin diseño ni autorización. Build también advierte sobre el tipo de módulo de Tailwind y tests sobre la futura carga nativa de config Vite; no se alteran manifiestos para silenciarlos.

Los logs/JSON de laboratorio están temporalmente en `/tmp/frontend-phase12-*`; no son un almacén permanente ni artefactos de CI. Este documento registra sólo resultados saneados; no se guardan cookies, tokens, claves reveladas, contraseñas o datos personales de clientes.

## Integración, CI y cierre humano

Docker: tanto `docker info` como el harness comprobaron que no existe daemon/socket disponible. Ejecución E2E **`dcf3b3b40f10`**: `Create owned network failed (1)`, antes de crear servicios o aplicar migraciones. El ACK para el harness descartable se conserva; no autoriza migrar desarrollo/remoto ni sustituye servicios ausentes. Los seis E2E obligatorios siguen descubriéndose sin desactivar tests ni controles de privacidad.

La suite API local ejecuta pruebas unitarias/HTTP, pero omite integraciones por entorno: testimonial persistence, catálogos, tenant, auth/sesiones, API keys, webhooks, logos, cuotas/Redis y todas las familias BI. **174 pruebas omitidas**: el gate de reporte completo debe rechazar ese JSON. Esa limitación impide declarar aceptación de aislamiento persistente, contratos sobre PostgreSQL o los seis E2E.

Durante la ejecución inicial GitHub no encontraba `fa7838b` (checks HTTP 422, status HTTP 404). Tras el commit humano de fase 12 se consultó el SHA completo `b14c1bef5e8797011f7f224fd7290fb4de60140a`: Checks responde HTTP 422 «No commit found» y `gh run list --commit <SHA>` devuelve `[]`. No hay CI verificable para ese commit local. La aceptación requiere `verify`, integración PG18/Redis7/warehouse y seis E2E sobre el SHA final publicado, incluido cualquier commit documental posterior. No se crea PR ni push ni despliegue desde esta fase.

La implementación quedó registrada en `b14c1be` y recibió el ACK «continuar». La consulta posterior a Docker fuera del sandbox sigue confirmando daemon/socket ausente. **El cierre integral queda pendiente de servicios reales, seis E2E y CI del SHA final publicado.** Este seguimiento sólo modifica documentación; no se repiten suites aprobadas sin cambios de código ni un harness cuya precondición sigue ausente. No se marca el plan completado ni se conceden excepciones a sus gates.
