import React, { useState, useMemo } from "react";
import { supabase as sb } from "../supabase";
import RewardManager from "./RewardManager";
import { Trash2, Edit2, RotateCw } from "lucide-react";
import {
  loadRate,
  loadTiers,
  saveRate,
  saveTiers,
  calcPoints,
} from "../utils/points";
import { groupAvailableCoupons } from "../utils/coupons";
import db from "../storage";

const TABS = ["ภาพรวม", "สมาชิก", "VIP", "หายไป", "ประวัติ", "Rewards"];

export default function Members({ orders = [], members: initMembers = [], onMembersChange, historyTrigger, showToast, showConfirm }) {
  const [tab, setTab] = useState("ภาพรวม");
  const [members, setMembers] = useState(initMembers);
  const [pointRate, setPointRate] = useState(loadRate);
  const [tiers, setTiers] = useState(loadTiers);
  const [editRate, setEditRate] = useState(false);
  const [editTiers, setEditTiers] = useState(false);
  const [rateInput, setRateInput] = useState(pointRate);
  const [tiersInput, setTiersInput] = useState(tiers);
  const [search, setSearch] = useState("");
  const [adjusting, setAdjusting] = useState(null); 
  const [adjustVal, setAdjustVal] = useState("");
  const [adjustNote, setAdjustNote] = useState("");
  const [adjustSaving, setAdjustSaving] = useState(false);
  const [history, setHistory] = useState([]);
  const [visitsMap, setVisitsMap] = useState({});
  const [visitsLoading, setVisitsLoading] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [memberLimit, setMemberLimit] = useState(50);

  React.useEffect(() => { setMembers(initMembers); }, [initMembers]);

  React.useEffect(() => {
    if (tab === "ประวัติ") fetchHistory();
  }, [historyTrigger, tab]);

  // เพิ่มใหม่ — fetch visits ตอน component mount ครั้งเดียว
  React.useEffect(() => {
    fetchVisits();
  }, []);

  const memberOrders = useMemo(() => orders.filter(o => o.member_phone), [orders]);
  const statsMap = useMemo(() => {
  const map = {};
  memberOrders.forEach(o => {
    const p = o.member_phone;
    if (!map[p]) map[p] = { lastVisit: null, items: [] };
    const t = o.time || o.created_at;
    if (!map[p].lastVisit || t > map[p].lastVisit) map[p].lastVisit = t;
    (o.items || []).forEach(item => map[p].items.push(item.name));
  });
  return map;
  }, [memberOrders]);

  const favMenu = useMemo(() => {
    const result = {};
    Object.entries(statsMap).forEach(([phone, s]) => {
      const freq = {};
      s.items.forEach(n => { freq[n] = (freq[n] || 0) + 1; });
      result[phone] = Object.entries(freq).sort((a, b) => b[1] - a[1]).slice(0, 3);
    });
    return result;
  }, [statsMap]);

  const [now] = useState(() => Date.now());
  const thisMonth = new Date(now).toISOString().slice(0, 7);
  const newThisMonth = members.filter(m => m.created_at?.slice(0, 7) === thisMonth).length;
  const totalPoints = members.reduce((s, m) => s + (m.points || 0), 0);
  const avgSpent = members.length ? Math.round(members.reduce((s, m) => s + (m.total_spent || 0), 0) / members.length) : 0;
  const cutoff30 = new Date(now - 30 * 86400000).toISOString();
  const goneMems = members.filter(m => { const s = statsMap[m.phone]; return s?.lastVisit && s.lastVisit < cutoff30; });
  const neverCome = members.filter(m => !statsMap[m.phone]);

  const daysSince = d => d ? Math.floor((now - new Date(d)) / 86400000) : "?";
  const daysUntil = d => d ? Math.ceil((new Date(d) - now) / 86400000) : null;
  const tierColor = t => ({ Standard: "#888", Silver: "#ccc", Gold: "#f5c518" })[t] || "#888";
  const isExpired = m => m.expires_at && new Date(m.expires_at) < new Date();
  const expiringSoon = m => { const d = daysUntil(m.expires_at); return d !== null && d >= 0 && d <= 30; };

  const handleDelete = async (phone) => {
    const mem = members.find(m => m.phone === phone);
    const ok = await showConfirm("ลบสมาชิก?", `ยืนยันการลบสมาชิก "${mem?.nickname || phone}"?`);
    if (!ok) return;
    try {
      await sb.from("members").delete().eq("phone", phone);
      const updated = members.filter(m => m.phone !== phone);
      setMembers(updated); onMembersChange?.(updated);
      showToast("ลบสมาชิกเรียบร้อย");
    } catch (e) { showToast("ลบไม่สำเร็จ: " + e.message, "error"); }
  };

  const handleSaveRate = () => {
    const r = { baht: Number(rateInput.baht) || 10, points: Number(rateInput.points) || 1 };
    setPointRate(r); saveRate(r); setEditRate(false);
    showToast("บันทึกอัตราแต้มแล้ว");
  };

  const handleAdjustPoints = async () => {
    if (!adjusting || adjustVal === "") return;
    const delta = Number(adjustVal);
    if (isNaN(delta)) return;
    setAdjustSaving(true);
    try {
      const newPoints = Math.max(0, (adjusting.points || 0) + delta);
      await sb.from("members").update({ points: newPoints }).eq("phone", adjusting.phone);
      await sb.from("point_history").insert({
        member_phone: adjusting.phone,
        type: "adjust",
        points: delta,
        note: adjustNote || `แก้ไขโดย Admin`,
      });
      setMembers(prev => prev.map(m => m.phone === adjusting.phone ? { ...m, points: newPoints } : m));
      onMembersChange?.(members.map(m => m.phone === adjusting.phone ? { ...m, points: newPoints } : m));
      setAdjusting(null); setAdjustVal(""); setAdjustNote("");
      showToast("แก้ไขแต้มเรียบร้อย");
    } catch (e) { showToast("แก้แต้มไม่สำเร็จ: " + e.message, "error"); }
    setAdjustSaving(false);
  };

  const fetchHistory = async () => {
    setHistoryLoading(true);
    try {
      const { data } = await sb.from("point_history")
        .select("*, members(nickname)")
        .order("created_at", { ascending: false })
        .limit(100);
      setHistory(data || []);
    } catch (e) { console.error(e); }
    setHistoryLoading(false);
  };

  const deleteHistory = async (id) => {
    const ok = await showConfirm("ลบประวัติ?", "ยืนยันการลบรายการประวัตินี้?");
    if (!ok) return;
    try {
      await sb.from("point_history").delete().eq("id", id);
      setHistory(prev => prev.filter(h => h.id !== id));
      showToast("ลบประวัติเรียบร้อย");
    } catch (e) { showToast("ลบไม่สำเร็จ", "error"); }
  };

  const handleSaveTiers = () => {
    const cleaned = tiersInput
      .filter(t => t.minSpend > 0 && t.multiplier > 1)
      .sort((a, b) => a.minSpend - b.minSpend);
    setTiers(cleaned); saveTiers(cleaned); setEditTiers(false);
    showToast("บันทึก Bonus Tiers แล้ว");
  };

  const addTier = () => setTiersInput(prev => [...prev, { id: Date.now(), minSpend: 0, multiplier: 2 }]);
  const removeTier = (id) => setTiersInput(prev => prev.filter(t => t.id !== id));
  const updateTier = (id, field, val) => setTiersInput(prev => prev.map(t => t.id === id ? { ...t, [field]: Number(val) } : t));

  const filtered = useMemo(() => {
    if (!search.trim()) return members;
    const q = search.toLowerCase();
    return members.filter(m => m.nickname?.toLowerCase().includes(q) || m.phone?.includes(q));
  }, [members, search]);

  const rowProps = (m) => ({
  m,
  stats: statsMap[m.phone],
  visits: visitsMap[m.phone] || 0,  // ← เพิ่ม
  fav: favMenu[m.phone] || [],
  tierColor, daysSince, daysUntil, isExpired, expiringSoon,
  onDelete: () => handleDelete(m.phone),
  onAdjust: () => { setAdjusting(m); setAdjustVal(""); setAdjustNote(""); },
  onDeleteCoupon: (couponId) => handleDeleteCoupon(m, couponId),
});

  const handleDeleteCoupon = async (member, couponId) => {
    const coupon = member.redeemed_rewards.find(r => r.id === couponId);
    const ok = await showConfirm(
      "ลบคูปอง?", 
      `คุณต้องการลบคูปอง "${coupon?.name || 'นี้'}" ใช่หรือไม่?\n(แต้มจะไม่ได้รับคืน)`,
      null,
      "danger"
    );
    if (!ok) return;

    try {
      const updatedRewards = member.redeemed_rewards.filter(r => r.id !== couponId);
      const { error } = await sb.from("members")
        .update({ redeemed_rewards: updatedRewards })
        .eq("phone", member.phone);

      if (error) throw error;

      // Update local state
      const updatedMembers = members.map(m => 
        m.phone === member.phone ? { ...m, redeemed_rewards: updatedRewards } : m
      );
      setMembers(updatedMembers);
      onMembersChange?.(updatedMembers);
      showToast("ลบคูปองเรียบร้อย");
    } catch (e) {
      showToast("ลบไม่ได้: " + e.message, "error");
    }
  };

  const fetchVisits = async () => {
  setVisitsLoading(true);
  try {
    const { data, error } = await sb
      .from("point_history")
      .select("member_phone")
      .eq("type", "earn");
console.log("Visits Data:", data);
    if (error) throw error;

    // นับจำนวน earn ต่อ phone
    const map = {};
    (data || []).forEach(row => {
      if (!row.member_phone) return;
      map[row.member_phone] = (map[row.member_phone] || 0) + 1;
    });
    setVisitsMap(map);
  } catch (e) {
    showToast("โหลด visits ไม่สำเร็จ: " + e.message, "error");
  }
  setVisitsLoading(false);
};
  
  return (
    <div style={{ ...S.wrap, width: "100%", flex: 1 }}>
      <div style={S.tabs}>
        {TABS.map(t => (
          <button key={t} onClick={() => setTab(t)} style={{ ...S.tab, ...(tab === t ? S.tabActive : {}) }}>
            {t}
            {t === "หายไป" && goneMems.length + neverCome.length > 0 && (
              <span style={S.badge}>{goneMems.length + neverCome.length}</span>
            )}
          </button>
        ))}
      </div>

      <div style={S.content}>
        <div style={{ maxWidth: "1200px", margin: "0 auto", width: "100%" }}>
          {tab === "ภาพรวม" && (
            <div>
              <div style={S.grid4}>
                <StatCard icon="👥" label="สมาชิกทั้งหมด" value={members.length} unit="คน" />
                <StatCard icon="✨" label="ใหม่เดือนนี้" value={newThisMonth} unit="คน" color="#4caf50" />
                <StatCard icon="⭐" label="แต้มที่แจก" value={totalPoints.toLocaleString()} unit="แต้ม" color="#f5c518" />
                <StatCard icon="💰" label="ยอดเฉลี่ย" value={`฿${avgSpent.toLocaleString()}`} color="#4D96FF" />
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(350px, 1fr))", gap: "16px" }}>
                <div>
                  <div style={S.section}>
                    <div style={S.sectionHeader}>
                      <div style={S.sectionTitle}>⭐ อัตราแต้มพื้นฐาน</div>
                      <button onClick={() => { setEditRate(!editRate); setRateInput(pointRate); }} style={S.btnEdit}>
                        {editRate ? "✕" : <Edit2 size={12} />}
                      </button>
                    </div>
                    {editRate ? (
                      <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", marginTop: 10 }}>
                        <span style={S.dim}>ทุก</span>
                        <input type="number" value={rateInput.baht} onChange={e => setRateInput(r => ({ ...r, baht: e.target.value }))} style={{ ...S.input, width: 70 }} />
                        <span style={S.dim}>บาท ได้</span>
                        <input type="number" value={rateInput.points} onChange={e => setRateInput(r => ({ ...r, points: e.target.value }))} style={{ ...S.input, width: 60 }} />
                        <span style={S.dim}>แต้ม</span>
                        <button onClick={handleSaveRate} style={S.btnSave}>💾 บันทึก</button>
                      </div>
                    ) : (
                      <div style={{ fontSize: 20, fontWeight: "bold", color: "#f5c518", marginTop: 8 }}>
                        ฿{pointRate.baht} = {pointRate.points} แต้ม
                      </div>
                    )}
                  </div>

                  <div style={S.section}>
                    <div style={S.sectionHeader}>
                      <div style={S.sectionTitle}>🚀 Bonus Tiers</div>
                      <button onClick={() => { setEditTiers(!editTiers); setTiersInput(tiers.map(t => ({ ...t }))); }} style={S.btnEdit}>
                        {editTiers ? "✕" : <Edit2 size={12} />}
                      </button>
                    </div>
                    {editTiers ? (
                      <div style={{ marginTop: 10 }}>
                        {tiersInput.map((t, i) => (
                          <div key={t.id} style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 8, flexWrap: "wrap" }}>
                            <span style={{ ...S.dim, minWidth: 20 }}>ระดับ {i + 1}</span>
                            <span style={S.dim}>ยอด ≥</span>
                            <input type="number" value={t.minSpend} onChange={e => updateTier(t.id, "minSpend", e.target.value)}
                              style={{ ...S.input, width: 80 }} placeholder="บาท" />
                            <span style={S.dim}>ได้แต้ม</span>
                            <input type="number" value={t.multiplier} onChange={e => updateTier(t.id, "multiplier", e.target.value)}
                              style={{ ...S.input, width: 60 }} placeholder="x" />
                            <span style={S.dim}>เท่า</span>
                            <button onClick={() => removeTier(t.id)} style={{ background: "none", border: "none", color: "#ff4444", fontSize: 18, cursor: "pointer" }}>✕</button>
                          </div>
                        ))}
                        <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
                          <button onClick={addTier} style={{ ...S.btnEdit, color: "#4D96FF", borderColor: "#4D96FF" }}>+ เพิ่ม tier</button>
                          <button onClick={handleSaveTiers} style={S.btnSave}>💾 บันทึก</button>
                        </div>
                      </div>
                    ) : (
                      <div style={{ marginTop: 8 }}>
                        {[...tiers].sort((a, b) => a.minSpend - b.minSpend).map((t, i) => (
                          <div key={t.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center",
                            padding: "8px 12px", background: "#181818", borderRadius: 10, marginBottom: 6 }}>
                            <div>
                              <span style={{ color: i === 0 ? "#4D96FF" : "#f5c518", fontWeight: "bold" }}>{t.multiplier}x</span>
                              <span style={{ color: "#666", fontSize: 13, marginLeft: 8 }}>ยอด ≥ ฿{t.minSpend.toLocaleString()}</span>
                            </div>
                            <div style={{ fontSize: 12, color: "#555" }}>฿{t.minSpend} → {calcPoints(t.minSpend, pointRate, tiers)} แต้ม</div>
                          </div>
                        ))}
                        {tiers.length === 0 && <div style={{ color: "#444", fontSize: 13 }}>ยังไม่มี bonus tier</div>}
                      </div>
                    )}
                  </div>
                </div>

                <div style={S.section}>
                  <div style={S.sectionTitle}>สมาชิกล่าสุด</div>
                  {members.slice(0, 5).map(m => <MemberRow key={m.phone} {...rowProps(m)} />)}
                  {members.length === 0 && <Empty text="ยังไม่มีสมาชิก" />}
                </div>
              </div>
            </div>
          )}

          {tab === "สมาชิก" && (
  <div>
    <input placeholder="🔍 ค้นหาชื่อหรือเบอร์..." value={search}
      onChange={e => { setSearch(e.target.value); setMemberLimit(50); }} // reset limit ตอน search
      style={{ ...S.input, width: "100%", marginBottom: 10, fontSize: 15 }} />
    <div style={S.section}>
      {filtered.slice(0, memberLimit).map(m => <MemberRow key={m.phone} {...rowProps(m)} showDelete />)}
    </div>

    {/* Load more button */}
    {filtered.length > memberLimit && (
      <button
        onClick={() => setMemberLimit(prev => prev + 50)}
        style={{ width: "100%", padding: "12px", marginTop: 8, background: "#1a1a1a", border: "1px solid #2a2a2a", borderRadius: 12, color: "#888", cursor: "pointer", fontSize: 13 }}>
        โหลดเพิ่ม ({filtered.length - memberLimit} คนที่เหลือ)
      </button>
    )}
  </div>
)}

