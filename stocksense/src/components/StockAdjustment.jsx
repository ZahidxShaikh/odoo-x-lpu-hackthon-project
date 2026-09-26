import { useState, useEffect } from "react";

export default function StockAdjustment() {
  const [products, setProducts] = useState([]);
  const [locations, setLocations] = useState([]);
  const [recent, setRecent] = useState([]);

  const [productId, setProductId] = useState("");
  const [locationId, setLocationId] = useState("");
  const [systemQty, setSystemQty] = useState(null);
  const [countedQty, setCountedQty] = useState("");

  useEffect(() => {
    fetch("/api/products").then((r) => r.json()).then(setProducts).catch(() => setProducts([]));
    fetch("/api/locations").then((r) => r.json()).then(setLocations).catch(() => setLocations([]));
    loadRecent();
  }, []);

  const loadRecent = () => {
    fetch("/api/adjustments?limit=10")
      .then((r) => r.json())
      .then(setRecent)
      .catch(() => setRecent([]));
  };

  useEffect(() => {
    if (!productId || !locationId) {
      setSystemQty(null);
      return;
    }
    fetch(`/api/stock-level?productId=${productId}&locationId=${locationId}`)
      .then((r) => r.json())
      .then((data) => setSystemQty(data.onHand))
      .catch(() => setSystemQty(null));
  }, [productId, locationId]);

  const difference =
    systemQty !== null && countedQty !== "" ? Number(countedQty) - systemQty : null;

  const applyAdjustment = async () => {
    if (!productId || !locationId || countedQty === "") return;
    await fetch("/api/adjustments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ productId, locationId, countedQty: Number(countedQty), systemQty }),
    });
    setCountedQty("");
    setSystemQty(null);
    setProductId("");
    setLocationId("");
    loadRecent();
  };

  return (
    <div className="p-6 space-y-6 max-w-2xl">
      <h1 className="text-2xl font-semibold text-slate-800">Stock Adjustment</h1>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Product</label>
            <select
              value={productId}
              onChange={(e) => setProductId(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            >
              <option value="">Select product</option>
              {products.map((p) => (
                <option key={p.id} value={p.id}>{p.name} ({p.sku})</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Warehouse / Location</label>
            <select
              value={locationId}
              onChange={(e) => setLocationId(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            >
              <option value="">Select location</option>
              {locations.map((l) => (
                <option key={l.id} value={l.id}>{l.warehouseName} / {l.name}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-4 items-end">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">System Quantity</label>
            <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600">
              {systemQty ?? "—"}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Physical Count</label>
            <input
              type="number"
              value={countedQty}
              onChange={(e) => setCountedQty(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Difference</label>
            <div
              className={`rounded-lg px-3 py-2 text-sm font-medium ${
                difference === null
                  ? "bg-slate-50 text-slate-400"
                  : difference > 0
                  ? "bg-emerald-50 text-emerald-700"
                  : difference < 0
                  ? "bg-red-50 text-red-700"
                  : "bg-slate-50 text-slate-500"
              }`}
            >
              {difference === null ? "—" : difference > 0 ? `+${difference}` : difference}
            </div>
          </div>
        </div>

        <button
          onClick={applyAdjustment}
          disabled={!productId || !locationId || countedQty === ""}
          className="rounded-lg bg-indigo-600 text-white px-4 py-2 text-sm font-medium hover:bg-indigo-700 disabled:opacity-50"
        >
          Apply Adjustment
        </button>
      </div>

      <div>
        <h2 className="text-lg font-semibold text-slate-800 mb-2">Recent Adjustments</h2>
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-500 text-left">
              <tr>
                <th className="px-4 py-2">Product</th>
                <th className="px-4 py-2">Location</th>
                <th className="px-4 py-2 text-right">System</th>
                <th className="px-4 py-2 text-right">Counted</th>
                <th className="px-4 py-2 text-right">Diff</th>
              </tr>
            </thead>
            <tbody>
              {recent.map((r) => (
                <tr key={r.id} className="border-t border-slate-100">
                  <td className="px-4 py-2">{r.productName}</td>
                  <td className="px-4 py-2">{r.locationName}</td>
                  <td className="px-4 py-2 text-right">{r.systemQty}</td>
                  <td className="px-4 py-2 text-right">{r.countedQty}</td>
                  <td
                    className={`px-4 py-2 text-right font-medium ${
                      r.countedQty - r.systemQty >= 0 ? "text-emerald-600" : "text-red-600"
                    }`}
                  >
                    {r.countedQty - r.systemQty > 0 ? "+" : ""}
                    {r.countedQty - r.systemQty}
                  </td>
                </tr>
              ))}
              {recent.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-6 text-center text-slate-400">
                    No adjustments yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
