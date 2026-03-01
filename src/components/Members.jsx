import React, { useState, useMemo } from "react";
import { supabase as sb } from "../supabase";
import RewardManager from "./RewardManager";

const TABS = ["ภาพรวม", "สมาชิก", "VIP", "หายไป", "ประวัติ", "Rewards"];

// ── Storage keys ──
const RATE_KEY = "katkat_point_rate";
const TIERS_KEY = "katkat_bonus_tiers";

const defaultRate = { baht: 10, points: 1 };
const defaultTiers = [
  { id: 1, minSpend: 200, multiplier: 2 },
  { id: 2, minSpend: 350, multiplier: 3 },
];

const loadRate = () => { try { return JSON.parse(localStorage.getItem(RATE_KEY)) || defaultRate; } catch { return defaultRate; } };
const loadTiers = () => { try { return JSON.parse(localStorage.getItem(TIERS_KEY)) || defaultTiers; } catch { return defaultTiers; } };
const saveRate = (r) => localStorage.setItem(RATE_KEY, JSON.stringify(r));
const saveTiers = (t) => localStorage.setItem(TIERS_KEY, JSON.stringify(t));

// ── Exported helpers (ใช้ใน App.jsx / MobilePOS / Cart) ──
export const calcPoints = (total, rate, tiers) => {
  const base = Math.floor(total / rate.baht) * rate.points;
  const sorted = [...tiers].sort((a, b) => b.minSpend - a.minSpend);
  const match = sorted.find(t => total >= t.minSpend);
  return match ? base * match.multiplier : base;
};

export const nextThreshold = (total, tiers) => {
  const sorted = [...tiers].sort((a, b) => a.minSpend - b.minSpend);
  return sorted.find(t => total < t.minSpend) || null;
};

export const getPointSettings = () => ({ rate: loadRate(), tiers: loadTiers() });

