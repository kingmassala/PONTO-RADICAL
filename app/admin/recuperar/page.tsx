import type { Metadata } from "next";
import { AuthCard } from "@/components/admin/auth-card";
import { ResetRequestForm } from "@/components/admin/auth-forms";

export const metadata: Metadata = { title: "Recuperar palavra-passe" };

export default function RecoverPage() {
  return (
    <AuthCard title="Recuperar palavra-passe" description="Enviaremos um link para definir uma nova palavra-passe.">
      <ResetRequestForm />
    </AuthCard>
  );
}
