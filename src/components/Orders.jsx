import React, { useState } from "react";

export default function Orders({
  orders = [],
  onDeleteOrder,
  onClearAll,
}) {
  const [deletingId, setDeletingId] = useState(null);
  const [clearing, setClearing] = useState(false);

  /* ===============================
     Helpers
  ============================== */

  const getChannelStyle = (channel) => {
    switch (channel) {
      case "grab":
        return { color: "#00B14F", bg: "#e6f7ee" };
      case "lineman":
        return { color: "#00A84F", bg: "#e6f6ee" };
      case "shopee":
        return { color: "#EE4D2D", bg: "#fef1ed" };
      default:
        return { color: "#ccc", bg: "#2a2a2a" };
    }
  };

  const formatDateTime = (time) => {
    if (!time) return "-";
    try {
      return new Date(time).toLocaleString("th-TH");
    } catch {
      return "-";
    }
  };

  const formatMoney = (num) => {
    return Number(num || 0).toLocaleString();
  };

  /* ===============================
     Clear All
  ============================== */

  const handleClearRequest = async () => {
    const confirmBox = window.confirm(
      "⚠️ คุณต้องการลบประวัติการขายทั้งหมดใช่หรือไม่?\n(ข้อมูลจะหายถาวร)"
    );
    if (!confirmBox) return;

    try {
      setClearing(true);
      await onClearAll?.();
    } catch (err) {
      alert("❌ ลบไม่ได้ กรุณาลองใหม่");
    } finally {
      setClearing(false);
    }
  };

  /* ===============================
     Delete Single
  ============================== */

  const handleDelete = async (id) => {
    try {
      setDeletingId(id);
      await onDeleteOrder?.(id);
    } catch (err) {
      alert("❌ ลบไม่ได้ กรุณาลองใหม่");
    } finally {
      setDeletingId(null);
    }
  };

  /* ===============================
     Render
  ============================== */

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <div style={styles.headerLeft}>
          <h2 style={{ margin: 0 }}>ประวัติการขาย</h2>
          <span style={styles.countBadge}>
            ทั้งหมด {orders.length} รายการ
          </span>
        </div>

        {orders.length > 0 && (
          <button
            onClick={handleClearRequest}
            disabled={clearing}
            style={{
              ...styles.btnClearAll,
              opacity: clearing ? 0.5 : 1,
            }}
          >
            {clearing ? "กำลังลบ..." : "ล้างประวัติทั้งหมด"}
          </button>
        )}
      </div>

      <div style={styles.list}>
        {orders.length === 0 ? (
          <div style={styles.empty}>
            ยังไม่มีประวัติการขาย
          </div>
        ) : (
          orders.map((order) => {
            const style = getChannelStyle(order.channel);
            const isDeleting = deletingId === order.id;

            return (
              <div
                key={order.id}
                style={{
                  ...styles.orderCard,
                  opacity: isDeleting ? 0.4 : 1,
                }}
              >
                {/* HEADER */}
                <div style={styles.cardHeader}>
                  <div style={styles.headerInfo}>
                    <div style={styles.channelRow}>
                      <span
                        style={{
                          ...styles.channelBadge,
                          color: style.color,
                          backgroundColor: style.bg,
                        }}
                      >
                        {order.channel?.toUpperCase() || "POS"}
                      </span>

                      {order.refId && (
                        <span style={styles.refBadge}>
                          #{order.refId}
                        </span>
                      )}
                    </div>

                    <span style={styles.time}>
                      {formatDateTime(order.time)}
                    </span>
                  </div>

                  <div style={styles.headerRight}>
                    <div style={styles.orderId}>
                      ID: {String(order.id).slice(-6)}
                    </div>

                    <button
                      onClick={() => handleDelete(order.id)}
                      disabled={isDeleting}
                      style={styles.btnDelete}
                    >
                      ✕
                    </button>
                  </div>
                </div>

                {/* ITEMS */}
                <div style={styles.itemList}>
                  {(order.items || []).map((item, idx) => (
                    <div key={idx} style={styles.item}>
                      <span>
                        {item.name}

                        {/* รองรับ modifier เดี่ยว หรือ array */}
                        {item.selectedModifier && (
                          <small style={styles.modifier}>
                            {" "}
                            (
                            {Array.isArray(item.selectedModifier)
                              ? item.selectedModifier
                                  .map((m) => m.name)
                                  .join(", ")
                              : item.selectedModifier.name}
                            )
                          </small>
                        )}
                      </span>

                      <span>x{item.qty}</span>
                    </div>
                  ))}
                </div>

                {/* FOOTER */}
                <div style={styles.cardFooter}>
                  <div style={styles.paymentInfo}>
                    <span>
                      วิธีจ่าย:{" "}
                      {order.payment === "cash"
                        ? "💵 เงินสด"
                        : "📱 โอน/แอป"}
                    </span>

                    <span
                      style={{
                        color: order.isSettled
                          ? "#4caf50"
                          : "#ff9800",
                        fontWeight: "bold",
                      }}
                    >
                      {order.isSettled
                        ? "● ตรวจสอบแล้ว"
                        : "○ รอใส่ยอดจริง"}
                    </span>
                  </div>

                  <div style={styles.priceInfo}>
                    <div style={styles.totalLabel}>
                      ยอดบิล: ฿{formatMoney(order.total)}
                    </div>
                    <div style={styles.actualLabel}>
                      รับจริง: ฿{formatMoney(order.actualAmount)}
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

/* ===============================
   Styles
============================== */

const styles = {
  container: {
    padding: "20px",
    backgroundColor: "#1a1a1a",
    minHeight: "100vh",
    color: "#fff",
  },

  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: "20px",
  },

  headerLeft: {
    display: "flex",
    alignItems: "center",
    gap: "15px",
  },

  countBadge: {
    backgroundColor: "#333",
    padding: "5px 12px",
    borderRadius: "20px",
    fontSize: "14px",
  },

  btnClearAll: {
    backgroundColor: "transparent",
    color: "#ff4444",
    border: "1px solid #ff4444",
    padding: "6px 12px",
    borderRadius: "8px",
    cursor: "pointer",
    fontSize: "13px",
    fontWeight: "bold",
  },

  list: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))",
    gap: "15px",
  },

  orderCard: {
    backgroundColor: "#262626",
    borderRadius: "12px",
    padding: "15px",
    border: "1px solid #333",
    display: "flex",
    flexDirection: "column",
    gap: "12px",
    transition: "opacity 0.2s",
  },

  cardHeader: {
    display: "flex",
    justifyContent: "space-between",
    borderBottom: "1px solid #333",
    paddingBottom: "10px",
  },

  headerInfo: {
    display: "flex",
    flexDirection: "column",
    gap: "5px",
  },

  channelRow: {
    display: "flex",
    alignItems: "center",
  },

  headerRight: {
    display: "flex",
    flexDirection: "column",
    alignItems: "flex-end",
    gap: "5px",
  },

  btnDelete: {
    background: "none",
    border: "1px solid #333",
    borderRadius: "6px",
    padding: "4px 8px",
    color: "#ff4444",
    cursor: "pointer",
  },

  channelBadge: {
    padding: "3px 8px",
    borderRadius: "6px",
    fontSize: "12px",
    fontWeight: "bold",
    marginRight: "8px",
  },

  refBadge: {
    backgroundColor: "#444",
    padding: "3px 8px",
    borderRadius: "6px",
    fontSize: "12px",
  },

  time: {
    fontSize: "12px",
    color: "#aaa",
  },

  orderId: {
    fontSize: "11px",
    color: "#666",
  },

  itemList: {
    flex: 1,
    fontSize: "14px",
    color: "#ddd",
  },

  item: {
    display: "flex",
    justifyContent: "space-between",
    marginBottom: "4px",
  },

  modifier: {
    color: "#888",
  },

  cardFooter: {
    borderTop: "1px solid #333",
    paddingTop: "10px",
    display: "flex",
    justifyContent: "space-between",
  },

  paymentInfo: {
    display: "flex",
    flexDirection: "column",
    fontSize: "12px",
    gap: "4px",
  },

  priceInfo: {
    textAlign: "right",
  },

  totalLabel: {
    fontSize: "13px",
    color: "#aaa",
  },

  actualLabel: {
    fontSize: "18px",
    fontWeight: "bold",
    color: "#4caf50",
  },

  empty: {
    gridColumn: "1/-1",
    textAlign: "center",
    padding: "50px",
    color: "#666",
  },
};