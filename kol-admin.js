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
let selectedPickerIds = new Set(); // 新增：多選狀態

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

function showLoadingOverlay(message = '處理中...') {
    let overlay = document.getElementById('loadingOverlay');
    if (!overlay) {
        overlay = document.createElement('div');
        overlay.id = 'loadingOverlay';
        overlay.style.cssText = `
            position: fixed; top: 0; left: 0; width: 100%; height: 100%;
            background: rgba(0,0,0,0.5); z-index: 9999;
            display: flex; flex-direction: column; align-items: center; justify-content: center;
            color: white; font-size: 1.2rem;
        `;
        overlay.innerHTML = '<div class="spinner" style="border: 4px solid #f3f3f3; border-top: 4px solid #3498db; border-radius: 50%; width: 40px; height: 40px; animation: spin 1s linear infinite; margin-bottom: 15px;"></div><div id="loadingMessage"></div>';

        // Add spinner animation style
        const style = document.createElement('style');
        style.textContent = '@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }';
        document.head.appendChild(style);

        document.body.appendChild(overlay);
    }
    document.getElementById('loadingMessage').textContent = message;
    overlay.style.display = 'flex';
}

function hideLoadingOverlay() {
    const overlay = document.getElementById('loadingOverlay');
    if (overlay) overlay.style.display = 'none';
}

// API 呼叫輔助函數 (for PageBuilder)
function callApi(subAction, payload = {}) {
    // 映射舊的 action 名稱到新的 KOL action
    const actionMap = {
        'saveLayoutToGitHub': 'kolSaveLayout'
    };

    const mappedAction = actionMap[subAction] || subAction;

    // 防止 payload 中的 storeId 為 null/undefined 覆蓋原本的 kolStoreId
    if (payload.storeId === null || payload.storeId === undefined) {
        delete payload.storeId;
    }

    const requestBody = {
        action: 'kolAction',
        subAction: mappedAction,
        storeId: kolStoreId,
        token: kolToken,
        ...payload
    };

    return fetch(GAS_API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify(requestBody)
    }).then(res => res.json());
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

