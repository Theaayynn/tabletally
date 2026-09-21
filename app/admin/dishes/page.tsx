"use client";

import { useEffect, useState } from "react";
import { Plus, UtensilsCrossed, Pencil, Trash2 } from "lucide-react";
import { Card, Badge } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Modal, ConfirmDialog } from "@/components/ui/Modal";
import { Input, Label, FieldGroup, Select } from "@/components/ui/Input";
import { Spinner, ErrorState, EmptyState } from "@/components/ui/States";
import { useToast } from "@/components/ui/Toast";
import { api, ApiError } from "@/lib/api-client";
import { formatMoney } from "@/lib/money";

interface Item {
  id: string;
  name: string;
  price: string;
  costPrice: string | null;
  sku: string | null;
  isActive: boolean;
  categoryId: string;
  categoryName: string;
}
interface Category {
  id: string;
  name: string;
}

export default function DishesPage() {
  const { notify } = useToast();
  const [tab, setTab] = useState<"dishes" | "categories">("dishes");
  const [items, setItems] = useState<Item[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [itemModalOpen, setItemModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<Item | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Item | null>(null);
  const [deleting, setDeleting] = useState(false);

  const [catModalOpen, setCatModalOpen] = useState(false);
  const [catName, setCatName] = useState("");

  const [form, setForm] = useState({ name: "", categoryId: "", price: "", costPrice: "", sku: "" });
  const [saving, setSaving] = useState(false);

  function load() {
    setLoading(true);
    Promise.all([
      api.get<{ items: Item[] }>("/api/items?activeOnly=false"),
      api.get<{ categories: Category[] }>("/api/categories"),
    ])
      .then(([i, c]) => {
        setItems(i.items);
        setCategories(c.categories);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }
  useEffect(load, []);

  function openCreateItem() {
    setEditingItem(null);
    setForm({ name: "", categoryId: categories[0]?.id ?? "", price: "", costPrice: "", sku: "" });
    setItemModalOpen(true);
  }
  function openEditItem(it: Item) {
    setEditingItem(it);
    setForm({
      name: it.name,
      categoryId: it.categoryId,
      price: it.price,
      costPrice: it.costPrice ?? "",
      sku: it.sku ?? "",
    });
    setItemModalOpen(true);
  }

  async function saveItem(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = {
        name: form.name,
        categoryId: form.categoryId,
        price: parseFloat(form.price),
        costPrice: form.costPrice ? parseFloat(form.costPrice) : null,
        sku: form.sku || null,
      };
      if (editingItem) {
        await api.patch(`/api/items/${editingItem.id}`, payload);
        notify("Dish updated.");
      } else {
        await api.post("/api/items", payload);
        notify("Dish added.");
      }
      setItemModalOpen(false);
      load();
    } catch (err) {
      notify(err instanceof ApiError ? err.message : "Could not save dish.", "error");
    } finally {
      setSaving(false);
    }
  }

  async function toggleItemActive(it: Item) {
    try {
      await api.patch(`/api/items/${it.id}`, { isActive: !it.isActive });
      notify(it.isActive ? "Dish disabled." : "Dish enabled.");
      load();
    } catch (err) {
      notify(err instanceof ApiError ? err.message : "Could not update.", "error");
    }
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const res = await api.delete<{ disabledInstead?: boolean; message?: string }>(`/api/items/${deleteTarget.id}`);
      notify(res.disabledInstead ? res.message ?? "Dish disabled." : "Dish deleted.");
      setDeleteTarget(null);
      load();
    } catch (err) {
      notify(err instanceof ApiError ? err.message : "Could not delete.", "error");
    } finally {
      setDeleting(false);
    }
  }

  async function createCategory(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await api.post("/api/categories", { name: catName });
      notify("Category added.");
      setCatModalOpen(false);
      setCatName("");
      load();
    } catch (err) {
      notify(err instanceof ApiError ? err.message : "Could not add category.", "error");
    } finally {
      setSaving(false);
    }
  }

  async function deleteCategory(c: Category) {
    try {
      await api.delete(`/api/categories/${c.id}`);
      notify("Category deleted.");
      load();
    } catch (err) {
      notify(err instanceof ApiError ? err.message : "Could not delete category.", "error");
    }
  }

  return (
    <div>
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-ink-900">Dishes & Menu</h1>
          <p className="text-sm text-ink-500">Manage what executives can sell, and its price.</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex rounded-xl bg-slate-100 p-1 text-sm font-medium">
            <button
              onClick={() => setTab("dishes")}
              className={`rounded-lg px-3 py-1.5 ${tab === "dishes" ? "bg-white text-brand-700 shadow-sm" : "text-ink-500"}`}
            >
              Dishes
            </button>
            <button
              onClick={() => setTab("categories")}
              className={`rounded-lg px-3 py-1.5 ${tab === "categories" ? "bg-white text-brand-700 shadow-sm" : "text-ink-500"}`}
            >
              Categories
            </button>
          </div>
          <Button
            onClick={tab === "dishes" ? openCreateItem : () => setCatModalOpen(true)}
            disabled={tab === "dishes" && categories.length === 0}
          >
            <Plus className="h-4 w-4" />
            {tab === "dishes" ? "Add Dish" : "Add Category"}
          </Button>
        </div>
      </div>

      {loading && <Spinner />}
      {!loading && error && <ErrorState message={error} onRetry={load} />}

      {!loading && !error && tab === "dishes" && categories.length === 0 && (
        <EmptyState title="Add a category first" description="Dishes need a category, like Main Course or Drinks." />
      )}

      {!loading && !error && tab === "dishes" && categories.length > 0 && (
        <>
          {items.length === 0 ? (
            <EmptyState icon={UtensilsCrossed} title="No dishes yet" action={{ label: "Add Dish", onClick: openCreateItem }} />
          ) : (
            <Card className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-100 text-xs text-ink-300">
                    <th className="px-4 py-3 font-medium">Dish</th>
                    <th className="px-4 py-3 font-medium">Category</th>
                    <th className="px-4 py-3 font-medium">Price</th>
                    <th className="px-4 py-3 font-medium">Status</th>
                    <th className="px-4 py-3 font-medium text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((it) => (
                    <tr key={it.id} className="border-b border-slate-50 last:border-0">
                      <td className="px-4 py-3 font-medium text-ink-900">{it.name}</td>
                      <td className="px-4 py-3 text-ink-500">{it.categoryName}</td>
                      <td className="px-4 py-3 text-ink-700">{formatMoney(it.price, { decimals: true })}</td>
                      <td className="px-4 py-3">
                        <button onClick={() => toggleItemActive(it)}>
                          <Badge tone={it.isActive ? "success" : "neutral"}>{it.isActive ? "Active" : "Disabled"}</Badge>
                        </button>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex justify-end gap-1.5">
                          <Button size="sm" variant="ghost" onClick={() => openEditItem(it)}>
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => setDeleteTarget(it)}>
                            <Trash2 className="h-3.5 w-3.5 text-rose-500" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Card>
          )}
        </>
      )}

      {!loading && !error && tab === "categories" && (
        <Card className="overflow-hidden">
          {categories.length === 0 ? (
            <EmptyState title="No categories yet" action={{ label: "Add Category", onClick: () => setCatModalOpen(true) }} />
          ) : (
            <ul className="divide-y divide-slate-100">
              {categories.map((c) => (
                <li key={c.id} className="flex items-center justify-between px-4 py-3 text-sm">
                  <span className="font-medium text-ink-900">{c.name}</span>
                  <Button size="sm" variant="ghost" onClick={() => deleteCategory(c)}>
                    <Trash2 className="h-3.5 w-3.5 text-rose-500" />
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </Card>
      )}

      <Modal open={itemModalOpen} onClose={() => setItemModalOpen(false)} title={editingItem ? "Edit Dish" : "Add Dish"}>
        <form onSubmit={saveItem}>
          <FieldGroup>
            <Label>Dish name</Label>
            <Input required value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
          </FieldGroup>
          <FieldGroup>
            <Label>Category</Label>
            <Select
              required
              value={form.categoryId}
              onChange={(e) => setForm((f) => ({ ...f, categoryId: e.target.value }))}
            >
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
          </FieldGroup>
          <div className="grid grid-cols-2 gap-3">
            <FieldGroup>
              <Label>Selling price (₹)</Label>
              <Input
                type="number"
                step="0.01"
                min="0"
                required
                value={form.price}
                onChange={(e) => setForm((f) => ({ ...f, price: e.target.value }))}
              />
            </FieldGroup>
            <FieldGroup>
              <Label>Cost price (optional)</Label>
              <Input
                type="number"
                step="0.01"
                min="0"
                value={form.costPrice}
                onChange={(e) => setForm((f) => ({ ...f, costPrice: e.target.value }))}
              />
            </FieldGroup>
          </div>
          <FieldGroup>
            <Label>SKU / item code (optional)</Label>
            <Input value={form.sku} onChange={(e) => setForm((f) => ({ ...f, sku: e.target.value }))} />
          </FieldGroup>
          <Button type="submit" className="w-full" loading={saving}>
            {editingItem ? "Save Changes" : "Add Dish"}
          </Button>
        </form>
      </Modal>

      <Modal open={catModalOpen} onClose={() => setCatModalOpen(false)} title="Add Category">
        <form onSubmit={createCategory}>
          <FieldGroup>
            <Label>Category name</Label>
            <Input required value={catName} onChange={(e) => setCatName(e.target.value)} placeholder="e.g. Starters" />
          </FieldGroup>
          <Button type="submit" className="w-full" loading={saving}>
            Add Category
          </Button>
        </form>
      </Modal>

      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={confirmDelete}
        title="Delete dish"
        description={`Delete "${deleteTarget?.name}"? If it has sales history, it will be disabled instead.`}
        loading={deleting}
      />
    </div>
  );
}
