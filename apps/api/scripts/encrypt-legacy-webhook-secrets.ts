import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import type { ConfigService } from '@nestjs/config';
import { WebhookSecretService } from '../src/modules/webhooks/services/webhook-secret.service';

async function main(): Promise<void> {
  const databaseUrl = process.env.DATABASE_URL;
  const encodedKeys = process.env.WEBHOOK_SECRET_KEYS_JSON;
  const version = Number(process.env.WEBHOOK_SECRET_CURRENT_VERSION ?? 1);
  if (!databaseUrl || !encodedKeys || !Number.isSafeInteger(version) || version < 1) {
    throw new Error('DATABASE_URL, WEBHOOK_SECRET_KEYS_JSON and current version are required');
  }
  const keys = JSON.parse(encodedKeys) as Record<string, string>;
  const service = new WebhookSecretService({
    getOrThrow: () => ({ webhookSecrets: { keys, currentKeyVersion: version } }),
  } as unknown as ConfigService);
  const prisma = new PrismaClient({ datasources: { db: { url: databaseUrl } } });
  try {
    const pending = await prisma.webhook.count({ where: { secret: { not: null } } });
    if (!process.argv.includes('--apply')) {
      process.stdout.write(`Dry run: ${pending} legacy webhook secrets need encryption. Pass --apply after approval.\n`);
      return;
    }
    let encryptedCount = 0;
    while (true) {
      const batch = await prisma.webhook.findMany({
        where: { secret: { not: null } }, orderBy: { id: 'asc' }, take: 100,
        select: { id: true, tenantId: true, secret: true },
      });
      if (batch.length === 0) break;
      let batchCount = 0;
      for (const row of batch) {
        if (row.secret === null) continue;
        // An empty legacy value never signed deliveries; clear it as unsigned.
        const encrypted = row.secret.length > 0
          ? service.encrypt(row.tenantId, row.id, row.secret) : null;
        const result = await prisma.webhook.updateMany({
          where: { id: row.id, secret: row.secret },
          data: { secret: null, secretCiphertext: encrypted?.ciphertext ?? null,
            secretKeyVersion: encrypted?.keyVersion ?? null },
        });
        encryptedCount += result.count;
        batchCount += result.count;
      }
      if (batchCount === 0) throw new Error('Legacy webhook secrets changed concurrently');
    }
    process.stdout.write(`Encrypted ${encryptedCount} legacy webhook secrets.\n`);
  } finally {
    await prisma.$disconnect();
  }
}

void main().catch(error => {
  process.stderr.write(`Webhook secret backfill failed: ${error instanceof Error ? error.name : 'unknown'}\n`);
  process.exitCode = 1;
});
