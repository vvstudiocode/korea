/**
 * 韓國代購網站 - 主入口 (模組化版本)
 * Rule #1 模組化: 簡單部件透過清晰介面連接
 * Rule #3 組合性: 設計可以與其他程式連接的程式
 * 
 * 載入順序：
 * 1. src/core/*.js (API, Storage, Toast, Utils)
 * 2. src/store/modules/*.js (Products, Cart, Checkout, Modal, ProductDetail, KolStore)
 * 3. src/store/app.js (本檔案)
 * 4. src/page-renderer/page-renderer.js (選用)
 */

const App = {
    version: '3.0.0 (Modular)',

    /**
     * 初始化應用程式
     */
    async init() {
        console.log(`App Version: ${this.version}`);

        // 進入頁面時捲動至頂部
        if ('scrollRestoration' in history) {
            history.scrollRestoration = 'manual';
        }
        window.scrollTo(0, 0);

        // 1. 初始化 KOL 商店模式
        await KolStore.init();

        // 2. 處理快取排版
        const cachedLayout = localStorage.getItem('omo_cached_layout');
        if (cachedLayout) {
            const defaultSection = document.querySelector('.products-section');
            if (defaultSection) defaultSection.style.display = 'none';
        }

        // 3. 載入商品
        await Products.load(KolStore.getStoreId());

        // 4. 初始化購物車
        Cart.init();

        // 4.5 處理 URL 購物車參數（從 LINE Bot 傳入）
        if (typeof UrlCart !== 'undefined') {
            UrlCart.processUrl();
        }

        // 5. 設定事件監聽器
        this.setupEventListeners();

        // 6. 初始化頁面渲染器
        if (typeof PageRenderer !== 'undefined') {
            PageRenderer.init(KolStore.getStoreId());
        }

        console.log('✅ 應用程式初始化完成');
    },

    /**
     * 設定事件監聽器
     */
    setupEventListeners() {
        // 購物車按鈕
        const cartBtn = document.getElementById('cartBtn');
        const closeCart = document.getElementById('closeCart');
        if (cartBtn) cartBtn.addEventListener('click', () => Cart.toggle());
        if (closeCart) closeCart.addEventListener('click', () => Cart.toggle());

        // 結帳按鈕
        const checkoutBtn = document.getElementById('checkoutBtn');
        if (checkoutBtn) checkoutBtn.addEventListener('click', () => Checkout.show());

        // 訂單表單
        const orderForm = document.getElementById('orderForm');
        if (orderForm) orderForm.addEventListener('submit', (e) => Checkout.handleSubmit(e));

        // 遮罩層點擊關閉
        Modal.setupOverlayClick();

        // 圖片輪播滑動監聯
        document.addEventListener('scroll', this.handleSliderScroll, true);
    },

    /**
     * 處理圖片輪播滑動，更新指示點
     * @param {Event} e - 滾動事件
     */
    handleSliderScroll(e) {
        const slider = e.target;
        if (!slider.classList || !slider.classList.contains('image-slider')) return;

        const container = slider.closest('.image-slider-container');
        if (!container) return;

        const dots = container.querySelectorAll('.slider-dot');
        if (dots.length === 0) return;

        const scrollLeft = slider.scrollLeft;
        const imageWidth = slider.offsetWidth;
        const currentIndex = Math.round(scrollLeft / imageWidth);

        dots.forEach((dot, index) => {
            dot.classList.toggle('active', index === currentIndex);
        });
    },

    /**
     * 顯示通知
     * @param {string} message - 訊息內容
     */
    showNotification(message) {
        Toast.success(message);
    }
};

// 初始化應用程式
document.addEventListener('DOMContentLoaded', () => {
    App.init();
});

// 掛載到 window
if (typeof window !== 'undefined') {
    window.App = App;
    // 相容舊版函數
    window.showNotification = (msg) => App.showNotification(msg);

    // 訂單查詢模態框
    window.openSearchModal = function () {
        Modal.show('searchOrderModal');
    };

    // 關閉搜尋視窗
    window.closeSearchModal = function () {
        Modal.close('searchOrderModal');
    };

    // 直接加入購物車（無規格商品）
    window.addToCartById = function (productId) {
        Cart.addById(productId);
    };

    // 處理訂單查詢 Enter 鍵
    window.handleSearchKeyPress = function (event) {
        if (event.key === 'Enter') {
            window.handleOrderSearch();
        }
    };
}
