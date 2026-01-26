/**
 * ProductDetail 商品詳情模組 - 處理商品詳情彈窗
 * Rule #6 簡約規則: 大程式只有在證明其他方法不行時才寫
 * Rule #7 透明性: 設計可見性，讓檢查和除錯更容易
 */

const ProductDetail = {
    // 目前顯示的商品
    currentProduct: null,

    /**
     * 顯示商品詳情
     * @param {string} productId - 商品 ID
     */
    show(productId) {
        const product = Products.getById(productId);

        if (!product) {
            console.error('❌ ProductDetail.show: 找不到商品', productId);
            return;
        }

        this.currentProduct = product;

        // 處理圖片
        const images = (product.image || '').split(',').map(url => url.trim());
        let imageHtml = images.length > 1 ? `
            <div class="image-slider-container">
                <div class="image-slider">${images.map(img => `<img src="${img}" class="slider-image">`).join('')}</div>
                <div class="slider-dots">${images.map((_, i) => `<div class="slider-dot ${i === 0 ? 'active' : ''}"></div>`).join('')}</div>
            </div>` : `
            <div class="image-slider-container"><img src="${images.length > 0 ? images[0] : 'https://via.placeholder.com/300'}" class="slider-image"></div>`;

        // 更新 UI
        document.querySelector('.product-detail-image').innerHTML = imageHtml;
        document.getElementById('modalProductName').textContent = product.name;
        document.getElementById('modalProductPrice').textContent = `NT$ ${product.price}`;
        document.getElementById('modalProductDescription').textContent = product.description || '暫無描述';
        document.getElementById('modalQuantity').value = 1;

        // 處理規格選項
        this.renderOptions(product);

        // 處理售完狀態
        this.updateSoldOutStatus(product);

        Modal.show('productModal');
    },

    /**
     * 渲染規格選項
     * @param {Object} product - 商品物件
     */
    renderOptions(product) {
        const optionsContainer = document.getElementById('modalProductOptions');
        optionsContainer.innerHTML = '';

        const hasOptions = product.options && Object.keys(product.options).length > 0;
        const variants = product.variants || [];

        if (!hasOptions) return;

        Object.entries(product.options).forEach(([key, values]) => {
            const optionEl = document.createElement('div');
            optionEl.className = 'product-option';

            const optionButtons = values.map(value => {
                // 找出對應的 variant（支援單規格和多規格）
                const variant = variants.find(v => {
                    const specParts = v.spec.split('/');
                    return specParts.includes(value);
                });

                const variantStock = variant ? variant.stock : null;
                const isSoldOut = variantStock !== null && variantStock <= 0;

                if (isSoldOut) {
                    return `<button type="button" class="option-btn sold-out" data-key="${key}" data-value="${value}" disabled>
                        ${value} <span class="sold-out-label">售完</span>
                    </button>`;
                } else {
                    return `<button type="button" class="option-btn" data-key="${key}" data-value="${value}" onclick="ProductDetail.selectOption(this, '${key}', '${value}')">
                        ${value}
                    </button>`;
                }
            }).join('');

            optionEl.innerHTML = `
                <label>${key}:</label>
                <div class="option-buttons" data-option-key="${key}">
                    ${optionButtons}
                </div>
            `;
            optionsContainer.appendChild(optionEl);
        });

        // 自動選擇第一個有庫存的選項
        document.querySelectorAll('.option-buttons').forEach(group => {
            const firstAvailable = group.querySelector('.option-btn:not(.sold-out)');
            if (firstAvailable) {
                firstAvailable.classList.add('selected');
            }
        });

        // 更新價格顯示（根據選擇的規格）
        this.updateVariantInfo();
    },

    /**
     * 選擇規格選項
     * @param {HTMLElement} btn - 按鈕元素
     * @param {string} key - 規格鍵
     * @param {string} value - 規格值
     */
    selectOption(btn, key, value) {
        const group = btn.closest('.option-buttons');
        group.querySelectorAll('.option-btn').forEach(b => b.classList.remove('selected'));
        btn.classList.add('selected');

        this.updateVariantInfo();
    },

    /**
     * 根據選擇的規格更新價格和圖片
     */
    updateVariantInfo() {
        const product = this.currentProduct;
        if (!product || !product.variants || product.variants.length === 0) return;

        // 獲取所有已選擇的規格值
        const selectedValues = [];
        document.querySelectorAll('.option-buttons').forEach(group => {
            const selected = group.querySelector('.option-btn.selected');
            if (selected) {
                selectedValues.push(selected.dataset.value);
            }
        });

        if (selectedValues.length === 0) return;

        // 組合規格字串
        const specString = selectedValues.join('/');

        // 找到對應的 variant
        const variant = product.variants.find(v => v.spec === specString);
        if (variant) {
            // 更新價格
            document.getElementById('modalProductPrice').textContent = `NT$ ${variant.price}`;

            // 更新圖片（如果有設定）
            if (variant.image) {
                const imageContainer = document.querySelector('.product-detail-image');
                const slider = imageContainer.querySelector('.image-slider');
                if (slider) {
                    const images = product.image.split(',').map(url => url.trim());
                    const imgIndex = images.findIndex(url => url === variant.image);
                    if (imgIndex >= 0) {
                        const imageWidth = slider.offsetWidth;
                        slider.scrollTo({ left: imgIndex * imageWidth, behavior: 'smooth' });
                    }
                }
            }

            // 檢查選中規格的庫存
            this.updateAddToCartButton(variant.stock <= 0);
        }
    },

    /**
     * 更新售完狀態
     * @param {Object} product - 商品物件
     */
    updateSoldOutStatus(product) {
        const hasOptions = product.options && Object.keys(product.options).length > 0;
        const variants = product.variants || [];

        let isAllSoldOut = false;
        if (hasOptions && variants.length > 0) {
            isAllSoldOut = variants.every(v => v.stock <= 0);
        } else {
            // 嚴格檢查：如果 stock 未定義，視為 999 (有貨)，但如果明確 <= 0 則為售完
            const stock = (product.stock !== undefined && product.stock !== '') ? Number(product.stock) : 999;
            isAllSoldOut = stock <= 0;
        }

        this.updateAddToCartButton(isAllSoldOut);
    },

    /**
     * 更新加入購物車按鈕狀態
     * @param {boolean} isSoldOut - 是否售完
     */
    updateAddToCartButton(isSoldOut) {
        const addToCartBtn = document.querySelector('.add-to-cart-btn');
        const quantityInput = document.getElementById('modalQuantity');
        const qtyBtns = document.querySelectorAll('.qty-btn');

        if (!addToCartBtn) return;

        if (isSoldOut) {
            addToCartBtn.disabled = true;
            addToCartBtn.textContent = '已售完';
            addToCartBtn.style.backgroundColor = '#ccc';
            addToCartBtn.style.cursor = 'not-allowed';

            // 禁用數量選擇
            if (quantityInput) quantityInput.disabled = true;
            qtyBtns.forEach(btn => btn.disabled = true);
        } else {
            addToCartBtn.disabled = false;
            addToCartBtn.textContent = '加入購物車';
            addToCartBtn.style.backgroundColor = '';
            addToCartBtn.style.cursor = '';

            // 啟用數量選擇
            if (quantityInput) quantityInput.disabled = false;
            qtyBtns.forEach(btn => btn.disabled = false);
        }
    },

    /**
     * 增加數量
     */
    increaseQuantity() {
        const input = document.getElementById('modalQuantity');
        if (input.disabled) return;
        input.value = parseInt(input.value) + 1;
    },

    /**
     * 減少數量
     */
    decreaseQuantity() {
        const input = document.getElementById('modalQuantity');
        if (input.disabled) return;
        if (parseInt(input.value) > 1) {
            input.value = parseInt(input.value) - 1;
        }
    },

    /**
     * 從模態框加入購物車
     */
    addToCart() {
        const quantity = parseInt(document.getElementById('modalQuantity').value);

        // 獲取選擇的選項
        const selectedOptions = {};
        document.querySelectorAll('#modalProductOptions .option-buttons').forEach(group => {
            const key = group.dataset.optionKey;
            const selected = group.querySelector('.option-btn.selected');
            if (selected) {
                selectedOptions[key] = selected.dataset.value;
            }
        });

        // 二次檢查庫存狀態 (防止 UI 狀態不同步)
        const product = this.currentProduct;
        const hasOptions = product.options && Object.keys(product.options).length > 0;

        if (hasOptions) {
            const specString = Object.values(selectedOptions).join('/');
            const variant = product.variants ? product.variants.find(v => v.spec === specString) : null;
            if (variant && variant.stock <= 0) {
                alert('此規格已售完');
                // 強制更新狀態
                this.updateAddToCartButton(true);
                return;
            }
        } else {
            const stock = (product.stock !== undefined && product.stock !== '') ? Number(product.stock) : 999;
            if (stock <= 0) {
                alert('此商品已售完');
                // 強制更新狀態
                this.updateAddToCartButton(true);
                return;
            }
        }

        Cart.add(this.currentProduct, quantity, selectedOptions);
        this.close();
    },

    /**
     * 關閉商品詳情
     */
    close() {
        Modal.close('productModal');
    }
};

// 掛載到 window
if (typeof window !== 'undefined') {
    window.ProductDetail = ProductDetail;
    // 相容舊版函數名稱
    window.showProductDetail = (id) => ProductDetail.show(id);
    window.closeProductModal = () => ProductDetail.close();
    window.selectOption = (btn, key, value) => ProductDetail.selectOption(btn, key, value);
    window.increaseQuantity = () => ProductDetail.increaseQuantity();
    window.decreaseQuantity = () => ProductDetail.decreaseQuantity();
    window.addToCartFromModal = () => ProductDetail.addToCart();
}
