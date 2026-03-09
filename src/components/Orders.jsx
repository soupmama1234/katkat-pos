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
  pending:  { label: "⏳ รอชำระ",  color: "#e65100", bg: "#fff3e0" },
  grab:     { label: "💳 Grab",    color: "#00B14F", bg: "#e6f7ee" },
  lineman:  { label: "💳 LINE",    color: "#00b0b9", bg: "#e0f7fa" },
  shopee:   { label: "💳 Shopee",  color: "#EE4D2D", bg: "#fef1ed" },
};

function ChannelBadge({ channel }) {
  const cfg = CHANNEL_CONFIG[channel] || CHANNEL_CONFIG.pos;
  return <span style={{ padding: "3px 9px", borderRadius: 6, fontSize: 11, fontWeight: "bold", color: cfg.color, backgroundColor: cfg.bg }}>{cfg.label}</span>;
}
function OrderTypeBadge({ orderType }) {
  if (!orderType || !ORDER_TYPE_CONFIG[orderType]) return null;
  const cfg = ORDER_TYPE_CONFIG[orderType];
  return <span style={{ padding: "3px 9px", borderRadius: 6, fontSize: 11, fontWeight: "bold", color: cfg.color, backgroundColor: cfg.bg }}>{cfg.label}</span>;
}
function PaymentBadge({ payment }) {
  const key = (payment || "").toLowerCase();
  const cfg = PAYMENT_CONFIG[key] || { label: payment, color: "#555", bg: "#eee" };
  return <span style={{ padding: "3px 9px", borderRadius: 6, fontSize: 11, fontWeight: "bold", color: cfg.color, backgroundColor: cfg.bg }}>{cfg.label}</span>;
}


// ── Payment Modal ──────────────────────────────────────────
function PaymentModal({ order, onConfirm, onClose }) {
  const [method, setMethod] = React.useState("cash");
  const [actual, setActual] = React.useState(order.total.toString());

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.9)", zIndex: 999, display: "flex", alignItems: "flex-end", justifyContent: "center" }}
      onClick={onClose}>
      <div style={{ background: "#141414", border: "1px solid #2a2a2a", borderRadius: "24px 24px 0 0", padding: "24px 20px 40px", width: "100%", maxWidth: 480 }}
        onClick={e => e.stopPropagation()}>
        <div style={{ fontSize: 17, fontWeight: 800, color: "#fff", marginBottom: 4 }}>💳 รับชำระเงิน</div>
        {order.tableNumber && <div style={{ color: "#666", fontSize: 13, marginBottom: 16 }}>โต๊ะ {order.tableNumber}</div>}

        {/* Items summary */}
        <div style={{ background: "#1e1e1e", borderRadius: 12, padding: "10px 14px", marginBottom: 16 }}>
          {order.items.map((item, i) => (
            <div key={i} style={{ display: "flex", justifyContent: "space-between", color: "#aaa", fontSize: 13, marginBottom: i < order.items.length - 1 ? 4 : 0 }}>
              <span>{item.name} ×{item.qty}</span>
              <span>฿{(item.price * item.qty).toLocaleString()}</span>
            </div>
          ))}
          <div style={{ borderTop: "1px solid #2a2a2a", marginTop: 8, paddingTop: 8, display: "flex", justifyContent: "space-between", color: "#FF9F0A", fontWeight: 800, fontSize: 16 }}>
            <span>รวม</span><span>฿{order.total.toLocaleString()}</span>
          </div>
        </div>

        {/* Payment method */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 14 }}>
          {[["cash", "💵 เงินสด"], ["transfer", "📱 โอนเงิน"]].map(([val, label]) => (
            <button key={val} onClick={() => setMethod(val)}
              style={{ padding: "12px", borderRadius: 12, border: method === val ? "2px solid #FF9F0A" : "1px solid #333", background: method === val ? "#FF9F0A22" : "#1e1e1e", color: method === val ? "#FF9F0A" : "#888", fontWeight: 700, fontSize: 15, cursor: "pointer", fontFamily: "inherit" }}>
              {label}
            </button>
          ))}
        </div>

        {/* Actual amount */}
        <div style={{ marginBottom: 16 }}>
          <div style={{ color: "#666", fontSize: 12, marginBottom: 6 }}>ยอดรับจริง</div>
          <input
            type="number" inputMode="numeric"
            value={actual}
            onChange={e => setActual(e.target.value)}
            style={{ width: "100%", background: "#1e1e1e", border: "1px solid #333", borderRadius: 12, padding: "12px 16px", color: "#fff", fontSize: 20, fontWeight: 700, textAlign: "center", outline: "none", boxSizing: "border-box", fontFamily: "inherit" }}
          />
        </div>

        <button
          onClick={() => onConfirm(method, Number(actual) || order.total)}
          style={{ width: "100%", background: "#FF9F0A", color: "#000", border: "none", borderRadius: 14, padding: 16, fontSize: 16, fontWeight: 800, cursor: "pointer", fontFamily: "inherit" }}>
          ✅ ยืนยันรับเงิน
        </button>
      </div>
    </div>
  );
}

