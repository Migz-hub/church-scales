import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  ArrowLeft,
  BellRing,
  History,
  ListChecks,
  LogOut,
  Pencil,
  ThumbsDown,
  ThumbsUp,
  Trash2,
  UserCircle2,
  UserMinus,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { LoadingState } from "@/components/LoadingState";
import { EmptyState } from "@/components/EmptyState";
import { ErrorState } from "@/components/ErrorState";
import { useAuth } from "@/contexts/AuthContext";
import { useMinistry } from "@/contexts/MinistryContext";
import { scheduleService } from "@/services/scheduleService";
import { unavailabilityService } from "@/services/unavailabilityService";
import { scheduleHistoryService } from "@/services/scheduleHistoryService";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import type {
  AssignmentStatus,
  Schedule,
  ScheduleAssignment,
  ScheduleHistoryEntry,
  Unavailability,
} from "@/types";
import { Switch } from "@/components/ui/switch";

const MONTHS_PT = ["JAN", "FEV", "MAR", "ABR", "MAI", "JUN", "JUL", "AGO", "SET", "OUT", "NOV", "DEZ"];

function relativeLabel(date: Date): string {
  const now = new Date();
  const d0 = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const d1 = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
  const diffDays = Math.round((d1 - d0) / 86400000);
  if (diffDays === 0) return "Hoje";
  if (diffDays === 1) return "Amanhã";
  if (diffDays === -1) return "Ontem";
  if (diffDays > 1) return `Daqui a ${diffDays} dias`;
  return `Há ${Math.abs(diffDays)} dias`;
}

