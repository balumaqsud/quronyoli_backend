import { Module } from '@nestjs/common';
import { TerminusModule } from '@nestjs/terminus';
import { HealthAliasController } from './health-alias.controller';
import { HealthController } from './health.controller';
import { HealthService } from './health.service';

@Module({
  imports: [TerminusModule],
  controllers: [HealthController, HealthAliasController],
  providers: [HealthService],
  exports: [HealthService],
})
export class HealthModule {}