// ────────────────────────────────────────────────
export default function Members({ orders = [], members: initMembers = [], onMembersChange }) {
  const [tab, setTab] = useState("ภาพรวม");
  const [members, setMembers] = useState(initMembers);
  const [pointRate, setPointRate] = useState(loadRate);
  const [tiers, setTiers] = useState(loadTiers);
  const [editRate, setEditRate] = useState(false);
  const [editTiers, setEditTiers] = useState(false);
  const [rateInput, setRateInput] = useState(pointRate);
  const [tiersInput, setTiersInput] = useState(tiers);
  const [search, setSearch] = useState("");
  const [deleting, setDeleting] = useState(null);
  const [adjusting, setAdjusting] = useState(null); // { phone, nickname, points }
  const [adjustVal, setAdjustVal] = useState("");
  const [adjustNote, setAdjustNote] = useState("");
  const [adjustSaving, setAdjustSaving] = useState(false);
  const [history, setHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  React.useEffect(() => { setMembers(initMembers); }, [initMembers]);

  const memberOrders = useMemo(() => orders.filter(o => o.member_phone), [orders]);
  const statsMap = useMemo(() => {
    const map = {};
    memberOrders.forEach(o => {
      const p = o.member_phone;
      if (!map[p]) map[p] = { count: 0, lastVisit: null, items: [] };
      map[p].count++;
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

  const thisMonth = new Date().toISOString().slice(0, 7);
  const newThisMonth = members.filter(m => m.created_at?.slice(0, 7) === thisMonth).length;
  const totalPoints = members.reduce((s, m) => s + (m.points || 0), 0);
  const avgSpent = members.length ? Math.round(members.reduce((s, m) => s + (m.total_spent || 0), 0) / members.length) : 0;
  const cutoff30 = new Date(Date.now() - 30 * 86400000).toISOString();
  const goneMems = members.filter(m => { const s = statsMap[m.phone]; return s?.lastVisit && s.lastVisit < cutoff30; });
  const neverCome = members.filter(m => !statsMap[m.phone]);

  const daysSince = d => d ? Math.floor((Date.now() - new Date(d)) / 86400000) : "?";
  const daysUntil = d => d ? Math.ceil((new Date(d) - Date.now()) / 86400000) : null;
  const tierColor = t => ({ Standard: "#888", Silver: "#ccc", Gold: "#f5c518" })[t] || "#888";
  const isExpired = m => m.expires_at && new Date(m.expires_at) < new Date();
  const expiringSoon = m => { const d = daysUntil(m.expires_at); return d !== null && d >= 0 && d <= 30; };

  const handleDelete = async (phone) => {
    try {
      await sb.from("members").delete().eq("phone", phone);
      const updated = members.filter(m => m.phone !== phone);
      setMembers(updated); onMembersChange?.(updated); setDeleting(null);
    } catch (e) { alert("ลบไม่สำเร็จ: " + e.message); }
  };

  const handleSaveRate = () => {
    const r = { baht: Number(rateInput.baht) || 10, points: Number(rateInput.points) || 1 };
    setPointRate(r); saveRate(r); setEditRate(false);
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
        note: adjustNote || `แก้ไขแต้มโดย admin (${delta > 0 ? "+" : ""}${delta})`,
      });
      setMembers(prev => prev.map(m => m.phone === adjusting.phone ? { ...m, points: newPoints } : m));
      onMembersChange?.(members.map(m => m.phone === adjusting.phone ? { ...m, points: newPoints } : m));
      setAdjusting(null); setAdjustVal(""); setAdjustNote("");
    } catch (e) { alert("แก้แต้มไม่สำเร็จ: " + e.message); }
    setAdjustSaving(false);
  };

  const fetchHistory = async () => {
    setHistoryLoading(true);
    const { data } = await sb.from("point_history")
      .select("*, members(nickname)")
      .order("created_at", { ascending: false })
      .limit(100);
    setHistory(data || []);
    setHistoryLoading(false);
  };

  const deleteHistory = async (id) => {
    await sb.from("point_history").delete().eq("id", id);
    setHistory(prev => prev.filter(h => h.id !== id));
  };

  const handleSaveTiers = () => {
    const cleaned = tiersInput
      .filter(t => t.minSpend > 0 && t.multiplier > 1)
      .sort((a, b) => a.minSpend - b.minSpend);
    setTiers(cleaned); saveTiers(cleaned); setEditTiers(false);
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
    m, stats: statsMap[m.phone], fav: favMenu[m.phone] || [],
    tierColor, daysSince, daysUntil, isExpired, expiringSoon,
    onDelete: () => setDeleting(m.phone),
    onAdjust: () => { setAdjusting(m); setAdjustVal(""); setAdjustNote(""); },
  });

  // preview คำนวณแต้มตัวอย่าง
  const previewPoints = (spend) => calcPoints(spend, pointRate, tiers);

  return (
    <div style={S.wrap}>
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

        {/* ══ ภาพรวม ══ */}
        {tab === "ภาพรวม" && (
          <div>
            <div style={S.grid4}>
              <StatCard icon="👥" label="สมาชิกทั้งหมด" value={members.length} unit="คน" />
              <StatCard icon="✨" label="ใหม่เดือนนี้" value={newThisMonth} unit="คน" color="#4caf50" />
              <StatCard icon="⭐" label="แต้มที่แจก" value={totalPoints.toLocaleString()} unit="แต้ม" color="#f5c518" />
              <StatCard icon="💰" label="ยอดเฉลี่ย" value={`฿${avgSpent.toLocaleString()}`} color="#4D96FF" />
            </div>

            {/* ── อัตราแต้มพื้นฐาน ── */}
            <div style={S.section}>
              <div style={S.sectionHeader}>
                <div style={S.sectionTitle}>⭐ อัตราแต้มพื้นฐาน</div>
                <button onClick={() => { setEditRate(!editRate); setRateInput(pointRate); }} style={S.btnEdit}>
                  {editRate ? "✕" : "✏️"}
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

            {/* ── Bonus Tiers ── */}
            <div style={S.section}>
              <div style={S.sectionHeader}>
                <div style={S.sectionTitle}>🚀 Bonus Tiers</div>
                <button onClick={() => { setEditTiers(!editTiers); setTiersInput(tiers.map(t => ({ ...t }))); }} style={S.btnEdit}>
                  {editTiers ? "✕" : "✏️"}
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
                  {/* แสดง tiers ปัจจุบัน */}
                  {[...tiers].sort((a, b) => a.minSpend - b.minSpend).map((t, i) => (
                    <div key={t.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center",
                      padding: "8px 12px", background: "#181818", borderRadius: 10, marginBottom: 6 }}>
                      <div>
                        <span style={{ color: i === 0 ? "#4D96FF" : "#f5c518", fontWeight: "bold" }}>
                          {t.multiplier}x
                        </span>
                        <span style={{ color: "#666", fontSize: 13, marginLeft: 8 }}>
                          ยอด ≥ ฿{t.minSpend.toLocaleString()}
                        </span>
                      </div>
                      <div style={{ fontSize: 12, color: "#555" }}>
                        ฿{t.minSpend} → {calcPoints(t.minSpend, pointRate, tiers)} แต้ม
                      </div>
                    </div>
                  ))}
                  {tiers.length === 0 && <div style={{ color: "#444", fontSize: 13 }}>ยังไม่มี bonus tier</div>}

                  {/* preview ตาราง */}
                  <div style={{ marginTop: 12, borderTop: "1px solid #1a1a1a", paddingTop: 10 }}>
                    <div style={{ fontSize: 11, color: "#555", marginBottom: 6 }}>ตัวอย่างแต้มที่ได้</div>
                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                      {[100, 150, 200, 300, 350, 500].map(amt => (
                        <div key={amt} style={{ background: "#181818", borderRadius: 8, padding: "5px 10px", textAlign: "center" }}>
                          <div style={{ fontSize: 11, color: "#555" }}>฿{amt}</div>
                          <div style={{ fontWeight: "bold", color: previewPoints(amt) > calcPoints(amt, pointRate, []) ? "#f5c518" : "#fff" }}>
                            {previewPoints(amt)} ⭐
                            {previewPoints(amt) > calcPoints(amt, pointRate, []) && (
                              <span style={{ fontSize: 10, color: "#f5c518", marginLeft: 3 }}>
                                {Math.round(tiers.sort((a,b)=>b.minSpend-a.minSpend).find(t=>amt>=t.minSpend)?.multiplier || 1)}x
                              </span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* สมาชิกล่าสุด */}
            <div style={S.section}>
              <div style={S.sectionTitle}>สมาชิกล่าสุด</div>
              {members.slice(0, 5).map(m => <MemberRow key={m.phone} {...rowProps(m)} />)}
              {members.length === 0 && <Empty text="ยังไม่มีสมาชิก" />}
            </div>
          </div>
        )}

        {/* ══ สมาชิก ══ */}
        {tab === "สมาชิก" && (
          <div>
            <input placeholder="🔍 ค้นหาชื่อหรือเบอร์..." value={search}
              onChange={e => setSearch(e.target.value)}
              style={{ ...S.input, width: "100%", marginBottom: 10, fontSize: 15 }} />
            <div style={{ fontSize: 12, color: "#444", marginBottom: 8 }}>
              แสดง {Math.min(filtered.length, 50)} / {members.length} คน
            </div>
            <div style={S.section}>
              {filtered.slice(0, 50).map(m => <MemberRow key={m.phone} {...rowProps(m)} showDelete />)}
              {filtered.length === 0 && <Empty text="ไม่พบสมาชิก" />}
            </div>
          </div>
        )}

        {/* ══ VIP ══ */}
        {tab === "VIP" && (
          <div style={S.section}>
            <div style={S.sectionTitle}>เรียงตามยอดใช้จ่าย</div>
            {[...members].sort((a, b) => (b.total_spent || 0) - (a.total_spent || 0))
              .map((m, i) => <MemberRow key={m.phone} {...rowProps(m)} rank={i + 1} showDelete />)}
            {members.length === 0 && <Empty text="ยังไม่มีสมาชิก" />}
          </div>
        )}

        {/* ══ หายไป ══ */}
        {tab === "หายไป" && (
          <div>
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
            {goneMems.length === 0 && neverCome.length === 0 && <Empty text="สมาชิกทุกคนยังมาสม่ำเสมอ 👍" />}
          </div>
        )}

        {/* ══ ประวัติแต้ม ══ */}
        {tab === "ประวัติ" && (
          <div>
            <button onClick={fetchHistory} style={{ ...S.btnEdit, marginBottom: 12, color: "#4D96FF", borderColor: "#4D96FF" }}>
              🔄 โหลดประวัติล่าสุด
            </button>
            {historyLoading ? <Empty text="กำลังโหลด..." /> : history.length === 0 ? (
              <Empty text="กด 'โหลดประวัติล่าสุด' เพื่อดูข้อมูล" />
            ) : (
              <div style={S.section}>
                <div style={S.sectionTitle}>100 รายการล่าสุด</div>
                {history.map(h => (
                  <div key={h.id} style={S.memberRow}>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <span style={{ fontSize: 16 }}>
                          {h.type === "earn" ? "⭐" : h.type === "redeem" ? "🎁" : "✏️"}
                        </span>
                        <span style={{ fontWeight: "bold", fontSize: 13 }}>
                          {h.members?.nickname || h.member_phone}
                        </span>
                        <span style={{ fontSize: 11, color: "#555" }}>{h.member_phone}</span>
                      </div>
                      <div style={{ fontSize: 12, color: "#666", marginTop: 2 }}>{h.note || h.type}</div>
                      <div style={{ fontSize: 11, color: "#444", marginTop: 1 }}>
                        {new Date(h.created_at).toLocaleString("th-TH")}
                      </div>
                    </div>
                    <div style={{ textAlign: "right", flexShrink: 0, display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 6 }}>
                      <span style={{ fontWeight: "bold", color: h.points > 0 ? "#4caf50" : "#ff6b6b", fontSize: 15 }}>
                        {h.points > 0 ? "+" : ""}{h.points} ⭐
                      </span>
                      <button onClick={() => deleteHistory(h.id)}
                        style={{ background: "none", border: "none", color: "#333", fontSize: 14, cursor: "pointer", padding: "2px 4px" }}>
                        🗑️
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ══ Rewards ══ */}
        {tab === "Rewards" && <RewardManager />}
      </div>

      {/* Confirm Delete */}
      {deleting && (
        <div style={S.overlay} onClick={() => setDeleting(null)}>
          <div style={S.modal} onClick={e => e.stopPropagation()}>
            <div style={{ fontSize: 44, marginBottom: 8 }}>🗑️</div>
            <div style={{ fontWeight: "bold", fontSize: 16, marginBottom: 6 }}>ลบสมาชิก?</div>
            <div style={{ color: "#666", fontSize: 13, marginBottom: 20 }}>
              {members.find(m => m.phone === deleting)?.nickname} · {deleting}
            </div>
            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={() => setDeleting(null)} style={S.btnCancel}>ยกเลิก</button>
              <button onClick={() => handleDelete(deleting)} style={S.btnDeleteConfirm}>ลบเลย</button>
            </div>
          </div>
        </div>
      )}

      {/* Adjust Points Modal */}
      {adjusting && (
        <div style={S.overlay} onClick={() => setAdjusting(null)}>
          <div style={{ ...S.modal, width: 320, textAlign: "left" }} onClick={e => e.stopPropagation()}>
            <div style={{ fontWeight: "bold", fontSize: 16, marginBottom: 4 }}>✏️ แก้ไขแต้ม</div>
            <div style={{ color: "#888", fontSize: 13, marginBottom: 16 }}>
              {adjusting.nickname} · ⭐ {adjusting.points || 0} แต้ม
            </div>

            <div style={{ fontSize: 12, color: "#555", marginBottom: 6 }}>เพิ่ม/ลด แต้ม (ใส่ - เพื่อลด)</div>
            <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
              {[-50, -10, +10, +50, +100].map(v => (
                <button key={v} onClick={() => setAdjustVal(String(v))}
                  style={{ flex: 1, padding: "6px 0", background: v < 0 ? "#2a1a1a" : "#1a2a1a",
                    border: `1px solid ${v < 0 ? "#ff4444" : "#4caf50"}33`,
                    color: v < 0 ? "#ff6b6b" : "#4caf50", borderRadius: 8, fontSize: 12, cursor: "pointer" }}>
                  {v > 0 ? "+" : ""}{v}
                </button>
              ))}
            </div>
            <input type="number" placeholder="หรือใส่จำนวนเอง เช่น +30 หรือ -20"
              value={adjustVal} onChange={e => setAdjustVal(e.target.value)}
              style={{ ...S.input, width: "100%", marginBottom: 8 }} />
            <input placeholder="หมายเหตุ (optional)" value={adjustNote}
              onChange={e => setAdjustNote(e.target.value)}
              style={{ ...S.input, width: "100%", marginBottom: 14 }} />

            {adjustVal !== "" && !isNaN(Number(adjustVal)) && (
              <div style={{ fontSize: 13, color: "#888", marginBottom: 12, textAlign: "center" }}>
                แต้มใหม่จะเป็น:{" "}
                <span style={{ color: "#f5c518", fontWeight: "bold", fontSize: 16 }}>
                  ⭐ {Math.max(0, (adjusting.points || 0) + Number(adjustVal))}
                </span>
              </div>
            )}

            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={() => setAdjusting(null)} style={S.btnCancel}>ยกเลิก</button>
              <button onClick={handleAdjustPoints} disabled={adjustSaving || adjustVal === ""}
                style={{ ...S.btnSave, flex: 2, opacity: adjustVal === "" ? 0.5 : 1 }}>
                {adjustSaving ? "กำลังบันทึก..." : "💾 บันทึก"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function MemberRow({ m, stats, fav = [], tierColor, daysSince, daysUntil, isExpired, expiringSoon, rank, onDelete, onAdjust, showDelete }) {
  const expired = isExpired(m);
  const soon = expiringSoon(m);
  const dLeft = daysUntil(m.expires_at);
  const visits = stats?.count || 0;
  return (
    <div style={{ ...S.memberRow, opacity: expired ? 0.55 : 1 }}>
      {rank && (
        <div style={{ width: 30, textAlign: "center", fontSize: 16, flexShrink: 0 }}>
          {rank === 1 ? "🥇" : rank === 2 ? "🥈" : rank === 3 ? "🥉" : <span style={{ color: "#333", fontSize: 12 }}>#{rank}</span>}
        </div>
      )}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
          <span style={{ fontWeight: "bold" }}>{m.nickname}</span>
          <span style={{ fontSize: 11, color: tierColor(m.tier), background: "#181818", padding: "2px 8px", borderRadius: 10, border: `1px solid ${tierColor(m.tier)}33` }}>
            {m.tier || "Standard"}
          </span>
          {expired && <span style={{ fontSize: 10, background: "#ff4444", color: "#fff", padding: "2px 7px", borderRadius: 8 }}>หมดอายุ</span>}
          {soon && !expired && <span style={{ fontSize: 10, background: "#ff9800", color: "#000", padding: "2px 7px", borderRadius: 8 }}>หมดใน {dLeft} วัน</span>}
        </div>
        <div style={{ fontSize: 12, color: "#555", marginTop: 3 }}>
          {m.phone} · <span style={{ color: "#4D96FF" }}>✅ {visits} ครั้ง</span>
          {stats?.lastVisit && <span> · {daysSince(stats.lastVisit)} วันที่แล้ว</span>}
        </div>
        {m.expires_at && (
          <div style={{ fontSize: 11, color: expired ? "#ff4444" : soon ? "#ff9800" : "#333", marginTop: 2 }}>
            🗓 หมดอายุ {new Date(m.expires_at).toLocaleDateString("th-TH")}
          </div>
        )}
        {fav?.length > 0 && (
          <div style={{ marginTop: 4, display: "flex", gap: 4, flexWrap: "wrap" }}>
            {fav.map(([name, cnt]) => <span key={name} style={S.tag}>🍽 {name} ×{cnt}</span>)}
          </div>
        )}
      </div>
      <div style={{ textAlign: "right", flexShrink: 0, marginLeft: 8 }}>
        <div style={{ color: "#f5c518", fontWeight: "bold" }}>⭐ {(m.points || 0).toLocaleString()}</div>
        <div style={{ color: "#4caf50", fontSize: 12 }}>฿{(m.total_spent || 0).toLocaleString()}</div>
        {showDelete && (
          <div style={{ display: "flex", gap: 4, justifyContent: "flex-end" }}>
            <button onClick={onAdjust} style={{ ...S.btnDelete, color: "#4D96FF", fontSize: 14 }} title="แก้ไขแต้ม">✏️</button>
            <button onClick={onDelete} style={S.btnDelete} title="ลบสมาชิก">🗑️</button>
          </div>
        )}
      </div>
    </div>
  );
}

function StatCard({ icon, label, value, unit, color = "#fff" }) {
  return (
    <div style={S.statCard}>
      <div style={{ fontSize: 22 }}>{icon}</div>
      <div style={{ color, fontWeight: "bold", fontSize: 18, margin: "4px 0" }}>{value} <span style={{ fontSize: 12, fontWeight: "normal" }}>{unit}</span></div>
      <div style={{ fontSize: 11, color: "#444" }}>{label}</div>
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
  grid4: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 14 },
  statCard: { background: "#111", borderRadius: 14, padding: "14px 12px", textAlign: "center" },
  section: { background: "#111", borderRadius: 14, padding: "14px", marginBottom: 12 },
  sectionHeader: { display: "flex", justifyContent: "space-between", alignItems: "center" },
  sectionTitle: { fontSize: 11, color: "#555", fontWeight: "bold", textTransform: "uppercase", letterSpacing: 0.8 },
  memberRow: { display: "flex", alignItems: "flex-start", gap: 8, padding: "12px 0", borderBottom: "1px solid #181818" },
  tag: { background: "#181818", borderRadius: 8, padding: "2px 8px", fontSize: 11, color: "#555" },
  input: { background: "#1a1a1a", border: "1px solid #2a2a2a", color: "#fff", borderRadius: 8, padding: "8px 12px", fontSize: 14, outline: "none", boxSizing: "border-box" },
  btnEdit: { background: "#1a1a1a", border: "1px solid #2a2a2a", color: "#888", borderRadius: 8, padding: "5px 10px", fontSize: 12, cursor: "pointer" },
  btnSave: { background: "#4caf50", border: "none", color: "#fff", borderRadius: 8, padding: "8px 14px", fontSize: 13, cursor: "pointer", fontWeight: "bold" },
  btnDelete: { background: "none", border: "none", color: "#333", fontSize: 15, cursor: "pointer", marginTop: 5, padding: "2px 4px", borderRadius: 6, display: "block" },
  btnCancel: { flex: 1, padding: 12, background: "#222", border: "1px solid #333", color: "#aaa", borderRadius: 10, fontSize: 15, cursor: "pointer" },
  btnDeleteConfirm: { flex: 1, padding: 12, background: "#ff4444", border: "none", color: "#fff", borderRadius: 10, fontSize: 15, fontWeight: "bold", cursor: "pointer" },
  overlay: { position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 999 },
  modal: { background: "#1a1a1a", borderRadius: 20, padding: "28px 24px", textAlign: "center", width: 300, border: "1px solid #2a2a2a" },
  dim: { color: "#666", fontSize: 13 },
};