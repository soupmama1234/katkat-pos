import React, { useState, useMemo } from "react";

const TABS = ["ภาพรวม", "VIP", "หายไป", "เมนูโปรด"];

export default function Members({ orders = [], members = [] }) {
  const [tab, setTab] = useState("ภาพรวม");

  // orders ที่ผูกกับสมาชิก
  const memberOrders = useMemo(
    () => orders.filter(o => o.member_phone),
    [orders]
  );

  // นับจำนวน orders และ last visit ต่อ phone
  const statsMap = useMemo(() => {
    const map = {};
    memberOrders.forEach(o => {
      if (!map[o.member_phone])
        map[o.member_phone] = { count: 0, lastVisit: null, items: [] };

      map[o.member_phone].count++;

      const t = o.time || o.created_at;
      if (!map[o.member_phone].lastVisit || t > map[o.member_phone].lastVisit)
        map[o.member_phone].lastVisit = t;

      (o.items || []).forEach(item =>
        map[o.member_phone].items.push(item.name)
      );
    });
    return map;
  }, [memberOrders]);

  const thisMonth = new Date().toISOString().slice(0, 7);
  const newThisMonth = members.filter(
    m => m.created_at?.slice(0, 7) === thisMonth
  ).length;

  const totalPoints = members.reduce(
    (s, m) => s + (m.points || 0),
    0
  );

  const avgSpent = members.length
    ? Math.round(
        members.reduce((s, m) => s + (m.total_spent || 0), 0) /
          members.length
      )
    : 0;

  const cutoff = new Date(
    Date.now() - 30 * 86400000
  ).toISOString();

  const goneMems = members.filter(m => {
    const s = statsMap[m.phone];
    return s && s.lastVisit && s.lastVisit < cutoff;
  });

  const neverCome = members.filter(
    m => !statsMap[m.phone]
  );

  const favMenu = useMemo(() => {
    const result = {};
    Object.entries(statsMap).forEach(([phone, s]) => {
      const freq = {};
      s.items.forEach(n => {
        freq[n] = (freq[n] || 0) + 1;
      });
      const sorted = Object.entries(freq)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3);
      result[phone] = sorted;
    });
    return result;
  }, [statsMap]);

  const daysSince = dateStr => {
    if (!dateStr) return "?";
    return Math.floor(
      (Date.now() - new Date(dateStr)) / 86400000
    );
  };

  const tierColor = tier =>
    ({
      Standard: "#888",
      Silver: "#aaa",
      Gold: "#f5c518"
    })[tier] || "#888";

  return (
    <div style={S.wrap}>
      <div style={S.tabs}>
        {TABS.map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            style={{
              ...S.tab,
              ...(tab === t ? S.tabActive : {})
            }}
          >
            {t}
            {t === "หายไป" &&
              goneMems.length + neverCome.length >
                0 && (
                <span style={S.badge}>
                  {goneMems.length +
                    neverCome.length}
                </span>
              )}
          </button>
        ))}
      </div>

      <div style={S.content}>
        {tab === "ภาพรวม" && (
          <div>
            <div style={S.grid4}>
              <StatCard
                icon="👥"
                label="สมาชิกทั้งหมด"
                value={members.length}
                unit="คน"
              />
              <StatCard
                icon="✨"
                label="สมาชิกใหม่เดือนนี้"
                value={newThisMonth}
                unit="คน"
                color="#4caf50"
              />
              <StatCard
                icon="⭐"
                label="แต้มที่แจกรวม"
                value={totalPoints.toLocaleString()}
                unit="แต้ม"
                color="#f5c518"
              />
              <StatCard
                icon="💰"
                label="ยอดใช้จ่ายเฉลี่ย"
                value={`฿${avgSpent.toLocaleString()}`}
                color="#4D96FF"
              />
            </div>

            <div style={S.section}>
              <div style={S.sectionTitle}>
                สมาชิกล่าสุด
              </div>
              {members.slice(0, 5).map(m => (
                <MemberRow
                  key={m.phone}
                  m={m}
                  stats={statsMap[m.phone]}
                  favMenu={favMenu[m.phone]}
                  tierColor={tierColor}
                  daysSince={daysSince}
                />
              ))}
              {members.length === 0 && (
                <Empty text="ยังไม่มีสมาชิก" />
              )}
            </div>
          </div>
        )}

        {tab === "VIP" && (
          <div style={S.section}>
            <div style={S.sectionTitle}>
              เรียงตามยอดใช้จ่าย
            </div>
            {[...members]
              .sort(
                (a, b) =>
                  (b.total_spent || 0) -
                  (a.total_spent || 0)
              )
              .map((m, i) => (
                <MemberRow
                  key={m.phone}
                  m={m}
                  stats={statsMap[m.phone]}
                  favMenu={favMenu[m.phone]}
                  tierColor={tierColor}
                  daysSince={daysSince}
                />
              ))}
          </div>
        )}

        {tab === "หายไป" && (
          <div>
            {goneMems.length === 0 &&
              neverCome.length === 0 && (
                <Empty text="สมาชิกทุกคนยังมาสม่ำเสมอ 👍" />
              )}
          </div>
        )}

        {tab === "เมนูโปรด" && (
          <div style={S.section}>
            <div style={S.sectionTitle}>
              เมนูที่สั่งบ่อยต่อสมาชิก
            </div>
            {members
              .filter(
                m =>
                  favMenu[m.phone]?.length > 0
              )
              .map(m => (
                <div
                  key={m.phone}
                  style={S.menuRow}
                >
                  <div
                    style={{
                      fontWeight: "bold"
                    }}
                  >
                    {m.nickname}
                  </div>
                  <div>
                    {favMenu[m.phone].map(
                      ([name, cnt]) => (
                        <span
                          key={name}
                          style={S.menuTag}
                        >
                          {name} ×{cnt}
                        </span>
                      )
                    )}
                  </div>
                </div>
              ))}
          </div>
        )}
      </div>
    </div>
  );
}

