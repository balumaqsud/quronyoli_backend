import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { Pool } from 'pg';
import { DatabaseConfig } from '../../config/configuration';
import { CONFIG_KEYS } from '../../common/constants';
import { PrismaClient } from '../../generated/prisma';

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  private readonly pool: Pool;

  constructor(
    configService: ConfigService,
    @InjectPinoLogger(PrismaService.name)
    private readonly logger: PinoLogger,
  ) {
    const databaseConfig = configService.getOrThrow<DatabaseConfig>(
      CONFIG_KEYS.DATABASE,
    );
    const pool = new Pool({
      connectionString: databaseConfig.url,
    });
    const adapter = new PrismaPg(pool);

    super({ adapter });
    this.pool = pool;
  }

  async onModuleInit(): Promise<void> {
    await this.$connect();
    this.logger.info('PostgreSQL connection established');
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
    await this.pool.end();
    this.logger.info('PostgreSQL connection closed');
  }

  async isHealthy(): Promise<boolean> {
    try {
      await this.$queryRaw`SELECT 1`;
      return true;
    } catch (error) {
      this.logger.error({ err: error }, 'PostgreSQL health check failed');
      return false;
    }
  }
}
