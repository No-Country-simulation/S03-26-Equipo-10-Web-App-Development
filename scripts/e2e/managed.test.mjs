import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  validateContainer,
  assertMigrationConsent,
  validateOrigin,
} from './managed.mjs';

const runId = 'abcdef123456';
function container() {
  return {
    Name: `/tms-e2e-${runId}-pg`,
    Config: { Labels: { 'testimonial.e2e.run': runId } },
    State: { Running: true },
    HostConfig: { Tmpfs: { '/var/lib/postgresql': 'rw' } },
    Mounts: [{ Type: 'tmpfs', Destination: '/var/lib/postgresql' }],
    NetworkSettings: {
      Ports: { '5432/tcp': [{ HostIp: '127.0.0.1', HostPort: '55432' }] },
    },
  };
}
const options = {
  runId,
  kind: 'pg',
  port: '5432/tcp',
  dataPath: '/var/lib/postgresql',
};
test('acepta sólo el PostgreSQL propio, descartable y publicado en loopback', () => {
  assert.equal(validateContainer(container(), options), 55432);
});
for (const [name, mutate] of [
  [
    'etiqueta ajena',
    (c) => {
      c.Config.Labels['testimonial.e2e.run'] = 'other';
    },
  ],
  [
    'nombre ajeno',
    (c) => {
      c.Name = '/production';
    },
  ],
  [
    'contenedor detenido',
    (c) => {
      c.State.Running = false;
    },
  ],
  [
    'puerto público',
    (c) => {
      c.NetworkSettings.Ports['5432/tcp'][0].HostIp = '0.0.0.0';
    },
  ],
  [
    'doble publicación',
    (c) => {
      c.NetworkSettings.Ports['5432/tcp'].push({
        HostIp: '::',
        HostPort: '55432',
      });
    },
  ],
  [
    'puerto inválido',
    (c) => {
      c.NetworkSettings.Ports['5432/tcp'][0].HostPort = '0';
    },
  ],
  [
    'datos persistentes',
    (c) => {
      c.HostConfig.Tmpfs = {};
    },
  ],
  [
    'bind mount',
    (c) => {
      c.Mounts.push({ Type: 'bind', Destination: '/shared' });
    },
  ],
  [
    'volumen persistente',
    (c) => {
      c.Mounts.push({ Type: 'volume', Destination: '/archive' });
    },
  ],
]) {
  test(`rechaza ${name} antes de construir un destino de migración`, () => {
    const c = container();
    mutate(c);
    assert.throws(() => validateContainer(c, options));
  });
}
test('migraciones requieren confirmación explícita, no se infiere de CI', () => {
  for (const value of [undefined, '', 'true', '0'])
    assert.throws(() => assertMigrationConsent(value));
  assert.doesNotThrow(() => assertMigrationConsent('1'));
});
test('sólo acepta origen HTTPS loopback con puerto explícito', () => {
  const withCredentials = new URL('https://127.0.0.1:35432');
  withCredentials.username = 'synthetic-user';
  withCredentials.password = 'synthetic-password';
  assert.equal(
    validateOrigin('https://127.0.0.1:35432'),
    'https://127.0.0.1:35432',
  );
  for (const url of [
    'https://example.com',
    'http://127.0.0.1:35432',
    'https://127.0.0.1',
    withCredentials.href,
    'https://127.0.0.1:35432/path',
    'https://127.0.0.1:35432?x=1',
  ]) {
    assert.throws(() => validateOrigin(url));
  }
});
