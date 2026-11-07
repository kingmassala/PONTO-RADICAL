// Dá acesso de Administrador à Gestão de Obras a uma conta que já existe no Supabase Auth
// (ex.: a conta usada no painel do website). Não mexe em palavras-passe.
// Uso: npm run gestao:admin -- email@dominio.com "Nome Apelido"
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;
const [emailArg, nameArg] = process.argv.slice(2);
if (!url || !key) {
  console.error("Defina NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SECRET_KEY em .env.local.");
  process.exit(1);
}
const email = (emailArg ?? "").trim().toLowerCase();
if (!email.includes("@")) {
  console.error('Uso: npm run gestao:admin -- email@dominio.com "Nome Apelido"');
  process.exit(1);
}
const db = createClient(url, key, { auth: { persistSession: false } });
let user = null;
for (let page = 1; page < 50 && !user; page++) {
  const { data, error } = await db.auth.admin.listUsers({ page, perPage: 200 });
  if (error || !data.users.length) break;
  user = data.users.find((u) => u.email?.toLowerCase() === email) ?? null;
  if (data.users.length < 200) break;
}
if (!user) {
  console.error(`Não existe nenhuma conta com o email ${email}. Crie-a primeiro (npm run admin:create) ou no Supabase.`);
  process.exit(1);
}
const { error } = await db.from("ops_members").upsert(
  { user_id: user.id, email, full_name: nameArg || user.user_metadata?.full_name || email.split("@")[0], role: "admin", active: true },
  { onConflict: "user_id" },
);
if (error) {
  console.error("Erro:", error.message, "— a migração da Gestão de Obras já foi aplicada? (npm run db:migrate)");
  process.exit(1);
}
console.log(`✓ ${email} é Administrador da Gestão de Obras. Entre em /gestao/entrar com a palavra-passe habitual.`);
