export type Role = "owner" | "admin" | "leader" | "member";

export interface User {
  id: string;
  name: string;
  email: string;
  createdAt: string;
}

export interface Ministry {
  id: string;
  name: string;
  inviteCode: string;
  invitesEnabled: boolean;
  ownerId: string;
  createdAt: string;
}

export interface MinistryMember {
  id: string;
  ministryId: string;
  userId: string;
  role: Role;
  user: Pick<User, "id" | "name" | "email">;
  joinedAt: string;
}

export interface Schedule {
  id: string;
  ministryId: string;
  title: string;
  date: string; // ISO
  description?: string;
  createdAt: string;
  createdBy: string;
  published?: boolean;
  requireConfirmation?: boolean;
  agenda?: ScheduleAgendaItem[];
}

export interface ScheduleAgendaItem {
  id: string;
  name: string;
  description?: string;
}

export interface ScheduleAssignment {
  id: string;
  scheduleId: string;
  label: string; // ex: "Vocal", "Som"
  userId?: string | null;
  user?: Pick<User, "id" | "name" | "email"> | null;
  status?: AssignmentStatus;
  attended?: boolean | null;
}

export type AssignmentStatus = "pending" | "confirmed" | "declined";

export interface ChatMessage {
  id: string;
  ministryId: string;
  userId: string;
  user: Pick<User, "id" | "name">;
  content: string;
  createdAt: string;
}

export type NotificationType =
  | "joined_ministry"
  | "added_to_schedule"
  | "schedule_created"
  | "schedule_updated"
  | "join_request"
  | "join_request_approved"
  | "join_request_rejected";

export interface AppNotification {
  id: string;
  userId: string;
  ministryId?: string;
  type: NotificationType;
  title: string;
  body?: string;
  read: boolean;
  createdAt: string;
}

export interface MinistryFunction {
  id: string;
  ministryId: string;
  name: string;
  icon?: string;
  active: boolean;
}

export interface MinistryTeam {
  id: string;
  ministryId: string;
  name: string;
  functionIds: string[];
}

export type PermissionKey =
  | "schedule.create"
  | "schedule.edit"
  | "schedule.delete"
  | "agenda.edit"
  | "participants.manage"
  | "function.create"
  | "function.edit"
  | "function.delete"
  | "function.assign";

export interface MemberPermissions {
  ministryId: string;
  memberId: string;
  overrides: Partial<Record<PermissionKey, boolean>>;
  functionIds: string[];
}

export interface MinistryDefaults {
  ministryId: string;
  description?: string;
  bannerUrl?: string;
  avatarUrl?: string;
  permissions: Partial<Record<PermissionKey, boolean>>;
}

export type AnnouncementPriority = "normal" | "important" | "urgent";

export type AnnouncementAudience =
  | { kind: "all" }
  | { kind: "admins" }
  | { kind: "team"; teamId: string }
  | { kind: "function"; functionId: string };

export interface Announcement {
  id: string;
  ministryId: string;
  title: string;
  message: string;
  priority: AnnouncementPriority;
  audience: AnnouncementAudience;
  createdAt: string;
  scheduledAt?: string;
  createdBy: string;
  createdByName: string;
}

export interface AnnouncementRead {
  announcementId: string;
  userId: string;
  readAt: string;
}

export interface Unavailability {
  id: string;
  ministryId: string;
  userId: string;
  user: Pick<User, "id" | "name" | "email">;
  description?: string;
  startsAt: string; // ISO
  endsAt: string; // ISO
  createdAt: string;
  createdBy: string;
}

export type ScheduleHistoryKind =
  | "created"
  | "updated"
  | "unavailability"
  | "attendance";

export interface ScheduleHistoryChange {
  field: string;
  before?: string;
  after?: string;
}

export interface ScheduleHistoryEntry {
  id: string;
  ministryId: string;
  scheduleId: string;
  scheduleDate: string; // for pruning
  createdAt: string;
  actorId: string;
  actorName: string;
  kind: ScheduleHistoryKind;
  summary?: string;
  changes?: ScheduleHistoryChange[];
  addedMembers?: { name: string; label?: string }[];
  removedMembers?: { name: string; label?: string }[];
  details?: Record<string, string | undefined>;
}

export type JoinRequestStatus = "pending" | "approved" | "rejected";

export interface MinistryJoinRequest {
  id: string;
  ministryId: string;
  userId: string;
  userName: string;
  userEmail: string;
  status: JoinRequestStatus;
  createdAt: string;
  decidedAt?: string;
  decidedBy?: string;
}