import { useEffect, useState } from "react";
import Navbar from "../components/Navbar";
import { api } from "../api/client";
import { useNavigate, useParams } from "react-router-dom";

const FIELD_TYPES = ["text", "textarea", "dropdown", "checkbox", "number", "email", "file"];

function FormBuilder({ form = [], onChange, locked }) {
  const addField = () => {
    const newField = {
      id: `field_${Math.random().toString(36).slice(2, 8)}`,
      label: "",
      type: "text",
      required: false,
      options: [], // for dropdown/checkbox
    };
    onChange([...form, newField]);
  };

  const updateField = (id, patch) => {
    onChange(form.map((f) => (f.id === id ? { ...f, ...patch } : f)));
  };

  const removeField = (id) => onChange(form.filter((f) => f.id !== id));

  const moveField = (id, dir) => {
    const idx = form.findIndex((f) => f.id === id);
    if (idx < 0) return;
    const newForm = [...form];
    const target = idx + dir;
    if (target < 0 || target >= newForm.length) return;
    [newForm[idx], newForm[target]] = [newForm[target], newForm[idx]];
    onChange(newForm);
  };

  return (
    <div>
      {locked && (
        <div style={{
          background: "#fef3c7", border: "1px solid #fcd34d", borderRadius: 8,
          padding: "10px 14px", marginBottom: 12, fontSize: 13, color: "#92400e"
        }}>
          ⚠️ Registration form is locked because at least one participant has registered. Fields cannot be edited.
        </div>
      )}

      {form.length === 0 && !locked && (
        <div className="muted" style={{ fontSize: 13, marginBottom: 10 }}>
          No custom fields yet. Add fields to create a registration form.
        </div>
      )}

      {form.map((field, idx) => (
        <div key={field.id} style={{
          background: "#f9fafb", border: "1px solid #e5e7eb",
          borderRadius: 10, padding: 14, marginBottom: 10,
          opacity: locked ? 0.7 : 1
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
            <span className="muted" style={{ fontSize: 12, minWidth: 24 }}>#{idx + 1}</span>
            <input
              className="input"
              placeholder="Field label (e.g. 'GitHub URL')"
              value={field.label}
              disabled={locked}
              onChange={(e) => updateField(field.id, { label: e.target.value })}
              style={{ flex: 1 }}
            />
            <select
              className="input"
              value={field.type}
              disabled={locked}
              onChange={(e) => updateField(field.id, { type: e.target.value, options: [] })}
              style={{ flex: "0 0 130px" }}
            >
              {FIELD_TYPES.map((t) => (
                <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>
              ))}
            </select>
            <label style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 12, whiteSpace: "nowrap" }}>
              <input
                type="checkbox"
                checked={field.required}
                disabled={locked}
                onChange={(e) => updateField(field.id, { required: e.target.checked })}
              />
              Required
            </label>
            {!locked && (
              <>
                <button type="button" onClick={() => moveField(field.id, -1)} style={{
                  background: "none", border: "1px solid #e5e7eb", borderRadius: 6,
                  padding: "4px 8px", cursor: "pointer", fontSize: 12
                }} disabled={idx === 0}>↑</button>
                <button type="button" onClick={() => moveField(field.id, 1)} style={{
                  background: "none", border: "1px solid #e5e7eb", borderRadius: 6,
                  padding: "4px 8px", cursor: "pointer", fontSize: 12
                }} disabled={idx === form.length - 1}>↓</button>
                <button type="button" onClick={() => removeField(field.id)} style={{
                  background: "none", border: "1px solid #fca5a5", borderRadius: 6,
                  padding: "4px 8px", cursor: "pointer", fontSize: 12, color: "#ef4444"
                }}>✕</button>
              </>
            )}
          </div>

          {/* Options for dropdown/checkbox */}
          {(field.type === "dropdown" || field.type === "checkbox") && !locked && (
            <div style={{ marginTop: 8, marginLeft: 32 }}>
              <div className="muted" style={{ fontSize: 12, marginBottom: 6 }}>Options (one per line):</div>
              <textarea
                className="input"
                rows={3}
                placeholder="Option 1&#10;Option 2&#10;Option 3"
                value={(field.options || []).join("\n")}
                onChange={(e) => updateField(field.id, { options: e.target.value.split("\n") })}
                style={{ fontSize: 13 }}
              />
            </div>
          )}
          {(field.type === "dropdown" || field.type === "checkbox") && locked && (
            <div style={{ marginLeft: 32, fontSize: 12, color: "#6b7280" }}>
              Options: {(field.options || []).join(", ")}
            </div>
          )}
        </div>
      ))}

      {!locked && (
        <button type="button" className="btn btn-outline" onClick={addField} style={{ marginTop: 4, fontSize: 13 }}>
          + Add Field
        </button>
      )}
    </div>
  );
}

