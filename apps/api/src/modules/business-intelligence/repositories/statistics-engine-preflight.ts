import type { PrismaClient } from '@prisma/client';

export async function statisticsEngineReady(target: PrismaClient, enabled: boolean): Promise<boolean> {
  if (!enabled) return false;
  try {
    const [permissions] = await target.$queryRaw<Array<{ ready: boolean }>>`
      WITH required(relation, privilege) AS (VALUES
        ('etl.statistics_jobs', 'SELECT'), ('etl.statistics_jobs', 'INSERT'), ('etl.statistics_jobs', 'UPDATE'),
        ('dw.statistics_publication', 'SELECT'), ('dw.statistics_publication', 'INSERT'),
        ('dw.statistics_current', 'SELECT'), ('dw.statistics_current', 'INSERT'), ('dw.statistics_current', 'UPDATE'))
      SELECT bool_and(coalesce(has_table_privilege(current_user, to_regclass(relation), privilege), false)) AS ready FROM required`;
    return permissions?.ready === true;
  } catch { return false; }
}
