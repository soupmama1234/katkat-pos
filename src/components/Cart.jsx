import React, { useState } from "react";
import { Trash2 } from "lucide-react";
import { supabase as sb } from "../supabase";
import { calcPoints, nextThreshold, getPointSettings } from "../utils/points";
import RedeemModal from "./RedeemModal";
import { parseRewardDiscount } from "../utils/discounts";
import { groupAvailableCoupons } from "../utils/coupons";

export default function Cart({
  // cart
  cart = [], decreaseQty, increaseQty, addToCart, total = 0,
  onCheckout, onClearCart,
  subtotal = 0, discountTotal = 0, discounts = [],
  onApplyManualDiscount, onApplyRewardDiscount, onRemoveDiscount, onClearDiscounts,
  // channel — lifted, comes from App
  priceChannel = "pos",
  // order meta — lifted, comes from App
  orderType = "dine_in", setOrderType,
  tableNumber = "", setTableNumber,
  deliveryRef = "", setDeliveryRef,
  // member — ALL lifted, comes from App
  memberPhone = "",
  memberInfo, onMemberUpdate, memberStatus, setMemberStatus,
  memberInput = "", setMemberInput,
  showRegister = false, setShowRegister,
  regNickname = "", setRegNickname,
  lookupMember, registerMember, clearMember,
  // ui
  showToast, showConfirm,
}) {
  // ── local UI-only state (ไม่ต้อง share ข้าม component) ──
  const [showPayment, setShowPayment] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState("cash");
  const [cashReceived, setCashReceived] = useState("");
  const [showRedeem, setShowRedeem] = useState(false);
  const [discountMode, setDiscountMode] = useState("amount");
  const [discountInput, setDiscountInput] = useState("");

  const isDelivery = ["grab", "lineman", "shopee"].includes(priceChannel);
  const receivedNumber = Number(cashReceived) || 0;
  const change = receivedNumber - total;

  const { rate, tiers } = getPointSettings();
  const pointsWillEarn = memberPhone ? calcPoints(total, rate, tiers) : 0;
  const nextTier = nextThreshold(total, tiers);
  const needMore = nextTier ? nextTier.minSpend - total : null;
  const currentMultiplier = [...tiers].sort((a, b) => b.minSpend - a.minSpend).find(t => total >= t.minSpend)?.multiplier || 1;
  const isBonus = currentMultiplier > 1;

  // ── reset cash received เมื่อเปิด modal ──
  React.useEffect(() => {
    if (showPayment) setCashReceived("");
  }, [showPayment]);

  // ── mark coupon used (optimistic + Supabase sync) ──
  const markCouponUsed = async (couponId) => {
    if (!memberInfo || !memberPhone) return;
    const updatedRewards = (memberInfo.redeemed_rewards || []).map(r =>
      r.id === couponId ? { ...r, used_at: new Date().toISOString() } : r
    );
    onMemberUpdate?.({ ...memberInfo, redeemed_rewards: updatedRewards });
    try {
      await sb.from("members").update({ redeemed_rewards: updatedRewards }).eq("phone", memberPhone);
    } catch (e) { console.warn("markCouponUsed error:", e); }
  };

  // ── delivery ref input handler — validation ตามช่องทาง ──
  const handleRefChange = (val) => {
    if (priceChannel === "grab") {
      // force prefix GF- เสมอ
      const digits = val.replace(/^GF-/i, "").replace(/\D/g, "");
      setDeliveryRef("GF-" + digits);
    } else if (priceChannel === "lineman") {
      if (val.replace(/\D/g, "").length <= 4) setDeliveryRef(val.replace(/\D/g, ""));
    } else {
      setDeliveryRef(val);
    }
  };

  // ── checkout: ส่งแค่ paymentMethod, App จัดการ state ทั้งหมดเอง ──
  const handleFinalConfirm = () => {
    onCheckout(paymentMethod);
    setShowPayment(false);
    setCashReceived("");
  };

  const isConfirmDisabled =
    (!isDelivery && paymentMethod === "cash" && (cashReceived === "" || change < 0)) ||
    (isDelivery && (
      !deliveryRef ||
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
      {/* ── Header ── */}
      <div style={S.header}>
        <h2 style={{ margin: 0, color: "#213547", fontSize: "1.1rem" }}>รายการขาย</h2>
        <button onClick={() => cart.length > 0 && onClearCart()} style={S.btnClear}>ล้างตะกร้า</button>
      </div>

      {/* ── Order Type: ทานที่ร้าน / กลับบ้าน (POS only) ── */}
      {!isDelivery && (
        <div style={S.orderTypeBar}>
          {[
            { key: "dine_in",  label: "🍽️ ทานที่ร้าน" },
            { key: "takeaway", label: "🥡 กลับบ้าน"   },
          ].map(({ key, label }) => (
            <button
              key={key}
              onClick={() => { setOrderType(key); if (key === "takeaway") setTableNumber(""); }}
              style={{
                ...S.orderTypeBtn,
                background: orderType === key ? "#213547" : "#f0f0f0",
                color:      orderType === key ? "#fff"    : "#555",
                fontWeight: orderType === key ? "bold"    : "normal",
              }}
            >
              {label}
            </button>
          ))}
          {orderType === "dine_in" && (
            <input
              type="text" inputMode="numeric" placeholder="โต๊ะ (optional)"
              value={tableNumber} onChange={e => setTableNumber(e.target.value)}
              style={S.tableInput} maxLength={4}
            />
          )}
        </div>
      )}

      {/* ── Delivery Ref (Delivery channels only) ── */}
      {isDelivery && (
        <div style={S.deliveryRefSection}>
          <div style={{ fontSize: 11, color: "#213547", fontWeight: "bold", marginBottom: 6, textTransform: "uppercase", letterSpacing: 0.5 }}>
            📋 เลขอ้างอิง {priceChannel.toUpperCase()}
          </div>
          <div style={{ display: "flex", alignItems: "center", background: "#fff", borderRadius: 8, border: "1px solid #ddd", overflow: "hidden" }}>
            {priceChannel === "grab" && (
              <span style={{ padding: "0 10px", color: "#00B14F", fontWeight: "bold", fontSize: 15, borderRight: "1px solid #ddd", whiteSpace: "nowrap" }}>
                GF-
              </span>
            )}
            <input
              type="text" inputMode="numeric"
              placeholder={priceChannel === "lineman" ? "เลข 4 หลัก" : "ระบุเลขอ้างอิง"}
              value={priceChannel === "grab" ? deliveryRef.replace("GF-", "") : deliveryRef}
              onChange={e => handleRefChange(priceChannel === "grab" ? "GF-" + e.target.value : e.target.value)}
              style={{ flex: 1, padding: "10px 12px", border: "none", outline: "none", fontSize: 16, color: "#333" }}
              autoFocus
            />
          </div>
        </div>
      )}

      {/* ── Member Section (POS only) ── */}
      {!isDelivery && (
        <div style={S.memberSection}>
          {memberStatus === "found" && memberInfo ? (
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: total > 0 ? 8 : 0 }}>
                <div style={{ flex: 1 }}>
                  <span style={{ color: "#2e7d32", fontWeight: "bold", fontSize: 13 }}>👤 {memberInfo.nickname}</span>
                  <span style={{ color: "#888", fontSize: 12, marginLeft: 8 }}>⭐ {memberInfo.points} แต้ม · {memberInfo.tier || "Standard"}</span>
                </div>
                <button onClick={() => setShowRedeem(true)} style={{ ...S.btnSmall, background: "#f5c518", border: "none", fontWeight: "bold", marginRight: 4 }}>🎁 แลก</button>
                <button onClick={clearMember} style={{ ...S.btnSmall, background: "#eee", border: "1px solid #bbb", color: "#333", fontWeight: "bold" }}>เปลี่ยน</button>
              </div>

              {/* Available Coupons */}
              {(() => {
                const couponGroups = groupAvailableCoupons(memberInfo.redeemed_rewards);
                if (couponGroups.length === 0) return null;
                return (
                  <div style={{ marginBottom: 10, padding: "8px 10px", background: "#fff", borderRadius: 10, border: "1px solid #eee" }}>
                    <div style={{ fontSize: 11, color: "#999", fontWeight: "bold", marginBottom: 6, textTransform: "uppercase" }}>คูปองที่แลกไว้</div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                      {couponGroups.map((group, idx) => (
                        <div key={idx} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: "#f8f9fa", padding: "6px 8px", borderRadius: 8, border: "1px solid #f0f0f0" }}>
                          <span style={{ fontSize: 12, color: "#2e7d32", fontWeight: "bold", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", marginRight: 8 }}>
                            🎁 {group.name} {group.count > 1 && <span style={{ color: "#4caf50" }}>x{group.count}</span>}
                          </span>
                          <button
                            onClick={async () => {
                              const coupon = group.sampleReward;
                              await markCouponUsed(coupon.id);
                              const rd = parseRewardDiscount(coupon);
                              if (rd) onApplyRewardDiscount?.({ ...rd, couponId: coupon.id });
                              else addToCart?.({ id: `coupon-${coupon.id}`, name: `🎁 ${coupon.name}`, price: 0, qty: 1, category: "reward", modifierGroups: [], couponId: coupon.id });
                              showToast?.(`ใช้คูปอง "${coupon.name}" แล้ว`);
                            }}
                            style={{ background: "#4caf50", color: "#fff", border: "none", borderRadius: 6, padding: "2px 10px", fontSize: 11, fontWeight: "bold", cursor: "pointer", flexShrink: 0 }}
                          >ใช้</button>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })()}

              {/* Bonus Progress */}
              {total > 0 && (
                <div style={{ background: "#f9f9f9", borderRadius: 10, padding: "8px 12px" }}>
                  {nextTier ? (
                    <>
                      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                        <span style={{ fontSize: 12, color: isBonus ? "#e65100" : "#555" }}>
                          ⭐ จะได้ <strong>{pointsWillEarn}</strong> แต้ม
                          {isBonus && <span style={{ color: "#e65100", marginLeft: 4 }}>({currentMultiplier}x 🔥)</span>}
                        </span>
                        <span style={{ fontSize: 12, color: "#ff9800", fontWeight: "bold" }}>อีก ฿{needMore} → {nextTier.multiplier}x 🚀</span>
                      </div>
                      <div style={{ height: 6, background: "#e0e0e0", borderRadius: 4, overflow: "hidden" }}>
                        <div style={{ height: "100%", borderRadius: 4, background: isBonus ? "linear-gradient(90deg,#ff9800,#f5c518)" : "linear-gradient(90deg,#4caf50,#8bc34a)", width: `${Math.min(100, (total / nextTier.minSpend) * 100)}%`, transition: "width 0.3s ease" }} />
                      </div>
                    </>
                  ) : (
                    <div style={{ fontSize: 12, color: "#e65100", fontWeight: "bold" }}>⭐ จะได้ {pointsWillEarn} แต้ม · {currentMultiplier}x 🔥 MAX BONUS!</div>
                  )}
                </div>
              )}
            </div>
          ) : showRegister ? (
            <div>
              <div style={{ fontSize: 12, color: "#e65100", marginBottom: 6 }}>✨ สมัครสมาชิกใหม่ · {memberInput}</div>
              <div style={{ display: "flex", gap: 6 }}>
                <input
                  placeholder="ชื่อเล่น" value={regNickname}
                  onChange={e => setRegNickname(e.target.value)}
                  style={{ ...S.input, flex: 1 }} autoFocus
                />
                <button onClick={registerMember} style={{ ...S.btnSmall, background: "#2e7d32", color: "#fff", border: "none" }}>บันทึก</button>
                <button onClick={clearMember} style={{ ...S.btnSmall, color: "#333" }}>✕</button>
              </div>
            </div>
          ) : (
            <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
              <input
                type="tel" inputMode="numeric" placeholder="👤 เบอร์สมาชิก (optional)"
                value={memberInput}
                onChange={e => { setMemberInput(e.target.value); setMemberStatus("idle"); }}
                onBlur={e => lookupMember(e.target.value)}
                onKeyDown={e => e.key === "Enter" && lookupMember(memberInput)}
                style={{ ...S.input, flex: 1 }}
              />
              {memberStatus === "loading" && <span style={{ fontSize: 12, color: "#aaa" }}>🔍</span>}
              {memberStatus === "notfound" && memberInput.length >= 9 && (
                <button onClick={() => setShowRegister(true)} style={{ ...S.btnSmall, background: "#ff9800", color: "#fff", border: "none", whiteSpace: "nowrap" }}>+ สมัคร</button>
              )}
            </div>
          )}
        </div>
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
                <span style={S.qtyNumber}>{item.qty}</span>
                <button onClick={() => increaseQty(item.id, item.channel, item.selectedModifier?.id)} style={S.qtyBtn}>+</button>
              </div>
              <button
                onClick={() => { for (let i = 0; i < item.qty; i++) decreaseQty(item.id, item.channel, item.selectedModifier?.id); }}
                style={S.btnDelete}
              >
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
            <div style={{ fontSize: 12, color: "#213547", marginBottom: 4, display: "flex", justifyContent: "space-between" }}>
              <span>ยอดก่อนลด</span><span>฿{subtotal.toLocaleString()}</span>
            </div>
            <div style={{ fontSize: 12, color: "#2e7d32", marginBottom: 6, display: "flex", justifyContent: "space-between" }}>
              <span>ส่วนลดรวม</span><span>-฿{discountTotal.toLocaleString()}</span>
            </div>
          </>
        )}
        <div style={S.totalRow}>
          <span>รวมทั้งหมด:</span><span>฿{total.toLocaleString()}</span>
        </div>

        {/* discount input */}
        <div style={{ display: "flex", gap: 6, marginBottom: 10, alignItems: "center" }}>
          <select value={discountMode} onChange={e => setDiscountMode(e.target.value)} style={{ ...S.input, width: 70, padding: "6px 4px", fontSize: 13, color: "#333" }}>
            <option value="amount">฿</option>
            <option value="percent">%</option>
          </select>
          <input value={discountInput} onChange={e => setDiscountInput(e.target.value)} placeholder="ลด" type="number" inputMode="decimal"
            style={{ ...S.input, flex: 1, padding: "6px 8px", minWidth: 0, color: "#333" }} />
          <button onClick={handleApplyDiscount} style={{ ...S.btnSmall, background: "#213547", color: "#fff", border: "none", fontWeight: "bold", padding: "6px 12px" }}>ใช้</button>
          <button onClick={() => onClearDiscounts?.()} style={{ ...S.btnSmall, color: "#333", padding: "6px 8px" }}>ล้าง</button>
        </div>
        {discounts.length > 0 && (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 10 }}>
            {discounts.map(d => (
              <button key={d.id} onClick={() => onRemoveDiscount?.(d.id)} style={{ background: "#f3f3f3", border: "1px solid #ddd", borderRadius: 14, padding: "4px 8px", fontSize: 11, cursor: "pointer", color: "#333" }}>
                {d.label || "ส่วนลด"} ✕
              </button>
            ))}
          </div>
        )}

        <button
          style={{ ...S.btnPay, backgroundColor: cart.length > 0 ? "#213547" : "#999", cursor: cart.length > 0 ? "pointer" : "not-allowed" }}
          onClick={() => cart.length > 0 && setShowPayment(true)}
        >
          {isDelivery ? `💾 บันทึก ${priceChannel.toUpperCase()}` : "💰 ชำระเงิน"}
        </button>
      </div>

      {/* ── Payment Modal ── */}
      {showPayment && (
        <div style={S.modalOverlay} onClick={() => setShowPayment(false)}>
          <div style={S.modalContent} onClick={e => e.stopPropagation()}>
            <h3 style={{ marginTop: 0 }}>{isDelivery ? "ยืนยันการบันทึก" : "การชำระเงิน"}</h3>

            {/* order type summary */}
            {!isDelivery && (
              <div style={{ textAlign: "center", marginBottom: 12 }}>
                <span style={{ fontSize: 13, background: "#f5f5f5", padding: "4px 14px", borderRadius: 20, color: "#555", fontWeight: "bold" }}>
                  {orderType === "dine_in" ? "🍽️ ทานที่ร้าน" : "🥡 กลับบ้าน"}
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
                <div style={{ fontSize: 18, fontWeight: "bold", color: "#213547", marginBottom: 4 }}>
                  {priceChannel === "grab" ? deliveryRef : `${priceChannel.toUpperCase()} · ${deliveryRef}`}
                </div>
                <p style={{ color: "#bbb", fontSize: 11, marginTop: 8 }}>ออเดอร์จะไปรอที่ Dashboard เพื่อใส่ยอดรับจริง</p>
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

      {/* ── Redeem Modal ── */}
      {showRedeem && memberInfo && (
        <RedeemModal
          memberPhone={memberPhone} memberInfo={memberInfo}
          onSuccess={(updatedMember, reward) => {
            onMemberUpdate?.(updatedMember);
            const rd = parseRewardDiscount(reward);
            if (rd) onApplyRewardDiscount?.(rd);
            else addToCart?.({ id: `reward-${reward.id}`, name: `🎁 ${reward.name}`, price: 0, qty: 1, category: "reward", modifierGroups: [] });
            setShowRedeem(false);
          }}
          onClose={() => setShowRedeem(false)}
        />
      )}
    </div>
  );
}

const S = {
  container: { display: "flex", flexDirection: "column", height: "100%", padding: "15px", backgroundColor: "#ff9800", boxSizing: "border-box" },
  header: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 },
  btnClear: { background: "rgba(255,255,255,0.3)", border: "1px solid #213547", padding: "4px 10px", borderRadius: 6, cursor: "pointer", fontSize: 13, color: "#213547" },
  orderTypeBar: { display: "flex", gap: 6, alignItems: "center", marginBottom: 10, background: "rgba(255,255,255,0.9)", borderRadius: 12, padding: "8px 10px" },
  orderTypeBtn: { flex: 1, padding: "8px 0", borderRadius: 8, border: "none", fontSize: 13, cursor: "pointer", transition: "all 0.15s" },
  tableInput: { width: 80, padding: "7px 8px", borderRadius: 8, border: "1.5px solid #213547", fontSize: 14, textAlign: "center", outline: "none", color: "#213547", fontWeight: "bold", background: "#fff" },
  deliveryRefSection: { background: "rgba(255,255,255,0.9)", borderRadius: 12, padding: "10px 12px", marginBottom: 10 },
  memberSection: { background: "rgba(255,255,255,0.9)", borderRadius: 12, padding: "10px 12px", marginBottom: 10 },
  cartList: { flex: 1, overflowY: "auto", marginBottom: 10 },
  emptyText: { textAlign: "center", marginTop: 50, color: "rgba(33,53,71,0.45)", fontSize: 15 },
  cartItem: { backgroundColor: "#fff", padding: "10px 12px", borderRadius: 10, marginBottom: 8, display: "flex", alignItems: "center", gap: 10, color: "#333" },
  itemName: { fontWeight: "bold", fontSize: 14 },
  badge: { fontSize: 10, background: "#213547", color: "#fff", padding: "2px 6px", borderRadius: 4 },
  modifierText: { fontSize: 11, color: "#888", fontStyle: "italic", marginTop: 2 },
  itemDetail: { fontSize: 13, color: "#555", marginTop: 3 },
  itemActions: { display: "flex", alignItems: "center", gap: 8, flexShrink: 0 },
  qtyControl: { display: "flex", alignItems: "center", backgroundColor: "#f0f0f0", borderRadius: 8, border: "1px solid #ddd", overflow: "hidden" },
  qtyBtn: { width: 30, height: 30, background: "none", border: "none", color: "#213547", fontSize: 18, fontWeight: "bold", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", lineHeight: 1, padding: 0 },
  qtyNumber: { minWidth: 28, textAlign: "center", fontWeight: "bold", fontSize: 14, color: "#213547", borderLeft: "1px solid #ddd", borderRight: "1px solid #ddd", height: 30, display: "flex", alignItems: "center", justifyContent: "center" },
  btnDelete: { background: "none", border: "none", cursor: "pointer", display: "flex", alignItems: "center", padding: 4, borderRadius: 6 },
  footer: { backgroundColor: "rgba(255,255,255,0.2)", padding: 14, borderRadius: 14 },
  totalRow: { display: "flex", justifyContent: "space-between", fontSize: "1.3rem", fontWeight: "bold", color: "#213547", marginBottom: 12 },
  btnPay: { width: "100%", padding: 14, borderRadius: 10, border: "none", color: "#fff", fontSize: "1.1rem", fontWeight: "bold" },
  input: { padding: "8px 10px", borderRadius: 8, border: "1px solid #ddd", fontSize: 14, outline: "none", boxSizing: "border-box", color: "#333" },
  inputModal: { width: "100%", padding: 12, borderRadius: 8, border: "1px solid #ddd", fontSize: 18, textAlign: "center", boxSizing: "border-box", color: "#333" },
  btnSmall: { background: "#fff", border: "1px solid #ddd", borderRadius: 6, padding: "5px 10px", fontSize: 12, cursor: "pointer", color: "#333" },
  modalOverlay: { position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.7)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 },
  modalContent: { backgroundColor: "#fff", padding: 24, borderRadius: 18, width: 320, color: "#333" },
  totalDisplay: { backgroundColor: "#f5f5f5", padding: 14, borderRadius: 10, textAlign: "center", marginBottom: 18 },
  btnMethod: { flex: 1, padding: 10, borderRadius: 8, border: "none", fontWeight: "bold", cursor: "pointer" },
  btnConfirm: { flex: 2, padding: 12, borderRadius: 8, border: "none", backgroundColor: "#213547", color: "#fff", fontWeight: "bold" },
  btnCancel: { flex: 1, padding: 12, borderRadius: 8, border: "1px solid #ddd", backgroundColor: "#fff", cursor: "pointer", color: "#333" },
};
