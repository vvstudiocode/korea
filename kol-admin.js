/**
 * KOL 團購主後台管理系統
 */

const GAS_API_URL = 'https://script.google.com/macros/s/AKfycby7V5VwHfn_Tb-wpg_SSrme2c2P5bin6qjhxEkr80RDLg6p5TPn2EXySkpG9qnyvfNF/exec';

// 狀態變數
let kolStoreId = '';
let kolToken = '';
let kolStoreInfo = {};
let kolProducts = [];
let kolOrders = [];
let availableProducts = [];

// ============================================================
// 初始化
// ============================================================

document.addEventListener('DOMContentLoaded', () => {
    // 檢查是否已登入
    const savedToken = sessionStorage.getItem('kolToken');
    const savedStoreId = sessionStorage.getItem('kolStoreId');
    if (savedToken && savedStoreId) {
        kolToken = savedToken;
        kolStoreId = savedStoreId;
        kolStoreInfo = JSON.parse(sessionStorage.getItem('kolStoreInfo') || '{}');
        showDashboard();
    }
});

// ============================================================
// 工具函數
// ============================================================

function showToast(message, type = 'info', duration = 3000) {
    const container = document.getElementById('toastContainer');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.style.cssText = `
        padding: 12px 20px;
        margin-bottom: 10px;
        border-radius: 8px;
        color: white;
        font-weight: 500;
        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        animation: slideIn 0.3s ease;
        cursor: pointer;
        max-width: 350px;
    `;

    const colors = {
        success: '#28a745',
        error: '#dc3545',
        warning: '#ffc107',
        info: '#17a2b8'
    };
    toast.style.backgroundColor = colors[type] || colors.info;
    if (type === 'warning') toast.style.color = '#333';

    toast.textContent = message;
    toast.onclick = () => toast.remove();

    container.appendChild(toast);

    setTimeout(() => {
        toast.style.animation = 'slideOut 0.3s ease';
        setTimeout(() => toast.remove(), 300);
    }, duration);
}

function formatCurrency(num) {
    return 'NT$ ' + (Number(num) || 0).toLocaleString();
}

function openModal(id) {
    document.getElementById(id).classList.add('active');
}

function closeModal(id) {
    document.getElementById(id).classList.remove('active');
}

// API 呼叫
function callKolApi(subAction, payload = {}) {
    return fetch(GAS_API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({
            action: 'kolAction',
            subAction: subAction,
            storeId: kolStoreId,
            token: kolToken,
            ...payload
        })
    }).then(res => res.json());
}

// ============================================================
// 登入/登出
// ============================================================

async function handleKolLogin() {
    const storeIdInput = document.getElementById('kolStoreId');
    const passwordInput = document.getElementById('kolPassword');
    const errorMsg = document.getElementById('loginError');
    const loginBtn = document.getElementById('loginBtn');

    const storeId = storeIdInput.value.trim();
    const password = passwordInput.value;

    if (!storeId || !password) {
        errorMsg.textContent = '請輸入賣場 ID 和密碼';
        return;
    }

    loginBtn.disabled = true;
    loginBtn.textContent = '登入中...';
    errorMsg.textContent = '';

    try {
        const response = await fetch(GAS_API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'text/plain;charset=utf-8' },
            body: JSON.stringify({
                action: 'kolAction',
                subAction: 'kolLogin',
                storeId: storeId,
                password: password
            })
        });

        const data = await response.json();

        if (data.success) {
            kolStoreId = storeId;
            kolToken = data.data.token;
            kolStoreInfo = data.data.store;

            // 儲存到 session
            sessionStorage.setItem('kolStoreId', kolStoreId);
            sessionStorage.setItem('kolToken', kolToken);
            sessionStorage.setItem('kolStoreInfo', JSON.stringify(kolStoreInfo));

            showDashboard();
        } else {
            errorMsg.textContent = data.error || '登入失敗';
        }
    } catch (err) {
        errorMsg.textContent = '連線錯誤，請稍後再試';
        console.error(err);
    } finally {
        loginBtn.disabled = false;
        loginBtn.textContent = '登入';
    }
}

