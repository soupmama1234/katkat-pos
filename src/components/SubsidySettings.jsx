import React, { useState } from "react";
import db from "../storage";

const CHANNELS = [
  { key: "pos",     label: "POS (หน้าร้าน)", color: "#fff" },
  { key: "grab",    label: "Grab",            color: "#00B14F" },
  { key: "lineman", label: "Lineman",          color: "#00A84F" },
  { key: "shopee",  label: "Shopee",           color: "#EE4D2D" },
];

export default function SubsidySettings({ subsidyConfig, onSave, showToast }) {
  const [config, setConfig] = useState({
    enabled:  subsidyConfig?.enabled  ?? false,
    label:    subsidyConfig?.label    ?? "ไทยช่วยไทย",
    channels: subsidyConfig?.channels ?? ["pos", "grab", "lineman", "shopee"],
  });
  const [saving, setSaving] = useState(false);

  const toggleChannel = (ch) => {
    setConfig(prev => ({
      ...prev,
      channels: prev.channels.includes(ch)
        ? prev.channels.filter(c => c !== ch)
        : [...prev.channels, ch],
    }));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await db.updateSettings("subsidy", config);
      onSave(config);
      showToast("บันทึกการตั้งค่าเรียบร้อย ✅");
    } catch (e) {
      showToast("บันทึกไม่สำเร็จ: " + e.message, "error");
    }
    setSaving(false);
  };

  return (
    <div style={{ padding: 24, maxWidth: 480, color: "#fff" }}>
      <h2 style={{ fontSize: 18, margin: "0 0 4px 0" }}>⚙️ ตั้งค่าโครงการรัฐ</h2>
      <p style={{ color: "#666", fontSize: 13, margin: "0 0 24px 0" }}>
        เปิด/ปิด และกำหนดช่องทางที่รองรับ
      </p>

      {/* Enable toggle */}
      <div style={S.card}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: 15 }}>เปิดใช้งาน</div>
            <div style={{ color: "#666", fontSize: 12, marginTop: 2 }}>
              แสดงปุ่มเลือกโครงการรัฐตอนชำระเงิน
            </div>
          </div>
          <button
            onClick={() => setConfig(prev => ({ ...prev, enabled: !prev.enabled }))}
            style={{
              width: 52, height: 28, borderRadius: 99, border: "none",
              background: config.enabled ? "#00b14f" : "#333",
              cursor: "pointer", position: "relative", transition: "background 0.2s",
              flexShrink: 0,
            }}
          >
            <div style={{
              position: "absolute", top: 4, borderRadius: "50%",
              width: 20, height: 20, background: "#fff",
              left: config.enabled ? 28 : 4,
              transition: "left 0.2s",
            }} />
          </button>
        </div>
      </div>

      {/* Label */}
      <div style={S.card}>
        <div style={{ fontSize: 12, color: "#888", fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 10 }}>
          ชื่อโครงการ
        </div>
        <input
          value={config.label}
          onChange={e => setConfig(prev => ({ ...prev, label: e.target.value }))}
          placeholder="เช่น ไทยช่วยไทย, คนละครึ่ง"
          style={S.input}
        />
        <div style={{ color: "#555", fontSize: 11, marginTop: 6 }}>
          ชื่อนี้จะแสดงบนปุ่มตอนชำระเงิน
        </div>
      </div>

      {/* Channels */}
      <div style={S.card}>
        <div style={{ fontSize: 12, color: "#888", fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 12 }}>
          ช่องทางที่รองรับ
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {CHANNELS.map(ch => {
            const active = config.channels.includes(ch.key);
            return (
              <button
                key={ch.key}
                onClick={() => toggleChannel(ch.key)}
                style={{
                  display: "flex", alignItems: "center", gap: 12,
                  padding: "12px 14px", borderRadius: 10, cursor: "pointer",
                  border: active ? `1px solid ${ch.color}44` : "1px solid #2a2a2a",
                  background: active ? `${ch.color}11` : "#1a1a1a",
                  color: "#fff", textAlign: "left",
                }}
              >
                <div style={{
                  width: 20, height: 20, borderRadius: 6,
                  border: active ? `2px solid ${ch.color}` : "2px solid #444",
                  background: active ? ch.color : "transparent",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  flexShrink: 0,
                }}>
                  {active && <span style={{ fontSize: 12, color: ch.key === "pos" ? "#000" : "#fff" }}>✓</span>}
                </div>
                <span style={{ fontWeight: active ? 700 : 400, color: active ? ch.color : "#aaa", fontSize: 14 }}>
                  {ch.label}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Preview */}
      <div style={{ ...S.card, background: "#0d1a0d", border: "1px solid #1a3a1a" }}>
        <div style={{ fontSize: 12, color: "#4caf50", fontWeight: 600, marginBottom: 10 }}>
          ตัวอย่างปุ่มที่จะแสดง
        </div>
        <button style={{
          width: "100%", padding: "10px 14px", borderRadius: 10,
          border: "2px solid #00b14f",
          background: "rgba(0,177,79,0.15)",
          color: "#00b14f", fontWeight: 700,
          cursor: "default", fontSize: 13, textAlign: "left",
          display: "flex", alignItems: "center", gap: 8,
          opacity: config.enabled ? 1 : 0.4,
        }}>
          <span style={{ fontSize: 18 }}>✅</span>
          ใช้สิทธิ์{config.label || "โครงการรัฐ"} (60/40)
        </button>
        {!config.enabled && (
          <div style={{ color: "#555", fontSize: 11, marginTop: 6, textAlign: "center" }}>
            ปุ่มจะซ่อนอยู่เพราะปิดใช้งาน
          </div>
        )}
      </div>

      <button
        onClick={handleSave}
        disabled={saving}
        style={{
          width: "100%", padding: 14, borderRadius: 12, border: "none",
          background: saving ? "#333" : "#FF9F0A",
          color: saving ? "#666" : "#000",
          fontWeight: 800, fontSize: 15, cursor: saving ? "not-allowed" : "pointer",
        }}
      >
        {saving ? "⏳ กำลังบันทึก..." : "💾 บันทึกการตั้งค่า"}
      </button>
    </div>
  );
}

const S = {
  card: {
    background: "#1a1a1a", border: "1px solid #2a2a2a",
    borderRadius: 14, padding: 16, marginBottom: 12,
  },
  input: {
    background: "#0a0a0a", border: "1px solid #333",
    color: "#fff", borderRadius: 10, padding: "10px 12px",
    fontSize: 14, outline: "none", width: "100%", boxSizing: "border-box",
    fontFamily: "inherit",
  },
};
