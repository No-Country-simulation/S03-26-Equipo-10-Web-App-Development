import { TestService } from './test.service';

/**
 * Ejemplo de Prueba Unitaria con Jest
 * Skill: SKL-QA-001
 * 
 * Sigue el patrón AAA (Arrange, Act, Assert).
 */

describe('TestService', () => {
  let service: TestService;

  beforeEach(() => {
    service = new TestService();
  });

  it('debe calcular el total correctamente (Happy Path)', () => {
    // 1. Arrange (Preparar)
    const items = [
      { price: 10, quantity: 2 },
      { price: 5, quantity: 1 },
    ];

    // 2. Act (Actuar)
    const result = service.calculateTotal(items);

    // 3. Assert (Afirmar)
    expect(result).toBe(25);
  });

  it('debe lanzar un error si el precio es negativo (Edge Case)', () => {
    const items = [{ price: -10, quantity: 1 }];

    expect(() => service.calculateTotal(items)).toThrow(
      'El precio no puede ser negativo'
    );
  });
});
