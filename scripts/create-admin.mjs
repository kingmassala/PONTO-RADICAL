// Cria (ou promove) o administrador inicial do painel.
// Uso: npm run admin:create -- email@dominio.ao "Nome Apelido"
// A palavra-passe é pedida no terminal (não fica no histórico da shell).
import { createClient } from "@supabase/supabase-js";
import { createInterface } from "node:readline/promises";
import { stdin, stdout } from "node:process";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;
const [email, fullName = ""] = process.argv.slice(2);

if (!url || !key) {
  console.error("Defina NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SECRET_KEY em .env.local.");
  process.exit(1);
}
if (!email || !email.includes("@")) {
  console.error('Uso: npm run admin:create -- email@dominio.ao "Nome Apelido"');
  process.exit(1);
}

const rl = createInterface({ input: stdin, output: stdout });
const password = (await rl.question("Palavra-passe (mín. 10 caracteres): ")).trim();
rl.close();
if (password.length < 10) {
  console.error("A palavra-passe deve ter pelo menos 10 caracteres.");
  process.exit(1);
}

const supabase = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });

let userId;
const { data: created, error } = await supabase.auth.admin.createUser({
  email,
  password,
  email_confirm: true,
  user_metadata: { full_name: fullName },
});
if (error) {
  if (!/already|registered|exists/i.test(error.message)) {
    console.error("Erro ao criar utilizador:", error.message);
    process.exit(1);
  }
  // Utilizador já existe: procura-o e actualiza a palavra-passe.
  for (let page = 1; !userId; page++) {
    const { data, error: listError } = await supabase.auth.admin.listUsers({ page, perPage: 200 });
    if (listError || data.users.length === 0) break;
    userId = data.users.find((u) => u.email?.toLowerCase() === email.toLowerCase())?.id;
  }
  if (!userId) {
    console.error("Não foi possível encontrar o utilizador existente.");
    process.exit(1);
  }
  await supabase.auth.admin.updateUserById(userId, { password });
  console.log("Utilizador já existia: palavra-passe actualizada.");
} else {
  userId = created.user.id;
}

const { error: profileError } = await supabase
  .from("profiles")
  .upsert({ id: userId, email, full_name: fullName || null, role: "admin" }, { onConflict: "id" });
if (profileError) {
  console.error("Erro ao atribuir o papel de administrador:", profileError.message);
  process.exit(1);
}
console.log(`✓ ${email} é administrador. Entre em /admin/login.`);
