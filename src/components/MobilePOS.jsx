import React, { useState, useMemo } from "react";
import { Trash2 } from "lucide-react";
import { supabase as sb } from "../supabase";
import { calcPoints, nextThreshold, getPointSettings } from "../utils/points";
import RedeemModal from "./RedeemModal";
import { parseRewardDiscount } from "../utils/discounts";
import { groupAvailableCoupons } from "../utils/coupons";

export default function MobilePOS({
  products = [],
  addToCart,
  increaseQty,
  decreaseQty,
  onClearCart,
  categories = [],
  selectedCategory,
  setSelectedCategory,
  cart = [],
  total = 0,
  onCheckout,
  priceChannel,
  setPriceChannel,
  modifierGroups = [],
  memberPhone = "",
  setMemberPhone,
  memberInfo,
  setMemberInfo,
  onMemberUpdate,
  memberStatus,
  setMemberStatus,
  subtotal = 0,
  discountTotal = 0,
  discounts = [],
  onApplyManualDiscount,
  onApplyRewardDiscount,
  onRemoveDiscount,
  onClearDiscounts,
  showToast,
  showConfirm,
}) {
  const [showCart, setShowCart] = useState(false);
  const [refValue, setRefValue] = useState("");
  const [orderType, setOrderType] = useState("dine_in"); // 🆕 ทานที่ร้าน / กลับบ้าน
  const [showRedeem, setShowRedeem] = useState(false);

  const [memberInput, setMemberInput] = useState("");
  const [showRegister, setShowRegister] = useState(false);
  const [regNickname, setRegNickname] = useState("");

  const [discountMode, setDiscountMode] = useState("amount");
  const [discountInput, setDiscountInput] = useState("");

  const handleApplyManualDiscount = () => {
    const value = Number(discountInput);
    if (!(value > 0)) return;
    onApplyManualDiscount?.({ mode: discountMode, value });
    setDiscountInput("");
  };

  const [showModifierPopup, setShowModifierPopup] = useState(false);
  const [selectedProductId, setSelectedProductId] = useState(null);
  const [tempSelection, setTempSelection] = useState([]);

  // ── bonus points calculation ──
  const { rate, tiers } = getPointSettings();
  const pointsWillEarn = memberPhone ? calcPoints(total, rate, tiers) : 0;
  const nextTier = nextThreshold(total, tiers);
  const needMore = nextTier ? nextTier.minSpend - total : null;
  const currentMultiplier = [...tiers].sort((a, b) => b.minSpend - a.minSpend).find(t => total >= t.minSpend)?.multiplier || 1;
  const isBonus = currentMultiplier > 1;

  // ── mark coupon used ──
  const markCouponUsed = async (couponId) => {
    if (!memberInfo || !memberPhone) return;
    const updatedRewards = (memberInfo.redeemed_rewards || []).map(r =>
      r.id === couponId ? { ...r, used_at: new Date().toISOString() } : r
    );
    const updatedMember = { ...memberInfo, redeemed_rewards: updatedRewards };
    onMemberUpdate?.(updatedMember);
    try {
      await sb.from("members").update({ redeemed_rewards: updatedRewards }).eq("phone", memberPhone);
    } catch (e) { console.warn("markCouponUsed error:", e); }
  };

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

  const getDisplayPrice = (product) => {
    const channelPrices = {
      pos: product.price,
      grab: product.grabPrice,
      lineman: product.linemanPrice,
      shopee: product.shopeePrice
    };
    return channelPrices[priceChannel] ?? product.price;
  };

  const selectedProduct = useMemo(() =>
    (products || []).find(p => p.id === selectedProductId),
    [products, selectedProductId]
  );

  const activeModifierGroups = useMemo(() =>
    modifierGroups.filter(g => selectedProduct?.modifierGroups?.includes(g.id)),
    [modifierGroups, selectedProduct]
  );

  const handleProductClick = (product) => {
    const productModGroups = modifierGroups.filter(g =>
      product.modifierGroups?.includes(g.id)
    );
    if (productModGroups.length > 0) {
      setSelectedProductId(product.id);
      setShowModifierPopup(true);
    } else {
      addToCart(product);
    }
  };

  const toggleModifier = (groupId, opt) => {
    const selectionKey = `${groupId}:${opt.id}`;
    setTempSelection(prev => {
      const isExist = prev.find(item => item.key === selectionKey);
      if (isExist) return prev.filter(item => item.key !== selectionKey);
      return [...prev, { ...opt, key: selectionKey, groupId }];
    });
  };

  const handleConfirmModifier = () => {
    if (!selectedProduct) return;
    const totalModPrice = tempSelection.reduce((sum, m) => sum + Number(m.price), 0);
    addToCart({
      ...selectedProduct,
      selectedModifier: tempSelection.length > 0 ? {
        id: [...tempSelection].map(m => m.key).sort().join("|"),
        name: tempSelection.map(m => m.name).join(", "),
        price: totalModPrice
      } : null
    });
    setShowModifierPopup(false);
    setTempSelection([]);
  };

  // 🆕 ส่ง orderType ไปด้วย
  const handleConfirmCheckout = (type) => {
    let finalRef = refValue;
    if (type === "grab" && refValue) finalRef = `GF-${refValue}`;
    const currentOrderType = ["grab", "lineman", "shopee"].includes(type) ? "takeaway" : orderType;
    onCheckout(type, finalRef, memberPhone, currentOrderType);
    setRefValue("");
    setShowCart(false);
    clearMember();
  };

  const totalQty = cart.reduce((sum, i) => sum + i.qty, 0);

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", backgroundColor: "#000", position: "relative" }}>

      {/* 1. หมวดหมู่ */}
      <div style={styles.categoryBar}>
        {categories.map((cat) => (
          <button
            key={cat}
            onClick={() => setSelectedCategory(cat)}
            style={{
              ...styles.catBtn,
              backgroundColor: selectedCategory === cat ? "#fff" : "#222",
              color: selectedCategory === cat ? "#000" : "#fff",
            }}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* 2. แถบช่องทาง */}
      <div style={styles.channelBar}>
        {[
          { key: "pos", label: "POS", color: "#4a4a4a" },
          { key: "grab", label: "Grab", color: "#00B14F" },
          { key: "lineman", label: "Lineman", color: "#00A84F" },
          { key: "shopee", label: "Shopee", color: "#EE4D2D" },
        ].map((ch) => (
          <button
            key={ch.key}
            onClick={() => { setPriceChannel(ch.key); setRefValue(""); }}
            style={{
              ...styles.channelBtn,
              background: priceChannel === ch.key ? ch.color : "#262626",
              border: priceChannel === ch.key ? "2px solid #fff" : "2px solid transparent",
              opacity: priceChannel === ch.key ? 1 : 0.6,
            }}
          >
            {ch.label}
          </button>
        ))}
      </div>

      {/* 2.5 ปุ่มทานที่ร้าน / กลับบ้าน (POS only) */}
      {priceChannel === "pos" && (
        <div style={{ display: "flex", gap: 8, padding: "8px 12px", backgroundColor: "#0d0d0d", borderBottom: "1px solid #222" }}>
          {[
            { key: "dine_in", label: "🍽️ ทานที่ร้าน" },
            { key: "takeaway", label: "🛍️ กลับบ้าน" },
          ].map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setOrderType(key)}
              style={{
                flex: 1,
                padding: "8px 0",
                borderRadius: 10,
                fontSize: 13,
                fontWeight: orderType === key ? "bold" : "normal",
                cursor: "pointer",
                border: orderType === key ? "2px solid #fff" : "2px solid transparent",
                backgroundColor: orderType === key ? "#fff" : "#222",
                color: orderType === key ? "#000" : "#aaa",
                transition: "all 0.15s",
              }}
            >
              {label}
            </button>
          ))}
        </div>
      )}

      {/* 2.6 ช่องเลข ref (delivery channels) */}
      {["grab", "lineman", "shopee"].includes(priceChannel) && (
        <div style={{ padding: "8px 12px", backgroundColor: "#111", borderBottom: "1px solid #222" }}>
          <div style={styles.inputGroup}>
            {priceChannel === "grab" && (
              <span style={styles.prefixLabel}>GF-</span>
            )}
            <input
              type="number"
              inputMode="numeric"
              placeholder={priceChannel === "grab" ? "ระบุตัวเลข" : "เลขที่อ้างอิง"}
              value={refValue}
              onChange={(e) => setRefValue(e.target.value)}
              style={{ ...styles.innerInput, fontSize: "16px", padding: "10px 12px" }}
              autoFocus
            />
          </div>
        </div>
      )}

      {/* ── Member Bar (POS only) ── */}
      {priceChannel === "pos" && (
        <div style={{ padding: "8px 12px", backgroundColor: "#0a0a0a", borderBottom: "1px solid #1a1a1a" }}>
          {memberStatus === "found" && memberInfo ? (
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                <span style={{ color: "#4caf50", fontWeight: "bold", fontSize: 13 }}>👤 {memberInfo.nickname}</span>
                <span style={{ color: "#666", fontSize: 12 }}>⭐ {memberInfo.points} แต้ม</span>
                <button onClick={() => setShowRedeem(true)} style={{ marginLeft: "auto", background: "#f5c518", border: "none", borderRadius: 6, padding: "4px 8px", fontSize: 11, fontWeight: "bold", cursor: "pointer" }}>🎁 แลก</button>
                <button onClick={clearMember} style={{ background: "#333", border: "none", borderRadius: 6, padding: "4px 8px", fontSize: 11, color: "#aaa", cursor: "pointer" }}>เปลี่ยน</button>
              </div>

              {/* Coupons */}
              {(() => {
                const couponGroups = groupAvailableCoupons(memberInfo.redeemed_rewards);
                if (couponGroups.length === 0) return null;
                return (
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 4 }}>
                    {couponGroups.map((group, idx) => (
                      <div key={idx} style={{ display: "flex", alignItems: "center", gap: 6, background: "#1a2e1a", border: "1px solid #2e4a2e", borderRadius: 8, padding: "4px 8px" }}>
                        <span style={{ fontSize: 11, color: "#4caf50" }}>🎁 {group.name} {group.count > 1 && `x${group.count}`}</span>
                        <button
                          onClick={async () => {
                            const coupon = group.sampleReward;
                            const rewardDiscount = parseRewardDiscount(coupon);
                            await markCouponUsed(coupon.id);
                            if (rewardDiscount) {
                              onApplyRewardDiscount?.({ ...rewardDiscount, couponId: coupon.id });
                            } else {
                              addToCart?.({ id: `reward-${coupon.id}`, name: `🎁 ${coupon.name}`, price: 0, qty: 1, category: "reward", modifierGroups: [] });
                            }
                          }}
                          style={{ background: "#4caf50", border: "none", borderRadius: 4, padding: "2px 6px", fontSize: 10, fontWeight: "bold", color: "#000", cursor: "pointer" }}
                        >ใช้</button>
                      </div>
                    ))}
                  </div>
                );
              })()}

              {total > 0 && pointsWillEarn > 0 && (
                <div style={{ fontSize: 11, color: isBonus ? "#ff9800" : "#4caf50" }}>
                  ⭐ +{pointsWillEarn} แต้ม {isBonus ? `(${currentMultiplier}x 🔥)` : ""}
                  {needMore && <span style={{ color: "#666", marginLeft: 4 }}>· อีก ฿{needMore} รับโบนัส</span>}
                </div>
              )}
            </div>
          ) : memberStatus === "loading" ? (
            <div style={{ color: "#666", fontSize: 13 }}>🔍 กำลังค้นหา...</div>
          ) : (
            <div>
              {memberStatus === "notfound" && !showRegister && (
                <div style={{ fontSize: 12, color: "#ff5252", marginBottom: 6 }}>
                  ไม่พบสมาชิก —{" "}
                  <button onClick={() => setShowRegister(true)} style={{ background: "none", border: "none", color: "#4caf50", fontWeight: "bold", cursor: "pointer", fontSize: 12 }}>สมัครใหม่?</button>
                </div>
              )}
              {showRegister ? (
                <div style={{ display: "flex", gap: 6 }}>
                  <input placeholder="ชื่อเล่น" value={regNickname} onChange={e => setRegNickname(e.target.value)}
                    style={{ flex: 1, background: "#222", border: "1px solid #333", borderRadius: 8, padding: "8px 10px", color: "#fff", fontSize: 13 }} />
                  <button onClick={registerMember} style={{ background: "#4caf50", border: "none", borderRadius: 8, padding: "8px 12px", fontWeight: "bold", color: "#000", cursor: "pointer", fontSize: 13 }}>สมัคร</button>
                  <button onClick={() => setShowRegister(false)} style={{ background: "#333", border: "none", borderRadius: 8, padding: "8px 10px", color: "#aaa", cursor: "pointer", fontSize: 13 }}>ยกเลิก</button>
                </div>
              ) : (
                <div style={{ display: "flex", gap: 6 }}>
                  <input
                    type="tel"
                    placeholder="เบอร์โทรสมาชิก"
                    value={memberInput}
                    onChange={e => setMemberInput(e.target.value)}
                    onKeyDown={e => e.key === "Enter" && lookupMember(memberInput)}
                    style={{ flex: 1, background: "#222", border: "1px solid #333", borderRadius: 8, padding: "8px 10px", color: "#fff", fontSize: 14, outline: "none" }}
                  />
                  <button onClick={() => lookupMember(memberInput)}
                    style={{ background: "#444", border: "none", borderRadius: 8, padding: "8px 12px", color: "#fff", cursor: "pointer", fontSize: 13 }}>ค้นหา</button>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* 3. รายการสินค้า */}
      <div style={styles.productGrid}>
        {products
          .filter(p => !selectedCategory || selectedCategory === "All" || p.category === selectedCategory)
          .map((p) => {
            const hasModifiers = modifierGroups.some(g => p.modifierGroups?.includes(g.id));
            return (
              <button key={p.id} onClick={() => handleProductClick(p)} style={styles.productCard}>
                <div style={{ fontSize: "15px", fontWeight: "bold", marginBottom: "6px", lineHeight: 1.3 }}>{p.name}</div>
                <div style={{ color: "#4caf50", fontWeight: "bold", fontSize: "16px" }}>
                  ฿{(getDisplayPrice(p) || 0).toLocaleString()}
                </div>
                {hasModifiers && (
                  <div style={styles.modifierBadge}>⚙️ มีตัวเลือก</div>
                )}
              </button>
            );
          })}
      </div>

      {/* 4. ปุ่มลอย */}
      {cart.length > 0 && !showCart && (
        <button style={styles.floatingCart} onClick={() => setShowCart(true)}>
          <span>🛒 {totalQty} รายการ</span>
          <span style={{ marginLeft: "auto", fontWeight: "bold" }}>ดูตะกร้า ฿{total.toLocaleString()}</span>
        </button>
      )}

      {/* 5. ตะกร้า Overlay */}
      {showCart && (
        <div style={styles.cartOverlay}>
          <div style={styles.cartHeader}>
            <div>
              <h3 style={{ margin: 0 }}>ตะกร้าสินค้า</h3>
              <span style={{ fontSize: "12px", color: "#888" }}>ช่องทาง: {priceChannel.toUpperCase()}</span>
              {priceChannel === "pos" && (
                <span style={{ fontSize: "12px", color: "#fff", marginLeft: 8 }}>
                  · {orderType === "dine_in" ? "🍽️ ทานที่ร้าน" : "🛍️ กลับบ้าน"}
                </span>
              )}
              {["grab", "lineman", "shopee"].includes(priceChannel) && refValue && (
                <span style={{ fontSize: "12px", color: "#4caf50", marginLeft: 8 }}>
                  · {priceChannel === "grab" ? `GF-${refValue}` : refValue}
                </span>
              )}
            </div>
            <button onClick={() => setShowCart(false)} style={styles.closeBtn}>✕</button>
          </div>

          <div style={styles.cartList}>
            {cart.map((item, idx) => (
              <div key={`${item.id}-${idx}`} style={styles.cartItem}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: "bold", fontSize: "15px", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                    {item.name}
                  </div>
                  {item.selectedModifier && (
                    <div style={{ fontSize: "12px", color: "#aaa", fontStyle: "italic" }}>
                      • {item.selectedModifier.name}
                    </div>
                  )}
                  <div style={{ fontSize: "13px", color: "#888", marginTop: 2 }}>
                    ฿{item.price.toLocaleString()} × {item.qty} = <strong style={{ color: "#fff" }}>฿{(item.price * item.qty).toLocaleString()}</strong>
                  </div>
                </div>

                <div style={styles.qtyControl}>
                  <button onClick={() => decreaseQty(item.id, item.channel, item.selectedModifier?.id)} style={styles.qtyBtn}>−</button>
                  <span style={styles.qtyNumber}>{item.qty}</span>
                  <button onClick={() => increaseQty(item.id, item.channel, item.selectedModifier?.id)} style={styles.qtyBtn}>+</button>
                </div>
                <button onClick={() => { for (let i = 0; i < item.qty; i++) decreaseQty(item.id, item.channel, item.selectedModifier?.id); }}
                  style={{ background: "none", border: "none", cursor: "pointer", padding: "4px" }}>
                  <Trash2 size={18} color="#ff5252" />
                </button>
              </div>
            ))}

            <button onClick={() => { onClearCart(); }} style={styles.btnClear}>
              <Trash2 size={16} /> ล้างตะกร้า
            </button>
          </div>

          <div style={styles.cartFooter}>
            {/* Member info inside cart */}
            {priceChannel === "pos" && memberStatus === "found" && memberInfo && total > 0 && pointsWillEarn > 0 && (
              <div style={{ marginBottom: 10, padding: "8px 12px", background: "#111", borderRadius: 10, fontSize: 12, color: isBonus ? "#ff9800" : "#4caf50" }}>
                ⭐ {memberInfo.nickname} · +{pointsWillEarn} แต้ม {isBonus ? `(${currentMultiplier}x 🔥)` : ""}
              </div>
            )}

            {/* Totals */}
            {discountTotal > 0 && (
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, color: "#888", marginBottom: 4 }}>
                <span>ยอดก่อนลด</span><span>฿{subtotal.toLocaleString()}</span>
              </div>
            )}
            {discountTotal > 0 && (
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, color: "#4caf50", marginBottom: 4 }}>
                <span>ส่วนลดรวม</span><span>-฿{discountTotal.toLocaleString()}</span>
              </div>
            )}
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: "20px", fontWeight: "bold", marginBottom: "16px" }}>
              <span>รวม</span><span>฿{total.toLocaleString()}</span>
            </div>

            {/* Discount input */}
            <div style={{ display: "flex", gap: "8px", marginBottom: "12px" }}>
              <select value={discountMode} onChange={e => setDiscountMode(e.target.value)}
                style={{ background: "#222", border: "1px solid #333", borderRadius: "8px", padding: "10px 6px", color: "#fff", fontSize: "13px" }}>
                <option value="amount">฿</option>
                <option value="percent">%</option>
              </select>
              <input value={discountInput} onChange={e => setDiscountInput(e.target.value)} placeholder="ส่วนลด" type="number" inputMode="decimal"
                style={{ flex: 1, background: "#222", border: "1px solid #333", borderRadius: "8px", padding: "10px", color: "#fff", fontSize: "14px", outline: "none" }} />
              <button onClick={handleApplyManualDiscount}
                style={{ background: "#444", border: "none", borderRadius: "8px", padding: "10px 14px", color: "#fff", fontWeight: "bold", cursor: "pointer" }}>ใช้</button>
              <button onClick={() => onClearDiscounts?.()}
                style={{ backgroundColor: "#333", color: "#fff", border: "none", borderRadius: "8px", padding: "0 10px", cursor: "pointer" }}>ล้าง</button>
            </div>

            {discounts.length > 0 && (
              <div style={{ display: "flex", flexWrap: "wrap", gap: "6px", marginBottom: "12px" }}>
                {discounts.map((d) => (
                  <button key={d.id} onClick={() => onRemoveDiscount?.(d.id)}
                    style={{ background: "#222", border: "1px solid #444", borderRadius: "14px", padding: "4px 10px", fontSize: "11px", color: "#aaa", cursor: "pointer" }}>
                    {d.label || "ลด"} {d.mode === "percent" ? `${d.value}%` : `฿${d.value}`} ✕
                  </button>
                ))}
              </div>
            )}

            {/* Checkout buttons */}
            <div style={{ display: "grid", gridTemplateColumns: priceChannel === "pos" ? "1fr 1fr" : "1fr", gap: "12px" }}>
              {priceChannel === "pos" ? (
                <>
                  <button onClick={() => handleConfirmCheckout("cash")} style={{ ...styles.payBtn, backgroundColor: "#4caf50" }}>💵 เงินสด</button>
                  <button onClick={() => handleConfirmCheckout("transfer")} style={{ ...styles.payBtn, backgroundColor: "#2196f3" }}>📱 โอนเงิน</button>
                </>
              ) : (
                <button
                  onClick={() => handleConfirmCheckout(priceChannel)}
                  style={{ ...styles.payBtn, backgroundColor: "#1e293b", fontSize: "18px" }}
                >
                  💾 บันทึก {priceChannel.toUpperCase()}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 6. Modifier Popup */}
      {showModifierPopup && selectedProduct && (
        <div style={styles.modifierOverlay} onClick={() => { setShowModifierPopup(false); setTempSelection([]); }}>
          <div style={styles.modifierModal} onClick={e => e.stopPropagation()}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
              <h3 style={{ margin: 0 }}>{selectedProduct.name}</h3>
              <button onClick={() => { setShowModifierPopup(false); setTempSelection([]); }}
                style={{ background: "none", border: "none", color: "#fff", fontSize: "24px", cursor: "pointer" }}>✕</button>
            </div>
            <div style={{ overflowY: "auto", flex: 1 }}>
              {activeModifierGroups.map(group => (
                <div key={group.id} style={{ marginBottom: "20px" }}>
                  <div style={{ fontSize: "13px", color: "#888", marginBottom: "10px", textTransform: "uppercase", letterSpacing: 1 }}>{group.name}</div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
                    {group.options.map(opt => {
                      const key = `${group.id}:${opt.id}`;
                      const isSelected = tempSelection.some(s => s.key === key);
                      return (
                        <button key={opt.id} onClick={() => toggleModifier(group.id, opt)}
                          style={{ padding: "10px 16px", borderRadius: "10px", border: isSelected ? "2px solid #4caf50" : "1px solid #444",
                            background: isSelected ? "#1a3a1a" : "#222", color: "#fff", cursor: "pointer", fontSize: "14px" }}>
                          {opt.name} {opt.price > 0 && <span style={{ color: "#4caf50" }}>+฿{opt.price}</span>}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
            <button onClick={handleConfirmModifier}
              style={{ width: "100%", padding: "16px", borderRadius: "12px", border: "none", backgroundColor: "#4caf50", color: "#000", fontWeight: "bold", fontSize: "16px", cursor: "pointer", marginTop: "16px" }}>
              ✓ เพิ่มลงตะกร้า
            </button>
          </div>
        </div>
      )}

      {/* 7. RedeemModal */}
      {showRedeem && memberInfo && (
        <RedeemModal
          memberPhone={memberPhone}
          memberInfo={memberInfo}
          onSuccess={(updatedMember, reward) => {
            onMemberUpdate?.(updatedMember);
            const rewardDiscount = parseRewardDiscount(reward);
            if (rewardDiscount) {
              onApplyRewardDiscount?.(rewardDiscount);
            } else {
              addToCart({
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

const styles = {
  categoryBar: { display: "flex", flexWrap: "wrap", padding: "12px", gap: "8px", backgroundColor: "#111", borderBottom: "1px solid #333" },
  catBtn: { padding: "8px 14px", borderRadius: "10px", border: "none", fontSize: "13px", fontWeight: "bold", cursor: "pointer" },
  channelBar: { display: "flex", padding: "8px 12px", gap: "8px", backgroundColor: "#000", borderBottom: "1px solid #333" },
  channelBtn: { flex: 1, padding: "10px 0", borderRadius: "10px", color: "#fff", fontSize: "12px", fontWeight: "bold", cursor: "pointer" },
  productGrid: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", padding: "12px", overflowY: "auto" },
  productCard: { backgroundColor: "#1a1a1a", border: "1px solid #333", borderRadius: "16px", color: "#fff", padding: "20px 12px", textAlign: "center", cursor: "pointer", display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center" },
  modifierBadge: { marginTop: "8px", fontSize: "10px", color: "#888", backgroundColor: "#2a2a2a", padding: "3px 8px", borderRadius: "10px" },
  floatingCart: { position: "fixed", bottom: "90px", left: "16px", right: "16px", backgroundColor: "#4caf50", color: "#000", border: "none", borderRadius: "14px", padding: "16px 20px", fontSize: "16px", fontWeight: "bold", display: "flex", alignItems: "center", zIndex: 100, cursor: "pointer" },
  cartOverlay: { position: "fixed", inset: 0, backgroundColor: "#111", zIndex: 2000, display: "flex", flexDirection: "column" },
  cartHeader: { padding: "20px", borderBottom: "1px solid #333", display: "flex", justifyContent: "space-between", alignItems: "center", backgroundColor: "#1a1a1a", flexShrink: 0 },
  closeBtn: { background: "none", border: "none", color: "#fff", fontSize: "26px", cursor: "pointer", lineHeight: 1 },
  cartList: { flex: 1, overflowY: "auto", padding: "16px" },
  cartItem: { display: "flex", alignItems: "center", gap: "12px", marginBottom: "16px", paddingBottom: "16px", borderBottom: "1px solid #222" },
  qtyControl: { display: "flex", alignItems: "center", gap: "0", backgroundColor: "#222", borderRadius: "10px", border: "1px solid #444", overflow: "hidden", flexShrink: 0 },
  qtyBtn: { width: "38px", height: "38px", background: "none", border: "none", color: "#fff", fontSize: "20px", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", lineHeight: 1, padding: 0 },
  qtyNumber: { minWidth: "32px", textAlign: "center", fontWeight: "bold", fontSize: "16px", color: "#fff", borderLeft: "1px solid #444", borderRight: "1px solid #444", height: "38px", display: "flex", alignItems: "center", justifyContent: "center" },
  btnClear: { width: "100%", background: "none", border: "1px solid #333", color: "#ff5252", padding: "10px", display: "flex", alignItems: "center", justifyContent: "center", gap: "6px", borderRadius: "8px", cursor: "pointer", marginTop: "8px" },
  cartFooter: { padding: "20px", borderTop: "1px solid #333", backgroundColor: "#1a1a1a", flexShrink: 0 },
  inputGroup: { display: "flex", alignItems: "center", backgroundColor: "#222", borderRadius: "12px", border: "1px solid #333", padding: "0 15px", marginBottom: "4px" },
  prefixLabel: { color: "#00B14F", fontSize: "18px", fontWeight: "bold", marginRight: "5px" },
  innerInput: { flex: 1, padding: "14px 0", backgroundColor: "transparent", border: "none", color: "#fff", fontSize: "18px", outline: "none" },
  payBtn: { border: "none", padding: "18px", borderRadius: "12px", color: "#fff", fontWeight: "bold", fontSize: "16px", cursor: "pointer" },
  modifierOverlay: { position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)", display: "flex", alignItems: "flex-end", zIndex: 3000 },
  modifierModal: { background: "#1a1a1a", borderRadius: "20px 20px 0 0", padding: "24px", width: "100%", maxHeight: "85vh", display: "flex", flexDirection: "column", borderTop: "1px solid #333" },
};
