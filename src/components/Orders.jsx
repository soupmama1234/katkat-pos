import React, { useState } from "react";

// ── Badge helpers ──────────────────────────────────────────
const CHANNEL_CONFIG = {
  grab:    { label: "GrabFood",   color: "#00B14F", bg: "#e6f7ee" },
  lineman: { label: "LINE MAN",   color: "#00b0b9", bg: "#e0f7fa" },
  shopee:  { label: "ShopeeFood", color: "#EE4D2D", bg: "#fef1ed" },
  pos:     { label: "หน้าร้าน",   color: "#213547", bg: "#f0f2f5" },
};

const ORDER_TYPE_CONFIG = {
  dine_in:  { label: "🍽️ ทานที่ร้าน", color: "#1565c0", bg: "#e3f2fd" },
  takeaway: { label: "🛍️ กลับบ้าน",  color: "#6a1b9a", bg: "#f3e5f5" },
};

const PAYMENT_CONFIG = {
  cash:     { label: "💵 เงินสด",  color: "#2e7d32", bg: "#e8f5e9" },
  transfer: { label: "📱 โอนเงิน", color: "#1565c0", bg: "#e3f2fd" },
  grab:     { label: "💳 Grab",    color: "#00B14F", bg: "#e6f7ee" },
  lineman:  { label: "💳 LINE",    color: "#00b0b9", bg: "#e0f7fa" },
  shopee:   { label: "💳 Shopee",  color: "#EE4D2D", bg: "#fef1ed" },
};

function ChannelBadge({ channel }) {
  const cfg = CHANNEL_CONFIG[channel] || CHANNEL_CONFIG.pos;
  return (
    <span style={{
      padding: "3px 9px", borderRadius: 6, fontSize: 11, fontWeight: "bold",
      color: cfg.color, backgroundColor: cfg.bg, letterSpacing: 0.2,
    }}>
      {cfg.label}
    </span>
  );
}

function OrderTypeBadge({ orderType }) {
  // delivery channels ไม่แสดง badge นี้
  if (!orderType || !ORDER_TYPE_CONFIG[orderType]) return null;
  const cfg = ORDER_TYPE_CONFIG[orderType];
  return (
    <span style={{
      padding: "3px 9px", borderRadius: 6, fontSize: 11, fontWeight: "bold",
      color: cfg.color, backgroundColor: cfg.bg,
    }}>
      {cfg.label}
    </span>
  );
}

function PaymentBadge({ payment }) {
  const key = (payment || "").toLowerCase();
  const cfg = PAYMENT_CONFIG[key] || { label: payment, color: "#555", bg: "#eee" };
  return (
    <span style={{
      padding: "3px 9px", borderRadius: 6, fontSize: 11, fontWeight: "bold",
      color: cfg.color, backgroundColor: cfg.bg,
    }}>
      {cfg.label}
    </span>
  );
}

// ─────────────────────────────────────────────────────────

