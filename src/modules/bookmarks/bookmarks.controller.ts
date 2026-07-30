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
  CreateBookmarkDto,
  ListBookmarksQueryDto,
  UpdateBookmarkDto,
} from './dto/bookmark.dto';
import {
  BookmarkResponseDto,
  PaginatedBookmarksResponseDto,
} from './dto/bookmark-response.dto';
import { BookmarksService } from './bookmarks.service';

@ApiTags('Bookmarks')
@ApiBearerAuth('access-token')
@ApiUnauthorizedResponse({ description: 'Authentication required' })
@Controller({
  path: 'bookmarks',
  version: '1',
})
export class BookmarksController {
  constructor(private readonly bookmarksService: BookmarksService) {}

  @Post()
  @ApiOperation({ summary: 'Create a bookmark' })
  @ApiOkResponse({ type: BookmarkResponseDto })
  @ApiBadRequestResponse({ description: 'Validation failed' })
  @ApiConflictResponse({
    description: 'Active bookmark already exists for ayah',
  })
  create(
    @CurrentUser() currentUser: AuthenticatedUser,
    @Body() dto: CreateBookmarkDto,
  ): Promise<BookmarkResponseDto> {
    return this.bookmarksService.create(currentUser.sub, dto);
  }

  @Get()
  @ApiOperation({ summary: 'List active bookmarks' })
  @ApiOkResponse({ type: PaginatedBookmarksResponseDto })
  list(
    @CurrentUser() currentUser: AuthenticatedUser,
    @Query() query: ListBookmarksQueryDto,
  ): Promise<PaginatedBookmarksResponseDto> {
    return this.bookmarksService.list(currentUser.sub, query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get an active bookmark by ID' })
  @ApiOkResponse({ type: BookmarkResponseDto })
  @ApiNotFoundResponse({ description: 'Bookmark not found' })
  getById(
    @CurrentUser() currentUser: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<BookmarkResponseDto> {
    return this.bookmarksService.getById(currentUser.sub, id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update an active bookmark' })
  @ApiOkResponse({ type: BookmarkResponseDto })
  @ApiNotFoundResponse({ description: 'Bookmark not found' })
  @ApiConflictResponse({
    description: 'Active bookmark already exists for ayah',
  })
  update(
    @CurrentUser() currentUser: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateBookmarkDto,
  ): Promise<BookmarkResponseDto> {
    return this.bookmarksService.update(currentUser.sub, id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Soft-delete a bookmark' })
  @ApiOkResponse({ description: 'Bookmark soft-deleted' })
  @ApiNotFoundResponse({ description: 'Bookmark not found' })
  remove(
    @CurrentUser() currentUser: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<{ deleted: true }> {
    return this.bookmarksService.remove(currentUser.sub, id);
  }
}
