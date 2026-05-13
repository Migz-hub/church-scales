import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  Bell,
  Palette,
  LogOut,
  ChevronRight,
  MessageSquareText,
  HelpCircle,
  Globe,
} from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogFooter,
} from "@/components/ui/alert-dialog";
import { useAuth } from "@/contexts/AuthContext";
import { useTheme } from "@/contexts/ThemeContext";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-7">
      <div className="px-4 mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        {title}
      </div>
      <div className="rounded-2xl border border-border bg-card overflow-hidden divide-y divide-border/60">
        {children}
      </div>
    </div>
  );
}

function Row({
  icon: Icon,
  label,
  hint,
  to,
  onClick,
  destructive,
  trailing,
}: {
  icon?: React.ElementType;
  label: string;
  hint?: React.ReactNode;
  to?: string;
  onClick?: () => void;
  destructive?: boolean;
  trailing?: React.ReactNode;
}) {
  const inner = (
    <div className="flex items-center gap-3 px-4 py-3.5 hover:bg-muted/40 transition-colors">
      {Icon && (
        <div className={`h-8 w-8 rounded-lg flex items-center justify-center ${destructive ? "bg-destructive/10 text-destructive" : "bg-primary/10 text-primary"}`}>
          <Icon className="h-4 w-4" />
        </div>
      )}
      <div className="flex-1 min-w-0">
        <div className={`text-sm font-medium ${destructive ? "text-destructive" : ""}`}>{label}</div>
      </div>
      {trailing ?? (hint && <div className="text-xs text-muted-foreground">{hint}</div>)}
      {(to || onClick) && !trailing && <ChevronRight className="h-4 w-4 text-muted-foreground" />}
    </div>
  );
  if (to) return <Link to={to}>{inner}</Link>;
  return (
    <button onClick={onClick} className="w-full text-left">
      {inner}
    </button>
  );
}

export default function Settings() {
  const navigate = useNavigate();
  const { signOut } = useAuth();
  const { mode, color } = useTheme();
  const [signOutOpen, setSignOutOpen] = useState(false);

  const onSignOut = async () => {
    await signOut();
    navigate("/login");
  };

  const modeLabel = mode === "light" ? "Claro" : mode === "dark" ? "Escuro" : "Padrão do sistema";

  return (
    <div className="max-w-xl mx-auto">
      <PageHeader title="Configurações" />

      <Section title="Notificações">
        <Row icon={Bell} label="Notificações" to="/configuracoes/notificacoes" />
      </Section>

      <Section title="Aparência">
        <Row icon={Palette} label="Tema e cores" hint={modeLabel} to="/configuracoes/aparencia" />
        <Row
          label="Cor principal"
          to="/configuracoes/aparencia"
          trailing={
            <span className="flex items-center gap-2">
              <span className="h-5 w-10 rounded-full" style={{ backgroundColor: color }} />
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            </span>
          }
        />
      </Section>

      <Section title="Sistema">
        <Row icon={MessageSquareText} label="Sugestões" hint="Em breve" />
        <Row icon={HelpCircle} label="Suporte" hint="Em breve" />
        <Row icon={Globe} label="Idioma" hint="Português" />
      </Section>

      <Section title="Conta">
        <Row icon={LogOut} label="Sair" destructive onClick={() => setSignOutOpen(true)} />
      </Section>

      <p className="text-center text-xs text-muted-foreground mt-2 mb-8">Versão 1.0.0</p>

      <AlertDialog open={signOutOpen} onOpenChange={setSignOutOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Sair da conta?</AlertDialogTitle>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={onSignOut}>Sair</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}