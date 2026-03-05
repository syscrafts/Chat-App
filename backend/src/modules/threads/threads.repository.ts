import { query } from "../../db/db.js";
import { BadRequestError, NotFoundError } from "../../lib/errors.js";
import {
  Category,
  CategoryRow,
  mapCategoryRow,
  mapThreadDetailRow,
  mapThreadSummaryRow,
  ThreadDetail,
  ThreadDetailRow,
  ThreadListFilter,
  ThreadSummary,
  ThreadSummaryRow,
} from "./threads.types.js";

export function parseThreadListFilter(queryObj: {
  page?: unknown;
  pageSize?: unknown;
  category?: unknown;
  q?: unknown;
  sort?: unknown;
}): ThreadListFilter {
  const page = Number(queryObj.page) || 1;
  const rawPageSize = Number(queryObj.pageSize) || 20;
  const pageSize = Math.min(Math.max(rawPageSize, 1), 50);

  const categorySlug =
    typeof queryObj.category === "string" && queryObj.category.trim()
      ? queryObj.category.trim()
      : undefined;

  const search =
    typeof queryObj.q === "string" && queryObj.q.trim()
      ? queryObj.q.trim()
      : undefined;

  const sort: "new" | "old" = queryObj.sort === "old" ? "old" : "new";

  return {
    page,
    pageSize,
    search,
    sort,
    categorySlug,
  };
}

export async function listCategories(): Promise<Category[]> {
  const result = await query<CategoryRow>(
    `
        SELECT id, slug, name, description
        FROM categories
        ORDER BY name ASC
    `
  );

  return result.rows.map(mapCategoryRow);
}

export async function createdThread(params: {
  categorySlug: string;
  authorUserId: number;
  title: string;
  body: string;
}): Promise<ThreadDetail> {
  const { categorySlug, authorUserId, title, body } = params;

  const categoryRes = await query<{ id: number }>(
    `
        SELECT id
        FROM categories
        WHERE slug = $1
        LIMIT 1
        `,
    [categorySlug]
  );

  if (categoryRes.rows.length === 0) {
    throw new BadRequestError("Invalid category");
  }

  const categoryId = categoryRes.rows[0].id;

  const insertRes = await query<{ id: number }>(
    `
        INSERT INTO threads (category_id, author_user_id, title, body)
        values ($1, $2, $3, $4)
        RETURNING id
        `,
    [categoryId, authorUserId, title, body]
  );

  const threadId = insertRes.rows[0].id;

  return getThreadById(threadId);
}

export async function getThreadById(id: number): Promise<ThreadDetail> {
  const result = await query<ThreadDetailRow>(
    `
        SELECT
          t.id,
          t.title,
          t.body,
          t.created_at,
          t.updated_at,
          c.slug AS category_slug,
          c.name AS category_name,
          u.display_name AS author_display_name,
          u.handle AS author_handle
        FROM threads t
        JOIN categories c ON c.id = t.category_id
        JOIN users u ON u.id = t.author_user_id
        WHERE t.id = $1
        LIMIT 1
        `,
    [id]
  );

  const row = result.rows[0];

  if (!row) {
    throw new NotFoundError("Thread not found");
  }

  return mapThreadDetailRow(row);
}

export async function listThreads(
  filter: ThreadListFilter
): Promise<ThreadSummary[]> {
  const { page, pageSize, categorySlug, sort, search } = filter;

  const conditions: string[] = [];

  const params: unknown[] = [];

  let idx = 1;

  if (categorySlug) {
    conditions.push(`c.slug = $${idx++}`);
    params.push(categorySlug);
  }

  if (search) {
    conditions.push(`(t.title ILIKE $${idx} OR t.body ILIKE $${idx})`);

    params.push(`%${search}%`);

    idx++;
  }

  const whereClause = conditions.length
    ? `WHERE ${conditions.join(" AND ")}`
    : "";

  const orderClause =
    sort === "old" ? "ORDER BY t.created_at ASC" : "ORDER BY t.created_at DESC";

  const offset = (page - 1) * pageSize;

  params.push(pageSize, offset);

  const result = await query<ThreadSummaryRow>(
    `
    SELECT 
      t.id,
      t.title,
      LEFT(t.body, 200) AS excerpt,
      t.created_at,
      c.slug AS category_slug,
      c.name AS category_name,
      u.display_name AS author_display_name,
      u.handle AS author_handle
    FROM threads t
    JOIN categories c ON c.id = t.category_id
    JOIN users u ON u.id = t.author_user_id
    ${whereClause}
    ${orderClause}
    LIMIT $${idx++} OFFSET $${idx}
    `,
    params
  );

  return result.rows.map(mapThreadSummaryRow);
}

// ─── Category CRUD ────────────────────────────────────────────────────────────

export async function createCategory(params: {
  slug: string;
  name: string;
  description?: string;
}): Promise<Category> {
  const { slug, name, description } = params;
  const result = await query<CategoryRow>(
    `INSERT INTO categories (slug, name, description)
     VALUES ($1, $2, $3)
     RETURNING id, slug, name, description`,
    [slug.toLowerCase().trim(), name.trim(), description?.trim() ?? null]
  );
  return mapCategoryRow(result.rows[0]);
}

export async function updateCategory(params: {
  id: number;
  name?: string;
  description?: string;
}): Promise<Category> {
  const { id, name, description } = params;
  const setClauses: string[] = [];
  const values: unknown[] = [id];
  let idx = 2;

  if (name !== undefined) { setClauses.push(`name = $${idx++}`); values.push(name.trim()); }
  if (description !== undefined) { setClauses.push(`description = $${idx++}`); values.push(description.trim()); }

  if (setClauses.length === 0) throw new BadRequestError("Nothing to update");

  const result = await query<CategoryRow>(
    `UPDATE categories SET ${setClauses.join(", ")} WHERE id = $1
     RETURNING id, slug, name, description`,
    values
  );
  if (result.rows.length === 0) throw new NotFoundError("Category not found");
  return mapCategoryRow(result.rows[0]);
}

export async function deleteCategory(id: number): Promise<void> {
  // Prevent deletion if threads exist under this category
  const threadCount = await query<{ count: string }>(
    `SELECT COUNT(*) AS count FROM threads WHERE category_id = $1`, [id]
  );
  if (Number(threadCount.rows[0].count) > 0) {
    throw new BadRequestError(
      "Cannot delete a category that has threads. Move or delete the threads first."
    );
  }
  const result = await query(`DELETE FROM categories WHERE id = $1`, [id]);
  if ((result as any).rowCount === 0) throw new NotFoundError("Category not found");
}
