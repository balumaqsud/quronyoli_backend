import {
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
  ApiTooManyRequestsResponse,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../../infrastructure/auth/interfaces/jwt-payload.interface';
import { ReadingService } from '../reading/reading.service';
import { DailyAyahResponseDto } from './dto/daily-ayah-response.dto';
import {
  AudioTimestampQueryDto,
  LanguageQueryDto,
  PageLookupQueryDto,
  PaginationQueryDto,
  SearchQueryDto,
  VersesQueryDto,
} from './dto/quran-query.dto';
import { QuranRateLimitGuard } from './guards/quran-rate-limit.guard';
import { QuranService } from './quran.service';

@ApiTags('Quran')
@ApiBearerAuth('access-token')
@ApiUnauthorizedResponse({ description: 'Authentication required' })
@ApiTooManyRequestsResponse({ description: 'Per-user rate limit exceeded' })
@UseGuards(QuranRateLimitGuard)
@Controller({
  path: 'quran',
  version: '1',
})
export class QuranController {
  constructor(
    private readonly quranService: QuranService,
    private readonly readingService: ReadingService,
  ) {}

  @Get('surahs')
  @ApiOperation({ summary: 'List surahs/chapters' })
  @ApiOkResponse({ description: 'Surah list from Quran.Foundation' })
  getSurahs(@Query() query: LanguageQueryDto): Promise<unknown> {
    return this.quranService.getSurahs(query);
  }

  @Get('surahs/:id')
  @ApiOperation({ summary: 'Get a surah by ID' })
  @ApiParam({ name: 'id', example: 1 })
  getSurah(
    @Param('id', ParseIntPipe) id: number,
    @Query() query: LanguageQueryDto,
  ): Promise<unknown> {
    return this.quranService.getSurah(id, query);
  }

  @Get('surahs/:id/info')
  @ApiOperation({ summary: 'Get surah info' })
  getSurahInfo(
    @Param('id', ParseIntPipe) id: number,
    @Query() query: LanguageQueryDto,
  ): Promise<unknown> {
    return this.quranService.getSurahInfo(id, query);
  }

  @Get('ayahs/by-surah/:chapter')
  @ApiOperation({ summary: 'Get ayahs by surah number' })
  getAyahsBySurah(
    @Param('chapter', ParseIntPipe) chapter: number,
    @Query() query: VersesQueryDto,
  ): Promise<unknown> {
    return this.quranService.getAyahsBySurah(chapter, query);
  }

  @Get('ayahs/daily')
  @ApiOperation({
    summary: 'Get the Daily Ayah for the user local calendar date',
    description:
      'Deterministic verse for today in the user timezone. Does not record a reading open.',
  })
  @ApiOkResponse({ type: DailyAyahResponseDto })
  async getDailyAyah(
    @CurrentUser() currentUser: AuthenticatedUser,
    @Query() query: VersesQueryDto,
  ): Promise<DailyAyahResponseDto> {
    const timezone = await this.readingService.getTimezone(currentUser.sub);
    return this.quranService.getDailyAyah(timezone, query);
  }

  @Get('ayahs/by-key/:verseKey')
  @ApiOperation({
    summary: 'Get an ayah by verse key (e.g. 1:1)',
    description:
      'Retrieves ayah content and automatically records reading progress/history for the authenticated user.',
  })
  async getAyahByKey(
    @CurrentUser() currentUser: AuthenticatedUser,
    @Param('verseKey') verseKey: string,
    @Query() query: VersesQueryDto,
  ): Promise<unknown> {
    const content = await this.quranService.getAyahByKey(verseKey, query);
    await this.readingService.recordAyahOpen(currentUser.sub, verseKey);
    return content;
  }

  @Get('ayahs/by-juz/:juz')
  @ApiOperation({ summary: 'Get ayahs by juz number' })
  getAyahsByJuz(
    @Param('juz', ParseIntPipe) juz: number,
    @Query() query: VersesQueryDto,
  ): Promise<unknown> {
    return this.quranService.getAyahsByJuz(juz, query);
  }

  @Get('ayahs/by-page/:page')
  @ApiOperation({ summary: 'Get ayahs by page number' })
  getAyahsByPage(
    @Param('page', ParseIntPipe) page: number,
    @Query() query: VersesQueryDto,
  ): Promise<unknown> {
    return this.quranService.getAyahsByPage(page, query);
  }

  @Get('juz')
  @ApiOperation({ summary: 'List juz metadata' })
  getJuzs(): Promise<unknown> {
    return this.quranService.getJuzs();
  }

  @Get('juz/:id')
  @ApiOperation({ summary: 'Get juz metadata by ID' })
  getJuz(@Param('id', ParseIntPipe) id: number): Promise<unknown> {
    return this.quranService.getJuz(id);
  }

  @Get('pages')
  @ApiOperation({ summary: 'List pages' })
  getPages(@Query() query: LanguageQueryDto): Promise<unknown> {
    return this.quranService.getPages(query);
  }

  @Get('pages/lookup')
  @ApiOperation({ summary: 'Lookup mushaf page boundaries' })
  lookupPages(@Query() query: PageLookupQueryDto): Promise<unknown> {
    return this.quranService.lookupPages(query);
  }

  @Get('pages/:pageNumber')
  @ApiOperation({ summary: 'Get page metadata' })
  getPage(
    @Param('pageNumber', ParseIntPipe) pageNumber: number,
    @Query() query: LanguageQueryDto,
  ): Promise<unknown> {
    return this.quranService.getPage(pageNumber, query);
  }

  @Get('translations')
  @ApiOperation({ summary: 'List translation resources' })
  getTranslations(@Query() query: LanguageQueryDto): Promise<unknown> {
    return this.quranService.getTranslations(query);
  }

  @Get('translations/:translationId/info')
  @ApiOperation({ summary: 'Get translation resource info' })
  getTranslationInfo(
    @Param('translationId', ParseIntPipe) translationId: number,
  ): Promise<unknown> {
    return this.quranService.getTranslationInfo(translationId);
  }

  @Get('translations/:resourceId/by-surah/:chapter')
  @ApiOperation({ summary: 'Get translation content by surah' })
  getTranslationBySurah(
    @Param('resourceId', ParseIntPipe) resourceId: number,
    @Param('chapter', ParseIntPipe) chapter: number,
    @Query() query: PaginationQueryDto,
  ): Promise<unknown> {
    return this.quranService.getTranslationBySurah(resourceId, chapter, query);
  }

  @Get('translations/:resourceId/by-ayah/:ayahKey')
  @ApiOperation({ summary: 'Get translation content by ayah key' })
  getTranslationByAyah(
    @Param('resourceId', ParseIntPipe) resourceId: number,
    @Param('ayahKey') ayahKey: string,
  ): Promise<unknown> {
    return this.quranService.getTranslationByAyah(resourceId, ayahKey);
  }

  @Get('translations/:resourceId/by-juz/:juz')
  @ApiOperation({ summary: 'Get translation content by juz' })
  getTranslationByJuz(
    @Param('resourceId', ParseIntPipe) resourceId: number,
    @Param('juz', ParseIntPipe) juz: number,
    @Query() query: PaginationQueryDto,
  ): Promise<unknown> {
    return this.quranService.getTranslationByJuz(resourceId, juz, query);
  }

  @Get('translations/:resourceId/by-page/:page')
  @ApiOperation({ summary: 'Get translation content by page' })
  getTranslationByPage(
    @Param('resourceId', ParseIntPipe) resourceId: number,
    @Param('page', ParseIntPipe) page: number,
    @Query() query: PaginationQueryDto,
  ): Promise<unknown> {
    return this.quranService.getTranslationByPage(resourceId, page, query);
  }

  @Get('tafsirs')
  @ApiOperation({ summary: 'List tafsir resources' })
  getTafsirs(@Query() query: LanguageQueryDto): Promise<unknown> {
    return this.quranService.getTafsirs(query);
  }

  @Get('tafsirs/:tafsirId/info')
  @ApiOperation({ summary: 'Get tafsir resource info' })
  getTafsirInfo(
    @Param('tafsirId', ParseIntPipe) tafsirId: number,
  ): Promise<unknown> {
    return this.quranService.getTafsirInfo(tafsirId);
  }

  @Get('tafsirs/:resourceId/by-surah/:chapter')
  @ApiOperation({ summary: 'Get tafsir content by surah' })
  getTafsirBySurah(
    @Param('resourceId', ParseIntPipe) resourceId: number,
    @Param('chapter', ParseIntPipe) chapter: number,
    @Query() query: PaginationQueryDto,
  ): Promise<unknown> {
    return this.quranService.getTafsirBySurah(resourceId, chapter, query);
  }

  @Get('tafsirs/:resourceId/by-ayah/:ayahKey')
  @ApiOperation({ summary: 'Get tafsir content by ayah key' })
  getTafsirByAyah(
    @Param('resourceId', ParseIntPipe) resourceId: number,
    @Param('ayahKey') ayahKey: string,
  ): Promise<unknown> {
    return this.quranService.getTafsirByAyah(resourceId, ayahKey);
  }

  @Get('tafsirs/:resourceId/by-juz/:juz')
  @ApiOperation({ summary: 'Get tafsir content by juz' })
  getTafsirByJuz(
    @Param('resourceId', ParseIntPipe) resourceId: number,
    @Param('juz', ParseIntPipe) juz: number,
    @Query() query: PaginationQueryDto,
  ): Promise<unknown> {
    return this.quranService.getTafsirByJuz(resourceId, juz, query);
  }

  @Get('tafsirs/:resourceId/by-page/:page')
  @ApiOperation({ summary: 'Get tafsir content by page' })
  getTafsirByPage(
    @Param('resourceId', ParseIntPipe) resourceId: number,
    @Param('page', ParseIntPipe) page: number,
    @Query() query: PaginationQueryDto,
  ): Promise<unknown> {
    return this.quranService.getTafsirByPage(resourceId, page, query);
  }

  @Get('audio/recitations')
  @ApiOperation({ summary: 'List ayah-by-ayah recitation resources' })
  getRecitations(@Query() query: LanguageQueryDto): Promise<unknown> {
    return this.quranService.getRecitations(query);
  }

  @Get('audio/chapter-reciters')
  @ApiOperation({ summary: 'List chapter reciters' })
  getChapterReciters(@Query() query: LanguageQueryDto): Promise<unknown> {
    return this.quranService.getChapterReciters(query);
  }

  @Get('audio/chapter-reciters/:reciterId')
  @ApiOperation({ summary: 'Get all chapter audio files for a reciter' })
  getChapterAudioFiles(
    @Param('reciterId', ParseIntPipe) reciterId: number,
  ): Promise<unknown> {
    return this.quranService.getChapterAudioFiles(reciterId);
  }

  @Get('audio/chapter-reciters/:reciterId/:chapter')
  @ApiOperation({ summary: 'Get one chapter audio file' })
  getChapterAudioFile(
    @Param('reciterId', ParseIntPipe) reciterId: number,
    @Param('chapter', ParseIntPipe) chapter: number,
  ): Promise<unknown> {
    return this.quranService.getChapterAudioFile(reciterId, chapter);
  }

  @Get('audio/recitations/:recitationId/by-surah/:chapter')
  @ApiOperation({ summary: 'Get ayah audio URLs by surah' })
  getAyahAudioBySurah(
    @Param('recitationId', ParseIntPipe) recitationId: number,
    @Param('chapter', ParseIntPipe) chapter: number,
    @Query() query: PaginationQueryDto,
  ): Promise<unknown> {
    return this.quranService.getAyahAudioBySurah(recitationId, chapter, query);
  }

  @Get('audio/recitations/:recitationId/by-ayah/:ayahKey')
  @ApiOperation({ summary: 'Get ayah audio URL by verse key' })
  getAyahAudioByKey(
    @Param('recitationId', ParseIntPipe) recitationId: number,
    @Param('ayahKey') ayahKey: string,
  ): Promise<unknown> {
    return this.quranService.getAyahAudioByKey(recitationId, ayahKey);
  }

  @Get('audio/reciters/:reciterId/timestamps')
  @ApiOperation({ summary: 'Get audio timestamps for a reciter' })
  getAudioTimestamps(
    @Param('reciterId', ParseIntPipe) reciterId: number,
    @Query() query: AudioTimestampQueryDto,
  ): Promise<unknown> {
    return this.quranService.getAudioTimestamps(reciterId, query);
  }

  @Get('search')
  @ApiOperation({ summary: 'Search Quran content via Quran.Foundation Search' })
  search(@Query() query: SearchQueryDto): Promise<unknown> {
    return this.quranService.search(query);
  }
}
