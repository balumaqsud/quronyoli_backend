export type HealthStatus = 'up' | 'down';

export interface ComponentHealth {
  status: HealthStatus;
}

export interface HealthCheckResult {
  status: 'ok' | 'error';
  info: {
    application: ComponentHealth;
    database: ComponentHealth;
    redis: ComponentHealth;
  };
  details: {
    application: ComponentHealth;
    database: ComponentHealth;
    redis: ComponentHealth;
  };
}
