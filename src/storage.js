// BUG FIX: ES module import ต้องอยู่บนสุดของไฟล์ (Vite ไม่รองรับ require())
import { supabase as _supabaseInstance } from './supabase';

// =============================================
// storage.js — Auto-switch Supabase ↔ localStorage
// =============================================

const USE_SUPABASE = !!(
  import.meta.env.VITE_SUPABASE_URL &&
  import.meta.env.VITE_SUPABASE_ANON_KEY &&
  import.meta.env.VITE_SUPABASE_URL !== "https://xxxxxxxxxxxx.supabase.co"
);

const ls = {
  get: (key, fallback) => {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch { return fallback; }
  },
  set: (key, value) => {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch (err) { console.warn("localStorage set failed", key, err); }
  },
};

const INITIAL_PRODUCTS = [
  { id: 1, name: "A1 ข้าวสันนอก", price: 120, category: "A ชุดข้าว", grabPrice: 150, linemanPrice: 150, shopeePrice: 145, modifierGroups: [] },
  { id: 2, name: "A2 ข้าวสันใน", price: 125, category: "A ชุดข้าว", grabPrice: 155, linemanPrice: 155, shopeePrice: 150, modifierGroups: [] },
];

function getSupabase() { return _supabaseInstance; }

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
    time: row.created_at || row.time,
    channel: row.channel,
    payment: row.payment,
    refId: row.ref_id,
    total: row.total,
    actualAmount: row.actual_amount,
    isSettled: row.is_settled,
    items: row.items || [],
    member_phone: row.member_phone || null,
    order_type: row.order_type || "dine_in",
    table_no: row.table_no || null,
    status: row.status || "settled"
  };
}

const supabaseDriver = {
  // CATEGORIES
  async fetchCategories() {
    const sb = getSupabase();
    const { data, error } = await sb.from("categories").select("name").order("name");
    if (error) throw error;
    return ["All", ...data.map(c => c.name)];
  },
  async addCategory(name) {
    const sb = getSupabase();
    const { error } = await sb.from("categories").insert({ name });
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
    const { data, error } = await sb.from("products").select("*").order("name");
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
    // วันนี้ตอนเที่ยงคืน (ISO string)
    const today = new Date();
    today.setHours(0,0,0,0);
    const todayISO = today.toISOString();

    const { data, error } = await sb.from("orders")
      .select("*")
      .gte("created_at", todayISO) // เอาเฉพาะของวันนี้
      .neq("status", "pending")    // ไม่เอาบิลค้าง
      .order("created_at", { ascending: false });
    if (error) throw error;
    return data.map(dbToOrder);
  },
  async addOrder(order) {
    const sb = getSupabase();
    const { data, error } = await sb.from("orders").insert({
      channel: order.channel, payment: order.payment, ref_id: order.refId || "",
      total: order.total, actual_amount: order.actualAmount || 0,
      is_settled: order.isSettled || false, is_history: false, items: order.items,
      member_phone: order.member_phone || null,
      order_type: order.order_type || "dine_in",
      table_no: order.table_no || null,
      status: order.status || "settled"
    }).select().single();
    if (error) throw error;
    return dbToOrder(data);
  },
  async updateOrder(id, fields) {
    const sb = getSupabase();
    const dbFields = {};
    if (fields.actualAmount !== undefined) dbFields.actual_amount = fields.actualAmount;
    if (fields.isSettled !== undefined) dbFields.is_settled = fields.isSettled;
    if (fields.status !== undefined) dbFields.status = fields.status;
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

  // MEMBERS
  async fetchMembers() {
    const sb = getSupabase();
    const { data, error } = await sb.from("members").select("*").order("created_at", { ascending: false });
    if (error) throw error;
    return data || [];
  },
  async addMember(member) {
    const sb = getSupabase();
    const { data, error } = await sb.from("members").insert(member).select().single();
    if (error) throw error;
    return data;
  },
  async updateMember(phone, fields) {
    const sb = getSupabase();
    const { error } = await sb.from("members").update(fields).eq("phone", phone);
    if (error) throw error;
  },
};

const localDriver = {
  async fetchCategories() {
    const cats = ls.get("katkat_categories", ["All", "A ชุดข้าว"]);
    const filtered = [...new Set(cats.filter(c => c !== "All"))];
    return ["All", ...filtered.sort((a, b) => a.localeCompare(b, 'th'))];
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
    const prods = ls.get("katkat_products", INITIAL_PRODUCTS);
    return prods.sort((a, b) => a.name.localeCompare(b.name, 'th'));
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
  async clearAllProducts() { ls.set("katkat_products", []); },

  async fetchModifierGroups() { return ls.get("katkat_modifiers", []); },
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
    ls.set("katkat_modifiers", groups.map(g => g.id === groupId ? { ...g, options: [...(g.options || []), opt] } : g));
    return opt;
  },
  async deleteOption(groupId, optionId) {
    const groups = ls.get("katkat_modifiers", []);
    ls.set("katkat_modifiers", groups.map(g => g.id === groupId ? { ...g, options: g.options.filter(o => o.id !== optionId) } : g));
  },

  async fetchOrders() {
    const orders = ls.get("katkat_orders", []);
    return orders.filter(o => o.status === "settled");
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
  async clearOrders() { ls.set("katkat_orders", []); },
  async closeDayOrders() {
    const orders = ls.get("katkat_orders", []);
    const history = ls.get("katkat_history", []);
    ls.set("katkat_history", [...history, ...orders]);
    ls.set("katkat_orders", []);
  },

  // MEMBERS
  async fetchMembers() { return ls.get("katkat_members", []); },
  async addMember(member) {
    const saved = { ...member, created_at: member.created_at || new Date().toISOString() };
    const mems = ls.get("katkat_members", []);
    ls.set("katkat_members", [...mems, saved]);
    return saved;
  },
  async updateMember(phone, fields) {
    const mems = ls.get("katkat_members", []);
    ls.set("katkat_members", mems.map(m => m.phone === phone ? { ...m, ...fields } : m));
  },
};

const db = USE_SUPABASE ? supabaseDriver : localDriver;
export const isUsingSupabase = USE_SUPABASE;
export default db;
