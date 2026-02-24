import { useCallback, useEffect, useState } from "react";
import Navbar from "../components/Navbar";
import { api } from "../api/client";
import { useParams, Link } from "react-router-dom";

const BACKEND = process.env.REACT_APP_API_URL?.replace("/api", "") || "http://localhost:5000";

const STATUS_STYLE = {
  pending: { bg: "#fef3c7", color: "#92400e", label: "Pending Approval" },
  approved: { bg: "#d1fae5", color: "#065f46", label: "Approved" },
  rejected: { bg: "#fee2e2", color: "#991b1b", label: "Rejected" },
};

export default function OrganizerOrders() {
  const { eventId } = useParams();
  const [orders, setOrders] = useState([]);
  const [eventName, setEventName] = useState("");
  const [err, setErr] = useState("");
  const [msg, setMsg] = useState("");
  const [tab, setTab] = useState("pending");
  const [noteModal, setNoteModal] = useState(null); // { batchKey, orderIds, action, proofUrl }
  const [note, setNote] = useState("");
  const [deciding, setDeciding] = useState(false);
  const [previewImg, setPreviewImg] = useState(null);

  const load = useCallback(async () => {
    setErr(""); setMsg("");
    try {
      const [ordersRes, evRes] = await Promise.all([
        api.get(`/orders/event/${eventId}`),
        api.get(`/events/${eventId}`),
      ]);
      setOrders(ordersRes.data || []);
      setEventName(evRes.data?.name || "");
    } catch (e) {
      setErr(e?.response?.data?.msg || "Failed to load orders");
    }
  }, [eventId]);

  useEffect(() => { load(); }, [load]);

  // ── Group orders by batchId (fallback: individual orderId) ────────────
  const buildGroups = (list) => {
    const groups = {};
    const keys = [];
    for (const o of list) {
      const key = o.batchId && o.batchId !== "" ? o.batchId : o._id;
      if (!groups[key]) { groups[key] = []; keys.push(key); }
      groups[key].push(o);
    }
    return { groups, keys };
  };

  // Derive grouped view for each tab
  const allGrouped = buildGroups(orders);
  const tabOrders = tab === "all" ? orders : orders.filter(o => o.status === tab);
  const { groups, keys } = buildGroups(tabOrders);

  // For count badges use individual orders
  const counts = {
    pending: orders.filter(o => o.status === "pending").length,
    approved: orders.filter(o => o.status === "approved").length,
    rejected: orders.filter(o => o.status === "rejected").length,
  };
  // Group-level counts (each batch = 1 "order" from organizer POV)
  const groupCounts = {
    pending: buildGroups(orders.filter(o => o.status === "pending")).keys.length,
    approved: buildGroups(orders.filter(o => o.status === "approved")).keys.length,
    rejected: buildGroups(orders.filter(o => o.status === "rejected")).keys.length,
    all: allGrouped.keys.length,
  };

  const openDecide = (batchKey, batch, action) => {
    setNote("");
    const proofUrl = batch[0]?.paymentProofPath ? `${BACKEND}${batch[0].paymentProofPath}` : null;
    setNoteModal({ batchKey, orderIds: batch.map(o => o._id), action, proofUrl });
  };

  const confirmDecide = async () => {
    if (!noteModal) return;
    setDeciding(true);
    try {
      // Decide EVERY order in the batch
      await Promise.all(
        noteModal.orderIds.map(id =>
          api.post(`/orders/${id}/decide`, { status: noteModal.action, note })
        )
      );
      setMsg(`Batch ${noteModal.action === "approved" ? "approved" : "rejected"} (${noteModal.orderIds.length} item${noteModal.orderIds.length > 1 ? "s" : ""}).`);
      setNoteModal(null);
      load();
    } catch (e) {
      setErr(e?.response?.data?.msg || "Decision failed");
    } finally {
      setDeciding(false);
    }
  };

  return (
    <>
      <Navbar />
      <div className="container">

        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 8 }}>
          <Link to="/org/events" className="btn btn-outline" style={{ fontSize: 12, padding: "5px 12px" }}>Back</Link>
          <h2 style={{ margin: 0 }}>Merch Orders{eventName ? ` — ${eventName}` : ""}</h2>
        </div>
        <p className="muted" style={{ marginBottom: 20 }}>
          Review payment proofs and approve or reject orders. Approved orders auto-generate a pickup QR ticket and decrement stock.
          Orders placed together as a batch are shown as one row.
        </p>

        {msg && <div className="success" style={{ marginBottom: 12 }}>{msg}</div>}
        {err && <div className="alert" style={{ marginBottom: 12 }}>{err}</div>}

        {/* Summary bar */}
        <div style={{ display: "flex", gap: 12, marginBottom: 20, flexWrap: "wrap" }}>
          {[
            { key: "pending", label: "Pending", color: "#f59e0b" },
            { key: "approved", label: "Approved", color: "#10b981" },
            { key: "rejected", label: "Rejected", color: "#ef4444" },
          ].map(s => (
            <div key={s.key} style={{
              flex: "1 1 120px", background: "#fff", borderRadius: 10,
              border: "1px solid #e5e7eb", borderLeft: `4px solid ${s.color}`,
              padding: "12px 16px", boxShadow: "0 2px 6px rgba(0,0,0,0.04)"
            }}>
              <div style={{ fontSize: 22, fontWeight: 800, color: s.color }}>{groupCounts[s.key]}</div>
              <div className="muted" style={{ fontSize: 12 }}>{s.label}</div>
            </div>
          ))}
          <div style={{
            flex: "1 1 120px", background: "#fff", borderRadius: 10,
            border: "1px solid #e5e7eb", borderLeft: "4px solid #667eea",
            padding: "12px 16px", boxShadow: "0 2px 6px rgba(0,0,0,0.04)"
          }}>
            <div style={{ fontSize: 22, fontWeight: 800, color: "#667eea" }}>{groupCounts.all}</div>
            <div className="muted" style={{ fontSize: 12 }}>Total Orders</div>
          </div>
        </div>

        {/* Tabs */}
        <div style={{ display: "flex", gap: 6, marginBottom: 20, borderBottom: "2px solid #f3f4f6", paddingBottom: 10 }}>
          {[
            { key: "pending", label: `Pending (${groupCounts.pending})` },
            { key: "approved", label: `Approved (${groupCounts.approved})` },
            { key: "rejected", label: `Rejected (${groupCounts.rejected})` },
            { key: "all", label: `All (${groupCounts.all})` },
          ].map(t => (
            <button key={t.key}
              className={tab === t.key ? "btn" : "btn btn-outline"}
              style={{ borderRadius: 20, fontSize: 12, padding: "5px 14px" }}
              onClick={() => setTab(t.key)}>
              {t.label}
            </button>
          ))}
        </div>

        {keys.length === 0 && (
          <div className="muted" style={{ textAlign: "center", padding: "32px 0", fontSize: 14 }}>
            No orders in this category.
          </div>
        )}

        {/* Grouped orders table */}
        {keys.length > 0 && (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr style={{ borderBottom: "2px solid #f3f4f6", background: "#f9fafb" }}>
                  {["Participant", "Email", "Items", "Total", "Payment Proof", "Status", "Note", "Actions"].map(h => (
                    <th key={h} style={{ textAlign: "left", padding: "10px 14px", color: "#6b7280", fontWeight: 600, whiteSpace: "nowrap" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {keys.map((key, i) => {
                  const batch = groups[key];
                  const first = batch[0];
                  // Batch status: most severe wins
                  const batchStatus = batch.some(o => o.status === "rejected") ? "rejected"
                    : batch.some(o => o.status === "pending") ? "pending" : "approved";
                  const sc = STATUS_STYLE[batchStatus] || STATUS_STYLE.pending;
                  const totalAmount = batch.reduce((s, o) => s + (o.amount || 0), 0);
                  const proofUrl = first.paymentProofPath ? `${BACKEND}${first.paymentProofPath}` : null;
                  const isPending = batchStatus === "pending";

                  return (
                    <tr key={key} style={{ borderBottom: "1px solid #f3f4f6", background: i % 2 === 0 ? "#fff" : "#fafafa", verticalAlign: "top" }}>
                      {/* Participant */}
                      <td style={{ padding: "12px 14px", fontWeight: 600, whiteSpace: "nowrap" }}>
                        {first.participant?.firstName} {first.participant?.lastName}
                      </td>
                      {/* Email */}
                      <td style={{ padding: "12px 14px", color: "#6b7280", fontSize: 12 }}>
                        {first.participant?.email}
                      </td>
                      {/* Items — stacked variant rows */}
                      <td style={{ padding: "12px 14px" }}>
                        {batch.map((o, j) => (
                          <div key={o._id} style={{
                            display: "flex", gap: 8, alignItems: "center",
                            paddingBottom: j < batch.length - 1 ? 6 : 0,
                            marginBottom: j < batch.length - 1 ? 6 : 0,
                            borderBottom: j < batch.length - 1 ? "1px dashed #f3f4f6" : "none",
                          }}>
                            <span style={{
                              background: "#f3f4f6", borderRadius: 12, padding: "1px 8px",
                              fontSize: 11, fontWeight: 700, color: "#374151", whiteSpace: "nowrap",
                            }}>
                              {o.variantSnapshot?.name
                                ? [o.variantSnapshot.name, o.variantSnapshot.size, o.variantSnapshot.color].filter(Boolean).join(" / ")
                                : "—"}
                            </span>
                            <span style={{ fontSize: 12, color: "#6b7280" }}>× {o.quantity}</span>
                            <span style={{ fontSize: 12, fontWeight: 700 }}>₹{o.amount}</span>
                          </div>
                        ))}
                      </td>
                      {/* Total */}
                      <td style={{ padding: "12px 14px", fontWeight: 800, color: "#667eea", whiteSpace: "nowrap" }}>
                        ₹{totalAmount}
                      </td>
                      {/* Proof */}
                      <td style={{ padding: "12px 14px" }}>
                        {proofUrl ? (
                          <button className="btn btn-outline" style={{ fontSize: 12, padding: "4px 10px" }} onClick={() => setPreviewImg(proofUrl)}>
                            View Proof
                          </button>
                        ) : (
                          <span style={{ color: "#f59e0b", fontSize: 12 }}>Not uploaded yet</span>
                        )}
                      </td>
                      {/* Status */}
                      <td style={{ padding: "12px 14px" }}>
                        <span style={{ background: sc.bg, color: sc.color, borderRadius: 20, padding: "3px 10px", fontSize: 11, fontWeight: 700 }}>
                          {sc.label}
                        </span>
                        {batch.length > 1 && (
                          <div style={{ fontSize: 10, color: "#9ca3af", marginTop: 4 }}>{batch.length} variants</div>
                        )}
                      </td>
                      {/* Note */}
                      <td style={{ padding: "12px 14px", color: "#6b7280", fontSize: 12, maxWidth: 140 }}>
                        {first.decisionNote || "—"}
                      </td>
                      {/* Actions */}
                      <td style={{ padding: "12px 14px" }}>
                        {isPending ? (
                          <div style={{ display: "flex", gap: 6 }}>
                            <button className="btn"
                              style={{ fontSize: 12, padding: "4px 12px", background: "#10b981" }}
                              onClick={() => openDecide(key, batch, "approved")}
                              disabled={!proofUrl}
                              title={!proofUrl ? "Proof not uploaded yet" : `Approve all ${batch.length} item(s)`}>
                              Approve{batch.length > 1 ? ` (${batch.length})` : ""}
                            </button>
                            <button className="btn btn-outline"
                              style={{ fontSize: 12, padding: "4px 12px", color: "#ef4444", borderColor: "#ef4444" }}
                              onClick={() => openDecide(key, batch, "rejected")}>
                              Reject{batch.length > 1 ? ` (${batch.length})` : ""}
                            </button>
                          </div>
                        ) : (
                          <span className="muted" style={{ fontSize: 12 }}>Decided</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Decision Modal */}
      {noteModal && (
        <div style={{
          position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)",
          display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000
        }}>
          <div style={{ background: "#fff", borderRadius: 16, padding: 28, width: "100%", maxWidth: 440, boxShadow: "0 20px 60px rgba(0,0,0,0.2)" }}>
            <h3 style={{ margin: "0 0 8px" }}>
              {noteModal.action === "approved" ? "Approve Order" : "Reject Order"}
              {noteModal.orderIds.length > 1 && (
                <span style={{ marginLeft: 8, fontSize: 13, color: "#667eea", fontWeight: 700 }}>
                  ({noteModal.orderIds.length} variants)
                </span>
              )}
            </h3>
            <p className="muted" style={{ fontSize: 13, marginBottom: 16 }}>
              {noteModal.action === "approved"
                ? `Approving will decrement stock for all ${noteModal.orderIds.length} item(s) and generate a single QR pickup ticket.`
                : `Rejecting will mark all ${noteModal.orderIds.length} item(s) as rejected. Stock will not be affected.`}
            </p>
            {noteModal.proofUrl && (
              <div style={{ marginBottom: 14 }}>
                <div className="muted" style={{ fontSize: 12, marginBottom: 6 }}>Payment Proof:</div>
                <img src={noteModal.proofUrl} alt="Payment proof"
                  style={{ width: 120, height: 90, objectFit: "cover", borderRadius: 8, border: "1px solid #e5e7eb", cursor: "pointer" }}
                  onClick={() => setPreviewImg(noteModal.proofUrl)} />
              </div>
            )}
            <div style={{ marginBottom: 16 }}>
              <label className="muted" style={{ fontSize: 13, display: "block", marginBottom: 6 }}>Decision Note (optional)</label>
              <textarea className="input" rows={3} placeholder="e.g. Payment verified, thank you!"
                value={note} onChange={e => setNote(e.target.value)} />
            </div>
            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
              <button className="btn btn-outline" onClick={() => setNoteModal(null)} disabled={deciding}>Cancel</button>
              <button className="btn"
                style={{ background: noteModal.action === "approved" ? "#10b981" : "#ef4444" }}
                onClick={confirmDecide} disabled={deciding}>
                {deciding ? "Processing…" : noteModal.action === "approved" ? "Confirm Approval" : "Confirm Rejection"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Proof Image Preview Modal */}
      {previewImg && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.75)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }}
          onClick={() => setPreviewImg(null)}>
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
