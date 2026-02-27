import React, { useState, useEffect, useMemo, useCallback } from "react";

import Products from "./components/Products";
import Cart from "./components/Cart";
import MenuManager from "./components/MenuManager";
import Dashboard from "./components/Dashboard";
import Orders from "./components/Orders";
import ModifierManager from "./components/ModifierManager";
import MobilePOS from "./components/MobilePOS";
import Members from "./components/Members";
import { supabase as sb } from "./supabaseclient";

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
  const [memberPhone, setMemberPhone] = useState(""); 

  // --- 1. โหลดข้อมูล (เรียกคืนความสมบูรณ์) ---
  useEffect(() => {
    async function loadAll() {
      try {
        const [cats, prods, mods, ords] = await Promise.all([
          db.fetchCategories(),
          db.fetchProducts(),
          db.fetchModifierGroups(),
          db.fetchOrders(),
        ]);

        const dbCats = new Set(cats.filter(c => c !== "All"));
        const prodCats = new Set(prods.map(p => p.category).filter(Boolean));
        const merged = ["All", ...new Set([...dbCats, ...prodCats])];

        setCategories(merged);
        setProducts(prods);
        setModifierGroups(mods);
        setOrders(ords);
      } catch (err) {
        console.error("Load failed:", err);
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

  // --- 2. ฟังก์ชันจัดการเมนู (คืนค่าการลบและแก้ไข) ---
  const addCategory = useCallback(async (name) => {
    if (!name || categories.includes(name)) return;
    await db.addCategory(name);
    setCategories(prev => [...prev, name]);
  }, [categories]);

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
    if (!window.confirm("ยืนยันการลบสินค้า? ข้อมูลจะหายจาก Supabase ถาวร")) return;
    try {
      await db.deleteProduct(id);
      setProducts(prev => prev.filter(p => p.id !== id));
    } catch (err) {
      alert("ลบสินค้าไม่ได้: " + err.message);
    }
  }, []);

  // --- 3. ระบบ Cart & Checkout (คืนค่า Ref และสมาชิก) ---
  const total = useMemo(() => cart.reduce((sum, item) => sum + (item.price * item.qty), 0), [cart]);

  const addToCart = useCallback((product, channel = priceChannel) => {
    setCart(prev => {
      const modId = product.selectedModifier?.id || null;
      const idx = prev.findIndex(i => i.id === product.id && i.channel === channel && (i.selectedModifier?.id || null) === modId);
      if (idx > -1) {
        const newCart = [...prev];
        newCart[idx].qty += 1;
        return newCart;
      }
      const base = Number(product[`${channel}Price`] ?? product.price) || 0;
      const modPrice = Number(product.selectedModifier?.price) || 0;
      return [...prev, { ...product, price: base + modPrice, qty: 1, channel, selectedModifier: product.selectedModifier || null }];
    });
  }, [priceChannel]);

  const increaseQty = (id, ch, mid) => setCart(prev => prev.map(i => (i.id === id && i.channel === ch && (i.selectedModifier?.id || null) === mid) ? { ...i, qty: i.qty + 1 } : i));
  const decreaseQty = (id, ch, mid) => setCart(prev => prev.map(i => (i.id === id && i.channel === ch && (i.selectedModifier?.id || null) === mid) ? { ...i, qty: i.qty - 1 } : i).filter(i => i.qty > 0));

  const handleCheckout = async (paymentMethod, refId = "", phone = memberPhone) => {
    if (cart.length === 0) return;
    const isDelivery = ["grab", "lineman", "shopee"].includes(priceChannel);
    try {
      const orderPayload = {
        time: new Date().toISOString(),
        items: [...cart],
        total_amount: total,
        payment: isDelivery ? "transfer" : paymentMethod,
        channel: priceChannel,
        ref: refId,
        member_phone: phone || null,
        isSettled: !isDelivery,
        actualAmount: isDelivery ? 0 : total,
      };
      const saved = await db.addOrder(orderPayload);
      setOrders(prev => [saved, ...prev]);

      if (phone) {
        try {
          const { data: m } = await sb.from('members').select('points, total_spent').eq('phone', phone).single();
          if (m) {
            await sb.from('members').update({ 
              points: (m.points || 0) + Math.floor(total / 10), 
              total_spent: (m.total_spent || 0) + total 
            }).eq('phone', phone);
          }
        } catch (e) { console.warn(e); }
      }
      setCart([]); setMemberPhone("");
      alert("บันทึกออเดอร์เรียบร้อย");
      return true;
    } catch (err) { console.error(err); return false; }
  };

  const CHANNELS = [
    { key: "pos", label: "POS", color: "#4a4a4a" },
    { key: "grab", label: "Grab", color: "#00B14F" },
    { key: "lineman", label: "Lineman", color: "#00A84F" },
    { key: "shopee", label: "Shopee", color: "#EE4D2D" },
  ];

  if (loading) return <div style={{ height: "100vh", backgroundColor: "#1a1a1a", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff" }}>กำลังโหลด...</div>;

  return (
    <div style={styles.appWrapper}>
      {isMobile ? (
        <div style={styles.mobileContainer}>
          <main style={styles.mobileMain}>
            {view === "pos" && <MobilePOS products={products} addToCart={addToCart} increaseQty={increaseQty} decreaseQty={decreaseQty} categories={categories} selectedCategory={selectedCategory} setSelectedCategory={setSelectedCategory} cart={cart} total={total} onCheckout={handleCheckout} priceChannel={priceChannel} setPriceChannel={setPriceChannel} onClearCart={() => setCart([])} memberPhone={memberPhone} setMemberPhone={setMemberPhone} modifierGroups={modifierGroups} />}
            {view === "dashboard" && <Dashboard orders={orders} onUpdateActual={(id, v) => db.updateOrder(id, { actualAmount: parseFloat(v), isSettled: true }).then(() => setOrders(prev => prev.map(o => o.id === id ? { ...o, actualAmount: parseFloat(v), isSettled: true } : o)))} onCloseDay={() => db.closeDayOrders().then(() => setOrders([]))} />}
            {view === "orders" && <Orders orders={orders} onDeleteOrder={(id) => db.deleteOrder(id)} onClearAll={() => db.clearOrders()} />}
            {view === "members" && <Members orders={orders} />}
            {view === "menu" && (
              <div style={{ padding: "10px" }}>
                <MenuManager products={products} setProducts={setProducts} updateProduct={updateProduct} deleteProduct={deleteProduct} addProduct={addProduct} categories={categories} />
                <ModifierManager modifierGroups={modifierGroups} setModifierGroups={setModifierGroups} />
              </div>
            )}
          </main>
          <nav style={styles.bottomNav}>
            {["pos", "dashboard", "orders", "members", "menu"].map(v => (
              <button key={v} onClick={() => setView(v)} style={styles.navBtn(view === v)}>
                {v === "pos" ? "🛍️" : v === "dashboard" ? "📊" : v === "orders" ? "📜" : v === "members" ? "👥" : "🍴"}
                <span style={{ fontSize: "10px" }}>{v.toUpperCase()}</span>
              </button>
            ))}
          </nav>
        </div>
      ) : (
        <div style={styles.desktopContainer}>
          <header style={styles.desktopHeader}>
            <h2 style={{ margin: 0, color: "#00B14F" }}>KATKAT POS</h2>
            <nav style={{ display: "flex", gap: 10 }}>
              {["pos", "menu", "dashboard", "orders", "members"].map((v) => (
                <button key={v} onClick={() => setView(v)} style={styles.desktopNavBtn(view === v)}>
                  {v === "pos" ? "ขายหน้าร้าน" : v === "menu" ? "จัดการเมนู" : v === "members" ? "👥 สมาชิก" : v.toUpperCase()}
                </button>
              ))}
            </nav>
          </header>
          <div style={styles.desktopChannelBar}>
            {CHANNELS.map((ch) => (
              <button key={ch.key} onClick={() => setPriceChannel(ch.key)} style={styles.channelBtn(priceChannel === ch.key, ch.color)}>{ch.label}</button>
            ))}
          </div>
          <main style={styles.desktopMain}>
            {view === "pos" && (
              <>
                <section style={styles.desktopProducts}><Products products={products} addToCart={addToCart} categories={categories} selectedCategory={selectedCategory} setSelectedCategory={setSelectedCategory} priceChannel={priceChannel} /></section>
                <aside style={styles.desktopCart}><Cart cart={cart} increaseQty={increaseQty} decreaseQty={decreaseQty} total={total} onCheckout={handleCheckout} onClearCart={() => setCart([])} priceChannel={priceChannel} memberPhone={memberPhone} setMemberPhone={setMemberPhone} /></aside>
              </>
            )}
            {view === "dashboard" && <div style={{ flex: 1, overflowY: "auto" }}><Dashboard orders={orders} onUpdateActual={(id, v) => db.updateOrder(id, { actualAmount: parseFloat(v), isSettled: true }).then(() => setOrders(prev => prev.map(o => o.id === id ? { ...o, actualAmount: parseFloat(v), isSettled: true } : o)))} onCloseDay={() => db.closeDayOrders().then(() => setOrders([]))} /></div>}
            {view === "menu" && (
              <div style={{ flex: 1, overflowY: "auto", padding: "30px" }}>
                <MenuManager products={products} setProducts={setProducts} updateProduct={updateProduct} deleteProduct={deleteProduct} addProduct={addProduct} categories={categories} />
                <ModifierManager modifierGroups={modifierGroups} setModifierGroups={setModifierGroups} />
              </div>
            )}
            {view === "orders" && <div style={{ flex: 1, overflowY: "auto" }}><Orders orders={orders} onDeleteOrder={(id) => db.deleteOrder(id)} onClearAll={() => db.clearOrders()} /></div>}
            {view === "members" && <div style={{ flex: 1, overflow: "hidden" }}><Members orders={orders} /></div>}
          </main>
        </div>
      )}
    </div>
  );
}

const styles = {
  appWrapper: { height: "100vh", width: "100vw", backgroundColor: "#1a1a1a", color: "#fff", overflow: "hidden" },
  mobileContainer: { height: "100vh", display: "flex", flexDirection: "column" },
  mobileMain: { flex: 1, overflowY: "auto", paddingBottom: "80px" },
  desktopContainer: { height: "100vh", display: "flex", flexDirection: "column" },
  desktopHeader: { padding: "15px 25px", backgroundColor: "#222", borderBottom: "1px solid #333", display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0 },
  desktopNavBtn: (isActive) => ({ padding: "8px 16px", borderRadius: "8px", background: isActive ? "#fff" : "transparent", color: isActive ? "#000" : "#fff", border: "1px solid #444", fontWeight: "bold", cursor: "pointer" }),
  desktopChannelBar: { padding: "10px 25px", backgroundColor: "#111", borderBottom: "1px solid #333", display: "flex", gap: 10, alignItems: "center", flexShrink: 0 },
  channelBtn: (isActive, color) => ({ padding: "6px 18px", borderRadius: "20px", border: "none", background: isActive ? color : "#262626", color: "#fff", cursor: "pointer", fontSize: "12px" }),
  desktopMain: { flex: 1, display: "flex", overflow: "hidden" },
  desktopProducts: { flex: 1, overflowY: "auto", padding: "15px", borderRight: "1px solid #333" },
  desktopCart: { width: "400px", display: "flex", flexDirection: "column", height: "100%", flexShrink: 0 },
  bottomNav: { position: "fixed", bottom: 0, left: 0, right: 0, height: "70px", backgroundColor: "#1a1a1a", display: "flex", justifyContent: "space-around", alignItems: "center", borderTop: "1px solid #333", zIndex: 1000 },
  navBtn: (isActive) => ({ background: "none", border: "none", color: isActive ? "#00B14F" : "#666", display: "flex", flexDirection: "column", alignItems: "center", gap: "4px", cursor: "pointer" }),
};

export default App;