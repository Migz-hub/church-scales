import { supabase } from "@/integrations/supabase/client";
import type { AppNotification, NotificationType } from "@/types";

type Row = {
  id: string;
  user_id: string;
  ministry_id: string | null;
  type: NotificationType;
  title: string;
  body: string | null;
  read: boolean;
  created_at: string;
};

function map(r: Row): AppNotification {
  return {
    id: r.id,
    userId: r.user_id,
    ministryId: r.ministry_id ?? undefined,
    type: r.type,
    title: r.title,
    body: r.body ?? undefined,
    read: r.read,
    createdAt: r.created_at,
  };
}

export const notificationService = {
  async list(userId: string, limit?: number): Promise<AppNotification[]> {
    let q = supabase
      .from("notifications")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });
    if (typeof limit === "number") q = q.limit(limit);
    const { data } = await q;
    return ((data ?? []) as Row[]).map(map);
  },

  async create(input: {
    userId: string;
    ministryId?: string;
    type: NotificationType;
    title: string;
    body?: string;
  }): Promise<AppNotification> {
    const { data, error } = await supabase
      .from("notifications")
      .insert({
        user_id: input.userId,
        ministry_id: input.ministryId ?? null,
        type: input.type,
        title: input.title,
        body: input.body ?? null,
      })
      .select()
      .single();
    if (error || !data) throw new Error(error?.message ?? "Erro ao criar notificação.");
    return map(data as Row);
  },

  async markAllRead(userId: string): Promise<void> {
    await supabase
      .from("notifications")
      .update({ read: true })
      .eq("user_id", userId)
      .eq("read", false);
  },
};
