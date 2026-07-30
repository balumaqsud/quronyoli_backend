# Telegram Bot & Notifications

## Overview

The backend integrates with Telegram for:

1. Mini App auth (`POST /api/v1/auth/telegram`) — existing initData HMAC verifier
2. Bot webhook (`POST /api/v1/telegram/webhook`) — `/start`, `/app`, ayah deep links
3. Share / deep links (`GET /api/v1/telegram/links/mini-app`, `GET /api/v1/telegram/share/ayah/:verseKey`)
4. Daily reminders (`/api/v1/notifications/reminders/daily`) via BullMQ

## Architecture

- `TelegramApi` interface + `TelegramHttpApi` Axios client (`TELEGRAM_API` token)
- Controllers stay thin: validation + delegation only
- `NotificationService` owns delivery orchestration; BullMQ handles scan + retries
- Unique `(userId, type, localDate)` on `notification_deliveries` provides durable idempotency

## Environment

See `.env.example` for:

- `TELEGRAM_BOT_TOKEN`, `TELEGRAM_BOT_USERNAME`, `TELEGRAM_WEBHOOK_SECRET`
- `TELEGRAM_MINI_APP_URL`, `TELEGRAM_WEBHOOK_URL`, `TELEGRAM_WEBHOOK_AUTO_REGISTER`
- BullMQ / reminder scan settings under `NOTIFICATIONS_*`

Never log the bot token or webhook secret.

## Webhook security

Telegram must send header `X-Telegram-Bot-Api-Secret-Token` matching `TELEGRAM_WEBHOOK_SECRET`. Comparison is constant-time.

## Deep links

- Bot: `https://t.me/<bot>?start=ayah_<chapter>_<verse>`
- Mini App: configured Mini App URL with `startapp=ayah_<chapter>_<verse>`
- Share: `https://t.me/share/url?...`

Login responses include `startParam` when present in initData so the client can navigate after auth.
