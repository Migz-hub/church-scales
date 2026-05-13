import { delay, hashPassword, readDB, uid, writeDB } from "./db";
import { STORAGE_KEYS, storage } from "@/lib/storage";
import type { User } from "@/types";

export interface Session {
  userId: string;
  token: string;
}

function publicUser(u: { id: string; name: string; email: string; createdAt: string }): User {
  return { id: u.id, name: u.name, email: u.email, createdAt: u.createdAt };
}

export const authService = {
  async signUp(input: { name: string; email: string; password: string }): Promise<User> {
    await delay();
    const db = readDB();
    const email = input.email.trim().toLowerCase();
    if (db.users.some((u) => u.email === email)) {
      throw new Error("Já existe uma conta com esse email.");
    }
    const user = {
      id: uid("usr"),
      name: input.name.trim(),
      email,
      passwordHash: hashPassword(input.password),
      createdAt: new Date().toISOString(),
    };
    db.users.push(user);
    writeDB(db);
    storage.set<Session>(STORAGE_KEYS.session, { userId: user.id, token: uid("tok") });
    return publicUser(user);
  },

  async signIn(input: { email: string; password: string }): Promise<User> {
    await delay();
    const db = readDB();
    const email = input.email.trim().toLowerCase();
    const user = db.users.find((u) => u.email === email);
    if (!user || user.passwordHash !== hashPassword(input.password)) {
      throw new Error("Email ou senha inválidos.");
    }
    storage.set<Session>(STORAGE_KEYS.session, { userId: user.id, token: uid("tok") });
    return publicUser(user);
  },

  async signOut(): Promise<void> {
    await delay(80);
    storage.remove(STORAGE_KEYS.session);
    storage.remove(STORAGE_KEYS.activeMinistry);
  },

  async restore(): Promise<User | null> {
    const session = storage.get<Session | null>(STORAGE_KEYS.session, null);
    if (!session) return null;
    const db = readDB();
    const u = db.users.find((x) => x.id === session.userId);
    return u ? publicUser(u) : null;
  },

  async requestPasswordReset(email: string): Promise<void> {
    await delay();
    // Visual flow only — backend will send the email.
    if (!email.includes("@")) throw new Error("Email inválido.");
  },

  async updateProfile(userId: string, patch: { name?: string; email?: string }): Promise<User> {
    await delay();
    const db = readDB();
    const u = db.users.find((x) => x.id === userId);
    if (!u) throw new Error("Usuário não encontrado.");
    if (patch.name !== undefined) u.name = patch.name.trim();
    if (patch.email !== undefined) {
      const e = patch.email.trim().toLowerCase();
      if (db.users.some((x) => x.id !== userId && x.email === e)) throw new Error("Email já em uso.");
      u.email = e;
    }
    // mirror to membership snapshots
    db.members.forEach((m) => {
      if (m.userId === userId) m.user = { id: u.id, name: u.name, email: u.email };
    });
    writeDB(db);
    return publicUser(u);
  },

  async changePassword(userId: string, current: string, next: string): Promise<void> {
    await delay();
    const db = readDB();
    const u = db.users.find((x) => x.id === userId);
    if (!u) throw new Error("Usuário não encontrado.");
    if (u.passwordHash !== hashPassword(current)) throw new Error("Senha atual inválida.");
    u.passwordHash = hashPassword(next);
    writeDB(db);
  },

  async deleteAccount(userId: string): Promise<void> {
    await delay();
    const db = readDB();
    db.users = db.users.filter((u) => u.id !== userId);
    db.members = db.members.filter((m) => m.userId !== userId);
    db.assignments = (db.assignments ?? []).map((a) =>
      a.userId === userId ? { ...a, userId: null, user: null } : a,
    );
    db.unavailabilities = (db.unavailabilities ?? []).filter((u) => u.userId !== userId);
    db.notifications = (db.notifications ?? []).filter((n) => n.userId !== userId);
    writeDB(db);
    storage.remove(STORAGE_KEYS.session);
    storage.remove(STORAGE_KEYS.activeMinistry);
  },
};