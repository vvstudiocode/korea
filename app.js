/**
 * 韓國代購網站 - 前端 JavaScript
 * 功能：商品展示、購物車、結帳流程
 */

// ===== 設定 =====
const GAS_API_URL = 'https://script.google.com/macros/s/AKfycby7V5VwHfn_Tb-wpg_SSrme2c2P5bin6qjhxEkr80RDLg6p5TPn2EXySkpG9qnyvfNF/exec'; // 請替換成您的 GAS Web App URL

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
    console.log('App Version: 2.1 (Product Options)'); // 版本標記
    loadProducts();
    loadCartFromLocalStorage();
    updateCartUI();
}

/**
 * 設定事件監聯器
 */
function setupEventListeners() {
    // 購物車按鈕
    document.getElementById('cartBtn').addEventListener('click', toggleCart);
    document.getElementById('closeCart').addEventListener('click', toggleCart);

    // 結帳按鈕
    document.getElementById('checkoutBtn').addEventListener('click', showCheckout);

    // 訂單表單
    document.getElementById('orderForm').addEventListener('submit', handleOrderSubmit);

    // 遮罩層點擊關閉
    document.getElementById('overlay').addEventListener('click', closeAllModals);

    // 圖片輪播滑動監聽 (使用事件委派)
    document.addEventListener('scroll', handleSliderScroll, true);
}

/**
 * 處理圖片輪播滑動，更新指示點
 */
function handleSliderScroll(e) {
    const slider = e.target;
    if (!slider.classList || !slider.classList.contains('image-slider')) return;

    const container = slider.closest('.image-slider-container');
    if (!container) return;

    const dots = container.querySelectorAll('.slider-dot');
    if (dots.length === 0) return;

    // 計算目前顯示的是第幾張圖片
    const scrollLeft = slider.scrollLeft;
    const imageWidth = slider.offsetWidth;
    const currentIndex = Math.round(scrollLeft / imageWidth);

    // 更新指示點
    dots.forEach((dot, index) => {
        dot.classList.toggle('active', index === currentIndex);
    });
}

// ===== 商品管理 =====

const PRODUCTS_CACHE_KEY = 'koreanShoppingProducts';
const CACHE_EXPIRY_MS = 5 * 60 * 1000; // 快取有效期：5分鐘

/**
 * 從 GAS API 載入商品（含快取機制）
 */
async function loadProducts() {
    const productsGrid = document.getElementById('productsGrid');

    // 1. 先嘗試從快取載入（立即顯示）
    const cached = loadProductsFromCache();
    if (cached) {
        console.log('📦 從快取載入商品');
        products = cached;
        displayProductsProgressive(); // 漸進式顯示
    } else {
        productsGrid.innerHTML = '<div class="loading">載入商品中...</div>';
    }

    // 2. 背景從 API 更新資料
    try {
        const response = await fetch(`${GAS_API_URL}?action=getProducts`);
        const result = await response.json();

        if (result.success) {
            const newProducts = result.data;

            // 如果資料有變化，更新顯示
            if (JSON.stringify(newProducts) !== JSON.stringify(products)) {
                console.log('🔄 更新商品資料');
                products = newProducts;
                saveProductsToCache(products);
                displayProductsProgressive();
            } else {
                console.log('✅ 商品資料無變化');
                saveProductsToCache(products); // 更新快取時間
            }
        } else if (!cached) {
            productsGrid.innerHTML = `<div class="loading">載入失敗：${result.error}</div>`;
        }
    } catch (error) {
        console.error('載入商品失敗:', error);
        if (!cached) {
            productsGrid.innerHTML = '<div class="loading">⚠️ 無法連接到伺服器<br><small>請確認網路連線</small></div>';
            loadDemoProducts();
        }
    }
}

/**
 * 儲存商品到快取
 */
function saveProductsToCache(data) {
    const cacheData = {
        timestamp: Date.now(),
        products: data
    };
    localStorage.setItem(PRODUCTS_CACHE_KEY, JSON.stringify(cacheData));
}

/**
 * 從快取載入商品
 */
function loadProductsFromCache() {
    try {
        const cached = localStorage.getItem(PRODUCTS_CACHE_KEY);
        if (!cached) return null;

        const cacheData = JSON.parse(cached);
        // 檢查快取是否過期（超過5分鐘仍可使用，只是會觸發背景更新）
        return cacheData.products;
    } catch (e) {
        console.error('快取讀取失敗:', e);
        return null;
    }
}

