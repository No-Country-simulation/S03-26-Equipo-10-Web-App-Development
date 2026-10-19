import Link from 'next/link';
import { Header } from '@/components/landing/Header';
import { Footer } from '@/components/landing/Footer';

const topics = [
  ['captura', 'Recibir testimonios'],
  ['moderacion', 'Revisar y organizar'],
  ['publicacion', 'Publicar y compartir'],
  ['api-keys', 'Conectar por API'],
  ['webhooks', 'Configurar webhooks'],
] as const;
const linkClass = 'text-primary underline underline-offset-4';
const sectionClass = 'scroll-mt-28 border-t pt-8';
export default function HelpScreen() {
  return (
    <div className="min-h-screen bg-background font-body text-foreground">
      <Header />
      <main
        id="main-content"
        tabIndex={-1}
        className="container py-12 sm:py-16"
      >
        <header className="mb-10 max-w-3xl">
          <h1 className="text-balance font-caption text-4xl font-light italic leading-tight sm:text-6xl">
            De la primera historia a la publicación.
          </h1>
          <p className="mt-6 max-w-prose text-base leading-relaxed text-muted-foreground">
            Configurá tu espacio, recibí testimonios y decidí cuáles compartir.
            Esta guía describe las acciones disponibles en el panel.
          </p>
        </header>
        <div className="grid items-start gap-10 lg:grid-cols-[14rem_minmax(0,1fr)] lg:gap-16">
          <nav
            aria-label="Temas de ayuda"
            className="min-w-0 lg:sticky lg:top-28"
          >
            <h2 className="text-base font-semibold">En esta guía</h2>
            <ul className="mt-3">
              {topics.map(([id, label]) => (
                <li key={id}>
                  <a
                    href={`#${id}`}
                    className={`${linkClass} inline-flex min-h-11 items-center py-2 text-sm`}
                  >
                    {label}
                  </a>
                </li>
              ))}
            </ul>
            <Link
              href="/admin"
              className="mt-4 inline-flex min-h-11 items-center text-sm font-medium underline underline-offset-4"
            >
              Ir al panel
            </Link>
          </nav>
          <div className="min-w-0 max-w-prose space-y-12 text-base leading-relaxed">
            <section
              id="captura"
              aria-labelledby="capture-help-title"
              className={sectionClass}
            >
              <h2
                id="capture-help-title"
                className="font-caption text-3xl italic"
              >
                Recibí testimonios con tu marca
              </h2>
              <ol className="mt-5 list-decimal space-y-4 pl-6">
                <li>
                  Entrá como administrador a{' '}
                  <Link className={linkClass} href="/admin/settings#brand">
                    Configuración → Marca
                  </Link>
                  . Guardá el nombre del espacio y, si querés, su logo.
                </li>
                <li>
                  En{' '}
                  <Link className={linkClass} href="/admin/settings#capture">
                    Enlace y recepción
                  </Link>
                  , guardá un identificador, copiá el enlace y abrí la
                  recepción. Compartí el enlace de captura{' '}
                  <code className="break-all">/p/tu-identificador</code>.
                </li>
                <li>
                  El formulario pide nombre, texto y una valoración de 1 a 5
                  elegida por la persona. La foto y el enlace de YouTube son
                  opcionales. La foto admite PNG, JPEG o WebP de hasta 10 MiB.
                </li>
              </ol>
              <p className="mt-5 text-muted-foreground">
                Los envíos quedan pendientes de revisión. Cerrar la recepción
                impide nuevos envíos; conserva la marca, los testimonios
                existentes y la galería pública.
              </p>
              <details className="mt-5 border p-4">
                <summary className="cursor-pointer py-1 font-medium">
                  El texto se guardó, pero faltó un adjunto
                </summary>
                <p className="mt-3">
                  Si la confirmación indica recepción parcial, el texto ya quedó
                  guardado. No reenvíes el formulario completo: avisale al
                  administrador qué medio falta para que revise la historia
                  desde el panel.
                </p>
              </details>
            </section>
            <section
              id="moderacion"
              aria-labelledby="review-help-title"
              className={sectionClass}
            >
              <h2
                id="review-help-title"
                className="font-caption text-3xl italic"
              >
                Revisá antes de publicar
              </h2>
              <ol className="mt-5 list-decimal space-y-4 pl-6">
                <li>
                  Abrí{' '}
                  <Link
                    className={linkClass}
                    href="/admin/testimonials?status=pending"
                  >
                    Testimonios pendientes
                  </Link>
                  . Buscá por autor o contenido y filtrá por estado, categoría o
                  etiquetas.
                </li>
                <li>
                  Abrí una historia y revisá el texto y los medios.
                  Administradores y editores pueden moderar. La edición depende
                  también de la propiedad del testimonio y de su estado; el
                  contenido publicado no se edita.
                </li>
                <li>
                  Aprobá si está listo para compartirse o rechazalo cuando no
                  corresponda. <strong>Aprobar no publica.</strong> Un borrador
                  creado en el panel debe enviarse a revisión antes de
                  aprobarse.
                </li>
              </ol>
              <p className="mt-5 text-muted-foreground">
                Categorías y etiquetas organizan las historias. El orden por
                relevancia usa el scoring disponible: valoración, vistas, clics
                y antigüedad desde la publicación. No verifica la veracidad del
                testimonio ni predice conversiones.
              </p>
              <details className="mt-5 border p-4">
                <summary className="cursor-pointer py-1 font-medium">
                  Quiero ocultar o eliminar una historia
                </summary>
                <p className="mt-3">
                  Ocultar un publicado lo pasa a Rechazado y deja de mostrarlo
                  al público; ese estado no permite volver a publicarlo. Si una
                  historia tiene actividad registrada, el borrado se impide para
                  conservarla. Revisá la consecuencia y los permisos que muestra
                  el panel antes de confirmar.
                </p>
              </details>
            </section>
            <section
              id="publicacion"
              aria-labelledby="publish-help-title"
              className={sectionClass}
            >
              <h2
                id="publish-help-title"
                className="font-caption text-3xl italic"
              >
                Publicá y compartí tu galería
              </h2>
              <ol className="mt-5 list-decimal space-y-4 pl-6">
                <li>
                  Entrá a{' '}
                  <Link
                    className={linkClass}
                    href="/admin/testimonials?status=approved"
                  >
                    Testimonios aprobados
                  </Link>
                  , abrí la historia y elegí Publicar. La API confirma el cambio
                  de estado.
                </li>
                <li>
                  Compartí la galería{' '}
                  <code className="break-all">/t/tu-identificador</code> usando
                  el identificador guardado en Configuración. Sólo muestra
                  historias publicadas y permite cargar más resultados.
                </li>
                <li>
                  Consultá{' '}
                  <Link className={linkClass} href="/admin/analytics">
                    Analítica
                  </Link>{' '}
                  para ver las interacciones registradas y abrir la historia
                  asociada a cada evento.
                </li>
              </ol>
              <p className="mt-5 text-muted-foreground">
                Visualizaciones, clics y reproducciones son eventos; no
                representan personas únicas ni ventas. El navegador puede
                bloquear el tracking. Los informes de inteligencia de negocio
                usan cortes históricos y muestran su vigencia cuando el módulo
                está habilitado en el entorno.
              </p>
            </section>
            <section
              id="integraciones"
              aria-labelledby="integrations-help-title"
              className={sectionClass}
            >
              <h2
                id="integrations-help-title"
                className="font-caption text-3xl italic"
              >
                Conectá tu aplicación
              </h2>
              <p className="mt-5">
                Los administradores gestionan{' '}
                <Link className={linkClass} href="/admin/settings#integrations">
                  API keys y webhooks
                </Link>
                . La API sirve para consultar contenido; los webhooks notifican
                eventos a un receptor que configures.
              </p>
              <section
                id="api-keys"
                aria-labelledby="keys-help-title"
                className="mt-8 scroll-mt-28"
              >
                <h3 id="keys-help-title" className="text-xl font-semibold">
                  API keys: acceso desde tu servidor
                </h3>
                <ol className="mt-4 list-decimal space-y-4 pl-6">
                  <li>
                    En{' '}
                    <Link className={linkClass} href="/admin/api-keys">
                      API keys
                    </Link>
                    , creá una clave con un nombre que identifique la
                    integración y los permisos que necesita. Para leer
                    testimonios publicados, usá el scope{' '}
                    <code>testimonials:read</code>.
                  </li>
                  <li>
                    Copiá la clave cuando se revele y guardala en el gestor de
                    secretos de tu servidor. Si falla la copia, seleccioná el
                    valor y copialo manualmente. No la incluyas en código
                    público ni en el navegador de tus visitantes.
                  </li>
                  <li>
                    Tu servidor puede consultar{' '}
                    <code className="break-all">
                      GET /api/v1/public/testimonials
                    </code>{' '}
                    con la clave en el encabezado{' '}
                    <code>Authorization: Bearer</code>. La respuesta paginada
                    contiene <code>data</code> y <code>meta</code>. El permiso
                    Testimonios del espacio debe estar habilitado para esta API.
                  </li>
                  <li>
                    Al rotar, actualizá la integración y comprobá el acceso. La
                    gracia de la clave anterior es de hasta 24 horas y puede
                    terminar antes por vencimiento o revocación. Una clave
                    vencida o revocada requiere crear otra.
                  </li>
                </ol>
                <p className="mt-4 text-muted-foreground">
                  La galería por identificador público tiene su propia consulta
                  anónima:{' '}
                  <code className="break-all">
                    GET /api/v1/public/testimonials/tenants/tu-identificador
                  </code>
                  . No necesita que expongas una API key.
                </p>
              </section>
              <section
                id="webhooks"
                aria-labelledby="webhooks-help-title"
                className="mt-10 scroll-mt-28"
              >
                <h3 id="webhooks-help-title" className="text-xl font-semibold">
                  Webhooks: del evento a tu receptor
                </h3>
                <ol className="mt-4 list-decimal space-y-4 pl-6">
                  <li>
                    En{' '}
                    <Link className={linkClass} href="/admin/webhooks">
                      Webhooks
                    </Link>
                    , creá un destino HTTPS y elegí el evento que querés
                    recibir. Guardá el secreto revelado: no volverá a mostrarse.
                  </li>
                  <li>
                    Configurá tu receptor para verificar la firma sobre los
                    bytes exactos recibidos y deduplicar los eventos. La entrega
                    puede repetirse; recibirla más de una vez no debe duplicar
                    el efecto en tu sistema.
                  </li>
                  <li>
                    Solicitá una prueba y abrí el historial del destino.{' '}
                    <strong>Encolada</strong> confirma la solicitud, no la
                    entrega. Revisá el resultado HTTP y los intentos para
                    comprobar qué ocurrió.
                  </li>
                  <li>
                    Si falla, corregí el receptor antes de reenviar una entrega.
                    Podés editar URL y evento, o pausar nuevos eventos. Las
                    entregas ya encoladas pueden continuar durante la pausa.
                  </li>
                </ol>
                <p className="mt-4 text-muted-foreground">
                  Al rotar el secreto, seguí la fecha de gracia que informa el
                  panel. Una respuesta 2xx confirma la recepción HTTP; no
                  garantiza el procesamiento interno del receptor. Los
                  parámetros técnicos Analítica y Webhooks no controlan el
                  acceso ni detienen la actividad.
                </p>
              </section>
            </section>
            <div className="border-t pt-8">
              <h2 className="text-xl font-semibold">Prepará tu espacio</h2>
              <p className="mt-3">
                Si todavía no tenés una cuenta administradora,{' '}
                <Link className={linkClass} href="/admin/register">
                  creá un espacio
                </Link>
                . Si ya tenés acceso,{' '}
                <Link className={linkClass} href="/admin/login">
                  ingresá al panel
                </Link>
                .
              </p>
            </div>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
