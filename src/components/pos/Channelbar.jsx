/**
 * ChannelBar — แถบเลือก POS / Grab / Lineman / Shopee
 * ใช้ร่วมกันระหว่าง Cart (desktop) และ MobilePOS (mobile)
 *
 * Props:
 *   priceChannel  : "pos" | "grab" | "lineman" | "shopee"
 *   setPriceChannel : (ch: string) => void
 *   variant       : "dark" (mobile, default) | "light" (desktop)
 */
export default function ChannelBar({ priceChannel, setPriceChannel, variant = "dark" }) {
  const isDark = variant === "dark";

  const CHANNELS = [
    { key: "pos",     label: "POS",      color: isDark ? "#4a4a4a" : "#444"   },
    { key: "grab",    label: "Grab",     color: "#00B14F"                     },
    { key: "lineman", label: "Lineman",  color: "#00A84F"                     },
    { key: "shopee",  label: "Shopee",   color: "#EE4D2D"                     },
  ];

  const wrapStyle = isDark
    ? { display: "flex", padding: "8px 12px", gap: 8, backgroundColor: "#000", borderBottom: "1px solid #333" }
    : { display: "flex", gap: 10, alignItems: "center" };

  const btnStyle = (ch) => {
    const isActive = priceChannel === ch.key;
    if (isDark) {
      return {
        flex: 1, padding: "10px 0", borderRadius: 10,
        color: "#fff", fontSize: 12, fontWeight: "bold", cursor: "pointer",
        background: isActive ? ch.color : "#262626",
        border: isActive ? "2px solid #fff" : "2px solid transparent",
        opacity: isActive ? 1 : 0.6,
        transition: "all 0.15s",
      };
    }
    // light (desktop)
    return {
      padding: "6px 18px", borderRadius: 20, border: "none",
      background: isActive ? ch.color : "#262626",
      color: "#fff", cursor: "pointer", fontSize: 12,
      fontWeight: isActive ? "bold" : "normal",
      transition: "all 0.15s",
    };
  };

  return (
    <div style={wrapStyle}>
      {CHANNELS.map(ch => (
        <button key={ch.key} onClick={() => setPriceChannel(ch.key)} style={btnStyle(ch)}>
          {ch.label}
        </button>
      ))}
    </div>
  );
}
