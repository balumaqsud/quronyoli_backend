import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiConflictResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../../infrastructure/auth/interfaces/jwt-payload.interface';
import {
  CreateFavoriteDto,
  ListFavoritesQueryDto,
  UpdateFavoriteDto,
} from './dto/favorite.dto';
import {
  FavoriteResponseDto,
  PaginatedFavoritesResponseDto,
} from './dto/favorite-response.dto';
import { FavoritesService } from './favorites.service';

@ApiTags('Favorites')
@ApiBearerAuth('access-token')
@ApiUnauthorizedResponse({ description: 'Authentication required' })
@Controller({
  path: 'favorites',
  version: '1',
})
export class FavoritesController {
  constructor(private readonly favoritesService: FavoritesService) {}

  @Post()
  @ApiOperation({ summary: 'Create a favorite ayah' })
  @ApiOkResponse({ type: FavoriteResponseDto })
  @ApiBadRequestResponse({ description: 'Validation failed' })
  @ApiConflictResponse({ description: 'Favorite already exists for ayah' })
  create(
    @CurrentUser() currentUser: AuthenticatedUser,
    @Body() dto: CreateFavoriteDto,
  ): Promise<FavoriteResponseDto> {
    return this.favoritesService.create(currentUser.sub, dto);
  }

  @Get()
  @ApiOperation({ summary: 'List favorites' })
  @ApiOkResponse({ type: PaginatedFavoritesResponseDto })
  list(
    @CurrentUser() currentUser: AuthenticatedUser,
    @Query() query: ListFavoritesQueryDto,
  ): Promise<PaginatedFavoritesResponseDto> {
    return this.favoritesService.list(currentUser.sub, query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a favorite by ID' })
  @ApiOkResponse({ type: FavoriteResponseDto })
  @ApiNotFoundResponse({ description: 'Favorite not found' })
  getById(
    @CurrentUser() currentUser: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<FavoriteResponseDto> {
    return this.favoritesService.getById(currentUser.sub, id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a favorite ayah coordinate' })
  @ApiOkResponse({ type: FavoriteResponseDto })
  @ApiNotFoundResponse({ description: 'Favorite not found' })
  @ApiConflictResponse({ description: 'Favorite already exists for ayah' })
  update(
    @CurrentUser() currentUser: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateFavoriteDto,
  ): Promise<FavoriteResponseDto> {
    return this.favoritesService.update(currentUser.sub, id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Hard-delete a favorite' })
  @ApiOkResponse({ description: 'Favorite deleted' })
  @ApiNotFoundResponse({ description: 'Favorite not found' })
  remove(
    @CurrentUser() currentUser: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<{ deleted: true }> {
    return this.favoritesService.remove(currentUser.sub, id);
  }
}
