import { Module } from '@nestjs/common';
import { UsersModule } from '../users/users.module';
import { AnalyticsModule } from '../analytics/analytics.module';
import { BookmarksController } from './bookmarks.controller';
import { BookmarksRepository } from './bookmarks.repository';
import { BookmarksService } from './bookmarks.service';

@Module({
  imports: [UsersModule, AnalyticsModule],
  controllers: [BookmarksController],
  providers: [BookmarksRepository, BookmarksService],
  exports: [BookmarksService],
})
export class BookmarksModule {}
