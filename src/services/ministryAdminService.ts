import { supabase } from "@/integrations/supabase/client";
import type {
  MemberPermissions,
  MinistryDefaults,
  MinistryFunction,
  MinistryTeam,
  PermissionKey,
} from "@/types";

const DEFAULT_PERMISSIONS: Record<PermissionKey, boolean> = {
  "schedule.create": false,
  "schedule.edit": false,
  "schedule.delete": false,
  "agenda.edit": false,
  "participants.manage": false,
  "function.create": false,
  "function.edit": false,
  "function.delete": false,
  "function.assign": false,
};

export const ministryAdminService = {
  // ---------- Defaults / Info ----------
  async getDefaults(ministryId: string): Promise<MinistryDefaults> {
    const { data } = await supabase
      .from("ministries")
      .select("description, banner_url, avatar_url, default_permissions")
      .eq("id", ministryId)
      .maybeSingle();
    return {
      ministryId,
      description: data?.description ?? undefined,
      bannerUrl: data?.banner_url ?? undefined,
      avatarUrl: data?.avatar_url ?? undefined,
      permissions: { ...DEFAULT_PERMISSIONS, ...(data?.default_permissions as Record<string, boolean> ?? {}) },
    };
  },

  async updateDefaults(ministryId: string, patch: Partial<MinistryDefaults>): Promise<MinistryDefaults> {
    const upd: Record<string, unknown> = {};
    if (patch.description !== undefined) upd.description = patch.description ?? null;
    if (patch.bannerUrl !== undefined) upd.banner_url = patch.bannerUrl ?? null;
    if (patch.avatarUrl !== undefined) upd.avatar_url = patch.avatarUrl ?? null;
    if (patch.permissions !== undefined) upd.default_permissions = patch.permissions;
    if (Object.keys(upd).length > 0) {
      const { error } = await supabase.from("ministries").update(upd).eq("id", ministryId);
      if (error) throw new Error(error.message);
    }
    return this.getDefaults(ministryId);
  },

  // ---------- Functions ----------
  async listFunctions(ministryId: string): Promise<MinistryFunction[]> {
    const { data } = await supabase
      .from("ministry_functions")
      .select("*")
      .eq("ministry_id", ministryId);
    return (data ?? []).map((f) => ({
      id: f.id,
      ministryId: f.ministry_id,
      name: f.name,
      icon: f.icon ?? undefined,
      active: f.active,
    }));
  },

  async createFunction(ministryId: string, input: { name: string; icon?: string }): Promise<MinistryFunction> {
    const { data, error } = await supabase
      .from("ministry_functions")
      .insert({
        ministry_id: ministryId,
        name: input.name.trim(),
        icon: input.icon ?? null,
      })
      .select()
      .single();
    if (error || !data) throw new Error(error?.message ?? "Erro ao criar função.");
    return {
      id: data.id,
      ministryId: data.ministry_id,
      name: data.name,
      icon: data.icon ?? undefined,
      active: data.active,
    };
  },

  async updateFunction(id: string, patch: Partial<MinistryFunction>): Promise<void> {
    const upd: Record<string, unknown> = {};
    if (patch.name !== undefined) upd.name = patch.name;
    if (patch.icon !== undefined) upd.icon = patch.icon ?? null;
    if (patch.active !== undefined) upd.active = patch.active;
    const { error } = await supabase.from("ministry_functions").update(upd).eq("id", id);
    if (error) throw new Error(error.message);
  },

  async deleteFunction(id: string): Promise<void> {
    const { error } = await supabase.from("ministry_functions").delete().eq("id", id);
    if (error) throw new Error(error.message);
  },

  // ---------- Teams ----------
  async listTeams(ministryId: string): Promise<MinistryTeam[]> {
    const { data: teams } = await supabase
      .from("ministry_teams")
      .select("*")
      .eq("ministry_id", ministryId);
    const list = teams ?? [];
    if (list.length === 0) return [];
    const { data: links } = await supabase
      .from("ministry_team_functions")
      .select("team_id, function_id")
      .in("team_id", list.map((t) => t.id));
    const fnMap = new Map<string, string[]>();
    (links ?? []).forEach((l) => {
      const arr = fnMap.get(l.team_id) ?? [];
      arr.push(l.function_id);
      fnMap.set(l.team_id, arr);
    });
    return list.map((t) => ({
      id: t.id,
      ministryId: t.ministry_id,
      name: t.name,
      functionIds: fnMap.get(t.id) ?? [],
    }));
  },

  async createTeam(ministryId: string, name: string, functionIds: string[] = []): Promise<MinistryTeam> {
    const { data, error } = await supabase
      .from("ministry_teams")
      .insert({ ministry_id: ministryId, name: name.trim() })
      .select()
      .single();
    if (error || !data) throw new Error(error?.message ?? "Erro ao criar equipe.");
    if (functionIds.length > 0) {
      await supabase
        .from("ministry_team_functions")
        .insert(functionIds.map((fid) => ({ team_id: data.id, function_id: fid })));
    }
    return { id: data.id, ministryId: data.ministry_id, name: data.name, functionIds };
  },

  async updateTeam(id: string, patch: Partial<MinistryTeam>): Promise<void> {
    if (patch.name !== undefined) {
      const { error } = await supabase.from("ministry_teams").update({ name: patch.name }).eq("id", id);
      if (error) throw new Error(error.message);
    }
    if (patch.functionIds !== undefined) {
      await supabase.from("ministry_team_functions").delete().eq("team_id", id);
      if (patch.functionIds.length > 0) {
        await supabase
          .from("ministry_team_functions")
          .insert(patch.functionIds.map((fid) => ({ team_id: id, function_id: fid })));
      }
    }
  },

  async deleteTeam(id: string): Promise<void> {
    const { error } = await supabase.from("ministry_teams").delete().eq("id", id);
    if (error) throw new Error(error.message);
  },

  // ---------- Member Permissions ----------
  async getMemberConfig(ministryId: string, memberId: string): Promise<MemberPermissions> {
    const { data } = await supabase
      .from("member_permissions")
      .select("*")
      .eq("ministry_id", ministryId)
      .eq("member_id", memberId)
      .maybeSingle();
    return {
      ministryId,
      memberId,
      overrides: (data?.overrides as Partial<Record<PermissionKey, boolean>>) ?? {},
      functionIds: (data?.function_ids as string[]) ?? [],
    };
  },

  async updateMemberConfig(
    ministryId: string,
    memberId: string,
    patch: Partial<Pick<MemberPermissions, "overrides" | "functionIds">>,
  ): Promise<MemberPermissions> {
    const upd: Record<string, unknown> = {
      ministry_id: ministryId,
      member_id: memberId,
    };
    if (patch.overrides !== undefined) upd.overrides = patch.overrides;
    if (patch.functionIds !== undefined) upd.function_ids = patch.functionIds;
    const { error } = await supabase
      .from("member_permissions")
      .upsert(upd, { onConflict: "ministry_id,member_id" });
    if (error) throw new Error(error.message);
    return this.getMemberConfig(ministryId, memberId);
  },
};

export const PERMISSION_LABELS: Record<PermissionKey, string> = {
  "schedule.create": "Criar escalas",
  "schedule.edit": "Editar escalas",
  "schedule.delete": "Excluir escalas",
  "agenda.edit": "Editar roteiro",
  "participants.manage": "Gerenciar participantes",
  "function.create": "Criar funções",
  "function.edit": "Editar funções",
  "function.delete": "Excluir funções",
  "function.assign": "Atribuir funções",
};

export { DEFAULT_PERMISSIONS };
