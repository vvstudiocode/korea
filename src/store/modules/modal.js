/**
 * Modal 模態框模組 - 統一管理彈窗顯示
 * Rule #10 最小驚訝: 介面設計應做最不令人驚訝的事
 * Rule #3 組合性: 設計可以與其他程式連接的程式
 */

const Modal = {
    /**
     * 顯示模態框
     * @param {string} modalId - 模態框元素 ID
     */
    show(modalId) {
        const modal = document.getElementById(modalId);
        const overlay = document.getElementById('overlay');

        if (modal) {
            modal.classList.add('active');
            if (overlay) {
                overlay.classList.add('active');
            }
            document.body.style.overflow = 'hidden';
        }
    },

    /**
     * 關閉模態框
     * @param {string} modalId - 模態框元素 ID
     */
    close(modalId) {
        const modal = document.getElementById(modalId);
        const overlay = document.getElementById('overlay');

        if (modal) {
            modal.classList.remove('active');
        }

        // 檢查是否還有其他開啟的模態框
        const openModals = document.querySelectorAll('.modal.active');
        const openCart = document.querySelector('#cartSidebar.open');

        if (openModals.length === 0 && !openCart) {
            if (overlay) {
                overlay.classList.remove('active');
            }
            document.body.style.overflow = '';
        }
    },

    /**
     * 關閉所有模態框
     */
    closeAll() {
        document.querySelectorAll('.modal.active').forEach(modal => {
            modal.classList.remove('active');
        });

        const cartSidebar = document.getElementById('cartSidebar');
        if (cartSidebar) {
            cartSidebar.classList.remove('open');
        }

        const overlay = document.getElementById('overlay');
        if (overlay) {
            overlay.classList.remove('active');
        }

        document.body.style.overflow = '';
    },

    /**
     * 設定點擊遮罩關閉功能
     */
    setupOverlayClick() {
        const overlay = document.getElementById('overlay');
        if (overlay) {
            overlay.addEventListener('click', () => this.closeAll());
        }
    }
};

// 掛載到 window
if (typeof window !== 'undefined') {
    window.Modal = Modal;
    // 相容舊版函數名稱
    window.showModal = (id) => Modal.show(id);
    window.closeModal = (id) => Modal.close(id);
    window.closeAllModals = () => Modal.closeAll();
}
