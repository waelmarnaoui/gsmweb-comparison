export function normalizeRomanianPhone(input: string): string {
  const value = input.replace(/[\s().-]/g, '');
  const normalized = value.startsWith('00') ? '+' + value.slice(2) : /^0\d{9}$/.test(value) ? '+40' + value.slice(1) : /^40\d{9}$/.test(value) ? '+' + value : value;
  if (!/^\+[1-9]\d{7,14}$/.test(normalized)) throw new Error('Use an international phone number with a country code');
  return normalized;
}
export function candidates<T extends { timestamp: string }>(callTime: string, clicks: T[], windowSeconds = 120): T[] {
  if (!Number.isFinite(windowSeconds) || windowSeconds < 1 || windowSeconds > 3600) throw new Error('Window must be 1-3600 seconds');
  const time = Date.parse(callTime);
  if (!Number.isFinite(time)) throw new Error('Invalid call timestamp');
  return clicks.filter(click => { const delay = (time - Date.parse(click.timestamp)) / 1000; return delay >= 0 && delay <= windowSeconds; });
}

