import { supabase as sb } from "../../supabase";
import { calcPoints, nextThreshold, getPointSettings } from "../../utils/points";
import { groupAvailableCoupons } from "../../utils/coupons";
import { parseRewardDiscount } from "../../utils/discounts";

/**
 * MemberBar — ค้นหา / สมัคร / แสดงข้อมูล member
 * ใช้ร่วมกันระหว่าง Cart (desktop) และ MobilePOS (mobile)
 *
 * Props (ทั้งหมดมาจาก App — ไม่มี local state):
 *   memberPhone, memberInfo, memberStatus, setMemberStatus
 *   memberInput, setMemberInput
 *   showRegister, setShowRegister
 *   regNickname, setRegNickname
 *   lookupMember, registerMember, clearMember
 *   onMemberUpdate
 *   onApplyRewardDiscount, addToCart
 *   total  (for points preview)
 *   showToast
 *   variant: "dark" (mobile) | "light" (desktop)
 *   showPointsPreview: boolean (default true)
 *   showCoupons: boolean (default true)
 *   showRedeem / setShowRedeem: for redeem button (optional)
 */
export default function MemberBar({
  memberPhone = "",
  memberInfo,
  memberStatus,
  setMemberStatus,
  memberInput = "",
  setMemberInput,
  showRegister = false,
  setShowRegister,
  regNickname = "",
  setRegNickname,
  lookupMember,
  registerMember,
  clearMember,
  onMemberUpdate,
  onApplyRewardDiscount,
  addToCart,
  total = 0,
  showToast,
  variant = "dark",
  showPointsPreview = true,
  showCoupons = true,
  onOpenRedeem,   // callback เปิด RedeemModal
}) {
  const isDark = variant === "dark";

  const { rate, tiers } = getPointSettings();
  const pointsWillEarn = memberPhone ? calcPoints(total, rate, tiers) : 0;
  const nextTier = nextThreshold(total, tiers);
  const needMore = nextTier ? nextTier.minSpend - total : null;
  const currentMultiplier = [...tiers].sort((a, b) => b.minSpend - a.minSpend).find(t => total >= t.minSpend)?.multiplier || 1;
  const isBonus = currentMultiplier > 1;

  const markCouponUsed = async (couponId) => {
    if (!memberInfo || !memberPhone) return;
      // เรียก atomic RPC แทน update ตรงๆ
  const { data, error } = await sb.rpc("use_coupon_atomic", {
    p_phone: memberPhone,
    p_coupon_id: couponId,
  });

  if (error || !data?.ok) {
    const reason = data?.error;
    if (reason === "already_used") {
      showToast?.("⚠️ คูปองนี้ถูกใช้ไปแล้ว", "error");
    } else {
      showToast?.("⚠️ ใช้คูปองไม่สำเร็จ", "error");
    }
    return; // ไม่ apply discount
  }
    // อัพ local state
    const updatedRewards = (memberInfo.redeemed_rewards || []).map(r =>
      r.id === couponId ? { ...r, used_at: new Date().toISOString() } : r
    );
    onMemberUpdate?.({ ...memberInfo, redeemed_rewards: updatedRewards });
    try {
      await sb.from("members").update({ redeemed_rewards: updatedRewards }).eq("phone", memberPhone);
    } catch (e) { console.warn("markCouponUsed error:", e); }
  };

  // ── Styles ──
  const wrap = isDark
    ? { padding: "8px 12px", backgroundColor: "#0a0a0a", borderBottom: "1px solid #1a1a1a" }
    : { background: "rgba(255,255,255,0.9)", borderRadius: 12, padding: "10px 12px", marginBottom: 10 };

  const inputStyle = isDark
    ? { flex: 1, background: "#1a1a1a", border: "1px solid #333", color: "#fff", borderRadius: 8, padding: "8px 10px", fontSize: 13, outline: "none" }
    : { flex: 1, padding: "8px 10px", borderRadius: 8, border: "1px solid #ddd", fontSize: 14, outline: "none", boxSizing: "border-box", color: "#333" };

  const btnStyle = (bg, color = "#fff") => isDark
    ? { background: bg, border: "none", borderRadius: 6, padding: "4px 10px", fontSize: 11, fontWeight: "bold", cursor: "pointer", color, whiteSpace: "nowrap" }
    : { background: bg, border: bg === "transparent" ? "1px solid #ddd" : "none", borderRadius: 6, padding: "5px 10px", fontSize: 12, cursor: "pointer", color, whiteSpace: "nowrap" };

  // ── Found member ──
  if (memberStatus === "found" && memberInfo) {
    return (
      <div style={wrap}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: (showCoupons || showPointsPreview) && total > 0 ? 8 : 0 }}>
          <div style={{ flex: 1 }}>
            <span style={{ color: isDark ? "#4caf50" : "#2e7d32", fontWeight: "bold", fontSize: 13 }}>
              👤 {memberInfo.nickname}
            </span>
            <span style={{ color: isDark ? "#666" : "#888", fontSize: 12, marginLeft: 8 }}>
              ⭐ {memberInfo.points} แต้ม · {memberInfo.tier || "Standard"}
              {isBonus && <span style={{ color: "#ff9800", marginLeft: 4 }}>{currentMultiplier}x 🔥</span>}
            </span>
          </div>
          {onOpenRedeem && (
            <button onClick={onOpenRedeem} style={btnStyle("#f5c518", "#000")}>🎁 แลก</button>
          )}
          <button onClick={clearMember} style={btnStyle(isDark ? "#333" : "#eee", isDark ? "#aaa" : "#333")}>เปลี่ยน</button>
        </div>

        {/* Coupons */}
        {showCoupons && (() => {
          const groups = groupAvailableCoupons(memberInfo.redeemed_rewards);
          if (!groups.length) return null;
          return (
            <div style={{ marginBottom: 8, padding: "8px 10px", background: isDark ? "#0d1a0d" : "#fff", borderRadius: 10, border: isDark ? "1px solid #1a2e1a" : "1px solid #eee" }}>
              <div style={{ fontSize: 11, color: isDark ? "#4caf50" : "#999", fontWeight: "bold", marginBottom: 6, textTransform: "uppercase" }}>คูปองที่แลกไว้</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                {groups.map((group, idx) => (
                  <div key={idx} style={{ display: "flex", justifyContent: "space-between", alignItems: "center",
                    background: isDark ? "#111" : "#f8f9fa", padding: "6px 8px", borderRadius: 8,
                    border: isDark ? "1px solid #1a2e1a" : "1px solid #f0f0f0" }}>
                    <span style={{ fontSize: 12, color: isDark ? "#4caf50" : "#2e7d32", fontWeight: "bold", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", marginRight: 8 }}>
                      🎁 {group.name} {group.count > 1 && <span style={{ color: isDark ? "#4caf50" : "#4caf50" }}>x{group.count}</span>}
                    </span>
                    <button
                      onClick={async () => {
                        const coupon = group.sampleReward;
                        await markCouponUsed(coupon.id);
                        const rd = parseRewardDiscount(coupon);
                        if (rd) {
                          onApplyRewardDiscount?.({ ...rd, couponId: coupon.id });
                        } else {
                          addToCart?.({ id: `coupon-${coupon.id}`, name: `🎁 ${coupon.name}`, price: 0, qty: 1, category: "reward", modifierGroups: [], couponId: coupon.id });
                        }
                        showToast?.(`ใช้คูปอง "${coupon.name}" แล้ว`);
                      }}
                      style={btnStyle("#4caf50", isDark ? "#000" : "#fff")}>
                      ใช้
                    </button>
                  </div>
                ))}
              </div>
            </div>
          );
        })()}

        {/* Points preview */}
        {showPointsPreview && total > 0 && (
          <div style={{ background: isDark ? "#111" : "#f9f9f9", borderRadius: 10, padding: "8px 12px" }}>
            {nextTier ? (
              <>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                  <span style={{ fontSize: 12, color: isBonus ? "#e65100" : (isDark ? "#888" : "#555") }}>
                    ⭐ จะได้ <strong>{pointsWillEarn}</strong> แต้ม
                    {isBonus && <span style={{ color: "#e65100", marginLeft: 4 }}>({currentMultiplier}x 🔥)</span>}
                  </span>
                  <span style={{ fontSize: 12, color: "#ff9800", fontWeight: "bold" }}>อีก ฿{needMore} → {nextTier.multiplier}x 🚀</span>
                </div>
                <div style={{ height: 6, background: isDark ? "#222" : "#e0e0e0", borderRadius: 4, overflow: "hidden" }}>
                  <div style={{ height: "100%", borderRadius: 4,
                    background: isBonus ? "linear-gradient(90deg,#ff9800,#f5c518)" : "linear-gradient(90deg,#4caf50,#8bc34a)",
                    width: `${Math.min(100, (total / nextTier.minSpend) * 100)}%`, transition: "width 0.3s ease" }} />
                </div>
              </>
            ) : (
              <div style={{ fontSize: 12, color: "#e65100", fontWeight: "bold" }}>
                ⭐ จะได้ {pointsWillEarn} แต้ม · {currentMultiplier}x 🔥 MAX!
              </div>
            )}
          </div>
        )}
      </div>
    );
  }

  // ── Register form ──
  if (showRegister) {
    return (
      <div style={wrap}>
        <div style={{ fontSize: 12, color: "#e65100", marginBottom: 6 }}>✨ สมัครสมาชิกใหม่ · {memberInput}</div>
        <div style={{ display: "flex", gap: 6 }}>
          <input
            placeholder="ชื่อเล่น" value={regNickname}
            onChange={e => setRegNickname(e.target.value)}
            style={inputStyle} autoFocus
          />
          <button onClick={registerMember} style={btnStyle(isDark ? "#4caf50" : "#2e7d32")}>บันทึก</button>
          <button onClick={clearMember} style={btnStyle(isDark ? "#222" : "#eee", isDark ? "#aaa" : "#333")}>✕</button>
        </div>
      </div>
    );
  }

  // ── Idle / lookup form ──
  return (
    <div style={wrap}>
      <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
        <input
          type="tel" inputMode="numeric" placeholder="👤 เบอร์สมาชิก (optional)"
          value={memberInput}
          onChange={e => { setMemberInput(e.target.value); setMemberStatus("idle"); }}
          onBlur={e => lookupMember(e.target.value)}
          onKeyDown={e => e.key === "Enter" && lookupMember(memberInput)}
          style={inputStyle}
        />
        {memberStatus === "loading" && (
          <span style={{ fontSize: 12, color: isDark ? "#aaa" : "#888" }}>🔍</span>
        )}
        {memberStatus === "notfound" && memberInput.length >= 9 && (
          <button onClick={() => setShowRegister(true)}
            style={btnStyle("#ff9800", "#000")}>
            + สมัคร
          </button>
        )}
      </div>
    </div>
  );
}
