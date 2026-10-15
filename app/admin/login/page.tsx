import type { Metadata } from "next";
import { Suspense } from "react";
import { AuthCard } from "@/components/admin/auth-card";
import { LoginForm } from "@/components/admin/auth-forms";

export const metadata: Metadata = { title: "Iniciar sessão" };

async function LoginWithNotice({ searchParams }: { searchParams: Promise<{ erro?: string }> }) {
  const { erro } = await searchParams;
  const notice = erro === "link-invalido" ? "O link expirou ou já foi usado. Peça um novo link." : undefined;
  return <LoginForm notice={notice} />;
}

export default function LoginPage({ searchParams }: PageProps<"/admin/login">) {
  return (
    <AuthCard title="Iniciar sessão" description="Acesso reservado à equipa Ponto Radical.">
      <Suspense fallback={<LoginForm />}>
        <LoginWithNotice searchParams={searchParams as Promise<{ erro?: string }>} />
      </Suspense>
    </AuthCard>
  );
}
