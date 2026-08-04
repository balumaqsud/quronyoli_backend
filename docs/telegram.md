# Telegram Bot & Notifications

## Overview

The backend integrates with Telegram for:

1. Mini App auth (`POST /api/v1/auth/telegram`) — initData HMAC verifier
2. Bot webhook (`POST /api/v1/telegram/webhook`) — **Mini App–first** entry
3. Share / deep links (`GET /api/v1/telegram/links/mini-app`, `GET /api/v1/telegram/share/ayah/:verseKey`)
4. Daily reminders (`/api/v1/notifications/reminders/daily`) via BullMQ

## Mini App–first UX

The chat is an **entry door** only. Product features (daily ayah, random ayah, search, tafsir, audio, bookmarks, settings) live in the Mini App.

Registered via `setMyCommands` on bootstrap:

| Command | Behavior |
| --- | --- |
| `/start` | Upsert user; short welcome + **single** Ilovani ochish button. Supports `ayah_c_v` deep link. |
| `/ilova` (`/app`) | Short line + Ilovani ochish |

Legacy commands (`/bugun`, `/tasodifiy`, `/suralar`, `/juz`, `/davom`, `/saqlangan`, `/yordam`, `/haqimizda`) still respond with a short “Ilovada oching” message and the same single button (not listed in BotFather menu).

**Ilovani ochish** uses a native Telegram `web_app` button pointing at `TELEGRAM_WEB_APP_URL` (HTTPS Mini App), plus a fallback Main Mini App URL button (`t.me/<bot>?startapp=`). Share / external deep links still use Direct Links: `https://t.me/<bot>/<shortName>` (optional `?startapp=`).

On bootstrap the bot also calls `setChatMenuButton` with the same HTTPS Web App URL (bottom menu label `Quron Yo'li`).

Telegram Bot API **cannot** wipe a user’s full chat history; there is no `/tozalash` clear-chat feature.

Webhook `allowed_updates`: `message`, `callback_query` (legacy callbacks soft-redirect to Mini App). Inbound `message` payloads are accepted loosely (Telegram adds fields often); only `update_id` is strictly validated.

## Architecture

- `TelegramApi` interface + `TelegramHttpApi` Axios client (`TELEGRAM_API` token)
- Controllers stay thin: validation + delegation only
- `TelegramUpdateDispatcher` routes commands and `callback_query`
- `TelegramAyahCardService` kept for possible reminder / future formatting (commands no longer send in-chat ayah cards)
- `NotificationService` owns delivery orchestration; BullMQ handles scan + retries

## Environment

See `.env.example` for:

- `TELEGRAM_BOT_TOKEN`, `TELEGRAM_BOT_USERNAME`, `TELEGRAM_WEBHOOK_SECRET`
- `TELEGRAM_MINI_APP_URL`, `TELEGRAM_WEB_APP_URL`, `TELEGRAM_MINI_APP_SHORT_NAME`
- `TELEGRAM_WEBHOOK_URL`, `TELEGRAM_WEBHOOK_AUTO_REGISTER`, `TELEGRAM_WEBHOOK_DROP_PENDING_UPDATES`
- BullMQ / reminder scan settings under `NOTIFICATIONS_*`

Never log the bot token or webhook secret.

## Webhook security

Telegram must send header `X-Telegram-Bot-Api-Secret-Token` matching `TELEGRAM_WEBHOOK_SECRET`. Comparison is constant-time.

## Deep links

- Bot: `https://t.me/<bot>?start=ayah_<chapter>_<verse>`
- Mini App Direct Link (share): `https://t.me/<bot>/<shortName>?startapp=ayah_<chapter>_<verse>`
- Chat `web_app` buttons: `TELEGRAM_WEB_APP_URL` (+ optional `?startapp=ayah_<chapter>_<verse>`)
- Share: `https://t.me/share/url?...`
