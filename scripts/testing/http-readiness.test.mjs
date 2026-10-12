import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { spawn } from 'node:child_process';
import { once } from 'node:events';

async function probe(t, resets, retries) {
  let requests = 0;
  const server = createServer((req, res) => {
    requests += 1;
    if (requests <= resets) req.socket.destroy();
    else {
      res.writeHead(200);
      res.end('ready');
    }
  });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(
    () =>
      new Promise((resolve) => {
        server.closeAllConnections();
        server.close(resolve);
      }),
  );
  const child = spawn(
    'bash',
    [
      'scripts/wait-http.sh',
      `http://127.0.0.1:${server.address().port}/health`,
      String(retries),
    ],
    { stdio: 'ignore', timeout: 5000 },
  );
  const [code] = await once(child, 'exit');
  return { code, requests };
}
test('readiness acepta el servicio sólo después de recuperarse de un reset de arranque', async (t) => {
  const result = await probe(t, 1, 1);
  assert.equal(result.code, 0);
  assert.equal(result.requests, 2);
});
test('readiness conserva el fallo cuando agota el presupuesto de sondeos', async (t) => {
  const result = await probe(t, Number.POSITIVE_INFINITY, 1);
  // curl may report a TCP reset (56) or an empty HTTP reply (52).
  assert.ok([52, 56].includes(result.code));
  assert.equal(result.requests, 2);
});
