/**
 * CMS Admin Logic V4.0 (Site Generator Support)
 * Rule #17 可擴展性: 支援動態 API URL 設定
 */

/**
 * 預設 GAS API URL (總部)
 */
const DEFAULT_GAS_API_URL = 'https://script.google.com/macros/s/AKfycby7V5VwHfn_Tb-wpg_SSrme2c2P5bin6qjhxEkr80RDLg6p5TPn2EXySkpG9qnyvfNF/exec';

/**
 * 動態 API URL - 優先使用 SITE_CONFIG (由生成器注入)
 */
const GAS_API_URL = (typeof window !== 'undefined' && window.SITE_CONFIG?.apiUrl) || DEFAULT_GAS_API_URL;

// Global State Variables
let currentPassword = '';
let currentOrders = [];
let currentProducts = [];

// Debug: Check which API is being used
if (typeof window !== 'undefined') {
    console.group('🔧 Admin Config Status');
    if (window.SITE_CONFIG) {
        console.log('✅ Using SITE_CONFIG API');
        console.log('Site ID:', window.SITE_CONFIG.siteId || window.SITE_CONFIG.id);
        console.log('API URL:', window.SITE_CONFIG.apiUrl);
    } else {
        console.warn('⚠️ No SITE_CONFIG found - Using DEFAULT/HEADQUARTERS API');
        console.log('Default API:', DEFAULT_GAS_API_URL);
    }
    console.log('Start Password:', currentPassword ? 'Loaded' : 'Empty');
    console.groupEnd();
}


// 批次更新暫存
let pendingUpdates = {}; // Order Updates
let pendingProductUpdates = []; // Product Updates (Array of objects)

// 初始化
document.addEventListener('DOMContentLoaded', () => {
    const savedPassword = sessionStorage.getItem('adminPassword');
    if (savedPassword) {
        currentPassword = savedPassword;
        showDashboard();
    }

    // 綁定自動計算事件
    document.getElementById('prodPriceKrw').addEventListener('input', calculateInlineCost);
    document.getElementById('prodExchangeRate').addEventListener('input', calculateInlineCost);

    // Update Sidebar Title to Site ID
    if (window.SITE_CONFIG && (window.SITE_CONFIG.siteId || window.SITE_CONFIG.id)) {
        const sidebarHeader = document.querySelector('.sidebar-header h3');
        if (sidebarHeader) {
            sidebarHeader.textContent = (window.SITE_CONFIG.siteId || window.SITE_CONFIG.id).toUpperCase() + ' ADMIN';
        }
    }
});

// Toast 通知系統
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

    // 根據類型設定顏色
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

function showLoadingOverlay() {
    let loadingOverlay = document.getElementById('loadingOverlay');
    if (!loadingOverlay) {
        loadingOverlay = document.createElement('div');
        loadingOverlay.id = 'loadingOverlay';
        loadingOverlay.className = 'loading-overlay';

        // 使用 CSS Spinner，確保後台樣式正確
        loadingOverlay.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(255, 255, 255, 0.8);
            z-index: 9999;
            display: flex;
            justify-content: center;
            align-items: center;
            flex-direction: column;
        `;

        loadingOverlay.innerHTML = `
            <div class="spinner" style="
                width: 40px; 
                height: 40px; 
                border: 4px solid #f3f3f3; 
                border-top: 4px solid #3498db; 
                border-radius: 50%; 
                animation: adminSpin 1s linear infinite;">
            </div>
            <style>
                @keyframes adminSpin {
                    0% { transform: rotate(0deg); }
                    100% { transform: rotate(360deg); }
                }
            </style>
        `;
        document.body.appendChild(loadingOverlay);
    }
    loadingOverlay.style.display = 'flex';
}

function hideLoadingOverlay() {
    const loadingOverlay = document.getElementById('loadingOverlay');
    if (loadingOverlay) {
        loadingOverlay.style.display = 'none';
    }
}

function handleLogin() {
    const passwordInput = document.getElementById('adminPassword');
    const password = passwordInput.value.trim();
    const errorMsg = document.getElementById('loginError');
    const loginBtn = document.getElementById('loginBtn');

    if (!password) { errorMsg.textContent = '請輸入密碼'; return; }

    loginBtn.disabled = true;
    loginBtn.textContent = '驗證中...';
    errorMsg.textContent = '';

    callApi('login', { password: password })
        .then(data => {
            if (data.success) {
                currentPassword = password;
                sessionStorage.setItem('adminPassword', password);
                showDashboard();
            } else {
                errorMsg.textContent = '密碼錯誤';
            }
        })
        .catch(err => errorMsg.textContent = '連線錯誤')
        .finally(() => {
            loginBtn.disabled = false;
            loginBtn.textContent = '登入';
        });
}

function callApi(subAction, payload = {}) {
    return fetch(GAS_API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({
            action: 'adminAction',
            subAction: subAction,
            password: currentPassword || payload.password,
            ...payload
        })
    }).then(res => res.json());
}

function logout() {
    sessionStorage.removeItem('adminPassword');
    currentPassword = '';
    document.getElementById('dashboardPage').style.display = 'none';
    document.getElementById('loginPage').style.display = 'flex';
}

function showDashboard() {
    document.getElementById('loginPage').style.display = 'none';
    document.getElementById('dashboardPage').style.display = 'flex';
    refreshData();
}

function switchTab(tabId) {
    document.querySelectorAll('.nav-links li').forEach(li => li.classList.remove('active'));
    document.querySelector(`#tab-${tabId}`).classList.add('active');

    document.querySelectorAll('.view-section').forEach(view => view.style.display = 'none');

    document.getElementById('batchActions').style.display = (tabId === 'orders') ? 'flex' : 'none';

    if (tabId === 'dashboard') {
        document.getElementById('dashboardView').style.display = 'block';
        document.getElementById('pageTitle').textContent = '總覽報表';
    } else if (tabId === 'orders') {
        document.getElementById('ordersView').style.display = 'block';
        document.getElementById('pageTitle').textContent = '訂單管理';
        renderOrders(currentOrders);
        updateBatchUI();

        // 確保商品列表已載入（新增訂單需要）
        if (currentProducts.length === 0) {
            fetchProducts();
        }

    } else if (tabId === 'products') {
        document.getElementById('productsView').style.display = 'block';
        document.getElementById('pageTitle').textContent = '商品管理';
        if (currentProducts.length === 0) fetchProducts();
        else renderProducts(currentProducts);
        updateProductBatchUI();
    } else if (tabId === 'builder') {
        document.getElementById('builderSection').style.display = 'block';
        document.getElementById('pageTitle').textContent = '首頁排版管理';
        if (typeof PageBuilder !== 'undefined') {
            if (!PageBuilder._hasStarted) {
                PageBuilder.init();
                PageBuilder._hasStarted = true;
            } else {
                // 如果已經初始化過，只需確保預覽正確渲染
                PageBuilder.renderPreview();
            }
        }
    } else if (tabId === 'purchasing') {
        document.getElementById('purchasingView').style.display = 'block';
        document.getElementById('pageTitle').textContent = '採買統計';
        document.getElementById('batchActions').style.display = 'none';

        // 初始化日期 (預設今天)
        const today = new Date().toISOString().split('T')[0];
        if (!document.getElementById('statsStartDate').value) {
            document.getElementById('statsStartDate').value = today;
            document.getElementById('statsEndDate').value = today;
        }
        loadPurchasingStats();
    } else if (tabId === 'sitegenerator') {
        document.getElementById('siteGeneratorView').style.display = 'block';
        document.getElementById('pageTitle').textContent = '網站生成器';
        document.getElementById('batchActions').style.display = 'none';
        loadGeneratedSites();
    } else if (tabId === 'settings') {
        document.getElementById('settingsView').style.display = 'block';
        document.getElementById('pageTitle').textContent = '網站設定';
        document.getElementById('batchActions').style.display = 'none';
        loadSettings();
    }

    // 手機版：選完分頁後自動收起側邊欄
    if (window.innerWidth <= 1024) {
        closeMobileSidebar();
    }
}

function toggleMobileSidebar() {
    const sidebar = document.querySelector('.sidebar');
    const overlay = document.querySelector('.sidebar-overlay');

    sidebar.classList.toggle('active');
    if (overlay) overlay.classList.toggle('active');
    document.body.classList.toggle('sidebar-open');
}

function closeMobileSidebar() {
    const sidebar = document.querySelector('.sidebar');
    const overlay = document.querySelector('.sidebar-overlay');

    if (sidebar) sidebar.classList.remove('active');
    if (overlay) overlay.classList.remove('active');
    document.body.classList.remove('sidebar-open');
}

function refreshData(startDate = null, endDate = null) {
    const payload = {};
    if (startDate) payload.startDate = startDate;
    if (endDate) payload.endDate = endDate;

    callApi('getDashboardData', payload)
        .then(data => {
            if (data.success) {
                currentOrders = data.data.orders;
                updateDashboardStats(data.data.stats);
                renderOrders(currentOrders);
                pendingUpdates = {};
                updateBatchUI();
            } else {
                if (data.error === '密碼錯誤') logout();
            }
        })
        .catch(console.error);
}

function updateDashboardStats(stats) {
    document.getElementById('statRevenue').textContent = formatCurrency(stats.totalRevenue);
    document.getElementById('statCost').textContent = formatCurrency(stats.totalCost);
    document.getElementById('statProfit').textContent = formatCurrency(stats.grossProfit);
    document.getElementById('statOrders').textContent = stats.totalOrders;
    document.getElementById('statPending').textContent = stats.pendingOrders;

    // 計算毛利率
    const profitMargin = stats.totalRevenue > 0
        ? ((stats.grossProfit / stats.totalRevenue) * 100).toFixed(1)
        : 0;
    document.getElementById('statProfitMargin').textContent = `毛利率: ${profitMargin}%`;
}

// 日期篩選
// Custom Date Filter Handler
function applyDashboardCustomDate() {
    const startVal = document.getElementById('dashStartDate').value;
    const endVal = document.getElementById('dashEndDate').value;

    if (!startVal || !endVal) {
        alert('請選擇開始與結束日期');
        return;
    }

    // Parse as local dates
    const startDate = new Date(startVal);
    startDate.setHours(0, 0, 0, 0);

    // Set end date to end of day
    const endDate = new Date(endVal);
    endDate.setHours(23, 59, 59, 999);

    if (startDate > endDate) {
        alert('結束日期不能早於開始日期');
        return;
    }

    updateDashboardStats(startDate, endDate);
}

// 日期篩選
function filterDashboardByDate(range) {
    const customDates = document.getElementById('dashboardCustomDates');

    if (range === 'custom') {
        customDates.style.display = 'flex';
        // Initialize inputs with current month if empty
        if (!document.getElementById('dashStartDate').value) {
            const now = new Date();
            const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
            const today = new Date();
            document.getElementById('dashStartDate').value = firstDay.toISOString().split('T')[0];
            document.getElementById('dashEndDate').value = today.toISOString().split('T')[0];
        }
        return; // Wait for user to click search
    } else {
        customDates.style.display = 'none';
    }

    let startDate = null;
    let endDate = null;
    const now = new Date();

    switch (range) {
        case 'today':
            startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
            endDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);
            break;
        case 'week':
            startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
            startDate.setHours(0, 0, 0, 0);
            endDate = now;
            break;
        case 'month':
            startDate = new Date(now.getFullYear(), now.getMonth(), 1);
            endDate = now;
            break;
        case 'year':
            startDate = new Date(now.getFullYear(), 0, 1);
            endDate = now;
            break;
        case 'all':
        default:
            startDate = null;
            endDate = null;
            break;
    }

    // 格式化日期為 YYYY-MM-DD
    const formatDate = (date) => {
        if (!date) return null;
        return date.getFullYear() + '-' +
            String(date.getMonth() + 1).padStart(2, '0') + '-' +
            String(date.getDate()).padStart(2, '0');
    };

    refreshData(formatDate(startDate), formatDate(endDate));
}


// ----------------------
// 訂單管理
// ----------------------

function getStoreName(storeId) {
    if (!storeId) return '';
    return storeId; // 賣場管理功能已移除，直接返回 ID
}

function renderOrders(orders) {
    const tbody = document.getElementById('ordersTableBody');
    if (orders.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" class="empty-cell">目前沒有訂單</td></tr>';
        return;
    }

    tbody.innerHTML = orders.map(order => {
        const pending = pendingUpdates[order.orderId];
        const displayStatus = (pending && pending.status) ? pending.status : order.status;
        const isModified = !!pending;

        // 訂單來源標記
        let sourceIcon = '';
        let sourceTitle = '';
        if (order.orderSource === 'customer') {
            sourceIcon = '🛒';
            sourceTitle = '客戶訂單';
        } else if (order.orderSource === 'manual') {
            sourceIcon = '✍️';
            sourceTitle = '手動建單';
        } else if (order.orderSource === 'kol') {
            sourceIcon = '👥';
            sourceTitle = '團購訂單';
        }

        const statusOptions = ['待處理', '已確認', '已出貨', '已完成', '已取消', '取消']
            .map(s => `<option value="${s}" ${s === displayStatus ? 'selected' : ''}>${s}</option>`)
            .join('');

        return `
        <tr class="${isModified ? 'row-modified' : ''}" onclick="toggleRowDetails('${order.orderId}')" style="cursor:pointer;">
            <td><span title="${sourceTitle}">${sourceIcon}</span> ${order.orderId}</td>
            <td onclick="event.stopPropagation()">
                <select onchange="markOrderUpdated('${order.orderId}', 'status', this.value)" 
                        style="padding: 5px; border-radius: 4px; border: 1px solid #ddd; background: ${getStatusColor(displayStatus)}">
                    ${statusOptions}
                </select>
                ${isModified ? '<span style="color:red; font-size:12px; margin-left:5px;">*</span>' : ''}
            </td>
            <td>${order.date}</td>
            <td>${order.customerName}</td>
            <td>${order.shippingMethod || '-'}</td>
            <td>${formatCurrency(order.total)}</td>
            <td onclick="event.stopPropagation()">
                <div style="display:flex; gap:5px;">
                    <button class="action-btn" onclick="openOrderDetail('${order.orderId}')">編輯</button>
                    <button class="action-btn btn-danger" onclick="confirmDeleteOrder('${order.orderId}')">刪除</button>
                </div>
            </td>
        </tr>
        <tr id="details-${order.orderId}" style="display:none; background-color:#f8f9fa;">
            <td colspan="7">
                <div style="padding: 15px;">
                    <strong>商品明細：</strong>
                    <ul style="margin: 10px 0; padding-left: 20px;">
                        ${(order.items || []).map(item => `
                            <li>${item.name} ${item.spec ? `(${item.spec})` : ''} x ${item.qty} - ${formatCurrency(item.subtotal)}</li>
                        `).join('')}
                    </ul>
                    <div style="margin-top: 10px; display:flex; gap: 20px;">
                        <span><strong>電話:</strong> ${order.customerPhone || '-'}</span>
                        <span><strong>運費:</strong> ${order.shippingFee || 0}</span>
                        <span><strong>備註:</strong> ${order.note || '無'}</span>
                    </div>
                    ${order.storeName ? `<div style="margin-top: 5px;"><strong>門市:</strong> ${order.storeName} (${order.storeCode})</div>` : ''}
                    ${order.storeAddress ? `<div style="margin-top: 5px;"><strong>地址:</strong> ${order.storeAddress}</div>` : ''}
                    ${order.storeId ? `<div style="margin-top: 5px; color: #e91e63;"><strong>KOL:</strong> ${getStoreName(order.storeId)}</div>` : ''}
                </div>
            </td>
        </tr>
    `}).join('');
}

