import { expect, it } from 'vitest';
import { expiryChange, localExpiry } from './key-form';

it('muestra hora de pared local y no cambia el instante original', () => {
  const iso = '2099-10-20T15:32:45.123Z';
  const expected = new Intl.DateTimeFormat('sv-SE', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  })
    .format(new Date(iso))
    .replace(' ', 'T');
  expect(localExpiry(iso)).toBe(expected);
  expect(expiryChange(expected, iso)).toBeUndefined();
});
it('convierte una edición local a UTC una sola vez', () => {
  const expected = new Date(2099, 9, 21, 12, 45).toISOString();
  expect(expiryChange('2099-10-21T12:45', null)).toBe(expected);
});
it('conserva ausencia de vencimiento y rechaza quitarlo o usar fechas pasadas/inválidas', () => {
  expect(localExpiry(null)).toBe('');
  expect(expiryChange('', null)).toBeUndefined();
  expect(() => expiryChange('', '2099-10-20T15:32:45.123Z')).toThrow(
    /no permite quitar/,
  );
  expect(() => expiryChange('2001-01-01T12:00', null)).toThrow(/futuro/);
  expect(() => expiryChange('invalida', null)).toThrow(/no existe/);
  expect(() => expiryChange('2099-02-31T12:00', null)).toThrow(/no existe/);
});
