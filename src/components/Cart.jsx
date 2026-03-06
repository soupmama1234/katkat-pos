import React, { useState } from "react";
import { Trash2 } from "lucide-react";
import { supabase as sb } from "../supabase";
import { calcPoints, nextThreshold, getPointSettings } from "../utils/points";
import RedeemModal from "./RedeemModal";
import { parseRewardDiscount } from "../utils/discounts";
import { groupAvailableCoupons } from "../utils/coupons";

export default function Cart({
  cart = [], decreaseQty, increaseQty, addToCart, total = 0,
  onCheckout, onClearCart, priceChannel = "pos",
  memberPhone = "", setMemberPhone,
  memberInfo, setMemberInfo, memberStatus, setMemberStatus,
  subtotal = 0, discountTotal = 0, discounts = [],
  onApplyManualDiscount, onApplyRewardDiscount, onRemoveDiscount, onClearDiscounts,
  showToast, showConfirm,
}) {
  const [showPayment, setShowPayment] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState("cash");
  const [cashReceived, setCashReceived] = useState("");
  const [deliveryRef, setDeliveryRef] = useState("");
  const [showRedeem, setShowRedeem] = useState(false);

  // member state (Removed local ones)
  const [memberInput, setMemberInput] = useState("");
  const [showRegister, setShowRegister] = useState(false);
  const [regNickname, setRegNickname] = useState("");
  const [discountMode, setDiscountMode] = useState("amount");
  const [discountInput, setDiscountInput] = useState("");

  const isDelivery = ["grab", "lineman", "shopee"].includes(priceChannel);
  const receivedNumber = Number(cashReceived) || 0;
  const change = receivedNumber - total;

  // ── bonus points ──
  const { rate, tiers } = getPointSettings();
  const pointsWillEarn = memberPhone ? calcPoints(total, rate, tiers) : 0;
  const nextTier = nextThreshold(total, tiers);
  const needMore = nextTier ? nextTier.minSpend - total : null;
  const currentMultiplier = [...tiers].sort((a,b) => b.minSpend - a.minSpend).find(t => total >= t.minSpend)?.multiplier || 1;
  const isBonus = currentMultiplier > 1;

  React.useEffect(() => {
    if (showPayment) {
      setDeliveryRef(priceChannel === "grab" ? "GF-" : "");
      setCashReceived("");
    }
  }, [showPayment, priceChannel]);

  // member lookup
  const lookupMember = async (phone) => {
    if (phone.length < 9) return;
    setMemberStatus("loading");
    try {
      const { data } = await sb.from("members").select("*").eq("phone", phone).single();
      if (data) { setMemberInfo(data); setMemberStatus("found"); setMemberPhone(phone); }
      else { setMemberInfo(null); setMemberStatus("notfound"); setMemberPhone(""); }
    } catch { setMemberInfo(null); setMemberStatus("notfound"); setMemberPhone(""); }
  };

  const registerMember = async () => {
    if (!memberInput || !regNickname) return;
    try {
      const { data } = await sb.from("members").insert({ phone: memberInput, nickname: regNickname }).select().single();
      setMemberInfo(data); setMemberStatus("found"); setMemberPhone(memberInput);
      setShowRegister(false); setRegNickname("");
      showToast?.("สมัครสมาชิกเรียบร้อย ✨");
    } catch (e) { 
      showToast?.("สมัครไม่สำเร็จ: " + e.message, "error"); 
    }
  };

  const clearMember = () => {
    setMemberInput(""); setMemberInfo(null);
    setMemberStatus("idle"); setMemberPhone("");
    setShowRegister(false); setRegNickname("");
  };


  const handleApplyManualDiscount = () => {
    const value = Number(discountInput);
    if (!(value > 0)) return;
    onApplyManualDiscount?.({ mode: discountMode, value });
    setDiscountInput("");
  };

  const handleRefChange = (val) => {
    const upperVal = val.toUpperCase();
    if (priceChannel === "grab") {
      if (upperVal.startsWith("GF-")) {
        setDeliveryRef(upperVal);
      } else if (upperVal === "" || "GF-".startsWith(upperVal)) {
        // ให้พิมพ์ GF- ได้สะดวกขึ้น หรือถ้าลบหมดให้กลับเป็น GF-
        setDeliveryRef("GF-");
      }
    } else {
      setDeliveryRef(upperVal);
    }
  };

  const handleFinalConfirm = () => {
    if (isDelivery) { 
      onCheckout("transfer", deliveryRef); 
    } else { 
      onCheckout(paymentMethod); 
    }
    setShowPayment(false); 
    setCashReceived(""); 
    setDeliveryRef("");
    clearMember();
  };

  const isConfirmDisabled =
    (!isDelivery && paymentMethod === "cash" && (cashReceived === "" || change < 0)) ||
    (isDelivery && (
      !deliveryRef ||
      (priceChannel === "grab" && (deliveryRef === "GF-" || deliveryRef.length < 4)) ||
      (priceChannel !== "pos" && deliveryRef.trim().length === 0)
    ));

  return (
    <div style={S.container}>
      {/* Header */}
      <div style={S.header}>
        <h2 style={{ margin: 0, color: "#213547", fontSize: "1.1rem" }}>รายการขาย</h2>
        <button onClick={() => cart.length > 0 && onClearCart()} style={S.btnClear}>ล้างตะกร้า</button>
      </div>

      {/* --- Delivery Ref Input (Show directly in sidebar) --- */}
      {isDelivery && (
        <div style={{ marginBottom: 10, padding: "10px", background: "rgba(255,255,255,0.9)", borderRadius: 12 }}>
          <div style={{ fontSize: 11, color: "#888", fontWeight: "bold", marginBottom: 6 }}>เลขอ้างอิง {priceChannel.toUpperCase()}</div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <input 
              type="text" 
              placeholder={priceChannel === "grab" ? "ระบุตัวเลข" : "ระบุเลขอ้างอิง"}
              value={deliveryRef} 
              onChange={e => handleRefChange(e.target.value)}
              style={{ ...S.input, flex: 1, fontSize: 16, fontWeight: "bold", color: "#213547" }}
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
                  <span style={{ color: "#2e7d32", fontWeight: "bold", fontSize: 13 }}>
                    👤 {memberInfo.nickname}
                  </span>
                  <span style={{ color: "#888", fontSize: 12, marginLeft: 8 }}>
                    ⭐ {memberInfo.points} แต้ม · {memberInfo.tier || "Standard"}
                  </span>
                </div>
                <button onClick={() => setShowRedeem(true)}
                  style={{ ...S.btnSmall, background: "#f5c518", border: "none", fontWeight: "bold", marginRight: 4 }}>
                  🎁 แลก
                </button>
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
                            onClick={() => {
                              const coupon = group.sampleReward;
                              const rewardDiscount = parseRewardDiscount(coupon);
                              if (rewardDiscount) {
                                onApplyRewardDiscount?.({ ...rewardDiscount, couponId: coupon.id });
                              } else {
                                addToCart?.({
                                  id: `coupon-${coupon.id}`,
                                  name: `🎁 ${coupon.name}`,
                                  price: 0,
                                  qty: 1,
                                  category: "reward",
                                  modifierGroups: [],
                                  couponId: coupon.id
                                });
                              }
                              showToast?.(`ใช้คูปอง "${coupon.name}" แล้ว`);
                            }}
                            style={{ background: "#4caf50", color: "#fff", border: "none", borderRadius: 6, padding: "2px 10px", fontSize: 11, fontWeight: "bold", cursor: "pointer", flexShrink: 0 }}
                          >
                            ใช้
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })()}

              {/* Bonus Progress Bar */}
              {total > 0 && (
                <div style={{ background: "#f9f9f9", borderRadius: 10, padding: "8px 12px" }}>
                  {nextTier ? (
                    <>
                      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                        <span style={{ fontSize: 12, color: isBonus ? "#e65100" : "#555" }}>
                          ⭐ จะได้ <strong>{pointsWillEarn}</strong> แต้ม
                          {isBonus && <span style={{ color: "#e65100", marginLeft: 4 }}>({currentMultiplier}x 🔥)</span>}
                        </span>
                        <span style={{ fontSize: 12, color: "#ff9800", fontWeight: "bold" }}>
                          อีก ฿{needMore} → {nextTier.multiplier}x 🚀
                        </span>
                      </div>
                      <div style={{ height: 6, background: "#e0e0e0", borderRadius: 4, overflow: "hidden" }}>
                        <div style={{
                          height: "100%", borderRadius: 4,
                          background: isBonus ? "linear-gradient(90deg,#ff9800,#f5c518)" : "linear-gradient(90deg,#4caf50,#8bc34a)",
                          width: `${Math.min(100, (total / nextTier.minSpend) * 100)}%`,
                          transition: "width 0.3s ease"
                        }} />
                      </div>
                    </>
                  ) : (
                    <div style={{ fontSize: 12, color: "#e65100", fontWeight: "bold" }}>
                      ⭐ จะได้ {pointsWillEarn} แต้ม · {currentMultiplier}x 🔥 MAX BONUS!
                    </div>
                  )}
                </div>
              )}
            </div>
          ) : showRegister ? (
            <div>
              <div style={{ fontSize: 12, color: "#e65100", marginBottom: 6 }}>✨ สมัครสมาชิกใหม่ · {memberInput}</div>
              <div style={{ display: "flex", gap: 6 }}>
                <input placeholder="ชื่อเล่น" value={regNickname} onChange={e => setRegNickname(e.target.value)}
                  style={{ ...S.input, flex: 1 }} autoFocus />
                <button onClick={registerMember} style={{ ...S.btnSmall, background: "#2e7d32", color: "#fff", border: "none" }}>บันทึก</button>
                <button onClick={clearMember} style={S.btnSmall}>✕</button>
              </div>
            </div>
          ) : (
            <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
              <input type="tel" inputMode="numeric" placeholder="👤 เบอร์สมาชิก (optional)"
                value={memberInput}
                onChange={e => { setMemberInput(e.target.value); setMemberStatus("idle"); }}
                onBlur={e => lookupMember(e.target.value)}
                onKeyDown={e => e.key === "Enter" && lookupMember(memberInput)}
                style={{ ...S.input, flex: 1 }} />
              {memberStatus === "loading" && <span style={{ fontSize: 12, color: "#aaa" }}>🔍</span>}
              {memberStatus === "notfound" && memberInput.length >= 9 && (
                <button onClick={() => setShowRegister(true)} style={{ ...S.btnSmall, background: "#ff9800", color: "#fff", border: "none", whiteSpace: "nowrap" }}>
                  + สมัคร
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {/* Item List */}
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
              <div style={S.itemDetail}>
                ฿{item.price.toLocaleString()} × {item.qty} = <strong>฿{(item.qty * item.price).toLocaleString()}</strong>
              </div>
            </div>
            <div style={S.itemActions}>
              <div style={S.qtyControl}>
                <button onClick={() => decreaseQty(item.id, item.channel, item.selectedModifier?.id)} style={S.qtyBtn}>−</button>
                <span style={S.qtyNumber}>{item.qty}</span>
                <button onClick={() => increaseQty(item.id, item.channel, item.selectedModifier?.id)} style={S.qtyBtn}>+</button>
              </div>
              <button onClick={() => { for (let i = 0; i < item.qty; i++) decreaseQty(item.id, item.channel, item.selectedModifier?.id); }} style={S.btnDelete}>
                <Trash2 size={16} color="#d32f2f" />
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Footer */}
      <div style={S.footer}>
        {discountTotal > 0 && (
          <div style={{ fontSize: 12, color: "#213547", marginBottom: 6, display: "flex", justifyContent: "space-between" }}>
            <span>ยอดก่อนลด</span><span>฿{subtotal.toLocaleString()}</span>
          </div>
        )}
        {discountTotal > 0 && (
          <div style={{ fontSize: 12, color: "#2e7d32", marginBottom: 6, display: "flex", justifyContent: "space-between" }}>
            <span>ส่วนลดรวม</span><span>-฿{discountTotal.toLocaleString()}</span>
          </div>
        )}
        <div style={S.totalRow}>
          <span>รวมทั้งหมด:</span>
          <span>฿{total.toLocaleString()}</span>
        </div>
        <div style={{ display: "flex", gap: 6, marginBottom: 10, alignItems: "center" }}>
          <select value={discountMode} onChange={(e) => setDiscountMode(e.target.value)} style={{ ...S.input, width: "70px", padding: "6px 4px", fontSize: "13px" }}>
            <option value="amount">฿</option>
            <option value="percent">%</option>
          </select>
          <input value={discountInput} onChange={(e) => setDiscountInput(e.target.value)} placeholder="ลด" type="number" inputMode="decimal" style={{ ...S.input, flex: 1, padding: "6px 8px", minWidth: 0 }} />
          <button onClick={handleApplyManualDiscount} style={{ ...S.btnSmall, background: "#000", color: "#fff", border: "1px solid #000", fontWeight: "bold", padding: "6px 12px" }}>ใช้</button>
          <button onClick={() => onClearDiscounts?.()} style={{ ...S.btnSmall, padding: "6px 8px"}}>ล้าง</button>
        </div>
        {discounts.length > 0 && (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 10 }}>
            {discounts.map((d) => (
              <button key={d.id} onClick={() => onRemoveDiscount?.(d.id)} style={{ background: "#f3f3f3", border: "1px solid #ddd", borderRadius: 14, padding: "4px 8px", fontSize: 11, cursor: "pointer" }}>
                {d.label || "ส่วนลด"} · {d.mode === "percent" ? `${d.value}%` : `฿${d.value}`} ✕
              </button>
            ))}
          </div>
        )}
        <button style={{ ...S.btnPay, backgroundColor: cart.length > 0 ? "#213547" : "#999", cursor: cart.length > 0 ? "pointer" : "not-allowed" }}
          onClick={() => cart.length > 0 && setShowPayment(true)}>
          {isDelivery ? `💾 บันทึก ${priceChannel.toUpperCase()}` : "💰 ชำระเงิน"}
        </button>
      </div>

      {/* Payment Modal */}
      {showPayment && (
        <div style={S.modalOverlay} onClick={() => setShowPayment(false)}>
          <div style={S.modalContent} onClick={e => e.stopPropagation()}>
            <h3 style={{ marginTop: 0 }}>{isDelivery ? "ยืนยันการบันทึก" : "การชำระเงิน"}</h3>

            <div style={S.totalDisplay}>
              <div style={{ fontSize: 13, color: "#888" }}>ยอดชำระสุทธิ</div>
              <div style={{ fontSize: 30, fontWeight: "bold" }}>฿{total.toLocaleString()}</div>
              {/* แสดงแต้มที่จะได้ใน modal */}
              {memberPhone && pointsWillEarn > 0 && (
                <div style={{ marginTop: 6, fontSize: 13, color: isBonus ? "#e65100" : "#555",
                  background: isBonus ? "#fff3e0" : "#f5f5f5", borderRadius: 8, padding: "4px 10px", display: "inline-block" }}>
                  ⭐ +{pointsWillEarn} แต้ม {isBonus ? `(${currentMultiplier}x 🔥)` : ""}
                </div>
              )}
            </div>

            {!isDelivery ? (
              <>
                <div style={{ display: "flex", gap: 10, marginBottom: 15 }}>
                  {["cash", "promptpay"].map(m => (
                    <button key={m} onClick={() => setPaymentMethod(m)} style={{
                      ...S.btnMethod,
                      backgroundColor: paymentMethod === m ? "#213547" : "#eee",
                      color: paymentMethod === m ? "#fff" : "#000",
                    }}>
                      {m === "cash" ? "💵 เงินสด" : "📱 สแกนจ่าย"}
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
              <div style={{ marginBottom: 20 }}>
                <p style={{ textAlign: "center", color: "#888", fontSize: 13, marginBottom: 10 }}>
                  ระบุเลขอ้างอิง {priceChannel.toUpperCase()}
                </p>
                <input type="text" placeholder={priceChannel === "lineman" ? "เลข 4 หลัก" : "ระบุเลขอ้างอิง"}
                  style={S.inputModal} value={deliveryRef} onChange={e => handleRefChange(e.target.value)} autoFocus />
                <p style={{ textAlign: "center", color: "#bbb", fontSize: 11, marginTop: 8 }}>
                  ออเดอร์จะไปรอที่ Dashboard เพื่อใส่ยอดรับจริง
                </p>
              </div>
            )}

            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={() => setShowPayment(false)} style={S.btnCancel}>ยกเลิก</button>
              <button disabled={isConfirmDisabled} onClick={handleFinalConfirm} style={{
                ...S.btnConfirm, opacity: isConfirmDisabled ? 0.4 : 1,
                cursor: isConfirmDisabled ? "not-allowed" : "pointer",
              }}>ยืนยัน</button>
            </div>
          </div>
        </div>
      )}
      {showRedeem && memberInfo && (
        <RedeemModal
          memberPhone={memberPhone}
          memberInfo={memberInfo}
          onSuccess={(updatedMember, reward) => {
            setMemberInfo(updatedMember);
            const rewardDiscount = parseRewardDiscount(reward);
            if (rewardDiscount) {
              onApplyRewardDiscount?.(rewardDiscount);
            } else {
              addToCart?.({
                id: `reward-${reward.id}`,
                name: `🎁 ${reward.name}`,
                price: 0,
                qty: 1,
                category: "reward",
                modifierGroups: [],
              });
            }
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
  header: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "10px" },
  btnClear: { background: "rgba(255,255,255,0.3)", border: "1px solid #213547", padding: "4px 10px", borderRadius: "6px", cursor: "pointer", fontSize: "13px" },
  memberSection: { background: "rgba(255,255,255,0.9)", borderRadius: 12, padding: "10px 12px", marginBottom: 10 },
  cartList: { flex: 1, overflowY: "auto", marginBottom: "10px" },
  emptyText: { textAlign: "center", marginTop: "50px", color: "rgba(33,53,71,0.45)", fontSize: "15px" },
  cartItem: { backgroundColor: "#fff", padding: "10px 12px", borderRadius: "10px", marginBottom: "8px", display: "flex", alignItems: "center", gap: "10px", color: "#333" },
  itemName: { fontWeight: "bold", fontSize: "14px" },
  badge: { fontSize: "10px", background: "#213547", color: "#fff", padding: "2px 6px", borderRadius: "4px" },
  modifierText: { fontSize: "11px", color: "#888", fontStyle: "italic", marginTop: "2px" },
  itemDetail: { fontSize: "13px", color: "#555", marginTop: "3px" },
  itemActions: { display: "flex", alignItems: "center", gap: "8px", flexShrink: 0 },
  qtyControl: { display: "flex", alignItems: "center", backgroundColor: "#f0f0f0", borderRadius: "8px", border: "1px solid #ddd", overflow: "hidden" },
  qtyBtn: { width: "30px", height: "30px", background: "none", border: "none", color: "#213547", fontSize: "18px", fontWeight: "bold", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", lineHeight: 1, padding: 0 },
  qtyNumber: { minWidth: "28px", textAlign: "center", fontWeight: "bold", fontSize: "14px", color: "#213547", borderLeft: "1px solid #ddd", borderRight: "1px solid #ddd", height: "30px", display: "flex", alignItems: "center", justifyContent: "center" },
  btnDelete: { background: "none", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", padding: "4px", borderRadius: "6px" },
  footer: { backgroundColor: "rgba(255,255,255,0.2)", padding: "14px", borderRadius: "14px" },
  totalRow: { display: "flex", justifyContent: "space-between", fontSize: "1.3rem", fontWeight: "bold", color: "#213547", marginBottom: "12px" },
  btnPay: { width: "100%", padding: "14px", borderRadius: "10px", border: "none", color: "#fff", fontSize: "1.1rem", fontWeight: "bold" },
  input: { padding: "8px 10px", borderRadius: 8, border: "1px solid #ddd", fontSize: 14, outline: "none", boxSizing: "border-box" },
  inputModal: { width: "100%", padding: "12px", borderRadius: "8px", border: "1px solid #ddd", fontSize: "18px", textAlign: "center", boxSizing: "border-box" },
  btnSmall: { background: "#fff", border: "1px solid #ddd", borderRadius: 6, padding: "5px 10px", fontSize: 12, cursor: "pointer" },
  modalOverlay: { position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.7)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 },
  modalContent: { backgroundColor: "#fff", padding: "24px", borderRadius: "18px", width: "320px", color: "#333" },
  totalDisplay: { backgroundColor: "#f5f5f5", padding: "14px", borderRadius: "10px", textAlign: "center", marginBottom: "18px" },
  btnMethod: { flex: 1, padding: "10px", borderRadius: "8px", border: "none", fontWeight: "bold", cursor: "pointer" },
  btnConfirm: { flex: 2, padding: "12px", borderRadius: "8px", border: "none", backgroundColor: "#213547", color: "#fff", fontWeight: "bold" },
  btnCancel: { flex: 1, padding: "12px", borderRadius: "8px", border: "1px solid #ddd", backgroundColor: "#fff", cursor: "pointer" },
};
