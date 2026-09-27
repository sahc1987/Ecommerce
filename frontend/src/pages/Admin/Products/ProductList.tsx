import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import toast from "react-hot-toast";
import { Plus, Pencil, Trash2, Search, Package, Tag } from "lucide-react";
import api, { errorMessage } from "../../../api";
import ListContent from '../../../components/Admin/ListContent';
import { textOr } from '../../../utils/text';

export default function ProductList() {
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [pages, setPages] = useState(1);

  const fetchProducts = async (p = 1, s = search) => {
    setLoading(true);
    try {
      const res = await api.get("/products/admin/all", {
        params: { page: p, limit: 15, search: s || undefined },
      });
      setProducts(res.data.products);
      setTotal(res.data.total);
      setPages(res.data.pages);
    } catch {
      toast.error("Failed to load products");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProducts();
  }, []);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    fetchProducts(1, search);
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Delete "${name}"? This cannot be undone.`)) return;
    try {
      await api.delete(`/products/${id}`);
      toast.success("Product deleted");
      fetchProducts(page);
    } catch (err: any) {
      toast.error(errorMessage(err, "Delete failed"));
    }
  };

  const getEffectivePrice = (p: any) => {
    if (!p.discount_active || !p.discount_percent)
      return Number.parseFloat(p.price);
    const now = new Date();
    if (p.discount_start && new Date(p.discount_start) > now)
      return Number.parseFloat(p.price);
    if (p.discount_end && new Date(p.discount_end) < now)
      return Number.parseFloat(p.price);
    return (
      Number.parseFloat(p.price) *
      (1 - Number.parseFloat(p.discount_percent) / 100)
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Products</h1>
          <p className="text-slate-500 text-sm mt-0.5">{total} products total</p>
        </div>
        <Link
          to="/admin/products/new"
          className="btn-primary flex items-center gap-2"
        >
          <Plus size={16} />
          Add Product
        </Link>
      </div>

      <form onSubmit={handleSearch} className="flex gap-2">
        <div className="relative flex-1">
          <Search
            size={16}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
          />
          <input
            className="input pl-9"
            placeholder="Search products..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <button type="submit" className="btn-secondary">
          Search
        </button>
      </form>

      <div className="card p-0 overflow-hidden">
        <ListContent loading={loading} isEmpty={products.length === 0} emptyIcon={Package} emptyText="No products found">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="text-left px-6 py-3 font-medium text-slate-500">
                  Product
                </th>
                <th className="text-left px-6 py-3 font-medium text-slate-500 hidden md:table-cell">
                  Category
                </th>
                <th className="text-left px-6 py-3 font-medium text-slate-500">
                  Price
                </th>
                <th className="text-left px-6 py-3 font-medium text-slate-500 hidden sm:table-cell">
                  Stock
                </th>
                <th className="text-left px-6 py-3 font-medium text-slate-500">
                  Status
                </th>
                <th className="px-6 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {products.map((p) => {
                const effectivePrice = getEffectivePrice(p);
                const hasDiscount = effectivePrice < Number.parseFloat(p.price);
                return (
                  <tr key={p.id} className="hover:bg-slate-50">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-slate-100 rounded-lg overflow-hidden flex-shrink-0">
                          {p.primary_image ? (
                            <img
                              src={p.primary_image}
                              alt={p.name}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <Package
                              size={18}
                              className="m-auto text-slate-400 mt-2.5"
                            />
                          )}
                        </div>
                        <div>
                          <p className="font-medium text-slate-900 truncate max-w-[180px]">
                            {p.name}
                          </p>
                          {p.sku && (
                            <p className="text-xs text-slate-400">
                              SKU: {p.sku}
                            </p>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 hidden md:table-cell">
                      <div className="flex items-center gap-1.5">
                        <Tag size={13} className="text-slate-400" />
                        <span className="text-slate-600">
                          {textOr(p.category_name, "—")}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div>
                        <span className="font-medium text-slate-900">
                          ${effectivePrice.toFixed(2)}
                        </span>
                        {hasDiscount && (
                          <>
                            <span className="text-slate-400 line-through ml-1.5 text-xs">
                              ${Number.parseFloat(p.price).toFixed(2)}
                            </span>
                            <span className="ml-1.5 text-xs font-medium text-green-600">
                              -{p.discount_percent}%
                            </span>
                          </>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 hidden sm:table-cell">
                      <span
                        className={
                          p.stock <= 5
                            ? "text-red-600 font-medium"
                            : "text-slate-600"
                        }
                      >
                        {p.stock}
                      </span>
                      {p.reserved_stock > 0 && (
                        <span
                          className="ml-1.5 text-[11px] text-amber-600"
                          title="Units currently held in shoppers' carts (released after 3 minutes of inactivity)"
                        >
                          {p.reserved_stock} in carts
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={`badge ${p.is_active ? "bg-green-100 text-green-800" : "bg-slate-100 text-slate-600"}`}
                      >
                        {p.is_active ? "Active" : "Draft"}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2 justify-end">
                        <Link
                          to={`/admin/products/${p.id}/edit`}
                          className="p-1.5 text-slate-400 hover:text-primary-600 hover:bg-primary-50 rounded-lg transition-colors"
                        >
                          <Pencil size={15} />
                        </Link>
                        <button
                          onClick={() => handleDelete(p.id, p.name)}
                          className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </ListContent>
      </div>

      {pages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <button
            className="btn-secondary py-1.5 px-3 text-sm"
            disabled={page === 1}
            onClick={() => {
              setPage(page - 1);
              fetchProducts(page - 1);
            }}
          >
            Previous
          </button>
          <span className="text-sm text-slate-600">
            Page {page} of {pages}
          </span>
          <button
            className="btn-secondary py-1.5 px-3 text-sm"
            disabled={page === pages}
            onClick={() => {
              setPage(page + 1);
              fetchProducts(page + 1);
            }}
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}