function kolLogout() {
    sessionStorage.removeItem('kolStoreId');
    sessionStorage.removeItem('kolToken');
    sessionStorage.removeItem('kolStoreInfo');
    kolStoreId = '';
    kolToken = '';
    kolStoreInfo = {};

    document.getElementById('dashboardPage').style.display = 'none';
    document.getElementById('loginPage').style.display = 'flex';
}

// ============================================================
// 主控台
// ============================================================

function showDashboard() {
    document.getElementById('loginPage').style.display = 'none';
    document.getElementById('dashboardPage').style.display = 'flex';

    // 設定 Header
    document.getElementById('storeNameHeader').textContent = kolStoreInfo.storeName || '我的賣場';
    document.getElementById('storeUrlLink').href = `https://vvstudiocode.github.io/korea/index.html?store=${kolStoreId}`;

    // 套用主題色
    if (kolStoreInfo.themeColor) {
        document.documentElement.style.setProperty('--primary-color', kolStoreInfo.themeColor);
    }

    // 載入儀表板資料
    // 載入儀表板資料
    loadDashboardData();

    // 初始化排版編輯器 (如果有的話)
    if (typeof PageBuilder !== 'undefined') {
        PageBuilder.init(kolStoreId);
    }
}

function kolSwitchTab(tabId) {
    document.querySelectorAll('.nav-links li').forEach(li => li.classList.remove('active'));
    document.querySelector(`#tab-${tabId}`).classList.add('active');

    document.querySelectorAll('.view-section').forEach(view => view.style.display = 'none');

    if (tabId === 'dashboard') {
        document.getElementById('dashboardView').style.display = 'block';
        document.getElementById('pageTitle').textContent = '業績總覽';
        loadDashboardData();
    } else if (tabId === 'products') {
        document.getElementById('productsView').style.display = 'block';
        document.getElementById('pageTitle').textContent = '我的商品';
        loadMyProducts();
    } else if (tabId === 'orders') {
        document.getElementById('ordersView').style.display = 'block';
        document.getElementById('pageTitle').textContent = '訂單管理';
        loadKolOrders();
    } else if (tabId === 'stats') {
        document.getElementById('statsView').style.display = 'block';
        document.getElementById('pageTitle').textContent = '業績統計';
        initStatsMonthSelect();
    } else if (tabId === 'settings') {
        document.getElementById('settingsView').style.display = 'block';
        document.getElementById('pageTitle').textContent = '店舖設定';
        document.getElementById('pageTitle').textContent = '店舖設定';
        loadProfileSettings();
    } else if (tabId === 'layout') {
        document.getElementById('builderSection').style.display = 'block';
        document.getElementById('pageTitle').textContent = '排版管理';
        // PageBuilder.init 已經在 login 時呼叫過，這裡不需要重新 init
        // 但如果有 resize 需求，可在此觸發
        window.dispatchEvent(new Event('resize'));
    }
}

function toggleMobileSidebar() {
    const sidebar = document.querySelector('.sidebar');
    sidebar.classList.toggle('active');
}

// ============================================================
// 業績總覽
// ============================================================

async function loadDashboardData() {
    try {
        const result = await callKolApi('kolGetDashboard');
        if (result.success && result.data) {
            const { stats, recentOrders } = result.data;

            // 更新統計卡片
            document.getElementById('dashRevenue').textContent = formatCurrency(stats.totalRevenue || 0);
            document.getElementById('dashCost').textContent = formatCurrency(stats.totalCost || 0);
            document.getElementById('dashProfit').textContent = formatCurrency(stats.grossProfit || 0);
            document.getElementById('dashOrders').textContent = stats.orderCount || 0;

            // 更新最近訂單
            renderRecentOrders(recentOrders || []);
        }
    } catch (err) {
        console.error('載入儀表板失敗', err);
    }
}

