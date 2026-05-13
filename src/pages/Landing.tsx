import { Link, Navigate } from "react-router-dom";
import { ArrowRight, Calendar, MessageSquare, Shield, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/Logo";
import { useAuth } from "@/contexts/AuthContext";
import { LoadingState } from "@/components/LoadingState";

const features = [
  { icon: Users, title: "Ministérios", desc: "Crie ministérios, convide membros por código e atribua papéis com permissões claras." },
  { icon: Calendar, title: "Escalas", desc: "Organize escalas por data, atribua funções e mantenha todos avisados." },
  { icon: MessageSquare, title: "Chat interno", desc: "Comunicação por ministério, em tempo real, sem ruído." },
  { icon: Shield, title: "Permissões", desc: "Owner, admin, líder e membro — cada um vê e faz o que pode." },
];

export default function Landing() {
  const { user, loading } = useAuth();
  if (loading) return <LoadingState />;
  if (user) return <Navigate to="/dashboard" replace />;

  return (
    <div className="min-h-screen bg-background">
      <header className="px-6 py-5 flex items-center justify-between max-w-6xl mx-auto">
        <Logo />
        <div className="flex items-center gap-2">
          <Button asChild variant="ghost"><Link to="/login">Entrar</Link></Button>
          <Button asChild><Link to="/cadastro">Criar conta</Link></Button>
        </div>
      </header>

      <section className="px-6 pt-16 pb-20 max-w-4xl mx-auto text-center">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-border bg-card text-xs text-muted-foreground mb-6">
          <span className="h-1.5 w-1.5 rounded-full bg-primary" />
          Plataforma para ministérios
        </div>
        <h1 className="text-4xl sm:text-6xl font-semibold tracking-tight">
          Organize seu ministério com <span className="text-primary">clareza</span>.
        </h1>
        <p className="mt-6 text-lg text-muted-foreground max-w-2xl mx-auto">
          ChurchEscales centraliza escalas, funções, membros e comunicação — tudo num lugar só, com permissões pensadas para a realidade da igreja.
        </p>
        <div className="mt-8 flex items-center justify-center gap-3">
          <Button asChild size="lg" className="shadow-elegant">
            <Link to="/cadastro">Começar agora <ArrowRight className="ml-1.5 h-4 w-4" /></Link>
          </Button>
          <Button asChild size="lg" variant="outline"><Link to="/login">Já tenho conta</Link></Button>
        </div>
      </section>

      <section className="px-6 pb-24 max-w-6xl mx-auto grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {features.map((f) => (
          <div key={f.title} className="rounded-xl border border-border bg-card p-5 shadow-card">
            <div className="h-10 w-10 rounded-lg bg-primary/15 text-primary flex items-center justify-center mb-3">
              <f.icon className="h-5 w-5" />
            </div>
            <h3 className="font-medium">{f.title}</h3>
            <p className="text-sm text-muted-foreground mt-1">{f.desc}</p>
          </div>
        ))}
      </section>
    </div>
  );
}