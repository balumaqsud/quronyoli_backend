import { Module } from '@nestjs/common';
import { UsersModule } from '../users/users.module';
import { ReadingController } from './reading.controller';
import { ReadingRepository } from './reading.repository';
import { ReadingService } from './reading.service';

@Module({
  imports: [UsersModule],
  controllers: [ReadingController],
  providers: [ReadingRepository, ReadingService],
  exports: [ReadingService],
})
export class ReadingModule {}