function StatCard({
  icon,
  label,
  value,
  unit,
  color = "#fff"
}) {
  return (
    <div style={S.statCard}>
      <div>{icon}</div>
      <div style={{ color }}>
        {value} {unit}
      </div>
      <div>{label}</div>
    </div>
  );
}

function MemberRow({
  m,
  stats,
  favMenu,
  tierColor,
  daysSince
}) {
  return (
    <div style={S.memberRow}>
      <div style={{ flex: 1 }}>
        <div>
          {m.nickname} •{" "}
          <span
            style={{
              color: tierColor(m.tier)
            }}
          >
            {m.tier}
          </span>
        </div>
        <div style={{ fontSize: 12 }}>
          {m.phone} • มา{" "}
          {stats?.count || 0} ครั้ง
        </div>
      </div>
      <div>
        ฿
        {(m.total_spent || 0).toLocaleString()}
      </div>
    </div>
  );
}

function Empty({ text }) {
  return (
    <div style={{ padding: 20 }}>
      {text}
    </div>
  );
}

const S = {
  wrap: { height: "100%", display: "flex", flexDirection: "column", backgroundColor: "#0a0a0a", color: "#fff" },
  tabs: { display: "flex", gap: 6, padding: "12px 16px", borderBottom: "1px solid #222", backgroundColor: "#111" },
  tab: { padding: "8px 16px", borderRadius: 20, border: "none", background: "#222", color: "#888", fontSize: 13, cursor: "pointer", position: "relative" },
  tabActive: { background: "#4D96FF", color: "#000", fontWeight: "bold" },
  badge: { position: "absolute", top: -4, right: -4, background: "#ff5252", color: "#fff", borderRadius: "50%", width: 16, height: 16, fontSize: 10, display: "flex", alignItems: "center", justifyContent: "center" },
  content: { flex: 1, overflowY: "auto", padding: "16px" },
  grid4: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 16 },
  statCard: { background: "#1a1a1a", borderRadius: 14, padding: 16 },
  section: { background: "#111", borderRadius: 14, padding: 16, marginBottom: 14 },
  sectionTitle: { fontSize: 12, color: "#888", fontWeight: "bold", marginBottom: 12 },
  memberRow: { display: "flex", justifyContent: "space-between", padding: "10px 0", borderBottom: "1px solid #1e1e1e" },
  menuRow: { padding: "10px 0", borderBottom: "1px solid #1e1e1e" },
  menuTag: { background: "#1e1e1e", borderRadius: 8, padding: "3px 10px", marginRight: 6 }
};