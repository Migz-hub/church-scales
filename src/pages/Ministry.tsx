import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  ChevronRight,
  ChevronDown,
  ChevronLeft,
  Copy,
  FileText,
  ListChecks,
  MoreVertical,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  ShieldCheck,
  Trash2,
  UserPlus,
  Users,
  Users2,
  X,
  UserCheck,
  Lock,
  Check as CheckIcon,
} from "lucide-react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { LoadingState } from "@/components/LoadingState";
import { EmptyState } from "@/components/EmptyState";
import { useAuth } from "@/contexts/AuthContext";
import { useMinistry } from "@/contexts/MinistryContext";
import { ministryService } from "@/services/ministryService";
import { ministryAdminService, DEFAULT_PERMISSIONS } from "@/services/ministryAdminService";
import type {
  MemberPermissions,
  MinistryDefaults,
  MinistryFunction,
  MinistryMember,
  MinistryTeam,
  PermissionKey,
  MinistryJoinRequest,
} from "@/types";
import { notificationService } from "@/services/notificationService";
import { roleLabel } from "@/lib/permissions";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

function initials(name: string) {
  return name.split(" ").filter(Boolean).map((p) => p[0]).slice(0, 2).join("").toUpperCase();
}

const FUNCTION_PERMISSION_KEYS: PermissionKey[] = [
  "function.create",
  "function.edit",
  "function.delete",
  "function.assign",
];

/** Classes para Sheet em tela cheia (em vez de drawer lateral). */
const FULL_SHEET =
  "bg-zinc-950 border-zinc-800 w-screen h-screen max-w-none sm:max-w-none inset-0 overflow-y-auto";

/** Grupos de permissões exibidos como 4 switches consolidados. */
type PermissionGroupId = "schedules" | "repertoire" | "functions" | "members";

interface PermissionGroup {
  id: PermissionGroupId;
  title: string;
  description: string;
  obs?: string;
  keys: PermissionKey[];
}

const PERMISSION_GROUPS: PermissionGroup[] = [
  {
    id: "schedules",
    title: "Escalas",
    description:
      "Permite criar, editar e excluir escalas, incluindo todas as informações da escala, como data, participantes, músicas e observações.",
    keys: ["schedule.create", "schedule.edit", "schedule.delete", "agenda.edit", "participants.manage"],
  },
  {
    id: "repertoire",
    title: "Repertório geral",
    description: "Permite adicionar, editar e excluir músicas no repertório do ministério.",
    obs: "Não permite alterar as músicas das escalas.",
    keys: [],
  },
  {
    id: "functions",
    title: "Funções",
    description: "Permite criar, editar e excluir funções do ministério.",
    obs: "Não permite alterar as funções atribuídas aos membros.",
    keys: ["function.create", "function.edit", "function.delete", "function.assign"],
  },
  {
    id: "members",
    title: "Membros",
    description: "Permite adicionar, remover e gerenciar membros do ministério.",
    keys: [],
  },
];

