import { delay, readDB, uid, writeDB } from "./db";
import type { Unavailability } from "@/types";

export const unavailabilityService = {
  async list(ministryId: string): Promise<Unavailability[]> {
    await delay(80);
    const db = readDB();
    return (db.unavailabilities ?? [])
      .filter((u) => u.ministryId === ministryId)
      .sort((a, b) => a.startsAt.localeCompare(b.startsAt));
  },

  async create(input: {
    ministryId: string;
    userIds: string[];
    description?: string;
    startsAt: string;
    endsAt: string;
    createdBy: string;
  }): Promise<Unavailability[]> {
    await delay();
    const db = readDB();
    db.unavailabilities ??= [];
    const created: Unavailability[] = [];
    for (const userId of input.userIds) {
      const member = db.members.find(
        (m) => m.ministryId === input.ministryId && m.userId === userId,
      );
      if (!member) continue;
      const u: Unavailability = {
        id: uid("una"),
        ministryId: input.ministryId,
        userId,
        user: member.user,
        description: input.description?.trim() || undefined,
        startsAt: input.startsAt,
        endsAt: input.endsAt,
        createdAt: new Date().toISOString(),
        createdBy: input.createdBy,
      };
      db.unavailabilities.push(u);
      created.push(u);
    }
    writeDB(db);
    return created;
  },

  async remove(id: string): Promise<void> {
    await delay();
    const db = readDB();
    db.unavailabilities = (db.unavailabilities ?? []).filter((u) => u.id !== id);
    writeDB(db);
  },

  async update(
    id: string,
    patch: { description?: string; startsAt?: string; endsAt?: string },
  ): Promise<Unavailability | null> {
    await delay();
    const db = readDB();
    const u = (db.unavailabilities ?? []).find((x) => x.id === id);
    if (!u) return null;
    if (patch.description !== undefined) u.description = patch.description.trim() || undefined;
    if (patch.startsAt) u.startsAt = patch.startsAt;
    if (patch.endsAt) u.endsAt = patch.endsAt;
    writeDB(db);
    return u;
  },
};