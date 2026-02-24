import { useCallback, useEffect, useState } from "react";
import Navbar from "../components/Navbar";
import { api } from "../api/client";
import { useParams, Link } from "react-router-dom";

function orgName(o) {
    return o?.name || `${o?.firstName || ""} ${o?.lastName || ""}`.trim() || "Organizer";
}

export default function OrganizerDetailPage() {
    const { id } = useParams();
    const [data, setData] = useState(null);
    const [err, setErr] = useState("");
    const [following, setFollowing] = useState([]);
    const [msg, setMsg] = useState("");

    const load = useCallback(async () => {
        setErr("");
        try {
            const [res, prefRes] = await Promise.all([
                api.get(`/users/organizers/${id}`),
                api.get("/users/me/preferences").catch(() => ({ data: { preferences: { followingOrganizers: [] } } })),
            ]);
            setData(res.data);
            setFollowing(prefRes.data?.preferences?.followingOrganizers || []);
        } catch (e) {
            setErr(e?.response?.data?.msg || "Failed to load organizer");
        }
    }, [id]);

    useEffect(() => { load(); }, [load]);

    const toggleFollow = async () => {
        if (!data) return;
        const isFollowing = following.includes(id);
        const updated = isFollowing ? following.filter(f => f !== id) : [...following, id];
        try {
            await api.put("/users/me/preferences", { followingOrganizers: updated });
            setFollowing(updated);
            setMsg(isFollowing ? "Unfollowed" : "Now following!");
            setTimeout(() => setMsg(""), 2000);
        } catch {
            setErr("Failed to update follow");
        }
    };

    if (!data) {
        return (
            <>
                <Navbar />
                <div className="container">
                    {err ? <div className="alert">{err}</div> : <div className="muted">Loading…</div>}
                </div>
            </>
        );
    }

    const { organizer, upcoming, past } = data;
    const displayName = orgName(organizer);
    const isFollowed = following.includes(id);

    return (
        <>
            <Navbar />
            <div className="container">
                {msg && <div className="success">{msg}</div>}
                {err && <div className="alert">{err}</div>}

                {/* ── Organizer Info Card ── */}
                <div className="card wide" style={{ padding: "24px 28px", marginBottom: 24 }}>
                    <div style={{ display: "flex", alignItems: "flex-start", gap: 20, flexWrap: "wrap" }}>
                        {/* Avatar */}
                        <div style={{
                            width: 64, height: 64, borderRadius: "50%", flexShrink: 0,
                            background: "linear-gradient(135deg,#c9a227,#e8d07a)",
                            color: "#3b2700", fontWeight: 900, fontSize: 26,
                            display: "flex", alignItems: "center", justifyContent: "center",
                        }}>{displayName[0]?.toUpperCase()}</div>

                        <div style={{ flex: 1, minWidth: 200 }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap", marginBottom: 6 }}>
                                <h2 style={{ margin: 0, fontSize: 22 }}>{displayName}</h2>
                                {organizer.category && (
                                    <span style={{
                                        background: "#e0e7ff", color: "#3730a3", borderRadius: 20,
                                        padding: "3px 12px", fontSize: 12, fontWeight: 700,
                                    }}>{organizer.category}</span>
                                )}
                            </div>

                            {organizer.description && (
                                <p className="muted" style={{ fontSize: 14, marginBottom: 10 }}>{organizer.description}</p>
                            )}

                            {/* Contact info */}
                            <div style={{ display: "flex", gap: 16, flexWrap: "wrap", fontSize: 13, color: "var(--muted)" }}>
                                {(organizer.contactEmail || organizer.email) && (
                                    <span>✉️ {organizer.contactEmail || organizer.email}</span>
                                )}
                                {organizer.contactNumber && <span>📞 {organizer.contactNumber}</span>}
                                <span>👥 {(organizer.followers?.length || 0)} followers</span>
                            </div>
                        </div>

                        <button
                            className={isFollowed ? "btn" : "btn btn-outline"}
                            onClick={toggleFollow}
                            style={{ alignSelf: "flex-start" }}>
                            {isFollowed ? "✓ Following" : "Follow"}
                        </button>
                    </div>
                </div>

                {/* ── Upcoming Events ── */}
                <h3 style={{ marginBottom: 12 }}>Upcoming Events</h3>
                {upcoming.length === 0 && <div className="muted" style={{ marginBottom: 24 }}>No upcoming events.</div>}
                <div className="grid3" style={{ marginBottom: 32 }}>
                    {upcoming.map(e => (
                        <div className="tile" key={e._id}>
                            <div className="tile-top">
                                <h4 style={{ margin: 0 }}>{e.name}</h4>
                                <span className="pill">{e.type}</span>
                            </div>
                            <div className="tiny muted">Start: {new Date(e.startDate).toLocaleDateString("en-IN")}</div>
                            {e.fee > 0 ? (
                                <div className="tiny muted">Fee: ₹{e.fee}</div>
                            ) : (
                                <div className="tiny" style={{ color: "#10b981" }}>Free</div>
                            )}
                            <Link className="btn btn-outline" style={{ marginTop: 8, fontSize: 12 }} to={`/events/${e._id}`}>View</Link>
                        </div>
                    ))}
                </div>

                {/* ── Past Events ── */}
                <h3 style={{ marginBottom: 12 }}>Past Events</h3>
                {past.length === 0 && <div className="muted">No past events.</div>}
                <div className="grid3">
                    {past.map(e => (
                        <div className="tile" key={e._id} style={{ opacity: 0.85 }}>
                            <div className="tile-top">
                                <h4 style={{ margin: 0 }}>{e.name}</h4>
                                <span className="pill">{e.status}</span>
                            </div>
                            <div className="tiny muted">
                                Ended: {e.endDate ? new Date(e.endDate).toLocaleDateString("en-IN") : "—"}
                            </div>
                            <Link className="btn btn-outline" style={{ marginTop: 8, fontSize: 12 }} to={`/events/${e._id}`}>View</Link>
                        </div>
                    ))}
                </div>
            </div>
        </>
    );
}