{tab === "VIP" && (
  <div style={S.section}>
    <div style={S.sectionTitle}>เรียงตามยอดใช้จ่าย</div>
    {[...members]
      .sort((a, b) => (b.total_spent || 0) - (a.total_spent || 0))
      .slice(0, memberLimit) // ← เพิ่ม limit
      .map((m, i) => <MemberRow key={m.phone} {...rowProps(m)} rank={i + 1} showDelete />)}
    {members.length > memberLimit && (
      <button
        onClick={() => setMemberLimit(prev => prev + 50)}
        style={{ width: "100%", padding: "12px", marginTop: 8, background: "#1a1a1a", border: "1px solid #2a2a2a", borderRadius: 12, color: "#888", cursor: "pointer", fontSize: 13 }}>
        โหลดเพิ่ม ({members.length - memberLimit} คนที่เหลือ)
      </button>
    )}
  </div>
)}

          {tab === "หายไป" && (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(350px, 1fr))", gap: "16px" }}>
              {goneMems.length > 0 && (
                <div style={S.section}>
                  <div style={S.sectionTitle}>🚨 ไม่มาเกิน 30 วัน ({goneMems.length} คน)</div>
                  {goneMems.map(m => <MemberRow key={m.phone} {...rowProps(m)} showDelete />)}
                </div>
              )}
              {neverCome.length > 0 && (
                <div style={S.section}>
                  <div style={S.sectionTitle}>👻 สมัครแล้วยังไม่มา ({neverCome.length} คน)</div>
                  {neverCome.map(m => <MemberRow key={m.phone} {...rowProps(m)} showDelete />)}
                </div>
              )}
            </div>
          )}

          {tab === "ประวัติ" && (
            <div>
              <button onClick={fetchHistory} style={{ ...S.btnEdit, marginBottom: 12, color: "#4D96FF", borderColor: "#4D96FF", display: "flex", alignItems: "center", gap: 6 }}>
                <RotateCw size={14} className={historyLoading ? "spin" : ""} /> โหลดประวัติล่าสุด
              </button>
              {historyLoading ? <Empty text="กำลังโหลด..." /> : (
                <div style={S.section}>
                  <div style={S.sectionTitle}>100 รายการล่าสุด</div>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: "0 20px" }}>
                    {history.map(h => (
                      <div key={h.id} style={S.memberRow}>
                        <div style={{ flex: 1 }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                            <span style={{ fontSize: 16 }}>{h.type === "earn" ? "⭐" : h.type === "redeem" ? "🎁" : "✏️"}</span>
                            <span style={{ fontWeight: "bold", fontSize: 13 }}>{h.members?.nickname || h.member_phone}</span>
                            <span style={{ fontSize: 11, color: "#555" }}>{h.member_phone}</span>
                          </div>
                          <div style={{ fontSize: 12, color: "#666", marginTop: 2 }}>{h.note || h.type}</div>
                          <div style={{ fontSize: 11, color: "#444" }}>{new Date(h.created_at).toLocaleString("th-TH")}</div>
                        </div>
                        <div style={{ textAlign: "right", display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 6 }}>
                          <span style={{ fontWeight: "bold", color: h.points > 0 ? "#4caf50" : "#ff6b6b", fontSize: 15 }}>{h.points > 0 ? "+" : ""}{h.points} ⭐</span>
                          <button onClick={() => deleteHistory(h.id)} style={{ background: "none", border: "none", color: "#333", cursor: "pointer", display: "flex", alignItems: "center" }}>
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {tab === "Rewards" && <RewardManager showToast={showToast} showConfirm={showConfirm} members={members} onMembersChange={m => { setMembers(m); onMembersChange?.(m); }} />}
        </div>
      </div>

      {adjusting && (
        <div style={S.overlay} onClick={() => setAdjusting(null)}>
          <div style={{ ...S.modal, width: 320, textAlign: "left" }} onClick={e => e.stopPropagation()}>
            <div style={{ fontWeight: "bold", fontSize: 16, marginBottom: 4 }}>✏️ แก้ไขแต้ม</div>
            <div style={{ color: "#888", fontSize: 13, marginBottom: 16 }}>{adjusting.nickname} · ⭐ {adjusting.points || 0} แต้ม</div>
            <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
              {[-50, -10, +10, +50].map(v => (
                <button key={v} onClick={() => setAdjustVal(String(v))} style={{ flex: 1, padding: "6px 0", background: v < 0 ? "#2a1a1a" : "#1a2a1a", border: `1px solid ${v < 0 ? "#ff4444" : "#4caf50"}33`, color: v < 0 ? "#ff6b6b" : "#4caf50", borderRadius: 8, fontSize: 12, cursor: "pointer" }}>{v > 0 ? "+" : ""}{v}</button>
              ))}
            </div>
            <input type="number" value={adjustVal} onChange={e => setAdjustVal(e.target.value)} style={{ ...S.input, width: "100%", marginBottom: 14 }} />
            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={() => setAdjusting(null)} style={S.btnCancel}>ยกเลิก</button>
              <button onClick={handleAdjustPoints} disabled={adjustSaving || adjustVal === ""} style={S.btnSave}>{adjustSaving ? "⏳" : "💾 บันทึก"}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function MemberRow({ m, stats, visits = 0, fav = [], tierColor, daysSince, daysUntil, rank, onDelete, onAdjust, showDelete, onDeleteCoupon }) {
  const couponGroups = groupAvailableCoupons(m.redeemed_rewards);
  const totalCoupons = couponGroups.reduce((s, g) => s + g.count, 0);

  return (
    <div style={S.memberRow}>
      {rank && <div style={{ width: 24, textAlign: "center", fontSize: 14, flexShrink: 0 }}>{rank === 1 ? "🥇" : rank === 2 ? "🥈" : rank === 3 ? "🥉" : `#${rank}`}</div>}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ fontWeight: "bold" }}>{m.nickname}</span>
          <span style={{ fontSize: 10, color: tierColor(m.tier), background: "#181818", padding: "1px 6px", borderRadius: 10, border: `1px solid ${tierColor(m.tier)}33` }}>{m.tier || "Standard"}</span>
          {totalCoupons > 0 && (
            <span style={{ fontSize: 10, background: "rgba(76,175,80,0.2)", color: "#4caf50", padding: "1px 6px", borderRadius: 10, fontWeight: "bold", border: "1px solid rgba(76,175,80,0.3)" }}>
              🎁 {totalCoupons} คูปอง
            </span>
          )}
        </div>
        <div style={{ fontSize: 12, color: "#555" }}>
          {m.phone} · <span style={{ color: "#4D96FF" }}>✅ {visits} ครั้ง</span>
          {stats?.lastVisit && <span> · {daysSince(stats.lastVisit)} วันที่แล้ว</span>}
        </div>
        {m.expires_at && (() => {
          const d = daysUntil(m.expires_at);
          const expired = d !== null && d < 0;
          const soon = d !== null && d >= 0 && d <= 30;
          return (
            <div style={{ fontSize: 11, marginTop: 2, color: expired ? "#ff4444" : soon ? "#FF9F0A" : "#444" }}>
              {expired ? "⚠️ หมดอายุแล้ว" : soon ? `⏰ หมดอายุใน ${d} วัน` : `📅 หมดอายุ ${new Date(m.expires_at).toLocaleDateString("th-TH", { day: "numeric", month: "short", year: "2-digit" })}`}
            </div>
          );
        })()}
        {couponGroups.length > 0 && (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginTop: 4 }}>
            {couponGroups.map((group, idx) => (
              <span key={idx} style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 9, color: "#aaa", background: "#151515", padding: "2px 6px", borderRadius: 4, border: "1px solid #222" }}>
                {group.name} {group.count > 1 && <span style={{ color: "#4caf50", fontWeight: "bold" }}>x{group.count}</span>}
                <button 
                  onClick={() => onDeleteCoupon?.(group.ids[0])} 
                  style={{ background: "none", border: "none", color: "#ff4444", cursor: "pointer", padding: 0, display: "flex", alignItems: "center" }}
                >
                  <Trash2 size={10} />
                </button>
              </span>
            ))}
          </div>
        )}
      </div>
      <div style={{ textAlign: "right", flexShrink: 0 }}>
        <div style={{ color: "#f5c518", fontWeight: "bold" }}>⭐ {(m.points || 0).toLocaleString()}</div>
        {showDelete && (
          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 4 }}>
            <button onClick={onAdjust} style={{ background: "none", border: "none", color: "#4D96FF", cursor: "pointer" }}><Edit2 size={14} /></button>
            <button onClick={onDelete} style={{ background: "none", border: "none", color: "#555", cursor: "pointer" }}><Trash2 size={14} /></button>
          </div>
        )}
      </div>
    </div>
  );
}

