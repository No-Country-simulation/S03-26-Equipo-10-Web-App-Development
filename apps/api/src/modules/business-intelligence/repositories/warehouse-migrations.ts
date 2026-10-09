import { createHash } from 'node:crypto';
import { PrismaClient } from '@prisma/client';
import { EtlError } from '../etl.types';

/** Initial DDL grammar: quoted strings/identifiers and comments; function bodies are deliberately unsupported. */
export function migrationStatements(sql: string): string[] {
  const statements: string[] = [];
  let current = '';
  let quote: "'" | '"' | null = null;
  let lineComment = false;
  for (let i = 0; i < sql.length; i += 1) {
    const char = sql.charAt(i);
    const next = sql.charAt(i + 1);
    if (lineComment) { if (char === '\n') { lineComment = false; current += '\n'; } continue; }
    if (quote) {
      current += char;
      if (char === quote) {
        if (next === quote) { current += next; i += 1; } else quote = null;
      }
    } else if (char === '-' && next === '-') { lineComment = true; i += 1; }
    else if (char === '/' && next === '*' || char === '$') throw new EtlError('BI_MIGRATION_INVALID');
    else if (char === "'" || char === '"') { quote = char; current += char; }
    else if (char === ';') { if (current.trim()) statements.push(current.trim()); current = ''; }
    else current += char;
  }
  if (quote || current.trim()) throw new EtlError('BI_MIGRATION_INVALID');
  return statements.filter(statement => !['BEGIN', 'COMMIT'].includes(statement.toUpperCase()));
}

// Migrator only. Never called by ETL, HTTP or application startup.
export async function applyWarehouseMigration(client: PrismaClient, version: string, sql: string): Promise<boolean> {
  if (!/^\d{4}_[a-z_]+\.sql$/.test(version)) throw new EtlError('BI_MIGRATION_INVALID');
  const checksum = createHash('sha256').update(sql).digest('hex');
  const statements = migrationStatements(sql);
  return client.$transaction(async tx => {
    await tx.$executeRaw`SET LOCAL lock_timeout = '1s'`;
    await tx.$executeRaw`SET LOCAL statement_timeout = '30s'`;
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(543001)`;
    const [ledger] = await tx.$queryRaw<Array<{ exists: boolean }>>`SELECT to_regclass('etl.schema_migrations') IS NOT NULL AS exists`;
    if (ledger?.exists) {
      const [applied] = await tx.$queryRaw<Array<{ checksum: string }>>`
        SELECT checksum FROM etl.schema_migrations WHERE version = ${version}`;
      if (applied) {
        if (applied.checksum !== checksum) throw new EtlError('BI_MIGRATION_DRIFT');
        return false;
      }
    } else if (version !== '0001_initial.sql') throw new EtlError('BI_MIGRATION_INVALID');
    for (const statement of statements) await tx.$executeRawUnsafe(statement);
    await tx.$executeRaw`INSERT INTO etl.schema_migrations (version, checksum) VALUES (${version}, ${checksum})`;
    return true;
  }, { maxWait: 5000, timeout: 35000 });
}
