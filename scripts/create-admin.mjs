// Cria (ou promove) o administrador inicial do painel.
// Uso: npm run admin:create -- email@dominio.ao "Nome Apelido"
// A palavra-passe é pedida no terminal sem aparecer no ecrã (nem fica no histórico da shell).
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

// Lê a palavra-passe sem a mostrar no ecrã (nada aparece enquanto escreve ou cola).
async function askHidden(question) {
  if (!stdin.isTTY) {
    const rl = createInterface({ input: stdin, output: stdout });
    const answer = await rl.question(question);
    rl.close();
    return answer;
  }
  stdout.write(question);
  stdin.setRawMode(true);
  stdin.setEncoding("utf8");
  stdin.resume();
  return new Promise((resolve) => {
    let value = "";
    const onData = (chunk) => {
      for (const ch of chunk) {
        if (ch === "\r" || ch === "\n") {
          stdin.setRawMode(false);
          stdin.pause();
          stdin.off("data", onData);
          stdout.write("\n");
          resolve(value);
          return;
        }
        if (ch === "\u0003") {
          stdout.write("\n");
          process.exit(130);
        }
        if (ch === "\u007f" || ch === "\b") value = value.slice(0, -1);
        else value += ch;
      }
    };
    stdin.on("data", onData);
  });
}

const password = (await askHidden("Palavra-passe (mín. 10 caracteres, não aparece no ecrã): ")).trim();
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
