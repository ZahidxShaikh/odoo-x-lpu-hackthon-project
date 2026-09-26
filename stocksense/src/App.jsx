import { useEffect, useState } from "react";
import Login from "./components/auth/Login";
import SignUp from "./components/auth/SignUp";
import OTPReset from "./components/auth/OTPReset";
import Dashboard from "./components/Dashboard";
import ProductCatalog from "./components/ProductCatalog";
import OperationsManager from "./components/operations/OperationsManager";
import StockAdjustment from "./components/StockAdjustment";
import MoveHistory from "./components/MoveHistory";
import WarehouseSettings from "./components/WarehouseSettings";

const NAV = [
  { key: "dashboard", label: "Dashboard" },
  { key: "products", label: "Products" },
  { key: "receipts", label: "Receipts" },
  { key: "deliveries", label: "Deliveries" },
  { key: "transfers", label: "Internal Transfers" },
  { key: "adjustments", label: "Adjustments" },
  { key: "history", label: "Move History" },
  { key: "settings", label: "Settings" },
];

export default function App() {
  const [user, setUser] = useState(null);
  const [checkingSession, setCheckingSession] = useState(true);
  const [authView, setAuthView] = useState("login");
  const [page, setPage] = useState("dashboard");
  const [opContext, setOpContext] = useState(null);

  useEffect(() => {
    let active = true;
    fetch("/api/auth/me")
      .then(async (response) =>
        response.ok ? (await response.json()).user : null,
      )
      .then((sessionUser) => {
        if (active && sessionUser) setUser(sessionUser);
      })
      .catch(() => {})
      .finally(() => {
        if (active) setCheckingSession(false);
      });

    return () => {
      active = false;
    };
  }, []);

  const logOut = async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } finally {
      setUser(null);
      setPage("dashboard");
      setAuthView("login");
    }
  };

  if (!user && checkingSession) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-50 text-sm font-medium text-slate-600">
        Restoring your secure session...
      </main>
    );
  }

  if (!user) {
    if (authView === "signup") {
      return <SignUp onSignUpSuccess={setUser} onNavigate={setAuthView} />;
    }

    if (authView === "reset") {
      return (
        <OTPReset
          onResetSuccess={() => setAuthView("login")}
          onNavigate={setAuthView}
        />
      );
    }

    return <Login onLoginSuccess={setUser} onNavigate={setAuthView} />;
  }

  const goToOperations = (_target, context) => {
    setOpContext(context);
    setPage(
      context.type === "RECEIPT"
        ? "receipts"
        : context.type === "DELIVERY"
          ? "deliveries"
          : "transfers",
    );
  };

  return (
    <div className="flex min-h-screen bg-slate-50">
      <aside className="w-56 bg-white border-r border-slate-200 flex flex-col">
        <div className="px-4 py-5 font-semibold text-slate-800">StockSense</div>

        <nav className="flex-1 px-2 space-y-1">
          {NAV.map((item) => (
            <button
              key={item.key}
              onClick={() => setPage(item.key)}
              className={`w-full text-left px-3 py-2 rounded-lg text-sm ${
                page === item.key
                  ? "bg-indigo-50 text-indigo-700 font-medium"
                  : "text-slate-600 hover:bg-slate-50"
              }`}
            >
              {item.label}
            </button>
          ))}
        </nav>

        <div className="px-4 py-4 border-t border-slate-200 text-sm text-slate-500">
          {user.name}
          <button
            onClick={logOut}
            className="block mt-1 text-red-500 hover:underline"
          >
            Log out
          </button>
        </div>
      </aside>

      <main className="flex-1 overflow-y-auto">
        {page === "dashboard" && <Dashboard onNavigate={goToOperations} />}
        {page === "products" && <ProductCatalog />}
        {page === "receipts" && (
          <OperationsManager
            type="RECEIPT"
            operationId={opContext?.operationId}
          />
        )}
        {page === "deliveries" && (
          <OperationsManager
            type="DELIVERY"
            operationId={opContext?.operationId}
          />
        )}
        {page === "transfers" && (
          <OperationsManager
            type="INTERNAL"
            operationId={opContext?.operationId}
          />
        )}
        {page === "adjustments" && <StockAdjustment />}
        {page === "history" && <MoveHistory />}
        {page === "settings" && <WarehouseSettings />}
      </main>
    </div>
  );
}
