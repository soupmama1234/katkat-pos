import React, { useState } from "react";
import { Trash2 } from "lucide-react";
import { calcPoints, getPointSettings } from "../utils/points";
import RedeemModal from "./RedeemModal";
import { parseRewardDiscount } from "../utils/discounts";
import OrderTypeBar from "./pos/OrderTypeBar.jsx";
import DeliveryRefInput from "./pos/DeliveryRefInput.jsx";
import MemberBar from "./pos/MemberBar.jsx";

export default function Cart({
  // cart
  cart = [], decreaseQty, increaseQty, addToCart, total = 0,
  onCheckout, onClearCart,
  subtotal = 0, discountTotal = 0, discounts = [],
  onApplyManualDiscount, onApplyRewardDiscount, onRemoveDiscount, onClearDiscounts,
  // channel
  priceChannel = "pos",
  // order meta — from App
  orderType = "dine_in", setOrderType,
  tableNumber = "", setTableNumber,
  deliveryRef = "", setDeliveryRef,
  // member — from App
  memberPhone = "",
  memberInfo, onMemberUpdate, memberStatus, setMemberStatus,
  memberInput = "", setMemberInput,
  showRegister = false, setShowRegister,
  regNickname = "", setRegNickname,
  lookupMember, registerMember, clearMember,
  // ui
  showToast, showConfirm,
  // pending
  pendingOrders = [], onSavePending, onRestorePending, onDeletePending,
}) {
  const [showPayment, setShowPayment] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState("cash");
  const [cashReceived, setCashReceived] = useState("");
  const [showRedeem, setShowRedeem] = useState(false);
  const [discountMode, setDiscountMode] = useState("amount");
  const [discountInput, setDiscountInput] = useState("");
  const [showPending, setShowPending] = useState(false);
  const [pendingLabel, setPendingLabel] = useState("");

  const isDelivery = ["grab", "lineman", "shopee"].includes(priceChannel);
  const receivedNumber = Number(cashReceived) || 0;
  const change = receivedNumber - total;

  const { rate, tiers } = getPointSettings();
  const pointsWillEarn = memberPhone ? calcPoints(total, rate, tiers) : 0;
  const currentMultiplier = [...tiers].sort((a, b) => b.minSpend - a.minSpend).find(t => total >= t.minSpend)?.multiplier || 1;
  const isBonus = currentMultiplier > 1;

  React.useEffect(() => {
    if (showPayment) setCashReceived("");
  }, [showPayment]);

  const handleFinalConfirm = () => {
    onCheckout(paymentMethod);
    setShowPayment(false);
    setCashReceived("");
  };

  const isConfirmDisabled =
    (!isDelivery && paymentMethod === "cash" && (cashReceived === "" || change < 0)) ||
    (isDelivery && (
      !deliveryRef || deliveryRef === "GF-" ||
      (priceChannel === "grab" && deliveryRef.replace("GF-", "").length < 3) ||
      (priceChannel === "lineman" && deliveryRef.length < 4)
    ));

  const handleApplyDiscount = () => {
    const value = Number(discountInput);
    if (!(value > 0)) return;
    onApplyManualDiscount?.({ mode: discountMode, value });
    setDiscountInput("");
  };

  return (
    <div style={S.container}>
      {/* Header */}
      <div style={S.header}>
        <h2 style={{ margin: 0, color: "#213547", fontSize: "1.1rem" }}>รายการขาย</h2>
        <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
          {pendingOrders.length > 0 && (
            <button onClick={() => setShowPending(true)} style={{ ...S.btnClear, position: "relative", paddingRight: 22 }}>
              พัก
              <span style={{ position: "absolute", top: -6, right: -6, background: "#e53935", color: "#fff", borderRadius: "50%", width: 18, height: 18, fontSize: 10, fontWeight: "bold", display: "flex", alignItems: "center", justifyContent: "center" }}>
                {pendingOrders.length}
              </span>
            </button>
          )}
          {pendingOrders.length === 0 && (
            <button onClick={() => setShowPending(true)} style={S.btnClear}>พัก</button>
          )}
          <button onClick={() => cart.length > 0 && onClearCart()} style={S.btnClear}>ล้างตะกร้า</button>
        </div>
      </div>

      {/* ── shared: Order type ── */}
      {!isDelivery && (
        <OrderTypeBar
          orderType={orderType} setOrderType={setOrderType}
          tableNumber={tableNumber} setTableNumber={setTableNumber}
          variant="light"
        />
      )}

      {/* ── shared: Delivery ref ── */}
      {isDelivery && (
        <DeliveryRefInput
          priceChannel={priceChannel}
          deliveryRef={deliveryRef} setDeliveryRef={setDeliveryRef}
          variant="light"
        />
      )}

      {/* ── shared: Member bar ── */}
      {!isDelivery && (
        <MemberBar
          memberPhone={memberPhone} memberInfo={memberInfo}
          memberStatus={memberStatus} setMemberStatus={setMemberStatus}
          memberInput={memberInput} setMemberInput={setMemberInput}
          showRegister={showRegister} setShowRegister={setShowRegister}
          regNickname={regNickname} setRegNickname={setRegNickname}
          lookupMember={lookupMember} registerMember={registerMember} clearMember={clearMember}
          onMemberUpdate={onMemberUpdate}
          onApplyRewardDiscount={onApplyRewardDiscount}
          addToCart={addToCart}
          total={total}
          showToast={showToast}
          variant="light"
          onOpenRedeem={() => setShowRedeem(true)}
        />
      )}

      {/* ── Cart Items ── */}
      <div style={S.cartList}>
        {cart.length === 0 && <div style={S.emptyText}>ไม่มีสินค้าในตะกร้า</div>}
        {cart.map((item, index) => (
          <div key={`${item.id}-${index}`} style={S.cartItem}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 5, flexWrap: "wrap" }}>
                <span style={S.itemName}>{item.name}</span>
                <span style={S.badge}>{item.channel?.toUpperCase()}</span>
              </div>
              {item.selectedModifier && <div style={S.modifierText}>• {item.selectedModifier.name}</div>}
              <div style={S.itemDetail}>฿{item.price.toLocaleString()} × {item.qty} = <strong>฿{(item.qty * item.price).toLocaleString()}</strong></div>
            </div>
            <div style={S.itemActions}>
              <div style={S.qtyControl}>
                <button onClick={() => decreaseQty(item.id, item.channel, item.selectedModifier?.id)} style={S.qtyBtn}>−</button>
                <span style={S.qtyNum}>{item.qty}</span>
                <button onClick={() => increaseQty(item.id, item.channel, item.selectedModifier?.id)} style={S.qtyBtn}>+</button>
              </div>
              <button onClick={() => { for (let i = 0; i < item.qty; i++) decreaseQty(item.id, item.channel, item.selectedModifier?.id); }} style={S.btnDelete}>
                <Trash2 size={16} color="#d32f2f" />
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* ── Footer ── */}
      <div style={S.footer}>
        {discountTotal > 0 && (
          <>
            <div style={{ ...S.summaryRow, color: "#555" }}><span>ยอดก่อนลด</span><span>฿{subtotal.toLocaleString()}</span></div>
            <div style={{ ...S.summaryRow, color: "#2e7d32", marginBottom: 6 }}><span>ส่วนลดรวม</span><span>-฿{discountTotal.toLocaleString()}</span></div>
          </>
        )}
        <div style={S.totalRow}><span>รวมทั้งหมด:</span><span>฿{total.toLocaleString()}</span></div>

        {/* discount row */}
        <div style={{ display: "flex", gap: 6, marginBottom: 8, alignItems: "center" }}>
          <select value={discountMode} onChange={e => setDiscountMode(e.target.value)}
            style={{ ...S.input, width: 60, padding: "6px 4px", fontSize: 13, color: "#333" }}>
            <option value="amount">฿</option>
            <option value="percent">%</option>
          </select>
          <input value={discountInput} onChange={e => setDiscountInput(e.target.value)}
            placeholder="ลด" type="number" inputMode="decimal"
            style={{ ...S.input, flex: 1, padding: "6px 8px", color: "#333" }} />
          <button onClick={handleApplyDiscount} style={{ ...S.btnSmall, background: "#213547", color: "#fff", border: "none", fontWeight: "bold", padding: "6px 12px" }}>ใช้</button>
          <button onClick={() => onClearDiscounts?.()} style={{ ...S.btnSmall, padding: "6px 8px", color: "#333" }}>ล้าง</button>
        </div>
        {discounts.length > 0 && (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 10 }}>
            {discounts.map(d => (
              <button key={d.id} onClick={() => onRemoveDiscount?.(d.id)}
                style={{ background: "#f3f3f3", border: "1px solid #ddd", borderRadius: 14, padding: "4px 8px", fontSize: 11, cursor: "pointer", color: "#333" }}>
                {d.label || "ส่วนลด"} ✕
              </button>
            ))}
          </div>
        )}

        <button
          style={{ ...S.btnPay, backgroundColor: cart.length > 0 ? "#213547" : "#999", cursor: cart.length > 0 ? "pointer" : "not-allowed" }}
          onClick={() => cart.length > 0 && setShowPayment(true)}>
          {isDelivery ? `💾 บันทึก ${priceChannel.toUpperCase()}` : "💰 ชำระเงิน"}
        </button>
      </div>

      {/* ── Payment Modal ── */}
      {showPayment && (
        <div style={S.modalOverlay} onClick={() => setShowPayment(false)}>
          <div style={S.modalContent} onClick={e => e.stopPropagation()}>
            <h3 style={{ marginTop: 0 }}>{isDelivery ? "ยืนยันการบันทึก" : "การชำระเงิน"}</h3>

            {!isDelivery && (
              <div style={{ textAlign: "center", marginBottom: 12 }}>
                <span style={{ fontSize: 13, background: "#f5f5f5", padding: "4px 14px", borderRadius: 20, color: "#555", fontWeight: "bold" }}>
                  {orderType === "dine_in" ? "🍽️ ทานที่ร้าน" : "🛍️ กลับบ้าน"}
                  {orderType === "dine_in" && tableNumber && <span style={{ color: "#213547", marginLeft: 6 }}>โต๊ะ {tableNumber}</span>}
                </span>
              </div>
            )}

            <div style={S.totalDisplay}>
              <div style={{ fontSize: 13, color: "#888" }}>ยอดชำระสุทธิ</div>
              <div style={{ fontSize: 30, fontWeight: "bold" }}>฿{total.toLocaleString()}</div>
              {memberPhone && pointsWillEarn > 0 && (
                <div style={{ marginTop: 6, fontSize: 13, color: isBonus ? "#e65100" : "#555", background: isBonus ? "#fff3e0" : "#f5f5f5", borderRadius: 8, padding: "4px 10px", display: "inline-block" }}>
                  ⭐ +{pointsWillEarn} แต้ม {isBonus ? `(${currentMultiplier}x 🔥)` : ""}
                </div>
              )}
            </div>

            {!isDelivery ? (
              <>
                <div style={{ display: "flex", gap: 10, marginBottom: 15 }}>
                  {["cash", "transfer"].map(m => (
                    <button key={m} onClick={() => setPaymentMethod(m)}
                      style={{ ...S.btnMethod, backgroundColor: paymentMethod === m ? "#213547" : "#eee", color: paymentMethod === m ? "#fff" : "#000" }}>
                      {m === "cash" ? "💵 เงินสด" : "📲 โอนเงิน"}
                    </button>
                  ))}
                </div>
                {paymentMethod === "cash" && (
                  <div style={{ marginBottom: 15 }}>
                    <input type="number" placeholder="รับเงินมา..." style={S.inputModal}
                      value={cashReceived} onChange={e => setCashReceived(e.target.value)} autoFocus />
                    {cashReceived !== "" && (
                      <div style={{ textAlign: "center", marginTop: 10, fontWeight: "bold", fontSize: 16 }}>
                        เงินทอน: <span style={{ color: change >= 0 ? "#2e7d32" : "#c62828" }}>฿{change.toLocaleString()}</span>
                      </div>
                    )}
                  </div>
                )}
              </>
            ) : (
              <div style={{ marginBottom: 20, textAlign: "center" }}>
                <div style={{ fontSize: 18, fontWeight: "bold", color: "#213547" }}>{deliveryRef}</div>
                <p style={{ color: "#bbb", fontSize: 11, marginTop: 8 }}>ออเดอร์จะรอที่ Dashboard เพื่อใส่ยอดรับจริง</p>
              </div>
            )}

            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={() => setShowPayment(false)} style={S.btnCancel}>ยกเลิก</button>
              <button disabled={isConfirmDisabled} onClick={handleFinalConfirm}
                style={{ ...S.btnConfirm, opacity: isConfirmDisabled ? 0.4 : 1, cursor: isConfirmDisabled ? "not-allowed" : "pointer" }}>
                ยืนยัน
              </button>
            </div>
          </div>
        </div>
      )}

      {showRedeem && memberInfo && (
        <RedeemModal memberPhone={memberPhone} memberInfo={memberInfo}
          onSuccess={(updatedMember, reward) => {
            onMemberUpdate?.(updatedMember);
            const rd = parseRewardDiscount(reward);
            if (rd) onApplyRewardDiscount?.(rd);
            setShowRedeem(false);
          }}
          onClose={() => setShowRedeem(false)}
        />
      )}

      {/* ── Pending Orders Drawer ── */}
      {showPending && (
        <div style={S.modalOverlay} onClick={() => setShowPending(false)}>
          <div style={{ ...S.modalContent, width: 340, maxHeight: "80vh", display: "flex", flexDirection: "column" }} onClick={e => e.stopPropagation()}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <h3 style={{ margin: 0, color: "#213547" }}>🗂️ ออเดอร์ที่พักไว้</h3>
              <button onClick={() => setShowPending(false)} style={{ background: "none", border: "none", fontSize: 22, cursor: "pointer", color: "#555" }}>✕</button>
            </div>

            {/* save current cart */}
            {cart.length > 0 && (
              <div style={{ marginBottom: 14, padding: 12, background: "#f5f5f5", borderRadius: 10 }}>
                <div style={{ fontSize: 13, color: "#555", marginBottom: 8 }}>พักออเดอร์ปัจจุบัน ({cart.length} รายการ)</div>
                <div style={{ display: "flex", gap: 8 }}>
                  <input
                    value={pendingLabel}
                    onChange={e => setPendingLabel(e.target.value)}
                    placeholder="ชื่อออเดอร์ (เช่น โต๊ะ 3)"
                    style={{ flex: 1, padding: "7px 10px", borderRadius: 8, border: "1px solid #bbb", background: "#fff", color: "#213547", fontSize: 13, outline: "none" }}
                  />
                  <button onClick={() => {
                    onSavePending?.(pendingLabel);
                    setPendingLabel("");
                    setShowPending(false);
                  }} style={{ background: "#213547", color: "#fff", border: "none", borderRadius: 8, padding: "7px 14px", fontWeight: "bold", fontSize: 13, cursor: "pointer" }}>
                    พัก
                  </button>
                </div>
              </div>
            )}

            {/* list */}
            <div style={{ flex: 1, overflowY: "auto" }}>
              {pendingOrders.length === 0 ? (
                <div style={{ textAlign: "center", color: "#aaa", padding: "30px 0", fontSize: 14 }}>ยังไม่มีออเดอร์ที่พักไว้</div>
              ) : (
                pendingOrders.map(p => (
                  <div key={p.id} style={{ background: "#f9f9f9", border: "1px solid #eee", borderRadius: 10, padding: "10px 12px", marginBottom: 8 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 6 }}>
                      <div>
                        <div style={{ fontWeight: "bold", fontSize: 14, color: "#213547" }}>
                          {p.label || "ออเดอร์ไม่มีชื่อ"}
                        </div>
                        <div style={{ fontSize: 11, color: "#aaa", marginTop: 2 }}>
                          {new Date(p.savedAt).toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" })} · {p.cart.length} รายการ · ฿{p.cart.reduce((s, i) => s + i.price * i.qty, 0).toLocaleString()}
                        </div>
                      </div>
                      <button onClick={() => onDeletePending?.(p.id)}
                        style={{ background: "none", border: "none", color: "#e53935", cursor: "pointer", fontSize: 18, lineHeight: 1, padding: 2 }}>✕</button>
                    </div>
                    <div style={{ fontSize: 12, color: "#777", marginBottom: 8 }}>
                      {p.cart.slice(0, 3).map((item, i) => <span key={i}>{item.name}{i < Math.min(p.cart.length, 3) - 1 ? ", " : ""}</span>)}
                      {p.cart.length > 3 && <span> +{p.cart.length - 3} อื่นๆ</span>}
                    </div>
                    <button onClick={() => { onRestorePending?.(p); setShowPending(false); }}
                      style={{ width: "100%", background: "#213547", color: "#fff", border: "none", borderRadius: 8, padding: "8px", fontWeight: "bold", fontSize: 13, cursor: "pointer" }}>
                      ดึงกลับมา
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const S = {
  container:   { display: "flex", flexDirection: "column", height: "100%", padding: "15px", backgroundColor: "#ff9800", boxSizing: "border-box" },
  header:      { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 },
  btnClear:    { background: "rgba(255,255,255,0.3)", border: "1px solid #213547", padding: "4px 10px", borderRadius: 6, cursor: "pointer", fontSize: 13, color: "#213547" },
  cartList:    { flex: 1, overflowY: "auto", marginBottom: 10 },
  emptyText:   { textAlign: "center", marginTop: 50, color: "rgba(33,53,71,0.45)", fontSize: 15 },
  cartItem:    { backgroundColor: "#fff", padding: "10px 12px", borderRadius: 10, marginBottom: 8, display: "flex", alignItems: "center", gap: 10, color: "#333" },
  itemName:    { fontWeight: "bold", fontSize: 14 },
  badge:       { fontSize: 10, background: "#213547", color: "#fff", padding: "2px 6px", borderRadius: 4 },
  modifierText:{ fontSize: 11, color: "#888", fontStyle: "italic", marginTop: 2 },
  itemDetail:  { fontSize: 13, color: "#555", marginTop: 3 },
  itemActions: { display: "flex", alignItems: "center", gap: 8, flexShrink: 0 },
  qtyControl:  { display: "flex", alignItems: "center", backgroundColor: "#f0f0f0", borderRadius: 8, border: "1px solid #ddd", overflow: "hidden" },
  qtyBtn:      { width: 30, height: 30, background: "none", border: "none", color: "#213547", fontSize: 18, fontWeight: "bold", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", padding: 0 },
  qtyNum:      { minWidth: 28, textAlign: "center", fontWeight: "bold", fontSize: 14, color: "#213547", borderLeft: "1px solid #ddd", borderRight: "1px solid #ddd", height: 30, display: "flex", alignItems: "center", justifyContent: "center" },
  btnDelete:   { background: "none", border: "none", cursor: "pointer", display: "flex", alignItems: "center", padding: 4, borderRadius: 6 },
  footer:      { backgroundColor: "rgba(255,255,255,0.2)", padding: 14, borderRadius: 14 },
  summaryRow:  { fontSize: 12, marginBottom: 4, display: "flex", justifyContent: "space-between" },
  totalRow:    { display: "flex", justifyContent: "space-between", fontSize: "1.3rem", fontWeight: "bold", color: "#213547", marginBottom: 12 },
  btnPay:      { width: "100%", padding: 14, borderRadius: 10, border: "none", color: "#fff", fontSize: "1.1rem", fontWeight: "bold" },
  input:       { padding: "8px 10px", borderRadius: 8, border: "1px solid #ddd", fontSize: 14, outline: "none", boxSizing: "border-box" },
  inputModal:  { width: "100%", padding: 12, borderRadius: 8, border: "1px solid #ddd", fontSize: 18, textAlign: "center", boxSizing: "border-box", color: "#333" },
  btnSmall:    { background: "#fff", border: "1px solid #ddd", borderRadius: 6, padding: "5px 10px", fontSize: 12, cursor: "pointer" },
  modalOverlay:{ position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.7)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 },
  modalContent:{ backgroundColor: "#fff", padding: 24, borderRadius: 18, width: 320, color: "#333" },
  totalDisplay:{ backgroundColor: "#f5f5f5", padding: 14, borderRadius: 10, textAlign: "center", marginBottom: 18 },
  btnMethod:   { flex: 1, padding: 10, borderRadius: 8, border: "none", fontWeight: "bold", cursor: "pointer" },
  btnConfirm:  { flex: 2, padding: 12, borderRadius: 8, border: "none", backgroundColor: "#213547", color: "#fff", fontWeight: "bold" },
  btnCancel:   { flex: 1, padding: 12, borderRadius: 8, border: "1px solid #ddd", backgroundColor: "#fff", cursor: "pointer", color: "#333" },
};
