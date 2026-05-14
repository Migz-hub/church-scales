import { supabase } from "@/integrations/supabase/client";
import type { Unavailability } from "@/types";

type Row = {
  id: string;
  ministry_id: string;
  user_id: string;
  description: string | null;
  starts_at: string;
  ends_at: string;
  created_by: string;
  created_at: string;
};

function map(r: Row, user: { id: string; name: string; email: string }): Unavailability {
  return {
    id: r.id,
    ministryId: r.ministry_id,
    userId: r.user_id,
    user,
    description: r.description ?? undefined,
    startsAt: r.starts_at,
    endsAt: r.ends_at,
    createdAt: r.created_at,
    createdBy: r.created_by,
  };
}

async function attachUsers(rows: Row[]): Promise<Unavailability[]> {
  if (rows.length === 0) return [];
  const ids = Array.from(new Set(rows.map((r) => r.user_id)));
  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, name, email")
    .in("id", ids);
  const map2 = new Map((profiles ?? []).map((p) => [p.id, p]));
  return rows.map((r) => map(r, map2.get(r.user_id) ?? { id: r.user_id, name: "", email: "" }));
}

export const unavailabilityService = {
  async list(ministryId: string): Promise<Unavailability[]> {
    const { data } = await supabase
      .from("unavailabilities")
      .select("*")
      .eq("ministry_id", ministryId)
      .order("starts_at", { ascending: true });
    return attachUsers((data ?? []) as Row[]);
  },

  async create(input: {
    ministryId: string;
    userIds: string[];
    description?: string;
    startsAt: string;
    endsAt: string;
    createdBy: string;
  }): Promise<Unavailability[]> {
    if (input.userIds.length === 0) return [];
    const rows = input.userIds.map((uid) => ({
      ministry_id: input.ministryId,
      user_id: uid,
      description: input.description?.trim() || null,
      starts_at: input.startsAt,
      ends_at: input.endsAt,
      created_by: input.createdBy,
    }));
    const { data, error } = await supabase.from("unavailabilities").insert(rows).select();
    if (error) throw new Error(error.message);
    return attachUsers((data ?? []) as Row[]);
  },

  async remove(id: string): Promise<void> {
    const { error } = await supabase.from("unavailabilities").delete().eq("id", id);
    if (error) throw new Error(error.message);
  },

  async update(
    id: string,
    patch: { description?: string; startsAt?: string; endsAt?: string },
  ): Promise<Unavailability | null> {
    const upd: Record<string, unknown> = {};
    if (patch.description !== undefined) upd.description = patch.description.trim() || null;
    if (patch.startsAt) upd.starts_at = patch.startsAt;
    if (patch.endsAt) upd.ends_at = patch.endsAt;
    const { data, error } = await supabase
      .from("unavailabilities")
      .update(upd)
      .eq("id", id)
      .select()
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!data) return null;
    const list = await attachUsers([data as Row]);
    return list[0] ?? null;
  },
};
