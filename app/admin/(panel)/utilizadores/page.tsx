import type { Metadata } from "next";
import { requireAdminPage } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { isServiceRoleConfigured } from "@/lib/supabase/admin";
import { UsersManager } from "@/components/admin/users";
import { PageHeader } from "@/components/admin/page-header";

export const metadata: Metadata = { title: "Utilizadores" };

export default async function UsersPage() {
  const user = await requireAdminPage();
  const supabase = await createClient();
  const { data } = await supabase.from("profiles").select("id, email, full_name, role, created_at").order("created_at");
  return (
    <>
      <PageHeader title="Utilizadores" description="Pessoas com acesso ao painel e respectivas permissões." />
      <UsersManager profiles={data ?? []} currentUserId={user.id} canInvite={isServiceRoleConfigured()} />
    </>
  );
}
