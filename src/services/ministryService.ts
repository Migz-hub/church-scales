import { supabase } from "@/integrations/supabase/client";
import type { Ministry, MinistryMember, MinistryJoinRequest, Role } from "@/types";

function genCode(): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 6; i++) code += alphabet[Math.floor(Math.random() * alphabet.length)];
  return code;
}

type MinistryRow = {
  id: string;
  name: string;
  invite_code: string;
  invites_enabled: boolean;
  owner_id: string;
  created_at: string;
};

function mapMinistry(m: MinistryRow): Ministry {
  return {
    id: m.id,
    name: m.name,
    inviteCode: m.invite_code,
    invitesEnabled: m.invites_enabled,
    ownerId: m.owner_id,
    createdAt: m.created_at,
  };
}

async function getRoleFor(userId: string, ministryId: string): Promise<Role> {
  const { data } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("ministry_id", ministryId);
  const roles = (data ?? []).map((r) => r.role as Role);
  if (roles.includes("owner")) return "owner";
  if (roles.includes("admin")) return "admin";
  if (roles.includes("leader")) return "leader";
  return "member";
}

export const ministryService = {
  async listForUser(userId: string): Promise<Ministry[]> {
    const { data: memberships } = await supabase
      .from("ministry_members")
      .select("ministry_id")
      .eq("user_id", userId);
    const ids = (memberships ?? []).map((m) => m.ministry_id);
    if (ids.length === 0) return [];
    const { data } = await supabase.from("ministries").select("*").in("id", ids);
    return (data ?? []).map(mapMinistry);
  },

  async getMembership(ministryId: string, userId: string): Promise<MinistryMember | null> {
    const { data: row } = await supabase
      .from("ministry_members")
      .select("id, ministry_id, user_id, joined_at")
      .eq("ministry_id", ministryId)
      .eq("user_id", userId)
      .maybeSingle();
    if (!row) return null;
    const { data: profile } = await supabase
      .from("profiles")
      .select("id, name, email")
      .eq("id", userId)
      .maybeSingle();
    const role = await getRoleFor(userId, ministryId);
    return {
      id: row.id,
      ministryId: row.ministry_id,
      userId: row.user_id,
      role,
      user: { id: profile?.id ?? userId, name: profile?.name ?? "", email: profile?.email ?? "" },
      joinedAt: row.joined_at,
    };
  },

  async listMembers(ministryId: string): Promise<MinistryMember[]> {
    const { data: members } = await supabase
      .from("ministry_members")
      .select("id, ministry_id, user_id, joined_at")
      .eq("ministry_id", ministryId);
    if (!members || members.length === 0) return [];
    const userIds = members.map((m) => m.user_id);
    const [{ data: profiles }, { data: roles }] = await Promise.all([
      supabase.from("profiles").select("id, name, email").in("id", userIds),
      supabase.from("user_roles").select("user_id, role").eq("ministry_id", ministryId).in("user_id", userIds),
    ]);
    const profileMap = new Map((profiles ?? []).map((p) => [p.id, p]));
    const rolesByUser = new Map<string, Role[]>();
    (roles ?? []).forEach((r) => {
      const arr = rolesByUser.get(r.user_id) ?? [];
      arr.push(r.role as Role);
      rolesByUser.set(r.user_id, arr);
    });
    return members.map((m) => {
      const userRoles = rolesByUser.get(m.user_id) ?? [];
      let role: Role = "member";
      if (userRoles.includes("owner")) role = "owner";
      else if (userRoles.includes("admin")) role = "admin";
      else if (userRoles.includes("leader")) role = "leader";
      const p = profileMap.get(m.user_id);
      return {
        id: m.id,
        ministryId: m.ministry_id,
        userId: m.user_id,
        role,
        user: { id: m.user_id, name: p?.name ?? "", email: p?.email ?? "" },
        joinedAt: m.joined_at,
      };
    });
  },

  async create(input: {
    name: string;
    userId: string;
    userName: string;
    userEmail: string;
    functions?: { name: string; icon?: string }[];
  }): Promise<Ministry> {
    const { data, error } = await supabase
      .from("ministries")
      .insert({
        name: input.name.trim(),
        invite_code: genCode(),
        invites_enabled: true,
        owner_id: input.userId,
      })
      .select()
      .single();
    if (error || !data) throw new Error(error?.message ?? "Erro ao criar ministério.");
    // Add creator as member + owner role
    await supabase.from("ministry_members").insert({
      ministry_id: data.id,
      user_id: input.userId,
    });
    await supabase.from("user_roles").insert({
      ministry_id: data.id,
      user_id: input.userId,
      role: "owner",
    });
    if (input.functions && input.functions.length > 0) {
      const rows = input.functions
        .map((f) => f.name.trim())
        .filter(Boolean)
        .map((name, idx) => ({
          ministry_id: data.id,
          name,
          icon: input.functions![idx].icon,
        }));
      if (rows.length > 0) {
        await supabase.from("ministry_functions").insert(rows);
      }
    }
    return mapMinistry(data);
  },

  async requestJoin(input: { code: string; userId: string; userName: string; userEmail: string }): Promise<{
    ministry: Ministry;
    request: MinistryJoinRequest;
    notify: { userId: string; ministryId: string; type: "join_request"; title: string; body?: string }[];
  }> {
    const code = input.code.trim().toUpperCase();
    const { data: ministry } = await supabase
      .from("ministries")
      .select("*")
      .eq("invite_code", code)
      .maybeSingle();
    if (!ministry) throw new Error("Código de convite inválido.");
    if (!ministry.invites_enabled) throw new Error("Convites desativados para este ministério.");

    const { data: existingMember } = await supabase
      .from("ministry_members")
      .select("id")
      .eq("ministry_id", ministry.id)
      .eq("user_id", input.userId)
      .maybeSingle();
    if (existingMember) throw new Error("Você já faz parte deste ministério.");

    const { data: existingReq } = await supabase
      .from("ministry_join_requests")
      .select("id")
      .eq("ministry_id", ministry.id)
      .eq("user_id", input.userId)
      .eq("status", "pending")
      .maybeSingle();
    if (existingReq) throw new Error("Você já enviou uma solicitação. Aguarde a aprovação.");

    const { data: req, error } = await supabase
      .from("ministry_join_requests")
      .insert({
        ministry_id: ministry.id,
        user_id: input.userId,
        status: "pending",
      })
      .select()
      .single();
    if (error || !req) throw new Error(error?.message ?? "Erro ao solicitar.");

    // Find admins/owners to notify
    const { data: adminRoles } = await supabase
      .from("user_roles")
      .select("user_id")
      .eq("ministry_id", ministry.id)
      .in("role", ["owner", "admin"]);

    const notify = (adminRoles ?? []).map((a) => ({
      userId: a.user_id,
      ministryId: ministry.id,
      type: "join_request" as const,
      title: "Nova solicitação de entrada",
      body: `${input.userName} pediu para entrar em ${ministry.name}.`,
    }));

    return {
      ministry: mapMinistry(ministry),
      request: {
        id: req.id,
        ministryId: req.ministry_id,
        userId: req.user_id,
        userName: input.userName,
        userEmail: input.userEmail,
        status: req.status as "pending",
        createdAt: req.created_at,
      },
      notify,
    };
  },

  async listJoinRequests(ministryId: string, status?: "pending" | "approved" | "rejected"): Promise<MinistryJoinRequest[]> {
    let q = supabase
      .from("ministry_join_requests")
      .select("*")
      .eq("ministry_id", ministryId);
    if (status) q = q.eq("status", status);
    const { data: rows } = await q.order("created_at", { ascending: false });
    if (!rows || rows.length === 0) return [];
    const userIds = Array.from(new Set(rows.map((r) => r.user_id)));
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, name, email")
      .in("id", userIds);
    const profileMap = new Map((profiles ?? []).map((p) => [p.id, p]));
    return rows.map((r) => {
      const p = profileMap.get(r.user_id);
      return {
        id: r.id,
        ministryId: r.ministry_id,
        userId: r.user_id,
        userName: p?.name ?? "",
        userEmail: p?.email ?? "",
        status: r.status as MinistryJoinRequest["status"],
        createdAt: r.created_at,
        decidedAt: r.decided_at ?? undefined,
        decidedBy: r.decided_by ?? undefined,
      };
    });
  },

  async approveJoinRequest(requestId: string, deciderId: string): Promise<{ memberId: string; userId: string; ministryId: string; ministryName: string }> {
    const { data: req } = await supabase
      .from("ministry_join_requests")
      .select("*")
      .eq("id", requestId)
      .maybeSingle();
    if (!req) throw new Error("Solicitação não encontrada.");
    if (req.status !== "pending") throw new Error("Solicitação já processada.");

    const { data: ministry } = await supabase
      .from("ministries")
      .select("id, name")
      .eq("id", req.ministry_id)
      .maybeSingle();
    if (!ministry) throw new Error("Ministério não encontrado.");

    const { data: member, error: memErr } = await supabase
      .from("ministry_members")
      .insert({ ministry_id: ministry.id, user_id: req.user_id })
      .select("id")
      .single();
    if (memErr || !member) throw new Error(memErr?.message ?? "Erro ao adicionar membro.");

    await supabase.from("user_roles").insert({
      ministry_id: ministry.id,
      user_id: req.user_id,
      role: "member",
    });

    await supabase
      .from("ministry_join_requests")
      .update({
        status: "approved",
        decided_at: new Date().toISOString(),
        decided_by: deciderId,
      })
      .eq("id", requestId);

    return { memberId: member.id, userId: req.user_id, ministryId: ministry.id, ministryName: ministry.name };
  },

  async rejectJoinRequest(requestId: string, deciderId: string): Promise<{ userId: string; ministryId: string; ministryName: string }> {
    const { data: req } = await supabase
      .from("ministry_join_requests")
      .select("*")
      .eq("id", requestId)
      .maybeSingle();
    if (!req) throw new Error("Solicitação não encontrada.");

    const { data: ministry } = await supabase
      .from("ministries")
      .select("name")
      .eq("id", req.ministry_id)
      .maybeSingle();

    await supabase
      .from("ministry_join_requests")
      .update({
        status: "rejected",
        decided_at: new Date().toISOString(),
        decided_by: deciderId,
      })
      .eq("id", requestId);

    return { userId: req.user_id, ministryId: req.ministry_id, ministryName: ministry?.name ?? "" };
  },

  async removeMember(ministryId: string, memberId: string): Promise<void> {
    const { data: member } = await supabase
      .from("ministry_members")
      .select("user_id")
      .eq("id", memberId)
      .maybeSingle();
    if (!member) throw new Error("Membro não encontrado.");
    // Check it's not the owner
    const { data: ownerRole } = await supabase
      .from("user_roles")
      .select("id")
      .eq("user_id", member.user_id)
      .eq("ministry_id", ministryId)
      .eq("role", "owner")
      .maybeSingle();
    if (ownerRole) throw new Error("O dono não pode ser removido.");
    await supabase.from("user_roles").delete().eq("ministry_id", ministryId).eq("user_id", member.user_id);
    await supabase.from("ministry_members").delete().eq("id", memberId);
  },

  async setMemberRole(ministryId: string, memberId: string, role: Role): Promise<void> {
    const { data: member } = await supabase
      .from("ministry_members")
      .select("user_id")
      .eq("id", memberId)
      .maybeSingle();
    if (!member) throw new Error("Membro não encontrado.");
    const { data: ownerRole } = await supabase
      .from("user_roles")
      .select("id")
      .eq("user_id", member.user_id)
      .eq("ministry_id", ministryId)
      .eq("role", "owner")
      .maybeSingle();
    if (ownerRole) throw new Error("Não é possível alterar o papel do dono.");
    // Replace all non-owner roles with the new one
    await supabase
      .from("user_roles")
      .delete()
      .eq("ministry_id", ministryId)
      .eq("user_id", member.user_id)
      .neq("role", "owner");
    await supabase.from("user_roles").insert({
      ministry_id: ministryId,
      user_id: member.user_id,
      role,
    });
  },

  async update(ministryId: string, patch: Partial<Pick<Ministry, "name" | "invitesEnabled">>): Promise<Ministry> {
    const upd: { name?: string; invites_enabled?: boolean } = {};
    if (patch.name !== undefined) upd.name = patch.name;
    if (patch.invitesEnabled !== undefined) upd.invites_enabled = patch.invitesEnabled;
    const { data, error } = await supabase
      .from("ministries")
      .update(upd)
      .eq("id", ministryId)
      .select()
      .single();
    if (error || !data) throw new Error(error?.message ?? "Erro ao atualizar.");
    return mapMinistry(data);
  },

  async regenerateCode(ministryId: string): Promise<Ministry> {
    const { data, error } = await supabase
      .from("ministries")
      .update({ invite_code: genCode() })
      .eq("id", ministryId)
      .select()
      .single();
    if (error || !data) throw new Error(error?.message ?? "Erro ao gerar código.");
    return mapMinistry(data);
  },

  async getById(ministryId: string): Promise<Ministry | null> {
    const { data } = await supabase.from("ministries").select("*").eq("id", ministryId).maybeSingle();
    return data ? mapMinistry(data) : null;
  },

  async addMemberManually(_input: {
    ministryId: string;
    name: string;
    email: string;
    role?: Role;
  }): Promise<MinistryMember> {
    // Adding members manually requires creating an auth user, which can only be
    // done with the service role. Direct add by email is no longer supported in
    // the client. Use the invite-code flow instead.
    throw new Error(
      "Adicionar membros manualmente foi descontinuado. Compartilhe o código de convite do ministério.",
    );
  },

  async deleteMinistry(ministryId: string): Promise<void> {
    const { error } = await supabase.from("ministries").delete().eq("id", ministryId);
    if (error) throw new Error(error.message);
  },
};
