/** Labels describe the API state; the API remains the lifecycle authority. */
export const testimonialStatusLabels: Record<string, string> = {
  draft: 'Borrador',
  pending: 'Pendiente de revisión',
  approved: 'Aprobado',
  published: 'Publicado',
  rejected: 'Rechazado',
};
export const testimonialStatusHelp: Record<string, string> = {
  draft:
    'Todavía no está en revisión ni es público. Envialo a revisión cuando esté listo.',
  pending:
    'Revisá el contenido para aprobarlo o rechazarlo. Aprobar no lo publica.',
  approved:
    'Está aprobado, pero todavía no es público. Publicalo para mostrarlo en la galería y la API pública.',
  published:
    'Es público. Ocultarlo lo cambia a Rechazado; no se podrá volver a publicar desde ese estado.',
  rejected:
    'No es público. Este estado no admite nuevas transiciones; podés crear un nuevo testimonio si corresponde.',
};
