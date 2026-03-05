import React, { useState, useEffect } from "react";
import { Trash2 } from "lucide-react";

// BUG FIX: ย้าย FormInputs ออกมานอก MenuManager component
// ถ้าอยู่ข้างใน → React สร้าง component ใหม่ทุก render → input เสีย focus ทันที
const FormInputs = ({ values, onChange, categories }) => (
  <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
    <input
      name="name"
      placeholder="ชื่อเมนู *"
      value={values.name}
      onChange={onChange}
      style={s.input}
    />
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
      <input name="price" placeholder="ราคาหน้าร้าน *" value={values.price} onChange={onChange} type="number" inputMode="numeric" style={s.input} />
      <input name="grabPrice" placeholder="ราคา Grab" value={values.grabPrice || ""} onChange={onChange} type="number" inputMode="numeric" style={s.input} />
      <input name="linemanPrice" placeholder="ราคา LineMan" value={values.linemanPrice || ""} onChange={onChange} type="number" inputMode="numeric" style={s.input} />
      <input name="shopeePrice" placeholder="ราคา Shopee" value={values.shopeePrice || ""} onChange={onChange} type="number" inputMode="numeric" style={s.input} />
    </div>
    <select name="category" value={values.category} onChange={onChange} style={s.input}>
      <option value="ทั่วไป">ทั่วไป</option>
      {(categories || []).filter(c => c !== "All").map(c => (
        <option key={c} value={c}>{c}</option>
      ))}
    </select>
  </div>
);

// BUG FIX: แปลง JSON เก่า (camelCase) → format ใหม่ ก่อน import
function normalizeImportedProducts(products = []) {
  return products.map(p => ({
    ...p,
    // รองรับทั้ง grabPrice (เก่า) และ grab_price (ใหม่)
    grabPrice: p.grabPrice ?? p.grab_price ?? null,
    linemanPrice: p.linemanPrice ?? p.lineman_price ?? null,
    shopeePrice: p.shopeePrice ?? p.shopee_price ?? null,
    modifierGroups: p.modifierGroups ?? p.modifier_group_ids ?? [],
  }));
}

