import React, { useState, useMemo } from "react";
import { supabase as sb } from "../supabase";

const TABS = ["ภาพรวม", "สมาชิก", "VIP", "หายไป"];

const RATE_KEY = "katkat_point_rate";
const loadRate = () => {
  try { return JSON.parse(localStorage.getItem(RATE_KEY)) || { baht: 10, points: 1 }; }
  catch { return { baht: 10, points: 1 }; }
};
const saveRate = (r) => localStorage.setItem(RATE_KEY, JSON.stringify(r));

export default function Members({ orders = [], members: initMembers = [], onMembersChange }) {
  const [tab, setTab] = useState("ภาพรวม");
  const [members, setMembers] = useState(initMembers);
  const [pointRate, setPointRate] = useState(loadRate);
  const [editRate, setEditRate] = useState(false);
  const [rateInput, setRateInput] = useState({ baht: pointRate.baht, points: pointRate.points });
  const [search, setSearch] = useState("");
  const [deleting, setDeleting] = useState(null);

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
  const avgSpent = members.length
    ? Math.round(members.reduce((s, m) => s + (m.total_spent || 0), 0) / members.length) : 0;

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
      setMembers(updated);
      onMembersChange?.(updated);
      setDeleting(null);
    } catch (e) { alert("ลบไม่สำเร็จ: " + e.message); }
  };

  const handleSaveRate = () => {
    const r = { baht: Number(rateInput.baht) || 10, points: Number(rateInput.points) || 1 };
    setPointRate(r);
    saveRate(r);
    setEditRate(false);
  };

  const filtered = useMemo(() => {
    if (!search.trim()) return members;
    const q = search.toLowerCase();
    return members.filter(m => m.nickname?.toLowerCase().includes(q) || m.phone?.includes(q));
  }, [members, search]);

  const rowProps = (m) => ({
    m, stats: statsMap[m.phone], fav: favMenu[m.phone] || [],
    tierColor, daysSince, daysUntil, isExpired, expiringSoon,
    onDelete: () => setDeleting(m.phone),
  });

  return (
    <div style={S.wrap}>
      <div style={S.tabs}>
        {TABS.map(t => (
          <button key={t} onClick={() => setTab(t)}
            style={{ ...S.tab, ...(tab === t ? S.tabActive : {}) }}>
            {t}
            {t === "หายไป" && goneMems.length + neverCome.length > 0 && (
              <span style={S.badge}>{goneMems.length + neverCome.length}</span>
            )}
          </button>
        ))}
      </div>

      <div style={S.content}>

        {tab === "ภาพรวม" && (
          <div>
            <div style={S.grid4}>
              <StatCard icon="👥" label="สมาชิกทั้งหมด" value={members.length} unit="คน" />
              <StatCard icon="✨" label="ใหม่เดือนนี้" value={newThisMonth} unit="คน" color="#4caf50" />
              <StatCard icon="⭐" label="แต้มที่แจก" value={totalPoints.toLocaleString()} unit="แต้ม" color="#f5c518" />
              <StatCard icon="💰" label="ยอดเฉลี่ย" value={`฿${avgSpent.toLocaleString()}`} color="#4D96FF" />
            </div>

            <div style={S.section}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                <div style={S.sectionTitle}>⭐ อัตราสะสมแต้ม</div>
                <button onClick={() => { setEditRate(!editRate); setRateInput(pointRate); }} style={S.btnEdit}>
                  {editRate ? "✕ ยกเลิก" : "✏️ แก้ไข"}
                </button>
              </div>
              {editRate ? (
                <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                  <span style={{ color: "#888" }}>ทุก</span>
                  <input type="number" value={rateInput.baht}
                    onChange={e => setRateInput(r => ({ ...r, baht: e.target.value }))}
                    style={{ ...S.input, width: 70 }} />
                  <span style={{ color: "#888" }}>บาท ได้</span>
                  <input type="number" value={rateInput.points}
                    onChange={e => setRateInput(r => ({ ...r, points: e.target.value }))}
                    style={{ ...S.input, width: 60 }} />
                  <span style={{ color: "#888" }}>แต้ม</span>
                  <button onClick={handleSaveRate} style={S.btnSave}>💾 บันทึก</button>
                </div>
              ) : (
                <div style={{ fontSize: 20, fontWeight: "bold", color: "#f5c518" }}>
                  ทุก ฿{pointRate.baht} = {pointRate.points} แต้ม
                  <div style={{ fontSize: 12, color: "#666", fontWeight: "normal", marginTop: 4 }}>
                    ฿100 ≈ {Math.round(100 / pointRate.baht * pointRate.points)} แต้ม
                  </div>
                </div>
              )}
            </div>

            <div style={S.section}>
              <div style={S.sectionTitle}>สมาชิกล่าสุด</div>
              {members.slice(0, 5).map(m => <MemberRow key={m.phone} {...rowProps(m)} />)}
              {members.length === 0 && <Empty text="ยังไม่มีสมาชิก" />}
            </div>
          </div>
        )}

        {tab === "สมาชิก" && (
          <div>
            <input placeholder="🔍 ค้นหาชื่อหรือเบอร์..." value={search}
              onChange={e => setSearch(e.target.value)}
              style={{ ...S.input, width: "100%", marginBottom: 10, fontSize: 15 }} />
            <div style={{ fontSize: 12, color: "#555", marginBottom: 8 }}>
              แสดง {Math.min(filtered.length, 50)} / {members.length} คน
            </div>
            <div style={S.section}>
              {filtered.slice(0, 50).map(m => <MemberRow key={m.phone} {...rowProps(m)} showDelete />)}
              {filtered.length === 0 && <Empty text="ไม่พบสมาชิก" />}
              {filtered.length > 50 && (
                <div style={{ textAlign: "center", color: "#555", padding: 10, fontSize: 12 }}>
                  ค้นหาเพื่อดูเพิ่ม
                </div>
              )}
            </div>
          </div>
        )}

        {tab === "VIP" && (
          <div style={S.section}>
            <div style={S.sectionTitle}>เรียงตามยอดใช้จ่าย</div>
            {[...members].sort((a, b) => (b.total_spent || 0) - (a.total_spent || 0))
              .map((m, i) => <MemberRow key={m.phone} {...rowProps(m)} rank={i + 1} showDelete />)}
            {members.length === 0 && <Empty text="ยังไม่มีสมาชิก" />}
          </div>
        )}

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
            {goneMems.length === 0 && neverCome.length === 0 && (
              <Empty text="สมาชิกทุกคนยังมาสม่ำเสมอ 👍" />
            )}
          </div>
        )}
      </div>

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
    </div>
  );
}

