import {
  act,
  render,
  renderHook,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, expect, it, vi } from 'vitest';
import BillingScreen from './screens/billing-screen';
import PlatformScreen from './screens/platform-screen';
import { CheckoutStatus } from './components/checkout-status';
import { useBillingAction } from './components/use-billing-action';
import { formatMoney, minorFromDecimal, safeCheckoutUrl } from './presentation';
import { loadCatalog } from './api';
import { ApiError } from '@/lib/api';
const { fetchApi, identity } = vi.hoisted(() => ({
  fetchApi: vi.fn(),
  identity: { isAdmin: true },
}));
vi.mock('@/hooks/use-session', () => ({
  useSession: () => ({
    session: { user: { roles: identity.isAdmin ? ['admin'] : ['editor'] } },
    loading: false,
    isAdmin: identity.isAdmin,
    fetchApi,
  }),
}));
const id = '11111111-1111-4111-8111-111111111111',
  priceId = '22222222-2222-4222-8222-222222222222';
const quotas = {
  active_users: 3,
  stored_testimonials: 100,
  active_api_keys: 0,
  active_webhooks: null,
};
const features = {
  media: false,
  analytics: true,
  scoring: false,
  business_intelligence: false,
  bi_statistics: false,
  api_keys: false,
  webhooks: true,
};
const summary = {
  runtime: 'simulation',
  isOperator: false,
  enforcementEnabled: true,
  revision: 0,
  trialConsumed: false,
  access: { mode: 'read_only', canMutate: false },
  plan: null,
  features: null,
  quotas,
  usage: {
    active_users: 1,
    stored_testimonials: 0,
    active_api_keys: 0,
    active_webhooks: 0,
  },
  coverage: null,
  subscription: null,
  change: null,
};
const catalog = [
  {
    id,
    code: 'synthetic',
    archived: false,
    versions: [
      {
        id,
        planId: id,
        version: 1,
        revision: 0,
        status: 'published',
        name: 'Plan de ensayo',
        description: 'Precio sintético para pruebas',
        trialDays: 14,
        graceDays: 7,
        features,
        quotas,
        prices: [
          {
            id: priceId,
            provider: 'stripe',
            currency: 'USD',
            interval: 'month',
            amountMinor: '1999',
            modes: ['manual', 'automatic'],
            ready: true,
          },
        ],
      },
    ],
  },
];
const ok = (data: unknown) => ({ success: true, data });
beforeEach(() => {
  identity.isAdmin = true;
  fetchApi.mockReset();
  fetchApi.mockImplementation(async (path: string, init?: RequestInit) => {
    if (init?.method) return ok({ operationId: id });
    if (path === '/billing/summary') return ok(summary);
    if (path === '/billing/catalog') return ok(catalog);
    if (path.startsWith('/billing/payments'))
      return ok({ items: [], total: 0, page: 1, limit: 20 });
    if (path.startsWith('/billing/operations'))
      return ok({
        id,
        status: 'succeeded',
        kind: 'checkout',
        errorCode: null,
        paymentStatus: 'pending',
      });
    throw Error(`Unexpected request ${path}`);
  });
});
it('conserva centavos y enteros grandes sin redondear el dinero por Number', () => {
  expect(formatMoney('9223372036854775807', 'ARS')).toContain(
    '92.233.720.368.547.758,07',
  );
  expect(minorFromDecimal('1999.90')).toBe('199990');
  for (const invalid of ['0', '01', '1,20', '1.001', '-1', '1e3'])
    expect(() => minorFromDecimal(invalid)).toThrow();
});
it('sólo admite checkout alojado conocido o retorno local de simulación', () => {
  expect(
    safeCheckoutUrl(
      'https://checkout.stripe.com/c/pay/cs_test',
      'sandbox',
      'https://cms.invalid',
    ),
  ).toContain('checkout.stripe.com');
  expect(
    safeCheckoutUrl(
      'https://sandbox.mercadopago.com.ar/checkout/v1/redirect?pref_id=1',
      'sandbox',
      'https://cms.invalid',
    ),
  ).toContain('mercadopago');
  for (const url of [
    'javascript:alert(1)',
    'https://checkout.stripe.com.attacker.invalid',
    'https://user:password@checkout.stripe.com',
    'http://checkout.stripe.com',
  ])
    expect(() =>
      safeCheckoutUrl(url, 'sandbox', 'https://cms.invalid'),
    ).toThrow();
  expect(() =>
    safeCheckoutUrl(
      'https://cms.invalid/admin/billing/return?operation=x',
      'sandbox',
      'https://cms.invalid',
    ),
  ).toThrow();
  expect(
    safeCheckoutUrl(
      'https://cms.invalid/admin/billing/return?operation=x',
      'simulation',
      'https://cms.invalid',
    ),
  ).toContain('operation=x');
});
it('rechaza contratos de catálogo que conviertan el importe a número', async () => {
  fetchApi.mockResolvedValue(
    ok([
      {
        ...catalog[0],
        versions: [
          {
            ...catalog[0]!.versions[0],
            prices: [
              { ...catalog[0]!.versions[0]!.prices[0], amountMinor: 19.99 },
            ],
          },
        ],
      },
    ]),
  );
  await expect(loadCatalog(fetchApi)).rejects.toThrow();
});
it('facturación apagada informa su estado sin consultar catálogo o historial', async () => {
  fetchApi.mockResolvedValue(ok({ ...summary, runtime: 'disabled' }));
  render(<BillingScreen />);
  expect(
    await screen.findByText(/La facturación está desactivada/),
  ).toBeInTheDocument();
  expect(fetchApi).toHaveBeenCalledTimes(1);
});
it('un editor no consulta la información financiera del administrador', () => {
  identity.isAdmin = false;
  render(<BillingScreen />);
  expect(screen.getByText(/El administrador del espacio/)).toBeInTheDocument();
  expect(fetchApi).not.toHaveBeenCalled();
});
it('compara funciones y cuotas y exige confirmar que la prueba no tiene tarjeta ni cobro al terminar', async () => {
  render(<BillingScreen />);
  const user = userEvent.setup();
  await user.click(
    await screen.findByRole('button', { name: 'Probar 14 días sin tarjeta' }),
  );
  const dialog = screen.getByRole('alertdialog');
  expect(dialog).toHaveTextContent(
    'Al terminar no hay cobro automático ni días de gracia',
  );
  expect(dialog).toHaveTextContent('termina la prueba');
  expect(fetchApi.mock.calls.some(([, init]) => init?.method)).toBe(false);
  await user.click(
    within(dialog).getByRole('button', { name: 'Iniciar prueba sin tarjeta' }),
  );
  await waitFor(() =>
    expect(fetchApi).toHaveBeenCalledWith(
      '/billing/trial',
      expect.objectContaining({
        headers: expect.objectContaining({
          'Idempotency-Key': expect.any(String),
        }),
        body: JSON.stringify({ planVersionId: id }),
      }),
    ),
  );
});
it('compra manual explica el período sin renovación antes de enviar sólo precio y modalidad', async () => {
  render(<BillingScreen />);
  const user = userEvent.setup();
  await user.selectOptions(await screen.findByLabelText('Modalidad'), 'manual');
  await user.click(screen.getByRole('button', { name: 'Seleccionar plan' }));
  const dialog = screen.getByRole('alertdialog');
  expect(dialog).toHaveTextContent('no se renueva automáticamente');
  await user.click(
    within(dialog).getByRole('button', { name: 'Continuar al pago' }),
  );
  await waitFor(() =>
    expect(fetchApi).toHaveBeenCalledWith(
      '/billing/checkouts',
      expect.objectContaining({
        body: JSON.stringify({ priceId, mode: 'manual' }),
      }),
    ),
  );
});
it('retorno pendiente no concede acceso; sólo el backend confirmado llama una vez a onConfirmed', async () => {
  const confirmed = vi.fn();
  const { rerender } = render(
    <CheckoutStatus
      id={id}
      fetchApi={fetchApi}
      runtime="simulation"
      onConfirmed={confirmed}
    />,
  );
  expect(await screen.findByText('Confirmación pendiente')).toBeInTheDocument();
  expect(confirmed).not.toHaveBeenCalled();
  fetchApi.mockResolvedValue(
    ok({
      id,
      status: 'succeeded',
      kind: 'checkout',
      errorCode: null,
      paymentStatus: 'confirmed',
    }),
  );
  await userEvent
    .setup()
    .click(screen.getByRole('button', { name: 'Consultar estado' }));
  expect(await screen.findByText('Pago confirmado')).toBeInTheDocument();
  expect(confirmed).toHaveBeenCalledTimes(1);
  rerender(
    <CheckoutStatus
      id={id}
      fetchApi={fetchApi}
      runtime="simulation"
      onConfirmed={confirmed}
    />,
  );
  await userEvent
    .setup()
    .click(screen.getByRole('button', { name: 'Consultar estado' }));
  await waitFor(() => expect(fetchApi).toHaveBeenCalledTimes(3));
  expect(confirmed).toHaveBeenCalledTimes(1);
});
it('conserva Idempotency-Key tras una respuesta incierta y renueva la identidad al aceptar', async () => {
  fetchApi
    .mockRejectedValueOnce(new Error('synthetic timeout'))
    .mockResolvedValue(ok({ accepted: true }));
  const { result } = renderHook(() => useBillingAction(fetchApi));
  await act(async () => {
    await expect(
      result.current.execute('/billing/trial', { planVersionId: id }),
    ).rejects.toThrow();
  });
  await act(async () => {
    await result.current.execute('/billing/trial', { planVersionId: id });
  });
  const first = fetchApi.mock.calls[0]![1].headers['Idempotency-Key'];
  expect(fetchApi.mock.calls[1]![1].headers['Idempotency-Key']).toBe(first);
  await act(async () => {
    await result.current.execute('/billing/trial', { planVersionId: id });
  });
  expect(fetchApi.mock.calls[2]![1].headers['Idempotency-Key']).not.toBe(first);
});
it('el panel de plataforma conserva el error de autorización y no ofrece concederse privilegios', async () => {
  fetchApi.mockRejectedValue(
    new ApiError('Forbidden', 'BILLING_OPERATOR_REQUIRED', 403),
  );
  render(<PlatformScreen />);
  expect(await screen.findByRole('alert')).toHaveTextContent(
    /permiso|autoriz/i,
  );
  expect(screen.queryByText('Publicar versión')).not.toBeInTheDocument();
});

