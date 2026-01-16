/**
 * Admin API 模組 - 管理後台 API 呼叫封裝
 * Rule #1 模組化: 簡單部件透過清晰介面連接
 * Rule #12 修復規則: 失敗時要大聲且盡早失敗
 */

const AdminAPI = {
    BASE_URL: 'https://script.google.com/macros/s/AKfycby7V5VwHfn_Tb-wpg_SSrme2c2P5bin6qjhxEkr80RDLg6p5TPn2EXySkpG9qnyvfNF/exec',

    /**
     * 呼叫管理員 API
     * @param {string} subAction - 子動作
     * @param {Object} payload - 請求資料
     * @returns {Promise<Object>} API 回應
     */
    async call(subAction, payload = {}) {
        const password = AdminAuth ? AdminAuth.getPassword() : (payload.password || '');

        const response = await fetch(this.BASE_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'text/plain;charset=utf-8' },
            body: JSON.stringify({
                action: 'adminAction',
                subAction: subAction,
                password: password,
                ...payload
            })
        });

        return response.json();
    },

    /**
     * 取得儀表板資料
     * @param {string} startDate - 開始日期
     * @param {string} endDate - 結束日期
     * @returns {Promise<Object>}
     */
    async getDashboardData(startDate = null, endDate = null) {
        const payload = {};
        if (startDate) payload.startDate = startDate;
        if (endDate) payload.endDate = endDate;
        return this.call('getDashboardData', payload);
    },

    /**
     * 取得訂單列表
     * @returns {Promise<Array>}
     */
    async getOrders() {
        const data = await this.call('getOrders');
        return data.success ? data.data.orders : [];
    },

    /**
     * 批量更新訂單
     * @param {Object} updates - 更新資料
     * @returns {Promise<Object>}
     */
    async updateOrdersBatch(updates) {
        return this.call('updateOrdersBatch', { updates });
    },

    /**
     * 取得商品列表
     * @returns {Promise<Array>}
     */
    async getProducts() {
        const data = await this.call('getProductsAdmin', { _t: Date.now() });
        return data.success ? data.data.products : [];
    },

    /**
    * 批量更新商品
     * @param {Array} updates - 更新資料陣列
     * @returns {Promise<Object>}
     */
    async updateProductsBatch(updates) {
        return this.call('batchUpdateProducts', { products: updates });
    },

    /**
     * 取得賣場列表
     * @returns {Promise<Array>}
     */
    async getStores() {
        const data = await this.call('getStores');
        return data.success ? data.data.stores : [];
    },

    /**
     * 刪除訂單
     * @param {string} orderId - 訂單 ID
     * @returns {Promise<Object>}
     */
    async deleteOrder(orderId) {
        return this.call('deleteOrder', { orderId });
    },

    /**
     * 刪除商品
     * @param {string} productId - 商品 ID
     * @returns {Promise<Object>}
     */
    async deleteProduct(productId) {
        return this.call('deleteProduct', { productId });
    },

    /**
     * 新增/更新商品
     * @param {Object} product - 商品資料
     * @returns {Promise<Object>}
     */
    async saveProduct(product) {
        return this.call('saveProduct', { product });
    },

    /**
     * 取得採買統計
     * @param {string} startDate - 開始日期
     * @param {string} endDate - 結束日期
     * @returns {Promise<Object>}
     */
    async getPurchasingStats(startDate, endDate) {
        return this.call('getPurchasingStats', { startDate, endDate });
    },

    /**
     * 取得 KOL 業績統計
     * @param {string} month - 月份 (YYYY-MM)
     * @returns {Promise<Object>}
     */
    async getKolStats(month) {
        return this.call('getKolStats', { month });
    }
};

// 掛載到 window
if (typeof window !== 'undefined') {
    window.AdminAPI = AdminAPI;
}
