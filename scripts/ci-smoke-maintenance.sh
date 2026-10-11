#!/usr/bin/env bash
set -euo pipefail

image="${1:-testimonial-cms-maintenance:ci}"
options=(--rm --network none --read-only --cap-drop ALL
  --security-opt no-new-privileges --tmpfs /tmp:rw,nosuid,nodev,size=64m)

# Compare the packaged migration bytes to the repository, without connecting to a database.
node --input-type=module - <<'JS' | docker run "${options[@]}" -i "$image" -e '
const assert = require("node:assert/strict");
const fs = require("node:fs");
const {createHash} = require("node:crypto");
const expected = JSON.parse(fs.readFileSync(0, "utf8"));
assert.notEqual(process.getuid(), 0);
assert.equal(process.cwd(), "/app/apps/api");
for (const {path, hash} of expected) {
  assert.equal(createHash("sha256").update(fs.readFileSync(`/app/${path}`)).digest("hex"), hash, path);
}
for (const path of ["/usr/local/bin/npm", "/usr/local/bin/npx", "/usr/local/lib/node_modules/npm",
  "/app/node_modules/supabase", "/app/node_modules/eslint"]) {
  assert.equal(fs.existsSync(path), false, path);
}
const cli = require("/app/apps/api/dist/modules/business-intelligence/migration.cli.js");
const migrations = cli.selectMigrations(fs.readdirSync("warehouse/migrations"), "0004_bi_operations.sql");
assert.equal(migrations.length, 4);
assert.equal(typeof require("/app/node_modules/@prisma/client").PrismaClient, "function");
assert.equal(typeof require("/app/node_modules/prisma/package.json").version, "string");
assert.throws(() => fs.writeFileSync("/app/rootfs-probe", "x"), {code: "EROFS"});
fs.writeFileSync("/tmp/maintenance-probe", "x");
fs.unlinkSync("/tmp/maintenance-probe");
console.log(`maintenance: non-root, read-only, ${expected.length} source files verified, BI/Prisma loadable`);
'
import {createHash} from 'node:crypto';
import {readFileSync, readdirSync} from 'node:fs';
const files = ['apps/api/prisma/schema.prisma'];
const walk = directory => {
  for (const entry of readdirSync(directory, {withFileTypes: true})) {
    const path = `${directory}/${entry.name}`;
    if (entry.isDirectory()) walk(path);
    else files.push(path);
  }
};
walk('apps/api/prisma/migrations');
walk('apps/api/warehouse/migrations');
console.log(JSON.stringify(files.map(path => ({path, hash: createHash('sha256').update(readFileSync(path)).digest('hex')}))));
JS

# Exercise the Prisma native schema engine offline; this only produces SQL on stdout.
docker run "${options[@]}" \
  --env DATABASE_URL=postgresql://postgres@127.0.0.1:5432/unused \
  "$image" /app/node_modules/prisma/build/index.js migrate diff \
  --from-empty --to-schema-datamodel /app/apps/api/prisma/schema.prisma --script >/dev/null

# An invocation without an explicit maintenance command must fail closed.
status=0
output="$(docker run "${options[@]}" "$image" 2>&1)" || status=$?
test "$status" -eq 1
test "$output" = 'Explicit maintenance command required'
echo 'maintenance: offline schema engine and explicit-command guard passed'
