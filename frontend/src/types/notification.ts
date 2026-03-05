export type NotificationType = "REPLY_ON_THREAD" | "LIKE_ON_THREAD";

export type Notification = {
  id: number;
  type: NotificationType | string;
  threadId: number;
  createdAt: string;
  readAt: string | null;
  actor: {
    displayName: string | null;
    handle: string | null;
  };
  thread: {
    title: string;
  };
};
