import React, { useMemo } from "react";

export default function Dashboard({ orders, setOrders, onCloseDay }) {
  
  const getChannelColor = (ch) => {
    const colors = { pos: "#ffffff", grab: "#00B14F", lineman: "#00A84F", shopee: "#EE4D2D" };
    return colors[ch] || "#888";
  };

  const handleUpdateActual = (orderId, value) => {
    const amount = parseFloat(value) || 0;
    const updated = orders.map(o =>
      o.id === orderId ? { ...o, actualAmount: amount, isSettled: true } : o
    );
    setOrders(updated);
  };

  const exportToCSV = (data, fileName) => {
    if (!data || data.length === 0) return alert("ไม่มีข้อมูลให้ Export ครับ");
    const headers = ["วันที่/เวลา", "เลขอ้างอิง", "ช่องทาง", "รายการสินค้า", "ยอดรวมเมนู", "ยอดรับจริง", "ประเภทชำระเงิน"];
    const rows = data.map(o => {
      // BUG#4 FIX: i.quantity → i.qty (ตรงกับ field ที่ใช้จริงใน cart)
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
    link.setAttribute("href", url);
    link.setAttribute("download", `${fileName}_${new Date().toLocaleDateString()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const stats = useMemo(() => {
    let totalSales = 0;
    let cashTotal = 0;
    let promptPayTotal = 0;
    let actualIncome = 0;
    let orderCount = orders.length;
    const channelMap = {};

    orders.forEach(o => {
      totalSales += o.total;
      actualIncome += (o.actualAmount || 0);
      if (o.payment === "cash") cashTotal += (o.actualAmount || 0);
      if (o.payment === "promptpay" || o.payment === "transfer") promptPayTotal += (o.actualAmount || 0);
      if (!channelMap[o.channel]) channelMap[o.channel] = { total: 0, actual: 0, cash: 0, promptpay: 0 };
      channelMap[o.channel].total += o.total;
      channelMap[o.channel].actual += (o.actualAmount || 0);
      if (o.payment === "cash") channelMap[o.channel].cash += (o.actualAmount || 0);
      else channelMap[o.channel].promptpay += (o.actualAmount || 0);
    });

    return { totalSales, cashTotal, promptPayTotal, actualIncome, channelMap, orderCount };
  }, [orders]);

  return (
    <div style={{ padding: "24px", color: "#fff", backgroundColor: "#121212", minHeight: "100vh" }}>
      
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "30px" }}>
        <div>
          <h2 style={{ margin: 0, fontSize: "28px", letterSpacing: "1px" }}>LIVE DASHBOARD</h2>
          <p style={{ color: "#666", margin: "5px 0 0 0" }}>สรุปยอดการขายประจำวันที่ {new Date().toLocaleDateString("th-TH")}</p>
        </div>
        <div style={{ display: "flex", gap: "12px" }}>
          <button onClick={() => exportToCSV(orders, "Daily_Backup")} style={styles.btnExport}>
            📥 สำรองข้อมูลไฟล์ CSV
          </button>
          <button onClick={onCloseDay} style={styles.btnCloseDay}>
            🏁 ปิดยอดวัน & เคลียร์หน้าจอ
          </button>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "15px", marginBottom: "30px" }}>
        <div style={{ ...styles.card, borderTop: "4px solid #ff9800" }}>
          <div style={styles.cardLabel}>ออเดอร์วันนี้</div>
          <div style={{ ...styles.cardValue, color: "#ff9800" }}>{stats.orderCount} <span style={{ fontSize: "14px" }}>บิล</span></div>
        </div>
        <div style={styles.card}>
          <div style={styles.cardLabel}>ยอดรวมเมนู</div>
          <div style={styles.cardValue}>฿{stats.totalSales.toLocaleString()}</div>
        </div>
        <div style={{ ...styles.card, borderTop: "4px solid #4caf50" }}>
          <div style={styles.cardLabel}>เงินสดในลิ้นชัก</div>
          <div style={{ ...styles.cardValue, color: "#4caf50" }}>฿{stats.cashTotal.toLocaleString()}</div>
        </div>
        <div style={{ ...styles.card, borderTop: "4px solid #2196f3" }}>
          <div style={styles.cardLabel}>ยอดโอน/App</div>
          <div style={{ ...styles.cardValue, color: "#2196f3" }}>฿{stats.promptPayTotal.toLocaleString()}</div>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1.2fr 0.8fr", gap: "25px" }}>
        <div style={styles.panel}>
          <h4 style={styles.panelTitle}>สัดส่วนรายได้จริงแยกตามช่องทาง</h4>
          {Object.entries(stats.channelMap).map(([ch, data]) => {
            const color = getChannelColor(ch);
            const percentage = stats.actualIncome > 0 ? (data.actual / stats.actualIncome) * 100 : 0;
            return (
              <div key={ch} style={{ marginBottom: "25px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "10px" }}>
                  <span style={{ color, fontWeight: "bold", fontSize: "16px" }}>{ch.toUpperCase()}</span>
                  <span style={{ fontSize: "16px" }}>฿{data.actual.toLocaleString()}</span>
                </div>
                <div style={styles.barBg}>
                  <div style={{ ...styles.barFill, width: `${percentage}%`, backgroundColor: color }} />
                </div>
              </div>
            );
          })}
          {Object.keys(stats.channelMap).length === 0 && (
            <div style={{ color: "#444", textAlign: "center", padding: "40px 0" }}>ยังไม่มีข้อมูลการขาย</div>
          )}
        </div>

        <div style={styles.panel}>
          <h4 style={{ color: "#ffa500", margin: "0 0 20px 0", fontSize: "16px" }}>⚠️ งานค้าง: รอระบุยอดรับจริง</h4>
          <div style={{ maxHeight: "400px", overflowY: "auto" }}>
            {orders.filter(o => !o.isSettled).map(o => (
              <div key={o.id} style={styles.pendingRow}>
                <div style={{ flex: 1 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <span style={{ color: getChannelColor(o.channel), fontWeight: "bold" }}>{o.channel.toUpperCase()}</span>
                    <span style={styles.refBadge}>{o.refId || "N/A"}</span>
                  </div>
                  <div style={{ color: "#888", fontSize: "12px", marginTop: "4px" }}>
                    {new Date(o.time).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} • ฿{o.total}
                  </div>
                </div>
                <div style={{ display: "flex", gap: "8px" }}>
                  <input type="number" placeholder="ยอด" id={`inp-${o.id}`} style={styles.miniInput} />
                  <button
                    onClick={() => {
                      const val = document.getElementById(`inp-${o.id}`).value;
                      if (val) handleUpdateActual(o.id, val);
                    }}
                    style={styles.miniBtn}
                  >
                    บันทึก
                  </button>
                </div>
              </div>
            ))}
            {orders.filter(o => !o.isSettled).length === 0 && (
              <div style={{ color: "#444", textAlign: "center", padding: "40px 0" }}>
                🎉 เคลียร์ยอดครบทุกรายการแล้ว
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

const styles = {
  card: { backgroundColor: "#1a1a1a", padding: "20px", borderRadius: "12px", border: "1px solid #333" },
  cardLabel: { color: "#888", fontSize: "13px", marginBottom: "8px" },
  cardValue: { fontSize: "28px", fontWeight: "bold" },
  panel: { backgroundColor: "#1a1a1a", padding: "25px", borderRadius: "16px", border: "1px solid #333" },
  panelTitle: { margin: "0 0 25px 0", fontSize: "15px", color: "#888", fontWeight: "normal" },
  barBg: { width: "100%", height: "10px", backgroundColor: "#000", borderRadius: "5px", overflow: "hidden" },
  barFill: { height: "100%", transition: "width 0.6s cubic-bezier(0.4, 0, 0.2, 1)" },
  pendingRow: { display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px", backgroundColor: "#000", borderRadius: "10px", marginBottom: "10px", border: "1px solid #222" },
  miniInput: { width: "70px", background: "#1a1a1a", color: "#fff", border: "1px solid #444", padding: "6px", borderRadius: "6px", fontSize: "13px" },
  miniBtn: { background: "#4caf50", color: "#000", border: "none", padding: "6px 12px", borderRadius: "6px", cursor: "pointer", fontWeight: "bold", fontSize: "12px" },
  btnExport: { backgroundColor: "#333", color: "#fff", border: "1px solid #444", padding: "10px 18px", borderRadius: "10px", cursor: "pointer", fontWeight: "bold", fontSize: "14px" },
  btnCloseDay: { backgroundColor: "#f57c00", color: "#fff", border: "none", padding: "10px 18px", borderRadius: "10px", cursor: "pointer", fontWeight: "bold", fontSize: "14px", boxShadow: "0 4px 15px rgba(245,124,0,0.3)" },
  refBadge: { backgroundColor: "#222", color: "#aaa", padding: "2px 8px", borderRadius: "5px", fontSize: "11px", border: "1px solid #333" }
};