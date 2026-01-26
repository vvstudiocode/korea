/**
 * Cart 購物車模組 - 購物車管理功能
 * Rule #4 分離性: 將策略與機制分離
 * Rule #8 穩健性: 穩健性來自透明與簡單
 */

const Cart = {
    // 購物車項目
    items: [],

    /**
     * 初始化購物車（從 LocalStorage 載入）
     */
    init() {
        this.items = AppStorage.getCart();
        this.updateUI();

        // 監聽跨分頁購物車更新
        window.addEventListener('storage', (e) => {
            if (e.key === AppStorage.CART_KEY) {
                console.log('[Cart] 同步更新購物車');
                this.items = AppStorage.getCart();
                this.updateUI();
            }
        });
    },

    /**
     * 產生購物車內唯一 ID
     * @param {string} productId - 商品 ID
     * @param {Object} options - 選項物件
     * @returns {string} 唯一 ID
     */
    getItemId(productId, options = {}) {
        if (!options || Object.keys(options).length === 0) {
            return productId;
        }
        const sortedOptions = Object.keys(options).sort().reduce((obj, key) => {
            obj[key] = options[key];
            return obj;
        }, {});
        return productId + '-' + JSON.stringify(sortedOptions);
    },

    /**
     * 透過 ID 直接加入購物車（無規格商品用）
     * @param {string} productId - 商品 ID
     */
    addById(productId) {
        const product = Products.getById(productId);
        if (!product) {
            console.error('❌ Cart.addById: 找不到商品', productId);
            ProductDetail.show(productId); // 嘗試開啟詳情
            return;
        }

        if (typeof product.stock !== 'undefined' && Number(product.stock) <= 0) {
            Toast.warning('此商品已售完');
            return;
        }

        this.add(product, 1, {});
    },

    /**
     * 加入購物車
     * @param {Object} product - 商品物件
     * @param {number} quantity - 數量
     * @param {Object} selectedOptions - 選擇的規格
     */
    add(product, quantity, selectedOptions = {}) {
        if (!product || !product.id) {
            console.error('❌ 嘗試加入無效商品:', product);
            return;
        }

        // 確保價格是數字
        let safePrice = product.price;
        if (typeof safePrice === 'string') {
            safePrice = Number(safePrice.replace(/,/g, ''));
        }
        product.price = safePrice;

        const cartItemId = this.getItemId(product.id, selectedOptions);
        const existingItem = this.items.find(item => item.cartItemId === cartItemId);

        // 確定價格：如果有規格，尋找對應規格的價格
        let finalPrice = product.price;
        if (selectedOptions && Object.keys(selectedOptions).length > 0 && product.variants && product.variants.length > 0) {
            const specString = Object.values(selectedOptions).join('/');
            const variant = product.variants.find(v => v.spec === specString);
            if (variant && variant.price) {
                finalPrice = variant.price;
            }
        }

        if (existingItem) {
            existingItem.quantity += quantity;
            existingItem.price = finalPrice;
        } else {
            const images = String(product.image || '').split(',').map(url => url.trim());
            const mainImage = images.length > 0 && images[0] !== '' ? images[0] : 'https://via.placeholder.com/300';
            const specText = Object.values(selectedOptions).join(' / ');

            this.items.push({
                cartItemId: cartItemId,
                id: product.id,
                name: product.name,
                spec: specText,
                price: finalPrice,
                image: mainImage,
                quantity: quantity,
                selectedOptions: selectedOptions
            });
        }

        this.save();
        this.updateUI();
        Toast.success('已加入購物車！');
    },

    /**
     * 更新購物車項目數量
     * @param {number} index - 項目索引
     * @param {number} change - 變化量（+1 或 -1）
     */
    updateQuantity(index, change) {
        if (this.items[index]) {
            this.items[index].quantity += change;
            if (this.items[index].quantity <= 0) {
                this.items.splice(index, 1);
            }
            this.save();
            this.updateUI();
        }
    },

    /**
     * 移除購物車項目
     * @param {number} index - 項目索引
     */
    remove(index) {
        this.items.splice(index, 1);
        this.save();
        this.updateUI();
    },

    /**
     * 清空購物車
     */
    clear() {
        this.items = [];
        this.save();
        this.updateUI();
    },

    /**
     * 儲存購物車到 LocalStorage
     */
    save() {
        AppStorage.saveCart(this.items);
    },

    /**
     * 取得購物車總數量
     * @returns {number} 總數量
     */
    getTotalCount() {
        return this.items.reduce((sum, item) => sum + item.quantity, 0);
    },

    /**
     * 取得購物車小計
     * @returns {number} 小計金額
     */
    getSubtotal() {
        return this.items.reduce((sum, item) => sum + (Number(item.price) * Number(item.quantity)), 0);
    },

    /**
     * 切換購物車顯示
     */
    toggle() {
        const cartSidebar = document.getElementById('cartSidebar');
        const overlay = document.getElementById('overlay');
        const isOpen = cartSidebar.classList.contains('open');

        if (isOpen) {
            cartSidebar.classList.remove('open');
            overlay.classList.remove('active');
            document.body.style.overflow = '';
        } else {
            cartSidebar.classList.add('open');
            overlay.classList.add('active');
            document.body.style.overflow = 'hidden';
        }
    },

    /**
     * 更新購物車 UI
     */
    updateUI() {
        const cartItems = document.getElementById('cartItems');
        const cartBadge = document.getElementById('cartBadge');
        const totalAmount = document.getElementById('totalAmount');
        const checkoutBtn = document.getElementById('checkoutBtn');

        // 過濾無效項目
        this.items = this.items.filter(item => item && item.name && item.name !== 'undefined');

        const totalCount = this.getTotalCount();
        cartBadge.textContent = totalCount;

        const subtotal = this.getSubtotal();
        const shippingFee = Checkout.getShippingFee();
        const total = this.items.length > 0 ? subtotal + shippingFee : 0;

        // 顯示運費和總計
        if (this.items.length > 0) {
            const shippingText = shippingFee > 0 ? `NT$ ${shippingFee}` : '免運';
            totalAmount.innerHTML = `
                <div class="cart-subtotal">小計：NT$ ${subtotal.toLocaleString()}</div>
                <div class="cart-shipping">運費（${Checkout.getShippingMethodName()}）：${shippingText}</div>
                <div class="cart-final-total">NT$ ${total.toLocaleString()}</div>`;
        } else {
            totalAmount.textContent = 'NT$ 0';
        }

        if (this.items.length === 0) {
            cartItems.innerHTML = `<div class="empty-cart"><p>購物車是空的</p><p class="empty-cart-hint">快去挑選喜歡的商品吧！</p></div>`;
            checkoutBtn.disabled = true;
        } else {
            cartItems.innerHTML = this.items.map((item, index) => {
                let optionsHtml = '';
                if (item.selectedOptions && Object.keys(item.selectedOptions).length > 0) {
                    optionsHtml = '<div class="cart-item-options">' +
                        Object.entries(item.selectedOptions)
                            .map(([key, value]) => `<span>${key}: ${value}</span>`)
                            .join(' ') +
                        '</div>';
                }

                return `
                <div class="cart-item">
                    <img src="${item.image}" alt="${item.name}" class="cart-item-image">
                    <div class="cart-item-info">
                        <div class="cart-item-name">${item.name}</div>
                        ${optionsHtml}
                        <div class="cart-item-price">NT$ ${item.price}</div>
                        <div class="cart-item-quantity">
                            <button class="qty-btn-small" onclick="Cart.updateQuantity(${index}, -1)">-</button>
                            <span>${item.quantity}</span>
                            <button class="qty-btn-small" onclick="Cart.updateQuantity(${index}, 1)">+</button>
                        </div>
                    </div>
                    <button class="remove-item" onclick="Cart.remove(${index})">🗑️</button>
                </div>`;
            }).join('');
            checkoutBtn.disabled = false;
        }
    }
};

// 掛載到 window
if (typeof window !== 'undefined') {
    window.Cart = Cart;
    // 相容舊版函數名稱
    window.toggleCart = () => Cart.toggle();
    window.updateCartQuantity = (index, change) => Cart.updateQuantity(index, change);
    window.removeFromCart = (index) => Cart.remove(index);
}
