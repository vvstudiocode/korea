/**
 * Admin Utils 工具模組 - 管理後台共用工具函數
 * Rule #9 表示規則: 將知識折疊到資料中，程式邏輯可以簡單穩健
 * Rule #13 經濟規則: 程式員時間寶貴，優先節省
 */

const AdminUtils = {
    /**
     * 格式化金額
     * @param {number} num - 金額
     * @returns {string} 格式化後的金額
     */
    formatCurrency(num) {
        if (num === null || num === undefined || isNaN(num)) return 'NT$ 0';
        return 'NT$ ' + Number(num).toLocaleString('zh-TW');
    },

    /**
     * 格式化日期為 YYYY-MM-DD
     * @param {Date} date - 日期
     * @returns {string}
     */
    formatDate(date) {
        if (!date) return '';
        const d = date instanceof Date ? date : new Date(date);
        return d.getFullYear() + '-' +
            String(d.getMonth() + 1).padStart(2, '0') + '-' +
            String(d.getDate()).padStart(2, '0');
    },

    /**
     * 計算總庫存 (包含 variants)
     * @param {Object} product - 商品物件
     * @returns {number} 總庫存
     */
    calculateTotalStock(product) {
        if (product.variants && product.variants.length > 0) {
            return product.variants.reduce((sum, v) => sum + (parseInt(v.stock) || 0), 0);
        }
        return product.stock || 0;
    }
};

/**
 * Admin Toast 通知模組
 */
const AdminToast = {
    /**
     * 顯示 Toast 通知
     * @param {string} message - 訊息
     * @param {string} type - 類型 (success, error, warning, info)
     * @param {number} duration - 顯示時間 (毫秒)
     */
    show(message, type = 'info', duration = 3000) {
        const container = document.getElementById('toastContainer');
        if (!container) return;

        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        toast.style.cssText = `
            padding: 12px 20px;
            margin-bottom: 10px;
            border-radius: 8px;
            color: white;
            font-weight: 500;
            box-shadow: 0 4px 12px rgba(0,0,0,0.15);
            animation: slideIn 0.3s ease;
            cursor: pointer;
            max-width: 350px;
        `;

        const colors = {
            success: '#28a745',
            error: '#dc3545',
            warning: '#ffc107',
            info: '#17a2b8'
        };
        toast.style.backgroundColor = colors[type] || colors.info;
        if (type === 'warning') toast.style.color = '#333';

        toast.textContent = message;
        toast.onclick = () => toast.remove();

        container.appendChild(toast);

        setTimeout(() => {
            toast.style.animation = 'slideOut 0.3s ease';
            setTimeout(() => toast.remove(), 300);
        }, duration);
    },

    success(msg, duration) { this.show(msg, 'success', duration); },
    error(msg, duration) { this.show(msg, 'error', duration); },
    warning(msg, duration) { this.show(msg, 'warning', duration); },
    info(msg, duration) { this.show(msg, 'info', duration); }
};

/**
 * Admin Loading 載入動畫模組
 */
const AdminLoading = {
    /**
     * 顯示載入動畫
     */
    show() {
        let overlay = document.getElementById('loadingOverlay');
        if (!overlay) {
            overlay = document.createElement('div');
            overlay.id = 'loadingOverlay';
            overlay.style.cssText = `
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background: rgba(255, 255, 255, 0.8);
                z-index: 9999;
                display: flex;
                justify-content: center;
                align-items: center;
                flex-direction: column;
            `;
            overlay.innerHTML = `
                <div style="
                    width: 40px; 
                    height: 40px; 
                    border: 4px solid #f3f3f3; 
                    border-top: 4px solid #3498db; 
                    border-radius: 50%; 
                    animation: adminSpin 1s linear infinite;">
                </div>
                <style>
                    @keyframes adminSpin {
                        0% { transform: rotate(0deg); }
                        100% { transform: rotate(360deg); }
                    }
                </style>
            `;
            document.body.appendChild(overlay);
        }
        overlay.style.display = 'flex';
    },

    /**
     * 隱藏載入動畫
     */
    hide() {
        const overlay = document.getElementById('loadingOverlay');
        if (overlay) {
            overlay.style.display = 'none';
        }
    }
};

/**
 * Admin Modal 模態框模組
 */
const AdminModal = {
    /**
     * 開啟模態框
     * @param {string} id - 模態框 ID
     */
    open(id) {
        const modal = document.getElementById(id);
        if (modal) {
            modal.style.display = 'flex';
        }
    },

    /**
     * 關閉模態框
     * @param {string} id - 模態框 ID
     */
    close(id) {
        const modal = document.getElementById(id);
        if (modal) {
            modal.style.display = 'none';
        }
    }
};

// 掛載到 window
if (typeof window !== 'undefined') {
    window.AdminUtils = AdminUtils;
    window.AdminToast = AdminToast;
    window.AdminLoading = AdminLoading;
    window.AdminModal = AdminModal;
    // 相容舊版
    window.formatCurrency = (n) => AdminUtils.formatCurrency(n);
    window.showToast = (m, t, d) => AdminToast.show(m, t, d);
    window.showLoadingOverlay = () => AdminLoading.show();
    window.hideLoadingOverlay = () => AdminLoading.hide();
    window.openModal = (id) => AdminModal.open(id);
    window.closeModal = (id) => AdminModal.close(id);
}
