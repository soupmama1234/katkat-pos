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
import db from "./storage";

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

  // --- Load Data ---
  useEffect(() => {
    async function loadAll() {
      try {
        const [cats, prods, mods, ords] = await Promise.all([
          db.fetchCategories(),
          db.fetchProducts(),
          db.fetchModifierGroups(),
          db.fetchOrders(),
        ]);
        setProducts(prods || []);
        setModifierGroups(mods || []);
        setOrders(ords || []);
        const dbCats = new Set(cats.filter(c => c !== "All"));
        const prodCats = new Set((prods || []).map(p => p.category).filter(Boolean));
        setCategories(["All", ...new Set([...dbCats, ...prodCats])]);
      } catch (err) { console.error("Load failed:", err); }
      finally { setLoading(false); }
    }
    loadAll();
  }, []);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // --- Functions ---
  const total = useMemo(() => cart.reduce((s, i) => s + (i.price * i.qty), 0), [cart]);

  const addToCart = useCallback((product, channel = priceChannel) => {
    setCart(prev => {
      const modId = product.selectedModifier?.id || null;
      const idx = prev.findIndex(i => i.id === product.id && i.channel === channel && (i.selectedModifier?.id || null) === modId);
      if (idx > -1) {
        const n = [...prev]; n[idx].qty += 1; return n;
      }
      const base = Number(product[`${channel}Price`] ?? product.price) || 0;
      const modPrice = Number(product.selectedModifier?.price) || 0;
      return [...prev, { ...product, price: base + modPrice, qty: 1, channel, selectedModifier: product.selectedModifier || null }];
    });
  }, [priceChannel]);

  const handleCheckout = async (paymentMethod, refId = "", phone = memberPhone) => {
    if (cart.length === 0) return;
    const isDelivery = ["grab", "lineman", "shopee"].includes(priceChannel);
    try {
      // ปรับ Payload ให้ตรงกับตาราง Supabase (ตามรูปที่คุณส่งมา)
      const payload = {
        time: new Date().toISOString(),
        items: cart, // ส่งเป็น array ของ object
        total_amount: total,
        payment_method: isDelivery ? "transfer" : paymentMethod,
        channel: priceChannel,
        ref_id: refId, // *** เลข GF-111 บันทึกลงที่นี่ ***
        member_phone: phone || null,
        is_settled: !isDelivery, // ตามชื่อฟิลด์ในรูป
        actual_amount: isDelivery ? 0 : total, // ตามชื่อฟิลด์ในรูป
        is_history: false
      };

      const saved = await db.addOrder(payload);
      setOrders(prev => [saved, ...prev]);

      if (phone) {
        const { data: m } = await sb.from('members').select('points, total_spent').eq('phone', phone).single();
        if (m) {
          await sb.from('members').update({ 
            points: (m.points || 0) + Math.floor(total / 10), 
            total_spent: (m.total_spent || 0) + total 
          }).eq('phone', phone);
        }
      }
      setCart([]); setMemberPhone(""); alert("บันทึกสำเร็จ!"); return true;
    } catch (err) { alert("Error: " + err.message); return false; }
  };
  return (
    <div style={styles.appWrapper}>
      {!isMobile ? (
        <div style={styles.desktopContainer}>
          <header style={styles.desktopHeader}>
            <h2 style={{ margin: 0, color: "#00B14F" }}>KATKAT POS</h2>
            <nav style={{ display: "flex", gap: 10 }}>
              {["pos", "menu", "dashboard", "orders", "members"].map(v => (
                <button key={v} onClick={() => setView(v)} style={styles.desktopNavBtn(view === v)}>{v.toUpperCase()}</button>
              ))}
            </nav>
          </header>

          <main style={styles.desktopMain}>
            {view === "pos" && (
              <>
                <section style={styles.desktopProducts}>
                  <Products products={products} addToCart={addToCart} categories={categories} selectedCategory={selectedCategory} setSelectedCategory={setSelectedCategory} priceChannel={priceChannel} modifierGroups={modifierGroups} />
                </section>
                <aside style={styles.desktopCart}>
                  <Cart cart={cart} total={total} onCheckout={handleCheckout} onClearCart={() => setCart([])} priceChannel={priceChannel} memberPhone={memberPhone} setMemberPhone={setMemberPhone} 
                    increaseQty={(id, ch, mid) => setCart(p => p.map(i => (i.id===id && i.channel===ch && (i.selectedModifier?.id||null)===mid) ? {...i, qty: i.qty+1} : i))}
                    decreaseQty={(id, ch, mid) => setCart(p => p.map(i => (i.id===id && i.channel===ch && (i.selectedModifier?.id||null)===mid) ? {...i, qty: i.qty-1} : i).filter(i => i.qty>0))}
                  />
                </aside>
              </>
            )}

            {view === "menu" && (
              <div style={{ flex: 1, overflowY: "auto", padding: "30px" }}>
                <MenuManager 
                  products={products} 
                  setProducts={setProducts} 
                  modifierGroups={modifierGroups} // *** ส่งกลุ่มตัวเลือกไปให้หน้าจัดการเมนู ***
                  updateProduct={(id, f) => db.updateProduct(id, f).then(() => setProducts(p => p.map(x => x.id === id ? {...x, ...f} : x)))} 
                  deleteProduct={(id) => db.deleteProduct(id).then(() => setProducts(p => p.filter(x => x.id !== id)))} 
                  addProduct={(p) => db.addProduct(p).then(s => setProducts(x => [...x, s]))} 
                  categories={categories} 
                />
                <ModifierManager modifierGroups={modifierGroups} setModifierGroups={setModifierGroups} />
              </div>
            )}

            {view === "orders" && (
              <div style={{ flex: 1, overflowY: "auto" }}>
                <Orders orders={orders} onDeleteOrder={(id) => db.deleteOrder(id).then(() => setOrders(o => o.filter(x => x.id !== id)))} onClearAll={() => db.clearOrders().then(() => setOrders([]))} />
              </div>
            )}
            
            {view === "dashboard" && (
              <div style={{ flex: 1, overflowY: "auto" }}>
                <Dashboard orders={orders} 
                  onUpdateActual={(id, v) => db.updateOrder(id, { actual_amount: parseFloat(v), is_settled: true }).then(() => setOrders(o => o.map(x => x.id === id ? {...x, actual_amount: parseFloat(v), is_settled: true} : x)))} 
                  onCloseDay={() => db.closeDayOrders().then(() => setOrders([]))} 
                />
              </div>
            )}
            {view === "members" && <div style={{ flex: 1 }}><Members orders={orders} /></div>}
          </main>
        </div>
      ) : (
        <div style={styles.mobileContainer}>
           <main style={styles.mobileMain}>
             {view === "pos" && <MobilePOS products={products} addToCart={addToCart} categories={categories} cart={cart} total={total} onCheckout={handleCheckout} priceChannel={priceChannel} setPriceChannel={setPriceChannel} onClearCart={() => setCart([])} memberPhone={memberPhone} setMemberPhone={setMemberPhone} modifierGroups={modifierGroups} />}
             {view === "orders" && <Orders orders={orders} onDeleteOrder={(id) => db.deleteOrder(id).then(() => setOrders(o => o.filter(x => x.id !== id)))} />}
           </main>
        </div>
      )}
    </div>
  );
}

const styles = {
  appWrapper: { height: "100vh", width: "100vw", backgroundColor: "#1a1a1a", color: "#fff", overflow: "hidden" },
  desktopContainer: { height: "100vh", display: "flex", flexDirection: "column" },
  desktopHeader: { padding: "15px 25px", backgroundColor: "#222", borderBottom: "1px solid #333", display: "flex", alignItems: "center", justifyContent: "space-between" },
  desktopNavBtn: (isActive) => ({ padding: "8px 16px", borderRadius: "8px", background: isActive ? "#fff" : "transparent", color: isActive ? "#000" : "#fff", border: "1px solid #444", fontWeight: "bold", cursor: "pointer" }),
  desktopMain: { flex: 1, display: "flex", overflow: "hidden" },
  desktopProducts: { flex: 1, overflowY: "auto", padding: "15px", borderRight: "1px solid #333" },
  desktopCart: { width: "400px", height: "100%" },
  mobileContainer: { height: "100vh", display: "flex", flexDirection: "column" },
  mobileMain: { flex: 1, overflowY: "auto", paddingBottom: "80px" },
};

export default App;