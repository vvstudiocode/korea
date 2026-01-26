/**
 * Checkout 結帳模組 - 處理結帳流程與訂單提交
 * Rule #5 簡單性: 設計簡單；只在必要時增加複雜度
 * Rule #12 修復規則: 失敗時要大聲且盡早失敗
 */

const Checkout = {
    // 運送方式設定
    SHIPPING_METHODS: {
        'pickup': { name: '限台中市面交', fee: 0 },
        '711': { name: '7-11 店到店', fee: 60 }
    },

    // 目前選擇的運送方式
    selectedMethod: '711',

    /**
     * 更新運送方式
     * @param {string} method - 運送方式 ID
     */
    setShippingMethod(method) {
        if (this.SHIPPING_METHODS[method]) {
            this.selectedMethod = method;
            this.toggleStoreFields();
            Cart.updateUI();
        }
    },

    /**
     * 取得目前運費
     * @returns {number} 運費金額
     */
    getShippingFee() {
        const method = this.SHIPPING_METHODS[this.selectedMethod];
        return method ? method.fee : 0;
    },

    /**
     * 取得目前運送方式名稱
     * @returns {string} 運送方式名稱
     */
    getShippingMethodName() {
        const method = this.SHIPPING_METHODS[this.selectedMethod];
        return method ? method.name : '';
    },

    /**
     * 根據運送方式顯示/隱藏門市欄位
     */
    toggleStoreFields() {
        const is711 = this.selectedMethod === '711';
        const storeFields = document.getElementById('storeFieldsSection');
        const storeNameInput = document.getElementById('storeName');
        const storeCodeInput = document.getElementById('storeCode');
        const storeAddressInput = document.getElementById('storeAddress');
        const addressGroup = document.querySelector('.address-group');

        if (storeFields && storeNameInput && storeCodeInput && storeAddressInput) {
            storeFields.style.display = is711 ? 'block' : 'none';
            storeNameInput.required = is711;
            storeCodeInput.required = is711;
            storeAddressInput.required = is711;
        }

        if (addressGroup) {
            addressGroup.style.display = is711 ? 'none' : 'block';
        }

        // 更新運送選項的選中狀態
        document.querySelectorAll('.shipping-option').forEach(opt => {
            const input = opt.querySelector('input[type="radio"]');
            if (input) {
                opt.classList.toggle('selected', input.value === this.selectedMethod);
            }
        });
    },

    /**
     * 顯示結帳彈窗
     */
    show() {
        if (Cart.items.length === 0) {
            Toast.warning('購物車是空的');
            return;
        }

        // 關閉購物車側邊欄
        Cart.toggle();

        // 更新結帳摘要
        this.updateSummary();

        // 顯示結帳彈窗
        Modal.show('checkoutModal');

        // 設定門市欄位
        this.toggleStoreFields();
    },

    /**
     * 更新結帳摘要
     */
    updateSummary() {
        const checkoutItems = document.getElementById('orderSummary');
        const checkoutTotal = document.getElementById('orderTotal');

        if (!checkoutItems || !checkoutTotal) return;

        // 商品列表
        checkoutItems.innerHTML = Cart.items.map(item => {
            const optionText = item.spec ? `<span class="item-option">(${item.spec})</span>` : '';
            return `
            <div class="checkout-item">
                <span class="item-name">${item.name} ${optionText} x${item.quantity}</span>
                <span class="item-price">NT$ ${(item.price * item.quantity).toLocaleString()}</span>
            </div>`;
        }).join('');

        // 總計
        const subtotal = Cart.getSubtotal();
        const shippingFee = this.getShippingFee();
        const total = subtotal + shippingFee;

        checkoutTotal.innerHTML = `
            <div class="summary-row"><span>商品小計</span><span>NT$ ${subtotal.toLocaleString()}</span></div>
            <div class="summary-row"><span>運費（${this.getShippingMethodName()}）</span><span>NT$ ${shippingFee.toLocaleString()}</span></div>
            <div class="summary-row total"><span>總計</span><span>NT$ ${total.toLocaleString()}</span></div>`;
    },

    /**
     * 處理訂單提交
     * @param {Event} e - 表單提交事件
     */
    async handleSubmit(e) {
        e.preventDefault();

        const submitBtn = document.querySelector('#orderForm button[type="submit"]');
        const originalText = submitBtn.textContent;

        try {
            submitBtn.disabled = true;
            submitBtn.textContent = '訂單處理中...';

            // 收集表單資料
            const formData = new FormData(e.target);
            const customerName = formData.get('name');
            const customerPhone = formData.get('phone');

            // 驗證電話格式
            if (!Utils.isValidPhone(customerPhone)) {
                Toast.error('請輸入正確的手機號碼格式');
                submitBtn.disabled = false;
                submitBtn.textContent = originalText;
                return;
            }

            // 組合運送地址
            let shippingAddress = '';
            if (this.selectedMethod === '711') {
                const storeName = formData.get('storeName');
                const storeCode = formData.get('storeCode');
                const storeAddress = formData.get('storeAddress');
                shippingAddress = `7-11 ${storeName} (${storeCode}) ${storeAddress}`;
            } else {
                shippingAddress = formData.get('address') || '台中面交';
            }

            // 產生訂單編號
            const orderId = 'KR' + new Date().toISOString().slice(0, 10).replace(/-/g, '') + Math.random().toString().slice(2, 6);

            // 準備訂單資料
            const orderData = {
                orderId: orderId,
                customerName: formData.get('name'),
                customerPhone: formData.get('phone'),
                customerLineId: formData.get('lineId'),
                customerEmail: formData.get('email'),
                customerNote: formData.get('note') || '',
                shippingMethod: this.getShippingMethodName(),
                shippingAddress,
                shippingFee: this.getShippingFee(),
                items: Cart.items.map(item => {
                    // 將選項物件轉換為內部規格字串 (e.g., "紅/M") 以匹配後端庫存 Spec key
                    let specString = '';
                    if (item.selectedOptions && Object.keys(item.selectedOptions).length > 0) {
                        specString = Object.values(item.selectedOptions).join('/');
                    }
                    return {
                        id: item.id,
                        name: item.name,
                        qty: Number(item.quantity),
                        quantity: Number(item.quantity),
                        price: Number(typeof item.price === 'string' ? item.price.replace(/,/g, '') : item.price),
                        spec: specString,
                        selectedOptions: item.selectedOptions || {}
                    };
                }),
                subtotal: Cart.getSubtotal(),
                total: Cart.getSubtotal() + this.getShippingFee(),
                storeId: (typeof AppStorage !== 'undefined' ? AppStorage.getStoreId() : null),
                orderType: (typeof AppStorage !== 'undefined' && AppStorage.getStoreId()) ? 'store' : 'direct',
                // 為了相容 GAS 接收端，加入個別欄位
                storeName: formData.get('storeName') || '',
                storeCode: formData.get('storeCode') || '',
                storeAddress: formData.get('storeAddress') || ''
            };

            // 第二個參數為 isStore，如果是獨立商店則為 true
            const isStore = typeof AppStorage !== 'undefined' && !!AppStorage.getStoreId();
            const result = await API.submitOrder(orderData, isStore);

            if (result.success) {
                // 清空購物車
                Cart.clear();

                // 關閉結帳彈窗
                Modal.close('checkoutModal');

                // 顯示成功訊息
                // 顯示成功訊息
                // 使用我們送出的 orderId，因為後端可能只回傳 success
                document.getElementById('orderNumber').textContent = orderId;
                Modal.show('successModal');

                Toast.success('訂單提交成功！');
            } else {
                throw new Error(result.message || '訂單提交失敗');
            }
        } catch (error) {
            console.error('訂單提交錯誤:', error);
            Toast.error('訂單提交失敗，請稍後再試');
        } finally {
            submitBtn.disabled = false;
            submitBtn.textContent = originalText;
        }
    }
};

// 掛載到 window
if (typeof window !== 'undefined') {
    window.Checkout = Checkout;
    // 相容舊版函數名稱
    window.showCheckout = () => Checkout.show();
    window.updateShippingMethod = (method) => Checkout.setShippingMethod(method);
    window.getShippingFee = () => Checkout.getShippingFee();
    window.getShippingMethodName = () => Checkout.getShippingMethodName();
}
