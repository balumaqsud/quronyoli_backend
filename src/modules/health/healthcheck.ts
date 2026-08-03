/**
 * Shared health-check helpers for application, database, and Redis probes.
 * Controllers: `/api/v1/health*` and unversioned `/api/health`.
 */
export type HealthComponentStatus = 'up' | 'down';

export interface HealthComponent {
  status: HealthComponentStatus;
}

export interface ApplicationHealthPayload {
  status: 'ok' | 'error';
  details: {
    application: HealthComponent;
    database: HealthComponent;
    redis: HealthComponent;
  };
}

export const buildHealthPayload = (input: {
  databaseHealthy: boolean;
  redisHealthy: boolean;
}): ApplicationHealthPayload => {
  const database: HealthComponent = {
    status: input.databaseHealthy ? 'up' : 'down',
  };
  const redis: HealthComponent = {
    status: input.redisHealthy ? 'up' : 'down',
  };
  const application: HealthComponent = { status: 'up' };
  const isHealthy = input.databaseHealthy && input.redisHealthy;

  return {
    status: isHealthy ? 'ok' : 'error',
    details: {
      application,
      database,
      redis,
    },
  };
};
