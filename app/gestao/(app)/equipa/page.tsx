import type { Metadata } from "next";
import { requireOpsPage } from "@/lib/ops/auth";
import { createClient } from "@/lib/supabase/server";
import { getMembers, getTasks, isLate } from "@/lib/ops/queries";
import { ROLE_LABELS, can } from "@/lib/ops/roles";
import { fmtAoa } from "@/lib/ops/money";
import { todayLuanda } from "@/lib/ops/time";
import { HourlyCostEditor, TeamFormButton } from "@/components/ops/team";
import { Badge, Card } from "@/components/admin/ui";

export const metadata: Metadata = { title: "Técnicos e equipas" };
export const instant = false;

export default async function EquipaPage() {
  const user = await requireOpsPage(["admin", "direcao", "gestor", "supervisor", "financeiro"]);
  const supabase = await createClient();
  const month = todayLuanda().slice(0, 7);
  const [members, tasks, teams, time, rates] = await Promise.all([
    getMembers(),
    getTasks({ openOnly: true }),
    supabase.from("ops_teams").select("id, name, leader_id, members:ops_team_members(user_id)").order("name"),
    supabase.from("ops_time_entries").select("user_id, hours").gte("work_date", `${month}-01`),
    supabase.from("ops_member_rates").select("user_id, hourly_cost"),
  ]);
  const rateMap = new Map((rates.data ?? []).map((r) => [r.user_id as string, Number(r.hourly_cost)]));
  const hours = new Map<string, number>();
  for (const t of time.data ?? []) hours.set(t.user_id, (hours.get(t.user_id) ?? 0) + Number(t.hours));
  const active = members.filter((m) => m.active);
  const people = active.map((m) => ({ id: m.user_id, name: m.full_name }));
  const names = new Map(members.map((m) => [m.user_id, m.full_name]));
  const showCost = can.finance(user.role);

  return (
    <>
      <div className="mb-5">
        <h1 className="text-2xl font-semibold tracking-tight">Técnicos e equipas</h1>
        <p className="mt-1 text-sm text-slate-500">Carga de trabalho actual e horas registadas este mês. As contas são geridas em Administração.</p>
      </div>
      <div className="mb-8 overflow-x-auto rounded-xl border border-slate-200 bg-white">
        <table className="w-full min-w-[760px] text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-3">Colaborador</th>
              <th className="px-4 py-3">Perfil</th>
              <th className="px-4 py-3 text-right">Tarefas abertas</th>
              <th className="px-4 py-3 text-right">Atrasadas</th>
              <th className="px-4 py-3 text-right">Horas no mês</th>
              {showCost && <th className="px-4 py-3 text-right">Custo/hora</th>}
              {showCost && <th className="px-4 py-3 text-right">Custo no mês</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {active.map((m) => {
              const mine = tasks.filter((t) => t.responsible_id === m.user_id || t.assignees.some((a) => a.user_id === m.user_id));
              const late = mine.filter((t) => isLate(t)).length;
              const h = hours.get(m.user_id) ?? 0;
              const rate = rateMap.has(m.user_id) ? rateMap.get(m.user_id)! : null;
              return (
                <tr key={m.user_id}>
                  <td className="px-4 py-3">
                    <p className="font-medium">{m.full_name}</p>
                    <p className="text-xs text-slate-500">{m.job_title}</p>
                  </td>
                  <td className="px-4 py-3">
                    <Badge>{ROLE_LABELS[m.role]}</Badge>
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">{mine.length}</td>
                  <td className={`px-4 py-3 text-right tabular-nums ${late ? "font-semibold text-red-600" : ""}`}>{late}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{h.toLocaleString("pt-PT")}</td>
                  {showCost && (
                    <td className="px-4 py-3 text-right">{can.editRates(user.role) ? <HourlyCostEditor userId={m.user_id} value={rate} /> : rate === null ? "—" : fmtAoa(rate)}</td>
                  )}
                  {showCost && <td className="px-4 py-3 text-right tabular-nums">{rate === null ? "—" : fmtAoa(h * rate)}</td>}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <Card title="Equipas" actions={can.plan(user.role) ? <TeamFormButton people={people} /> : null}>
        {(teams.data ?? []).length === 0 ? (
          <p className="text-sm text-slate-500">Sem equipas.</p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {(teams.data ?? []).map((t) => {
              const ids = (t.members as { user_id: string }[]).map((x) => x.user_id);
              return (
                <li key={t.id} className="flex flex-wrap items-center justify-between gap-2 py-3 text-sm">
                  <div>
                    <p className="font-medium">{t.name}</p>
                    <p className="text-xs text-slate-500">
                      {t.leader_id ? `Chefe: ${names.get(t.leader_id)} · ` : ""}
                      {ids.map((id) => names.get(id)).join(", ") || "Sem membros"}
                    </p>
                  </div>
                  {can.plan(user.role) && <TeamFormButton people={people} team={{ id: t.id, name: t.name, leader_id: t.leader_id, members: ids }} />}
                </li>
              );
            })}
          </ul>
        )}
      </Card>
    </>
  );
}
