import { Module } from '@nestjs/common';
import { UsersModule } from '../users/users.module';
import { AnalyticsModule } from '../analytics/analytics.module';
import { ReadingController } from './reading.controller';
import { ReadingRepository } from './reading.repository';
import { ReadingService } from './reading.service';

@Module({
  imports: [UsersModule, AnalyticsModule],
  controllers: [ReadingController],
  providers: [ReadingRepository, ReadingService],
  exports: [ReadingService],
})
export class ReadingModule {}
