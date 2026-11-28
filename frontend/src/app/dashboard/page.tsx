"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ProtectedRoute } from "@/components/protected-route";
import { useAuth } from "@/components/auth-provider";
import { apiRequest } from "@/lib/api";

type Branch = { id: number; name: string; code: string | null; createdAt: string };

type CurrentUser = {
  id: number;
  email: string;
  fullName: string | null;
  roleAssignments: Array<{
    branchId: number | null;
    branch: { id: number; name: string; code: string | null } | null;
    role: { id: number; name: string; description: string | null };
  }>;
};

function DashboardContent() {
  const { logout, accessToken } = useAuth();
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
  const [profileError, setProfileError] = useState("");
  const [branches, setBranches] = useState<Branch[]>([]);
  const [activeBranchId, setActiveBranchId] = useState("");
  const [branchError, setBranchError] = useState("");

  useEffect(() => {
    if (!accessToken) return;
    let active = true;
    apiRequest<CurrentUser>("/auth/me", { method: "GET" }, accessToken)
      .then((user) => { if (active) setCurrentUser(user); })
      .catch((error: unknown) => {
        if (active) setProfileError(error instanceof Error ? error.message : "Unable to load account details.");
      });
    return () => { active = false; };
  }, [accessToken]);

  useEffect(() => {
    if (!accessToken || !currentUser) return;
    let active = true;
    const assignedBranchIds = Array.from(new Set(
      currentUser.roleAssignments
        .map((assignment) => assignment.branchId)
        .filter((id): id is number => id !== null),
    ));

    async function loadBranches() {
      try {
        const allBranches = await apiRequest<Branch[]>("/branches", { method: "GET" }, accessToken);
        if (active) {
          setBranches(allBranches);
          setActiveBranchId((current) => current || (allBranches[0] ? String(allBranches[0].id) : ""));
        }
        return;
      } catch {
        // Branch-scoped users are intentionally limited to their own assignments.
      }

      const scoped = await Promise.allSettled(assignedBranchIds.map((id) =>
        apiRequest<Branch[]>("/branches", {
          method: "GET",
          headers: { "X-Branch-Id": String(id) },
        }, accessToken),
      ));
      const visible = scoped.flatMap((result) => result.status === "fulfilled" ? result.value : []);
      if (active) {
        const unique = Array.from(new Map(visible.map((item) => [item.id, item])).values());
        setBranches(unique);
        setActiveBranchId((current) => current || (unique[0] ? String(unique[0].id) : ""));
        if (!unique.length && assignedBranchIds.length) {
          setBranchError("No assigned branch is currently available to this account.");
        }
      }
    }

    void loadBranches();
    return () => { active = false; };
  }, [accessToken, currentUser]);

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
        {profileError && <p role="alert" className="mt-5 rounded-xl bg-amber-50 p-4 text-sm text-amber-800">{profileError}</p>}

        {branches.length > 0 && (
          <section className="mt-6 max-w-xl rounded-2xl border border-slate-200 bg-white p-5">
            <label htmlFor="active-branch" className="block text-sm font-semibold text-slate-700">Active branch</label>
            <select
              id="active-branch"
              value={activeBranchId}
              onChange={(event) => setActiveBranchId(event.target.value)}
              className="mt-2 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-forest focus:ring-2 focus:ring-forest/20"
            >
              {branches.map((branch) => (
                <option key={branch.id} value={String(branch.id)}>{branch.name}{branch.code ? " (" + branch.code + ")" : ""}</option>
              ))}
            </select>
            <p className="mt-2 text-xs text-slate-500">The branch list is returned by the API using your assigned permissions and branch scope.</p>
          </section>
        )}
        {branchError && <p role="status" className="mt-4 text-sm text-slate-500">{branchError}</p>}

        <div className="mt-8 grid gap-5 md:grid-cols-2">
          <section className="rounded-2xl border border-slate-200 bg-white p-6">
            <h2 className="text-sm font-semibold text-slate-500">Signed-in account</h2>
            <p className="mt-3 text-xl font-semibold">{currentUser?.fullName || "Account profile"}</p>
            <p className="mt-1 text-sm text-slate-600">{currentUser?.email || (profileError ? "Profile unavailable" : "Loading account…")}</p>
          </section>
          <section className="rounded-2xl border border-slate-200 bg-white p-6">
            <h2 className="text-sm font-semibold text-slate-500">Role assignments</h2>
            {currentUser ? (currentUser.roleAssignments.length ? (
              <ul className="mt-3 space-y-3">
                {currentUser.roleAssignments.map((assignment) => (
                  <li key={`${assignment.role.id}-${assignment.branchId ?? "global"}`} className="flex items-start justify-between gap-3 text-sm">
                    <span className="font-medium">{assignment.role.name}</span>
                    <span className="text-right text-slate-500">{assignment.branch?.name || "Global access"}</span>
                  </li>
                ))}
              </ul>
            ) : <p className="mt-3 text-sm text-slate-500">No role assignments are currently attached to this account.</p>) : <p className="mt-3 text-sm text-slate-500">Loading assignments…</p>}
          </section>
        </div>
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
