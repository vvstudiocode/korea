/**
 * Storage 模組 - 封裝 LocalStorage 操作
 * Rule #4 分離性: 將策略與機制分離
 * Rule #8 穩健性: 穩健性來自透明與簡單
 */

const Storage = {
    /**
     * 儲存資料到 LocalStorage
     * @param {string} key - 儲存鍵
     * @param {*} value - 要儲存的值（會自動 JSON 序列化）
     */
    set(key, value) {
        try {
            localStorage.setItem(key, JSON.stringify(value));
        } catch (error) {
            console.error(`[Storage] 儲存 ${key} 失敗:`, error);
        }
    },

    /**
     * 從 LocalStorage 取得資料
     * @param {string} key - 儲存鍵
     * @param {*} defaultValue - 預設值（找不到時返回）
     * @returns {*} 儲存的值或預設值
     */
    get(key, defaultValue = null) {
        try {
            const item = localStorage.getItem(key);
            return item ? JSON.parse(item) : defaultValue;
        } catch (error) {
            console.error(`[Storage] 讀取 ${key} 失敗:`, error);
            return defaultValue;
        }
    },

    /**
     * 從 LocalStorage 移除資料
     * @param {string} key - 儲存鍵
     */
    remove(key) {
        try {
            localStorage.removeItem(key);
        } catch (error) {
            console.error(`[Storage] 移除 ${key} 失敗:`, error);
        }
    },

    /**
     * 清除所有 LocalStorage 資料
     */
    clear() {
        try {
            localStorage.clear();
        } catch (error) {
            console.error('[Storage] 清除失敗:', error);
        }
    },

    // ===== 購物車專用方法 =====
    get CART_KEY() {
        if (typeof window !== 'undefined' && window.currentStoreId) {
            return 'kol_cart_' + window.currentStoreId;
        }
        return 'koreanShoppingCart';
    },

    /**
     * 取得購物車內容
     * @returns {Array} 購物車項目陣列
     */
    getCart() {
        return this.get(this.CART_KEY, []);
    },

    /**
     * 儲存購物車內容
     * @param {Array} cart - 購物車項目陣列
     */
    saveCart(cart) {
        this.set(this.CART_KEY, cart);
    },

    /**
     * 清空購物車
     */
    clearCart() {
        this.remove(this.CART_KEY);
    },

    // ===== 商品快取專用方法 =====
    PRODUCTS_CACHE_KEY: 'koreanShoppingProducts',
    CACHE_EXPIRY_MS: 5 * 60 * 1000, // 5 分鐘

    /**
     * 儲存商品到快取
     * @param {Array} products - 商品陣列
     */
    cacheProducts(products) {
        this.set(this.PRODUCTS_CACHE_KEY, {
            products,
            timestamp: Date.now()
        });
    },

    /**
     * 從快取取得商品
     * @returns {Array|null} 商品陣列或 null（如果快取過期）
     */
    getCachedProducts() {
        const cached = this.get(this.PRODUCTS_CACHE_KEY);
        if (!cached) return null;

        const isExpired = Date.now() - cached.timestamp > this.CACHE_EXPIRY_MS;
        if (isExpired) {
            this.remove(this.PRODUCTS_CACHE_KEY);
            return null;
        }

        return cached.products;
    },

    /**
     * 清除商品快取
     */
    clearProductsCache() {
        this.remove(this.PRODUCTS_CACHE_KEY);
    }
};

// 如果在瀏覽器環境，掛載到 window
if (typeof window !== 'undefined') {
    window.Storage = Storage;
}

// 如果支援 ES 模組匯出
if (typeof module !== 'undefined' && module.exports) {
    module.exports = Storage;
}
