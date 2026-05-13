import { delay, readDB, uid, writeDB } from "./db";
import type { ChatMessage, User } from "@/types";

export const chatService = {
  async list(ministryId: string): Promise<ChatMessage[]> {
    await delay(100);
    const db = readDB();
    return db.messages
      .filter((m) => m.ministryId === ministryId)
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  },

  async send(input: { ministryId: string; user: Pick<User, "id" | "name">; content: string }): Promise<ChatMessage> {
    await delay(80);
    const content = input.content.trim();
    if (!content) throw new Error("Mensagem vazia.");
    if (content.length > 1000) throw new Error("Máximo de 1000 caracteres.");
    const db = readDB();
    const msg: ChatMessage = {
      id: uid("msg"),
      ministryId: input.ministryId,
      userId: input.user.id,
      user: input.user,
      content,
      createdAt: new Date().toISOString(),
    };
    db.messages.push(msg);
    writeDB(db);
    return msg;
  },
};