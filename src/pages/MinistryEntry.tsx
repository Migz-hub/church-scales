import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { ChevronRight, LogIn, Plus } from "lucide-react";
import { FullscreenPage } from "@/components/FullscreenPage";

export default function MinistryEntry() {
  const { user } = useAuth();
  const navigate = useNavigate();

  return (
    <FullscreenPage backTo="/dashboard" className="max-w-xl">
      <div className="w-full">
      <div className="rounded-2xl border border-border bg-card p-5 flex items-center gap-3">
        <div className="h-11 w-11 rounded-full bg-primary/15 text-primary flex items-center justify-center font-semibold">
          {user?.name.split(" ").map((p) => p[0]).slice(0, 2).join("").toUpperCase()}
        </div>
        <div className="min-w-0">
          <div className="font-semibold uppercase tracking-wide text-sm truncate">{user?.name}</div>
          <div className="text-xs text-muted-foreground truncate">{user?.email}</div>
        </div>
      </div>

      <div className="mt-7">
        <div className="px-1 mb-2 text-xs font-semibold uppercase text-muted-foreground tracking-wider">
          Adicionar ministério
        </div>
        <p className="px-1 text-sm text-muted-foreground mb-4">
          Selecione uma opção para continuar:
        </p>

        <div className="space-y-3">
          <EntryCard
            icon={<LogIn className="h-5 w-5" />}
            title="Ingressar em um ministério"
            subtitle="Entre com o código de convite de um ministério."
            onClick={() => navigate("/ministerios/ingressar")}
          />
          <EntryCard
            icon={<Plus className="h-5 w-5" />}
            title="Cadastrar novo ministério"
            subtitle="Crie um novo ministério para começar a organizar sua equipe."
            onClick={() => navigate("/ministerios/criar")}
          />
        </div>
      </div>
      </div>
    </FullscreenPage>
  );
}

function EntryCard({
  icon,
  title,
  subtitle,
  onClick,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="w-full text-left rounded-2xl border border-border bg-card hover:bg-muted/40 transition p-5 flex items-center gap-4"
    >
      <span className="h-11 w-11 rounded-xl bg-primary/15 text-primary flex items-center justify-center shrink-0">
        {icon}
      </span>
      <div className="flex-1 min-w-0">
        <div className="text-lg font-semibold truncate">{title}</div>
        <div className="text-sm text-muted-foreground truncate mt-0.5">{subtitle}</div>
      </div>
      <ChevronRight className="h-5 w-5 text-muted-foreground shrink-0" />
    </button>
  );
}
