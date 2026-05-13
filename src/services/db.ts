/**
 * In-memory + localStorage mock "database".
 * Designed so services have a stable shape; swap with Supabase queries later.
 */
import type {
  AppNotification,
  ChatMessage,
  Ministry,
  MinistryMember,
  Schedule,
  ScheduleAssignment,
  User,
  MinistryFunction,
  MinistryTeam,
  MemberPermissions,
  MinistryDefaults,
  Announcement,
  AnnouncementRead,
  Unavailability,
  ScheduleHistoryEntry,
  MinistryJoinRequest,
} from "@/types";
import { STORAGE_KEYS, storage } from "@/lib/storage";

interface DBShape {
  users: (User & { passwordHash: string })[];
  ministries: Ministry[];
  members: MinistryMember[];
  schedules: Schedule[];
  assignments: ScheduleAssignment[];
  messages: ChatMessage[];
  notifications: AppNotification[];
  functions?: MinistryFunction[];
  teams?: MinistryTeam[];
  memberPermissions?: MemberPermissions[];
  ministryDefaults?: MinistryDefaults[];
  announcements?: Announcement[];
  announcementReads?: AnnouncementRead[];
  unavailabilities?: Unavailability[];
  scheduleHistory?: ScheduleHistoryEntry[];
  joinRequests?: MinistryJoinRequest[];
}

const empty: DBShape = {
  users: [],
  ministries: [],
  members: [],
  schedules: [],
  assignments: [],
  messages: [],
  notifications: [],
  functions: [],
  teams: [],
  memberPermissions: [],
  ministryDefaults: [],
  announcements: [],
  announcementReads: [],
  unavailabilities: [],
  scheduleHistory: [],
  joinRequests: [],
};

export function readDB(): DBShape {
  const db = storage.get<DBShape>(STORAGE_KEYS.db, empty);
  db.functions ??= [];
  db.teams ??= [];
  db.memberPermissions ??= [];
  db.ministryDefaults ??= [];
  db.announcements ??= [];
  db.announcementReads ??= [];
  db.unavailabilities ??= [];
  db.scheduleHistory ??= [];
  db.joinRequests ??= [];
  return db;
}

export function writeDB(db: DBShape) {
  storage.set(STORAGE_KEYS.db, db);
}

export function uid(prefix = "id") {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36)}`;
}

/** Tiny artificial latency to mimic network calls. */
export const delay = (ms = 250) => new Promise((r) => setTimeout(r, ms));

/** Naive password hash for prototype only. Replace with real auth (Supabase). */
export function hashPassword(plain: string) {
  let h = 0;
  for (let i = 0; i < plain.length; i++) h = (h << 5) - h + plain.charCodeAt(i);
  return `mock$${h.toString(36)}`;
}