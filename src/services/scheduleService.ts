import { supabase } from "@/integrations/supabase/client";
import type { Schedule, ScheduleAgendaItem, ScheduleAssignment } from "@/types";

type ScheduleRow = {
  id: string;
  ministry_id: string;
  title: string;
  date: string;
  description: string | null;
  published: boolean;
  require_confirmation: boolean;
  created_by: string;
  created_at: string;
};

function mapSchedule(s: ScheduleRow, agenda: ScheduleAgendaItem[] = []): Schedule {
  return {
    id: s.id,
    ministryId: s.ministry_id,
    title: s.title,
    date: s.date,
    description: s.description ?? undefined,
    createdAt: s.created_at,
    createdBy: s.created_by,
    published: s.published,
    requireConfirmation: s.require_confirmation,
    agenda,
  };
}

async function loadAgendaMap(scheduleIds: string[]): Promise<Map<string, ScheduleAgendaItem[]>> {
  if (scheduleIds.length === 0) return new Map();
  const { data } = await supabase
    .from("schedule_agenda_items")
    .select("*")
    .in("schedule_id", scheduleIds)
    .order("position", { ascending: true });
  const map = new Map<string, ScheduleAgendaItem[]>();
  (data ?? []).forEach((row) => {
    const arr = map.get(row.schedule_id) ?? [];
    arr.push({ id: row.id, name: row.name, description: row.description ?? undefined });
    map.set(row.schedule_id, arr);
  });
  return map;
}

