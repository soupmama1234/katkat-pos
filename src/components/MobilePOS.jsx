import React, { useState } from "react";
import { Trash2 } from "lucide-react";
import { calcPoints, nextThreshold, getPointSettings } from "../utils/points";
import RedeemModal from "./RedeemModal";
import { parseRewardDiscount } from "../utils/discounts";
import ChannelBar from "./pos/ChannelBar.jsx";
import OrderTypeBar from "./pos/OrderTypeBar.jsx";
import DeliveryRefInput from "./pos/DeliveryRefInput.jsx";
import MemberBar from "./pos/MemberBar.jsx";
import ModifierPopup from "./pos/ModifierPopup.jsx";

export default function MobilePOS({
  // products
  products = [], addToCart, increaseQty, decreaseQty, onClearCart,
  categories = [], selectedCategory, setSelectedCategory,
  modifierGroups = [],
  // cart
  cart = [], total = 0, subtotal = 0, discountTotal = 0, discounts = [],
  onCheckout,
  onApplyManualDiscount, onApplyRewardDiscount, onRemoveDiscount, onClearDiscounts,
  // channel — from App
  priceChannel = "pos", setPriceChannel,
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
  const [showCart, setShowCart]           = useState(false);
  const [showRedeem, setShowRedeem]       = useState(false);
  const [customerType, setCustomerType]   = useState(null); // null | "new" | "repeat"
  const [discountMode, setDiscountMode]   = useState("amount");
  const [discountInput, setDiscountInput] = useState("");
  const [modProduct, setModProduct]       = useState(null);
  const [showPending, setShowPending]     = useState(false);
  const [pendingLabel, setPendingLabel]   = useState("");

  const isDelivery = ["grab", "lineman", "shopee"].includes(priceChannel);

  const { rate, tiers } = getPointSettings();
  const pointsWillEarn = memberPhone ? calcPoints(total, rate, tiers) : 0;
  const nextTier = nextThreshold(total, tiers);
  const needMore = nextTier ? nextTier.minSpend - total : null;
  const currentMultiplier = [...tiers].sort((a, b) => b.minSpend - a.minSpend).find(t => total >= t.minSpend)?.multiplier || 1;
  const isBonus = currentMultiplier > 1;

  const getDisplayPrice = (p) =>
    ({ pos: p.price, grab: p.grabPrice, lineman: p.linemanPrice, shopee: p.shopeePrice })[priceChannel] ?? p.price;

  const handleProductClick = (product) => {
    const hasMods = modifierGroups.some(g => product.modifierGroups?.includes(g.id));
    if (hasMods) setModProduct(product);
    else addToCart(product);
  };

  const handleConfirmCheckout = (paymentMethod) => {
    onCheckout(paymentMethod, customerType);
    setShowCart(false);
    setCustomerType(null);
  };

  const handleApplyDiscount = () => {
    const value = Number(discountInput);
    if (!(value > 0)) return;
    onApplyManualDiscount?.({ mode: discountMode, value });
    setDiscountInput("");
  };

  const totalQty = cart.reduce((s, i) => s + i.qty, 0);

  const isCheckoutDisabled = isDelivery && (
    !deliveryRef || deliveryRef === "GF-" ||
    (priceChannel === "grab" && deliveryRef.replace("GF-", "").length < 3) ||
    (priceChannel === "lineman" && deliveryRef.length < 4)
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", backgroundColor: "#000", position: "relative" }}>

      {/* 1. Category bar */}
      <div style={st.categoryBar}>
        {categories.map(cat => (
          <button key={cat} onClick={() => setSelectedCategory(cat)}
            style={{ ...st.catBtn, backgroundColor: selectedCategory === cat ? "#fff" : "#222", color: selectedCategory === cat ? "#000" : "#fff" }}>
            {cat}
          </button>
        ))}
      </div>

      {/* 2. ── shared: Channel bar ── */}
      <ChannelBar priceChannel={priceChannel} setPriceChannel={setPriceChannel} variant="dark" />

      {/* 3. ── shared: Order type bar (POS only) ── */}
      {!isDelivery && (
        <OrderTypeBar
          orderType={orderType} setOrderType={setOrderType}
          tableNumber={tableNumber} setTableNumber={setTableNumber}
          variant="dark"
        />
      )}

      {/* 4. ── shared: Delivery ref (delivery only) ── */}
      {isDelivery && (
        <DeliveryRefInput
          priceChannel={priceChannel}
          deliveryRef={deliveryRef} setDeliveryRef={setDeliveryRef}
          variant="dark"
        />
      )}

      {/* 5. ── shared: Member bar (POS only) ── */}
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
          variant="dark"
          showPointsPreview={false}
          onOpenRedeem={() => setShowRedeem(true)}
        />
      )}

      {/* 6. Product grid */}
      <div style={st.productGrid}>
        {products
          .filter(p => !selectedCategory || selectedCategory === "All" || p.category === selectedCategory)
          .map(p => {
            const hasMods = modifierGroups.some(g => p.modifierGroups?.includes(g.id));
            return (
              <button key={p.id} onClick={() => handleProductClick(p)} style={st.productCard}>
                <div style={{ fontSize: 15, fontWeight: "bold", marginBottom: 6, lineHeight: 1.3 }}>{p.name}</div>
                <div style={{ color: "#4caf50", fontWeight: "bold", fontSize: 16 }}>฿{(getDisplayPrice(p) || 0).toLocaleString()}</div>
                {hasMods && <div style={st.modBadge}>⚙️ มีตัวเลือก</div>}
              </button>
            );
          })}
      </div>

      {/* 7. Floating cart button — แสดงตลอด */}
      {!showCart && (
        <button style={{
          ...st.floatingCart,
          backgroundColor: cart.length > 0 ? "#4caf50" : "#222",
          color: cart.length > 0 ? "#000" : "#fff",
          border: cart.length > 0 ? "none" : "1px solid #444",
        }} onClick={() => setShowCart(true)}>
          <span style={{ fontSize: 20 }}>🛒</span>
          {cart.length > 0 && <span>฿{total.toLocaleString()}</span>}
          {(cart.length > 0 || pendingOrders.length > 0) && (
            <span style={{ background: cart.length > 0 ? "rgba(0,0,0,0.15)" : "#e53935", color: cart.length > 0 ? "#000" : "#fff", borderRadius: 10, padding: "1px 7px", fontSize: 12, fontWeight: "bold" }}>
              {cart.length > 0 ? totalQty : `พัก ${pendingOrders.length}`}
            </span>
          )}
        </button>
      )}

      {/* 8. Cart overlay */}
      {showCart && (
        <div style={st.cartOverlay}>
          {/* header */}
          <div style={st.cartHeader}>
            <div>
              <h3 style={{ margin: 0, color: "#fff" }}>ตะกร้าสินค้า</h3>
              <span style={{ fontSize: 12, color: "#888" }}>
                {priceChannel.toUpperCase()}
                {!isDelivery && (
                  <span style={{ color: "#fff", marginLeft: 6 }}>
                    · {orderType === "dine_in" ? "🍽️ ทานที่ร้าน" : "🛍️ กลับบ้าน"}
                    {orderType === "dine_in" && tableNumber ? ` โต๊ะ ${tableNumber}` : ""}
                  </span>
                )}
                {isDelivery && deliveryRef && deliveryRef !== "GF-" && (
                  <span style={{ color: "#4caf50", marginLeft: 6 }}>· {deliveryRef}</span>
                )}
              </span>
            </div>
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <button onClick={() => setShowPending(true)} style={{ background: "#222", border: "1px solid #444", borderRadius: 8, color: "#fff", padding: "6px 12px", fontSize: 13, cursor: "pointer", position: "relative" }}>
                🗂️ พัก
                {pendingOrders.length > 0 && (
                  <span style={{ position: "absolute", top: -6, right: -6, background: "#e53935", color: "#fff", borderRadius: "50%", width: 18, height: 18, fontSize: 10, fontWeight: "bold", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    {pendingOrders.length}
                  </span>
                )}
              </button>
              <button onClick={() => setShowCart(false)} style={{ background: "none", border: "none", color: "#fff", fontSize: 26, cursor: "pointer", lineHeight: 1 }}>✕</button>
            </div>
          </div>

          {/* cart items */}
          <div style={st.cartList}>
            {cart.map((item, idx) => (
              <div key={`${item.id}-${idx}`} style={st.cartItem}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: "bold", fontSize: 15, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{item.name}</div>
                  {item.selectedModifier && <div style={{ fontSize: 12, color: "#aaa", fontStyle: "italic" }}>• {item.selectedModifier.name}</div>}
                  <div style={{ fontSize: 13, color: "#888", marginTop: 2 }}>
                    ฿{item.price.toLocaleString()} × {item.qty} = <strong style={{ color: "#fff" }}>฿{(item.price * item.qty).toLocaleString()}</strong>
                  </div>
                </div>
                <div style={st.qtyControl}>
                  <button onClick={() => decreaseQty(item.id, item.channel, item.selectedModifier?.id)} style={st.qtyBtn}>−</button>
                  <span style={st.qtyNum}>{item.qty}</span>
                  <button onClick={() => increaseQty(item.id, item.channel, item.selectedModifier?.id)} style={st.qtyBtn}>+</button>
                </div>
                <button onClick={() => { for (let i = 0; i < item.qty; i++) decreaseQty(item.id, item.channel, item.selectedModifier?.id); }}
                  style={{ background: "none", border: "none", cursor: "pointer", padding: 4 }}>
                  <Trash2 size={18} color="#ff5252" />
                </button>
              </div>
            ))}
            <button onClick={onClearCart} style={st.btnClearCart}>
              <Trash2 size={16} /> ล้างตะกร้า
            </button>
          </div>

          {/* footer */}
          <div style={st.cartFooter}>
            {/* points preview */}
            {memberPhone && total > 0 && pointsWillEarn > 0 && (
              <div style={{ marginBottom: 10, padding: "6px 12px", background: "#111", borderRadius: 10, fontSize: 12, color: isBonus ? "#ff9800" : "#4caf50" }}>
                ⭐ {memberInfo?.nickname} · +{pointsWillEarn} แต้ม {isBonus ? `(${currentMultiplier}x 🔥)` : ""}
                {nextTier && <span style={{ color: "#555", marginLeft: 6 }}>อีก ฿{needMore} → {nextTier.multiplier}x</span>}
              </div>
            )}

            {/* discount */}
            <div style={{ display: "flex", gap: 6, marginBottom: 8, alignItems: "center" }}>
              <select value={discountMode} onChange={e => setDiscountMode(e.target.value)}
                style={{ background: "#222", border: "1px solid #444", color: "#fff", borderRadius: 8, padding: "6px 4px", fontSize: 13, width: 55 }}>
                <option value="amount">฿</option>
                <option value="percent">%</option>
              </select>
              <input value={discountInput} onChange={e => setDiscountInput(e.target.value)} placeholder="ลด" type="number" inputMode="decimal"
                style={{ flex: 1, background: "#222", border: "1px solid #444", color: "#fff", borderRadius: 8, padding: "6px 10px", fontSize: 14, outline: "none" }} />
              <button onClick={handleApplyDiscount}
                style={{ background: "#444", border: "none", color: "#fff", borderRadius: 6, padding: "4px 10px", fontSize: 12, cursor: "pointer" }}>ใช้</button>
              <button onClick={() => onClearDiscounts?.()}
                style={{ background: "#222", border: "1px solid #444", color: "#aaa", borderRadius: 6, padding: "4px 10px", fontSize: 12, cursor: "pointer" }}>ล้าง</button>
            </div>
            {discounts.length > 0 && (
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 8 }}>
                {discounts.map(d => (
                  <button key={d.id} onClick={() => onRemoveDiscount?.(d.id)}
                    style={{ background: "#222", border: "1px solid #444", borderRadius: 14, padding: "4px 10px", fontSize: 11, color: "#aaa", cursor: "pointer" }}>
                    {d.label || "ลด"} ✕
                  </button>
                ))}
              </div>
            )}

            {discountTotal > 0 && (
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, color: "#888", marginBottom: 4 }}>
                <span>ยอดก่อนลด</span><span>฿{subtotal.toLocaleString()}</span>
              </div>
            )}
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 20, fontWeight: "bold", color: "#fff", marginBottom: 14 }}>
              <span>รวม</span><span>฿{total.toLocaleString()}</span>
            </div>

            {/* customer type — เฉพาะ non-member */}
            {!isDelivery && !memberPhone && (
              <div style={{ marginBottom: 12 }}>
                <div style={{ fontSize: 11, color: "#888", marginBottom: 6 }}>ประเภทลูกค้า (optional)</div>
                <div style={{ display: "flex", gap: 8 }}>
                  {[["new", "🆕 ใหม่", "#4caf50"], ["repeat", "🔄 ประจำ", "#4D96FF"]].map(([val, label, color]) => (
                    <button key={val} onClick={() => setCustomerType(v => v === val ? null : val)}
                      style={{ flex: 1, padding: "10px", borderRadius: 10, border: customerType === val ? `2px solid ${color}` : "1px solid #444", background: customerType === val ? `${color}22` : "#222", color: customerType === val ? color : "#888", fontWeight: customerType === val ? 700 : 400, cursor: "pointer", fontSize: 13 }}>
                      {label}
                    </button>
                  ))}
                </div>
              </div>
            )}
            {/* checkout buttons */}
            <div style={{ display: "grid", gridTemplateColumns: !isDelivery ? "1fr 1fr" : "1fr", gap: 12 }}>
              {!isDelivery ? (
                <>
                  <button onClick={() => handleConfirmCheckout("cash")} style={{ ...st.payBtn, backgroundColor: "#4caf50" }}>💵 เงินสด</button>
                  <button onClick={() => handleConfirmCheckout("transfer")} style={{ ...st.payBtn, backgroundColor: "#2196f3" }}>📲 โอนเงิน</button>
                </>
              ) : (
                <button
                  onClick={() => !isCheckoutDisabled && handleConfirmCheckout("transfer")}
                  style={{ ...st.payBtn, backgroundColor: isCheckoutDisabled ? "#333" : "#1e293b", opacity: isCheckoutDisabled ? 0.5 : 1, cursor: isCheckoutDisabled ? "not-allowed" : "pointer" }}>
                  💾 บันทึก {priceChannel.toUpperCase()}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 9. ── shared: Modifier popup ── */}
      {modProduct && (
        <ModifierPopup
          product={modProduct}
          modifierGroups={modifierGroups}
          onConfirm={(productWithMod) => { addToCart(productWithMod); setModProduct(null); }}
          onClose={() => setModProduct(null)}
          variant="dark"
        />
      )}

      {/* 10. Redeem modal */}
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

      {/* 11. Pending Orders Drawer */}
      {showPending && (
        <div style={{ position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.85)", zIndex: 3000, display: "flex", alignItems: "flex-end" }}
          onClick={() => setShowPending(false)}>
          <div style={{ backgroundColor: "#1a1a1a", borderRadius: "20px 20px 0 0", padding: 20, width: "100%", maxHeight: "75vh", display: "flex", flexDirection: "column", boxSizing: "border-box" }}
            onClick={e => e.stopPropagation()}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <h3 style={{ margin: 0, color: "#fff" }}>🗂️ ออเดอร์ที่พักไว้</h3>
              <button onClick={() => setShowPending(false)} style={{ background: "none", border: "none", color: "#fff", fontSize: 24, cursor: "pointer" }}>✕</button>
            </div>

            {/* save current cart */}
            {cart.length > 0 && (
              <div style={{ marginBottom: 14, padding: 12, background: "#222", borderRadius: 12 }}>
                <div style={{ fontSize: 13, color: "#ccc", marginBottom: 8 }}>พักออเดอร์ปัจจุบัน ({cart.length} รายการ)</div>
                <div style={{ display: "flex", gap: 8 }}>
                  <input
                    value={pendingLabel}
                    onChange={e => setPendingLabel(e.target.value)}
                    placeholder="ชื่อออเดอร์ (เช่น โต๊ะ 3)"
                    style={{ flex: 1, padding: "8px 12px", borderRadius: 8, border: "1px solid #555", background: "#333", color: "#fff", fontSize: 13, outline: "none" }}
                  />
                  <button onClick={() => {
                    onSavePending?.(pendingLabel);
                    setPendingLabel("");
                    setShowPending(false);
                    setShowCart(false);
                  }} style={{ background: "#4caf50", color: "#fff", border: "none", borderRadius: 8, padding: "8px 16px", fontWeight: "bold", fontSize: 13, cursor: "pointer" }}>
                    พัก
                  </button>
                </div>
              </div>
            )}

            {/* list */}
            <div style={{ flex: 1, overflowY: "auto" }}>
              {pendingOrders.length === 0 ? (
                <div style={{ textAlign: "center", color: "#555", padding: "30px 0", fontSize: 14 }}>ยังไม่มีออเดอร์ที่พักไว้</div>
              ) : (
                pendingOrders.map(p => (
                  <div key={p.id} style={{ background: "#262626", border: "1px solid #333", borderRadius: 12, padding: "12px 14px", marginBottom: 10 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 6 }}>
                      <div>
                        <div style={{ fontWeight: "bold", fontSize: 15, color: "#fff" }}>
                          {p.label || "ออเดอร์ไม่มีชื่อ"}
                        </div>
                        <div style={{ fontSize: 11, color: "#666", marginTop: 2 }}>
                          {new Date(p.savedAt).toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" })} · {p.cart.length} รายการ · ฿{p.cart.reduce((s, i) => s + i.price * i.qty, 0).toLocaleString()}
                        </div>
                      </div>
                      <button onClick={() => onDeletePending?.(p.id)}
                        style={{ background: "none", border: "none", color: "#ff5252", cursor: "pointer", fontSize: 20, lineHeight: 1, padding: 2 }}>✕</button>
                    </div>
                    <div style={{ fontSize: 12, color: "#666", marginBottom: 10 }}>
                      {p.cart.slice(0, 3).map((item, i) => <span key={i}>{item.name}{i < Math.min(p.cart.length, 3) - 1 ? ", " : ""}</span>)}
                      {p.cart.length > 3 && <span> +{p.cart.length - 3} อื่นๆ</span>}
                    </div>
                    <button onClick={() => { onRestorePending?.(p); setShowPending(false); setShowCart(true); }}
                      style={{ width: "100%", background: "#213547", color: "#fff", border: "none", borderRadius: 10, padding: "10px", fontWeight: "bold", fontSize: 14, cursor: "pointer" }}>
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

const st = {
  categoryBar:  { display: "flex", flexWrap: "wrap", padding: "10px 12px", gap: 8, backgroundColor: "#111", borderBottom: "1px solid #333" },
  catBtn:       { padding: "8px 14px", borderRadius: 10, border: "none", fontSize: 13, fontWeight: "bold", cursor: "pointer" },
  productGrid:  { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, padding: 12, overflowY: "auto", flex: 1 },
  productCard:  { backgroundColor: "#1a1a1a", border: "1px solid #333", borderRadius: 16, color: "#fff", padding: "20px 12px", textAlign: "center", cursor: "pointer", display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center" },
  modBadge:     { marginTop: 8, fontSize: 10, color: "#888", background: "#2a2a2a", padding: "3px 8px", borderRadius: 10 },
  floatingCart: { position: "fixed", bottom: 90, right: 16, backgroundColor: "#4caf50", color: "#000", border: "none", borderRadius: 28, padding: "12px 18px", fontSize: 14, fontWeight: "bold", display: "flex", alignItems: "center", gap: 8, zIndex: 100, cursor: "pointer", boxShadow: "0 4px 16px rgba(0,0,0,0.4)" },
  cartOverlay:  { position: "fixed", inset: 0, backgroundColor: "#111", zIndex: 2000, display: "flex", flexDirection: "column" },
  cartHeader:   { padding: 20, borderBottom: "1px solid #333", display: "flex", justifyContent: "space-between", alignItems: "center", backgroundColor: "#1a1a1a", flexShrink: 0 },
  cartList:     { flex: 1, overflowY: "auto", padding: 16 },
  cartItem:     { display: "flex", alignItems: "center", gap: 12, marginBottom: 16, paddingBottom: 16, borderBottom: "1px solid #222" },
  qtyControl:   { display: "flex", alignItems: "center", backgroundColor: "#222", borderRadius: 10, border: "1px solid #444", overflow: "hidden", flexShrink: 0 },
  qtyBtn:       { width: 38, height: 38, background: "none", border: "none", color: "#fff", fontSize: 20, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" },
  qtyNum:       { minWidth: 32, textAlign: "center", fontWeight: "bold", fontSize: 16, color: "#fff", borderLeft: "1px solid #444", borderRight: "1px solid #444", height: 38, display: "flex", alignItems: "center", justifyContent: "center" },
  btnClearCart: { width: "100%", background: "none", border: "1px solid #333", color: "#ff5252", padding: 10, display: "flex", alignItems: "center", justifyContent: "center", gap: 6, borderRadius: 8, cursor: "pointer", marginTop: 8 },
  cartFooter:   { padding: 20, borderTop: "1px solid #333", backgroundColor: "#1a1a1a", flexShrink: 0 },
  payBtn:       { border: "none", padding: 18, borderRadius: 12, color: "#fff", fontWeight: "bold", fontSize: 16, cursor: "pointer" },
};
