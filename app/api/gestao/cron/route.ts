import { timingSafeEqual } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { connection } from "next/server";
import { processOutbox, runScheduler } from "@/lib/ops/notify";

/**
 * Motor de automatização da Gestão de Obras.
 * Chamado periodicamente no servidor (Supabase pg_cron + pg_net a cada 5 minutos e
 * Vercel Cron como reserva), com o cabeçalho «Authorization: Bearer <CRON_SECRET>».
 * Gera os avisos devidos (início, prazo, atraso, lembretes, diário, semanal) e envia a fila.
 */
function authorised(request: NextRequest): boolean {
  const secret = process.env.CRON_SECRET ?? "";
  const header = request.headers.get("authorization") ?? "";
  const given = header.startsWith("Bearer ") ? header.slice(7) : "";
  if (!secret || given.length !== secret.length) return false;
  return timingSafeEqual(Buffer.from(given), Buffer.from(secret));
}

async function run(request: NextRequest) {
  await connection();
  if (!authorised(request)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const started = Date.now();
  try {
    const scheduler = await runScheduler();
    const outbox = await processOutbox();
    const result = { ok: true, ms: Date.now() - started, scheduler, outbox };
    console.log("[gestao/cron]", JSON.stringify(result));
    return NextResponse.json(result);
  } catch (error) {
    console.error("[gestao/cron] erro:", error);
    return NextResponse.json({ ok: false, error: (error as Error).message }, { status: 500 });
  }
}

export const GET = run;
export const POST = run;
export const maxDuration = 60;
