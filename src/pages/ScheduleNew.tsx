import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  ArrowLeft,
  CalendarIcon,
  Check,
  ChevronDown,
  ChevronUp,
  Plus,
  Pencil,
  Trash2,
  Users,
  ListChecks,
  FileText,
  Search,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Checkbox } from "@/components/ui/checkbox";
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
import { scheduleService } from "@/services/scheduleService";
import { ministryAdminService } from "@/services/ministryAdminService";
import { unavailabilityService } from "@/services/unavailabilityService";
import { scheduleHistoryService } from "@/services/scheduleHistoryService";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import type {
  MinistryFunction,
  MinistryMember,
  MinistryTeam,
  ScheduleAgendaItem,
  Unavailability,
} from "@/types";

interface RoleSlot {
  id: string;
  label: string;
  members: string[]; // userIds
}

interface AgendaDraft extends ScheduleAgendaItem {}

function uid() {
  return Math.random().toString(36).slice(2, 10);
}

export default function ScheduleNew() {
  const navigate = useNavigate();
  const { id: editId } = useParams<{ id: string }>();
  const isEdit = Boolean(editId);
  const { user } = useAuth();
  const { active, can, loading: ministryLoading } = useMinistry();

  const [tab, setTab] = useState("detalhes");
  const [submitting, setSubmitting] = useState(false);
  const [loadingSchedule, setLoadingSchedule] = useState(isEdit);

  // Detalhes
  const [title, setTitle] = useState("");
  const [date, setDate] = useState<Date | undefined>(undefined);
  const [time, setTime] = useState("19:30");
  const [notes, setNotes] = useState("");
  const [published, setPublished] = useState(true);
  const [requireConfirmation, setRequireConfirmation] = useState(false);

  // Participantes
  const [members, setMembers] = useState<MinistryMember[]>([]);
  const [loadingMembers, setLoadingMembers] = useState(true);
  const [roles, setRoles] = useState<RoleSlot[]>([]);
  const [functions, setFunctions] = useState<MinistryFunction[]>([]);
  const [teams, setTeams] = useState<MinistryTeam[]>([]);
  const [unavailabilities, setUnavailabilities] = useState<Unavailability[]>([]);
  const [unavExpanded, setUnavExpanded] = useState(true);
  // memberId (MinistryMember.id) -> functionIds[]
  const [memberFunctions, setMemberFunctions] = useState<Record<string, string[]>>({});
  const [addOpen, setAddOpen] = useState(false);
  const [teamsOpen, setTeamsOpen] = useState(false);

  // Confirm dialog quando data muda e há participantes indisponíveis
  const [conflictDialog, setConflictDialog] = useState<{
    pendingDate: Date;
    names: string[];
    userIds: string[];
  } | null>(null);

  // Roteiro
  const [agenda, setAgenda] = useState<AgendaDraft[]>([]);
  const [agendaName, setAgendaName] = useState("");
  const [agendaDesc, setAgendaDesc] = useState("");

  // Snapshot do estado original (para diff de histórico em edição)
  const originalRef = useRef<{
    title: string;
    dateISO: string;
    description: string;
    requireConfirmation: boolean;
    agendaCount: number;
    members: { userId: string; name: string; labels: string[] }[];
  } | null>(null);

  useEffect(() => {
    if (!active) return;
    setLoadingMembers(true);
    (async () => {
      const [m, fns, tms] = await Promise.all([
        ministryService.listMembers(active.id),
        ministryAdminService.listFunctions(active.id),
        ministryAdminService.listTeams(active.id),
      ]);
      setMembers(m);
      setFunctions(fns);
      setTeams(tms);
      try {
        const uns = await unavailabilityService.list(active.id);
        setUnavailabilities(uns);
      } catch {
        /* ignore */
      }
      const cfgs = await Promise.all(
        m.map((mb) => ministryAdminService.getMemberConfig(active.id, mb.id)),
      );
      const map: Record<string, string[]> = {};
      m.forEach((mb, i) => {
        map[mb.id] = cfgs[i]?.functionIds ?? [];
      });
      setMemberFunctions(map);
      setLoadingMembers(false);
    })();
  }, [active]);

  // Load existing schedule when editing
  useEffect(() => {
    if (!isEdit || !editId) return;
    let cancelled = false;
    (async () => {
      try {
        const [s, asg] = await Promise.all([
          scheduleService.getById(editId),
          scheduleService.listAssignments(editId),
        ]);
        if (cancelled || !s) return;
        setTitle(s.title);
        const dt = new Date(s.date);
        setDate(dt);
        setTime(`${String(dt.getHours()).padStart(2, "0")}:${String(dt.getMinutes()).padStart(2, "0")}`);
        setNotes(s.description ?? "");
        setPublished(s.published ?? true);
        setRequireConfirmation(s.requireConfirmation ?? false);
        setAgenda(s.agenda ?? []);
        // Group assignments into roles
        const map = new Map<string, RoleSlot>();
        for (const a of asg) {
          const existing = map.get(a.label);
          if (existing) {
            if (a.userId) existing.members.push(a.userId);
          } else {
            map.set(a.label, {
              id: uid(),
              label: a.label,
              members: a.userId ? [a.userId] : [],
            });
          }
        }
        const loaded = Array.from(map.values());
        if (loaded.length > 0) setRoles(loaded);
        // snapshot para diff
        const memberMap = new Map<string, { userId: string; name: string; labels: string[] }>();
        for (const a of asg) {
          if (!a.userId) continue;
          const cur = memberMap.get(a.userId);
          if (cur) {
            if (a.label && a.label !== "Sem função" && !cur.labels.includes(a.label)) cur.labels.push(a.label);
          } else {
            memberMap.set(a.userId, {
              userId: a.userId,
              name: a.user?.name ?? "Membro",
              labels: a.label && a.label !== "Sem função" ? [a.label] : [],
            });
          }
        }
        originalRef.current = {
          title: s.title,
          dateISO: s.date,
          description: s.description ?? "",
          requireConfirmation: !!s.requireConfirmation,
          agendaCount: (s.agenda ?? []).length,
          members: Array.from(memberMap.values()),
        };
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Erro ao carregar escala");
      } finally {
        if (!cancelled) setLoadingSchedule(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isEdit, editId]);

  const titleError = title.trim().length < 2;
  const dateError = !date;

  const totalParticipants = useMemo(
    () => roles.reduce((sum, r) => sum + r.members.length, 0),
    [roles],
  );

  // Lista única de participantes com suas funções atribuídas (derivada de roles)
  const participants = useMemo(() => {
    const map = new Map<string, { userId: string; name: string; labels: string[] }>();
    for (const r of roles) {
      for (const userId of r.members) {
        const m = members.find((mb) => mb.userId === userId);
        const name = m?.user.name ?? "Membro";
        const cur = map.get(userId);
        if (cur) {
          if (r.label !== "Sem função" && !cur.labels.includes(r.label)) {
            cur.labels.push(r.label);
          }
        } else {
          map.set(userId, {
            userId,
            name,
            labels: r.label === "Sem função" ? [] : [r.label],
          });
        }
      }
    }
    return Array.from(map.values());
  }, [roles, members]);

  const removeParticipant = (userId: string) => {
    setRoles((prev) =>
      prev
        .map((r) => ({ ...r, members: r.members.filter((u) => u !== userId) }))
        .filter((r) => r.members.length > 0),
    );
  };

  // Helpers para checagem de indisponibilidade em uma data específica
  const unavailableUserIdsOn = (d: Date): Set<string> => {
    const ds = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
    const de = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999).getTime();
    const ids = new Set<string>();
    for (const u of unavailabilities) {
      if (new Date(u.startsAt).getTime() <= de && new Date(u.endsAt).getTime() >= ds) {
        ids.add(u.userId);
      }
    }
    return ids;
  };

  const removeUsersFromRoles = (userIds: Set<string>) => {
    setRoles((prev) =>
      prev
        .map((r) => ({ ...r, members: r.members.filter((u) => !userIds.has(u)) }))
        .filter((r) => r.members.length > 0),
    );
  };

  // Handler que troca a data verificando conflitos
  const handleDateChange = (newDate: Date | undefined) => {
    if (!newDate) {
      setDate(newDate);
      return;
    }
    const unavailIds = unavailableUserIdsOn(newDate);
    const conflicting = participants.filter((p) => unavailIds.has(p.userId));
    if (conflicting.length === 0) {
      setDate(newDate);
      return;
    }
    setConflictDialog({
      pendingDate: newDate,
      names: conflicting.map((p) => p.name),
      userIds: conflicting.map((p) => p.userId),
    });
  };

  // Auto-remove se carregamos novas indisponibilidades para a data atual
  useEffect(() => {
    if (!date) return;
    const unavailIds = unavailableUserIdsOn(date);
    if (unavailIds.size === 0) return;
    const hasConflict = participants.some((p) => unavailIds.has(p.userId));
    if (hasConflict) {
      removeUsersFromRoles(unavailIds);
      toast.info("Membros indisponíveis foram removidos da escala");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [unavailabilities]);

  // Selection inicial para o sheet (derivada das atribuições atuais)
  const initialSelection = useMemo(() => {
    const sel: Record<string, string[]> = {};
    for (const m of members) {
      const fnIds: string[] = [];
      let included = false;
      for (const r of roles) {
        if (!r.members.includes(m.userId)) continue;
        included = true;
        if (r.label === "Sem função") continue;
        const fn = functions.find((f) => f.name === r.label);
        if (fn && !fnIds.includes(fn.id)) fnIds.push(fn.id);
      }
      if (included) sel[m.id] = fnIds;
    }
    return sel;
  }, [roles, members, functions]);

  // Add a userId to the role slot whose label matches functionName (creates if missing).
  const addMemberToFunction = (
    list: RoleSlot[],
    functionName: string,
    userId: string,
  ): RoleSlot[] => {
    const idx = list.findIndex((r) => r.label === functionName);
    if (idx === -1) {
      return [...list, { id: uid(), label: functionName, members: [userId] }];
    }
    if (list[idx].members.includes(userId)) return list;
    const next = list.slice();
    next[idx] = { ...next[idx], members: [...next[idx].members, userId] };
    return next;
  };

  const applyMembersSelection = (selection: Record<string, string[]>) => {
    // selection: memberId -> functionIds[]. Substitui completamente as atribuições.
    const selectedUserIds = new Set<string>();
    for (const memberId of Object.keys(selection)) {
      const m = members.find((x) => x.id === memberId);
      if (m) selectedUserIds.add(m.userId);
    }
    setRoles((prev) => {
      // remove usuários que não estão mais na seleção
      let next = prev
        .map((r) => ({
          ...r,
          members: r.members.filter((u) => selectedUserIds.has(u)),
        }))
        .filter((r) => r.members.length > 0);
      // limpa atribuições dos selecionados (vamos re-adicionar)
      next = next
        .map((r) => ({
          ...r,
          members: r.members.filter((u) => !selectedUserIds.has(u)),
        }))
        .filter((r) => r.members.length > 0);
      for (const [memberId, fnIds] of Object.entries(selection)) {
        const member = members.find((m) => m.id === memberId);
        if (!member) continue;
        if (fnIds.length === 0) {
          next = addMemberToFunction(next, "Sem função", member.userId);
          continue;
        }
        for (const fnId of fnIds) {
          const fn = functions.find((f) => f.id === fnId);
          if (!fn) continue;
          next = addMemberToFunction(next, fn.name, member.userId);
        }
      }
      return next;
    });
  };

  const applyTeam = (team: MinistryTeam) => {
    setRoles((prev) => {
      let next = prev;
      for (const fnId of team.functionIds) {
        const fn = functions.find((f) => f.id === fnId);
        if (!fn) continue;
        // ensure slot exists
        if (!next.some((r) => r.label === fn.name)) {
          next = [...next, { id: uid(), label: fn.name, members: [] }];
        }
        // add all members configured for this function
        for (const m of members) {
          if ((memberFunctions[m.id] ?? []).includes(fnId)) {
            next = addMemberToFunction(next, fn.name, m.userId);
          }
        }
      }
      return next;
    });
    toast.success(`Equipe "${team.name}" aplicada`);
    setTeamsOpen(false);
  };

  const addAgenda = () => {
    const name = agendaName.trim();
    if (!name) return;
    setAgenda((p) => [...p, { id: uid(), name, description: agendaDesc.trim() || undefined }]);
    setAgendaName("");
    setAgendaDesc("");
  };

  const removeAgenda = (id: string) => setAgenda((p) => p.filter((a) => a.id !== id));

  const onSubmit = async () => {
    if (!active || !user) return;
    if (titleError) {
      setTab("detalhes");
      toast.error("Informe um título");
      return;
    }
    if (dateError) {
      setTab("detalhes");
      toast.error("Informe uma data");
      return;
    }
    setSubmitting(true);
    try {
      const [hh, mm] = time.split(":").map((n) => parseInt(n, 10));
      const dt = new Date(date!);
      dt.setHours(hh || 0, mm || 0, 0, 0);

      let scheduleId: string;
      if (isEdit && editId) {
        await scheduleService.update(editId, {
          title: title.trim(),
          date: dt.toISOString(),
          description: notes.trim() || undefined,
          published,
          requireConfirmation,
          agenda,
        });
        // Reconcile assignments: remove all and re-create
        const existing = await scheduleService.listAssignments(editId);
        for (const a of existing) {
          await scheduleService.removeAssignment(a.id);
        }
        scheduleId = editId;
        for (const r of roles) {
          if (r.members.length === 0) continue;
          for (const userId of r.members) {
            await scheduleService.addAssignment({
              scheduleId,
              label: r.label,
              userId,
            });
          }
        }
        toast.success("Escala atualizada com sucesso");
        // Histórico: diff do que mudou
        try {
          const orig = originalRef.current;
          const changes: { field: string; before?: string; after?: string }[] = [];
          const added: { name: string; label?: string }[] = [];
          const removed: { name: string; label?: string }[] = [];
          if (orig) {
            if (orig.title !== title.trim())
              changes.push({ field: "Título", before: orig.title, after: title.trim() });
            if (orig.dateISO !== dt.toISOString())
              changes.push({
                field: "Data",
                before: new Date(orig.dateISO).toLocaleString("pt-BR"),
                after: dt.toLocaleString("pt-BR"),
              });
            const newDesc = notes.trim();
            if (orig.description !== newDesc)
              changes.push({ field: "Descrição", before: orig.description || "—", after: newDesc || "—" });
            if (orig.requireConfirmation !== requireConfirmation)
              changes.push({
                field: "Solicitar confirmação dos participantes",
                before: orig.requireConfirmation ? "Sim" : "Não",
                after: requireConfirmation ? "Sim" : "Não",
              });
            if (orig.agendaCount !== agenda.length)
              changes.push({ field: "Roteiro", before: String(orig.agendaCount), after: String(agenda.length) });

            // members diff
            const origIds = new Set(orig.members.map((m) => m.userId));
            const newIds = new Set(participants.map((m) => m.userId));
            for (const p of participants) {
              if (!origIds.has(p.userId)) {
                added.push({ name: p.name, label: p.labels.join(", ") || undefined });
              }
            }
            for (const m of orig.members) {
              if (!newIds.has(m.userId)) {
                removed.push({ name: m.name, label: m.labels.join(", ") || undefined });
              }
            }
          }
          if (changes.length || added.length || removed.length) {
            await scheduleHistoryService.add({
              ministryId: active.id,
              scheduleId,
              scheduleDate: dt.toISOString(),
              actorId: user.id,
              actorName: user.name,
              kind: "updated",
              changes,
              addedMembers: added,
              removedMembers: removed,
            });
          }
        } catch {/* ignore */}
      } else {
        const created = await scheduleService.create({
          ministryId: active.id,
          title,
          date: dt.toISOString(),
          description: notes,
          createdBy: user.id,
          published,
          requireConfirmation,
          agenda,
        });
        scheduleId = created.id;
        for (const r of roles) {
          if (r.members.length === 0) continue;
          for (const userId of r.members) {
            await scheduleService.addAssignment({
              scheduleId,
              label: r.label,
              userId,
            });
          }
        }
        toast.success("Escala criada com sucesso");
        try {
          const added: { name: string; label?: string }[] = participants.map((p) => ({
            name: p.name,
            label: p.labels.join(", ") || undefined,
          }));
          await scheduleHistoryService.add({
            ministryId: active.id,
            scheduleId,
            scheduleDate: dt.toISOString(),
            actorId: user.id,
            actorName: user.name,
            kind: "created",
            details: {
              "Descrição": title.trim(),
              "Observações": notes.trim() || undefined,
              "Data": dt.toLocaleString("pt-BR"),
              "Solicitar confirmação dos participantes": requireConfirmation ? "Sim" : "Não",
              "Roteiro": agenda.length > 0 ? "Atualizado" : "Vazio",
            },
            addedMembers: added,
          });
        } catch {/* ignore */}
      }
      navigate(`/escalas/${scheduleId}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao salvar escala");
    } finally {
      setSubmitting(false);
    }
  };

  if (ministryLoading || loadingSchedule) return <LoadingState />;
  if (!active) return null;
  const requiredPerm = isEdit ? "schedule.edit" : "schedule.create";
  if (!can(requiredPerm)) {
    return <EmptyState title="Sem permissão" description="Você não pode criar escalas neste ministério." />;
  }

  const NOTES_MAX = 500;

  return (
    <div className="pb-24">
      <button
        onClick={() => navigate(-1)}
        className="text-sm text-muted-foreground hover:text-foreground inline-flex items-center gap-1 mb-4"
      >
        <ArrowLeft className="h-4 w-4" /> Voltar
      </button>

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            {isEdit ? "Editar escala" : "Nova escala"}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Configure detalhes, participantes e roteiro de {active.name}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {totalParticipants > 0 && (
            <Badge variant="secondary" className="gap-1">
              <Users className="h-3 w-3" /> {totalParticipants} participantes
            </Badge>
          )}
        </div>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="w-full sm:w-auto">
          <TabsTrigger value="detalhes" className="gap-1.5">
            <FileText className="h-4 w-4" /> Detalhes
          </TabsTrigger>
          <TabsTrigger value="participantes" className="gap-1.5">
            <Users className="h-4 w-4" /> Participantes
          </TabsTrigger>
          <TabsTrigger value="roteiro" className="gap-1.5">
            <ListChecks className="h-4 w-4" /> Roteiro
          </TabsTrigger>
        </TabsList>

        {/* DETALHES */}
        <TabsContent value="detalhes" className="mt-6">
          <div className="rounded-xl border border-border bg-card p-5 sm:p-6 shadow-card max-w-2xl space-y-5">
            <div className="space-y-1.5">
              <Label htmlFor="title">Título *</Label>
              <Input
                id="title"
                placeholder="Ex: Culto de domingo"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Data *</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-full justify-start text-left font-normal",
                        !date && "text-muted-foreground",
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {date ? format(date, "PPP", { locale: ptBR }) : "Selecione a data"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={date}
                      onSelect={handleDateChange}
                      initialFocus
                      locale={ptBR}
                      className={cn("p-3 pointer-events-auto")}
                    />
                  </PopoverContent>
                </Popover>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="time">Hora</Label>
                <Input
                  id="time"
                  type="time"
                  value={time}
                  onChange={(e) => setTime(e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="notes">Observações</Label>
              <Textarea
                id="notes"
                rows={4}
                maxLength={NOTES_MAX}
                placeholder="Avisos, lembretes, ensaio…"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
              <div className="text-xs text-muted-foreground text-right">
                {notes.length}/{NOTES_MAX}
              </div>
            </div>

            <div className="space-y-3 pt-2 border-t border-border">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <Label htmlFor="published" className="text-sm">Publicar escala</Label>
                  <p className="text-xs text-muted-foreground">
                    Quando ativo, os membros conseguem ver a escala.
                  </p>
                </div>
                <Switch id="published" checked={published} onCheckedChange={setPublished} />
              </div>
              <div className="flex items-center justify-between gap-4">
                <div>
                  <Label htmlFor="confirm" className="text-sm">Solicitar confirmação</Label>
                  <p className="text-xs text-muted-foreground">
                    Participantes precisarão confirmar presença.
                  </p>
                </div>
                <Switch
                  id="confirm"
                  checked={requireConfirmation}
                  onCheckedChange={setRequireConfirmation}
                />
              </div>
            </div>
          </div>
        </TabsContent>

        {/* PARTICIPANTES */}
        <TabsContent value="participantes" className="mt-6">
          <div className="space-y-4 max-w-3xl">
            {date && (() => {
              const ds = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
              const de = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59, 999).getTime();
              const onDate = unavailabilities.filter(
                (u) =>
                  new Date(u.startsAt).getTime() <= de &&
                  new Date(u.endsAt).getTime() >= ds,
              );
              if (onDate.length === 0) return null;
              return (
                <div className="rounded-xl border border-border bg-card overflow-hidden">
                  <button
                    type="button"
                    onClick={() => setUnavExpanded((v) => !v)}
                    className="w-full flex items-center justify-between px-4 py-3 hover:bg-muted/40 text-left"
                  >
                    <div>
                      <div className="font-medium">Indisponibilidades ({onDate.length})</div>
                      <div className="text-xs text-muted-foreground">
                        {format(date, "dd/MM/yyyy", { locale: ptBR })} {time}
                      </div>
                    </div>
                    {unavExpanded ? (
                      <ChevronUp className="h-4 w-4 text-muted-foreground" />
                    ) : (
                      <ChevronDown className="h-4 w-4 text-muted-foreground" />
                    )}
                  </button>
                  {unavExpanded && (
                    <div className="px-4 pb-3 pt-1 flex flex-wrap gap-2 border-t border-border/60">
                      {onDate.map((u) => (
                        <span
                          key={u.id}
                          className="inline-flex items-center gap-2 rounded-full bg-muted px-3 py-1.5 text-sm"
                          title={u.description}
                        >
                          <span className="h-6 w-6 rounded-full bg-primary/15 text-primary flex items-center justify-center text-[10px] font-semibold">
                            {u.user.name.slice(0, 2).toUpperCase()}
                          </span>
                          {u.user.name}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              );
            })()}

            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                onClick={() => setAddOpen(true)}
                className="rounded-full"
              >
                {participants.length > 0 ? (
                  <>
                    <Pencil className="h-4 w-4 mr-1.5" /> Editar
                  </>
                ) : (
                  <>
                    <Plus className="h-4 w-4 mr-1.5" /> Adicionar
                  </>
                )}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => setTeamsOpen(true)}
                className="rounded-full"
              >
                <Users className="h-4 w-4 mr-1.5" /> Equipes
              </Button>
            </div>

            {loadingMembers ? (
              <LoadingState />
            ) : members.length === 0 ? (
              <EmptyState
                icon={Users}
                title="Nenhum membro disponível"
                description="Convide membros ao ministério para escalar."
              />
            ) : participants.length === 0 ? (
              <EmptyState
                icon={Users}
                title="Nenhum participante"
                description="Para adicionar um participante, toque no botão ( + Adicionar )."
              />
            ) : (
              <ul className="space-y-2">
                {participants.map((p) => (
                  <li
                    key={p.userId}
                    className="flex items-center gap-3 rounded-xl border border-border bg-card px-4 py-3 shadow-card"
                  >
                    <div className="h-10 w-10 rounded-full bg-primary/15 text-primary flex items-center justify-center text-sm font-semibold shrink-0">
                      {p.name.slice(0, 2).toUpperCase()}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="font-medium truncate">{p.name}</div>
                      <div className="text-xs text-muted-foreground truncate">
                        {p.labels.length === 0 ? "Sem função" : p.labels.join(", ")}
                      </div>
                    </div>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => removeParticipant(p.userId)}
                      aria-label="Remover participante"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </TabsContent>

        {/* ROTEIRO */}
        <TabsContent value="roteiro" className="mt-6">
          <div className="space-y-4 max-w-2xl">
            <div className="rounded-xl border border-border bg-card p-4 shadow-card space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="aname">Nome do item</Label>
                <Input
                  id="aname"
                  placeholder="Ex: Música - Tua Graça Me Basta"
                  value={agendaName}
                  onChange={(e) => setAgendaName(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="adesc">Descrição (opcional)</Label>
                <Textarea
                  id="adesc"
                  rows={2}
                  placeholder="Tom, observações, link…"
                  value={agendaDesc}
                  onChange={(e) => setAgendaDesc(e.target.value)}
                />
              </div>
              <div className="flex justify-end">
                <Button type="button" onClick={addAgenda}>
                  <Plus className="h-4 w-4 mr-1.5" /> Adicionar ao roteiro
                </Button>
              </div>
            </div>

            {agenda.length === 0 ? (
              <EmptyState
                icon={ListChecks}
                title="Roteiro vazio"
                description="Adicione músicas, etapas ou observações."
              />
            ) : (
              <ol className="space-y-2">
                {agenda.map((item, idx) => (
                  <li
                    key={item.id}
                    className="flex items-start justify-between gap-3 rounded-xl border border-border bg-card p-4 shadow-card"
                  >
                    <div className="flex items-start gap-3 min-w-0">
                      <div className="h-7 w-7 rounded-md bg-primary/15 text-primary flex items-center justify-center text-xs font-semibold shrink-0">
                        {idx + 1}
                      </div>
                      <div className="min-w-0">
                        <div className="font-medium truncate">{item.name}</div>
                        {item.description && (
                          <div className="text-xs text-muted-foreground mt-0.5 whitespace-pre-wrap">
                            {item.description}
                          </div>
                        )}
                      </div>
                    </div>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => removeAgenda(item.id)}
                      aria-label="Remover item"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </li>
                ))}
              </ol>
            )}
          </div>
        </TabsContent>
      </Tabs>

      {/* Barra de ações fixa */}
      <div className="fixed bottom-0 left-0 right-0 sm:left-64 z-40 border-t border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/70">
        <div className="flex items-center justify-end gap-2 px-4 sm:px-8 py-3">
          <Button
            variant="ghost"
            onClick={() => navigate(isEdit && editId ? `/escalas/${editId}` : "/escalas")}
            disabled={submitting}
          >
            Cancelar
          </Button>
          <Button onClick={onSubmit} disabled={submitting}>
            {submitting ? "Salvando…" : isEdit ? "Salvar alterações" : "Salvar escala"}
          </Button>
        </div>
      </div>

      <AddMembersSheet
        open={addOpen}
        onOpenChange={setAddOpen}
        members={members}
        functions={functions}
        memberFunctions={memberFunctions}
        initialSelection={initialSelection}
        unavailableUserIds={(() => {
          if (!date) return new Set<string>();
          const ds = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
          const de = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59, 999).getTime();
          const ids = new Set<string>();
          for (const u of unavailabilities) {
            if (new Date(u.startsAt).getTime() <= de && new Date(u.endsAt).getTime() >= ds) {
              ids.add(u.userId);
            }
          }
          return ids;
        })()}
        onConfirm={(sel) => {
          applyMembersSelection(sel);
          setAddOpen(false);
        }}
      />

      <TeamsSheet
        open={teamsOpen}
        onOpenChange={setTeamsOpen}
        teams={teams}
        functions={functions}
        onApply={applyTeam}
      />

      <AlertDialog
        open={!!conflictDialog}
        onOpenChange={(v) => {
          if (!v) setConflictDialog(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmação</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3">
                <div>
                  <span className="font-medium text-foreground">Indisponível: </span>
                  {conflictDialog?.names.join(", ")}
                </div>
                <div>
                  Membros indisponíveis nesta data serão removidos automaticamente,
                  deseja continuar?
                </div>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Não</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (!conflictDialog) return;
                const ids = new Set(conflictDialog.userIds);
                setDate(conflictDialog.pendingDate);
                removeUsersFromRoles(ids);
                setConflictDialog(null);
                toast.info("Membros indisponíveis removidos da escala");
              }}
            >
              Sim
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// ----------------- Add Members Sheet -----------------
function AddMembersSheet({
  open,
  onOpenChange,
  members,
  functions,
  memberFunctions,
  initialSelection,
  unavailableUserIds,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  members: MinistryMember[];
  functions: MinistryFunction[];
  memberFunctions: Record<string, string[]>;
  initialSelection?: Record<string, string[]>;
  unavailableUserIds: Set<string>;
  onConfirm: (selection: Record<string, string[]>) => void;
}) {
  const [query, setQuery] = useState("");
  // memberId -> Set of functionIds selected
  const [selection, setSelection] = useState<Record<string, string[]>>({});
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (open) {
      setSelection(initialSelection ? { ...initialSelection } : {});
      setQuery("");
      setExpanded(new Set(initialSelection ? Object.keys(initialSelection) : []));
    }
  }, [open, initialSelection]);

  const fnName = (id: string) => functions.find((f) => f.id === id)?.name ?? "";

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return members;
    return members.filter((m) => {
      if (m.user.name.toLowerCase().includes(q)) return true;
      const fns = (memberFunctions[m.id] ?? []).map(fnName).join(" ").toLowerCase();
      return fns.includes(q);
    });
  }, [query, members, memberFunctions, functions]);

  const totalSelected = useMemo(
    () => Object.keys(selection).length,
    [selection],
  );

  const allSelected =
    filtered.length > 0 &&
    filtered.every((m) => Object.prototype.hasOwnProperty.call(selection, m.id));

  const toggleAll = (v: boolean) => {
    setSelection((prev) => {
      const next = { ...prev };
      for (const m of filtered) {
        if (unavailableUserIds.has(m.userId)) continue;
        if (v) next[m.id] = [...(memberFunctions[m.id] ?? [])];
        else delete next[m.id];
      }
      return next;
    });
  };

  const toggleMember = (m: MinistryMember, v: boolean) => {
    if (v && unavailableUserIds.has(m.userId)) return;
    setSelection((prev) => {
      const next = { ...prev };
      if (v) next[m.id] = [];
      else delete next[m.id];
      return next;
    });
    setExpanded((prev) => {
      const n = new Set(prev);
      if (v) n.add(m.id);
      else n.delete(m.id);
      return n;
    });
  };

  const toggleMemberFn = (memberId: string, fnId: string) => {
    setSelection((prev) => {
      const cur = prev[memberId] ?? [];
      const exists = cur.includes(fnId);
      const nextFns = exists ? cur.filter((x) => x !== fnId) : [...cur, fnId];
      const next = { ...prev };
      next[memberId] = nextFns;
      return next;
    });
  };

  const toggleExpanded = (memberId: string) => {
    setExpanded((prev) => {
      const n = new Set(prev);
      if (n.has(memberId)) n.delete(memberId);
      else n.add(memberId);
      return n;
    });
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-screen h-screen max-w-none p-0 flex flex-col"
      >
        <SheetHeader className="px-4 py-4 border-b border-border flex-row items-center gap-3 space-y-0">
          <button
            onClick={() => onOpenChange(false)}
            className="text-muted-foreground hover:text-foreground"
            aria-label="Fechar"
          >
            <X className="h-5 w-5" />
          </button>
          <SheetTitle className="flex-1 text-center">Membros</SheetTitle>
          <div className="w-5" />
        </SheetHeader>

        <div className="px-4 sm:px-8 py-4 space-y-3 max-w-3xl mx-auto w-full flex-1 overflow-y-auto">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar por nome ou função"
              className="pl-9 rounded-full h-11"
            />
          </div>

          {filtered.length > 0 && (
            <div className="flex items-center justify-between rounded-xl border border-border bg-card px-4 py-3">
              <span className="font-semibold">Selecionar todos</span>
              <Switch checked={allSelected} onCheckedChange={toggleAll} />
            </div>
          )}

          <div className="space-y-2">
            {filtered.length === 0 ? (
              <EmptyState
                icon={Users}
                title="Nenhum membro encontrado"
                description="Tente outra busca."
              />
            ) : (
              filtered.map((m) => {
                const fns = memberFunctions[m.id] ?? [];
                const isOn = Object.prototype.hasOwnProperty.call(selection, m.id);
                const sel = selection[m.id] ?? [];
                const isExpanded = expanded.has(m.id);
                const isUnavailable = unavailableUserIds.has(m.userId);
                return (
                  <div
                    key={m.id}
                    className={cn(
                      "rounded-xl border border-border bg-card overflow-hidden",
                      isUnavailable && "opacity-60",
                    )}
                  >
                    <div className="flex items-center gap-3 px-4 py-3">
                      <div className="h-10 w-10 rounded-full bg-primary/15 text-primary flex items-center justify-center text-sm font-semibold shrink-0">
                        {m.user.name.slice(0, 2).toUpperCase()}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="font-medium truncate">{m.user.name}</div>
                        <div className="text-xs text-muted-foreground truncate">
                          {fns.length === 0
                            ? "Sem função atribuída"
                            : fns.map(fnName).filter(Boolean).join(", ")}
                        </div>
                        {isUnavailable && (
                          <div className="text-xs text-destructive mt-0.5">
                            Indisponível nesta data
                          </div>
                        )}
                      </div>
                      <Switch
                        checked={isOn}
                        disabled={isUnavailable}
                        onCheckedChange={(v) => toggleMember(m, v)}
                      />
                    </div>
                    {isOn && fns.length === 0 && (
                      <div className="px-4 pb-3 pt-1 text-sm text-muted-foreground border-t border-border/60">
                        Nenhuma função atribuída.
                      </div>
                    )}
                    {isOn && fns.length > 0 && (
                      <div className="border-t border-border/60">
                        <button
                          type="button"
                          onClick={() => toggleExpanded(m.id)}
                          className="w-full flex items-center justify-between px-4 py-2.5 text-sm text-muted-foreground hover:bg-muted/40 transition-colors"
                        >
                          <span>
                            {sel.length}/{fns.length} funções selecionadas.
                          </span>
                          {isExpanded ? (
                            <ChevronUp className="h-4 w-4" />
                          ) : (
                            <ChevronDown className="h-4 w-4" />
                          )}
                        </button>
                        {isExpanded && (
                          <ul className="px-4 pb-3 space-y-2">
                            {fns.map((fnId) => {
                              const fn = functions.find((f) => f.id === fnId);
                              const active = sel.includes(fnId);
                              return (
                                <li
                                  key={fnId}
                                  className="flex items-center gap-3 py-1.5"
                                >
                                  <span className="text-lg leading-none w-6 text-center">
                                    {fn?.icon ?? "•"}
                                  </span>
                                  <span className="flex-1 text-sm">
                                    {fn?.name ?? fnName(fnId)}
                                  </span>
                                  <Checkbox
                                    checked={active}
                                    onCheckedChange={() => toggleMemberFn(m.id, fnId)}
                                  />
                                </li>
                              );
                            })}
                          </ul>
                        )}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>

        <div className="border-t border-border px-4 py-3 flex justify-end">
          <Button
            onClick={() => onConfirm(selection)}
            disabled={totalSelected === 0}
          >
            <Check className="h-4 w-4 mr-1.5" />
            Salvar ( {totalSelected} )
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}

// ----------------- Teams Sheet -----------------
function TeamsSheet({
  open,
  onOpenChange,
  teams,
  functions,
  onApply,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  teams: MinistryTeam[];
  functions: MinistryFunction[];
  onApply: (team: MinistryTeam) => void;
}) {
  const fnName = (id: string) => functions.find((f) => f.id === id)?.name ?? "";

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-screen h-screen max-w-none p-0 flex flex-col"
      >
        <SheetHeader className="px-4 py-4 border-b border-border flex-row items-center gap-3 space-y-0">
          <button
            onClick={() => onOpenChange(false)}
            className="text-muted-foreground hover:text-foreground"
            aria-label="Fechar"
          >
            <X className="h-5 w-5" />
          </button>
          <SheetTitle className="flex-1 text-center">Equipes</SheetTitle>
          <div className="w-5" />
        </SheetHeader>

        <div className="px-4 sm:px-8 py-4 space-y-2 max-w-3xl mx-auto w-full flex-1 overflow-y-auto">
          {teams.length === 0 ? (
            <EmptyState
              icon={Users}
              title="Nenhuma equipe"
              description="Cadastre equipes na aba Ministério."
            />
          ) : (
            teams.map((t) => (
              <button
                type="button"
                key={t.id}
                onClick={() => onApply(t)}
                className="w-full text-left rounded-xl border border-border bg-card hover:border-primary/40 transition-colors px-4 py-3"
              >
                <div className="font-medium">{t.name}</div>
                <div className="text-xs text-muted-foreground mt-0.5 truncate">
                  {t.functionIds.length === 0
                    ? "Sem funções"
                    : t.functionIds.map(fnName).filter(Boolean).join(", ")}
                </div>
              </button>
            ))
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}