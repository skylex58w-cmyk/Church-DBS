"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { apiRequest } from "@/lib/api";

type Transaction = {
  id: number;
  type: "INCOME" | "EXPENSE";
  category: string;
  amount: string | number;
  currency: string;
  description: string | null;
  reference: string | null;
  transactionDate: string;
  status: "PENDING" | "APPROVED" | "REJECTED";
  rejectionReason: string | null;
  recordedBy: { id: number; fullName: string | null; email: string };
  approvedBy: { id: number; fullName: string | null; email: string } | null;
  approvedAt: string | null;
};

type TransactionType = Transaction["type"];
type TransactionStatus = Transaction["status"];

const money = (amount: string | number) => new Intl.NumberFormat("en-NG", {
  style: "currency", currency: "NGN", minimumFractionDigits: 2,
}).format(Number(amount));

export function FinanceManagement({ branchId, accessToken }: { branchId: string; accessToken: string }) {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [type, setType] = useState<TransactionType>("INCOME");
  const [category, setCategory] = useState("");
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [reference, setReference] = useState("");
  const [transactionDate, setTransactionDate] = useState(new Date().toISOString().slice(0, 10));
  const [filterStatus, setFilterStatus] = useState("");
  const [filterType, setFilterType] = useState("");
  const [rejectionReasons, setRejectionReasons] = useState<Record<number, string>>({});
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const headers = { "X-Branch-Id": branchId };
  const loadTransactions = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams();
      if (filterStatus) params.set("status", filterStatus);
      if (filterType) params.set("type", filterType);
      const suffix = params.size ? `?${params.toString()}` : "";
      const rows = await apiRequest<Transaction[]>(`/finance${suffix}`, { method: "GET", headers }, accessToken);
      setTransactions(rows);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to load financial transactions.");
    } finally {
      setLoading(false);
    }
  }, [accessToken, branchId, filterStatus, filterType]);

  useEffect(() => { void loadTransactions(); }, [loadTransactions]);

  async function submitTransaction(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true); setError(""); setNotice("");
    try {
      await apiRequest<Transaction>("/finance", {
        method: "POST", headers,
        body: JSON.stringify({
          type, category: category.trim(), amount,
          description: description.trim() || null,
          reference: reference.trim() || null,
          transactionDate,
          currency: "NGN",
        }),
      }, accessToken);
      setCategory(""); setAmount(""); setDescription(""); setReference("");
      setNotice("Transaction recorded and submitted for approval.");
      await loadTransactions();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to record transaction.");
    } finally { setSaving(false); }
  }

  async function decide(id: number, decision: "APPROVE" | "REJECT") {
    const reason = rejectionReasons[id]?.trim() || "";
    if (decision === "REJECT" && reason.length < 3) {
      setError("Enter a rejection reason of at least 3 characters.");
      return;
    }
    setSaving(true); setError(""); setNotice("");
    try {
      await apiRequest<Transaction>(`/finance/${id}/decision`, {
        method: "POST", headers,
        body: JSON.stringify(decision === "REJECT" ? { decision, reason } : { decision }),
      }, accessToken);
      setNotice(decision === "APPROVE" ? "Transaction approved." : "Transaction rejected.");
      await loadTransactions();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to process transaction decision.");
    } finally { setSaving(false); }
  }

  const approvedIncome = transactions.filter((row) => row.type === "INCOME" && row.status === "APPROVED")
    .reduce((sum, row) => sum + Number(row.amount), 0);
  const approvedExpense = transactions.filter((row) => row.type === "EXPENSE" && row.status === "APPROVED")
    .reduce((sum, row) => sum + Number(row.amount), 0);

  return (
    <section className="mt-8 rounded-2xl border border-slate-200 bg-white p-6">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-forest">Stewardship</p>
        <h2 className="mt-1 text-xl font-semibold">Finance management</h2>
        <p className="mt-1 text-sm text-slate-500">Record branch income and expenses, then track approval decisions.</p>
      </div>

      {error && <p role="alert" className="mt-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}
      {notice && <p role="status" className="mt-4 rounded-lg bg-emerald-50 px-4 py-3 text-sm text-emerald-800">{notice}</p>}

      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        <div className="rounded-xl bg-slate-50 p-4"><p className="text-xs text-slate-500">Approved income in loaded results</p><p className="mt-1 text-xl font-semibold text-emerald-700">{money(approvedIncome)}</p></div>
        <div className="rounded-xl bg-slate-50 p-4"><p className="text-xs text-slate-500">Approved expenses in loaded results</p><p className="mt-1 text-xl font-semibold text-slate-800">{money(approvedExpense)}</p></div>
      </div>
      <p className="mt-2 text-xs text-slate-400">Figures are calculated from the currently loaded (maximum 200) transactions and are not a complete financial statement.</p>

      <form onSubmit={submitTransaction} className="mt-5 rounded-xl border border-slate-200 bg-slate-50 p-4">
        <h3 className="font-semibold">Record a transaction</h3>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <label className="text-sm font-medium">Transaction type
            <select value={type} onChange={(e) => setType(e.target.value as TransactionType)} className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2"><option value="INCOME">Income</option><option value="EXPENSE">Expense</option></select>
          </label>
          <label className="text-sm font-medium">Category *
            <input required maxLength={100} value={category} onChange={(e) => setCategory(e.target.value)} placeholder="e.g. Tithes, Offering, Utilities" className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2" />
          </label>
          <label className="text-sm font-medium">Amount (NGN) *
            <input required type="number" min="0.01" max="9999999999.99" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2" />
          </label>
          <label className="text-sm font-medium">Transaction date *
            <input required type="date" value={transactionDate} onChange={(e) => setTransactionDate(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2" />
          </label>
          <label className="text-sm font-medium">Reference
            <input maxLength={120} value={reference} onChange={(e) => setReference(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2" />
          </label>
          <label className="text-sm font-medium">Description
            <input maxLength={1000} value={description} onChange={(e) => setDescription(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2" />
          </label>
        </div>
        <button disabled={saving} className="mt-4 rounded-lg bg-forest px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-60">{saving ? "Saving…" : "Submit for approval"}</button>
      </form>

      <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div><h3 className="font-semibold">Transaction history</h3><p className="text-xs text-slate-500">Showing up to 200 records for this branch.</p></div>
        <div className="grid grid-cols-2 gap-2">
          <label className="text-xs font-medium text-slate-600">Status
            <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-2 py-2 text-sm"><option value="">All statuses</option><option value="PENDING">Pending</option><option value="APPROVED">Approved</option><option value="REJECTED">Rejected</option></select>
          </label>
          <label className="text-xs font-medium text-slate-600">Type
            <select value={filterType} onChange={(e) => setFilterType(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-2 py-2 text-sm"><option value="">All types</option><option value="INCOME">Income</option><option value="EXPENSE">Expense</option></select>
          </label>
        </div>
      </div>

      <div className="mt-4 overflow-x-auto">
        <table className="w-full min-w-[760px] text-left text-sm">
          <thead><tr className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500"><th className="px-3 py-3">Date / Category</th><th className="px-3 py-3">Type</th><th className="px-3 py-3">Amount</th><th className="px-3 py-3">Status</th><th className="px-3 py-3">Approval</th></tr></thead>
          <tbody>
            {transactions.map((row) => <tr key={row.id} className="border-b border-slate-100 align-top">
              <td className="px-3 py-3"><p className="font-medium">{row.category}</p><p className="mt-1 text-xs text-slate-500">{new Date(row.transactionDate).toLocaleDateString()} · {row.reference || "No reference"}</p>{row.description && <p className="mt-1 text-xs text-slate-500">{row.description}</p>}</td>
              <td className="px-3 py-3">{row.type === "INCOME" ? "Income" : "Expense"}</td>
              <td className="px-3 py-3 font-medium tabular-nums">{money(row.amount)}</td>
              <td className="px-3 py-3"><span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium">{row.status}</span><p className="mt-2 text-xs text-slate-400">By {row.recordedBy.fullName || row.recordedBy.email}</p></td>
              <td className="px-3 py-3">
                {row.status === "PENDING" ? <div className="min-w-[190px] space-y-2">
                  <button type="button" disabled={saving} onClick={() => void decide(row.id, "APPROVE")} className="rounded-lg bg-forest px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-60">Approve</button>
                  <input aria-label={`Rejection reason for transaction ${row.id}`} value={rejectionReasons[row.id] || ""} onChange={(e) => setRejectionReasons((current) => ({ ...current, [row.id]: e.target.value }))} placeholder="Reason required to reject" className="w-full rounded-lg border border-slate-200 px-2 py-1.5 text-xs" />
                  <button type="button" disabled={saving} onClick={() => void decide(row.id, "REJECT")} className="rounded-lg border border-red-200 px-3 py-1.5 text-xs font-semibold text-red-700 disabled:opacity-60">Reject</button>
                </div> : <div className="text-xs text-slate-500">{row.approvedBy ? `Decided by ${row.approvedBy.fullName || row.approvedBy.email}` : "—"}{row.rejectionReason && <p className="mt-1 text-red-600">{row.rejectionReason}</p>}</div>}
              </td>
            </tr>)}
            {!loading && transactions.length === 0 && <tr><td colSpan={5} className="px-3 py-10 text-center text-slate-500">No transactions match these filters.</td></tr>}
            {loading && transactions.length === 0 && <tr><td colSpan={5} className="px-3 py-10 text-center text-slate-500">Loading transactions…</td></tr>}
          </tbody>
        </table>
      </div>
    </section>
  );
}
