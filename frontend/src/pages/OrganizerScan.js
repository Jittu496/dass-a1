import { useState, useEffect } from "react";
import Navbar from "../components/Navbar";
import { api } from "../api/client";

export default function OrganizerScan() {
  const [qrText, setQrText] = useState("");
  const [events, setEvents] = useState([]);
  const [eventId, setEventId] = useState("");
  const [selectedEventName, setSelectedEventName] = useState("");
  const [result, setResult] = useState(null);
  const [err, setErr] = useState("");

  const scan = async () => {
    setErr(""); setResult(null);
    try {
      const res = await api.post("/tickets/scan", { qrText, eventId });
      setResult(res.data);
    } catch (e) {
      setErr(e?.response?.data?.msg || "Scan failed");
    }
  };

  const loadMyEvents = async () => {
    try {
      const res = await api.get("/events/org/mine/list");
      setEvents(res.data || []);
      // Prefer explicit eventId from URL query string if present (avoid race with setState)
      let urlId = null;
      try {
        const params = new URLSearchParams(window.location.search);
        urlId = params.get("eventId");
      } catch (e) {
        urlId = null;
      }

      if (urlId) {
        setEventId(urlId);
        const sel = (res.data || []).find((x) => x._id === urlId);
        setSelectedEventName(sel?.name || "");
      } else if (!eventId && res.data?.[0]?._id) {
        setEventId(res.data[0]._id);
        setSelectedEventName(res.data[0].name || "");
      } else if (eventId) {
        const sel = (res.data || []).find((x) => x._id === eventId);
        if (sel) setSelectedEventName(sel.name || "");
      }
    } catch (e) {
      // ignore
    }
  };

  // load organizer events on mount
  useEffect(() => { 
    // if eventId provided in URL, set it; otherwise load events
    loadMyEvents();
  }, []);

  // keep selectedEventName in sync when events or eventId change
  useEffect(() => {
    if (!eventId || !events || events.length === 0) return;
    const sel = events.find((x) => x._id === eventId);
    if (sel) setSelectedEventName(sel.name || "");
  }, [eventId, events]);

  return (
    <>
      <Navbar />
      <div className="container">
        <h2>Scan QR (Manual)</h2>
        <div className="card wide">
          <p className="muted tiny">
            For demo: copy-paste QR text if needed (in real app you’d use camera scanner).
          </p>
            <div className="grid2">
              {eventId ? (
                // if eventId is provided (from My Events link), show fixed event name instead of a select
                <div className="input" style={{ paddingTop: 10 }}>{selectedEventName || "Selected event"}</div>
              ) : (
                <>
                  <select className="input" value={eventId} onChange={(e)=>setEventId(e.target.value)}>
                    {events.map(ev => <option key={ev._id} value={ev._id}>{ev.name}</option>)}
                  </select>
                  <button className="btn btn-outline" onClick={loadMyEvents}>Refresh</button>
                </>
              )}
            </div>

            <textarea className="input" value={qrText} onChange={(e)=>setQrText(e.target.value)} placeholder="Paste qrText here" />
            <button className="btn" onClick={scan}>Scan</button>

          {err && <div className="alert">{err}</div>}
          {result && (
            <div className="success">
              {result.msg} — {result.ticket?.participant?.firstName} {result.ticket?.participant?.lastName}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
