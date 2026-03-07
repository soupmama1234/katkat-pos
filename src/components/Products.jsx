import React, { useState } from "react";
import ModifierPopup from "./pos/ModifierPopup";

export default function Products({ 
  products = [], 
  addToCart, 
  categories = [], 
  selectedCategory, 
  setSelectedCategory, 
  priceChannel,
  modifierGroups = []
}) {
  const [modProduct, setModProduct] = useState(null);

  const getDisplayPrice = (product) => {
    const channelPrices = {
      pos: product.price,
      grab: product.grabPrice,
      lineman: product.linemanPrice,
      shopee: product.shopeePrice
    };
    return channelPrices[priceChannel] ?? product.price;
  };

  const handleProductClick = (product) => {
    const hasMods = modifierGroups.some(g => product.modifierGroups?.includes(g.id));
    if (hasMods) setModProduct(product);
    else addToCart(product);
  };

  const ProductButton = ({ product }) => (
    <button onClick={() => handleProductClick(product)} style={styles.productCard}>
      <div style={styles.productName}>{product.name}</div>
      <div style={styles.productPrice}>฿{getDisplayPrice(product)}</div>
      {modifierGroups.some(g => product.modifierGroups?.includes(g.id)) && (
        <div style={styles.modBadge}>⚙️ มีตัวเลือก</div>
      )}
    </button>
  );

  return (
    <div style={styles.container}>
      <div style={styles.headerRow}>
        <h2 style={{ margin: 0 }}>เมนูสินค้า</h2>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: "14px", color: "#888" }}>หมวดหมู่:</span>
          <select value={selectedCategory} onChange={e => setSelectedCategory(e.target.value)} style={styles.select}>
            <option value="All">ทั้งหมด</option>
            {categories.filter(c => c !== "All").map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
      </div>

      <div style={styles.scrollArea}>
        {selectedCategory !== "All" ? (
          <div style={styles.grid}>
            {products.filter(p => p.category === selectedCategory).map(p => <ProductButton key={p.id} product={p} />)}
          </div>
        ) : (
          categories.filter(c => c !== "All").map(cat => {
            const items = products.filter(p => p.category === cat);
            if (!items.length) return null;
            return (
              <div key={cat} style={{ marginBottom: 24 }}>
                <div style={styles.categoryTitle}>{cat}</div>
                <div style={styles.grid}>
                  {items.map(p => <ProductButton key={p.id} product={p} />)}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* ── shared: Modifier popup ── */}
      {modProduct && (
        <ModifierPopup
          product={modProduct}
          modifierGroups={modifierGroups}
          onConfirm={p => { addToCart(p); setModProduct(null); }}
          onClose={() => setModProduct(null)}
          variant="dark"
        />
      )}
    </div>
  );
}

const styles = {
  container:     { display: "flex", flexDirection: "column", height: "100%", padding: "15px", boxSizing: "border-box" },
  headerRow:     { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px", paddingBottom: "10px", borderBottom: "1px solid #333" },
  select:        { padding: "8px 12px", borderRadius: "8px", backgroundColor: "#262626", color: "#fff", border: "1px solid #444", outline: "none" },
  scrollArea:    { flex: 1, overflowY: "auto", paddingRight: "5px" },
  grid:          { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(100px, 1fr))", gap: "10px" },
  productCard:   { aspectRatio: "1 / 1", padding: "15px", backgroundColor: "#262626", border: "1px solid #333", borderRadius: "12px", cursor: "pointer", display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center", color: "#fff" },
  productName:   { fontWeight: "bold", fontSize: "14px", marginBottom: "8px" },
  productPrice:  { color: "#4caf50", fontWeight: "bold", fontSize: "15px" },
  modBadge:      { marginTop: 6, fontSize: 10, color: "#888", background: "#2a2a2a", padding: "2px 6px", borderRadius: 8 },
  categoryTitle: { fontSize: "18px", fontWeight: "800", color: "#888", marginBottom: "12px", textTransform: "uppercase", letterSpacing: "1px" },
};
