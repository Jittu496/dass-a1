import { useCallback, useEffect, useState } from "react";
import Navbar from "../components/Navbar";
import { api } from "../api/client";
import { Link } from "react-router-dom";

// ── helpers ──────────────────────────────────────────────────────
function orgName(o) {
  if (!o) return "—";
  return o.name || `${o.firstName || ""} ${o.lastName || ""}`.trim() || "Organizer";
}
function formatDate(d) {
  return d ? new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "—";
}

const TYPE_PILL = {
  normal: { bg: "#dbeafe", color: "#1e40af" },
  hackathon: { bg: "#fce7f3", color: "#9d174d" },
  merch: { bg: "#fef9c3", color: "#854d0e" },
};

export default function BrowseEvents() {
  const [events, setEvents] = useState([]);
  const [trending, setTrending] = useState([]);
  const [search, setSearch] = useState("");
  const [type, setType] = useState("");
  const [eligibility, setEligibility] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [filter, setFilter] = useState("all"); // all | followed
  const [following, setFollowing] = useState([]);
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);

  // Load following list + trending ONCE on mount
  useEffect(() => {
    api.get("/events/trending").then(r => setTrending(r.data || [])).catch(() => { });
    api.get("/users/me/preferences")
      .then(r => setFollowing(r.data?.preferences?.followingOrganizers || []))
      .catch(() => { });
  }, []); // ← empty dep array: runs once only

  // Main load — takes followersList as argument to avoid stale closure
  const load = useCallback(async (followersList) => {
    setErr(""); setLoading(true);
    try {
      const params = {};
      if (search.trim()) params.search = search.trim();
      if (type) params.type = type;
      if (eligibility) params.eligibility = eligibility;
      if (dateFrom) params.dateFrom = dateFrom;
      if (dateTo) params.dateTo = dateTo;
      const fl = Array.isArray(followersList) ? followersList : following;
      if (filter === "followed" && fl.length)
        params.followedOrganizers = fl.join(",");

      const res = await api.get("/events", { params });
      setEvents(res.data || []);
    } catch {
      setErr("Failed to load events");
    } finally { setLoading(false); }
  }, [search, type, eligibility, dateFrom, dateTo, filter, following]);

  // Initial load + re-run only when filters/search change (not following)
  useEffect(() => { load(); }, [load]);

  // Debounce search: only fire API after user stops typing 400ms
  useEffect(() => {
    const t = setTimeout(() => { load(); }, 400);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  const trendingIds = new Set(trending.map(e => e._id));

  return (
    <>
      <Navbar />
      <div className="container">
        <h2>Browse Events</h2>

        {/* ── Trending strip ───────────────────────────────────── */}
        {trending.length > 0 && (
          <div style={{ marginBottom: 24 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
              <span style={{ fontSize: 18 }}>🔥</span>
              <h3 style={{ margin: 0, fontSize: 15 }}>Trending (Top 5 in last 24h)</h3>
            </div>
            <div style={{ display: "flex", gap: 10, overflowX: "auto", paddingBottom: 4 }}>
              {trending.map(e => {
                const pill = TYPE_PILL[e.type] || {};
                return (
                  <Link key={e._id} to={`/events/${e._id}`}
                    style={{
                      flexShrink: 0, minWidth: 200, padding: "12px 16px",
                      background: "#fff", borderRadius: 14, border: "1.5px solid rgba(201,162,39,0.30)",
                      textDecoration: "none", color: "inherit",
                      boxShadow: "0 2px 10px rgba(0,0,0,0.06)",
                    }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
                      <span style={{
                        fontSize: 11, fontWeight: 800, ...pill,
                        borderRadius: 20, padding: "2px 8px"
                      }}>{e.type}</span>
                      <span style={{ fontSize: 11, color: "#c9a227", fontWeight: 700 }}>
                        🔥 {e._regCount} reg
                      </span>
                    </div>
                    <div style={{ fontWeight: 700, fontSize: 14 }}>{e.name}</div>
                    <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 3 }}>
                      {orgName(e.organizer)}
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>
        )}

        {/* ── Filters ─────────────────────────────────────────── */}
        <div style={{
          background: "#fff", borderRadius: 14, padding: "16px 20px",
          border: "1px solid rgba(18,18,18,0.08)", marginBottom: 20,
          display: "flex", flexDirection: "column", gap: 12,
        }}>
          {/* Search bar */}
          <div style={{ display: "flex", gap: 8 }}>
            <input className="input" placeholder="🔍  Search events or organizers…"
              value={search} onChange={e => setSearch(e.target.value)}
              onKeyDown={e => e.key === "Enter" && load()}
              style={{ flex: 1 }} />
            <button className="btn" onClick={load}>Search</button>
          </div>

          {/* Filter row */}
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
            <select className="input" style={{ minWidth: 120 }} value={type} onChange={e => setType(e.target.value)}>
              <option value="">All Types</option>
              <option value="normal">Normal</option>
              <option value="merch">Merchandise</option>
              <option value="hackathon">Hackathon</option>
            </select>
            <select className="input" style={{ minWidth: 130 }} value={eligibility} onChange={e => setEligibility(e.target.value)}>
              <option value="">All Eligibility</option>
              <option value="IIIT">IIIT Only</option>
              <option value="Non-IIIT">Non-IIIT</option>
              <option value="All">All</option>
            </select>
            <input className="input" type="date" title="From date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} style={{ minWidth: 130 }} />
            <span className="muted" style={{ fontSize: 12 }}>to</span>
            <input className="input" type="date" title="To date" value={dateTo} onChange={e => setDateTo(e.target.value)} style={{ minWidth: 130 }} />
            <button
              className={filter === "followed" ? "btn" : "btn btn-outline"}
              onClick={() => setFilter(f => f === "followed" ? "all" : "followed")}
              style={{ fontSize: 12 }}>
              {filter === "followed" ? "✓ Followed Clubs" : "Followed Clubs"}
            </button>
            <button className="btn btn-outline" onClick={() => {
              setSearch(""); setType(""); setEligibility(""); setDateFrom(""); setDateTo(""); setFilter("all");
            }} style={{ fontSize: 12 }}>Clear</button>
          </div>
        </div>

        {err && <div className="alert">{err}</div>}

        {loading && <div className="muted" style={{ textAlign: "center", padding: "32px 0" }}>Loading…</div>}

        {!loading && events.length === 0 && (
          <div className="muted" style={{ textAlign: "center", marginTop: 40, fontSize: 14 }}>
            No events found. Try adjusting your filters.
          </div>
        )}

        {/* ── Event Grid ──────────────────────────────────────── */}
        <div className="grid3">
          {events.map(e => {
            const pill = TYPE_PILL[e.type] || {};
            const isTrending = trendingIds.has(e._id);
            return (
              <div key={e._id} className="tile" style={{
                border: isTrending ? "1.5px solid rgba(201,162,39,0.35)" : undefined,
              }}>
                <div className="tile-top">
                  <h3 style={{ margin: 0, fontSize: 15 }}>
                    {isTrending && <span style={{ fontSize: 14 }}>🔥 </span>}
                    {e.name}
                  </h3>
                  <span style={{
                    ...pill, borderRadius: 20, padding: "2px 10px",
                    fontSize: 11, fontWeight: 700, whiteSpace: "nowrap",
                  }}>{e.type}</span>
                </div>
                <div className="muted" style={{ fontSize: 12, marginBottom: 6 }}>
                  {orgName(e.organizer)}
                </div>
                <p className="muted clamp" style={{ fontSize: 13, marginBottom: 6 }}>
                  {e.description || "No description"}
                </p>
                <div style={{ fontSize: 11, color: "var(--muted)", marginBottom: 10, display: "flex", gap: 10, flexWrap: "wrap" }}>
                  <span>📅 {formatDate(e.startDate)}</span>
                  {e.eligibility && e.eligibility !== "All" && <span>🎓 {e.eligibility}</span>}
                  {e.fee > 0 ? <span>₹{e.fee}</span> : <span style={{ color: "#10b981" }}>Free</span>}
                  <span style={{
                    padding: "1px 7px", borderRadius: 20, fontSize: 10, fontWeight: 700,
                    background: e.status === "published" || e.status === "ongoing" ? "#d1fae5" : "#f3f4f6",
                    color: e.status === "published" || e.status === "ongoing" ? "#065f46" : "#6b7280",
                  }}>{e.status}</span>
                </div>
                <Link className="btn btn-outline" to={`/events/${e._id}`} style={{ fontSize: 12 }}>
                  View Details
                </Link>
              </div>
            );
          })}
        </div>
      </div>
    </>
  );
}