export const scheduleService = {
  async list(ministryId: string): Promise<Schedule[]> {
    const { data } = await supabase
      .from("schedules")
      .select("*")
      .eq("ministry_id", ministryId)
      .order("date", { ascending: true });
    const rows = (data ?? []) as ScheduleRow[];
    const agendaMap = await loadAgendaMap(rows.map((r) => r.id));
    return rows.map((r) => mapSchedule(r, agendaMap.get(r.id) ?? []));
  },

  async upcoming(userId: string, ministryId: string, days = 7): Promise<Schedule[]> {
    const now = new Date();
    const limit = new Date(now.getTime() + days * 86400000);
    const { data } = await supabase
      .from("schedules")
      .select("*")
      .eq("ministry_id", ministryId)
      .gte("date", now.toISOString())
      .lte("date", limit.toISOString())
      .order("date", { ascending: true });
    const rows = (data ?? []) as ScheduleRow[];
    if (rows.length === 0) return [];
    const { data: mine } = await supabase
      .from("schedule_assignments")
      .select("schedule_id")
      .eq("user_id", userId)
      .in("schedule_id", rows.map((r) => r.id));
    const mineSet = new Set((mine ?? []).map((m) => m.schedule_id));
    const agendaMap = await loadAgendaMap(rows.map((r) => r.id));
    return rows.map((r) => ({ ...mapSchedule(r, agendaMap.get(r.id) ?? []), _mine: mineSet.has(r.id) } as Schedule));
  },

  async create(input: {
    ministryId: string;
    title: string;
    date: string;
    description?: string;
    createdBy: string;
    published?: boolean;
    requireConfirmation?: boolean;
    agenda?: ScheduleAgendaItem[];
  }): Promise<Schedule> {
    const { data, error } = await supabase
      .from("schedules")
      .insert({
        ministry_id: input.ministryId,
        title: input.title.trim(),
        date: input.date,
        description: input.description?.trim() || null,
        published: input.published ?? true,
        require_confirmation: input.requireConfirmation ?? false,
        created_by: input.createdBy,
      })
      .select()
      .single();
    if (error || !data) throw new Error(error?.message ?? "Erro ao criar escala.");
    let agenda: ScheduleAgendaItem[] = [];
    if (input.agenda && input.agenda.length > 0) {
      const rows = input.agenda.map((a, idx) => ({
        schedule_id: data.id,
        name: a.name,
        description: a.description ?? null,
        position: idx,
      }));
      const { data: ins } = await supabase.from("schedule_agenda_items").insert(rows).select();
      agenda = (ins ?? []).map((r) => ({ id: r.id, name: r.name, description: r.description ?? undefined }));
    }
    return mapSchedule(data as ScheduleRow, agenda);
  },

  async update(
    scheduleId: string,
    patch: Partial<Pick<Schedule, "title" | "date" | "description" | "agenda" | "published" | "requireConfirmation">>,
  ): Promise<Schedule> {
    const upd: Record<string, unknown> = {};
    if (patch.title !== undefined) upd.title = patch.title;
    if (patch.date !== undefined) upd.date = patch.date;
    if (patch.description !== undefined) upd.description = patch.description ?? null;
    if (patch.published !== undefined) upd.published = patch.published;
    if (patch.requireConfirmation !== undefined) upd.require_confirmation = patch.requireConfirmation;
    const { data, error } = await supabase
      .from("schedules")
      .update(upd)
      .eq("id", scheduleId)
      .select()
      .single();
    if (error || !data) throw new Error(error?.message ?? "Erro ao atualizar.");

    let agenda: ScheduleAgendaItem[] = [];
    if (patch.agenda !== undefined) {
      await supabase.from("schedule_agenda_items").delete().eq("schedule_id", scheduleId);
      if (patch.agenda.length > 0) {
        const rows = patch.agenda.map((a, idx) => ({
          schedule_id: scheduleId,
          name: a.name,
          description: a.description ?? null,
          position: idx,
        }));
        const { data: ins } = await supabase.from("schedule_agenda_items").insert(rows).select();
        agenda = (ins ?? []).map((r) => ({ id: r.id, name: r.name, description: r.description ?? undefined }));
      }
    } else {
      const map = await loadAgendaMap([scheduleId]);
      agenda = map.get(scheduleId) ?? [];
    }
    return mapSchedule(data as ScheduleRow, agenda);
  },

  async remove(scheduleId: string): Promise<void> {
    const { error } = await supabase.from("schedules").delete().eq("id", scheduleId);
    if (error) throw new Error(error.message);
  },

  async getById(scheduleId: string): Promise<Schedule | null> {
    const { data } = await supabase.from("schedules").select("*").eq("id", scheduleId).maybeSingle();
    if (!data) return null;
    const map = await loadAgendaMap([scheduleId]);
    return mapSchedule(data as ScheduleRow, map.get(scheduleId) ?? []);
  },

  async listAssignments(scheduleId: string): Promise<ScheduleAssignment[]> {
    const { data } = await supabase
      .from("schedule_assignments")
      .select("*")
      .eq("schedule_id", scheduleId);
    const rows = data ?? [];
    if (rows.length === 0) return [];
    const userIds = Array.from(new Set(rows.map((r) => r.user_id).filter((x): x is string => !!x)));
    const profileMap = new Map<string, { id: string; name: string; email: string }>();
    if (userIds.length > 0) {
      const { data: ps } = await supabase.from("profiles").select("id, name, email").in("id", userIds);
      (ps ?? []).forEach((p) => profileMap.set(p.id, p));
    }
    return rows.map((r) => ({
      id: r.id,
      scheduleId: r.schedule_id,
      label: r.label,
      userId: r.user_id ?? null,
      user: r.user_id ? (profileMap.get(r.user_id) ?? null) : null,
      status: r.status as ScheduleAssignment["status"],
      attended: r.attended ?? null,
    }));
  },

  async addAssignment(input: {
    scheduleId: string;
    label: string;
    userId?: string | null;
  }): Promise<ScheduleAssignment> {
    const { data, error } = await supabase
      .from("schedule_assignments")
      .insert({
        schedule_id: input.scheduleId,
        label: input.label.trim(),
        user_id: input.userId ?? null,
      })
      .select()
      .single();
    if (error || !data) throw new Error(error?.message ?? "Erro ao adicionar.");
    let user: ScheduleAssignment["user"] = null;
    if (data.user_id) {
      const { data: p } = await supabase
        .from("profiles")
        .select("id, name, email")
        .eq("id", data.user_id)
        .maybeSingle();
      user = p ?? null;
    }
    return {
      id: data.id,
      scheduleId: data.schedule_id,
      label: data.label,
      userId: data.user_id ?? null,
      user,
      status: data.status as ScheduleAssignment["status"],
      attended: data.attended ?? null,
    };
  },

  async removeAssignment(assignmentId: string): Promise<void> {
    const { error } = await supabase.from("schedule_assignments").delete().eq("id", assignmentId);
    if (error) throw new Error(error.message);
  },

  async setAssignmentStatus(
    assignmentId: string,
    status: "pending" | "confirmed" | "declined",
  ): Promise<void> {
    const { error } = await supabase
      .from("schedule_assignments")
      .update({ status })
      .eq("id", assignmentId);
    if (error) throw new Error(error.message);
  },

  async setAttendance(assignmentId: string, attended: boolean): Promise<void> {
    const { error } = await supabase
      .from("schedule_assignments")
      .update({ attended })
      .eq("id", assignmentId);
    if (error) throw new Error(error.message);
  },

  async leaveSchedule(scheduleId: string, userId: string): Promise<void> {
    await supabase
      .from("schedule_assignments")
      .update({ user_id: null, status: "pending" })
      .eq("schedule_id", scheduleId)
      .eq("user_id", userId);
  },
};
