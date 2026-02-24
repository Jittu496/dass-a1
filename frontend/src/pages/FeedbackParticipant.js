import { useEffect, useState } from "react";
import Navbar from "../components/Navbar";
import { api } from "../api/client";

// ── Star Rating Component ─────────────────────────────────────────
function StarRating({ value, onChange, readonly = false }) {
  const [hovered, setHovered] = useState(0);
  const labels = { 1: "Terrible", 2: "Bad", 3: "Okay", 4: "Good", 5: "Excellent" };
  const active = hovered || value;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <div style={{ display: "flex", gap: 6 }}>
        {[1, 2, 3, 4, 5].map((star) => (
          <span
            key={star}
            onClick={() => !readonly && onChange(star)}
            onMouseEnter={() => !readonly && setHovered(star)}
            onMouseLeave={() => !readonly && setHovered(0)}
            style={{
              fontSize: 36, cursor: readonly ? "default" : "pointer",
              color: star <= active ? "#f59e0b" : "#d1d5db",
              transition: "color 0.1s, transform 0.1s",
              transform: !readonly && star <= (hovered || 0) ? "scale(1.2)" : "scale(1)",
              display: "inline-block",
            }}
          >★</span>
        ))}
      </div>
      {!readonly && active > 0 && (
        <div style={{ fontSize: 13, fontWeight: 600, color: "#f59e0b" }}>
          {labels[active]}
        </div>
      )}
    </div>
  );
}

export default function FeedbackParticipant() {
  const [myEvents, setMyEvents] = useState([]);      // events with tickets
  const [eventId, setEventId] = useState("");
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState("");
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const res = await api.get("/tickets/mine");
        const tickets = res.data || [];
        const seen = new Set();
        const allEvents = [];
        for (const t of tickets) {
          if (t.event && !seen.has(t.event._id)) {
            seen.add(t.event._id);
            allEvents.push(t.event);
          }
        }
        const now = new Date();
        // Only events that have already ended
        const ended = allEvents.filter(e => e.endDate && new Date(e.endDate) < now);
        setMyEvents(ended);
        if (ended[0]?._id) setEventId(ended[0]._id);
      } catch {
        setErr("Failed to load your events");
      } finally { setLoading(false); }
    })();
  }, []);

  const handleEventChange = (id) => {
    setEventId(id);
    setRating(0);
    setComment("");
    setMsg("");
    setErr("");
    setSubmitted(false);
  };

  const submit = async () => {
    setMsg(""); setErr("");
    if (!eventId) return setErr("Please select an event");
    if (rating < 1) return setErr("Please select a star rating");
    try {
      await api.post(`/feedback/${eventId}`, { rating, comment });
      setMsg("✅ Feedback submitted anonymously! Thank you.");
      setSubmitted(true);
    } catch (e) {
      setErr(e?.response?.data?.msg || "Submission failed");
    }
  };

  const selectedEvent = myEvents.find(e => e._id === eventId);

  return (
    <>
      <Navbar />
      <div className="container" style={{ maxWidth: 640 }}>
        <h2>Submit Feedback</h2>
        <p className="muted" style={{ marginBottom: 20 }}>
          Your feedback is completely anonymous — your identity is not stored with your response.
          You can only submit feedback for events you are registered for.
        </p>

        {loading && <div className="muted">Loading your events…</div>}
        {!loading && myEvents.length === 0 && (
          <div className="alert">
            No completed events found. Feedback can only be submitted <strong>after an event has ended</strong>.
            Once your registered events are completed, they'll appear here.
          </div>
        )}

        {!loading && myEvents.length > 0 && (
          <div className="card wide" style={{ padding: "24px 28px" }}>
            {/* Anonymous notice */}
            <div style={{
              background: "#f0fdf4", border: "1px solid #bbf7d0",
              borderRadius: 10, padding: "10px 16px",
              fontSize: 13, color: "#166534", marginBottom: 20,
              display: "flex", alignItems: "center", gap: 8,
            }}>
              <span style={{ fontSize: 16 }}>🔒</span>
              <span>This feedback is <strong>completely anonymous</strong>. Organizers cannot see who submitted what.</span>
            </div>

            {msg && <div className="success" style={{ marginBottom: 16 }}>{msg}</div>}
            {err && <div className="alert" style={{ marginBottom: 16 }}>{err}</div>}

            {!submitted && (
              <>
                {/* Event picker */}
                <div style={{ marginBottom: 20 }}>
                  <label style={{ fontSize: 12, fontWeight: 800, color: "var(--muted)", display: "block", marginBottom: 6 }}>
                    SELECT EVENT
                  </label>
                  <select className="input" value={eventId} onChange={e => handleEventChange(e.target.value)}>
                    {myEvents.map(ev => (
                      <option key={ev._id} value={ev._id}>{ev.name}</option>
                    ))}
                  </select>
                  {selectedEvent?.startDate && (
                    <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>
                      Held on {new Date(selectedEvent.startDate).toLocaleDateString("en-IN")}
                    </div>
                  )}
                </div>

                {/* Star rating */}
                <div style={{ marginBottom: 20 }}>
                  <label style={{ fontSize: 12, fontWeight: 800, color: "var(--muted)", display: "block", marginBottom: 10 }}>
                    OVERALL RATING *
                  </label>
                  <StarRating value={rating} onChange={setRating} />
                </div>

                {/* Comment */}
                <div style={{ marginBottom: 20 }}>
                  <label style={{ fontSize: 12, fontWeight: 800, color: "var(--muted)", display: "block", marginBottom: 6 }}>
                    COMMENTS (optional)
                  </label>
                  <textarea
                    className="input"
                    placeholder="Share your thoughts about this event…"
                    value={comment}
                    onChange={e => setComment(e.target.value)}
                    maxLength={1000}
                    rows={4}
                    style={{ resize: "vertical" }}
                  />
                  <div className="muted" style={{ fontSize: 11, textAlign: "right" }}>
                    {comment.length}/1000
                  </div>
                </div>

                <button
                  className="btn"
                  style={{ width: "100%", padding: "13px" }}
                  onClick={submit}
                  disabled={rating < 1}
                >
                  Submit Anonymously
                </button>
              </>
            )}

            {submitted && (
              <div style={{ textAlign: "center", padding: "20px 0" }}>
                <div style={{ fontSize: 48, marginBottom: 12 }}>🎉</div>
                <h3>Thank you for your feedback!</h3>
                <p className="muted">Your response has been recorded anonymously.</p>
                <button className="btn btn-outline" style={{ marginTop: 12 }}
                  onClick={() => handleEventChange(eventId)}>
                  Submit for another event
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </>
  );
}
