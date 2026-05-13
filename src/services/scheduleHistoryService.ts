import { delay, readDB, uid, writeDB } from "./db";
import type { ScheduleHistoryEntry } from "@/types";

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

function pruneExpired(): void {
  const db = readDB();
  const now = Date.now();
  const before = (db.scheduleHistory ?? []).length;
  db.scheduleHistory = (db.scheduleHistory ?? []).filter((e) => {
    const dt = new Date(e.scheduleDate).getTime();
    if (Number.isNaN(dt)) return true;
    return dt + WEEK_MS > now;
  });
  if ((db.scheduleHistory ?? []).length !== before) writeDB(db);
}

export const scheduleHistoryService = {
  async list(scheduleId: string): Promise<ScheduleHistoryEntry[]> {
    pruneExpired();
    await delay(60);
    const db = readDB();
    return (db.scheduleHistory ?? [])
      .filter((e) => e.scheduleId === scheduleId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  },

  async add(
    input: Omit<ScheduleHistoryEntry, "id" | "createdAt">,
  ): Promise<ScheduleHistoryEntry> {
    const db = readDB();
    db.scheduleHistory ??= [];
    const entry: ScheduleHistoryEntry = {
      ...input,
      id: uid("hst"),
      createdAt: new Date().toISOString(),
    };
    db.scheduleHistory.push(entry);
    writeDB(db);
    return entry;
  },

  /** Logs an unavailability event on every schedule (in given ministry) overlapping the date range. */
  async logUnavailabilityForOverlapping(input: {
    ministryId: string;
    actorId: string;
    actorName: string;
    targetUserName: string;
    startsAt: string;
    endsAt: string;
  }): Promise<void> {
    const db = readDB();
    db.scheduleHistory ??= [];
    const start = new Date(input.startsAt).getTime();
    const end = new Date(input.endsAt).getTime();
    const matches = db.schedules.filter((s) => {
      if (s.ministryId !== input.ministryId) return false;
      const sd = new Date(s.date).getTime();
      return sd >= start && sd <= end + 86_399_999;
    });
    for (const s of matches) {
      const entry: ScheduleHistoryEntry = {
        id: uid("hst"),
        ministryId: s.ministryId,
        scheduleId: s.id,
        scheduleDate: s.date,
        createdAt: new Date().toISOString(),
        actorId: input.actorId,
        actorName: input.actorName,
        kind: "unavailability",
        summary: `${input.targetUserName} informou estar indisponível.`,
      };
      db.scheduleHistory.push(entry);
    }
    if (matches.length > 0) writeDB(db);
  },
};