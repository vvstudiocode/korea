/**
 * 韓國代購網站 - 前端 JavaScript
 * 功能：商品展示、購物車、結帳流程
 */

// ===== 設定 =====
const GAS_API_URL = 'https://script.google.com/macros/s/AKfycby7V5VwHfn_Tb-wpg_SSrme2c2P5bin6qjhxEkr80RDLg6p5TPn2EXySkpG9qnyvfNF/exec';

// ===== 全域變數 =====
let products = [];
let cart = [];
let currentProduct = null;
let currentCategory = 'all';

// ===== KOL 商店模式 =====
let currentStoreId = null;
let currentStoreInfo = null;

// ===== 初始化 =====
document.addEventListener('DOMContentLoaded', () => {
    initializeApp();
    setupEventListeners();
});

/**
 * 初始化應用程式
 */
async function initializeApp() {
    console.log('App Version: 2.5 (KOL Scroll Fix)');
    // 進入頁面時捲動至頂部
    if ('scrollRestoration' in history) {
        history.scrollRestoration = 'manual';
    }
    window.scrollTo(0, 0);

    // 0. 檢查是否為 KOL 商店模式

    await initStoreMode();

    // 1. 如果有快取排版，立即隱藏預設區域
    const cachedLayout = localStorage.getItem('omo_cached_layout');
    if (cachedLayout) {
        const defaultSection = document.querySelector('.products-section');
        if (defaultSection) defaultSection.style.display = 'none';
    }

    // 確保 showProductDetail 全域可用
    if (typeof showProductDetail === 'function') {
        window.showProductDetail = showProductDetail;
    }

    await loadProducts();
    loadCartFromLocalStorage();
    updateCartUI();

    // 3. 處理 URL 參數 (LINE Bot 快速下單連結)
    handleUrlParameters();

    // 4. 初始化頁面渲染器 (它內部會處理快取與遠端更新)
    if (typeof PageRenderer !== 'undefined') {
        PageRenderer.init(currentStoreId);
    }
}

/**
 * 處理 URL 參數（支援 LINE Bot 快速下單連結）
 */
function handleUrlParameters() {
    const urlParams = new URLSearchParams(window.location.search);
    const productId = urlParams.get('product');
    const qty = parseInt(urlParams.get('qty')) || 1;

    if (productId) {
        console.log(`📱 LINE 快速下單: 商品 ${productId}, 數量 ${qty}`);

        // 等待商品載入完成再處理
        setTimeout(() => {
            // 從所有可能的商品來源尋找
            let targetProducts = products;
            if (window.kolProducts && window.kolProducts.length > 0) {
                targetProducts = window.kolProducts;
            }

            const product = targetProducts.find(p => String(p.id) === productId);

            if (product) {
                // 檢查是否需要選擇規格
                const hasOptions = product.options && Object.keys(product.options).length > 0;

                if (hasOptions) {
                    // 有規格的商品，打開詳情讓用戶選擇
                    showProductDetail(productId);
                    showNotification(`請選擇規格後加入購物車`);
                } else {
                    // 無規格商品，直接加入購物車
                    addToCart(product, qty, {});
                    showNotification(`已加入 ${qty} 件「${product.name}」`);

                    // 如果 URL 有 #checkout，自動打開購物車
                    if (window.location.hash === '#checkout') {
                        setTimeout(() => toggleCart(), 500);
                    }
                }
            } else {
                console.warn(`❌ 找不到商品: ${productId}`);
                showNotification(`找不到商品 ${productId}`);
            }

            // 清除 URL 參數（避免重新載入時重複加入）
            const newUrl = window.location.pathname + window.location.hash;
            window.history.replaceState({}, document.title, newUrl);
        }, 1000); // 延遲 1 秒確保商品已載入
    }
}

/**
 * 初始化 KOL 商店模式
 */
