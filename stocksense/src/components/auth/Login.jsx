import { useState } from "react";

export default function Login({ onLoginSuccess, onNavigate }) {
  const [form, setForm] = useState(() => ({
    email: localStorage.getItem("stocksense_saved_email") ?? "",
    password: "",
  }));
  const [rememberEmail, setRememberEmail] = useState(() =>
    Boolean(localStorage.getItem("stocksense_saved_email")),
  );
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleChange = (e) => {
    setForm((current) => ({ ...current, [e.target.name]: e.target.value }));
    setError("");
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    if (rememberEmail)
      localStorage.setItem("stocksense_saved_email", form.email);
    else localStorage.removeItem("stocksense_saved_email");

    setLoading(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (!res.ok)
        throw new Error(
          "We couldn't sign you in. Check your email and password, then try again.",
        );
      const data = await res.json();
      onLoginSuccess(data.user);
    } catch (err) {
      setError(err.message || "Unable to connect right now. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="mx-0! w-full! max-w-none! border-0! text-left! grid min-h-screen grid-cols-1 bg-[#f6f7f3] font-sans text-[#1f2d29] lg:grid-cols-[1.05fr_.95fr]">
      <section
        className="relative flex min-h-97.5 flex-col justify-between overflow-hidden bg-[#213b34] bg-[linear-gradient(115deg,rgba(24,47,41,.97),rgba(35,69,58,.92)),repeating-linear-gradient(0deg,transparent_0_47px,rgba(229,239,229,.05)_48px),repeating-linear-gradient(90deg,transparent_0_47px,rgba(229,239,229,.05)_48px)] px-6 py-6 text-[#f1f4ee] sm:px-10 sm:py-9 lg:min-h-screen lg:px-[clamp(2.5rem,5vw,4.25rem)] lg:py-12"
        aria-label="StockSense overview"
      >
        <a
          className="relative z-10 flex w-fit items-center gap-3 text-base font-bold text-inherit no-underline"
          href="#sign-in"
          aria-label="StockSense home"
        >
          <span
            className="grid h-10 w-10 grid-cols-2 grid-rows-2 place-content-center gap-0.75 rounded-[10px] bg-[#c5df81] p-2.75"
            aria-hidden="true"
          >
            <i className="rounded-xs bg-[#29483d]" />
            <i className="rounded-xs bg-[#29483d]/60" />
            <i className="rounded-xs bg-[#29483d]/60" />
            <i className="rounded-xs bg-[#29483d]" />
          </span>
          <span>
            StockSense
            <span className="mt-0.5 block text-[9px] font-bold tracking-[.12em] text-[#afc0b5]">
              INVENTORY CONTROL
            </span>
          </span>
        </a>

        <div className="relative z-10 my-10 w-full max-w-xl lg:my-14">
          <p className="flex items-center gap-2 text-[10px] font-extrabold tracking-[.15em] text-[#c5df81]">
            <span className="h-px w-5 bg-current" /> BUILT FOR THE FLOOR
          </p>
          <h1 className="my-5! text-[clamp(2.5rem,5vw,4.4rem)]! font-semibold! leading-[1.04]! tracking-[-.055em]! text-[#f3f5f0]!">
            Know what&apos;s moving.
            <br />
            Before it moves.
          </h1>
          <p className="max-w-md text-sm leading-7 text-[#bac9c0] sm:text-[15px]">
            Keep every count, handoff, and reorder in view. One calm workspace
            for the people who keep stock moving.
          </p>

          <div
            className="mt-8 w-full max-w-102.5 rounded-[10px] border border-white/15 bg-[#091b16]/25 p-5 shadow-xl backdrop-blur-sm"
            aria-label="Inventory dashboard preview"
          >
            <div className="flex items-center justify-between">
              <div>
                <span className="block text-[8px] font-bold tracking-[.13em] text-[#9bb0a3]">
                  NETWORK SNAPSHOT
                </span>
                <strong className="mt-1 block text-[13px]">
                  Inventory pulse
                </strong>
              </div>
              <span className="flex items-center gap-2 text-[9px] font-bold tracking-widest text-[#d3e5b0]">
                <i className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#c5df81]" />
                LIVE
              </span>
            </div>
            <div className="mt-4 flex items-baseline gap-2">
              <strong className="text-[31px] font-semibold tracking-tight text-[#f2f5ef]">
                12,840
              </strong>
              <span className="text-[11px] text-[#a8b9ae]">units tracked</span>
            </div>
            <div
              className="mt-2 flex h-9 items-end gap-1.25 border-b border-white/10"
              aria-hidden="true"
            >
              {[
                "h-[35%]",
                "h-[52%]",
                "h-[76%]",
                "h-[35%]",
                "h-[92%]",
                "h-[52%]",
                "h-[35%]",
                "h-[76%]",
                "h-[52%]",
                "h-[92%]",
                "h-[35%]",
                "h-[76%]",
              ].map((height, index) => (
                <i
                  key={index}
                  className={`flex-1 rounded-t-sm bg-[#a9c86b]/80 ${height}`}
                />
              ))}
            </div>
            <div className="mt-3 flex items-center justify-between text-[11px]">
              <span className="text-[#a8b9ae]">Stock health</span>
              <strong className="text-[#edf3e8]">
                94%{" "}
                <i className="ml-1 text-[9px] not-italic text-[#c5df81]">
                  +2.4%
                </i>
              </strong>
            </div>
            <div className="mt-2 h-1 overflow-hidden rounded-full bg-white/10">
              <span className="block h-full w-[94%] rounded-full bg-[#c5df81]" />
            </div>
          </div>
        </div>

        <div className="relative z-10 flex items-center justify-between text-[9px] font-bold tracking-[.12em] text-[#96aa9d]">
          <span className="text-[#c5df81]">01</span>
          <span>RECEIVE · COUNT · MOVE · SHIP</span>
          <span className="text-[#c5df81]">02</span>
        </div>
      </section>

      <section
        className="flex min-h-130 flex-col justify-center bg-[#fbfcf9] px-6 py-10 sm:px-10 lg:min-h-screen lg:px-[clamp(2.5rem,7vw,6.5rem)]"
        id="sign-in"
      >
        <div className="mx-auto my-auto w-full max-w-97.5">
          <div className="mb-8 flex items-center gap-3 text-base font-bold text-[#1f2d29] lg:hidden">
            <span
              className="grid h-8 w-8 grid-cols-2 grid-rows-2 place-content-center gap-0.75 rounded-lg bg-[#c5df81] p-2.25"
              aria-hidden="true"
            >
              <i className="rounded-xs bg-[#29483d]" />
              <i className="rounded-xs bg-[#29483d]/60" />
              <i className="rounded-xs bg-[#29483d]/60" />
              <i className="rounded-xs bg-[#29483d]" />
            </span>
            StockSense
          </div>
          <div className="mb-7">
            <p className="text-[10px] font-extrabold tracking-[.15em] text-[#748f7f]">
              YOUR WORKSPACE AWAITS
            </p>
            <h2 className="mb-2! mt-2! text-[34px]! font-semibold! leading-tight! tracking-[-.04em]! text-[#22332c]!">
              Welcome back.
            </h2>
            <p className="text-sm text-[#75827c]">
              Sign in to your inventory dashboard.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="grid gap-4.75">
            <label className="grid gap-2 text-xs font-bold text-[#34433c]">
              Email address
              <input
                type="email"
                name="email"
                value={form.email}
                onChange={handleChange}
                autoComplete="username"
                placeholder="you@company.com"
                required
                className="h-12 w-full rounded-md border border-[#d8e0d9] bg-white px-3 text-sm font-normal text-[#24332d] outline-none transition placeholder:text-[#a1aba4] hover:border-[#aebcb1] focus:border-[#648977] focus:ring-4 focus:ring-[#4f7c65]/10"
              />
            </label>

            <label className="grid gap-2 text-xs font-bold text-[#34433c]">
              Password
              <span className="relative block">
                <input
                  type={showPassword ? "text" : "password"}
                  name="password"
                  value={form.password}
                  onChange={handleChange}
                  autoComplete="current-password"
                  placeholder="Enter your password"
                  required
                  className="h-12 w-full rounded-md border border-[#d8e0d9] bg-white px-3 pr-16 text-sm font-normal text-[#24332d] outline-none transition placeholder:text-[#a1aba4] hover:border-[#aebcb1] focus:border-[#648977] focus:ring-4 focus:ring-[#4f7c65]/10"
                />
                <button
                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded px-2 py-1 text-[11px] font-bold text-[#587361] transition hover:bg-[#edf2e9] hover:text-[#243f32] focus-visible:outline-2 focus-visible:outline-[#648977]"
                  type="button"
                  aria-pressed={showPassword}
                  onClick={() => setShowPassword((visible) => !visible)}
                >
                  {showPassword ? "Hide" : "Show"}
                </button>
              </span>
            </label>

            <div className="-mt-1 flex items-center justify-between gap-3">
              <label className="inline-flex cursor-pointer items-center gap-2 text-[11px] text-[#647169]">
                <input
                  type="checkbox"
                  checked={rememberEmail}
                  onChange={(event) => setRememberEmail(event.target.checked)}
                  className="size-3.75 accent-[#315c48]"
                />
                Remember my email
              </label>
              <button
                type="button"
                className="text-[11px] font-bold text-[#38624c] hover:text-[#203d2d] hover:underline hover:underline-offset-4"
                onClick={() => onNavigate("reset")}
              >
                Forgot password?
              </button>
            </div>

            {error && (
              <p
                className="rounded-md border border-[#efd1c7] bg-[#fff5f0] px-3 py-2.5 text-xs leading-5 text-[#9d4934]"
                role="alert"
              >
                {error}
              </p>
            )}

            <button
              className="mt-0.5 flex min-h-12 items-center justify-center gap-3 rounded-md bg-[#2c5141] px-4 text-[13px] font-bold text-[#f7f8f3] transition hover:-translate-y-px hover:bg-[#234434] hover:shadow-lg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#648977] disabled:cursor-wait disabled:opacity-80"
              type="submit"
              disabled={loading}
            >
              {loading && (
                <span
                  className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/40 border-t-white"
                  aria-hidden="true"
                />
              )}
              {loading ? "Signing you in" : "Sign in to StockSense"}
              {!loading && (
                <span aria-hidden="true" className="text-base font-normal">
                  →
                </span>
              )}
            </button>
          </form>

          <p className="mt-6 text-center text-xs text-[#77837c]">
            New to StockSense?{" "}
            <button
              type="button"
              className="ml-1 font-bold text-[#38624c] hover:text-[#203d2d] hover:underline hover:underline-offset-4"
              onClick={() => onNavigate("signup")}
            >
              Create an account
            </button>
          </p>
          <p className="mt-10 flex items-center justify-center gap-2 text-[10px] text-[#89958d]">
            <span aria-hidden="true" className="text-[#54735e]">
              ▣
            </span>
            Your workspace is protected with secure sign-in.
          </p>
        </div>
        <div className="mx-auto mt-8 flex w-full max-w-97.5 items-center justify-between text-[8px] font-bold tracking-[.12em] text-[#96a098]">
          <span>STOCKSENSE INVENTORY</span>
          <span>© 2026</span>
        </div>
      </section>
    </main>
  );
}