function renderRecentOrders(orders) {
    const tbody = document.getElementById('recentOrdersBody');
    if (orders.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" style="text-align:center">目前沒有訂單</td></tr>';
        return;
    }

    tbody.innerHTML = orders.map(o => `
        <tr>
            <td>${o.orderId}</td>
            <td>${o.customerName}</td>
            <td>${formatCurrency(o.total)}</td>
            <td><span class="status-badge status-${o.status === '已完成' ? 'done' : 'pending'}">${o.status}</span></td>
            <td>${o.date || '-'}</td>
        </tr>
    `).join('');
}

// ============================================================
// 我的商品
// ============================================================

async function loadMyProducts() {
    const tbody = document.getElementById('myProductsBody');
    tbody.innerHTML = '<tr><td colspan="8" style="text-align:center">載入中...</td></tr>';

    try {
        const result = await callKolApi('kolGetMyProducts');
        if (result.success && result.data) {
            kolProducts = result.data.products || [];
            renderMyProducts(kolProducts);
        }
    } catch (err) {
        tbody.innerHTML = '<tr><td colspan="8" style="text-align:center; color:red;">載入失敗</td></tr>';
    }
}

function renderMyProducts(products) {
    const tbody = document.getElementById('myProductsBody');
    if (products.length === 0) {
        tbody.innerHTML = '<tr><td colspan="8" style="text-align:center">尚未新增商品，點擊上方按鈕開始選品</td></tr>';
        return;
    }

    tbody.innerHTML = products.map(p => {
        const profit = (p.customPrice || 0) - (p.wholesalePrice || 0);
        const imageUrl = (p.image || '').split(',')[0].trim() || 'https://via.placeholder.com/50';
        const typeTag = p.type === 'own' ? '<span class="tag tag-own">自建</span>' : '';

        return `
        <tr>
            <td><img src="${imageUrl}" class="table-thumb"></td>
            <td>${p.name} ${typeTag}</td>
            <td style="color:#888;">${formatCurrency(p.wholesalePrice)}</td>
            <td style="font-weight:600;">${formatCurrency(p.customPrice)}</td>
            <td style="color:#28a745; font-weight:500;">${formatCurrency(profit)}</td>
            <td>${p.availableStock}</td>
            <td>${p.soldQty || 0}</td>
            <td>
                <button class="action-btn" onclick="editProductPrice('${p.id}')">改價</button>
                <button class="action-btn btn-danger" onclick="removeProduct('${p.id}')">下架</button>
            </td>
        </tr>
        `;
    }).join('');
}

// 從商品庫選品
async function openProductPicker() {
    const grid = document.getElementById('pickerProductGrid');
    grid.innerHTML = '<p style="text-align:center">載入商品中...</p>';

    openModal('productPickerModal');

    try {
        const result = await callKolApi('kolGetProducts');
        if (result.success && result.data) {
            availableProducts = result.data.products || [];
            renderPickerProducts(availableProducts);
        }
    } catch (err) {
        grid.innerHTML = '<p style="color:red;">載入失敗</p>';
    }
}

function filterPickerProducts() {
    const searchTerm = document.getElementById('pickerSearchInput').value.toLowerCase();
    const filtered = availableProducts.filter(p =>
        p.name.toLowerCase().includes(searchTerm) ||
        (p.category || '').toLowerCase().includes(searchTerm)
    );
    renderPickerProducts(filtered);
}

