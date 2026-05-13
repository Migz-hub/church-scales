import { delay, readDB, uid, writeDB } from "./db";
import type { Ministry, MinistryMember, MinistryJoinRequest, Role } from "@/types";

function genCode(existing: Set<string>): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  for (let attempt = 0; attempt < 50; attempt++) {
    let code = "";
    for (let i = 0; i < 6; i++) code += alphabet[Math.floor(Math.random() * alphabet.length)];
    if (!existing.has(code)) return code;
  }
  return uid("code").toUpperCase();
}

export const ministryService = {
  async listForUser(userId: string): Promise<Ministry[]> {
    await delay(120);
    const db = readDB();
    const ids = new Set(db.members.filter((m) => m.userId === userId).map((m) => m.ministryId));
    return db.ministries.filter((m) => ids.has(m.id));
  },

  async getMembership(ministryId: string, userId: string): Promise<MinistryMember | null> {
    const db = readDB();
    return db.members.find((m) => m.ministryId === ministryId && m.userId === userId) ?? null;
  },

  async listMembers(ministryId: string): Promise<MinistryMember[]> {
    await delay(120);
    const db = readDB();
    return db.members.filter((m) => m.ministryId === ministryId);
  },

  async create(input: {
    name: string;
    userId: string;
    userName: string;
    userEmail: string;
    functions?: { name: string; icon?: string }[];
  }): Promise<Ministry> {
    await delay();
    const db = readDB();
    const ministry: Ministry = {
      id: uid("min"),
      name: input.name.trim(),
      inviteCode: genCode(new Set(db.ministries.map((m) => m.inviteCode))),
      invitesEnabled: true,
      ownerId: input.userId,
      createdAt: new Date().toISOString(),
    };
    db.ministries.push(ministry);
    db.members.push({
      id: uid("mem"),
      ministryId: ministry.id,
      userId: input.userId,
      role: "owner",
      user: { id: input.userId, name: input.userName, email: input.userEmail },
      joinedAt: new Date().toISOString(),
    });
    if (input.functions && input.functions.length > 0) {
      db.functions ??= [];
      for (const f of input.functions) {
        const name = f.name.trim();
        if (!name) continue;
        db.functions.push({
          id: uid("fn"),
          ministryId: ministry.id,
          name,
          icon: f.icon,
          active: true,
        });
      }
    }
    writeDB(db);
    return ministry;
  },

  async requestJoin(input: { code: string; userId: string; userName: string; userEmail: string }): Promise<{
    ministry: Ministry;
    request: MinistryJoinRequest;
    notify: { userId: string; ministryId: string; type: "join_request"; title: string; body?: string }[];
  }> {
    await delay();
    const db = readDB();
    const code = input.code.trim().toUpperCase();
    const ministry = db.ministries.find((m) => m.inviteCode === code);
    if (!ministry) throw new Error("Código de convite inválido.");
    if (!ministry.invitesEnabled) throw new Error("Convites desativados para este ministério.");
    if (db.members.some((m) => m.ministryId === ministry.id && m.userId === input.userId)) {
      throw new Error("Você já faz parte deste ministério.");
    }
    db.joinRequests ??= [];
    if (db.joinRequests.some((r) => r.ministryId === ministry.id && r.userId === input.userId && r.status === "pending")) {
      throw new Error("Você já enviou uma solicitação. Aguarde a aprovação.");
    }
    const request: MinistryJoinRequest = {
      id: uid("req"),
      ministryId: ministry.id,
      userId: input.userId,
      userName: input.userName,
      userEmail: input.userEmail,
      status: "pending",
      createdAt: new Date().toISOString(),
    };
    db.joinRequests.push(request);
    writeDB(db);
    const admins = db.members.filter(
      (m) => m.ministryId === ministry.id && (m.role === "owner" || m.role === "admin"),
    );
    const notify = admins.map((a) => ({
      userId: a.userId,
      ministryId: ministry.id,
      type: "join_request" as const,
      title: "Nova solicitação de entrada",
      body: `${input.userName} pediu para entrar em ${ministry.name}.`,
    }));
    return { ministry, request, notify };
  },

  async listJoinRequests(ministryId: string, status?: "pending" | "approved" | "rejected"): Promise<MinistryJoinRequest[]> {
    await delay(80);
    const db = readDB();
    const items = (db.joinRequests ?? []).filter((r) => r.ministryId === ministryId);
    return status ? items.filter((r) => r.status === status) : items;
  },

  async approveJoinRequest(requestId: string, deciderId: string): Promise<{ memberId: string; userId: string; ministryId: string; ministryName: string }> {
    await delay();
    const db = readDB();
    const req = (db.joinRequests ?? []).find((r) => r.id === requestId);
    if (!req) throw new Error("Solicitação não encontrada.");
    if (req.status !== "pending") throw new Error("Solicitação já processada.");
    const ministry = db.ministries.find((m) => m.id === req.ministryId);
    if (!ministry) throw new Error("Ministério não encontrado.");
    if (db.members.some((m) => m.ministryId === ministry.id && m.userId === req.userId)) {
      req.status = "approved";
      req.decidedAt = new Date().toISOString();
      req.decidedBy = deciderId;
      writeDB(db);
      throw new Error("Esta pessoa já é membro.");
    }
    const member: MinistryMember = {
      id: uid("mem"),
      ministryId: ministry.id,
      userId: req.userId,
      role: "member",
      user: { id: req.userId, name: req.userName, email: req.userEmail },
      joinedAt: new Date().toISOString(),
    };
    db.members.push(member);
    req.status = "approved";
    req.decidedAt = new Date().toISOString();
    req.decidedBy = deciderId;
    writeDB(db);
    return { memberId: member.id, userId: req.userId, ministryId: ministry.id, ministryName: ministry.name };
  },

  async rejectJoinRequest(requestId: string, deciderId: string): Promise<{ userId: string; ministryId: string; ministryName: string }> {
    await delay();
    const db = readDB();
    const req = (db.joinRequests ?? []).find((r) => r.id === requestId);
    if (!req) throw new Error("Solicitação não encontrada.");
    if (req.status !== "pending") throw new Error("Solicitação já processada.");
    const ministry = db.ministries.find((m) => m.id === req.ministryId);
    req.status = "rejected";
    req.decidedAt = new Date().toISOString();
    req.decidedBy = deciderId;
    writeDB(db);
    return { userId: req.userId, ministryId: req.ministryId, ministryName: ministry?.name ?? "" };
  },

  async removeMember(ministryId: string, memberId: string): Promise<void> {
    await delay();
    const db = readDB();
    const member = db.members.find((m) => m.id === memberId && m.ministryId === ministryId);
    if (!member) throw new Error("Membro não encontrado.");
    if (member.role === "owner") throw new Error("O dono não pode ser removido.");
    db.members = db.members.filter((m) => m.id !== memberId);
    writeDB(db);
  },

  async setMemberRole(ministryId: string, memberId: string, role: Role): Promise<void> {
    await delay();
    const db = readDB();
    const member = db.members.find((m) => m.id === memberId && m.ministryId === ministryId);
    if (!member) throw new Error("Membro não encontrado.");
    if (member.role === "owner") throw new Error("Não é possível alterar o papel do dono.");
    member.role = role;
    writeDB(db);
  },

  async update(ministryId: string, patch: Partial<Pick<Ministry, "name" | "invitesEnabled">>): Promise<Ministry> {
    await delay();
    const db = readDB();
    const m = db.ministries.find((x) => x.id === ministryId);
    if (!m) throw new Error("Ministério não encontrado.");
    Object.assign(m, patch);
    writeDB(db);
    return m;
  },

  async regenerateCode(ministryId: string): Promise<Ministry> {
    await delay();
    const db = readDB();
    const m = db.ministries.find((x) => x.id === ministryId);
    if (!m) throw new Error("Ministério não encontrado.");
    m.inviteCode = genCode(new Set(db.ministries.map((x) => x.inviteCode).filter((c) => c !== m.inviteCode)));
    writeDB(db);
    return m;
  },

  async getById(ministryId: string): Promise<Ministry | null> {
    const db = readDB();
    return db.ministries.find((m) => m.id === ministryId) ?? null;
  },

  async addMemberManually(input: {
    ministryId: string;
    name: string;
    email: string;
    role?: Role;
  }): Promise<MinistryMember> {
    await delay();
    const db = readDB();
    const email = input.email.trim().toLowerCase();
    let user = db.users.find((u) => u.email === email);
    if (!user) {
      user = {
        id: uid("usr"),
        name: input.name.trim(),
        email,
        passwordHash: "manual$pending",
        createdAt: new Date().toISOString(),
      };
      db.users.push(user);
    }
    if (db.members.some((m) => m.ministryId === input.ministryId && m.userId === user!.id)) {
      throw new Error("Esta pessoa já faz parte do ministério.");
    }
    const member: MinistryMember = {
      id: uid("mem"),
      ministryId: input.ministryId,
      userId: user.id,
      role: input.role ?? "member",
      user: { id: user.id, name: user.name, email: user.email },
      joinedAt: new Date().toISOString(),
    };
    db.members.push(member);
    writeDB(db);
    return member;
  },

  async deleteMinistry(ministryId: string): Promise<void> {
    await delay();
    const db = readDB();
    db.ministries = db.ministries.filter((m) => m.id !== ministryId);
    db.members = db.members.filter((m) => m.ministryId !== ministryId);
    db.schedules = db.schedules.filter((s) => s.ministryId !== ministryId);
    db.assignments = db.assignments.filter((a) =>
      db.schedules.some((s) => s.id === a.scheduleId),
    );
    db.messages = db.messages.filter((m) => m.ministryId !== ministryId);
    db.functions = (db.functions ?? []).filter((f) => f.ministryId !== ministryId);
    db.teams = (db.teams ?? []).filter((t) => t.ministryId !== ministryId);
    db.memberPermissions = (db.memberPermissions ?? []).filter((p) => p.ministryId !== ministryId);
    db.ministryDefaults = (db.ministryDefaults ?? []).filter((d) => d.ministryId !== ministryId);
    writeDB(db);
  },
};