async function kolSwitchTab(tabId) {
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

        // 確保商品資料已載入，用於排版預覽
        if (kolProducts.length === 0 && typeof loadMyProducts === 'function') {
            console.log('📦 排版管理：先載入商品資料...');
            await loadMyProducts();
        }

        // 確保 PageRenderer 知道現在是 KOL 模式 (防止載入總部商品或重新 fetch)
        if (typeof PageRenderer !== 'undefined') {
            PageRenderer.currentStoreId = kolStoreId;
            console.log('🎨 設定 PageRenderer.currentStoreId =', kolStoreId);
        }

        // 每次切換到排版管理都重新初始化（因為 init 時元素可能隱藏）
        if (typeof PageBuilder !== 'undefined') {
            // 如果尚未初始化，重新執行 init
            if (!PageBuilder.layout || PageBuilder.layout.length === 0) {
                console.log('🎨 重新初始化 PageBuilder...');
                await PageBuilder.init(kolStoreId);
            } else {
                // 已初始化，只重新渲染
                PageBuilder.renderComponentsList();
                await PageBuilder.renderPreview();
            }
        }
        window.dispatchEvent(new Event('resize'));
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

// 桌面版側邊欄縮合專用函數
function toggleDesktopSidebar() {
    const dashboard = document.getElementById('dashboardPage');
    if (!dashboard) return;

    // 只在桌面版生效
    if (window.innerWidth <= 1024) return;

    dashboard.classList.toggle('sidebar-collapsed');

    // 保存縮合狀態到 localStorage
    const isCollapsed = dashboard.classList.contains('sidebar-collapsed');
    localStorage.setItem('kol_sidebar_collapsed', isCollapsed ? 'true' : 'false');

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

// 頁面載入時恢復側邊欄縮合狀態
document.addEventListener('DOMContentLoaded', () => {
    // 恢復收合狀態
    setTimeout(() => {
        const wasCollapsed = localStorage.getItem('kol_sidebar_collapsed') === 'true';
        if (wasCollapsed && window.innerWidth > 1024) {
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
    }, 100);
});

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
    if (tbody) {
        tbody.innerHTML = '<tr><td colspan="8" style="text-align:center">載入中...</td></tr>';
    }

    try {
        const result = await callKolApi('kolGetMyProducts');
        console.log('📦 kolGetMyProducts 結果:', result);

        if (result.success && result.data) {
            kolProducts = result.data.products || [];
            console.log(`✅ 載入 ${kolProducts.length} 項商品:`, kolProducts.slice(0, 2));
            if (tbody) {
                renderMyProducts(kolProducts);
            }
        } else {
            console.error('❌ 載入商品失敗:', result.error);
            if (tbody) {
                tbody.innerHTML = '<tr><td colspan="8" style="text-align:center; color:red;">載入失敗: ' + (result.error || '未知錯誤') + '</td></tr>';
            }
        }
    } catch (err) {
        console.error('❌ loadMyProducts 錯誤:', err);
        if (tbody) {
            tbody.innerHTML = '<tr><td colspan="8" style="text-align:center; color:red;">載入失敗</td></tr>';
        }
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
        const statusBadge = p.status === 'active' ? '<span class="status-badge status-done">上架中</span>' : '<span class="status-badge status-pending">下架</span>';

        return `
        <tr>
            <td><img src="${imageUrl}" class="table-thumb"></td>
            <td>${p.name} ${typeTag}</td>
            <td style="color:#888;">${formatCurrency(p.wholesalePrice)}</td>
            <td style="font-weight:600;">${formatCurrency(p.customPrice)}</td>
            <td style="color:#28a745; font-weight:500;">${formatCurrency(profit)}</td>
            <td>${p.availableStock}</td>
            <td>${p.soldQty || 0}</td>
            <td>${statusBadge}</td>
            <td>
                <button class="action-btn" onclick="openEditMyProduct('${p.id}')">編輯</button>
            </td>
        </tr>
        `;
    }).join('');
}

// 從商品庫選品
async function openProductPicker() {
    const grid = document.getElementById('pickerProductGrid');
    grid.innerHTML = '<p style="text-align:center">載入商品中...</p>';
    selectedPickerIds.clear(); // 清空選取狀態
    updatePickerFooter(); // 更新底部按鈕

    openModal('productPickerModal');

    showLoadingOverlay('載入商品列表...');

    try {
        const result = await callKolApi('kolGetProducts');
        if (result.success && result.data) {
            availableProducts = result.data.products || [];
            renderPickerProducts(availableProducts);
        }
    } catch (err) {
        grid.innerHTML = '<p style="color:red;">載入失敗</p>';
    } finally {
        hideLoadingOverlay();
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
        const productId = String(p.id); // 統一轉為字串
        const alreadyAdded = kolProducts.some(kp => String(kp.id) === productId);
        const isSelected = selectedPickerIds.has(productId);

        return `
        <div class="product-card ${alreadyAdded ? 'disabled' : ''} ${isSelected ? 'selected' : ''}" 
             onclick="${alreadyAdded ? '' : `toggleProductSelection('${productId}')`}">
             ${!alreadyAdded ? `
             <div class="checkbox-overlay">
                <input type="checkbox" ${isSelected ? 'checked' : ''} style="pointer-events:none;">
             </div>` : ''}
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

function toggleProductSelection(productId) {
    const id = String(productId); // 確保是字串
    if (selectedPickerIds.has(id)) {
        selectedPickerIds.delete(id);
    } else {
        selectedPickerIds.add(id);
    }
    renderPickerProducts(availableProducts); // 重新渲染以更新樣式
    updatePickerFooter();
}

function updatePickerFooter() {
    // 檢查是否已經有 footer，如果沒有則新增
    let footer = document.getElementById('pickerFooter');
    if (!footer) {
        const modalContent = document.querySelector('#productPickerModal .modal-content');
        if (modalContent) {
            footer = document.createElement('div');
            footer.id = 'pickerFooter';
            footer.className = 'modal-actions';
            footer.style.marginTop = '20px';
            footer.style.borderTop = '1px solid #eee';
            footer.style.paddingTop = '15px';
            modalContent.appendChild(footer);
        }
    }

    if (footer) {
        const count = selectedPickerIds.size;
        footer.innerHTML = `
            <span style="flex:1; line-height:36px; color:#666;">已選擇 ${count} 項商品</span>
            <button onclick="closeModal('productPickerModal')">取消</button>
            <button class="accent-btn" onclick="batchAddProducts()" ${count === 0 ? 'disabled' : ''}>
                確認新增 (${count})
            </button>
        `;
    }
}

async function batchAddProducts() {
    if (selectedPickerIds.size === 0) return;

    // 安全過濾：確保商品存在
    const productsToAdd = Array.from(selectedPickerIds).map(id => {
        const product = availableProducts.find(p => String(p.id) === id);
        return product ? {
            productId: id,
            customPrice: product.price || product.wholesalePrice || 0 // 增加 fallback
        } : null;
    }).filter(item => item !== null);

    if (productsToAdd.length === 0) {
        showToast('無法識別選取的商品，請重試', 'error');
        return;
    }

    if (!confirm(`確定要新增這 ${productsToAdd.length} 項商品嗎？\n預設售價將設定為官方建議售價。`)) return;

    showLoadingOverlay('批量新增中...');

    try {
        // 這裡需要後端支援批量新增 API，或者我們循環呼叫單筆新增
        // 為了效率，理想情況是後端支援。目前先用循環呼叫（臨時方案）
        // TODO: 優化為單次 API 請求
        let successCount = 0;
        for (const item of productsToAdd) {
            const result = await callKolApi('kolAddProduct', item);
            if (result.success) successCount++;
        }

        hideLoadingOverlay();
        showToast(`成功新增 ${successCount} 項商品`, 'success');
        closeModal('productPickerModal');
        loadMyProducts();
        selectedPickerIds.clear();

    } catch (err) {
        hideLoadingOverlay();
        showToast('批次新增過程發生錯誤', 'error');
        console.error(err);
    }
}

// 舊的單選邏輯保留給需要個別設定時使用 (如果需要)
function selectProduct(productId) {
    // ... Deprecated or Keep? 
    // 目前改為 toggleProductSelection 流程，此函數可移除或保留兼容
    toggleProductSelection(productId);
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

    showLoadingOverlay('新增商品中...');

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
    } finally {
        hideLoadingOverlay();
    }
}

// 編輯我的商品
function openEditMyProduct(productId) {
    const product = kolProducts.find(p => p.id === productId);
    if (!product) return;

    document.getElementById('editProductId').value = product.id;

    // 顯示商品資訊
    const imageUrl = (product.image || '').split(',')[0] || 'https://via.placeholder.com/50';
    document.getElementById('editProductInfo').innerHTML = `
        <div style="display:flex; gap:10px; align-items:center;">
             <img src="${imageUrl}" style="width:50px; height:50px; object-fit:cover; border-radius:4px;">
             <div>
                 <div style="font-weight:bold;">${product.name}</div>
                 <div style="font-size:0.9em; color:#666;">ID: ${product.id}</div>
             </div>
        </div>
    `;

    document.getElementById('editProductStatus').value = product.status;

    const isOwn = product.type === 'own';
    const stockInput = document.getElementById('editProductStock');
    const stockHint = document.getElementById('editStockHint');

    if (isOwn) {
        stockInput.placeholder = "設定庫存數量";
        stockHint.style.display = 'none';
        stockInput.value = product.assignedStock || 0;
        stockInput.disabled = false;
    } else {
        // Selected Product (HQ Managed)
        stockInput.placeholder = "庫存由總部管理";
        stockHint.style.display = 'block';
        stockHint.textContent = "此商品庫存與總部同步，無法手動修改";
        stockInput.value = product.availableStock; // This now comes from HQ stock via backend
        stockInput.disabled = true; // Make Read-only
    }

    // 設置按鈕區
    const actionsDiv = document.querySelector('#editProductModal .modal-actions');
    if (actionsDiv) {
        actionsDiv.innerHTML = `
            <button class="btn-secondary" style="color:var(--danger-color); border-color:var(--danger-color);" onclick="removeMyProduct('${product.id}')">刪除商品</button>
            <button class="accent-btn" onclick="saveMyProduct()">儲存變更</button>
        `;
    }

    openModal('editProductModal');
}

async function removeMyProduct(productId) {
    if (!confirm('確定要刪除此商品嗎？此動作無法復原。')) return;

    showLoadingOverlay('刪除商品中...');

    try {
        const result = await callKolApi('kolRemoveProduct', {
            storeId: kolStoreId,
            productId: productId
        });

        if (result.success) {
            showToast('商品已刪除', 'success');
            closeModal('editProductModal');
            loadMyProducts();
        } else {
            showToast('刪除失敗: ' + result.error, 'error');
        }
    } catch (err) {
        showToast('刪除失敗', 'error');
        console.error(err);
    } finally {
        hideLoadingOverlay();
    }
}

async function saveMyProduct() {
    const productId = document.getElementById('editProductId').value;
    const price = parseInt(document.getElementById('editProductPrice').value);
    const stock = parseInt(document.getElementById('editProductStock').value);
    const status = document.getElementById('editProductStatus').value;

    if (isNaN(price) || price < 0) {
        showToast('請輸入有效的售價', 'warning');
        return;
    }

    const product = kolProducts.find(p => p.id === productId);
    if (!product) return;

    const updates = {
        price: price,
        status: status
    };

    // 所有商品都允許更新庫存
    if (!isNaN(stock) && stock >= 0) {
        updates.stock = stock;
    } else if (stock < 0) {
        showToast('請輸入有效的庫存', 'warning');
        return;
    }

    showLoadingOverlay('儲存商品變更...');

    try {
        const result = await callKolApi('kolUpdateProduct', {
            storeId: kolStoreId,
            productId: productId,
            updates: updates
        });

        if (result.success) {
            showToast('商品已更新', 'success');
            closeModal('editProductModal');
            loadMyProducts(); // 重新載入列表
        } else {
            showToast('更新失敗: ' + result.error, 'error');
        }
    } catch (err) {
        showToast('更新失敗', 'error');
        console.error(err);
    } finally {
        hideLoadingOverlay();
    }
}

// ----------------------------------------------------
// 自建商品功能
// ----------------------------------------------------

let ownProductFiles = []; // 儲存選擇的圖片檔案
let kolSpecGroups = []; // 規格組

function openCreateOwnProduct() {
    // 重置表單
    document.getElementById('createOwnProductForm').reset();
    document.getElementById('ownProductImagePreview').innerHTML = '';
    if (document.getElementById('ownProdBrand')) document.getElementById('ownProdBrand').value = '';
    ownProductFiles = [];

    // 重置規格
    kolSpecGroups = [];
    renderKolSpecBuilder();
    document.getElementById('ownVariantsSection').style.display = 'none';

    openModal('createOwnProductModal');
}

function handleKolImageSelect(event) {
    const files = Array.from(event.target.files);
    if (files.length === 0) return;

    ownProductFiles = [...ownProductFiles, ...files];
    renderKolImagePreview();
}

function renderKolImagePreview() {
    const container = document.getElementById('ownProductImagePreview');
    container.innerHTML = ownProductFiles.map((file, index) => `
        <div class="preview-item">
            <img src="${URL.createObjectURL(file)}" title="${file.name}">
            <button type="button" class="remove-btn" onclick="removeKolImage(${index})">×</button>
        </div>
    `).join('');
}

function removeKolImage(index) {
    ownProductFiles.splice(index, 1);
    renderKolImagePreview();
}

// 規格管理
function addKolSpecGroup() {
    if (kolSpecGroups.length >= 2) {
        showToast('最多支援兩層規格', 'warning');
        return;
    }
    kolSpecGroups.push({ name: '', options: [] });
    renderKolSpecBuilder();
}

function removeKolSpecGroup(index) {
    kolSpecGroups.splice(index, 1);
    renderKolSpecBuilder();
    generateKolVariants();
}

function updateKolSpecName(index, value) {
    kolSpecGroups[index].name = value;
    generateKolVariants();
}

function addKolSpecOption(groupIndex) {
    const input = document.getElementById(`kolSpecInput_${groupIndex}`);
    const val = input.value.trim();
    if (!val) return;

    if (kolSpecGroups[groupIndex].options.includes(val)) {
        showToast('選項已存在', 'warning');
        return;
    }

    kolSpecGroups[groupIndex].options.push(val);
    input.value = '';
    renderKolSpecBuilder();
    generateKolVariants();
}

function removeKolSpecOption(groupIndex, optIndex) {
    kolSpecGroups[groupIndex].options.splice(optIndex, 1);
    renderKolSpecBuilder();
    generateKolVariants();
}

function renderKolSpecBuilder() {
    const container = document.getElementById('ownSpecContainer');
    if (kolSpecGroups.length === 0) {
        container.innerHTML = '<p style="color:#888; font-size:0.9em;">尚未設定規格 (預設為單一規格)</p>';
        return;
    }

    container.innerHTML = kolSpecGroups.map((group, idx) => `
        <div class="spec-group">
            <div class="spec-header">
                <input type="text" placeholder="規格名稱 (例如: 顏色)" value="${group.name}" 
                       onchange="updateKolSpecName(${idx}, this.value)">
                <button type="button" class="btn-text needs-confirm" onclick="removeKolSpecGroup(${idx})">刪除</button>
            </div>
            <div class="spec-options">
                ${group.options.map((opt, optIdx) => `
                    <span class="spec-tag">${opt} <span onclick="removeKolSpecOption(${idx}, ${optIdx})">×</span></span>
                `).join('')}
                <div class="add-option-box">
                    <input type="text" id="kolSpecInput_${idx}" placeholder="輸入選項按 Enter" 
                           onkeydown="if(event.key==='Enter'){event.preventDefault();addKolSpecOption(${idx});}">
                    <button type="button" onclick="addKolSpecOption(${idx})">+</button>
                </div>
            </div>
        </div>
    `).join('');
}

function generateKolVariants() {
    const tbody = document.getElementById('ownVariantsTableBody');
    const container = document.getElementById('ownVariantsSection');

    // 檢查是否有有效規格
    const validGroups = kolSpecGroups.filter(g => g.name && g.options.length > 0);
    if (validGroups.length === 0) {
        container.style.display = 'none';
        return;
    }

    container.style.display = 'block';

    // 產生笛卡爾積
    let variants = [[]];
    validGroups.forEach(group => {
        const newVariants = [];
        variants.forEach(variant => {
            group.options.forEach(opt => {
                newVariants.push([...variant, opt]);
            });
        });
        variants = newVariants;
    });

    // 渲染表格
    const basePrice = document.getElementById('ownProdPrice').value || '';
    const baseStock = document.getElementById('ownProdStock').value || 99;

    tbody.innerHTML = variants.map((v, idx) => {
        const name = v.join(' / ');
        return `
            <tr class="variant-row" data-name="${name}">
                <td>${name}</td>
                <td><input type="number" class="v-price" value="${basePrice}" placeholder="價格"></td>
                <td><input type="number" class="v-stock" value="${baseStock}" placeholder="庫存"></td>
            </tr>
        `;
    }).join('');
}

async function submitOwnProduct(event) {
    event.preventDefault();

    const name = document.getElementById('ownProdName').value.trim();
    const price = document.getElementById('ownProdPrice').value;
    const stock = document.getElementById('ownProdStock').value;

    if (!name || !price || !stock) {
        showToast('請填寫必填欄位', 'warning');
        return;
    }

    showLoadingOverlay('建立商品中... (若有圖片需稍候)');

    try {
        // 1. 上傳圖片
        const uploadedImages = [];
        if (ownProductFiles.length > 0) {
            for (let i = 0; i < ownProductFiles.length; i++) {
                const file = ownProductFiles[i];
                const reader = new FileReader();

                const base64Promise = new Promise((resolve, reject) => {
                    reader.onload = e => resolve(e.target.result.split(',')[1]);
                    reader.onerror = reject;
                    reader.readAsDataURL(file);
                });

                const base64 = await base64Promise;

                document.getElementById('loadingMessage').textContent = `上傳圖片 ${i + 1}/${ownProductFiles.length}...`;

                const uploadRes = await callKolApi('kolUploadImage', {
                    imageBase64: base64,
                    fileName: file.name
                });

                if (uploadRes.success) {
                    uploadedImages.push(uploadRes.data.url);
                } else {
                    console.error(`圖片 ${file.name} 上傳失敗`, uploadRes.error);
                }
            }
        }

        // 2. 收集規格資料
        const options = {};
        const validGroups = kolSpecGroups.filter(g => g.name && g.options.length > 0);

        if (validGroups.length > 0) {
            // 建構 options 物件
            // 這裡簡單化，只存 groups 結構和 variants 列表
            options.groups = validGroups;

            const variantRows = document.querySelectorAll('.variant-row');
            const variantsList = [];
            variantRows.forEach(row => {
                variantsList.push({
                    name: row.dataset.name,
                    price: parseInt(row.querySelector('.v-price').value) || 0,
                    stock: parseInt(row.querySelector('.v-stock').value) || 0
                });
            });
            options.variants = variantsList;
        }

        // 3. 送出商品資料
        const productData = {
            name: name,
            category: document.getElementById('ownProdCategory').value,
            brand: document.getElementById('ownProdBrand').value.trim(), // 收集品牌
            price: parseInt(price),
            wholesalePrice: parseInt(document.getElementById('ownProdCost').value) || 0,
            stock: parseInt(stock),
            status: document.getElementById('ownProdStatus').value,
            description: document.getElementById('ownProdDesc').value,
            images: uploadedImages,
            options: options
        };

        document.getElementById('loadingMessage').textContent = '儲存商品資料...';

        const result = await callKolApi('kolCreateProduct', { productData });

        if (result.success) {
            showToast('專屬商品建立成功！', 'success');
            closeModal('createOwnProductModal');
            loadMyProducts();
        } else {
            showToast('建立失敗: ' + result.error, 'error');
        }

    } catch (err) {
        showToast('發生錯誤', 'error');
        console.error(err);
    } finally {
        hideLoadingOverlay();
    }
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


    tbody.innerHTML = orders.map((o, idx) => {
        const totalItems = (o.items || []).reduce((sum, i) => sum + (Number(i.qty) || 0), 0);
        const firstItem = (o.items || [])[0] ? (o.items[0].name + (o.items.length > 1 ? ` 等 ${totalItems} 件商品` : '')) : '無商品';

        // 詳細清單 HTML
        const detailsHtml = (o.items || []).map(i => `
            <div style="display:flex; justify-content:space-between; padding:4px 0; border-bottom:1px dashed #eee; font-size:13px;">
                <span>${i.name} ${i.spec ? `(${i.spec})` : ''}</span>
                <span>x${i.qty}</span>
            </div>
        `).join('');

        return `
        <tr class="order-main-row" onclick="toggleOrderDetails('order-details-${idx}')" style="cursor: pointer;">
            <td>${o.orderId}</td>
            <td>${o.date || '-'}</td>
            <td>${o.customerName}</td>
            <td>${o.customerPhone}</td>
            <td style="max-width:200px;">
                <div style="display:flex; justify-content:space-between; align-items:center;">
                    <span style="white-space:nowrap; overflow:hidden; text-overflow:ellipsis; max-width:120px;">${firstItem}</span>
                </div>
            </td>
            <td>${formatCurrency(o.total)}</td>
            <td><span class="status-badge">${o.status}</span></td>
        </tr>
        <tr id="order-details-${idx}" class="order-details-row" style="display:none; background:#f9fafb;">
            <td colspan="7">
                <div style="padding:10px 20px;">
                    <h5 style="margin:0 0 10px 0; color:#4b5563;">訂單明細</h5>
                    ${detailsHtml}
                    <div style="margin-top:10px; font-size:13px; color:#666;">
                        <strong>備註：</strong> ${o.note || '無'} | 
                        <strong>寄送：</strong> ${o.shippingMethod} ${o.storeName || ''} ${o.storeCode || ''}
                    </div>
                </div>
            </td>
        </tr>
        `;
    }).join('');
}

function toggleOrderDetails(id) {
    const el = document.getElementById(id);
    if (el) {
        const isHidden = el.style.display === 'none';
        el.style.display = isHidden ? 'table-row' : 'none';
    }
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

function handleKolLogoSelect(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function (e) {
        const preview = document.getElementById('kolLogoPreview');
        preview.src = e.target.result;
        preview.style.display = 'block';
        document.getElementById('removeKolLogoBtn').style.display = 'block';
        document.getElementById('kolLogoUploadZone').style.display = 'none';
    };
    reader.readAsDataURL(file);
}

function removeKolLogo() {
    document.getElementById('kolLogoFile').value = '';
    document.getElementById('kolLogoPreview').src = '';
    document.getElementById('kolLogoPreview').style.display = 'none';
    document.getElementById('removeKolLogoBtn').style.display = 'none';
    document.getElementById('kolLogoUploadZone').style.display = 'block';

    // 如果想要清空原本的，可以清空 hidden input
    // 但通常使用者可能只是想取消"更換"，若原本有圖，應該恢復顯示？
    // 這裡簡化為清空，若使用者儲存則會變成無 Logo
    document.getElementById('settingsLogoUrl').value = '';
}

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

            // Logo
            if (profile.logoUrl) {
                document.getElementById('settingsLogoUrl').value = profile.logoUrl;
                document.getElementById('kolLogoPreview').src = profile.logoUrl;
                document.getElementById('kolLogoPreview').style.display = 'block';
                document.getElementById('removeKolLogoBtn').style.display = 'block';
                document.getElementById('kolLogoUploadZone').style.display = 'none';
            } else {
                removeKolLogo();
            }

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
        bankAccount: document.getElementById('settingsBankAccount').value.trim(),
        logoUrl: document.getElementById('settingsLogoUrl').value
    };

    const btn = event.target.querySelector('button[type="submit"]');
    const originalText = btn.textContent;
    btn.disabled = true;
    btn.textContent = '儲存中...';

    try {
        // Logo Upload
        const logoFile = document.getElementById('kolLogoFile').files[0];
        if (logoFile) {
            const base64 = await new Promise((resolve) => {
                const reader = new FileReader();
                reader.onload = (e) => resolve(e.target.result);
                reader.readAsDataURL(logoFile);
            });
            const base64Content = base64.split(',')[1];

            // callKolApi for upload
            // 注意: code.gs 需要 kolUploadImage 返回 brand
            const uploadRes = await callKolApi('kolUploadImage', {
                fileName: logoFile.name,
                content: base64Content,
                mimeType: logoFile.type,
                brand: profileData.storeName
            });

            if (uploadRes.success) {
                profileData.logoUrl = uploadRes.data.url;
            } else {
                throw new Error('Logo 上傳失敗: ' + uploadRes.error);
            }
        }

        const result = await callKolApi('kolUpdateProfile', { profileData });
        if (result.success) {
            showToast('資料已更新', 'success');

            // 更新本地狀態
            kolStoreInfo.storeName = profileData.storeName;
            kolStoreInfo.themeColor = profileData.themeColor;
            kolStoreInfo.logoUrl = profileData.logoUrl; // Update Token/Info logic usually doesn't store logoUrl but let's keep it sync
            sessionStorage.setItem('kolStoreInfo', JSON.stringify(kolStoreInfo));

            // 更新 header
            document.getElementById('storeNameHeader').textContent = profileData.storeName;
            if (profileData.themeColor) {
                document.documentElement.style.setProperty('--primary-color', profileData.themeColor);
            }
            // Update Logo in sidebar if exists
            const logoContainer = document.getElementById('storeLogoContainer');
            if (logoContainer) {
                if (profileData.logoUrl) {
                    logoContainer.innerHTML = `<img src="${profileData.logoUrl}" style="width:50px; height:50px; border-radius:50%; object-fit:cover; margin-bottom:0.5rem;">`;
                } else {
                    logoContainer.innerHTML = '';
                }
            }

        } else {
            showToast('更新失敗: ' + result.error, 'error');
        }
    } catch (err) {
        showToast('更新失敗: ' + err.message, 'error');
    } finally {
        btn.disabled = false;
        btn.textContent = originalText; // Restore text
    }
}



// Image Upload Helper
function uploadToGitHub(file) {
    return new Promise((resolve, reject) => {
        if (!file) {
            reject(new Error('No file provided'));
            return;
        }

        const reader = new FileReader();
        reader.onload = async function (e) {
            try {
                const base64Content = e.target.result;
                const result = await callKolApi('kolUploadImage', {
                    storeId: kolStoreId,
                    imageBase64: base64Content,
                    fileName: file.name
                });

                if (result.success) {
                    resolve(result.data); // Should contain { url: ... }
                } else {
                    reject(new Error(result.error || 'Upload failed'));
                }
            } catch (err) {
                reject(err);
            }
        };
        reader.onerror = () => reject(new Error('File reading failed'));
        reader.readAsDataURL(file);
    });
}
