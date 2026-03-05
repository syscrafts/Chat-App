export type NotificationRow = {
  id: number;
  type: string;
  thread_id: number;
  created_at: Date;
  read_at: Date | null;
  actor_display_name: string | null;
  actor_handle: string | null;
  thread_title: string | null;
};

export type Notification = {
  id: number;
  type: string;
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

export function mapNotificationsRow(row: NotificationRow): Notification {
  return {
    id: row.id,
    type: row.type,
    threadId: row.thread_id,
    createdAt: row.created_at.toISOString(),
    readAt: row.read_at ? row.read_at.toISOString() : null,
    actor: {
      displayName: row.actor_display_name ?? null,
      handle: row.actor_handle ?? null,
    },
    thread: {
      title: row.thread_title ?? "",
    },
  };
}