function toggleRowDetails(orderId) {
    const row = document.getElementById(`details-${orderId}`);
    if (row) {
        row.style.display = row.style.display === 'none' ? 'table-row' : 'none';
    }
}

// 訂單搜尋/篩選
function filterOrders() {
    const searchTerm = document.getElementById('orderSearchInput').value.toLowerCase();
    const statusFilter = document.getElementById('orderStatusFilter').value;

    const filtered = currentOrders.filter(order => {
        // 搜尋條件
        const matchSearch = !searchTerm ||
            order.orderId.toLowerCase().includes(searchTerm) ||
            (order.customerName || '').toLowerCase().includes(searchTerm) ||
            String(order.customerPhone || '').toLowerCase().includes(searchTerm);

        // 狀態篩選
        const matchStatus = !statusFilter || order.status === statusFilter;

        return matchSearch && matchStatus;
    });

    renderOrders(filtered);
}

// 商品搜尋
function filterProductsList() {
    const searchTerm = document.getElementById('productSearchInput').value.toLowerCase();

    const filtered = currentProducts.filter(product => {
        return !searchTerm ||
            (product.name || '').toLowerCase().includes(searchTerm) ||
            (product.category || '').toLowerCase().includes(searchTerm) ||
            (product.brand || '').toLowerCase().includes(searchTerm);
    });

    renderProducts(filtered);
}

function getStatusColor(status) {
    if (status === '待處理') return '#fff3cd';
    if (status === '已確認') return '#d1e7dd';
    if (status === '已出貨') return '#cff4fc';
    if (status === '已完成') return '#e2e3e5';
    if (status === '已取消' || status === '取消') return '#f8d7da';
    return '#fff';
}

// 批量儲存訂單變更
// 批量儲存訂單變更 (發送到後端)
function saveBatchUpdates() {
    if (Object.keys(pendingUpdates).length === 0) {
        alert('沒有變更需要儲存');
        return;
    }

    const btn = document.getElementById('saveBatchBtn');
    if (!btn) return;

    const confirmMsg = `確定要儲存 ${Object.keys(pendingUpdates).length} 筆訂單的變更嗎？`;
    if (!confirm(confirmMsg)) return;

    btn.disabled = true;
    btn.textContent = '儲存中...';

    console.log('準備儲存的訂單變更:', pendingUpdates);

    callApi('updateOrdersBatch', { updates: pendingUpdates })
        .then(data => {
            if (data.success) {
                showToast(`成功儲存 ${Object.keys(pendingUpdates).length} 筆訂單！`, 'success');
                pendingUpdates = {}; // 清空暫存
                updateBatchUI();
                refreshData(); // 重新整理列表與統計
            } else {
                alert('儲存失敗：' + data.error);
            }
        })
        .catch(err => {
            alert('儲存失敗：' + err);
        })
        .finally(() => {
            btn.disabled = false;
            btn.textContent = '💾 儲存所有變更';
        });
}

// 更新訂單批次更新 UI
function updateBatchUI() {
    const count = Object.keys(pendingUpdates).length;
    const msg = document.getElementById('unsavedChangesMsg');
    const btn = document.getElementById('saveBatchBtn');

    if (msg && btn) {
        if (count > 0) {
            msg.textContent = `⚠️ 有 ${count} 筆訂單變更未儲存`;
            btn.disabled = false;
        } else {
            msg.textContent = '';
            btn.disabled = true;
        }
    }
}

// 立即更新訂單狀態
// 暫存訂單狀態變更
function markOrderUpdated(orderId, field, value) {
    if (field !== 'status') return;

    if (!pendingUpdates[orderId]) pendingUpdates[orderId] = {};
    pendingUpdates[orderId][field] = value;

    // 觸發重新渲染以顯示標記
    renderOrders(currentOrders);
    updateBatchUI();
    showToast(`狀態變更已暫存 (${orderId})`, 'info', 1500);
}

// 移除舊的 updateBatchUI (如果只剩商品需要它)

function renderDashboard(orders = currentOrders) {
    const totalOrders = orders.length;
    const totalRevenue = orders.reduce((sum, o) => sum + (o.total || 0), 0);
    const pendingOrders = orders.filter(o => o.status === '待處理' || o.status === '編輯/詳情').length;

    document.querySelector('.stats-container').innerHTML = `
        <div class="stat-card">
            <div class="stat-value">${totalOrders}</div>
            <div class="stat-label">訂單總數</div>
        </div>
        <div class="stat-card">
            <div class="stat-value">NT$ ${formatCurrency(totalRevenue)}</div>
            <div class="stat-label">總營收</div>
        </div>
        <div class="stat-card">
            <div class="stat-value">${pendingOrders}</div>
            <div class="stat-label">待處理訂單</div>
        </div>
    `;
}

function openOrderDetail(orderId) {
    console.log('openOrderDetail called with orderId:', orderId);

    const order = currentOrders.find(o => o.orderId === orderId);
    if (!order) return;

    const pending = pendingUpdates[orderId] || {};

    currentEditingOrderId = orderId;
    tempOrderItems = order.items.map(item => ({
        name: item.name,
        spec: item.spec || '',
        qty: item.qty,
        price: item.price || (item.subtotal / item.qty),
        subtotal: item.subtotal
    }));

    document.getElementById('detailOrderId').textContent = order.orderId;

    document.getElementById('detailName').value = pending.customerName || order.customerName || '';
    document.getElementById('detailPhone').value = pending.customerPhone || order.customerPhone || '';
    document.getElementById('detailEmail').value = order.email || '';
    document.getElementById('detailLine').value = order.lineId || '';

    const shipMethod = pending.shippingMethod || order.shippingMethod || '7-11店到店'; // 預設必填
    const shipSelect = document.getElementById('detailShipping');
    shipSelect.value = shipMethod;

    if (!shipSelect.value) {
        // 如果值不在選項內，可能是舊資料問題，強制選第一個或保留
        // 這裡我們把 shipMethod 加回去或者選第一個
        shipSelect.value = '7-11店到店';
    }

    // 載入運費
    const shipFeeInput = document.getElementById('detailShippingFee');
    let loadedFee = 0;
    if (pending.shippingFee !== undefined) {
        loadedFee = pending.shippingFee;
    } else if (order.shippingFee !== undefined) {
        loadedFee = order.shippingFee;
    } else {
        // 沒有舊資料
        loadedFee = (shipMethod === '7-11店到店') ? 60 : 0;
    }

    // 用戶反饋: "因為現在初始是711但是下方的運費實際不會增加"
    // 如果是 7-11店到店 且 loadedFee 為 0，強制設為 60?
    // 但這可能會覆蓋真的免運訂單。
    // 折衷方案: 如果 loadedFee 是 0 且方法是 7-11，我們提示或者預設填 60 (如果是新訂單或資料不全)
    // 這裡我們信任：如果 order.shippingFee 存在 (即使是0)，就用它。

    // 但用戶抱怨的是初始化時沒反應。
    // 如果 order.shippingFee 確實是 undefined (舊訂單)，上面 logic 會設 60.
    // 如果 order.shippingFee 是 0 (可能來自 Google Sheet 空白被轉為 0)，那就會顯示 0.
    // 我們可以依賴用戶手動改，或者：
    if (shipMethod === '7-11店到店' && loadedFee === 0) {
        // 是否要強制更新？
        // 考慮到用戶體驗，如果是舊資料(可能運費欄位空白)，設為60比較好。
        // 但如何區分 "空白" 和 "手動0"?
        // Code.gs 裡如果是空白，可能會讀成 "" 或 0.
        // 為了方便，我們預設 7-11 就是 60，除非這是一個已經確認的免運訂單？
        // 暫時強制設為 60，讓用戶自己改 0 (如果是特例)。這比每次都要改 60 好。
        loadedFee = 60;
    }

    shipFeeInput.value = loadedFee;

    document.getElementById('detailStoreName').value = pending.storeName || order.storeName || '';
    document.getElementById('detailStoreCode').value = order.storeCode || '';
    document.getElementById('detailStoreAddress').value = pending.storeAddress || order.storeAddress || '';

    renderOrderItems();
    loadProductSuggestions();

    document.getElementById('detailNote').value = pending.note || order.note || '';

    // 編輯模式：設定最下方的按鈕
    const saveBtn = document.querySelector('#orderDetailModal .modal-actions .accent-btn');
    if (saveBtn) {
        console.log('Setting saveBtn onclick with orderId:', orderId);
        saveBtn.textContent = '確認修改 (暫存)';
        saveBtn.onclick = () => saveOrderDetailToBatch(orderId);
    }

    openModal('orderDetailModal');
}

// 儲存訂單詳情到暫存區
function saveOrderDetailToBatch(orderId) {
    const updates = {
        customerName: document.getElementById('detailName').value,
        customerPhone: document.getElementById('detailPhone').value,
        email: document.getElementById('detailEmail').value,
        lineId: document.getElementById('detailLine').value,
        shippingMethod: document.getElementById('detailShipping').value,
        shippingFee: parseInt(document.getElementById('detailShippingFee').value) || 0,
        storeName: document.getElementById('detailStoreName').value,
        storeCode: document.getElementById('detailStoreCode').value,
        storeAddress: document.getElementById('detailStoreAddress').value,
        note: document.getElementById('detailNote').value,
        items: tempOrderItems,
        total: parseInt(document.getElementById('detailTotal').textContent.replace(/[^\d]/g, '')) || 0
    };

    console.log('saveOrderDetailToBatch - updates:', updates);

    if (!pendingUpdates[orderId]) pendingUpdates[orderId] = {};
    Object.assign(pendingUpdates[orderId], updates);

    closeModal('orderDetailModal');
    updateBatchUI();
    renderOrders(currentOrders);
}

// ----------------------
// 商品管理
// ----------------------
function fetchProducts(force = false) {
    const tbody = document.getElementById('productsTableBody');
    if (!force) tbody.innerHTML = '<tr><td colspan="13" class="loading-cell">載入中...</td></tr>';

    return callApi('getProductsAdmin', { _t: Date.now() })
        .then(data => {
            if (data.success) {
                currentProducts = data.data.products;
                // 清除 pending (因為重整了) - 或者可以 merge? 這裡簡單起見先清空
                pendingProductUpdates = [];
                updateProductBatchUI();
                renderProducts(currentProducts);
            }
        });
}

// 新增：計算總庫存 (包含 variants)
function calculateTotalStock(product) {
    if (product.variants && product.variants.length > 0) {
        return product.variants.reduce((sum, v) => sum + (parseInt(v.stock) || 0), 0);
    }
    return product.stock || 0;
}

function renderProducts(products) {
    const tbody = document.getElementById('productsTableBody');

    // 合併 pendingUpdates 到顯示列表
    // 這裡我們需要知道哪些被改了
    // 簡單做法：pendingUpdates 裡的物件直接覆蓋 products 裡的 (如果 ID 相同)
    // 但 pendingUpdates 可能是 Array of changed objects.

    const displayProducts = products.map(p => {
        const pending = pendingProductUpdates.find(up => String(up.id) === String(p.id));
        return pending ? { ...p, ...pending, _isModified: true } : p;
    });

    // 也要顯示新建立的商品 (暫時只支援編輯既有，新增就簡單處理直接顯示在列表最後?)
    // 為了簡單，新增商品目前還是一樣進 Modal，Submit 後放入 Pending

    // 處理新增的 (ID 不在 currentProducts 裡的)
    pendingProductUpdates.forEach(pending => {
        if (!pending.id || !currentProducts.find(p => String(p.id) === String(pending.id))) {
            // 這是一個純新增的，且尚未有 ID (或有臨時 ID)
            // 這裡顯示會有問題，因為 ID 是後端生成的。
            // 建議：新增商品依然直接 call API (因為需要圖片上傳、ID 生成等)，或者用臨時 ID
            // 使用者需求: "編輯好之後，再統一按下儲存" -> 通常指編輯現有。
            // 新增通常比較獨立。但我們嘗試將新增也納入 pending?

            // 如果是新增，我們給一個臨時 ID (Temp...)
            if (!displayProducts.find(x => x.id === pending.id)) {
                displayProducts.push({ ...pending, _isModified: true, _isNew: true });
            }
        }
    });

    tbody.innerHTML = displayProducts.map(p => {
        // 如果有多張圖片，只顯示第一張
        const imageUrl = (p.image || "").split(',')[0].trim();

        const hasVariants = p.variants && p.variants.length > 0;
        const totalStock = calculateTotalStock(p);
        const rowStyle = hasVariants ? 'cursor:pointer;' : '';
        const clickEvent = hasVariants ? `onclick="toggleProductDetail('${p.id}')"` : '';

        // 主行 (Main Row)
        const mainRow = `
        <tr class="${p._isModified ? 'row-modified' : ''} product-main-row" data-id="${p.id}" ${clickEvent} style="${rowStyle}">
            <td style="cursor:move; text-align:center; color:#999; font-size:1.2rem;" class="drag-handle" onclick="event.stopPropagation()">⠿</td>
            <td style="font-size:0.75rem; color:#6366f1; font-family:monospace;" onclick="event.stopPropagation()">${p.id || '-'}</td>
            <td>
                <a href="https://vvstudiocode.github.io/korea/products/${p.id}/" target="_blank" onclick="event.stopPropagation()">
                    <img src="${imageUrl}" class="table-thumb" style="width:40px;height:40px;object-fit:cover;vertical-align:middle;">
                </a>
            </td>
            <td><a href="https://vvstudiocode.github.io/korea/products/${p.id}/" target="_blank" style="color:#6366f1; text-decoration:none;" onclick="event.stopPropagation()">${p.name}</a> ${p._isNew ? '(新)' : ''}</td>
            <td>${p.price}</td>
            <td style="color: #aaa; font-size:0.9em;">₩${p.priceKrw || 0}</td>
            <td style="font-weight:bold;">${totalStock}</td>
            <td onclick="event.stopPropagation()">
                <label class="toggle-switch">
                    <input type="checkbox" 
                           ${p.status === '上架' ? 'checked' : ''} 
                           onchange="toggleProductStatus('${p.id}', this.checked)">
                    <span class="toggle-slider"></span>
                </label>
                <span class="status-label ${p.status === '上架' ? 'status-active' : 'status-inactive'}">${p.status === '上架' ? '上架中' : '已下架'}</span>
            </td>
            <td>
                <div style="display:flex; gap:5px;" onclick="event.stopPropagation()">
                    <button class="action-btn" onclick="openProductModal('${p.id || ''}')">編輯</button>
                    <button class="action-btn btn-danger" onclick="confirmDeleteProduct('${p.id || ''}')">刪除</button>
                </div>
            </td>
        </tr>`;

        // 詳情行 (Detail Row) - 僅在有規格時生成
        let detailRow = '';
        if (hasVariants) {
            const detailContent = `
                <div style="padding: 10px 20px; background-color: #f8f9fa; border-left: 3px solid #6366f1;">
                    <strong>規格庫存明細：</strong>
                    <div style="display:flex; gap: 15px; flex-wrap: wrap; margin-top: 5px;">
                        ${p.variants.map(v => `<span style="background:white; padding:2px 8px; border-radius:4px; border:1px solid #ddd;">${v.spec || v.name}: <b>${v.stock}</b></span>`).join('')}
                    </div>
                </div>
            `;

            detailRow = `
            <tr id="detail-${p.id}" class="product-detail-row" style="display:none;">
                <td colspan="13" style="padding:0; border:none;">
                    ${detailContent}
                </td>
            </tr>
            `;
        }

        return mainRow + detailRow;
    }).join('');

    // 重要：將資料綁定到 DOM 元素，以便拖勒排序後能找回正確資料
    const rows = tbody.querySelectorAll('tr.product-main-row');
    rows.forEach((row, index) => {
        if (displayProducts[index]) {
            row._productData = displayProducts[index];
        }
    });

    enableProductDragAndDrop();
}

