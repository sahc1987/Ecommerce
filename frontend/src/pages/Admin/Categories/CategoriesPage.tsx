import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import {
  Plus,
  Pencil,
  Trash2,
  ChevronDown,
  ChevronRight,
  Tag,
} from "lucide-react";
import api from "../../../api";

interface Category {
  id: number;
  name: string;
  slug: string;
  description: string;
  image_url: string;
  subcategory_count: number;
}
interface Subcategory {
  id: number;
  name: string;
  slug: string;
  description: string;
}

type EditingItem = Category | Subcategory | null;

interface ModalState {
  type: "category" | "subcategory";
  editing: EditingItem;
  categoryId?: number;
}

export default function CategoriesPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [expanded, setExpanded] = useState<number | null>(null);
  const [subcategories, setSubcategories] = useState<
    Record<number, Subcategory[]>
  >({});
  const [loading, setLoading] = useState(true);

  // Modal state
  const [modal, setModal] = useState<ModalState | null>(null);
  const [form, setForm] = useState({ name: "", description: "" });
  const [saving, setSaving] = useState(false);
  const [imageFile, setImageFile] = useState<File | null>(null);

  const fetchCategories = async () => {
    const res = await api.get("/categories");
    setCategories(res.data.categories);
    setLoading(false);
  };

  useEffect(() => {
    fetchCategories();
  }, []);

  const toggleExpand = async (id: number) => {
    if (expanded === id) {
      setExpanded(null);
      return;
    }
    setExpanded(id);
    if (!subcategories[id]) {
      const res = await api.get(`/categories/${id}/subcategories`);
      setSubcategories((prev) => ({ ...prev, [id]: res.data.subcategories }));
    }
  };

  const openModal = (
    type: "category" | "subcategory",
    editing: EditingItem = null,
    categoryId?: number,
  ) => {
    setModal({ type, editing, categoryId });
    setForm({
      name: editing?.name || "",
      description: editing?.description || "",
    });
    setImageFile(null);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const fd = new FormData();
      fd.append("name", form.name);
      fd.append("description", form.description);
      if (imageFile) fd.append("image", imageFile);

      if (modal?.type === "category") {
        if (modal.editing) {
          await api.put(`/categories/${modal.editing.id}`, fd);
          toast.success("Category updated");
        } else {
          await api.post("/categories", fd);
          toast.success("Category created");
        }
        fetchCategories();
      } else {
        if (modal?.editing) {
          const res = await api.put(
            `/categories/subcategories/${modal.editing.id}`,
            form,
          );
          setSubcategories((prev) => ({
            ...prev,
            [modal.categoryId!]: prev[modal.categoryId!].map((s) =>
              s.id === modal.editing!.id ? res.data.subcategory : s,
            ),
          }));
          toast.success("Subcategory updated");
        } else {
          const res = await api.post(
            `/categories/${modal!.categoryId}/subcategories`,
            form,
          );
          setSubcategories((prev) => ({
            ...prev,
            [modal!.categoryId!]: [
              ...(prev[modal!.categoryId!] || []),
              res.data.subcategory,
            ],
          }));
          toast.success("Subcategory created");
        }
        fetchCategories();
      }
      setModal(null);
    } catch (err: any) {
      toast.error(err.response?.data?.error || "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteCategory = async (id: number, name: string) => {
    if (!confirm(`Delete category "${name}" and all its subcategories?`))
      return;
    try {
      await api.delete(`/categories/${id}`);
      setCategories((prev) => prev.filter((c) => c.id !== id));
      toast.success("Category deleted");
    } catch {
      toast.error("Delete failed");
    }
  };

  const handleDeleteSubcategory = async (
    catId: number,
    subId: number,
    name: string,
  ) => {
    if (!confirm(`Delete subcategory "${name}"?`)) return;
    try {
      await api.delete(`/categories/subcategories/${subId}`);
      setSubcategories((prev) => ({
        ...prev,
        [catId]: prev[catId].filter((s) => s.id !== subId),
      }));
      fetchCategories();
      toast.success("Subcategory deleted");
    } catch {
      toast.error("Delete failed");
    }
  };

  const categoryContent = (() => {
    if (loading) {
      return (
        <div className="flex items-center justify-center h-40">
          <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
        </div>
      );
    }
    if (categories.length === 0) {
      return (
        <div className="text-center py-16 text-gray-400">
          <Tag size={40} className="mx-auto mb-3 opacity-40" />
          <p>No categories yet</p>
        </div>
      );
    }
    return (
      <div className="divide-y divide-gray-100">
        {categories.map((cat) => (
          <div key={cat.id}>
            <div className="flex items-center gap-3 px-6 py-4 hover:bg-gray-50">
              <button
                onClick={() => toggleExpand(cat.id)}
                className="text-gray-400 hover:text-gray-600"
              >
                {expanded === cat.id ? (
                  <ChevronDown size={16} />
                ) : (
                  <ChevronRight size={16} />
                )}
              </button>
              {cat.image_url && (
                <img
                  src={cat.image_url}
                  alt={cat.name}
                  className="w-8 h-8 rounded-lg object-cover"
                />
              )}
              <div className="flex-1">
                <p className="font-medium text-gray-900">{cat.name}</p>
                <p className="text-xs text-gray-400">
                  {cat.subcategory_count} subcategories
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => openModal("subcategory", null, cat.id)}
                  className="text-xs text-blue-600 hover:underline font-medium px-2"
                >
                  + Subcategory
                </button>
                <button
                  onClick={() => openModal("category", cat)}
                  className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg"
                >
                  <Pencil size={14} />
                </button>
                <button
                  onClick={() => handleDeleteCategory(cat.id, cat.name)}
                  className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>

            {expanded === cat.id && (
              <div className="bg-gray-50 border-t border-gray-100">
                {(subcategories[cat.id] || []).length === 0 ? (
                  <p className="text-sm text-gray-400 px-16 py-3">
                    No subcategories
                  </p>
                ) : (
                  (subcategories[cat.id] || []).map((sub) => (
                    <div
                      key={sub.id}
                      className="flex items-center gap-3 px-16 py-3 hover:bg-gray-100 border-b border-gray-100 last:border-0"
                    >
                      <div className="flex-1">
                        <p className="text-sm font-medium text-gray-800">
                          {sub.name}
                        </p>
                        {sub.description && (
                          <p className="text-xs text-gray-400 truncate">
                            {sub.description}
                          </p>
                        )}
                      </div>
                      <button
                        onClick={() => openModal("subcategory", sub, cat.id)}
                        className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg"
                      >
                        <Pencil size={13} />
                      </button>
                      <button
                        onClick={() =>
                          handleDeleteSubcategory(cat.id, sub.id, sub.name)
                        }
                        className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    );
  })();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Categories</h1>
        <button
          onClick={() => openModal("category")}
          className="btn-primary flex items-center gap-2"
        >
          <Plus size={16} /> Add Category
        </button>
      </div>

      <div className="card p-0 overflow-hidden">{categoryContent}</div>

      {/* Modal */}
      {modal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => setModal(null)}
          />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
            <h2 className="text-lg font-bold text-gray-900 mb-5">
              {modal.editing ? "Edit" : "Add"}{" "}
              {modal.type === "category" ? "Category" : "Subcategory"}
            </h2>
            <form onSubmit={handleSave} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Name *
                </label>
                <input
                  className="input"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Description
                </label>
                <textarea
                  className="input resize-none h-20"
                  value={form.description}
                  onChange={(e) =>
                    setForm({ ...form, description: e.target.value })
                  }
                />
              </div>
              {modal.type === "category" && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Image
                  </label>
                  <input
                    type="file"
                    accept="image/*"
                    className="text-sm"
                    onChange={(e) => setImageFile(e.target.files?.[0] || null)}
                  />
                </div>
              )}
              <div className="flex gap-3 pt-2">
                <button
                  type="submit"
                  className="btn-primary flex-1"
                  disabled={saving}
                >
                  {saving ? "Saving..." : "Save"}
                </button>
                <button
                  type="button"
                  className="btn-secondary flex-1"
                  onClick={() => setModal(null)}
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
