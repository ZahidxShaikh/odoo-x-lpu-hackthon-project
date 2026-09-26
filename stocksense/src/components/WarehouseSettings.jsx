import { useState, useEffect } from "react";

function WarehouseForm({ onCreated }) {
  const [form, setForm] = useState({ name: "", shortCode: "", address: "" });

  const handleSubmit = async (e) => {
    e.preventDefault();
    await fetch("/api/warehouses", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    setForm({ name: "", shortCode: "", address: "" });
    onCreated();
  };

  return (
    <form onSubmit={handleSubmit} className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 space-y-3">
      <h2 className="font-medium text-slate-800">New Warehouse</h2>
      <input
        placeholder="Name"
        value={form.name}
        onChange={(e) => setForm({ ...form, name: e.target.value })}
        className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
      />
      <input
        placeholder="Short Code"
        value={form.shortCode}
        onChange={(e) => setForm({ ...form, shortCode: e.target.value })}
        className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
      />
      <input
        placeholder="Address"
        value={form.address}
        onChange={(e) => setForm({ ...form, address: e.target.value })}
        className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
      />
      <button
        type="submit"
        className="rounded-lg bg-indigo-600 text-white px-4 py-2 text-sm font-medium hover:bg-indigo-700"
      >
        Add Warehouse
      </button>
    </form>
  );
}

function LocationForm({ warehouses, onCreated }) {
  const [form, setForm] = useState({ name: "", shortCode: "", warehouseId: "" });

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.warehouseId) return;
    await fetch("/api/locations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    setForm({ name: "", shortCode: "", warehouseId: "" });
    onCreated();
  };

  return (
    <form onSubmit={handleSubmit} className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 space-y-3">
      <h2 className="font-medium text-slate-800">New Location</h2>
      <select
        value={form.warehouseId}
        onChange={(e) => setForm({ ...form, warehouseId: e.target.value })}
        className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
      >
        <option value="">Select parent warehouse</option>
        {warehouses.map((w) => (
          <option key={w.id} value={w.id}>{w.name}</option>
        ))}
      </select>
      <input
        placeholder="Location Name"
        value={form.name}
        onChange={(e) => setForm({ ...form, name: e.target.value })}
        className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
      />
      <input
        placeholder="Short Code"
        value={form.shortCode}
        onChange={(e) => setForm({ ...form, shortCode: e.target.value })}
        className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
      />
      <button
        type="submit"
        className="rounded-lg bg-indigo-600 text-white px-4 py-2 text-sm font-medium hover:bg-indigo-700"
      >
        Add Location
      </button>
    </form>
  );
}

export default function WarehouseSettings() {
  const [warehouses, setWarehouses] = useState([]);

  const loadWarehouses = () => {
    fetch("/api/warehouses?include=locations")
      .then((res) => res.json())
      .then(setWarehouses)
      .catch(() => setWarehouses([]));
  };

  useEffect(loadWarehouses, []);

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-semibold text-slate-800">Warehouses & Locations</h1>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <WarehouseForm onCreated={loadWarehouses} />
        <LocationForm warehouses={warehouses} onCreated={loadWarehouses} />
      </div>

      <div>
        <h2 className="text-lg font-semibold text-slate-800 mb-3">Hierarchy</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {warehouses.map((w) => (
            <div key={w.id} className="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-slate-800">{w.name}</h3>
                <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
                  {w.shortCode}
                </span>
              </div>
              {w.address && <p className="text-sm text-slate-500 mt-1">{w.address}</p>}

              <div className="mt-3 space-y-1">
                {(w.locations ?? []).map((l) => (
                  <div
                    key={l.id}
                    className="flex items-center justify-between text-sm rounded-lg bg-slate-50 px-3 py-2"
                  >
                    <span>{l.name}</span>
                    <span className="text-slate-400">{l.shortCode}</span>
                  </div>
                ))}
                {(w.locations ?? []).length === 0 && (
                  <p className="text-sm text-slate-400">No locations yet.</p>
                )}
              </div>
            </div>
          ))}
          {warehouses.length === 0 && (
            <p className="text-sm text-slate-400">No warehouses yet.</p>
          )}
        </div>
      </div>
    </div>
  );
}
