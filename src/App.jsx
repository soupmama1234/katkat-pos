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
  const [memberPhone, setMemberPhone] = useState(""); // เก็บเบอร์สมาชิกที่เลือกในปัจจุบัน

  // --- 1. โหลดข้อมูลตอนเริ่มต้น ---
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
        console.error("โหลดข้อมูลไม่ได้:", err);
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

  // --- 2. ฟังก์ชันจัดการสินค้าและหมวดหมู่ ---
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
    if (!window.confirm("ยืนยันการลบสินค้า?")) return;
    await db.deleteProduct(id);
    setProducts(prev => prev.filter(p => p.id !== id));
  }, []);

  // --- 3. ระบบตะกร้าสินค้า (Cart) ---
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

  // --- 4. หัวใจสำคัญ: ระบบชำระเงินและสมาชิก (Checkout & Loyalty) ---
  const handleCheckout = async (paymentMethod, refId = "", phone = memberPhone) => {
    if (cart.length === 0) return;
    const isDelivery = ["grab", "lineman", "shopee"].includes(priceChannel);
    
    try {
      // (A) บันทึกออเดอร์ลงตาราง orders พร้อม member_phone
      const orderPayload = {
        time: new Date().toISOString(),
        items: [...cart],
        total_amount: total,
        payment: isDelivery ? "transfer" : paymentMethod,
        channel: priceChannel,
        ref: refId,
        member_phone: phone || null, // ผูกข้อมูลสมาชิกกับออเดอร์
        isSettled: !isDelivery,
        actualAmount: isDelivery ? 0 : total,
      };

      const savedOrder = await db.addOrder(orderPayload);
      setOrders(prev => [savedOrder, ...prev]);

      // (B) อัปเดตแต้มสมาชิกในตาราง members (ถ้ามีเบอร์โทร)
      if (phone) {
        try {
          // ดึงแต้มปัจจุบันมาคำนวณใหม่หน้าบ้าน (เลี่ยง RPC Error)
          const { data: member } = await sb.from('members').select('points, total_spent').eq('phone', phone).single();
          
          if (member) {
            const pointsEarned = Math.floor(total / 10); // ทุก 10 บาทได้ 1 แต้ม
            await sb.from('members').update({
              points: (member.points || 0) + pointsEarned,
              total_spent: (member.total_spent || 0) + total
            }).eq('phone', phone);
            console.log(`✅ สมาชิก ${phone} ได้รับ +${pointsEarned} แต้ม`);
          }
        } catch (e) {
          console.warn("⚠️ อัปเดตสมาชิกไม่สำเร็จ:", e.message);
        }
      }

      // (C) ล้างค่าหลังจบการขาย
      setCart([]);
      setMemberPhone(""); 
      alert("✅ บันทึกออเดอร์เรียบร้อย");
      return true;
    } catch (err) {
      console.error("❌ Checkout Error:", err);
      alert("เกิดข้อผิดพลาดในการบันทึก: " + err.message);
      return false;
    }
  };

  // --- 5. จัดการประวัติการขาย ---
  const handleUpdateActual = async (orderId, value) => {
    const amount = parseFloat(value) || 0;
    await db.updateOrder(orderId, { actualAmount: amount, isSettled: true });
    setOrders(prev => prev.map(o => o.id === orderId ? { ...o, actualAmount: amount, isSettled: true } : o));
  };

  const handleCloseDay = async () => {
    const totalSales = orders.reduce((sum, o) => sum + (o.actualAmount || 0), 0);
    if (window.confirm(`ยอดขายรวมวันนี้: ฿${totalSales.toLocaleString()}\nต้องการปิดยอดวันและล้างหน้าจอใช่หรือไม่?`)) {
      await db.closeDayOrders();
      setOrders([]);
      alert("✅ ปิดยอดวันเรียบร้อย");
    }
  };

  // --- UI Components Props ---
  const CHANNELS = [
    { key: "pos", label: "POS", color: "#4a4a4a" },
    { key: "grab", label: "Grab", color: "#00B14F" },
    { key: "lineman", label: "Lineman", color: "#00A84F" },
    { key: "shopee", label: "Shopee", color: "#EE4D2D" },
  ];

  if (loading) return <div style={{ background: "#1a1a1a", height: "100vh", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center" }}>กำลังโหลด KATKAT POS...</div>;

  return (
    <div style={{ height: "100vh", width: "100vw", backgroundColor: "#1a1a1a", color: "#fff", overflow: "hidden", fontFamily: "sans-serif" }}>
      {isMobile ? (
        <div style={{ height: "100vh", display: "flex", flexDirection: "column" }}>
          <main style={{ flex: 1, overflowY: "auto", paddingBottom: "80px" }}>
            {view === "pos" && (
              <MobilePOS
                products={products} addToCart={addToCart}
                increaseQty={increaseQty} decreaseQty={decreaseQty}
                categories={categories} selectedCategory={selectedCategory}
                setSelectedCategory={setSelectedCategory} cart={cart} total={total}
                onCheckout={handleCheckout} priceChannel={priceChannel}
                setPriceChannel={setPriceChannel} onClearCart={() => setCart([])}
                memberPhone={memberPhone} setMemberPhone={setMemberPhone}
              />
            )}
            {view === "dashboard" && <Dashboard orders={orders} onCloseDay={handleCloseDay} onUpdateActual={handleUpdateActual} />}
            {view === "orders" && <Orders orders={orders} onDeleteOrder={(id) => db.deleteOrder(id)} onClearAll={() => db.clearOrders()} />}
            {view === "members" && <Members orders={orders} />}
            {view === "menu" && (
              <div style={{ padding: 10 }}>
                <MenuManager products={products} setProducts={setProducts} updateProduct={updateProduct} deleteProduct={deleteProduct} addProduct={addProduct} categories={categories} />
                <ModifierManager modifierGroups={modifierGroups} setModifierGroups={setModifierGroups} />
              </div>
            )}
          </main>
          <nav style={styles.bottomNav}>
            <button onClick={() => setView("pos")} style={styles.navBtn(view === "pos")}>🛍️ <span>ขาย</span></button>
            <button onClick={() => setView("dashboard")} style={styles.navBtn(view === "dashboard")}>📊 <span>สรุป</span></button>
            <button onClick={() => setView("orders")} style={styles.navBtn(view === "orders")}>📜 <span>บิล</span></button>
            <button onClick={() => setView("members")} style={styles.navBtn(view === "members")}>👥 <span>สมาชิก</span></button>
            <button onClick={() => setView("menu")} style={styles.navBtn(view === "menu")}>🍴 <span>เมนู</span></button>
          </nav>
        </div>
      ) : (
        <div style={{ height: "100%", display: "flex", flexDirection: "column" }}>
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
              <button key={ch.key} onClick={() => setPriceChannel(ch.key)} style={styles.channelBtn(priceChannel === ch.key, ch.color)}>
                {ch.label}
              </button>
            ))}
          </div>
          <main style={{ flex: 1, display: "flex", overflow: "hidden" }}>
            {view === "pos" && (
              <>
                <section style={{ flex: 1, overflowY: "auto", padding: "15px", borderRight: "1px solid #333" }}>
                  <Products products={products} addToCart={addToCart} categories={categories} selectedCategory={selectedCategory} setSelectedCategory={setSelectedCategory} priceChannel={priceChannel} />
                </section>
                <aside style={{ width: "400px" }}>
                  <Cart cart={cart} increaseQty={increaseQty} decreaseQty={decreaseQty} total={total} onCheckout={handleCheckout} onClearCart={() => setCart([])} memberPhone={memberPhone} setMemberPhone={setMemberPhone} />
                </aside>
              </>
            )}
            {view === "menu" && <div style={{ flex: 1, overflowY: "auto", padding: 30 }}><MenuManager products={products} setProducts={setProducts} updateProduct={updateProduct} deleteProduct={deleteProduct} addProduct={addProduct} categories={categories} /></div>}
            {view === "dashboard" && <Dashboard orders={orders} onCloseDay={handleCloseDay} onUpdateActual={handleUpdateActual} />}
            {view === "orders" && <Orders orders={orders} onDeleteOrder={(id) => db.deleteOrder(id)} onClearAll={() => db.clearOrders()} />}
            {view === "members" && <Members orders={orders} />}
          </main>
        </div>
      )}
    </div>
  );
}

