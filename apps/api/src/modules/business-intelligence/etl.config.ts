import { EtlError } from './etl.types';

export function databaseUrl(value: string | undefined, connections: number): string {
  try {
    if (!value) throw new Error();
    const url = new URL(value);
    if (!['postgres:', 'postgresql:'].includes(url.protocol) || !url.hostname
      || url.pathname.length <= 1 || url.hash) throw new Error();
    url.searchParams.set('connection_limit', String(connections));
    url.searchParams.set('pool_timeout', '5');
    url.searchParams.set('connect_timeout', '5');
    return url.toString();
  } catch { throw new EtlError('BI_CONFIGURATION_INVALID'); }
}

export function etlConfig(env: NodeJS.ProcessEnv = process.env) {
  const sourceUrl = databaseUrl(env.BI_SOURCE_DATABASE_URL, 1);
  const warehouseUrl = databaseUrl(env.BI_ETL_DATABASE_URL, 2);
  const source = new URL(sourceUrl);
  const target = new URL(warehouseUrl);
  const sameServer = source.hostname.toLowerCase() === target.hostname.toLowerCase() && (source.port || '5432') === (target.port || '5432')
    && source.searchParams.get('host') === target.searchParams.get('host');
  if (sameServer && (env.NODE_ENV === 'production' || source.pathname === target.pathname)) {
    throw new EtlError('BI_CONFIGURATION_INVALID');
  }
  return { sourceUrl, warehouseUrl, pageSize: 1000 };
}
