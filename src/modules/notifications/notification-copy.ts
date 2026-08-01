/** Fixed Uzbek copy for daily reminder inbox + Telegram messages. */

export function buildDailyReminderInboxCopy(input: {
  verseKey: string;
  goalLines: string[];
}): { title: string; body: string } {
  const title = 'Kunlik eslatma';
  let body = `Bugungi oyat: ${input.verseKey}`;
  if (input.goalLines.length > 0) {
    body += `\nMaqsadlar:\n${input.goalLines.map((line) => `• ${line}`).join('\n')}`;
  }
  return { title, body: body.slice(0, 1000) };
}

export function buildDailyReminderTelegramText(input: {
  localDate: string;
  verseKey: string;
  goalLines: string[];
  escapeHtml: (value: string) => string;
}): string {
  const goalsBlock =
    input.goalLines.length > 0
      ? `\n\n<b>Maqsadlar</b>\n${input.goalLines
          .map((line) => `• ${input.escapeHtml(line)}`)
          .join('\n')}`
      : `\n\nBugun tugallanmagan maqsad yo'q.`;

  return (
    `<b>Kunlik eslatma</b> (${input.escapeHtml(input.localDate)})\n` +
    `Bugungi oyat: <b>${input.escapeHtml(input.verseKey)}</b>` +
    goalsBlock
  );
}
