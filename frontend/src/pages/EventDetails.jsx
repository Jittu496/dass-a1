import { useEffect, useState } from "react";
import Navbar from "../components/Navbar";
import { api } from "../api/client";
import { useParams } from "react-router-dom";
import DynamicForm from "../components/DynamicForm";
import EventForum from "../components/EventForum";

export default function EventDetails() {
  const { id } = useParams();
  const [event, setEvent] = useState(null);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");
  const [registrationResponses, setRegistrationResponses] = useState({});
  const [variantQtys, setVariantQtys] = useState({}); // variantId -> quantity
  const [orderQuantity, setOrderQuantity] = useState(1); // fallback for no-variant merch
  const role = localStorage.getItem("role");

  useEffect(() => {
    (async () => {
      try {
        const res = await api.get(`/events/${id}`);
        setEvent(res.data);
        // initialise qty map to 0 for every variant
        if (res.data.variants && res.data.variants.length > 0) {
          const init = {};
          res.data.variants.forEach(v => { init[v.id] = 0; });
          setVariantQtys(init);
        }
      } catch {
        setErr("Event not found");
      }
    })();
  }, [id]);

  const formatIST = (dateValue) => {
    const d = new Date(dateValue);
    if (Number.isNaN(d.getTime())) return "-";
    return d.toLocaleString("en-IN", {
      timeZone: "Asia/Kolkata",
      year: "numeric",
      month: "short",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    }) + " IST";
  };

  const registerTicket = async () => {
    setMsg(""); setErr("");
    try {
      const payload = {};
      if (Object.keys(registrationResponses || {}).length > 0)
        payload.registrationResponses = registrationResponses;
      const res = await api.post(`/tickets/register/${id}`, payload);
      setMsg(`Registered! Ticket ID: ${res.data.ticketId}`);
    } catch (e) {
      setErr(e?.response?.data?.msg || "Registration failed");
    }
  };

  const setQty = (variantId, delta) => {
    setVariantQtys(prev => {
      const cur = prev[variantId] || 0;
      const next = Math.max(0, cur + delta);
      return { ...prev, [variantId]: next };
    });
  };

  const createOrder = async () => {
    setMsg(""); setErr("");
    const hasVariants = Array.isArray(event?.variants) && event.variants.length > 0;
    if (hasVariants) {
      const selected = event.variants.filter(v => (variantQtys[v.id] || 0) > 0);
      if (selected.length === 0) return setErr("Please select at least one variant quantity");
      // One shared batchId ties all variant orders together for grouping in My Orders
      const batchId = `batch_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      let successCount = 0, errors = [];
      for (const v of selected) {
        try {
          await api.post(`/orders/create/${id}`, { quantity: variantQtys[v.id], variantId: v.id, batchId });
          successCount++;
        } catch (e) {
          errors.push(`${v.name || v.id}: ${e?.response?.data?.msg || "failed"}`);
        }
      }
      if (errors.length) setErr(errors.join(" | "));
      if (successCount > 0) {
        setMsg(`${successCount} order(s) placed! Upload payment proof in My Orders.`);
        const reset = {};
        event.variants.forEach(v => { reset[v.id] = 0; });
        setVariantQtys(reset);
      }
    } else {
      // No variants — use simple quantity
      try {
        const res = await api.post(`/orders/create/${id}`, { quantity: orderQuantity });
        setMsg(`Order placed! Upload payment proof in My Orders. Order ID: ${res.data._id}`);
      } catch (e) {
        setErr(e?.response?.data?.msg || "Order failed");
      }
    }
  };

  if (!event) {
    return (
      <>
        <Navbar />
        <div className="container">
          {err ? <div className="alert">{err}</div> : <div className="muted">Loading event…</div>}
        </div>
      </>
    );
  }

  const now = new Date();
  const deadline = new Date(event.registrationDeadline);
  const deadlinePassed = Number.isNaN(deadline.getTime()) ? true : deadline < now;
  const statusAllowsRegistration = ["published", "ongoing"].includes(event.status);
  const registrationClosed = !statusAllowsRegistration || deadlinePassed;

  const isMerch = event.type === "merch";
  const isHackathon = event.type === "hackathon";

  // Cart totals for multi-variant
  const hasVariants = isMerch && Array.isArray(event.variants) && event.variants.length > 0;
  const cartItems = hasVariants
    ? event.variants
      .filter(v => (variantQtys[v.id] || 0) > 0)
      .map(v => ({ v, qty: variantQtys[v.id], subtotal: (variantQtys[v.id] || 0) * (v.price ?? 0) }))
    : [];
  const cartTotal = hasVariants
    ? cartItems.reduce((sum, item) => sum + item.subtotal, 0)
    : (orderQuantity * (Number(event.fee) || 0));

  // Legacy single-variant price (for no-variant merch or non-merch)
  const unitPrice = Number(event.fee) || 0;
  const isFree = !hasVariants && unitPrice === 0;

  return (
    <>
      <Navbar />
      <div className="container">
        {/* Page header */}
        <div style={{ marginBottom: 24 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
            <h1 style={{ margin: 0, fontSize: 28, letterSpacing: "-0.8px" }}>{event.name}</h1>
            <span className="pill" style={{ fontSize: 13 }}>{event.type}</span>
            <span className={`pill ${event.status === "published" ? "pill-green" : ""}`}
              style={{
                fontSize: 12, background: event.status === "published" ? "rgba(34,197,94,0.15)" : undefined,
                border: event.status === "published" ? "1px solid rgba(34,197,94,0.3)" : undefined,
                color: event.status === "published" ? "#166534" : undefined
              }}>
              {event.status}
            </span>
          </div>
          <p className="muted" style={{ marginTop: 8 }}>{event.description || "No description provided."}</p>
        </div>

        {/* Main two-column layout */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 360px", gap: 24, alignItems: "start" }}>

          {/* LEFT — Event Info */}
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

            {/* Event Details card */}
            <div className="card wide" style={{ padding: "22px 24px" }}>
              <h3 style={{ marginBottom: 16, fontSize: 15, fontWeight: 800, letterSpacing: "-0.3px" }}>Event Details</h3>
              <div className="grid2" style={{ gap: 14 }}>
                <InfoRow label="Start" value={formatIST(event.startDate)} />
                <InfoRow label="End" value={formatIST(event.endDate)} />
                <InfoRow label="Registration Deadline" value={formatIST(event.registrationDeadline)} />
                <InfoRow label="Eligibility" value={event.eligibility || "All"} />
                <InfoRow label="Organizer" value={`${event.organizer?.firstName || ""} ${event.organizer?.lastName || ""}`.trim() || "-"} />
                {isMerch && <InfoRow label="Total Stock" value={event.stock ?? "-"} />}
                {isHackathon && <InfoRow label="Participation Mode" value={event.participationMode || "Individual"} />}
                {isHackathon && <InfoRow label="Team Size" value={event.teamSize || 1} />}
              </div>
              {(event.tags || []).length > 0 && (
                <div style={{ marginTop: 14, display: "flex", gap: 6, flexWrap: "wrap" }}>
                  {event.tags.map((t) => (
                    <span key={t} style={{
                      background: "rgba(201,162,39,0.10)", border: "1px solid rgba(201,162,39,0.20)",
                      color: "#6b5400", borderRadius: 999, padding: "3px 10px", fontSize: 12, fontWeight: 700
                    }}>{t}</span>
                  ))}
                </div>
              )}
            </div>

            {/* Variants — each gets its own inline qty stepper */}
            {isMerch && hasVariants && (
              <div className="card wide" style={{ padding: "22px 24px" }}>
                <h3 style={{ marginBottom: 14, fontSize: 15, fontWeight: 800 }}>Choose Variants & Quantities</h3>
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {event.variants.map((v) => {
                    const qty = variantQtys[v.id] || 0;
                    const outOfStock = (v.stock ?? 1) <= 0;
                    const atLimit = v.perParticipantLimit && qty >= v.perParticipantLimit;
                    const atStock = qty >= (v.stock ?? Infinity);
                    return (
                      <div key={v.id} style={{
                        display: "flex", alignItems: "center", justifyContent: "space-between",
                        padding: "12px 16px", borderRadius: 14,
                        border: qty > 0 ? "2px solid var(--gold)" : "1.5px solid rgba(18,18,18,0.10)",
                        background: qty > 0 ? "rgba(201,162,39,0.07)" : "rgba(255,255,255,0.7)",
                        opacity: outOfStock ? 0.5 : 1,
                        gap: 10, flexWrap: "wrap",
                      }}>
                        {/* Variant info */}
                        <div style={{ flex: 1 }}>
                          <div style={{ fontWeight: 700, fontSize: 14 }}>
                            {v.name || [v.size, v.color].filter(Boolean).join(" / ") || `Variant ${v.id}`}
                          </div>
                          <div className="tiny muted" style={{ marginTop: 2 }}>
                            Stock: {v.stock ?? "N/A"}
                            {v.perParticipantLimit ? ` · Limit: ${v.perParticipantLimit}/person` : ""}
                            {outOfStock && <span style={{ color: "#ef4444", marginLeft: 6 }}>· Out of stock</span>}
                          </div>
                        </div>

                        {/* Price */}
                        <div style={{ fontWeight: 900, fontSize: 15, color: "var(--gold)", minWidth: 48, textAlign: "right" }}>
                          {v.price != null ? `₹${v.price}` : "Free"}
                        </div>

                        {/* Inline qty stepper */}
                        {!outOfStock && role === "participant" && statusAllowsRegistration && (
                          <div style={{
                            display: "flex", alignItems: "center",
                            border: "1.5px solid rgba(18,18,18,0.12)",
                            borderRadius: 12, overflow: "hidden",
                          }}>
                            <button onClick={() => setQty(v.id, -1)} disabled={qty <= 0}
                              style={{
                                width: 34, height: 34, border: "none",
                                background: qty > 0 ? "rgba(201,162,39,0.12)" : "rgba(18,18,18,0.04)",
                                cursor: qty > 0 ? "pointer" : "default",
                                fontWeight: 900, fontSize: 16, fontFamily: "inherit",
                                borderRight: "1px solid rgba(18,18,18,0.10)",
                                color: qty > 0 ? "var(--gold)" : "#9ca3af",
                              }}>−</button>
                            <span style={{ width: 36, textAlign: "center", fontWeight: 900, fontSize: 15 }}>
                              {qty}
                            </span>
                            <button onClick={() => setQty(v.id, +1)} disabled={atLimit || atStock}
                              style={{
                                width: 34, height: 34, border: "none",
                                background: (!atLimit && !atStock) ? "rgba(201,162,39,0.12)" : "rgba(18,18,18,0.04)",
                                cursor: (!atLimit && !atStock) ? "pointer" : "default",
                                fontWeight: 900, fontSize: 16, fontFamily: "inherit",
                                borderLeft: "1px solid rgba(18,18,18,0.10)",
                                color: (!atLimit && !atStock) ? "var(--gold)" : "#9ca3af",
                              }}>+</button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Registration form for non-merch */}
            {role === "participant" && !isMerch && !registrationClosed &&
              Array.isArray(event.registrationForm) && event.registrationForm.length > 0 && (
                <div className="card wide" style={{ padding: "22px 24px" }}>
                  <h3 style={{ marginBottom: 14, fontSize: 15, fontWeight: 800 }}>Registration Form</h3>
                  <DynamicForm schema={event.registrationForm} initial={{}} onChange={setRegistrationResponses} />
                </div>
              )}

          </div>

          {/* RIGHT — Cart / Order summary */}
          <div style={{ position: "sticky", top: 80, display: "flex", flexDirection: "column", gap: 16 }}>
            <div className="card" style={{ padding: 0, overflow: "hidden", width: "100%" }}>

              {/* Cart header */}
              <div style={{
                background: "linear-gradient(135deg, var(--gold2), var(--gold))",
                padding: "16px 20px", display: "flex", alignItems: "center", gap: 8
              }}>
                <CartIcon />
                <span style={{ fontWeight: 900, fontSize: 15, letterSpacing: "-0.3px", color: "#3b2700" }}>
                  {isMerch ? "Order Summary" : "Registration Summary"}
                </span>
              </div>

              <div style={{ padding: "18px 20px", display: "flex", flexDirection: "column", gap: 14 }}>

                {/* Cart items for multi-variant */}
                {hasVariants ? (
                  <div style={{ borderBottom: "1px solid rgba(18,18,18,0.07)", paddingBottom: 12, marginBottom: 4 }}>
                    {cartItems.length === 0 ? (
                      <div className="muted" style={{ fontSize: 13, textAlign: "center", padding: "8px 0" }}>
                        Select quantities above
                      </div>
                    ) : (
                      cartItems.map(({ v, qty, subtotal: sub }) => (
                        <div key={v.id} style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 6 }}>
                          <span style={{ flex: 1 }}>
                            {v.name || [v.size, v.color].filter(Boolean).join(" / ") || `Variant`}
                            <span className="muted" style={{ marginLeft: 6 }}>× {qty}</span>
                          </span>
                          <span style={{ fontWeight: 700 }}>₹{sub}</span>
                        </div>
                      ))
                    )}
                  </div>
                ) : (
                  <div style={{
                    display: "flex", justifyContent: "space-between", alignItems: "center",
                    paddingBottom: 12, borderBottom: "1px solid rgba(18,18,18,0.07)"
                  }}>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: 14 }}>{event.name}</div>
                    </div>
                    <div style={{ fontWeight: 800, fontSize: 14, color: "var(--gold)" }}>
                      {isFree ? "Free" : `₹${unitPrice}`}
                    </div>
                  </div>
                )}

                {/* Quantity stepper — only for no-variant merch */}
                {isMerch && !hasVariants && statusAllowsRegistration && (
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 700, color: "var(--muted)", marginBottom: 8 }}>QUANTITY</div>
                    <div style={{
                      display: "flex", alignItems: "center", gap: 0,
                      border: "1.5px solid rgba(18,18,18,0.12)", borderRadius: 14, overflow: "hidden", width: "fit-content"
                    }}>
                      <button onClick={() => setOrderQuantity(Math.max(1, orderQuantity - 1))}
                        style={{
                          width: 40, height: 40, border: "none", background: "rgba(18,18,18,0.04)",
                          cursor: "pointer", fontWeight: 900, fontSize: 18, fontFamily: "inherit",
                          borderRight: "1px solid rgba(18,18,18,0.10)"
                        }}>−</button>
                      <span style={{ width: 48, textAlign: "center", fontWeight: 900, fontSize: 16 }}>{orderQuantity}</span>
                      <button onClick={() => setOrderQuantity(orderQuantity + 1)}
                        style={{
                          width: 40, height: 40, border: "none", background: "rgba(18,18,18,0.04)",
                          cursor: "pointer", fontWeight: 900, fontSize: 18, fontFamily: "inherit",
                          borderLeft: "1px solid rgba(18,18,18,0.10)"
                        }}>+</button>
                    </div>
                  </div>
                )}

                {/* Total */}
                <div style={{
                  display: "flex", justifyContent: "space-between", alignItems: "center",
                  padding: "12px 0", borderTop: "1.5px solid rgba(18,18,18,0.09)"
                }}>
                  <span style={{ fontWeight: 900, fontSize: 15 }}>Total</span>
                  <span style={{ fontWeight: 900, fontSize: 22, color: cartTotal === 0 ? "#166534" : "#3b2700", letterSpacing: "-0.6px" }}>
                    {cartTotal === 0 ? "Free" : `₹${cartTotal}`}
                  </span>
                </div>

                {/* Alerts for participant */}
                {msg && <div className="success" style={{ fontSize: 13 }}>{msg}</div>}
                {err && <div className="alert" style={{ fontSize: 13 }}>{err}</div>}

                {/* CTA button */}
                {role === "participant" && (
                  <>
                    {isMerch ? (
                      statusAllowsRegistration ? (
                        <button className="btn" style={{ width: "100%", padding: "13px", fontSize: 15 }}
                          onClick={createOrder}>
                          Place Order
                        </button>
                      ) : (
                        <div className="alert" style={{ textAlign: "center" }}>Ordering closed</div>
                      )
                    ) : (
                      registrationClosed ? (
                        <div className="alert" style={{ textAlign: "center" }}>Registration closed</div>
                      ) : (
                        <button className="btn" style={{ width: "100%", padding: "13px", fontSize: 15 }}
                          onClick={registerTicket}>
                          {isFree ? "Register Free" : `Pay ₹${cartTotal} & Register`}

                        </button>
                      )
                    )}
                  </>
                )}

                {/* Non-participant view */}
                {role !== "participant" && (
                  <div className="tiny muted" style={{ textAlign: "center" }}>
                    Log in as a participant to{" "}
                    {isMerch ? "order" : "register"}.
                  </div>
                )}
              </div>
            </div>

            {/* Info chips below cart */}
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <ChipRow icon="🗓" label={`Deadline: ${formatIST(event.registrationDeadline)}`} />
              {isMerch && hasVariants && (
                event.variants
                  .filter(v => (variantQtys[v.id] || 0) > 0)
                  .map(v => (
                    <ChipRow key={v.id} icon="📦" label={`${v.name || v.id}: ${v.stock} in stock`} />
                  ))
              )}
              {isHackathon && (
                <ChipRow icon="👥" label={`Team size: ${event.teamSize || 1} · ${event.participationMode || "Individual"}`} />
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── Discussion Forum ── only rendered if user is registered / is organizer ── */}
      <div className="card wide" style={{ padding: "24px 28px", marginTop: 24 }}>
        <EventForum
          eventId={id}
          eventOrganizerId={event.organizer?._id || event.organizer}
        />
      </div>

      <style>{`
        @media (max-width: 820px) {
          .event-layout { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </>
  );
}

/* ── small helpers ─────────────────────────────────────────── */

function InfoRow({ label, value }) {
  return (
    <div>
      <div style={{
        fontSize: 11, fontWeight: 800, color: "var(--muted)", textTransform: "uppercase",
        letterSpacing: "0.5px", marginBottom: 3
      }}>{label}</div>
      <div style={{ fontSize: 14, fontWeight: 600 }}>{value}</div>
    </div>
  );
}

function ChipRow({ icon, label }) {
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 8, padding: "9px 14px",
      background: "rgba(255,255,255,0.75)", border: "1px solid rgba(18,18,18,0.08)",
      borderRadius: 12, fontSize: 12, color: "var(--muted)", fontWeight: 600
    }}>
      <span style={{ fontSize: 15 }}>{icon}</span>
      <span>{label}</span>
    </div>
  );
}

function CartIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#3b2700"
      strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z" />
      <line x1="3" y1="6" x2="21" y2="6" />
      <path d="M16 10a4 4 0 0 1-8 0" />
    </svg>
  );
}