"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { apiRequest } from "@/lib/api";

type Member = {
  id: number;
  firstName: string;
  lastName: string;
  middleName: string | null;
  phone: string | null;
  email: string | null;
  gender: string | null;
  dateOfBirth: string | null;
  address: string | null;
  maritalStatus: string | null;
  membershipStatus: "ACTIVE" | "INACTIVE" | "TRANSFERRED" | "DECEASED";
  joinedAt: string | null;
};

type MemberForm = {
  firstName: string;
  lastName: string;
  middleName: string;
  phone: string;
  email: string;
  gender: string;
  dateOfBirth: string;
  address: string;
  maritalStatus: string;
  membershipStatus: Member["membershipStatus"];
  joinedAt: string;
};

const emptyForm: MemberForm = {
  firstName: "", lastName: "", middleName: "", phone: "", email: "",
  gender: "", dateOfBirth: "", address: "", maritalStatus: "",
  membershipStatus: "ACTIVE", joinedAt: "",
};

const statusLabel: Record<Member["membershipStatus"], string> = {
  ACTIVE: "Active", INACTIVE: "Inactive", TRANSFERRED: "Transferred", DECEASED: "Deceased",
};

export function MemberManagement({ branchId, accessToken }: { branchId: string; accessToken: string }) {
  const [members, setMembers] = useState<Member[]>([]);
  const [search, setSearch] = useState("");
  const [form, setForm] = useState<MemberForm>(emptyForm);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const branchHeaders = { "X-Branch-Id": branchId };

  const loadMembers = useCallback(async (term: string) => {
    setLoading(true);
    setError("");
    try {
      const query = term.trim() ? `?search=${encodeURIComponent(term.trim())}` : "";
      const data = await apiRequest<Member[]>(`/members${query}`, {
        method: "GET", headers: branchHeaders,
      }, accessToken);
      setMembers(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load members.");
    } finally {
      setLoading(false);
    }
  }, [accessToken, branchId]);

  useEffect(() => {
    void loadMembers(search);
  }, [loadMembers, search]);

  function startCreate() {
    setEditingId(null);
    setForm(emptyForm);
    setNotice("");
    setShowForm(true);
  }

  function startEdit(member: Member) {
    setEditingId(member.id);
    setForm({
      firstName: member.firstName,
      lastName: member.lastName,
      middleName: member.middleName || "",
      phone: member.phone || "",
      email: member.email || "",
      gender: member.gender || "",
      dateOfBirth: member.dateOfBirth ? member.dateOfBirth.slice(0, 10) : "",
      address: member.address || "",
      maritalStatus: member.maritalStatus || "",
      membershipStatus: member.membershipStatus,
      joinedAt: member.joinedAt ? member.joinedAt.slice(0, 10) : "",
    });
    setNotice("");
    setShowForm(true);
  }

  async function submitMember(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError("");
    setNotice("");
    const payload = {
      firstName: form.firstName.trim(),
      lastName: form.lastName.trim(),
      middleName: form.middleName.trim() || null,
      phone: form.phone.trim() || null,
      email: form.email.trim() || null,
      gender: form.gender || null,
      dateOfBirth: form.dateOfBirth || null,
      address: form.address.trim() || null,
      maritalStatus: form.maritalStatus || null,
      membershipStatus: form.membershipStatus,
      joinedAt: form.joinedAt || null,
    };
    try {
      await apiRequest<Member>(editingId ? `/members/${editingId}` : "/members", {
        method: editingId ? "PATCH" : "POST",
        headers: branchHeaders,
        body: JSON.stringify(payload),
      }, accessToken);
      setShowForm(false);
      setEditingId(null);
      setForm(emptyForm);
      setNotice(editingId ? "Member details updated." : "Member registered successfully.");
      await loadMembers(search);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to save member.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="mt-8 rounded-2xl border border-slate-200 bg-white p-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-forest">People</p>
          <h2 className="mt-1 text-xl font-semibold">Member directory</h2>
          <p className="mt-1 text-sm text-slate-500">Records are loaded and saved within the selected branch.</p>
        </div>
        <button type="button" onClick={startCreate} className="rounded-lg bg-forest px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#103b2c]">Add member</button>
      </div>

      <div className="mt-5 flex flex-col gap-3 sm:flex-row">
        <label className="sr-only" htmlFor="member-search">Search members</label>
        <input id="member-search" value={search} onChange={(event) => setSearch(event.target.value)}
          placeholder="Search by name, phone or email"
          className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-forest sm:max-w-md" />
        <button type="button" onClick={() => void loadMembers(search)} disabled={loading}
          className="rounded-lg border border-slate-200 px-4 py-2.5 text-sm font-medium hover:bg-slate-50 disabled:opacity-60">
          {loading ? "Refreshing…" : "Refresh"}
        </button>
      </div>

      {error && <p role="alert" className="mt-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}
      {notice && <p role="status" className="mt-4 rounded-lg bg-emerald-50 px-4 py-3 text-sm text-emerald-800">{notice}</p>}

      {showForm && (
        <form onSubmit={submitMember} className="mt-5 rounded-xl border border-slate-200 bg-slate-50 p-4">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold">{editingId ? "Edit member" : "Register a member"}</h3>
            <button type="button" onClick={() => setShowForm(false)} className="text-sm text-slate-500 hover:text-slate-800">Cancel</button>
          </div>
          <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <label className="text-sm font-medium">First name *
              <input required maxLength={100} value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })} className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2" />
            </label>
            <label className="text-sm font-medium">Last name *
              <input required maxLength={100} value={form.lastName} onChange={(e) => setForm({ ...form, lastName: e.target.value })} className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2" />
            </label>
            <label className="text-sm font-medium">Middle name
              <input maxLength={100} value={form.middleName} onChange={(e) => setForm({ ...form, middleName: e.target.value })} className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2" />
            </label>
            <label className="text-sm font-medium">Phone
              <input maxLength={40} value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2" />
            </label>
            <label className="text-sm font-medium">Email
              <input type="email" maxLength={254} value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2" />
            </label>
            <label className="text-sm font-medium">Gender
              <select value={form.gender} onChange={(e) => setForm({ ...form, gender: e.target.value })} className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2">
                <option value="">Not specified</option><option value="MALE">Male</option><option value="FEMALE">Female</option><option value="OTHER">Other</option>
              </select>
            </label>
            <label className="text-sm font-medium">Date of birth
              <input type="date" value={form.dateOfBirth} onChange={(e) => setForm({ ...form, dateOfBirth: e.target.value })} className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2" />
            </label>
            <label className="text-sm font-medium">Marital status
              <select value={form.maritalStatus} onChange={(e) => setForm({ ...form, maritalStatus: e.target.value })} className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2">
                <option value="">Not specified</option><option value="SINGLE">Single</option><option value="MARRIED">Married</option><option value="WIDOWED">Widowed</option><option value="DIVORCED">Divorced</option>
              </select>
            </label>
            <label className="text-sm font-medium sm:col-span-2 lg:col-span-3">Address
              <textarea maxLength={500} rows={2} value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2" />
            </label>
            <label className="text-sm font-medium">Date joined
              <input type="date" value={form.joinedAt} onChange={(e) => setForm({ ...form, joinedAt: e.target.value })} className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2" />
            </label>
            <label className="text-sm font-medium">Membership status
              <select value={form.membershipStatus} onChange={(e) => setForm({ ...form, membershipStatus: e.target.value as MemberForm["membershipStatus"] })} className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2">
                <option value="ACTIVE">Active</option><option value="INACTIVE">Inactive</option>
                <option value="TRANSFERRED">Transferred</option><option value="DECEASED">Deceased</option>
              </select>
            </label>
          </div>
          <button disabled={saving} className="mt-5 rounded-lg bg-forest px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-60">
            {saving ? "Saving…" : editingId ? "Save changes" : "Register member"}
          </button>
        </form>
      )}

      <div className="mt-5 overflow-x-auto">
        <table className="w-full min-w-[620px] text-left text-sm">
          <thead><tr className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500">
            <th className="px-3 py-3 font-semibold">Member</th><th className="px-3 py-3 font-semibold">Contact</th>
            <th className="px-3 py-3 font-semibold">Status</th><th className="px-3 py-3 text-right font-semibold">Action</th>
          </tr></thead>
          <tbody>
            {members.map((member) => (
              <tr key={member.id} className="border-b border-slate-100 last:border-0">
                <td className="px-3 py-3"><p className="font-medium">{member.firstName} {member.middleName ? member.middleName + " " : ""}{member.lastName}</p><p className="mt-1 text-xs text-slate-400">Member #{member.id}</p></td>
                <td className="px-3 py-3 text-slate-600">{member.phone || member.email || "—"}{member.phone && member.email ? <p className="mt-1 text-xs text-slate-400">{member.email}</p> : null}</td>
                <td className="px-3 py-3"><span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium">{statusLabel[member.membershipStatus]}</span></td>
                <td className="px-3 py-3 text-right"><button type="button" onClick={() => startEdit(member)} className="font-medium text-forest hover:underline">Edit</button></td>
              </tr>
            ))}
            {!loading && members.length === 0 && <tr><td colSpan={4} className="px-3 py-10 text-center text-slate-500">No members found in this branch.</td></tr>}
            {loading && members.length === 0 && <tr><td colSpan={4} className="px-3 py-10 text-center text-slate-500">Loading members…</td></tr>}
          </tbody>
        </table>
      </div>
      <p className="mt-3 text-xs text-slate-400">Showing up to 200 matching records. Member deletion and advanced member details are not available yet.</p>
    </section>
  );
}
