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
import { HttpCache } from '../../common/decorators/http-cache.decorator';
import { AuthenticatedUser } from '../../infrastructure/auth/interfaces/jwt-payload.interface';
import { DailyAyahResponseDto } from './dto/daily-ayah-response.dto';
import {
  MushafPageDetailDto,
  MushafPageVersesResponseDto,
} from './dto/mushaf-page-response.dto';
import {
  AudioTimestampQueryDto,
  LanguageQueryDto,
  MushafPagesQueryDto,
  PageLookupQueryDto,
  PaginationQueryDto,
  ScriptQueryDto,
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
  constructor(private readonly quranService: QuranService) {}

  @Get('surahs')
  @HttpCache('private-short')
  @ApiOperation({ summary: 'List surahs/chapters' })
  @ApiOkResponse({ description: 'Surah list from Quran.Foundation' })
  getSurahs(@Query() query: LanguageQueryDto): Promise<unknown> {
    return this.quranService.getSurahs(query);
  }

  @Get('surahs/:id')
  @HttpCache('private-short')
  @ApiOperation({ summary: 'Get a surah by ID' })
  @ApiParam({ name: 'id', example: 1 })
  getSurah(
    @Param('id', ParseIntPipe) id: number,
    @Query() query: LanguageQueryDto,
  ): Promise<unknown> {
    return this.quranService.getSurah(id, query);
  }

  @Get('surahs/:id/info')
  @HttpCache('private-short')
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
    return this.quranService.getDailyAyahForUser(currentUser.sub, query);
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
    return this.quranService.getAyahByKeyForUser(
      currentUser.sub,
      verseKey,
      query,
    );
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
  @ApiOperation({
    summary: 'Get ayahs by Mushaf page number',
    description:
      'Alias of GET /pages/:page/verses. Returns local page metadata plus QF verse bodies.',
  })
  @ApiParam({ name: 'page', example: 1 })
  @ApiOkResponse({ type: MushafPageVersesResponseDto })
  getAyahsByPage(
    @Param('page', ParseIntPipe) page: number,
    @Query() query: VersesQueryDto,
  ): Promise<unknown> {
    return this.quranService.getAyahsByPage(page, query);
  }

  @Get('ayahs/by-hizb/:hizb')
  @ApiOperation({ summary: 'Get ayahs by hizb number' })
  getAyahsByHizb(
    @Param('hizb', ParseIntPipe) hizb: number,
    @Query() query: VersesQueryDto,
  ): Promise<unknown> {
    return this.quranService.getAyahsByHizb(hizb, query);
  }

  @Get('ayahs/by-rub/:rub')
  @ApiOperation({ summary: 'Get ayahs by rub number' })
  getAyahsByRub(
    @Param('rub', ParseIntPipe) rub: number,
    @Query() query: VersesQueryDto,
  ): Promise<unknown> {
    return this.quranService.getAyahsByRub(rub, query);
  }

  @Get('ayahs/by-rub-el-hizb/:rub')
  @ApiOperation({ summary: 'Get ayahs by rub el hizb number' })
  getAyahsByRubElHizb(
    @Param('rub', ParseIntPipe) rub: number,
    @Query() query: VersesQueryDto,
  ): Promise<unknown> {
    return this.quranService.getAyahsByRubElHizb(rub, query);
  }

  @Get('ayahs/by-ruku/:ruku')
  @ApiOperation({ summary: 'Get ayahs by ruku number' })
  getAyahsByRuku(
    @Param('ruku', ParseIntPipe) ruku: number,
    @Query() query: VersesQueryDto,
  ): Promise<unknown> {
    return this.quranService.getAyahsByRuku(ruku, query);
  }

  @Get('ayahs/by-manzil/:manzil')
  @ApiOperation({ summary: 'Get ayahs by manzil number' })
  getAyahsByManzil(
    @Param('manzil', ParseIntPipe) manzil: number,
    @Query() query: VersesQueryDto,
  ): Promise<unknown> {
    return this.quranService.getAyahsByManzil(manzil, query);
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
  @HttpCache('private-short')
  @ApiOperation({
    summary: 'List Madani Mushaf page metadata',
    description:
      'Returns locally synced page metadata plus total/totalPages (604 for mushaf=1). Not a live QF GET /pages proxy — run qf:sync-pages first. Cached under Redis key pages:list.',
  })
  @ApiOkResponse({
    description: '{ pages: MushafPageListItemDto[], total, totalPages }',
  })
  getPages(@Query() query: MushafPagesQueryDto): Promise<unknown> {
    return this.quranService.getPages(query);
  }

  @Get('pages/lookup')
  @ApiOperation({ summary: 'Lookup mushaf page boundaries (live QF proxy)' })
  lookupPages(@Query() query: PageLookupQueryDto): Promise<unknown> {
    return this.quranService.lookupPages(query);
  }

  @Get('pages/:pageNumber/verses')
  @ApiOperation({
    summary: 'Get verses for a Mushaf page',
    description:
      'Composes local page metadata with Quran.Foundation verse bodies (Arabic text + words by default; translations/audio/tafsir via query). Verse text is not stored in Postgres. Cached under page:{n}:verses:{digest}.',
  })
  @ApiParam({ name: 'pageNumber', example: 1 })
  @ApiOkResponse({ type: MushafPageVersesResponseDto })
  getPageVerses(
    @Param('pageNumber', ParseIntPipe) pageNumber: number,
    @Query() query: VersesQueryDto,
  ): Promise<unknown> {
    return this.quranService.getPageVerses(pageNumber, query);
  }

  @Get('pages/:pageNumber')
  @HttpCache('private-short')
  @ApiOperation({
    summary: 'Get Mushaf page metadata by page number',
    description:
      'Local mushaf_pages row: verse keys, surah ids, juz/hizb/rub, optional image meta. Cached under Redis key page:{n}.',
  })
  @ApiParam({ name: 'pageNumber', example: 1 })
  @ApiOkResponse({ type: MushafPageDetailDto })
  getPage(
    @Param('pageNumber', ParseIntPipe) pageNumber: number,
    @Query() query: MushafPagesQueryDto,
  ): Promise<unknown> {
    return this.quranService.getPage(pageNumber, query);
  }

  @Get('hizbs')
  @HttpCache('private-short')
  @ApiOperation({ summary: 'List hizb metadata' })
  getHizbs(): Promise<unknown> {
    return this.quranService.getHizbs();
  }

  @Get('hizbs/:id')
  @HttpCache('private-short')
  @ApiOperation({ summary: 'Get hizb metadata by ID' })
  getHizb(@Param('id', ParseIntPipe) id: number): Promise<unknown> {
    return this.quranService.getHizb(id);
  }

  @Get('rub-el-hizbs')
  @HttpCache('private-short')
  @ApiOperation({ summary: 'List rub el hizb metadata' })
  getRubElHizbs(): Promise<unknown> {
    return this.quranService.getRubElHizbs();
  }

  @Get('rub-el-hizbs/:id')
  @HttpCache('private-short')
  @ApiOperation({ summary: 'Get rub el hizb metadata by ID' })
  getRubElHizb(@Param('id', ParseIntPipe) id: number): Promise<unknown> {
    return this.quranService.getRubElHizb(id);
  }

  @Get('rukus')
  @HttpCache('private-short')
  @ApiOperation({ summary: 'List ruku metadata' })
  getRukus(): Promise<unknown> {
    return this.quranService.getRukus();
  }

  @Get('rukus/:id')
  @HttpCache('private-short')
  @ApiOperation({ summary: 'Get ruku metadata by ID' })
  getRuku(@Param('id', ParseIntPipe) id: number): Promise<unknown> {
    return this.quranService.getRuku(id);
  }

  @Get('manzils')
  @HttpCache('private-short')
  @ApiOperation({ summary: 'List manzil metadata' })
  getManzils(): Promise<unknown> {
    return this.quranService.getManzils();
  }

  @Get('manzils/:id')
  @HttpCache('private-short')
  @ApiOperation({ summary: 'Get manzil metadata by ID' })
  getManzil(@Param('id', ParseIntPipe) id: number): Promise<unknown> {
    return this.quranService.getManzil(id);
  }

  @Get('languages')
  @HttpCache('private-short')
  @ApiOperation({ summary: 'List Quran.Foundation language resources' })
  getLanguages(@Query() query: LanguageQueryDto): Promise<unknown> {
    return this.quranService.getLanguages(query);
  }

  @Get('mushafs')
  @HttpCache('private-short')
  @ApiOperation({
    summary: 'List known mushaf IDs for verse/page rendering',
    description:
      'Static metadata — Quran.Foundation has no /resources/mushafs catalog. Pass mushaf= on verse queries. Classic Medina 1405 is included only when QF_MUSHAF_1405_IMAGE_BASE is set and 604 pages are synced.',
  })
  getMushafs(): Promise<{ mushafs: unknown }> {
    return this.quranService.getMushafs();
  }

  @Get('scripts/:script')
  @ApiOperation({
    summary: 'Get Quran text in a specific script (e.g. uthmani_tajweed)',
  })
  @ApiParam({
    name: 'script',
    example: 'uthmani_tajweed',
    description:
      'uthmani | uthmani_tajweed | uthmani_simple | imlaei | indopak | indopak_nastaleeq | code_v1 | code_v2 | qpc_hafs',
  })
  getScript(
    @Param('script') script: string,
    @Query() query: ScriptQueryDto,
  ): Promise<unknown> {
    return this.quranService.getScript(script, query);
  }

  @Get('footnotes/:id')
  @ApiOperation({
    summary: 'Get a translation footnote by ID',
    description:
      'Footnote IDs come from <sup foot_note=ID> markers in translation HTML.',
  })
  getFootnote(@Param('id', ParseIntPipe) id: number): Promise<unknown> {
    return this.quranService.getFootnote(id);
  }

  @Get('translations')
  @HttpCache('private-short')
  @ApiOperation({ summary: 'List translation resources' })
  getTranslations(@Query() query: LanguageQueryDto): Promise<unknown> {
    return this.quranService.getTranslations(query);
  }

  @Get('translations/:translationId/info')
  @HttpCache('private-short')
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
  @HttpCache('private-short')
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
  search(
    @CurrentUser() currentUser: AuthenticatedUser,
    @Query() query: SearchQueryDto,
  ): Promise<unknown> {
    return this.quranService.search(currentUser.sub, query);
  }
}