/**
 * 載入示範商品（開發用）
 */
function loadDemoProducts() {
    products = [
        { id: 'P001', name: '韓國保濕面膜', description: '超人氣保濕面膜', price: 350, stock: 50, image: 'https://picsum.photos/400/300?random=1', category: '美妝保養', options: { '類型': ['保濕', '美白'] } },
        { id: 'P002', name: '韓國海苔禮盒', description: '經典海苔禮盒', price: 280, stock: 30, image: 'https://picsum.photos/400/300?random=2', category: '零食食品', options: {} },
        { id: 'P003', name: '韓國泡麵組合包', description: '5種口味各2包', price: 450, stock: 20, image: 'https://picsum.photos/400/300?random=3', category: '零食食品', options: { '辣度': ['辛辣', '微辣', '不辣'] } },
        { id: 'P004', name: '韓國氣墊粉餅', description: '輕盈服貼，自然裸妝感', price: 680, stock: 15, image: 'https://picsum.photos/400/300?random=4', category: '美妝保養', options: { '色號': ['21象牙白', '23自然色'] } },
        { id: 'P005', name: '韓國蜂蜜柚子茶', description: '天然蜂蜜與柚子完美結合', price: 320, stock: 40, image: 'https://picsum.photos/400/300?random=5', category: '零食食品', options: {} },
        { id: 'P006', name: '簡約LOGO T-shirt', description: '熱門百搭單品', price: 890, stock: 12, image: 'https://picsum.photos/400/300?random=6', category: '流行服飾', options: { '顏色': ['黑色', '白色'], '尺寸': ['S', 'M', 'L'] } }
    ];

    displayProductsProgressive();
}

/**
 * 漸進式顯示商品（一個一個出現）
 */
function displayProductsProgressive() {
    const grid = document.getElementById('productsGrid');
    grid.innerHTML = ''; // 清空

    products.forEach((product, index) => {
        // 使用 setTimeout 讓每個商品依序出現
        setTimeout(() => {
            const card = createProductCard(product);
            grid.insertAdjacentHTML('beforeend', card);

            // 添加淡入動畫
            const addedCard = grid.lastElementChild;
            addedCard.style.opacity = '0';
            addedCard.style.transform = 'translateY(20px)';
            requestAnimationFrame(() => {
                addedCard.style.transition = 'opacity 0.3s ease, transform 0.3s ease';
                addedCard.style.opacity = '1';
                addedCard.style.transform = 'translateY(0)';
            });
        }, index * 80); // 每個商品間隔 80ms 出現
    });
}

/**
 * 建立單個商品卡片 HTML
 */
function createProductCard(product) {
    const images = product.image ? product.image.split(',').map(url => url.trim()) : [];
    const mainImage = images.length > 0 ? images[0] : 'https://via.placeholder.com/300';

    let imageHtml = images.length > 1 ? `
        <div class="image-slider-container">
            <div class="image-slider">${images.map(img => `<img src="${img}" class="slider-image" loading="lazy">`).join('')}</div>
            <div class="slider-dots">${images.map((_, i) => `<div class="slider-dot ${i === 0 ? 'active' : ''}"></div>`).join('')}</div>
        </div>` : `
        <div class="image-slider-container"><img src="${mainImage}" class="slider-image" loading="lazy"></div>`;

    const hasOptions = product.options && Object.keys(product.options).length > 0;
    const buttonHtml = hasOptions ? `
        <button class="card-add-btn" onclick="event.stopPropagation(); showProductDetail('${product.id}')">
            選擇規格
        </button>` : `
        <button class="card-add-btn" onclick="event.stopPropagation(); addToCartById('${product.id}')">
            加入購物車
        </button>`;

    return `
    <div class="product-card" onclick="showProductDetail('${product.id}')">
        ${imageHtml}
        <div class="product-info">
            <h3 class="product-name">${product.name}</h3>
            <div class="product-footer">
                <span class="product-price">NT$ ${product.price}</span>
                ${buttonHtml}
            </div>
        </div>
    </div>`;
}

/**
 * 顯示商品清單（保留原函數供其他地方呼叫）
 */
function displayProducts() {
    displayProductsProgressive();
}


