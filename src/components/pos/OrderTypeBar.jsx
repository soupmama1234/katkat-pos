/**
 * OrderTypeBar — ปุ่มเลือก ทานที่ร้าน / กลับบ้าน + ช่องเลขโต๊ะ
 * ใช้ร่วมกันระหว่าง Cart (desktop) และ MobilePOS (mobile)
 *
 * Props:
 *   orderType     : "dine_in" | "takeaway"
 *   setOrderType  : (type: string) => void
 *   tableNumber   : string
 *   setTableNumber: (v: string) => void
 *   variant       : "dark" (mobile, default) | "light" (desktop)
 */
export default function OrderTypeBar({ orderType, setOrderType, tableNumber, setTableNumber, variant = "dark" }) {
  const isDark = variant === "dark";

  const wrapStyle = isDark
    ? { display: "flex", padding: "8px 12px", gap: 8, backgroundColor: "#0d0d0d", borderBottom: "1px solid #222", alignItems: "center" }
    : { display: "flex", gap: 6, alignItems: "center", background: "rgba(255,255,255,0.9)", borderRadius: 12, padding: "8px 10px", marginBottom: 10 };

  const OPTIONS = [
    { key: "dine_in",  label: "🍽️ ทานที่ร้าน" },
    { key: "takeaway", label: "🛍️ กลับบ้าน"  },
  ];

  const btnStyle = (key) => {
    const isActive = orderType === key;
    if (isDark) {
      return {
        flex: 1, padding: "8px 0", borderRadius: 10, fontSize: 13, cursor: "pointer",
        transition: "all 0.15s",
        backgroundColor: isActive ? "#fff" : "#222",
        color:           isActive ? "#000" : "#aaa",
        border:          isActive ? "2px solid #fff" : "2px solid transparent",
        fontWeight:      isActive ? "bold" : "normal",
      };
    }
    // light (desktop)
    return {
      flex: 1, padding: "8px 0", borderRadius: 8, border: "none", fontSize: 13,
      cursor: "pointer", transition: "all 0.15s",
      background: isActive ? "#213547" : "#f0f0f0",
      color:      isActive ? "#fff"    : "#555",
      fontWeight: isActive ? "bold"    : "normal",
    };
  };

  const inputStyle = isDark
    ? { width: 60, background: "#222", border: "1px solid #444", borderRadius: 8, color: "#fff", padding: "6px 8px", fontSize: 14, textAlign: "center", outline: "none" }
    : { width: 80, padding: "7px 8px", borderRadius: 8, border: "1.5px solid #213547", fontSize: 14, textAlign: "center", outline: "none", color: "#213547", fontWeight: "bold", background: "#fff" };

  return (
    <div style={wrapStyle}>
      {OPTIONS.map(({ key, label }) => (
        <button
          key={key}
          onClick={() => { setOrderType(key); if (key === "takeaway") setTableNumber(""); }}
          style={btnStyle(key)}
        >
          {label}
        </button>
      ))}
      {orderType === "dine_in" && (
        <input
          type="text" inputMode="numeric" placeholder="โต๊ะ"
          value={tableNumber} onChange={e => setTableNumber(e.target.value)}
          maxLength={4} style={inputStyle}
        />
      )}
    </div>
  );
}