export default function Ministry() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { active, role, refresh } = useMinistry();
  const isAdmin = role === "owner" || role === "admin";
  const isOwner = role === "owner";

  const [tab, setTab] = useState<"info" | "members">("info");
  const [loading, setLoading] = useState(true);

  const [members, setMembers] = useState<MinistryMember[]>([]);
  const [functions, setFunctions] = useState<MinistryFunction[]>([]);
  const [teams, setTeams] = useState<MinistryTeam[]>([]);
  const [defaults, setDefaults] = useState<MinistryDefaults | null>(null);
  const [memberFns, setMemberFns] = useState<Record<string, string[]>>({});
  const [joinRequests, setJoinRequests] = useState<MinistryJoinRequest[]>([]);
  const [requestsOpen, setRequestsOpen] = useState(false);

  const [editOpen, setEditOpen] = useState(false);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [functionsOpen, setFunctionsOpen] = useState(false);
  const [adminsOpen, setAdminsOpen] = useState(false);
  const [teamsOpen, setTeamsOpen] = useState(false);
  const [agendaOpen, setAgendaOpen] = useState(false);
  const [addMemberOpen, setAddMemberOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [memberDrawer, setMemberDrawer] = useState<MinistryMember | null>(null);

  const reload = async () => {
    if (!active) return;
    setLoading(true);
    const [m, f, t, d, jr] = await Promise.all([
      ministryService.listMembers(active.id),
      ministryAdminService.listFunctions(active.id),
      ministryAdminService.listTeams(active.id),
      ministryAdminService.getDefaults(active.id),
      ministryService.listJoinRequests(active.id, "pending"),
    ]);
    setMembers(m);
    setFunctions(f);
    setTeams(t);
    setDefaults(d);
    setJoinRequests(jr);
    const map: Record<string, string[]> = {};
    for (const member of m) {
      const cfg = await ministryAdminService.getMemberConfig(active.id, member.id);
      map[member.id] = cfg.functionIds;
    }
    setMemberFns(map);
    setLoading(false);
  };

  useEffect(() => {
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active?.id]);

  // Auto-abrir folha de solicitações se vier do dashboard com ?requests=1
  useEffect(() => {
    if (searchParams.get("requests") === "1" && isAdmin) {
      setRequestsOpen(true);
      const next = new URLSearchParams(searchParams);
      next.delete("requests");
      setSearchParams(next, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, isAdmin]);

  if (!active) return null;

  const handleDelete = async () => {
    await ministryService.deleteMinistry(active.id);
    toast.success("Ministério excluído");
    setConfirmDelete(false);
    await refresh();
    navigate("/ministerios/entrada");
  };

  return (
    <div className="mx-auto w-full max-w-2xl">
      {/* Centered header */}
      <header className="text-center pt-2 pb-6">
        <h1 className="text-2xl font-semibold tracking-tight">Ministério</h1>
        <p className="text-sm text-muted-foreground mt-0.5">{active.name}</p>
      </header>

      <Tabs value={tab} onValueChange={(v) => setTab(v as "info" | "members")} className="w-full">
        <TabsList className="grid grid-cols-2 w-full h-12 rounded-2xl bg-zinc-900/70 border border-zinc-800 p-1">
          <TabsTrigger value="info" className="rounded-xl data-[state=active]:bg-zinc-800 data-[state=active]:text-foreground">
            Informações
          </TabsTrigger>
          <TabsTrigger value="members" className="rounded-xl data-[state=active]:bg-zinc-800 data-[state=active]:text-foreground">
            Membros ({members.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="info" className="mt-4">
          {loading ? (
            <LoadingState />
          ) : (
            <div className="space-y-3">
              {/* Banner card */}
              <div className="relative rounded-2xl overflow-hidden border border-zinc-800 bg-zinc-900/60">
                <div
                  className="h-44 w-full bg-gradient-to-br from-indigo-600/40 via-violet-600/30 to-fuchsia-600/20"
                  style={
                    defaults?.bannerUrl
                      ? { backgroundImage: `url(${defaults.bannerUrl})`, backgroundSize: "cover", backgroundPosition: "center" }
                      : undefined
                  }
                />
                <div className="absolute inset-0 flex items-end justify-between p-4">
                  <div className="flex items-end gap-3">
                    <div className="h-14 w-14 rounded-xl bg-zinc-950/80 border border-zinc-700 flex items-center justify-center text-xl font-bold text-indigo-400 backdrop-blur-sm overflow-hidden">
                      {defaults?.avatarUrl ? (
                        <img src={defaults.avatarUrl} alt={active.name} className="h-full w-full object-cover" />
                      ) : (
                        initials(active.name)
                      )}
                    </div>
                  </div>
                  {isAdmin && (
                    <Button size="icon" variant="secondary" className="h-9 w-9 rounded-full" onClick={() => setEditOpen(true)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </div>

              {/* Name row */}
              <SettingsRow
                icon={<span className="text-base font-semibold">Tt</span>}
                title={active.name}
                onClick={isAdmin ? () => setEditOpen(true) : undefined}
                trailing={isAdmin ? <MoreVertical className="h-4 w-4 text-muted-foreground" /> : undefined}
              />

              {/* Invite */}
              <SettingsRow
                icon={<UserPlus className="h-5 w-5 text-indigo-400" />}
                title="Convidar membros"
                subtitle="Gerar novo convite"
                onClick={() => setInviteOpen(true)}
                trailing={<ChevronRight className="h-4 w-4 text-muted-foreground" />}
                emphasized
              />

              {isAdmin && joinRequests.length > 0 && (
                <SettingsRow
                  icon={<UserCheck className="h-5 w-5 text-amber-400" />}
                  title="Solicitações de entrada"
                  subtitle={`${joinRequests.length} pendente${joinRequests.length > 1 ? "s" : ""}`}
                  onClick={() => setRequestsOpen(true)}
                  trailing={
                    <span className="min-w-[1.5rem] h-6 px-2 inline-flex items-center justify-center rounded-full bg-amber-500/20 text-amber-300 text-xs font-semibold">
                      {joinRequests.length}
                    </span>
                  }
                />
              )}

              {/* Group */}
              <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 divide-y divide-zinc-800/80 overflow-hidden">
                <SettingsRow
                  flush
                  icon={<Users2 className="h-5 w-5 text-muted-foreground" />}
                  title="Equipes"
                  trailing={<ChevronRight className="h-4 w-4 text-muted-foreground" />}
                  onClick={() => setTeamsOpen(true)}
                />
                <SettingsRow
                  flush
                  icon={<ListChecks className="h-5 w-5 text-muted-foreground" />}
                  title="Funções"
                  trailing={<ChevronRight className="h-4 w-4 text-muted-foreground" />}
                  onClick={() => setFunctionsOpen(true)}
                />
                <SettingsRow
                  flush
                  icon={<ShieldCheck className="h-5 w-5 text-muted-foreground" />}
                  title="Administradores"
                  trailing={<ChevronRight className="h-4 w-4 text-muted-foreground" />}
                  onClick={() => setAdminsOpen(true)}
                />
                <SettingsRow
                  flush
                  icon={<FileText className="h-5 w-5 text-muted-foreground" />}
                  title="Modelos de roteiro"
                  trailing={<ChevronRight className="h-4 w-4 text-muted-foreground" />}
                  onClick={() => setAgendaOpen(true)}
                />
              </div>

              {/* Delete */}
              {isOwner && (
                <button
                  onClick={() => setConfirmDelete(true)}
                  className="w-full flex items-center gap-3 rounded-2xl border border-zinc-800 bg-zinc-900/60 px-4 py-4 text-left hover:bg-zinc-900 transition"
                >
                  <Trash2 className="h-5 w-5 text-destructive" />
                  <span className="text-destructive font-medium">Excluir ministério</span>
                </button>
              )}
            </div>
          )}
        </TabsContent>

        <TabsContent value="members" className="mt-4">
          {loading ? (
            <LoadingState />
          ) : (
            <MembersList
              members={members}
              functions={functions}
              memberFns={memberFns}
              onSelect={setMemberDrawer}
              canAdd={isAdmin}
              onAdd={() => setAddMemberOpen(true)}
              inviteCode={active.inviteCode}
            />
          )}
        </TabsContent>
      </Tabs>

      {/* Sheets */}
      <EditMinistrySheet
        open={editOpen}
        onOpenChange={setEditOpen}
        ministryId={active.id}
        ministryName={active.name}
        defaults={defaults}
        onSaved={async () => {
          await refresh();
          await reload();
        }}
      />

      <InviteSheet
        open={inviteOpen}
        onOpenChange={setInviteOpen}
        inviteCode={active.inviteCode}
        invitesEnabled={active.invitesEnabled}
        canManage={isAdmin}
        ministryId={active.id}
        onChanged={async () => {
          await refresh();
          await reload();
        }}
      />

      <FunctionsSheet
        open={functionsOpen}
        onOpenChange={setFunctionsOpen}
        functions={functions}
        canEdit={isAdmin}
        ministryId={active.id}
        onChanged={reload}
      />

      <AdminsSheet
        open={adminsOpen}
        onOpenChange={setAdminsOpen}
        members={members}
        ministryId={active.id}
        canManage={isAdmin}
        currentUserId={user?.id}
        onChanged={reload}
      />

      <TeamsSheet
        open={teamsOpen}
        onOpenChange={setTeamsOpen}
        teams={teams}
        functions={functions}
        canEdit={isAdmin}
        ministryId={active.id}
        onChanged={reload}
      />

      <AgendaTemplatesSheet open={agendaOpen} onOpenChange={setAgendaOpen} />

      <JoinRequestsSheet
        open={requestsOpen}
        onOpenChange={setRequestsOpen}
        requests={joinRequests}
        ministryName={active.name}
        ministryId={active.id}
        functions={functions}
        deciderId={user?.id ?? ""}
        onChanged={reload}
      />

      <AddMemberSheet
        open={addMemberOpen}
        onOpenChange={setAddMemberOpen}
        ministryId={active.id}
        inviteCode={active.inviteCode}
        onAdded={reload}
      />

      <MemberDrawer
        member={memberDrawer}
        functions={functions}
        defaults={defaults}
        ministryId={active.id}
        canManage={isAdmin}
        currentUserId={user?.id}
        onClose={() => setMemberDrawer(null)}
        onChanged={reload}
      />

      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir ministério?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita. Todos os membros, escalas, funções e mensagens deste ministério serão removidos.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Excluir definitivamente
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

/* =================== UI bits =================== */

function SettingsRow({
  icon,
  title,
  subtitle,
  trailing,
  onClick,
  emphasized,
  flush,
}: {
  icon?: ReactNode;
  title: string;
  subtitle?: string;
  trailing?: ReactNode;
  onClick?: () => void;
  emphasized?: boolean;
  flush?: boolean;
}) {
  const Cmp = onClick ? "button" : "div";
  return (
    <Cmp
      onClick={onClick}
      className={cn(
        "w-full flex items-center gap-3 px-4 py-4 text-left transition",
        !flush && "rounded-2xl border border-zinc-800 bg-zinc-900/60",
        onClick && "hover:bg-zinc-900",
        emphasized && "border-indigo-500/30 bg-indigo-500/[0.06] hover:bg-indigo-500/[0.12]",
      )}
    >
      {icon && <span className="h-8 w-8 flex items-center justify-center shrink-0">{icon}</span>}
      <div className="flex-1 min-w-0">
        <div className={cn("font-medium truncate", emphasized && "text-foreground")}>{title}</div>
        {subtitle && <div className="text-xs text-muted-foreground truncate mt-0.5">{subtitle}</div>}
      </div>
      {trailing}
    </Cmp>
  );
}

/* =================== Members List =================== */
function MembersList({
  members,
  functions,
  memberFns,
  onSelect,
  canAdd,
  onAdd,
  inviteCode,
}: {
  members: MinistryMember[];
  functions: MinistryFunction[];
  memberFns: Record<string, string[]>;
  onSelect: (m: MinistryMember) => void;
  canAdd: boolean;
  onAdd: () => void;
  inviteCode: string;
}) {
  const [q, setQ] = useState("");
  const filtered = useMemo(() => {
    const t = q.trim().toLowerCase();
    if (!t) return members;
    return members.filter((m) => m.user.name.toLowerCase().includes(t) || m.user.email.toLowerCase().includes(t));
  }, [members, q]);

  if (members.length === 0) {
    return (
      <div className="space-y-4">
        <EmptyState
          icon={Users}
          title="Nenhum membro ainda"
          description={`Compartilhe o código ${inviteCode} ou cadastre manualmente.`}
          action={canAdd ? <Button onClick={onAdd}><UserPlus className="h-4 w-4 mr-1" /> Adicionar membro</Button> : undefined}
        />
      </div>
    );
  }

  return (
    <div className="relative">
      <div className="relative mb-3">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar membro..." className="pl-9" />
      </div>

      <div className="space-y-2">
        {filtered.map((m) => {
          const fns = (memberFns[m.id] ?? [])
            .map((id) => functions.find((f) => f.id === id))
            .filter(Boolean) as MinistryFunction[];
          const isAdmin = m.role === "owner" || m.role === "admin";
          return (
            <button
              key={m.id}
              onClick={() => onSelect(m)}
              className="w-full text-left flex items-center gap-3 px-3 py-3 rounded-xl hover:bg-zinc-900/60 transition"
            >
              <div className="h-11 w-11 rounded-full bg-indigo-500/15 text-indigo-400 flex items-center justify-center text-sm font-semibold shrink-0">
                {initials(m.user.name)}
              </div>
              <div className="min-w-0 flex-1">
                <div className="font-medium truncate">{m.user.name}</div>
                <div className="text-xs text-muted-foreground truncate">
                  {fns.length > 0 ? fns.map((f) => f.name).join(", ") : "Sem funções"}
                </div>
                {isAdmin && (
                  <div className="text-xs text-indigo-400 mt-0.5">{roleLabel[m.role]}</div>
                )}
              </div>
              <MoreVertical className="h-4 w-4 text-muted-foreground" />
            </button>
          );
        })}
      </div>

      {canAdd && (
        <button
          onClick={onAdd}
          className="fixed bottom-6 right-6 z-30 inline-flex items-center gap-2 rounded-full bg-indigo-600 hover:bg-indigo-500 text-white px-5 py-3 shadow-lg shadow-indigo-900/40 transition"
        >
          <UserPlus className="h-4 w-4" />
          <span className="font-medium">Adicionar</span>
        </button>
      )}
    </div>
  );
}

/* =================== Invite Sheet =================== */
function InviteSheet({
  open,
  onOpenChange,
  inviteCode,
  invitesEnabled,
  canManage,
  ministryId,
  onChanged,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  inviteCode: string;
  invitesEnabled: boolean;
  canManage: boolean;
  ministryId: string;
  onChanged: () => void;
}) {
  const copy = () => {
    navigator.clipboard.writeText(inviteCode);
    toast.success("Código copiado");
  };
  const regen = async () => {
    await ministryService.regenerateCode(ministryId);
    toast.success("Novo código gerado");
    onChanged();
  };
  const toggle = async (v: boolean) => {
    await ministryService.update(ministryId, { invitesEnabled: v });
    onChanged();
  };
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className={FULL_SHEET}>
        <SheetHeader>
          <SheetTitle>Convidar membros</SheetTitle>
          <SheetDescription>Compartilhe o código abaixo com quem você quer convidar.</SheetDescription>
        </SheetHeader>
        <div className="mt-6 space-y-4">
          <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-5 text-center">
            <div className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Código de convite</div>
            <div className="text-3xl font-mono tracking-[0.4em] font-semibold">{inviteCode}</div>
            <div className="mt-4 flex justify-center gap-2">
              <Button variant="outline" onClick={copy}><Copy className="h-4 w-4 mr-1" /> Copiar</Button>
              {canManage && (
                <Button variant="outline" onClick={regen}><RefreshCw className="h-4 w-4 mr-1" /> Gerar novo</Button>
              )}
            </div>
          </div>
          {canManage && (
            <div className="flex items-center justify-between rounded-xl border border-zinc-800 bg-zinc-900/60 px-4 py-3">
              <div>
                <div className="text-sm font-medium">Convites habilitados</div>
                <div className="text-xs text-muted-foreground">Pessoas podem entrar via código</div>
              </div>
              <Switch checked={invitesEnabled} onCheckedChange={toggle} />
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

/* =================== Functions Sheet =================== */
function FunctionsSheet({
  open,
  onOpenChange,
  functions,
  canEdit,
  ministryId,
  onChanged,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  functions: MinistryFunction[];
  canEdit: boolean;
  ministryId: string;
  onChanged: () => void;
}) {
  const [name, setName] = useState("");
  const [adding, setAdding] = useState(false);

  const create = async () => {
    if (!name.trim()) return;
    await ministryAdminService.createFunction(ministryId, { name });
    setName("");
    setAdding(false);
    toast.success("Função criada");
    onChanged();
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className={FULL_SHEET}>
        <SheetHeader>
          <SheetTitle>Funções</SheetTitle>
          <SheetDescription>Capacidades do ministério atribuíveis aos membros.</SheetDescription>
        </SheetHeader>

        <div className="mt-6 space-y-2">
          {functions.length === 0 && !adding && (
            <p className="text-sm text-muted-foreground py-4 text-center">Nenhuma função cadastrada.</p>
          )}
          {functions.map((fn) => (
            <div
              key={fn.id}
              className="flex items-center justify-between rounded-xl border border-zinc-800 bg-zinc-900/60 px-4 py-3"
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className="h-8 w-8 rounded-lg bg-indigo-500/15 text-indigo-400 flex items-center justify-center text-xs font-semibold">
                  {initials(fn.name)}
                </div>
                <span className={cn("text-sm truncate", !fn.active && "opacity-60")}>{fn.name}</span>
              </div>
              {canEdit && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="text-muted-foreground hover:text-destructive"
                  onClick={async () => {
                    if (!confirm(`Excluir função "${fn.name}"?`)) return;
                    await ministryAdminService.deleteFunction(fn.id);
                    toast.success("Função excluída");
                    onChanged();
                  }}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              )}
            </div>
          ))}

          {adding && (
            <div className="flex gap-2">
              <Input
                autoFocus
                placeholder="Ex: Vocal, Guitarra"
                value={name}
                onChange={(e) => setName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && create()}
              />
              <Button onClick={create}>Salvar</Button>
              <Button variant="ghost" onClick={() => { setAdding(false); setName(""); }}>Cancelar</Button>
            </div>
          )}

          {canEdit && !adding && (
            <Button variant="outline" className="w-full" onClick={() => setAdding(true)}>
              <Plus className="h-4 w-4 mr-1" /> Nova função
            </Button>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

/* =================== Admins Sheet =================== */
function AdminsSheet({
  open,
  onOpenChange,
  members,
  ministryId,
  canManage,
  currentUserId,
  onChanged,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  members: MinistryMember[];
  ministryId: string;
  canManage: boolean;
  currentUserId?: string;
  onChanged: () => void;
}) {
  const sorted = [...members].sort((a, b) => {
    const score = (m: MinistryMember) => (m.role === "owner" ? 2 : m.role === "admin" ? 1 : 0);
    return score(b) - score(a);
  });

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className={FULL_SHEET}>
        <SheetHeader>
          <SheetTitle>Administradores</SheetTitle>
          <SheetDescription>Ative para promover. O dono não pode ser alterado.</SheetDescription>
        </SheetHeader>

        <div className="mt-6 space-y-2">
          {sorted.map((m) => {
            const isAdmin = m.role === "owner" || m.role === "admin";
            const isOwner = m.role === "owner";
            const isMe = m.userId === currentUserId;
            return (
              <div key={m.id} className="flex items-center gap-3 px-3 py-3 rounded-xl border border-zinc-800 bg-zinc-900/60">
                <div className="h-10 w-10 rounded-full bg-indigo-500/15 text-indigo-400 flex items-center justify-center text-sm font-semibold">
                  {initials(m.user.name)}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium truncate">
                    {m.user.name} {isMe && <span className="text-xs text-muted-foreground">(você)</span>}
                  </div>
                  <div className="text-xs text-muted-foreground truncate">{m.user.email}</div>
                </div>
                <Switch
                  checked={isAdmin}
                  disabled={!canManage || isOwner}
                  onCheckedChange={async (v) => {
                    try {
                      await ministryService.setMemberRole(ministryId, m.id, v ? "admin" : "member");
                      toast.success(v ? `${m.user.name} agora é admin` : `${m.user.name} removido dos admins`);
                      onChanged();
                    } catch (e) {
                      toast.error(e instanceof Error ? e.message : "Erro");
                    }
                  }}
                />
              </div>
            );
          })}
        </div>
      </SheetContent>
    </Sheet>
  );
}

/* =================== Teams Sheet =================== */
function TeamsSheet({
  open,
  onOpenChange,
  teams,
  functions,
  canEdit,
  ministryId,
  onChanged,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  teams: MinistryTeam[];
  functions: MinistryFunction[];
  canEdit: boolean;
  ministryId: string;
  onChanged: () => void;
}) {
  const [editing, setEditing] = useState<MinistryTeam | null>(null);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [fnIds, setFnIds] = useState<string[]>([]);

  useEffect(() => {
    if (creating) { setName(""); setFnIds([]); }
    else if (editing) { setName(editing.name); setFnIds(editing.functionIds); }
  }, [creating, editing]);

  const showForm = creating || !!editing;

  const save = async () => {
    if (!name.trim()) return;
    if (editing) {
      await ministryAdminService.updateTeam(editing.id, { name: name.trim(), functionIds: fnIds });
      toast.success("Equipe atualizada");
    } else {
      await ministryAdminService.createTeam(ministryId, name.trim(), fnIds);
      toast.success("Equipe criada");
    }
    setCreating(false);
    setEditing(null);
    onChanged();
  };

  return (
    <Sheet open={open} onOpenChange={(o) => { if (!o) { setCreating(false); setEditing(null); } onOpenChange(o); }}>
      <SheetContent side="right" className={FULL_SHEET}>
        <SheetHeader>
          <SheetTitle>Equipes</SheetTitle>
          <SheetDescription>Agrupam funções (ex: Louvor = Vocal + Guitarra).</SheetDescription>
        </SheetHeader>

        {showForm ? (
          <div className="mt-6 space-y-4">
            <div>
              <Label className="text-xs">Nome</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex: Louvor" />
            </div>
            <div>
              <Label className="text-xs mb-2 block">Funções</Label>
              <div className="space-y-1.5 max-h-72 overflow-y-auto">
                {functions.length === 0 && (
                  <p className="text-xs text-muted-foreground">Crie funções primeiro.</p>
                )}
                {functions.map((fn) => {
                  const checked = fnIds.includes(fn.id);
                  return (
                    <label
                      key={fn.id}
                      className="flex items-center gap-3 rounded-xl border border-zinc-800 bg-zinc-900/60 px-3 py-2.5 cursor-pointer hover:border-indigo-500/40"
                    >
                      <Checkbox
                        checked={checked}
                        onCheckedChange={(v) =>
                          setFnIds(v ? [...fnIds, fn.id] : fnIds.filter((x) => x !== fn.id))
                        }
                      />
                      <span className="text-sm">{fn.name}</span>
                    </label>
                  );
                })}
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              {editing && (
                <Button
                  variant="ghost"
                  className="text-destructive mr-auto"
                  onClick={async () => {
                    if (!confirm("Excluir esta equipe?")) return;
                    await ministryAdminService.deleteTeam(editing.id);
                    toast.success("Equipe excluída");
                    setEditing(null);
                    onChanged();
                  }}
                >
                  Excluir
                </Button>
              )}
              <Button variant="ghost" onClick={() => { setCreating(false); setEditing(null); }}>Cancelar</Button>
              <Button onClick={save}>Salvar</Button>
            </div>
          </div>
        ) : (
          <div className="mt-6 space-y-2">
            {teams.length === 0 && (
              <p className="text-sm text-muted-foreground py-4 text-center">Nenhuma equipe criada.</p>
            )}
            {teams.map((t) => (
              <button
                key={t.id}
                disabled={!canEdit}
                onClick={() => setEditing(t)}
                className="w-full text-left rounded-xl border border-zinc-800 bg-zinc-900/60 p-4 hover:border-indigo-500/40 transition"
              >
                <div className="flex items-center justify-between">
                  <div className="font-medium">{t.name}</div>
                  <Badge variant="secondary">{t.functionIds.length}</Badge>
                </div>
                <div className="mt-2 flex flex-wrap gap-1">
                  {t.functionIds.map((id) => {
                    const fn = functions.find((f) => f.id === id);
                    return fn ? <Badge key={id} variant="outline" className="text-xs">{fn.name}</Badge> : null;
                  })}
                </div>
              </button>
            ))}
            {canEdit && (
              <Button variant="outline" className="w-full" onClick={() => setCreating(true)}>
                <Plus className="h-4 w-4 mr-1" /> Nova equipe
              </Button>
            )}
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}

/* =================== Agenda templates (placeholder) =================== */
function AgendaTemplatesSheet({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className={FULL_SHEET}>
        <SheetHeader>
          <SheetTitle>Modelos de roteiro</SheetTitle>
          <SheetDescription>Reutilize roteiros padronizados ao criar novas escalas.</SheetDescription>
        </SheetHeader>
        <div className="mt-10">
          <EmptyState
            icon={FileText}
            title="Em breve"
            description="Você poderá criar e reaproveitar modelos de roteiro para suas escalas."
          />
        </div>
      </SheetContent>
    </Sheet>
  );
}

/* =================== Add member manually =================== */
function AddMemberSheet({
  open,
  onOpenChange,
  ministryId,
  inviteCode,
  onAdded,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  ministryId: string;
  inviteCode: string;
  onAdded: () => void;
}) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => { if (open) { setName(""); setEmail(""); } }, [open]);

  const submit = async () => {
    if (!name.trim() || !email.trim()) {
      toast.error("Preencha nome e email");
      return;
    }
    setBusy(true);
    try {
      await ministryService.addMemberManually({ ministryId, name, email });
      toast.success("Membro adicionado");
      onAdded();
      onOpenChange(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className={FULL_SHEET}>
        <SheetHeader>
          <SheetTitle>Adicionar membro</SheetTitle>
          <SheetDescription>Convide pelo código ou cadastre manualmente.</SheetDescription>
        </SheetHeader>

        <div className="mt-6 space-y-6">
          <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-4">
            <div className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Código de convite</div>
            <div className="flex items-center justify-between gap-2">
              <div className="text-xl font-mono tracking-[0.3em] font-semibold">{inviteCode}</div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  navigator.clipboard.writeText(inviteCode);
                  toast.success("Código copiado");
                }}
              >
                <Copy className="h-4 w-4 mr-1" /> Copiar
              </Button>
            </div>
          </div>

          <div className="space-y-3">
            <div className="text-sm font-medium">Cadastrar manualmente</div>
            <div>
              <Label className="text-xs">Nome</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nome completo" />
            </div>
            <div>
              <Label className="text-xs">Email</Label>
              <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="email@exemplo.com" />
            </div>
            <Button onClick={submit} disabled={busy} className="w-full">
              <UserPlus className="h-4 w-4 mr-1" /> Adicionar membro
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

/* =================== Member Drawer =================== */
function MemberDrawer({
  member,
  functions,
  defaults,
  ministryId,
  canManage,
  currentUserId,
  onClose,
  onChanged,
}: {
  member: MinistryMember | null;
  functions: MinistryFunction[];
  defaults: MinistryDefaults | null;
  ministryId: string;
  canManage: boolean;
  currentUserId?: string;
  onClose: () => void;
  onChanged: () => void;
}) {
  const [config, setConfig] = useState<MemberPermissions | null>(null);

  useEffect(() => {
    if (member) {
      ministryAdminService.getMemberConfig(ministryId, member.id).then(setConfig);
    } else {
      setConfig(null);
    }
  }, [member, ministryId]);

  if (!member) return null;

  const isAdmin = member.role === "owner" || member.role === "admin";
  const isOwner = member.role === "owner";
  const isMe = member.userId === currentUserId;

  const perms = { ...DEFAULT_PERMISSIONS, ...(defaults?.permissions ?? {}), ...(config?.overrides ?? {}) };
  // Rule: when member has any function permission active, lock function assignment edits.
  const hasFunctionPermission = FUNCTION_PERMISSION_KEYS.some((k) => !!perms[k]);
  const functionAssignmentLocked = hasFunctionPermission;

  const toggleFn = async (fnId: string, on: boolean) => {
    if (!config) return;
    const next = on ? [...config.functionIds, fnId] : config.functionIds.filter((x) => x !== fnId);
    const updated = await ministryAdminService.updateMemberConfig(ministryId, member.id, { functionIds: next });
    setConfig(updated);
    onChanged();
  };

  const togglePermGroup = async (group: PermissionGroup, v: boolean) => {
    if (!config) return;
    const nextOverrides = { ...config.overrides };
    for (const k of group.keys) nextOverrides[k] = v;
    const updated = await ministryAdminService.updateMemberConfig(ministryId, member.id, {
      overrides: nextOverrides,
    });
    setConfig(updated);
    onChanged();
  };

  const remove = async () => {
    if (!confirm(`Remover ${member.user.name} do ministério?`)) return;
    try {
      await ministryService.removeMember(ministryId, member.id);
      toast.success("Membro removido");
      onChanged();
      onClose();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro");
    }
  };

  return (
    <Sheet open={!!member} onOpenChange={(o) => !o && onClose()}>
      <SheetContent side="right" className={FULL_SHEET}>
        <div className="mx-auto w-full max-w-2xl">
          <SheetHeader className="text-center">
            <SheetTitle className="text-center">Editar</SheetTitle>
          </SheetHeader>

          <div className="mt-6 flex flex-col items-center text-center gap-3">
            <div className="h-24 w-24 rounded-full bg-indigo-500/20 text-indigo-300 flex items-center justify-center text-3xl font-semibold">
              {initials(member.user.name)}
            </div>
          </div>

          <div className="mt-6 rounded-2xl border border-zinc-800 bg-zinc-900/60 p-5 space-y-4">
            <div>
              <div className="text-xs text-muted-foreground">Nome</div>
              <div className="text-base font-semibold">{member.user.name}</div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground">E-mail</div>
              <div className="text-base font-semibold break-all">{member.user.email}</div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground">Função no ministério</div>
              <div className="text-base font-semibold">
                {roleLabel[member.role]} {isMe && <span className="text-xs text-muted-foreground">(você)</span>}
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              Apenas o dono da conta consegue alterar as informações pessoais
            </p>
          </div>

          <Tabs defaultValue="functions" className="mt-6">
            <TabsList className="grid grid-cols-2 w-full h-12 rounded-2xl bg-zinc-900/70 border border-zinc-800 p-1">
              <TabsTrigger value="functions" className="rounded-xl data-[state=active]:bg-zinc-800">
                Funções ({config?.functionIds.length ?? 0})
              </TabsTrigger>
              <TabsTrigger value="permissions" className="rounded-xl data-[state=active]:bg-zinc-800">
                Permissões ({PERMISSION_GROUPS.filter((g) => g.keys.some((k) => !!perms[k])).length})
              </TabsTrigger>
            </TabsList>

            <TabsContent value="functions" className="mt-4">
              {functionAssignmentLocked && (
                <p className="text-xs text-amber-400/90 mb-3">
                  Este membro tem permissão para gerenciar funções — as funções atribuídas só podem ser alteradas por ele mesmo.
                </p>
              )}
              {functions.length === 0 ? (
                <p className="text-xs text-muted-foreground">Nenhuma função cadastrada no ministério.</p>
              ) : (
                <div className="grid grid-cols-2 gap-2">
                  {functions.filter((f) => f.active).map((fn) => {
                    const checked = !!config?.functionIds.includes(fn.id);
                    return (
                      <label
                        key={fn.id}
                        className={cn(
                          "flex items-center gap-2 rounded-xl border border-zinc-800 bg-zinc-900/60 px-3 py-2 cursor-pointer hover:border-indigo-500/40",
                          (functionAssignmentLocked || !canManage) && "opacity-60 cursor-not-allowed",
                        )}
                      >
                        <Checkbox
                          checked={checked}
                          disabled={!canManage || functionAssignmentLocked}
                          onCheckedChange={(v) => toggleFn(fn.id, !!v)}
                        />
                        <span className="text-sm truncate">{fn.name}</span>
                      </label>
                    );
                  })}
                </div>
              )}
            </TabsContent>

            <TabsContent value="permissions" className="mt-4">
              {isOwner ? (
                <p className="text-sm text-muted-foreground">O dono já possui acesso total.</p>
              ) : (
                <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 overflow-hidden divide-y divide-zinc-800/80">
                  <div className="px-4 py-3 text-center text-xs text-muted-foreground bg-zinc-900/80">
                    Apenas o Administrador pode alterar as permissões.
                  </div>
                  {PERMISSION_GROUPS.map((g) => {
                    const active = g.keys.length > 0 && g.keys.every((k) => !!perms[k]);
                    return (
                      <div key={g.id} className="flex items-start gap-4 px-4 py-4">
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-semibold">{g.title}</div>
                          <p className="text-xs text-muted-foreground mt-1">{g.description}</p>
                          {g.obs && (
                            <p className="text-xs text-muted-foreground mt-2"><span className="font-medium">Obs:</span> {g.obs}</p>
                          )}
                        </div>
                        <Switch
                          checked={active}
                          disabled={!canManage || isAdmin || g.keys.length === 0}
                          onCheckedChange={(v) => togglePermGroup(g, v)}
                        />
                      </div>
                    );
                  })}
                </div>
              )}
              {isAdmin && !isOwner && (
                <p className="text-xs text-muted-foreground mt-3">
                  Administradores têm acesso operacional total — permissões individuais não se aplicam.
                </p>
              )}
            </TabsContent>
          </Tabs>

          {canManage && !isOwner && !isMe && (
            <Button variant="outline" className="w-full text-destructive mt-6" onClick={remove}>
              <X className="h-4 w-4 mr-1" /> Remover do ministério
            </Button>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

/* =================== Edit Ministry Sheet =================== */
function EditMinistrySheet({
  open,
  onOpenChange,
  ministryId,
  ministryName,
  defaults,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  ministryId: string;
  ministryName: string;
  defaults: MinistryDefaults | null;
  onSaved: () => void;
}) {
  const [name, setName] = useState(ministryName);
  const [description, setDescription] = useState(defaults?.description ?? "");
  const [bannerUrl, setBannerUrl] = useState(defaults?.bannerUrl ?? "");
  const [avatarUrl, setAvatarUrl] = useState(defaults?.avatarUrl ?? "");

  useEffect(() => {
    if (open) {
      setName(ministryName);
      setDescription(defaults?.description ?? "");
      setBannerUrl(defaults?.bannerUrl ?? "");
      setAvatarUrl(defaults?.avatarUrl ?? "");
    }
  }, [open, ministryName, defaults]);

  const handleFile = (file: File | null, target: "avatar" | "banner") => {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Selecione uma imagem válida");
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      toast.error("Imagem muito grande (máx. 2MB)");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const url = reader.result as string;
      if (target === "avatar") setAvatarUrl(url);
      else setBannerUrl(url);
    };
    reader.readAsDataURL(file);
  };

  const save = async () => {
    if (name.trim() && name !== ministryName) {
      await ministryService.update(ministryId, { name: name.trim() });
    }
    await ministryAdminService.updateDefaults(ministryId, {
      description: description.trim() || undefined,
      bannerUrl: bannerUrl.trim() || undefined,
      avatarUrl: avatarUrl.trim() || undefined,
    });
    toast.success("Ministério atualizado");
    onOpenChange(false);
    onSaved();
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className={FULL_SHEET}>
        <div className="mx-auto w-full max-w-2xl">
          <SheetHeader className="text-center">
            <SheetTitle className="text-center">Editar ministério</SheetTitle>
          </SheetHeader>

          <div className="mt-6 flex flex-col items-center gap-3">
            <label className="relative cursor-pointer group">
              <div className="h-24 w-24 rounded-full bg-indigo-500/20 text-indigo-300 flex items-center justify-center text-3xl font-semibold overflow-hidden border border-zinc-800">
                {avatarUrl ? (
                  <img src={avatarUrl} alt="" className="h-full w-full object-cover" />
                ) : (
                  initials(name || "M")
                )}
              </div>
              <div className="absolute inset-0 rounded-full bg-black/50 opacity-0 group-hover:opacity-100 transition flex items-center justify-center text-xs text-white">
                Trocar foto
              </div>
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => handleFile(e.target.files?.[0] ?? null, "avatar")}
              />
            </label>
            {avatarUrl && (
              <Button type="button" variant="ghost" size="sm" onClick={() => setAvatarUrl("")}>
                Remover foto
              </Button>
            )}
          </div>

          <div className="mt-6 space-y-4">
            <div>
              <Label className="text-xs">Nome do ministério</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div>
              <Label className="text-xs">Descrição</Label>
              <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} />
            </div>
            <div>
              <Label className="text-xs">Banner</Label>
              <div className="flex items-center gap-3">
                <label className="flex-1 rounded-xl border border-dashed border-zinc-700 hover:border-indigo-500/50 px-4 py-3 text-sm text-center cursor-pointer text-muted-foreground">
                  {bannerUrl ? "Trocar banner" : "Selecionar imagem do banner"}
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => handleFile(e.target.files?.[0] ?? null, "banner")}
                  />
                </label>
                {bannerUrl && (
                  <Button type="button" variant="ghost" size="sm" onClick={() => setBannerUrl("")}>
                    Remover
                  </Button>
                )}
              </div>
              {bannerUrl && (
                <div className="mt-2 h-24 w-full rounded-xl bg-cover bg-center border border-zinc-800" style={{ backgroundImage: `url(${bannerUrl})` }} />
              )}
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancelar</Button>
              <Button onClick={save}>Salvar</Button>
            </div>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

/* =================== Join Requests =================== */
function JoinRequestsSheet({
  open,
  onOpenChange,
  requests,
  ministryName,
  ministryId,
  functions,
  deciderId,
  onChanged,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  requests: MinistryJoinRequest[];
  ministryName: string;
  ministryId: string;
  functions: MinistryFunction[];
  deciderId: string;
  onChanged: () => void | Promise<void>;
}) {
  const [busy, setBusy] = useState<string | null>(null);
  const [index, setIndex] = useState(0);
  const [selectedFns, setSelectedFns] = useState<string[]>([]);
  const [perms, setPerms] = useState<Partial<Record<PermissionKey, boolean>>>({});
  const [openSection, setOpenSection] = useState<"fns" | "perms" | null>(null);

  const current = requests[index];

  useEffect(() => {
    if (index >= requests.length && requests.length > 0) setIndex(0);
  }, [requests.length, index]);

  useEffect(() => {
    // reset selections quando trocar de solicitação
    setSelectedFns([]);
    setPerms({});
    setOpenSection(null);
  }, [current?.id]);

  const toggleFn = (id: string) =>
    setSelectedFns((arr) => (arr.includes(id) ? arr.filter((x) => x !== id) : [...arr, id]));

  const togglePerm = (key: PermissionKey) =>
    setPerms((p) => ({ ...p, [key]: !p[key] }));

  const approve = async (req: MinistryJoinRequest) => {
    setBusy(req.id);
    try {
      const res = await ministryService.approveJoinRequest(req.id, deciderId);
      if (selectedFns.length > 0 || Object.keys(perms).length > 0) {
        await ministryAdminService.updateMemberConfig(ministryId, res.memberId, {
          functionIds: selectedFns,
          overrides: perms,
        });
      }
      await notificationService.create({
        userId: res.userId,
        ministryId: res.ministryId,
        type: "join_request_approved",
        title: "Solicitação aprovada",
        body: `Você agora é membro de ${res.ministryName}.`,
      });
      toast.success(`${req.userName} entrou em ${ministryName}`);
      await onChanged();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao aprovar");
    } finally {
      setBusy(null);
    }
  };

  const reject = async (req: MinistryJoinRequest) => {
    setBusy(req.id);
    try {
      const res = await ministryService.rejectJoinRequest(req.id, deciderId);
      await notificationService.create({
        userId: res.userId,
        ministryId: res.ministryId,
        type: "join_request_rejected",
        title: "Solicitação recusada",
        body: `Sua solicitação para entrar em ${res.ministryName} foi recusada.`,
      });
      toast.success("Solicitação recusada");
      await onChanged();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao recusar");
    } finally {
      setBusy(null);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className={FULL_SHEET}>
        <SheetHeader className="text-center">
          <SheetTitle className="text-center">Solicitações de entrada no ministério</SheetTitle>
          <SheetDescription className="text-center text-primary text-base font-semibold">
            {ministryName}
          </SheetDescription>
        </SheetHeader>

        <div className="mt-6 max-w-xl mx-auto">
          {requests.length === 0 || !current ? (
            <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-8 text-center text-sm text-muted-foreground">
              Nenhuma solicitação pendente.
            </div>
          ) : (
            <>
              <div className="flex items-center justify-center gap-3 mb-4">
                <Button
                  variant="ghost"
                  size="icon"
                  disabled={index === 0}
                  onClick={() => setIndex((i) => Math.max(0, i - 1))}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <span className="text-xs px-3 py-1 rounded-full bg-zinc-800 text-muted-foreground">
                  {index + 1} de {requests.length}
                </span>
                <Button
                  variant="ghost"
                  size="icon"
                  disabled={index >= requests.length - 1}
                  onClick={() => setIndex((i) => Math.min(requests.length - 1, i + 1))}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>

              <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 overflow-hidden">
                <div className="px-4 pt-6 pb-4 flex flex-col items-center text-center">
                  <div className="h-20 w-20 rounded-full bg-primary/15 text-primary flex items-center justify-center text-2xl font-semibold mb-3">
                    {initials(current.userName)}
                  </div>
                  <div className="text-lg font-semibold">{current.userName}</div>
                  <div className="text-sm text-muted-foreground">{current.userEmail}</div>
                </div>

                <div className="border-t border-zinc-800/80">
                  <button
                    className="w-full flex items-center gap-3 px-4 py-4 text-left hover:bg-zinc-900 transition"
                    onClick={() => setOpenSection((s) => (s === "fns" ? null : "fns"))}
                  >
                    <UserPlus className="h-5 w-5 text-muted-foreground" />
                    <div className="flex-1 min-w-0">
                      <div className="font-medium">Funções no ministério</div>
                      <div className="text-xs text-muted-foreground mt-0.5">
                        {selectedFns.length} selecionada{selectedFns.length === 1 ? "" : "s"}
                      </div>
                    </div>
                    {openSection === "fns" ? (
                      <ChevronDown className="h-4 w-4 text-muted-foreground" />
                    ) : (
                      <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    )}
                  </button>
                  {openSection === "fns" && (
                    <div className="px-4 pb-4 space-y-1">
                      {functions.length === 0 && (
                        <p className="text-xs text-muted-foreground text-center py-3">
                          Nenhuma função cadastrada neste ministério.
                        </p>
                      )}
                      {functions.map((f) => {
                        const checked = selectedFns.includes(f.id);
                        return (
                          <button
                            key={f.id}
                            type="button"
                            onClick={() => toggleFn(f.id)}
                            className={cn(
                              "w-full flex items-center gap-3 px-3 py-2 rounded-lg border transition",
                              checked
                                ? "border-primary/50 bg-primary/10"
                                : "border-zinc-800 bg-zinc-950/40 hover:bg-zinc-900",
                            )}
                          >
                            <span className="text-lg w-6 text-center">{f.icon ?? "🔹"}</span>
                            <span className="flex-1 text-left text-sm">{f.name}</span>
                            {checked && <CheckIcon className="h-4 w-4 text-primary" />}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>

                <div className="border-t border-zinc-800/80">
                  <button
                    className="w-full flex items-center gap-3 px-4 py-4 text-left hover:bg-zinc-900 transition"
                    onClick={() => setOpenSection((s) => (s === "perms" ? null : "perms"))}
                  >
                    <Lock className="h-5 w-5 text-muted-foreground" />
                    <div className="flex-1 min-w-0">
                      <div className="font-medium">Permissões no ministério</div>
                      <div className="text-xs text-muted-foreground mt-0.5">
                        {Object.values(perms).filter(Boolean).length} selecionada
                        {Object.values(perms).filter(Boolean).length === 1 ? "" : "s"}
                      </div>
                    </div>
                    {openSection === "perms" ? (
                      <ChevronDown className="h-4 w-4 text-muted-foreground" />
                    ) : (
                      <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    )}
                  </button>
                  {openSection === "perms" && (
                    <div className="px-4 pb-4 space-y-2">
                      {PERMISSION_GROUPS.filter((g) => g.keys.length > 0).map((g) => {
                        const allOn = g.keys.every((k) => perms[k]);
                        return (
                          <div
                            key={g.id}
                            className="rounded-lg border border-zinc-800 bg-zinc-950/40 px-3 py-3 flex items-start gap-3"
                          >
                            <div className="flex-1 min-w-0">
                              <div className="font-medium text-sm">{g.title}</div>
                              <div className="text-xs text-muted-foreground mt-0.5">{g.description}</div>
                            </div>
                            <Switch
                              checked={allOn}
                              onCheckedChange={(v) =>
                                setPerms((p) => {
                                  const next = { ...p };
                                  for (const k of g.keys) next[k] = v;
                                  return next;
                                })
                              }
                            />
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                <div className="border-t border-zinc-800/80 p-3 grid grid-cols-2 gap-2">
                  <Button
                    variant="outline"
                    disabled={busy === current.id}
                    onClick={() => reject(current)}
                  >
                    <X className="h-4 w-4 mr-1" /> Rejeitar
                  </Button>
                  <Button disabled={busy === current.id} onClick={() => approve(current)}>
                    <CheckIcon className="h-4 w-4 mr-1" /> Aprovar
                  </Button>
                </div>
              </div>
            </>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
