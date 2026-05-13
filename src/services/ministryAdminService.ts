import { delay, readDB, uid, writeDB } from "./db";
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
    await delay(60);
    const db = readDB();
    let d = db.ministryDefaults!.find((x) => x.ministryId === ministryId);
    if (!d) {
      d = { ministryId, permissions: { ...DEFAULT_PERMISSIONS } };
      db.ministryDefaults!.push(d);
      writeDB(db);
    }
    return d;
  },
  async updateDefaults(ministryId: string, patch: Partial<MinistryDefaults>): Promise<MinistryDefaults> {
    await delay(80);
    const db = readDB();
    let d = db.ministryDefaults!.find((x) => x.ministryId === ministryId);
    if (!d) {
      d = { ministryId, permissions: { ...DEFAULT_PERMISSIONS } };
      db.ministryDefaults!.push(d);
    }
    Object.assign(d, patch);
    writeDB(db);
    return d;
  },

  // ---------- Functions ----------
  async listFunctions(ministryId: string): Promise<MinistryFunction[]> {
    await delay(80);
    const db = readDB();
    return db.functions!.filter((f) => f.ministryId === ministryId);
  },
  async createFunction(ministryId: string, input: { name: string; icon?: string }): Promise<MinistryFunction> {
    await delay();
    const db = readDB();
    const fn: MinistryFunction = {
      id: uid("fn"),
      ministryId,
      name: input.name.trim(),
      icon: input.icon,
      active: true,
    };
    db.functions!.push(fn);
    writeDB(db);
    return fn;
  },
  async updateFunction(id: string, patch: Partial<MinistryFunction>): Promise<void> {
    await delay();
    const db = readDB();
    const fn = db.functions!.find((f) => f.id === id);
    if (!fn) throw new Error("Função não encontrada");
    Object.assign(fn, patch);
    writeDB(db);
  },
  async deleteFunction(id: string): Promise<void> {
    await delay();
    const db = readDB();
    db.functions = db.functions!.filter((f) => f.id !== id);
    db.teams = db.teams!.map((t) => ({ ...t, functionIds: t.functionIds.filter((x) => x !== id) }));
    db.memberPermissions = db.memberPermissions!.map((mp) => ({
      ...mp,
      functionIds: mp.functionIds.filter((x) => x !== id),
    }));
    writeDB(db);
  },

  // ---------- Teams ----------
  async listTeams(ministryId: string): Promise<MinistryTeam[]> {
    await delay(80);
    const db = readDB();
    return db.teams!.filter((t) => t.ministryId === ministryId);
  },
  async createTeam(ministryId: string, name: string, functionIds: string[] = []): Promise<MinistryTeam> {
    await delay();
    const db = readDB();
    const team: MinistryTeam = { id: uid("team"), ministryId, name: name.trim(), functionIds };
    db.teams!.push(team);
    writeDB(db);
    return team;
  },
  async updateTeam(id: string, patch: Partial<MinistryTeam>): Promise<void> {
    await delay();
    const db = readDB();
    const t = db.teams!.find((x) => x.id === id);
    if (!t) throw new Error("Equipe não encontrada");
    Object.assign(t, patch);
    writeDB(db);
  },
  async deleteTeam(id: string): Promise<void> {
    await delay();
    const db = readDB();
    db.teams = db.teams!.filter((t) => t.id !== id);
    writeDB(db);
  },

  // ---------- Member Permissions ----------
  async getMemberConfig(ministryId: string, memberId: string): Promise<MemberPermissions> {
    await delay(60);
    const db = readDB();
    let mp = db.memberPermissions!.find((x) => x.ministryId === ministryId && x.memberId === memberId);
    if (!mp) {
      mp = { ministryId, memberId, overrides: {}, functionIds: [] };
      db.memberPermissions!.push(mp);
      writeDB(db);
    }
    return mp;
  },
  async updateMemberConfig(
    ministryId: string,
    memberId: string,
    patch: Partial<Pick<MemberPermissions, "overrides" | "functionIds">>,
  ): Promise<MemberPermissions> {
    await delay(80);
    const db = readDB();
    let mp = db.memberPermissions!.find((x) => x.ministryId === ministryId && x.memberId === memberId);
    if (!mp) {
      mp = { ministryId, memberId, overrides: {}, functionIds: [] };
      db.memberPermissions!.push(mp);
    }
    if (patch.overrides) mp.overrides = patch.overrides;
    if (patch.functionIds) mp.functionIds = patch.functionIds;
    writeDB(db);
    return mp;
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