function MemberRow({ m, stats, fav = [], tierColor, daysSince, daysUntil, isExpired, expiringSoon, rank, onDelete, showDelete }) {
  const expired = isExpired(m);
  const soon = expiringSoon(m);
  const dLeft = daysUntil(m.expires_at);
  const visits = stats?.count || 0;

  return (
    <div style={{ ...S.memberRow, opacity: expired ? 0.55 : 1 }}>
      {rank && (
        <div style={{ width: 30, textAlign: "center", fontSize: 18, flexShrink: 0 }}>
          {rank === 1 ? "🥇" : rank === 2 ? "🥈" : rank === 3 ? "🥉" : (
            <span style={{ color: "#444", fontSize: 13 }}>#{rank}</span>
          )}
        </div>
      )}

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
          <span style={{ fontWeight: "bold" }}>{m.nickname}</span>
          <span style={{ fontSize: 11, color: tierColor(m.tier), background: "#181818",
            padding: "2px 8px", borderRadius: 10, border: `1px solid ${tierColor(m.tier)}33` }}>
            {m.tier || "Standard"}
          </span>
          {expired && <span style={{ fontSize: 10, background: "#ff4444", color: "#fff", padding: "2px 7px", borderRadius: 8 }}>หมดอายุ</span>}
          {soon && !expired && <span style={{ fontSize: 10, background: "#ff9800", color: "#000", padding: "2px 7px", borderRadius: 8 }}>หมดใน {dLeft} วัน</span>}
        </div>

        <div style={{ fontSize: 12, color: "#555", marginTop: 3 }}>
          {m.phone}
          {" · "}
          <span style={{ color: "#4D96FF" }}>✅ {visits} ครั้ง</span>
          {stats?.lastVisit && <span> · {daysSince(stats.lastVisit)} วันที่แล้ว</span>}
        </div>

        {m.expires_at && (
          <div style={{ fontSize: 11, color: expired ? "#ff4444" : soon ? "#ff9800" : "#444", marginTop: 2 }}>
            🗓 หมดอายุ {new Date(m.expires_at).toLocaleDateString("th-TH")}
          </div>
        )}

        {fav?.length > 0 && (
          <div style={{ marginTop: 5, display: "flex", gap: 4, flexWrap: "wrap" }}>
            {fav.map(([name, cnt]) => (
              <span key={name} style={S.tag}>🍽 {name} ×{cnt}</span>
            ))}
          </div>
        )}
      </div>

      <div style={{ textAlign: "right", flexShrink: 0, marginLeft: 8 }}>
        <div style={{ color: "#f5c518", fontWeight: "bold" }}>⭐ {(m.points || 0).toLocaleString()}</div>
        <div style={{ color: "#4caf50", fontSize: 12 }}>฿{(m.total_spent || 0).toLocaleString()}</div>
        {showDelete && (
          <button onClick={onDelete} style={S.btnDelete} title="ลบสมาชิก">🗑️</button>
        )}
      </div>
    </div>
  );
}

