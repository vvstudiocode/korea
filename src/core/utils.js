/**
 * Utils 工具模組 - 共用工具函數
 * Rule #9 表示規則: 將知識折疊到資料中，程式邏輯可以簡單穩健
 * Rule #13 經濟規則: 程式員時間寶貴，優先節省
 */

const Utils = {
    /**
     * 格式化金額為新台幣格式
     * @param {number} amount - 金額
     * @returns {string} 格式化後的金額
     */
    formatCurrency(amount) {
        return `NT$ ${Number(amount).toLocaleString()}`;
    },

    /**
     * 格式化日期為本地格式
     * @param {string|Date} date - 日期
     * @param {Object} options - Intl.DateTimeFormat 選項
     * @returns {string} 格式化後的日期
     */
    formatDate(date, options = {}) {
        const d = date instanceof Date ? date : new Date(date);
        const defaultOptions = {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit'
        };
        return d.toLocaleString('zh-TW', { ...defaultOptions, ...options });
    },

    /**
     * 格式化日期為 YYYY-MM-DD 格式
     * @param {Date} date - 日期物件
     * @returns {string} 格式化的日期字串
     */
    formatDateToYMD(date) {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    },

    /**
     * 防抖函數
     * @param {Function} func - 要執行的函數
     * @param {number} wait - 等待時間（毫秒）
     * @returns {Function} 防抖後的函數
     */
    debounce(func, wait = 300) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func.apply(this, args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    },

    /**
     * 節流函數
     * @param {Function} func - 要執行的函數
     * @param {number} limit - 限制時間（毫秒）
     * @returns {Function} 節流後的函數
     */
    throttle(func, limit = 300) {
        let inThrottle;
        return function executedFunction(...args) {
            if (!inThrottle) {
                func.apply(this, args);
                inThrottle = true;
                setTimeout(() => inThrottle = false, limit);
            }
        };
    },

    /**
     * 深拷貝物件
     * @param {*} obj - 要拷貝的物件
     * @returns {*} 拷貝後的物件
     */
    deepClone(obj) {
        if (obj === null || typeof obj !== 'object') return obj;
        if (obj instanceof Date) return new Date(obj.getTime());
        if (obj instanceof Array) return obj.map(item => this.deepClone(item));
        if (typeof obj === 'object') {
            const clone = {};
            for (const key in obj) {
                if (Object.prototype.hasOwnProperty.call(obj, key)) {
                    clone[key] = this.deepClone(obj[key]);
                }
            }
            return clone;
        }
        return obj;
    },

    /**
     * 產生唯一 ID
     * @returns {string} 唯一 ID
     */
    generateId() {
        return Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
    },

    /**
     * 將選項物件轉換為唯一 ID
     * @param {string} productId - 商品 ID
     * @param {Object} options - 選項物件
     * @returns {string} 唯一 ID
     */
    getCartItemId(productId, options = {}) {
        if (!options || Object.keys(options).length === 0) {
            return productId;
        }
        const sortedKeys = Object.keys(options).sort();
        const optionStr = sortedKeys.map(k => `${k}:${options[k]}`).join('|');
        return `${productId}__${optionStr}`;
    },

    /**
     * 驗證電話號碼格式
     * @param {string} phone - 電話號碼
     * @returns {boolean} 是否有效
     */
    isValidPhone(phone) {
        return /^09\d{8}$/.test(phone);
    },

    /**
     * 驗證電子郵件格式
     * @param {string} email - 電子郵件
     * @returns {boolean} 是否有效
     */
    isValidEmail(email) {
        return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    },

    /**
     * 取得 URL 參數
     * @param {string} name - 參數名稱
     * @returns {string|null} 參數值
     */
    getUrlParam(name) {
        const urlParams = new URLSearchParams(window.location.search);
        return urlParams.get(name);
    },

    /**
     * 安全地解析 JSON
     * @param {string} jsonString - JSON 字串
     * @param {*} defaultValue - 預設值
     * @returns {*} 解析後的物件或預設值
     */
    safeParseJSON(jsonString, defaultValue = null) {
        try {
            return JSON.parse(jsonString);
        } catch (error) {
            console.warn('[Utils] JSON 解析失敗:', error);
            return defaultValue;
        }
    },

    /**
     * 等待指定時間
     * @param {number} ms - 毫秒數
     * @returns {Promise<void>}
     */
    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    },

    /**
     * 將字串轉換為安全的檔案名稱（小寫、連字號分隔）
     * @param {string} str - 原始字串
     * @returns {string} 安全的檔案名稱
     */
    toSafeFileName(str) {
        return str
            .toLowerCase()
            .trim()
            .replace(/\s+/g, '-')
            .replace(/[^a-z0-9-]/g, '')
            .replace(/-+/g, '-');
    },

    /**
     * 訂單狀態對應的顏色
     */
    STATUS_COLORS: {
        '待處理': '#ff9800',
        '處理中': '#2196F3',
        '已出貨': '#4CAF50',
        '已完成': '#8BC34A',
        '已取消': '#9E9E9E',
        '退貨中': '#f44336'
    },

    /**
     * 取得訂單狀態顏色
     * @param {string} status - 訂單狀態
     * @returns {string} 顏色代碼
     */
    getStatusColor(status) {
        return this.STATUS_COLORS[status] || '#757575';
    }
};

// 如果在瀏覽器環境，掛載到 window
if (typeof window !== 'undefined') {
    window.Utils = Utils;
}

// 如果支援 ES 模組匯出
if (typeof module !== 'undefined' && module.exports) {
    module.exports = Utils;
}