const statusMeta: Record<AssignmentStatus, { label: string; className: string }> = {
  confirmed: { label: "Confirmado", className: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30" },
  pending: { label: "Pendente", className: "bg-amber-500/15 text-amber-400 border-amber-500/30" },
  declined: { label: "Recusado", className: "bg-destructive/15 text-destructive border-destructive/30" },
};

function StatusBadge({ status }: { status?: AssignmentStatus }) {
  const s = status ?? "pending";
  const meta = statusMeta[s];
  return (
    <span className={cn("inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium", meta.className)}>
      {meta.label}
    </span>
  );
}

export default function ScheduleDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { active, can } = useMinistry();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [schedule, setSchedule] = useState<Schedule | null>(null);
  const [assignments, setAssignments] = useState<ScheduleAssignment[]>([]);
  const [unavailabilities, setUnavailabilities] = useState<Unavailability[]>([]);
  const [tab, setTab] = useState<"membros" | "funcoes">("membros");
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [memberDetailUserId, setMemberDetailUserId] = useState<string | null>(null);
  const [absencesOpen, setAbsencesOpen] = useState(false);
  const [absencesNotice, setAbsencesNotice] = useState<string | null>(null);
  const [absenceDraft, setAbsenceDraft] = useState<Record<string, boolean>>({});
  const [savingAbsences, setSavingAbsences] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [history, setHistory] = useState<ScheduleHistoryEntry[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  const load = async () => {
    if (!id || !active) return;
    setLoading(true);
    setError(null);
    try {
      const [s, a, u] = await Promise.all([
        scheduleService.getById(id),
        scheduleService.listAssignments(id),
        unavailabilityService.list(active.id),
      ]);
      setSchedule(s);
      setAssignments(a);
      setUnavailabilities(u);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao carregar escala");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, active]);

  const dateObj = useMemo(() => (schedule ? new Date(schedule.date) : null), [schedule]);

  const dayStartMs = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const dayEndMs = (d: Date) =>
    new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999).getTime();
  const userHasUnavOnDate = (userId: string): boolean => {
    if (!dateObj) return false;
    const ds = dayStartMs(dateObj);
    const de = dayEndMs(dateObj);
    return unavailabilities.some(
      (u) =>
        u.userId === userId &&
        new Date(u.startsAt).getTime() <= de &&
        new Date(u.endsAt).getTime() >= ds,
    );
  };

  const groupedByMember = useMemo(() => {
    const map = new Map<
      string,
      { userId: string; name: string; initials: string; items: ScheduleAssignment[] }
    >();
    for (const a of assignments) {
      if (!a.userId) continue;
      const cur = map.get(a.userId);
      if (cur) cur.items.push(a);
      else
        map.set(a.userId, {
          userId: a.userId,
          name: a.user?.name ?? "Membro",
          initials: (a.user?.name ?? "?").slice(0, 2).toUpperCase(),
          items: [a],
        });
    }
    return Array.from(map.values());
  }, [assignments]);

  const memberStatus = (items: ScheduleAssignment[]): AssignmentStatus => {
    if (items.some((a) => (a.status ?? "pending") === "pending")) return "pending";
    if (items.every((a) => a.status === "declined")) return "declined";
    return "confirmed";
  };

  const groupedByRole = useMemo(() => {
    const map = new Map<string, ScheduleAssignment[]>();
    for (const a of assignments) {
      const arr = map.get(a.label) ?? [];
      arr.push(a);
      map.set(a.label, arr);
    }
    return Array.from(map.entries()).map(([label, items]) => ({ label, items }));
  }, [assignments]);

  const filledCount = assignments.filter((a) => a.userId).length;
  const totalSlots = assignments.length;

  const myAssignments = assignments.filter((a) => a.userId === user?.id);
  const isParticipant = myAssignments.length > 0;
  const myUnav = user ? userHasUnavOnDate(user.id) : false;
  const baseStatus: AssignmentStatus = myAssignments.some(
    (a) => (a.status ?? "pending") === "pending",
  )
    ? "pending"
    : myAssignments.every((a) => a.status === "declined")
      ? "declined"
      : "confirmed";
  const myStatus: AssignmentStatus = myUnav ? "declined" : baseStatus;
  const hasResponded = isParticipant && myStatus !== "pending";

  // Auto-mark declined when an unavailability exists for this date
  useEffect(() => {
    if (!user || !isParticipant || !myUnav) return;
    const toUpdate = myAssignments.filter((a) => (a.status ?? "pending") !== "declined");
    if (toUpdate.length === 0) return;
    setAssignments((prev) =>
      prev.map((a) => (a.userId === user.id ? { ...a, status: "declined" as AssignmentStatus } : a)),
    );
    Promise.all(
      toUpdate.map((a) => scheduleService.setAssignmentStatus(a.id, "declined")),
    ).catch(() => load());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [myUnav]);

  const onChangeAllStatus = async (status: AssignmentStatus) => {
    setAssignments((prev) =>
      prev.map((a) => (a.userId === user?.id ? { ...a, status } : a)),
    );
    try {
      await Promise.all(
        myAssignments.map((a) => scheduleService.setAssignmentStatus(a.id, status)),
      );
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao atualizar status");
      load();
    }
  };

  const onConfirmParticipation = async () => {
    await onChangeAllStatus("confirmed");
    setConfirmOpen(false);
    toast.success("Participação confirmada");
  };

  const onDeclineParticipation = async () => {
    setConfirmOpen(false);
    if (!schedule) return;
    navigate("/indisponibilidade", {
      state: {
        openAdd: true,
        initialDate: schedule.date,
        returnTo: `/escalas/${schedule.id}`,
      },
    });
  };

  const onLeave = async () => {
    if (!schedule || !user) return;
    navigate("/indisponibilidade", {
      state: {
        openAdd: true,
        initialDate: schedule.date,
        returnTo: `/escalas/${schedule.id}`,
      },
    });
  };

  const onDeleteSchedule = async () => {
    if (!schedule) return;
    if (!confirm("Excluir esta escala? Esta ação não pode ser desfeita.")) return;
    await scheduleService.remove(schedule.id);
    toast.success("Escala excluída");
    navigate("/escalas");
  };

  const openAbsences = () => {
    if (!schedule || !dateObj) return;
    if (Date.now() < dateObj.getTime()) {
      setAbsencesNotice(
        `A data da escala ainda não passou. Você só poderá registrar a falta a partir de ${format(dateObj, "dd/MM/yyyy HH:mm")}.`,
      );
      return;
    }
    const draft: Record<string, boolean> = {};
    for (const g of groupedByMember) {
      // attended = true means present; missed = !attended. Default = present.
      const allMissed = g.items.every((a) => a.attended === false);
      draft[g.userId] = allMissed;
    }
    setAbsenceDraft(draft);
    setAbsencesOpen(true);
  };

  const saveAbsences = async () => {
    if (!schedule || !user || !active) return;
    setSavingAbsences(true);
    try {
      const changes: { name: string; missed: boolean }[] = [];
      for (const g of groupedByMember) {
        const missed = !!absenceDraft[g.userId];
        const wasMissed = g.items.every((a) => a.attended === false);
        if (missed === wasMissed && g.items.every((a) => a.attended !== undefined && a.attended !== null)) continue;
        for (const a of g.items) {
          await scheduleService.setAttendance(a.id, !missed);
        }
        if (missed !== wasMissed) changes.push({ name: g.name, missed });
      }
      if (changes.length > 0) {
        await scheduleHistoryService.add({
          ministryId: active.id,
          scheduleId: schedule.id,
          scheduleDate: schedule.date,
          actorId: user.id,
          actorName: user.name,
          kind: "attendance",
          summary: "Faltas atualizadas",
          changes: changes.map((c) => ({ field: c.name, after: c.missed ? "Faltou" : "Presente" })),
        });
      }
      toast.success("Faltas registradas");
      setAbsencesOpen(false);
      load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao salvar");
    } finally {
      setSavingAbsences(false);
    }
  };

  const openHistory = async () => {
    if (!schedule) return;
    setHistoryOpen(true);
    setHistoryLoading(true);
    try {
      const list = await scheduleHistoryService.list(schedule.id);
      setHistory(list);
    } finally {
      setHistoryLoading(false);
    }
  };

  if (loading) return <LoadingState />;
  if (error) return <ErrorState message={error} onRetry={load} />;
  if (!schedule || !dateObj) return <EmptyState title="Escala não encontrada" />;

  const day = String(dateObj.getDate()).padStart(2, "0");
  const month = MONTHS_PT[dateObj.getMonth()];
  const weekday = format(dateObj, "EEEE", { locale: ptBR });
  const time = format(dateObj, "HH:mm");
  const canEdit = can("schedule.edit");
  const canDelete = can("schedule.delete");

  return (
    <div className="animate-fade-in">
      <button
        onClick={() => navigate("/escalas")}
        className="text-sm text-muted-foreground hover:text-foreground inline-flex items-center gap-1 mb-4 transition-colors"
      >
        <ArrowLeft className="h-4 w-4" /> Voltar
      </button>

      {/* HEADER */}
      <div className="flex items-stretch gap-4 mb-4">
        <div className="rounded-xl bg-primary/15 text-primary flex flex-col items-center justify-center w-24 sm:w-28 py-4 shrink-0">
          <span className="text-3xl font-bold leading-none">{day}</span>
          <span className="text-xs font-semibold tracking-wider mt-1">{month}</span>
          <span className="text-sm text-primary/80 mt-3">{time}</span>
        </div>
        <div className="flex-1 min-w-0 rounded-xl bg-primary/10 px-5 py-4 flex flex-col justify-center">
          <h1 className="text-2xl font-semibold tracking-tight truncate text-foreground">
            {schedule.title}
          </h1>
          <div className="text-xs uppercase tracking-wider text-muted-foreground mt-1.5 flex items-center gap-2 flex-wrap">
            <span>{weekday}</span>
            <span>•</span>
            <span>{relativeLabel(dateObj)}</span>
          </div>
        </div>
      </div>

      {/* ACTION PILLS */}
      <div className="flex flex-wrap items-center justify-center gap-2 mb-6">
        {isParticipant && !hasResponded && (
          <button
            onClick={() => setConfirmOpen(true)}
            className="inline-flex items-center gap-2 rounded-full bg-amber-500/10 hover:bg-amber-500/15 border border-amber-500/30 px-4 py-2 text-sm text-amber-400 transition-colors"
          >
            <BellRing className="h-4 w-4" /> Confirmação pendente
          </button>
        )}
        {hasResponded && (
          <button
            onClick={onLeave}
            className="inline-flex items-center gap-2 rounded-full bg-card hover:bg-muted border border-border px-4 py-2 text-sm transition-colors"
          >
            <LogOut className="h-4 w-4 text-sky-400" /> Sair da escala
          </button>
        )}
        {canEdit && (
          <button
            onClick={() => navigate(`/escalas/${schedule.id}/editar`)}
            className="inline-flex items-center gap-2 rounded-full bg-card hover:bg-muted border border-border px-4 py-2 text-sm transition-colors"
          >
            <Pencil className="h-4 w-4 text-amber-400" /> Editar
          </button>
        )}
        {canEdit && (
          <button
            onClick={openAbsences}
            className="inline-flex items-center gap-2 rounded-full bg-card hover:bg-muted border border-border px-4 py-2 text-sm transition-colors"
          >
            <UserMinus className="h-4 w-4 text-rose-400" /> Registrar faltas
          </button>
        )}
        <button
          onClick={openHistory}
          className="inline-flex items-center gap-2 rounded-full bg-card hover:bg-muted border border-border px-4 py-2 text-sm transition-colors"
        >
          <History className="h-4 w-4 text-violet-400" /> Histórico
        </button>
        {canDelete && (
          <button
            onClick={onDeleteSchedule}
            className="inline-flex items-center gap-2 rounded-full bg-card hover:bg-destructive/10 border border-border hover:border-destructive/40 px-4 py-2 text-sm text-destructive transition-colors"
          >
            <Trash2 className="h-4 w-4" /> Excluir
          </button>
        )}
      </div>

      {schedule.description && (
        <div className="rounded-xl border border-border bg-card px-5 py-4 mb-6 text-sm whitespace-pre-wrap text-muted-foreground">
          {schedule.description}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* PARTICIPANTES */}
        <section className="lg:col-span-2">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Participantes
              </h2>
              <Badge variant="secondary">
                {filledCount}/{totalSlots || 0}
              </Badge>
            </div>
          </div>

          <Tabs value={tab} onValueChange={(v) => setTab(v as "membros" | "funcoes")}>
            <TabsList>
              <TabsTrigger value="membros" className="gap-1.5">
                <Users className="h-4 w-4" /> Membros
              </TabsTrigger>
              <TabsTrigger value="funcoes" className="gap-1.5">
                <ListChecks className="h-4 w-4" /> Funções
              </TabsTrigger>
            </TabsList>

            <TabsContent value="membros" className="mt-4 animate-fade-in">
              {groupedByMember.length === 0 ? (
                <EmptyState
                  icon={UserCircle2}
                  title="Nenhum participante"
                  description={
                    canEdit
                      ? "Edite a escala para adicionar participantes."
                      : "Aguarde a liderança organizar."
                  }
                />
              ) : (
                <ul className="space-y-2">
                  {groupedByMember.map((g) => {
                    const hasUnav = userHasUnavOnDate(g.userId);
                    const status: AssignmentStatus = hasUnav ? "declined" : memberStatus(g.items);
                    const labels = g.items.map((i) => i.label).join(", ");
                    return (
                      <li
                        key={g.userId}
                        className="rounded-xl border border-border bg-card p-4 shadow-card transition-colors hover:border-primary/30 cursor-pointer"
                        onClick={() => setMemberDetailUserId(g.userId)}
                      >
                        <div className="flex items-center justify-between gap-3 flex-wrap">
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="h-10 w-10 rounded-full bg-primary/15 text-primary flex items-center justify-center text-xs font-semibold shrink-0">
                              {g.initials}
                            </div>
                            <div className="min-w-0">
                              <div className="font-medium truncate">{g.name}</div>
                              <div className="text-xs text-muted-foreground truncate">{labels}</div>
                            </div>
                          </div>
                          <StatusBadge status={status} />
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </TabsContent>

            <TabsContent value="funcoes" className="mt-4 animate-fade-in">
              {groupedByRole.length === 0 ? (
                <EmptyState
                  icon={ListChecks}
                  title="Nenhuma função definida"
                  description={canEdit ? "Edite a escala para adicionar funções." : "Aguarde a liderança."}
                />
              ) : (
                <div className="space-y-2">
                  {groupedByRole.map((g) => {
                    const filled = g.items.filter((i) => i.userId).length;
                    return (
                      <div
                        key={g.label}
                        className="rounded-xl border border-border bg-card p-4 shadow-card"
                      >
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <span className="font-medium">{g.label}</span>
                            <Badge variant="secondary">
                              {filled}/{g.items.length}
                            </Badge>
                          </div>
                        </div>
                        <ul className="space-y-1.5">
                          {g.items.map((a) => (
                            <li
                              key={a.id}
                              className="flex items-center justify-between text-sm"
                            >
                              <span className="truncate">
                                {a.user ? a.user.name : <span className="italic text-muted-foreground">Vaga aberta</span>}
                              </span>
                              <StatusBadge status={a.status} />
                            </li>
                          ))}
                        </ul>
                      </div>
                    );
                  })}
                </div>
              )}
            </TabsContent>
          </Tabs>
        </section>

        {/* ROTEIRO */}
        <aside>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Roteiro
            </h2>
          </div>

          {!schedule.agenda || schedule.agenda.length === 0 ? (
            <EmptyState
              icon={ListChecks}
              title="Roteiro vazio"
              description={canEdit ? "Edite a escala para adicionar itens." : "Sem itens cadastrados."}
            />
          ) : (
            <ol className="space-y-2">
              {schedule.agenda.map((item, idx) => (
                <li
                  key={item.id}
                  className="flex items-start gap-3 rounded-xl border border-border bg-card p-3 shadow-card transition-colors hover:border-primary/30"
                >
                  <div className="h-7 w-7 rounded-md bg-primary/15 text-primary flex items-center justify-center text-xs font-semibold shrink-0">
                    {idx + 1}
                  </div>
                  <div className="min-w-0">
                    <div className="font-medium text-sm truncate">{item.name}</div>
                    {item.description && (
                      <div className="text-xs text-muted-foreground mt-0.5 whitespace-pre-wrap">
                        {item.description}
                      </div>
                    )}
                  </div>
                </li>
              ))}
            </ol>
          )}
        </aside>
      </div>

      {/* Modal de confirmação */}
      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-center">Confirme sua participação nesta escala.</DialogTitle>
          </DialogHeader>
          <ul className="space-y-2 my-2">
            {myAssignments.map((a) => (
              <li key={a.id} className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-primary/15 text-primary flex items-center justify-center text-sm font-semibold">
                  {a.user ? a.user.name.slice(0, 2).toUpperCase() : "?"}
                </div>
                <div className="min-w-0">
                  <div className="font-medium truncate">{a.user?.name}</div>
                  <div className="text-xs text-muted-foreground truncate">{a.label}</div>
                </div>
              </li>
            ))}
          </ul>
          <div className="grid grid-cols-2 gap-2 mt-2">
            <Button variant="outline" onClick={onDeclineParticipation}>
              <ThumbsDown className="h-4 w-4 mr-1.5" /> Não participarei
            </Button>
            <Button onClick={onConfirmParticipation}>
              <ThumbsUp className="h-4 w-4 mr-1.5" /> Confirmar
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Detalhes do membro */}
      <Dialog open={!!memberDetailUserId} onOpenChange={(v) => !v && setMemberDetailUserId(null)}>
        <DialogContent className="sm:max-w-md">
          {(() => {
            const g = groupedByMember.find((x) => x.userId === memberDetailUserId);
            if (!g) return null;
            const hasUnav = userHasUnavOnDate(g.userId);
            const status: AssignmentStatus = hasUnav ? "declined" : memberStatus(g.items);
            return (
              <>
                <DialogHeader>
                  <DialogTitle className="sr-only">{g.name}</DialogTitle>
                </DialogHeader>
                <div className="flex items-center gap-3">
                  <div className="h-12 w-12 rounded-full bg-primary/15 text-primary flex items-center justify-center text-sm font-semibold">
                    {g.initials}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="font-semibold text-lg truncate">{g.name}</div>
                    <div className="flex flex-wrap gap-1.5 mt-1.5">
                      {g.items.map((a) => (
                        <span
                          key={a.id}
                          className="inline-flex items-center rounded-full bg-muted px-2.5 py-0.5 text-xs"
                        >
                          {a.label}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
                <div className="rounded-lg border border-border bg-card px-4 py-3 mt-2 flex items-center justify-between">
                  <span className="text-sm font-medium">Status</span>
                  <StatusBadge status={status} />
                </div>
              </>
            );
          })()}
        </DialogContent>
      </Dialog>

      {/* Aviso: data não passou */}
      <Dialog open={!!absencesNotice} onOpenChange={(v) => !v && setAbsencesNotice(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Ops</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">{absencesNotice}</p>
          <div className="flex justify-end mt-2">
            <Button variant="ghost" onClick={() => setAbsencesNotice(null)}>Ok</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Registrar faltas */}
      <Dialog open={absencesOpen} onOpenChange={setAbsencesOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-center">Registrar faltas</DialogTitle>
          </DialogHeader>
          <div>
            <div className="font-semibold">{schedule.title}</div>
            <div className="text-xs text-muted-foreground mt-0.5">
              {format(dateObj, "HH:mm")} · {format(dateObj, "EEEE", { locale: ptBR })} · {format(dateObj, "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
            </div>
          </div>
          {groupedByMember.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4">Nenhum participante.</p>
          ) : (
            <ul className="space-y-2 mt-3 max-h-[55vh] overflow-y-auto">
              {groupedByMember.map((g) => {
                const missed = !!absenceDraft[g.userId];
                return (
                  <li
                    key={g.userId}
                    className="flex items-center justify-between gap-3 rounded-lg border border-border bg-card p-3"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="h-9 w-9 rounded-full bg-primary/15 text-primary flex items-center justify-center text-xs font-semibold shrink-0">
                        {g.initials}
                      </div>
                      <div className="min-w-0">
                        <div className="font-medium truncate">{g.name}</div>
                        {missed && (
                          <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-destructive/15 text-destructive border border-destructive/30 mt-1">
                            <UserMinus className="h-3 w-3" /> Faltou
                          </span>
                        )}
                      </div>
                    </div>
                    <Switch
                      checked={missed}
                      onCheckedChange={(v) =>
                        setAbsenceDraft((p) => ({ ...p, [g.userId]: !!v }))
                      }
                    />
                  </li>
                );
              })}
            </ul>
          )}
          <div className="flex justify-end gap-2 mt-3">
            <Button variant="ghost" onClick={() => setAbsencesOpen(false)}>Cancelar</Button>
            <Button onClick={saveAbsences} disabled={savingAbsences}>
              {savingAbsences ? "Salvando..." : "Salvar"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Histórico */}
      <Dialog open={historyOpen} onOpenChange={setHistoryOpen}>
        <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-center">Histórico de alterações</DialogTitle>
          </DialogHeader>
          {historyLoading ? (
            <p className="text-sm text-muted-foreground py-4 text-center">Carregando...</p>
          ) : history.length === 0 ? (
            <p className="text-sm text-muted-foreground py-6 text-center">Sem registros.</p>
          ) : (
            <ul className="divide-y divide-border">
              {history.map((h) => (
                <li key={h.id} className="py-4">
                  <div className="flex justify-end text-xs text-muted-foreground mb-2">
                    {format(new Date(h.createdAt), "dd/MM/yyyy HH:mm")}
                  </div>
                  {h.kind === "unavailability" ? (
                    <p className="text-sm">{h.summary}</p>
                  ) : (
                    <div className="space-y-2 text-sm">
                      <div>
                        <div className="text-xs text-muted-foreground">
                          {h.kind === "created" ? "Criado por:" : "Alterado por:"}
                        </div>
                        <div className="font-semibold">{h.actorName}</div>
                      </div>
                      {h.details &&
                        Object.entries(h.details)
                          .filter(([, v]) => v !== undefined && v !== "")
                          .map(([k, v]) => (
                            <div key={k}>
                              <div className="text-xs text-muted-foreground">{k}</div>
                              <div className="font-semibold whitespace-pre-wrap">{v}</div>
                            </div>
                          ))}
                      {h.changes && h.changes.length > 0 && (
                        <div className="space-y-1.5">
                          {h.changes.map((c, i) => (
                            <div key={i}>
                              <div className="text-xs text-muted-foreground">{c.field}</div>
                              <div className="font-semibold">
                                {c.before !== undefined && (
                                  <span className="line-through text-muted-foreground mr-2">{c.before}</span>
                                )}
                                {c.after}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                      {h.addedMembers && h.addedMembers.length > 0 && (
                        <div>
                          <div className="text-xs text-muted-foreground">Membros adicionados:</div>
                          {h.addedMembers.map((m, i) => (
                            <div key={i} className="font-medium">
                              - {m.name}{m.label ? ` ( ${m.label} )` : ""}
                            </div>
                          ))}
                        </div>
                      )}
                      {h.removedMembers && h.removedMembers.length > 0 && (
                        <div>
                          <div className="text-xs text-muted-foreground">Membros removidos:</div>
                          {h.removedMembers.map((m, i) => (
                            <div key={i} className="font-medium">
                              - {m.name}{m.label ? ` ( ${m.label} )` : ""}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
          {dateObj && (
            <p className="text-xs text-destructive text-center mt-2">
              Esse histórico será apagado dia {format(new Date(dateObj.getTime() + 7 * 86400000), "dd/MM/yyyy")}
              <br />( uma semana após a data da escala ).
            </p>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}