async function initStoreMode() {
    const urlParams = new URLSearchParams(window.location.search);
    const storeId = urlParams.get('store');

    if (!storeId) {
        console.log('📌 官方直營模式');
        return;
    }

    // KOL模式: 立即清空載入畫面文字，避免顯示預設的 OMO Select
    const loadingTexts = document.querySelectorAll('.loading-text, .loading-screen h2, #loadingText');
    loadingTexts.forEach(el => {
        el.textContent = ''; // 清空文字，只留轉圈圈
    });

    // 或者顯示載入中...
    // document.querySelector('.loading-text').textContent = 'Loading...';

    currentStoreId = storeId;

    console.log(`🏪 KOL 商店模式: ${storeId}`);
    currentStoreId = storeId;

    try {
        // 獲取商店基本資訊 (含品牌色、Logo)
        const response = await fetch(`${GAS_API_URL}?action=getStoreProducts&storeId=${storeId}`);
        const result = await response.json();

        console.log('📦 getStoreProducts API 響應:', result);

        if (result.success && result.data) {
            // 商店資訊在 result.data.storeInfo
            currentStoreInfo = result.data.storeInfo || null;

            if (currentStoreInfo) {
                console.log('✅ 商店資訊:', currentStoreInfo);
                applyStoreTheme(currentStoreInfo);
            } else {
                console.warn('⚠️ result.data.storeInfo 為空');
            }
        } else {
            console.warn('⚠️ 無法載入商店資訊，使用預設樣式');
            console.warn('   API響應:', result);
        }
    } catch (error) {
        console.error('❌ 載入商店資訊失敗:', error);
    }
}

/**
 * 套用 KOL 商店品牌主題
 */
