import { useState } from "react";

const ROLES = [
  { value: "MANAGER", label: "Inventory Manager" },
  { value: "WAREHOUSE_STAFF", label: "Warehouse Staff" },
];

export default function SignUp({ onSignUpSuccess, onNavigate }) {
  const [form, setForm] = useState({ name: "", email: "", password: "", role: "WAREHOUSE_STAFF" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    if (!form.name || !form.email || !form.password) {
      setError("All fields are required.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (!res.ok) throw new Error("Could not create account.");
      const data = await res.json();
      onSignUpSuccess(data.user);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-100">
      <div className="w-full max-w-sm bg-white rounded-xl shadow-md p-8">
        <h1 className="text-2xl font-semibold text-slate-800 mb-1">Create account</h1>
        <p className="text-sm text-slate-500 mb-6">Join your team on StockSense</p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Full name</label>
            <input
              name="name"
              value={form.name}
              onChange={handleChange}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              placeholder="Jane Doe"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Email</label>
            <input
              type="email"
              name="email"
              value={form.email}
              onChange={handleChange}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              placeholder="you@company.com"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Password</label>
            <input
              type="password"
              name="password"
              value={form.password}
              onChange={handleChange}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              placeholder="••••••••"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Role</label>
            <div className="grid grid-cols-2 gap-2">
              {ROLES.map((r) => (
                <button
                  type="button"
                  key={r.value}
                  onClick={() => setForm({ ...form, role: r.value })}
                  className={`rounded-lg border px-3 py-2 text-sm font-medium transition ${
                    form.role === r.value
                      ? "border-indigo-600 bg-indigo-50 text-indigo-700"
                      : "border-slate-300 text-slate-600 hover:bg-slate-50"
                  }`}
                >
                  {r.label}
                </button>
              ))}
            </div>
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-indigo-600 text-white py-2 text-sm font-medium hover:bg-indigo-700 disabled:opacity-60"
          >
            {loading ? "Creating account..." : "Sign Up"}
          </button>
        </form>

        <div className="mt-4 text-sm text-center">
          <button onClick={() => onNavigate("login")} className="text-indigo-600 hover:underline">
            Already have an account? Sign in
          </button>
        </div>
      </div>
    </div>
  );
}