function renderPickerProducts(products) {
    const grid = document.getElementById('pickerProductGrid');
    if (products.length === 0) {
        grid.innerHTML = '<p style="text-align:center">沒有可選商品</p>';
        return;
    }

    grid.innerHTML = products.map(p => {
        const imageUrl = (p.image || '').split(',')[0].trim() || 'https://via.placeholder.com/100';
        const alreadyAdded = kolProducts.some(kp => kp.id === p.id);

        return `
        <div class="product-card ${alreadyAdded ? 'disabled' : ''}" onclick="${alreadyAdded ? '' : `selectProduct('${p.id}')`}">
            <img src="${imageUrl}" class="product-card-img">
            <div class="product-card-info">
                <h4>${p.name}</h4>
                <p class="price">建議售價: ${formatCurrency(p.price)}</p>
                <p class="wholesale">批發價: ${formatCurrency(p.wholesalePrice)}</p>
                ${alreadyAdded ? '<span class="badge">已新增</span>' : ''}
            </div>
        </div>
        `;
    }).join('');
}

function selectProduct(productId) {
    const product = availableProducts.find(p => p.id === productId);
    if (!product) return;

    closeModal('productPickerModal');

    // 開啟設定價格 Modal
    document.getElementById('priceProductId').value = productId;
    document.getElementById('priceProductInfo').innerHTML = `
        <strong>${product.name}</strong>
        <p>${product.description || ''}</p>
    `;
    document.getElementById('priceWholesale').textContent = formatCurrency(product.wholesalePrice);
    document.getElementById('priceCustom').value = product.price; // 預設用建議售價
    updateProfitPreview();

    document.getElementById('priceCustom').oninput = updateProfitPreview;

    openModal('setPriceModal');
}

function updateProfitPreview() {
    const productId = document.getElementById('priceProductId').value;
    const product = availableProducts.find(p => p.id === productId);
    if (!product) return;

    const customPrice = parseInt(document.getElementById('priceCustom').value) || 0;
    const profit = customPrice - (product.wholesalePrice || 0);
    document.getElementById('priceProfit').textContent = formatCurrency(profit);
    document.getElementById('priceProfit').style.color = profit >= 0 ? '#28a745' : '#dc3545';
}

async function confirmAddProduct() {
    const productId = document.getElementById('priceProductId').value;
    const customPrice = parseInt(document.getElementById('priceCustom').value) || 0;

    if (customPrice <= 0) {
        showToast('請輸入有效的售價', 'warning');
        return;
    }

    try {
        const result = await callKolApi('kolAddProduct', { productId, customPrice });
        if (result.success) {
            showToast('商品已新增到我的賣場', 'success');
            closeModal('setPriceModal');
            loadMyProducts();
        } else {
            showToast('新增失敗: ' + result.error, 'error');
        }
    } catch (err) {
        showToast('新增失敗', 'error');
    }
}

async function editProductPrice(productId) {
    const product = kolProducts.find(p => p.id === productId);
    if (!product) return;

    const newPrice = prompt(`設定「${product.name}」的售價:`, product.customPrice);
    if (newPrice === null) return;

    const price = parseInt(newPrice);
    if (isNaN(price) || price <= 0) {
        showToast('請輸入有效的價格', 'warning');
        return;
    }

    try {
        const result = await callKolApi('kolUpdateProduct', { productId, customPrice: price });
        if (result.success) {
            showToast('售價已更新', 'success');
            loadMyProducts();
        } else {
            showToast('更新失敗', 'error');
        }
    } catch (err) {
        showToast('更新失敗', 'error');
    }
}

async function removeProduct(productId) {
    if (!confirm('確定要下架此商品嗎？')) return;

    try {
        const result = await callKolApi('kolRemoveProduct', { productId });
        if (result.success) {
            showToast('商品已下架', 'success');
            loadMyProducts();
        } else {
            showToast('下架失敗', 'error');
        }
    } catch (err) {
        showToast('下架失敗', 'error');
    }
}

function openCreateOwnProduct() {
    showToast('自建商品功能開發中...', 'info');
}

// ============================================================
// 訂單管理
// ============================================================

