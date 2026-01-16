/**
 * KolStore KOL 商店模組 - 處理 KOL 商店模式
 * Rule #17 擴展性: 為未來設計，因為它來得比你想的快
 * Rule #4 分離性: 將策略與機制分離
 */

const KolStore = {
    // 商店 ID
    storeId: null,
    // 商店資訊
    storeInfo: null,

    /**
     * 初始化 KOL 商店模式
     * @returns {Promise<boolean>} 是否為 KOL 商店模式
     */
    async init() {
        const storeId = Utils.getUrlParam('store');

        if (!storeId) {
            console.log('📌 官方直營模式');
            return false;
        }

        // KOL模式: 立即清空載入畫面文字
        const loadingTexts = document.querySelectorAll('.loading-text, .loading-screen h2, #loadingText');
        loadingTexts.forEach(el => {
            el.textContent = '';
        });

        this.storeId = storeId;
        window.currentStoreId = storeId;

        console.log(`🏪 KOL 商店模式: ${storeId}`);

        try {
            // 獲取商店基本資訊
            const result = await API.call('getStoreProducts', { storeId });

            if (result.success && result.data) {
                this.storeInfo = result.data.storeInfo || null;
                window.currentStoreInfo = this.storeInfo;

                if (this.storeInfo) {
                    console.log('✅ 商店資訊:', this.storeInfo);
                    this.applyTheme();
                } else {
                    console.warn('⚠️ result.data.storeInfo 為空');
                }
            } else {
                console.warn('⚠️ 無法載入商店資訊，使用預設樣式');
            }
        } catch (error) {
            console.error('❌ 載入商店資訊失敗:', error);
        }

        return true;
    },

    /**
     * 套用商店品牌主題
     */
    applyTheme() {
        if (!this.storeInfo) return;

        // 套用品牌主題色
        if (this.storeInfo.themeColor) {
            document.documentElement.style.setProperty('--primary-color', this.storeInfo.themeColor);
            document.documentElement.style.setProperty('--accent-color', this.storeInfo.themeColor);

            const header = document.querySelector('header');
            if (header) {
                header.style.borderBottomColor = this.storeInfo.themeColor;
            }
        }

        // 更新 Logo
        if (this.storeInfo.logoUrl) {
            const logo = document.querySelector('.logo img');
            if (logo) {
                logo.src = this.storeInfo.logoUrl;
                logo.alt = this.storeInfo.storeName || 'Store Logo';
            }
        }

        // 更新店名
        if (this.storeInfo.storeName) {
            const siteTitle = document.querySelector('.logo span, .site-title');
            if (siteTitle) {
                siteTitle.textContent = this.storeInfo.storeName;
            }
            document.title = `${this.storeInfo.storeName} | 韓國代購`;
        }

        console.log('✅ 已套用商店品牌樣式:', this.storeInfo.storeName);
    },

    /**
     * 取得商店 ID
     * @returns {string|null} 商店 ID
     */
    getStoreId() {
        return this.storeId;
    },

    /**
     * 取得商店資訊
     * @returns {Object|null} 商店資訊
     */
    getStoreInfo() {
        return this.storeInfo;
    },

    /**
     * 是否為 KOL 商店模式
     * @returns {boolean}
     */
    isKolMode() {
        return this.storeId !== null;
    }
};

// 掛載到 window
if (typeof window !== 'undefined') {
    window.KolStore = KolStore;
}
