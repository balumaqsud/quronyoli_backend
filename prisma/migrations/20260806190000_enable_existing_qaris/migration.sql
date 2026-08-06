-- Backfill: enable existing non-deleted qaris so Mini App profile lists match admin catalog.
UPDATE quran_reciters SET is_active = true WHERE deleted_at IS NULL AND is_active = false;
