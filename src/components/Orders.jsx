import React from "react";

export default function Orders({ orders = [], onDeleteOrder, onClearAll }) {
  // ฟังก์ชันช่วยเลือกสีตามช่องทาง
  const getChannelStyle = (channel) => {
    switch (channel) {
      case "grab": return { color: "#00B14F", bg: "#e6f7ee" };
      case "lineman": return { color: "#00A84F", bg: "#e6f6ee" };
      case "shopee": return { color: "#EE4D2D", bg: "#fef1ed" };
      default: return { color: "#213547", bg: "#f0f2f5" };
    }
  };

  const handleClearRequest = () => {
    const confirmBox = window.confirm("⚠️ คุณต้องการลบประวัติการขายทั้งหมดใช่หรือไม่? (ข้อมูลจะหายถาวร)");
    if (confirmBox) {
      onClearAll();
    }
  };

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <div style={{ display: "flex", alignItems: "center", gap: "15px" }}>
          <h2 style={{ margin: 0 }}>ประวัติการขาย</h2>
          <span style={styles.countBadge}>ทั้งหมด {orders.length} รายการ</span>
        </div>
        
        {orders.length > 0 && (
          <button onClick={handleClearRequest} style={styles.btnClearAll}>
            ล้างประวัติทั้งหมด
          </button>
        )}
      </div>

      <div style={styles.list}>
        {orders.length === 0 ? (
          <div style={styles.empty}>ยังไม่มีประวัติการขาย</div>
        ) : (
          orders.map((order) => {
            const style = getChannelStyle(order.channel);
            return (
              <div key={order.id} style={styles.orderCard}>
                <div style={styles.cardHeader}>
                  <div style={{ display: "flex", flexDirection: "column", gap: "5px" }}>
                    <div style={{ display: "flex", alignItems: "center" }}>
                      <span style={{ ...styles.channelBadge, color: style.color, backgroundColor: style.bg }}>
                        {order.channel?.toUpperCase()}
                      </span>
                      {/* --- แสดงเลข Reference ตรงนี้ --- */}
                      {order.refId && (
                        <span style={styles.refBadge}>
                          #{order.refId}
                        </span>
                      )}
                    </div>
                    <span style={styles.time}>
                      {new Date(order.time).toLocaleString('th-TH', { hour: '2-digit', minute: '2-digit' })} น.
                    </span>
                  </div>
                  
                  <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                    <div style={styles.orderId}>ID: {order.id.toString().slice(-6)}</div>
                    <button 
                      onClick={() => onDeleteOrder(order.id)} 
                      style={styles.btnDelete}
                      title="ลบรายการนี้"
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#ff4444" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M3 6h18"></path>
                        <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"></path>
                        <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"></path>
                      </svg>
                    </button>
                  </div>
                </div>

                <div style={styles.itemList}>
                  {order.items.map((item, idx) => (
                    <div key={idx} style={styles.item}>
                      <span>{item.name} {item.selectedModifier && <small style={{color: '#888'}}>({item.selectedModifier.name})</small>}</span>
                      <span>x{item.qty}</span>
                    </div>
                  ))}
                </div>

                <div style={styles.cardFooter}>
                  <div style={styles.paymentInfo}>
                    <span>วิธีจ่าย: {order.payment === 'cash' ? '💵 เงินสด' : '📱 โอน/แอป'}</span>
                    <span style={{ 
                      color: order.isSettled ? "#4caf50" : "#ff9800",
                      fontWeight: "bold"
                    }}>
                      {order.isSettled ? "● ตรวจสอบแล้ว" : "○ รอใส่ยอดจริง"}
                    </span>
                  </div>
                  <div style={styles.priceInfo}>
                    <div style={styles.totalLabel}>ยอดบิล: ฿{order.total.toLocaleString()}</div>
                    <div style={styles.actualLabel}>รับจริง: ฿{order.actualAmount?.toLocaleString() || 0}</div>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

const styles = {
  container: { padding: "20px", backgroundColor: "#1a1a1a", minHeight: "100vh", color: "#fff" },
  header: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" },
  countBadge: { backgroundColor: "#333", padding: "5px 12px", borderRadius: "20px", fontSize: "14px" },
  btnClearAll: { backgroundColor: "transparent", color: "#ff4444", border: "1px solid #ff4444", padding: "6px 12px", borderRadius: "8px", cursor: "pointer", fontSize: "13px", fontWeight: "bold" },
  list: { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: "15px" },
  orderCard: { backgroundColor: "#262626", borderRadius: "12px", padding: "15px", border: "1px solid #333", display: "flex", flexDirection: "column", gap: "12px" },
  cardHeader: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", borderBottom: "1px solid #333", paddingBottom: "10px" },
  btnDelete: { background: "none", border: "1px solid #333", borderRadius: "6px", padding: "5px", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" },
  channelBadge: { padding: "3px 8px", borderRadius: "6px", fontSize: "12px", fontWeight: "bold", marginRight: "8px" },
  // สไตล์สำหรับเลข Reference (GF-xxx)
  refBadge: { backgroundColor: "#444", color: "#fff", padding: "3px 8px", borderRadius: "6px", fontSize: "12px", fontWeight: "bold" },
  time: { fontSize: "13px", color: "#aaa" },
  orderId: { fontSize: "11px", color: "#555" },
  itemList: { flex: 1, fontSize: "14px", color: "#ddd" },
  item: { display: "flex", justifyContent: "space-between", marginBottom: "4px" },
  cardFooter: { borderTop: "1px solid #333", paddingTop: "10px", display: "flex", justifyContent: "space-between", alignItems: "flex-end" },
  paymentInfo: { display: "flex", flexDirection: "column", fontSize: "12px", gap: "4px" },
  priceInfo: { textAlign: "right" },
  totalLabel: { fontSize: "14px", color: "#aaa" },
  actualLabel: { fontSize: "18px", fontWeight: "bold", color: "#4caf50" },
  empty: { gridColumn: "1/-1", textAlign: "center", padding: "50px", color: "#666" }
};