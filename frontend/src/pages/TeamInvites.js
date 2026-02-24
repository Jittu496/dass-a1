import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import Navbar from "../components/Navbar";
import { api } from "../api/client";

export default function TeamInvites() {
    const [invites, setInvites] = useState([]);
    const [loading, setLoading] = useState(true);
    const [msg, setMsg] = useState("");
    const [err, setErr] = useState("");
    const navigate = useNavigate();

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const res = await api.get("/teams/invites/pending");
            setInvites(res.data || []);
        } catch (e) {
            setErr(e?.response?.data?.msg || "Failed to load invites");
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { load(); }, [load]);

    const flash = (ok, txt) => {
        if (ok) { setMsg(txt); setErr(""); }
        else { setErr(txt); setMsg(""); }
        setTimeout(() => { setMsg(""); setErr(""); }, 4000);
    };

    const respond = async (teamId, accept) => {
        try {
            await api.post("/teams/invite/respond", { teamId, accept });
            flash(true, accept ? "✓ Joined team! Redirecting…" : "Invite declined");
            if (accept) {
                setTimeout(() => navigate("/team"), 1200);
            } else {
                load();
            }
        } catch (e) {
            flash(false, e?.response?.data?.msg || "Failed to respond to invite");
        }
    };

    return (
        <>
            <Navbar />
            <div className="container">
                <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 8 }}>
                    <button className="btn btn-outline" style={{ fontSize: 13, padding: "6px 14px" }}
                        onClick={() => navigate("/team")}>← Back to Teams</button>
                    <h2 style={{ margin: 0 }}>📬 Team Invites</h2>
                </div>
                <p className="muted" style={{ marginBottom: 24 }}>
                    Review and respond to team invites from other participants.
                </p>

                {msg && <div className="success" style={{ marginBottom: 16 }}>{msg}</div>}
                {err && <div className="alert" style={{ marginBottom: 16 }}>{err}</div>}

                {loading ? (
                    <p className="muted">Loading…</p>
                ) : invites.length === 0 ? (
                    <div style={{
                        textAlign: "center", padding: "60px 20px",
                        background: "#fff", borderRadius: 16, border: "1px solid #e5e7eb"
                    }}>
                        <div style={{ fontSize: 48, marginBottom: 16 }}>📭</div>
                        <h3 style={{ margin: "0 0 8px" }}>No Pending Invites</h3>
                        <p className="muted" style={{ marginBottom: 20 }}>
                            You have no pending team invites right now.
                        </p>
                        <button className="btn" onClick={() => navigate("/team")}>
                            Go to Team Dashboard
                        </button>
                    </div>
                ) : (
                    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                        {invites.map((inv) => {
                            const filled = inv.memberCount;
                            const pct = Math.round((filled / inv.maxSize) * 100);
                            const invitedDate = inv.invitedAt ? new Date(inv.invitedAt) : null;
                            return (
                                <div key={inv._id} style={{
                                    background: "#fff", borderRadius: 16, border: "1px solid #e5e7eb",
                                    padding: 24, boxShadow: "0 2px 8px rgba(0,0,0,0.06)",
                                    display: "flex", gap: 20, alignItems: "flex-start",
                                    flexWrap: "wrap"
                                }}>
                                    {/* Left: avatar placeholder */}
                                    <div style={{
                                        width: 56, height: 56, borderRadius: "50%",
                                        background: "linear-gradient(135deg,#667eea,#764ba2)",
                                        display: "flex", alignItems: "center", justifyContent: "center",
                                        color: "#fff", fontSize: 22, fontWeight: 700, flexShrink: 0
                                    }}>
                                        {inv.teamName.charAt(0).toUpperCase()}
                                    </div>

                                    {/* Middle: info */}
                                    <div style={{ flex: 1, minWidth: 200 }}>
                                        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
                                            <h3 style={{ margin: 0 }}>{inv.teamName}</h3>
                                            <span className="pill" style={{
                                                background: "linear-gradient(135deg,#667eea,#764ba2)",
                                                color: "#fff", fontSize: 11, padding: "2px 10px"
                                            }}>
                                                Forming
                                            </span>
                                        </div>

                                        <div className="muted" style={{ fontSize: 13, marginBottom: 8 }}>
                                            🎯 <b>{inv.event?.name}</b>
                                            {inv.event?.startDate && (
                                                <span style={{ marginLeft: 8 }}>
                                                    · {new Date(inv.event.startDate).toLocaleDateString()}
                                                </span>
                                            )}
                                        </div>

                                        <div className="muted" style={{ fontSize: 13, marginBottom: 10 }}>
                                            👤 Leader: <b>{inv.leader?.firstName} {inv.leader?.lastName}</b>
                                            <span style={{ marginLeft: 4, color: "#9ca3af" }}>({inv.leader?.email})</span>
                                        </div>

                                        {/* Progress */}
                                        <div style={{ marginBottom: 8, maxWidth: 260 }}>
                                            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 4 }}>
                                                <span className="muted">Team size</span>
                                                <span style={{ fontWeight: 600 }}>{filled} / {inv.maxSize}</span>
                                            </div>
                                            <div style={{ background: "#f3f4f6", borderRadius: 99, height: 6 }}>
                                                <div style={{
                                                    height: 6, borderRadius: 99, width: `${pct}%`,
                                                    background: pct === 100 ? "#10b981" : "linear-gradient(90deg,#667eea,#764ba2)"
                                                }} />
                                            </div>
                                        </div>

                                        {invitedDate && (
                                            <div style={{ fontSize: 12, color: "#9ca3af" }}>
                                                Invited {invitedDate.toLocaleDateString()} at {invitedDate.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                                            </div>
                                        )}
                                    </div>

                                    {/* Right: actions */}
                                    <div style={{ display: "flex", flexDirection: "column", gap: 10, alignItems: "flex-end", flexShrink: 0 }}>
                                        <button
                                            className="btn"
                                            style={{ minWidth: 120, background: "linear-gradient(135deg,#10b981,#059669)" }}
                                            onClick={() => respond(inv.teamId, true)}
                                        >
                                            ✓ Accept
                                        </button>
                                        <button
                                            className="btn btn-outline"
                                            style={{ minWidth: 120, color: "#ef4444", borderColor: "#ef4444" }}
                                            onClick={() => respond(inv.teamId, false)}
                                        >
                                            ✕ Decline
                                        </button>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        </>
    );
}
