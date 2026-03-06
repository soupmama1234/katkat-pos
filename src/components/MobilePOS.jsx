import React, { useState, useMemo } from "react";
import { Trash2 } from "lucide-react";
import { supabase as sb } from "../supabase";
import { calcPoints, nextThreshold, getPointSettings } from "../utils/points";
import RedeemModal from "./RedeemModal";
import { parseRewardDiscount } from "../utils/discounts";
import { groupAvailableCoupons } from "../utils/coupons";

export default function MobilePOS({
  // products
  products = [], addToCart, increaseQty, decreaseQty, onClearCart,
  categories = [], selectedCategory, setSelectedCategory,
  modifierGroups = [],
  // cart
  cart = [], total = 0, subtotal = 0, discountTotal = 0, discounts = [],
  onCheckout,
  onApplyManualDiscount, onApplyRewardDiscount, onRemoveDiscount, onClearDiscounts,
  // channel — lifted from App
  priceChannel = "pos", setPriceChannel,
  // order meta — lifted from App
  orderType = "dine_in", setOrderType,
  tableNumber = "", setTableNumber,
  deliveryRef = "", setDeliveryRef,
  // member — ALL lifted from App
  memberPhone = "",
  memberInfo, onMemberUpdate, memberStatus, setMemberStatus,
  memberInput = "", setMemberInput,
  showRegister = false, setShowRegister,
  regNickname = "", setRegNickname,
  lookupMember, registerMember, clearMember,
  // ui
  showToast, showConfirm,
}) {
  // ── local UI-only state ──
  const [showCart, setShowCart] = useState(false);
  const [showRedeem, setShowRedeem] = useState(false);
  const [discountMode, setDiscountMode] = useState("amount");
  const [discountInput, setDiscountInput] = useState("");
  const [showModifierPopup, setShowModifierPopup] = useState(false);
  const [selectedProductId, setSelectedProductId] = useState(null);
  const [tempSelection, setTempSelection] = useState([]);

  const isDelivery = ["grab", "lineman", "shopee"].includes(priceChannel);

  const { rate, tiers } = getPointSettings();
  const pointsWillEarn = memberPhone ? calcPoints(total, rate, tiers) : 0;
  const nextTier = nextThreshold(total, tiers);
  const needMore = nextTier ? nextTier.minSpend - total : null;
  const currentMultiplier = [...tiers].sort((a, b) => b.minSpend - a.minSpend).find(t => total >= t.minSpend)?.multiplier || 1;
  const isBonus = currentMultiplier > 1;

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

  // ── delivery ref input handler ──
  const handleRefChange = (val) => {
    if (priceChannel === "grab") {
      const digits = val.replace(/\D/g, "");
      setDeliveryRef("GF-" + digits);
    } else if (priceChannel === "lineman") {
      setDeliveryRef(val.replace(/\D/g, "").slice(0, 4));
    } else {
      setDeliveryRef(val);
    }
  };

  // ── product / modifier ──
  const selectedProduct = useMemo(() =>
    products.find(p => p.id === selectedProductId), [products, selectedProductId]);

  const activeModifierGroups = useMemo(() =>
    modifierGroups.filter(g => selectedProduct?.modifierGroups?.includes(g.id)),
    [modifierGroups, selectedProduct]);

  const getDisplayPrice = (product) =>
    ({ pos: product.price, grab: product.grabPrice, lineman: product.linemanPrice, shopee: product.shopeePrice })[priceChannel] ?? product.price;

  const handleProductClick = (product) => {
    const hasMods = modifierGroups.some(g => product.modifierGroups?.includes(g.id));
    if (hasMods) { setSelectedProductId(product.id); setShowModifierPopup(true); }
    else addToCart(product);
  };

  const toggleModifier = (groupId, opt) => {
    const key = `${groupId}:${opt.id}`;
    setTempSelection(prev =>
      prev.find(s => s.key === key) ? prev.filter(s => s.key !== key) : [...prev, { ...opt, key, groupId }]
    );
  };

  const handleConfirmModifier = () => {
    if (!selectedProduct) return;
    const totalModPrice = tempSelection.reduce((s, m) => s + Number(m.price), 0);
    addToCart({
      ...selectedProduct,
      selectedModifier: tempSelection.length > 0 ? {
        id: tempSelection.map(m => m.key).sort().join("|"),
        name: tempSelection.map(m => m.name).join(", "),
        price: totalModPrice,
      } : null,
    });
    setShowModifierPopup(false);
    setTempSelection([]);
  };

  // ── checkout: ส่งแค่ paymentMethod — App จัดการ state ทั้งหมดเอง ──
  const handleConfirmCheckout = (paymentMethod) => {
    onCheckout(paymentMethod);
    setShowCart(false);
  };

  const handleApplyDiscount = () => {
    const value = Number(discountInput);
    if (!(value > 0)) return;
    onApplyManualDiscount?.({ mode: discountMode, value });
    setDiscountInput("");
  };

  const totalQty = cart.reduce((s, i) => s + i.qty, 0);

  const isCheckoutDisabled = isDelivery && (
    !deliveryRef ||
    deliveryRef === "GF-" ||
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

      {/* 2. Channel bar */}
      <div style={st.channelBar}>
        {[
          { key: "pos",     label: "POS",     color: "#4a4a4a" },
          { key: "grab",    label: "Grab",    color: "#00B14F" },
          { key: "lineman", label: "Lineman", color: "#00A84F" },
          { key: "shopee",  label: "Shopee",  color: "#EE4D2D" },
        ].map(ch => (
          <button key={ch.key}
            onClick={() => setPriceChannel(ch.key)}
            style={{ ...st.channelBtn, background: priceChannel === ch.key ? ch.color : "#262626",
              border: priceChannel === ch.key ? "2px solid #fff" : "2px solid transparent",
              opacity: priceChannel === ch.key ? 1 : 0.6 }}>
            {ch.label}
          </button>
        ))}
      </div>

      {/* 3. Order type bar (POS only) */}
      {!isDelivery && (
        <div style={st.orderTypeBar}>
          {[{ key: "dine_in", label: "🍽️ ทานที่ร้าน" }, { key: "takeaway", label: "🛍️ กลับบ้าน" }].map(({ key, label }) => (
            <button key={key}
              onClick={() => { setOrderType(key); if (key === "takeaway") setTableNumber(""); }}
              style={{ ...st.orderTypeBtn, backgroundColor: orderType === key ? "#fff" : "#222", color: orderType === key ? "#000" : "#aaa",
                border: orderType === key ? "2px solid #fff" : "2px solid transparent", fontWeight: orderType === key ? "bold" : "normal" }}>
              {label}
            </button>
          ))}
          {orderType === "dine_in" && (
            <input type="text" inputMode="numeric" placeholder="โต๊ะ" value={tableNumber}
              onChange={e => setTableNumber(e.target.value)} maxLength={4}
              style={{ width: 60, background: "#222", border: "1px solid #444", borderRadius: 8, color: "#fff", padding: "6px 8px", fontSize: 14, textAlign: "center", outline: "none" }} />
          )}
        </div>
      )}

      {/* 4. Delivery ref bar */}
      {isDelivery && (
        <div style={st.deliveryBar}>
          <div style={{ display: "flex", alignItems: "center", background: "#1a1a1a", borderRadius: 10, border: "1px solid #333", overflow: "hidden" }}>
            {priceChannel === "grab" && (
              <span style={{ padding: "0 10px", color: "#00B14F", fontWeight: "bold", fontSize: 16, borderRight: "1px solid #333" }}>GF-</span>
            )}
            <input
              type="text" inputMode="numeric"
              placeholder={priceChannel === "lineman" ? "เลข 4 หลัก" : "เลขอ้างอิง"}
              value={priceChannel === "grab" ? deliveryRef.replace("GF-", "") : deliveryRef}
              onChange={e => handleRefChange(priceChannel === "grab" ? "GF-" + e.target.value : e.target.value)}
              style={{ flex: 1, background: "transparent", border: "none", color: "#fff", fontSize: 16, padding: "10px 12px", outline: "none" }}
              autoFocus
            />
          </div>
        </div>
      )}

      {/* 5. Member bar (POS only) */}
      {!isDelivery && (
        <div style={st.memberBar}>
          {memberStatus === "found" && memberInfo ? (
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ color: "#4caf50", fontWeight: "bold", fontSize: 13, flex: 1 }}>
                👤 {memberInfo.nickname} · ⭐ {memberInfo.points} แต้ม
                {isBonus && <span style={{ color: "#ff9800", marginLeft: 4 }}>· {currentMultiplier}x 🔥</span>}
              </span>
              <button onClick={() => setShowRedeem(true)} style={st.btnMini}>🎁 แลก</button>
              <button onClick={clearMember} style={{ ...st.btnMini, color: "#aaa" }}>เปลี่ยน</button>
            </div>
          ) : showRegister ? (
            <div style={{ display: "flex", gap: 6 }}>
              <input placeholder="ชื่อเล่น" value={regNickname} onChange={e => setRegNickname(e.target.value)}
                style={{ flex: 1, background: "#1a1a1a", border: "1px solid #333", color: "#fff", borderRadius: 8, padding: "8px 10px", fontSize: 13 }} autoFocus />
              <button onClick={registerMember} style={{ ...st.btnMini, background: "#4caf50", color: "#000" }}>บันทึก</button>
              <button onClick={clearMember} style={{ ...st.btnMini, color: "#aaa" }}>✕</button>
            </div>
          ) : (
            <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
              <input type="tel" inputMode="numeric" placeholder="👤 เบอร์สมาชิก"
                value={memberInput}
                onChange={e => { setMemberInput(e.target.value); setMemberStatus("idle"); }}
                onBlur={e => lookupMember(e.target.value)}
                onKeyDown={e => e.key === "Enter" && lookupMember(memberInput)}
                style={{ flex: 1, background: "#1a1a1a", border: "1px solid #333", color: "#fff", borderRadius: 8, padding: "8px 10px", fontSize: 13, outline: "none" }}
              />
              {memberStatus === "loading" && <span style={{ color: "#aaa", fontSize: 12 }}>🔍</span>}
              {memberStatus === "notfound" && memberInput.length >= 9 && (
                <button onClick={() => setShowRegister(true)} style={{ ...st.btnMini, background: "#ff9800", color: "#000" }}>+ สมัคร</button>
              )}
            </div>
          )}
        </div>
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

      {/* 7. Floating cart button */}
      {cart.length > 0 && !showCart && (
        <button style={st.floatingCart} onClick={() => setShowCart(true)}>
          <span>🛒 {totalQty} รายการ</span>
          <span style={{ marginLeft: "auto", fontWeight: "bold" }}>ดูตะกร้า ฿{total.toLocaleString()}</span>
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
                {!isDelivery && <span style={{ color: "#fff", marginLeft: 6 }}>· {orderType === "dine_in" ? "🍽️ ทานที่ร้าน" : "🛍️ กลับบ้าน"}{orderType === "dine_in" && tableNumber ? ` โต๊ะ ${tableNumber}` : ""}</span>}
                {isDelivery && deliveryRef && deliveryRef !== "GF-" && <span style={{ color: "#4caf50", marginLeft: 6 }}>· {deliveryRef}</span>}
              </span>
            </div>
            <button onClick={() => setShowCart(false)} style={{ background: "none", border: "none", color: "#fff", fontSize: 26, cursor: "pointer", lineHeight: 1 }}>✕</button>
          </div>

          {/* coupon bar */}
          {!isDelivery && memberStatus === "found" && memberInfo && (() => {
            const groups = groupAvailableCoupons(memberInfo.redeemed_rewards);
            if (!groups.length) return null;
            return (
              <div style={{ padding: "8px 16px", background: "#0d1a0d", borderBottom: "1px solid #1a2e1a", display: "flex", flexWrap: "wrap", gap: 6 }}>
                {groups.map((group, idx) => (
                  <div key={idx} style={{ display: "flex", alignItems: "center", gap: 6, background: "#1a2e1a", border: "1px solid #2e4a2e", borderRadius: 8, padding: "4px 8px" }}>
                    <span style={{ fontSize: 11, color: "#4caf50" }}>🎁 {group.name}{group.count > 1 ? ` x${group.count}` : ""}</span>
                    <button
                      onClick={async () => {
                        const coupon = group.sampleReward;
                        await markCouponUsed(coupon.id);
                        const rd = parseRewardDiscount(coupon);
                        if (rd) onApplyRewardDiscount?.({ ...rd, couponId: coupon.id });
                        else addToCart?.({ id: `coupon-${coupon.id}`, name: `🎁 ${coupon.name}`, price: 0, qty: 1, category: "reward", modifierGroups: [] });
                        showToast?.(`ใช้คูปอง "${coupon.name}" แล้ว`);
                      }}
                      style={{ background: "#4caf50", color: "#000", border: "none", borderRadius: 5, padding: "2px 8px", fontSize: 10, fontWeight: "bold", cursor: "pointer" }}>
                      ใช้
                    </button>
                  </div>
                ))}
              </div>
            );
          })()}

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
                {nextTier && <span style={{ color: "#666", marginLeft: 6 }}>อีก ฿{needMore} → {nextTier.multiplier}x</span>}
              </div>
            )}

            {/* discount */}
            <div style={{ display: "flex", gap: 6, marginBottom: 8, alignItems: "center" }}>
              <select value={discountMode} onChange={e => setDiscountMode(e.target.value)}
                style={{ background: "#222", border: "1px solid #444", color: "#fff", borderRadius: 8, padding: "6px 4px", fontSize: 13, width: 55 }}>
                <option value="amount">฿</option>
                <option value="percent">%</option>
              </select>
              <input value={discountInput} onChange={e => setDiscountInput(e.target.value)}
                placeholder="ลด" type="number" inputMode="decimal"
                style={{ flex: 1, background: "#222", border: "1px solid #444", color: "#fff", borderRadius: 8, padding: "6px 10px", fontSize: 14, outline: "none" }} />
              <button onClick={handleApplyDiscount} style={{ ...st.btnMini, background: "#444" }}>ใช้</button>
              <button onClick={() => onClearDiscounts?.()} style={{ ...st.btnMini, color: "#aaa" }}>ล้าง</button>
            </div>
            {discounts.length > 0 && (
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 8 }}>
                {discounts.map(d => (
                  <button key={d.id} onClick={() => onRemoveDiscount?.(d.id)}
                    style={{ background: "#222", border: "1px solid #444", borderRadius: 14, padding: "4px 10px", fontSize: 11, color: "#aaa", cursor: "pointer" }}>
                    {d.label || "ลด"} {d.mode === "percent" ? `${d.value}%` : `฿${d.value}`} ✕
                  </button>
                ))}
              </div>
            )}

            {/* totals */}
            {discountTotal > 0 && (
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, color: "#888", marginBottom: 4 }}>
                <span>ยอดก่อนลด</span><span>฿{subtotal.toLocaleString()}</span>
              </div>
            )}
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 20, fontWeight: "bold", color: "#fff", marginBottom: 14 }}>
              <span>รวม</span><span>฿{total.toLocaleString()}</span>
            </div>

            {/* checkout buttons */}
            <div style={{ display: "grid", gridTemplateColumns: !isDelivery ? "1fr 1fr" : "1fr", gap: 12 }}>
              {!isDelivery ? (
                <>
                  <button onClick={() => handleConfirmCheckout("cash")}
                    style={{ ...st.payBtn, backgroundColor: "#4caf50" }}>💵 เงินสด</button>
                  <button onClick={() => handleConfirmCheckout("transfer")}
                    style={{ ...st.payBtn, backgroundColor: "#2196f3" }}>📲 โอนเงิน</button>
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

      {/* 9. Modifier popup */}
      {showModifierPopup && selectedProduct && (
        <div style={st.modOverlay} onClick={() => { setShowModifierPopup(false); setTempSelection([]); }}>
          <div style={st.modModal} onClick={e => e.stopPropagation()}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <h3 style={{ margin: 0, color: "#fff" }}>{selectedProduct.name}</h3>
              <button onClick={() => { setShowModifierPopup(false); setTempSelection([]); }}
                style={{ background: "none", border: "none", color: "#888", fontSize: 24, cursor: "pointer", lineHeight: 1 }}>✕</button>
            </div>
            <div style={{ overflowY: "auto", flex: 1 }}>
              {activeModifierGroups.map(group => (
                <div key={group.id} style={{ marginBottom: 20 }}>
                  <div style={{ fontSize: 13, color: "#888", marginBottom: 10, textTransform: "uppercase", letterSpacing: 1 }}>{group.name}</div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                    {(group.options || []).map(opt => {
                      const key = `${group.id}:${opt.id}`;
                      const isSelected = tempSelection.some(s => s.key === key);
                      return (
                        <button key={opt.id} onClick={() => toggleModifier(group.id, opt)}
                          style={{ padding: "10px 16px", borderRadius: 10, fontSize: 14, cursor: "pointer", color: "#fff",
                            border: isSelected ? "2px solid #4caf50" : "1px solid #444",
                            background: isSelected ? "#1a3a1a" : "#222" }}>
                          {opt.name}
                          {opt.price > 0 && <span style={{ color: "#4caf50" }}> +฿{opt.price}</span>}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
            <button onClick={handleConfirmModifier}
              style={{ width: "100%", padding: 16, borderRadius: 12, border: "none", backgroundColor: "#4caf50", color: "#000", fontWeight: "bold", fontSize: 16, cursor: "pointer", marginTop: 16 }}>
              ✓ เพิ่มลงตะกร้า
            </button>
          </div>
        </div>
      )}

      {/* 10. Redeem modal */}
      {showRedeem && memberInfo && (
        <RedeemModal
          memberPhone={memberPhone} memberInfo={memberInfo}
          onSuccess={(updatedMember, reward) => {
            onMemberUpdate?.(updatedMember);
            const rd = parseRewardDiscount(reward);
            if (rd) onApplyRewardDiscount?.(rd);
            else addToCart({ id: `reward-${reward.id}`, name: `🎁 ${reward.name}`, price: 0, qty: 1, category: "reward", modifierGroups: [] });
            setShowRedeem(false);
          }}
          onClose={() => setShowRedeem(false)}
        />
      )}
    </div>
  );
}

const st = {
  categoryBar:   { display: "flex", flexWrap: "wrap", padding: "10px 12px", gap: 8, backgroundColor: "#111", borderBottom: "1px solid #333" },
  catBtn:        { padding: "8px 14px", borderRadius: 10, border: "none", fontSize: 13, fontWeight: "bold", cursor: "pointer" },
  channelBar:    { display: "flex", padding: "8px 12px", gap: 8, backgroundColor: "#000", borderBottom: "1px solid #333" },
  channelBtn:    { flex: 1, padding: "10px 0", borderRadius: 10, color: "#fff", fontSize: 12, fontWeight: "bold", cursor: "pointer" },
  orderTypeBar:  { display: "flex", padding: "8px 12px", gap: 8, backgroundColor: "#0d0d0d", borderBottom: "1px solid #222", alignItems: "center" },
  orderTypeBtn:  { flex: 1, padding: "8px 0", borderRadius: 10, fontSize: 13, cursor: "pointer", transition: "all 0.15s" },
  deliveryBar:   { padding: "8px 12px", backgroundColor: "#111", borderBottom: "1px solid #222" },
  memberBar:     { padding: "8px 12px", backgroundColor: "#0a0a0a", borderBottom: "1px solid #1a1a1a" },
  btnMini:       { background: "#333", border: "none", color: "#fff", borderRadius: 6, padding: "4px 10px", fontSize: 11, fontWeight: "bold", cursor: "pointer" },
  productGrid:   { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, padding: 12, overflowY: "auto", flex: 1 },
  productCard:   { backgroundColor: "#1a1a1a", border: "1px solid #333", borderRadius: 16, color: "#fff", padding: "20px 12px", textAlign: "center", cursor: "pointer", display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center" },
  modBadge:      { marginTop: 8, fontSize: 10, color: "#888", background: "#2a2a2a", padding: "3px 8px", borderRadius: 10 },
  floatingCart:  { position: "fixed", bottom: 90, left: 16, right: 16, backgroundColor: "#4caf50", color: "#000", border: "none", borderRadius: 14, padding: "16px 20px", fontSize: 16, fontWeight: "bold", display: "flex", alignItems: "center", zIndex: 100, cursor: "pointer" },
  cartOverlay:   { position: "fixed", inset: 0, backgroundColor: "#111", zIndex: 2000, display: "flex", flexDirection: "column" },
  cartHeader:    { padding: 20, borderBottom: "1px solid #333", display: "flex", justifyContent: "space-between", alignItems: "center", backgroundColor: "#1a1a1a", flexShrink: 0 },
  cartList:      { flex: 1, overflowY: "auto", padding: 16 },
  cartItem:      { display: "flex", alignItems: "center", gap: 12, marginBottom: 16, paddingBottom: 16, borderBottom: "1px solid #222" },
  qtyControl:    { display: "flex", alignItems: "center", backgroundColor: "#222", borderRadius: 10, border: "1px solid #444", overflow: "hidden", flexShrink: 0 },
  qtyBtn:        { width: 38, height: 38, background: "none", border: "none", color: "#fff", fontSize: 20, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" },
  qtyNum:        { minWidth: 32, textAlign: "center", fontWeight: "bold", fontSize: 16, color: "#fff", borderLeft: "1px solid #444", borderRight: "1px solid #444", height: 38, display: "flex", alignItems: "center", justifyContent: "center" },
  btnClearCart:  { width: "100%", background: "none", border: "1px solid #333", color: "#ff5252", padding: 10, display: "flex", alignItems: "center", justifyContent: "center", gap: 6, borderRadius: 8, cursor: "pointer", marginTop: 8 },
  cartFooter:    { padding: 20, borderTop: "1px solid #333", backgroundColor: "#1a1a1a", flexShrink: 0 },
  payBtn:        { border: "none", padding: 18, borderRadius: 12, color: "#fff", fontWeight: "bold", fontSize: 16, cursor: "pointer" },
  modOverlay:    { position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)", display: "flex", alignItems: "flex-end", zIndex: 3000 },
  modModal:      { background: "#1a1a1a", borderRadius: "20px 20px 0 0", padding: 24, width: "100%", maxHeight: "85vh", display: "flex", flexDirection: "column", borderTop: "1px solid #333" },
};
