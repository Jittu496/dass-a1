import React, { useState, useEffect } from "react";

// Simple dynamic form renderer
// schema: [{ id, label, type, required, options }] where type in (text, textarea, select, checkbox, number, email)
export default function DynamicForm({ schema = [], initial = {}, onChange }) {
  const [values, setValues] = useState(() => ({ ...initial }));

  useEffect(() => {
    setValues({ ...initial });
  }, [initial]);

  useEffect(() => {
    if (onChange) onChange(values);
  }, [values, onChange]);

  const set = (id, val) => setValues((s) => ({ ...s, [id]: val }));

  if (!schema || schema.length === 0) return null;

  return (
    <div className="card" style={{ marginBottom: 12 }}>
      <h4>Additional Registration Info</h4>
      {schema.map((f) => (
        <div className="field" key={f.id}>
          <label style={{ display: "block", marginBottom: 6 }}>
            {f.label} {f.required ? <span style={{ color: "#c00" }}>*</span> : null}
          </label>

          {f.type === "textarea" ? (
            <textarea className="input" value={values[f.id] || ""} onChange={(e) => set(f.id, e.target.value)} />
          ) : f.type === "select" ? (
            <select className="input" value={values[f.id] || ""} onChange={(e) => set(f.id, e.target.value)}>
              <option value="">-- select --</option>
              {(f.options || []).map((o) => (
                <option key={o} value={o}>{o}</option>
              ))}
            </select>
          ) : f.type === "checkbox" ? (
            <label style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
              <input type="checkbox" checked={!!values[f.id]} onChange={(e) => set(f.id, e.target.checked)} />
              <span className="tiny">{f.hint || ""}</span>
            </label>
          ) : (
            <input
              className="input"
              type={f.type === "number" ? "number" : f.type === "email" ? "email" : "text"}
              value={values[f.id] || ""}
              onChange={(e) => set(f.id, e.target.value)}
            />
          )}
        </div>
      ))}
    </div>
  );
}