async function loadKolOrders() {
    const tbody = document.getElementById('kolOrdersBody');
    tbody.innerHTML = '<tr><td colspan="7" style="text-align:center">載入中...</td></tr>';

    try {
        const result = await callKolApi('kolGetOrders');
        if (result.success && result.data) {
            kolOrders = result.data.orders || [];
            renderKolOrders(kolOrders);
        }
    } catch (err) {
        tbody.innerHTML = '<tr><td colspan="7" style="text-align:center; color:red;">載入失敗</td></tr>';
    }
}

function filterKolOrders() {
    const searchTerm = document.getElementById('kolOrderSearch').value.toLowerCase();
    const statusFilter = document.getElementById('kolOrderStatus').value;

    const filtered = kolOrders.filter(o => {
        const matchSearch = !searchTerm ||
            o.orderId.toLowerCase().includes(searchTerm) ||
            (o.customerName || '').toLowerCase().includes(searchTerm);
        const matchStatus = !statusFilter || o.status === statusFilter;
        return matchSearch && matchStatus;
    });

    renderKolOrders(filtered);
}

function renderKolOrders(orders) {
    const tbody = document.getElementById('kolOrdersBody');
    if (orders.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" style="text-align:center">沒有訂單</td></tr>';
        return;
    }

    tbody.innerHTML = orders.map(o => {
        const items = (o.items || []).map(i => `${i.name} x${i.qty}`).join(', ');
        return `
        <tr>
            <td>${o.orderId}</td>
            <td>${o.date || '-'}</td>
            <td>${o.customerName}</td>
            <td>${o.customerPhone}</td>
            <td style="max-width:200px; overflow:hidden; text-overflow:ellipsis;">${items}</td>
            <td>${formatCurrency(o.total)}</td>
            <td><span class="status-badge">${o.status}</span></td>
        </tr>
        `;
    }).join('');
}

// ============================================================
// 業績統計
// ============================================================

function initStatsMonthSelect() {
    const select = document.getElementById('kolStatsMonth');
    select.innerHTML = '';

    const now = new Date();
    for (let i = 0; i < 12; i++) {
        const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const year = date.getFullYear();
        const month = date.getMonth() + 1;
        const label = `${year}年${month}月`;
        const value = `${year}-${String(month).padStart(2, '0')}`;
        select.innerHTML += `<option value="${value}">${label}</option>`;
    }

    loadKolMonthlyStats();
}

async function loadKolMonthlyStats() {
    const monthValue = document.getElementById('kolStatsMonth').value;
    if (!monthValue) return;

    const [year, month] = monthValue.split('-').map(Number);
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0);

    try {
        const result = await callKolApi('kolGetStats', {
            startDate: startDate.toISOString(),
            endDate: endDate.toISOString()
        });

        if (result.success && result.data) {
            const stats = result.data.stats;

            document.getElementById('statsRevenue').textContent = formatCurrency(stats.totalRevenue || 0);
            document.getElementById('statsCost').textContent = formatCurrency(stats.totalCost || 0);
            document.getElementById('statsProfit').textContent = formatCurrency(stats.grossProfit || 0);
            document.getElementById('statsOrderCount').textContent = stats.orderCount || 0;

            // 商品排行
            renderProductRanking(stats.productStats || []);
        }
    } catch (err) {
        console.error('載入統計失敗', err);
    }
}

function renderProductRanking(products) {
    const tbody = document.getElementById('productRankingBody');
    if (products.length === 0) {
        tbody.innerHTML = '<tr><td colspan="4" style="text-align:center">本月無銷售記錄</td></tr>';
        return;
    }

    // 按銷售額排序
    products.sort((a, b) => (b.revenue || 0) - (a.revenue || 0));

    tbody.innerHTML = products.map(p => `
        <tr>
            <td>${p.name}</td>
            <td>${p.spec || '-'}</td>
            <td>${p.qty}</td>
            <td>${formatCurrency(p.revenue)}</td>
        </tr>
    `).join('');
}

// ============================================================
// 店舖設定
// ============================================================

