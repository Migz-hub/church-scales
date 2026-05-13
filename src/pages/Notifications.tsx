import { useEffect, useMemo, useState } from "react";
import { Bell, Check, MoreVertical, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/PageHeader";
import { LoadingState } from "@/components/LoadingState";
import { EmptyState } from "@/components/EmptyState";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAuth } from "@/contexts/AuthContext";
import { useMinistry } from "@/contexts/MinistryContext";
import {
  announcementService,
  type AnnouncementWithRead,
} from "@/services/announcementService";
import { ministryAdminService } from "@/services/ministryAdminService";
import { toast } from "@/hooks/use-toast";
import type {
  AnnouncementAudience,
  AnnouncementPriority,
  MinistryFunction,
  MinistryTeam,
} from "@/types";
import { cn } from "@/lib/utils";

const PRIORITY_LABEL: Record<AnnouncementPriority, string> = {
  normal: "Normal",
  important: "Importante",
  urgent: "Urgente",
};

const PRIORITY_BADGE: Record<AnnouncementPriority, string> = {
  normal: "bg-muted text-muted-foreground",
  important: "bg-primary/15 text-primary border border-primary/30",
  urgent: "bg-destructive/15 text-destructive border border-destructive/30",
};

const PRIORITY_BAR: Record<AnnouncementPriority, string> = {
  normal: "bg-muted",
  important: "bg-primary",
  urgent: "bg-destructive",
};

function relativeTime(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.round(diff / 60000);
  if (m < 1) return "agora";
  if (m < 60) return `há ${m} min`;
  const h = Math.round(m / 60);
  if (h < 24) return `há ${h} h`;
  const d = Math.round(h / 24);
  if (d < 7) return `há ${d} d`;
  return new Date(iso).toLocaleDateString("pt-BR");
}

function audienceLabel(
  a: AnnouncementAudience,
  teams: MinistryTeam[],
  fns: MinistryFunction[],
) {
  switch (a.kind) {
    case "all":
      return "Todos os membros";
    case "admins":
      return "Apenas administradores";
    case "team":
      return `Equipe: ${teams.find((t) => t.id === a.teamId)?.name ?? "—"}`;
    case "function":
      return `Função: ${fns.find((f) => f.id === a.functionId)?.name ?? "—"}`;
  }
}