/**
 * 直接從卡片加入購物車 (僅限無規格商品)
 */
function addToCartById(productId) {
    const product = products.find(p => String(p.id) === String(productId));
    if (product) {
        // **修改**：無規格商品傳入空的 selectedOptions
        addToCart(product, 1, {});
    }
}

/**
 * 顯示商品詳情
 */
function showProductDetail(productId) {
    const product = products.find(p => String(p.id) === String(productId));
    if (!product) return;

    currentProduct = product;

    const images = product.image ? product.image.split(',').map(url => url.trim()) : [];
    let imageHtml = images.length > 1 ? `
        <div class="image-slider-container">
            <div class="image-slider">${images.map(img => `<img src="${img}" class="slider-image">`).join('')}</div>
            <div class="slider-dots">${images.map((_, i) => `<div class="slider-dot ${i === 0 ? 'active' : ''}"></div>`).join('')}</div>
        </div>` : `
        <div class="image-slider-container"><img src="${images.length > 0 ? images[0] : 'https://via.placeholder.com/300'}" class="slider-image"></div>`;

    document.querySelector('.product-detail-image').innerHTML = imageHtml;
    document.getElementById('modalProductName').textContent = product.name;
    document.getElementById('modalProductPrice').textContent = `NT$ ${product.price}`;
    document.getElementById('modalProductDescription').textContent = product.description || '暫無描述';
    document.getElementById('modalQuantity').value = 1;

    // **新增**：動態產生商品選項
    const optionsContainer = document.getElementById('modalProductOptions');
    optionsContainer.innerHTML = ''; // 清空舊選項
    const hasOptions = product.options && Object.keys(product.options).length > 0;

    if (hasOptions) {
        Object.entries(product.options).forEach(([key, values]) => {
            const optionEl = document.createElement('div');
            optionEl.className = 'product-option';
            optionEl.innerHTML = `
                <label>${key}:</label>
                <select class="option-select" data-option-key="${key}">
                    ${values.map(value => `<option value="${value}">${value}</option>`).join('')}
                </select>
            `;
            optionsContainer.appendChild(optionEl);
        });
    }

    showModal('productModal');
}

function increaseQuantity() {
    const input = document.getElementById('modalQuantity');
    input.value = parseInt(input.value) + 1;
}

function decreaseQuantity() {
    const input = document.getElementById('modalQuantity');
    if (parseInt(input.value) > 1) {
        input.value = parseInt(input.value) - 1;
    }
}

/**
 * 從模態框加入購物車
 */
function addToCartFromModal() {
    const quantity = parseInt(document.getElementById('modalQuantity').value);

    // **新增**：獲取選擇的選項
    const selectedOptions = {};
    document.querySelectorAll('#modalProductOptions .option-select').forEach(select => {
        const key = select.dataset.optionKey;
        const value = select.value;
        selectedOptions[key] = value;
    });

    addToCart(currentProduct, quantity, selectedOptions);
    closeProductModal();
}

function closeProductModal() {
    closeModal('productModal');
}

// ===== 購物車管理 =====

/**
 * **核心修改**：產生購物車內唯一ID
 */
function getCartItemId(productId, options) {
    if (!options || Object.keys(options).length === 0) {
        return productId;
    }
    // 排序 key 以確保順序一致，例如 {b:1, a:2} 和 {a:2, b:1} 視為相同
    const sortedOptions = Object.keys(options).sort().reduce((obj, key) => {
        obj[key] = options[key];
        return obj;
    }, {});
    return productId + '-' + JSON.stringify(sortedOptions);
}


/**
 * **核心修改**：加入購物車
 */
function addToCart(product, quantity, selectedOptions) {
    const cartItemId = getCartItemId(product.id, selectedOptions);
    const existingItem = cart.find(item => item.cartItemId === cartItemId);

    if (existingItem) {
        existingItem.quantity += quantity;
    } else {
        const images = product.image ? product.image.split(',').map(url => url.trim()) : [];
        const mainImage = images.length > 0 ? images[0] : 'https://via.placeholder.com/300';

        cart.push({
            cartItemId: cartItemId, // 使用新的唯一 ID
            id: product.id,
            name: product.name,
            price: product.price,
            image: mainImage,
            quantity: quantity,
            selectedOptions: selectedOptions // 儲存選項
        });
    }

    saveCartToLocalStorage();
    updateCartUI();
    showNotification('已加入購物車！');
}


