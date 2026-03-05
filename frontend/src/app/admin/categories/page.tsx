"use client";

import { apiGet, createBrowserApiClient } from "@/lib/api-client";
import { useAuth } from "@clerk/nextjs";
import axios from "axios";
import { Pencil, Plus, Save, Trash2, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

type Category = {
  id: number;
  slug: string;
  name: string;
  description: string | null;
};

const API = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:5000";

export default function AdminCategoriesPage() {
  const { getToken } = useAuth();
  const apiClient = useMemo(() => createBrowserApiClient(getToken), [getToken]);

  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);

  // ── New category form ──
  const [newSlug, setNewSlug] = useState("");
  const [newName, setNewName] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [creating, setCreating] = useState(false);

  // ── Inline edit state ──
  const [editId, setEditId] = useState<number | null>(null);
  const [editName, setEditName] = useState("");
  const [editDesc, setEditDesc] = useState("");
  const [saving, setSaving] = useState(false);

  async function authHeaders() {
    const token = await getToken();
    return { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
  }

  async function load() {
    setLoading(true);
    try {
      const data = await apiGet<Category[]>(apiClient, "/api/threads/categories");
      setCategories(data);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, [apiClient]);

  // ── Create ──────────────────────────────────────────────────────────────────
  async function handleCreate() {
    if (!newSlug.trim() || !newName.trim()) {
      toast.error("Slug and Name are required.");
      return;
    }
    setCreating(true);
    try {
      const headers = await authHeaders();
      const res = await axios.post<{ data: Category }>(
        `${API}/api/threads/categories`,
        { slug: newSlug.trim(), name: newName.trim(), description: newDesc.trim() || undefined },
        { headers }
      );
      setCategories((prev) => [...prev, res.data.data].sort((a, b) => a.name.localeCompare(b.name)));
      setNewSlug(""); setNewName(""); setNewDesc("");
      toast.success(`Category "${res.data.data.name}" created.`);
    } catch (err: any) {
      toast.error(err?.response?.data?.error ?? "Failed to create category.");
    } finally {
      setCreating(false);
    }
  }

  // ── Start editing ────────────────────────────────────────────────────────────
  function startEdit(cat: Category) {
    setEditId(cat.id);
    setEditName(cat.name);
    setEditDesc(cat.description ?? "");
  }

  // ── Save edit ────────────────────────────────────────────────────────────────
  async function handleSave(id: number) {
    setSaving(true);
    try {
      const headers = await authHeaders();
      const res = await axios.patch<{ data: Category }>(
        `${API}/api/threads/categories/${id}`,
        { name: editName.trim(), description: editDesc.trim() || undefined },
        { headers }
      );
      setCategories((prev) =>
        prev.map((c) => (c.id === id ? res.data.data : c))
      );
      setEditId(null);
      toast.success("Category updated.");
    } catch (err: any) {
      toast.error(err?.response?.data?.error ?? "Failed to update category.");
    } finally {
      setSaving(false);
    }
  }

  // ── Delete ───────────────────────────────────────────────────────────────────
  async function handleDelete(cat: Category) {
    if (!confirm(`Delete "${cat.name}"? This cannot be undone.`)) return;
    try {
      const headers = await authHeaders();
      await axios.delete(`${API}/api/threads/categories/${cat.id}`, { headers });
      setCategories((prev) => prev.filter((c) => c.id !== cat.id));
      toast.success(`"${cat.name}" deleted.`);
    } catch (err: any) {
      toast.error(err?.response?.data?.error ?? "Failed to delete category.");
    }
  }

  // ── Auto-generate slug from name ─────────────────────────────────────────────
  function handleNewNameChange(val: string) {
    setNewName(val);
    if (!newSlug) {
      setNewSlug(val.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, ""));
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-8 py-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">
          Manage Categories
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Add, edit or delete thread categories. Categories with existing threads cannot be deleted.
        </p>
      </div>

      {/* ── Add new category ── */}
      <div className="rounded-xl border border-border bg-card p-6 space-y-4">
        <h2 className="text-sm font-semibold text-foreground">Add New Category</h2>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">Name</label>
            <input
              value={newName}
              onChange={(e) => handleNewNameChange(e.target.value)}
              placeholder="e.g. Off Topic"
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">
              Slug <span className="text-muted-foreground/60">(auto-generated, must be unique)</span>
            </label>
            <input
              value={newSlug}
              onChange={(e) =>
                setNewSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))
              }
              placeholder="e.g. off-topic"
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
        </div>

        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground">Description (optional)</label>
          <input
            value={newDesc}
            onChange={(e) => setNewDesc(e.target.value)}
            placeholder="Short description shown to users"
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>

        <button
          onClick={handleCreate}
          disabled={creating}
          className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
        >
          <Plus className="w-4 h-4" />
          {creating ? "Creating..." : "Create Category"}
        </button>
      </div>

      {/* ── Existing categories ── */}
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <div className="border-b border-border px-6 py-4">
          <h2 className="text-sm font-semibold text-foreground">
            Existing Categories{" "}
            <span className="ml-1 rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
              {categories.length}
            </span>
          </h2>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <p className="text-sm text-muted-foreground">Loading...</p>
          </div>
        ) : categories.length === 0 ? (
          <div className="flex items-center justify-center py-12">
            <p className="text-sm text-muted-foreground">No categories yet.</p>
          </div>
        ) : (
          <ul className="divide-y divide-border">
            {categories.map((cat) => (
              <li key={cat.id} className="px-6 py-4">
                {editId === cat.id ? (
                  /* ── Edit mode ── */
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <span className="rounded-md bg-muted px-2 py-0.5 font-mono text-xs text-muted-foreground">
                        {cat.slug}
                      </span>
                      <span className="text-xs text-muted-foreground">(slug cannot be changed)</span>
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="space-y-1">
                        <label className="text-xs font-medium text-muted-foreground">Name</label>
                        <input
                          value={editName}
                          onChange={(e) => setEditName(e.target.value)}
                          className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs font-medium text-muted-foreground">Description</label>
                        <input
                          value={editDesc}
                          onChange={(e) => setEditDesc(e.target.value)}
                          className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                        />
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleSave(cat.id)}
                        disabled={saving}
                        className="flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                      >
                        <Save className="w-3 h-3" />
                        {saving ? "Saving..." : "Save"}
                      </button>
                      <button
                        onClick={() => setEditId(null)}
                        className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground hover:bg-accent"
                      >
                        <X className="w-3 h-3" />
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  /* ── View mode ── */
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium text-sm text-foreground">{cat.name}</span>
                        <span className="rounded-md bg-muted px-2 py-0.5 font-mono text-xs text-muted-foreground">
                          {cat.slug}
                        </span>
                      </div>
                      {cat.description && (
                        <p className="mt-1 text-xs text-muted-foreground">{cat.description}</p>
                      )}
                    </div>
                    <div className="flex shrink-0 items-center gap-1">
                      <button
                        onClick={() => startEdit(cat)}
                        className="flex items-center gap-1 rounded-lg border border-border px-2.5 py-1.5 text-xs text-muted-foreground hover:bg-accent hover:text-foreground"
                      >
                        <Pencil className="w-3 h-3" />
                        Edit
                      </button>
                      <button
                        onClick={() => handleDelete(cat)}
                        className="flex items-center gap-1 rounded-lg border border-destructive/40 px-2.5 py-1.5 text-xs text-destructive hover:bg-destructive/10"
                      >
                        <Trash2 className="w-3 h-3" />
                        Delete
                      </button>
                    </div>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
