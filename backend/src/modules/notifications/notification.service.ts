import { query } from "../../db/db.js";
import { getIo } from "../../realtime/io.js";
import { mapNotificationsRow, NotificationRow } from "./notifications.types.js";

export async function createReplyNotification(params: {
  threadId: number;
  actorUserId: number;
}) {
  const { threadId, actorUserId } = params;

  const threadRes = await query(
    `
        SELECT author_user_id
        FROM threads
        WHERE id = $1
        LIMIT 1
        `,
    [threadId]
  );

  const row = threadRes.rows[0] as { author_user_id: number } | undefined;
  if (!row) {
    return;
  }

  const authorUserId = row.author_user_id;
  if (authorUserId === actorUserId) return;

  const insertRes = await query(
    `
     INSERT INTO notifications (user_id, actor_user_id, thread_id, type)
     VALUES ($1, $2, $3, 'REPLY_ON_THREAD')
     RETURNING id, created_at
     `,
    [authorUserId, actorUserId, threadId]
  );

  const notiRow = insertRes.rows[0] as { id: number };
  if (!notiRow) {
    return;
  }

  const fullRes = await query(
    `
        SELECT 
          n.id,
          n.type,
          n.thread_id,
          n.created_at,
          n.read_at,
          actor.display_name AS actor_display_name,
          actor.handle AS actor_handle,
          t.title AS thread_title
        FROM notifications n
        JOIN users actor ON actor.id = n.actor_user_id
        JOIN threads t ON t.id = n.thread_id
        WHERE n.id = $1
        LIMIT 1

        `,
    [notiRow.id]
  );

  const fullRow = fullRes.rows[0] as NotificationRow | undefined;
  if (!fullRow) {
    return;
  }

  const payload = mapNotificationsRow(fullRow);

  // emit first socket event
  // notification:new

  const io = getIo();
  if (io) {
    io.to(`notifications:user:${authorUserId}`).emit(
      "notification:new",
      payload
    );
  }
}

export async function createLikeNotification(params: {
  threadId: number;
  actorUserId: number;
}) {
  const { threadId, actorUserId } = params;

  const threadRes = await query(
    `
        SELECT author_user_id
        FROM threads
        WHERE id = $1
        LIMIT 1
        `,
    [threadId]
  );

  const row = threadRes.rows[0] as { author_user_id: number } | undefined;
  if (!row) {
    return;
  }

  const authorUserId = row.author_user_id;
  if (authorUserId === actorUserId) return;

  const insertRes = await query(
    `
     INSERT INTO notifications (user_id, actor_user_id, thread_id, type)
     VALUES ($1, $2, $3, 'LIKE_ON_THREAD')
     RETURNING id, created_at
     `,
    [authorUserId, actorUserId, threadId]
  );

  const notiRow = insertRes.rows[0] as { id: number };
  if (!notiRow) {
    return;
  }

  const fullRes = await query(
    `
        SELECT 
          n.id,
          n.type,
          n.thread_id,
          n.created_at,
          n.read_at,
          actor.display_name AS actor_display_name,
          actor.handle AS actor_handle,
          t.title AS thread_title
        FROM notifications n
        JOIN users actor ON actor.id = n.actor_user_id
        JOIN threads t ON t.id = n.thread_id
        WHERE n.id = $1
        LIMIT 1

        `,
    [notiRow.id]
  );

  const fullRow = fullRes.rows[0] as NotificationRow | undefined;
  if (!fullRow) {
    return;
  }

  const payload = mapNotificationsRow(fullRow);

  // emit first socket event
  // notification:new

  const io = getIo();
  if (io) {
    io.to(`notifications:user:${authorUserId}`).emit(
      "notification:new",
      payload
    );
  }
}

export async function listNotificationsForUser(params: {
  userId: number;
  unreadOnly: boolean;
}) {
  try {
    const { unreadOnly, userId } = params;

    const conditions = ["n.user_id = $1"];
    const values: unknown[] = [userId];

    if (unreadOnly) {
      conditions.push("n.read_at IS NULL");
    }

    const whereClause = `WHERE ${conditions.join(" AND ")}`;

    console.log(whereClause, userId, unreadOnly, "whereClause");

    const result = await query(
      `
        SELECT 
          n.id,
          n.type,
          n.thread_id,
          n.created_at,
          n.read_at,
          actor.display_name AS actor_display_name,
          actor.handle AS actor_handle,
          t.title AS thread_title
        FROM notifications n
        JOIN users actor ON actor.id = n.actor_user_id
        JOIN threads t ON t.id = n.thread_id
        ${whereClause}
        ORDER BY n.created_at DESC
        `,
      values
    );

    return result.rows.map((noti) =>
      mapNotificationsRow(noti as NotificationRow)
    );
  } catch (err) {
    console.error("Error:", err);
    throw err;
  }
}

export async function markNotificationRead(params: {
  userId: number;
  notificationId: number;
}) {
  const { userId, notificationId } = params;

  await query(
    `
        UPDATE notifications
        SET read_at = COALESCE(read_at, NOW())
        WHERE id = $1 AND user_id = $2
        `,
    [notificationId, userId]
  );
}

// HOMEWORK -> create a function to handle marking all notifications as read at once
// 10 -> button ->
