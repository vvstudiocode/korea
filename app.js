/**
 * 韓國代購網站 - 前端 JavaScript
 * 功能：商品展示、購物車、結帳流程
 */

// ===== 設定 =====
const GAS_API_URL = 'https://script.google.com/macros/s/AKfycbyVwUTAG0nRLEQqoCA49Q-6Pyycejkxkz1Eb5XQ86xXW-DBdYPPeH7BomWUHD69Y6-j/exec'; // 請替換成您的 GAS Web App URL

// ===== 全域變數 =====
let products = [];
let cart = [];
let currentProduct = null;
let currentCategory = 'all';

// ===== 初始化 =====
document.addEventListener('DOMContentLoaded', () => {
    initializeApp();
    setupEventListeners();
});

/**
 * 初始化應用程式
 */
function initializeApp() {
    loadProducts();
    loadCartFromLocalStorage();
    updateCartUI();
}

/**
 * 設定事件監聽器
 */
function setupEventListeners() {
    // 購物車按鈕
    document.getElementById('cartBtn').addEventListener('click', toggleCart);
    document.getElementById('closeCart').addEventListener('click', toggleCart);

    // 結帳按鈕
    document.getElementById('checkoutBtn').addEventListener('click', showCheckout);

    // 訂單表單
    document.getElementById('orderForm').addEventListener('submit', handleOrderSubmit);

    // 訂單表單
    document.getElementById('orderForm').addEventListener('submit', handleOrderSubmit);

    // 移除分類篩選監聽器
    // document.querySelectorAll('.filter-btn').forEach(...)

    // 遮罩層點擊關閉
    document.getElementById('overlay').addEventListener('click', closeAllModals);
}

// ===== 商品管理 =====

/**
 * 從 GAS API 載入商品
 */
async function loadProducts() {
    const productsGrid = document.getElementById('productsGrid');

    try {
        productsGrid.innerHTML = '<div class="loading">載入商品中...</div>';

        const response = await fetch(`${GAS_API_URL}?action=getProducts`);
        const result = await response.json();

        if (result.success) {
            products = result.data;
            displayProducts();
        } else {
            productsGrid.innerHTML = `<div class="loading">載入失敗：${result.error}</div>`;
        }
    } catch (error) {
        console.error('載入商品失敗:', error);
        productsGrid.innerHTML = '<div class="loading">⚠️ 無法連接到伺服器<br><small>請確認 GAS API URL 設定正確</small></div>';

        // 使用示範資料
        loadDemoProducts();
    }
}

/**
 * 載入示範商品（開發用）
 */
function loadDemoProducts() {
    products = [
        {
            id: 'P001',
            name: '韓國保濕面膜 10片裝',
            description: '超人氣保濕面膜，含玻尿酸精華，深層保濕鎖水',
            price: 350,
            stock: 50,
            image: 'https://picsum.photos/400/300?random=1',
            category: '美妝保養'
        },
        {
            id: 'P002',
            name: '韓國海苔禮盒組',
            description: '經典海苔禮盒，送禮自用兩相宜，香脆美味',
            price: 280,
            stock: 30,
            image: 'https://picsum.photos/400/300?random=2',
            category: '零食食品'
        },
        {
            id: 'P003',
            name: '韓國泡麵組合包',
            description: '5種口味各2包，共10包，辛拉麵、安城湯麵等熱門口味',
            price: 450,
            stock: 20,
            image: 'https://picsum.photos/400/300?random=3',
            category: '零食食品'
        },
        {
            id: 'P004',
            name: '韓國氣墊粉餅',
            description: '輕盈服貼，自然裸妝感，SPF50+ PA+++防曬',
            price: 680,
            stock: 15,
            image: 'https://picsum.photos/400/300?random=4',
            category: '美妝保養'
        },
        {
            id: 'P005',
            name: '韓國蜂蜜柚子茶',
            description: '天然蜂蜜與柚子完美結合，冷熱皆宜',
            price: 320,
            stock: 40,
            image: 'https://picsum.photos/400/300?random=5',
            category: '零食食品'
        },
        {
            id: 'P006',
            name: '韓國口紅套組',
            description: '熱門色號3支組，霧面絲絨質地，顯色持久',
            price: 890,
            stock: 12,
            image: 'https://picsum.photos/400/300?random=6',
            category: '美妝保養'
        }
    ];

    displayProducts();
}

/**
 * 顯示商品清單
 */
