/**
 * Idempotent Madani Mushaf page metadata sync into local Postgres.
 *
 * Usage:
 *   npm run qf:sync-pages
 *   npm run qf:sync-pages -- --mushaf=1
 *   npm run qf:sync-pages -- --mushaf=4,5,19 --clone-from=1
 *
 * `--clone-from` copies 604 Madani page coordinates from a synced source
 * (recommended when editions share the same Madani layout: 1, 4, 5, 19).
 */
import { NestFactory } from '@nestjs/core';
import { Logger } from 'nestjs-pino';
import { QfPagesSyncModule } from '../modules/quran/pages/qf-pages-sync.module';
import { QfPagesSyncService } from '../modules/quran/pages/qf-pages-sync.service';
import { DEFAULT_MUSHAF_ID } from '../modules/quran/pages/qf-pages.constants';

function parseMushafIds(argv: string[]): number[] {
  const flag = argv.find((arg) => arg.startsWith('--mushaf='));
  if (!flag) {
    return [DEFAULT_MUSHAF_ID];
  }
  const raw = flag.slice('--mushaf='.length);
  const ids = raw
    .split(',')
    .map((part) => Number(part.trim()))
    .filter((id) => Number.isFinite(id) && id > 0);
  if (ids.length === 0) {
    throw new Error(`Invalid --mushaf value: ${raw}`);
  }
  return ids;
}

function parseCloneFrom(argv: string[]): number | null {
  const flag = argv.find((arg) => arg.startsWith('--clone-from='));
  if (!flag) {
    return null;
  }
  const id = Number(flag.slice('--clone-from='.length));
  if (!Number.isFinite(id) || id <= 0) {
    throw new Error(`Invalid --clone-from value: ${flag}`);
  }
  return id;
}

async function main(): Promise<void> {
  const argv = process.argv.slice(2);
  const mushafIds = parseMushafIds(argv);
  const cloneFrom = parseCloneFrom(argv);

  const app = await NestFactory.createApplicationContext(QfPagesSyncModule, {
    bufferLogs: true,
  });
  app.useLogger(app.get(Logger));

  try {
    const syncService = app.get(QfPagesSyncService);
    const results = [];

    for (const mushafId of mushafIds) {
      if (cloneFrom != null) {
        if (mushafId === cloneFrom) {
          results.push(await syncService.syncMadaniPages(mushafId));
        } else {
          results.push(
            await syncService.cloneMadaniPagesFrom(cloneFrom, mushafId),
          );
        }
      } else {
        results.push(await syncService.syncMadaniPages(mushafId));
      }
    }

    console.log(JSON.stringify({ ok: true, results }, null, 2));
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
