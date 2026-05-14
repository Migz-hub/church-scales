import { supabase } from "@/integrations/supabase/client";
import type {
  Announcement,
  AnnouncementAudience,
  AnnouncementPriority,
} from "@/types";

export interface AnnouncementWithRead extends Announcement {
  read: boolean;
}

type Row = {
  id: string;
  ministry_id: string;
  title: string;
  message: string;
  priority: AnnouncementPriority;
  audience_kind: "all" | "admins" | "team" | "function";
  audience_team_id: string | null;
  audience_function_id: string | null;
  scheduled_at: string | null;
  created_by: string;
  created_at: string;
};

function rowToAudience(r: Row): AnnouncementAudience {
  switch (r.audience_kind) {
    case "all":
      return { kind: "all" };
    case "admins":
      return { kind: "admins" };
    case "team":
      return { kind: "team", teamId: r.audience_team_id ?? "" };
    case "function":
      return { kind: "function", functionId: r.audience_function_id ?? "" };
  }
}

function audienceToCols(a: AnnouncementAudience) {
  return {
    audience_kind: a.kind,
    audience_team_id: a.kind === "team" ? a.teamId : null,
    audience_function_id: a.kind === "function" ? a.functionId : null,
  };
}

function map(r: Row, createdByName: string): Announcement {
  return {
    id: r.id,
    ministryId: r.ministry_id,
    title: r.title,
    message: r.message,
    priority: r.priority,
    audience: rowToAudience(r),
    createdAt: r.created_at,
    scheduledAt: r.scheduled_at ?? undefined,
    createdBy: r.created_by,
    createdByName,
  };
}

function memberMatchesAudience(
  audience: AnnouncementAudience,
  ctx: { role: string | null; functionIds: string[]; teamIds: string[] },
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
  }
}

async function userContext(ministryId: string, userId: string) {
  const { data: member } = await supabase
    .from("ministry_members")
    .select("id")
    .eq("ministry_id", ministryId)
    .eq("user_id", userId)
    .maybeSingle();
  if (!member) return null;

  const { data: roles } = await supabase
    .from("user_roles")
    .select("role")
    .eq("ministry_id", ministryId)
    .eq("user_id", userId);
  const roleList = (roles ?? []).map((r) => r.role);
  let role: string | null = "member";
  if (roleList.includes("owner")) role = "owner";
  else if (roleList.includes("admin")) role = "admin";
  else if (roleList.includes("leader")) role = "leader";

  const { data: perms } = await supabase
    .from("member_permissions")
    .select("function_ids")
    .eq("ministry_id", ministryId)
    .eq("member_id", member.id)
    .maybeSingle();
  const functionIds: string[] = (perms?.function_ids ?? []) as string[];

  let teamIds: string[] = [];
  if (functionIds.length > 0) {
    const { data: tfs } = await supabase
      .from("ministry_team_functions")
      .select("team_id, ministry_teams!inner(ministry_id)")
      .in("function_id", functionIds);
    teamIds = Array.from(
      new Set(
        (tfs ?? [])
          .filter((t) => (t.ministry_teams as unknown as { ministry_id: string })?.ministry_id === ministryId)
          .map((t) => t.team_id as string),
      ),
    );
  }
  return { role, functionIds, teamIds };
}

async function profileNameMap(ids: string[]): Promise<Map<string, string>> {
  if (ids.length === 0) return new Map();
  const { data } = await supabase.from("profiles").select("id, name").in("id", ids);
  return new Map((data ?? []).map((p) => [p.id, p.name]));
}

export const announcementService = {
  async list(ministryId: string, userId: string): Promise<AnnouncementWithRead[]> {
    const ctx = await userContext(ministryId, userId);
    if (!ctx) return [];
    const { data } = await supabase
      .from("announcements")
      .select("*")
      .eq("ministry_id", ministryId)
      .order("created_at", { ascending: false });
    const rows = (data ?? []) as Row[];
    if (rows.length === 0) return [];

    const { data: reads } = await supabase
      .from("announcement_reads")
      .select("announcement_id")
      .eq("user_id", userId);
    const readSet = new Set((reads ?? []).map((r) => r.announcement_id));

    const nameMap = await profileNameMap(Array.from(new Set(rows.map((r) => r.created_by))));

    const now = Date.now();
    return rows
      .filter((r) => !r.scheduled_at || new Date(r.scheduled_at).getTime() <= now)
      .filter((r) => memberMatchesAudience(rowToAudience(r), ctx))
      .map((r) => ({ ...map(r, nameMap.get(r.created_by) ?? ""), read: readSet.has(r.id) }));
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
    const { data, error } = await supabase
      .from("announcements")
      .insert({
        ministry_id: input.ministryId,
        title: input.title.trim(),
        message: input.message.trim(),
        priority: input.priority,
        ...audienceToCols(input.audience),
        scheduled_at: input.scheduledAt ?? null,
        created_by: input.createdBy,
      })
      .select()
      .single();
    if (error || !data) throw new Error(error?.message ?? "Erro ao criar aviso.");
    return map(data as Row, input.createdByName);
  },

  async update(
    id: string,
    patch: Partial<Pick<Announcement, "title" | "message" | "priority" | "audience" | "scheduledAt">>,
  ): Promise<void> {
    const upd: Record<string, unknown> = {};
    if (patch.title !== undefined) upd.title = patch.title;
    if (patch.message !== undefined) upd.message = patch.message;
    if (patch.priority !== undefined) upd.priority = patch.priority;
    if (patch.audience !== undefined) Object.assign(upd, audienceToCols(patch.audience));
  async update(
    id: string,
    patch: Partial<Pick<Announcement, "title" | "message" | "priority" | "audience" | "scheduledAt">>,
  ): Promise<void> {
    const upd: Record<string, unknown> = {};
    if (patch.title !== undefined) upd.title = patch.title;
    if (patch.message !== undefined) upd.message = patch.message;
    if (patch.priority !== undefined) upd.priority = patch.priority;
    if (patch.audience !== undefined) Object.assign(upd, audienceToCols(patch.audience));
    if (patch.scheduledAt !== undefined) upd.scheduled_at = patch.scheduledAt ?? null;
    const { error } = await supabase.from("announcements").update(upd as never).eq("id", id);
    if (error) throw new Error(error.message);
  },

  async remove(id: string): Promise<void> {
    const { error } = await supabase.from("announcements").delete().eq("id", id);
    if (error) throw new Error(error.message);
  },

  async markRead(announcementId: string, userId: string): Promise<void> {
    await supabase
      .from("announcement_reads")
      .upsert({ announcement_id: announcementId, user_id: userId }, { onConflict: "announcement_id,user_id" });
  },

  async markAllRead(ministryId: string, userId: string): Promise<void> {
    const list = await this.list(ministryId, userId);
    const rows = list
      .filter((a) => !a.read)
      .map((a) => ({ announcement_id: a.id, user_id: userId }));
    if (rows.length === 0) return;
    await supabase
      .from("announcement_reads")
      .upsert(rows, { onConflict: "announcement_id,user_id" });
  },
};
