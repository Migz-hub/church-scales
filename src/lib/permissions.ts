import type { Role } from "@/types";

export type PermissionAction =
  | "schedule.create"
  | "schedule.edit"
  | "schedule.delete"
  | "member.add"
  | "member.remove"
  | "ministry.settings"
  | "chat.send"
  | "announcement.send";

const matrix: Record<PermissionAction, Role[]> = {
  "schedule.create": ["owner", "admin", "leader"],
  "schedule.edit": ["owner", "admin", "leader"],
  "schedule.delete": ["owner", "admin"],
  "member.add": ["owner", "admin"],
  "member.remove": ["owner", "admin"],
  "ministry.settings": ["owner", "admin"],
  "chat.send": ["owner", "admin", "leader", "member"],
  "announcement.send": ["owner", "admin", "leader"],
};

export function can(role: Role | undefined | null, action: PermissionAction): boolean {
  if (!role) return false;
  return matrix[action].includes(role);
}

export const roleLabel: Record<Role, string> = {
  owner: "Dono",
  admin: "Administrador",
  leader: "Líder",
  member: "Membro",
};