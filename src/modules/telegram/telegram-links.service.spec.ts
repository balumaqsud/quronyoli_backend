import { TelegramLinksService } from './telegram-links.service';

describe('TelegramLinksService', () => {
  const service = new TelegramLinksService({
    getOrThrow: () => ({
      botUsername: 'QuronYoliBot',
      miniAppUrl: 'https://example.com/ignored',
      webAppUrl: 'https://quronyoli-front.vercel.app',
      miniAppShortName: 'app',
    }),
  } as never);

  it('builds mini app and share links via t.me direct link', () => {
    const links = service.getMiniAppLinks();
    expect(links.botDeepLink).toContain('t.me/QuronYoliBot?start=app');
    expect(links.miniAppDeepLink).toBe('https://t.me/QuronYoliBot/app');
    expect(links.shareUrl).toContain('t.me/share/url');
  });

  it('builds ayah share links that open Mini App with startapp', () => {
    const links = service.getAyahShareLinks(2, 255);
    expect(links.verseKey).toBe('2:255');
    expect(links.botDeepLink).toContain('start=ayah_2_255');
    expect(links.miniAppDeepLink).toBe(
      'https://t.me/QuronYoliBot/app?startapp=ayah_2_255',
    );
  });

  it('exposes web app https url for optional web_app buttons', () => {
    expect(service.getWebAppUrl()).toBe('https://quronyoli-front.vercel.app');
  });
});
