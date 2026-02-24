import { useEffect, useState } from "react";
import Navbar from "../components/Navbar";
import { api } from "../api/client";

const STAR_COLORS = { 5: "#10b981", 4: "#3b82f6", 3: "#f59e0b", 2: "#f97316", 1: "#ef4444" };

function StarBar({ rating, count, total }) {
  const pct = total > 0 ? Math.round((count / total) * 100) : 0;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
      <span style={{ minWidth: 16, fontSize: 13, fontWeight: 700, color: "#374151" }}>{rating}</span>
      <span style={{ color: "#f59e0b", fontSize: 14 }}>★</span>
      <div style={{ flex: 1, height: 10, background: "#f3f4f6", borderRadius: 20, overflow: "hidden" }}>
        <div style={{
          height: "100%", borderRadius: 20,
          width: `${pct}%`,
          background: STAR_COLORS[rating] || "#6b7280",
          transition: "width 0.4s ease",
        }} />
      </div>
      <span style={{ minWidth: 40, fontSize: 12, color: "#6b7280" }}>{count} ({pct}%)</span>
    </div>
  );
}

function StarDisplay({ rating }) {
  return (
    <span>
      {[1, 2, 3, 4, 5].map(s => (
        <span key={s} style={{ color: s <= rating ? "#f59e0b" : "#d1d5db", fontSize: 15 }}>★</span>
      ))}
    </span>
  );
}

