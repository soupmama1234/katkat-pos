// BUG FIX: ES module import ต้องอยู่บนสุดของไฟล์ (Vite ไม่รองรับ require())
import { createClient } from '@supabase/supabase-js';

// =============================================
// storage.js — Auto-switch Supabase ↔ localStorage
// ถ้ามี VITE_SUPABASE_URL ใน .env → ใช้ Supabase
// ถ้าไม่มี → ใช้ localStorage (dev mode)
// =============================================

const USE_SUPABASE = !!(
  import.meta.env.VITE_SUPABASE_URL &&
  import.meta.env.VITE_SUPABASE_ANON_KEY &&
  import.meta.env.VITE_SUPABASE_URL !== "https://xxxxxxxxxxxx.supabase.co"
);

// --- localStorage helpers ---
const ls = {
  get: (key, fallback) => {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch { return fallback; }
  },
  set: (key, value) => {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch {}
  },
};

const INITIAL_PRODUCTS = [
  { id: 1, name: "A1 ข้าวสันนอก", price: 120, category: "A ชุดข้าว", grabPrice: 150, linemanPrice: 150, shopeePrice: 145, modifierGroups: [] },
  { id: 2, name: "A2 ข้าวสันใน", price: 125, category: "A ชุดข้าว", grabPrice: 155, linemanPrice: 155, shopeePrice: 150, modifierGroups: [] },
];

// =============================================
// SUPABASE DRIVER
// =============================================
let _supabase = null;
function getSupabase() {
  if (!_supabase) {
    _supabase = createClient(
      import.meta.env.VITE_SUPABASE_URL,
      import.meta.env.VITE_SUPABASE_ANON_KEY
    );
  }
  return _supabase;
}

// แปลง DB row → App format
function dbToProduct(row) {
  return {
    id: row.id,
    name: row.name,
    category: row.category,
    price: row.price,
    grabPrice: row.grab_price,
    linemanPrice: row.lineman_price,
    shopeePrice: row.shopee_price,
    modifierGroups: row.modifier_group_ids || [],
  };
}

function productToDb(p) {
  return {
    name: p.name,
    category: p.category || "ทั่วไป",
    price: Number(p.price) || 0,
    grab_price: p.grabPrice ? Number(p.grabPrice) : null,
    lineman_price: p.linemanPrice ? Number(p.linemanPrice) : null,
    shopee_price: p.shopeePrice ? Number(p.shopeePrice) : null,
    modifier_group_ids: p.modifierGroups || [],
  };
}

function dbToOrder(row) {
  return {
    id: row.id,
    time: row.created_at,
    channel: row.channel,
    payment: row.payment,
    refId: row.ref_id,
    total: row.total,
    actualAmount: row.actual_amount,
    isSettled: row.is_settled,
    items: row.items || [],
  };
}

