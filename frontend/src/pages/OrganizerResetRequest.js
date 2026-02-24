import { useState } from "react";
import Navbar from "../components/Navbar";
import { api } from "../api/client";

export default function OrganizerResetRequest() {
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");
  const requestReset = async () => {
    setMsg(""); setErr("");
    try {
      const res = await api.post("/admin/password-reset/request");
      setMsg("Password reset requested. Admin will approve/reject soon. RequestId: " + res.data._id);
    } catch (e) {
      setErr(e?.response?.data?.msg || "Request failed");
    }
  };

  return (
    <>
      <Navbar />
      <div className="container">
        <h2>Organizer Password Reset Request</h2>
        <p className="muted">Tier B Feature: Organizer requests reset → Admin approves & generates temp password.</p>

        {msg && <div className="success">{msg}</div>}
        {err && <div className="alert">{err}</div>}

        <div className="card wide">
          <button className="btn" onClick={requestReset}>Request Password Reset</button>
          <div className="tiny muted" style={{ marginTop: 10 }}>
            If you already requested, it may show “Already pending”.
          </div>
        </div>
      </div>
    </>
  );
}
