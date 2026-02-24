import { useEffect, useState, useCallback } from "react";
import Navbar from "../components/Navbar";
import { api } from "../api/client";

const BACKEND = process.env.REACT_APP_API_URL?.replace("/api", "") || "http://localhost:5000";

const STATUS_STYLE = {
  pending: { bg: "#fef3c7", color: "#92400e", label: "Pending Approval" },
  approved: { bg: "#d1fae5", color: "#065f46", label: "Approved" },
  rejected: { bg: "#fee2e2", color: "#991b1b", label: "Rejected" },
};

export default function MyOrders() {
  const [orders, setOrders] = useState([]);
  const [tickets, setTickets] = useState({}); // orderId → ticket
  const [err, setErr] = useState("");
  const [msg, setMsg] = useState("");
  const [uploading, setUploading] = useState({});
  const [previewImg, setPreviewImg] = useState(null);

  const load = useCallback(async () => {
    setErr(""); setMsg("");
    try {
      const res = await api.get("/orders/mine");
      const loaded = res.data || [];
      setOrders(loaded);
      const approved = loaded.filter(o => o.status === "approved");
      const pairs = await Promise.all(
        approved.map(async o => {
          try { const r = await api.get(`/tickets/for-order/${o._id}`); return [o._id, r.data]; }
          catch { return [o._id, null]; }
        })
      );
      const map = {};
      pairs.forEach(([id, t]) => { if (t) map[id] = t; });
      setTickets(map);
    } catch {
      setErr("Failed to load orders");
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const uploadProof = async (orderId, file) => {
    setUploading(u => ({ ...u, [orderId]: true }));
    setErr(""); setMsg("");
    try {
      const form = new FormData();
      form.append("proof", file);
      await api.post(`/orders/${orderId}/proof`, form, { headers: { "Content-Type": "multipart/form-data" } });
      setMsg("Payment proof uploaded. Your order is now pending organizer review.");
      load();
    } catch (e) {
      setErr(e?.response?.data?.msg || "Upload failed");
    } finally {
      setUploading(u => ({ ...u, [orderId]: false }));
    }
  };

  if (orders.length === 0 && !err) {
    return (
      <>
        <Navbar />
        <div className="container">
          <h2>My Orders</h2>
          <div style={{ textAlign: "center", padding: "48px 20px", color: "#9ca3af", fontSize: 14 }}>
            No merchandise orders yet.
          </div>
        </div>
      </>
    );
  }

  // ── Group orders by batchId ──────────────────────────────────
  const groups = {};
  const groupOrder = [];
  for (const o of orders) {
    const key = o.batchId && o.batchId !== "" ? o.batchId : o._id;
    if (!groups[key]) { groups[key] = []; groupOrder.push(key); }
    groups[key].push(o);
  }

  return (
    <>
      <Navbar />
      <div className="container">
        <h2>My Orders</h2>
        <p className="muted" style={{ marginBottom: 20 }}>
          After placing an order, upload your payment proof. The organizer will approve or reject it.
          Approved orders show your QR pickup ticket.
        </p>

        {msg && <div className="success" style={{ marginBottom: 14 }}>{msg}</div>}
        {err && <div className="alert" style={{ marginBottom: 14 }}>{err}</div>}

        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          {groupOrder.map(key => {
            const batch = groups[key];
            const first = batch[0];
            const batchStatus = batch.some(o => o.status === "rejected") ? "rejected"
              : batch.some(o => o.status === "pending") ? "pending" : "approved";
            const sc = STATUS_STYLE[batchStatus] || STATUS_STYLE.pending;
            const isApproved = batchStatus === "approved";
            const totalAmount = batch.reduce((s, o) => s + (o.amount || 0), 0);
            const proofUrl = first.paymentProofPath ? `${BACKEND}${first.paymentProofPath}` : null;
            const ticket = tickets[first._id];
            const isUploading = batch.some(o => uploading[o._id]);

            return (
              <div key={key} style={{
                background: "#fff", borderRadius: 16,
                border: `1px solid ${isApproved ? "#6ee7b7" : "#e5e7eb"}`,
                boxShadow: isApproved ? "0 4px 20px rgba(16,185,129,0.12)" : "0 2px 8px rgba(0,0,0,0.05)",
                overflow: "hidden",
              }}>
                {/* ── Card header ── */}
                <div style={{
                  padding: "16px 20px", borderBottom: "1px solid #f3f4f6",
                  display: "flex", alignItems: "center", justifyContent: "space-between",
                  flexWrap: "wrap", gap: 10,
                  background: isApproved ? "linear-gradient(90deg,#ecfdf5,#d1fae5)" : undefined,
                }}>
                  <div>
                    <h3 style={{ margin: 0, fontSize: 16 }}>{first.event?.name || "Merch Event"}</h3>
                    <div className="muted" style={{ fontSize: 13, marginTop: 3 }}>
                      Placed {first.createdAt ? new Date(first.createdAt).toLocaleDateString() : "—"}
                      {batch.length > 1 && (
                        <span style={{
                          marginLeft: 8, fontSize: 11, fontWeight: 700,
                          background: "#e0e7ff", color: "#3730a3",
                          borderRadius: 20, padding: "1px 8px",
                        }}>{batch.length} variants</span>
                      )}
                    </div>
                  </div>
                  <span style={{
                    background: sc.bg, color: sc.color,
                    borderRadius: 20, padding: "4px 14px", fontSize: 12, fontWeight: 700,
                  }}>{sc.label}</span>
                </div>

                <div style={{ padding: "16px 20px" }}>
                  {/* Variant rows */}
                  <div style={{ marginBottom: 16 }}>
                    {batch.map((o, i) => (
                      <div key={o._id} style={{
                        display: "flex", gap: 16, flexWrap: "wrap", alignItems: "center",
                        paddingBottom: i < batch.length - 1 ? 10 : 0,
                        marginBottom: i < batch.length - 1 ? 10 : 0,
                        borderBottom: i < batch.length - 1 ? "1px dashed #f3f4f6" : "none",
                      }}>
                        {o.variantSnapshot?.name && (
                          <div style={{
                            background: "#f3f4f6", borderRadius: 20, padding: "2px 10px",
                            fontSize: 12, fontWeight: 700, color: "#374151",
                          }}>
                            {[o.variantSnapshot.name, o.variantSnapshot.size, o.variantSnapshot.color].filter(Boolean).join(" · ")}
                          </div>
                        )}
                        <Detail label="QTY" value={o.quantity} />
                        <Detail label="AMOUNT" value={`₹${o.amount}`} highlight />
                      </div>
                    ))}
                  </div>

                  {/* Total row for multi-variant batches */}
                  {batch.length > 1 && (
                    <div style={{
                      display: "flex", justifyContent: "space-between",
                      fontWeight: 800, fontSize: 15, paddingTop: 10,
                      borderTop: "1.5px solid rgba(18,18,18,0.07)", marginBottom: 16,
                    }}>
                      <span>Total</span>
                      <span style={{ color: "#667eea" }}>₹{totalAmount}</span>
                    </div>
                  )}

                  {/* Status stepper */}
                  <div style={{ display: "flex", alignItems: "center", marginBottom: 16 }}>
                    {["Order Placed", "Proof Uploaded", batchStatus === "rejected" ? "Rejected" : "Approved"].map((step, i) => {
                      const done = i === 0
                        || (i === 1 && (proofUrl || batchStatus !== "pending"))
                        || (i === 2 && isApproved);
                      const isCurrent = (i === 1 && !proofUrl && batchStatus === "pending")
                        || (i === 2 && batchStatus === "pending" && proofUrl);
                      const rejected = i === 2 && batchStatus === "rejected";
                      return (
                        <div key={step} style={{ display: "flex", alignItems: "center", flex: "1 1 0" }}>
                          <div style={{ textAlign: "center", minWidth: 80 }}>
                            <div style={{
                              width: 28, height: 28, borderRadius: "50%", margin: "0 auto 4px",
                              background: rejected ? "#ef4444" : done ? "#10b981" : isCurrent ? "#f59e0b" : "#e5e7eb",
                              color: done || isCurrent || rejected ? "#fff" : "#9ca3af",
                              display: "flex", alignItems: "center", justifyContent: "center",
                              fontSize: 13, fontWeight: 700,
                            }}>
                              {done ? "✓" : rejected ? "✗" : i + 1}
                            </div>
                            <div style={{ fontSize: 10, color: rejected ? "#ef4444" : done ? "#10b981" : "#9ca3af", fontWeight: done ? 600 : 400 }}>
                              {step}
                            </div>
                          </div>
                          {i < 2 && (
                            <div style={{ flex: 1, height: 2, margin: "0 4px", marginBottom: 14, background: done ? "#10b981" : "#e5e7eb" }} />
                          )}
                        </div>
                      );
                    })}
                  </div>

                  {/* Decision note */}
                  {first.decisionNote && (
                    <div style={{
                      background: batchStatus === "rejected" ? "#fee2e2" : "#d1fae5",
                      border: `1px solid ${batchStatus === "rejected" ? "#fca5a5" : "#6ee7b7"}`,
                      borderRadius: 8, padding: "10px 14px", marginBottom: 14, fontSize: 13,
                    }}>
                      <b>Organizer note:</b> {first.decisionNote}
                    </div>
                  )}

                  {/* Approved → QR ticket */}
                  {isApproved ? (
                    <div style={{
                      background: "linear-gradient(135deg,#ecfdf5,#f0fdf4)",
                      border: "1.5px solid #6ee7b7", borderRadius: 14,
                      padding: "20px 24px", display: "flex", alignItems: "center", gap: 24, flexWrap: "wrap",
                    }}>
                      {ticket?.qrDataUrl ? (
                        <div style={{ textAlign: "center" }}>
                          <img src={ticket.qrDataUrl} alt="Pickup QR" style={{
                            width: 140, height: 140, borderRadius: 10,
                            border: "2px solid #10b981", display: "block", background: "#fff", padding: 6,
                          }} />
                          <div style={{ fontSize: 10, color: "#6b7280", marginTop: 6, fontWeight: 600 }}>Scan at pickup</div>
                        </div>
                      ) : (
                        <div style={{
                          width: 140, height: 140, borderRadius: 10, border: "2px dashed #10b981",
                          display: "flex", alignItems: "center", justifyContent: "center",
                          color: "#9ca3af", fontSize: 12, textAlign: "center", padding: 10,
                        }}>Generating ticket…</div>
                      )}
                      <div style={{ flex: 1, minWidth: 180 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                          <span style={{ fontSize: 18 }}>🎫</span>
                          <span style={{ fontWeight: 900, fontSize: 16, color: "#065f46" }}>My Pickup Ticket</span>
                        </div>
                        {ticket ? (
                          <>
                            <div style={{ marginBottom: 6, fontSize: 13 }}>
                              <span className="muted" style={{ fontSize: 11 }}>TICKET ID </span>
                              <span style={{ fontWeight: 700, fontFamily: "monospace", letterSpacing: 1 }}>{ticket.ticketId}</span>
                            </div>
                            <div style={{ marginBottom: 6, fontSize: 13 }}>
                              <span className="muted" style={{ fontSize: 11 }}>EVENT </span>
                              <span style={{ fontWeight: 600 }}>{first.event?.name}</span>
                            </div>
                          </>
                        ) : (
                          <div className="muted" style={{ fontSize: 13 }}>Loading ticket…</div>
                        )}
                        <div style={{ marginTop: 14, fontSize: 12, color: "#6b7280", background: "#fff", borderRadius: 8, padding: "8px 12px", border: "1px solid #d1fae5" }}>
                          Show this QR code at the merchandise pickup counter.
                        </div>
                      </div>
                    </div>
                  ) : (
                    /* Pending / Rejected → proof upload (one upload covers whole batch) */
                    <div style={{ background: "#f9fafb", borderRadius: 10, padding: "14px 16px", border: "1px solid #e5e7eb" }}>
                      <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 10 }}>Payment Proof</div>
                      {proofUrl ? (
                        <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
                          <img src={proofUrl} alt="Payment proof thumbnail" style={{ width: 72, height: 72, objectFit: "cover", borderRadius: 8, border: "1px solid #e5e7eb", cursor: "pointer" }} onClick={() => setPreviewImg(proofUrl)} />
                          <div>
                            <div style={{ fontSize: 13, color: "#10b981", fontWeight: 600, marginBottom: 4 }}>Proof uploaded</div>
                            <button className="btn btn-outline" style={{ fontSize: 12, padding: "4px 12px" }} onClick={() => setPreviewImg(proofUrl)}>View Full Image</button>
                          </div>
                          {batchStatus === "rejected" && (
                            <label style={{ cursor: "pointer", background: "#fff", border: "1px solid #667eea", color: "#667eea", borderRadius: 8, padding: "6px 14px", fontSize: 12, fontWeight: 600 }}>
                              Re-upload Proof
                              <input type="file" accept="image/*,.pdf" style={{ display: "none" }} onChange={e => { if (e.target.files?.[0]) uploadProof(first._id, e.target.files[0]); }} />
                            </label>
                          )}
                        </div>
                      ) : batchStatus === "pending" ? (
                        <div>
                          <p className="muted" style={{ fontSize: 13, marginBottom: 10 }}>
                            Upload a screenshot or photo of your payment (UPI, bank transfer, etc.) to submit for review.
                            {batch.length > 1 && " One proof covers all variants in this order."}
                          </p>
                          <label style={{ display: "inline-block", cursor: isUploading ? "default" : "pointer", background: isUploading ? "#f3f4f6" : "linear-gradient(135deg,#667eea,#764ba2)", color: isUploading ? "#9ca3af" : "#fff", borderRadius: 8, padding: "10px 20px", fontSize: 13, fontWeight: 600 }}>
                            {isUploading ? "Uploading…" : "Choose & Upload Proof"}
                            <input type="file" accept="image/*,.pdf" disabled={isUploading} style={{ display: "none" }} onChange={e => { if (e.target.files?.[0]) uploadProof(first._id, e.target.files[0]); }} />
                          </label>
                        </div>
                      ) : (
                        <div className="muted" style={{ fontSize: 13 }}>No proof was uploaded.</div>
                      )}
                      {batchStatus !== "approved" && (
                        <div className="muted" style={{ fontSize: 12, marginTop: 10 }}>
                          Your pickup QR ticket will appear here after the organizer approves your payment.
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Image Preview Modal */}
      {previewImg && (
        <div style={{
          position: "fixed", inset: 0, background: "rgba(0,0,0,0.75)",
          display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000,
        }} onClick={() => setPreviewImg(null)}>
          <div style={{ position: "relative" }} onClick={e => e.stopPropagation()}>
            <img src={previewImg} alt="Payment proof" style={{ maxWidth: "90vw", maxHeight: "80vh", borderRadius: 12, boxShadow: "0 8px 32px rgba(0,0,0,0.4)" }} />
            <div style={{ display: "flex", gap: 10, marginTop: 12, justifyContent: "center" }}>
              <a href={previewImg} target="_blank" rel="noreferrer" className="btn btn-outline" style={{ fontSize: 13, background: "#fff" }}>Open Full Size</a>
              <button className="btn" onClick={() => setPreviewImg(null)} style={{ fontSize: 13 }}>Close</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

/* ── tiny helper ─────────────────────────────────────── */
function Detail({ label, value, highlight }) {
  return (
    <div>
      <div className="muted" style={{ fontSize: 11, marginBottom: 2 }}>{label}</div>
      <div style={{ fontWeight: 700, fontSize: highlight ? 16 : 14, color: highlight ? "#667eea" : undefined }}>
        {value}
      </div>
    </div>
  );
}