// 切換商品詳情顯示
function toggleProductDetail(productId) {
    const detailRow = document.getElementById(`detail-${productId}`);
    if (detailRow) {
        detailRow.style.display = detailRow.style.display === 'none' ? 'table-row' : 'none';
    }
}

// 快速切換商品上架/下架狀態
function toggleProductStatus(productId, isActive) {
    const newStatus = isActive ? '上架' : '下架';

    // 檢查是否已在 pending 中
    const existingIndex = pendingProductUpdates.findIndex(p => String(p.id) === String(productId));

    if (existingIndex !== -1) {
        // 更新既有的 pending 記錄
        pendingProductUpdates[existingIndex].status = newStatus;
    } else {
        // 從 currentProducts 取得完整資料
        const product = currentProducts.find(p => String(p.id) === String(productId));
        if (product) {
            pendingProductUpdates.push({
                ...product,
                status: newStatus
            });
        }
    }

    // 同時更新 currentProducts 的狀態 (本地顯示用)
    const productIndex = currentProducts.findIndex(p => String(p.id) === String(productId));
    if (productIndex !== -1) {
        currentProducts[productIndex].status = newStatus;
    }

    updateProductBatchUI();
    renderProducts(currentProducts);
    showToast(`商品狀態已變更為「${newStatus}」(暫存)`, 'info', 1500);
}

// 載入現有品牌列表 (用於自動完成)
function loadBrandList() {
    // 從 currentProducts 提取所有不重複的品牌
    const brands = new Set();

    currentProducts.forEach(p => {
        const brandStr = String(p.brand || '').trim();
        if (brandStr) {
            brands.add(brandStr);
        }
    });

    // 更新 datalist
    const datalist = document.getElementById('brandList');
    if (datalist) {
        datalist.innerHTML = Array.from(brands)
            .sort()
            .map(brand => `<option value="${brand}">`)
            .join('');
    }
}

// 商品拖曳排序變數
let dragSrcEl = null;

function enableProductDragAndDrop() {
    const rows = document.querySelectorAll('#productsTableBody tr.product-main-row');
    rows.forEach(row => {
        row.setAttribute('draggable', true);
        row.addEventListener('dragstart', handleDragStart);
        row.addEventListener('dragover', handleDragOver);
        row.addEventListener('drop', handleDrop);
        // row.addEventListener('dragenter', handleDragEnter);
        // row.addEventListener('dragleave', handleDragLeave);

        // Mobile Touch Support
        const handle = row.querySelector('.drag-handle');
        if (handle) {
            handle.addEventListener('touchstart', handleTouchStart, { passive: false });
            handle.addEventListener('touchmove', handleTouchMove, { passive: false });
            handle.addEventListener('touchend', handleTouchEnd, { passive: false });
        }
    });
}

// Mobile Touch Variables
let touchDragRow = null;

function handleTouchStart(e) {
    if (e.cancelable) e.preventDefault();
    touchDragRow = this.closest('tr');
    if (touchDragRow) {
        touchDragRow.classList.add('dragging');
        touchDragRow.style.opacity = '0.5';
        dragSrcEl = touchDragRow; // Reuse global variable if possible or just use local
    }
}

function handleTouchMove(e) {
    if (!touchDragRow) return;
    if (e.cancelable) e.preventDefault();

    const touch = e.touches[0];
    const targetElement = document.elementFromPoint(touch.clientX, touch.clientY);

    if (targetElement) {
        const targetRow = targetElement.closest('tr.product-main-row');
        if (targetRow && targetRow !== touchDragRow) {
            const rect = targetRow.getBoundingClientRect();
            // Determine insertion point
            const offset = touch.clientY - rect.top;
            if (offset > rect.height / 2) {
                targetRow.parentNode.insertBefore(touchDragRow, targetRow.nextSibling);
            } else {
                targetRow.parentNode.insertBefore(touchDragRow, targetRow);
            }
        }
    }
}

function handleTouchEnd(e) {
    if (touchDragRow) {
        touchDragRow.classList.remove('dragging');
        touchDragRow.style.opacity = '1';

        // Trigger save logic (reusing handleDrop logic)
        // Manual trigger since we skipped drop event
        const tbody = document.getElementById('productsTableBody');
        const rows = Array.from(tbody.querySelectorAll('tr.product-main-row'));
        const newProducts = rows.map(row => row._productData).filter(p => p);

        if (newProducts.length === currentProducts.length) {
            currentProducts = newProducts;
            showUnsavedSortWarning();
            renderProducts(currentProducts);
        }

        touchDragRow = null;
        dragSrcEl = null;
    }
}

function handleDragStart(e) {
    dragSrcEl = this;
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/html', this.innerHTML);
    this.classList.add('dragging');
}

function handleDragOver(e) {
    if (e.preventDefault) {
        e.preventDefault();
    }
    e.dataTransfer.dropEffect = 'move';

    // Live DOM Swapping Logic
    const targetRow = this;
    if (dragSrcEl && targetRow !== dragSrcEl && targetRow.parentNode === dragSrcEl.parentNode) {
        const rect = targetRow.getBoundingClientRect();
        const next = (e.clientY - rect.top) / (rect.bottom - rect.top) > 0.5;

        // 如果滑鼠在下半部，插入到目標之後；否則插入到目標之前
        // insertBefore(node, nextSibling) -> if nextSibling is null, insert at end
        targetRow.parentNode.insertBefore(dragSrcEl, next ? targetRow.nextSibling : targetRow);
    }

    return false;
}

function handleDrop(e) {
    if (e.stopPropagation) {
        e.stopPropagation();
    }

    // 因為在 DragOver 已經完成了 DOM 的移動，這裡只需要更新資料陣列
    if (dragSrcEl) {
        dragSrcEl.classList.remove('dragging');

        // 根據新的 DOM 順序重建 currentProducts
        const tbody = document.getElementById('productsTableBody');
        const rows = Array.from(tbody.querySelectorAll('tr.product-main-row'));

        // 建立新的產品陣列
        const newOrderProducts = [];
        let hasChanges = false;

        rows.forEach(row => {
            // 這邊我們需要一個唯一識別符來找回原本的產品物件
            // 假設第一欄的 checkbox 或按鈕包含 id，或是找 row 裡的內容
            // 比較嚴謹的做法是在 renderProducts 時給 tr 加 data-id
            // 但如果不想改 renderProducts，我們可以用 indexOf 對照舊陣列? 
            // 不行，因為有排序問題。
            // 我們依賴 `dragSrcEl` 是原本的 DOM 元素，所以 DOM 順序就是新的順序
            // 只要我們能從 DOM row 找到對應的 product object

            // 由於目前的 renderProducts 沒有給 tr 加 ID，我們暫時用一個比較笨的方法：
            // 在 render 時期一定要加 data-id，否則這裡很難對應
            // 讓我檢查一下 renderProducts
        });

        // 既然要即時回饋，那我們的 renderProducts 必須要改一下，給 TR 加上 index 或 ID
        // 在此之前，先用一個簡單的方法：直接重新抓取 currentProducts
        // 因為 DOM 元素本身就是從 currentProducts render 出來的，我們可以為每個 product 物件加個臨時標記？
        // 或者：在 renderProducts 時，直接把 product object 綁定到 DOM element (row._product = product)

        // 為了避免改動太大，我們假設 renderProducts 會被我們改 (見下一步驟)
        // 這裡先寫邏輯：

        const newProducts = rows.map(row => row._productData).filter(p => p);

        if (newProducts.length === currentProducts.length) {
            currentProducts = newProducts;
            showUnsavedSortWarning();
            // 重繪以修正 Detail Row 的位置 (因為 DOM 移動只移了 Main Row)
            renderProducts(currentProducts);
        }
    }

    return false;
}

function showUnsavedSortWarning() {
    // 我們可以複用 unsavedProductsMsg，或者新增一個
    const msg = document.getElementById('unsavedProductsMsg');
    if (msg) {
        msg.textContent = '⚠️ 排序已變更，請點擊「儲存排序」';
        // 我們動態新增一個按鈕? 或者檢查有沒有存排序按鈕
        let sortBtn = document.getElementById('saveSortBtn');
        if (!sortBtn) {
            const container = document.getElementById('productBatchActions');
            sortBtn = document.createElement('button');
            sortBtn.id = 'saveSortBtn';
            sortBtn.textContent = '💾 儲存排序';
            sortBtn.className = 'accent-btn';
            sortBtn.style.marginLeft = '10px';
            sortBtn.style.backgroundColor = '#17a2b8'; // 不同顏色
            sortBtn.onclick = saveProductSortOrder;
            container.appendChild(sortBtn);
        }
    }
}

async function saveProductSortOrder() {
    const btn = document.getElementById('saveSortBtn');
    btn.disabled = true;
    btn.textContent = '儲存中...';

    const orderedIds = currentProducts.map(p => p.id);

    try {
        const result = await callApi('reorderProducts', { orderedIds: orderedIds });
        if (result.success) {
            alert('排序已儲存！');
            btn.remove(); // 移除按鈕
            const msg = document.getElementById('unsavedProductsMsg');
            if (msg) msg.textContent = '';
        } else {
            alert('儲存排序失敗: ' + result.error);
            btn.disabled = false;
        }
    } catch (e) {
        alert('儲存排序錯誤');
        btn.disabled = false;
    }
}

function openProductModal(productId = null) {
    const form = document.getElementById('productForm');
    form.reset();

    document.getElementById('prodId').value = '';
    document.getElementById('prodExchangeRate').value = '';
    document.getElementById('prodBrand').value = '';

    // 載入品牌列表
    loadBrandList();

    // 嘗試從 pending 或 current 找
    let p = null;

    // 重置圖片狀態
    modalImages = [];
    document.getElementById('imagePreviewContainer').innerHTML = '';
    document.getElementById('imagePreviewContainer').innerHTML = '';
    // document.getElementById('uploadImagesBtn').style.display = 'none'; // 已移除

    // 重置 variants
    currentProductVariants = [];

    if (productId) {
        // 先找 pending
        p = pendingProductUpdates.find(x => String(x.id) === String(productId));
        // 再找 current
        if (!p) p = currentProducts.find(x => String(x.id) === String(productId));

        if (p) {
            document.getElementById('prodId').value = p.id;
            document.getElementById('prodName').value = p.name;
            document.getElementById('prodCategory').value = p.category;
            document.getElementById('prodBrand').value = p.brand || '';
            document.getElementById('prodPrice').value = p.price;
            document.getElementById('prodCost').value = p.cost;
            document.getElementById('prodWholesalePrice').value = p.wholesalePrice || 0;
            document.getElementById('prodPriceKrw').value = p.priceKrw || 0;
            document.getElementById('prodStock').value = p.stock;
            document.getElementById('prodStatus').value = p.status;
            document.getElementById('prodDesc').value = p.description;

            // 處理現有圖片 (優先讀取暫存的 modalImages)
            if (p.modalImages && p.modalImages.length > 0) {
                modalImages = p.modalImages;
                // 更新 prodImage value (僅包含 existing 的，為了兼容)
                const existing = modalImages.filter(i => i.type === 'existing').map(i => i.value);
                document.getElementById('prodImage').value = existing.join(',');
            } else {
                let imgVal = p.image || '';
                if (imgVal) {
                    const urls = imgVal.split(',').filter(url => url.trim() !== '');
                    modalImages = urls.map(url => ({ type: 'existing', value: url }));
                    document.getElementById('prodImage').value = imgVal;
                } else {
                    modalImages = [];
                    document.getElementById('prodImage').value = '';
                }
            }

            // 渲染預覽 (包含現有圖片)
            renderImagePreviews();

            // 載入現有 variants
            currentProductVariants = p.variants || [];

            // 處理規格產生器
            renderSpecBuilder(p.options || {});

            // 渲染規格明細表格
            setTimeout(() => updateVariantsTable(), 100);
        }
    } else {
        document.getElementById('prodImage').value = '';
        renderSpecBuilder({});
        document.getElementById('variantsSection').style.display = 'none';
    }

    openModal('productModal');
    const body = document.querySelector('#productForm .modal-body');
    if (body) body.scrollTop = 0;
}

function calculateInlineCost() {
    const krw = Number(document.getElementById('prodPriceKrw').value) || 0;
    const rate = Number(document.getElementById('prodExchangeRate').value);

    if (krw > 0 && rate > 0) {
        const cost = Math.round(krw / rate);
        document.getElementById('prodCost').value = cost;
    }
}

async function handleProductSubmit(e) {
    e.preventDefault();

    const submitBtn = document.querySelector('#productForm button[type="submit"]');
    const originalBtnText = submitBtn.textContent;

    try {
        // 分離現有圖片和待上傳圖片
        const existingImages = modalImages.filter(img => img.type === 'existing').map(img => img.value);
        const newImagesToUpload = modalImages.filter(img => img.type === 'new').map(img => img.value);

        // 如果只有現有圖片且順序變了，我們直接更新 prodImage 以供之後儲存
        document.getElementById('prodImage').value = existingImages.join(',');

        submitBtn.textContent = '儲存中...';

        const productId = document.getElementById('prodId').value;
        const options = getSpecData();

        // 建立 Product 物件
        const isNew = !productId;
        const tempId = isNew ? 'NEW_' + Date.now() : productId;

        const productData = {
            id: tempId,
            name: document.getElementById('prodName').value,
            category: document.getElementById('prodCategory').value,
            brand: document.getElementById('prodBrand').value.trim() || '',
            price: Number(document.getElementById('prodPrice').value),
            cost: Number(document.getElementById('prodCost').value),
            wholesalePrice: Number(document.getElementById('prodWholesalePrice').value) || 0,
            priceKrw: Number(document.getElementById('prodPriceKrw').value),
            stock: Number(document.getElementById('prodStock').value),
            status: document.getElementById('prodStatus').value,
            description: document.getElementById('prodDesc').value,
            image: document.getElementById('prodImage').value,
            modalImages: [...modalImages], // 保存完整順序資訊供上傳時參考
            newImages: newImagesToUpload, // 暫存待上傳檔案 (相容舊邏輯)
            options: options,
            variants: getVariantsData() // 收集規格明細資料
        };

        // 更新 Pending Queue
        pendingProductUpdates = pendingProductUpdates.filter(p => String(p.id) !== String(tempId));
        pendingProductUpdates.push(productData);

        // 關閉 Modal 並更新 UI
        closeModal('productModal');
        updateProductBatchUI();
        renderProducts(currentProducts);

    } catch (error) {
        console.error('儲存失敗:', error);
        alert('儲存失敗: ' + error.message);
    } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = originalBtnText;
    }
}

function updateProductBatchUI() {
    const count = pendingProductUpdates.length;
    const msg = document.getElementById('unsavedProductsMsg');
    const btn = document.querySelector('#productBatchActions button');

    if (msg && btn) {
        if (count > 0) {
            msg.textContent = `⚠️ 有 ${count} 筆商品變更`;
            btn.disabled = false;
        } else {
            msg.textContent = '';
            btn.disabled = true;
        }
    }
}


