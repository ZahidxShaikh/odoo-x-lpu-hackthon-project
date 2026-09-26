import { useState } from "react";

export default function SignUp({ onSignUpSuccess, onNavigate }) {
  const [form, setForm] = useState({ name: "", email: "", password: "" });
  const [verificationPending, setVerificationPending] = useState(false);
  const [code, setCode] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleChange = (e) => {
    setForm((current) => ({ ...current, [e.target.name]: e.target.value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    if (!form.name.trim() || !form.email.trim() || !form.password) {
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
      const data = await res.json().catch(() => ({}));
      if (data.verificationRequired) {
        setVerificationPending(true);
        setMessage(
          data.error || `We sent a verification code to ${form.email}.`,
        );
        return;
      }
      if (!res.ok) throw new Error(data.error || "Could not create account.");
      throw new Error(
        "The server did not start email verification. Please try again.",
      );
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const verifyEmail = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/auth/verify-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: form.email, code }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok)
        throw new Error(data.error || "Could not verify your email.");
      onSignUpSuccess(data.user);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const resendCode = async () => {
    setError("");
    setMessage("");
    setLoading(true);
    try {
      const res = await fetch("/api/auth/resend-verification", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: form.email }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok)
        throw new Error(
          data.error || "Could not resend the verification code.",
        );
      setMessage(data.message);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-100 px-4 py-8">
      <section className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-xl shadow-slate-900/5 sm:p-9">
        <div className="mb-7 flex items-center gap-3">
          <span className="grid h-10 w-10 place-items-center rounded-xl bg-emerald-100 text-lg font-black text-emerald-900">
            S
          </span>
          <div>
            <p className="text-sm font-bold text-slate-900">StockSense</p>
            <p className="text-[10px] font-semibold tracking-[.14em] text-slate-500">
              INVENTORY CONTROL
            </p>
          </div>
        </div>

        <h1 className="!my-0 !text-2xl !font-bold !tracking-normal !text-slate-900">
          {verificationPending ? "Check your inbox" : "Create your account"}
        </h1>
        <p className="mt-2 mb-6 text-sm leading-6 text-slate-500">
          {verificationPending
            ? `Enter the 6-digit code sent to ${form.email}.`
            : "Set up a secure workspace for your inventory team."}
        </p>

        {verificationPending ? (
          <form onSubmit={verifyEmail} className="space-y-4">
            {message && (
              <p
                className="rounded-lg bg-emerald-50 px-3 py-2.5 text-sm leading-5 text-emerald-800"
                role="status"
              >
                {message}
              </p>
            )}
            <label className="block text-sm font-semibold text-slate-700">
              Verification code
              <input
                value={code}
                onChange={(event) =>
                  setCode(event.target.value.replace(/\D/g, "").slice(0, 6))
                }
                inputMode="numeric"
                autoComplete="one-time-code"
                pattern="[0-9]{6}"
                maxLength={6}
                required
                className="mt-2 h-12 w-full rounded-lg border border-slate-300 px-3 text-center font-mono text-lg tracking-[.4em] outline-none transition focus:border-emerald-700 focus:ring-4 focus:ring-emerald-700/10"
                placeholder="000000"
              />
            </label>
            {error && (
              <p className="text-sm text-red-700" role="alert">
                {error}
              </p>
            )}
            <button
              type="submit"
              disabled={loading}
              className="flex h-12 w-full items-center justify-center rounded-lg bg-emerald-900 px-4 text-sm font-bold text-white transition hover:bg-emerald-800 disabled:cursor-wait disabled:opacity-60"
            >
              {loading ? "Verifying..." : "Verify email and continue"}
            </button>
            <button
              type="button"
              onClick={resendCode}
              disabled={loading}
              className="w-full py-2 text-sm font-semibold text-emerald-900 hover:underline disabled:opacity-50"
            >
              Resend code
            </button>
          </form>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <label className="block text-sm font-semibold text-slate-700">
              Full name
              <input
                name="name"
                value={form.name}
                onChange={handleChange}
                autoComplete="name"
                required
                maxLength={120}
                className="mt-1.5 h-11 w-full rounded-lg border border-slate-300 px-3 text-sm font-normal outline-none transition focus:border-emerald-700 focus:ring-4 focus:ring-emerald-700/10"
                placeholder="Jane Doe"
              />
            </label>
            <label className="block text-sm font-semibold text-slate-700">
              Email
              <input
                type="email"
                name="email"
                value={form.email}
                onChange={handleChange}
                autoComplete="email"
                required
                className="mt-1.5 h-11 w-full rounded-lg border border-slate-300 px-3 text-sm font-normal outline-none transition focus:border-emerald-700 focus:ring-4 focus:ring-emerald-700/10"
                placeholder="you@company.com"
              />
            </label>
            <label className="block text-sm font-semibold text-slate-700">
              Password
              <input
                type="password"
                name="password"
                value={form.password}
                onChange={handleChange}
                autoComplete="new-password"
                minLength={8}
                maxLength={128}
                required
                className="mt-1.5 h-11 w-full rounded-lg border border-slate-300 px-3 text-sm font-normal outline-none transition focus:border-emerald-700 focus:ring-4 focus:ring-emerald-700/10"
                placeholder="At least 8 characters"
              />
            </label>
            {error && (
              <p className="text-sm text-red-700" role="alert">
                {error}
              </p>
            )}
            <button
              type="submit"
              disabled={loading}
              className="flex h-12 w-full items-center justify-center rounded-lg bg-emerald-900 px-4 text-sm font-bold text-white transition hover:bg-emerald-800 disabled:cursor-wait disabled:opacity-60"
            >
              {loading ? "Sending verification code..." : "Create account"}
            </button>
            <button
              type="button"
              onClick={() => {
                setVerificationPending(true);
                setMessage(
                  "Enter your email to verify an account you already created.",
                );
                setError("");
              }}
              className="w-full py-1 text-sm font-semibold text-emerald-900 hover:underline"
            >
              Already created an account? Verify email
            </button>
          </form>
        )}

        <div className="mt-5 border-t border-slate-100 pt-4 text-center text-sm text-slate-500">
          <button
            type="button"
            onClick={() => onNavigate("login")}
            className="font-semibold text-emerald-900 hover:underline"
          >
            Already verified? Sign in
          </button>
        </div>
      </section>
    </main>
  );
}
