import { useState } from "react";
import { Link, Navigate, useLocation, useNavigate } from "react-router-dom";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Logo } from "@/components/Logo";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

const schema = z.object({
  email: z.string().trim().email("Email inválido"),
  password: z.string().min(8, "Mínimo 8 caracteres"),
});
type FormValues = z.infer<typeof schema>;

export default function Login() {
  const { user, signIn } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [submitting, setSubmitting] = useState(false);
  const { register, handleSubmit, formState: { errors } } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { email: "", password: "" },
  });

  if (user) return <Navigate to="/dashboard" replace />;

  const onSubmit = async (values: FormValues) => {
    setSubmitting(true);
    try {
      await signIn(values.email, values.password);
      const from = (location.state as { from?: { pathname?: string } } | null)?.from?.pathname || "/dashboard";
      navigate(from, { replace: true });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao entrar");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AuthShell>
      <h1 className="text-2xl font-semibold">Entrar</h1>
      <p className="text-sm text-muted-foreground mt-1">Acesse sua conta para gerenciar seus ministérios.</p>
      <form onSubmit={handleSubmit(onSubmit)} className="mt-6 space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="email">Email</Label>
          <Input id="email" type="email" autoComplete="email" {...register("email")} />
          {errors.email && <p className="text-xs text-destructive">{errors.email.message}</p>}
        </div>
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <Label htmlFor="password">Senha</Label>
            <Link to="/recuperar-senha" className="text-xs text-muted-foreground hover:text-primary">
              Esqueci a senha
            </Link>
          </div>
          <Input id="password" type="password" autoComplete="current-password" {...register("password")} />
          {errors.password && <p className="text-xs text-destructive">{errors.password.message}</p>}
        </div>
        <Button type="submit" className="w-full" disabled={submitting}>
          {submitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
          Entrar
        </Button>
      </form>
      <p className="text-sm text-muted-foreground text-center mt-6">
        Não tem conta? <Link to="/cadastro" className="text-primary hover:underline">Criar conta</Link>
      </p>
    </AuthShell>
  );
}

export function AuthShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="px-6 py-5">
        <Link to="/"><Logo /></Link>
      </header>
      <div className="flex-1 flex items-center justify-center px-6 pb-12">
        <div className="w-full max-w-md rounded-2xl border border-border bg-card p-8 shadow-card">
          {children}
        </div>
      </div>
    </div>
  );
}