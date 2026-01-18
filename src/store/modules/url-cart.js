/**
 * UrlCart URL 購物車模組 - 處理從 LINE Bot 傳入的 URL 參數
 * 自動解析 URL 中的商品資訊並加入購物車
 */

const UrlCart = {
    /**
     * 處理 URL 參數，將商品加入購物車
     * 支援的參數格式：
     * - ?product=商品ID&qty=數量
     * - ?product=商品ID&qty=數量&spec=規格（以/分隔）
     * @returns {boolean} 是否有處理購物車參數
     */
    processUrl() {
        const productId = Utils.getUrlParam('product');
        const qty = parseInt(Utils.getUrlParam('qty')) || 1;
        const spec = Utils.getUrlParam('spec');

        if (!productId) {
            console.log('📌 UrlCart: 無購物車參數');
            return false;
        }

        console.log(`🛒 UrlCart: 處理購物車參數 - 商品: ${productId}, 數量: ${qty}, 規格: ${spec || '無'}`);

        // 等待商品資料載入後處理
        this.waitForProduct(productId, qty, spec);
        return true;
    },

    /**
     * 等待商品資料載入後加入購物車
     * @param {string} productId - 商品 ID
     * @param {number} qty - 數量
     * @param {string} spec - 規格字串（可選）
     */
    waitForProduct(productId, qty, spec) {
        const maxRetries = 20;
        let retries = 0;

        const checkProduct = () => {
            const product = Products.getById(productId);

            if (product) {
                console.log('✅ UrlCart: 找到商品', product.name);
                this.addToCart(product, qty, spec);
                return;
            }

            retries++;
            if (retries < maxRetries) {
                console.log(`⏳ UrlCart: 等待商品載入... (${retries}/${maxRetries})`);
                setTimeout(checkProduct, 300);
            } else {
                console.error('❌ UrlCart: 商品載入超時', productId);
                Toast.error(`找不到商品：${productId}`);
            }
        };

        checkProduct();
    },

    /**
     * 將商品加入購物車
     * @param {Object} product - 商品物件
     * @param {number} qty - 數量
     * @param {string} spec - 規格字串（可選，格式如 "紅色/L"）
     */
    addToCart(product, qty, spec) {
        // 檢查是否有規格要求
        const hasOptions = product.options && Object.keys(product.options).length > 0;

        if (hasOptions && !spec) {
            // 有規格但沒選擇，開啟商品詳情讓用戶選擇
            console.log('⚠️ UrlCart: 商品需要選擇規格');
            Toast.info('請選擇商品規格');
            ProductDetail.show(product.id);
            return;
        }

        // 解析規格選項
        let selectedOptions = {};
        if (spec && hasOptions) {
            const specValues = spec.split('/');
            const optionKeys = Object.keys(product.options);

            optionKeys.forEach((key, index) => {
                if (specValues[index]) {
                    selectedOptions[key] = specValues[index];
                }
            });

            // 驗證規格是否有效
            const specString = Object.values(selectedOptions).join('/');
            if (product.variants && product.variants.length > 0) {
                const variant = product.variants.find(v => v.spec === specString);
                if (!variant) {
                    console.warn('⚠️ UrlCart: 找不到對應規格', specString);
                    Toast.warning('選擇的規格無效，請重新選擇');
                    ProductDetail.show(product.id);
                    return;
                }
                if (variant.stock <= 0) {
                    Toast.warning('此規格已售完');
                    ProductDetail.show(product.id);
                    return;
                }
            }
        }

        // 檢查庫存
        if (!hasOptions && typeof product.stock !== 'undefined' && product.stock <= 0) {
            Toast.warning('此商品已售完');
            return;
        }

        // 加入購物車
        Cart.add(product, qty, selectedOptions);

        // 開啟購物車側邊欄
        setTimeout(() => {
            Cart.toggle();
        }, 500);

        // 清除 URL 參數（避免重複加入）
        this.clearUrlParams();
    },

    /**
     * 清除 URL 中的購物車參數
     */
    clearUrlParams() {
        const url = new URL(window.location.href);
        url.searchParams.delete('product');
        url.searchParams.delete('qty');
        url.searchParams.delete('spec');

        // 保留 hash
        const hash = window.location.hash;
        const newUrl = url.pathname + url.search + hash;

        window.history.replaceState({}, '', newUrl);
        console.log('🧹 UrlCart: 已清除 URL 參數');
    }
};

// 掛載到 window
if (typeof window !== 'undefined') {
    window.UrlCart = UrlCart;
}
