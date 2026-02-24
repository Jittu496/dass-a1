import { useEffect, useState } from "react";
import Navbar from "../components/Navbar";
import { api } from "../api/client";

function orgName(o) {
  return o?.name || `${o?.firstName || ""} ${o?.lastName || ""}`.trim() || "Organizer";
}
function formatDate(d) {
  return d ? new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "—";
}

export default function MyTickets() {
  const [tickets, setTickets] = useState([]);
  const [err, setErr] = useState("");

  useEffect(() => {
    (async () => {
      try {
        const res = await api.get("/tickets/mine");
        setTickets(res.data || []);
      } catch {
        setErr("Failed to load tickets");
      }
    })();
  }, []);

  const statusColor = (s) => {
    if (s === "used") return { bg: "#fee2e2", color: "#991b1b", label: "Used / Checked-In" };
    if (s === "cancelled") return { bg: "#f3f4f6", color: "#6b7280", label: "Cancelled" };
    return { bg: "#d1fae5", color: "#065f46", label: "Active" };
  };

  return (
    <>
      <Navbar />
      <div className="container">
        <h2>My Tickets</h2>
        <p className="muted" style={{ marginBottom: 20 }}>
          All your event registrations. Show the QR code at the entrance for check-in.
        </p>

        {err && <div className="alert">{err}</div>}

        {tickets.length === 0 && !err && (
          <div className="muted" style={{ textAlign: "center", padding: "48px 20px" }}>
            No tickets yet. Register for an event to get your first ticket!
          </div>
        )}

        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          {tickets.map((t) => {
            const sc = statusColor(t.status);
            return (
              <div key={t._id} style={{
                background: "#fff", borderRadius: 18,
                border: `1.5px solid ${t.status === "active" ? "rgba(16,185,129,0.25)" : "rgba(18,18,18,0.08)"}`,
                boxShadow: "0 2px 12px rgba(0,0,0,0.05)",
                overflow: "hidden",
              }}>
                {/* Header */}
                <div style={{
                  background: t.status === "active"
                    ? "linear-gradient(90deg,#ecfdf5,#d1fae5)"
                    : "#f9fafb",
                  padding: "14px 20px",
                  borderBottom: "1px solid rgba(18,18,18,0.07)",
                  display: "flex", alignItems: "center",
                  justifyContent: "space-between", flexWrap: "wrap", gap: 8,
                }}>
                  <div>
                    <h3 style={{ margin: 0, fontSize: 16 }}>{t.event?.name || "Event"}</h3>
                    <div className="muted" style={{ fontSize: 12, marginTop: 2 }}>
                      {orgName(t.event?.organizer)}
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                    {t.event?.type && (
                      <span style={{
                        background: "#e0e7ff", color: "#3730a3",
                        borderRadius: 20, padding: "2px 10px", fontSize: 11, fontWeight: 700,
                      }}>{t.event.type}</span>
                    )}
                    <span style={{
                      background: sc.bg, color: sc.color,
                      borderRadius: 20, padding: "3px 12px", fontSize: 11, fontWeight: 700,
                    }}>{sc.label}</span>
                  </div>
                </div>

                {/* Body */}
                <div style={{
                  padding: "16px 20px",
                  display: "flex", gap: 24, flexWrap: "wrap", alignItems: "flex-start",
                }}>
                  {/* QR code */}
                  {t.qrDataUrl ? (
                    <div style={{ textAlign: "center", flexShrink: 0 }}>
                      <img src={t.qrDataUrl} alt="QR Code"
                        style={{
                          width: 140, height: 140, border: "2px solid #e5e7eb",
                          borderRadius: 12, padding: 6, background: "#fff", display: "block",
                        }} />
                      <div className="muted" style={{ fontSize: 10, marginTop: 6 }}>
                        Show at entry
                      </div>
                    </div>
                  ) : (
                    <div style={{
                      width: 140, height: 140, borderRadius: 12,
                      border: "2px dashed #e5e7eb",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      color: "#9ca3af", fontSize: 12, textAlign: "center",
                    }}>No QR<br />Available</div>
                  )}

                  {/* Ticket details */}
                  <div style={{ flex: 1, minWidth: 200 }}>
                    <div style={{
                      background: "rgba(102,126,234,0.06)",
                      border: "1px solid rgba(102,126,234,0.20)",
                      borderRadius: 10, padding: "8px 14px",
                      fontFamily: "monospace", fontWeight: 700, fontSize: 14,
                      color: "#667eea", letterSpacing: 1, marginBottom: 14,
                      display: "inline-block",
                    }}>
                      🎫 {t.ticketId}
                    </div>

                    <div style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: 13 }}>
                      {t.event?.startDate && (
                        <InfoRow label="Event Date" value={formatDate(t.event.startDate)} />
                      )}
                      {t.event?.endDate && (
                        <InfoRow label="End Date" value={formatDate(t.event.endDate)} />
                      )}
                      <InfoRow label="Ticket Status" value={sc.label} />
                      {t.checkedInAt && (
                        <InfoRow label="Checked-In At" value={new Date(t.checkedInAt).toLocaleString("en-IN")} />
                      )}
                      {t.event?.eligibility && t.event.eligibility !== "All" && (
                        <InfoRow label="Eligibility" value={t.event.eligibility} />
                      )}
                      {t.registrationResponses && Object.keys(t.registrationResponses).length > 0 && (
                        <div style={{ marginTop: 8 }}>
                          <div className="muted" style={{ fontSize: 11, fontWeight: 800, marginBottom: 4 }}>
                            REGISTRATION RESPONSES
                          </div>
                          {Object.entries(t.registrationResponses).map(([k, v]) => (
                            <InfoRow key={k} label={k} value={String(v)} />
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Footer note */}
                <div style={{
                  padding: "10px 20px",
                  borderTop: "1px solid rgba(18,18,18,0.06)",
                  background: "#fafafa",
                  fontSize: 11, color: "var(--muted)",
                }}>
                  Registered on {t.createdAt ? new Date(t.createdAt).toLocaleDateString("en-IN") : "—"}
                  {" · "}Ticket ID uniquely identifies you at this event
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </>
  );
}

function InfoRow({ label, value }) {
  return (
    <div style={{ display: "flex", gap: 8 }}>
      <span className="muted" style={{ fontSize: 11, minWidth: 100, flexShrink: 0 }}>{label}:</span>
      <span style={{ fontWeight: 600 }}>{value}</span>
    </div>
  );
}
