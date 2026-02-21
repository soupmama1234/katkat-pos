import { supabase } from './supabaseclient';

export const isUsingSupabase = true;

const db = {
  // --- Categories ---
  fetchCategories: async () => {
    const { data, error } = await supabase.from('categories').select('name').order('sort_order');
    if (error) throw error;
    return ['All', ...data.map(c => c.name)];
  },
  addCategory: async (name) => {
    const { data, error } = await supabase.from('categories').insert([{ name }]).select();
    if (error) throw error;
    return data[0];
  },
  deleteCategory: async (name) => {
    const { error } = await supabase.from('categories').delete().eq('name', name);
    if (error) throw error;
  },

  // --- Products ---
  fetchProducts: async () => {
    const { data, error } = await supabase.from('products').select('*').order('id');
    if (error) throw error;
    return data.map(p => ({
      ...p,
      price: Number(p.price),
      grabPrice: p.grab_price,
      linemanPrice: p.lineman_price,
      shopeePrice: p.shopee_price,
      modifierGroups: p.modifier_group_ids // Map ชื่อให้ตรงกับใน App.jsx
    }));
  },
  addProduct: async (p) => {
    const { data, error } = await supabase.from('products').insert([{
      name: p.name,
      category: p.category,
      price: p.price,
      grab_price: p.grabPrice,
      lineman_price: p.linemanPrice,
      shopee_price: p.shopeePrice,
      modifier_group_ids: p.modifierGroups || []
    }]).select().single();
    if (error) throw error;
    return { ...data, modifierGroups: data.modifier_group_ids };
  },
  updateProduct: async (id, fields) => {
    const updateData = { ...fields };
    if (fields.modifierGroups) {
      updateData.modifier_group_ids = fields.modifierGroups;
      delete updateData.modifierGroups;
    }
    const { error } = await supabase.from('products').update(updateData).eq('id', id);
    if (error) throw error;
  },
  deleteProduct: async (id) => {
    const { error } = await supabase.from('products').delete().eq('id', id);
    if (error) throw error;
  },

  // --- Modifiers ---
  fetchModifierGroups: async () => {
    // ดึงกลุ่มพร้อมตัวเลือก (Join modifier_options)
    const { data, error } = await supabase.from('modifier_groups').select(`
      id, name, options:modifier_options(*)
    `);
    if (error) throw error;
    return data;
  },
  addModifierGroup: async (name) => {
    const { data, error } = await supabase.from('modifier_groups').insert([{ name }]).select().single();
    if (error) throw error;
    return { ...data, options: [] };
  },
  deleteModifierGroup: async (id) => {
    const { error } = await supabase.from('modifier_groups').delete().eq('id', id);
    if (error) throw error;
  },
  addOptionToGroup: async (groupId, name, price) => {
    const { data, error } = await supabase.from('modifier_options').insert([{ group_id: groupId, name, price }]).select().single();
    if (error) throw error;
    return data;
  },
  deleteOption: async (groupId, optionId) => {
    const { error } = await supabase.from('modifier_options').delete().eq('id', optionId);
    if (error) throw error;
  },

  // --- Orders ---
  fetchOrders: async () => {
    const { data, error } = await supabase.from('orders').select('*').eq('is_history', false).order('created_at', { ascending: false });
    if (error) throw error;
    return data;
  },
  addOrder: async (order) => {
    const { data, error } = await supabase.from('orders').insert([{
      channel: order.channel,
      payment: order.payment,
      total: order.total,
      actual_amount: order.actualAmount,
      ref_id: order.refId,
      items: order.items,
      is_settled: order.isSettled
    }]).select().single();
    if (error) throw error;
    return data;
  },
  updateOrder: async (id, fields) => {
    const { error } = await supabase.from('orders').update({
        actual_amount: fields.actualAmount,
        is_settled: fields.isSettled
    }).eq('id', id);
    if (error) throw error;
  },
  closeDayOrders: async () => {
    const { error } = await supabase.from('orders').update({ is_history: true }).eq('is_history', false);
    if (error) throw error;
  }
};

export default db;