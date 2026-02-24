import { useCallback, useEffect, useState } from "react";
import Navbar from "../components/Navbar";
import { api } from "../api/client";
import { Link } from "react-router-dom";

function orgName(o) {
    return o?.name || `${o?.firstName || ""} ${o?.lastName || ""}`.trim() || "Organizer";
}

export default function ClubsPage() {
    const [organizers, setOrganizers] = useState([]);
    const [following, setFollowing] = useState([]);
    const [err, setErr] = useState("");
    const [msg, setMsg] = useState("");

    const load = useCallback(async () => {
        setErr("");
        try {
            const [orgRes, prefRes] = await Promise.all([
                api.get("/users/organizers"),
                api.get("/users/me/preferences").catch(() => ({ data: { preferences: { followingOrganizers: [] } } })),
            ]);
            setOrganizers(orgRes.data || []);
            setFollowing(prefRes.data?.preferences?.followingOrganizers || []);
        } catch {
            setErr("Failed to load clubs");
        }
    }, []);

    useEffect(() => { load(); }, [load]);

    const toggleFollow = async (id) => {
        setMsg(""); setErr("");
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

    return (
        <>
            <Navbar />
            <div className="container">
                <h2>Clubs &amp; Organizers</h2>
                {msg && <div className="success">{msg}</div>}
                {err && <div className="alert">{err}</div>}

                <div className="grid3">
                    {organizers.length === 0 && (
                        <div className="muted" style={{ gridColumn: "1/-1", textAlign: "center", marginTop: 32 }}>
                            No organizers found.
                        </div>
                    )}
                    {organizers.map((o) => {
                        const isFollowed = following.includes(o._id);
                        const displayName = orgName(o);
                        return (
                            <div className="tile" key={o._id}>
                                <div className="tile-top">
                                    {/* Avatar circle */}
                                    <div style={{ display: "flex", alignItems: "center", gap: 10, flex: 1 }}>
                                        <div style={{
                                            width: 42, height: 42, borderRadius: "50%",
                                            background: "linear-gradient(135deg,#c9a227,#e8d07a)",
                                            color: "#3b2700", fontWeight: 900, fontSize: 16,
                                            display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
                                        }}>{displayName[0]?.toUpperCase()}</div>
                                        <div>
                                            <div style={{ fontWeight: 700, fontSize: 15 }}>{displayName}</div>
                                            {o.category && (
                                                <span style={{
                                                    fontSize: 10, fontWeight: 700, background: "#e0e7ff", color: "#3730a3",
                                                    borderRadius: 20, padding: "1px 8px",
                                                }}>{o.category}</span>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                {o.description && <p className="muted clamp" style={{ fontSize: 13, marginTop: 8 }}>{o.description}</p>}

                                {o.contactEmail && (
                                    <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 4 }}>
                                        ✉️ {o.contactEmail}
                                    </div>
                                )}
                                {o.contactNumber && (
                                    <div style={{ fontSize: 12, color: "var(--muted)" }}>
                                        📞 {o.contactNumber}
                                    </div>
                                )}

                                <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 4, marginBottom: 12 }}>
                                    {(o.followers?.length || 0)} followers
                                </div>

                                <div style={{ display: "flex", gap: 8 }}>
                                    <Link className="btn btn-outline" to={`/clubs/${o._id}`} style={{ fontSize: 12 }}>
                                        View
                                    </Link>
                                    <button
                                        className={isFollowed ? "btn" : "btn btn-outline"}
                                        style={{ fontSize: 12 }}
                                        onClick={() => toggleFollow(o._id)}>
                                        {isFollowed ? "✓ Following" : "Follow"}
                                    </button>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
        </>
    );
}
