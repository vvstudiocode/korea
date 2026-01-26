/**
 * Products 商品模組 - 商品載入、快取與顯示
 * Rule #1 模組化: 簡單部件透過清晰介面連接
 * Rule #6 簡約規則: 大程式只有在證明其他方法不行時才寫
 */

const Products = {
    // 商品列表
    items: [],
    // KOL 商品列表（商店模式用）
    kolItems: [],

    /**
     * 載入商品（含快取機制）
     * @param {string} storeId - KOL 商店 ID (可選)
     * @returns {Promise<Array>} 商品陣列
     */
    async load(storeId = null) {
        const grid = document.getElementById('productsGrid');

        // 1. 先嘗試從快取載入
        const cached = Storage.getCachedProducts();
        if (cached) {
            console.log('📦 從快取載入商品');
            this.items = cached;
            window.products = this.items; // 暴露給 page-renderer.js 使用
            this.displayProgressive();
        } else if (grid) {
            grid.innerHTML = '<div class="loading">載入商品中...</div>';
        }

        // 2. 背景從 API 更新資料
        try {
            let products;
            // 判斷是否為獨立網站 (有自訂 API URL)
            // 如果是獨立網站，即使有 storeId，也應該視為該站點的"總部"，使用 getProducts
            const isStandaloneSite = typeof window !== 'undefined' && (window.CUSTOM_API_URL || window.SITE_CONFIG?.apiUrl);

            if (storeId && !isStandaloneSite) {
                // 真正的 KOL 子商店模式 (依附於總部)
                const data = await API.call('getStoreProducts', { storeId });
                if (data.data && data.data.products) {
                    this.kolItems = data.data.products;
                    window.kolProducts = this.kolItems; // 相容舊版
                    console.log(`✅ KOL模式: 載入 ${this.kolItems.length} 個商品`);
                    return this.kolItems;
                }
            } else {
                // 總部模式 或 獨立網站模式
                products = await API.getProducts();
                if (JSON.stringify(products) !== JSON.stringify(this.items)) {
                    console.log('🔄 更新商品資料');
                    this.items = products;
                    Storage.cacheProducts(products);
                    this.displayProgressive();
                } else {
                    console.log('✅ 商品資料無變化');
                    Storage.cacheProducts(this.items);
                }
                // 暴露給 page-renderer.js 使用
                window.products = this.items;
            }

            return this.items;
        } catch (error) {
            console.error('載入商品失敗:', error);
            if (!cached && grid) {
                grid.innerHTML = '<div class="loading">⚠️ 無法連接到伺服器<br><small>請確認網路連線</small></div>';
            }
            return this.items;
        }
    },

    /**
     * 根據 ID 取得商品
     * @param {string} productId - 商品 ID
     * @returns {Object|null} 商品物件
     */
    getById(productId) {
        // 優先檢查 KOL 商品
        if (this.kolItems.length > 0) {
            const kolProduct = this.kolItems.find(p => String(p.id) === String(productId));
            if (kolProduct) return kolProduct;
        }

        // 再檢查一般商品
        return this.items.find(p => String(p.id) === String(productId)) || null;
    },

    /**
     * 漸進式顯示商品（一個一個出現）
     */
    displayProgressive() {
        const grid = document.getElementById('productsGrid');
        if (!grid) return;

        grid.innerHTML = '';

        this.items.forEach((product, index) => {
            setTimeout(() => {
                const card = this.createCard(product);
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
            }, index * 80);
        });
    },

    /**
     * 建立商品卡片 HTML
     * @param {Object} product - 商品物件
     * @returns {string} HTML 字串
     */
    createCard(product) {
        const images = product.image ? product.image.split(',').map(url => url.trim()) : [];
        const mainImage = images.length > 0 ? images[0] : 'https://via.placeholder.com/300';

        let imageHtml = images.length > 1 ? `
            <div class="image-slider-container">
                <div class="image-slider">${images.map(img => `<img src="${img}" class="slider-image" loading="lazy">`).join('')}</div>
                <div class="slider-dots">${images.map((_, i) => `<div class="slider-dot ${i === 0 ? 'active' : ''}"></div>`).join('')}</div>
            </div>` : `
            <div class="image-slider-container"><img src="${mainImage}" class="slider-image" loading="lazy"></div>`;

        const hasOptions = product.options && Object.keys(product.options).length > 0;

        // 判斷庫存邏輯
        let isSoldOut = false;
        if (hasOptions && product.variants && Array.isArray(product.variants) && product.variants.length > 0) {
            const hasVariantStock = product.variants.some(v => Number(v.stock) > 0);
            isSoldOut = !hasVariantStock;
        } else {
            isSoldOut = typeof product.stock !== 'undefined' && Number(product.stock) <= 0;
        }

        let buttonHtml;
        if (isSoldOut) {
            buttonHtml = `<button class="card-add-btn sold-out" disabled style="background-color: #ccc; cursor: not-allowed;">已售完</button>`;
        } else if (hasOptions) {
            buttonHtml = `<button class="card-add-btn" onclick="event.stopPropagation(); ProductDetail.show('${product.id}')">選擇規格</button>`;
        } else {
            buttonHtml = `<button class="card-add-btn" onclick="event.stopPropagation(); Cart.addById('${product.id}')">加入購物車</button>`;
        }

        return `
        <div class="product-card" onclick="window.open('/korea/products/${product.id}/', '_blank')">
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
};

// 掛載到 window
if (typeof window !== 'undefined') {
    window.Products = Products;
}
