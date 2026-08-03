import { mkdirSync } from 'fs';
import { join } from 'path';
import type { TransportMultiOptions } from 'pino';

/**
 * Production Pino transport targets:
 * - stdout (container logs)
 * - application.log (info+)
 * - error.log (error+)
 * - http.log (info+; request logs share the same logger pipeline)
 */
export const createProductionTransport = (
  logDir: string,
): TransportMultiOptions => {
  mkdirSync(logDir, { recursive: true });

  return {
    targets: [
      {
        target: 'pino/file',
        level: 'info',
        options: { destination: 1 },
      },
      {
        target: 'pino-roll',
        level: 'info',
        options: {
          file: join(logDir, 'application'),
          frequency: 'daily',
          mkdir: true,
          size: '50m',
        },
      },
      {
        target: 'pino-roll',
        level: 'error',
        options: {
          file: join(logDir, 'error'),
          frequency: 'daily',
          mkdir: true,
          size: '50m',
        },
      },
      {
        target: 'pino-roll',
        level: 'info',
        options: {
          file: join(logDir, 'http'),
          frequency: 'daily',
          mkdir: true,
          size: '50m',
        },
      },
    ],
  };
};
