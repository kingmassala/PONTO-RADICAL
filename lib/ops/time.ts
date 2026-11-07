/** Datas e horas no fuso de Angola (Africa/Luanda, UTC+1, sem hora de Verão). */
export const OPS_TZ = "Africa/Luanda";

const dateFmt = new Intl.DateTimeFormat("pt-PT", { timeZone: OPS_TZ, day: "2-digit", month: "2-digit", year: "numeric" });
const timeFmt = new Intl.DateTimeFormat("pt-PT", { timeZone: OPS_TZ, hour: "2-digit", minute: "2-digit", hour12: false });
const isoFmt = new Intl.DateTimeFormat("en-CA", { timeZone: OPS_TZ, year: "numeric", month: "2-digit", day: "2-digit" });

export function fmtDate(value: string | Date | null | undefined): string {
  if (!value) return "—";
  const d = typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value) ? new Date(`${value}T12:00:00Z`) : new Date(value);
  return dateFmt.format(d);
}

export function fmtTime(value: string | Date | null | undefined): string {
  if (!value) return "—";
  return timeFmt.format(new Date(value)).replace(":", "h");
}

export function fmtDateTime(value: string | Date | null | undefined): string {
  if (!value) return "—";
  return `${fmtDate(value)} ${fmtTime(value)}`;
}

/** Data de hoje em Luanda (AAAA-MM-DD). */
export function todayLuanda(now = new Date()): string {
  return isoFmt.format(now);
}

/** Converte uma data/hora local de Luanda («2026-11-09» + «08:00») em instante UTC (ISO). */
export function luandaToIso(date: string, time = "00:00"): string {
  // Luanda está sempre em UTC+1.
  return new Date(`${date}T${time.length === 5 ? `${time}:00` : time}+01:00`).toISOString();
}

/** Valor para <input type="datetime-local"> no fuso de Luanda. */
export function isoToLuandaInput(value: string | null | undefined): string {
  if (!value) return "";
  const d = new Date(new Date(value).getTime() + 60 * 60 * 1000);
  return d.toISOString().slice(0, 16);
}

export function addDaysIso(date: string, days: number): string {
  const d = new Date(`${date}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}
