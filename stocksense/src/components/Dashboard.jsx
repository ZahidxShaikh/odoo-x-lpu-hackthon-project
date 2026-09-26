import { useState, useEffect } from "react";

const DOC_TYPES = ["Receipts", "Delivery", "Internal", "Adjustments"];
const STATUSES = ["Draft", "Waiting", "Ready", "Done", "Canceled"];

function KpiCard({ label, value, accent }) {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
      <p className="text-sm text-slate-500">{label}</p>
      <p className={`text-3xl font-semibold mt-1 ${accent || "text-slate-800"}`}>
        {value}
      </p>
    </div>
  );
}

function QuickAction({ label, description, onClick }) {
  return (
    <button
      onClick={onClick}
      className="text-left bg-white rounded-xl shadow-sm border border-slate-200 p-4 hover:border-indigo-400 hover:shadow-md transition"
    >
      <p className="font-medium text-slate-800">{label}</p>
      <p className="text-sm text-slate-500 mt-1">{description}</p>
    </button>
  );
}

export default function Dashboard({ onNavigate }) {
  const [kpis, setKpis] = useState(null);
  const [filters, setFilters] = useState({
    docType: "",
    status: "",
    location: "",
    category: "",
  });

  useEffect(() => {
    const query = new URLSearchParams(filters).toString();

    fetch(`/api/dashboard/kpis?${query}`)
      .then((res) => res.json())
      .then(setKpis)
      .catch(() => setKpis(null));
  }, [filters]);

  const updateFilter = (key, value) => {
    setFilters((current) => ({ ...current, [key]: value }));
  };

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-800">Dashboard</h1>
        <p className="text-sm text-slate-500">
          Snapshot of your inventory operations
        </p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <KpiCard
          label="Total Products in Stock"
          value={kpis?.totalProducts ?? "—"}
        />
        <KpiCard
          label="Low / Out of Stock"
          value={kpis?.lowStock ?? "—"}
          accent="text-red-600"
        />
        <KpiCard
          label="Pending Receipts"
          value={kpis?.pendingReceipts ?? "—"}
        />
        <KpiCard
          label="Pending Deliveries"
          value={kpis?.pendingDeliveries ?? "—"}
        />
        <KpiCard
          label="Internal Transfers Scheduled"
          value={kpis?.scheduledTransfers ?? "—"}
        />
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 flex flex-wrap gap-3">
        <select
          value={filters.docType}
          onChange={(e) => updateFilter("docType", e.target.value)}
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
        >
          <option value="">Document Type</option>
          {DOC_TYPES.map((type) => (
            <option key={type} value={type}>
              {type}
            </option>
          ))}
        </select>

        <select
          value={filters.status}
          onChange={(e) => updateFilter("status", e.target.value)}
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
        >
          <option value="">Status</option>
          {STATUSES.map((status) => (
            <option key={status} value={status}>
              {status}
            </option>
          ))}
        </select>

        <select
          value={filters.location}
          onChange={(e) => updateFilter("location", e.target.value)}
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
        >
          <option value="">Warehouse / Location</option>
          {(kpis?.locations ?? []).map((location) => (
            <option key={location.id} value={location.id}>
              {location.name}
            </option>
          ))}
        </select>

        <select
          value={filters.category}
          onChange={(e) => updateFilter("category", e.target.value)}
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
        >
          <option value="">Product Category</option>
          {(kpis?.categories ?? []).map((category) => (
            <option key={category} value={category}>
              {category}
            </option>
          ))}
        </select>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <QuickAction
          label="New Receipt"
          description="Record incoming stock from a vendor"
          onClick={() => onNavigate("operations", { type: "RECEIPT" })}
        />
        <QuickAction
          label="New Delivery"
          description="Ship stock out to a customer"
          onClick={() => onNavigate("operations", { type: "DELIVERY" })}
        />
        <QuickAction
          label="New Internal Transfer"
          description="Move stock between locations"
          onClick={() => onNavigate("operations", { type: "INTERNAL" })}
        />
      </div>
    </div>
  );
}