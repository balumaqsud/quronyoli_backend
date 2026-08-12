import { normalizeQfMediaUrls } from './qf-media-url.normalizer';

describe('normalizeQfMediaUrls', () => {
  const base = 'https://audio.qurancdn.com';

  it('upgrades protocol-relative image_url to https', () => {
    expect(
      normalizeQfMediaUrls(
        { verse: { image_url: '//cdn.example.com/1_1.png', image_width: 675 } },
        base,
      ),
    ).toEqual({
      verse: {
        image_url: 'https://cdn.example.com/1_1.png',
        image_width: 675,
      },
    });
  });

  it('absolutizes relative ayah audio urls', () => {
    expect(
      normalizeQfMediaUrls(
        {
          audio_files: [{ verse_key: '1:1', url: 'Alafasy/mp3/001001.mp3' }],
        },
        base,
      ),
    ).toEqual({
      audio_files: [
        {
          verse_key: '1:1',
          url: 'https://audio.qurancdn.com/Alafasy/mp3/001001.mp3',
        },
      ],
    });
  });

  it('leaves absolute audio_url unchanged', () => {
    const absolute =
      'https://download.quranicaudio.com/qdc/mishari_al_afasy/murattal/1.mp3';
    expect(
      normalizeQfMediaUrls({ audio_file: { audio_url: absolute } }, base),
    ).toEqual({ audio_file: { audio_url: absolute } });
  });

  it('preserves object identity when no media URLs need rewriting', () => {
    const payload = {
      verses: [
        {
          verse_key: '1:1',
          text_uthmani: 'بِسْمِ',
          words: [{ text: 'بِسْمِ', position: 1 }],
        },
      ],
    };

    expect(normalizeQfMediaUrls(payload, base)).toBe(payload);
  });
});
