import React, { useState } from "react";
import { Trash2, User } from "lucide-react"; // เพิ่ม Icon เพื่อความสวยงาม

export default function Orders({ orders = [], onDeleteOrder, onClearAll }) {
  const [deletingId, setDeletingId] = useState(null);
  const [clearing, setClearing] = useState(false);

  const getChannelStyle = (channel) => {
    switch (channel) {
      case "grab": return { color: "#00B14F", bg: "rgba(0, 177, 79, 0.1)" };
      case "lineman": return { color: "#00A84F", bg: "rgba(0, 168, 79, 0.1)" };
      case "shopee": return { color: "#EE4D2D", bg: "rgba(238, 77, 45, 0.1)" };
      default: return { color: "#fff", bg: "#333" };
    }
  };

  const handleClearRequest = async () => {
    const confirmBox = window.confirm("⚠️ คุณต้องการลบประวัติการขายทั้งหมดใช่หรือไม่? (ข้อมูลจะหายถาวร)");
    if (!confirmBox) return;
    try {
      setClearing(true);
      await onClearAll();
    } catch (err) {
      alert("❌ ลบไม่ได้ กรุณาลองใหม่");
    } finally {
      setClearing(false);
    }
  };

  const handleDelete = async (id) => {
    try {
      setDeletingId(id);
      await onDeleteOrder(id);
    } catch (err) {
      alert("❌ ลบรายการไม่สำเร็จ");
    } finally {
      setDeletingId(null);
    }
  };

  // เรียงลำดับออเดอร์ล่าสุดขึ้นก่อน
  const sortedOrders = [...orders].sort((a, b) => 
    new Date(b.time || b.created_at) - new Date(a.time || a.created_at)
  );

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h2 style={styles.title}>ประวัติการขาย ({orders.length})</h2>
        <button 
          onClick={handleClearRequest} 
          disabled={clearing || orders.length === 0}
          style={{...styles.btnClearAll, opacity: orders.length === 0 ? 0.5 : 1}}
        >
          {clearing ? "กำลังลบ..." : "ล้างประวัติทั้งหมด"}
        </button>
      </div>

      <div style={styles.grid}>
        {sortedOrders.map((order) => (
          <div key={order.id} style={{...styles.orderCard, opacity: deletingId === order.id ? 0.5 : 1}}>
            <div style={styles.cardHeader}>
              <div>
                <div style={{ display: 'flex', gap: '8px', marginBottom: '8px', alignItems: 'center' }}>
                  <span style={{
                    ...styles.channelBadge, 
                    backgroundColor: getChannelStyle(order.channel).bg, 
                    color: getChannelStyle(order.channel).color
                  }}>
                    {order.channel?.toUpperCase() || 'POS'}
                  </span>
                  {order.ref && <span style={styles.refBadge}>{order.ref}</span>}
                </div>

                {/* --- ส่วนแสดงผลข้อมูลสมาชิก --- */}
                {order.member_phone && (
                  <div style={styles.memberInfo}>
                    <User size={14} color="#00B14F" />
                    <span>สมาชิก: {order.member_phone}</span>
                  </div>
                )}
                
                <div style={styles.time}>
                  {new Date(order.time || order.created_at).toLocaleString('th-TH', {
                    year: '2-digit', month: 'short', day: 'numeric',
                    hour: '2-digit', minute: '2-digit'
                  })}
                </div>
                <div style={styles.orderId}>ID: #{order.id.toString().slice(-6)}</div>
              </div>

              <button 
                onClick={() => handleDelete(order.id)}
                disabled={deletingId === order.id}
                style={styles.btnDelete}
              >
                <Trash2 size={16} color="#ff5252" />
              </button>
            </div>

            <div style={styles.itemList}>
              {order.items && (typeof order.items === 'string' ? JSON.parse(order.items) : order.items).map((item, idx) => (
                <div key={idx} style={styles.itemRow}>
                  <span>{item.name} x{item.qty}</span>
                  <span>{(item.price * item.qty).toLocaleString()}</span>
                </div>
              ))}
            </div>

            <div style={styles.cardFooter}>
              <span style={styles.totalLabel}>ยอดรวม</span>
              <span style={styles.totalValue}>฿{Number(order.total_amount || 0).toLocaleString()}</span>
            </div>
          </div>
        ))}
      </div>
      
      {orders.length === 0 && (
        <div style={styles.emptyState}>ยังไม่มีประวัติการขาย</div>
      )}
    </div>
  );
}

const styles = {
  container: { padding: "20px", paddingBottom: "100px", color: "#fff", backgroundColor: "#121212", minHeight: "100vh" },
  header: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" },
  title: { fontSize: "20px", fontWeight: "bold", margin: 0 },
  btnClearAll: { padding: "8px 16px", backgroundColor: "transparent", border: "1px solid #ff5252", color: "#ff5252", borderRadius: "8px", cursor: "pointer", fontSize: "12px" },
  grid: { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: "15px" },
  orderCard: { backgroundColor: "#1e1e1e", borderRadius: "14px", padding: "16px", border: "1px solid #333", display: "flex", flexDirection: "column", gap: "12px" },
  cardHeader: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", borderBottom: "1px solid #333", paddingBottom: "12px" },
  memberInfo: { 
    display: "flex", 
    alignItems: "center", 
    gap: "6px", 
    color: "#00B14F", 
    fontSize: "14px", 
    fontWeight: "bold",
    marginBottom: "4px"
  },
  time: { fontSize: "12px", color: "#888" },
  orderId: { fontSize: "10px", color: "#444" },
  btnDelete: { background: "none", border: "1px solid #333", borderRadius: "8px", padding: "6px", cursor: "pointer" },
  channelBadge: { padding: "3px 8px", borderRadius: "6px", fontSize: "11px", fontWeight: "bold" },
  refBadge: { backgroundColor: "#333", color: "#fff", padding: "3px 8px", borderRadius: "6px", fontSize: "11px" },
  itemList: { flex: 1, marginY: "8px" },
  itemRow: { display: "flex", justifyContent: "space-between", fontSize: "14px", color: "#ccc", marginBottom: "4px" },
  cardFooter: { borderTop: "1px solid #333", paddingTop: "12px", display: "flex", justifyContent: "space-between", alignItems: "center" },
  totalLabel: { fontSize: "14px", color: "#888" },
  totalValue: { fontSize: "18px", fontWeight: "bold", color: "#fff" },
  emptyState: { textAlign: "center", padding: "50px", color: "#555" }
};