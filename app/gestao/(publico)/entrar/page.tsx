import type { Metadata } from "next";
import { Suspense } from "react";
import { getOpsBase } from "@/lib/ops/server-base";
import { OpsAuthCard, OpsLoginForm } from "@/components/ops/auth-forms";

export const metadata: Metadata = { title: "Entrar" };

async function Login({ searchParams }: { searchParams: Promise<{ erro?: string }> }) {
  const [{ erro }, base] = await Promise.all([searchParams, getOpsBase()]);
  return <OpsLoginForm base={base} notice={erro === "link-invalido" ? "O link expirou ou já foi usado. Peça um novo." : undefined} />;
}

export default function EntrarPage({ searchParams }: PageProps<"/gestao/entrar">) {
  return (
    <OpsAuthCard title="Iniciar sessão" subtitle="Acesso reservado aos colaboradores da Ponto Radical.">
      <Suspense>
        <Login searchParams={searchParams as Promise<{ erro?: string }>} />
      </Suspense>
    </OpsAuthCard>
  );
}
