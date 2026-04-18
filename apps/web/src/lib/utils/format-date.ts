/**
 * Purpose: Shared date formatting utility for consistent locale-aware dates.
 */

/**
 * Formats a date string to a human-readable Spanish locale format.
 * @param dateStr - ISO date string or Date-compatible value.
 * @param options - Optional Intl.DateTimeFormatOptions overrides.
 * @returns Formatted date string, e.g. "18 de abril de 2026".
 */
export function formatDate(
  dateStr: string | Date,
  options: Intl.DateTimeFormatOptions = { year: 'numeric', month: 'long', day: 'numeric' },
): string {
  try {
    return new Date(dateStr).toLocaleDateString('es-ES', options);
  } catch {
    return '—';
  }
}
