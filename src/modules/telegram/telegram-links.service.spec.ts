import { TelegramLinksService } from './telegram-links.service';

describe('TelegramLinksService', () => {
  const service = new TelegramLinksService({
    getOrThrow: () => ({
      botUsername: 'QuronYoliBot',
      miniAppUrl: 'https://t.me/QuronYoliBot/app',
    }),
  } as never);

  it('builds mini app and share links', () => {
    const links = service.getMiniAppLinks();
    expect(links.botDeepLink).toContain('t.me/QuronYoliBot?start=app');
    expect(links.miniAppDeepLink).toBe('https://t.me/QuronYoliBot/app');
    expect(links.shareUrl).toContain('t.me/share/url');
  });

  it('builds ayah share links', () => {
    const links = service.getAyahShareLinks(2, 255);
    expect(links.verseKey).toBe('2:255');
    expect(links.botDeepLink).toContain('start=ayah_2_255');
    expect(links.miniAppDeepLink).toContain('startapp=ayah_2_255');
  });
});
