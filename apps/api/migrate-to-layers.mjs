/**
 * migrate-to-layers.mjs
 * 
 * Migrates the flat folder structure to NestJS layered architecture.
 * All files are moved from src/{controllers,services,repositories,models,dtos,interfaces}/
 * into their respective src/modules/<domain>/{controllers,services,repositories,entities,dto}/ folders.
 * 
 * Run: node migrate-to-layers.mjs
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync, rmSync, readdirSync, statSync } from 'node:fs';
import { dirname, relative, resolve, join, posix } from 'node:path';

const SRC = resolve('src');

// ─────────────────────────────────────────────────────
// FILE MOVE MAP: { oldRelPath → newRelPath }  (relative to src/)
// ─────────────────────────────────────────────────────
const FILE_MOVES = new Map([
  // ── shared / value-objects ──
  ['models/value-objects/api-key-hash.vo.ts', 'modules/shared/value-objects/api-key-hash.vo.ts'],
  ['models/value-objects/email.vo.ts',        'modules/shared/value-objects/email.vo.ts'],
  ['models/value-objects/rating.vo.ts',       'modules/shared/value-objects/rating.vo.ts'],
  ['models/value-objects/webhook-url.vo.ts',  'modules/shared/value-objects/webhook-url.vo.ts'],

  // ── auth ──
  ['controllers/auth.controller.ts',            'modules/auth/controllers/auth.controller.ts'],
  ['services/auth.service.ts',                  'modules/auth/services/auth.service.ts'],
  ['services/jwt-token.service.ts',             'modules/auth/services/jwt-token.service.ts'],
  ['services/login-attempts.service.ts',        'modules/auth/services/login-attempts.service.ts'],
  ['repositories/auth.repository.ts',           'modules/auth/repositories/auth.repository.ts'],
  ['repositories/prisma-auth.repository.ts',    'modules/auth/repositories/prisma-auth.repository.ts'],
  ['dtos/login.dto.ts',                         'modules/auth/dto/login.dto.ts'],
  ['dtos/refresh-token.dto.ts',                 'modules/auth/dto/refresh-token.dto.ts'],
  ['dtos/register-admin.dto.ts',                'modules/auth/dto/register-admin.dto.ts'],
  ['interfaces/token.port.ts',                  'modules/auth/interfaces/token.port.ts'],

  // ── users ──
  ['controllers/users.controller.ts',           'modules/users/controllers/users.controller.ts'],
  ['services/users.service.ts',                 'modules/users/services/users.service.ts'],
  ['repositories/user.repository.ts',           'modules/users/repositories/user.repository.ts'],
  ['repositories/prisma-user.repository.ts',    'modules/users/repositories/prisma-user.repository.ts'],
  ['dtos/user.dto.ts',                          'modules/users/dto/user.dto.ts'],
  ['models/user.model.ts',                      'modules/users/entities/user.model.ts'],

  // ── tenants ──
  ['controllers/tenants.controller.ts',         'modules/tenants/controllers/tenants.controller.ts'],
  ['services/tenants.service.ts',               'modules/tenants/services/tenants.service.ts'],
  ['repositories/tenant.repository.ts',         'modules/tenants/repositories/tenant.repository.ts'],
  ['repositories/prisma-tenant.repository.ts',  'modules/tenants/repositories/prisma-tenant.repository.ts'],
  ['dtos/update-tenant.dto.ts',                 'modules/tenants/dto/update-tenant.dto.ts'],

  // ── testimonials (includes categories + tags) ──
  ['controllers/testimonials.controller.ts',        'modules/testimonials/controllers/testimonials.controller.ts'],
  ['controllers/public-testimonials.controller.ts', 'modules/testimonials/controllers/public-testimonials.controller.ts'],
  ['controllers/categories.controller.ts',          'modules/testimonials/controllers/categories.controller.ts'],
  ['controllers/tags.controller.ts',                'modules/testimonials/controllers/tags.controller.ts'],
  ['services/testimonials.service.ts',              'modules/testimonials/services/testimonials.service.ts'],
  ['services/categories.service.ts',                'modules/testimonials/services/categories.service.ts'],
  ['services/tags.service.ts',                      'modules/testimonials/services/tags.service.ts'],
  ['repositories/testimonial.repository.ts',        'modules/testimonials/repositories/testimonial.repository.ts'],
  ['repositories/prisma-testimonial.repository.ts', 'modules/testimonials/repositories/prisma-testimonial.repository.ts'],
  ['repositories/category.repository.ts',           'modules/testimonials/repositories/category.repository.ts'],
  ['repositories/prisma-category.repository.ts',    'modules/testimonials/repositories/prisma-category.repository.ts'],
  ['repositories/tag.repository.ts',                'modules/testimonials/repositories/tag.repository.ts'],
  ['repositories/prisma-tag.repository.ts',         'modules/testimonials/repositories/prisma-tag.repository.ts'],
  ['dtos/testimonials.dto.ts',                      'modules/testimonials/dto/testimonials.dto.ts'],
  ['models/testimonial.model.ts',                   'modules/testimonials/entities/testimonial.model.ts'],
  ['models/category.model.ts',                      'modules/testimonials/entities/category.model.ts'],
  ['models/tag.model.ts',                           'modules/testimonials/entities/tag.model.ts'],

  // ── analytics ──
  ['controllers/analytics.controller.ts',           'modules/analytics/controllers/analytics.controller.ts'],
  ['controllers/public-analytics.controller.ts',    'modules/analytics/controllers/public-analytics.controller.ts'],
  ['services/analytics.service.ts',                 'modules/analytics/services/analytics.service.ts'],
  ['repositories/analytics-event.repository.ts',    'modules/analytics/repositories/analytics-event.repository.ts'],
  ['repositories/prisma-analytics-event.repository.ts','modules/analytics/repositories/prisma-analytics-event.repository.ts'],
  ['dtos/track-analytics-event.dto.ts',             'modules/analytics/dto/track-analytics-event.dto.ts'],

  // ── api-keys ──
  ['controllers/api-keys.controller.ts',            'modules/api-keys/controllers/api-keys.controller.ts'],
  ['services/api-keys.service.ts',                  'modules/api-keys/services/api-keys.service.ts'],
  ['repositories/api-key.repository.ts',            'modules/api-keys/repositories/api-key.repository.ts'],
  ['repositories/prisma-api-key.repository.ts',     'modules/api-keys/repositories/prisma-api-key.repository.ts'],
  ['dtos/api-key.dto.ts',                           'modules/api-keys/dto/api-key.dto.ts'],

  // ── webhooks ──
  ['controllers/webhooks.controller.ts',            'modules/webhooks/controllers/webhooks.controller.ts'],
  ['services/webhooks.service.ts',                  'modules/webhooks/services/webhooks.service.ts'],
  ['services/webhook-outbox-handler.service.ts',    'modules/webhooks/services/webhook-outbox-handler.service.ts'],
  ['services/outbox.service.ts',                    'modules/webhooks/services/outbox.service.ts'],
  ['services/outbox.processor.ts',                  'modules/webhooks/services/outbox.processor.ts'],
  ['services/outbox.adapter.ts',                    'modules/webhooks/services/outbox.adapter.ts'],
  ['services/http-webhook-dispatcher.ts',           'modules/webhooks/services/http-webhook-dispatcher.ts'],
  ['services/http-resilience.service.ts',           'modules/webhooks/services/http-resilience.service.ts'],
  ['services/logger.service.ts',                    'modules/webhooks/services/logger.service.ts'],
  ['repositories/webhook.repository.ts',            'modules/webhooks/repositories/webhook.repository.ts'],
  ['repositories/prisma-webhook.repository.ts',     'modules/webhooks/repositories/prisma-webhook.repository.ts'],
  ['dtos/webhook.dto.ts',                           'modules/webhooks/dto/webhook.dto.ts'],
  ['models/webhook.model.ts',                       'modules/webhooks/entities/webhook.model.ts'],
  ['interfaces/outbox.port.ts',                     'modules/webhooks/interfaces/outbox.port.ts'],
  ['interfaces/webhook-dispatcher.port.ts',         'modules/webhooks/interfaces/webhook-dispatcher.port.ts'],

  // ── feature-flags ──
  ['controllers/feature-flags.controller.ts',       'modules/feature-flags/controllers/feature-flags.controller.ts'],
  ['services/feature-flags.service.ts',             'modules/feature-flags/services/feature-flags.service.ts'],
  ['repositories/feature-flag.repository.ts',       'modules/feature-flags/repositories/feature-flag.repository.ts'],
  ['repositories/prisma-feature-flag.repository.ts','modules/feature-flags/repositories/prisma-feature-flag.repository.ts'],
  ['dtos/update-feature-flag.dto.ts',               'modules/feature-flags/dto/update-feature-flag.dto.ts'],

  // ── health ──
  ['controllers/health.controller.ts',              'modules/health/controllers/health.controller.ts'],
  ['services/health-runtime.service.ts',            'modules/health/services/health-runtime.service.ts'],

  // ── docs ──
  ['controllers/docs.controller.ts',                'modules/docs/controllers/docs.controller.ts'],

  // ── shared / adapters ──
  ['services/cloudinary.adapter.ts',                'modules/shared/adapters/cloudinary.adapter.ts'],
  ['services/youtube.adapter.ts',                   'modules/shared/adapters/youtube.adapter.ts'],

  // ── password service → shared/hashing ──
  ['services/password.service.ts',                  'modules/shared/hashing/password.service.ts'],
]);

// ─────────────────────────────────────────────────────
// Build reverse map: absolute old path → absolute new path
// ─────────────────────────────────────────────────────
const absMovesOldToNew = new Map();
const absMovesNewToOld = new Map();

for (const [oldRel, newRel] of FILE_MOVES) {
  const oldAbs = resolve(SRC, oldRel);
  const newAbs = resolve(SRC, newRel);
  absMovesOldToNew.set(oldAbs, newAbs);
  absMovesNewToOld.set(newAbs, oldAbs);
}

// ─────────────────────────────────────────────────────
// Collect ALL .ts files in src/ recursively
// ─────────────────────────────────────────────────────
function walkTs(dir) {
  const results = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const stat = statSync(full);
    if (stat.isDirectory() && entry !== 'node_modules' && entry !== 'dist') {
      results.push(...walkTs(full));
    } else if (entry.endsWith('.ts')) {
      results.push(full);
    }
  }
  return results;
}

// ─────────────────────────────────────────────────────
// Resolve an import specifier to an absolute path
// ─────────────────────────────────────────────────────
function resolveImport(importSpec, fromFileDir) {
  if (!importSpec.startsWith('.')) return null; // skip node_modules
  const abs = resolve(fromFileDir, importSpec);
  // Try .ts extension
  if (existsSync(abs + '.ts')) return abs + '.ts';
  if (existsSync(abs + '/index.ts')) return abs + '/index.ts';
  if (existsSync(abs)) return abs;
  return abs + '.ts'; // assume .ts even if not found
}

// ─────────────────────────────────────────────────────
// Compute new relative import path
// ─────────────────────────────────────────────────────
function computeRelativeImport(fromFileAbs, toFileAbs) {
  const fromDir = dirname(fromFileAbs);
  let rel = relative(fromDir, toFileAbs).replace(/\\/g, '/');
  // Remove .ts extension
  rel = rel.replace(/\.ts$/, '');
  if (!rel.startsWith('.')) rel = './' + rel;
  return rel;
}

// ─────────────────────────────────────────────────────
// Main migration
// ─────────────────────────────────────────────────────
function migrate() {
  console.log('🚀 Starting migration to layered architecture...\n');

  // 1. Create all target directories
  const targetDirs = new Set();
  for (const newPath of absMovesOldToNew.values()) {
    targetDirs.add(dirname(newPath));
  }
  for (const dir of targetDirs) {
    mkdirSync(dir, { recursive: true });
  }
  console.log(`📁 Created ${targetDirs.size} directories`);

  // 2. Read all files, compute their new locations and contents
  const allTsFiles = walkTs(SRC);
  console.log(`📄 Found ${allTsFiles.length} TypeScript files`);

  // 3. For each file, determine its final location
  const fileOperations = []; // { oldPath, newPath, content }

  for (const filePath of allTsFiles) {
    const newPath = absMovesOldToNew.get(filePath) ?? filePath;
    let content = readFileSync(filePath, 'utf-8');

    // Update imports in this file
    content = updateImports(content, filePath, newPath);

    fileOperations.push({ oldPath: filePath, newPath, content });
  }

  // 4. Write all files to their new locations
  let moved = 0;
  let updated = 0;

  for (const op of fileOperations) {
    mkdirSync(dirname(op.newPath), { recursive: true });

    const originalContent = existsSync(op.oldPath) ? readFileSync(op.oldPath, 'utf-8') : '';

    if (op.oldPath !== op.newPath) {
      // File is being moved
      writeFileSync(op.newPath, op.content, 'utf-8');
      // Don't delete yet – some files might reference the old location
      moved++;
    } else if (op.content !== originalContent) {
      // File stays but imports were updated
      writeFileSync(op.newPath, op.content, 'utf-8');
      updated++;
    }
  }

  console.log(`📦 Moved ${moved} files`);
  console.log(`✏️  Updated imports in ${updated} stationary files`);

  // 5. Delete old files that were moved
  for (const oldPath of absMovesOldToNew.keys()) {
    if (existsSync(oldPath)) {
      rmSync(oldPath);
    }
  }
  console.log(`🗑️  Deleted ${absMovesOldToNew.size} old files`);

  // 6. Remove empty directories
  const dirsToClean = [
    resolve(SRC, 'controllers'),
    resolve(SRC, 'services'),
    resolve(SRC, 'repositories'),
    resolve(SRC, 'models'),
    resolve(SRC, 'dtos'),
    resolve(SRC, 'interfaces'),
    resolve(SRC, 'modules/categories'),
    resolve(SRC, 'modules/tags'),
  ];

  for (const dir of dirsToClean) {
    removeEmptyDirs(dir);
  }
  console.log(`🧹 Cleaned empty directories`);

  console.log('\n✅ Migration complete!');
}

function removeEmptyDirs(dir) {
  if (!existsSync(dir)) return;
  try {
    const stat = statSync(dir);
    if (!stat.isDirectory()) return;
  } catch { return; }

  const entries = readdirSync(dir);
  for (const entry of entries) {
    removeEmptyDirs(join(dir, entry));
  }

  // Re-check after recursive cleanup
  if (readdirSync(dir).length === 0) {
    rmSync(dir, { recursive: true });
  }
}

// ─────────────────────────────────────────────────────
// Update import paths in file content
// ─────────────────────────────────────────────────────
function updateImports(content, oldFilePath, newFilePath) {
  // Match: import ... from '...' or import ... from "..."
  // Also match: export ... from '...'
  const importRegex = /((?:import|export)\s+(?:.*?\s+from\s+|)['"])([^'"]+)(['"])/g;

  const oldDir = dirname(oldFilePath);
  const newDir = dirname(newFilePath);

  return content.replace(importRegex, (match, prefix, specifier, suffix) => {
    if (!specifier.startsWith('.')) return match; // skip absolute/node imports

    // Resolve what the old import pointed to
    const resolvedAbs = resolveImportFlexible(specifier, oldDir);
    if (!resolvedAbs) return match;

    // Check if the resolved file was moved
    const resolvedNewAbs = absMovesOldToNew.get(resolvedAbs) ?? resolvedAbs;

    // Compute new relative path from new file location
    const newRelative = computeRelativeImport(newFilePath, resolvedNewAbs);

    return prefix + newRelative + suffix;
  });
}

function resolveImportFlexible(specifier, fromDir) {
  // Try multiple resolution strategies
  const base = resolve(fromDir, specifier);

  // Direct match with .ts
  if (existsSync(base + '.ts')) return base + '.ts';
  // Try as directory with index
  if (existsSync(base + '/index.ts')) return base + '/index.ts';
  // Maybe it's already the full path
  if (existsSync(base) && statSync(base).isFile()) return base;

  // For broken imports, try to match by filename
  // Extract the basename without extension
  const parts = specifier.split('/');
  const leaf = parts[parts.length - 1];

  // Search in our move map for a matching leaf
  for (const [oldPath] of absMovesOldToNew) {
    const oldLeaf = oldPath.split(/[\\/]/).pop()?.replace('.ts', '');
    if (oldLeaf === leaf) {
      return oldPath;
    }
  }

  return base + '.ts'; // best guess
}

// ─────────────────────────────────────────────────────
migrate();
