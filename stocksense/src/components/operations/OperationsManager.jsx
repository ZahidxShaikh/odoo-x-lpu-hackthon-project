import { useState, useEffect } from "react";

const STAGES = {
  RECEIPT: ["DRAFT", "READY", "DONE"],
  DELIVERY: ["DRAFT", "WAITING", "READY", "DONE"],
  INTERNAL: ["DRAFT", "WAITING", "READY", "DONE"],
};

const TYPE_LABELS = {
  RECEIPT: "Receipt",
  DELIVERY: "Delivery Order",
  INTERNAL: "Internal Transfer",
};

function ProgressBar({ type, status }) {
  const stages = STAGES[type];
  const currentIndex = stages.indexOf(status);

  return (
    <div className="flex items-center gap-2">
      {stages.map((stage, i) => (
        <div key={stage} className="flex items-center gap-2">
          <div
            className={`px-3 py-1 rounded-full text-xs font-medium ${
              i <= currentIndex
                ? "bg-indigo-600 text-white"
                : "bg-slate-100 text-slate-400"
            }`}
          >
            {stage}
          </div>
          {i < stages.length - 1 && <div className="w-6 h-px bg-slate-300" />}
        </div>
      ))}
    </div>
  );
}

function MoveLinesTable({ lines, onChange, allowEdit }) {
  const updateLine = (id, field, value) => {
    onChange(lines.map((line) => (line.id === id ? { ...line, [field]: value } : line)));
  };

  const addLine = () => {
    onChange([
      ...lines,
      { id: crypto.randomUUID(), productId: "", productName: "", quantity: 1 },
    ]);
  };

  const removeLine = (id) => {
    onChange(lines.filter((line) => line.id !== id));
  };

  return (
    <div className="border border-slate-200 rounded-lg overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-slate-50 text-slate-500 text-left">
          <tr>
            <th className="px-3 py-2">Product</th>
            <th className="px-3 py-2 text-right">Quantity</th>
            {allowEdit && <th className="px-3 py-2"></th>}
          </tr>
        </thead>
        <tbody>
          {lines.map((line) => (
            <tr key={line.id} className="border-t border-slate-100">
              <td className="px-3 py-2">
                <input
                  value={line.productName}
                  disabled={!allowEdit}
                  onChange={(e) =>
                    updateLine(line.id, "productName", e.target.value)
                  }
                  placeholder="Search product..."
                  className="w-full rounded-md border border-slate-300 px-2 py-1 disabled:bg-slate-50"
                />
              </td>
              <td className="px-3 py-2 text-right">
                <input
                  type="number"
                  min={1}
                  value={line.quantity}
                  disabled={!allowEdit}
                  onChange={(e) =>
                    updateLine(line.id, "quantity", Number(e.target.value))
                  }
                  className="w-24 rounded-md border border-slate-300 px-2 py-1 text-right disabled:bg-slate-50"
                />
              </td>
              {allowEdit && (
                <td className="px-3 py-2 text-right">
                  <button
                    onClick={() => removeLine(line.id)}
                    className="text-red-500 hover:underline"
                  >
                    Remove
                  </button>
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>

      {allowEdit && (
        <button
          onClick={addLine}
          className="w-full text-left px-3 py-2 text-sm text-indigo-600 hover:bg-indigo-50"
        >
          + Add product
        </button>
      )}
    </div>
  );
}

export default function OperationsManager({
  type = "RECEIPT",
  operationId,
  onDone,
}) {
  const [operation, setOperation] = useState(null);
  const [lines, setLines] = useState([
    { id: crypto.randomUUID(), productName: "", quantity: 1 },
  ]);
  const [contact, setContact] = useState("");
  const [fromLocation, setFromLocation] = useState("");
  const [toLocation, setToLocation] = useState("");
  const [scheduledDate, setScheduledDate] = useState("");

  useEffect(() => {
    if (!operationId) return;

    fetch(`/api/operations/${operationId}`)
      .then((res) => res.json())
      .then((data) => {
        setOperation(data);
        setLines(data.lines);
        setContact(data.contact ?? "");
        setFromLocation(data.fromLocationId ?? "");
        setToLocation(data.toLocationId ?? "");
        setScheduledDate(data.scheduledDate ?? "");
      });
  }, [operationId]);

  const status = operation?.status ?? "DRAFT";
  const isEditable = status === "DRAFT";

  const persist = async (nextStatus) => {
    const payload = {
      type,
      status: nextStatus,
      contact,
      fromLocation,
      toLocation,
      scheduledDate,
      lines,
    };

    const res = await fetch(
      operationId ? `/api/operations/${operationId}` : "/api/operations",
      {
        method: operationId ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      }
    );

    const data = await res.json();
    setOperation(data);
  };

  const validate = () => persist(type === "RECEIPT" ? "DONE" : "WAITING");

  const advance = () => {
    const stages = STAGES[type];
    const next = stages[Math.min(stages.indexOf(status) + 1, stages.length - 1)];
    persist(next);
  };

  const cancel = () => persist("CANCELED");

  return (
    <div className="p-6 space-y-4 max-w-3xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-800">
            {TYPE_LABELS[type]} {operation?.reference && `— ${operation.reference}`}
          </h1>
          <p className="text-sm text-slate-500">
            {type === "RECEIPT" && "Receive stock from a vendor into a location."}
            {type === "DELIVERY" && "Pick, pack and ship stock to a customer."}
            {type === "INTERNAL" && "Move stock between two locations."}
          </p>
        </div>
        <ProgressBar type={type} status={status} />
      </div>

      <div className="flex gap-2">
        {isEditable && status !== "DONE" && (
          <button
            onClick={validate}
            className="rounded-lg bg-emerald-600 text-white px-4 py-2 text-sm font-medium hover:bg-emerald-700"
          >
            Validate
          </button>
        )}

        {!isEditable && status !== "DONE" && status !== "CANCELED" && (
          <button
            onClick={advance}
            className="rounded-lg bg-indigo-600 text-white px-4 py-2 text-sm font-medium hover:bg-indigo-700"
          >
            Mark {STAGES[type][STAGES[type].indexOf(status) + 1]}
          </button>
        )}

        <button
          onClick={cancel}
          disabled={status === "DONE" || status === "CANCELED"}
          className="rounded-lg border border-red-300 text-red-600 px-4 py-2 text-sm font-medium hover:bg-red-50 disabled:opacity-50"
        >
          Cancel
        </button>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              {type === "RECEIPT"
                ? "Vendor / Contact"
                : type === "DELIVERY"
                  ? "Customer / Contact"
                  : "Reason"}
            </label>
            <input
              value={contact}
              disabled={!isEditable}
              onChange={(e) => setContact(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm disabled:bg-slate-50"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Scheduled Date
            </label>
            <input
              type="date"
              value={scheduledDate}
              disabled={!isEditable}
              onChange={(e) => setScheduledDate(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm disabled:bg-slate-50"
            />
          </div>

          {type !== "RECEIPT" && (
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                From Location
              </label>
              <input
                value={fromLocation}
                disabled={!isEditable}
                onChange={(e) => setFromLocation(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm disabled:bg-slate-50"
              />
            </div>
          )}

          {type !== "DELIVERY" && (
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                To Location
              </label>
              <input
                value={toLocation}
                disabled={!isEditable}
                onChange={(e) => setToLocation(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm disabled:bg-slate-50"
              />
            </div>
          )}
        </div>

        <MoveLinesTable
          lines={lines}
          onChange={setLines}
          allowEdit={isEditable}
        />
      </div>
    </div>
  );
}