/**
 * **核心修改**：更新購物車 UI
 */
function updateCartUI() {
    const cartItems = document.getElementById('cartItems');
    const cartBadge = document.getElementById('cartBadge');
    const totalAmount = document.getElementById('totalAmount');
    const checkoutBtn = document.getElementById('checkoutBtn');

    const totalItems = cart.reduce((sum, item) => sum + item.quantity, 0);
    cartBadge.textContent = totalItems;

    const subtotal = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    const shippingFee = getShippingFee();
    const total = cart.length > 0 ? subtotal + shippingFee : 0;

    // 顯示運費和總計
    if (cart.length > 0) {
        const shippingText = shippingFee > 0 ? `NT$ ${shippingFee}` : '免運';
        totalAmount.innerHTML = `
            <div class="cart-subtotal">小計：NT$ ${subtotal.toLocaleString()}</div>
            <div class="cart-shipping">運費（${getShippingMethodName()}）：${shippingText}</div>
            <div class="cart-final-total">NT$ ${total.toLocaleString()}</div>`;
    } else {
        totalAmount.textContent = 'NT$ 0';
    }

    if (cart.length === 0) {
        cartItems.innerHTML = `<div class="empty-cart"><p>購物車是空的</p><p class="empty-cart-hint">快去挑選喜歡的商品吧！</p></div>`;
        checkoutBtn.disabled = true;
    } else {
        cartItems.innerHTML = cart.map((item, index) => {
            // **新增**：顯示選項
            let optionsHtml = '';
            if (item.selectedOptions && Object.keys(item.selectedOptions).length > 0) {
                optionsHtml = '<div class="cart-item-options">' +
                    Object.entries(item.selectedOptions)
                        .map(([key, value]) => `<span>${key}: ${value}</span>`)
                        .join(' ') +
                    '</div>';
            }

            return `
            <div class="cart-item">
                <img src="${item.image}" alt="${item.name}" class="cart-item-image">
                <div class="cart-item-info">
                    <div class="cart-item-name">${item.name}</div>
                    ${optionsHtml}
                    <div class="cart-item-price">NT$ ${item.price}</div>
                    <div class="cart-item-quantity">
                        <button class="qty-btn-small" onclick="updateCartQuantity(${index}, -1)">-</button>
                        <span>${item.quantity}</span>
                        <button class="qty-btn-small" onclick="updateCartQuantity(${index}, 1)">+</button>
                    </div>
                </div>
                <button class="remove-item" onclick="removeFromCart(${index})">🗑️</button>
            </div>
        `}).join('');
        checkoutBtn.disabled = false;
    }
}

/**
 * **核心修改**：更新購物車商品數量
 */
function updateCartQuantity(index, change) {
    const item = cart[index];
    if (!item) return;

    const newQuantity = item.quantity + change;
    if (newQuantity <= 0) {
        removeFromCart(index);
        return;
    }

    item.quantity = newQuantity;
    saveCartToLocalStorage();
    updateCartUI();
}

/**
 * **核心修改**：移除購物車商品
 */
function removeFromCart(index) {
    cart.splice(index, 1);
    saveCartToLocalStorage();
    updateCartUI();
}

function toggleCart() {
    document.getElementById('cartSidebar').classList.toggle('active');
    document.getElementById('overlay').classList.toggle('active');
}

function saveCartToLocalStorage() {
    localStorage.setItem('koreanShoppingCart', JSON.stringify(cart));
}

function loadCartFromLocalStorage() {
    const savedCart = localStorage.getItem('koreanShoppingCart');
    if (savedCart) {
        cart = JSON.parse(savedCart);
    }
}

// ===== 結帳流程 =====

// 運送方式設定
const SHIPPING_METHODS = {
    'pickup': { name: '限台中市面交', fee: 0 },
    '711': { name: '7-11 店到店', fee: 60 }
};
let selectedShippingMethod = '711'; // 預設 711 店到店

/**
 * 更新運送方式
 */
function updateShippingMethod(method) {
    selectedShippingMethod = method;
    localStorage.setItem('shippingMethod', method);
    updateCartUI();
}

/**
 * 取得目前運費
 */
function getShippingFee() {
    return SHIPPING_METHODS[selectedShippingMethod]?.fee || 0;
}

