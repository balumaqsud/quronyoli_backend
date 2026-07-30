import { Module } from '@nestjs/common';
import { UsersModule } from '../users/users.module';
import { BookmarksController } from './bookmarks.controller';
import { BookmarksRepository } from './bookmarks.repository';
import { BookmarksService } from './bookmarks.service';

@Module({
  imports: [UsersModule],
  controllers: [BookmarksController],
  providers: [BookmarksRepository, BookmarksService],
  exports: [BookmarksService],
})
export class BookmarksModule {}
