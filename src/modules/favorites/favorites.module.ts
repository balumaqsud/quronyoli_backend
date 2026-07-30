import { Module } from '@nestjs/common';
import { UsersModule } from '../users/users.module';
import { FavoritesController } from './favorites.controller';
import { FavoritesRepository } from './favorites.repository';
import { FavoritesService } from './favorites.service';

@Module({
  imports: [UsersModule],
  controllers: [FavoritesController],
  providers: [FavoritesRepository, FavoritesService],
  exports: [FavoritesService],
})
export class FavoritesModule {}