/**
 * 取得目前運送方式名稱
 */
function getShippingMethodName() {
    return SHIPPING_METHODS[selectedShippingMethod]?.name || '';
}

/**
 * 根據運送方式顯示/隱藏門市欄位
 */
function toggleStoreFields() {
    const storeFields = document.getElementById('storeFieldsSection');
    const shippingNotice = document.querySelector('.shipping-notice');

    if (storeFields) {
        if (selectedShippingMethod === '711') {
            storeFields.style.display = 'block';
            if (shippingNotice) shippingNotice.style.display = 'block';
            // 設定為必填
            document.getElementById('storeName').required = true;
            document.getElementById('storeCode').required = true;
            document.getElementById('storeAddress').required = true;
        } else {
            storeFields.style.display = 'none';
            if (shippingNotice) shippingNotice.style.display = 'none';
            // 取消必填
            document.getElementById('storeName').required = false;
            document.getElementById('storeCode').required = false;
            document.getElementById('storeAddress').required = false;
        }
    }
}

function showCheckout() {
    if (cart.length === 0) return;
    toggleCart();

    const orderSummary = document.getElementById('orderSummary');
    const orderTotal = document.getElementById('orderTotal');
    const subtotal = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    const shippingFee = getShippingFee();
    const total = subtotal + shippingFee;

    let summaryHTML = cart.map(item => {
        // **新增**：顯示選項於訂單摘要
        let optionText = '';
        if (item.selectedOptions && Object.keys(item.selectedOptions).length > 0) {
            optionText = ` <small>(${Object.values(item.selectedOptions).join(', ')})</small>`;
        }
        return `
        <div class="summary-item">
            <span>${item.name}${optionText} x ${item.quantity}</span>
            <span>NT$ ${(item.price * item.quantity).toLocaleString()}</span>
        </div>`;
    }).join('');

    // 加入運費項目
    const shippingText = shippingFee > 0 ? `NT$ ${shippingFee}` : '免運';
    summaryHTML += `
        <div class="summary-item shipping-fee">
            <span>運費（${getShippingMethodName()}）</span>
            <span>${shippingText}</span>
        </div>`;

    orderSummary.innerHTML = summaryHTML;
    orderTotal.textContent = `NT$ ${total.toLocaleString()}`;

    // 根據運送方式顯示/隱藏門市欄位
    toggleStoreFields();

    showModal('checkoutModal');
}


async function handleOrderSubmit(e) {
    e.preventDefault();

    const formData = {
        customerName: document.getElementById('customerName').value,
        customerPhone: document.getElementById('customerPhone').value,
        customerLineId: document.getElementById('customerLineId').value,
        customerEmail: document.getElementById('customerEmail').value,
        // 711 店到店資訊
        storeName: document.getElementById('storeName').value,
        storeCode: document.getElementById('storeCode').value,
        storeAddress: document.getElementById('storeAddress').value,
        customerNote: document.getElementById('customerNote').value || '', // 備注欄位（選填）
    };

    showLoadingOverlay();
    const submitBtn = e.target.querySelector('.submit-order-btn');
    submitBtn.disabled = true;

    try {
        const orderId = 'KR' + new Date().toISOString().slice(0, 10).replace(/-/g, '') + Math.random().toString().slice(2, 6);

        // **核心修改**：確保 selectedOptions 被傳送到後端
        const simplifiedItems = cart.map(item => ({
            id: item.id,
            name: item.name,
            quantity: item.quantity,
            price: item.price,
            selectedOptions: item.selectedOptions // 包含選項資訊
        }));

        const payload = {
            action: 'submitOrder',
            orderData: {
                ...formData,
                items: simplifiedItems,
                shippingMethod: getShippingMethodName(), // 運送方式
                shippingFee: getShippingFee(), // 運費
                total: cart.reduce((sum, item) => sum + (item.price * item.quantity), 0) + getShippingFee(), // 總金額含運費
                orderId: orderId
            }
        };

        const response = await fetch(GAS_API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'text/plain;charset=utf-8' },
            body: JSON.stringify(payload)
        });

        const result = await response.json();
        console.log('Backend Version:', result.version);

        if (result.success) {
            setTimeout(() => {
                hideLoadingOverlay();
                document.getElementById('orderNumber').textContent = orderId;
                closeModal('checkoutModal');
                showModal('successModal');

                loadProducts(); // 重新載入商品 (未來可同步庫存)
                cart = [];
                saveCartToLocalStorage();
                updateCartUI();
                document.getElementById('orderForm').reset();
                submitBtn.disabled = false;
            }, 1000);
        } else {
            throw new Error(result.error || 'Unknown error');
        }

    } catch (error) {
        console.error('送出訂單失敗:', error);
        hideLoadingOverlay();
        submitBtn.disabled = false;
        alert('訂單送出失敗，請稍後再試\n錯誤: ' + error.message);
    }
}