const supabaseDriver = {
  // CATEGORIES
  async fetchCategories() {
    const sb = getSupabase();
    const { data, error } = await sb.from("categories").select("name").order("sort_order");
    if (error) throw error;
    return ["All", ...data.map(c => c.name)];
  },
  async addCategory(name) {
    const sb = getSupabase();
    const { error } = await sb.from("categories").insert({ name, sort_order: Date.now() });
    if (error && error.code !== "23505") throw error;
  },
  async deleteCategory(name) {
    const sb = getSupabase();
    const { error } = await sb.from("categories").delete().eq("name", name);
    if (error) throw error;
  },

  // PRODUCTS
  async fetchProducts() {
    const sb = getSupabase();
    const { data, error } = await sb.from("products").select("*").order("created_at");
    if (error) throw error;
    return data.map(dbToProduct);
  },
  async addProduct(p) {
    const sb = getSupabase();
    const { data, error } = await sb.from("products").insert(productToDb(p)).select().single();
    if (error) throw error;
    return dbToProduct(data);
  },
  async updateProduct(id, fields) {
    const sb = getSupabase();
    const dbFields = {};
    if (fields.name !== undefined) dbFields.name = fields.name;
    if (fields.category !== undefined) dbFields.category = fields.category;
    if (fields.price !== undefined) dbFields.price = Number(fields.price);
    if (fields.grabPrice !== undefined) dbFields.grab_price = fields.grabPrice ? Number(fields.grabPrice) : null;
    if (fields.linemanPrice !== undefined) dbFields.lineman_price = fields.linemanPrice ? Number(fields.linemanPrice) : null;
    if (fields.shopeePrice !== undefined) dbFields.shopee_price = fields.shopeePrice ? Number(fields.shopeePrice) : null;
    if (fields.modifierGroups !== undefined) dbFields.modifier_group_ids = fields.modifierGroups;
    const { error } = await sb.from("products").update(dbFields).eq("id", id);
    if (error) throw error;
  },
  async deleteProduct(id) {
    const sb = getSupabase();
    const { error } = await sb.from("products").delete().eq("id", id);
    if (error) throw error;
  },
  async clearAllProducts() {
    const sb = getSupabase();
    const { error } = await sb.from("products").delete().neq("id", 0);
    if (error) throw error;
  },

  // MODIFIERS
  async fetchModifierGroups() {
    const sb = getSupabase();
    const [{ data: groups, error: gErr }, { data: options, error: oErr }] = await Promise.all([
      sb.from("modifier_groups").select("*").order("created_at"),
      sb.from("modifier_options").select("*").order("created_at"),
    ]);
    if (gErr) throw gErr;
    if (oErr) throw oErr;
    return groups.map(g => ({
      id: g.id,
      name: g.name,
      options: options.filter(o => o.group_id === g.id).map(o => ({ id: o.id, name: o.name, price: o.price })),
    }));
  },
  async addModifierGroup(name) {
    const sb = getSupabase();
    const { data, error } = await sb.from("modifier_groups").insert({ name }).select().single();
    if (error) throw error;
    return { id: data.id, name: data.name, options: [] };
  },
  async deleteModifierGroup(groupId) {
    const sb = getSupabase();
    const { error } = await sb.from("modifier_groups").delete().eq("id", groupId);
    if (error) throw error;
  },
  async addOptionToGroup(groupId, name, price) {
    const sb = getSupabase();
    const { data, error } = await sb.from("modifier_options").insert({ group_id: groupId, name, price: Number(price) || 0 }).select().single();
    if (error) throw error;
    return { id: data.id, name: data.name, price: data.price };
  },
  async deleteOption(groupId, optionId) {
    const sb = getSupabase();
    const { error } = await sb.from("modifier_options").delete().eq("id", optionId);
    if (error) throw error;
  },

  // ORDERS
  async fetchOrders() {
    const sb = getSupabase();
    const { data, error } = await sb.from("orders").select("*").eq("is_history", false).order("created_at", { ascending: false });
    if (error) throw error;
    return data.map(dbToOrder);
  },
  async addOrder(order) {
    const sb = getSupabase();
    const { data, error } = await sb.from("orders").insert({
      channel: order.channel, payment: order.payment, ref_id: order.refId || "",
      total: order.total, actual_amount: order.actualAmount || 0,
      is_settled: order.isSettled || false, is_history: false, items: order.items,
    }).select().single();
    if (error) throw error;
    return dbToOrder(data);
  },
  async updateOrder(id, fields) {
    const sb = getSupabase();
    const dbFields = {};
    if (fields.actualAmount !== undefined) dbFields.actual_amount = fields.actualAmount;
    if (fields.isSettled !== undefined) dbFields.is_settled = fields.isSettled;
    const { error } = await sb.from("orders").update(dbFields).eq("id", id);
    if (error) throw error;
  },
  async deleteOrder(id) {
    const sb = getSupabase();
    const { error } = await sb.from("orders").delete().eq("id", id);
    if (error) throw error;
  },
  async clearOrders() {
    const sb = getSupabase();
    const { error } = await sb.from("orders").delete().eq("is_history", false);
    if (error) throw error;
  },
  async closeDayOrders() {
    const sb = getSupabase();
    const { error } = await sb.from("orders").update({ is_history: true }).eq("is_history", false);
    if (error) throw error;
  },
};