export default function FeedbackOrganizer() {
  const [myEvents, setMyEvents] = useState([]);
  const [eventId, setEventId] = useState("");
  const [data, setData] = useState(null);
  const [ratingFilter, setRatingFilter] = useState("");
  const [page, setPage] = useState(1);
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);

  // Load organizer's events once
  useEffect(() => {
    api.get("/events/org/mine/list")
      .then(r => {
        setMyEvents(r.data || []);
        if (r.data?.[0]?._id) setEventId(r.data[0]._id);
      })
      .catch(() => setErr("Failed to load events"));
  }, []);

  // Load feedback when event/filter/page changes
  const loadAgg = async (id, rf, pg) => {
    if (!id) return;
    setLoading(true); setErr("");
    try {
      const params = { page: pg || 1, limit: 20 };
      if (rf) params.rating = rf;
      const res = await api.get(`/feedback/${id}/aggregate`, { params });
      setData(res.data);
    } catch (e) {
      setErr(e?.response?.data?.msg || "Failed to load feedback");
      setData(null);
    } finally { setLoading(false); }
  };

  useEffect(() => {
    if (eventId) { setPage(1); loadAgg(eventId, ratingFilter, 1); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventId, ratingFilter]);

  const handlePageChange = (pg) => {
    setPage(pg);
    loadAgg(eventId, ratingFilter, pg);
  };

  const exportCSV = async () => {
    if (!eventId) return;
    setExporting(true);
    try {
      const res = await api.get(`/feedback/${eventId}/export`, { responseType: "blob" });
      const url = URL.createObjectURL(res.data);
      const a = document.createElement("a");
      const ev = myEvents.find(e => e._id === eventId);
      a.href = url;
      a.download = `feedback_${ev?.name || eventId}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch {
      setErr("Export failed");
    } finally { setExporting(false); }
  };

  const avgColor = data ? (data.avg >= 4 ? "#10b981" : data.avg >= 3 ? "#f59e0b" : "#ef4444") : "#6b7280";

  return (
    <>
      <Navbar />
      <div className="container">
        <h2>Feedback Analytics</h2>
        {err && <div className="alert">{err}</div>}

        {/* Event picker + export */}
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center", marginBottom: 20 }}>
          <select className="input" style={{ flex: 1, minWidth: 200 }}
            value={eventId} onChange={e => setEventId(e.target.value)}>
            {myEvents.map(ev => (
              <option key={ev._id} value={ev._id}>{ev.name}</option>
            ))}
          </select>
          <button className="btn btn-outline" style={{ fontSize: 13 }}
            onClick={() => loadAgg(eventId, ratingFilter, page)}>Refresh</button>
          <button className="btn" style={{ fontSize: 13, background: "#10b981", borderColor: "#10b981" }}
            onClick={exportCSV} disabled={!data || exporting}>
            {exporting ? "Exporting…" : "Export CSV"}
          </button>
        </div>

        {loading && <div className="muted" style={{ textAlign: "center", padding: "32px 0" }}>Loading…</div>}

        {data && !loading && (
          <>
            {/* ── Stats Row ── */}
            <div className="grid3" style={{ marginBottom: 24 }}>
              {/* Average */}
              <div className="card" style={{ padding: "20px 24px", textAlign: "center" }}>
                <div style={{ fontSize: 11, fontWeight: 800, color: "var(--muted)", marginBottom: 8 }}>
                  AVERAGE RATING
                </div>
                <div style={{ fontSize: 48, fontWeight: 900, color: avgColor, lineHeight: 1 }}>
                  {data.avg > 0 ? data.avg : "—"}
                </div>
                <div style={{ color: "#f59e0b", fontSize: 20, marginTop: 4 }}>
                  {"★".repeat(Math.round(data.avg))}{"☆".repeat(5 - Math.round(data.avg))}
                </div>
              </div>

              {/* Total */}
              <div className="card" style={{ padding: "20px 24px", textAlign: "center" }}>
                <div style={{ fontSize: 11, fontWeight: 800, color: "var(--muted)", marginBottom: 8 }}>
                  TOTAL RESPONSES
                </div>
                <div style={{ fontSize: 48, fontWeight: 900, color: "#374151", lineHeight: 1 }}>
                  {data.count}
                </div>
              </div>

              {/* Distribution bars */}
              <div className="card" style={{ padding: "20px 24px" }}>
                <div style={{ fontSize: 11, fontWeight: 800, color: "var(--muted)", marginBottom: 12 }}>
                  RATING DISTRIBUTION
                </div>
                {[5, 4, 3, 2, 1].map(r => (
                  <StarBar key={r} rating={r} count={data.dist[r] || 0} total={data.count} />
                ))}
              </div>
            </div>

            {/* ── Filter + Comments ── */}
            <div className="card wide" style={{ padding: "20px 24px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16, flexWrap: "wrap" }}>
                <h3 style={{ margin: 0, flex: 1 }}>Comments</h3>
                <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
                  <span className="muted" style={{ fontSize: 12 }}>Filter by rating:</span>
                  <button
                    className={ratingFilter === "" ? "btn" : "btn btn-outline"}
                    style={{ fontSize: 11, padding: "4px 10px", borderRadius: 20 }}
                    onClick={() => setRatingFilter("")}>All</button>
                  {[5, 4, 3, 2, 1].map(r => (
                    <button key={r}
                      className={ratingFilter === String(r) ? "btn" : "btn btn-outline"}
                      style={{
                        fontSize: 11, padding: "4px 10px", borderRadius: 20,
                        ...(ratingFilter === String(r) ? { background: STAR_COLORS[r], borderColor: STAR_COLORS[r] } : {})
                      }}
                      onClick={() => setRatingFilter(String(r))}>
                      {r}★
                    </button>
                  ))}
                </div>
              </div>

              {/* Showing X of Y */}
              <div className="muted" style={{ fontSize: 12, marginBottom: 12 }}>
                Showing {data.filtered.items.length} of {data.filtered.total} responses
                {ratingFilter ? ` with ${ratingFilter}★` : ""}
              </div>

              {data.filtered.items.length === 0 && (
                <div className="muted" style={{ textAlign: "center", padding: "20px 0" }}>
                  No feedback matching this filter.
                </div>
              )}

              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {data.filtered.items.map((f, i) => (
                  <div key={f._id || i} style={{
                    background: "#fafafa", borderRadius: 12,
                    border: "1px solid rgba(18,18,18,0.07)",
                    padding: "12px 16px",
                    display: "flex", gap: 14, alignItems: "flex-start",
                  }}>
                    {/* Star badge */}
                    <div style={{
                      width: 42, height: 42, borderRadius: "50%", flexShrink: 0,
                      background: STAR_COLORS[f.rating] || "#6b7280",
                      color: "#fff", fontWeight: 900, fontSize: 14,
                      display: "flex", alignItems: "center", justifyContent: "center",
                    }}>{f.rating}★</div>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                        <StarDisplay rating={f.rating} />
                        <span className="muted" style={{ fontSize: 11 }}>
                          {new Date(f.createdAt).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}
                        </span>
                      </div>
                      {f.comment ? (
                        <p style={{ margin: 0, fontSize: 13, color: "#374151" }}>{f.comment}</p>
                      ) : (
                        <span className="muted" style={{ fontSize: 12 }}>No comment</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {/* Pagination */}
              {data.filtered.total > data.filtered.limit && (
                <div style={{ display: "flex", gap: 8, justifyContent: "center", marginTop: 16 }}>
                  <button className="btn btn-outline" style={{ fontSize: 12 }}
                    disabled={page <= 1} onClick={() => handlePageChange(page - 1)}>← Prev</button>
                  <span className="muted" style={{ fontSize: 12, alignSelf: "center" }}>
                    Page {page} of {Math.ceil(data.filtered.total / data.filtered.limit)}
                  </span>
                  <button className="btn btn-outline" style={{ fontSize: 12 }}
                    disabled={page >= Math.ceil(data.filtered.total / data.filtered.limit)}
                    onClick={() => handlePageChange(page + 1)}>Next →</button>
                </div>
              )}
            </div>
          </>
        )}

        {data?.count === 0 && !loading && (
          <div className="muted" style={{ textAlign: "center", padding: "40px 0" }}>
            No feedback submitted for this event yet.
          </div>
        )}
      </div>
    </>
  );
}
