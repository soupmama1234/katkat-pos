import React, { useMemo } from "react";

export default function Dashboard({ orders = [], setOrders, onCloseDay, onUpdateActual }) {

  const getChannelColor = (ch) => {
    const colors = { pos: "#ffffff", grab: "#00B14F", lineman: "#00A84F", shopee: "#EE4D2D" };
    return colors[ch] || "#888";
  };

  const pendingOrders = orders.filter(o =>
    !o.isSettled && ["grab", "lineman", "shopee"].includes(o.channel)
  );

  const handleUpdateActual = (orderId, value) => {
    const amount = parseFloat(value) || 0;
    if (onUpdateActual) {
      onUpdateActual(orderId, amount);
    } else if (setOrders) {
      setOrders(orders.map(o =>
        o.id === orderId ? { ...o, actualAmount: amount, isSettled: true } : o
      ));
    }
  };

  const exportToCSV = (data, fileName) => {
    if (!data || data.length === 0) return alert("ไม่มีข้อมูลให้ Export ครับ");
    const headers = ["วันที่/เวลา", "เลขอ้างอิง", "ช่องทาง", "รายการสินค้า", "ยอดรวมเมนู", "ยอดรับจริง", "ประเภทชำระเงิน"];
    const rows = data.map(o => {
      const itemsSummary = o.items.map(i => `${i.name}x${i.qty}`).join(" | ");
      return [
        new Date(o.time).toLocaleString("th-TH"),
        `"${o.refId || "-"}"`,
        o.channel.toUpperCase(),
        `"${itemsSummary}"`,
        o.total,
        o.actualAmount || 0,
        o.payment === "cash" ? "เงินสด" : "โอน/App"
      ];
    });
    const csvContent = "\uFEFF" + [headers, ...rows].map(e => e.join(",")).join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `${fileName}_${new Date().toLocaleDateString()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const stats = useMemo(() => {
    let totalSales = 0, cashTotal = 0, promptPayTotal = 0, actualIncome = 0;
    // แยก cash/transfer แต่ละ channel
    const channelMap = {};

    orders.forEach(o => {
      totalSales += o.total;
      actualIncome += (o.actualAmount || 0);

      if (!channelMap[o.channel]) {
        channelMap[o.channel] = { total: 0, actual: 0, cash: 0, transfer: 0 };
      }
      channelMap[o.channel].total += o.total;
      channelMap[o.channel].actual += (o.actualAmount || 0);

      if (o.payment === "cash") {
        cashTotal += (o.actualAmount || 0);
        channelMap[o.channel].cash += (o.actualAmount || 0);
      } else {
        // promptpay / transfer ทั้งหมด
        promptPayTotal += (o.actualAmount || 0);
        channelMap[o.channel].transfer += (o.actualAmount || 0);
      }
    });

    return { totalSales, cashTotal, promptPayTotal, actualIncome, channelMap, orderCount: orders.length };
  }, [orders]);

  const formatTime = (timeStr) => {
    if (!timeStr) return "N/A";
    try {
      const d = new Date(timeStr);
      if (isNaN(d.getTime())) return "N/A";
      return d.toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" });
    } catch { return "N/A"; }
  };

  const todayStr = new Date().toLocaleDateString("th-TH", {
    day: "numeric", month: "short", year: "numeric"
  });

  return (
    <div style={{ padding: "16px", color: "#fff", backgroundColor: "#121212", minHeight: "100vh", boxSizing: "border-box" }}>

      {/* Header */}
      <div style={{ marginBottom: "16px" }}>
        <h2 style={{ margin: "0 0 2px 0", fontSize: "20px" }}>LIVE DASHBOARD</h2>
        <p style={{ color: "#666", margin: "0 0 12px 0", fontSize: "12px" }}>{todayStr}</p>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
          <button onClick={() => exportToCSV(orders, "Daily_Backup")} style={s.btnExport}>
            📥 สำรอง CSV
          </button>
          <button onClick={onCloseDay} style={s.btnCloseDay}>
            🏁 ปิดยอดวัน
          </button>
        </div>
      </div>

      {/* Stats 2x2 */}
      <div style={s.statsGrid}>
        <div style={{ ...s.card, borderTop: "3px solid #ff9800" }}>
          <div style={s.cardLabel}>ออเดอร์วันนี้</div>
          <div style={{ ...s.cardValue, color: "#ff9800" }}>
            {stats.orderCount}
            <span style={{ fontSize: "13px", fontWeight: "normal" }}> บิล</span>
          </div>
        </div>
        <div style={s.card}>
          <div style={s.cardLabel}>ยอดรวม</div>
          <div style={{ ...s.cardValue, fontSize: "20px" }}>฿{stats.totalSales.toLocaleString()}</div>
        </div>
        <div style={{ ...s.card, borderTop: "3px solid #4caf50" }}>
          <div style={s.cardLabel}>💵 เงินสด</div>
          <div style={{ ...s.cardValue, color: "#4caf50", fontSize: "20px" }}>฿{stats.cashTotal.toLocaleString()}</div>
        </div>
        <div style={{ ...s.card, borderTop: "3px solid #2196f3" }}>
          <div style={s.cardLabel}>📱 โอน/App</div>
          <div style={{ ...s.cardValue, color: "#2196f3", fontSize: "20px" }}>฿{stats.promptPayTotal.toLocaleString()}</div>
        </div>
      </div>

      {/* Channel breakdown — BUG#4: แสดง cash/transfer แยกใต้แต่ละ channel */}
      {Object.keys(stats.channelMap).length > 0 && (
        <div style={s.panel}>
          <div style={s.panelTitle}>สัดส่วนรายได้แยกช่องทาง</div>
          {Object.entries(stats.channelMap).map(([ch, data]) => {
            const color = getChannelColor(ch);
            const pct = stats.actualIncome > 0 ? (data.actual / stats.actualIncome) * 100 : 0;
            return (
              <div key={ch} style={{ marginBottom: "18px" }}>
                {/* ชื่อ channel + ยอดรวม */}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "5px" }}>
                  <div>
                    <span style={{ color, fontWeight: "bold", fontSize: "14px" }}>{ch.toUpperCase()}</span>
                    {/* BUG#4 FIX: แสดง cash/transfer breakdown เฉพาะ POS */}
                    {ch === "pos" && (
                      <div style={{ display: "flex", gap: "10px", marginTop: "3px" }}>
                        {data.cash > 0 && (
                          <span style={{ fontSize: "11px", color: "#4caf50" }}>
                            💵 ฿{data.cash.toLocaleString()}
                          </span>
                        )}
                        {data.transfer > 0 && (
                          <span style={{ fontSize: "11px", color: "#2196f3" }}>
                            📱 ฿{data.transfer.toLocaleString()}
                          </span>
                        )}
                        {data.cash === 0 && data.transfer === 0 && (
                          <span style={{ fontSize: "11px", color: "#444" }}>ยังไม่มียอด</span>
                        )}
                      </div>
                    )}
                  </div>
                  <span style={{ fontSize: "14px" }}>฿{data.actual.toLocaleString()}</span>
                </div>
                <div style={s.barBg}>
                  <div style={{ ...s.barFill, width: `${pct}%`, backgroundColor: color }} />
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* งานค้าง */}
      <div style={s.panel}>
        <div style={{ ...s.panelTitle, color: "#ffa500", marginBottom: "12px" }}>
          ⚠️ งานค้าง: รอระบุยอดรับจริง ({pendingOrders.length})
        </div>
        {pendingOrders.length === 0 ? (
          <div style={{ color: "#444", textAlign: "center", padding: "20px 0", fontSize: "13px" }}>
            🎉 เคลียร์ยอดครบแล้ว
          </div>
        ) : (
          pendingOrders.map(o => (
            <div key={o.id} style={s.pendingRow}>
              <div style={{ flex: 1, minWidth: 0, marginRight: "8px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "6px", flexWrap: "wrap", marginBottom: "3px" }}>
                  <span style={{ color: getChannelColor(o.channel), fontWeight: "bold", fontSize: "13px" }}>
                    {o.channel.toUpperCase()}
                  </span>
                  {o.refId && <span style={s.refBadge}>{o.refId}</span>}
                </div>
                <div style={{ color: "#666", fontSize: "11px" }}>
                  {formatTime(o.time)} · ฿{o.total.toLocaleString()}
                </div>
              </div>
              <div style={{ display: "flex", gap: "6px", alignItems: "center", flexShrink: 0 }}>
                <input
                  type="number"
                  inputMode="numeric"
                  placeholder="ยอด"
                  id={`inp-${o.id}`}
                  style={s.miniInput}
                />
                <button
                  onClick={() => {
                    const val = document.getElementById(`inp-${o.id}`)?.value;
                    if (val) handleUpdateActual(o.id, val);
                  }}
                  style={s.miniBtn}
                >
                  ✓
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

const s = {
  statsGrid: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px", marginBottom: "16px" },
  card: { backgroundColor: "#1a1a1a", padding: "14px", borderRadius: "12px", border: "1px solid #2a2a2a", minWidth: 0 },
  cardLabel: { color: "#888", fontSize: "12px", marginBottom: "6px" },
  cardValue: { fontSize: "24px", fontWeight: "bold", lineHeight: 1.2 },
  panel: { backgroundColor: "#1a1a1a", padding: "16px", borderRadius: "12px", border: "1px solid #2a2a2a", marginBottom: "16px" },
  panelTitle: { fontSize: "13px", color: "#888", marginBottom: "16px" },
  barBg: { width: "100%", height: "8px", backgroundColor: "#000", borderRadius: "4px", overflow: "hidden" },
  barFill: { height: "100%", transition: "width 0.5s ease", borderRadius: "4px" },
  pendingRow: { display: "flex", alignItems: "center", padding: "10px", backgroundColor: "#0a0a0a", borderRadius: "8px", marginBottom: "8px", border: "1px solid #222" },
  miniInput: { width: "70px", background: "#1a1a1a", color: "#fff", border: "1px solid #444", padding: "8px 6px", borderRadius: "6px", fontSize: "14px", textAlign: "center" },
  miniBtn: { background: "#4caf50", color: "#000", border: "none", padding: "8px 12px", borderRadius: "6px", cursor: "pointer", fontWeight: "bold", fontSize: "16px" },
  btnExport: { backgroundColor: "#2a2a2a", color: "#fff", border: "1px solid #444", padding: "12px", borderRadius: "10px", cursor: "pointer", fontWeight: "bold", fontSize: "13px" },
  btnCloseDay: { backgroundColor: "#f57c00", color: "#fff", border: "none", padding: "12px", borderRadius: "10px", cursor: "pointer", fontWeight: "bold", fontSize: "13px" },
  refBadge: { backgroundColor: "#222", color: "#aaa", padding: "2px 6px", borderRadius: "4px", fontSize: "11px", border: "1px solid #333" },
};
