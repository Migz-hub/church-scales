import { delay, readDB, uid, writeDB } from "./db";
import type { Schedule, ScheduleAgendaItem, ScheduleAssignment } from "@/types";

export const scheduleService = {
  async list(ministryId: string): Promise<Schedule[]> {
    await delay(120);
    const db = readDB();
    return db.schedules
      .filter((s) => s.ministryId === ministryId)
      .sort((a, b) => a.date.localeCompare(b.date));
  },

  async upcoming(userId: string, ministryId: string, days = 7): Promise<Schedule[]> {
    const db = readDB();
    const now = new Date();
    const limit = new Date(now.getTime() + days * 86400000);
    const myAssignments = new Set(
      db.assignments.filter((a) => a.userId === userId).map((a) => a.scheduleId),
    );
    return db.schedules
      .filter((s) => s.ministryId === ministryId)
      .filter((s) => {
        const d = new Date(s.date);
        return d >= now && d <= limit;
      })
      .sort((a, b) => a.date.localeCompare(b.date))
      .map((s) => ({ ...s, _mine: myAssignments.has(s.id) } as Schedule));
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
    await delay();
    const db = readDB();
    const schedule: Schedule = {
      id: uid("sch"),
      ministryId: input.ministryId,
      title: input.title.trim(),
      date: input.date,
      description: input.description?.trim() || undefined,
      createdAt: new Date().toISOString(),
      createdBy: input.createdBy,
      published: input.published ?? true,
      requireConfirmation: input.requireConfirmation ?? false,
      agenda: input.agenda ?? [],
    };
    db.schedules.push(schedule);
    writeDB(db);
    return schedule;
  },

  async update(
    scheduleId: string,
    patch: Partial<Pick<Schedule, "title" | "date" | "description" | "agenda" | "published" | "requireConfirmation">>,
  ): Promise<Schedule> {
    await delay();
    const db = readDB();
    const s = db.schedules.find((x) => x.id === scheduleId);
    if (!s) throw new Error("Escala não encontrada.");
    Object.assign(s, patch);
    writeDB(db);
    return s;
  },

  async remove(scheduleId: string): Promise<void> {
    await delay();
    const db = readDB();
    db.schedules = db.schedules.filter((s) => s.id !== scheduleId);
    db.assignments = db.assignments.filter((a) => a.scheduleId !== scheduleId);
    writeDB(db);
  },

  async getById(scheduleId: string): Promise<Schedule | null> {
    const db = readDB();
    return db.schedules.find((s) => s.id === scheduleId) ?? null;
  },

  async listAssignments(scheduleId: string): Promise<ScheduleAssignment[]> {
    await delay(80);
    const db = readDB();
    return db.assignments.filter((a) => a.scheduleId === scheduleId);
  },

  async addAssignment(input: {
    scheduleId: string;
    label: string;
    userId?: string | null;
  }): Promise<ScheduleAssignment> {
    await delay();
    const db = readDB();
    const schedule = db.schedules.find((s) => s.id === input.scheduleId);
    if (!schedule) throw new Error("Escala não encontrada.");
    let user: ScheduleAssignment["user"] = null;
    if (input.userId) {
      const member = db.members.find((m) => m.ministryId === schedule.ministryId && m.userId === input.userId);
      if (!member) throw new Error("Membro não pertence a este ministério.");
      user = member.user;
    }
    const a: ScheduleAssignment = {
      id: uid("asg"),
      scheduleId: input.scheduleId,
      label: input.label.trim(),
      userId: input.userId ?? null,
      user,
    };
    db.assignments.push(a);
    writeDB(db);
    return a;
  },

  async removeAssignment(assignmentId: string): Promise<void> {
    await delay();
    const db = readDB();
    db.assignments = db.assignments.filter((a) => a.id !== assignmentId);
    writeDB(db);
  },

  async setAssignmentStatus(
    assignmentId: string,
    status: "pending" | "confirmed" | "declined",
  ): Promise<void> {
    await delay(120);
    const db = readDB();
    const a = db.assignments.find((x) => x.id === assignmentId);
    if (!a) throw new Error("Atribuição não encontrada.");
    a.status = status;
    writeDB(db);
  },

  async setAttendance(assignmentId: string, attended: boolean): Promise<void> {
    await delay(60);
    const db = readDB();
    const a = db.assignments.find((x) => x.id === assignmentId);
    if (!a) throw new Error("Atribuição não encontrada.");
    a.attended = attended;
    writeDB(db);
  },

  async leaveSchedule(scheduleId: string, userId: string): Promise<void> {
    await delay();
    const db = readDB();
    db.assignments = db.assignments.filter(
      (a) => !(a.scheduleId === scheduleId && a.userId === userId),
    );
    writeDB(db);
  },
};