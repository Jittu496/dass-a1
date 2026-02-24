import { useEffect, useState } from "react";
import Navbar from "../components/Navbar";
import { api } from "../api/client";

const CATEGORIES = ["Club", "Council", "Fest Team", "Sports", "Technical", "Cultural", "Other"];

export default function AdminOrganizers() {
  const [list, setList] = useState([]);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");
  const [showForm, setShowForm] = useState(false);
  // form fields — now matching target format
  const [name, setName] = useState("");
  const [category, setCategory] = useState("Club");
  const [description, setDesc] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [contactNumber, setContactNumber] = useState("");

  const load = async () => {
    setErr("");
    try {
      const res = await api.get("/admin/organizers");
      setList(res.data);
    } catch (e) {
      setErr(e?.response?.data?.msg || "Load failed");
    }
  };

  useEffect(() => { load(); }, []);

  const resetForm = () => {
    setName(""); setCategory("Club"); setDesc(""); setContactEmail(""); setContactNumber("");
  };

  const create = async (e) => {
    e?.preventDefault?.();
    setErr(""); setMsg("");
    if (!name.trim()) return setErr("Club/Organizer name is required");
    try {
      const res = await api.post("/admin/organizers", {
        name: name.trim(), category, description, contactEmail, contactNumber,
      });
      setMsg(
        `✅ Organizer created!\n` +
        `LOGIN EMAIL: ${res.data.loginEmail || res.data.email}\n` +
        `TEMP PASSWORD: ${res.data.tempPassword}`
      );
      resetForm();
      setShowForm(false);
      setTimeout(load, 500);
    } catch (e) {
      setErr(e?.response?.data?.msg || "Create failed");
    }
  };

  const toggleDisable = async (id, currentlyDisabled) => {
    const action = currentlyDisabled ? "Enable" : "Disable";
    if (!window.confirm(`${action} this organizer account?`)) return;
    try {
      const res = await api.patch(`/admin/organizers/${id}/disable`, { disabled: !currentlyDisabled });
      setMsg(res.data.msg);
      load();
    } catch (e) {
      setErr(e?.response?.data?.msg || "Action failed");
    }
  };

  const permanentDelete = async (id) => {
    if (!window.confirm("Permanently delete this organizer? This cannot be undone.")) return;
    try {
      await api.delete(`/admin/organizers/${id}`);
      setMsg("Organizer permanently deleted.");
      load();
    } catch (e) {
      setErr(e?.response?.data?.msg || "Delete failed");
    }
  };

  return (
    <>
      <Navbar />
      <div className="container">
        <h2>Admin: Manage Clubs / Organizers</h2>

        {msg && (
          <div className="success" style={{ whiteSpace: "pre-line", marginBottom: 12 }}>{msg}</div>
        )}
        {err && <div className="alert" style={{ marginBottom: 12 }}>{err}</div>}

        <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
          <button className="btn" onClick={() => { setShowForm((s) => !s); resetForm(); }}>
            {showForm ? "Cancel" : "Create Organizer"}
          </button>
          {!showForm && <button className="btn btn-outline" onClick={load}>Refresh</button>}
        </div>

        {/* ── Create Form ── */}
        {showForm && (
          <form className="card form" onSubmit={create}
            style={{ marginBottom: 20, padding: "20px 24px", maxWidth: 560 }}>
            <h3 style={{ margin: "0 0 14px" }}>New Club / Organizer</h3>

            <input className="input" placeholder="Club / Organizer name *"
              value={name} onChange={(e) => setName(e.target.value)} required />

            <div className="grid2" style={{ marginTop: 8 }}>
              <select className="input" value={category} onChange={(e) => setCategory(e.target.value)}>
                {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
              <input className="input" placeholder="Short description"
                value={description} onChange={(e) => setDesc(e.target.value)} />
            </div>

            <div className="grid2" style={{ marginTop: 8 }}>
              <input className="input" placeholder="Contact email (club's public email)"
                value={contactEmail} onChange={(e) => setContactEmail(e.target.value)} />
              <input className="input" placeholder="Contact number"
                value={contactNumber} onChange={(e) => setContactNumber(e.target.value)} />
            </div>

            <div className="tiny muted" style={{ marginTop: 8 }}>
              Login email is auto-generated from the club name (e.g. chess_club@felicity.com)
            </div>

            <button className="btn" type="submit" style={{ marginTop: 12 }}>Create</button>
          </form>
        )}

        {/* ── Organizer Cards ── */}
        <div className="grid2" style={{ marginTop: 4 }}>
          {list.map((u) => {
            const displayName = u.name || `${u.firstName || ""} ${u.lastName || ""}`.trim() || "—";
            return (
              <div className="tile" key={u._id}
                style={{
                  opacity: u.disabled ? 0.6 : 1,
                  border: u.disabled ? "2px solid #f87171" : "1px solid rgba(18,18,18,0.08)"
                }}>

                <div className="tile-top">
                  <h3 style={{ margin: 0 }}>{displayName}</h3>
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                    {u.category && <span className="pill">{u.category}</span>}
                    {u.disabled && (
                      <span className="pill" style={{ background: "#f87171", color: "#fff" }}>Disabled</span>
                    )}
                    {u.isArchived && (
                      <span className="pill" style={{ background: "#9ca3af", color: "#fff" }}>Archived</span>
                    )}
                  </div>
                </div>

                {/* Document fields matching target format */}
                <div style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 13 }}>
                  <FieldRow label="Login Email" value={u.loginEmail || u.email} mono />
                  {u.contactEmail && <FieldRow label="Contact Email" value={u.contactEmail} />}
                  {u.contactNumber && <FieldRow label="Contact No." value={u.contactNumber} />}
                  {u.description && <div className="muted" style={{ fontSize: 12 }}>{u.description}</div>}
                  <div style={{ display: "flex", gap: 12, marginTop: 4, fontSize: 12, color: "var(--muted)" }}>
                    <span>Followers: <b>{(u.followers || []).length}</b></span>
                    <span>Active: <b style={{ color: u.isActive ? "#10b981" : "#ef4444" }}>{u.isActive ? "Yes" : "No"}</b></span>
                    <span>Archived: <b>{u.isArchived ? "Yes" : "No"}</b></span>
                  </div>
                </div>

                <div style={{ display: "flex", gap: 8, marginTop: 12, flexWrap: "wrap" }}>
                  <button className="btn btn-outline"
                    style={{
                      fontSize: 12, color: u.disabled ? "#22c55e" : "#f59e0b",
                      borderColor: u.disabled ? "#22c55e" : "#f59e0b"
                    }}
                    onClick={() => toggleDisable(u._id, u.disabled)}>
                    {u.disabled ? "Enable Account" : "Disable Account"}
                  </button>
                  <button className="btn btn-outline"
                    style={{ fontSize: 12, color: "#ef4444", borderColor: "#ef4444" }}
                    onClick={() => permanentDelete(u._id)}>
                    Delete
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {list.length === 0 && !err && (
          <div className="muted" style={{ textAlign: "center", padding: "32px 0", fontSize: 14 }}>
            No organizers yet. Create one above.
          </div>
        )}
      </div>
    </>
  );
}

function FieldRow({ label, value, mono }) {
  return (
    <div style={{ display: "flex", gap: 6 }}>
      <span className="muted" style={{ fontSize: 11, minWidth: 88 }}>{label}:</span>
      <span style={{ fontWeight: 600, fontFamily: mono ? "monospace" : "inherit", fontSize: 12 }}>{value}</span>
    </div>
  );
}
