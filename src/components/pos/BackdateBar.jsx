/**
 * BackdateBar — toggle สำหรับลงออเดอร์ย้อนหลัง (เลือกวันที่+เวลาได้)
 * ใช้ร่วมกันระหว่าง Cart (desktop) และ MobilePOS (mobile)
 *
 * Props:
 *   backdateAt    : string (datetime-local format "YYYY-MM-DDTHH:mm") | null — null = ไม่ backdate
 *   setBackdateAt : (v: string | null) => void
 *   variant       : "dark" (mobile, default) | "light" (desktop)
 */
export default function BackdateBar({ backdateAt, setBackdateAt, variant = "dark" }) {
  const isDark = variant === "dark";
  const enabled = backdateAt !== null;

  // ค่า default ตอนเปิด toggle = เวลาปัจจุบัน (local)
  const nowLocal = () => {
    const d = new Date();
    d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
    return d.toISOString().slice(0, 16); // "YYYY-MM-DDTHH:mm"
  };

  const wrapStyle = isDark
    ? { padding: "8px 12px", backgroundColor: "#1a0f00", borderBottom: "1px solid #332200" }
    : { background: "rgba(255,159,10,0.12)", borderRadius: 12, padding: "8px 10px", marginBottom: 10 };

  return (
    <div style={wrapStyle}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <button
          onClick={() => setBackdateAt(enabled ? null : nowLocal())}
          style={{
            display: "flex", alignItems: "center", gap: 6,
            background: enabled ? "#FF9F0A" : (isDark ? "#222" : "#eee"),
            color: enabled ? "#000" : (isDark ? "#aaa" : "#666"),
            border: "none", borderRadius: 8, padding: "6px 12px",
            fontSize: 12, fontWeight: "bold", cursor: "pointer", whiteSpace: "nowrap",
          }}
        >
          🕐 {enabled ? "ลงย้อนหลัง" : "ลงย้อนหลัง?"}
        </button>
        {enabled && (
          <input
            type="datetime-local"
            value={backdateAt}
            max={nowLocal()}
            onChange={e => setBackdateAt(e.target.value)}
            style={{
              flex: 1, minWidth: 180, padding: "6px 10px", borderRadius: 8,
              border: isDark ? "1px solid #444" : "1px solid #ddd",
              background: isDark ? "#1a1a1a" : "#fff",
              color: isDark ? "#fff" : "#333",
              fontSize: 13, outline: "none",
            }}
          />
        )}
      </div>
      {enabled && (
        <div style={{ fontSize: 11, color: "#FF9F0A", marginTop: 6 }}>
          ⚠️ บิลนี้จะถูกบันทึกเป็น {new Date(backdateAt).toLocaleString("th-TH", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}
        </div>
      )}
    </div>
  );
}