function displayProducts() {
    const productsGrid = document.getElementById('productsGrid');

    // 移除分類篩選邏輯，直接顯示所有商品
    let filteredProducts = products;
    // if (currentCategory !== 'all') {
    //     filteredProducts = products.filter(p => p.category === currentCategory);
    // }

    if (filteredProducts.length === 0) {
        productsGrid.innerHTML = '<div class="loading">此分類暫無商品</div>';
        return;
    }

    // 渲染商品卡片
    productsGrid.innerHTML = filteredProducts.map(product => `
        <div class="product-card" onclick="showProductDetail('${product.id}')">
            <img src="${product.image}" alt="${product.name}" class="product-image">
            <div class="product-info">
                <span class="product-category">${product.category}</span>
                <h3 class="product-name">${product.name}</h3>
                <p class="product-description">${product.description}</p>
                <div class="product-footer">
                    <span class="product-price">NT$ ${product.price}</span>
                    <span class="product-stock">庫存 ${product.stock}</span>
                </div>
            </div>
        </div>
    `).join('');
}

/**
 * 顯示商品詳情
 */
function showProductDetail(productId) {
    // 使用寬鬆相等 (==) 以容許數字/字串差異，避免 ID 為 1 時找不到商品
    currentProduct = products.find(p => p.id == productId);

    if (!currentProduct) {
        console.error('找不到商品:', productId);
        return;
    }

    document.getElementById('modalProductImage').src = currentProduct.image;
    document.getElementById('modalProductName').textContent = currentProduct.name;
    document.getElementById('modalProductPrice').textContent = `NT$ ${currentProduct.price}`;
    document.getElementById('modalProductDescription').textContent = currentProduct.description;
    document.getElementById('modalProductStock').textContent = currentProduct.stock;
    document.getElementById('modalQuantity').value = 1;
    document.getElementById('modalQuantity').max = currentProduct.stock;

    showModal('productModal');
}

/**
 * 增加數量
 */
function increaseQuantity() {
    const input = document.getElementById('modalQuantity');
    const max = parseInt(input.max);
    const current = parseInt(input.value);

    if (current < max) {
        input.value = current + 1;
    }
}

/**
 * 減少數量
 */
function decreaseQuantity() {
    const input = document.getElementById('modalQuantity');
    const current = parseInt(input.value);

    if (current > 1) {
        input.value = current - 1;
    }
}

/**
 * 從模態框加入購物車
 */
function addToCartFromModal() {
    const quantity = parseInt(document.getElementById('modalQuantity').value);
    addToCart(currentProduct, quantity);
    closeProductModal();
}

/**
 * 關閉商品詳情模態框
 */
function closeProductModal() {
    closeModal('productModal');
}

// ===== 購物車管理 =====

/**
 * 加入購物車
 */
function addToCart(product, quantity) {
    const existingItem = cart.find(item => item.id === product.id);

    if (existingItem) {
        // 檢查庫存
        const newQuantity = existingItem.quantity + quantity;
        if (newQuantity > product.stock) {
            alert(`庫存不足！目前庫存僅剩 ${product.stock} 件`);
            return;
        }
        existingItem.quantity = newQuantity;
    } else {
        cart.push({
            ...product,
            quantity: quantity
        });
    }

    saveCartToLocalStorage();
    updateCartUI();

    // 更新本地商品庫存並重新渲染商品卡片
    const prod = products.find(p => p.id === product.id);
    if (prod) {
        prod.stock = Math.max(0, prod.stock - quantity);
        displayProducts();
    }

    // 顯示提示
    showNotification('已加入購物車！');
}

/**
 * 更新購物車 UI
 */