export default function Notifications() {
  const { user } = useAuth();
  const { active, can } = useMinistry();
  const canSend = can("announcement.send");

  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<AnnouncementWithRead[]>([]);
  const [teams, setTeams] = useState<MinistryTeam[]>([]);
  const [functions, setFunctions] = useState<MinistryFunction[]>([]);

  const [statusFilter, setStatusFilter] = useState<"all" | "unread">("all");
  const [priorityFilter, setPriorityFilter] = useState<"all" | AnnouncementPriority>("all");

  const [composerOpen, setComposerOpen] = useState(false);

  const load = async () => {
    if (!user || !active) return;
    setLoading(true);
    const [list, t, f] = await Promise.all([
      announcementService.list(active.id, user.id),
      ministryAdminService.listTeams(active.id),
      ministryAdminService.listFunctions(active.id),
    ]);
    setItems(list);
    setTeams(t);
    setFunctions(f);
    setLoading(false);
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, active]);

  const filtered = useMemo(() => {
    return items.filter((i) => {
      if (statusFilter === "unread" && i.read) return false;
      if (priorityFilter !== "all" && i.priority !== priorityFilter) return false;
      return true;
    });
  }, [items, statusFilter, priorityFilter]);

  const unreadTotal = items.filter((i) => !i.read).length;

  const onMarkAll = async () => {
    if (!user || !active) return;
    await announcementService.markAllRead(active.id, user.id);
    load();
  };

  const onMarkOne = async (id: string) => {
    if (!user) return;
    await announcementService.markRead(id, user.id);
    load();
  };

  const onDelete = async (id: string) => {
    await announcementService.remove(id);
    toast({ title: "Aviso excluído" });
    load();
  };

  if (!active) return null;

  return (
    <div>
      <PageHeader
        title="Notificações"
        description="Comunicados e avisos do ministério"
        actions={
          canSend ? (
            <Button onClick={() => setComposerOpen(true)}>
              <Plus className="h-4 w-4 mr-1.5" />
              Nova notificação
            </Button>
          ) : undefined
        }
      />

      {/* Filtros */}
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <FilterPill
          active={statusFilter === "all"}
          onClick={() => setStatusFilter("all")}
          label="Todas"
        />
        <FilterPill
          active={statusFilter === "unread"}
          onClick={() => setStatusFilter("unread")}
          label={`Não lidas${unreadTotal ? ` (${unreadTotal})` : ""}`}
        />
        <span className="mx-1 h-5 w-px bg-border" />
        {(["all", "normal", "important", "urgent"] as const).map((p) => (
          <FilterPill
            key={p}
            active={priorityFilter === p}
            onClick={() => setPriorityFilter(p)}
            label={p === "all" ? "Todas prioridades" : PRIORITY_LABEL[p]}
          />
        ))}
        <div className="ml-auto">
          {unreadTotal > 0 && (
            <Button variant="outline" size="sm" onClick={onMarkAll}>
              <Check className="h-4 w-4 mr-1.5" /> Marcar todas como lidas
            </Button>
          )}
        </div>
      </div>

      {loading ? (
        <LoadingState />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={Bell}
          title="Sem notificações"
          description={
            canSend
              ? "Crie um aviso para comunicar seu ministério."
              : "Você verá aqui comunicados do ministério."
          }
        />
      ) : (
        <ul className="space-y-3">
          {filtered.map((n) => {
            const canManage = canSend && (user?.id === n.createdBy || can("ministry.settings"));
            return (
              <li
                key={n.id}
                className={cn(
                  "relative overflow-hidden rounded-2xl border bg-card shadow-card transition-colors",
                  n.read ? "border-border" : "border-primary/40",
                )}
              >
                <span
                  className={cn(
                    "absolute inset-y-0 left-0 w-1.5",
                    PRIORITY_BAR[n.priority],
                  )}
                />
                <div className="pl-5 pr-4 py-4">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span
                      className={cn(
                        "text-[10px] uppercase tracking-wider font-semibold px-2 py-0.5 rounded-md",
                        PRIORITY_BADGE[n.priority],
                      )}
                    >
                      {PRIORITY_LABEL[n.priority]}
                    </span>
                    {!n.read && (
                      <span className="inline-flex items-center gap-1 text-[11px] text-primary">
                        <span className="h-1.5 w-1.5 rounded-full bg-primary" />
                        Não lida
                      </span>
                    )}
                    <span className="ml-auto text-[11px] text-muted-foreground">
                      {relativeTime(n.createdAt)}
                    </span>
                    {canManage && (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button className="p-1 rounded-md hover:bg-muted text-muted-foreground">
                            <MoreVertical className="h-4 w-4" />
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => onDelete(n.id)} className="text-destructive">
                            <Trash2 className="h-4 w-4 mr-2" /> Excluir
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    )}
                  </div>

                  <h3 className="mt-1.5 font-semibold leading-snug">{n.title}</h3>
                  <p className="mt-1 text-sm text-muted-foreground whitespace-pre-wrap">
                    {n.message}
                  </p>

                  <div className="mt-3 pt-3 border-t border-border flex items-center gap-3 flex-wrap text-xs text-muted-foreground">
                    <span className="inline-flex items-center gap-1.5">
                      <span className="h-5 w-5 rounded-full bg-primary/15 text-primary text-[10px] font-semibold flex items-center justify-center">
                        {n.createdByName.slice(0, 1).toUpperCase()}
                      </span>
                      {n.createdByName}
                    </span>
                    <span>·</span>
                    <span>{audienceLabel(n.audience, teams, functions)}</span>
                    {!n.read && (
                      <button
                        onClick={() => onMarkOne(n.id)}
                        className="ml-auto text-primary hover:text-primary-glow inline-flex items-center gap-1"
                      >
                        <Check className="h-3.5 w-3.5" /> Marcar como lida
                      </button>
                    )}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {canSend && (
        <AnnouncementComposer
          open={composerOpen}
          onOpenChange={setComposerOpen}
          teams={teams}
          functions={functions}
          onCreated={load}
        />
      )}
    </div>
  );
}

function FilterPill({
  active,
  onClick,
  label,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "px-3 py-1.5 rounded-full text-xs font-medium border transition-colors",
        active
          ? "bg-primary text-primary-foreground border-primary"
          : "bg-card text-muted-foreground border-border hover:text-foreground",
      )}
    >
      {label}
    </button>
  );
}

function AnnouncementComposer({
  open,
  onOpenChange,
  teams,
  functions,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  teams: MinistryTeam[];
  functions: MinistryFunction[];
  onCreated: () => void;
}) {
  const { user } = useAuth();
  const { active } = useMinistry();
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [priority, setPriority] = useState<AnnouncementPriority>("normal");
  const [audienceKind, setAudienceKind] = useState<
    "all" | "admins" | "team" | "function"
  >("all");
  const [teamId, setTeamId] = useState<string>("");
  const [functionId, setFunctionId] = useState<string>("");
  const [scheduledAt, setScheduledAt] = useState<string>("");
  const [saving, setSaving] = useState(false);

  const reset = () => {
    setTitle("");
    setMessage("");
    setPriority("normal");
    setAudienceKind("all");
    setTeamId("");
    setFunctionId("");
    setScheduledAt("");
  };

  const submit = async () => {
    if (!user || !active) return;
    if (!title.trim() || !message.trim()) {
      toast({ title: "Preencha título e mensagem", variant: "destructive" });
      return;
    }
    let audience: AnnouncementAudience;
    if (audienceKind === "team") {
      if (!teamId) return toast({ title: "Selecione a equipe", variant: "destructive" });
      audience = { kind: "team", teamId };
    } else if (audienceKind === "function") {
      if (!functionId) return toast({ title: "Selecione a função", variant: "destructive" });
      audience = { kind: "function", functionId };
    } else {
      audience = { kind: audienceKind };
    }
    setSaving(true);
    try {
      await announcementService.create({
        ministryId: active.id,
        title,
        message,
        priority,
        audience,
        createdBy: user.id,
        createdByName: user.name,
        scheduledAt: scheduledAt ? new Date(scheduledAt).toISOString() : undefined,
      });
      toast({ title: "Aviso publicado" });
      reset();
      onOpenChange(false);
      onCreated();
    } finally {
      setSaving(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-screen max-w-none sm:max-w-none p-0 flex flex-col"
      >
        <SheetHeader className="px-6 py-4 border-b border-border">
          <SheetTitle>Nova notificação</SheetTitle>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5 max-w-2xl w-full mx-auto">
          <div className="space-y-1.5">
            <Label htmlFor="ann-title">Título</Label>
            <Input
              id="ann-title"
              maxLength={80}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Ex.: Ensaio de quinta foi adiado"
            />
            <div className="text-[11px] text-muted-foreground text-right">
              {title.length}/80
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="ann-msg">Mensagem</Label>
            <Textarea
              id="ann-msg"
              rows={6}
              maxLength={2000}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Escreva o comunicado..."
            />
            <div className="text-[11px] text-muted-foreground text-right">
              {message.length}/2000
            </div>
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Prioridade</Label>
              <Select
                value={priority}
                onValueChange={(v) => setPriority(v as AnnouncementPriority)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="normal">Normal</SelectItem>
                  <SelectItem value="important">Importante</SelectItem>
                  <SelectItem value="urgent">Urgente</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label>Destinatários</Label>
              <Select
                value={audienceKind}
                onValueChange={(v) => setAudienceKind(v as typeof audienceKind)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os membros</SelectItem>
                  <SelectItem value="admins">Apenas administradores</SelectItem>
                  <SelectItem value="team">Equipe específica</SelectItem>
                  <SelectItem value="function">Função específica</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {audienceKind === "team" && (
            <div className="space-y-1.5">
              <Label>Equipe</Label>
              <Select value={teamId} onValueChange={setTeamId}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione a equipe" />
                </SelectTrigger>
                <SelectContent>
                  {teams.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {audienceKind === "function" && (
            <div className="space-y-1.5">
              <Label>Função</Label>
              <Select value={functionId} onValueChange={setFunctionId}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione a função" />
                </SelectTrigger>
                <SelectContent>
                  {functions.map((f) => (
                    <SelectItem key={f.id} value={f.id}>
                      {f.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="ann-sched">Agendar envio (opcional)</Label>
            <Input
              id="ann-sched"
              type="datetime-local"
              value={scheduledAt}
              onChange={(e) => setScheduledAt(e.target.value)}
            />
          </div>
        </div>

        <div className="px-6 py-4 border-t border-border flex items-center justify-end gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={submit} disabled={saving}>
            {saving ? "Publicando..." : "Publicar"}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