it('el estado de gracia muestra su vencimiento, separado del fin del período pago', async () => {
  fetchApi.mockImplementation(async (path: string) =>
    path === '/billing/summary'
      ? ok({
          ...summary,
          access: { mode: 'grace', canMutate: true },
          coverage: {
            startsAt: '2026-09-20T00:00:00Z',
            endsAt: '2026-10-20T00:00:00Z',
            graceEndsAt: '2026-10-27T00:00:00Z',
          },
        })
      : path === '/billing/catalog'
        ? ok(catalog)
        : ok({ items: [], total: 0, page: 1, limit: 20 }),
  );
  render(<BillingScreen />);
  expect(
    await screen.findByText(/Período de gracia · Hasta 27 oct 2026/),
  ).toBeInTheDocument();
});

it('limita el sondeo pendiente a un minuto y conserva la consulta manual', async () => {
  vi.useFakeTimers();
  try {
    render(<CheckoutStatus id={id} fetchApi={fetchApi} runtime="simulation" />);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(63000);
    });
    expect(
      screen.getByText(/La confirmación sigue pendiente/),
    ).toBeInTheDocument();
    const count = fetchApi.mock.calls.length;
    await act(async () => {
      await vi.advanceTimersByTimeAsync(120000);
    });
    expect(fetchApi).toHaveBeenCalledTimes(count);
    expect(
      screen.getByRole('button', { name: 'Consultar estado' }),
    ).toBeEnabled();
  } finally {
    vi.useRealTimers();
  }
});

