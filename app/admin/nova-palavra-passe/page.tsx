import type { Metadata } from "next";
import { AuthCard } from "@/components/admin/auth-card";
import { NewPasswordForm } from "@/components/admin/auth-forms";

export const metadata: Metadata = { title: "Nova palavra-passe" };

export default function NewPasswordPage() {
  return (
    <AuthCard title="Definir nova palavra-passe" description="Escolha a palavra-passe que vai usar para entrar no painel.">
      <NewPasswordForm />
    </AuthCard>
  );
}
