import { NextResponse, type NextRequest } from "next/server";
import { getStaffUser } from "@/lib/auth";
import { listDeliveries } from "@/lib/deliveries/queries";
import { controlDetailCsv, controlSummaryCsv } from "@/lib/deliveries/rules";

const DATE = /^\d{4}-\d{2}-\d{2}$/;

/** Download do controlo de material em CSV (abre no Excel). ?tipo=resumo|detalhe&de=AAAA-MM-DD&ate=AAAA-MM-DD&cliente=… */
export async function GET(request: NextRequest) {
  const user = await getStaffUser();
  if (!user) return NextResponse.json({ error: "not_authorized" }, { status: 401 });
  const q = request.nextUrl.searchParams;
  const tipo = q.get("tipo") === "detalhe" ? "detalhe" : "resumo";
  const from = DATE.test(q.get("de") ?? "") ? q.get("de")! : "";
  const to = DATE.test(q.get("ate") ?? "") ? q.get("ate")! : "";
  const client = (q.get("cliente") ?? "todos").slice(0, 120) || "todos";
  const { deliveries, error } = await listDeliveries(5000);
  if (error) return NextResponse.json({ error }, { status: 500 });
  const filter = { from, to, client };
  const body = tipo === "detalhe" ? controlDetailCsv(deliveries, filter) : controlSummaryCsv(deliveries, filter);
  const slug = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-zA-Z0-9]+/g, "-").replace(/^-|-$/g, "").toLowerCase();
  const name = ["controlo-material", tipo, client !== "todos" ? slug(client) : "", from || "inicio", to || "hoje"].filter(Boolean).join("_");
  return new NextResponse(body, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${name}.csv"`,
      "Cache-Control": "private, no-store",
    },
  });
}
