import React, { useState, useMemo } from "react";

export default function Products({ 
  products = [], 
  addToCart, 
  categories = [], 
  selectedCategory, 
  setSelectedCategory, 
  priceChannel,
  modifierGroups = []
}) {
  const [showModifierPopup, setShowModifierPopup] = useState(false);
  const [selectedProductId, setSelectedProductId] = useState(null);
  const [tempSelection, setTempSelection] = useState([]);

  const getDisplayPrice = (product) => {
    const channelPrices = {
      pos: product.price,
      grab: product.grabPrice,
      lineman: product.linemanPrice,
      shopee: product.shopeePrice
    };
    return channelPrices[priceChannel] ?? product.price;
  };

  // BUG#3 FIX: เช็ค product.modifierGroups (array of IDs) แทน product.modifiers
  const handleProductClick = (product) => {
    const productModGroups = modifierGroups.filter(g =>
      product.modifierGroups?.includes(g.id)
    );
    if (productModGroups.length > 0) {
      setSelectedProductId(product.id);
      setShowModifierPopup(true);
    } else {
      addToCart({ ...product, price: getDisplayPrice(product) });
    }
  };

  const selectedProduct = useMemo(() =>
    products.find(p => p.id === selectedProductId),
    [products, selectedProductId]
  );

  // BUG#5 FIX: filter เฉพาะ groups ที่ผูกกับ selectedProduct เท่านั้น
  const activeModifierGroups = useMemo(() =>
    modifierGroups.filter(g =>
      selectedProduct?.modifierGroups?.includes(g.id)
    ),
    [modifierGroups, selectedProduct]
  );

  const toggleModifier = (opt) => {
    setTempSelection(prev => {
      const isExist = prev.find(item => item.id === opt.id);
      if (isExist) return prev.filter(item => item.id !== opt.id);
      return [...prev, opt];
    });
  };

  const ProductButton = ({ product }) => {
    const price = getDisplayPrice(product);
    return (
      <button onClick={() => handleProductClick(product)} style={styles.productCard}>
        <div style={styles.productName}>{product.name}</div>
        <div style={styles.productPrice}>฿{price}</div>
      </button>
    );
  };

  return (
    <div style={styles.container}>
      <div style={styles.headerRow}>
        <h2 style={{ margin: 0 }}>เมนูสินค้า</h2>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: "14px", color: "#888" }}>หมวดหมู่:</span>
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            style={styles.select}
          >
            <option value="All">ทั้งหมด</option>
            {categories.filter(c => c !== "All").map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
      </div>

      <div style={styles.scrollArea}>
        {selectedCategory !== "All" ? (
          <div style={styles.grid}>
            {products
              .filter(p => p.category === selectedCategory)
              .map(p => <ProductButton key={p.id} product={p} />)}
          </div>
        ) : (
          categories.filter(c => c !== "All").map((cat) => {
            const items = products.filter((p) => p.category === cat);
            if (items.length === 0) return null;
            return (
              <div key={cat} style={{ marginBottom: 24 }}>
                <div style={styles.categoryTitle}>{cat}</div>
                <div style={styles.grid}>
                  {items.map((p) => <ProductButton key={p.id} product={p} />)}
                </div>
              </div>
            );
          })
        )}
      </div>

      {showModifierPopup && selectedProduct && (
        <div style={styles.modalOverlay} onClick={() => { setShowModifierPopup(false); setTempSelection([]); }}>
          <div style={styles.modalContent} onClick={e => e.stopPropagation()}>
            <h3 style={{ marginTop: 0, color: "#fff" }}>เลือกตัวเลือก: {selectedProduct.name}</h3>
            <div style={{ maxHeight: "60vh", overflowY: "auto", margin: "20px 0" }}>
              {/* BUG#5 FIX: ใช้ activeModifierGroups แทน modifierGroups ทั้งหมด */}
              {activeModifierGroups.map(group => (
                <div key={group.id} style={{ marginBottom: "15px", textAlign: "left" }}>
                  <div style={{ fontSize: "14px", color: "#888", marginBottom: "8px", fontWeight: "bold" }}>
                    {group.name}
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                    {group.options && group.options.map(opt => {
                      const isSelected = tempSelection.find(s => s.id === opt.id);
                      return (
                        <button
                          key={opt.id}
                          style={{
                            padding: "12px",
                            backgroundColor: isSelected ? "#4caf50" : "#333",
                            border: isSelected ? "1px solid #fff" : "1px solid #444",
                            color: "#fff", borderRadius: "8px", cursor: "pointer", textAlign: "center"
                          }}
                          onClick={() => toggleModifier(opt)}
                        >
                          <div style={{ fontWeight: "bold" }}>{opt.name}</div>
                          <div style={{ color: isSelected ? "#fff" : "#4caf50", fontSize: "13px", marginTop: "4px" }}>
                            +{Number(opt.price).toLocaleString()} ฿
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
            <div style={{ display: "flex", gap: "10px" }}>
              <button
                onClick={() => { setShowModifierPopup(false); setTempSelection([]); }}
                style={{ ...styles.btnCancel, flex: 1 }}
              >
                ยกเลิก
              </button>
              <button
                style={{ flex: 2, padding: "12px", backgroundColor: "#2196f3", color: "#fff", border: "none", borderRadius: "8px", fontWeight: "bold", cursor: "pointer" }}
                onClick={() => {
                  const basePrice = getDisplayPrice(selectedProduct);
                  const totalModPrice = tempSelection.reduce((sum, m) => sum + Number(m.price), 0);
                  addToCart({
                    ...selectedProduct,
                    price: basePrice + totalModPrice,
                    selectedModifier: tempSelection.length > 0 ? {
                      id: tempSelection.map(m => m.id).join("-"),
                      name: tempSelection.map(m => m.name).join(", "),
                      price: totalModPrice
                    } : null
                  });
                  setShowModifierPopup(false);
                  setTempSelection([]);
                }}
              >
                ยืนยัน (+{tempSelection.reduce((sum, m) => sum + Number(m.price), 0)} ฿)
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const styles = {
  container: { display: "flex", flexDirection: "column", height: "100%", padding: "15px", boxSizing: "border-box" },
  headerRow: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px", paddingBottom: "10px", borderBottom: "1px solid #333" },
  select: { padding: "8px 12px", borderRadius: "8px", backgroundColor: "#262626", color: "#fff", border: "1px solid #444", outline: "none" },
  scrollArea: { flex: 1, overflowY: "auto", paddingRight: "5px" },
  grid: { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(100px, 1fr))", gap: "10px" },
  // BUG#7 FIX: "px" → "12px"
  productCard: { aspectRatio: "1 / 1", padding: "15px", backgroundColor: "#262626", border: "1px solid #333", borderRadius: "12px", cursor: "pointer", display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center", color: "#fff" },
  productName: { fontWeight: "bold", fontSize: "14px", marginBottom: "8px" },
  productPrice: { color: "#4caf50", fontWeight: "bold", fontSize: "15px" },
  categoryTitle: { fontSize: "18px", fontWeight: "800", color: "#888", marginBottom: "12px", textTransform: "uppercase", letterSpacing: "1px" },
  modalOverlay: { position: "fixed", inset: 0, background: "rgba(0,0,0,0.8)", display: "flex", justifyContent: "center", alignItems: "center", zIndex: 1000 },
  modalContent: { background: "#262626", padding: "25px", borderRadius: "16px", width: "90%", maxWidth: "450px", border: "1px solid #444" },
  btnCancel: { padding: "12px", background: "none", border: "1px solid #555", color: "#888", borderRadius: "8px", cursor: "pointer" }
};