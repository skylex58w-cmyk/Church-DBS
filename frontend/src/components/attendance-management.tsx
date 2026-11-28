"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { apiRequest } from "@/lib/api";

type Session = { id: number; title: string; serviceDate: string; serviceType: string | null; _count?: { records: number } };
type Member = { id: number; firstName: string; lastName: string; middleName: string | null; membershipStatus: "ACTIVE" | "INACTIVE" | "TRANSFERRED" | "DECEASED" };
type AttendanceStatus = "PRESENT" | "ABSENT" | "LATE" | "EXCUSED";
type SessionDetail = Session & { records: Array<{ id: number; memberId: number; status: AttendanceStatus; member: { firstName: string; lastName: string; middleName: string | null } }> };

const statusOptions: AttendanceStatus[] = ["PRESENT", "ABSENT", "LATE", "EXCUSED"];

export function AttendanceManagement({ branchId, accessToken }: { branchId: string; accessToken: string }) {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [detail, setDetail] = useState<SessionDetail | null>(null);
  const [marks, setMarks] = useState<Record<number, AttendanceStatus>>({});
  const [title, setTitle] = useState("Sunday Service");
  const [serviceDate, setServiceDate] = useState(new Date().toISOString().slice(0, 10));
  const [serviceType, setServiceType] = useState("Sunday Service");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const headers = { "X-Branch-Id": branchId };
  const loadSessions = useCallback(async () => {
    try {
      const data = await apiRequest<Session[]>("/attendance", { method: "GET", headers }, accessToken);
      setSessions(data);
      if (!selectedId && data.length) setSelectedId(String(data[0].id));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to load attendance sessions.");
    }
  }, [accessToken, branchId, selectedId]);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");
    Promise.all([
      apiRequest<Member[]>("/members", { method: "GET", headers }, accessToken),
      apiRequest<Session[]>("/attendance", { method: "GET", headers }, accessToken),
    ]).then(([memberRows, sessionRows]) => {
      if (!active) return;
      setMembers(memberRows.filter((m) => m.membershipStatus === "ACTIVE"));
      setSessions(sessionRows);
      setSelectedId((current) => current || (sessionRows[0] ? String(sessionRows[0].id) : ""));
    }).catch((e: unknown) => {
      if (active) setError(e instanceof Error ? e.message : "Unable to load attendance data.");
    }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [accessToken, branchId]);

  useEffect(() => {
    if (!selectedId) { setDetail(null); setMarks({}); return; }
    let active = true;
    apiRequest<SessionDetail>(`/attendance/${selectedId}`, { method: "GET", headers }, accessToken)
      .then((row) => {
        if (!active) return;
        setDetail(row);
        setMarks(Object.fromEntries(row.records.map((record) => [record.memberId, record.status])));
      })
      .catch((e: unknown) => { if (active) setError(e instanceof Error ? e.message : "Unable to load session."); });
    return () => { active = false; };
  }, [accessToken, branchId, selectedId]);

  async function createSession(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true); setError(""); setNotice("");
    try {
      const created = await apiRequest<Session>("/attendance", {
        method: "POST", headers, body: JSON.stringify({ title: title.trim(), serviceDate, serviceType: serviceType.trim() || null }),
      }, accessToken);
      setNotice("Attendance session created.");
      setSelectedId(String(created.id));
      await loadSessions();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to create session.");
    } finally { setSaving(false); }
  }

  async function saveAttendance() {
    if (!selectedId) return;
    const records = Object.entries(marks).map(([memberId, status]) => ({ memberId: Number(memberId), status }));
    if (!records.length) { setError("Mark at least one member before saving."); return; }
    setSaving(true); setError(""); setNotice("");
    try {
      await apiRequest(`/attendance/${selectedId}/records`, {
        method: "PUT", headers, body: JSON.stringify({ records }),
      }, accessToken);
      setNotice(`Saved attendance for ${records.length} member(s).`);
      const updated = await apiRequest<SessionDetail>(`/attendance/${selectedId}`, { method: "GET", headers }, accessToken);
      setDetail(updated);
      await loadSessions();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to save attendance.");
    } finally { setSaving(false); }
  }

  return (
    <section className="mt-8 rounded-2xl border border-slate-200 bg-white p-6">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-forest">Church records</p>
        <h2 className="mt-1 text-xl font-semibold">Attendance management</h2>
        <p className="mt-1 text-sm text-slate-500">Create service sessions and record attendance for active members in the selected branch.</p>
      </div>
      {error && <p role="alert" className="mt-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}
      {notice && <p role="status" className="mt-4 rounded-lg bg-emerald-50 px-4 py-3 text-sm text-emerald-800">{notice}</p>}
      <form onSubmit={createSession} className="mt-5 grid gap-3 rounded-xl bg-slate-50 p-4 sm:grid-cols-2 lg:grid-cols-4">
        <label className="text-sm font-medium">Session title
          <input required maxLength={150} value={title} onChange={(e) => setTitle(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2" />
        </label>
        <label className="text-sm font-medium">Service date
          <input required type="date" value={serviceDate} onChange={(e) => setServiceDate(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2" />
        </label>
        <label className="text-sm font-medium">Service type
          <input maxLength={80} value={serviceType} onChange={(e) => setServiceType(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2" />
        </label>
        <div className="flex items-end"><button disabled={saving} className="w-full rounded-lg bg-forest px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60">{saving ? "Saving…" : "Create session"}</button></div>
      </form>

      <div className="mt-5 grid gap-5 lg:grid-cols-[260px_1fr]">
        <aside className="rounded-xl border border-slate-200 p-4">
          <h3 className="font-semibold">Service sessions</h3>
          {sessions.length === 0 && <p className="mt-3 text-sm text-slate-500">{loading ? "Loading sessions…" : "No sessions created yet."}</p>}
          <ul className="mt-3 space-y-2">
            {sessions.map((session) => <li key={session.id}>
              <button type="button" onClick={() => setSelectedId(String(session.id))} className={`w-full rounded-lg p-3 text-left text-sm ${selectedId === String(session.id) ? "bg-forest text-white" : "bg-slate-50 hover:bg-slate-100"}`}>
                <span className="block font-medium">{session.title}</span>
                <span className={`mt-1 block text-xs ${selectedId === String(session.id) ? "text-white/75" : "text-slate-500"}`}>{new Date(session.serviceDate).toLocaleDateString()} · {session._count?.records ?? 0} marked</span>
              </button>
            </li>)}
          </ul>
        </aside>

        <div className="min-w-0">
          {!selectedId ? <p className="rounded-xl border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500">Create or select a service session to mark attendance.</p> : <>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div><h3 className="font-semibold">{detail?.title || "Loading session…"}</h3><p className="text-xs text-slate-500">{detail ? new Date(detail.serviceDate).toLocaleDateString() : ""}</p></div>
              <button type="button" onClick={saveAttendance} disabled={saving || !detail || members.length === 0} className="rounded-lg bg-forest px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60">{saving ? "Saving…" : "Save attendance"}</button>
            </div>
            <div className="mt-4 overflow-x-auto">
              <table className="w-full min-w-[480px] text-left text-sm">
                <thead><tr className="border-b border-slate-200 text-xs uppercase text-slate-500"><th className="px-3 py-3">Member</th><th className="px-3 py-3">Attendance status</th></tr></thead>
                <tbody>{members.map((member) => <tr key={member.id} className="border-b border-slate-100">
                  <td className="px-3 py-3 font-medium">{member.firstName} {member.middleName ? member.middleName + " " : ""}{member.lastName}</td>
                  <td className="px-3 py-3"><select aria-label={`Attendance status for ${member.firstName} ${member.lastName}`} value={marks[member.id] || ""} onChange={(e) => setMarks((current) => {
                    const next = { ...current };
                    if (e.target.value) next[member.id] = e.target.value as AttendanceStatus;
                    else delete next[member.id];
                    return next;
                  })} className="w-full max-w-[180px] rounded-lg border border-slate-200 bg-white px-3 py-2">
                    <option value="">Not marked</option>{statusOptions.map((status) => <option key={status} value={status}>{status.charAt(0) + status.slice(1).toLowerCase()}</option>)}
                  </select></td>
                </tr>)}
                {members.length === 0 && <tr><td colSpan={2} className="px-3 py-8 text-center text-slate-500">No active members found in this branch.</td></tr>}
                </tbody>
              </table>
            </div>
            <p className="mt-3 text-xs text-slate-400">Only marked members are submitted. Existing records are updated; unmarked members are left unchanged.</p>
          </>}
        </div>
      </div>
    </section>
  );
}
