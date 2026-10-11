import {
  cpSync,
  existsSync,
  mkdirSync,
  readFileSync,
  realpathSync,
} from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join, relative, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

// Copy the installed lockfile-resolved Prisma CLI closure, not the builder's development toolchain.
export function collectTools(root, output, entries = ['prisma']) {
  root = realpathSync(root);
  const copied = new Set();
  const locate = (name, parent, optional) => {
    const search =
      createRequire(join(parent, 'package.json')).resolve.paths(name) ?? [];
    for (const directory of search) {
      const path = join(directory, name);
      if (!existsSync(join(path, 'package.json'))) continue;
      const real = realpathSync(path);
      const inside = relative(root, real);
      if (inside.startsWith('..') || !inside.includes('node_modules'))
        throw new Error('MAINTENANCE_DEPENDENCY_OUTSIDE_ROOT');
      return real;
    }
    if (!optional) throw new Error('MAINTENANCE_DEPENDENCY_MISSING');
  };
  const visit = (name, parent, optional = false) => {
    const source = locate(name, parent, optional);
    if (!source || copied.has(source)) return;
    copied.add(source);
    const pkg = JSON.parse(readFileSync(join(source, 'package.json'), 'utf8'));
    const target = join(output, relative(root, source));
    mkdirSync(dirname(target), { recursive: true });
    cpSync(source, target, {
      recursive: true,
      dereference: true,
      filter: (path) =>
        !relative(source, path).split('/').includes('node_modules'),
    });
    const optionalNames = new Set(Object.keys(pkg.optionalDependencies ?? {}));
    for (const dependency of Object.keys({
      ...pkg.dependencies,
      ...pkg.optionalDependencies,
    }))
      visit(dependency, source, optionalNames.has(dependency));
    for (const dependency of Object.keys(pkg.peerDependencies ?? {}))
      if (pkg.peerDependenciesMeta?.[dependency]?.optional !== true)
        visit(dependency, source);
  };
  for (const name of entries) visit(name, root);
  return [...copied].map((path) => relative(root, path)).sort();
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  if (process.argv.length !== 4)
    throw new Error('MAINTENANCE_ARGUMENTS_INVALID');
  const copied = collectTools(
    resolve(process.argv[2]),
    resolve(process.argv[3]),
  );
  console.log(
    JSON.stringify({ event: 'maintenance.tools_collected', packages: copied }),
  );
}
