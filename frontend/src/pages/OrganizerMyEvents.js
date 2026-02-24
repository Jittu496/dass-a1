import { useEffect, useState, useCallback } from "react";
import Navbar from "../components/Navbar";
import { api } from "../api/client";
import { Link, useSearchParams } from "react-router-dom";

const STATUS_COLORS = {
  draft: { bg: "#f3f4f6", color: "#6b7280", label: "Draft" },
  published: { bg: "#dbeafe", color: "#1d4ed8", label: "Published" },
  ongoing: { bg: "#d1fae5", color: "#065f46", label: "Ongoing" },
  completed: { bg: "#ede9fe", color: "#5b21b6", label: "Completed" },
  closed: { bg: "#fee2e2", color: "#991b1b", label: "Closed" },
};

const TYPE_ICONS = { normal: "🎫", merch: "🛍️", hackathon: "💻" };

export default function OrganizerMyEvents() {
  const [searchParams] = useSearchParams();
  const [events, setEvents] = useState([]);
  const [analytics, setAnalytics] = useState({});
  const [err, setErr] = useState("");
  const [filter, setFilter] = useState(searchParams.get("status") || "all");
  const [carouselIndex, setCarouselIndex] = useState(0);

  const load = useCallback(async () => {
    setErr("");
    try {
      const res = await api.get("/events/org/mine/list");
      const evs = res.data || [];
      setEvents(evs);

      // Load analytics for completed events only (to show revenue/registrations in summary)
      const completed = evs.filter((e) => ["completed", "closed", "ongoing", "published"].includes(e.status));
      const analyticsResults = await Promise.allSettled(
        completed.map((e) => api.get(`/events/${e._id}/analytics`))
      );
      const map = {};
      completed.forEach((e, i) => {
        if (analyticsResults[i].status === "fulfilled") {
          map[e._id] = analyticsResults[i].value.data;
        }
      });
      setAnalytics(map);
    } catch (e) {
      setErr(e?.response?.data?.msg || "Failed to load events");
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const publish = async (id) => {
    try { await api.post(`/events/${id}/publish`); load(); }
    catch (e) { setErr(e?.response?.data?.msg || "Publish failed"); }
  };

  const downloadCSV = async (id, name) => {
    try {
      const res = await api.get(`/events/${id}/export/participants`, { responseType: "blob" });
      const url = window.URL.createObjectURL(new Blob([res.data], { type: "text/csv" }));
      const a = document.createElement("a");
      a.href = url; a.download = `participants_${name || id}.csv`;
      document.body.appendChild(a); a.click(); a.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) { alert(err?.response?.data?.msg || "Download failed"); }
  };

  const filtered = filter === "all" ? events : events.filter((e) => e.status === filter);

  // Summary stats
  const totalReg = Object.values(analytics).reduce((s, a) => s + (a.registrations || 0), 0);
  const totalRev = Object.values(analytics).reduce((s, a) => s + (a.revenue || 0), 0);
  const ongoingCount = events.filter((e) => e.status === "ongoing").length;

  // Ongoing events for carousel hero
  const ongoingEvents = events.filter((e) => e.status === "ongoing");
  const currentOngoing = ongoingEvents[carouselIndex % Math.max(ongoingEvents.length, 1)];

  return (
    <>
      <Navbar />
      <div className="container">
        <h2>Organizer Dashboard</h2>
        {err && <div className="alert">{err}</div>}

        {/* ── Summary Stats ────────────────────────────────────────────── */}
        <div style={{ display: "flex", gap: 16, marginBottom: 28, flexWrap: "wrap" }}>
          {[
            { label: "Total Events", value: events.length, color: "#667eea" },
            { label: "Ongoing Now", value: ongoingCount, color: "#ef4444" },
            { label: "Total Registrations", value: totalReg, color: "#10b981" },
            { label: "Total Revenue", value: `₹${totalRev.toLocaleString()}`, color: "#f59e0b" },
          ].map((s) => (
            <div key={s.label} style={{
              flex: "1 1 160px", background: "#fff", borderRadius: 14,
              border: "1px solid #e5e7eb", borderLeft: `4px solid ${s.color}`,
              padding: "16px 20px", boxShadow: "0 2px 8px rgba(0,0,0,0.05)"
            }}>
              <div style={{ fontSize: 28, fontWeight: 800, color: s.color }}>{s.value}</div>
              <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>{s.label}</div>
            </div>
          ))}
        </div>

        {/* ── Ongoing Events Carousel ───────────────────────────────────── */}
        {ongoingEvents.length > 0 && (
          <div style={{ marginBottom: 28 }}>
            <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 12 }}>Ongoing Events</div>
            <div style={{ position: "relative" }}>
              <div style={{
                background: "linear-gradient(135deg,#667eea,#764ba2)",
                borderRadius: 16, padding: "24px 28px", color: "#fff",
                boxShadow: "0 4px 20px rgba(102,126,234,0.35)"
              }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                  <div>
                    <div style={{ fontSize: 12, opacity: 0.8, marginBottom: 4 }}>
                      {TYPE_ICONS[currentOngoing?.type]} {currentOngoing?.type?.toUpperCase()}
                    </div>
                    <h3 style={{ margin: "0 0 8px", fontSize: 22 }}>{currentOngoing?.name}</h3>
                    <div style={{ opacity: 0.85, fontSize: 13, maxWidth: 400 }}>
                      {currentOngoing?.description?.slice(0, 120) || "No description"}
                    </div>
                    <div style={{ marginTop: 12, fontSize: 13, opacity: 0.9 }}>
                      📅 Ends {currentOngoing?.endDate ? new Date(currentOngoing.endDate).toLocaleDateString() : "—"}
                      &nbsp;·&nbsp; 👥 {analytics[currentOngoing?._id]?.registrations ?? "—"} registrations
                    </div>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 8, flexShrink: 0, marginLeft: 16 }}>
                    <Link to={`/org/analytics/${currentOngoing?._id}`}
                      style={{ background: "rgba(255,255,255,0.2)", color: "#fff", padding: "8px 16px", borderRadius: 8, textDecoration: "none", fontSize: 13, backdropFilter: "blur(4px)" }}>
                      View Analytics
                    </Link>
                    <Link to={`/org/edit/${currentOngoing?._id}`}
                      style={{ background: "rgba(255,255,255,0.2)", color: "#fff", padding: "8px 16px", borderRadius: 8, textDecoration: "none", fontSize: 13, backdropFilter: "blur(4px)" }}>
                      Edit Event
                    </Link>
                  </div>
                </div>
              </div>
              {ongoingEvents.length > 1 && (
                <div style={{ display: "flex", gap: 8, marginTop: 10, justifyContent: "center" }}>
                  {ongoingEvents.map((_, i) => (
                    <button key={i} onClick={() => setCarouselIndex(i)} style={{
                      width: i === carouselIndex % ongoingEvents.length ? 24 : 8,
                      height: 8, borderRadius: 99, border: "none", cursor: "pointer",
                      background: i === carouselIndex % ongoingEvents.length ? "#667eea" : "#d1d5db",
                      transition: "all 0.3s"
                    }} />
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── Event List with Filters ───────────────────────────────────── */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16, flexWrap: "wrap", gap: 10 }}>
          <div style={{ fontWeight: 700, fontSize: 15 }}>All Events ({filtered.length})</div>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {["all", "draft", "published", "ongoing", "completed", "closed"].map((s) => (
              <button key={s} onClick={() => setFilter(s)}
                className={filter === s ? "btn" : "btn btn-outline"}
                style={{ borderRadius: 20, fontSize: 12, padding: "4px 12px" }}>
                {s === "all" ? "All" : s.charAt(0).toUpperCase() + s.slice(1)}
                {s !== "all" && (
                  <span style={{ marginLeft: 4, opacity: 0.7 }}>
                    ({events.filter(e => e.status === s).length})
                  </span>
                )}
              </button>
            ))}
          </div>
          <Link className="btn" to="/org/create" style={{ fontSize: 13 }}>
            + Create Event
          </Link>
        </div>

        {filtered.length === 0 && (
          <div className="muted" style={{ textAlign: "center", padding: "32px 0", fontSize: 14 }}>
            No events{filter !== "all" ? ` with status "${filter}"` : " yet"}.
          </div>
        )}

        <div className="grid3">
          {filtered.map((e) => {
            const sc = STATUS_COLORS[e.status] || STATUS_COLORS.draft;
            const an = analytics[e._id];
            return (
              <div key={e._id} style={{
                background: "#fff", borderRadius: 16, border: "1px solid #e5e7eb",
                padding: 20, boxShadow: "0 2px 8px rgba(0,0,0,0.05)",
                display: "flex", flexDirection: "column", gap: 10
              }}>
                {/* Card Header */}
                <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 8 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, marginBottom: 4 }}>
                      {TYPE_ICONS[e.type]} <span className="muted">{e.type}</span>
                    </div>
                    <h3 style={{ margin: 0, fontSize: 16, lineHeight: 1.3 }}>{e.name}</h3>
                  </div>
                  <span style={{
                    background: sc.bg, color: sc.color, borderRadius: 20,
                    padding: "3px 10px", fontSize: 11, fontWeight: 700, flexShrink: 0
                  }}>{sc.label}</span>
                </div>

                {/* Dates */}
                <div className="muted" style={{ fontSize: 12 }}>
                  📅 {e.startDate ? new Date(e.startDate).toLocaleDateString() : "—"}
                  {" → "}
                  {e.endDate ? new Date(e.endDate).toLocaleDateString() : "—"}
                </div>

                {/* Analytics mini */}
                {an && (
                  <div style={{ display: "flex", gap: 12, fontSize: 12 }}>
                    <span style={{ color: "#10b981" }}>👥 {an.registrations} reg</span>
                    <span style={{ color: "#f59e0b" }}>✅ {an.attendance} attended</span>
                    {an.revenue > 0 && <span style={{ color: "#667eea" }}>₹{an.revenue}</span>}
                  </div>
                )}

                {/* Actions */}
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: "auto" }}>
                  <Link className="btn btn-outline" to={`/org/analytics/${e._id}`} style={{ fontSize: 12, padding: "5px 10px" }}>
                    📊 Analytics
                  </Link>
                  <Link className="btn btn-outline" to={`/org/edit/${e._id}`} style={{ fontSize: 12, padding: "5px 10px" }}>
                    ✏️ Edit
                  </Link>
                  <button className="btn btn-outline" onClick={() => downloadCSV(e._id, e.name)}
                    style={{ fontSize: 12, padding: "5px 10px" }}>
                    ⬇️ CSV
                  </button>
                  {e.type === "merch" && (
                    <Link className="btn btn-outline" to={`/org/orders/${e._id}`} style={{ fontSize: 12, padding: "5px 10px" }}>
                      🛍️ Orders
                    </Link>
                  )}
                  {e.status === "draft" && (
                    <button className="btn" onClick={() => publish(e._id)}
                      style={{ fontSize: 12, padding: "5px 10px" }}>
                      🚀 Publish
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </>
  );
}