// =============================================
// LOCALSTORAGE DRIVER (dev / offline fallback)
// =============================================
const localDriver = {
  async fetchCategories() {
    return ls.get("katkat_categories", ["All", "A ชุดข้าว"]);
  },
  async addCategory(name) {
    const cats = ls.get("katkat_categories", ["All"]);
    if (!cats.includes(name)) ls.set("katkat_categories", [...cats, name]);
  },
  async deleteCategory(name) {
    const cats = ls.get("katkat_categories", []);
    ls.set("katkat_categories", cats.filter(c => c !== name));
  },

  async fetchProducts() {
    return ls.get("katkat_products", INITIAL_PRODUCTS);
  },
  async addProduct(p) {
    const saved = { ...p, id: Date.now(), modifierGroups: p.modifierGroups || [] };
    const prods = ls.get("katkat_products", []);
    ls.set("katkat_products", [...prods, saved]);
    return saved;
  },
  async updateProduct(id, fields) {
    const prods = ls.get("katkat_products", []);
    ls.set("katkat_products", prods.map(p => p.id === id ? { ...p, ...fields } : p));
  },
  async deleteProduct(id) {
    const prods = ls.get("katkat_products", []);
    ls.set("katkat_products", prods.filter(p => p.id !== id));
  },
  async clearAllProducts() {
    ls.set("katkat_products", []);
  },

  async fetchModifierGroups() {
    return ls.get("katkat_modifiers", []);
  },
  async addModifierGroup(name) {
    const group = { id: Date.now(), name, options: [] };
    const groups = ls.get("katkat_modifiers", []);
    ls.set("katkat_modifiers", [...groups, group]);
    return group;
  },
  async deleteModifierGroup(groupId) {
    const groups = ls.get("katkat_modifiers", []);
    ls.set("katkat_modifiers", groups.filter(g => g.id !== groupId));
  },
  async addOptionToGroup(groupId, name, price) {
    const opt = { id: Date.now(), name, price: Number(price) || 0 };
    const groups = ls.get("katkat_modifiers", []);
    ls.set("katkat_modifiers", groups.map(g =>
      g.id === groupId ? { ...g, options: [...(g.options || []), opt] } : g
    ));
    return opt;
  },
  async deleteOption(groupId, optionId) {
    const groups = ls.get("katkat_modifiers", []);
    ls.set("katkat_modifiers", groups.map(g =>
      g.id === groupId ? { ...g, options: g.options.filter(o => o.id !== optionId) } : g
    ));
  },

  async fetchOrders() {
    return ls.get("katkat_orders", []);
  },
  async addOrder(order) {
    const saved = { ...order, id: Date.now() };
    const orders = ls.get("katkat_orders", []);
    ls.set("katkat_orders", [saved, ...orders]);
    return saved;
  },
  async updateOrder(id, fields) {
    const orders = ls.get("katkat_orders", []);
    ls.set("katkat_orders", orders.map(o => o.id === id ? { ...o, ...fields } : o));
  },
  async deleteOrder(id) {
    const orders = ls.get("katkat_orders", []);
    ls.set("katkat_orders", orders.filter(o => o.id !== id));
  },
  async clearOrders() {
    ls.set("katkat_orders", []);
  },
  async closeDayOrders() {
    const orders = ls.get("katkat_orders", []);
    const history = ls.get("katkat_history", []);
    ls.set("katkat_history", [...history, ...orders]);
    ls.set("katkat_orders", []);
  },
};

// =============================================
// EXPORT — ใช้ driver ที่เหมาะสมอัตโนมัติ
// =============================================
const db = USE_SUPABASE ? supabaseDriver : localDriver;

export const supabaseClient = USE_SUPABASE ? getSupabase() : null;
export default db;