import { timingSafeEqual } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { runTaskAlerts } from "@/lib/tasks/alerts";
import { isServiceRoleConfigured } from "@/lib/supabase/admin";

/** Agendador dos alertas de tarefas (Vercel Cron, diário). Exige Authorization: Bearer <CRON_SECRET>. */
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET ?? "";
  const given = (request.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
  const valid = secret.length >= 16 && given.length === secret.length && timingSafeEqual(Buffer.from(given), Buffer.from(secret));
  if (!valid) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  if (!isServiceRoleConfigured()) return NextResponse.json({ ok: false, error: "service_role_missing" }, { status: 503 });
  try {
    const result = await runTaskAlerts();
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    return NextResponse.json({ ok: false, error: (error as Error).message }, { status: 500 });
  }
}
