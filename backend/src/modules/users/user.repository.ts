import { query } from "../../db/db.js";
import { User, UserRow } from "./user.types.js";

function hydrateUser(row: UserRow): User {
  return {
    id: row.id,
    clerkUserId: row.clerk_user_id,
    displayName: row.display_name,
    handle: row.handle,
    bio: row.bio,
    avatarUrl: row.avatar_url,
    publicKey: row.public_key ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function upsertUserFromClerkProfile(params: {
  clerkUserId: string;
  displayName: string | null;
  avatarUrl: string | null;
}): Promise<User> {
  const { clerkUserId, displayName, avatarUrl } = params;

  const result = await query<UserRow>(
    `
        INSERT INTO users (clerk_user_id, display_name, avatar_url)
        VALUES ($1, $2, $3)
        ON CONFLICT (clerk_user_id)
        DO UPDATE SET
           updated_at   = NOW()
        RETURNING
           id,
           clerk_user_id,
           display_name,
           handle,
           avatar_url,
           bio,
           public_key,
           created_at,
           updated_at
        `,
    [clerkUserId, displayName, avatarUrl]
  );

  return hydrateUser(result.rows[0]);
}

export async function repoUpdateUserProfile(params: {
  clerkUserId: string;
  displayName?: string;
  handle?: string;
  bio?: string;
  avatarUrl?: string;
}): Promise<User> {
  const { clerkUserId, displayName, handle, bio, avatarUrl } = params;

  console.log(clerkUserId, displayName, handle, bio, avatarUrl);

  const setClauses: string[] = [];
  const values: unknown[] = [clerkUserId];
  let idx = 2;

  if (typeof displayName !== undefined) {
    setClauses.push(`display_name = $${idx++}`);
    values.push(displayName);
  }

  if (typeof handle !== undefined) {
    setClauses.push(`handle = $${idx++}`);
    values.push(handle);
  }

  if (typeof bio !== undefined) {
    setClauses.push(`bio = $${idx++}`);
    values.push(bio);
  }

  if (typeof avatarUrl !== undefined) {
    setClauses.push(`avatar_url = $${idx++}`);
    values.push(avatarUrl);
  }

  setClauses.push(`updated_at = NOW()`);

  const result = await query<UserRow>(
    `
      UPDATE users
      SET ${setClauses.join(", ")}
      WHERE clerk_user_id = $1
      RETURNING
        id,
        clerk_user_id,
        display_name,
        handle,
        avatar_url,
        bio,
        public_key,
        created_at,
        updated_at
      `,
    values
  );
  console.log(result);

  if (result.rows.length === 0) {
    throw new Error(`no user found for clerk user id= ${clerkUserId}`);
  }

  return hydrateUser(result.rows[0]);
}

export async function repoSavePublicKey(params: {
  clerkUserId: string;
  publicKey: string;
}): Promise<User> {
  const { clerkUserId, publicKey } = params;

  const result = await query<UserRow>(
    `
      UPDATE users
      SET public_key = $2, updated_at = NOW()
      WHERE clerk_user_id = $1
      RETURNING
        id,
        clerk_user_id,
        display_name,
        handle,
        avatar_url,
        bio,
        public_key,
        created_at,
        updated_at
    `,
    [clerkUserId, publicKey]
  );

  if (result.rows.length === 0) {
    throw new Error(`no user found for clerk user id= ${clerkUserId}`);
  }

  return hydrateUser(result.rows[0]);
}

export async function repoGetPublicKeyByUserId(userId: number): Promise<string | null> {
  const result = await query<{ public_key: string | null }>(
    `SELECT public_key FROM users WHERE id = $1`,
    [userId]
  );

  return result.rows[0]?.public_key ?? null;
}
