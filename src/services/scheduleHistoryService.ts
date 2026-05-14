import { supabase } from "@/integrations/supabase/client";
import type { ScheduleHistoryEntry, ScheduleHistoryChange } from "@/types";

type Row = {
  id: string;
  ministry_id: string;
  schedule_id: string;
  schedule_date: string;
  actor_id: string;
  kind: ScheduleHistoryEntry["kind"];
  summary: string | null;
  changes: unknown;
  added_members: unknown;
  removed_members: unknown;
  details: unknown;
  created_at: string;
};

function map(r: Row, actorName: string): ScheduleHistoryEntry {
  return {
    id: r.id,
    ministryId: r.ministry_id,
    scheduleId: r.schedule_id,
    scheduleDate: r.schedule_date,
    createdAt: r.created_at,
    actorId: r.actor_id,
    actorName,
    kind: r.kind,
    summary: r.summary ?? undefined,
    changes: (r.changes as ScheduleHistoryChange[] | null) ?? undefined,
    addedMembers: (r.added_members as { name: string; label?: string }[] | null) ?? undefined,
    removedMembers: (r.removed_members as { name: string; label?: string }[] | null) ?? undefined,
    details: (r.details as Record<string, string | undefined> | null) ?? undefined,
  };
}

async function nameMap(ids: string[]): Promise<Map<string, string>> {
  if (ids.length === 0) return new Map();
  const { data } = await supabase.from("profiles").select("id, name").in("id", ids);
  return new Map((data ?? []).map((p) => [p.id, p.name]));
}

export const scheduleHistoryService = {
  async list(scheduleId: string): Promise<ScheduleHistoryEntry[]> {
    const { data } = await supabase
      .from("schedule_history")
      .select("*")
      .eq("schedule_id", scheduleId)
      .order("created_at", { ascending: false });
    const rows = (data ?? []) as Row[];
    const names = await nameMap(Array.from(new Set(rows.map((r) => r.actor_id))));
    return rows.map((r) => map(r, names.get(r.actor_id) ?? ""));
  },

  async add(
    input: Omit<ScheduleHistoryEntry, "id" | "createdAt">,
  ): Promise<ScheduleHistoryEntry> {
    const { data, error } = await supabase
      .from("schedule_history")
      .insert({
        ministry_id: input.ministryId,
        schedule_id: input.scheduleId,
        schedule_date: input.scheduleDate,
        actor_id: input.actorId,
        kind: input.kind,
        summary: input.summary ?? null,
        changes: input.changes ?? null,
        added_members: input.addedMembers ?? null,
        removed_members: input.removedMembers ?? null,
        details: input.details ?? null,
      })
      .select()
      .single();
    if (error || !data) throw new Error(error?.message ?? "Erro ao registrar histórico.");
    return map(data as Row, input.actorName);
  },

  async logUnavailabilityForOverlapping(input: {
    ministryId: string;
    actorId: string;
    actorName: string;
    targetUserName: string;
    startsAt: string;
    endsAt: string;
  }): Promise<void> {
    // Schedules whose date falls within the unavailability range
    const startISO = new Date(input.startsAt).toISOString();
    const endDate = new Date(input.endsAt);
    endDate.setDate(endDate.getDate() + 1);
    const endISO = endDate.toISOString();
    const { data: schedules } = await supabase
      .from("schedules")
      .select("id, ministry_id, date")
      .eq("ministry_id", input.ministryId)
      .gte("date", startISO)
      .lt("date", endISO);
    const list = schedules ?? [];
    if (list.length === 0) return;
    const rows = list.map((s) => ({
      ministry_id: s.ministry_id,
      schedule_id: s.id,
      schedule_date: s.date,
      actor_id: input.actorId,
      kind: "unavailability" as const,
      summary: `${input.targetUserName} informou estar indisponível.`,
    }));
    await supabase.from("schedule_history").insert(rows);
  },
};
