import React, { useState } from "react";
import { Trash2 } from "lucide-react";

const InputGroup = ({ values, onChange, categories, styles }) => (
  <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
    <input name="name" placeholder="ชื่อเมนู" value={values.name} onChange={onChange} style={styles.input} />
    <input name="price" placeholder="ราคาหน้าร้าน" value={values.price} onChange={onChange} type="number" style={styles.input} />
    <input name="grabPrice" placeholder="ราคา Grab" value={values.grabPrice} onChange={onChange} type="number" style={styles.input} />
    <input name="linemanPrice" placeholder="ราคา LineMan" value={values.linemanPrice} onChange={onChange} type="number" style={styles.input} />
    <input name="shopeePrice" placeholder="ราคา Shopee" value={values.shopeePrice} onChange={onChange} type="number" style={styles.input} />
    <select name="category" value={values.category} onChange={onChange} style={styles.input}>
      <option value="ทั่วไป">ทั่วไป</option>
      {categories.map(c => <option key={c} value={c}>{c}</option>)}
    </select>
  </div>
);

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
  setCategories
}) {
  const initialForm = { name: "", price: "", grabPrice: "", linemanPrice: "", shopeePrice: "", category: "ทั่วไป" };

  const [formData, setFormData] = useState(initialForm);
  const [showCategoryInput, setShowCategoryInput] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [showEditModal, setShowEditModal] = useState(false);
  const [openDropdownId, setOpenDropdownId] = useState(null);
  const [editFields, setEditFields] = useState({ ...initialForm, id: null });

  const handleExport = () => {
    const data = { products, categories, modifierGroups };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `menu_backup_${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImport = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const json = JSON.parse(event.target.result);
        if (window.confirm("การนำเข้าจะทับข้อมูลปัจจุบันทั้งหมด ยืนยันหรือไม่?")) {
          if (json.products) setProducts([...json.products]);
          if (json.categories) setCategories([...json.categories]);
          setFormData(initialForm);
          setOpenDropdownId(null);
          setShowEditModal(false);
          e.target.value = "";
          alert("โหลดข้อมูลสำเร็จ!");
        }
      } catch (err) {
        alert("ไฟล์ไม่ถูกต้อง หรือรูปแบบ JSON เสียหาย");
      }
    };
    reader.readAsText(file);
  };

  const handleClearAll = () => {
    if (window.confirm("!!! ลบเมนูและหมวดหมู่ทั้งหมดหรือไม่?")) {
      if (window.confirm("ยืนยันครั้งสุดท้าย (แนะนำให้ Backup ก่อนล้าง)")) {
        setProducts([]);
        setCategories([]);
        alert("ล้างข้อมูลเรียบร้อย");
      }
    }
  };

  const handleInputChange = (e, isEdit = false) => {
    const { name, value } = e.target;
    if (isEdit) setEditFields(prev => ({ ...prev, [name]: value }));
    else setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = () => {
    if (!formData.name || !formData.price) return;
    addProduct({
      ...formData,
      id: Date.now(),
      price: Number(formData.price),
      grabPrice: formData.grabPrice ? Number(formData.grabPrice) : null,
      linemanPrice: formData.linemanPrice ? Number(formData.linemanPrice) : null,
      shopeePrice: formData.shopeePrice ? Number(formData.shopeePrice) : null,
      modifierGroups: []  // BUG#3 FIX: เป็น array of IDs เสมอ
    });
    setFormData({ ...initialForm, category: formData.category });
  };

  const handleUpdate = () => {
    if (!editFields.name || !editFields.price) return;
    updateProduct(editFields.id, {
      ...editFields,
      price: Number(editFields.price),
      grabPrice: editFields.grabPrice ? Number(editFields.grabPrice) : null,
      linemanPrice: editFields.linemanPrice ? Number(editFields.linemanPrice) : null,
      shopeePrice: editFields.shopeePrice ? Number(editFields.shopeePrice) : null,
    });
    setShowEditModal(false);
  };

  // BUG#2 & BUG#3 FIX: เก็บแค่ group.id (number) ไม่ใช่ object ทั้งก้อน
  const toggleProductModifier = (productId, groupId) => {
    const product = products.find(p => p.id === productId);
    if (!product) return;
    const currentGroups = product.modifierGroups || [];
    const exists = currentGroups.includes(groupId);
    const updatedGroups = exists
      ? currentGroups.filter(id => id !== groupId)
      : [...currentGroups, groupId];
    updateProduct(productId, { modifierGroups: updatedGroups });
  };

  return (
    <div style={{ padding: "20px", maxWidth: "1000px", margin: "0 auto", color: "#fff" }}>
      
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px", backgroundColor: "#333", padding: "15px", borderRadius: "12px" }}>
        <h2 style={{ margin: 0, fontSize: "1.2rem" }}>จัดการเมนู</h2>
        <div style={{ display: "flex", gap: "10px" }}>
          <button onClick={handleExport} style={{ ...styles.btnPrimary, background: "#4caf50", color: "#fff" }}>💾 Backup</button>
          <label style={{ ...styles.btnPrimary, background: "#2196f3", color: "#fff", cursor: "pointer", display: "inline-block" }}>
            📂 Load Menu
            <input type="file" accept=".json" onChange={handleImport} style={{ display: "none" }} />
          </label>
          <button onClick={handleClearAll} style={{ ...styles.btnDel, padding: "10px 20px", display: "flex", alignItems: "center", gap: 6 }}>
            <Trash2 size={16} color="#ff5252" /> ล้างทั้งหมด
          </button>
        </div>
      </div>

      <section style={styles.section}>
        <h3 style={{ marginTop: 0 }}>+ เพิ่มเมนูใหม่</h3>
        <InputGroup values={formData} onChange={(e) => handleInputChange(e, false)} categories={categories} styles={styles} />
        <div style={{ marginTop: 12, display: "flex", gap: 10 }}>
          <button onClick={handleSubmit} style={styles.btnPrimary}>บันทึกสินค้า</button>
          <button onClick={() => setShowCategoryInput(!showCategoryInput)} style={styles.btnSecondary}>
            {showCategoryInput ? "ยกเลิก" : "จัดการหมวดหมู่"}
          </button>
        </div>

        {showCategoryInput && (
          <div style={styles.categoryBox}>
            <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
              <input placeholder="ชื่อหมวดหมู่ใหม่" value={newCategoryName} onChange={(e) => setNewCategoryName(e.target.value)} style={styles.input} />
              <button onClick={() => { if (newCategoryName) { addCategory(newCategoryName); setNewCategoryName(""); } }} style={styles.btnPrimary}>เพิ่ม</button>
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {categories.map(cat => (
                <span key={cat} style={styles.tag}>
                  {cat} <button onClick={() => deleteCategory(cat)} style={styles.tagDel}>×</button>
                </span>
              ))}
            </div>
          </div>
        )}
      </section>

      <section>
        <h3>รายการสินค้าทั้งหมด ({products.length})</h3>
        <div style={{ display: "grid", gap: 10 }}>
          {products.map((p) => (
            <div key={p.id} style={styles.productCard}>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: "bold", fontSize: "15px" }}>{p.name}</div>
                <div style={{ fontSize: "13px", color: "#b3b3b3", marginTop: "4px" }}>
                  {p.category} |
                  <span style={{ color: "#4caf50", fontWeight: "bold" }}> ฿{p.price}</span> |
                  <span style={{ color: "#00B14F" }}> G: ฿{p.grabPrice || "-"}</span> |
                  <span style={{ color: "#00A84F" }}> L: ฿{p.linemanPrice || "-"}</span> |
                  <span style={{ color: "#EE4D2D" }}> S: ฿{p.shopeePrice || "-"}</span>
                </div>
              </div>

              <div style={{ display: "flex", gap: 8 }}>
                <button onClick={() => setOpenDropdownId(openDropdownId === p.id ? null : p.id)} style={styles.btnAction}>⚙️ ตั้งค่าตัวเลือก</button>
                <button onClick={() => { setEditFields(p); setShowEditModal(true); }} style={styles.btnEdit}>แก้ไข</button>
                <button onClick={() => deleteProduct(p.id)} style={styles.btnDel}>ลบ</button>
              </div>

              {openDropdownId === p.id && (
                <div style={styles.dropdown}>
                  <div style={{ fontWeight: "bold", fontSize: "12px", marginBottom: 8, color: "#ccc" }}>เชื่อมกลุ่มตัวเลือก:</div>
                  {modifierGroups.length === 0 ? (
                    <div style={{ fontSize: "12px", color: "#666" }}>ยังไม่มีกลุ่มตัวเลือก<br/>สร้างได้ที่ส่วน Modifiers ด้านล่าง</div>
                  ) : (
                    <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                      {modifierGroups.map(group => (
                        <label key={group.id} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: "13px", cursor: "pointer", color: "#ccc" }}>
                          <input
                            type="checkbox"
                            // BUG#2 FIX: ใช้ p (ตัวแปรใน loop) แทน product, เช็คจาก modifierGroups (IDs)
                            checked={p.modifierGroups?.includes(group.id) || false}
                            // BUG#2 FIX: ส่ง group.id แทน group object, ใช้ชื่อฟังก์ชันที่ถูกต้อง
                            onChange={() => toggleProductModifier(p.id, group.id)}
                          />
                          {group.name}
                        </label>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      </section>

      {showEditModal && (
        <div style={styles.modalOverlay} onClick={() => setShowEditModal(false)}>
          <div style={styles.modalContent} onClick={e => e.stopPropagation()}>
            <h3 style={{ marginTop: 0 }}>แก้ไขข้อมูลสินค้า</h3>
            <InputGroup values={editFields} onChange={(e) => handleInputChange(e, true)} categories={categories} styles={styles} />
            <div style={{ display: "flex", gap: 10, marginTop: 25, justifyContent: "flex-end" }}>
              <button onClick={() => setShowEditModal(false)} style={styles.btnSecondary}>ยกเลิก</button>
              <button onClick={handleUpdate} style={styles.btnPrimary}>บันทึกการแก้ไข</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const styles = {
  section: { marginBottom: "30px", padding: "20px", backgroundColor: "#262626", borderRadius: "12px", border: "1px solid #333" },
  input: { padding: "10px", borderRadius: "6px", border: "1px solid #444", backgroundColor: "#1a1a1a", color: "#fff", outline: "none", minWidth: "140px" },
  btnPrimary: { background: "#fff", color: "#000", border: "none", padding: "10px 20px", borderRadius: "8px", cursor: "pointer", fontWeight: "bold" },
  btnSecondary: { background: "transparent", border: "1px solid #555", color: "#ccc", padding: "10px 20px", borderRadius: "8px", cursor: "pointer" },
  productCard: { position: "relative", display: "flex", justifyContent: "space-between", alignItems: "center", padding: "16px", border: "1px solid #333", borderRadius: "12px", backgroundColor: "#262626" },
  btnAction: { background: "#333", color: "#64b5f6", border: "1px solid #444", padding: "6px 12px", borderRadius: "6px", cursor: "pointer", fontSize: "12px" },
  btnEdit: { background: "transparent", border: "1px solid #4caf50", color: "#4caf50", padding: "6px 12px", borderRadius: "6px", cursor: "pointer", fontSize: "12px" },
  btnDel: { background: "transparent", border: "1px solid #f44336", color: "#f44336", padding: "6px 12px", borderRadius: "6px", cursor: "pointer", fontSize: "12px" },
  dropdown: { position: "absolute", top: "100%", right: 0, zIndex: 10, background: "#1a1a1a", border: "1px solid #444", padding: "15px", borderRadius: "10px", boxShadow: "0 8px 16px rgba(0,0,0,0.4)", minWidth: "200px" },
  tag: { padding: "6px 12px", background: "#333", color: "#eee", borderRadius: "20px", fontSize: "13px", display: "flex", alignItems: "center", gap: "8px", border: "1px solid #444" },
  tagDel: { background: "none", border: "none", color: "#f44336", cursor: "pointer", fontWeight: "bold", fontSize: "16px" },
  modalOverlay: { position: "fixed", inset: 0, background: "rgba(0,0,0,0.8)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100 },
  modalContent: { background: "#262626", padding: "30px", borderRadius: "16px", width: "90%", maxWidth: "600px", border: "1px solid #444" },
  categoryBox: { marginTop: "15px", padding: "15px", border: "1px dashed #444", borderRadius: "10px", backgroundColor: "#1a1a1a" }
};