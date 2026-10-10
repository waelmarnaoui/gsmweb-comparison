const zone = 'Europe/Bucharest';
const formatter = new Intl.DateTimeFormat('en-GB', {timeZone: zone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23'});
function parts(date: Date) {
 const p = Object.fromEntries(formatter.formatToParts(date).map(p => [p.type, p.value]));
 return `${p.year}-${p.month}-${p.day} ${p.hour}:${p.minute}:${p.second}`;
}
export function formatRomanianTimestamp(value: string) {
 return parts(new Date(value));
}
export function parseTimestamp(input: string): string {
 const value = input.trim();
 if (/^\d{10}$|^\d{13}$/.test(value)) {
  const date = new Date(Number(value) * (value.length === 10 ? 1000 : 1));
  return date.toISOString();
 }
 const explicit=value.match(/^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::(\d{2})(?:\.(\d{1,3}))?)?(Z|[+-]\d{2}:?\d{2})$/i);
 if (explicit) {
  validateCalendar(Number(explicit[1]),Number(explicit[2]),Number(explicit[3]),Number(explicit[4]),Number(explicit[5]),Number(explicit[6]||0));
  const date = new Date(value.replace(' ', 'T'));
  if (Number.isFinite(date.getTime())) return date.toISOString();
  throw new Error('Invalid timezone offset.');
 }
 const iso = value.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})[T ](\d{1,2}):(\d{2})(?::(\d{2})(?:\.(\d{1,3}))?)?$/);
 const european = value.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{4})[ ,T]+(\d{1,2}):(\d{2})(?::(\d{2})(?:\.(\d{1,3}))?)?$/);
 const m = iso || european;
 if (!m) throw new Error('Use YYYY-MM-DD HH:mm:ss, an ISO timestamp with offset, a Romanian DD/MM/YYYY date and time, or Unix seconds/milliseconds.');
 const year = Number(iso ? m[1] : m[3]), month = Number(m[2]), day = Number(iso ? m[3] : m[1]);
 const hour = Number(m[4]), minute = Number(m[5]), second = Number(m[6] || 0), ms = Number((m[7] || '').padEnd(3, '0'));
 const wall = Date.UTC(year, month - 1, day, hour, minute, second, ms);
 validateCalendar(year,month,day,hour,minute,second);
 const wanted = `${String(year).padStart(4,'0')}-${String(month).padStart(2,'0')}-${String(day).padStart(2,'0')} ${String(hour).padStart(2,'0')}:${String(minute).padStart(2,'0')}:${String(second).padStart(2,'0')}`;
 // Validate both Romanian offsets: DST gaps and repeated hours cannot be guessed safely.
 const candidates = [2, 3].map(offset => new Date(wall - offset * 3600000)).filter(date => parts(date) === wanted);
 if (candidates.length !== 1) throw new Error('This Romanian daylight-saving time is missing or ambiguous. Include +02:00 or +03:00.');
 return candidates[0].toISOString();
}
function validateCalendar(year:number,month:number,day:number,hour:number,minute:number,second:number){
 const check=new Date(Date.UTC(year,month-1,day,hour,minute,second));
 if(check.getUTCFullYear()!==year||check.getUTCMonth()!==month-1||check.getUTCDate()!==day||hour>23||minute>59||second>59)throw new Error('Invalid calendar date or time.');
}