// ── Queue Card (pending_customer orders) ───────────────────
function QueueCard({ order, onAccept, accepting, onCancel, cancelling }) {
  return (
    <div style={{
      background: "linear-gradient(135deg, #1a1a1a, #1e1e1e)",
      border: "1px solid #FF9F0A44",
      borderLeft: "4px solid #FF9F0A",
      borderRadius: 14, padding: 16,
      display: "flex", flexDirection: "column", gap: 12,
      boxShadow: "0 4px 20px rgba(255,159,10,0.08)",
    }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            <span style={{ background: "#FF9F0A22", color: "#FF9F0A", border: "1px solid #FF9F0A44", borderRadius: 6, padding: "3px 9px", fontSize: 11, fontWeight: 700 }}>
              🆕 ออเดอร์ใหม่
            </span>
            {order.tableNumber && (
              <span style={{ background: "#333", color: "#fff", borderRadius: 6, padding: "3px 9px", fontSize: 11, fontWeight: 700 }}>
                🪑 โต๊ะ {order.tableNumber}
              </span>
            )}
          </div>
          <span style={{ fontSize: 12, color: "#666" }}>
            🕐 {new Date(order.time).toLocaleString("th-TH", { hour: "2-digit", minute: "2-digit" })} น.
          </span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 11, color: "#444" }}>#{order.id.toString().slice(-6)}</span>
          <button
            onClick={() => onCancel(order)}
            disabled={cancelling}
            title="ยกเลิกออเดอร์"
            style={{ background: "none", border: "1px solid #ff444444", borderRadius: 8, padding: "4px 8px", color: "#ff4444", cursor: cancelling ? "not-allowed" : "pointer", fontSize: 16, lineHeight: 1, opacity: cancelling ? 0.4 : 1 }}
          >✕</button>
        </div>
      </div>

      {/* Items */}
      <div style={{ background: "#111", borderRadius: 10, padding: "10px 14px" }}>
        {order.items.map((item, i) => (
          <div key={i} style={{ display: "flex", justifyContent: "space-between", marginBottom: i < order.items.length - 1 ? 6 : 0 }}>
            <span style={{ color: "#ddd", fontSize: 14 }}>
              {item.name}
              {item.selectedModifier && <small style={{ color: "#888" }}> ({item.selectedModifier.name})</small>}
            </span>
            <span style={{ color: "#888", fontSize: 14 }}>×{item.qty}</span>
          </div>
        ))}
        {order.note && (
          <div style={{ marginTop: 8, paddingTop: 8, borderTop: "1px solid #222", color: "#888", fontSize: 12 }}>
            📝 {order.note}
          </div>
        )}
      </div>

      {/* Footer */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          {order.member_phone && <span style={{ fontSize: 11, color: "#888" }}>👤 {order.member_phone}</span>}
          <div style={{ color: "#FF9F0A", fontWeight: 800, fontSize: 18 }}>฿{order.total.toLocaleString()}</div>
        </div>
        <button
          onClick={() => onAccept(order)}
          disabled={accepting}
          style={{
            background: accepting ? "#333" : "#FF9F0A",
            color: accepting ? "#666" : "#000",
            border: "none", borderRadius: 12,
            padding: "10px 20px", fontSize: 14,
            fontWeight: 800, cursor: accepting ? "not-allowed" : "pointer",
            fontFamily: "inherit",
          }}
        >
          {accepting ? "⏳ กำลังรับ..." : "✅ รับออเดอร์"}
        </button>
      </div>
    </div>
  );
}


