import { supabase } from "@/integrations/supabase/client";
import type { ChatMessage, User } from "@/types";

export const chatService = {
  async list(ministryId: string): Promise<ChatMessage[]> {
    const { data } = await supabase
      .from("chat_messages")
      .select("*")
      .eq("ministry_id", ministryId)
      .order("created_at", { ascending: true })
      .limit(500);
    const rows = data ?? [];
    if (rows.length === 0) return [];
    const userIds = Array.from(new Set(rows.map((r) => r.user_id)));
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, name")
      .in("id", userIds);
    const profileMap = new Map((profiles ?? []).map((p) => [p.id, p]));
    return rows.map((r) => ({
      id: r.id,
      ministryId: r.ministry_id,
      userId: r.user_id,
      user: { id: r.user_id, name: profileMap.get(r.user_id)?.name ?? "" },
      content: r.content,
      createdAt: r.created_at,
    }));
  },

  async send(input: { ministryId: string; user: Pick<User, "id" | "name">; content: string }): Promise<ChatMessage> {
    const content = input.content.trim();
    if (!content) throw new Error("Mensagem vazia.");
    if (content.length > 1000) throw new Error("Máximo de 1000 caracteres.");
    const { data, error } = await supabase
      .from("chat_messages")
      .insert({
        ministry_id: input.ministryId,
        user_id: input.user.id,
        content,
      })
      .select()
      .single();
    if (error || !data) throw new Error(error?.message ?? "Erro ao enviar.");
    return {
      id: data.id,
      ministryId: data.ministry_id,
      userId: data.user_id,
      user: input.user,
      content: data.content,
      createdAt: data.created_at,
    };
  },
};