function updateCartUI() {
    const cartItems = document.getElementById('cartItems');
    const cartBadge = document.getElementById('cartBadge');
    const totalAmount = document.getElementById('totalAmount');
    const checkoutBtn = document.getElementById('checkoutBtn');

    // 更新徽章
    const totalItems = cart.reduce((sum, item) => sum + item.quantity, 0);
    cartBadge.textContent = totalItems;

    // 計算總金額
    const total = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    totalAmount.textContent = `NT$ ${total.toLocaleString()}`;

    // 更新購物車內容
    if (cart.length === 0) {
        cartItems.innerHTML = `
            <div class="empty-cart">
                <p>購物車是空的</p>
                <p class="empty-cart-hint">快去挑選喜歡的商品吧！</p>
            </div>
        `;
        checkoutBtn.disabled = true;
    } else {
        cartItems.innerHTML = cart.map(item => `
            <div class="cart-item">
                <img src="${item.image}" alt="${item.name}" class="cart-item-image">
                <div class="cart-item-info">
                    <div class="cart-item-name">${item.name}</div>
                    <div class="cart-item-price">NT$ ${item.price}</div>
                    <div class="cart-item-quantity">
                        <button class="qty-btn-small" onclick="updateCartQuantity('${item.id}', -1)">-</button>
                        <span>${item.quantity}</span>
                        <button class="qty-btn-small" onclick="updateCartQuantity('${item.id}', 1)">+</button>
                    </div>
                </div>
                <button class="remove-item" onclick="removeFromCart('${item.id}')">🗑️</button>
            </div>
        `).join('');
        checkoutBtn.disabled = false;
    }
}

/**
 * 更新購物車商品數量
 */
function updateCartQuantity(productId, change) {
    const item = cart.find(i => i.id === productId);
    if (!item) return;

    const newQuantity = item.quantity + change;

    // 檢查庫存
    const product = products.find(p => p.id === productId);
    if (newQuantity > product.stock) {
        alert(`庫存不足！目前庫存僅剩 ${product.stock} 件`);
        return;
    }

    if (newQuantity <= 0) {
        removeFromCart(productId);
        return;
    }

    item.quantity = newQuantity;
    saveCartToLocalStorage();
    updateCartUI();
}

/**
 * 移除購物車商品
 */
function removeFromCart(productId) {
    cart = cart.filter(item => item.id !== productId);
    saveCartToLocalStorage();
    updateCartUI();
}

/**
 * 切換購物車顯示
 */
function toggleCart() {
    const cartSidebar = document.getElementById('cartSidebar');
    const overlay = document.getElementById('overlay');

    cartSidebar.classList.toggle('active');
    overlay.classList.toggle('active');
}

/**
 * 儲存購物車到 LocalStorage
 */
function saveCartToLocalStorage() {
    localStorage.setItem('koreanShoppingCart', JSON.stringify(cart));
}

/**
 * 從 LocalStorage 載入購物車
 */
function loadCartFromLocalStorage() {
    const savedCart = localStorage.getItem('koreanShoppingCart');
    if (savedCart) {
        cart = JSON.parse(savedCart);
    }
}

// ===== 結帳流程 =====

/**
 * 顯示結帳表單
 */
function showCheckout() {
    if (cart.length === 0) return;

    // 關閉購物車
    toggleCart();

    // 更新訂單摘要
    const orderSummary = document.getElementById('orderSummary');
    const orderTotal = document.getElementById('orderTotal');

    const total = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);

    orderSummary.innerHTML = cart.map(item => `
        <div class="summary-item">
            <span>${item.name} x ${item.quantity}</span>
            <span>NT$ ${(item.price * item.quantity).toLocaleString()}</span>
        </div>
    `).join('');

    orderTotal.textContent = `NT$ ${total.toLocaleString()}`;

    showModal('checkoutModal');
}

/**
 * 處理訂單提交
 */
