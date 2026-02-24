import { useEffect, useState, useCallback } from "react";
import Navbar from "../components/Navbar";
import { api } from "../api/client";
import { useParams, Link } from "react-router-dom";

export default function OrganizerAnalytics() {
  const { eventId } = useParams();
  const [event, setEvent] = useState(null);
  const [data, setData] = useState(null);
  const [tickets, setTickets] = useState([]);
  const [teams, setTeams] = useState([]);
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(true);

  // Participants table state
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterAttendance, setFilterAttendance] = useState("all");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [evRes, anRes, tkRes] = await Promise.all([
        api.get(`/events/${eventId}`),
        api.get(`/events/${eventId}/analytics`),
        api.get(`/events/${eventId}/export/participants`, { responseType: "text" }),
      ]);
      setEvent(evRes.data);
      setData(anRes.data);

      // Parse CSV to table rows
      const csvText = typeof tkRes.data === "string" ? tkRes.data : "";
      const rows = parseCSV(csvText);
      setTickets(rows);
    } catch (e) {
      setErr(e?.response?.data?.msg || "Failed to load analytics");
    } finally {
      setLoading(false);
    }

    // Try load teams if hackathon
    try {
      const teamsRes = await api.get(`/teams/event/${eventId}`);
      setTeams(teamsRes.data || []);
    } catch { /* not hackathon or no teams */ }
  }, [eventId]);

  useEffect(() => { load(); }, [load]);

  function parseCSV(text) {
    if (!text || !text.trim()) return [];
    const lines = text.trim().split("\n");
    if (lines.length < 2) return [];
    const headers = lines[0].split(",").map((h) => h.trim());
    return lines.slice(1).map((line) => {
      const vals = line.split(",");
      const obj = {};
      headers.forEach((h, i) => { obj[h] = (vals[i] || "").trim(); });
      return obj;
    });
  }

  const downloadCSV = async () => {
    try {
      const res = await api.get(`/events/${eventId}/export/participants`, { responseType: "blob" });
      const url = window.URL.createObjectURL(new Blob([res.data], { type: "text/csv" }));
      const a = document.createElement("a");
      a.href = url; a.download = `participants_${event?.name || eventId}.csv`;
      document.body.appendChild(a); a.click(); a.remove();
      window.URL.revokeObjectURL(url);
    } catch { alert("Download failed"); }
  };

  // Apply search + filters
  const filtered = tickets.filter((t) => {
    const q = search.toLowerCase();
    const matchSearch = !q || (
      (t.firstName + " " + t.lastName).toLowerCase().includes(q) ||
      t.email?.toLowerCase().includes(q) ||
      t.ticketId?.toLowerCase().includes(q)
    );
    const matchStatus = filterStatus === "all" || t.status === filterStatus;
    const matchAttendance = filterAttendance === "all" ||
      (filterAttendance === "attended" && t.status === "used") ||
      (filterAttendance === "not-attended" && t.status !== "used");
    return matchSearch && matchStatus && matchAttendance;
  });

  if (loading) return (<><Navbar /><div className="container"><p className="muted">Loading analytics…</p></div></>);

  const teamCompletion = teams.length > 0
    ? teams.filter(t => t.status === "finalized").length
    : null;

  return (
    <>
      <Navbar />
      <div className="container">

        {/* Header */}
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 24, flexWrap: "wrap", gap: 12 }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <Link to="/org/events" className="btn btn-outline" style={{ fontSize: 12, padding: "4px 10px" }}>← Back</Link>
              <h2 style={{ margin: 0 }}>{event?.name || "Event Analytics"}</h2>
            </div>
            {event && (
              <div className="muted" style={{ fontSize: 13, marginTop: 6 }}>
                <span className="pill" style={{ marginRight: 8 }}>{event.type}</span>
                <span style={{ marginRight: 8 }}>Status: <b>{event.status}</b></span>
                <span>Dates: {new Date(event.startDate).toLocaleDateString()} — {new Date(event.endDate).toLocaleDateString()}</span>
              </div>
            )}
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button className="btn btn-outline" onClick={downloadCSV} style={{ fontSize: 13 }}>Export CSV</button>
            <Link to={`/org/edit/${eventId}`} className="btn" style={{ fontSize: 13 }}>Edit Event</Link>
          </div>
        </div>

        {err && <div className="alert" style={{ marginBottom: 16 }}>{err}</div>}

        {/* ── Event Overview ──────────────────────────────────────── */}
        {event && (
          <div style={{
            background: "#fff", borderRadius: 14, border: "1px solid #e5e7eb",
            padding: 20, marginBottom: 24, boxShadow: "0 2px 8px rgba(0,0,0,0.05)"
          }}>
            <h4 style={{ margin: "0 0 12px", fontWeight: 700 }}>Event Overview</h4>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: 12 }}>
              {[
                { label: "Type", value: event.type },
                { label: "Status", value: event.status },
                { label: "Eligibility", value: event.eligibility || "All" },
                { label: "Fee", value: event.fee > 0 ? `₹${event.fee}` : "Free" },
                { label: "Reg. Limit", value: event.registrationLimit > 0 ? event.registrationLimit : "Unlimited" },
                { label: "Reg. Deadline", value: new Date(event.registrationDeadline).toLocaleDateString() },
                ...(event.type === "hackathon" ? [
                  { label: "Participation", value: event.participationMode },
                  { label: "Team Size", value: event.teamSize || 1 },
                ] : []),
                ...(event.type === "merch" ? [
                  { label: "Distribution Venue", value: event.distributionVenue || "TBD" },
                ] : []),
              ].map((item) => (
                <div key={item.label} style={{ background: "#f9fafb", borderRadius: 8, padding: "10px 14px" }}>
                  <div style={{ fontSize: 11, color: "#9ca3af", marginBottom: 2 }}>{item.label.toUpperCase()}</div>
                  <div style={{ fontWeight: 700, fontSize: 14 }}>{item.value}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Analytics Stats ──────────────────────────────────────── */}
        {data && (
          <div style={{ display: "flex", gap: 16, marginBottom: 24, flexWrap: "wrap" }}>
            {[
              { label: "Registrations", value: data.registrations, color: "#667eea" },
              { label: "Attendance", value: data.attendance, color: "#10b981" },
              { label: "Revenue", value: `₹${(data.revenue || 0).toLocaleString()}`, color: "#f59e0b" },
              ...(teamCompletion !== null ? [
                { label: "Teams Completed", value: `${teamCompletion}/${teams.length}`, color: "#764ba2" }
              ] : []),
              ...(data.registrations > 0 ? [
                { label: "Attendance Rate", value: `${Math.round((data.attendance / data.registrations) * 100)}%`, color: "#ef4444" }
              ] : []),
            ].map((s) => (
              <div key={s.label} style={{
                flex: "1 1 140px", background: "#fff", borderRadius: 14,
                border: "1px solid #e5e7eb", borderLeft: `4px solid ${s.color}`,
                padding: "18px 20px", boxShadow: "0 2px 8px rgba(0,0,0,0.05)"
              }}>
                <div style={{ fontSize: 28, fontWeight: 800, color: s.color }}>{s.value}</div>
                <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>{s.label}</div>
              </div>
            ))}
          </div>
        )}

        {/* ── Teams List (Hackathon only) ───────────────────────────── */}
        {teams.length > 0 && (
          <div style={{
            background: "#fff", borderRadius: 14, border: "1px solid #e5e7eb",
            padding: 20, marginBottom: 24, boxShadow: "0 2px 8px rgba(0,0,0,0.05)"
          }}>
            <h4 style={{ margin: "0 0 12px", fontWeight: 700 }}>👥 Teams ({teams.length})</h4>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                <thead>
                  <tr style={{ borderBottom: "2px solid #f3f4f6" }}>
                    {["Team Name", "Leader", "Members", "Size", "Status", "Pending Invites"].map((h) => (
                      <th key={h} style={{ textAlign: "left", padding: "8px 12px", color: "#6b7280", fontWeight: 600 }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {teams.map((t) => (
                    <tr key={t._id} style={{ borderBottom: "1px solid #f9fafb" }}>
                      <td style={{ padding: "10px 12px", fontWeight: 600 }}>{t.teamName}</td>
                      <td style={{ padding: "10px 12px" }}>{t.leader?.firstName} {t.leader?.lastName}</td>
                      <td style={{ padding: "10px 12px" }}>
                        {(t.members || []).map(m => `${m.firstName} ${m.lastName}`).join(", ")}
                      </td>
                      <td style={{ padding: "10px 12px" }}>{t.members?.length}/{t.maxSize}</td>
                      <td style={{ padding: "10px 12px" }}>
                        <span style={{
                          background: t.status === "finalized" ? "#d1fae5" : "#fef3c7",
                          color: t.status === "finalized" ? "#065f46" : "#92400e",
                          borderRadius: 20, padding: "2px 10px", fontSize: 11, fontWeight: 700
                        }}>{t.status}</span>
                      </td>
                      <td style={{ padding: "10px 12px" }}>
                        {(t.pendingInvites || []).filter(i => i.status === "pending").length}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ── Participants Table ────────────────────────────────────── */}
        <div style={{
          background: "#fff", borderRadius: 14, border: "1px solid #e5e7eb",
          padding: 20, boxShadow: "0 2px 8px rgba(0,0,0,0.05)"
        }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16, flexWrap: "wrap", gap: 10 }}>
            <h4 style={{ margin: 0, fontWeight: 700 }}>
              👤 Participants ({filtered.length}{filtered.length !== tickets.length ? ` of ${tickets.length}` : ""})
            </h4>
            <button className="btn btn-outline" onClick={downloadCSV} style={{ fontSize: 12 }}>⬇️ Export CSV</button>
          </div>

          {/* Filters */}
          <div style={{ display: "flex", gap: 10, marginBottom: 14, flexWrap: "wrap" }}>
            <input
              className="input"
              placeholder="🔍 Search by name, email, ticket ID…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{ flex: "1 1 200px", minWidth: 180 }}
            />
            <select className="input" value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              style={{ flex: "0 0 auto" }}>
              <option value="all">All Statuses</option>
              <option value="active">Active</option>
              <option value="used">Used (Attended)</option>
              <option value="cancelled">Cancelled</option>
            </select>
            <select className="input" value={filterAttendance}
              onChange={(e) => setFilterAttendance(e.target.value)}
              style={{ flex: "0 0 auto" }}>
              <option value="all">All Attendance</option>
              <option value="attended">Attended</option>
              <option value="not-attended">Not Attended</option>
            </select>
          </div>

          {tickets.length === 0 ? (
            <div style={{ textAlign: "center", padding: "32px 20px", color: "#9ca3af" }}>
              No participants yet.
            </div>
          ) : filtered.length === 0 ? (
            <div style={{ textAlign: "center", padding: "32px 20px", color: "#9ca3af" }}>
              No participants match the current filters.
            </div>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                <thead>
                  <tr style={{ borderBottom: "2px solid #f3f4f6" }}>
                    {["Ticket ID", "Name", "Email", "Reg. Date", "Payment", "Team", "Attendance"].map((h) => (
                      <th key={h} style={{ textAlign: "left", padding: "8px 12px", color: "#6b7280", fontWeight: 600, whiteSpace: "nowrap" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((t, i) => (
                    <tr key={i} style={{
                      borderBottom: "1px solid #f9fafb",
                      background: i % 2 === 0 ? "#fff" : "#fafafa"
                    }}>
                      <td style={{ padding: "10px 12px", fontFamily: "monospace", fontSize: 12 }}>{t.ticketId || "—"}</td>
                      <td style={{ padding: "10px 12px", fontWeight: 600 }}>{t.firstName} {t.lastName}</td>
                      <td style={{ padding: "10px 12px", color: "#6b7280" }}>{t.email || "—"}</td>
                      <td style={{ padding: "10px 12px", whiteSpace: "nowrap", color: "#6b7280", fontSize: 12 }}>
                        {t.createdAt ? new Date(t.createdAt).toLocaleDateString() : "—"}
                      </td>
                      <td style={{ padding: "10px 12px" }}>
                        <span style={{
                          background: "#d1fae5", color: "#065f46",
                          borderRadius: 20, padding: "2px 8px", fontSize: 11
                        }}>Paid</span>
                      </td>
                      <td style={{ padding: "10px 12px", color: "#6b7280" }}>
                        {t.team || "—"}
                      </td>
                      <td style={{ padding: "10px 12px" }}>
                        {t.status === "used" ? (
                          <span style={{ background: "#d1fae5", color: "#065f46", borderRadius: 20, padding: "2px 10px", fontSize: 11, fontWeight: 700 }}>
                            ✓ Attended
                          </span>
                        ) : t.status === "cancelled" ? (
                          <span style={{ background: "#fee2e2", color: "#991b1b", borderRadius: 20, padding: "2px 10px", fontSize: 11, fontWeight: 700 }}>
                            Cancelled
                          </span>
                        ) : (
                          <span style={{ background: "#f3f4f6", color: "#6b7280", borderRadius: 20, padding: "2px 10px", fontSize: 11 }}>
                            Registered
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
