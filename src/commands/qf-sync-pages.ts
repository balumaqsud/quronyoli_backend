/**
 * Idempotent Madani Mushaf page metadata sync into local Postgres.
 * Usage: npm run qf:sync-pages
 */
import { NestFactory } from '@nestjs/core';
import { Logger } from 'nestjs-pino';
import { QfPagesSyncModule } from '../modules/quran/pages/qf-pages-sync.module';
import { QfPagesSyncService } from '../modules/quran/pages/qf-pages-sync.service';

async function main(): Promise<void> {
  const app = await NestFactory.createApplicationContext(QfPagesSyncModule, {
    bufferLogs: true,
  });
  app.useLogger(app.get(Logger));

  try {
    const syncService = app.get(QfPagesSyncService);
    const result = await syncService.syncMadaniPages();

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
