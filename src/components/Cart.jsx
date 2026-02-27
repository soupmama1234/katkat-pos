import React, { useState } from "react";
import { Trash2 } from "lucide-react";

export default function Cart({ cart = [], decreaseQty, increaseQty, addToCart, total = 0, onCheckout, onClearCart, priceChannel = "pos", deliveryRef = "", onRefChange }) {
  const [showPayment, setShowPayment] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState("cash");
  const [cashReceived, setCashReceived] = useState("");

  const isDelivery = ["grab", "lineman", "shopee"].includes(priceChannel);
  const receivedNumber = Number(cashReceived) || 0;
  const change = receivedNumber - total;

  React.useEffect(() => {
    if (showPayment) setCashReceived("");
  }, [showPayment]);

  const handleFinalConfirm = () => {
    const finalRef = priceChannel === "grab" ? `GF-${deliveryRef}` : deliveryRef;
    if (isDelivery) {
      onCheckout("transfer", finalRef);
    } else {
      onCheckout(paymentMethod);
    }
    setShowPayment(false);
    setCashReceived("");
    if (onRefChange) onRefChange("");
  };

  const isConfirmDisabled =
    (!isDelivery && paymentMethod === "cash" && (cashReceived === "" || change < 0)) ||
    (isDelivery && (
      !deliveryRef ||
      (priceChannel === "grab" && deliveryRef.length < 2) ||
      (priceChannel === "lineman" && deliveryRef.length < 4)
    ));

  return (
    <div style={styles.container}>
      {/* Header */}
      <div style={styles.header}>
        <h2 style={{ margin: 0, color: "#213547", fontSize: "1.1rem" }}>รายการขาย</h2>
        <button onClick={() => cart.length > 0 && onClearCart()} style={styles.btnClear}>
          ล้างตะกร้า
        </button>
      </div>

      {/* Item List */}
      <div style={styles.cartList}>
        {cart.length === 0 && (
          <div style={styles.emptyText}>ไม่มีสินค้าในตะกร้า</div>
        )}
        {cart.map((item, index) => (
          <div key={`${item.id}-${index}`} style={styles.cartItem}>
            {/* ชื่อสินค้า */}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 5, flexWrap: "wrap" }}>
                <span style={styles.itemName}>{item.name}</span>
                <span style={styles.badge}>{item.channel?.toUpperCase()}</span>
              </div>
              {item.selectedModifier && (
                <div style={styles.modifierText}>• {item.selectedModifier.name}</div>
              )}
              <div style={styles.itemDetail}>
                ฿{item.price.toLocaleString()} × {item.qty} = <strong>฿{(item.qty * item.price).toLocaleString()}</strong>
              </div>
            </div>

            {/* ปุ่ม - qty + และ ลบ */}
            <div style={styles.itemActions}>
              <div style={styles.qtyControl}>
                <button
                  onClick={() => decreaseQty(item.id, item.channel, item.selectedModifier?.id)}
                  style={styles.qtyBtn}
                  title="ลดจำนวน"
                >
                  −
                </button>
                <span style={styles.qtyNumber}>{item.qty}</span>
                <button
                  onClick={() => increaseQty(item.id, item.channel, item.selectedModifier?.id)}
                  style={styles.qtyBtn}
                  title="เพิ่มจำนวน"
                >
                  +
                </button>
              </div>
              <button
                onClick={() => {
                  // ลบทั้งหมดของรายการนี้โดย decrease จนหมด
                  for (let i = 0; i < item.qty; i++) {
                    decreaseQty(item.id, item.channel, item.selectedModifier?.id);
                  }
                }}
                style={styles.btnDelete}
                title="ลบรายการนี้"
              >
                <Trash2 size={16} color="#d32f2f" />
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Footer */}
      <div style={styles.footer}>
        <div style={styles.totalRow}>
          <span>รวมทั้งหมด:</span>
          <span>฿{total.toLocaleString()}</span>
        </div>
        <button
          style={{
            ...styles.btnPay,
            backgroundColor: cart.length > 0 ? "#213547" : "#999",
            cursor: cart.length > 0 ? "pointer" : "not-allowed",
          }}
          onClick={() => cart.length > 0 && setShowPayment(true)}
        >
          {isDelivery ? `💾 บันทึก ${priceChannel.toUpperCase()}` : "💰 ชำระเงิน"}
        </button>
      </div>

      {/* Payment Modal */}
      {showPayment && (
        <div style={styles.modalOverlay} onClick={() => setShowPayment(false)}>
          <div style={styles.modalContent} onClick={(e) => e.stopPropagation()}>
            <h3 style={{ marginTop: 0 }}>{isDelivery ? "ยืนยันการบันทึก" : "การชำระเงิน"}</h3>

            <div style={styles.totalDisplay}>
              <div style={{ fontSize: 13, color: "#888" }}>ยอดชำระสุทธิ</div>
              <div style={{ fontSize: 30, fontWeight: "bold" }}>฿{total.toLocaleString()}</div>
            </div>

            {!isDelivery ? (
              <>
                <div style={{ display: "flex", gap: 10, marginBottom: 15 }}>
                  {["cash", "promptpay"].map(m => (
                    <button key={m} onClick={() => setPaymentMethod(m)} style={{
                      ...styles.btnMethod,
                      backgroundColor: paymentMethod === m ? "#213547" : "#eee",
                      color: paymentMethod === m ? "#fff" : "#000",
                    }}>
                      {m === "cash" ? "💵 เงินสด" : "📱 สแกนจ่าย"}
                    </button>
                  ))}
                </div>
                {paymentMethod === "cash" && (
                  <div style={{ marginBottom: 15 }}>
                    <input
                      type="number"
                      placeholder="รับเงินมา..."
                      style={styles.input}
                      value={cashReceived}
                      onChange={(e) => setCashReceived(e.target.value)}
                      autoFocus
                    />
                    {cashReceived !== "" && (
                      <div style={{ textAlign: "center", marginTop: 10, fontWeight: "bold", fontSize: 16 }}>
                        เงินทอน:{" "}
                        <span style={{ color: change >= 0 ? "#2e7d32" : "#c62828" }}>
                          ฿{change.toLocaleString()}
                        </span>
                      </div>
                    )}
                  </div>
                )}
              </>
            ) : (
              <div style={{ marginBottom: 20, textAlign: "center" }}>
                <p style={{ color: "#888", fontSize: 13, margin: "0 0 8px" }}>เลขอ้างอิง {priceChannel.toUpperCase()}</p>
                <div style={{ fontSize: 22, fontWeight: "bold", color: "#4caf50", letterSpacing: 2 }}>
                  {priceChannel === "grab" ? `GF-${deliveryRef}` : deliveryRef}
                </div>
                {!deliveryRef && (
                  <p style={{ color: "#ff5252", fontSize: 12, marginTop: 8 }}>⚠️ ยังไม่ได้ใส่เลขอ้างอิง</p>
                )}
              </div>
            )}

            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={() => setShowPayment(false)} style={styles.btnCancel}>ยกเลิก</button>
              <button
                disabled={isConfirmDisabled}
                onClick={handleFinalConfirm}
                style={{
                  ...styles.btnConfirm,
                  opacity: isConfirmDisabled ? 0.4 : 1,
                  cursor: isConfirmDisabled ? "not-allowed" : "pointer",
                }}
              >
                ยืนยัน
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const styles = {
  container: {
    display: "flex", flexDirection: "column", height: "100%",
    padding: "15px", backgroundColor: "#ff9800", boxSizing: "border-box",
  },
  header: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" },
  btnClear: { background: "rgba(255,255,255,0.3)", border: "1px solid #213547", padding: "4px 10px", borderRadius: "6px", cursor: "pointer", fontSize: "13px" },
  cartList: { flex: 1, overflowY: "auto", marginBottom: "12px" },
  emptyText: { textAlign: "center", marginTop: "50px", color: "rgba(33,53,71,0.45)", fontSize: "15px" },

  cartItem: {
    backgroundColor: "#fff", padding: "10px 12px", borderRadius: "10px",
    marginBottom: "8px", display: "flex", alignItems: "center", gap: "10px", color: "#333",
  },
  itemName: { fontWeight: "bold", fontSize: "14px" },
  badge: { fontSize: "10px", background: "#213547", color: "#fff", padding: "2px 6px", borderRadius: "4px" },
  modifierText: { fontSize: "11px", color: "#888", fontStyle: "italic", marginTop: "2px" },
  itemDetail: { fontSize: "13px", color: "#555", marginTop: "3px" },

  itemActions: { display: "flex", alignItems: "center", gap: "8px", flexShrink: 0 },

  // ปุ่ม +/- สำหรับ desktop cart
  qtyControl: {
    display: "flex", alignItems: "center",
    backgroundColor: "#f0f0f0", borderRadius: "8px",
    border: "1px solid #ddd", overflow: "hidden",
  },
  qtyBtn: {
    width: "30px", height: "30px",
    background: "none", border: "none",
    color: "#213547", fontSize: "18px", fontWeight: "bold",
    cursor: "pointer", display: "flex", alignItems: "center",
    justifyContent: "center", lineHeight: 1, padding: 0,
  },
  qtyNumber: {
    minWidth: "28px", textAlign: "center",
    fontWeight: "bold", fontSize: "14px", color: "#213547",
    borderLeft: "1px solid #ddd", borderRight: "1px solid #ddd",
    height: "30px", display: "flex", alignItems: "center", justifyContent: "center",
  },
  btnDelete: {
    background: "none", border: "none", cursor: "pointer",
    display: "flex", alignItems: "center", justifyContent: "center",
    padding: "4px", borderRadius: "6px",
  },

  footer: { backgroundColor: "rgba(255,255,255,0.2)", padding: "14px", borderRadius: "14px" },
  totalRow: { display: "flex", justifyContent: "space-between", fontSize: "1.3rem", fontWeight: "bold", color: "#213547", marginBottom: "12px" },
  btnPay: { width: "100%", padding: "14px", borderRadius: "10px", border: "none", color: "#fff", fontSize: "1.1rem", fontWeight: "bold" },

  modalOverlay: { position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.7)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 },
  modalContent: { backgroundColor: "#fff", padding: "24px", borderRadius: "18px", width: "320px", color: "#333" },
  totalDisplay: { backgroundColor: "#f5f5f5", padding: "14px", borderRadius: "10px", textAlign: "center", marginBottom: "18px" },
  input: { width: "100%", padding: "12px", borderRadius: "8px", border: "1px solid #ddd", fontSize: "18px", textAlign: "center", boxSizing: "border-box" },
  btnMethod: { flex: 1, padding: "10px", borderRadius: "8px", border: "none", fontWeight: "bold", cursor: "pointer" },
  btnConfirm: { flex: 2, padding: "12px", borderRadius: "8px", border: "none", backgroundColor: "#213547", color: "#fff", fontWeight: "bold" },
  btnCancel: { flex: 1, padding: "12px", borderRadius: "8px", border: "1px solid #ddd", backgroundColor: "#fff", cursor: "pointer" },
};