function applyStoreTheme(storeInfo) {
    if (!storeInfo) return;

    // 套用品牌主題色
    if (storeInfo.themeColor) {
        document.documentElement.style.setProperty('--primary-color', storeInfo.themeColor);
        document.documentElement.style.setProperty('--accent-color', storeInfo.themeColor);

        // 更新 header 背景色 (可選)
        const header = document.querySelector('header');
        if (header) {
            header.style.borderBottomColor = storeInfo.themeColor;
        }
    }

    // 更新 Logo
    if (storeInfo.logoUrl) {
        const logo = document.querySelector('.logo img');
        if (logo) {
            logo.src = storeInfo.logoUrl;
            logo.alt = storeInfo.storeName || 'Store Logo';
        }
    }

    // 更新店名
    if (storeInfo.storeName) {
        const siteTitle = document.querySelector('.logo span, .site-title');
        if (siteTitle) {
            siteTitle.textContent = storeInfo.storeName;
        }
        document.title = `${storeInfo.storeName} | 韓國代購`;
    }

    console.log('✅ 已套用商店品牌樣式:', storeInfo.storeName);
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
    } else if (productsGrid) {
        productsGrid.innerHTML = '<div class="loading">載入商品中...</div>';
    }

    // 2. 背景從 API 更新資料
    try {
        // 根據是否為 KOL 商店模式選擇 API
        let apiUrl = `${GAS_API_URL}?action=getProducts`;
        if (currentStoreId) {
            apiUrl = `${GAS_API_URL}?action=getStoreProducts&storeId=${currentStoreId}`;
        }

        const response = await fetch(apiUrl);
        const result = await response.json();

        // KOL 商店模式下,商品在 result.data.products
        if (currentStoreId && result.data && result.data.products) {
            // ⭐️ 關鍵修復:將KOL商品存到 kolProducts 變數供 PageRenderer 使用!
            window.kolProducts = result.data.products;
            // 🔥 清空products避免PageRenderer fallback載入總部商品
            window.products = [];
            products = []; // 本地變數也清空

            // 下一行賦值導致 result.data 變成陣列
            result.data = result.data.products;

            // 修正 Log 錯誤: result.data 現在是陣列，沒有 products 屬性了
            console.log(`✅ KOL模式:已設置 ${result.data.length} 個商品到 kolProducts, products已清空`);

            // 更新載入畫面名稱 (如果有商店資訊)
            if (currentStoreInfo && currentStoreInfo.storeName) {
                // 嘗試多種選擇器以確保更新
                const loadingTexts = document.querySelectorAll('.loading-text, .loading-screen h2, #loadingText');
                loadingTexts.forEach(el => el.textContent = currentStoreInfo.storeName);
            }
        }

        if (result.success) {
            // KOL模式:不更新products(避免覆蓋空陣列)
            if (currentStoreId) {
                console.log('✅ KOL模式:商品已載入到 kolProducts,跳過 products 更新');
                // PageRenderer會使用 kolProducts,所以不需要 displayProductsProgressive
            } else {
                // 總部模式:正常更新products
                const newProducts = result.data;
                if (JSON.stringify(newProducts) !== JSON.stringify(products)) {
                    console.log('🔄 更新商品資料');
                    products = newProducts;
                    saveProductsToCache(products);
                    displayProductsProgressive();
                } else {
                    console.log('✅ 商品資料無變化');
                    saveProductsToCache(products);
                }
            }
        } else if (!cached && productsGrid) {
            productsGrid.innerHTML = `<div class="loading">載入失敗：${result.error}</div>`;
        }
    } catch (error) {
        console.error('載入商品失敗:', error);
        if (!cached && productsGrid) {
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
    if (!grid) return; // 如果找不到 Grid (例如使用了自訂排版)，則不執行舊有的顯示邏輯

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

    // 判斷庫存邏輯：如果有規格，檢查是否有任何規格有庫存；否則檢查主庫存
    let isSoldOut = false;
    if (hasOptions && product.variants && Array.isArray(product.variants) && product.variants.length > 0) {
        const hasVariantStock = product.variants.some(v => Number(v.stock) > 0);
        isSoldOut = !hasVariantStock;
    } else {
        isSoldOut = typeof product.stock !== 'undefined' && Number(product.stock) <= 0;
    }

    let buttonHtml;
    if (isSoldOut) {
        buttonHtml = `
        <button class="card-add-btn sold-out" disabled style="background-color: #ccc; cursor: not-allowed;">
            已售完
        </button>`;
    } else if (hasOptions) {
        buttonHtml = `
        <button class="card-add-btn" onclick="event.stopPropagation(); showProductDetail('${product.id}')">
            選擇規格
        </button>`;
    } else {
        buttonHtml = `
        <button class="card-add-btn" onclick="event.stopPropagation(); addToCartById('${product.id}')">
            加入購物車
        </button>`;
    }

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
    // 優先檢查是否有 KOL 專屬商品列表
    let targetProducts = products;
    if (typeof kolProducts !== 'undefined' && kolProducts.length > 0) {
        targetProducts = kolProducts;
    } else if (typeof window.kolProducts !== 'undefined' && window.kolProducts.length > 0) {
        targetProducts = window.kolProducts;
    }

    const product = targetProducts.find(p => String(p.id) === String(productId));
    if (product) {
        if (typeof product.stock !== 'undefined' && Number(product.stock) <= 0) {
            alert('此商品已售完');
            return;
        }
        // **修改**：無規格商品傳入空的 selectedOptions
        addToCart(product, 1, {});
    } else {
        console.error('❌ addToCartById: 找不到商品', productId);
        // 如果找不到，嘗試打開詳情讓它去 fallback 找
        if (typeof showProductDetail === 'function') {
            showProductDetail(productId);
        }
    }
}

/**
 * 顯示商品詳情
 */
function showProductDetail(productId) {
    // 優先檢查是否有 KOL 專屬商品列表，否則使用一般商品列表
    let targetProducts = products;
    if (typeof kolProducts !== 'undefined' && kolProducts.length > 0) {
        targetProducts = kolProducts;
    } else if (typeof window.kolProducts !== 'undefined' && window.kolProducts.length > 0) {
        targetProducts = window.kolProducts;
    }

    const product = targetProducts.find(p => String(p.id) === String(productId));

    if (!product) {
        console.error('❌ showProductDetail: 找不到商品', productId);
        // Fallback: 嘗試從所有可能的來源再次尋找
        const potentialSources = [products, window.kolProducts, window.products].filter(Array.isArray).flat();
        const fallbackProduct = potentialSources.find(p => String(p.id) === String(productId));
        if (fallbackProduct) {
            console.log('✅ Fallback 找到商品:', fallbackProduct.name);
            // 遞迴調用自己並確保 logic 正確，或者直接使用 fallbackProduct
            // 為避免遞迴風險，直接繼續執行
            currentProduct = fallbackProduct;
        } else {
            return;
        }
    } else {
        currentProduct = product;
    }

    const images = (currentProduct.image || '').split(',').map(url => url.trim());
    let imageHtml = images.length > 1 ? `
        <div class="image-slider-container">
            <div class="image-slider">${images.map(img => `<img src="${img}" class="slider-image">`).join('')}</div>
            <div class="slider-dots">${images.map((_, i) => `<div class="slider-dot ${i === 0 ? 'active' : ''}"></div>`).join('')}</div>
        </div>` : `
        <div class="image-slider-container"><img src="${images.length > 0 ? images[0] : 'https://via.placeholder.com/300'}" class="slider-image"></div>`;

    document.querySelector('.product-detail-image').innerHTML = imageHtml;
    document.getElementById('modalProductName').textContent = currentProduct.name;
    document.getElementById('modalProductPrice').textContent = `NT$ ${currentProduct.price}`;
    document.getElementById('modalProductDescription').textContent = currentProduct.description || '暫無描述';

    document.getElementById('modalQuantity').value = 1;

    // 動態產生商品選項（根據 variants 判斷庫存）
    const optionsContainer = document.getElementById('modalProductOptions');
    optionsContainer.innerHTML = '';
    const hasOptions = product.options && Object.keys(product.options).length > 0;
    const variants = product.variants || [];

    if (hasOptions) {
        Object.entries(product.options).forEach(([key, values]) => {
            const optionEl = document.createElement('div');
            optionEl.className = 'product-option';

            // 建立選項 HTML，檢查每個規格的庫存
            const optionButtons = values.map(value => {
                // 找出對應的 variant（支援單規格和多規格）
                const variant = variants.find(v => {
                    const specParts = v.spec.split('/');
                    return specParts.includes(value);
                });

                const variantStock = variant ? variant.stock : null;
                const isSoldOut = variantStock !== null && variantStock <= 0;

                if (isSoldOut) {
                    return `<button type="button" class="option-btn sold-out" data-key="${key}" data-value="${value}" disabled>
                        ${value} <span class="sold-out-label">售完</span>
                    </button>`;
                } else {
                    return `<button type="button" class="option-btn" data-key="${key}" data-value="${value}" onclick="selectOption(this, '${key}', '${value}')">
                        ${value}
                    </button>`;
                }
            }).join('');

            optionEl.innerHTML = `
                <label>${key}:</label>
                <div class="option-buttons" data-option-key="${key}">
                    ${optionButtons}
                </div>
            `;
            optionsContainer.appendChild(optionEl);
        });

        // 自動選擇第一個有庫存的選項
        document.querySelectorAll('.option-buttons').forEach(group => {
            const firstAvailable = group.querySelector('.option-btn:not(.sold-out)');
            if (firstAvailable) {
                firstAvailable.classList.add('selected');
            }
        });

        // 更新價格顯示（根據選擇的規格）
        updateSelectedVariantInfo(product);
    }

    // 檢查整體庫存狀態（無規格商品用 stock，有規格商品檢查是否全部售完）
    let isAllSoldOut = false;
    if (hasOptions && variants.length > 0) {
        isAllSoldOut = variants.every(v => v.stock <= 0);
    } else {
        isAllSoldOut = typeof product.stock !== 'undefined' && Number(product.stock) <= 0;
    }

    const addToCartBtn = document.querySelector('.add-to-cart-btn');
    if (isAllSoldOut) {
        addToCartBtn.disabled = true;
        addToCartBtn.textContent = '已售完';
        addToCartBtn.style.backgroundColor = '#ccc';
        addToCartBtn.style.cursor = 'not-allowed';
    } else {
        addToCartBtn.disabled = false;
        addToCartBtn.textContent = '加入購物車';
        addToCartBtn.style.backgroundColor = '';
        addToCartBtn.style.cursor = '';
    }

    showModal('productModal');
}

/**
 * 選擇規格選項
 */
function selectOption(btn, key, value) {
    // 移除同組的其他選中狀態
    const group = btn.closest('.option-buttons');
    group.querySelectorAll('.option-btn').forEach(b => b.classList.remove('selected'));
    btn.classList.add('selected');

    // 更新價格和圖片
    updateSelectedVariantInfo(currentProduct);
}

/**
 * 根據選擇的規格更新價格和圖片
 */
function updateSelectedVariantInfo(product) {
    if (!product || !product.variants || product.variants.length === 0) return;

    // 獲取所有已選擇的規格值
    const selectedValues = [];
    document.querySelectorAll('.option-buttons').forEach(group => {
        const selected = group.querySelector('.option-btn.selected');
        if (selected) {
            selectedValues.push(selected.dataset.value);
        }
    });

    if (selectedValues.length === 0) return;

    // 組合規格字串
    const specString = selectedValues.join('/');

    // 找到對應的 variant
    const variant = product.variants.find(v => v.spec === specString);
    if (variant) {
        // 更新價格
        document.getElementById('modalProductPrice').textContent = `NT$ ${variant.price}`;

        // 更新圖片（如果有設定）
        if (variant.image) {
            const imageContainer = document.querySelector('.product-detail-image');
            const slider = imageContainer.querySelector('.image-slider');
            if (slider) {
                // 找到對應圖片並滑動到該位置
                const images = product.image.split(',').map(url => url.trim());
                const imgIndex = images.findIndex(url => url === variant.image);
                if (imgIndex >= 0) {
                    const imageWidth = slider.offsetWidth;
                    slider.scrollTo({ left: imgIndex * imageWidth, behavior: 'smooth' });
                }
            }
        }

        // 檢查選中規格的庫存
        const addToCartBtn = document.querySelector('.add-to-cart-btn');
        if (variant.stock <= 0) {
            addToCartBtn.disabled = true;
            addToCartBtn.textContent = '已售完';
            addToCartBtn.style.backgroundColor = '#ccc';
            addToCartBtn.style.cursor = 'not-allowed';
        } else {
            addToCartBtn.disabled = false;
            addToCartBtn.textContent = '加入購物車';
            addToCartBtn.style.backgroundColor = '';
            addToCartBtn.style.cursor = '';
        }
    }
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

    // 獲取選擇的選項（從按鈕）
    const selectedOptions = {};
    document.querySelectorAll('#modalProductOptions .option-buttons').forEach(group => {
        const key = group.dataset.optionKey;
        const selected = group.querySelector('.option-btn.selected');
        if (selected) {
            selectedOptions[key] = selected.dataset.value;
        }
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
    if (!product || !product.id) {
        console.error('❌ 嘗試加入無效商品:', product);
        return;
    }
    const cartItemId = getCartItemId(product.id, selectedOptions);
    const existingItem = cart.find(item => item.cartItemId === cartItemId);

    // 確定價格：如果有規格，尋找對應規格的價格
    let finalPrice = product.price;
    if (selectedOptions && Object.keys(selectedOptions).length > 0 && product.variants && product.variants.length > 0) {
        // 將選擇的規格值（如 "M", "Red"）組合為字串 "M/Red"
        const specString = Object.values(selectedOptions).join('/');
        const variant = product.variants.find(v => v.spec === specString);
        if (variant && variant.price) {
            finalPrice = variant.price;
        }
    }

    if (existingItem) {
        existingItem.quantity += quantity;
        existingItem.price = finalPrice; // 更新為最新價格（以防變動）
    } else {
        const images = String(product.image || '').split(',').map(url => url.trim());
        const mainImage = images.length > 0 && images[0] !== '' ? images[0] : 'https://via.placeholder.com/300';

        // 整理規格顯示文字
        const specText = Object.values(selectedOptions).join(' / ');

        cart.push({
            cartItemId: cartItemId,
            id: product.id,
            name: product.name,
            spec: specText, // 存入規格文字供結帳顯示
            price: finalPrice,
            image: mainImage,
            quantity: quantity,
            selectedOptions: selectedOptions
        });
    }

    saveCartToLocalStorage();
    updateCartUI();
    showNotification('已加入購物車！');
}

function updateCartUI() {
    const cartItems = document.getElementById('cartItems');
    const cartBadge = document.getElementById('cartBadge');
    const totalAmount = document.getElementById('totalAmount');
    const checkoutBtn = document.getElementById('checkoutBtn');

    // 過濾無效項目 (防止舊快取干擾)
    cart = cart.filter(item => item && item.name && item.name !== 'undefined');

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

    // showLoadingOverlay(); // 改用按鈕本身的 Loading 狀態
    const submitBtn = e.target.querySelector('.submit-order-btn');
    submitBtn.disabled = true;
    submitBtn.classList.add('loading'); // Add loading class

    try {
        const orderId = 'KR' + new Date().toISOString().slice(0, 10).replace(/-/g, '') + Math.random().toString().slice(2, 6);

        // **核心修改**：確保 selectedOptions 被傳送到後端
        const simplifiedItems = cart.map(item => {
            // 將選項物件轉換為內部規格字串 (e.g., "紅/M") 以匹配後端庫存 Spec key
            let specString = '';
            if (item.selectedOptions && Object.keys(item.selectedOptions).length > 0) {
                // 使用 Object.values 確保生成的字串格式為 "Value1/Value2" (例如 "紅/M")
                // 這必須與 admin.js 生成 variants 的邏輯一致
                specString = Object.values(item.selectedOptions).join('/');
            }

            return {
                id: item.id,
                name: item.name,
                qty: Number(item.quantity || 0), // Ensure number
                quantity: Number(item.quantity || 0),
                price: parseFloat(item.price || 0), // Ensure float
                spec: specString,
                selectedOptions: item.selectedOptions
            };
        });

        // 根據是否為 KOL 商店模式選擇 API action
        const orderAction = currentStoreId ? 'submitStoreOrder' : 'submitOrder';

        const payload = {
            action: orderAction,
            orderData: {
                ...formData,
                items: simplifiedItems,
                shippingMethod: getShippingMethodName(), // 運送方式
                shippingFee: getShippingFee(), // 運費
                total: cart.reduce((sum, item) => sum + (item.price * item.quantity), 0) + getShippingFee(), // 總金額含運費
                orderId: orderId,
                storeId: currentStoreId || null, // KOL 商店 ID
                orderType: currentStoreId ? 'kol' : 'direct' // 訂單類型
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
                // hideLoadingOverlay(); // 移除 global overlay
                submitBtn.classList.remove('loading'); // Remove loading class
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
        // hideLoadingOverlay();
        submitBtn.classList.remove('loading');
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

// ===== 訂單查詢功能 =====

function openSearchModal() {
    const modal = document.getElementById('searchOrderModal');
    if (modal) {
        modal.classList.add('active');
        document.body.classList.add('no-scroll');
        // 清空之前的查詢結果和輸入
        document.getElementById('searchPhone').value = '';
        document.getElementById('searchResults').innerHTML = '';
        setTimeout(() => {
            const phoneInput = document.getElementById('searchPhone');
            if (phoneInput) phoneInput.focus();
        }, 100);
    }
}

function closeSearchModal() {
    closeModal('searchOrderModal');
}

function handleSearchKeyPress(event) {
    if (event.key === 'Enter') {
        handleSearchOrder();
    }
}

async function handleSearchOrder() {
    const phoneInput = document.getElementById('searchPhone');
    const phoneNumber = phoneInput.value.trim();
    const resultsContainer = document.getElementById('searchResults');

    if (!phoneNumber) {
        alert('請輸入手機號碼');
        return;
    }

    if (phoneNumber.length < 8) {
        alert('請輸入正確的手機號碼格式');
        return;
    }

    showLoadingOverlay();
    resultsContainer.innerHTML = '';

    try {
        const response = await fetch(GAS_API_URL, {
            method: 'POST',
            // 這裡用 text/plain 是正確的，避免 GAS 發生 CORS 預檢 (Preflight) 錯誤
            headers: { 'Content-Type': 'text/plain;charset=utf-8' },
            body: JSON.stringify({
                action: 'searchOrder',
                phoneNumber: phoneNumber
            })
        });

        const result = await response.json();

        if (result.success) {
            console.log('🔍 Search API Result:', result); // 關鍵除錯：顯示後端回傳的完整資料

            // --- 修正點開始 ---
            // 嘗試從不同結構取得訂單資料，以防後端格式與預期不符
            let orders = [];

            if (result.data && Array.isArray(result.data.orders)) {
                orders = result.data.orders;
            } else if (Array.isArray(result.orders)) {
                orders = result.orders;
            } else if (result.data && Array.isArray(result.data)) {
                orders = result.data; // 極端情況：data 本身就是陣列
            }

            console.log('📦 Parsed Orders:', orders);

            if (orders && orders.length > 0) {
                renderSearchResults(orders);
            } else {
                console.warn('❌ No orders found in response');
                resultsContainer.innerHTML = '<div class="no-results">查無此手機號碼的訂單資料</div>';
            }
            // --- 修正點結束 ---
        } else {
            resultsContainer.innerHTML = `<div class="error-message">查詢失敗：${result.error || '未知錯誤'}</div>`;
        }
    } catch (error) {
        console.error('查詢訂單錯誤:', error);
        resultsContainer.innerHTML = '<div class="error-message">連線錯誤，請稍後再試</div>';
    } finally {
        hideLoadingOverlay();
    }
}

function renderSearchResults(orders) {
    const container = document.getElementById('searchResults');
    let html = '';

    orders.forEach(order => {
        let itemsHtml = order.items.map(item => `
            <div class="search-item-row">
                <span class="item-name">${item.name} ${item.spec !== '無規格' ? `(${item.spec})` : ''}</span>
                <span class="item-qty">x${item.qty}</span>
            </div>
        `).join('');

        html += `
            <div class="search-result-card">
                <div class="card-header">
                    <span class="order-id">#${order.orderId}</span>
                    <span class="order-status status-${getStatusClass(order.status)}">${order.status}</span>
                </div>
                <div class="card-date">訂購日期：${order.date}</div>
                <div class="card-items">
                    ${itemsHtml}
                </div>
                <div class="card-footer">
                    <div class="shipping-info">運送：${order.shipping}</div>
                    <div class="total-price">總計：NT$ ${order.total}</div>
                </div>
            </div>
        `;
    });

    container.innerHTML = html;
}

function getStatusClass(status) {
    if (status === '已出貨') return 'shipped';
    if (status === '已完成') return 'completed';
    if (status === '取消') return 'cancelled';
    return 'pending';
}


