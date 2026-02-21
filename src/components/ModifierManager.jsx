import React, { useState } from "react";

// BUG#1 FIX: รับ deleteOption เป็น prop จาก App.jsx แทนการเรียก setModifierGroups โดยตรง
const ModifierGroupItem = ({ group, addOptionToGroup, deleteModifierGroup, deleteOption, styles }) => {
  const [optName, setOptName] = useState("");
  const [optPrice, setOptPrice] = useState("");

  const handleAddOption = () => {
    if (!optName) return;
    addOptionToGroup(group.id, optName.trim(), Number(optPrice) || 0);
    setOptName("");
    setOptPrice("");
  };

  return (
    <div style={styles.groupCard}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 15 }}>
        <h3 style={{ margin: 0, color: "#fff", fontSize: "18px" }}>📦 {group.name}</h3>
        <button onClick={() => deleteModifierGroup(group.id)} style={styles.btnDelText}>ลบกลุ่มนี้</button>
      </div>

      <div style={{ display: "flex", gap: 8, marginBottom: 15 }}>
        <input
          placeholder="ชื่อตัวเลือก (เช่น หวานน้อย)"
          value={optName}
          onChange={(e) => setOptName(e.target.value)}
          style={styles.input}
        />
        <input
          placeholder="ราคา +"
          type="number"
          value={optPrice}
          onChange={(e) => setOptPrice(e.target.value)}
          style={{ ...styles.input, width: "100px" }}
        />
        <button onClick={handleAddOption} style={styles.btnAction}>เพิ่มตัวเลือก</button>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {group.options?.map((option) => (
          <div key={option.id} style={{ display: "flex", alignItems: "center", padding: "8px 0" }}>
            <span style={{ color: "#eee" }}>• {option.name}</span>
            <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: "15px" }}>
              <span style={{ color: "#4caf50", fontWeight: "bold" }}>
                +{option.price} ฿
              </span>
              {/* BUG#1 FIX: เรียก deleteOption prop แทน setModifierGroups */}
              <button
                onClick={() => deleteOption(group.id, option.id)}
                style={{ background: "none", border: "none", color: "#ff5252", cursor: "pointer", fontSize: "18px", padding: "0 5px" }}
              >
                ✕
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default function ModifierManager({
  modifierGroups = [],
  addModifierGroup,
  deleteModifierGroup,
  addOptionToGroup,
  deleteOption  // BUG#1 FIX: รับ deleteOption จาก App.jsx
}) {
  const [newGroupName, setNewGroupName] = useState("");

  const handleCreateGroup = () => {
    if (newGroupName.trim() && typeof addModifierGroup === "function") {
      addModifierGroup(newGroupName.trim());
      setNewGroupName("");
    }
  };

  return (
    <div style={{ padding: "20px", maxWidth: "800px", margin: "0 auto", color: "#fff" }}>
      <h2 style={{ borderBottom: "2px solid #333", paddingBottom: "10px" }}>จัดการเมนูย่อย (Modifiers)</h2>

      <section style={styles.addSection}>
        <h4 style={{ marginTop: 0, color: "#b3b3b3" }}>สร้างกลุ่มเมนูย่อยใหม่</h4>
        <div style={{ display: "flex", gap: 10 }}>
          <input
            placeholder="เช่น ระดับความหวาน, ท็อปปิ้ง..."
            value={newGroupName}
            onChange={(e) => setNewGroupName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleCreateGroup()}
            style={{ ...styles.input, flex: 1 }}
          />
          <button onClick={handleCreateGroup} style={styles.btnPrimary}>สร้างกลุ่ม</button>
        </div>
      </section>

      <div style={{ display: "grid", gap: 20 }}>
        {modifierGroups.map((group) => (
          <ModifierGroupItem
            key={group.id}
            group={group}
            addOptionToGroup={addOptionToGroup}
            deleteModifierGroup={deleteModifierGroup}
            deleteOption={deleteOption}  // BUG#1 FIX: ส่ง deleteOption ลงไป
            styles={styles}
          />
        ))}
      </div>
    </div>
  );
}

const styles = {
  addSection: { backgroundColor: "#262626", padding: "20px", borderRadius: "12px", marginBottom: "25px", border: "1px solid #333" },
  groupCard: { backgroundColor: "#262626", padding: "20px", borderRadius: "12px", border: "1px solid #444" },
  input: { backgroundColor: "#1a1a1a", border: "1px solid #444", color: "#fff", padding: "10px 14px", borderRadius: "8px", outline: "none" },
  btnPrimary: { backgroundColor: "#fff", color: "#000", border: "none", padding: "10px 20px", borderRadius: "8px", fontWeight: "bold", cursor: "pointer" },
  btnAction: { backgroundColor: "#333", color: "#fff", border: "1px solid #555", padding: "8px 16px", borderRadius: "8px", cursor: "pointer", fontSize: "14px" },
  btnDelText: { background: "none", border: "none", color: "#ff5252", cursor: "pointer", fontSize: "13px", textDecoration: "underline" }
};