import { fmtAoa, fmtNum } from "@/lib/ops/money";

/**
 * Gráficos simples, sem bibliotecas: uma série por gráfico (sem legenda; o título do cartão
 * identifica-a), marcas finas com extremidade arredondada, valores em cor de texto,
 * tooltip ao passar o rato/tocar (title + estado hover) e tabela alternativa para leitores de ecrã.
 */
type Format = "aoa" | "num";
const fmt = (v: number, f: Format) => (f === "aoa" ? fmtAoa(v) : fmtNum(v));

export function BarChart({ data, format = "num", max: maxItems = 10 }: { data: { label: string; value: number }[]; format?: Format; max?: number }) {
  const rows = data.slice(0, maxItems);
  if (!rows.length) return <p className="text-sm text-slate-500">Sem dados.</p>;
  const max = Math.max(...rows.map((d) => d.value), 1);
  return (
    <figure>
      <ul className="space-y-2.5" aria-hidden>
        {rows.map((d) => (
          <li key={d.label} className="group" title={`${d.label}: ${fmt(d.value, format)}`}>
            <div className="mb-1 flex justify-between gap-3 text-xs">
              <span className="truncate text-slate-600">{d.label}</span>
              <span className="tabular-nums font-medium text-slate-900">{fmt(d.value, format)}</span>
            </div>
            <div className="h-2.5 rounded-r-[4px] bg-slate-100">
              <div className="h-full rounded-r-[4px] bg-neutral-800 transition-colors group-hover:bg-black" style={{ width: `${Math.max(1, (d.value / max) * 100)}%` }} />
            </div>
          </li>
        ))}
      </ul>
      <table className="sr-only">
        <tbody>
          {rows.map((d) => (
            <tr key={d.label}>
              <th>{d.label}</th>
              <td>{fmt(d.value, format)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}

/** Evolução no tempo (ex.: despesas por mês). Uma linha de 2px com marcadores e valores no hover. */
export function LineChart({ data, format = "aoa", height = 180 }: { data: { label: string; value: number }[]; format?: Format; height?: number }) {
  if (!data.length) return <p className="text-sm text-slate-500">Sem dados.</p>;
  const w = 600;
  const pad = { l: 8, r: 8, t: 16, b: 26 };
  const max = Math.max(...data.map((d) => d.value), 1);
  const x = (i: number) => pad.l + (data.length === 1 ? (w - pad.l - pad.r) / 2 : (i / (data.length - 1)) * (w - pad.l - pad.r));
  const y = (v: number) => pad.t + (1 - v / max) * (height - pad.t - pad.b);
  const path = data.map((d, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(d.value).toFixed(1)}`).join(" ");
  const last = data[data.length - 1];
  return (
    <figure>
      <svg viewBox={`0 0 ${w} ${height}`} className="h-auto w-full" role="img" aria-label={`Evolução: último valor ${fmt(last.value, format)}`}>
        {[0.5, 1].map((g) => (
          <line key={g} x1={pad.l} x2={w - pad.r} y1={y(max * g)} y2={y(max * g)} stroke="#e2e8f0" strokeWidth={1} />
        ))}
        <line x1={pad.l} x2={w - pad.r} y1={y(0)} y2={y(0)} stroke="#cbd5e1" strokeWidth={1} />
        <path d={path} fill="none" stroke="#111" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
        {data.map((d, i) => (
          <g key={d.label} className="group">
            <rect x={x(i) - 14} y={pad.t} width={28} height={height - pad.t - pad.b} fill="transparent" />
            <circle cx={x(i)} cy={y(d.value)} r={4} fill="#111" stroke="#fff" strokeWidth={2} />
            <title>{`${d.label}: ${fmt(d.value, format)}`}</title>
            <text x={x(i)} y={height - 8} textAnchor="middle" fontSize={11} fill="#64748b">
              {d.label}
            </text>
          </g>
        ))}
        <text x={x(data.length - 1)} y={y(last.value) - 9} textAnchor="end" fontSize={11} fill="#0f172a" fontWeight={600}>
          {fmt(last.value, format)}
        </text>
      </svg>
      <table className="sr-only">
        <tbody>
          {data.map((d) => (
            <tr key={d.label}>
              <th>{d.label}</th>
              <td>{fmt(d.value, format)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}