const styles = {
  bottomNav: { position: "fixed", bottom: 0, left: 0, right: 0, height: "70px", backgroundColor: "#1a1a1a", display: "flex", justifyContent: "space-around", alignItems: "center", borderTop: "1px solid #333", zIndex: 1000 },
  navBtn: (isActive) => ({ background: "none", border: "none", color: isActive ? "#00B14F" : "#666", fontSize: "10px", display: "flex", flexDirection: "column", alignItems: "center", gap: "4px", cursor: "pointer", fontWeight: isActive ? "bold" : "normal" }),
  desktopHeader: { padding: "15px 25px", backgroundColor: "#222", display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: "1px solid #333" },
  desktopNavBtn: (isActive) => ({ padding: "8px 16px", borderRadius: "8px", background: isActive ? "#00B14F" : "transparent", color: "#fff", border: "1px solid #444", cursor: "pointer", fontWeight: "bold" }),
  desktopChannelBar: { padding: "10px 25px", backgroundColor: "#111", display: "flex", gap: 10, borderBottom: "1px solid #333" },
  channelBtn: (isActive, color) => ({ padding: "6px 18px", borderRadius: "20px", border: "none", background: isActive ? color : "#262626", color: "#fff", cursor: "pointer", fontSize: "12px" }),
};

export default App;