async function loadProfileSettings() {
    try {
        const result = await callKolApi('kolGetProfile');
        if (result.success && result.data) {
            const profile = result.data;
            document.getElementById('settingsStoreId').value = profile.storeId || '';
            document.getElementById('settingsStoreName').value = profile.storeName || '';
            document.getElementById('settingsOwnerName').value = profile.ownerName || '';
            document.getElementById('settingsPhone').value = profile.phone || '';
            document.getElementById('settingsEmail').value = profile.email || '';
            document.getElementById('settingsThemeColor').value = profile.themeColor || '#6366f1';
            document.getElementById('settingsThemeColorPicker').value = profile.themeColor || '#6366f1';
            document.getElementById('settingsBankAccount').value = profile.bankAccount || '';

            // 顏色選擇器同步
            document.getElementById('settingsThemeColorPicker').oninput = function () {
                document.getElementById('settingsThemeColor').value = this.value;
            };
            document.getElementById('settingsThemeColor').oninput = function () {
                const color = this.value;
                if (/^#[0-9A-Fa-f]{6}$/.test(color)) {
                    document.getElementById('settingsThemeColorPicker').value = color;
                }
            };
        } else {
            showToast('載入資料失敗', 'error');
        }
    } catch (err) {
        console.error('載入設定失敗', err);
        showToast('載入設定失敗', 'error');
    }
}

async function handleProfileUpdate(event) {
    event.preventDefault();

    const profileData = {
        storeName: document.getElementById('settingsStoreName').value.trim(),
        ownerName: document.getElementById('settingsOwnerName').value.trim(),
        phone: document.getElementById('settingsPhone').value.trim(),
        email: document.getElementById('settingsEmail').value.trim(),
        themeColor: document.getElementById('settingsThemeColor').value.trim(),
        bankAccount: document.getElementById('settingsBankAccount').value.trim()
    };

    const btn = event.target.querySelector('button[type="submit"]');
    btn.disabled = true;
    btn.textContent = '儲存中...';

    try {
        const result = await callKolApi('kolUpdateProfile', { profileData });
        if (result.success) {
            showToast('資料已更新', 'success');

            // 更新本地狀態
            kolStoreInfo.storeName = profileData.storeName;
            kolStoreInfo.themeColor = profileData.themeColor;
            sessionStorage.setItem('kolStoreInfo', JSON.stringify(kolStoreInfo));

            // 更新 header
            document.getElementById('storeNameHeader').textContent = profileData.storeName;
            if (profileData.themeColor) {
                document.documentElement.style.setProperty('--primary-color', profileData.themeColor);
            }
        } else {
            showToast('更新失敗: ' + result.error, 'error');
        }
    } catch (err) {
        showToast('更新失敗', 'error');
    } finally {
        btn.disabled = false;
        btn.textContent = '儲存變更';
    }
}

async function handlePasswordChange(event) {
    event.preventDefault();

    const currentPassword = document.getElementById('currentPassword').value;
    const newPassword = document.getElementById('newPassword').value;
    const confirmPassword = document.getElementById('confirmPassword').value;

    if (newPassword !== confirmPassword) {
        showToast('新密碼與確認密碼不一致', 'warning');
        return;
    }

    if (newPassword.length < 6) {
        showToast('新密碼至少需要 6 個字元', 'warning');
        return;
    }

    const btn = event.target.querySelector('button[type="submit"]');
    btn.disabled = true;
    btn.textContent = '更新中...';

    try {
        const result = await callKolApi('kolChangePassword', { currentPassword, newPassword });
        if (result.success) {
            showToast('密碼已更新，請重新登入', 'success');
            document.getElementById('passwordForm').reset();

            // 登出讓使用者重新登入
            setTimeout(() => {
                kolLogout();
            }, 2000);
        } else {
            showToast('更新失敗: ' + result.error, 'error');
        }
    } catch (err) {
        showToast('更新失敗', 'error');
    } finally {
        btn.disabled = false;
        btn.textContent = '更新密碼';
    }
}
