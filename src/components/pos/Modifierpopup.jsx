import { useState, useMemo } from "react";

/**
 * ModifierPopup — popup เลือก modifier options
 * ใช้ร่วมกันทั้ง desktop (Products) และ mobile (MobilePOS)
 *
 * Props:
 *   product        : product object (ที่มี modifierGroups)
 *   modifierGroups : all modifier groups array
 *   onConfirm      : (productWithModifier) => void
 *   onClose        : () => void
 *   variant        : "dark" (default) | "light"
 */
export default function ModifierPopup({ product, modifierGroups = [], onConfirm, onClose, variant = "dark" }) {
  const [tempSelection, setTempSelection] = useState([]);

  const activeGroups = useMemo(() =>
    modifierGroups.filter(g => product?.modifierGroups?.includes(g.id)),
    [modifierGroups, product]
  );

  if (!product) return null;

  const toggleModifier = (groupId, opt) => {
    const key = `${groupId}:${opt.id}`;
    setTempSelection(prev =>
      prev.find(s => s.key === key) ? prev.filter(s => s.key !== key) : [...prev, { ...opt, key, groupId }]
    );
  };

  const handleConfirm = () => {
    const totalModPrice = tempSelection.reduce((s, m) => s + Number(m.price), 0);
    onConfirm({
      ...product,
      selectedModifier: tempSelection.length > 0 ? {
        id:    tempSelection.map(m => m.key).sort().join("|"),
        name:  tempSelection.map(m => m.name).join(", "),
        price: totalModPrice,
      } : null,
    });
  };

  const isDark = variant === "dark";

  const overlayStyle = {
    position: "fixed", inset: 0,
    background: isDark ? "rgba(0,0,0,0.85)" : "rgba(0,0,0,0.6)",
    display: "flex", alignItems: "flex-end", zIndex: 3000,
  };

  const modalStyle = {
    background: isDark ? "#1a1a1a" : "#fff",
    borderRadius: "20px 20px 0 0",
    padding: 24, width: "100%", maxHeight: "85vh",
    display: "flex", flexDirection: "column",
    borderTop: isDark ? "1px solid #333" : "1px solid #e0e0e0",
  };

  const optBtnStyle = (isSelected) => ({
    padding: "10px 16px", borderRadius: 10, fontSize: 14, cursor: "pointer",
    color: isDark ? "#fff" : (isSelected ? "#fff" : "#333"),
    border: isSelected ? "2px solid #4caf50" : (isDark ? "1px solid #444" : "1px solid #ddd"),
    background: isSelected
      ? (isDark ? "#1a3a1a" : "#4caf50")
      : (isDark ? "#222" : "#f5f5f5"),
    transition: "all 0.1s",
  });

  return (
    <div style={overlayStyle} onClick={onClose}>
      <div style={modalStyle} onClick={e => e.stopPropagation()}>
        {/* header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <h3 style={{ margin: 0, color: isDark ? "#fff" : "#213547" }}>{product.name}</h3>
          <button onClick={onClose}
            style={{ background: "none", border: "none", color: isDark ? "#888" : "#999", fontSize: 24, cursor: "pointer", lineHeight: 1 }}>
            ✕
          </button>
        </div>

        {/* options */}
        <div style={{ overflowY: "auto", flex: 1 }}>
          {activeGroups.map(group => (
            <div key={group.id} style={{ marginBottom: 20 }}>
              <div style={{ fontSize: 13, color: isDark ? "#888" : "#999", marginBottom: 10, textTransform: "uppercase", letterSpacing: 1, fontWeight: "bold" }}>
                {group.name}
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {(group.options || []).map(opt => {
                  const key = `${group.id}:${opt.id}`;
                  const isSelected = tempSelection.some(s => s.key === key);
                  return (
                    <button key={opt.id} onClick={() => toggleModifier(group.id, opt)} style={optBtnStyle(isSelected)}>
                      {opt.name}
                      {opt.price > 0 && (
                        <span style={{ color: isSelected ? (isDark ? "#4caf50" : "#fff") : "#4caf50" }}> +฿{opt.price}</span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        {/* confirm */}
        <button
          onClick={handleConfirm}
          style={{ width: "100%", padding: 16, borderRadius: 12, border: "none", backgroundColor: "#4caf50", color: "#000", fontWeight: "bold", fontSize: 16, cursor: "pointer", marginTop: 16 }}>
          ✓ เพิ่มลงตะกร้า
        </button>
      </div>
    </div>
  );
}