// 商品批次儲存
// 商品批次儲存
async function saveProductBatchChanges() {
    if (pendingProductUpdates.length === 0) {
        alert('沒有待儲存的商品變更');
        return;
    }

    const confirmMsg = `確定要儲存 ${pendingProductUpdates.length} 筆商品的變更嗎？`;
    if (!confirm(confirmMsg)) return;

    const btn = document.querySelector('#productBatchActions button');
    if (btn) {
        btn.disabled = true;
        btn.textContent = '處理中...';
    }

    try {
        // 先處理圖片上傳
        const totalItems = pendingProductUpdates.length;

        for (let i = 0; i < totalItems; i++) {
            const item = pendingProductUpdates[i];

            if (item.modalImages && item.modalImages.some(img => img.type === 'new')) {
                btn.textContent = `正在上傳 ${item.name} 的圖片...`;

                const brand = item.brand || 'default';

                const tempIdMap = {};

                // 逐一處理 modalImages
                for (let j = 0; j < item.modalImages.length; j++) {
                    const img = item.modalImages[j];
                    if (img.type === 'new') {
                        const file = img.value;
                        try {
                            const base64 = await fileToBase64(file);
                            const base64Content = base64.split(',')[1];
                            const result = await callApi('uploadImageToGitHub', {
                                fileName: file.name,
                                content: base64Content,
                                mimeType: file.type,
                                brand: brand
                            });
                            if (result.success && result.data.url) {
                                // 記錄 tempId -> url 對照
                                if (img.tempId) {
                                    tempIdMap[img.tempId] = result.data.url;
                                }
                                img.type = 'existing';
                                img.value = result.data.url;
                            }
                        } catch (e) { console.error(e); }
                    }
                }

                // 根據最終的 modalImages 組合 URL
                item.image = item.modalImages
                    .filter(img => img.type === 'existing')
                    .map(img => img.value)
                    .join(',');

                // 更新 variants 中的圖片連結 (將 tempId 替換為真實 URL)
                if (item.variants && Array.isArray(item.variants)) {
                    item.variants.forEach(v => {
                        if (v.image && tempIdMap[v.image]) {
                            v.image = tempIdMap[v.image];
                        }
                    });
                }

                delete item.modalImages;
                delete item.newImages;
            }
        }

        btn.textContent = '儲存商品資料中...';

        // 將 NEW_ ID 清除，讓後端生成
        const updates = pendingProductUpdates.map(p => {
            const pCopy = { ...p };
            delete pCopy.newImages; // 確保不傳送 File 物件到後端

            if (String(pCopy.id).startsWith('NEW_')) {
                return { ...pCopy, id: null };
            }
            return pCopy;
        });

        const data = await callApi('updateProductsBatch', { updates: updates });

        if (data.success) {
            pendingProductUpdates.forEach(update => {
                // 略過新增的商品
                if (String(update.id).startsWith('NEW_')) return;

                const index = currentProducts.findIndex(p => String(p.id) === String(update.id));
                if (index !== -1) {
                    currentProducts[index] = { ...currentProducts[index], ...update };
                }
            });

            alert(`成功儲存 ${pendingProductUpdates.length} 筆商品的變更！`);
            pendingProductUpdates = [];
            updateProductBatchUI();
            renderProducts(currentProducts);

            setTimeout(() => fetchProducts(true), 100);
        } else {
            alert('儲存失敗：' + data.error);
        }
    } catch (err) {
        console.error(err);
        alert('儲存過程中發生錯誤：' + err);
    } finally {
        if (btn) {
            btn.disabled = false;
            btn.textContent = '💾 儲存所有變更';
        }
    }
}

function formatCurrency(num) {
    if (typeof num === 'string') {
        // 移除所有非數字字符 (除了小數點和負號)
        const parsed = parseFloat(num.replace(/[^\d.-]/g, ''));
        if (!isNaN(parsed)) num = parsed;
    }
    return 'NT$ ' + (Number(num) || 0).toLocaleString();
}

function openModal(id) {
    const modal = document.getElementById(id);
    modal.style.display = 'flex';
    // 重置滾動位置，確保每次開啟都在最上面
    const content = modal.querySelector('.modal-content');
    if (content) content.scrollTop = 0;
}

function closeModal(id) {
    document.getElementById(id).style.display = 'none';
}

// ----------------------
// 圖片上傳到 GitHub
// ----------------------
let modalImages = []; // 統一管理的圖片陣列 {type: 'existing'|'new', value: url|File, preview?: base64}

