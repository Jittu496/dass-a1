import { useState } from "react";
import Navbar from "../components/Navbar";
import { api } from "../api/client";
import { useNavigate } from "react-router-dom";

export default function OrganizerCreateEvent() {
  const navigate = useNavigate();

  const [name, setName] = useState("");
  const [description, setDesc] = useState("");
  const [type, setType] = useState("normal");

  // keep as strings -> input can be empty (no forced 0)
  const [fee, setFee] = useState("");
  const [stock, setStock] = useState("");
  const [registrationLimit, setLimit] = useState("");

  // hackathon
  const [participationMode, setParticipationMode] = useState("individual"); // individual | team
  const [teamSize, setTeamSize] = useState("");

  const [tags, setTags] = useState("");
  const [registrationForm, setRegistrationForm] = useState([]);


  // eligibility: only IIIT or Non-IIIT per user request
  const [eligibility, setEligibility] = useState("All");

  // merch distribution details
  const [distributionVenue, setDistributionVenue] = useState("");
  const [distributionVenueConfirmed, setDistributionVenueConfirmed] = useState(false);
  const [variants, setVariants] = useState([]);

  const addVariant = () => {
    const v = { id: `v_${Math.random().toString(36).slice(2, 9)}`, name: "", size: "", color: "", stock: 0, price: "", perParticipantLimit: "" };
    setVariants((s) => [...s, v]);
  };

  const updateVariant = (id, patch) => {
    setVariants((s) => s.map((v) => (v.id === id ? { ...v, ...patch } : v)));
  };

  const removeVariant = (id) => setVariants((s) => s.filter((v) => v.id !== id));

  // Date + Time
  const [deadlineDate, setDeadlineDate] = useState("");
  const [deadlineTime, setDeadlineTime] = useState("");
  const [startDateOnly, setStartDateOnly] = useState("");
  const [startTimeOnly, setStartTimeOnly] = useState("");
  const [endDateOnly, setEndDateOnly] = useState("");
  const [endTimeOnly, setEndTimeOnly] = useState("");

  const [err, setErr] = useState([]);

  // Build datetime string in IST explicitly (GMT+5:30)
  // Example: "2026-02-20T07:30:00+05:30"
  const toISTString = (d, t) => {
    if (!d || !t) return null;
    const hhmm = t.slice(0, 5);
    return `${d}T${hhmm}:00+05:30`;
  };

  const toNumberOrDefault = (val, def = 0) => {
    if (val === "" || val === null || val === undefined) return def;
    const n = Number(val);
    return Number.isFinite(n) ? n : def;
  };

  const submit = async (e) => {
    e.preventDefault();
    setErr([]);
    const errors = [];
    if (!name.trim()) errors.push("Event name is required.");

    if (!deadlineDate || !deadlineTime || !startDateOnly || !startTimeOnly || !endDateOnly || !endTimeOnly) {
      errors.push("Please fill Registration Deadline, Start, and End date & time.");
    }

    const registrationDeadline = toISTString(deadlineDate, deadlineTime);
    const startDate = toISTString(startDateOnly, startTimeOnly);
    const endDate = toISTString(endDateOnly, endTimeOnly);

    const d = new Date(registrationDeadline);
    const s = new Date(startDate);
    const en = new Date(endDate);

    if ([d, s, en].some((x) => Number.isNaN(x.getTime()))) {
      errors.push("Invalid date/time. Please re-select.");
    } else {
      if (en <= s) errors.push("End time must be after start time.");
      if (d > s) errors.push("Registration deadline must be before start time.");
    }

    if (type === "merch") {
      // require distribution venue only when venue is confirmed
      if (distributionVenueConfirmed && !distributionVenue) {
        errors.push("Please provide distribution venue when venue is confirmed.");
      }
      // If variants are present, top-level stock is not required and will be computed.
      if (!variants || variants.length === 0) {
        if (stock === "" || stock == null) {
          errors.push("Stock is required for merch when no variants are provided. Please enter a number.");
        } else if (toNumberOrDefault(stock, -1) < 0) {
          errors.push("Stock must be 0 or more.");
        }
      }
    }

    if (type === "hackathon") {
      if (participationMode === "team") {
        if (teamSize === "") errors.push("Team size is required for Team mode.");
        if (toNumberOrDefault(teamSize, 0) < 2) errors.push("Team size must be at least 2.");
      }
    }

    // ✅ eligibility default like fee:
    const finalEligibility = eligibility.trim() === "" ? "All" : eligibility.trim();

    const payload = {
      name: name.trim(),
      description: description.trim(),
      type,
      eligibility: finalEligibility,
      tags: tags.split(",").map((s) => s.trim()).filter(Boolean),

      registrationDeadline,
      startDate,
      endDate,

      // For merch events, fee is driven by per-variant prices. Force 0 here.
      fee: type === "merch" ? 0 : toNumberOrDefault(fee, 0),
      registrationLimit: type === "merch" ? 0 : toNumberOrDefault(registrationLimit, 0),
      stock: type === "merch" ? toNumberOrDefault(stock, 0) : 0,
      // Custom registration form (normal events only)
      registrationForm: type === "normal" ? registrationForm.filter(f => f.label.trim()) : [],

    };

    if (type === "merch") {
      // include venue only if provided (it's optional when not confirmed)
      if (distributionVenue) payload.distributionVenue = distributionVenue.trim();
      payload.distributionVenueConfirmed = Boolean(distributionVenueConfirmed);
      // Some backends expect explicit distribution start/end when venue is confirmed — include them to be safe
      if (distributionVenueConfirmed) {
        payload.distributionStart = startDate;
        payload.distributionEnd = endDate;
      }
      if (variants && variants.length > 0) {
        // validate variants and collect errors with indices
        variants.forEach((v, idx) => {
          const id = idx + 1;
          if (!v.name && !v.size && !v.color) errors.push(`Variant ${id}: provide at least a name, size or color.`);
          if (v.price !== "" && (typeof v.price !== "number" || Number.isNaN(v.price) || v.price < 0)) errors.push(`Variant ${id}: price must be a number >= 0.`);
          if (v.stock === "" || v.stock == null || typeof v.stock !== "number" || Number.isNaN(v.stock) || v.stock < 0) errors.push(`Variant ${id}: stock must be a number >= 0.`);
          if (v.perParticipantLimit !== "" && (typeof v.perParticipantLimit !== "number" || Number.isNaN(v.perParticipantLimit) || v.perParticipantLimit < 0)) errors.push(`Variant ${id}: per-participant limit must be a number >= 0.`);
        });

        if (errors.length === 0) {
          payload.variants = variants.map(v => ({
            id: v.id,
            name: v.name,
            size: v.size,
            color: v.color,
            stock: Number(v.stock || 0),
            price: v.price != null && v.price !== "" ? Number(v.price) : undefined,
            perParticipantLimit: v.perParticipantLimit != null && v.perParticipantLimit !== "" ? Number(v.perParticipantLimit) : undefined,
          }));

          // set total stock as sum of variant stocks
          payload.stock = payload.variants.reduce((a, x) => a + (Number(x.stock) || 0), 0);
        }
      }
    }

    // If any validation errors collected, show them and stop
    if (errors.length > 0) {
      return setErr(errors);
    }

    if (type === "hackathon") {
      payload.participationMode = participationMode;
      payload.teamSize = participationMode === "team" ? toNumberOrDefault(teamSize, 2) : 1;
    }

    try {
      await api.post("/events", payload);
      navigate("/org/events");
    } catch (e2) {
      setErr([e2?.response?.data?.msg || "Create failed"]);
    }
  };

  return (
    <>
      <Navbar />
      <div className="container">
        <h2>Create Event (Draft)</h2>
        {err && Array.isArray(err) && err.length > 0 && (
          <div className="alert">
            <ul style={{ margin: 0, paddingLeft: 18 }}>
              {err.map((m, i) => (
                <li key={i} style={{ lineHeight: 1.6 }}>{m}</li>
              ))}
            </ul>
          </div>
        )}

        <form className="card wide form" onSubmit={submit}>
          <input
            className="input"
            placeholder="Event name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />

          <textarea
            className="input"
            placeholder="Description"
            value={description}
            onChange={(e) => setDesc(e.target.value)}
          />

          <div className="grid2">
            <select
              className="input"
              value={type}
              onChange={(e) => {
                const next = e.target.value;
                setType(next);

                if (next !== "merch") setStock("");
                if (next === "merch") setLimit("");
                if (next !== "hackathon") {
                  setParticipationMode("individual");
                  setTeamSize("");
                }
              }}
            >
              <option value="normal">Normal</option>
              <option value="merch">Merch</option>
              <option value="hackathon">Hackathon</option>
            </select>

            <select className="input" value={eligibility} onChange={(e) => setEligibility(e.target.value)}>
              <option value="All">All</option>
              <option value="IIIT">IIIT</option>
              <option value="Non-IIIT">Non-IIIT</option>
            </select>
          </div>

          <div className="grid2">
            {type !== "merch" ? (
              <input
                className="input"
                placeholder="Fee (leave empty = 0)"
                type="number"
                min={0}
                value={fee}
                onChange={(e) => setFee(e.target.value)}
              />
            ) : (
              <div style={{ display: "flex", alignItems: "center" }}>
                <div className="tiny muted">Fee is per-variant for merch events</div>
              </div>
            )}

            {type === "merch" ? (
              variants && variants.length > 0 ? (
                // When variants exist, stock is managed per-variant
                <div style={{ display: "flex", alignItems: "center" }}>
                  <div className="tiny muted">Stock is managed per-variant. Total stock will be the sum of variant stocks.</div>
                </div>
              ) : (
                <input
                  className="input"
                  placeholder="Stock (required)"
                  type="number"
                  min={0}
                  value={stock}
                  onChange={(e) => setStock(e.target.value)}
                  required
                />
              )
            ) : (
              <input
                className="input"
                placeholder="Registration limit (leave empty or 0 = unlimited)"
                type="number"
                min={0}
                value={registrationLimit}
                onChange={(e) => setLimit(e.target.value)}
              />
            )}
          </div>

          {type === "merch" && (
            <div className="card" style={{ marginTop: 12 }}>
              <h4>Merchandise distribution details</h4>
              <div className="tiny muted" style={{ marginTop: 6 }}>
                Is the distribution venue confirmed?
              </div>
              <div style={{ marginTop: 6 }}>
                <label style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                  <input type="checkbox" checked={distributionVenueConfirmed} onChange={(e) => setDistributionVenueConfirmed(e.target.checked)} />
                  <span className="tiny">Venue confirmed</span>
                </label>
              </div>
              {distributionVenueConfirmed && (
                <div style={{ marginTop: 10 }}>
                  <input
                    className="input"
                    placeholder="Distribution venue (e.g., Admin Block, Room 101)"
                    value={distributionVenue}
                    onChange={(e) => setDistributionVenue(e.target.value)}
                  />
                </div>
              )}
              {/* Variant editor */}
              <div style={{ marginTop: 12 }}>
                <div className="tiny muted">Variants (optional): add size/color/price per-variant</div>
                <div className="tiny" style={{ marginTop: 6 }}>
                  Total variant stock: {variants.reduce((a, v) => a + (Number(v.stock) || 0), 0)}
                </div>
                <div style={{ marginTop: 8 }}>
                  <button type="button" className="btn btn-outline" onClick={addVariant}>Add Variant</button>
                </div>

                {variants.map((v) => (
                  <div key={v.id} className="card" style={{ marginTop: 8 }}>
                    <div className="grid3">
                      <input className="input" placeholder="Name/Label" value={v.name} onChange={(e) => updateVariant(v.id, { name: e.target.value })} />
                      <input className="input" placeholder="Size" value={v.size} onChange={(e) => updateVariant(v.id, { size: e.target.value })} />
                      <input className="input" placeholder="Color" value={v.color} onChange={(e) => updateVariant(v.id, { color: e.target.value })} />
                    </div>
                    <div className="grid3" style={{ marginTop: 8 }}>
                      <input className="input" placeholder="Price" type="number" min={0} value={v.price} onChange={(e) => updateVariant(v.id, { price: e.target.value === "" ? "" : Number(e.target.value) })} />
                      <input className="input" placeholder="Stock" type="number" min={0} value={v.stock} onChange={(e) => updateVariant(v.id, { stock: e.target.value === "" ? "" : Number(e.target.value) })} />
                      <input className="input" placeholder="Per participant limit (optional)" type="number" min={0} value={v.perParticipantLimit} onChange={(e) => updateVariant(v.id, { perParticipantLimit: e.target.value === "" ? "" : Number(e.target.value) })} />
                    </div>
                    <div style={{ marginTop: 8 }}>
                      <button type="button" className="btn btn-outline" onClick={() => removeVariant(v.id)}>Remove</button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {type === "hackathon" && (
            <div className="grid2">
              <select
                className="input"
                value={participationMode}
                onChange={(e) => {
                  setParticipationMode(e.target.value);
                  if (e.target.value !== "team") setTeamSize("");
                }}
              >
                <option value="individual">Individual</option>
                <option value="team">Team</option>
              </select>

              {participationMode === "team" ? (
                <input
                  className="input"
                  placeholder="Team size (min 2)"
                  type="number"
                  min={2}
                  value={teamSize}
                  onChange={(e) => setTeamSize(e.target.value)}
                  required
                />
              ) : (
                <input className="input" value="Team size: 1 (Individual)" readOnly />
              )}
            </div>
          )}

          <div className="field">
            <div className="tiny muted" style={{ marginBottom: 6 }}>
              Registration Deadline (IST / GMT+5:30)
            </div>
            <div className="grid2">
              <input className="input" type="date" value={deadlineDate} onChange={(e) => setDeadlineDate(e.target.value)} required />
              <input className="input" type="time" value={deadlineTime} onChange={(e) => setDeadlineTime(e.target.value)} required />
            </div>
          </div>

          <div className="field">
            <div className="tiny muted" style={{ marginBottom: 6 }}>
              Start Date & Time (IST / GMT+5:30)
            </div>
            <div className="grid2">
              <input className="input" type="date" value={startDateOnly} onChange={(e) => setStartDateOnly(e.target.value)} required />
              <input className="input" type="time" value={startTimeOnly} onChange={(e) => setStartTimeOnly(e.target.value)} required />
            </div>
          </div>

          <div className="field">
            <div className="tiny muted" style={{ marginBottom: 6 }}>
              End Date & Time (IST / GMT+5:30)
            </div>
            <div className="grid2">
              <input className="input" type="date" value={endDateOnly} onChange={(e) => setEndDateOnly(e.target.value)} required />
              <input className="input" type="time" value={endTimeOnly} onChange={(e) => setEndTimeOnly(e.target.value)} required />
            </div>
          </div>

          <input
            className="input"
            placeholder="Tags (comma separated)"
            value={tags}
            onChange={(e) => setTags(e.target.value)}
          />

          {/* Form Builder — Normal events only */}
          {type === "normal" && (
            <div style={{ background: "#f9fafb", border: "1px solid #e5e7eb", borderRadius: 12, padding: 20, marginTop: 8 }}>
              <h4 style={{ margin: "0 0 8px" }}>📝 Custom Registration Form (Optional)</h4>
              <p className="muted" style={{ fontSize: 13, margin: "0 0 12px" }}>
                Add custom fields that participants must fill when registering. Form cannot be edited after the first registration.
              </p>
              {registrationForm.map((field, idx) => (
                <div key={field.id} style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 8, padding: 12, marginBottom: 10 }}>
                  <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                    <span className="muted" style={{ fontSize: 12 }}>#{idx + 1}</span>
                    <input className="input" style={{ flex: 1, minWidth: 140 }}
                      placeholder="Field label (e.g. 'GitHub URL')"
                      value={field.label}
                      onChange={(e) => setRegistrationForm(registrationForm.map((f) => f.id === field.id ? { ...f, label: e.target.value } : f))} />
                    <select className="input" style={{ flex: "0 0 120px" }}
                      value={field.type}
                      onChange={(e) => setRegistrationForm(registrationForm.map((f) => f.id === field.id ? { ...f, type: e.target.value, options: [] } : f))}>
                      {["text", "textarea", "dropdown", "checkbox", "number", "email", "file"].map((t) => (
                        <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>
                      ))}
                    </select>
                    <label style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 12, whiteSpace: "nowrap" }}>
                      <input type="checkbox" checked={field.required}
                        onChange={(e) => setRegistrationForm(registrationForm.map((f) => f.id === field.id ? { ...f, required: e.target.checked } : f))} />
                      Required
                    </label>
                    <button type="button" onClick={() => setRegistrationForm(registrationForm.filter((f) => f.id !== field.id))}
                      style={{ background: "none", border: "1px solid #fca5a5", borderRadius: 6, padding: "4px 8px", cursor: "pointer", fontSize: 12, color: "#ef4444" }}>✕</button>
                  </div>
                  {(field.type === "dropdown" || field.type === "checkbox") && (
                    <div style={{ marginTop: 8, marginLeft: 28 }}>
                      <div className="muted" style={{ fontSize: 12, marginBottom: 4 }}>Options (one per line):</div>
                      <textarea className="input" rows={3} placeholder={"Option 1\nOption 2\nOption 3"}
                        value={(field.options || []).join("\n")}
                        onChange={(e) => setRegistrationForm(registrationForm.map((f) => f.id === field.id ? { ...f, options: e.target.value.split("\n") } : f))} />
                    </div>
                  )}
                </div>
              ))}
              <button type="button" className="btn btn-outline" style={{ fontSize: 13 }}
                onClick={() => setRegistrationForm([...registrationForm, {
                  id: `field_${Math.random().toString(36).slice(2, 8)}`,
                  label: "", type: "text", required: false, options: []
                }])}>
                + Add Field
              </button>
            </div>
          )}

          <button className="btn" type="submit">
            Create Draft
          </button>

        </form>
      </div>
    </>
  );
}