/**
 * Toast 通知模組 - 統一的訊息通知系統
 * Rule #11 沉默規則: 程式無話可說時不應說話
 * Rule #10 最小驚訝: 介面設計應做最不令人驚訝的事
 */

const Toast = {
    // Toast 類型及其對應的顏色
    TYPES: {
        success: { icon: '✓', bg: '#4CAF50' },
        error: { icon: '✕', bg: '#f44336' },
        warning: { icon: '⚠', bg: '#ff9800' },
        info: { icon: 'ℹ', bg: '#2196F3' }
    },

    // Toast 容器元素
    container: null,

    /**
     * 初始化 Toast 容器
     */
    init() {
        if (this.container) return;

        this.container = document.createElement('div');
        this.container.id = 'toast-container';
        this.container.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            z-index: 10000;
            display: flex;
            flex-direction: column;
            gap: 10px;
            pointer-events: none;
        `;
        document.body.appendChild(this.container);
    },

    /**
     * 顯示 Toast 訊息
     * @param {string} message - 訊息內容
     * @param {string} type - 類型 (success, error, warning, info)
     * @param {number} duration - 顯示時間（毫秒）
     */
    show(message, type = 'info', duration = 3000) {
        this.init();

        const typeConfig = this.TYPES[type] || this.TYPES.info;

        const toast = document.createElement('div');
        toast.style.cssText = `
            background: ${typeConfig.bg};
            color: white;
            padding: 12px 20px 12px 16px;
            border-radius: 8px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.15);
            display: flex;
            align-items: center;
            gap: 10px;
            min-width: 250px;
            max-width: 400px;
            pointer-events: auto;
            cursor: pointer;
            animation: toastSlideIn 0.3s ease-out;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            font-size: 14px;
        `;

        toast.innerHTML = `
            <span style="font-size: 18px;">${typeConfig.icon}</span>
            <span style="flex: 1;">${message}</span>
        `;

        // 點擊關閉
        toast.onclick = () => this.dismiss(toast);

        this.container.appendChild(toast);

        // 確保動畫樣式存在
        this.ensureStyles();

        // 自動關閉
        setTimeout(() => this.dismiss(toast), duration);
    },

    /**
     * 關閉 Toast
     * @param {HTMLElement} toast - Toast 元素
     */
    dismiss(toast) {
        if (!toast || !toast.parentNode) return;

        toast.style.animation = 'toastSlideOut 0.3s ease-in forwards';
        setTimeout(() => {
            if (toast.parentNode) {
                toast.parentNode.removeChild(toast);
            }
        }, 300);
    },

    /**
     * 確保必要的 CSS 動畫樣式存在
     */
    ensureStyles() {
        if (document.getElementById('toast-styles')) return;

        const style = document.createElement('style');
        style.id = 'toast-styles';
        style.textContent = `
            @keyframes toastSlideIn {
                from {
                    transform: translateX(100%);
                    opacity: 0;
                }
                to {
                    transform: translateX(0);
                    opacity: 1;
                }
            }
            @keyframes toastSlideOut {
                from {
                    transform: translateX(0);
                    opacity: 1;
                }
                to {
                    transform: translateX(100%);
                    opacity: 0;
                }
            }
        `;
        document.head.appendChild(style);
    },

    // 便捷方法
    success(message, duration) { this.show(message, 'success', duration); },
    error(message, duration) { this.show(message, 'error', duration); },
    warning(message, duration) { this.show(message, 'warning', duration); },
    info(message, duration) { this.show(message, 'info', duration); }
};

// 如果在瀏覽器環境，掛載到 window
if (typeof window !== 'undefined') {
    window.Toast = Toast;
}

// 如果支援 ES 模組匯出
if (typeof module !== 'undefined' && module.exports) {
    module.exports = Toast;
}
