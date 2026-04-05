import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const { url, anonKey } = window.SUPABASE_CONFIG;
const supabase = createClient(url, anonKey);

const grid = document.getElementById('grid');
const filterSelect = document.getElementById('category-filter');
const toastEl = document.getElementById('toast');
const cardTemplate = document.getElementById('card-template');

let allItems = [];

function isUrl(s) {
  if (!s) return false;
  try { const u = new URL(s); return u.protocol === 'http:' || u.protocol === 'https:'; }
  catch { return false; }
}

function showToast(msg) {
  toastEl.textContent = msg;
  toastEl.classList.add('show');
  setTimeout(() => toastEl.classList.remove('show'), 3000);
}

function renderCard(item) {
  const frag = cardTemplate.content.cloneNode(true);
  const imgWrap = frag.querySelector('.card-img');
  const img = frag.querySelector('.card-img img');
  if (item.image_url) {
    img.src = item.image_url;
    img.alt = item.name;
  } else {
    img.remove();
    imgWrap.classList.add('placeholder');
  }
  frag.querySelector('.card-name').textContent = item.name;
  const desc = frag.querySelector('.card-desc');
  if (item.description) desc.textContent = item.description; else desc.remove();
  const price = frag.querySelector('.card-price');
  if (item.price != null) price.textContent = `$${Number(item.price).toFixed(2)}`;
  else price.remove();
  const link = frag.querySelector('.card-link');
  if (isUrl(item.link)) link.href = item.link; else link.hidden = true;
  const btn = frag.querySelector('.card-claim');
  btn.addEventListener('click', () => onClaim(item, btn));
  return frag;
}

function render() {
  const filter = filterSelect.value;
  const items = filter ? allItems.filter((i) => i.category === filter) : allItems;
  grid.innerHTML = '';
  if (items.length === 0) {
    grid.innerHTML = '<p style="grid-column:1/-1;text-align:center;color:#888">No items available right now.</p>';
    return;
  }
  const byCat = new Map();
  for (const item of items) {
    const key = item.category || 'Other';
    if (!byCat.has(key)) byCat.set(key, []);
    byCat.get(key).push(item);
  }
  for (const [cat, list] of byCat) {
    const group = document.createElement('section');
    group.className = 'category-group';
    const h = document.createElement('h2');
    h.textContent = cat;
    group.appendChild(h);
    const inner = document.createElement('div');
    inner.className = 'cards';
    for (const item of list) inner.appendChild(renderCard(item));
    group.appendChild(inner);
    grid.appendChild(group);
  }
}

function populateCategoryFilter() {
  const cats = [...new Set(allItems.map((i) => i.category).filter(Boolean))].sort();
  filterSelect.innerHTML = '<option value="">All</option>' +
    cats.map((c) => `<option value="${c}">${c}</option>`).join('');
}

async function loadItems() {
  const { data, error } = await supabase
    .from('items')
    .select('*')
    .eq('claimed', false)
    .order('category', { ascending: true })
    .order('name', { ascending: true });
  if (error) {
    grid.innerHTML = '<p style="color:#c00">Could not load items. Try refreshing.</p>';
    console.error(error);
    return;
  }
  allItems = data ?? [];
  populateCategoryFilter();
  render();
}

async function onClaim(item, btn) {
  const ok = confirm(`Mark "${item.name}" as your gift? Others won't see it anymore.`);
  if (!ok) return;
  btn.disabled = true;
  const { data, error } = await supabase
    .from('items')
    .update({ claimed: true, claimed_at: new Date().toISOString() })
    .eq('id', item.id)
    .eq('claimed', false)
    .select('id');
  if (error) {
    console.error(error);
    showToast("Couldn't save — try again.");
    btn.disabled = false;
    return;
  }
  if (!data || data.length === 0) {
    showToast('Someone just claimed that one — refreshing.');
    await loadItems();
    return;
  }
  allItems = allItems.filter((i) => i.id !== item.id);
  render();
  showToast('Got it! Thank you 💛');
}

filterSelect.addEventListener('change', render);
loadItems();