function StatCard({ icon, label, value, unit, color = "#fff" }) {
  return (
    <div style={S.statCard}>
      <div style={{ fontSize: 20 }}>{icon}</div>
      <div style={{ color, fontWeight: "bold", fontSize: 16, margin: "2px 0" }}>{value} <span style={{ fontSize: 10, fontWeight: "normal" }}>{unit}</span></div>
      <div style={{ fontSize: 10, color: "#444" }}>{label}</div>
    </div>
  );
}
function Empty({ text }) { return <div style={{ padding: 24, textAlign: "center", color: "#444", fontSize: 13 }}>{text}</div>; }

const S = {
  wrap: { height: "100%", display: "flex", flexDirection: "column", backgroundColor: "#0a0a0a", color: "#fff" },
  tabs: { display: "flex", gap: 4, padding: "10px 12px", borderBottom: "1px solid #1a1a1a", overflowX: "auto" },
  tab: { padding: "7px 14px", borderRadius: 20, border: "none", background: "#1a1a1a", color: "#666", fontSize: 12, cursor: "pointer", position: "relative", whiteSpace: "nowrap", flexShrink: 0 },
  tabActive: { background: "#4D96FF", color: "#fff", fontWeight: "bold" },
  badge: { position: "absolute", top: -4, right: -4, background: "#ff4444", color: "#fff", borderRadius: "50%", width: 16, height: 16, fontSize: 10, display: "flex", alignItems: "center", justifyContent: "center" },
  content: { flex: 1, overflowY: "auto", padding: "14px" },
  grid4: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 10, marginBottom: 14 },
  statCard: { background: "#111", borderRadius: 14, padding: "12px 10px", textAlign: "center" },
  section: { background: "#111", borderRadius: 14, padding: "14px", marginBottom: 12 },
  sectionHeader: { display: "flex", justifyContent: "space-between", alignItems: "center" },
  sectionTitle: { fontSize: 11, color: "#555", fontWeight: "bold", textTransform: "uppercase", letterSpacing: 0.8 },
  memberRow: { display: "flex", alignItems: "flex-start", gap: 8, padding: "12px 0", borderBottom: "1px solid #181818" },
  input: { background: "#1a1a1a", border: "1px solid #2a2a2a", color: "#fff", borderRadius: 8, padding: "8px 12px", fontSize: 14, outline: "none", boxSizing: "border-box" },
  btnEdit: { background: "#1a1a1a", border: "1px solid #2a2a2a", color: "#888", borderRadius: 8, padding: "5px 10px", fontSize: 12, cursor: "pointer" },
  btnSave: { background: "#4caf50", border: "none", color: "#fff", borderRadius: 8, padding: "8px 14px", fontSize: 13, cursor: "pointer", fontWeight: "bold" },
  btnCancel: { flex: 1, padding: 10, background: "#222", border: "1px solid #333", color: "#aaa", borderRadius: 10, fontSize: 14, cursor: "pointer" },
  overlay: { position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 999 },
  modal: { background: "#1a1a1a", borderRadius: 20, padding: "24px", textAlign: "center", width: 300, border: "1px solid #2a2a2a" },
  dim: { color: "#666", fontSize: 13 },
};
