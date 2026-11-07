import type { Metadata } from "next";
import { Suspense } from "react";
import { getOpsBase } from "@/lib/ops/server-base";
import { OpsAuthCard, OpsResetForm } from "@/components/ops/auth-forms";

export const metadata: Metadata = { title: "Recuperar palavra-passe" };

async function Form() {
  return <OpsResetForm base={await getOpsBase()} />;
}

export default function RecuperarPage() {
  return (
    <OpsAuthCard title="Recuperar palavra-passe" subtitle="Enviaremos um link para o seu email.">
      <Suspense>
        <Form />
      </Suspense>
    </OpsAuthCard>
  );
}
