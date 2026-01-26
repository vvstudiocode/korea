/**
 * Storage 模組 - 封裝 LocalStorage 操作
 * Rule #4 分離性: 將策略與機制分離
 * Rule #8 穩健性: 穩健性來自透明與簡單
 * 
 * 🔒 商店隔離：使用 SITE_CONFIG.id 作為 localStorage key 前綴
 *    - 總部 (無 SITE_CONFIG): 使用 'omo_' 前綴
 *    - 獨立網站 (有 SITE_CONFIG): 使用 '{siteId}_' 前綴
 */

const AppStorage = {
    // ===== 商店前綴 (核心隔離機制) =====
    /**
     * 取得當前商店的 localStorage key 前綴
     * @returns {string} 前綴字串 (如 'omo_' 或 'store_xxx_')
     * 
     * 支援多種設定來源：
     * - SITE_CONFIG.siteId (新版生成器注入)
     * - SITE_CONFIG.id (舊版兼容)
     * - STORE_CONFIG.storeId (前台頁面)
     */
    get STORE_PREFIX() {
        if (typeof window !== 'undefined') {
            // 優先使用 SITE_CONFIG.siteId (新版生成器)
            if (window.SITE_CONFIG?.siteId) {
                return window.SITE_CONFIG.siteId + '_';
            }
            // 兼容舊版 SITE_CONFIG.id
            if (window.SITE_CONFIG?.id) {
                return window.SITE_CONFIG.id + '_';
            }
            // 支援前台頁面的 STORE_CONFIG
            if (window.STORE_CONFIG?.storeId) {
                return window.STORE_CONFIG.storeId + '_';
            }
        }
        // 總部預設使用 'omo_' 前綴
        return 'omo_';
    },

    /**
     * 儲存資料到 LocalStorage
     * @param {string} key - 儲存鍵
     * @param {*} value - 要儲存的值（會自動 JSON 序列化）
     */
    set(key, value) {
        try {
            localStorage.setItem(key, JSON.stringify(value));
        } catch (error) {
            console.error(`[AppStorage] 儲存 ${key} 失敗:`, error);
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
            console.error(`[AppStorage] 讀取 ${key} 失敗:`, error);
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
            console.error(`[AppStorage] 移除 ${key} 失敗:`, error);
        }
    },

    /**
     * 清除所有 LocalStorage 資料
     */
    clear() {
        try {
            localStorage.clear();
        } catch (error) {
            console.error('[AppStorage] 清除失敗:', error);
        }
    },

    // ===== 購物車專用方法 =====
    /**
     * 購物車 Key (帶商店前綴)
     */
    get CART_KEY() {
        return this.STORE_PREFIX + 'cart';
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

    // ===== 版面配置快取 =====
    /**
     * 版面配置快取 Key (帶商店前綴)
     */
    get LAYOUT_CACHE_KEY() {
        return this.STORE_PREFIX + 'cached_layout';
    },

    /**
     * 儲存版面配置到快取
     * @param {Object} layout - 版面配置物件
     */
    cacheLayout(layout) {
        this.set(this.LAYOUT_CACHE_KEY, layout);
    },

    /**
     * 從快取取得版面配置
     * @returns {Object|null} 版面配置或 null
     */
    getCachedLayout() {
        return this.get(this.LAYOUT_CACHE_KEY);
    },

    /**
     * 清除版面配置快取
     */
    clearLayoutCache() {
        this.remove(this.LAYOUT_CACHE_KEY);
    },

    // ===== 商品快取專用方法 =====
    /**
     * 商品快取 Key (帶商店前綴)
     */
    get PRODUCTS_CACHE_KEY() {
        return this.STORE_PREFIX + 'products_cache';
    },

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
    },

    // ===== 工具方法 =====
    /**
     * 取得當前商店 ID
     * @returns {string|null} 商店 ID 或 null (總部)
     */
    getStoreId() {
        if (typeof window !== 'undefined') {
            // 優先使用 SITE_CONFIG.siteId (新版生成器注入)
            if (window.SITE_CONFIG?.siteId) return window.SITE_CONFIG.siteId;
            // 兼容舊版 SITE_CONFIG.id
            if (window.SITE_CONFIG?.id) return window.SITE_CONFIG.id;
            // 支援前台頁面的 STORE_CONFIG
            if (window.STORE_CONFIG?.storeId) return window.STORE_CONFIG.storeId;
        }
        return null;
    },

    /**
     * 取得首頁 URL (用於返回按鈕)
     * @returns {string} 首頁 URL
     */
    getHomeUrl() {
        const storeId = this.getStoreId();
        if (storeId) {
            return '/korea/stores/' + storeId + '/';
        }
        return '/korea/';
    }
};

// 如果在瀏覽器環境，掛載到 window
if (typeof window !== 'undefined') {
    window.AppStorage = AppStorage;
}

// 如果支援 ES 模組匯出
if (typeof module !== 'undefined' && module.exports) {
    module.exports = AppStorage;
}