it('informa una reversión del pago sin presentar confirmación o un nuevo checkout', async () => {
  fetchApi.mockResolvedValue(
    ok({
      id,
      status: 'succeeded',
      kind: 'checkout',
      errorCode: null,
      paymentStatus: 'reversed',
    }),
  );
  const confirmed = vi.fn();
  render(
    <CheckoutStatus
      id={id}
      fetchApi={fetchApi}
      runtime="simulation"
      onConfirmed={confirmed}
    />,
  );
  expect(await screen.findByText('Pago revertido')).toBeInTheDocument();
  expect(
    screen.getByText(/período asociado fue invalidado/),
  ).toBeInTheDocument();
  expect(confirmed).not.toHaveBeenCalled();
  expect(
    screen.queryByRole('button', { name: 'Abrir checkout seguro' }),
  ).not.toBeInTheDocument();
});

it('permite renovar términos manuales aceptados aunque el plan ya no se ofrezca en catálogo', async () => {
  fetchApi.mockImplementation(async (path: string, init?: RequestInit) =>
    init?.method
      ? ok({ operationId: id })
      : path === '/billing/summary'
        ? ok({
            ...summary,
            trialConsumed: true,
            subscription: {
              id,
              status: 'active',
              mode: 'manual',
              paidThrough: '2026-10-20T00:00:00Z',
              renewalStoppedAt: null,
              price: {
                id: priceId,
                provider: 'stripe',
                currency: 'USD',
                interval: 'month',
                amountMinor: '1999',
              },
            },
          })
        : path === '/billing/catalog'
          ? ok([])
          : path.startsWith('/billing/payments')
            ? ok({ items: [], total: 0, page: 1, limit: 20 })
            : ok({
                id,
                status: 'succeeded',
                kind: 'checkout',
                errorCode: null,
                paymentStatus: 'pending',
              }),
  );
  render(<BillingScreen />);
  const user = userEvent.setup();
  await user.click(
    await screen.findByRole('button', { name: 'Renovar período actual' }),
  );
  const dialog = screen.getByRole('alertdialog');
  expect(dialog).toHaveTextContent('Conservás el precio aceptado');
  await user.click(
    within(dialog).getByRole('button', { name: 'Continuar a la renovación' }),
  );
  await waitFor(() =>
    expect(fetchApi).toHaveBeenCalledWith(
      '/billing/checkouts',
      expect.objectContaining({
        body: JSON.stringify({ priceId, mode: 'manual' }),
      }),
    ),
  );
});