function handleImageSelect(event) {
    const files = Array.from(event.target.files);

    // 檢查檔案
    const validFiles = files.filter(file => {
        const validTypes = ['image/jpeg', 'image/png', 'image/webp'];
        const maxSize = 5 * 1024 * 1024; // 5MB

        if (!validTypes.includes(file.type)) {
            alert(`${file.name} 格式不支援，請使用 JPG, PNG 或 WEBP`);
            return false;
        }

        if (file.size > maxSize) {
            alert(`${file.name} 檔案過大，請小於 5MB`);
            return false;
        }

        return true;
    });

    if (validFiles.length === 0) return;

    validFiles.forEach(file => {
        // 生成臨時 ID
        const tempId = `temp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        modalImages.push({ type: 'new', value: file, tempId: tempId });
    });

    renderImagePreviews();
    // 更新規格選單 (使用本地預覽)
    updateVariantImageSelects();

    // 清空 input，允許重複選擇同一檔案
    event.target.value = '';
}

let imageDragSrcIndex = null;

function renderImagePreviews() {
    const container = document.getElementById('imagePreviewContainer');
    container.innerHTML = '';

    modalImages.forEach((img, index) => {
        const div = document.createElement('div');
        div.className = `image-preview-item ${img.type}`;
        div.setAttribute('draggable', true);
        div.dataset.index = index;

        // 事件監聽
        div.addEventListener('dragstart', handleImageDragStart);
        div.addEventListener('dragover', handleImageDragOver);
        div.addEventListener('drop', handleImageDragDrop);

        const imgEl = document.createElement('img');
        if (img.type === 'existing') {
            imgEl.src = img.value;
        } else {
            // 對於新檔案，如果還沒產生預覽圖就產生
            if (!img.preview) {
                const reader = new FileReader();
                reader.onload = (e) => {
                    img.preview = e.target.result;
                    imgEl.src = img.preview;
                };
                reader.readAsDataURL(img.value);
            } else {
                imgEl.src = img.preview;
            }
        }

        div.appendChild(imgEl);

        const removeBtn = document.createElement('button');
        removeBtn.type = 'button';
        removeBtn.className = 'remove-btn';
        removeBtn.innerHTML = '×';
        removeBtn.onclick = (e) => {
            e.stopPropagation();
            removeModalImage(index);
        };
        div.appendChild(removeBtn);

        container.appendChild(div);
    });
}

function handleImageDragStart(e) {
    imageDragSrcIndex = parseInt(this.dataset.index);
    e.dataTransfer.effectAllowed = 'move';
    this.classList.add('dragging');
}

function handleImageDragOver(e) {
    if (e.preventDefault) e.preventDefault();
    return false;
}

function handleImageDragDrop(e) {
    if (e.stopPropagation) e.stopPropagation();

    const targetIndex = parseInt(this.dataset.index);
    if (imageDragSrcIndex !== targetIndex) {
        const item = modalImages[imageDragSrcIndex];
        modalImages.splice(imageDragSrcIndex, 1);
        modalImages.splice(targetIndex, 0, item);
        renderImagePreviews();
        updateVariantImageSelects(); // 排序變更後更新選單

        // 更新隱藏的 prodImage (僅限現有的)
        const existing = modalImages.filter(i => i.type === 'existing').map(i => i.value);
        document.getElementById('prodImage').value = existing.join(',');
    }
    return false;
}

function removeModalImage(index) {
    modalImages.splice(index, 1);
    renderImagePreviews();

    // 更新現有的
    const existing = modalImages.filter(i => i.type === 'existing').map(i => i.value);
    document.getElementById('prodImage').value = existing.join(',');

    // 觸發規格選單更新 (因為移除圖片也需要更新)
    updateVariantImageSelects();
}

async function uploadImagesToGitHub() {
    const newImagesCount = modalImages.filter(img => img.type === 'new').length;
    if (newImagesCount === 0) return;

    // 鎖定提交按鈕
    const submitBtn = document.querySelector('#productForm button[type="submit"]');
    const originalBtnText = submitBtn ? submitBtn.textContent : '儲存';
    if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.textContent = '圖片上傳中...';
    }

    // 顯示上傳狀態在 Upload Zone
    const uploadZone = document.getElementById('uploadZone');
    const originalZoneHTML = uploadZone.innerHTML;
    const progressDiv = document.createElement('div');
    progressDiv.style.color = 'blue';
    progressDiv.style.fontWeight = 'bold';
    progressDiv.textContent = '正在上傳圖片至 GitHub，請稍候...';
    uploadZone.appendChild(progressDiv);

    // 取得品牌資訊
    const brand = document.getElementById('prodBrand').value.trim() || 'default';

    try {
        let uploadedCount = 0;
        for (let i = 0; i < modalImages.length; i++) {
            const img = modalImages[i];
            if (img.type === 'new') {
                const file = img.value;
                progressDiv.textContent = `正在上傳 ${uploadedCount + 1}/${newImagesCount}: ${file.name}...`;

                // 轉換為 Base64
                const base64 = await fileToBase64(file);
                const base64Content = base64.split(',')[1];

                const result = await callApi('uploadImageToGitHub', {
                    fileName: file.name,
                    content: base64Content,
                    mimeType: file.type,
                    brand: brand
                });

                if (result.success && result.data.url) {
                    img.type = 'existing';
                    img.value = result.data.url;
                    uploadedCount++;
                } else {
                    console.error('上傳失敗', result);
                    alert(`圖片 ${file.name} 上傳失敗: ${result.error}`);
                    // 失敗的保持 new 狀態，或者移除？
                    // 這裡暫時保留，用戶可以重試 (重新選擇)
                }
            }
        }

        // 更新 prodImage
        const allUrls = modalImages.filter(i => i.type === 'existing').map(i => i.value).join(',');
        document.getElementById('prodImage').value = allUrls;

        // 如果全部成功
        if (uploadedCount === newImagesCount) {
            progressDiv.textContent = '所有圖片上傳完成！';
            setTimeout(() => {
                if (uploadZone.contains(progressDiv)) progressDiv.remove();
            }, 2000);
        }

        renderImagePreviews();
        updateVariantImageSelects(); // 圖片上傳後更新規格選單

    } catch (error) {
        console.error('上傳過程發生錯誤:', error);
        alert('上傳過程發生錯誤: ' + error.message);
    } finally {
        // 還原按鈕
        if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.textContent = originalBtnText;
        }
        // 還原 Upload Zone (如果沒有在上面移除)
        if (uploadZone.contains(progressDiv)) {
            // 保留一下訊息再移除，或是直接還原
            // 上面已經有 setTimeout 移除，這裡做個雙保險
            if (uploadZone.innerHTML === originalZoneHTML) {
                // do nothing
            }
        }
    }
}

function fileToBase64(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
}

// 拖放支援
document.addEventListener('DOMContentLoaded', () => {
    // ... 原有的 DOMContentLoaded 邏輯 ...

    // 加入拖放支援
    const uploadZone = document.getElementById('uploadZone');
    if (uploadZone) {
        ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
            uploadZone.addEventListener(eventName, preventDefaults, false);
        });

        function preventDefaults(e) {
            e.preventDefault();
            e.stopPropagation();
        }

        ['dragenter', 'dragover'].forEach(eventName => {
            uploadZone.addEventListener(eventName, () => {
                uploadZone.classList.add('drag-over');
            }, false);
        });

        ['dragleave', 'drop'].forEach(eventName => {
            uploadZone.addEventListener(eventName, () => {
                uploadZone.classList.remove('drag-over');
            }, false);
        });

        uploadZone.addEventListener('drop', (e) => {
            const dt = e.dataTransfer;
            const files = dt.files;
            document.getElementById('imageFileInput').files = files;
            handleImageSelect({ target: { files: files } });
        }, false);
    }
});

// 側邊欄切換 (桌面收合 / 手機展開)
function toggleSidebar() {
    const isMobile = window.innerWidth <= 1024;
    const dashboard = document.getElementById('dashboardPage');
    const sidebar = document.querySelector('.sidebar');

    if (isMobile) {
        const overlay = document.querySelector('.sidebar-overlay');
        if (!overlay) {
            const newOverlay = document.createElement('div');
            newOverlay.className = 'sidebar-overlay';
            newOverlay.onclick = toggleSidebar;
            document.body.appendChild(newOverlay);
        }
        sidebar.classList.toggle('active');
        document.querySelector('.sidebar-overlay').classList.toggle('active');
        document.body.classList.toggle('sidebar-open');
    } else {
        // 桌面版：收合
        dashboard.classList.toggle('sidebar-collapsed');
        // 加入動畫監聽，在動畫結束後通知 PageBuilder 更新比例
        setTimeout(() => {
            if (typeof PageBuilder !== 'undefined' && PageBuilder.updatePreviewScale) {
                PageBuilder.updatePreviewScale();
            }
        }, 310); // 略長於 CSS transition 300ms
    }
}

// 桌面版側邊欄縮合專用函數
function toggleDesktopSidebar() {
    const dashboard = document.getElementById('dashboardPage');
    if (!dashboard) return;

    // 只在桌面版生效
    if (window.innerWidth <= 1024) return;

    dashboard.classList.toggle('sidebar-collapsed');

    // 保存縮合狀態到 localStorage
    const isCollapsed = dashboard.classList.contains('sidebar-collapsed');
    localStorage.setItem('sidebar_collapsed', isCollapsed ? 'true' : 'false');

    // 更新按鈕圖示
    const collapseBtn = document.querySelector('.sidebar-collapse-btn');
    if (collapseBtn) {
        collapseBtn.innerHTML = isCollapsed ? '⟩' : '⟨';
        collapseBtn.title = isCollapsed ? '展開選單' : '收合選單';
    }

    // 動畫結束後通知 PageBuilder 更新比例
    setTimeout(() => {
        if (typeof PageBuilder !== 'undefined' && PageBuilder.updatePreviewScale) {
            PageBuilder.updatePreviewScale();
        }
    }, 310);
}

// 初始化時恢復側邊欄縮合狀態
document.addEventListener('DOMContentLoaded', () => {
    const savedCollapsed = localStorage.getItem('sidebar_collapsed');
    if (savedCollapsed === 'true' && window.innerWidth > 1024) {
        const dashboard = document.getElementById('dashboardPage');
        if (dashboard) {
            dashboard.classList.add('sidebar-collapsed');
            const collapseBtn = document.querySelector('.sidebar-collapse-btn');
            if (collapseBtn) {
                collapseBtn.innerHTML = '⟩';
                collapseBtn.title = '展開選單';
            }
        }
    }
});

// ----------------------
// 刪除操作
// ----------------------
async function confirmDeleteOrder(orderId) {
    if (!confirm(`確定要刪除訂單 ${orderId} 嗎？此操作不可還原！`)) return;

    try {
        showToast(`正在刪除訂單 ${orderId}...`);
        const result = await callApi('deleteOrder', { orderId: orderId });
        if (result.success) {
            showToast('訂單已刪除', 'success');
            refreshData(); // 重新整理列表
        } else {
            alert('刪除失敗: ' + result.error);
        }
    } catch (e) {
        console.error(e);
        alert('刪除發生錯誤');
    }
}

async function confirmDeleteProduct(productId) {
    if (!productId || productId.startsWith('NEW_')) {
        // 如果是尚未儲存的新商品，直接從暫存移除
        if (confirm('確定要移除此待儲存商品嗎？')) {
            pendingProductUpdates = pendingProductUpdates.filter(p => String(p.id) !== String(productId));
            updateProductBatchUI();
            renderProducts(currentProducts);
            showToast('已移除待儲存商品', 'info');
        }
        return;
    }

    if (!confirm(`確定要刪除商品 ID: ${productId} 嗎？此操作不可還原！`)) return;

    try {
        showToast(`正在刪除商品 ${productId}...`);
        const result = await callApi('deleteProduct', { productId: productId });
        if (result.success) {
            showToast('商品已刪除', 'success');
            fetchProducts(true); // 重新整理列表
        } else {
            alert('刪除失敗: ' + result.error);
        }
    } catch (e) {
        console.error(e);
        alert('刪除發生錯誤');
    }
}

// ----------------------
// 手動訂單管理
// ----------------------
let currentEditingOrderId = null;
let tempOrderItems = [];

function openCreateOrderModal() {
    currentEditingOrderId = null;
    tempOrderItems = [];

    // 確保商品已載入
    if (currentProducts.length === 0) {
        alert('正在載入商品資料，請稍後再試');
        fetchProducts();
        return;
    }

    console.log('建立新訂單，可用商品數:', currentProducts.length);

    document.getElementById('detailOrderId').textContent = '(新訂單)';
    document.getElementById('detailName').value = '';
    document.getElementById('detailPhone').value = '';
    document.getElementById('detailEmail').value = '';
    document.getElementById('detailLine').value = '';
    document.getElementById('detailShipping').value = ''; // Default to empty
    document.getElementById('detailStoreName').value = '';
    document.getElementById('detailStoreCode').value = '';
    document.getElementById('detailStoreAddress').value = '';
    document.getElementById('detailNote').value = '';

    renderOrderItems();
    loadProductSuggestions();

    // 設定最下方的提交按鈕
    const saveBtn = document.querySelector('#orderDetailModal .modal-actions .accent-btn');
    if (saveBtn) {
        saveBtn.textContent = '建立訂單';
        saveBtn.onclick = () => submitManualOrder();
    }

    openModal('orderDetailModal');
}

function loadProductSuggestions() {
    const datalist = document.getElementById('productSuggestions');
    if (!datalist) return;

    datalist.innerHTML = currentProducts.map(p =>
        `<option value="${p.name}">${p.name} - NT$ ${p.price}</option>`
    ).join('');

    console.log('載入商品建議:', currentProducts.length, '個商品');
}

function filterProducts(query) {
    // datalist 會自動過濾，不需要手動實作
}

function updateShippingFee() {
    const shippingMethod = document.getElementById('detailShipping').value;
    const feeInput = document.getElementById('detailShippingFee');

    // 如果是手動修改過的，也許我們不該覆蓋？
    // 但如果使用者切換運送方式，通常期望運費跟著變。
    // 所以策略是：切換運送方式時，總是更新為該方式的預設值。

    if (shippingMethod === '7-11店到店') {
        feeInput.value = 60;
    } else {
        // 限台中市面交 或其他
        feeInput.value = 0;
    }

    updateTotal();
}

// 更新訂單總計（支援折扣率和固定折扣）
function updateOrderTotal() {
    // 1. 計算商品小計
    let itemsSubtotal = 0;
    tempOrderItems.forEach(item => {
        itemsSubtotal += item.subtotal || 0;
    });

    // 2. 套用折扣率
    let discountFromPercent = 0;
    const enablePercent = document.getElementById('enableDiscountPercent');
    const percentInput = document.getElementById('discountPercent');

    if (enablePercent && enablePercent.checked && percentInput) {
        const percent = parseFloat(percentInput.value) || 100;
        if (percent < 100 && percent >= 0) {
            discountFromPercent = itemsSubtotal * (100 - percent) / 100;
        }
    }

    // 3. 套用固定折扣
    let discountFromAmount = 0;
    const enableAmount = document.getElementById('enableDiscountAmount');
    const amountInput = document.getElementById('discountAmount');

    if (enableAmount && enableAmount.checked && amountInput) {
        discountFromAmount = parseFloat(amountInput.value) || 0;
    }

    // 4. 計算總折扣
    const totalDiscount = discountFromPercent + discountFromAmount;

    // 5. 加上運費
    const shippingFee = parseFloat(document.getElementById('detailShippingFee').value) || 0;

    // 6. 計算最終總計
    const total = Math.max(0, itemsSubtotal - totalDiscount + shippingFee);

    // 更新顯示
    document.getElementById('itemsSubtotal').textContent = `NT$ ${Math.round(itemsSubtotal)}`;

    if (document.getElementById('discountPercentAmount')) {
        document.getElementById('discountPercentAmount').textContent = `- NT$ ${Math.round(totalDiscount)}`;
    }

    document.getElementById('detailTotal').innerHTML = `<strong>NT$ ${Math.round(total)}</strong>`;

    console.log('訂單總計更新:', { itemsSubtotal, discountFromPercent, discountFromAmount, totalDiscount, shippingFee, total });
}

// 保留舊函數名稱以維持相容性
function updateTotal() {
    updateOrderTotal();
}

function openAddProductToOrder() {
    const area = document.getElementById('addProductArea');
    if (!area) {
        console.error('找不到 addProductArea');
        return;
    }

    // 重新載入商品清單
    loadProductSuggestions();

    // 重置表單
    const select = document.getElementById('productSearch');
    if (select) {
        select.value = '';
        // 綁定產品選擇事件 (多種事件確保觸發)
        select.removeEventListener('input', onProductSelected);
        select.addEventListener('input', onProductSelected);
        select.removeEventListener('change', onProductSelected);
        select.addEventListener('change', onProductSelected);
        select.removeEventListener('blur', onProductSelected);
        select.addEventListener('blur', onProductSelected);
    }

    const qtyInput = document.getElementById('productQty');
    if (qtyInput) qtyInput.value = 1;

    // 隱藏規格選擇器
    const specGroup = document.getElementById('specSelectGroup');
    if (specGroup) specGroup.style.display = 'none';

    // 顯示區域
    area.style.display = 'block';

    console.log('開啟新增商品區域，商品數量:', currentProducts.length);
}

// 當選擇商品時，檢查並顯示規格選項
function onProductSelected() {
    console.log('onProductSelected 被觸發');
    const searchInput = document.getElementById('productSearch');
    const productName = searchInput ? searchInput.value.trim() : '';
    const specGroup = document.getElementById('specSelectGroup');
    const specSelectors = document.getElementById('specSelectors');

    console.log('選擇的商品:', productName);

    if (!productName || !specGroup || !specSelectors) {
        if (specGroup) specGroup.style.display = 'none';
        return;
    }

    // 查找商品
    let product = currentProducts.find(p => p.name === productName);

    // 如果找不到，嘗試 ID 匹配
    if (!product) {
        product = currentProducts.find(p => String(p.id) === productName);
    }

    if (!product) {
        console.log('找不到對應商品資料:', productName);
        specGroup.style.display = 'none';
        return;
    }

    console.log('找到商品:', product.name, '變體數量:', product.variants ? product.variants.length : 0);

    // 檢查是否有 variants
    if (product.variants && product.variants.length > 0) {
        // 解析規格維度 - 傳入整個產品物件
        const dimensions = parseVariantDimensions(product);

        if (Object.keys(dimensions).length > 0) {
            // 清空並重建規格選擇器
            specSelectors.innerHTML = '';

            // 為每個維度創建選擇器
            Object.keys(dimensions).forEach(dimName => {
                const dimDiv = document.createElement('div');
                dimDiv.className = 'spec-dimension';

                const label = document.createElement('label');
                label.textContent = dimName;

                const select = document.createElement('select');
                select.className = 'spec-select';
                select.dataset.dimension = dimName;

                // 添加預設選項
                const defaultOption = document.createElement('option');
                defaultOption.value = '';
                defaultOption.textContent = `-- 請選擇${dimName} --`;
                select.appendChild(defaultOption);

                // 添加該維度的所有值
                dimensions[dimName].forEach(value => {
                    const option = document.createElement('option');
                    option.value = value;
                    option.textContent = value;
                    select.appendChild(option);
                });

                dimDiv.appendChild(label);
                dimDiv.appendChild(select);
                specSelectors.appendChild(dimDiv);
            });

            // 顯示規格選擇器 - 強制設置所有可見性屬性
            specGroup.style.cssText = 'display: block !important; visibility: visible !important; opacity: 1 !important; min-height: 80px; margin-top: 0.5rem; padding: 1rem; background: #fff3cd; border: 2px solid #ffc107; border-radius: 6px;';
            console.log('規格選擇器已顯示，specGroup:', specGroup);
            console.log('specSelectors 內容:', specSelectors.innerHTML);

            // 檢查是否真的有內容
            if (specSelectors.children.length === 0) {
                console.error('警告：specSelectors 沒有子元素！');
            }
        } else {
            // 多維度解析失敗，回退到單一規格模式
            console.log('多維度解析失敗，使用單一規格模式，變體數:', product.variants.length);

            specSelectors.innerHTML = '';

            const dimDiv = document.createElement('div');
            dimDiv.className = 'spec-dimension';
            dimDiv.style.cssText = 'display: flex; flex-direction: column; gap: 4px;';

            const label = document.createElement('label');
            label.textContent = '規格';
            label.style.fontWeight = 'bold';

            const select = document.createElement('select');
            select.className = 'spec-select';
            select.dataset.dimension = '規格';
            select.style.cssText = 'padding: 0.5rem; border: 1px solid #ddd; border-radius: 4px; min-width: 150px;';

            const defaultOption = document.createElement('option');
            defaultOption.value = '';
            defaultOption.textContent = '-- 請選擇規格 --';
            select.appendChild(defaultOption);

            product.variants.forEach(variant => {
                const option = document.createElement('option');
                option.value = variant.spec || '';
                option.textContent = variant.spec || '無';
                if (variant.stock !== undefined) {
                    option.textContent += ` (庫存: ${variant.stock})`;
                }
                select.appendChild(option);
            });

            dimDiv.appendChild(label);
            dimDiv.appendChild(select);
            specSelectors.appendChild(dimDiv);

            // 顯示規格選擇器
            specGroup.style.display = 'block';
            specGroup.style.marginTop = '0.5rem';
            specGroup.style.padding = '0.5rem';
            specGroup.style.background = '#f8f9fa';
            specGroup.style.border = '1px solid #ddd';
            specGroup.style.borderRadius = '4px';
            console.log('單一規格選擇器已顯示');
        }
    } else {
        // 沒有規格，隱藏選擇器
        specGroup.style.display = 'none';
        console.log('商品無規格');
    }
}

// 解析規格維度 - 使用產品的 options 欄位
function parseVariantDimensions(product) {
    // 如果產品有 options 欄位，直接使用
    if (product.options && typeof product.options === 'object') {
        // options 可能是 {"顏色":["紅","米白"],"尺寸":["小孩","大人"]} 格式
        let optionsData = product.options;

        // 如果是字串，嘗試解析
        if (typeof optionsData === 'string') {
            try {
                optionsData = JSON.parse(optionsData);
            } catch (e) {
                console.log('無法解析 options:', e);
                return {};
            }
        }

        // 確保有維度資料
        if (Object.keys(optionsData).length > 0) {
            console.log('使用 options 欄位:', optionsData);
            return optionsData;
        }
    }

    // 回退：從 variants 的 spec 解析（用斜線分隔）
    if (product.variants && product.variants.length > 0) {
        const firstSpec = product.variants[0].spec || '';
        const parts = firstSpec.split('/');

        if (parts.length > 1) {
            // 多維度，嘗試推斷維度名稱
            const dimensions = {};
            const dimNames = ['規格1', '規格2', '規格3'];

            parts.forEach((_, index) => {
                if (index < dimNames.length) {
                    dimensions[dimNames[index]] = [];
                }
            });

            product.variants.forEach(v => {
                const specParts = (v.spec || '').split('/');
                specParts.forEach((part, index) => {
                    const dimName = dimNames[index];
                    if (dimName && dimensions[dimName] && !dimensions[dimName].includes(part)) {
                        dimensions[dimName].push(part);
                    }
                });
            });

            console.log('從 variants 解析維度:', dimensions);
            return dimensions;
        }
    }

    return {};
}

function cancelAddProduct() {
    const area = document.getElementById('addProductArea');
    if (area) {
        area.style.display = 'none';
    }
}

function addProductToOrderItems() {
    const select = document.getElementById('productSearch');
    const productName = select.value.trim();
    const qty = parseInt(document.getElementById('productQty').value) || 1;

    // 從多維度選擇器收集規格
    const specGroup = document.getElementById('specSelectGroup');
    const specSelectors = document.getElementById('specSelectors');
    let spec = '';

    if (specGroup && specGroup.style.display !== 'none' && specSelectors) {
        const selects = specSelectors.querySelectorAll('select.spec-select');
        const specValues = [];
        let allSelected = true;

        selects.forEach(sel => {
            if (sel.value) {
                specValues.push(sel.value);
            } else {
                allSelected = false;
            }
        });

        // 如果有多個選擇器但沒有全部選擇，提示用戶
        if (selects.length > 0 && !allSelected) {
            alert('請選擇所有規格');
            return;
        }

        // 用斜線組合規格值
        spec = specValues.join('/');
    }

    console.log('嘗試新增商品:', productName, '規格:', spec, '數量:', qty);

    if (!productName) {
        alert('請選擇商品');
        return;
    }

    // 查找商品
    let product = currentProducts.find(p => p.name === productName);

    // 如果找不到，嘗試 ID 匹配
    if (!product) {
        product = currentProducts.find(p => String(p.id) === productName);
    }

    if (!product) {
        alert('找不到此商品');
        return;
    }

    // 如果有規格選擇器顯示但沒選擇規格，且商品有多個變體
    if (specGroup && specGroup.style.display !== 'none' && !spec && product.variants && product.variants.length > 1) {
        alert('請選擇規格');
        return;
    }

    // 查找對應的變體以獲取正確價格
    let price = product.price;
    if (spec && product.variants) {
        const matchedVariant = product.variants.find(v => v.spec === spec);
        if (matchedVariant && matchedVariant.price) {
            price = matchedVariant.price;
            console.log('找到對應變體，價格:', price);
        }
    }

    // 檢查庫存 (庫存 <= 0 不能加入)
    let currentStock = product.stock;
    if (spec && product.variants) {
        const matchedVariant = product.variants.find(v => v.spec === spec);
        if (matchedVariant) {
            currentStock = matchedVariant.stock;
        }
    }

    // 如果沒有變體，且沒有 spec，使用產品總庫存
    if (currentStock === undefined || currentStock === null || currentStock === '') {
        // 極端情況回退
        console.warn('無法判斷庫存，預設為可銷售');
        currentStock = 999;
    }

    if (parseInt(currentStock) <= 0) {
        alert('此商品/規格已售完 (庫存: 0)，無法加入訂單。');
        return;
    }

    // 檢查是否已存在 (同名稱且同規格)
    const existing = tempOrderItems.find(item => item.name === productName && (item.spec || '') === spec);
    if (existing) {
        existing.qty += qty;
        existing.subtotal = existing.price * existing.qty;
        console.log('更新現有商品數量');
    } else {
        tempOrderItems.push({
            name: product.name,
            spec: spec,
            qty: qty,
            originalPrice: price,
            price: price,
            subtotal: price * qty
        });
        console.log('新增商品到列表');
    }

    console.log('目前商品列表:', tempOrderItems);

    // 立即更新顯示
    renderOrderItems();

    // 清空輸入
    select.value = '';
    document.getElementById('productQty').value = 1;
    if (specGroup) {
        specGroup.style.display = 'none';
    }
    if (specSelectors) {
        specSelectors.innerHTML = '';
    }
}

// 處理商品輸入變更
function handleProductSearchInput() {
    const searchInput = document.getElementById('productSearch');
    if (!searchInput) return;

    const val = searchInput.value.trim(); // 去除前後空白
    // console.log('商品搜尋輸入:', val); // 減少 log

    // 嘗試找到商品：名稱完全匹配 或 包含 (如果不只一個，取第一個完全匹配的，或第一個包含的)
    let product = currentProducts.find(p => p.name.trim() === val);

    // 如果沒找到，試試看是否包含 (例如用戶只打部分名稱)
    // 但只有當用戶選中時才應該顯示規格，所以我們應該盡量精確。
    // 用戶反饋 "沒有規格選項"，可能是名稱有一些不可見字符？
    if (!product) {
        // 嘗試更寬鬆的匹配 (Case insensitive)
        product = currentProducts.find(p => p.name.trim().toLowerCase() === val.toLowerCase());
    }

    const specGroup = document.getElementById('specSelectGroup');
    const specSelect = document.getElementById('productSpec');

    if (product) {
        // console.log('找到商品:', product.name, product.options);
        // ... (rest logic)

        if (product && specGroup && specSelect) {
            let options = [];
            try {
                if (Array.isArray(product.options)) {
                    options = product.options;
                } else if (typeof product.options === 'object' && product.options !== null) {
                    // 處理 Object 格式: { "款式": ["黑色", "粉色"] }
                    options = Object.entries(product.options).map(([name, values]) => ({
                        name: name,
                        values: Array.isArray(values) ? values : [values]
                    }));
                } else if (typeof product.options === 'string' && product.options.trim() !== '') {
                    const parsed = JSON.parse(product.options);
                    if (Array.isArray(parsed)) {
                        options = parsed;
                    } else if (typeof parsed === 'object' && parsed !== null) {
                        options = Object.entries(parsed).map(([name, values]) => ({
                            name: name,
                            values: Array.isArray(values) ? values : [values]
                        }));
                    }
                }
            } catch (e) {
                console.error('規格解析失敗', e, product.options);
                options = [];
            }

            console.log('解析後的規格選項:', options);

            if (options && options.length > 0) {
                // 清空舊選項
                specSelect.innerHTML = '<option value="">請選擇規格</option>';

                let hasSpecs = false;
                options.forEach(opt => {
                    if (opt && opt.values && Array.isArray(opt.values)) {
                        opt.values.forEach(val => {
                            const optionText = `${opt.name}: ${val}`;
                            const option = document.createElement('option');
                            option.value = optionText;
                            option.textContent = optionText;
                            specSelect.appendChild(option);
                            hasSpecs = true;
                        });
                    }
                });

                if (hasSpecs) {
                    specGroup.style.display = 'block';
                    console.log('顯示規格選單');
                } else {
                    specGroup.style.display = 'none';
                    console.log('無有效規格選項，隱藏選單');
                }
            } else {
                specGroup.style.display = 'none';
            }
        } else if (specGroup) {
            specGroup.style.display = 'none';
        }
    }
}

// 監聽商品輸入變更，動態顯示規格
document.addEventListener('DOMContentLoaded', () => {
    const searchInput = document.getElementById('productSearch');
    if (searchInput) {
        searchInput.addEventListener('input', handleProductSearchInput);
        searchInput.addEventListener('change', handleProductSearchInput);
    }
});

function removeOrderItem(index) {
    if (confirm('確定刪除此商品？')) {
        tempOrderItems.splice(index, 1);
        renderOrderItems();
    }
}

function renderOrderItems() {
    const tbody = document.getElementById('detailItemsBody');
    console.log('renderOrderItems 被調用，商品數量:', tempOrderItems.length);

    if (tempOrderItems.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;color:#999;">尚未新增商品</td></tr>';
        document.getElementById('detailShippingFee').value = 0;
        document.getElementById('detailTotal').textContent = 0;
        return;
    }

    tbody.innerHTML = tempOrderItems.map((item, index) => `
        <tr>
            <td>${item.name}</td>
            <td>${item.spec || '-'}</td>
            <td>${item.qty}</td>
            <td>${formatCurrency(item.originalPrice || item.price)}</td>
            <td>
                <input type="number" value="${item.price}" 
                       onchange="updateItemPrice(${index}, this.value)"
                       style="width: 80px; padding: 0.3rem; border: 1px solid #ddd; border-radius: 4px;">
            </td>
            <td>${formatCurrency(item.subtotal)}</td>
            <td><button class="action-btn" onclick="removeOrderItem(${index})" style="background:#dc3545;color:white;">刪除</button></td>
        </tr>
    `).join('');

    // 更新總計
    updateOrderTotal();

    console.log('商品明細已更新');
    // 全局重新整理
    function refreshData() {
        const btn = document.querySelector('.refresh-btn');
        if (btn) btn.disabled = true;

        Promise.all([
            fetchOrders(true),
            fetchProducts(true)
        ]).then(() => {
            showToast('資料已更新', 'success');
        }).catch(err => {
            console.error(err);
            showToast('更新失敗', 'error');
        }).finally(() => {
            if (btn) btn.disabled = false;
        });
    }
    // 確保新增商品區域狀態正確
    const addArea = document.getElementById('addProductArea');
    if (addArea && addArea.style.display === 'block') {
        // 如果正在新增，保持開啟
    } else if (addArea) {
        addArea.style.display = 'none';
    }
}

function submitManualOrder() {
    if (tempOrderItems.length === 0) {
        alert('請至少新增一個商品');
        return;
    }

    const customerName = document.getElementById('detailName').value.trim();
    const customerPhone = document.getElementById('detailPhone').value.trim();

    if (!customerName || !customerPhone) {
        alert('請填寫客戶姓名和電話');
        return;
    }

    const orderData = {
        // Flattened structure for GAS backend
        customerName: customerName,
        customerPhone: customerPhone,
        email: document.getElementById('detailEmail').value.trim(),
        lineId: document.getElementById('detailLine').value.trim(),

        shippingMethod: document.getElementById('detailShipping').value,
        storeName: document.getElementById('detailStoreName').value.trim(),
        storeCode: document.getElementById('detailStoreCode').value.trim(),
        storeAddress: document.getElementById('detailStoreAddress').value.trim(),
        shippingFee: parseInt(document.getElementById('detailShippingFee').value) || 0,

        items: tempOrderItems,
        total: parseInt(document.getElementById('detailTotal').textContent.replace(/[^\d]/g, '')) || 0,
        note: document.getElementById('detailNote').value.trim(),
        status: '待處理'
    };

    const btn = document.querySelector('#orderDetailModal .accent-btn');
    btn.disabled = true;
    btn.textContent = '建立中...';

    callApi('createManualOrder', { orderData: orderData })
        .then(data => {
            if (data.success) {
                alert('訂單建立成功！訂單編號：' + data.data.orderId);
                // closeModal('orderDetailModal'); // Don't close
                refreshData(); // 重新載入訂單列表

                // Reset modal for next order
                // The easiest way is to re-call openCreateOrderModal() which clears inputs
                openCreateOrderModal();
            } else {
                alert('建立失敗：' + data.error);
                btn.disabled = false;
                btn.textContent = '建立訂單';
            }
        })
        .catch(err => {
            alert('建立失敗：' + err);
            btn.disabled = false;
            btn.textContent = '建立訂單';
        });
}

// ----------------------
// 網站設定
// ----------------------
let currentSettings = {};

function loadSiteSettings() {
    const container = document.getElementById('settingsForm');
    container.innerHTML = '<div class="loading">載入設定中...</div>';

    callApi('getSiteSettings')
        .then(data => {
            if (data.success) {
                currentSettings = data.data.settings;
                renderSettingsForm(currentSettings);
            } else {
                container.innerHTML = `<div class="error">載入失敗: ${data.error}</div>`;
            }
        })
        .catch(err => {
            container.innerHTML = `<div class="error">載入失敗: ${err}</div>`;
        });
}

function renderSettingsForm(settings) {
    const container = document.getElementById('settingsForm');

    // Define known keys for better UI, others will be generic inputs
    const knownKeys = {
        'announcementTitle': '公告標題',
        'announcementContent': '公告內容',
        'heroImage': '首頁大圖 URL',
        'footerInfo': '頁尾資訊 (HTML)',
        'checkoutSuccessInfo': '訂單成立後提示訊息 (支援 HTML)'
    };

    let html = '<div class="settings-grid" style="display: grid; gap: 15px;">';

    // Render known keys first
    Object.keys(knownKeys).forEach(key => {
        const val = settings[key] || '';
        if (key === 'checkoutSuccessInfo' || key === 'footerInfo' || key === 'announcementContent') {
            html += `
            <div class="form-group">
                <label style="font-weight:bold; display:block; margin-bottom:5px;">${knownKeys[key]} <small style="color:#888">(${key})</small></label>
                <textarea class="setting-input" data-key="${key}" rows="5" style="width:100%; padding:8px; border:1px solid #ddd; border-radius:4px;">${val.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</textarea>
            </div>
            `;
        } else {
            html += `
            <div class="form-group">
                <label style="font-weight:bold; display:block; margin-bottom:5px;">${knownKeys[key]} <small style="color:#888">(${key})</small></label>
                <input type="text" class="setting-input" data-key="${key}" value="${val.replace(/"/g, '&quot;')}" style="width:100%; padding:8px; border:1px solid #ddd; border-radius:4px;">
            </div>
            `;
        }
    });

    // Render other keys
    Object.keys(settings).forEach(key => {
        if (!knownKeys[key] && key !== 'Key' && key !== 'Value') {
            const val = settings[key];
            html += `
            <div class="form-group">
                <label style="font-weight:bold; display:block; margin-bottom:5px;">${key}</label>
                <input type="text" class="setting-input" data-key="${key}" value="${val}" style="width:100%; padding:8px; border:1px solid #ddd; border-radius:4px;">
            </div>
            `;
        }
    });

    html += '</div>';

    // Add "Add New Setting" button? Maybe later.

    container.innerHTML = html;
}

function saveSiteSettings() {
    const inputs = document.querySelectorAll('.setting-input');
    const newSettings = {};

    inputs.forEach(input => {
        newSettings[input.dataset.key] = input.value;
    });

    const btn = document.querySelector('#settingsView .accent-btn');
    const originalText = btn.textContent;
    btn.disabled = true;
    btn.textContent = '儲存中...';

    callApi('saveSiteSettings', { settings: newSettings })
        .then(data => {
            if (data.success) {
                showToast('網站設定已儲存', 'success');
                currentSettings = newSettings;
            } else {
                alert('儲存失敗: ' + data.error);
            }
        })
        .catch(err => {
            alert('儲存失敗: ' + err);
        })
        .finally(() => {
            btn.disabled = false;
            btn.textContent = originalText;
        });
}

// ----------------------------------------------------
// 採買統計
// ----------------------------------------------------

async function loadPurchasingStats() {
    const startDate = document.getElementById('statsStartDate').value;
    const endDate = document.getElementById('statsEndDate').value;

    if (!startDate || !endDate) {
        showToast('請選擇日期範圍', 'error');
        return;
    }

    const tbody = document.getElementById('purchasingStatsBody');
    tbody.innerHTML = '<tr><td colspan="4" style="text-align:center">計算中...</td></tr>';

    showLoadingOverlay(); // Show loading

    try {
        const result = await callApi('getPurchasingStats', { startDate, endDate });
        if (result.success) {
            renderPurchasingStats(result.data.stats);
        } else {
            showToast('採買統計載入失敗: ' + result.error, 'error');
            tbody.innerHTML = '<tr><td colspan="4" style="text-align:center; color:red">載入失敗</td></tr>';
        }
    } catch (e) {
        console.error(e);
        tbody.innerHTML = '<tr><td colspan="4" style="text-align:center; color:red">連線錯誤</td></tr>';
    } finally {
        hideLoadingOverlay(); // Hide loading
    }
}

function renderPurchasingStats(stats) {
    const tbody = document.getElementById('purchasingStatsBody');
    const totalTypesEl = document.getElementById('statsTotalTypes');
    const totalQtyEl = document.getElementById('statsTotalQty');

    if (!stats || stats.length === 0) {
        tbody.innerHTML = '<tr><td colspan="4" style="text-align:center">此期間無訂單資料</td></tr>';
        totalTypesEl.textContent = '0';
        totalQtyEl.textContent = '0';
        return;
    }

    let totalQty = 0;
    let html = '';

    stats.forEach((item, index) => {
        totalQty += item.totalQty;
        const detailRows = (item.details || []).map(d => `
            <div style="font-size: 0.85em; padding: 4px 0; border-bottom: 1px dashed #eee; display: flex; justify-content: space-between;">
                <span>• <strong>${d.customerName}</strong> (${d.orderId})：${d.qty} 件</span>
                <span style="color: #666;">[${d.status}] ${d.date}</span>
            </div>
        `).join('');

        html += `
            <tr onclick="togglePurchasingDetail(${index})" style="cursor: pointer;">
                <td><strong>${item.name}</strong></td>
                <td>${item.spec || '無規格'}</td>
                <td style="color: #e91e63; font-weight: bold; font-size: 1.1em">${item.totalQty}</td>
                <td>${item.orderCount} 筆 </td>
            </tr>
            <tr id="purchasing-detail-${index}" style="display: none; background: #fffafb;">
                <td colspan="4">
                    <div style="padding: 10px 15px; border-left: 3px solid var(--accent);">
                        <div style="font-weight: bold; margin-bottom: 5px; font-size: 0.9em;">訂單明細：</div>
                        ${detailRows}
                    </div>
                </td>
            </tr>
        `;
    });

    tbody.innerHTML = html;
    totalTypesEl.textContent = stats.length;
    totalQtyEl.textContent = totalQty;
}

function togglePurchasingDetail(index) {
    const row = document.getElementById(`purchasing-detail-${index}`);
    if (row) {
        row.style.display = row.style.display === 'none' ? 'table-row' : 'none';
    }
}

function setStatsShortcut(type) {
    const startInput = document.getElementById('statsStartDate');
    const endInput = document.getElementById('statsEndDate');
    const now = new Date();
    const today = now.toISOString().split('T')[0];

    if (type === 'today') {
        startInput.value = today;
        endInput.value = today;
    } else if (type === 'yesterday') {
        const yesterday = new Date(now);
        yesterday.setDate(now.getDate() - 1);
        const yStr = yesterday.toISOString().split('T')[0];
        startInput.value = yStr;
        endInput.value = yStr;
    } else if (type === '7days') {
        const sevenDaysAgo = new Date(now);
        sevenDaysAgo.setDate(now.getDate() - 6);
        startInput.value = sevenDaysAgo.toISOString().split('T')[0];
        endInput.value = today;
    }

    loadPurchasingStats();
}

function exportPurchasingStats() {
    const startDate = document.getElementById('statsStartDate').value;
    const endDate = document.getElementById('statsEndDate').value;
    const tbody = document.getElementById('purchasingStatsBody');
    const rows = tbody.querySelectorAll('tr');

    if (rows.length === 0 || rows[0].innerText.includes('無訂單') || rows[0].innerText.includes('請選擇')) {
        showToast('無資料可匯出', 'error');
        return;
    }

    let csvContent = "\ufeff商品名稱,規格/款式,採買數量,涉及訂單數\n";

    rows.forEach(row => {
        const cells = row.querySelectorAll('td');
        if (cells.length === 4) {
            const name = cells[0].innerText.replace(/,/g, '');
            const spec = cells[1].innerText.replace(/,/g, '');
            const qty = cells[2].innerText;
            const orders = cells[3].innerText;
            csvContent += `${name},${spec},${qty},${orders}\n`;
        }
    });

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `採買清單_${startDate}_${endDate}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    showToast('匯出成功');
}
function renderSpecBuilder(options = {}) {
    const container = document.getElementById('specBuilderContainer');
    if (!container) return;
    container.innerHTML = '';

    // options 可能格式: { "顏色": ["紅", "藍"] } 或 [ {name: "顏色", values: ["紅", "藍"]} ]
    let normalizedOptions = [];
    if (Array.isArray(options)) {
        normalizedOptions = options;
    } else if (typeof options === 'object' && options !== null) {
        normalizedOptions = Object.entries(options).map(([name, values]) => ({
            name: name,
            values: Array.isArray(values) ? values : [values]
        }));
    }

    if (normalizedOptions.length === 0) {
        // 預設給一個空的列
        addSpecGroup();
    } else {
        normalizedOptions.forEach(opt => {
            addSpecGroup(opt.name, opt.values.join(','));
        });
    }
}

function addSpecGroup(name = '', values = '') {
    const container = document.getElementById('specBuilderContainer');
    const div = document.createElement('div');
    div.className = 'spec-group-row';
    div.innerHTML = `
        <input type="text" placeholder="類別 (如：尺寸)" class="group-name" value="${name}">
        <input type="text" placeholder="選項用逗號分開 (如：S,M,L)" class="group-values" value="${values}">
        <button type="button" class="remove-btn" onclick="this.parentElement.remove()">✕</button>
    `;
    container.appendChild(div);
}

function getSpecData() {
    const container = document.getElementById('specBuilderContainer');
    const rows = container.querySelectorAll('.spec-group-row');
    const result = {};

    rows.forEach(row => {
        const name = row.querySelector('.group-name').value.trim();
        const values = row.querySelector('.group-values').value.trim();
        if (name && values) {
            result[name] = values.split(',').map(v => v.trim()).filter(v => v !== '');
        }
    });

    return result;
}

// ----------------------
// 規格明細表格 (Variants)
// ----------------------
let currentProductVariants = []; // 暫存編輯中的 variants

/**
 * 產生所有規格組合
 * 例如：{ "顏色": ["黑", "紅"], "尺寸": ["S", "M"] }
 * 會產生：["黑/S", "黑/M", "紅/S", "紅/M"]
 */
function generateVariantCombinations(options) {
    const keys = Object.keys(options);
    if (keys.length === 0) return [];

    // 取得所有 values 陣列
    const valueArrays = keys.map(k => options[k]);

    // 計算笛卡爾積
    function cartesian(arrays) {
        if (arrays.length === 0) return [[]];
        const [first, ...rest] = arrays;
        const restCombinations = cartesian(rest);
        const result = [];
        for (const item of first) {
            for (const combo of restCombinations) {
                result.push([item, ...combo]);
            }
        }
        return result;
    }

    const combinations = cartesian(valueArrays);
    return combinations.map(combo => combo.join('/'));
}

/**
 * 更新規格明細表格
 * 根據目前規格產生器的內容，產生或更新表格
 */
function updateVariantsTable() {
    const options = getSpecData();
    const combinations = generateVariantCombinations(options);
    const section = document.getElementById('variantsSection');

    if (combinations.length === 0) {
        section.style.display = 'none';
        return;
    }

    section.style.display = 'block';

    // 取得預設價格和庫存
    const defaultPrice = Number(document.getElementById('prodPrice').value) || 0;
    const defaultCost = Number(document.getElementById('prodCost').value) || 0; // 預設成本
    const defaultStock = Number(document.getElementById('prodStock').value) || 99;

    // 取得商品圖片列表 (供圖片選擇)
    const imageList = getProductImageList();

    const tbody = document.getElementById('variantsTableBody');
    tbody.innerHTML = combinations.map((spec, index) => {
        // 嘗試找到現有的 variant 資料
        const existingVariant = currentProductVariants.find(v => v.spec === spec) || {};
        const price = existingVariant.price !== undefined ? existingVariant.price : defaultPrice;
        const cost = existingVariant.cost !== undefined ? existingVariant.cost : defaultCost; // 成本
        const stock = existingVariant.stock !== undefined ? existingVariant.stock : defaultStock;
        const image = existingVariant.image || '';

        // 產生圖片選擇下拉選單 (使用 modalImages)
        const imageOptions = ['<option value="">不指定</option>']
            .concat(modalImages.map((img, i) => {
                const isNew = img.type === 'new';
                // 使用 tempId 或 url
                const val = isNew ? img.tempId : img.value;
                const selected = val === image ? 'selected' : '';
                const shortName = `圖片 ${i + 1}${isNew ? ' (待上傳)' : ''}`;
                return `<option value="${val}" ${selected}>${shortName}</option>`;
            }))
            .join('');

        // 圖片預覽
        const imagePreview = image
            ? `<img src="${image}" class="variant-thumb">`
            : '<div class="variant-thumb-placeholder">📷</div>';

        return `
            <tr data-spec="${spec}">
                <td><input type="checkbox" class="variant-checkbox"></td>
                <td>
                    <div class="variant-image-cell">
                        ${imagePreview}
                        <select class="variant-image-select" onchange="updateVariantImagePreview(this)">
                            ${imageOptions}
                        </select>
                    </div>
                </td>
                <td class="variant-spec">${spec}</td>
                <td><input type="number" class="variant-cost" value="${cost}" min="0"></td>
                <td><input type="number" class="variant-price" value="${price}" min="0"></td>
                <td><input type="number" class="variant-stock" value="${stock}" min="0"></td>
            </tr>
        `;
    }).join('');
}

/**
 * 更新 variant 圖片預覽
 */
function updateVariantImagePreview(selectEl) {
    const url = selectEl.value;
    const cell = selectEl.closest('.variant-image-cell');
    const existingImg = cell.querySelector('.variant-thumb, .variant-thumb-placeholder');

    if (existingImg) existingImg.remove();

    if (val) {
        const img = document.createElement('img');
        img.className = 'variant-thumb';

        // 檢查是否為 tempId
        if (String(val).startsWith('temp_')) {
            // 從 modalImages 查找
            const target = modalImages.find(m => m.tempId === val);
            if (target && target.preview) {
                img.src = target.preview;
            } else {
                img.src = ''; // 尚未生成預覽
            }
        } else {
            img.src = val;
        }

        cell.insertBefore(img, selectEl);
    } else {
        const placeholder = document.createElement('div');
        placeholder.className = 'variant-thumb-placeholder';
        placeholder.textContent = '📷';
        cell.insertBefore(placeholder, selectEl);
    }
}

/**
 * 取得商品已上傳的圖片列表
 */
function getProductImageList() {
    const imageValue = document.getElementById('prodImage').value;
    if (!imageValue) return [];
    return imageValue.split(',').map(url => url.trim()).filter(url => url !== '');
}

/**
 * 從表格收集 variants 資料
 */
function getVariantsData() {
    const tbody = document.getElementById('variantsTableBody');
    if (!tbody) return [];

    const rows = tbody.querySelectorAll('tr');
    const variants = [];

    rows.forEach(row => {
        const spec = row.dataset.spec;
        const price = Number(row.querySelector('.variant-price').value) || 0;
        const cost = Number(row.querySelector('.variant-cost').value) || 0; // 收集成本
        const stock = Number(row.querySelector('.variant-stock').value) || 0;
        const imageSelect = row.querySelector('.variant-image-select');
        const image = imageSelect ? imageSelect.value : '';

        variants.push({ spec, price, cost, stock, image });
    });

    return variants;
}

/**
 * 全選/取消全選 variants
 */
function toggleAllVariants(checkbox) {
    const checkboxes = document.querySelectorAll('#variantsTableBody .variant-checkbox');
    checkboxes.forEach(cb => cb.checked = checkbox.checked);
}

/**
 * 監聽規格產生器變更，自動更新 variants 表格
 */
function setupSpecBuilderListeners() {
    const container = document.getElementById('specBuilderContainer');
    if (!container) return;

    // 使用事件委派監聽輸入變更
    container.addEventListener('input', debounce(() => {
        // 先保存目前表格的資料
        const currentData = getVariantsData();
        currentProductVariants = currentData;
        // 重新產生表格
        updateVariantsTable();
    }, 500));
}

// Debounce 函數
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

// 在 DOMContentLoaded 時設定監聽器
document.addEventListener('DOMContentLoaded', () => {
    setupSpecBuilderListeners();
});

/**
 * 在圖片上傳成功後，即時刷新規格表格中的圖片下拉選單
 */
function updateVariantImageSelects() {
    const section = document.getElementById('variantsSection');
    if (section.style.display === 'none') return;

    // 使用 modalImages 作為來源，因為 prodImage value 此時可能還是空的或是舊的
    const selects = document.querySelectorAll('.variant-image-select');

    selects.forEach(select => {
        const currentVal = select.value;
        const imageOptions = ['<option value="">不指定</option>']
            .concat(modalImages.map((img, i) => {
                const isNew = img.type === 'new';
                // 對於 new，value 使用 tempId；對於 existing，使用 url
                const val = isNew ? img.tempId : img.value;
                const isSelected = val === currentVal ? 'selected' : '';
                const shortName = `圖片 ${i + 1}${isNew ? ' (待上傳)' : ''}`;
                return `<option value="${val}" ${isSelected}>${shortName}</option>`;
            }))
            .join('');
        select.innerHTML = imageOptions;

        // 觸發預覽更新
        updateVariantImagePreview(select);
    });
}

window.addEventListener('beforeunload', function (e) {
    // 檢查是否有待處理的更新
    if (typeof pendingProductUpdates !== 'undefined' && pendingProductUpdates.length > 0) {
        e.preventDefault();
        e.returnValue = ''; // Chrome 需要此屬性
        return '';
    }
});



// 更新商品單價
function updateItemPrice(index, newPrice) {
    if (index >= 0 && index < tempOrderItems.length) {
        const item = tempOrderItems[index];
        const price = parseFloat(newPrice);

        if (!isNaN(price) && price >= 0) {
            item.price = price;
            item.subtotal = item.qty * price;
            renderOrderItems();
            console.log('更新商品單價:', item.name, price);
        } else {
            alert('請輸入有效的價格');
            renderOrderItems(); // 重置回原值
        }
    }
}

// ============================================================
// 網站生成器
// ============================================================

/**
 * 新網站 Logo 選擇處理
 */
async function handleNewSiteLogoSelect(input) {
    if (!input.files || !input.files[0]) return;

    const file = input.files[0];
    const statusEl = document.getElementById('newSiteLogoStatus');

    // 驗證檔案大小 (最大 2MB)
    if (file.size > 2 * 1024 * 1024) {
        statusEl.innerHTML = '<span style="color: red;">❌ 檔案過大，請選擇 2MB 以下的圖片</span>';
        return;
    }

    // 驗證檔案類型
    if (!file.type.startsWith('image/')) {
        statusEl.innerHTML = '<span style="color: red;">❌ 請選擇圖片檔案</span>';
        return;
    }

    statusEl.innerHTML = '<span style="color: #666;">⏳ 上傳中...</span>';

    try {
        // 讀取為 base64
        const reader = new FileReader();
        reader.onload = async function (e) {
            const base64Data = e.target.result;

            // 嘗試上傳到 GitHub
            try {
                const result = await callApi('uploadLogo', {
                    imageData: base64Data,
                    fileName: file.name
                });

                if (result.success && result.data && result.data.url) {
                    // 使用上傳後的 URL
                    document.getElementById('newSiteLogoUrl').value = result.data.url;
                    document.getElementById('newSiteLogoImg').src = result.data.url;
                    statusEl.innerHTML = '<span style="color: green;">✅ Logo 上傳成功</span>';
                } else {
                    // 備用：直接使用 base64 (較大但可用)
                    document.getElementById('newSiteLogoUrl').value = base64Data;
                    document.getElementById('newSiteLogoImg').src = base64Data;
                    statusEl.innerHTML = '<span style="color: orange;">⚠️ 已使用內嵌圖片</span>';
                }
            } catch (e) {
                // 備用方案：直接使用 base64
                document.getElementById('newSiteLogoUrl').value = base64Data;
                document.getElementById('newSiteLogoImg').src = base64Data;
                statusEl.innerHTML = '<span style="color: orange;">⚠️ 已使用內嵌圖片</span>';
            }

            // 顯示預覽
            document.getElementById('newSiteLogoImg').style.display = 'block';
            document.getElementById('newSiteNoLogoText').style.display = 'none';
            document.getElementById('newSiteLogoRemoveBtn').style.display = 'inline-block';
        };
        reader.onerror = function () {
            statusEl.innerHTML = '<span style="color: red;">❌ 讀取圖片失敗</span>';
        };
        reader.readAsDataURL(file);
    } catch (error) {
        statusEl.innerHTML = `<span style="color: red;">❌ 上傳失敗: ${error.message}</span>`;
    }
}

/**
 * 移除新網站 Logo
 */
function removeNewSiteLogo() {
    document.getElementById('newSiteLogoUrl').value = '';
    document.getElementById('newSiteLogoImg').src = '';
    document.getElementById('newSiteLogoImg').style.display = 'none';
    document.getElementById('newSiteNoLogoText').style.display = 'block';
    document.getElementById('newSiteLogoRemoveBtn').style.display = 'none';
    document.getElementById('newSiteLogoStatus').textContent = '';
    document.getElementById('newSiteLogoInput').value = '';
}

/**
 * 產生新的獨立網站
 */
async function generateNewSite() {
    const siteId = document.getElementById('newSiteId').value.trim();
    const siteName = document.getElementById('newSiteName').value.trim();
    const apiUrl = document.getElementById('newSiteApiUrl').value.trim();
    const siteDescription = document.getElementById('newSiteDescription').value.trim();

    // 驗證
    if (!siteId || !siteName || !apiUrl) {
        alert('請填寫所有必填欄位 (網站 ID、名稱、GAS API URL)');
        return;
    }

    // 驗證 ID 格式
    if (!/^[a-z0-9_]+$/.test(siteId)) {
        alert('網站 ID 僅限使用英文小寫、數字和底線');
        return;
    }

    // 驗證 URL 格式
    if (!apiUrl.startsWith('https://script.google.com/macros/')) {
        alert('GAS API URL 格式不正確，請確認是否為 Google Apps Script 部署網址');
        return;
    }

    showLoadingOverlay();

    try {
        const result = await callApi('createNewSite', {
            siteId: siteId,
            siteName: siteName,
            apiUrl: apiUrl,
            siteDescription: siteDescription,
            logoUrl: document.getElementById('newSiteLogoUrl').value || ''
        });

        hideLoadingOverlay();

        if (result.success) {
            // 使用後端回傳的 URL (新版)，如果沒有則使用前端產生的 (向後兼容)
            const baseUrl = 'https://vvstudiocode.github.io/korea';
            const storeUrl = result.data.storeUrl || `${baseUrl}/stores/${siteId}/`;
            const adminUrl = result.data.adminUrl || `${baseUrl}/stores/${siteId}/admin.html`;

            // 顯示結果
            const resultDiv = document.getElementById('siteGeneratorResult');
            resultDiv.style.display = 'block';

            const storeUrlLink = document.getElementById('generatedStoreUrl');
            const adminUrlLink = document.getElementById('generatedAdminUrl');

            storeUrlLink.href = storeUrl;
            storeUrlLink.textContent = storeUrl;

            adminUrlLink.href = adminUrl;
            adminUrlLink.textContent = adminUrl;

            showToast('網站產生成功！檔案已在 GitHub 建立，約 1-2 分鐘後生效', 'success');

            // 重新載入列表
            loadGeneratedSites();
        } else {
            alert('產生失敗：' + (result.error || result.message || '未知錯誤'));
        }
    } catch (error) {
        hideLoadingOverlay();
        alert('產生失敗：' + error.message);
        console.error('generateNewSite error:', error);
    }
}

/**
 * 載入已生成的網站列表
 */
async function loadGeneratedSites() {
    try {
        const result = await callApi('getGeneratedSites');
        if (result.success) {
            renderGeneratedSites(result.data.sites || []);
        } else {
            console.error('loadGeneratedSites error:', result.error);
        }
    } catch (error) {
        console.error('loadGeneratedSites error:', error);
    }
}

/**
 * 渲染已生成的網站列表
 */
function renderGeneratedSites(sites) {
    const tbody = document.getElementById('generatedSitesTableBody');

    if (!sites || sites.length === 0) {
        tbody.innerHTML = '<tr><td colspan="4" style="text-align:center;color:#888;">尚未生成任何網站</td></tr>';
        return;
    }

    // 產生前後台 URL
    const baseUrl = 'https://vvstudiocode.github.io/korea';

    tbody.innerHTML = sites.map(site => {
        const createdDate = site.createdAt ? new Date(site.createdAt).toLocaleDateString('zh-TW') : '-';
        // 取得正確的欄位 (後端用 id/name，前端需轉換)
        const siteId = site.id || site.siteId;
        const siteName = site.name || site.siteName;
        const storeUrl = site.storeUrl || `${baseUrl}/stores/${siteId}/`;
        const adminUrl = site.adminUrl || `${baseUrl}/stores/${siteId}/admin.html`;

        // 準備傳給編輯函數的資料，統一格式
        const siteData = {
            siteId: siteId,
            siteName: siteName,
            apiUrl: site.apiUrl,
            storeUrl: storeUrl,
            adminUrl: adminUrl
        };
        const editData = encodeURIComponent(JSON.stringify(siteData));

        return `
            <tr>
                <td>${siteId}</td>
                <td>${siteName}</td>
                <td>${createdDate}</td>
                <td>
                    <a href="${storeUrl}" target="_blank" class="btn-small">前台</a>
                    <a href="${adminUrl}" target="_blank" class="btn-small">後台</a>
                    <button class="btn-small" onclick="editGeneratedSiteUI('${editData}')">編輯</button>
                    <button class="btn-small" style="background:#dc3545;color:white;border:none;" onclick="deleteGeneratedSiteUI('${siteId}')">刪除</button>
                </td>
            </tr>
        `;
    }).join('');
}

/**
 * UI 操作：刪除生成網站
 */
async function deleteGeneratedSiteUI(siteId) {
    if (!confirm(`確定要刪除網站 ${siteId} 嗎？\n此動作將無法復原，並會從 GitHub 移除該網站資料夾。`)) {
        return;
    }

    showLoadingOverlay();

    try {
        const result = await callApi('deleteSite', { siteId: siteId });
        hideLoadingOverlay();

        if (result.success) {
            showToast('網站已刪除', 'success');
            loadGeneratedSites(); // 重新整理列表
        } else {
            alert('刪除失敗：' + (result.error || '未知錯誤'));
        }
    } catch (error) {
        hideLoadingOverlay();
        alert('刪除失敗：' + error.message);
    }
}

/**
 * 開啟網站生成器 Modal (新增模式)
 */
function openSiteGeneratorModal() {
    resetSiteGeneratorForm();
    document.getElementById('siteGenModalTitle').textContent = '建立新網站';

    const btn = document.getElementById('btnGenerateSite');
    btn.textContent = '🚀 產生網站';
    btn.onclick = generateNewSite;

    openModal('siteGeneratorModal');
}

/**
 * UI 操作：編輯生成網站 (帶入資料到 Modal)
 */
function editGeneratedSiteUI(encodedData) {
    try {
        const site = JSON.parse(decodeURIComponent(encodedData));

        // 填入表單
        document.getElementById('newSiteId').value = site.siteId;
        document.getElementById('newSiteName').value = site.siteName;
        document.getElementById('newSiteApiUrl').value = site.apiUrl;
        document.getElementById('newSiteDescription').value = '';

        // ID 欄位設為唯讀
        document.getElementById('newSiteId').disabled = true;
        document.getElementById('newSiteId').style.backgroundColor = '#f0f0f0';

        // 修改 Modal 標題與按鈕
        document.getElementById('siteGenModalTitle').textContent = '編輯網站設定';

        const btn = document.getElementById('btnGenerateSite');
        btn.textContent = '💾 更新網站設定';
        btn.onclick = () => updateGeneratedSiteUI(site.siteId);

        // 開啟 Modal
        openModal('siteGeneratorModal');

    } catch (e) {
        console.error('editGeneratedSiteUI error:', e);
    }
}

/**
 * 重置生成器表單 & 關閉 Modal
 */
function resetSiteGeneratorForm() {
    document.getElementById('newSiteId').value = '';
    document.getElementById('newSiteId').disabled = false;
    document.getElementById('newSiteId').style.backgroundColor = '';

    document.getElementById('newSiteName').value = '';
    document.getElementById('newSiteApiUrl').value = '';
    document.getElementById('newSiteDescription').value = '';

    // 清除 Logo 狀態
    document.getElementById('newSiteLogoUrl').value = '';
    document.getElementById('newSiteLogoImg').src = '';
    document.getElementById('newSiteLogoImg').style.display = 'none';
    document.getElementById('newSiteNoLogoText').style.display = 'block';
    document.getElementById('newSiteLogoRemoveBtn').style.display = 'none';
    document.getElementById('newSiteLogoStatus').textContent = '';
    document.getElementById('newSiteLogoInput').value = '';

    // 隱藏結果區
    document.getElementById('siteGeneratorResult').style.display = 'none';

    // 如果 Modal 是開著的，可以選擇關閉它 (或只清空)
    // 這裡我們選擇只在成功後關閉，或手動取消。
    // 但此函數也被用來初始化，所以不強制關閉。

    // 如果是成功後的呼叫，通常會有一個 flag 或直接 close
    // 暫時這裡只做清空。關閉動作由呼叫者決定 (例如 generateNewSite 成功後)
    closeModal('siteGeneratorModal');
}

/**
 * UI 操作：執行更新
 */
async function updateGeneratedSiteUI(siteId) {
    const siteName = document.getElementById('newSiteName').value.trim();
    const apiUrl = document.getElementById('newSiteApiUrl').value.trim();
    const siteDescription = document.getElementById('newSiteDescription').value.trim();

    if (!siteName || !apiUrl) {
        alert('名稱與 API URL 為必填');
        return;
    }

    showLoadingOverlay();

    try {
        const result = await callApi('updateSite', {
            siteId: siteId,
            siteName: siteName,
            apiUrl: apiUrl,
            siteDescription: siteDescription
        });

        hideLoadingOverlay();

        if (result.success) {
            showToast('網站更新成功！', 'success');

            // 重置表單狀態
            resetSiteGeneratorForm();
            loadGeneratedSites();

        } else {
            alert('更新失敗：' + (result.error || '未知錯誤'));
        }
    } catch (error) {
        hideLoadingOverlay();
        alert('更新失敗：' + error.message);
    }
}

/**
 * 重置生成器表單
 */
function resetSiteGeneratorForm() {
    const siteIdField = document.getElementById('newSiteId');
    if (siteIdField) {
        siteIdField.value = '';
        siteIdField.disabled = false;
        siteIdField.style.backgroundColor = '';
    }

    const siteNameField = document.getElementById('newSiteName');
    if (siteNameField) siteNameField.value = '';

    const apiUrlField = document.getElementById('newSiteApiUrl');
    if (apiUrlField) apiUrlField.value = '';

    const descField = document.getElementById('newSiteDescription');
    if (descField) descField.value = '';

    // 恢復 Modal 按鈕
    const btn = document.getElementById('btnGenerateSite');
    if (btn) {
        btn.textContent = '🚀 產生網站';
        btn.onclick = generateNewSite;
    }

    // 隱藏結果區
    const resultDiv = document.getElementById('siteGeneratorResult');
    if (resultDiv) resultDiv.style.display = 'none';
}

// ----------------------
// 網站設定
// ----------------------
function loadSettings() {
    showLoadingOverlay();
    callApi('getSiteSettings')
        .then(data => {
            if (data.success && data.data.settings) {
                const s = data.data.settings;
                document.getElementById('settingBankCode').value = s.bankCode || '';
                document.getElementById('settingBankAccount').value = s.bankAccount || '';
                document.getElementById('settingBankNote').value = s.bankNote || '';

                const siteNameInput = document.getElementById('settingSiteName');
                if (siteNameInput) siteNameInput.value = s.siteName || '';

                const siteDescInput = document.getElementById('settingSiteDescription');
                if (siteDescInput) siteDescInput.value = s.siteDescription || '';

                const paymentNoteInput = document.getElementById('settingPaymentNote');
                if (paymentNoteInput) paymentNoteInput.value = s.paymentNote || '';
            }
        })
        .finally(() => hideLoadingOverlay());
}

// 載入網站設定 (對應新版 UI)
function loadSettings() {
    const btn = document.querySelector('#settingsView button');
    if (btn) btn.disabled = true;

    callApi('getSiteSettings')
        .then(data => {
            if (data.success) {
                const s = data.data.settings || {};

                // 填入銀行資訊 & 匯款完成提示
                const bankNameInput = document.getElementById('settingBankName');
                const bankCodeInput = document.getElementById('settingBankCode');
                const bankAccountInput = document.getElementById('settingBankAccount');
                const bankNoteInput = document.getElementById('settingBankNote');
                const paymentNoteInput = document.getElementById('settingPaymentNote');

                if (bankNameInput) bankNameInput.value = s.bankName || '';
                if (bankCodeInput) bankCodeInput.value = s.bankCode || '';
                if (bankAccountInput) bankAccountInput.value = s.bankAccount || '';
                if (bankNoteInput) bankNoteInput.value = s.bankNote || '';
                if (paymentNoteInput) paymentNoteInput.value = s.paymentNote || '';

                // 處理 Logo 顯示
                const logoPreview = document.getElementById('currentLogoPreview');
                const noLogoText = document.getElementById('noLogoText');
                const deleteBtn = document.getElementById('deleteLogoBtn');

                if (logoPreview && noLogoText && deleteBtn) {
                    if (s.logoUrl) {
                        logoPreview.src = s.logoUrl;
                        logoPreview.style.display = 'block';
                        // 清除 pending 狀態，確保儲存時不會誤判
                        logoPreview.removeAttribute('data-pending-url');

                        noLogoText.style.display = 'none';
                        deleteBtn.style.display = 'inline-block';
                    } else {
                        logoPreview.src = '';
                        logoPreview.style.display = 'none';
                        logoPreview.removeAttribute('data-pending-url');

                        noLogoText.style.display = 'block';
                        deleteBtn.style.display = 'none';
                    }
                }
            } else {
                showToast('載入設定失敗: ' + data.error, 'error');
            }
        })
        .catch(err => {
            showToast('載入設定錯誤: ' + err, 'error');
        })
        .finally(() => {
            if (btn) btn.disabled = false;
        });
}

// 處理 Logo 選擇與上傳
function handleLogoSelect(input) {
    if (input.files && input.files[0]) {
        const file = input.files[0];
        // 限制檔案大小 (例如 2MB)
        if (file.size > 2 * 1024 * 1024) {
            alert('檔案太大，請選擇小於 2MB 的圖片');
            input.value = '';
            return;
        }

        const reader = new FileReader();
        const statusDiv = document.getElementById('logoUploadStatus');
        if (statusDiv) {
            statusDiv.textContent = '正在上傳 Logo...';
            statusDiv.style.color = 'blue';
        }

        reader.onload = function (e) {
            const base64Content = e.target.result.split(',')[1];
            const mimeType = file.type;
            const fileName = 'logo_' + Date.now() + '_' + file.name.replace(/[^a-zA-Z0-9\._-]/g, '');

            callApi('uploadImageToGitHub', {
                fileName: fileName,
                content: base64Content,
                mimeType: mimeType,
                brand: 'logos'
            }).then(resp => {
                if (resp.success) {
                    const logoUrl = resp.data.url;

                    const logoPreview = document.getElementById('currentLogoPreview');
                    const noLogoText = document.getElementById('noLogoText');
                    const deleteBtn = document.getElementById('deleteLogoBtn');

                    if (logoPreview) {
                        logoPreview.src = logoUrl;
                        logoPreview.style.display = 'block';
                        // 標記為待儲存的新 URL
                        logoPreview.dataset.pendingUrl = logoUrl;
                    }
                    if (noLogoText) noLogoText.style.display = 'none';
                    if (deleteBtn) deleteBtn.style.display = 'inline-block';

                    if (statusDiv) {
                        statusDiv.textContent = 'Logo 上傳成功！請記得點擊下方「儲存設定」按鈕以套用變更。';
                        statusDiv.style.color = 'green';
                    }
                } else {
                    if (statusDiv) {
                        statusDiv.textContent = 'Logo 上傳失敗: ' + resp.error;
                        statusDiv.style.color = 'red';
                    }
                    input.value = ''; // 清除選擇
                }
            }).catch(err => {
                if (statusDiv) {
                    statusDiv.textContent = '上傳錯誤: ' + err;
                    statusDiv.style.color = 'red';
                }
            });
        };
        reader.readAsDataURL(file);
    }
}

// 刪除 Logo
function deleteLogo() {
    if (confirm('確定要移除網站 Logo 嗎？(需按下儲存設定才會生效)')) {
        const logoPreview = document.getElementById('currentLogoPreview');
        const noLogoText = document.getElementById('noLogoText');
        const deleteBtn = document.getElementById('deleteLogoBtn');
        const fileInput = document.getElementById('logoFileInput');
        const statusDiv = document.getElementById('logoUploadStatus');

        if (logoPreview) {
            logoPreview.style.display = 'none';
            logoPreview.src = '';
            // 標記為刪除
            logoPreview.dataset.pendingUrl = 'DELETE';
        }
        if (noLogoText) noLogoText.style.display = 'block';
        if (deleteBtn) deleteBtn.style.display = 'none';
        if (fileInput) fileInput.value = '';
        if (statusDiv) statusDiv.textContent = 'Logo 已移除，請點擊「儲存設定」以確認。';
    }
}

function saveSettings() {
    // 顯示 Loading overlay
    showLoadingOverlay();

    // 準備設定物件
    const settings = {
        siteName: document.getElementById('settingSiteName').value.trim(),
        siteDescription: document.getElementById('settingSiteDescription').value.trim(),
        bankName: document.getElementById('settingBankName').value.trim(),
        bankCode: document.getElementById('settingBankCode').value.trim(),
        bankAccount: document.getElementById('settingBankAccount').value.trim(),
        bankNote: document.getElementById('settingBankNote').value.trim(),
        paymentNote: document.getElementById('settingPaymentNote').value.trim()
    };

    // 處理 Logo URL
    const logoPreview = document.getElementById('currentLogoPreview');
    if (logoPreview) {
        const pendingUrl = logoPreview.dataset.pendingUrl;
        if (pendingUrl === 'DELETE') {
            settings.logoUrl = '';
        } else if (pendingUrl) {
            settings.logoUrl = pendingUrl;
        } else {
            // 如果沒有變更，使用目前的 src (如果有的話)
            // 注意：需排除 empty src 或 placeholder
            if (logoPreview.style.display !== 'none' && logoPreview.src) {
                settings.logoUrl = logoPreview.src;
            } else {
                settings.logoUrl = '';
            }
        }
    }

    const btn = document.querySelector('#settingsView button');
    if (btn) {
        btn.disabled = true;
        btn.textContent = '儲存中...';
    }

    callApi('saveSiteSettings', { settings })
        .then(data => {
            if (data.success) {
                showToast('設定已儲存', 'success');
                // 成功後，清除 pending 狀態並重新載入確保一致性 (或手動更新狀態)
                if (logoPreview) logoPreview.removeAttribute('data-pending-url');
                const statusDiv = document.getElementById('logoUploadStatus');
                if (statusDiv) statusDiv.textContent = '';
            } else {
                showToast('儲存失敗: ' + data.error, 'error');
            }
        })
        .finally(() => {
            // 隱藏 Loading overlay
            hideLoadingOverlay();
            if (btn) {
                btn.disabled = false;
                btn.textContent = '💾 儲存設定';
            }
        });
}
