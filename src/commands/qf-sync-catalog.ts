/**
 * Idempotent Quran.Foundation catalog sync into local Postgres.
 * Usage: npm run qf:sync-catalog
 */
import { NestFactory } from '@nestjs/core';
import { Logger } from 'nestjs-pino';
import { QfCatalogSyncModule } from '../modules/quran/catalog/qf-catalog-sync.module';
import { QfCatalogSyncService } from '../modules/quran/catalog/qf-catalog-sync.service';

async function main(): Promise<void> {
  const app = await NestFactory.createApplicationContext(QfCatalogSyncModule, {
    bufferLogs: true,
  });
  app.useLogger(app.get(Logger));

  try {
    const syncService = app.get(QfCatalogSyncService);
    const result = await syncService.syncAll();

    console.log(JSON.stringify({ ok: true, result }, null, 2));
  } finally {
    await app.close();
  }
}

main().catch((error: unknown) => {
  const message =
    error instanceof Error ? (error.stack ?? error.message) : error;

  console.error(message);
  process.exitCode = 1;
});
