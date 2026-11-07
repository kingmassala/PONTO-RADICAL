import type { Metadata } from "next";
import Link from "next/link";
import { requireOpsPage } from "@/lib/ops/auth";
import { createClient } from "@/lib/supabase/server";
import { getOpsBase } from "@/lib/ops/server-base";
import { joinBase } from "@/lib/ops/base";
import { ROLE_DESCRIPTIONS, ROLE_LABELS } from "@/lib/ops/roles";
import { MyWhatsappForm } from "@/components/ops/admin";
import { Card } from "@/components/admin/ui";

export const metadata: Metadata = { title: "A minha conta" };
export const instant = false;

export default async function ContaPage() {
  const user = await requireOpsPage();
  const supabase = await createClient();
  const { data } = await supabase.from("ops_members").select("whatsapp_phone, whatsapp_consent").eq("user_id", user.id).single();
  const base = await getOpsBase();
  return (
    <>
      <h1 className="mb-5 text-2xl font-semibold tracking-tight">A minha conta</h1>
      <div className="grid gap-6 lg:grid-cols-2">
        <Card title={user.fullName} description={user.email}>
          <p className="text-sm">
            Perfil: <strong>{ROLE_LABELS[user.role]}</strong>
          </p>
          <p className="text-sm text-slate-500">{ROLE_DESCRIPTIONS[user.role]}</p>
          <Link href={joinBase(base, "/nova-palavra-passe")} className="inline-block text-sm underline">
            Alterar palavra-passe
          </Link>
        </Card>
        <Card title="Notificações por WhatsApp">
          <MyWhatsappForm phone={data?.whatsapp_phone ?? null} consent={Boolean(data?.whatsapp_consent)} />
        </Card>
      </div>
    </>
  );
}
