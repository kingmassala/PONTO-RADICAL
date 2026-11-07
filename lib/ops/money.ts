const aoa = new Intl.NumberFormat("pt-PT", { style: "currency", currency: "AOA", minimumFractionDigits: 2, maximumFractionDigits: 2 });
const num = new Intl.NumberFormat("pt-PT", { maximumFractionDigits: 2 });
const pct = new Intl.NumberFormat("pt-PT", { style: "percent", maximumFractionDigits: 1 });

export function fmtAoa(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) return "—";
  return aoa.format(value);
}
export function fmtNum(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) return "—";
  return num.format(value);
}
export function fmtPct(ratio: number | null | undefined): string {
  if (ratio === null || ratio === undefined || !Number.isFinite(ratio)) return "—";
  return pct.format(ratio);
}
/** Arredondamento monetário a 2 casas (half-up em cêntimos). */
export function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}
