/**
 * DeliveryRefInput — ช่องกรอกเลขอ้างอิง Delivery
 * จัดการ GF- prefix, Lineman 4-digit, Shopee free text
 * ใช้ร่วมกันระหว่าง Cart (desktop) และ MobilePOS (mobile)
 *
 * Props:
 *   priceChannel  : "grab" | "lineman" | "shopee"
 *   deliveryRef   : string  (state ใน App)
 *   setDeliveryRef: (v: string) => void
 *   variant       : "dark" (mobile, default) | "light" (desktop)
 *   autoFocus     : boolean (default true)
 */
export default function DeliveryRefInput({
  priceChannel,
  deliveryRef = "",
  setDeliveryRef,
  variant = "dark",
  autoFocus = true,
}) {
  const isDark = variant === "dark";

  // ── Validation / formatting per channel ──
  const handleChange = (raw) => {
    if (priceChannel === "grab") {
      // max 3 digits
      const digits = raw.replace(/\D/g, "").slice(0, 3);
      setDeliveryRef("GF-" + digits);
    } else if (priceChannel === "lineman") {
      // max 4 digits
      setDeliveryRef(raw.replace(/\D/g, "").slice(0, 4));
    } else {
      setDeliveryRef(raw);
    }
  };

  // ค่าที่แสดงใน input (ตัด prefix GF- ออกเพราะแสดงแยก)
  const inputValue = priceChannel === "grab" ? deliveryRef.replace("GF-", "") : deliveryRef;

  // ── Styles ──
  const wrapStyle = isDark
    ? { padding: "8px 12px", backgroundColor: "#111", borderBottom: "1px solid #222" }
    : { background: "rgba(255,255,255,0.9)", borderRadius: 12, padding: "10px 12px", marginBottom: 10 };
  const labelStyle = isDark
    ? { fontSize: 11, color: "#888", fontWeight: "bold", marginBottom: 6, textTransform: "uppercase", letterSpacing: 0.5 }
    : { fontSize: 11, color: "#213547", fontWeight: "bold", marginBottom: 6, textTransform: "uppercase", letterSpacing: 0.5 };
  const innerWrapStyle = isDark
    ? { display: "flex", alignItems: "center", background: "#1a1a1a", borderRadius: 10, border: "1px solid #333", overflow: "hidden" }
    : { display: "flex", alignItems: "center", background: "#fff", borderRadius: 8, border: "1px solid #ddd", overflow: "hidden" };
  const prefixStyle = isDark
    ? { padding: "0 10px", color: "#00B14F", fontWeight: "bold", fontSize: 16, borderRight: "1px solid #333", whiteSpace: "nowrap" }
    : { padding: "0 10px", color: "#00B14F", fontWeight: "bold", fontSize: 15, borderRight: "1px solid #ddd", whiteSpace: "nowrap" };
  const inputStyle = isDark
    ? { flex: 1, background: "transparent", border: "none", color: "#fff", fontSize: 16, padding: "10px 12px", outline: "none" }
    : { flex: 1, padding: "10px 12px", border: "none", outline: "none", fontSize: 16, color: "#333" };

  const channelLabel = { grab: "GrabFood", lineman: "LINE MAN", shopee: "ShopeeFood" }[priceChannel] || priceChannel.toUpperCase();

  return (
    <div style={wrapStyle}>
      <div style={labelStyle}>📋 เลขอ้างอิง {channelLabel}</div>
      <div style={innerWrapStyle}>
        {priceChannel === "grab" && (
          <span style={prefixStyle}>GF-</span>
        )}
        <input
          type="text"
          inputMode="numeric"
          placeholder={priceChannel === "lineman" ? "เลข 4 หลัก" : priceChannel === "grab" ? "เลข 3 หลัก" : "ระบุเลขอ้างอิง"}
          value={inputValue}
          onChange={e => handleChange(priceChannel === "grab" ? "GF-" + e.target.value : e.target.value)}
          style={inputStyle}
          autoFocus={autoFocus}
        />
      </div>
    </div>
  );
}
