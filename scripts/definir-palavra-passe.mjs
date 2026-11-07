// Define a palavra-passe de uma conta existente (website /admin e Gestão de Obras usam a mesma conta).
// A palavra-passe é pedida numa janela do macOS com texto escondido (ou no terminal, sem eco),
// nunca é mostrada, guardada em ficheiros nem passada na linha de comandos.
//
// Uso:   npm run conta:palavra-passe -- geral@pontoradical.com
//        npm run conta:palavra-passe -- geral@pontoradical.com --terminal   (pedir no terminal)
//        npm run conta:palavra-passe -- geral@pontoradical.com --verificar  (só confirma que a conta existe)
import { execFileSync } from "node:child_process";
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;
const args = process.argv.slice(2);
const email = (args.find((a) => !a.startsWith("--")) ?? "").trim().toLowerCase();
const onlyCheck = args.includes("--verificar");
const useTerminal = args.includes("--terminal") || process.platform !== "darwin";

if (!url || !key) {
  console.error("Defina NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SECRET_KEY em .env.local.");
  process.exit(1);
}
if (!email.includes("@")) {
  console.error("Uso: npm run conta:palavra-passe -- email@dominio.com");
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
  console.error(`Não existe nenhuma conta com o email ${email}.`);
  process.exit(1);
}
if (onlyCheck) {
  console.log(`✓ A conta ${email} existe. Nada foi alterado.`);
  process.exit(0);
}

/** Janela do macOS com resposta escondida. Devolve null se for cancelada. */
function askDialog(prompt) {
  const script = `display dialog ${JSON.stringify(prompt)} default answer "" with hidden answer with title "Ponto Radical" buttons {"Cancelar", "OK"} default button "OK" cancel button "Cancelar"
return text returned of result`;
  try {
    return execFileSync("osascript", ["-e", script], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).replace(/\n$/, "");
  } catch {
    return null;
  }
}

/** Pergunta no terminal sem mostrar o que se escreve. */
function askTerminal(prompt) {
  return new Promise((resolve) => {
    const stdin = process.stdin;
    if (!stdin.isTTY) {
      console.error("O terminal não aceita texto escondido. Execute sem --terminal para usar a janela do macOS.");
      process.exit(1);
    }
    process.stdout.write(prompt);
    stdin.setRawMode(true);
    stdin.resume();
    stdin.setEncoding("utf8");
    let value = "";
    const onData = (ch) => {
      if (ch === "\r" || ch === "\n" || ch === "\u0004") {
        stdin.setRawMode(false);
        stdin.pause();
        stdin.off("data", onData);
        process.stdout.write("\n");
        resolve(value);
      } else if (ch === "\u0003") {
        process.stdout.write("\n");
        process.exit(1);
      } else if (ch === "\u007f" || ch === "\b") {
        value = value.slice(0, -1);
      } else {
        value += ch;
      }
    };
    stdin.on("data", onData);
  });
}

const ask = (p) => (useTerminal ? askTerminal(`${p} `) : Promise.resolve(askDialog(p)));

const first = await ask(`Nova palavra-passe para ${email} (mínimo 10 caracteres):`);
if (first === null) {
  console.log("Cancelado. Nada foi alterado.");
  process.exit(0);
}
if (first.length < 10) {
  console.error("A palavra-passe tem de ter pelo menos 10 caracteres. Nada foi alterado.");
  process.exit(1);
}
const second = await ask("Repita a palavra-passe:");
if (second !== first) {
  console.error("As palavras-passe não coincidem. Nada foi alterado.");
  process.exit(1);
}

const { error } = await db.auth.admin.updateUserById(user.id, { password: first });
if (error) {
  console.error(`Não foi possível definir a palavra-passe: ${error.message}`);
  process.exit(1);
}
// Se a conta estava marcada para trocar a palavra-passe no primeiro acesso à gestão, deixa de estar.
await db.from("ops_members").update({ must_change_password: false }).eq("user_id", user.id);
console.log(`✓ Palavra-passe de ${email} definida. Serve para o painel do website (/admin) e para a Gestão de Obras.`);
