(() => {
  'use strict';

  const CURRENT_BACKEND_URL = 'https://script.google.com/macros/s/AKfycbyBBevMY4BpwVyd9o9bL7D0kbvL4Oln5V_yHCXslwQPNRCdfphW1WM3xgpA7-DkEEEF/exec';
  const query = new URLSearchParams(window.location.search);
  const BACKEND_URL = query.get('script_url') || CURRENT_BACKEND_URL;
  const STORAGE_TOKEN = 'mailly_session_token';
  const PAGE_SIZE = 60;

  let currentUser = '';
  let currentCredit = 0;
  let categories = [];
  let products = [];
  let selectedCategory = 'all';
  let selectedProduct = null;
  let visibleLimit = PAGE_SIZE;
  let purchaseHistory = [];

  const $ = id => document.getElementById(id);

  function escapeHtml(value) {
    return String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function safeImageUrl(value) {
    try {
      const url = new URL(String(value || ''), window.location.href);
      return url.protocol === 'https:' ? url.href : '';
    } catch (_) {
      return '';
    }
  }

  function formatMoney(value) {
    return `${(Number(value) || 0).toLocaleString('th-TH', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    })} ฿`;
  }

  function showToast(message, type = 'info') {
    let wrap = $('shopToastArea');
    if (!wrap) {
      wrap = document.createElement('div');
      wrap.id = 'shopToastArea';
      wrap.className = 'fixed top-4 right-4 z-[100] flex flex-col gap-2 w-[min(92vw,380px)]';
      document.body.appendChild(wrap);
    }

    const colors = {
      success: 'border-emerald-500/40 bg-emerald-950/95 text-emerald-100',
      error: 'border-red-500/40 bg-red-950/95 text-red-100',
      warning: 'border-amber-500/40 bg-amber-950/95 text-amber-100',
      info: 'border-orange-500/40 bg-stone-950/95 text-stone-100'
    };

    const toast = document.createElement('div');
    toast.className = `rounded-xl border px-4 py-3 shadow-2xl backdrop-blur ${colors[type] || colors.info}`;
    toast.textContent = String(message || '');
    wrap.appendChild(toast);
    setTimeout(() => toast.remove(), 5200);
  }

  async function api(action, payload = {}) {
    const response = await fetch(BACKEND_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ action, payload })
    });

    if (!response.ok) {
      throw new Error(`ระบบหลังบ้านตอบกลับ HTTP ${response.status}`);
    }

    const data = await response.json();
    if (!data.success) {
      throw new Error(data.message || 'ไม่สามารถดำเนินการได้');
    }
    return data;
  }

  async function loadSession() {
    const token = localStorage.getItem(STORAGE_TOKEN) || '';
    if (!token) {
      throw new Error('กรุณาเข้าสู่ระบบจากหน้าหลักก่อนใช้งานร้านค้า');
    }

    const data = await api('getSessionUser', { token });
    currentUser = data.user.username || '';
    currentCredit = Number(data.user.credit) || 0;
    $('userNameDisplay').textContent = currentUser || 'สมาชิก';
    $('shopHeaderAvatar').textContent = (currentUser || 'M').charAt(0).toUpperCase();
    $('userCreditDisplay').textContent = formatMoney(currentCredit);
    localStorage.setItem('username', currentUser);

    if (currentUser.toLowerCase() === 'admin') {
      $('supplierStatusBtn')?.classList.remove('hidden');
    }
  }

  function catalogLoading() {
    $('productGrid').innerHTML = '<div class="col-span-full text-center text-stone-400 py-16"><i class="fa-solid fa-spinner animate-spin text-2xl text-orange-400 mb-3 block"></i>กำลังโหลดสินค้าจาก Shopnoi...</div>';
    $('catalogSummary').textContent = 'กำลังเชื่อมต่อ Shopnoi...';
  }

  async function loadCatalog(force = false) {
    catalogLoading();
    try {
      const token = localStorage.getItem(STORAGE_TOKEN) || '';
      const data = await api('getShopnoiCatalog', { token, force });
      categories = Array.isArray(data.categories) ? data.categories : [];
      products = categories.flatMap(category => {
        const list = Array.isArray(category.products) ? category.products : [];
        return list.map(product => ({
          ...product,
          categoryId: String(category.id),
          categoryName: category.name || 'อื่น ๆ',
          categoryIcon: category.icon || ''
        }));
      });
      visibleLimit = PAGE_SIZE;
      renderCategoryFilters();
      renderProducts();
      $('catalogSummary').textContent = `${categories.length} หมวด · ${products.length.toLocaleString('th-TH')} สินค้า · ราคา Shopnoi`;
    } catch (error) {
      $('catalogSummary').textContent = 'เชื่อมต่อ Shopnoi ไม่สำเร็จ';
      $('productGrid').innerHTML = `<div class="col-span-full glass-card rounded-2xl p-8 text-center"><i class="fa-solid fa-triangle-exclamation text-3xl text-red-400 mb-3 block"></i><p class="text-white font-bold">โหลดสินค้าไม่สำเร็จ</p><p class="text-sm text-stone-400 mt-2">${escapeHtml(error.message)}</p><button type="button" onclick="loadCatalog(true)" class="mt-5 px-4 py-2 rounded-xl btn-gradient text-white text-sm font-bold">ลองใหม่</button></div>`;
    }
  }

  function renderCategoryFilters() {
    const container = $('categoryFilters');
    const allButton = '<button data-category="all" onclick="filterCategory(\'all\', this)" class="cat-btn shrink-0 px-5 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all"><i class="fa-solid fa-border-all mr-1.5"></i>ทั้งหมด</button>';
    const buttons = categories.map(category => {
      const icon = safeImageUrl(category.icon);
      return `<button data-category="${escapeHtml(category.id)}" onclick="filterCategory('${escapeHtml(category.id)}', this)" class="cat-btn shrink-0 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all flex items-center gap-2">${icon ? `<img src="${escapeHtml(icon)}" alt="" class="w-5 h-5 rounded object-contain">` : '<i class="fa-solid fa-folder text-orange-400"></i>'}<span>${escapeHtml(category.name)}</span></button>`;
    }).join('');
    container.innerHTML = allButton + buttons;
    updateCategoryButtonStyles();
  }

  function updateCategoryButtonStyles() {
    document.querySelectorAll('.cat-btn').forEach(button => {
      const active = String(button.dataset.category) === selectedCategory;
      button.classList.toggle('bg-orange-600', active);
      button.classList.toggle('text-white', active);
      button.classList.toggle('shadow-lg', active);
      button.classList.toggle('shadow-orange-600/30', active);
      button.classList.toggle('bg-stone-800/80', !active);
      button.classList.toggle('text-stone-300', !active);
      button.classList.toggle('border', !active);
      button.classList.toggle('border-stone-700/50', !active);
    });
  }

  function filteredProducts() {
    const term = ($('productSearch')?.value || '').trim().toLowerCase();
    return products.filter(product => {
      const inCategory = selectedCategory === 'all' || product.categoryId === selectedCategory;
      const haystack = `${product.name || ''} ${product.description || ''} ${product.categoryName || ''}`.toLowerCase();
      return inCategory && (!term || haystack.includes(term));
    });
  }

  function renderProducts() {
    const grid = $('productGrid');
    const filtered = filteredProducts();
    const visible = filtered.slice(0, visibleLimit);

    if (!visible.length) {
      grid.innerHTML = '<div class="col-span-full text-center text-stone-500 py-16"><i class="fa-solid fa-box-open text-3xl mb-3 block opacity-50"></i>ไม่พบสินค้าในเงื่อนไขนี้</div>';
      return;
    }

    grid.innerHTML = visible.map((product, index) => {
      const stock = Math.max(0, Number(product.amount) || 0);
      const out = stock < Math.max(1, Number(product.min) || 1);
      const logo = safeImageUrl(product.categoryIcon);
      const flag = String(product.flag || '').trim();
      return `<article class="glass-card rounded-2xl p-5 flex flex-col justify-between premium-card relative group animate-fade-in-up" style="animation-delay:${Math.min(index, 12) * 0.03}s">
        <div>
          <div class="flex items-center justify-between gap-3 mb-4">
            <div class="w-12 h-12 shrink-0 rounded-xl bg-stone-900 border border-stone-700/80 flex items-center justify-center p-2 shadow-inner overflow-hidden">${logo ? `<img src="${escapeHtml(logo)}" alt="" class="w-8 h-8 object-contain" onerror="this.style.display='none';this.nextElementSibling.style.display='block'"><i class="fa-solid fa-box text-orange-400" style="display:none"></i>` : '<i class="fa-solid fa-box text-orange-400"></i>'}</div>
            <div class="min-w-0 text-right"><span class="inline-block max-w-full truncate text-[10px] font-bold px-2.5 py-1 rounded-full bg-orange-500/15 border border-orange-500/30 text-orange-300">${escapeHtml(flag || product.categoryName)}</span><span class="block mt-1 text-[10px] ${out ? 'text-red-400' : 'text-emerald-400'} font-semibold"><i class="fa-solid fa-boxes-stacked mr-1"></i>สต็อก ${stock.toLocaleString('th-TH')}</span></div>
          </div>
          <h3 class="font-bold text-white text-base mb-2 group-hover:text-orange-300 transition-colors line-clamp-2">${escapeHtml(product.name)}</h3>
          <p class="text-xs text-stone-400 leading-relaxed mb-4 line-clamp-3 whitespace-pre-line">${escapeHtml(product.description || 'ดูรายละเอียดและเงื่อนไขก่อนสั่งซื้อ')}</p>
        </div>
        <div class="pt-4 border-t border-stone-800/80 flex items-end justify-between gap-3">
          <div><span class="text-[10px] text-stone-400 block">ราคาต่อชิ้น</span><strong class="text-xl text-orange-400">${formatMoney(product.price)}</strong><small class="block text-[10px] text-stone-500 mt-0.5">ขั้นต่ำ ${Math.max(1, Number(product.min) || 1)}</small></div>
          <button type="button" onclick="openBuyModal('${escapeHtml(product.id)}')" ${out ? 'disabled' : ''} class="px-4 py-2.5 rounded-xl ${out ? 'bg-stone-800 text-stone-500 cursor-not-allowed' : 'btn-gradient text-white active:scale-95'} text-xs font-bold transition-all"><i class="fa-solid ${out ? 'fa-ban' : 'fa-cart-shopping'} mr-1"></i>${out ? 'สินค้าหมด' : 'ดูและสั่งซื้อ'}</button>
        </div>
      </article>`;
    }).join('');

    if (visible.length < filtered.length) {
      grid.insertAdjacentHTML('beforeend', `<div class="col-span-full flex justify-center pt-4"><button type="button" onclick="showMoreProducts()" class="px-6 py-3 rounded-xl bg-stone-800 hover:bg-stone-700 border border-stone-700 text-stone-200 text-sm font-bold">แสดงเพิ่มอีก ${Math.min(PAGE_SIZE, filtered.length - visible.length)} รายการ <span class="text-stone-500">(${visible.length}/${filtered.length})</span></button></div>`);
    }
  }

  function filterCategory(categoryId) {
    selectedCategory = String(categoryId);
    visibleLimit = PAGE_SIZE;
    updateCategoryButtonStyles();
    renderProducts();
  }

  function showMoreProducts() {
    visibleLimit += PAGE_SIZE;
    renderProducts();
  }

  async function openBuyModal(productId) {
    const preview = products.find(item => String(item.id) === String(productId));
    selectedProduct = preview || null;
    $('buyModal').classList.remove('hidden');
    $('modalProductName').textContent = preview?.name || 'กำลังโหลดรายละเอียด...';
    $('modalProductPrice').textContent = preview ? formatMoney(preview.price) : '-';
    $('modalUserCredit').textContent = formatMoney(currentCredit);
    $('modalProductDescription').textContent = 'กำลังตรวจสอบราคาและสต็อกล่าสุด...';
    $('btnConfirmBuy').disabled = true;

    try {
      const token = localStorage.getItem(STORAGE_TOKEN) || '';
      const data = await api('getShopnoiProduct', { token, productId });
      selectedProduct = {
        ...(preview || {}),
        ...data.product
      };
      const min = Math.max(1, Number(selectedProduct.min) || 1);
      const stock = Math.max(0, Number(selectedProduct.amount) || 0);
      const max = Math.min(Math.max(min, Number(selectedProduct.max) || stock), stock);
      $('modalProductName').textContent = selectedProduct.name || '';
      $('modalProductPrice').textContent = formatMoney(selectedProduct.price);
      $('modalProductDescription').textContent = selectedProduct.description || 'ไม่มีคำอธิบายเพิ่มเติม';
      $('buyAmount').min = String(min);
      $('buyAmount').max = String(max);
      $('buyAmount').value = String(min);
      $('buyAmountHint').textContent = `ขั้นต่ำ ${min} · สูงสุด ${max} · สต็อก ${stock}`;
      $('btnConfirmBuy').disabled = max < min;
      updatePurchaseTotal();
    } catch (error) {
      $('modalProductDescription').textContent = error.message;
      $('btnConfirmBuy').disabled = true;
      showToast(error.message, 'error');
    }
  }

  function closeBuyModal() {
    $('buyModal').classList.add('hidden');
    selectedProduct = null;
    $('buyCoupon').value = '';
  }

  function updatePurchaseTotal() {
    if (!selectedProduct) return;
    const amount = Number($('buyAmount').value) || 0;
    $('modalPurchaseTotal').textContent = formatMoney((Number(selectedProduct.price) || 0) * amount);
  }

  async function executePurchase() {
    if (!selectedProduct) return;
    const token = localStorage.getItem(STORAGE_TOKEN) || '';
    const amount = Number($('buyAmount').value);
    const min = Number($('buyAmount').min) || 1;
    const max = Number($('buyAmount').max) || 0;
    const coupon = $('buyCoupon').value.trim();

    if (!Number.isInteger(amount) || amount < min || amount > max) {
      showToast(`กรุณาเลือกจำนวนระหว่าง ${min}–${max}`, 'warning');
      return;
    }

    const button = $('btnConfirmBuy');
    button.disabled = true;
    button.innerHTML = '<i class="fa-solid fa-spinner animate-spin"></i> กำลังสั่งซื้อ...';

    try {
      const data = await api('buyShopnoiProductWithCredit', {
        token,
        productId: selectedProduct.id,
        amount,
        coupon
      });
      currentCredit = Number(data.newCredit) || 0;
      $('userCreditDisplay').textContent = formatMoney(currentCredit);
      closeBuyModal();
      showPurchaseResult(data);
      showToast(`สั่งซื้อสำเร็จ เลขที่ ${data.orderId}`, 'success');
      await Promise.allSettled([loadCatalog(true), loadPurchaseHistory(false)]);
    } catch (error) {
      showToast(error.message, 'error');
      $('modalUserCredit').textContent = formatMoney(currentCredit);
    } finally {
      button.disabled = false;
      button.innerHTML = '<span>ยืนยันและชำระเครดิต</span>';
    }
  }

  function showPurchaseResult(data) {
    $('detailOrderId').textContent = `Order ID: ${data.orderId || data.purchaseId}`;
    $('detailTitle').textContent = data.productName || 'ข้อมูลสินค้าที่ได้รับ';
    $('detailContent').textContent = (Array.isArray(data.data) ? data.data : [data.data]).filter(Boolean).join('\n');
    $('viewDetailModal').classList.remove('hidden');
  }

  function switchMainTab(tab) {
    document.querySelectorAll('.tab-btn').forEach(button => button.classList.remove('active'));
    const history = tab === 'history';
    $('tabShopBtn').classList.toggle('active', !history);
    $('tabHistoryBtn').classList.toggle('active', history);
    $('shopViewSection').classList.toggle('hidden', history);
    $('historyViewSection').classList.toggle('hidden', !history);
    if (history) loadPurchaseHistory();
  }

  async function loadPurchaseHistory(showLoading = true) {
    const list = $('historyList');
    if (showLoading) {
      list.innerHTML = '<div class="text-center py-10 text-stone-400"><i class="fa-solid fa-spinner animate-spin text-orange-400 mr-2"></i>กำลังโหลดประวัติ...</div>';
    }

    try {
      const token = localStorage.getItem(STORAGE_TOKEN) || '';
      const data = await api('getMyShopnoiPurchases', { token });
      purchaseHistory = Array.isArray(data.purchases) ? data.purchases : [];
      renderPurchaseHistory();
    } catch (error) {
      list.innerHTML = `<div class="text-center py-10 text-red-300">${escapeHtml(error.message)}</div>`;
    }
  }

  function renderPurchaseHistory() {
    const list = $('historyList');
    if (!purchaseHistory.length) {
      list.innerHTML = '<div class="text-center py-10 text-stone-500"><i class="fa-solid fa-box-open text-3xl mb-2 block opacity-40"></i>คุณยังไม่มีประวัติการสั่งซื้อจาก Shopnoi</div>';
      return;
    }

    list.innerHTML = purchaseHistory.map((item, index) => {
      const completed = String(item.status).toLowerCase() === 'completed';
      return `<div class="bg-stone-950/80 rounded-xl p-4 border border-stone-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div class="min-w-0"><div class="flex flex-wrap items-center gap-2 mb-1"><span class="text-xs font-mono font-bold text-orange-400 bg-orange-500/10 px-2 py-0.5 rounded border border-orange-500/20">${escapeHtml(item.orderId)}</span><span class="text-[10px] ${completed ? 'text-emerald-400' : 'text-amber-400'}">${escapeHtml(item.status)}</span><span class="text-[10px] text-stone-500">${escapeHtml(item.createdAt)}</span></div><h4 class="font-bold text-white text-sm truncate">${escapeHtml(item.productName)}</h4><span class="text-xs text-stone-400">${item.quantity} ชิ้น · <b class="text-emerald-400">${formatMoney(item.total)}</b></span></div>
        <div class="flex flex-wrap gap-2"><button type="button" onclick="openHistoryDetail(${index})" class="px-3.5 py-2 rounded-lg bg-stone-800 hover:bg-stone-700 text-xs text-orange-300 border border-stone-700"><i class="fa-solid fa-key mr-1"></i>ดูข้อมูล</button><button type="button" onclick="refreshOrder(${index})" class="px-3.5 py-2 rounded-lg bg-stone-800 hover:bg-stone-700 text-xs text-stone-300 border border-stone-700"><i class="fa-solid fa-rotate mr-1"></i>ตรวจออเดอร์</button></div>
      </div>`;
    }).join('');
  }

  function openHistoryDetail(index) {
    const item = purchaseHistory[index];
    if (!item) return;
    $('detailOrderId').textContent = `Order ID: ${item.orderId}`;
    $('detailTitle').textContent = item.productName || 'ข้อมูลสินค้าที่ได้รับ';
    const values = Array.isArray(item.data) ? item.data : [item.data];
    $('detailContent').textContent = values.filter(Boolean).map(value => typeof value === 'string' ? value : JSON.stringify(value, null, 2)).join('\n');
    $('viewDetailModal').classList.remove('hidden');
  }

  async function refreshOrder(index) {
    const item = purchaseHistory[index];
    if (!item) return;
    try {
      showToast('กำลังตรวจสอบคำสั่งซื้อ...', 'info');
      const token = localStorage.getItem(STORAGE_TOKEN) || '';
      const data = await api('getMyShopnoiOrder', { token, orderId: item.orderId });
      $('detailOrderId').textContent = `Order ID: ${item.orderId}`;
      $('detailTitle').textContent = 'สถานะคำสั่งซื้อจาก Shopnoi';
      $('detailContent').textContent = JSON.stringify(data.order, null, 2);
      $('viewDetailModal').classList.remove('hidden');
    } catch (error) {
      showToast(error.message, 'error');
    }
  }

  function closeDetailModal() {
    $('viewDetailModal').classList.add('hidden');
  }

  async function copyDetailContent() {
    const text = $('detailContent').textContent || '';
    try {
      await navigator.clipboard.writeText(text);
      showToast('คัดลอกข้อมูลแล้ว', 'success');
    } catch (_) {
      showToast('คัดลอกไม่สำเร็จ กรุณาเลือกข้อความแล้วคัดลอกเอง', 'warning');
    }
  }

  async function loadSupplierProfile() {
    try {
      const token = localStorage.getItem(STORAGE_TOKEN) || '';
      const data = await api('getShopnoiProfileForAdmin', { token });
      showToast(`Shopnoi: ${data.profile.username || '-'} · ยอดคงเหลือ ${formatMoney(data.profile.money)}`, Number(data.profile.money) > 0 ? 'success' : 'warning');
    } catch (error) {
      showToast(error.message, 'error');
    }
  }

  let searchTimer;
  document.addEventListener('DOMContentLoaded', async () => {
    $('productSearch')?.addEventListener('input', () => {
      clearTimeout(searchTimer);
      searchTimer = setTimeout(() => {
        visibleLimit = PAGE_SIZE;
        renderProducts();
      }, 180);
    });

    $('buyModal')?.addEventListener('click', event => {
      if (event.target === $('buyModal')) closeBuyModal();
    });
    $('viewDetailModal')?.addEventListener('click', event => {
      if (event.target === $('viewDetailModal')) closeDetailModal();
    });
    document.addEventListener('keydown', event => {
      if (event.key === 'Escape') {
        closeBuyModal();
        closeDetailModal();
      }
    });

    try {
      await loadSession();
      await loadCatalog();
    } catch (error) {
      catalogLoading();
      $('productGrid').innerHTML = `<div class="col-span-full glass-card rounded-2xl p-8 text-center"><i class="fa-solid fa-lock text-3xl text-orange-400 mb-3 block"></i><p class="text-white font-bold">กรุณาเข้าสู่ระบบ</p><p class="text-sm text-stone-400 mt-2">${escapeHtml(error.message)}</p><a href="index.html" class="inline-block mt-5 px-5 py-2.5 rounded-xl btn-gradient text-white text-sm font-bold">ไปหน้าเข้าสู่ระบบ</a></div>`;
      $('catalogSummary').textContent = 'ต้องเข้าสู่ระบบก่อน';
    }
  });

  Object.assign(window, {
    loadCatalog,
    filterCategory,
    showMoreProducts,
    openBuyModal,
    closeBuyModal,
    updatePurchaseTotal,
    executePurchase,
    switchMainTab,
    loadPurchaseHistory,
    openHistoryDetail,
    refreshOrder,
    closeDetailModal,
    copyDetailContent,
    loadSupplierProfile
  });
})();
