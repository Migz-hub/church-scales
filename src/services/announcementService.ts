import { delay, readDB, uid, writeDB } from "./db";
import type {
  Announcement,
  AnnouncementAudience,
  AnnouncementPriority,
} from "@/types";

export interface AnnouncementWithRead extends Announcement {
  read: boolean;
}

function memberMatchesAudience(
  audience: AnnouncementAudience,
  ctx: {
    role: string | null;
    functionIds: string[];
    teamIds: string[];
  },
): boolean {
  switch (audience.kind) {
    case "all":
      return true;
    case "admins":
      return ctx.role === "owner" || ctx.role === "admin";
    case "function":
      return ctx.functionIds.includes(audience.functionId);
    case "team":
      return ctx.teamIds.includes(audience.teamId);
    default:
      return false;
  }
}

function userContext(ministryId: string, userId: string) {
  const db = readDB();
  const member = db.members.find(
    (m) => m.ministryId === ministryId && m.userId === userId,
  );
  if (!member) return null;
  const mp = db.memberPermissions?.find(
    (x) => x.ministryId === ministryId && x.memberId === member.id,
  );
  const functionIds = mp?.functionIds ?? [];
  const teamIds = (db.teams ?? [])
    .filter((t) => t.ministryId === ministryId)
    .filter((t) => t.functionIds.some((fid) => functionIds.includes(fid)))
    .map((t) => t.id);
  return { role: member.role, functionIds, teamIds };
}

export const announcementService = {
  async list(ministryId: string, userId: string): Promise<AnnouncementWithRead[]> {
    await delay(80);
    const db = readDB();
    const ctx = userContext(ministryId, userId);
    if (!ctx) return [];
    const now = Date.now();
    const reads = new Set(
      (db.announcementReads ?? [])
        .filter((r) => r.userId === userId)
        .map((r) => r.announcementId),
    );
    return (db.announcements ?? [])
      .filter((a) => a.ministryId === ministryId)
      .filter((a) => !a.scheduledAt || new Date(a.scheduledAt).getTime() <= now)
      .filter((a) => memberMatchesAudience(a.audience, ctx))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .map((a) => ({ ...a, read: reads.has(a.id) }));
  },

  async unreadCount(ministryId: string, userId: string): Promise<number> {
    const list = await this.list(ministryId, userId);
    return list.filter((a) => !a.read).length;
  },

  async create(input: {
    ministryId: string;
    title: string;
    message: string;
    priority: AnnouncementPriority;
    audience: AnnouncementAudience;
    createdBy: string;
    createdByName: string;
    scheduledAt?: string;
  }): Promise<Announcement> {
    await delay();
    const db = readDB();
    const a: Announcement = {
      id: uid("ann"),
      ministryId: input.ministryId,
      title: input.title.trim(),
      message: input.message.trim(),
      priority: input.priority,
      audience: input.audience,
      createdAt: new Date().toISOString(),
      scheduledAt: input.scheduledAt,
      createdBy: input.createdBy,
      createdByName: input.createdByName,
    };
    db.announcements = db.announcements ?? [];
    db.announcements.push(a);
    writeDB(db);
    return a;
  },

  async update(id: string, patch: Partial<Pick<Announcement, "title" | "message" | "priority" | "audience" | "scheduledAt">>): Promise<void> {
    await delay();
    const db = readDB();
    const a = db.announcements?.find((x) => x.id === id);
    if (!a) throw new Error("Aviso não encontrado.");
    Object.assign(a, patch);
    writeDB(db);
  },

  async remove(id: string): Promise<void> {
    await delay();
    const db = readDB();
    db.announcements = (db.announcements ?? []).filter((a) => a.id !== id);
    db.announcementReads = (db.announcementReads ?? []).filter((r) => r.announcementId !== id);
    writeDB(db);
  },

  async markRead(announcementId: string, userId: string): Promise<void> {
    const db = readDB();
    db.announcementReads = db.announcementReads ?? [];
    if (
      !db.announcementReads.some(
        (r) => r.announcementId === announcementId && r.userId === userId,
      )
    ) {
      db.announcementReads.push({
        announcementId,
        userId,
        readAt: new Date().toISOString(),
      });
      writeDB(db);
    }
  },

  async markAllRead(ministryId: string, userId: string): Promise<void> {
    const list = await this.list(ministryId, userId);
    const db = readDB();
    db.announcementReads = db.announcementReads ?? [];
    const now = new Date().toISOString();
    for (const a of list) {
      if (
        !db.announcementReads.some(
          (r) => r.announcementId === a.id && r.userId === userId,
        )
      ) {
        db.announcementReads.push({
          announcementId: a.id,
          userId,
          readAt: now,
        });
      }
    }
    writeDB(db);
  },
};