export default function Orders({ orders = [], onDeleteOrder, onClearAll }) {
  const canDelete = typeof onDeleteOrder === "function";
  const [deletingId, setDeletingId] = useState(null);
  const [clearing, setClearing] = useState(false);

  const handleClearRequest = async () => {
    const confirmBox = window.confirm("⚠️ คุณต้องการลบประวัติการขายทั้งหมดใช่หรือไม่? (ข้อมูลจะหายถาวร)");
    if (!confirmBox) return;
    try {
      setClearing(true);
      await onClearAll();
    } catch {
      alert("❌ ลบไม่ได้ กรุณาลองใหม่");
    } finally {
      setClearing(false);
    }
  };

  const handleDelete = async (id) => {
    try {
      setDeletingId(id);
      await onDeleteOrder(id);
    } catch {
      alert("❌ ลบไม่ได้ กรุณาลองใหม่");
    } finally {
      setDeletingId(null);
    }
  };

  const isDelivery = (ch) => ["grab", "lineman", "shopee"].includes(ch);

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <div style={{ display: "flex", alignItems: "center", gap: 15 }}>
          <h2 style={{ margin: 0 }}>ประวัติการขาย</h2>
          <span style={styles.countBadge}>ทั้งหมด {orders.length} รายการ</span>
        </div>
        {orders.length > 0 && canDelete && (
          <button onClick={handleClearRequest} disabled={clearing}
            style={{ ...styles.btnClearAll, opacity: clearing ? 0.5 : 1 }}>
            {clearing ? "กำลังลบ..." : "ล้างประวัติทั้งหมด"}
          </button>
        )}
      </div>

      <div style={styles.list}>
        {orders.length === 0 ? (
          <div style={styles.empty}>ยังไม่มีประวัติการขาย</div>
        ) : (
          orders.map((order) => {
            const deleting = deletingId === order.id;
            const delivery = isDelivery(order.channel);
            return (
              <div key={order.id} style={{ ...styles.orderCard, opacity: deleting ? 0.4 : 1 }}>

                {/* ── Header ── */}
                <div style={styles.cardHeader}>
                  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>

                    {/* Row 1: channel + orderType badges */}
                    <div style={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: 6 }}>
                      <ChannelBadge channel={order.channel} />
                      {/* ทานที่ร้าน/กลับบ้าน: แสดงเฉพาะ POS */}
                      {!delivery && (
                        <OrderTypeBadge orderType={order.orderType || "dine_in"} />
                      )}
                      {order.refId && (
                        <span style={styles.refBadge}>#{order.refId}</span>
                      )}
                    </div>

                    {/* Row 2: เวลา */}
                    <span style={styles.time}>
                      🕐 {new Date(order.time).toLocaleString("th-TH", {
                        day: "2-digit", month: "short",
                        hour: "2-digit", minute: "2-digit"
                      })} น.
                    </span>
                  </div>

                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <div style={styles.orderId}>#{order.id.toString().slice(-6)}</div>
                    {canDelete && <button onClick={() => handleDelete(order.id)} disabled={deleting}
                      style={{ ...styles.btnDelete, cursor: deleting ? "not-allowed" : "pointer" }}
                      title="ลบรายการนี้">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#ff4444" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/>
                        <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/>
                      </svg>
                    </button>}
                  </div>
                </div>

                {/* ── Items ── */}
                <div style={styles.itemList}>
                  {order.items.map((item, idx) => (
                    <div key={idx} style={styles.item}>
                      <span>
                        {item.name}
                        {item.selectedModifier && (
                          <small style={{ color: "#888" }}> ({item.selectedModifier.name})</small>
                        )}
                      </span>
                      <span style={{ color: "#aaa" }}>×{item.qty}</span>
                    </div>
                  ))}
                </div>

                {/* ── Footer ── */}
                <div style={styles.cardFooter}>
                  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    {/* payment badge */}
                    <PaymentBadge payment={order.payment} />
                    {/* settled status */}
                    <span style={{
                      fontSize: 12, fontWeight: "bold",
                      color: order.isSettled ? "#4caf50" : "#ff9800"
                    }}>
                      {order.isSettled ? "● ตรวจสอบแล้ว" : "○ รอใส่ยอดจริง"}
                    </span>
                    {order.member_phone && (
                      <span style={{ fontSize: 11, color: "#888" }}>👤 {order.member_phone}</span>
                    )}
                  </div>

                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontSize: 13, color: "#aaa" }}>ยอดบิล: ฿{order.total.toLocaleString()}</div>
                    <div style={{ fontSize: 20, fontWeight: "bold", color: "#4caf50" }}>
                      ฿{(order.actualAmount || 0).toLocaleString()}
                    </div>
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
  container: { padding: 20, backgroundColor: "#1a1a1a", minHeight: "100vh", color: "#fff" },
  header: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 },
  countBadge: { backgroundColor: "#333", padding: "5px 12px", borderRadius: 20, fontSize: 14 },
  btnClearAll: { backgroundColor: "transparent", color: "#ff4444", border: "1px solid #ff4444", padding: "6px 12px", borderRadius: 8, cursor: "pointer", fontSize: 13, fontWeight: "bold" },
  list: { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 15 },
  orderCard: { backgroundColor: "#262626", borderRadius: 12, padding: 15, border: "1px solid #333", display: "flex", flexDirection: "column", gap: 12, transition: "opacity 0.2s" },
  cardHeader: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", borderBottom: "1px solid #333", paddingBottom: 10 },
  btnDelete: { background: "none", border: "1px solid #333", borderRadius: 6, padding: 5, display: "flex", alignItems: "center", justifyContent: "center" },
  refBadge: { backgroundColor: "#444", color: "#fff", padding: "3px 8px", borderRadius: 6, fontSize: 11, fontWeight: "bold" },
  time: { fontSize: 12, color: "#888" },
  orderId: { fontSize: 11, color: "#555" },
  itemList: { flex: 1, fontSize: 14, color: "#ddd" },
  item: { display: "flex", justifyContent: "space-between", marginBottom: 4 },
  cardFooter: { borderTop: "1px solid #333", paddingTop: 10, display: "flex", justifyContent: "space-between", alignItems: "flex-end" },
  empty: { gridColumn: "1/-1", textAlign: "center", padding: 50, color: "#666" },
};
