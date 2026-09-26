import { useState, useEffect, useMemo } from "react";

const TYPE_BADGES = {
  RECEIPT: { label: "Incoming from Vendor", className: "bg-emerald-100 text-emerald-700" },
  DELIVERY: { label: "Outgoing to Customer", className: "bg-red-100 text-red-700" },
  INTERNAL: { label: "Internal Relocation", className: "bg-indigo-100 text-indigo-700" },
  ADJUSTMENT: { label: "Adjustment", className: "bg-amber-100 text-amber-700" },
};

function TypeBadge({ type }) {
  const meta = TYPE_BADGES[type] ?? { label: type, className: "bg-slate-100 text-slate-600" };
  return (
    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${meta.className}`}>
      {meta.label}
    </span>
  );
}

export default function MoveHistory() {
  const [moves, setMoves] = useState([]);
  const [query, setQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState("");

  useEffect(() => {
    fetch("/api/moves")
      .then((res) => res.json())
      .then(setMoves)
      .catch(() => setMoves([]));
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return moves.filter((m) => {
      const matchesQuery =
        !q ||
        m.reference.toLowerCase().includes(q) ||
        m.productSku.toLowerCase().includes(q) ||
        m.fromLocation?.toLowerCase().includes(q) ||
        m.toLocation?.toLowerCase().includes(q);
      const matchesType = !typeFilter || m.type === typeFilter;
      return matchesQuery && matchesType;
    });
  }, [moves, query, typeFilter]);

  return (
    <div className="p-6 space-y-4">
      <h1 className="text-2xl font-semibold text-slate-800">Move History</h1>
      <p className="text-sm text-slate-500">Immutable ledger of every stock movement.</p>

      <div className="flex flex-wrap gap-3">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by reference, SKU or location..."
          className="flex-1 min-w-[240px] rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
        />
        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
        >
          <option value="">All Types</option>
          {Object.keys(TYPE_BADGES).map((t) => (
            <option key={t} value={t}>{TYPE_BADGES[t].label}</option>
          ))}
        </select>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-slate-500 text-left">
            <tr>
              <th className="px-4 py-3">Reference</th>
              <th className="px-4 py-3">Date</th>
              <th className="px-4 py-3">Contact</th>
              <th className="px-4 py-3">From</th>
              <th className="px-4 py-3">To</th>
              <th className="px-4 py-3 text-right">Quantity</th>
              <th className="px-4 py-3">Type</th>
              <th className="px-4 py-3">Status</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((m) => (
              <tr key={m.id} className="border-t border-slate-100">
                <td className="px-4 py-3 font-medium text-slate-800">{m.reference}</td>
                <td className="px-4 py-3 text-slate-500">{m.date}</td>
                <td className="px-4 py-3">{m.contact ?? "—"}</td>
                <td className="px-4 py-3">{m.fromLocation ?? "—"}</td>
                <td className="px-4 py-3">{m.toLocation ?? "—"}</td>
                <td className="px-4 py-3 text-right">{m.quantity}</td>
                <td className="px-4 py-3"><TypeBadge type={m.type} /></td>
                <td className="px-4 py-3">{m.status}</td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-center text-slate-400">
                  No moves match your search.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