function closeCheckoutModal() {
    closeModal('checkoutModal');
}

function closeSuccessModal() {
    closeModal('successModal');
}

// ===== 模態框控制 =====

function showModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.classList.add('active');
        document.body.classList.add('no-scroll');

        // 確保模態框內容捲動到最上方
        const modalContent = modal.querySelector('.modal-content');
        if (modalContent) {
            modalContent.scrollTop = 0;
        }
    }
}

function closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.classList.remove('active');
        document.body.classList.remove('no-scroll');
    }
}

window.onclick = function (event) {
    if (event.target.classList.contains('modal')) {
        event.target.classList.remove('active');
        document.body.classList.remove('no-scroll');
    }
}

function openCart() {
    document.getElementById('cartSidebar').classList.add('active');
    document.getElementById('overlay').classList.add('active');
    document.body.classList.add('no-scroll');
}

function closeCart() {
    document.getElementById('cartSidebar').classList.remove('active');
    document.getElementById('overlay').classList.remove('active');
    document.body.classList.remove('no-scroll');
}

function closeAllModals() {
    document.querySelectorAll('.modal, #cartSidebar, #overlay').forEach(el => {
        el.classList.remove('active');
    });
    document.body.classList.remove('no-scroll');
}

// ===== 輔助功能 =====

function showNotification(message) {
    const notification = document.createElement('div');
    notification.className = 'notification-toast';
    notification.textContent = message;
    document.body.appendChild(notification);
    setTimeout(() => notification.remove(), 2300);
}

// 動畫樣式，如果已存在則不重複添加
if (!document.getElementById('gemini-animations')) {
    const style = document.createElement('style');
    style.id = 'gemini-animations';
    style.textContent = `
        .notification-toast {
            position: fixed;
            top: 100px;
            right: 20px;
            background: linear-gradient(135deg, #11998e 0%, #38ef7d 100%);
            color: white;
            padding: 1rem 2rem;
            border-radius: 12px;
            box-shadow: 0 4px 16px rgba(0, 0, 0, 0.2);
            z-index: 10000;
            animation: slideIn 0.3s ease forwards, slideOut 0.3s ease 2s forwards;
        }
        @keyframes slideIn {
            from { transform: translateX(120%); opacity: 0; }
            to { transform: translateX(0); opacity: 1; }
        }
        @keyframes slideOut {
            from { transform: translateX(0); opacity: 1; }
            to { transform: translateX(120%); opacity: 0; }
        }
        .loading-overlay {
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(255, 255, 255, 0.7);
            display: flex;
            justify-content: center;
            align-items: center;
            z-index: 9999;
            opacity: 0;
            visibility: hidden;
            transition: opacity 0.3s, visibility 0.3s;
        }
        .loading-overlay.active {
            opacity: 1;
            visibility: visible;
        }
        .spinner {
            border: 4px solid rgba(0, 0, 0, 0.1);
            width: 36px;
            height: 36px;
            border-radius: 50%;
            border-left-color: #09f;
            animation: spin 1s ease infinite;
        }
        @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
        }
    `;
    document.head.appendChild(style);
}

function showLoadingOverlay() {
    let loadingOverlay = document.getElementById('loadingOverlay');
    if (!loadingOverlay) {
        loadingOverlay = document.createElement('div');
        loadingOverlay.id = 'loadingOverlay';
        loadingOverlay.className = 'loading-overlay';
        loadingOverlay.innerHTML = `<div class="spinner"></div>`;
        document.body.appendChild(loadingOverlay);
    }
    loadingOverlay.classList.add('active');
}

function hideLoadingOverlay() {
    const loadingOverlay = document.getElementById('loadingOverlay');
    if (loadingOverlay) {
        loadingOverlay.classList.remove('active');
    }
}