async function handleOrderSubmit(e) {
    e.preventDefault();

    const formData = {
        customerName: document.getElementById('customerName').value,
        customerPhone: document.getElementById('customerPhone').value,
        customerLineId: document.getElementById('customerLineId').value, // 取得 Line ID
        customerEmail: document.getElementById('customerEmail').value,
        customerAddress: document.getElementById('customerAddress').value,
        items: cart,
        total: cart.reduce((sum, item) => sum + (item.price * item.quantity), 0)
    };

    // 顯示全螢幕 Loading (不帶文字)
    showLoadingOverlay();

    const submitBtn = e.target.querySelector('.submit-order-btn');
    submitBtn.disabled = true;

    try {
        // 生成本地訂單編號
        const orderId = 'KR' + new Date().toISOString().slice(0, 10).replace(/-/g, '') + Math.random().toString().slice(2, 6);

        // 精簡 items 資料，只傳送後端需要的欄位
        const simplifiedItems = cart.map(item => ({
            id: item.id, // 新增 ID 以便後端準確扣庫存
            name: item.name,
            quantity: item.quantity,
            price: item.price
        }));

        // 準備傳送給後端的資料
        const payload = {
            action: 'submitOrder',
            orderData: {
                ...formData,
                items: simplifiedItems,
                orderId: orderId // 傳送前端生成的訂單編號
            }
        };

        // 使用 fetch 發送 POST 請求 (取代原本的 Image GET 方式)
        // mode: 'no-cors' 允許跨域發送，雖然無法讀取回應，但能確保資料送達
        await fetch(GAS_API_URL, {
            method: 'POST',
            mode: 'no-cors',
            headers: {
                'Content-Type': 'text/plain;charset=utf-8', // 避免觸發 CORS 預檢
            },
            body: JSON.stringify(payload)
        });

        // 不等待回應，直接顯示成功（訂單已發送到後端）
        setTimeout(() => {
            hideLoadingOverlay(); // 隱藏 Loading

            // 顯示成功訊息
            document.getElementById('orderNumber').textContent = orderId;
            closeModal('checkoutModal');
            showModal('successModal');

            // 重新載入商品資料以同步庫存顯示
            loadProducts();

            // 清空購物車
            cart = [];
            saveCartToLocalStorage();
            updateCartUI();

            // 重置表單
            document.getElementById('orderForm').reset();

            submitBtn.textContent = '確認送出訂單';
            submitBtn.disabled = false;
        }, 1500);

    } catch (error) {
        console.error('送出訂單失敗:', error);
        hideLoadingOverlay();
        submitBtn.textContent = '確認送出訂單';
        submitBtn.disabled = false;
        alert('訂單送出失敗，請稍後再試');
    }
}

/**
 * 關閉結帳模態框
 */
function closeCheckoutModal() {
    closeModal('checkoutModal');
}

/**
 * 關閉成功訊息模態框
 */
function closeSuccessModal() {
    closeModal('successModal');
}

// ===== 模態框控制 =====

/**
 * 顯示模態框
 */
function showModal(modalId) {
    document.getElementById(modalId).classList.add('active');
    document.getElementById('overlay').classList.add('active');
}

/**
 * 關閉模態框
 */
function closeModal(modalId) {
    document.getElementById(modalId).classList.remove('active');
    document.getElementById('overlay').classList.remove('active');
}

/**
 * 關閉所有模態框
 */
function closeAllModals() {
    document.querySelectorAll('.modal').forEach(modal => {
        modal.classList.remove('active');
    });
    document.getElementById('overlay').classList.remove('active');

    // 同時關閉購物車
    document.getElementById('cartSidebar').classList.remove('active');
}

// ===== 輔助功能 =====

/**
 * 顯示通知
 */
function showNotification(message) {
    // 簡單的通知實作
    const notification = document.createElement('div');
    notification.style.cssText = `
        position: fixed;
        top: 100px;
        right: 20px;
        background: linear-gradient(135deg, #11998e 0%, #38ef7d 100%);
        color: white;
        padding: 1rem 2rem;
        border-radius: 12px;
        box-shadow: 0 4px 16px rgba(0, 0, 0, 0.2);
        z-index: 10000;
        animation: slideIn 0.3s ease;
    `;
    notification.textContent = message;

    document.body.appendChild(notification);

    setTimeout(() => {
        notification.style.animation = 'slideOut 0.3s ease';
        setTimeout(() => notification.remove(), 300);
    }, 2000);
}

// 添加動畫樣式
const style = document.createElement('style');
style.textContent = `
    @keyframes slideIn {
        from { transform: translateX(400px); opacity: 0; }
        to { transform: translateX(0); opacity: 1; }
    }
    }
    @keyframes slideOut {
        from { transform: translateX(0); opacity: 1; }
        to { transform: translateX(400px); opacity: 0; }
    }
`;
document.head.appendChild(style);

/**
 * 顯示全螢幕 Loading (僅動畫)
 */
function showLoadingOverlay() {
    let loadingOverlay = document.getElementById('loadingOverlay');
    if (!loadingOverlay) {
        loadingOverlay = document.createElement('div');
        loadingOverlay.id = 'loadingOverlay';
        loadingOverlay.className = 'loading-overlay';
        loadingOverlay.innerHTML = `
            <div class="spinner"></div>
        `;
        document.body.appendChild(loadingOverlay);
    }
    loadingOverlay.classList.add('active');
}

/**
 * 隱藏全螢幕 Loading
 */
function hideLoadingOverlay() {
    const loadingOverlay = document.getElementById('loadingOverlay');
    if (loadingOverlay) {
        loadingOverlay.classList.remove('active');
    }
}