// ── Accepted Card (กำลังทำอาหาร/รอจ่าย) ──────────────────
function AcceptedCard({ order, onSettle, settling }) {
  return (
    <div style={{
      background: "#1a1a1a",
      border: "1px solid #30d15844",
      borderLeft: "4px solid #30d158",
      borderRadius: 14, padding: 16,
      display: "flex", flexDirection: "column", gap: 10,
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            <span style={{ background: "#30d15822", color: "#30d158", border: "1px solid #30d15844", borderRadius: 6, padding: "3px 9px", fontSize: 11, fontWeight: 700 }}>
              🍳 กำลังทำ
            </span>
            {order.tableNumber && (
              <span style={{ background: "#333", color: "#fff", borderRadius: 6, padding: "3px 9px", fontSize: 11, fontWeight: 700 }}>
                🪑 โต๊ะ {order.tableNumber}
              </span>
            )}
          </div>
          <span style={{ fontSize: 12, color: "#666" }}>🕐 {new Date(order.time).toLocaleString("th-TH", { hour: "2-digit", minute: "2-digit" })} น.</span>
        </div>
        <span style={{ fontSize: 11, color: "#444" }}>#{order.id.toString().slice(-6)}</span>
      </div>

      <div style={{ background: "#111", borderRadius: 10, padding: "8px 12px" }}>
        {order.items.map((item, i) => (
          <div key={i} style={{ display: "flex", justifyContent: "space-between", color: "#aaa", fontSize: 13, marginBottom: i < order.items.length - 1 ? 4 : 0 }}>
            <span>{item.name}</span><span>×{item.qty}</span>
          </div>
        ))}
      </div>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={{ color: "#30d158", fontWeight: 800, fontSize: 18 }}>฿{order.total.toLocaleString()}</span>
        <button onClick={() => onSettle(order)} disabled={settling}
          style={{ background: settling ? "#333" : "#30d158", color: settling ? "#666" : "#000", border: "none", borderRadius: 12, padding: "10px 18px", fontSize: 14, fontWeight: 800, cursor: settling ? "not-allowed" : "pointer", fontFamily: "inherit" }}>
          {settling ? "⏳..." : "💳 รับเงิน"}
        </button>
      </div>
    </div>
  );
}

// ── Main Orders Component ──────────────────────────────────
export default function Orders({ orders = [], pendingOrders = [], acceptedOrders = [], onDeleteOrder, onClearAll, onAcceptPending, onCancelPending, onSettleOrder }) {
  const canDelete = typeof onDeleteOrder === "function";
  const [deletingId, setDeletingId] = useState(null);
  const [clearing, setClearing] = useState(false);
  const [acceptingId, setAcceptingId] = useState(null);
  const [cancellingId, setCancellingId] = useState(null);
  const [settlingId, setSettlingId] = useState(null);
  const [paymentOrder, setPaymentOrder] = useState(null);
  const [tab, setTab] = useState(pendingOrders.length > 0 ? "queue" : "history");

  // auto-switch ไป queue ถ้ามี pending order เข้ามาใหม่
  React.useEffect(() => {
    if (pendingOrders.length > 0) setTab("queue");
  }, [pendingOrders.length]);

  const handleCancel = async (order) => {
    if (!window.confirm(`ยกเลิกออเดอร์โต๊ะ ${order.tableNumber || order.id.toString().slice(-4)}?`)) return;
    setCancellingId(order.id);
    try {
      await onCancelPending(order);
    } finally {
      setCancellingId(null);
    }
  };

  const handleSettle = async (order) => {
    setPaymentOrder(order);
  };

  const handleConfirmPayment = async (method, actual) => {
    setSettlingId(paymentOrder.id);
    try {
      await onSettleOrder(paymentOrder, method, actual);
      setPaymentOrder(null);
    } finally {
      setSettlingId(null);
    }
  };

  const handleAccept = async (order) => {
    setAcceptingId(order.id);
    try {
      await onAcceptPending(order);
    } finally {
      setAcceptingId(null);
    }
  };

  const handleClearRequest = async () => {
    if (!window.confirm("⚠️ ต้องการลบประวัติการขายทั้งหมด?")) return;
    try { setClearing(true); await onClearAll(); }
    catch { alert("❌ ลบไม่ได้"); }
    finally { setClearing(false); }
  };

  const handleDelete = async (id) => {
    try { setDeletingId(id); await onDeleteOrder(id); }
    catch { alert("❌ ลบไม่ได้"); }
    finally { setDeletingId(null); }
  };

  const isDelivery = (ch) => ["grab", "lineman", "shopee"].includes(ch);
  const settledOrders = orders.filter(o => o.status !== "pending_customer");

  return (
    <div style={styles.container}>
      {/* Tab bar */}
      <div style={styles.tabBar}>
        <button
          style={{ ...styles.tab, ...(tab === "queue" ? styles.tabActive : {}) }}
          onClick={() => setTab("queue")}
        >
          🔔 คิวลูกค้า
          {pendingOrders.length > 0 && (
            <span style={styles.tabBadge}>{pendingOrders.length}</span>
          )}
        </button>
        <button
          style={{ ...styles.tab, ...(tab === "history" ? styles.tabActive : {}) }}
          onClick={() => setTab("history")}
        >
          📜 ประวัติการขาย
          <span style={{ ...styles.tabBadge, background: "#333", color: "#888" }}>{settledOrders.length}</span>
        </button>
      </div>

      {/* Queue tab */}
      {tab === "queue" && (
        <div>
          {pendingOrders.length === 0 && acceptedOrders.length === 0 ? (
            <div style={styles.empty}>
              <div style={{ fontSize: 40, marginBottom: 12 }}>✨</div>
              <div>ไม่มีออเดอร์รอรับ</div>
            </div>
          ) : (
            <>
              {pendingOrders.length > 0 && (
                <div style={styles.list}>
                  {pendingOrders.map(order => (
                    <QueueCard
                      key={order.id}
                      order={order}
                      onAccept={handleAccept}
                      accepting={acceptingId === order.id}
                      onCancel={handleCancel}
                      cancelling={cancellingId === order.id}
                    />
                  ))}
                </div>
              )}
              {acceptedOrders.length > 0 && (
                <div style={{ marginTop: pendingOrders.length > 0 ? 16 : 0 }}>
                  <div style={{ color: "#30d158", fontSize: 12, fontWeight: 700, marginBottom: 10, paddingLeft: 4 }}>🍳 กำลังทำ / รอจ่าย ({acceptedOrders.length})</div>
                  <div style={styles.list}>
                    {acceptedOrders.map(order => (
                      <AcceptedCard
                        key={order.id}
                        order={order}
                        onSettle={handleSettle}
                        settling={settlingId === order.id}
                      />
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* Payment Modal */}
      {paymentOrder && (
        <PaymentModal
          order={paymentOrder}
          onConfirm={handleConfirmPayment}
          onClose={() => setPaymentOrder(null)}
        />
      )}

      {/* History tab */}
      {tab === "history" && (
        <div>
          <div style={styles.historyHeader}>
            <span style={styles.countBadge}>ทั้งหมด {settledOrders.length} รายการ</span>
            {settledOrders.length > 0 && canDelete && (
              <button onClick={handleClearRequest} disabled={clearing}
                style={{ ...styles.btnClearAll, opacity: clearing ? 0.5 : 1 }}>
                {clearing ? "กำลังลบ..." : "ล้างประวัติทั้งหมด"}
              </button>
            )}
          </div>
          <div style={styles.list}>
            {settledOrders.length === 0 ? (
              <div style={styles.empty}>ยังไม่มีประวัติการขาย</div>
            ) : (
              settledOrders.map(order => {
                const deleting = deletingId === order.id;
                const delivery = isDelivery(order.channel);
                return (
                  <div key={order.id} style={{ ...styles.orderCard, opacity: deleting ? 0.4 : 1 }}>
                    <div style={styles.cardHeader}>
                      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                        <div style={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: 6 }}>
                          <ChannelBadge channel={order.channel} />
                          {!delivery && <OrderTypeBadge orderType={order.orderType || "dine_in"} />}
                          {order.tableNumber && (
                            <span style={{ background: "#333", color: "#aaa", borderRadius: 6, padding: "3px 8px", fontSize: 11 }}>🪑 {order.tableNumber}</span>
                          )}
                        </div>
                        <span style={styles.time}>🕐 {new Date(order.time).toLocaleString("th-TH", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })} น.</span>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <div style={styles.orderId}>#{order.id.toString().slice(-6)}</div>
                        {canDelete && <button onClick={() => handleDelete(order.id)} disabled={deleting}
                          style={{ ...styles.btnDelete, cursor: deleting ? "not-allowed" : "pointer" }} title="ลบรายการนี้">
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#ff4444" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/>
                            <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/>
                          </svg>
                        </button>}
                      </div>
                    </div>
                    <div style={styles.itemList}>
                      {order.items.map((item, idx) => (
                        <div key={idx} style={styles.item}>
                          <span>{item.name}{item.selectedModifier && <small style={{ color: "#888" }}> ({item.selectedModifier.name})</small>}</span>
                          <span style={{ color: "#aaa" }}>×{item.qty}</span>
                        </div>
                      ))}
                    </div>
                    <div style={styles.cardFooter}>
                      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                        <PaymentBadge payment={order.payment} />
                        <span style={{ fontSize: 12, fontWeight: "bold", color: order.isSettled ? "#4caf50" : "#ff9800" }}>
                          {order.isSettled ? "● ตรวจสอบแล้ว" : "○ รอใส่ยอดจริง"}
                        </span>
                        {order.member_phone && <span style={{ fontSize: 11, color: "#888" }}>👤 {order.member_phone}</span>}
                      </div>
                      <div style={{ textAlign: "right" }}>
                        <div style={{ fontSize: 13, color: "#aaa" }}>ยอดบิล: ฿{order.total.toLocaleString()}</div>
                        <div style={{ fontSize: 20, fontWeight: "bold", color: "#4caf50" }}>฿{(order.actualAmount || 0).toLocaleString()}</div>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}

const styles = {
  container: { padding: 16, backgroundColor: "#1a1a1a", minHeight: "100vh", color: "#fff" },
  tabBar: { display: "flex", gap: 8, marginBottom: 16 },
  tab: { flex: 1, background: "#222", border: "1px solid #333", borderRadius: 12, padding: "10px 16px", color: "#888", fontSize: 14, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 },
  tabActive: { background: "#2a2a2a", border: "1px solid #FF9F0A44", color: "#fff" },
  tabBadge: { background: "#FF9F0A", color: "#000", borderRadius: 99, padding: "1px 7px", fontSize: 11, fontWeight: 800, minWidth: 18, textAlign: "center" },
  historyHeader: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 },
  countBadge: { backgroundColor: "#333", padding: "5px 12px", borderRadius: 20, fontSize: 14 },
  btnClearAll: { backgroundColor: "transparent", color: "#ff4444", border: "1px solid #ff4444", padding: "6px 12px", borderRadius: 8, cursor: "pointer", fontSize: 13, fontWeight: "bold" },
  list: { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 12 },
  orderCard: { backgroundColor: "#262626", borderRadius: 12, padding: 15, border: "1px solid #333", display: "flex", flexDirection: "column", gap: 12 },
  cardHeader: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", borderBottom: "1px solid #333", paddingBottom: 10 },
  btnDelete: { background: "none", border: "1px solid #333", borderRadius: 6, padding: 5, display: "flex", alignItems: "center", justifyContent: "center" },
  time: { fontSize: 12, color: "#888" },
  orderId: { fontSize: 11, color: "#555" },
  itemList: { flex: 1, fontSize: 14, color: "#ddd" },
  item: { display: "flex", justifyContent: "space-between", marginBottom: 4 },
  cardFooter: { borderTop: "1px solid #333", paddingTop: 10, display: "flex", justifyContent: "space-between", alignItems: "flex-end" },
  empty: { textAlign: "center", padding: "50px 0", color: "#555" },
};