function StatCard({ icon, label, value, unit, color = "#fff" }) {
  return (
    <div style={S.statCard}>
      <div style={{ fontSize: 22 }}>{icon}</div>
      <div style={{ color, fontWeight: "bold", fontSize: 18, margin: "4px 0" }}>
        {value} <span style={{ fontSize: 12, fontWeight: "normal" }}>{unit}</span>
      </div>
      <div style={{ fontSize: 11, color: "#555" }}>{label}</div>
    </div>
  );
}

function Empty({ text }) {
  return <div style={{ padding: 24, textAlign: "center", color: "#444", fontSize: 13 }}>{text}</div>;
}

const S = {
  wrap: { height: "100%", display: "flex", flexDirection: "column", backgroundColor: "#0a0a0a", color: "#fff" },
  tabs: { display: "flex", gap: 4, padding: "10px 12px", borderBottom: "1px solid #1a1a1a", overflowX: "auto" },
  tab: { padding: "7px 14px", borderRadius: 20, border: "none", background: "#1a1a1a", color: "#666",
    fontSize: 12, cursor: "pointer", position: "relative", whiteSpace: "nowrap", flexShrink: 0 },
  tabActive: { background: "#4D96FF", color: "#fff", fontWeight: "bold" },
  badge: { position: "absolute", top: -4, right: -4, background: "#ff4444", color: "#fff",
    borderRadius: "50%", width: 16, height: 16, fontSize: 10,
    display: "flex", alignItems: "center", justifyContent: "center" },
  content: { flex: 1, overflowY: "auto", padding: "14px" },
  grid4: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 14 },
  statCard: { background: "#111", borderRadius: 14, padding: "14px 12px", textAlign: "center" },
  section: { background: "#111", borderRadius: 14, padding: "14px", marginBottom: 12 },
  sectionTitle: { fontSize: 11, color: "#555", fontWeight: "bold", marginBottom: 10, textTransform: "uppercase", letterSpacing: 0.8 },
  memberRow: { display: "flex", alignItems: "flex-start", gap: 8, padding: "12px 0", borderBottom: "1px solid #181818" },
  tag: { background: "#181818", borderRadius: 8, padding: "2px 8px", fontSize: 11, color: "#666" },
  input: { background: "#1a1a1a", border: "1px solid #2a2a2a", color: "#fff", borderRadius: 8,
    padding: "8px 12px", fontSize: 14, outline: "none", boxSizing: "border-box" },
  btnEdit: { background: "#1a1a1a", border: "1px solid #2a2a2a", color: "#888", borderRadius: 8,
    padding: "5px 12px", fontSize: 12, cursor: "pointer" },
  btnSave: { background: "#4caf50", border: "none", color: "#fff", borderRadius: 8,
    padding: "8px 14px", fontSize: 13, cursor: "pointer", fontWeight: "bold" },
  btnDelete: { background: "none", border: "none", color: "#444", fontSize: 16,
    cursor: "pointer", marginTop: 6, padding: "3px 5px", borderRadius: 6, display: "block" },
  btnCancel: { flex: 1, padding: 12, background: "#222", border: "1px solid #333",
    color: "#aaa", borderRadius: 10, fontSize: 15, cursor: "pointer" },
  btnDeleteConfirm: { flex: 1, padding: 12, background: "#ff4444", border: "none",
    color: "#fff", borderRadius: 10, fontSize: 15, fontWeight: "bold", cursor: "pointer" },
  overlay: { position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)",
    display: "flex", alignItems: "center", justifyContent: "center", zIndex: 999 },
  modal: { background: "#1a1a1a", borderRadius: 20, padding: "28px 24px",
    textAlign: "center", width: 300, border: "1px solid #2a2a2a" },
};