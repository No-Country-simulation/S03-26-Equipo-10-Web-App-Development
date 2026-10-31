import {
  moneyFromDecimal,
  moneyFromWire,
  moneyToDecimal,
  moneyToWire,
} from '../src/modules/billing/domain/money';

describe('billing exact money contract', () => {
  it('round trips values above Number.MAX_SAFE_INTEGER without rounding', () => {
    const value = moneyFromWire('9007199254740993', 'ARS');
    expect(value.amountMinor).toBe(9007199254740993n);
    expect(moneyToWire(value)).toEqual({
      amountMinor: '9007199254740993',
      currency: 'ARS',
    });
    expect(moneyToDecimal(value)).toBe('90071992547409.93');
  });
  it.each([
    '-1',
    '1.5',
    '01',
    '+1',
    '',
    '1e3',
    ' 10',
    '10 ',
    'NaN',
    '9223372036854775808',
  ])('rejects noncanonical or overflowing minor amount %j', (value) => {
    expect(() => moneyFromWire(value, 'USD')).toThrow('BILLING_MONEY_INVALID');
  });
  it.each([
    ['0', '0.00'],
    ['1', '0.01'],
    ['100', '1.00'],
    ['101', '1.01'],
    ['9223372036854775807', '92233720368547758.07'],
  ])('converts %s minor units to %s exactly', (minor, decimal) => {
    expect(moneyToDecimal(moneyFromWire(minor, 'USD'))).toBe(decimal);
  });
  it.each([
    ['0', 0n],
    ['1', 100n],
    ['0.01', 1n],
    ['10.5', 1050n],
    ['90071992547409.93', 9007199254740993n],
  ])('parses decimal text %s', (decimal, amount) => {
    expect(moneyFromDecimal(decimal, 'ARS')).toEqual({
      amountMinor: amount,
      currency: 'ARS',
    });
  });
  it.each([
    '0.001',
    '01.00',
    '-1.00',
    '1e2',
    ' 1',
    '1.',
    '.5',
    '92233720368547758.08',
  ])('rejects implicit rounding or invalid decimal %s', (value) => {
    expect(() => moneyFromDecimal(value, 'ARS')).toThrow(
      'BILLING_MONEY_INVALID',
    );
  });
  it('validates internally constructed values before serialization', () => {
    expect(() => moneyToWire({ amountMinor: -1n, currency: 'USD' })).toThrow(
      'BILLING_MONEY_INVALID',
    );
  });
});
