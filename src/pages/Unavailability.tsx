import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  Plus,
  Trash2,
  Pencil,
  X,
  CalendarOff,
  Calendar as CalendarIcon,
  Clock,
  Info,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { PageHeader } from "@/components/PageHeader";
import { LoadingState } from "@/components/LoadingState";
import { EmptyState } from "@/components/EmptyState";
import { useAuth } from "@/contexts/AuthContext";
import { useMinistry } from "@/contexts/MinistryContext";
import { ministryService } from "@/services/ministryService";
import { unavailabilityService } from "@/services/unavailabilityService";
import { scheduleHistoryService } from "@/services/scheduleHistoryService";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import type { Ministry, MinistryMember, Unavailability } from "@/types";

const WEEK = ["dom.", "seg.", "ter.", "qua.", "qui.", "sex.", "sáb."];

function startOfDay(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}
function endOfDay(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);
}
function sameDay(a: Date, b: Date) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}
function rangeOverlapsDay(start: Date, end: Date, day: Date) {
  return start <= endOfDay(day) && end >= startOfDay(day);
}
function fmtDateInput(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function fmtTimeInput(d: Date) {
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}
function durationText(start: Date, end: Date) {
  let ms = Math.max(0, end.getTime() - start.getTime());
  const days = Math.floor(ms / 86_400_000);
  ms -= days * 86_400_000;
  const hours = Math.floor(ms / 3_600_000);
  ms -= hours * 3_600_000;
  const mins = Math.floor(ms / 60_000);
  ms -= mins * 60_000;
  const secs = Math.floor(ms / 1000);
  const parts: string[] = [];
  if (days) parts.push(`${days}d`);
  parts.push(`${hours}h`);
  parts.push(`${mins}m`);
  parts.push(`${secs}s`);
  return parts.join(" ");
}

function buildMonthGrid(year: number, month: number): (Date | null)[] {
  const first = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0).getDate();
  const startWeekday = first.getDay();
  const cells: (Date | null)[] = [];
  for (let i = 0; i < startWeekday; i++) cells.push(null);
  for (let d = 1; d <= lastDay; d++) cells.push(new Date(year, month, d));
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

export default function UnavailabilityPage() {
  const { user } = useAuth();
  const { active } = useMinistry();
  const navigate = useNavigate();
  const location = useLocation();

  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<Unavailability[]>([]);
  const [members, setMembers] = useState<MinistryMember[]>([]);

  const today = useMemo(() => new Date(), []);
  const [cursor, setCursor] = useState(new Date(today.getFullYear(), today.getMonth(), 1));
  const [selectedDate, setSelectedDate] = useState<Date>(today);
  // null = all members
  const [selectedMemberId, setSelectedMemberId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const [addOpen, setAddOpen] = useState(false);
  const [editing, setEditing] = useState<Unavailability | null>(null);

  const load = async () => {
    if (!active) return;
    setLoading(true);
    const [list, mems] = await Promise.all([
      unavailabilityService.list(active.id),
      ministryService.listMembers(active.id),
    ]);
    setItems(list);
    setMembers(mems);
    setLoading(false);
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active]);

  useEffect(() => {
    const state = location.state as
      | { openAdd?: boolean; initialDate?: string; returnTo?: string }
      | null;
    if (state?.openAdd) setAddOpen(true);
  }, [location.state]);

  const navState = (location.state ?? {}) as {
    openAdd?: boolean;
    initialDate?: string;
    returnTo?: string;
  };
  const initialDateISO = navState.initialDate;
  const returnTo = navState.returnTo;

  const closeAddAndMaybeReturn = () => {
    setAddOpen(false);
    if (returnTo) navigate(returnTo);
  };

  const cells = useMemo(
    () => buildMonthGrid(cursor.getFullYear(), cursor.getMonth()),
    [cursor],
  );

  const filteredItems = useMemo(() => {
    if (!selectedMemberId) return items;
    return items.filter((i) => i.userId === selectedMemberId);
  }, [items, selectedMemberId]);

  const dayUnavCount = (day: Date) =>
    filteredItems.reduce(
      (acc, u) =>
        rangeOverlapsDay(new Date(u.startsAt), new Date(u.endsAt), day) ? acc + 1 : acc,
      0,
    );

  const onSelectedDateItems = useMemo(
    () =>
      filteredItems.filter((u) =>
        rangeOverlapsDay(new Date(u.startsAt), new Date(u.endsAt), selectedDate),
      ),
    [filteredItems, selectedDate],
  );

  const filteredMembers = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return members;
    return members.filter((m) => m.user.name.toLowerCase().includes(q));
  }, [members, search]);

  const toggleMember = (userId: string) => {
    setSelectedMemberId((prev) => (prev === userId ? null : userId));
  };

  const toggleExpand = (id: string) => {
    setExpanded((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  };

  const handleRemove = async (id: string) => {
    if (!confirm("Remover esta indisponibilidade?")) return;
    await unavailabilityService.remove(id);
    toast.success("Removida");
    load();
  };

  if (!active) return null;

  // Target user for the Add sheet: selected on page or current user
  const targetUserId = selectedMemberId ?? user?.id ?? "";
  const targetUserName =
    members.find((m) => m.userId === targetUserId)?.user.name ?? user?.name ?? "";

  return (
    <div>
      <PageHeader
        title="Indisponibilidades"
        description={active.name}
        actions={
          <Button onClick={() => setAddOpen(true)}>
            <Plus className="h-4 w-4 mr-1.5" /> Adicionar
          </Button>
        }
      />

      {loading ? (
        <LoadingState />
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-4">
            {/* Calendar */}
            <div className="rounded-xl border border-border bg-card p-4">
              <div className="flex items-center justify-between mb-3">
                <button
                  onClick={() =>
                    setCursor(new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1))
                  }
                  className="h-8 w-8 inline-flex items-center justify-center rounded-md hover:bg-muted"
                  aria-label="Mês anterior"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <div className="text-sm font-semibold uppercase tracking-wider">
                  {format(cursor, "MMMM 'de' yyyy", { locale: ptBR })}
                </div>
                <button
                  onClick={() =>
                    setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1))
                  }
                  className="h-8 w-8 inline-flex items-center justify-center rounded-md hover:bg-muted"
                  aria-label="Próximo mês"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
              <div className="grid grid-cols-7 gap-1 text-center text-xs text-muted-foreground mb-1">
                {WEEK.map((w) => (
                  <div key={w} className="py-1">
                    {w}
                  </div>
                ))}
              </div>
              <div className="grid grid-cols-7 gap-1">
                {cells.map((d, i) => {
                  if (!d) return <div key={i} className="h-12" />;
                  const isToday = sameDay(d, today);
                  const isSelected = sameDay(d, selectedDate);
                  const count = dayUnavCount(d);
                  const dotCount = Math.min(count, 3);
                  return (
                    <button
                      key={i}
                      onClick={() => setSelectedDate(d)}
                      className={cn(
                        "h-12 rounded-md text-sm relative transition-colors",
                        isSelected
                          ? "bg-primary/70 text-primary-foreground"
                          : isToday
                            ? "bg-muted"
                            : "hover:bg-muted/60",
                      )}
                    >
                      {d.getDate()}
                      {count > 0 && (
                        <span className="absolute bottom-1 left-1/2 -translate-x-1/2 flex items-center gap-0.5">
                          {Array.from({ length: dotCount }).map((_, idx) => (
                            <span
                              key={idx}
                              className={cn(
                                "h-1.5 w-1.5 rounded-full",
                                isSelected ? "bg-primary-foreground" : "bg-primary",
                              )}
                            />
                          ))}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Selected day items */}
            <div>
              <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                {format(selectedDate, "EEEE, d 'de' MMMM", { locale: ptBR })}
              </h3>
              {onSelectedDateItems.length === 0 ? (
                <EmptyState
                  icon={CalendarOff}
                  title="Nenhuma indisponibilidade neste dia"
                />
              ) : (
                <ul className="space-y-2">
                  {onSelectedDateItems.map((u) => {
                    const start = new Date(u.startsAt);
                    const end = new Date(u.endsAt);
                    const isOpen = expanded.has(u.id);
                    const canManage =
                      u.userId === user?.id || u.createdBy === user?.id;
                    const periodText = sameDay(start, end)
                      ? format(start, "dd/MM/yyyy", { locale: ptBR })
                      : `${format(start, "dd/MM/yyyy")} a ${format(end, "dd/MM/yyyy")}`;
                    return (
                      <li
                        key={u.id}
                        className="rounded-xl border border-border bg-card overflow-hidden"
                      >
                        <button
                          onClick={() => toggleExpand(u.id)}
                          className="w-full flex items-center gap-3 p-4 text-left hover:bg-muted/40"
                        >
                          <div className="h-10 w-10 rounded-full bg-primary/15 text-primary flex items-center justify-center text-xs font-semibold shrink-0">
                            {u.user.name.slice(0, 2).toUpperCase()}
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="font-medium truncate">{u.user.name}</div>
                            <div className="text-xs text-muted-foreground">{periodText}</div>
                          </div>
                          {isOpen ? (
                            <ChevronUp className="h-4 w-4 text-muted-foreground" />
                          ) : (
                            <ChevronDown className="h-4 w-4 text-muted-foreground" />
                          )}
                        </button>

                        {isOpen && (
                          <div className="border-t border-border px-4 py-4 space-y-4">
                            <div>
                              <div className="flex items-center justify-between">
                                <div className="text-sm font-semibold">Descrição</div>
                                <Info className="h-4 w-4 text-muted-foreground" />
                              </div>
                              <div className="text-sm text-muted-foreground mt-1 whitespace-pre-wrap">
                                {u.description || "—"}
                              </div>
                            </div>

                            <div className="flex items-start gap-3">
                              <CalendarIcon className="h-4 w-4 mt-0.5 text-muted-foreground" />
                              <div>
                                <div className="text-sm font-semibold">Data de início</div>
                                <div className="text-sm text-muted-foreground">
                                  {format(start, "dd/MM/yyyy HH:mm", { locale: ptBR })}{" "}
                                  ( {format(start, "EEEE", { locale: ptBR })} )
                                </div>
                              </div>
                            </div>

                            <div className="flex items-start gap-3">
                              <CalendarIcon className="h-4 w-4 mt-0.5 text-muted-foreground" />
                              <div>
                                <div className="text-sm font-semibold">Data de Término</div>
                                <div className="text-sm text-muted-foreground">
                                  {format(end, "dd/MM/yyyy HH:mm", { locale: ptBR })}{" "}
                                  ( {format(end, "EEEE", { locale: ptBR })} )
                                </div>
                              </div>
                            </div>

                            <div className="flex items-start gap-3">
                              <Clock className="h-4 w-4 mt-0.5 text-muted-foreground" />
                              <div>
                                <div className="text-sm font-semibold">Duração</div>
                                <div className="text-sm text-muted-foreground">
                                  {durationText(start, end)}
                                </div>
                              </div>
                            </div>

                            {canManage && (
                              <div className="flex justify-end gap-2 pt-2 border-t border-border">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleRemove(u.id)}
                                >
                                  <Trash2 className="h-4 w-4 mr-1.5" /> Excluir
                                </Button>
                                <Button size="sm" onClick={() => setEditing(u)}>
                                  <Pencil className="h-4 w-4 mr-1.5" /> Editar
                                </Button>
                              </div>
                            )}
                          </div>
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </div>

          {/* Sidebar — members filter */}
          <aside>
            <div className="rounded-xl border border-border bg-card p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Membros
                </h3>
              </div>
              <Button
                variant={selectedMemberId === null ? "default" : "outline"}
                className="w-full mb-3"
                onClick={() => setSelectedMemberId(null)}
              >
                Selecionar todos
              </Button>
              <Input
                placeholder="Pesquisar"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="mb-3"
              />
              <ul className="space-y-1 max-h-[420px] overflow-auto">
                {filteredMembers.map((m) => {
                  const checked = selectedMemberId === m.userId;
                  return (
                    <li key={m.id}>
                      <button
                        onClick={() => toggleMember(m.userId)}
                        className={cn(
                          "w-full flex items-center gap-3 px-2 py-2 rounded-md hover:bg-muted text-left",
                          checked && "bg-muted",
                        )}
                      >
                        <div className="h-8 w-8 rounded-full bg-primary/15 text-primary flex items-center justify-center text-xs font-semibold">
                          {m.user.name.slice(0, 2).toUpperCase()}
                        </div>
                        <span className="text-sm flex-1 truncate">{m.user.name}</span>
                        {checked ? (
                          <div className="h-5 w-5 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-[10px]">
                            ✓
                          </div>
                        ) : (
                          <ChevronRight className="h-4 w-4 text-muted-foreground" />
                        )}
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          </aside>
        </div>
      )}

      <AddUnavailabilitySheet
        open={addOpen}
        onClose={closeAddAndMaybeReturn}
        targetUserId={targetUserId}
        targetUserName={targetUserName}
        currentMinistryId={active.id}
        userId={user?.id ?? ""}
        initialDateISO={initialDateISO}
        onSaved={() => {
          setAddOpen(false);
          if (returnTo) navigate(returnTo);
          else load();
        }}
      />

      <EditUnavailabilitySheet
        item={editing}
        onClose={() => setEditing(null)}
        onSaved={() => {
          setEditing(null);
          load();
        }}
      />
    </div>
  );
}

function AddUnavailabilitySheet({
  open,
  onClose,
  targetUserId,
  targetUserName,
  currentMinistryId,
  userId,
  initialDateISO,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  targetUserId: string;
  targetUserName: string;
  currentMinistryId: string;
  userId: string;
  initialDateISO?: string;
  onSaved: () => void;
}) {
  const today = new Date();
  const [description, setDescription] = useState("");
  const [usePeriod, setUsePeriod] = useState(false);
  const [startDate, setStartDate] = useState(fmtDateInput(today));
  const [startTime, setStartTime] = useState("00:00");
  const [endDate, setEndDate] = useState(fmtDateInput(today));
  const [endTime, setEndTime] = useState("23:59");
  const [ministries, setMinistries] = useState<Ministry[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) return;
    setDescription("");
    setUsePeriod(false);
    const t = initialDateISO ? new Date(initialDateISO) : new Date();
    setStartDate(fmtDateInput(t));
    setEndDate(fmtDateInput(t));
    setStartTime("00:00");
    setEndTime("23:59");
    setSelected(new Set([currentMinistryId]));
    if (targetUserId) {
      ministryService.listForUser(targetUserId).then((ms) => setMinistries(ms));
    } else {
      setMinistries([]);
    }
  }, [open, targetUserId, currentMinistryId, initialDateISO]);

  const allChecked = selected.size > 0 && selected.size === ministries.length;

  const toggle = (id: string) => {
    setSelected((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  };

  const submit = async () => {
    if (!description.trim()) {
      toast.error("Descrição obrigatória");
      return;
    }
    if (selected.size === 0) {
      toast.error("Selecione pelo menos um ministério");
      return;
    }
    const startsAt = new Date(`${startDate}T${startTime}:00`).toISOString();
    const endsAt = new Date(
      `${usePeriod ? endDate : startDate}T${endTime}:00`,
    ).toISOString();
    if (new Date(endsAt) < new Date(startsAt)) {
      toast.error("Data/hora final inválida");
      return;
    }
    setSubmitting(true);
    try {
      for (const ministryId of selected) {
        await unavailabilityService.create({
          ministryId,
          userIds: [targetUserId],
          description,
          startsAt,
          endsAt,
          createdBy: userId,
        });
        try {
          await scheduleHistoryService.logUnavailabilityForOverlapping({
            ministryId,
            actorId: userId,
            actorName: targetUserName,
            targetUserName,
            startsAt,
            endsAt,
          });
        } catch {/* ignore */}
      }
      toast.success("Indisponibilidade registrada");
      onSaved();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent
        side="right"
        className="w-screen max-w-none sm:max-w-none flex flex-col p-6"
      >
        <SheetHeader>
          <SheetTitle>Nova Indisponibilidade</SheetTitle>
          {targetUserName && (
            <p className="text-sm text-muted-foreground">Para: {targetUserName}</p>
          )}
        </SheetHeader>

        <div className="flex-1 overflow-auto space-y-5 mt-4 pr-1">
          <div className="space-y-1.5">
            <Label htmlFor="desc">Descrição *</Label>
            <Textarea
              id="desc"
              maxLength={500}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Motivo da indisponibilidade"
              rows={3}
            />
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>
                Apenas os administradores do ministério podem visualizar a descrição.
              </span>
              <span>{description.length}/500</span>
            </div>
          </div>

          <div className="flex items-center justify-between">
            <Label>Selecionar período</Label>
            <Switch checked={usePeriod} onCheckedChange={setUsePeriod} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Data de início</Label>
              <Input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Hora</Label>
              <Input
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
              />
            </div>
            {usePeriod && (
              <>
                <div className="space-y-1.5">
                  <Label>Data de término</Label>
                  <Input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Hora</Label>
                  <Input
                    type="time"
                    value={endTime}
                    onChange={(e) => setEndTime(e.target.value)}
                  />
                </div>
              </>
            )}
            {!usePeriod && (
              <div className="space-y-1.5 col-span-1">
                <Label>Hora término</Label>
                <Input
                  type="time"
                  value={endTime}
                  onChange={(e) => setEndTime(e.target.value)}
                />
              </div>
            )}
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <Label>
                Ministérios{" "}
                <span className="text-xs text-muted-foreground ml-1">
                  {selected.size}/{ministries.length}
                </span>
              </Label>
              <button
                type="button"
                onClick={() =>
                  setSelected(allChecked ? new Set() : new Set(ministries.map((m) => m.id)))
                }
                className="text-xs text-primary hover:underline"
              >
                {allChecked ? "Limpar" : "Selecionar todos"}
              </button>
            </div>
            {ministries.length === 0 ? (
              <div className="text-sm text-muted-foreground rounded-md border border-border p-3">
                Nenhum ministério encontrado para este membro.
              </div>
            ) : (
              <ul className="space-y-1 max-h-72 overflow-auto rounded-md border border-border p-2">
                {ministries.map((m) => {
                  const checked = selected.has(m.id);
                  return (
                    <li key={m.id}>
                      <button
                        type="button"
                        onClick={() => toggle(m.id)}
                        className={cn(
                          "w-full flex items-center gap-3 px-2 py-2 rounded-md hover:bg-muted text-left",
                          checked && "bg-muted",
                        )}
                      >
                        <span className="text-sm flex-1 truncate">{m.name}</span>
                        <Checkbox checked={checked} />
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>

        <div className="border-t border-border pt-3 flex justify-end gap-2">
          <Button variant="outline" onClick={onClose}>
            <X className="h-4 w-4 mr-1.5" /> Cancelar
          </Button>
          <Button onClick={submit} disabled={submitting}>
            Salvar
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}

function EditUnavailabilitySheet({
  item,
  onClose,
  onSaved,
}: {
  item: Unavailability | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const open = !!item;
  const [description, setDescription] = useState("");
  const [usePeriod, setUsePeriod] = useState(false);
  const [startDate, setStartDate] = useState("");
  const [startTime, setStartTime] = useState("");
  const [endDate, setEndDate] = useState("");
  const [endTime, setEndTime] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!item) return;
    const s = new Date(item.startsAt);
    const e = new Date(item.endsAt);
    setDescription(item.description ?? "");
    setStartDate(fmtDateInput(s));
    setStartTime(fmtTimeInput(s));
    setEndDate(fmtDateInput(e));
    setEndTime(fmtTimeInput(e));
    setUsePeriod(!sameDay(s, e));
  }, [item]);

  const submit = async () => {
    if (!item) return;
    if (!description.trim()) {
      toast.error("Descrição obrigatória");
      return;
    }
    const startsAt = new Date(`${startDate}T${startTime}:00`).toISOString();
    const endsAt = new Date(
      `${usePeriod ? endDate : startDate}T${endTime}:00`,
    ).toISOString();
    if (new Date(endsAt) < new Date(startsAt)) {
      toast.error("Data/hora final inválida");
      return;
    }
    setSubmitting(true);
    try {
      await unavailabilityService.update(item.id, { description, startsAt, endsAt });
      toast.success("Atualizada");
      onSaved();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent side="right" className="w-full sm:max-w-xl flex flex-col">
        <SheetHeader>
          <SheetTitle>Editar Indisponibilidade</SheetTitle>
        </SheetHeader>

        <div className="flex-1 overflow-auto space-y-5 mt-4 pr-1">
          <div className="space-y-1.5">
            <Label htmlFor="edesc">Descrição *</Label>
            <Textarea
              id="edesc"
              maxLength={500}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
            />
            <div className="text-xs text-muted-foreground text-right">
              {description.length}/500
            </div>
          </div>

          <div className="flex items-center justify-between">
            <Label>Selecionar período</Label>
            <Switch checked={usePeriod} onCheckedChange={setUsePeriod} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Data de início</Label>
              <Input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Hora</Label>
              <Input
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
              />
            </div>
            {usePeriod && (
              <>
                <div className="space-y-1.5">
                  <Label>Data de término</Label>
                  <Input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Hora</Label>
                  <Input
                    type="time"
                    value={endTime}
                    onChange={(e) => setEndTime(e.target.value)}
                  />
                </div>
              </>
            )}
            {!usePeriod && (
              <div className="space-y-1.5 col-span-1">
                <Label>Hora término</Label>
                <Input
                  type="time"
                  value={endTime}
                  onChange={(e) => setEndTime(e.target.value)}
                />
              </div>
            )}
          </div>
        </div>

        <div className="border-t border-border pt-3 flex justify-end gap-2">
          <Button variant="outline" onClick={onClose}>
            <X className="h-4 w-4 mr-1.5" /> Cancelar
          </Button>
          <Button onClick={submit} disabled={submitting}>
            Salvar
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
