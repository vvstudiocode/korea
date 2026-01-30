/**
 * API 模組 - 統一封裝所有 GAS API 呼叫
 * Rule #1 模組化: 簡單部件透過清晰介面連接
 * Rule #12 修復規則: 錯誤時提早且大聲地失敗
 */

/**
 * 預設 GAS API URL (總部)
 * Rule #17 可擴展性: 為未來設計
 */
const DEFAULT_API_URL = 'https://script.google.com/macros/s/AKfycby7V5VwHfn_Tb-wpg_SSrme2c2P5bin6qjhxEkr80RDLg6p5TPn2EXySkpG9qnyvfNF/exec';

const API = {
    // GAS API 基礎 URL - 支援動態設定
    // 使用 getter 確保每次呼叫時都能取得正確的 URL（支援 SITE_CONFIG 和 STORE_CONFIG）
    get BASE_URL() {
        if (typeof window !== 'undefined') {
            // 優先使用 SITE_CONFIG（新版生成器）
            if (window.SITE_CONFIG?.apiUrl) return window.SITE_CONFIG.apiUrl;
            // 其次使用 STORE_CONFIG（前台頁面）
            if (window.STORE_CONFIG?.apiUrl) return window.STORE_CONFIG.apiUrl;
            // 最後使用 CUSTOM_API_URL（後台頁面動態載入）
            if (window.CUSTOM_API_URL) return window.CUSTOM_API_URL;
        }
        return DEFAULT_API_URL;
    },

    /**
     * 發送 API 請求
     * @param {string} action - API 動作
     * @param {Object} payload - 請求資料
     * @param {string} password - 驗證密碼 (可選)
     * @returns {Promise<Object>} API 回應
     */
    async call(action, payload = {}, password = '') {
        try {
            const body = {
                action,
                password,
                ...payload
            };

            const response = await fetch(this.BASE_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'text/plain;charset=utf-8' },
                body: JSON.stringify(body)
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();

            if (!data.success) {
                throw new Error(data.message || 'API 請求失敗');
            }

            return data;
        } catch (error) {
            console.error(`[API] ${action} 失敗:`, error);
            throw error;
        }
    },

    /**
     * 取得商品列表
     * @param {string} storeId - KOL 商店 ID (可選)
     * @returns {Promise<Array>} 商品陣列
     */
    async getProducts(storeId = null) {
        const payload = storeId ? { storeId } : {};
        const data = await this.call('getProducts', payload);
        // GAS 返回格式: { success: true, data: [...products] }
        // data 直接就是商品陣列
        return Array.isArray(data.data) ? data.data : (data.products || data.data || []);
    },

    /**
     * 提交訂單
     * @param {Object} orderData - 訂單資料
     * @param {boolean} isKol - 是否為 KOL 訂單
     * @returns {Promise<Object>} 訂單結果
     */
    async submitOrder(orderData, isKol = false) {
        const action = isKol ? 'submitStoreOrder' : 'submitOrder';
        return await this.call(action, { orderData });
    },

    /**
     * 管理員登入
     * @param {string} password - 管理員密碼
     * @returns {Promise<Object>} 登入結果
     */
    async adminLogin(password) {
        return await this.call('adminLogin', {}, password);
    },

    /**
     * 取得運送選項設定
     * @returns {Promise<Object>}
     */
    async getShippingOptions() {
        return this.call('getShippingOptions');
    },

    /**
     * 取得訂單列表 (管理員用)
     * @param {string} password - 管理員密碼
     * @param {Object} filters - 篩選條件
     * @returns {Promise<Array>} 訂單陣列
     */
    async getOrders(password, filters = {}) {
        const data = await this.call('getOrders', filters, password);
        return data.orders || [];
    },

    /**
     * 更新訂單
     * @param {string} password - 管理員密碼
     * @param {Array} updates - 更新資料陣列
     * @returns {Promise<Object>} 更新結果
     */
    async updateOrders(password, updates) {
        return await this.call('updateOrders', { updates }, password);
    },

    /**
     * 更新商品
     * @param {string} password - 管理員密碼
     * @param {Array} updates - 更新資料陣列
     * @returns {Promise<Object>} 更新結果
     */
    async updateProducts(password, updates) {
        return await this.call('updateProducts', { updates }, password);
    },

    /**
     * 取得 KOL 商店資訊
     * @param {string} storeId - 商店 ID
     * @returns {Promise<Object>} 商店資訊
     */
    async getStoreInfo(storeId) {
        const data = await this.call('getStoreInfo', { storeId });
        return data.storeInfo || null;
    },

    /**
     * 取得統計資料 (管理員用)
     * @param {string} password - 管理員密碼
     * @param {string} startDate - 開始日期
     * @param {string} endDate - 結束日期
     * @returns {Promise<Object>} 統計資料
     */
    async getStats(password, startDate = null, endDate = null) {
        const payload = {};
        if (startDate) payload.startDate = startDate;
        if (endDate) payload.endDate = endDate;
        return await this.call('getStats', payload, password);
    }
};

// 如果在瀏覽器環境，掛載到 window
if (typeof window !== 'undefined') {
    window.API = API;
}

// 如果支援 ES 模組匯出
if (typeof module !== 'undefined' && module.exports) {
    module.exports = API;
}