export default function OrganizerEditEvent() {
  const { id } = useParams();
  const [ev, setEv] = useState(null);
  const [err, setErr] = useState([]);
  const [msg, setMsg] = useState("");
  const navigate = useNavigate();

  useEffect(() => {
    (async () => {
      try {
        const res = await api.get(`/events/${id}`);
        setEv(res.data);
      } catch {
        setErr(["Event not found"]);
      }
    })();
  }, [id]);

  const isLocked = (status) => ["completed", "closed"].includes(status);
  const isPublished = (status) => ["published", "ongoing"].includes(status);

  const save = async () => {
    setErr([]); setMsg("");
    try {
      const errors = [];
      const payload = { ...ev, fee: ev.type === "merch" ? 0 : ev.fee };
      if (payload.type === "merch") {
        if (Array.isArray(payload.variants) && payload.variants.length > 0) {
          payload.variants.forEach((v, idx) => {
            const idn = idx + 1;
            if (!v.name && !v.size && !v.color) errors.push(`Variant ${idn}: provide at least a name, size or color.`);
            if (v.price !== "" && (typeof v.price !== "number" || Number.isNaN(v.price) || v.price < 0)) errors.push(`Variant ${idn}: price must be a number >= 0.`);
            if (v.stock == null || typeof v.stock !== "number" || Number.isNaN(v.stock) || v.stock < 0) errors.push(`Variant ${idn}: stock must be a number >= 0.`);
          });
          if (errors.length === 0) {
            payload.variants = payload.variants.map((v) => ({
              id: v.id, name: v.name, size: v.size, color: v.color,
              stock: Number(v.stock || 0),
              price: v.price != null && v.price !== "" ? Number(v.price) : undefined,
              perParticipantLimit: v.perParticipantLimit != null && v.perParticipantLimit !== "" ? Number(v.perParticipantLimit) : undefined,
            }));
            payload.stock = payload.variants.reduce((a, x) => a + (Number(x.stock) || 0), 0);
          }
        } else {
          if (payload.stock == null || Number.isNaN(Number(payload.stock))) errors.push("Stock is required for merch.");
          else if (Number(payload.stock) < 0) errors.push("Stock must be 0 or more.");
        }
      }
      if (payload.distributionVenueConfirmed) {
        payload.distributionStart = payload.startDate;
        payload.distributionEnd = payload.endDate;
      }
      if (errors.length > 0) { setErr(errors); return; }

      await api.put(`/events/${id}`, payload);
      setMsg("Saved successfully!");
    } catch (e) {
      setErr([e?.response?.data?.msg || "Save failed"]);
    }
  };

  if (!ev) return (
    <><Navbar /><div className="container">
      {Array.isArray(err) && err.length > 0
        ? <div className="alert"><ul style={{ margin: 0, paddingLeft: 18 }}>{err.map((m, i) => <li key={i}>{m}</li>)}</ul></div>
        : <p className="muted">Loading...</p>}
    </div></>
  );

  const locked = isLocked(ev.status);
  const published = isPublished(ev.status);
  const formLocked = ev.registrationFormLocked;

  // Editing rules per spec
  const canEditBasic = !locked; // draft: free edits; published/ongoing: limited
  const canEditStatus = true; // always can change status (within rules)

  return (
    <>
      <Navbar />
      <div className="container">
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 8 }}>
          <button className="btn btn-outline" onClick={() => navigate("/org/events")} style={{ fontSize: 12, padding: "5px 12px" }}>← Back</button>
          <h2 style={{ margin: 0 }}>Edit Event</h2>
          <span style={{
            background: ["completed", "closed"].includes(ev.status) ? "#fee2e2" :
              ["published", "ongoing"].includes(ev.status) ? "#dbeafe" : "#f3f4f6",
            color: ["completed", "closed"].includes(ev.status) ? "#991b1b" :
              ["published", "ongoing"].includes(ev.status) ? "#1d4ed8" : "#6b7280",
            borderRadius: 20, padding: "3px 12px", fontSize: 12, fontWeight: 700
          }}>{ev.status}</span>
        </div>

        {/* Editing rules notice */}
        {locked && (
          <div style={{ background: "#fee2e2", border: "1px solid #fca5a5", borderRadius: 10, padding: "10px 16px", marginBottom: 16, fontSize: 13, color: "#991b1b" }}>
            🔒 This event is <b>{ev.status}</b>. Only status changes (completed/closed) are allowed.
          </div>
        )}
        {published && !locked && (
          <div style={{ background: "#dbeafe", border: "1px solid #93c5fd", borderRadius: 10, padding: "10px 16px", marginBottom: 16, fontSize: 13, color: "#1e40af" }}>
            ℹ️ Published event: you can update description, extend registration deadline, increase participant limit, or close registrations.
          </div>
        )}

        {msg && <div className="success" style={{ marginBottom: 12 }}>{msg}</div>}
        {Array.isArray(err) && err.length > 0 && (
          <div className="alert" style={{ marginBottom: 12 }}>
            <ul style={{ margin: 0, paddingLeft: 18 }}>{err.map((m, i) => <li key={i} style={{ lineHeight: 1.6 }}>{m}</li>)}</ul>
          </div>
        )}

        <div className="card wide form">

          {/* Basic Info */}
          <div style={{ marginBottom: 16 }}>
            <div className="muted" style={{ fontSize: 12, marginBottom: 6 }}>Event Name</div>
            <input className="input" value={ev.name}
              disabled={published || locked}
              onChange={(e) => setEv({ ...ev, name: e.target.value })} />
          </div>

          <div style={{ marginBottom: 16 }}>
            <div className="muted" style={{ fontSize: 12, marginBottom: 6 }}>Description {!locked && <span style={{ color: "#10b981" }}>(editable)</span>}</div>
            <textarea className="input" rows={3} value={ev.description || ""}
              disabled={locked}
              onChange={(e) => setEv({ ...ev, description: e.target.value })} />
          </div>

          <div className="grid2" style={{ marginBottom: 16 }}>
            <div>
              <div className="muted" style={{ fontSize: 12, marginBottom: 6 }}>Eligibility</div>
              <input className="input" value={ev.eligibility || ""}
                disabled={published || locked}
                onChange={(e) => setEv({ ...ev, eligibility: e.target.value })} />
            </div>
            {ev.type !== "merch" ? (
              <div>
                <div className="muted" style={{ fontSize: 12, marginBottom: 6 }}>Fee (₹)</div>
                <input className="input" type="number" value={ev.fee || 0}
                  disabled={published || locked}
                  onChange={(e) => setEv({ ...ev, fee: Number(e.target.value) })} />
              </div>
            ) : (
              <div style={{ display: "flex", alignItems: "flex-end" }}>
                <div className="tiny muted">Fee is per-variant for merch events</div>
              </div>
            )}
          </div>

          {/* Registration Limit — can increase when published */}
          {ev.type !== "merch" && (
            <div style={{ marginBottom: 16 }}>
              <div className="muted" style={{ fontSize: 12, marginBottom: 6 }}>
                Registration Limit (0 = unlimited)
                {published && !locked && <span style={{ color: "#10b981", marginLeft: 6 }}>(can increase)</span>}
              </div>
              <input className="input" type="number" min={0}
                value={ev.registrationLimit || 0}
                disabled={locked}
                onChange={(e) => setEv({ ...ev, registrationLimit: Number(e.target.value) })} />
            </div>
          )}

          {/* Merch section */}
          {ev.type === "merch" && (
            <div style={{ background: "#f9fafb", borderRadius: 10, padding: 16, marginBottom: 16 }}>
              <h4 style={{ margin: "0 0 12px" }}>Merchandise</h4>
              {(ev.variants || []).length > 0 ? (
                <div className="tiny muted">Stock is managed per-variant. Total: {(ev.variants || []).reduce((a, v) => a + (Number(v.stock) || 0), 0)}</div>
              ) : (
                <input className="input" type="number" value={ev.stock || 0}
                  disabled={locked}
                  onChange={(e) => setEv({ ...ev, stock: Number(e.target.value) })} />
              )}
              <label style={{ display: "inline-flex", alignItems: "center", gap: 8, marginTop: 8 }}>
                <input type="checkbox" checked={!!ev.distributionVenueConfirmed}
                  disabled={locked}
                  onChange={(e) => setEv({ ...ev, distributionVenueConfirmed: e.target.checked })} />
                <span className="tiny">Venue confirmed</span>
              </label>
              {ev.distributionVenueConfirmed && (
                <input className="input" placeholder="Distribution venue" value={ev.distributionVenue || ""}
                  disabled={locked}
                  onChange={(e) => setEv({ ...ev, distributionVenue: e.target.value })}
                  style={{ marginTop: 8 }} />
              )}
              {/* Variants */}
              <div style={{ marginTop: 12 }}>
                <div className="tiny muted">Variants</div>
                <div style={{ marginTop: 6 }}>
                  {!locked && <button type="button" className="btn btn-outline" style={{ fontSize: 12 }} onClick={() => {
                    const v = { id: `v_${Math.random().toString(36).slice(2, 9)}`, name: "", size: "", color: "", stock: 0, price: "", perParticipantLimit: "" };
                    setEv({ ...ev, variants: [...(ev.variants || []), v] });
                  }}>Add Variant</button>}
                </div>
                {(ev.variants || []).map((v) => (
                  <div key={v.id} className="card" style={{ marginTop: 8 }}>
                    <div className="grid3">
                      <input className="input" placeholder="Name/Label" value={v.name || ""} disabled={locked}
                        onChange={(e) => setEv({ ...ev, variants: (ev.variants || []).map(x => x.id === v.id ? { ...x, name: e.target.value } : x) })} />
                      <input className="input" placeholder="Size" value={v.size || ""} disabled={locked}
                        onChange={(e) => setEv({ ...ev, variants: (ev.variants || []).map(x => x.id === v.id ? { ...x, size: e.target.value } : x) })} />
                      <input className="input" placeholder="Color" value={v.color || ""} disabled={locked}
                        onChange={(e) => setEv({ ...ev, variants: (ev.variants || []).map(x => x.id === v.id ? { ...x, color: e.target.value } : x) })} />
                    </div>
                    <div className="grid3" style={{ marginTop: 8 }}>
                      <input className="input" placeholder="Price" type="number" min={0} value={v.price || ""} disabled={locked}
                        onChange={(e) => { const val = e.target.value === "" ? "" : Number(e.target.value); setEv({ ...ev, variants: (ev.variants || []).map(x => x.id === v.id ? { ...x, price: val } : x) }); }} />
                      <input className="input" placeholder="Stock" type="number" min={0} value={v.stock || 0} disabled={locked}
                        onChange={(e) => { const val = e.target.value === "" ? 0 : Number(e.target.value); setEv({ ...ev, variants: (ev.variants || []).map(x => x.id === v.id ? { ...x, stock: val } : x) }); }} />
                      <input className="input" placeholder="Per participant limit" type="number" min={0} value={v.perParticipantLimit || ""} disabled={locked}
                        onChange={(e) => { const val = e.target.value === "" ? "" : Number(e.target.value); setEv({ ...ev, variants: (ev.variants || []).map(x => x.id === v.id ? { ...x, perParticipantLimit: val } : x) }); }} />
                    </div>
                    {!locked && <div style={{ marginTop: 8 }}><button type="button" className="btn btn-outline" style={{ fontSize: 12 }} onClick={() => setEv({ ...ev, variants: (ev.variants || []).filter(x => x.id !== v.id) })}>Remove</button></div>}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Dates */}
          <div className="grid3" style={{ marginBottom: 16 }}>
            <div>
              <div className="muted" style={{ fontSize: 12, marginBottom: 6 }}>
                Reg. Deadline {published && !locked && <span style={{ color: "#10b981" }}>(can extend)</span>}
              </div>
              <input className="input" type="datetime-local"
                value={(ev.registrationDeadline || "").slice(0, 16)}
                disabled={locked}
                onChange={(e) => setEv({ ...ev, registrationDeadline: e.target.value })} />
            </div>
            <div>
              <div className="muted" style={{ fontSize: 12, marginBottom: 6 }}>Start Date</div>
              <input className="input" type="datetime-local"
                value={(ev.startDate || "").slice(0, 16)}
                disabled={published || locked}
                onChange={(e) => setEv({ ...ev, startDate: e.target.value })} />
            </div>
            <div>
              <div className="muted" style={{ fontSize: 12, marginBottom: 6 }}>End Date</div>
              <input className="input" type="datetime-local"
                value={(ev.endDate || "").slice(0, 16)}
                disabled={published || locked}
                onChange={(e) => setEv({ ...ev, endDate: e.target.value })} />
            </div>
          </div>

          <div className="grid2" style={{ marginBottom: 16 }}>
            <div>
              <div className="muted" style={{ fontSize: 12, marginBottom: 6 }}>Status</div>
              <select className="input" value={ev.status}
                onChange={(e) => setEv({ ...ev, status: e.target.value })}>
                <option value="draft">draft</option>
                <option value="published">published</option>
                <option value="ongoing">ongoing</option>
                <option value="completed">completed</option>
                <option value="closed">closed</option>
              </select>
            </div>
            <div>
              <div className="muted" style={{ fontSize: 12, marginBottom: 6 }}>Tags (comma separated)</div>
              <input className="input" placeholder="tag1, tag2"
                value={(ev.tags || []).join(", ")}
                disabled={published || locked}
                onChange={(e) => setEv({ ...ev, tags: e.target.value.split(",").map(s => s.trim()).filter(Boolean) })} />
            </div>
          </div>

          {/* ── Form Builder (Normal events only) ───────────────────────── */}
          {ev.type === "normal" && (
            <div style={{
              background: "#f9fafb", border: "1px solid #e5e7eb",
              borderRadius: 12, padding: 20, marginBottom: 16
            }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
                <div>
                  <h4 style={{ margin: 0 }}>📝 Custom Registration Form</h4>
                  <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>
                    Add custom fields participants must fill when registering.
                    {formLocked && <span style={{ color: "#ef4444", marginLeft: 6 }}>LOCKED (registrations received)</span>}
                  </div>
                </div>
                {formLocked && <span style={{ background: "#fee2e2", color: "#991b1b", borderRadius: 20, padding: "3px 10px", fontSize: 11, fontWeight: 700 }}>Locked</span>}
              </div>
              <FormBuilder
                form={ev.registrationForm || []}
                locked={formLocked || locked}
                onChange={(newForm) => setEv({ ...ev, registrationForm: newForm })}
              />
            </div>
          )}

          <div className="row gap">
            <button className="btn" onClick={save}>Save Changes</button>
            <button className="btn btn-outline" onClick={() => navigate("/org/events")}>Back</button>
          </div>
        </div>
      </div>
    </>
  );
}
