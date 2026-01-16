/**
 * Admin Auth 認證模組 - 處理管理員登入/登出
 * Rule #12 修復規則: 失敗時要大聲且盡早失敗
 * Rule #4 分離性: 將策略與機制分離
 */

const AdminAuth = {
    // 目前密碼
    password: '',

    /**
     * 初始化（檢查已儲存的登入狀態）
     */
    init() {
        const savedPassword = sessionStorage.getItem('adminPassword');
        if (savedPassword) {
            this.password = savedPassword;
            return true;
        }
        return false;
    },

    /**
     * 登入
     * @param {string} password - 管理員密碼
     * @returns {Promise<boolean>} 登入是否成功
     */
    async login(password) {
        try {
            const data = await AdminAPI.call('login', { password });

            if (data.success) {
                this.password = password;
                sessionStorage.setItem('adminPassword', password);
                return true;
            } else {
                return false;
            }
        } catch (error) {
            console.error('登入失敗:', error);
            throw error;
        }
    },

    /**
     * 登出
     */
    logout() {
        sessionStorage.removeItem('adminPassword');
        this.password = '';
    },

    /**
     * 取得目前密碼
     * @returns {string} 密碼
     */
    getPassword() {
        return this.password;
    },

    /**
     * 是否已登入
     * @returns {boolean}
     */
    isLoggedIn() {
        return this.password !== '';
    }
};

// 掛載到 window
if (typeof window !== 'undefined') {
    window.AdminAuth = AdminAuth;
}