export default function MenuManager({ 
  products = [], 
  modifierGroups = [], 
  addProduct, 
  updateProduct, 
  categories = [], 
  addCategory, 
  deleteProduct, 
  deleteCategory,
  setProducts,
  setCategories,
  clearAllProducts,
  clearAllProductsSilent,
  showToast,
  showConfirm,
}) {
  const initialForm = { name: "", price: "", grabPrice: "", linemanPrice: "", shopeePrice: "", category: "ทั่วไป" };

  const [formData, setFormData] = useState(initialForm);
  const [showCategoryInput, setShowCategoryInput] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [showEditModal, setShowEditModal] = useState(false);
  const [openDropdownId, setOpenDropdownId] = useState(null);
  const [editFields, setEditFields] = useState({ ...initialForm, id: null });
  const [keyboardHeight, setKeyboardHeight] = useState(0);

  // ตรวจจับ keyboard ขึ้น/ลง → ดัน modal ขึ้นพอดี
  useEffect(() => {
    const handleResize = () => {
      const visualHeight = window.visualViewport?.height || window.innerHeight;
      const windowHeight = window.innerHeight;
      const kbHeight = Math.max(0, windowHeight - visualHeight);
      setKeyboardHeight(kbHeight);
    };
    window.visualViewport?.addEventListener("resize", handleResize);
    return () => window.visualViewport?.removeEventListener("resize", handleResize);
  }, []);

  const handleExport = () => {
    const data = { products, categories, modifierGroups };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `menu_backup_${new Date().toISOString().split("T")[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showToast?.("✅ ส่งออกข้อมูลเมนูเรียบร้อย");
  };

  const handleImport = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const json = JSON.parse(event.target.result);
        const ok = await showConfirm?.(
          "ยืนยันการนำเข้า?", 
          "การนำเข้าจะทับข้อมูลปัจจุบันทั้งหมด ยืนยันหรือไม่?",
          null,
          "danger"
        );
        if (!ok) return;

        const normalized = normalizeImportedProducts(json.products || []);

        // ลบของเดิมใน Supabase ก่อน แล้วค่อย add ใหม่ทีละตัว
        if (clearAllProductsSilent) await clearAllProductsSilent();
        else if (clearAllProducts) await clearAllProducts();

        // save แต่ละตัวลง Supabase ผ่าน addProduct
        let count = 0;
        for (const p of normalized) {
          try {
            await addProduct({
              name: p.name,
              category: p.category || "ทั่วไป",
              price: p.price,
              grabPrice: p.grabPrice || null,
              linemanPrice: p.linemanPrice || null,
              shopeePrice: p.shopeePrice || null,
              modifierGroups: p.modifierGroups || [],
            });
            count++;
          } catch (err) {
            console.error("save product error:", p.name, err);
          }
        }

        // categories
        if (json.categories) {
          for (const cat of json.categories) {
            if (cat && cat !== "All") {
              try { await addCategory(cat); } catch (err) { console.warn("skip duplicate category", cat, err); }
            }
          }
        }

        setFormData(initialForm);
        setOpenDropdownId(null);
        setShowEditModal(false);
        e.target.value = "";
        showToast?.(`✅ โหลดสำเร็จ ${count}/${normalized.length} รายการ`);
      } catch (err) {
        console.error(err);
        showToast?.("❌ ไฟล์ไม่ถูกต้อง หรือ save ไม่สำเร็จ", "error");
      }
    };
    reader.readAsText(file);
  };

  const handleClearAll = async () => {
    const ok = await showConfirm?.(
      "!!! ลบทั้งหมด !!!", 
      "ยืนยันการลบเมนูและหมวดหมู่ทั้งหมดหรือไม่?",
      null,
      "danger"
    );
    if (!ok) return;

    if (clearAllProducts) {
      await clearAllProducts();
    } else {
      setProducts([]);
      setCategories([]);
    }
    showToast?.("🗑️ ล้างข้อมูลเมนูทั้งหมดเรียบร้อย");
  };

  const handleInputChange = (e, isEdit = false) => {
    const { name, value } = e.target;
    if (isEdit) setEditFields(prev => ({ ...prev, [name]: value }));
    else setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = () => {
    if (!formData.name || !formData.price) return showToast?.("กรุณาใส่ชื่อและราคา", "warning");
    addProduct({
      ...formData,
      id: Date.now(),
      price: Number(formData.price),
      grabPrice: formData.grabPrice ? Number(formData.grabPrice) : null,
      linemanPrice: formData.linemanPrice ? Number(formData.linemanPrice) : null,
      shopeePrice: formData.shopeePrice ? Number(formData.shopeePrice) : null,
      modifierGroups: [],
    });
    setFormData({ ...initialForm, category: formData.category });
    showToast?.("✨ เพิ่มเมนูเรียบร้อย");
  };

  const handleUpdate = () => {
    if (!editFields.name || !editFields.price) return showToast?.("กรุณาใส่ชื่อและราคา", "warning");
    updateProduct(editFields.id, {
      name: editFields.name,
      category: editFields.category,
      price: Number(editFields.price),
      grabPrice: editFields.grabPrice ? Number(editFields.grabPrice) : null,
      linemanPrice: editFields.linemanPrice ? Number(editFields.linemanPrice) : null,
      shopeePrice: editFields.shopeePrice ? Number(editFields.shopeePrice) : null,
    });
    setShowEditModal(false);
    showToast?.("✅ อัปเดตเมนูเรียบร้อย");
  };

  const toggleProductModifier = (productId, groupId) => {
    const product = products.find(p => p.id === productId);
    if (!product) return;
    const currentGroups = product.modifierGroups || [];
    const updatedGroups = currentGroups.includes(groupId)
      ? currentGroups.filter(id => id !== groupId)
      : [...currentGroups, groupId];
    updateProduct(productId, { modifierGroups: updatedGroups });
  };

  const openEdit = (p) => {
    setEditFields({
      id: p.id,
      name: p.name || "",
      price: p.price || "",
      grabPrice: p.grabPrice || "",
      linemanPrice: p.linemanPrice || "",
      shopeePrice: p.shopeePrice || "",
      category: p.category || "ทั่วไป",
    });
    setShowEditModal(true);
  };

  return (
    <div style={s.page}>
      <div style={s.topGrid}>

      {/* Header */}
      <div style={{ backgroundColor: "#262626", padding: "14px", borderRadius: "12px", marginBottom: "16px", border: "1px solid #333" }}>
        <h2 style={{ margin: "0 0 12px 0", fontSize: "18px" }}>จัดการเมนู</h2>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
          <button onClick={handleExport} style={s.btnGreen}>💾 Backup</button>
          <label style={{ ...s.btnBlue, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
            📂 Load Menu
            <input type="file" accept=".json" onChange={handleImport} style={{ display: "none" }} />
          </label>
          <button onClick={handleClearAll} style={{ ...s.btnRed, gridColumn: "1 / -1" }}>
            <Trash2 size={14} style={{ marginRight: 6 }} /> ล้างทั้งหมด
          </button>
        </div>
      </div>

      {/* Add form */}
      <div style={s.section}>
        <h3 style={{ margin: "0 0 14px 0", fontSize: "16px" }}>+ เพิ่มเมนูใหม่</h3>
        <FormInputs
          values={formData}
          onChange={(e) => handleInputChange(e, false)}
          categories={categories}
        />
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px", marginTop: "12px" }}>
          <button onClick={handleSubmit} style={s.btnWhite}>บันทึกสินค้า</button>
          <button onClick={() => setShowCategoryInput(!showCategoryInput)} style={s.btnOutline}>
            {showCategoryInput ? "ซ่อน" : "จัดการหมวดหมู่"}
          </button>
        </div>

        {showCategoryInput && (
          <div style={{ marginTop: "14px", padding: "14px", border: "1px dashed #444", borderRadius: "10px", backgroundColor: "#1a1a1a" }}>
            <div style={{ display: "flex", gap: "8px", marginBottom: "12px" }}>
              <input
                placeholder="ชื่อหมวดหมู่ใหม่"
                value={newCategoryName}
                onChange={(e) => setNewCategoryName(e.target.value)}
                style={{ ...s.input, flex: 1 }}
              />
              <button
                onClick={() => { if (newCategoryName) { addCategory(newCategoryName); setNewCategoryName(""); } }}
                style={s.btnWhite}
              >
                เพิ่ม
              </button>
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
              {categories.filter(c => c !== "All").map(cat => (
                <span key={cat} style={s.tag}>
                  {cat}
                  <button onClick={() => deleteCategory(cat)} style={{ ...s.tagDel, display: "flex", alignItems: "center" }}>
                    <Trash2 size={12} />
                  </button>
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      </div>

      {/* Product list */}
      <h3 style={{ fontSize: "15px", margin: "0 0 10px 0", color: "#ddd" }}>รายการสินค้าทั้งหมด ({products.length})</h3>
      <div style={s.productGrid}>
        {products.map((p) => (
          <div key={p.id} style={s.productCard}>
            <div style={{ marginBottom: "10px" }}>
              <div style={{ fontWeight: "bold", fontSize: "15px", marginBottom: "4px" }}>{p.name}</div>
              <div style={{ fontSize: "12px", color: "#888", lineHeight: 1.7 }}>
                <span style={{ color: "#4caf50", fontWeight: "bold" }}>฿{p.price}</span>
                {p.grabPrice && <span style={{ color: "#00B14F" }}> · G:฿{p.grabPrice}</span>}
                {p.linemanPrice && <span style={{ color: "#00A84F" }}> · L:฿{p.linemanPrice}</span>}
                {p.shopeePrice && <span style={{ color: "#EE4D2D" }}> · S:฿{p.shopeePrice}</span>}
                <span style={{ color: "#555" }}> · {p.category}</span>
              </div>
              {p.modifierGroups?.length > 0 && (
                <div style={{ fontSize: "11px", color: "#555", marginTop: "2px" }}>
                  ⚙️ {p.modifierGroups.length} กลุ่มตัวเลือก
                </div>
              )}
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "6px" }}>
              <button
                onClick={() => setOpenDropdownId(openDropdownId === p.id ? null : p.id)}
                style={s.btnAction}
              >
                ⚙️ ตัวเลือก
              </button>
              <button onClick={() => openEdit(p)} style={s.btnEdit}>✏️ แก้ไข</button>
              <button onClick={() => deleteProduct(p.id)} style={{ ...s.btnDel, display: "flex", alignItems: "center", justifyContent: "center", gap: 4 }}>
                <Trash2 size={14} /> ลบ
              </button>
            </div>

            {openDropdownId === p.id && (
              <div style={s.dropdown}>
                <div style={{ fontWeight: "bold", fontSize: "12px", marginBottom: "10px", color: "#ccc" }}>
                  เชื่อมกลุ่มตัวเลือก:
                </div>
                {modifierGroups.length === 0 ? (
                  <div style={{ fontSize: "12px", color: "#666" }}>ยังไม่มีกลุ่มตัวเลือก สร้างได้ที่ส่วน Modifiers ด้านล่าง</div>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                    {modifierGroups.map(group => (
                      <label key={group.id} style={{ display: "flex", alignItems: "center", gap: "10px", fontSize: "14px", cursor: "pointer", color: "#ccc", padding: "4px 0" }}>
                        <input
                          type="checkbox"
                          checked={p.modifierGroups?.includes(group.id) || false}
                          onChange={() => toggleProductModifier(p.id, group.id)}
                          style={{ width: "18px", height: "18px", cursor: "pointer" }}
                        />
                        {group.name}
                      </label>
                    ))}
                  </div>
                )}
                <button
                  onClick={() => setOpenDropdownId(null)}
                  style={{ ...s.btnOutline, width: "100%", marginTop: "12px", fontSize: "12px", padding: "8px" }}
                >
                  ปิด
                </button>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Edit modal */}
      {showEditModal && (
        <div style={s.modalOverlay} onClick={() => setShowEditModal(false)}>
          <div style={{ ...s.modalContent, marginBottom: keyboardHeight }} onClick={e => e.stopPropagation()}>
            {/* Handle ลาก */}
            <div style={{ width: "40px", height: "4px", background: "#555", borderRadius: "2px", margin: "0 auto 16px" }} />
            <h3 style={{ marginTop: 0, fontSize: "16px" }}>แก้ไขสินค้า</h3>
            <FormInputs
              values={editFields}
              onChange={(e) => handleInputChange(e, true)}
              categories={categories}
            />
            {/* BUG FIX: ปุ่มอยู่ใน modal content เสมอ ไม่โดน clip */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px", marginTop: "20px", paddingBottom: "8px" }}>
              <button onClick={() => setShowEditModal(false)} style={s.btnOutline}>ยกเลิก</button>
              <button onClick={handleUpdate} style={s.btnWhite}>✅ บันทึก</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const s = {
  page: { padding: "12px", color: "#fff", boxSizing: "border-box", maxWidth: "1100px", margin: "0 auto" },
  topGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: "12px", alignItems: "start" },
  section: { marginBottom: "12px", padding: "16px", backgroundColor: "#262626", borderRadius: "12px", border: "1px solid #333" },
  input: { padding: "12px", borderRadius: "8px", border: "1px solid #444", backgroundColor: "#1a1a1a", color: "#fff", outline: "none", width: "100%", fontSize: "15px", boxSizing: "border-box" },
  btnWhite: { background: "#fff", color: "#000", border: "none", padding: "12px", borderRadius: "8px", cursor: "pointer", fontWeight: "bold", fontSize: "14px" },
  btnOutline: { background: "transparent", border: "1px solid #555", color: "#ccc", padding: "12px", borderRadius: "8px", cursor: "pointer", fontSize: "14px" },
  btnGreen: { background: "#4caf50", color: "#fff", border: "none", padding: "12px", borderRadius: "8px", cursor: "pointer", fontWeight: "bold", fontSize: "14px" },
  btnBlue: { background: "#2196f3", color: "#fff", border: "none", padding: "12px", borderRadius: "8px", fontWeight: "bold", fontSize: "14px" },
  btnRed: { background: "transparent", color: "#ff5252", border: "1px solid #ff5252", padding: "10px", borderRadius: "8px", cursor: "pointer", fontWeight: "bold", fontSize: "13px", display: "flex", alignItems: "center", justifyContent: "center" },
  btnAction: { background: "#2a2a2a", color: "#64b5f6", border: "1px solid #444", padding: "8px 4px", borderRadius: "6px", cursor: "pointer", fontSize: "12px" },
  btnEdit: { background: "transparent", border: "1px solid #4caf50", color: "#4caf50", padding: "8px 4px", borderRadius: "6px", cursor: "pointer", fontSize: "12px" },
  btnDel: { background: "transparent", border: "1px solid #f44336", color: "#f44336", padding: "8px 4px", borderRadius: "6px", cursor: "pointer", fontSize: "12px" },
  productGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: "10px", paddingBottom: "20px" },
  productCard: { position: "relative", padding: "14px", border: "1px solid #333", borderRadius: "12px", backgroundColor: "#262626" },
  dropdown: { marginTop: "12px", background: "#1a1a1a", border: "1px solid #444", padding: "14px", borderRadius: "10px" },
  tag: { padding: "6px 10px", background: "#333", color: "#eee", borderRadius: "20px", fontSize: "13px", display: "flex", alignItems: "center", gap: "6px", border: "1px solid #444" },
  tagDel: { background: "none", border: "none", color: "#f44336", cursor: "pointer", fontWeight: "bold", fontSize: "16px", lineHeight: 1, padding: 0 },
  modalOverlay: { position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)", display: "flex", alignItems: "flex-end", justifyContent: "center", zIndex: 200 },
  // BUG FIX: ไม่ใช้ maxHeight overflow-y แล้ว ใช้ paddingBottom ให้ปุ่มโผล่เสมอ
  modalContent: { background: "#1e1e1e", padding: "20px 20px 32px", borderRadius: "20px 20px 0 0", width: "100%", maxWidth: "600px", border: "1px solid #444", boxSizing: "border-box", marginBottom: "env(keyboard-inset-height, 300px)" },
};
