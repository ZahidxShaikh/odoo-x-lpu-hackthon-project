import { useState, useEffect, useMemo } from "react";

const EMPTY_PRODUCT = {
  name: "",
  sku: "",
  category: "",
  unitOfMeasure: "",
  unitCost: "",
  reorderLevel: 0,
  initialStock: 0,
};

function LowStockBadge({ onHand, reorderLevel }) {
  if (onHand <= 0) {
    return <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700">Out of stock</span>;
  }
  if (onHand <= reorderLevel) {
    return <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-700">Low stock</span>;
  }
  return <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-700">In stock</span>;
}

function ProductDrawer({ initial, onClose, onSave }) {
  const [form, setForm] = useState(initial || EMPTY_PRODUCT);

  const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave(form);
  };

  return (
    <div className="fixed inset-0 bg-black/30 flex justify-end z-50">
      <div className="w-full max-w-md bg-white h-full p-6 overflow-y-auto shadow-xl">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-semibold text-slate-800">
            {initial ? "Edit Product" : "New Product"}
          </h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">✕</button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          {[
            ["name", "Name"],
            ["sku", "SKU"],
            ["category", "Category"],
            ["unitOfMeasure", "Unit of Measure"],
            ["unitCost", "Unit Cost"],
            ["reorderLevel", "Reorder Level"],
            ["initialStock", "Initial Stock"],
          ].map(([key, label]) => (
            <div key={key}>
              <label className="block text-sm font-medium text-slate-700 mb-1">{label}</label>
              <input
                name={key}
                value={form[key]}
                onChange={handleChange}
                type={["unitCost", "reorderLevel", "initialStock"].includes(key) ? "number" : "text"}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          ))}

          <button
            type="submit"
            className="w-full rounded-lg bg-indigo-600 text-white py-2 text-sm font-medium hover:bg-indigo-700 mt-2"
          >
            Save Product
          </button>
        </form>
      </div>
    </div>
  );
}

function StockDrilldown({ product, onClose }) {
  const [breakdown, setBreakdown] = useState([]);

  useEffect(() => {
    fetch(`/api/products/${product.id}/stock-by-location`)
      .then((res) => res.json())
      .then(setBreakdown)
      .catch(() => setBreakdown([]));
  }, [product.id]);

  return (
    <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-semibold text-slate-800">{product.name} — Stock by Location</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">✕</button>
        </div>

        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-slate-500 border-b">
              <th className="py-2">Warehouse</th>
              <th className="py-2">Rack / Location</th>
              <th className="py-2 text-right">On Hand</th>
            </tr>
          </thead>
          <tbody>
            {breakdown.map((row) => (
              <tr key={row.locationId} className="border-b last:border-0">
                <td className="py-2">{row.warehouseName}</td>
                <td className="py-2">{row.locationName}</td>
                <td className="py-2 text-right">{row.onHand}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function ProductCatalog() {
  const [products, setProducts] = useState([]);
  const [search, setSearch] = useState("");
  const [editingProduct, setEditingProduct] = useState(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drilldownProduct, setDrilldownProduct] = useState(null);

  const loadProducts = () => {
    fetch("/api/products")
      .then((res) => res.json())
      .then(setProducts)
      .catch(() => setProducts([]));
  };

  useEffect(loadProducts, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return products;
    return products.filter(
      (p) => p.name.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q)
    );
  }, [products, search]);

  const openNew = () => {
    setEditingProduct(null);
    setDrawerOpen(true);
  };

  const openEdit = (product) => {
    setEditingProduct(product);
    setDrawerOpen(true);
  };

  const saveProduct = async (form) => {
    const isEdit = Boolean(editingProduct);
    await fetch(isEdit ? `/api/products/${editingProduct.id}` : "/api/products", {
      method: isEdit ? "PUT" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    setDrawerOpen(false);
    loadProducts();
  };

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-slate-800">Products</h1>
        <button
          onClick={openNew}
          className="rounded-lg bg-indigo-600 text-white px-4 py-2 text-sm font-medium hover:bg-indigo-700"
        >
          + New Product
        </button>
      </div>

      <input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search by name or SKU..."
        className="w-full max-w-sm rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
      />

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-slate-500 text-left">
            <tr>
              <th className="px-4 py-3">Name</th>
              <th className="px-4 py-3">SKU</th>
              <th className="px-4 py-3">Category</th>
              <th className="px-4 py-3">UoM</th>
              <th className="px-4 py-3 text-right">On Hand</th>
              <th className="px-4 py-3 text-right">Free to Use</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((p) => (
              <tr
                key={p.id}
                className="border-t border-slate-100 hover:bg-slate-50 cursor-pointer"
                onClick={() => setDrilldownProduct(p)}
              >
                <td className="px-4 py-3 font-medium text-slate-800">{p.name}</td>
                <td className="px-4 py-3 text-slate-500">{p.sku}</td>
                <td className="px-4 py-3">{p.category}</td>
                <td className="px-4 py-3">{p.unitOfMeasure}</td>
                <td className="px-4 py-3 text-right">{p.onHand}</td>
                <td className="px-4 py-3 text-right">{p.onHand - p.allocated}</td>
                <td className="px-4 py-3">
                  <LowStockBadge onHand={p.onHand} reorderLevel={p.reorderLevel} />
                </td>
                <td className="px-4 py-3 text-right">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      openEdit(p);
                    }}
                    className="text-indigo-600 hover:underline"
                  >
                    Edit
                  </button>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-center text-slate-400">
                  No products found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {drawerOpen && (
        <ProductDrawer
          initial={editingProduct}
          onClose={() => setDrawerOpen(false)}
          onSave={saveProduct}
        />
      )}

      {drilldownProduct && (
        <StockDrilldown product={drilldownProduct} onClose={() => setDrilldownProduct(null)} />
      )}
    </div>
  );
}
