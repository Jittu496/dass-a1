import { useEffect, useState } from "react";
import Navbar from "../components/Navbar";
import { api } from "../api/client";

export default function AdminPasswordResets() {
  const [reqs, setReqs] = useState([]);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");
  const [decisionOpen, setDecisionOpen] = useState(false);
  const [decisionId, setDecisionId] = useState(null);
  const [decisionStatus, setDecisionStatus] = useState("");
  const [decisionNote, setDecisionNote] = useState("");

  const load = async () => {
    setErr(""); setMsg("");
    try {
      const res = await api.get("/admin/password-reset");
      setReqs(res.data);
    } catch (e) {
      setErr(e?.response?.data?.msg || "Load failed");
    }
  };

  useEffect(() => { load(); }, []);

  const openDecide = (id, status) => {
    setDecisionId(id); setDecisionStatus(status); setDecisionNote(""); setDecisionOpen(true);
  };

  const submitDecision = async () => {
    try {
      const res = await api.post(`/admin/password-reset/${decisionId}/decide`, { status: decisionStatus, note: decisionNote });
      if (res.data?.request?.newPasswordTemp) {
        setMsg(`Approved. TEMP PASSWORD: ${res.data.request.newPasswordTemp}`);
      } else {
        setMsg("Decision saved.");
      }
    } catch (e) {
      setErr(e?.response?.data?.msg || 'Decision failed');
    } finally {
      setDecisionOpen(false); setDecisionId(null); setDecisionStatus(""); setDecisionNote(""); load();
    }
  };

  return (
    <>
      <Navbar />
      <div className="container">
        <h2>Admin: Password Reset Requests</h2>
        {msg && <div className="success">{msg}</div>}
        {err && <div className="alert">{err}</div>}

        <div className="grid2">
          {reqs.map((r) => (
            <div className="tile" key={r._id}>
              <h3>{r.organizer?.firstName} {r.organizer?.lastName}</h3>
              <div className="tiny muted">{r.organizer?.email}</div>
              {/* clubName and reason removed from reset requests */}
              <div className="tiny muted">Status: <b>{r.status}</b></div>
              {r.status === "pending" && (
                <div className="row gap">
                  <button className="btn" onClick={() => openDecide(r._id, "approved")}>Approve</button>
                  <button className="btn btn-outline" onClick={() => openDecide(r._id, "rejected")}>Reject</button>
                </div>
              )}
              {r.decisionNote && <div className="tiny muted">Note: {r.decisionNote}</div>}
              {r.newPasswordTemp && <div className="tiny"><b>Temp:</b> {r.newPasswordTemp}</div>}
            </div>
          ))}
        </div>
        {decisionOpen && (
          <div className="card" style={{ marginTop: 12 }}>
            <h3>Decision: {decisionStatus}</h3>
            <textarea className="input" placeholder="Note (optional)" value={decisionNote} onChange={(e)=>setDecisionNote(e.target.value)} />
            <div style={{ marginTop: 8 }} className="row gap">
              <button className="btn" onClick={submitDecision}>Confirm</button>
              <button className="btn btn-outline" onClick={()=>setDecisionOpen(false)}>Cancel</button>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
