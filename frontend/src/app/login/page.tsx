"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/auth-provider";

export default function LoginPage() {
  const { login, isAuthenticated, isLoading } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!isLoading && isAuthenticated) router.replace("/dashboard");
  }, [isAuthenticated, isLoading, router]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      await login(email.trim(), password);
      router.replace("/dashboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to sign in. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-5 py-12">
      <div className="grid w-full max-w-5xl overflow-hidden rounded-3xl bg-white shadow-soft md:grid-cols-2">
        <section className="hidden flex-col justify-between bg-forest p-12 text-white md:flex">
          <div>
            <div className="mb-14 flex items-center gap-3">
              <div className="grid h-11 w-11 place-items-center rounded-xl bg-white/10 text-lg font-bold">C</div>
              <span className="text-lg font-semibold tracking-wide">CHURCH DBS</span>
            </div>
            <p className="mb-4 text-xs font-semibold uppercase tracking-[0.25em] text-emerald-100">Church management</p>
            <h1 className="max-w-sm text-4xl font-semibold leading-tight">A clearer way to care for your church community.</h1>
            <p className="mt-5 max-w-sm text-sm leading-7 text-emerald-50/80">Secure access to your church management workspace.</p>
          </div>
          <p className="text-xs text-emerald-100/70">Church DBS · Secure administration</p>
        </section>

        <section className="flex flex-col justify-center px-7 py-12 sm:px-12">
          <div className="mb-10 md:hidden">
            <p className="text-sm font-bold tracking-[0.18em] text-forest">CHURCH DBS</p>
          </div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-forest">Welcome back</p>
          <h2 className="mt-3 text-3xl font-semibold tracking-tight">Sign in to your account</h2>
          <p className="mt-3 text-sm leading-6 text-slate-500">Use the administrator account created for your church.</p>

          <form className="mt-9 space-y-5" onSubmit={handleSubmit}>
            <div>
              <label htmlFor="email" className="mb-2 block text-sm font-medium">Email address</label>
              <input id="email" type="email" autoComplete="username" required value={email}
                onChange={(event) => setEmail(event.target.value)}
                className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none transition focus:border-forest"
                placeholder="you@church.org" />
            </div>
            <div>
              <label htmlFor="password" className="mb-2 block text-sm font-medium">Password</label>
              <input id="password" type="password" autoComplete="current-password" required value={password}
                onChange={(event) => setPassword(event.target.value)}
                className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none transition focus:border-forest"
                placeholder="Enter your password" />
            </div>
            {error && <p role="alert" className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}
            <button disabled={submitting || isLoading} className="w-full rounded-xl bg-forest px-4 py-3.5 text-sm font-semibold text-white transition hover:bg-[#103b2c] disabled:cursor-not-allowed disabled:opacity-60">
              {submitting ? "Signing in…" : "Sign in"}
            </button>
          </form>
          <p className="mt-8 text-center text-xs leading-5 text-slate-400">Access is provided by your church administrator. Public registration is disabled.</p>
        </section>
      </div>
    </main>
  );
}
