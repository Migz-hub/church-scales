import { useState } from "react";
import { Link } from "react-router-dom";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { Loader2, MailCheck } from "lucide-react";
import { AuthShell } from "./Login";

const schema = z.object({ email: z.string().trim().email("Email inválido") });
type FormValues = z.infer<typeof schema>;

export default function ForgotPassword() {
  const { requestPasswordReset } = useAuth();
  const [sent, setSent] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const { register, handleSubmit, formState: { errors } } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { email: "" },
  });

  const onSubmit = async (values: FormValues) => {
    setSubmitting(true);
    try {
      await requestPasswordReset(values.email);
      setSent(true);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AuthShell>
      {sent ? (
        <div className="text-center py-4">
          <div className="h-12 w-12 mx-auto rounded-full bg-success/15 text-success flex items-center justify-center mb-4">
            <MailCheck className="h-6 w-6" />
          </div>
          <h1 className="text-xl font-semibold">Verifique seu email</h1>
          <p className="text-sm text-muted-foreground mt-2">
            Se houver uma conta associada, enviamos um link para redefinir sua senha.
          </p>
          <Button asChild variant="outline" className="mt-6"><Link to="/login">Voltar para o login</Link></Button>
        </div>
      ) : (
        <>
          <h1 className="text-2xl font-semibold">Recuperar senha</h1>
          <p className="text-sm text-muted-foreground mt-1">Vamos enviar um link de redefinição para o seu email.</p>
          <form onSubmit={handleSubmit(onSubmit)} className="mt-6 space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" {...register("email")} />
              {errors.email && <p className="text-xs text-destructive">{errors.email.message}</p>}
            </div>
            <Button type="submit" className="w-full" disabled={submitting}>
              {submitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Enviar link
            </Button>
          </form>
          <p className="text-sm text-muted-foreground text-center mt-6">
            <Link to="/login" className="text-primary hover:underline">Voltar para o login</Link>
          </p>
        </>
      )}
    </AuthShell>
  );
}