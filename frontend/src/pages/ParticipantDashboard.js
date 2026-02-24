import { useCallback, useEffect, useState } from "react";
import Navbar from "../components/Navbar";
import { api } from "../api/client";
import { Link } from "react-router-dom";

// ── helpers ──────────────────────────────────────────────────────
const TABS = ["Upcoming", "Normal", "Merchandise", "Completed", "Cancelled"];

function orgName(o) {
    if (!o) return "—";
    return o.name || `${o.firstName || ""} ${o.lastName || ""}`.trim() || "Organizer";
}

function pill(label, bg = "#e5e7eb", color = "#374151") {
    return (
        <span style={{
            background: bg, color, borderRadius: 20, padding: "2px 10px",
            fontSize: 10, fontWeight: 800, letterSpacing: "0.3px",
        }}>{label}</span>
    );
}

const TYPE_COLOR = {
    normal: ["#dbeafe", "#1e40af"],
    hackathon: ["#fce7f3", "#9d174d"],
    merch: ["#fef9c3", "#854d0e"],
};

export default function ParticipantDashboard() {
    const [tickets, setTickets] = useState([]);
    const [orders, setOrders] = useState([]);
    const [myTeams, setMyTeams] = useState([]);
    const [pendingInviteCount, setPendingInviteCount] = useState(0);
    const [tab, setTab] = useState("Upcoming");
    const [err, setErr] = useState("");
    const [ticketModal, setTicketModal] = useState(null); // ticket object to preview

    const load = useCallback(async () => {
        setErr("");
        try {
            const [tRes, oRes, teamsRes, invitesRes] = await Promise.all([
                api.get("/tickets/mine"),
                api.get("/orders/mine"),
                api.get("/teams/mine"),
                api.get("/teams/invites/pending"),
            ]);
            setTickets(tRes.data || []);
            setOrders(oRes.data || []);
            setMyTeams(teamsRes.data || []);
            setPendingInviteCount((invitesRes.data || []).length);
        } catch {
            setErr("Failed to load your events");
        }
    }, []);

    useEffect(() => { load(); }, [load]);

    const now = new Date();

    const filteredTickets = tickets.filter((t) => {
        const start = t.event?.startDate ? new Date(t.event.startDate) : null;
        const isUsed = t.status === "used" || t.event?.status === "completed";
        if (tab === "Upcoming") return t.status === "active" && start && start >= now;
        if (tab === "Normal") return t.event?.type === "normal";
        if (tab === "Completed") return isUsed;
        if (tab === "Cancelled") return t.status === "cancelled";
        return false;
    });

    const filteredOrders = tab === "Merchandise" ? orders : [];

    // find team for a hackathon ticket
    const teamForEvent = (eventId) =>
        myTeams.find(t => String(t.event) === String(eventId) || String(t.event?._id) === String(eventId));

    return (
        <>
            <Navbar />
            <div className="container">
                <h2>My Events Dashboard</h2>
                {err && <div className="alert">{err}</div>}

                {/* Teams & Invites */}
                <div style={{
                    background: "linear-gradient(135deg,#667eea15,#764ba215)",
                    border: "1px solid #667eea30", borderRadius: 14,
                    padding: "16px 20px", marginBottom: 24,
                    display: "flex", alignItems: "center", justifyContent: "space-between",
                    flexWrap: "wrap", gap: 12,
                }}>
                    <div>
                        <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 4 }}>Hackathon Teams</div>
                        <div className="muted" style={{ fontSize: 13 }}>
                            {myTeams.length > 0
                                ? myTeams.map((t) => (
                                    <span key={t._id} style={{ marginRight: 12 }}>
                                        <b>{t.teamName}</b>
                                        <span style={{
                                            marginLeft: 6, fontSize: 11,
                                            background: t.status === "finalized" ? "#10b981" : "#f59e0b",
                                            color: "#fff", borderRadius: 10, padding: "1px 7px",
                                        }}>{t.status}</span>
                                    </span>
                                ))
                                : "No active teams — create or join one!"}
                        </div>
                    </div>
                    <div style={{ display: "flex", gap: 10 }}>
                        {pendingInviteCount > 0 && (
                            <Link to="/team/invites" className="btn" style={{ fontSize: 13, position: "relative" }}>
                                Invites
                                <span style={{
                                    position: "absolute", top: -6, right: -6,
                                    background: "#ef4444", color: "#fff",
                                    borderRadius: "50%", width: 18, height: 18,
                                    display: "flex", alignItems: "center", justifyContent: "center",
                                    fontSize: 10, fontWeight: 700,
                                }}>{pendingInviteCount}</span>
                            </Link>
                        )}
                        <Link to="/team" className="btn btn-outline" style={{ fontSize: 13 }}>
                            Manage Teams →
                        </Link>
                    </div>
                </div>

                {/* Tabs */}
                <div style={{ display: "flex", gap: 8, marginBottom: 16, borderBottom: "2px solid #eee", paddingBottom: 8, flexWrap: "wrap" }}>
                    {TABS.map((t) => (
                        <button key={t} onClick={() => setTab(t)}
                            className={tab === t ? "btn" : "btn btn-outline"}
                            style={{ borderRadius: 20, fontSize: 13 }}>{t}</button>
                    ))}
                </div>

                {/* Ticket-based tabs */}
                {tab !== "Merchandise" && (
                    <div className="grid3">
                        {filteredTickets.length === 0 && (
                            <div className="muted" style={{ gridColumn: "1/-1", textAlign: "center", marginTop: 32 }}>
                                No events in this category.
                            </div>
                        )}
                        {filteredTickets.map((t) => {
                            const [tBg, tColor] = TYPE_COLOR[t.event?.type] || ["#e5e7eb", "#374151"];
                            const team = t.event?.type === "hackathon" ? teamForEvent(t.event?._id) : null;
                            return (
                                <div className="tile" key={t._id}>
                                    <div className="tile-top" style={{ marginBottom: 8 }}>
                                        <h3 style={{ margin: 0, fontSize: 15 }}>{t.event?.name || "Event"}</h3>
                                        {pill(t.event?.type, tBg, tColor)}
                                    </div>

                                    <div style={{ fontSize: 12, color: "var(--muted)", marginBottom: 4 }}>
                                        <b>Organizer:</b> {orgName(t.event?.organizer)}
                                    </div>
                                    {t.event?.startDate && (
                                        <div style={{ fontSize: 12, color: "var(--muted)", marginBottom: 4 }}>
                                            <b>Date:</b> {new Date(t.event.startDate).toLocaleDateString("en-IN")}
                                        </div>
                                    )}
                                    <div style={{ fontSize: 12, color: "var(--muted)", marginBottom: 4 }}>
                                        <b>Status:</b> {t.status}
                                        {" · "}
                                        <b>Event:</b> {t.event?.status}
                                    </div>
                                    {team && (
                                        <div style={{ fontSize: 12, color: "var(--muted)", marginBottom: 4 }}>
                                            <b>Team:</b> {team.teamName}
                                        </div>
                                    )}
                                    {/* Clickable Ticket ID */}
                                    <button onClick={() => setTicketModal(t)}
                                        style={{
                                            fontSize: 11, fontFamily: "monospace", fontWeight: 700,
                                            color: "#667eea", background: "rgba(102,126,234,0.08)",
                                            border: "1px solid rgba(102,126,234,0.25)", borderRadius: 8,
                                            padding: "4px 10px", cursor: "pointer", marginBottom: 8,
                                            display: "block", width: "100%", textAlign: "left",
                                        }}>
                                        🎫 {t.ticketId}
                                    </button>
                                    <Link className="btn btn-outline" style={{ fontSize: 12 }} to="/my-tickets">
                                        All Tickets
                                    </Link>
                                </div>
                            );
                        })}
                    </div>
                )}

                {/* Merchandise tab */}
                {tab === "Merchandise" && (
                    <div className="grid3">
                        {filteredOrders.length === 0 && (
                            <div className="muted" style={{ gridColumn: "1/-1", textAlign: "center", marginTop: 32 }}>
                                No merchandise orders yet.
                            </div>
                        )}
                        {filteredOrders.map((o) => (
                            <div className="tile" key={o._id}>
                                <div className="tile-top" style={{ marginBottom: 8 }}>
                                    <h3 style={{ margin: 0, fontSize: 15 }}>{o.event?.name || "Merch Event"}</h3>
                                    {pill("merch", "#fef9c3", "#854d0e")}
                                </div>
                                <div style={{ fontSize: 12, color: "var(--muted)", marginBottom: 4 }}>
                                    <b>Organizer:</b> {orgName(o.event?.organizer)}
                                </div>
                                <div style={{ fontSize: 12, color: "var(--muted)", marginBottom: 4 }}>
                                    Qty: <b>{o.quantity}</b> · Amount: <b>₹{o.amount}</b>
                                </div>
                                {o.variantSnapshot?.name && (
                                    <div style={{ fontSize: 12, color: "var(--muted)", marginBottom: 4 }}>
                                        Variant: {o.variantSnapshot.name}
                                        {o.variantSnapshot.size ? ` · ${o.variantSnapshot.size}` : ""}
                                    </div>
                                )}
                                <div style={{ fontSize: 12, marginBottom: 8 }}>
                                    Status:{" "}
                                    <span style={{
                                        fontWeight: 700,
                                        color: o.status === "approved" ? "#10b981" : o.status === "rejected" ? "#ef4444" : "#f59e0b",
                                    }}>{o.status}</span>
                                </div>
                                <Link className="btn btn-outline" style={{ fontSize: 12 }} to="/my-orders">
                                    View Order
                                </Link>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* ── Ticket Preview Modal ── */}
            {ticketModal && (
                <div
                    style={{
                        position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)",
                        display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000,
                    }}
                    onClick={() => setTicketModal(null)}
                >
                    <div style={{
                        background: "#fff", borderRadius: 20, padding: "28px 32px",
                        maxWidth: 380, width: "90%", boxShadow: "0 8px 40px rgba(0,0,0,0.3)",
                    }} onClick={e => e.stopPropagation()}>
                        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
                            <span style={{ fontSize: 24 }}>🎫</span>
                            <h3 style={{ margin: 0 }}>{ticketModal.event?.name}</h3>
                        </div>
                        {ticketModal.qrDataUrl && (
                            <div style={{ textAlign: "center", marginBottom: 16 }}>
                                <img src={ticketModal.qrDataUrl} alt="QR Code"
                                    style={{ width: 160, height: 160, border: "2px solid #e5e7eb", borderRadius: 12, padding: 6 }} />
                            </div>
                        )}
                        <div style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: 13 }}>
                            <Row label="Ticket ID" value={<code style={{ fontFamily: "monospace" }}>{ticketModal.ticketId}</code>} />
                            <Row label="Organizer" value={orgName(ticketModal.event?.organizer)} />
                            <Row label="Date" value={ticketModal.event?.startDate ? new Date(ticketModal.event.startDate).toLocaleDateString("en-IN") : "—"} />
                            <Row label="Status" value={<b style={{ color: ticketModal.status === "used" ? "#ef4444" : "#10b981" }}>{ticketModal.status}</b>} />
                            {ticketModal.event?.type && <Row label="Type" value={ticketModal.event.type} />}
                        </div>
                        <div className="muted" style={{ textAlign: "center", fontSize: 11, marginTop: 14 }}>
                            Show this QR at the event entrance
                        </div>
                        <button className="btn" style={{ width: "100%", marginTop: 16 }}
                            onClick={() => setTicketModal(null)}>Close</button>
                    </div>
                </div>
            )}
        </>
    );
}

function Row({ label, value }) {
    return (
        <div style={{ display: "flex", gap: 8, alignItems: "baseline" }}>
            <span className="muted" style={{ fontSize: 11, minWidth: 80 }}>{label}:</span>
            <span>{value}</span>
        </div>
    );
}
