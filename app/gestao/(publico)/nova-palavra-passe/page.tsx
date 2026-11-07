import type { Metadata } from "next";
import { Suspense } from "react";
import { OpsAuthCard, OpsNewPasswordForm } from "@/components/ops/auth-forms";

export const metadata: Metadata = { title: "Nova palavra-passe" };

async function Form({ searchParams }: { searchParams: Promise<{ obrigatoria?: string }> }) {
  const { obrigatoria } = await searchParams;
  return <OpsNewPasswordForm forced={obrigatoria === "1"} />;
}

export default function NovaPalavraPassePage({ searchParams }: PageProps<"/gestao/nova-palavra-passe">) {
  return (
    <OpsAuthCard title="Definir palavra-passe">
      <Suspense>
        <Form searchParams={searchParams as Promise<{ obrigatoria?: string }>} />
      </Suspense>
    </OpsAuthCard>
  );
}
