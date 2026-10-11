// Next 15 carga este adaptador síncrono mediante CommonJS.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { isAbsolute } = require('node:path');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { globSync: findDirectories } = require('tinyglobby');

// Next 15 sólo usa globSync(pattern, { onlyDirectories: true }).
// Fallá ante cambios de ese contrato; no simules el resto de fast-glob.
exports.globSync = (pattern, options) => {
  if (
    typeof pattern !== 'string' ||
    options?.onlyDirectories !== true ||
    Object.keys(options).some((key) => key !== 'onlyDirectories')
  ) {
    throw new TypeError('El adaptador sólo admite el contrato de directorios de Next 15');
  }
  return findDirectories(pattern, {
    onlyDirectories: true,
    expandDirectories: false,
    absolute: isAbsolute(pattern),
  }).map((directory) => directory.length > 1 && directory.endsWith('/') ? directory.slice(0, -1) : directory);
};
