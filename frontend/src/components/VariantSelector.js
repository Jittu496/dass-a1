import React from "react";

// Simple variant selector
export default function VariantSelector({ variants = [], selectedId, onSelect, quantity, setQuantity }) {
  if (!variants || variants.length === 0) return null;

  const selected = (variants || []).find((v) => String(v.id) === String(selectedId)) || variants[0];

  return (
    <div className="card" style={{ marginBottom: 12 }}>
      <h4>Choose Variant</h4>
      <div className="field">
        <select className="input" value={selected?.id || ""} onChange={(e) => onSelect(e.target.value)}>
          {(variants || []).map((v) => (
            <option key={v.id} value={v.id}>{v.name || `${v.size || ""} ${v.color || ""}`}</option>
          ))}
        </select>
      </div>

      {selected && (
        <div className="tiny muted">
          <div>Price: {selected.price != null ? selected.price : "N/A"}</div>
          <div>Stock: {selected.stock != null ? selected.stock : "N/A"}</div>
          <div>Per participant limit: {selected.perParticipantLimit != null ? selected.perParticipantLimit : "Unlimited"}</div>
        </div>
      )}

      <div className="field" style={{ marginTop: 8 }}>
        <input className="input" type="number" min={1} value={quantity} onChange={(e) => setQuantity(Number(e.target.value))} />
      </div>
    </div>
  );
}
