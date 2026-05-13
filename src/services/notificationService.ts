import { delay, readDB, uid, writeDB } from "./db";
import type { AppNotification, NotificationType } from "@/types";

export const notificationService = {
  async list(userId: string, limit?: number): Promise<AppNotification[]> {
    await delay(80);
    const db = readDB();
    const items = db.notifications
      .filter((n) => n.userId === userId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    return typeof limit === "number" ? items.slice(0, limit) : items;
  },

  async create(input: {
    userId: string;
    ministryId?: string;
    type: NotificationType;
    title: string;
    body?: string;
  }): Promise<AppNotification> {
    const db = readDB();
    const notif: AppNotification = {
      id: uid("ntf"),
      userId: input.userId,
      ministryId: input.ministryId,
      type: input.type,
      title: input.title,
      body: input.body,
      read: false,
      createdAt: new Date().toISOString(),
    };
    db.notifications.push(notif);
    writeDB(db);
    return notif;
  },

  async markAllRead(userId: string): Promise<void> {
    const db = readDB();
    db.notifications.forEach((n) => {
      if (n.userId === userId) n.read = true;
    });
    writeDB(db);
  },
};