"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ProtectedRoute } from "@/components/protected-route";
import { useAuth } from "@/components/auth-provider";

function DashboardContent() {
  const { logout } = useAuth();
  const router = useRouter();
  const [signingOut, setSigningOut] = useState(false);
  const [error, setError] = useState("");

  async function handleLogout() {
    setSigningOut(true);
    setError("");
    try {
      await logout();
      router.replace("/login");
    } catch {
      setError("The server could not complete sign out. Your local session has been cleared; close this tab if you are on a shared device.");
      router.replace("/login");
    } finally {
      setSigningOut(false);
    }
  }

  return (
    <main className="min-h-screen">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-4 sm:px-8">
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-xl bg-forest font-bold text-white">C</div>
            <div>
              <p className="text-sm font-bold tracking-wide">CHURCH DBS</p>
              <p className="text-xs text-slate-500">Management workspace</p>
            </div>
          </div>
          <button disabled={signingOut} onClick={handleLogout} className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium hover:bg-slate-50 disabled:opacity-60">{signingOut ? "Signing out…" : "Sign out"}</button>
        </div>
      </header>

      <section className="mx-auto max-w-7xl px-5 py-12 sm:px-8">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-forest">Workspace</p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight">Dashboard</h1>
        <p className="mt-2 text-sm text-slate-500">Your secure church management session is active.</p>
        {error && <p role="alert" className="mt-5 rounded-xl bg-amber-50 p-4 text-sm text-amber-800">{error}</p>}

        <div className="mt-8 rounded-2xl border border-emerald-200 bg-white p-6 shadow-sm">
          <div className="flex items-start gap-3">
            <span className="mt-1 h-2.5 w-2.5 rounded-full bg-emerald-500" />
            <div>
              <h2 className="font-semibold">Authentication connected</h2>
              <p className="mt-1 text-sm leading-6 text-slate-600">You signed in through the Church DBS API. Your refresh session is held in an HttpOnly cookie; the access token is kept in application memory.</p>
            </div>
          </div>
        </div>

        <div className="mt-8 rounded-2xl border border-slate-200 bg-white p-6">
          <h2 className="text-lg font-semibold">Next implementation stage</h2>
          <p className="mt-2 max-w-2xl text-sm leading-7 text-slate-600">Church data modules are not exposed in this dashboard yet. They will be added only after their API endpoints, branch isolation rules, and permission checks are implemented and tested.</p>
        </div>
      </section>
    </main>
  );
}

export default function DashboardPage() {
  return <ProtectedRoute><DashboardContent /></ProtectedRoute>;
}
