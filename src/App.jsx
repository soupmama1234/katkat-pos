import React, { useState, useEffect, useMemo, useCallback } from "react";

import Products from "./components/Products";
import Cart from "./components/Cart";
import MenuManager from "./components/MenuManager";
import Dashboard from "./components/Dashboard";
import Orders from "./components/Orders";
import ModifierManager from "./components/ModifierManager";
import MobilePOS from "./components/MobilePOS";

// storage.js จะ auto-switch ระหว่าง Supabase และ localStorage
import db, { isUsingSupabase } from "./storage";

function App() {
  const [view, setView] = useState("pos");
  const [priceChannel, setPriceChannel] = useState("pos");
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  const [loading, setLoading] = useState(true);

  const [cart, setCart] = useState([]);
  const [orders, setOrders] = useState([]);
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState(["All"]);
  const [modifierGroups, setModifierGroups] = useState([]);

  // เรียงเมนูตามตัวอักษร (ใช้แทน products ทุกที่ที่แสดงผล)
  const sortedProducts = useMemo(() =>
    [...products].sort((a, b) => a.name.localeCompare(b.name, 'th')),
    [products]
  );

  // โหลดข้อมูลทั้งหมดตอนเปิดแอป (ทำงานได้ทั้ง localStorage และ Supabase)
  useEffect(() => {
    async function loadAll() {
      try {
        const [cats, prods, mods, ords] = await Promise.all([
          db.fetchCategories(),
          db.fetchProducts(),
          db.fetchModifierGroups(),
          db.fetchOrders(),
        ]);

        // FIX: รวม categories จาก DB + categories ที่มีใน products จริงๆ
        // ป้องกันกรณี categories table ไม่ครบแต่ products มีอยู่แล้ว
        const dbCats = new Set(cats.filter(c => c !== "All"));
        const prodCats = new Set(prods.map(p => p.category).filter(Boolean));
        const merged = ["All", ...new Set([...dbCats, ...prodCats])];

        // save categories ที่หายไปกลับเข้า DB ด้วย (auto-repair)
        for (const cat of prodCats) {
          if (!dbCats.has(cat)) {
            try { await db.addCategory(cat); } catch {}
          }
        }

        setCategories(merged);
        setProducts(prods);
        setModifierGroups(mods);
        setOrders(ords);
      } catch (err) {
        console.error("โหลดข้อมูลไม่ได้:", err);
        alert("❌ โหลดข้อมูลไม่ได้ กรุณา refresh");
      } finally {
        setLoading(false);
      }
    }
    loadAll();
  }, []);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // CATEGORIES
  const addCategory = useCallback(async (name) => {
    if (!name || categories.includes(name)) return;
    await db.addCategory(name);
    setCategories(prev => [...prev, name]);
  }, [categories]);

  const deleteCategory = useCallback(async (catName) => {
    if (!window.confirm(`ลบหมวดหมู่ "${catName}"?`)) return;
    await db.deleteCategory(catName);
    setCategories(prev => prev.filter(c => c !== catName));
  }, []);

  // PRODUCTS
  const addProduct = useCallback(async (newProductData) => {
    const cat = newProductData.category || "ทั่วไป";
    const saved = await db.addProduct({ ...newProductData, category: cat });
    setProducts(prev => [...prev, saved]);
    await addCategory(cat);
  }, [addCategory]);

  const updateProduct = useCallback(async (id, fields) => {
    await db.updateProduct(id, fields);
    setProducts(prev => prev.map(p => p.id === id ? { ...p, ...fields } : p));
  }, []);

  const deleteProduct = useCallback(async (id) => {
    if (!window.confirm("ยืนยันการลบสินค้า?")) return;
    await db.deleteProduct(id);
    setProducts(prev => prev.filter(p => p.id !== id));
  }, []);

  // MODIFIERS
  const addModifierGroup = useCallback(async (name) => {
    const newGroup = await db.addModifierGroup(name);
    setModifierGroups(prev => [...prev, newGroup]);
  }, []);

  const deleteModifierGroup = useCallback(async (groupId) => {
    if (!window.confirm("ลบกลุ่มตัวเลือกนี้?")) return;
    await db.deleteModifierGroup(groupId);
    setModifierGroups(prev => prev.filter(g => g.id !== groupId));
    const affected = products.filter(p => p.modifierGroups?.includes(groupId));
    setProducts(prev => prev.map(p => ({
      ...p,
      modifierGroups: p.modifierGroups?.filter(id => id !== groupId) || []
    })));
    affected.forEach(p => db.updateProduct(p.id, {
      modifierGroups: p.modifierGroups.filter(id => id !== groupId)
    }));
  }, [products]);

  const addOptionToGroup = useCallback(async (groupId, optionName, optionPrice) => {
    const newOpt = await db.addOptionToGroup(groupId, optionName, optionPrice);
    setModifierGroups(prev => prev.map(g =>
      g.id === groupId ? { ...g, options: [...(g.options || []), newOpt] } : g
    ));
  }, []);

  const deleteOption = useCallback(async (groupId, optionId) => {
    await db.deleteOption(groupId, optionId);
    setModifierGroups(prev => prev.map(g =>
      g.id === groupId ? { ...g, options: g.options.filter(o => o.id !== optionId) } : g
    ));
  }, []);

  // POS LOGIC
  const visibleProducts = useMemo(() =>
    (!selectedCategory || selectedCategory === "All")
      ? products
      : products.filter(p => p.category === selectedCategory),
    [products, selectedCategory]
  );

  const total = useMemo(() =>
    cart.reduce((sum, item) => sum + (item.price * item.qty), 0),
    [cart]
  );

  const addToCart = useCallback((product, channel = priceChannel) => {
    setCart(prev => {
      const modId = product.selectedModifier?.id || null;
      const idx = prev.findIndex(i =>
        i.id === product.id && i.channel === channel && (i.selectedModifier?.id || null) === modId
      );
      if (idx > -1) {
        const newCart = [...prev];
        newCart[idx].qty += 1;
        return newCart;
      }
      const base = Number(product[`${channel}Price`] ?? product.price) || 0;
      const modPrice = Number(product.selectedModifier?.price) || 0;
      return [...prev, {
        ...product, price: base + modPrice, qty: 1, channel,
        selectedModifier: product.selectedModifier || null
      }];
    });
  }, [priceChannel]);

  const decreaseQty = useCallback((id, channel, modId = null) => {
    setCart(prev => prev.map(item =>
      (item.id === id && item.channel === channel && (item.selectedModifier?.id || null) === modId)
        ? { ...item, qty: item.qty - 1 } : item
    ).filter(i => i.qty > 0));
  }, []);

  const increaseQty = useCallback((id, channel, modId = null) => {
    setCart(prev => prev.map(item =>
      (item.id === id && item.channel === channel && (item.selectedModifier?.id || null) === modId)
        ? { ...item, qty: item.qty + 1 } : item
    ));
  }, []);

  const handleCheckout = async (paymentMethod, refId = "") => {
    if (cart.length === 0) return;
    const isDelivery = ["grab", "lineman", "shopee"].includes(priceChannel);
    try {
      const saved = await db.addOrder({
        time: new Date().toISOString(),
        items: [...cart],
        total,
        payment: isDelivery ? "transfer" : paymentMethod,
        channel: priceChannel,
        refId,
        isSettled: !isDelivery,
        actualAmount: isDelivery ? 0 : total,
      });
      setOrders(prev => [saved, ...prev]);
      setCart([]);
      alert(isDelivery ? `บันทึกออเดอร์ ${priceChannel.toUpperCase()} เรียบร้อย` : "ชำระเงินเรียบร้อย");
    } catch (err) {
      console.error(err);
      alert("❌ บันทึกออเดอร์ไม่ได้ กรุณาลองใหม่");
    }
  };

  const handleUpdateActual = async (orderId, value) => {
    const amount = parseFloat(value) || 0;
    await db.updateOrder(orderId, { actualAmount: amount, isSettled: true });
    setOrders(prev => prev.map(o =>
      o.id === orderId ? { ...o, actualAmount: amount, isSettled: true } : o
    ));
  };

  const handleCloseDay = async () => {
    if (orders.length === 0) return alert("ไม่มีข้อมูลการขายสำหรับวันนี้");
    const totalSales = orders.reduce((sum, o) => sum + (o.actualAmount || 0), 0);
    if (window.confirm(`สรุปยอดขายวันนี้: ฿${totalSales.toLocaleString()}\nยืนยันการปิดยอดวัน?`)) {
      try {
        await db.closeDayOrders();
        setOrders([]);
        alert("✅ ปิดยอดวันเรียบร้อย");
      } catch {
        alert("❌ ปิดยอดไม่ได้ กรุณาลองใหม่");
      }
    }
  };

  const menuManagerProps = {
    products: sortedProducts, setProducts, updateProduct, deleteProduct, addProduct,
    categories, setCategories, addCategory, deleteCategory, modifierGroups,
    // สำหรับปุ่ม "ล้างทั้งหมด" — มี confirm 2 ชั้น
    clearAllProducts: async () => {
      if (!window.confirm("ลบเมนูทั้งหมด?")) return;
      if (!window.confirm("ยืนยันครั้งสุดท้าย?")) return;
      await db.clearAllProducts();
      setProducts([]);
    },
    // สำหรับ Load Menu — ไม่มี confirm (user confirm ตอน import แล้ว)
    clearAllProductsSilent: async () => {
      await db.clearAllProducts();
      setProducts([]);
    },
  };

  const modifierManagerProps = {
    modifierGroups, addModifierGroup, deleteModifierGroup, addOptionToGroup, deleteOption,
  };

  const CHANNELS = [
    { key: "pos", label: "POS", color: "#4a4a4a" },
    { key: "grab", label: "Grab", color: "#00B14F" },
    { key: "lineman", label: "Lineman", color: "#00A84F" },
    { key: "shopee", label: "Shopee", color: "#EE4D2D" },
  ];

  if (loading) {
    return (
      <div style={{ height: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", backgroundColor: "#1a1a1a", color: "#fff", gap: 16 }}>
        <div style={{ fontSize: 40 }}>🍖</div>
        <div style={{ fontSize: 20, fontWeight: "bold" }}>KATKAT POS</div>
        <div style={{ color: "#666", fontSize: 14 }}>กำลังโหลดข้อมูล...</div>
        {!isUsingSupabase && (
          <div style={{ color: "#444", fontSize: 12, marginTop: 8 }}>[ Local Mode ]</div>
        )}
      </div>
    );
  }

  return (
    <div style={{ height: "100vh", width: "100vw", backgroundColor: "#1a1a1a", color: "#fff", overflow: "hidden" }}>
      {isMobile ? (
        <div style={{ height: "100vh", display: "flex", flexDirection: "column" }}>
          <main style={{ flex: 1, overflowY: "auto", paddingBottom: "80px" }}>
            {view === "pos" && (
              <MobilePOS
                products={sortedProducts} addToCart={addToCart}
                increaseQty={increaseQty} decreaseQty={decreaseQty}
                categories={categories} selectedCategory={selectedCategory}
                setSelectedCategory={setSelectedCategory} cart={cart} total={total}
                onCheckout={handleCheckout} priceChannel={priceChannel}
                setPriceChannel={setPriceChannel} onClearCart={() => setCart([])}
                modifierGroups={modifierGroups}
              />
            )}
            {view === "dashboard" && (
              <Dashboard orders={orders} setOrders={setOrders}
                onCloseDay={handleCloseDay} onUpdateActual={handleUpdateActual} />
            )}
            {view === "orders" && (
              <Orders orders={orders}
                onDeleteOrder={async (id) => { await db.deleteOrder(id); setOrders(prev => prev.filter(o => o.id !== id)); }}
                onClearAll={async () => { await db.clearOrders(); setOrders([]); }} />
            )}
            {view === "menu" && (
              <div style={{ padding: "10px" }}>
                <MenuManager {...menuManagerProps} />
                <hr style={{ margin: "30px 0", borderColor: "#333" }} />
                <ModifierManager {...modifierManagerProps} />
              </div>
            )}
          </main>
          <nav style={styles.bottomNav}>
            <button onClick={() => setView("pos")} style={styles.navBtn(view === "pos")}><span>🛍️</span> ขาย</button>
            <button onClick={() => setView("dashboard")} style={styles.navBtn(view === "dashboard")}><span>📊</span> สรุป</button>
            <button onClick={() => setView("orders")} style={styles.navBtn(view === "orders")}><span>📜</span> บิล</button>
            <button onClick={() => setView("menu")} style={styles.navBtn(view === "menu")}><span>🍴</span> เมนู</button>
          </nav>
        </div>
      ) : (
        <div style={{ height: "100%", display: "flex", flexDirection: "column" }}>
          <header style={styles.desktopHeader}>
            <h2 style={{ margin: 0 }}>KATKAT POS</h2>
            <nav style={{ display: "flex", gap: 10 }}>
              {["pos", "menu", "dashboard", "orders"].map((v) => (
                <button key={v} onClick={() => setView(v)} style={styles.desktopNavBtn(view === v)}>
                  {v === "pos" ? "ขายหน้าร้าน" : v === "menu" ? "จัดการเมนู" : v.toUpperCase()}
                </button>
              ))}
            </nav>
          </header>
          <div style={styles.desktopChannelBar}>
            <span style={{ fontSize: "12px", color: "#888" }}>ช่องทางราคา:</span>
            {CHANNELS.map((ch) => (
              <button key={ch.key} onClick={() => setPriceChannel(ch.key)} style={styles.channelBtn(priceChannel === ch.key, ch.color)}>
                {ch.label}
              </button>
            ))}
          </div>
          <main style={{ flex: 1, display: "flex", overflow: "hidden" }}>
            {view === "pos" && (
              <>
                <section style={{ flex: 1, overflowY: "auto", padding: "15px", borderRight: "1px solid #333" }}>
                  <Products products={sortedProducts} addToCart={addToCart} categories={categories}
                    selectedCategory={selectedCategory} setSelectedCategory={setSelectedCategory}
                    priceChannel={priceChannel} modifierGroups={modifierGroups} />
                </section>
                <aside style={{ width: "400px" }}>
                  <Cart cart={cart} addToCart={addToCart} increaseQty={increaseQty}
                    decreaseQty={decreaseQty} total={total} onCheckout={handleCheckout}
                    onClearCart={() => setCart([])} priceChannel={priceChannel} />
                </aside>
              </>
            )}
            {view === "menu" && (
              <div style={{ flex: 1, overflowY: "auto", padding: "30px" }}>
                <MenuManager {...menuManagerProps} />
                <hr style={{ margin: "40px 0", borderColor: "#333" }} />
                <ModifierManager {...modifierManagerProps} />
              </div>
            )}
            {view === "dashboard" && (
              <div style={{ flex: 1, overflowY: "auto" }}>
                <Dashboard orders={orders} setOrders={setOrders}
                  onCloseDay={handleCloseDay} onUpdateActual={handleUpdateActual} />
              </div>
            )}
            {view === "orders" && (
              <div style={{ flex: 1, overflowY: "auto" }}>
                <Orders orders={orders}
                  onDeleteOrder={async (id) => { await db.deleteOrder(id); setOrders(prev => prev.filter(o => o.id !== id)); }}
                  onClearAll={async () => { await db.clearOrders(); setOrders([]); }} />
              </div>
            )}
          </main>
        </div>
      )}
    </div>
  );
}

const styles = {
  bottomNav: { position: "fixed", bottom: 0, left: 0, right: 0, height: "70px", backgroundColor: "#1a1a1a", display: "flex", justifyContent: "space-around", alignItems: "center", borderTop: "1px solid #333", zIndex: 1000 },
  navBtn: (isActive) => ({ background: "none", border: "none", color: isActive ? "#fff" : "#666", fontSize: "12px", display: "flex", flexDirection: "column", alignItems: "center", gap: "5px", fontWeight: isActive ? "bold" : "normal", cursor: "pointer" }),
  desktopHeader: { padding: "15px 25px", backgroundColor: "#222", borderBottom: "1px solid #333", display: "flex", alignItems: "center", justifyContent: "space-between" },
  desktopNavBtn: (isActive) => ({ padding: "8px 16px", borderRadius: "8px", background: isActive ? "#fff" : "transparent", color: isActive ? "#000" : "#fff", border: "1px solid #444", fontWeight: "bold", cursor: "pointer" }),
  desktopChannelBar: { padding: "10px 25px", backgroundColor: "#111", borderBottom: "1px solid #333", display: "flex", gap: 10, alignItems: "center" },
  channelBtn: (isActive, color) => ({ padding: "6px 18px", borderRadius: "20px", border: "none", background: isActive ? color : "#262626", color: "#fff", cursor: "pointer", transition: "0.2s", fontSize: "12px" }),
};

export default App;
