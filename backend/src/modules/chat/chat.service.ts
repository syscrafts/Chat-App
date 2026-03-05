import { query } from "../../db/db.js";

export async function listChatUsers(currentUserId: number) {
  try {
    const result = await query(
      `
            SELECT 
              id,
              display_name,
              handle,
              avatar_url
            FROM users
            WHERE id <> $1
            ORDER BY COALESCE(display_name, handle, 'User') ASC
            `,
      [currentUserId]
    );

    return result.rows.map((row) => ({
      id: row.id as number,
      displayName: (row.display_name as string) ?? null,
      handle: (row.handle as string) ?? null,
      avatarUrl: (row.avatar_url as string) ?? null,
    }));
  } catch (err) {
    throw err;
  }
}

export async function listDirectMessages(params: {
  userId: number;
  otherUserId: number;
  limit: number;
}) {
  try {
    const { userId, otherUserId, limit } = params;
    const setLimit = Math.min(Math.max(limit || 50, 1), 200);

    const result = await query(
      `
            SELECT
              dm.id,
              dm.sender_user_id,
              dm.recipient_user_id,
              dm.body,
              dm.image_url,
              dm.created_at,
              s.display_name AS sender_display_name,
              s.handle AS sender_handle,
              s.avatar_url AS sender_avatar,
              r.display_name AS recipient_display_name,
              r.handle AS recipient_handle,
              r.avatar_url AS recipient_avatar
            FROM direct_messages dm
            JOIN users s ON s.id = dm.sender_user_id
            JOIN users r ON r.id = dm.recipient_user_id
            WHERE
              (dm.sender_user_id = $1 AND dm.recipient_user_id = $2)
              OR
              (dm.sender_user_id = $2 AND dm.recipient_user_id = $1)
            ORDER BY dm.created_at DESC
            LIMIT $3
            `,
      [userId, otherUserId, setLimit]
    );

    const rows = result.rows.slice().reverse();

    return rows.map((row) => ({
      id: row.id as number,
      senderUserId: row.sender_user_id as number,
      recipientUserId: row.recipient_user_id as number,
      body: (row.body as string) ?? null,
      imageUrl: (row.image_url as string) ?? null,
      createdAt: (row.created_at as Date).toISOString(),
      sender: {
        displayName: (row.sender_display_name as string) ?? null,
        handle: (row.sender_handle as string) ?? null,
        avatarUrl: (row.sender_avatar as string) ?? null,
      },
      recipient: {
        displayName: (row.recipient_display_name as string) ?? null,
        handle: (row.recipient_handle as string) ?? null,
        avatarUrl: (row.recipient_avatar as string) ?? null,
      },
    }));
  } catch (err) {
    throw err;
  }
}

export async function createDirectMessage(params: {
  senderUserId: number;
  recipientUserId: number;
  body?: string | null;
  imageUrl?: string | null;
}) {
  const { senderUserId, recipientUserId } = params;
  const rawBody = params?.body ?? "";
  const trimmedBody = rawBody.trim();
  const setImageUrl = params?.imageUrl ?? null;

  if (!trimmedBody && !setImageUrl) {
    throw new Error("Message body or image is required");
  }

  const insertRes = await query(
    `
        INSERT INTO direct_messages (sender_user_id, recipient_user_id, body, image_url)
        VALUES ($1, $2, $3, $4)
        RETURNING id, created_at
        `,
    [senderUserId, recipientUserId, trimmedBody || null, setImageUrl]
  );

  const row = insertRes.rows[0];

  const fullRes = await query(
    `
         SELECT
              dm.id,
              dm.sender_user_id,
              dm.recipient_user_id,
              dm.body,
              dm.image_url,
              dm.created_at,
              s.display_name AS sender_display_name,
              s.handle AS sender_handle,
              s.avatar_url AS sender_avatar,
              r.display_name AS recipient_display_name,
              r.handle AS recipient_handle,
              r.avatar_url AS recipient_avatar
            FROM direct_messages dm
            JOIN users s ON s.id = dm.sender_user_id
            JOIN users r ON r.id = dm.recipient_user_id
            WHERE dm.id = $1
            LIMIT 1
        `,
    [row.id]
  );

  const fullRow = fullRes.rows[0];

  if (!fullRow) {
    throw new Error("Failed to load inserted direct message (DM)");
  }

  return {
    id: fullRow.id as number,
    senderUserId: fullRow.sender_user_id as number,
    recipientUserId: fullRow.recipient_user_id as number,
    body: (fullRow.body as string) ?? null,
    imageUrl: (fullRow.image_url as string) ?? null,
    createdAt: (fullRow.created_at as Date).toISOString(),
    sender: {
      displayName: (fullRow.sender_display_name as string) ?? null,
      handle: (fullRow.sender_handle as string) ?? null,
      avatarUrl: (fullRow.sender_avatar as string) ?? null,
    },
    recipient: {
      displayName: (fullRow.recipient_display_name as string) ?? null,
      handle: (fullRow.recipient_handle as string) ?? null,
      avatarUrl: (fullRow.recipient_avatar as string) ?? null,
    },
  };
}
