export function normalizeRomanianPhone(input: string): string {
  const value = input.replace(/[\s().-]/g, '');
  const normalized = value.startsWith('0040') ? '+' + value.slice(2) : /^0\d{9}$/.test(value) ? '+40' + value.slice(1) : /^40\d{9}$/.test(value) ? '+' + value : value;
  if (!/^\+40\d{9}$/.test(normalized)) throw new Error('Invalid Romanian phone number');
  return normalized;
}
export function candidates<T extends { timestamp: string }>(callTime: string, clicks: T[], windowSeconds = 120): T[] {
  if (!Number.isFinite(windowSeconds) || windowSeconds < 1 || windowSeconds > 3600) throw new Error('Window must be 1-3600 seconds');
  const time = Date.parse(callTime);
  if (!Number.isFinite(time)) throw new Error('Invalid call timestamp');
  return clicks.filter(click => { const delay = (time - Date.parse(click.timestamp)) / 1000; return delay >= 0 && delay <= windowSeconds; });
}
