/**
 * Checkout 結帳模組 - 處理結帳流程與訂單提交
 * Rule #5 簡單性: 設計簡單；只在必要時增加複雜度
 * Rule #12 修復規則: 失敗時要大聲且盡早失敗
 */

const Checkout = {
    // 運送方式設定 - 預設值（會被動態載入覆蓋）
    SHIPPING_METHODS: {
        'pickup': { name: '限台中市面交', fee: 0 },
        '711': { name: '7-11 店到店', fee: 60 }
    },

    // 目前選擇的運送方式
    selectedMethod: '711',

    /**
     * 初始化運送選項（從後端載入）
     */
    async init() {
        try {
            const result = await API.getShippingOptions();
            if (result.success && result.shippingOptions) {
                // 更新運送方式設定
                this.SHIPPING_METHODS = {
                    'pickup': {
                        name: result.shippingOptions.option1.name,
                        fee: result.shippingOptions.option1.fee
                    },
                    '711': {
                        name: result.shippingOptions.option2.name,
                        fee: result.shippingOptions.option2.fee
                    }
                };
                console.log('運送選項已載入:', this.SHIPPING_METHODS);
            }
        } catch (error) {
            console.error('載入運送選項失敗，使用預設值:', error);
        }
    },

    /**
     * 將網站設定套用到結帳表單（匯款資訊、提示）
     * 獨立函數方便延遲呼叫
     */
    _applySettings() {
        if (typeof App === 'undefined' || !App.siteSettings) return;
        const s = App.siteSettings;

        // 1. 更新匯款資訊區塊
        const paymentInfoDiv = document.querySelector('.payment-info');
        if (paymentInfoDiv && (s.bankName || s.bankAccount)) {
            let bankHtml = '';
            if (s.bankName) bankHtml += `<div class="payment-item"><span class="payment-label">銀行名稱：</span><span class="payment-value">${s.bankName} ${s.bankCode ? `(代碼 ${s.bankCode})` : ''}</span></div>`;
            if (s.bankAccount) bankHtml += `<div class="payment-item"><span class="payment-label">帳號：</span><span class="payment-value account-number">${s.bankAccount}</span></div>`;

            // 保留固定提示
            bankHtml += `<div class="payment-item"><span class="payment-label">任何問題可洽網頁最下方LINE | IG</span></div>`;
            bankHtml += `<div class="payment-item"><span class="payment-value">匯款完成後請聯繫我們匯款後五碼</span></div>`;

            const detailsDiv = paymentInfoDiv.querySelector('.payment-details');
            if (detailsDiv) detailsDiv.innerHTML = bankHtml;

            // 更新備註提示
            if (s.bankNote) {
                const noteP = paymentInfoDiv.querySelector('.payment-note');
                if (noteP) noteP.textContent = s.bankNote;
            }
        }

        // 2. 更新匯款完成提示欄位 (paymentNote)
        if (s.paymentNote) {
            const hintElement = document.querySelector('.form-hint');
            if (hintElement) {
                hintElement.innerHTML = s.paymentNote;
            }
        }
    },

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

        // 更新結帳表單的設定（匯款資訊、提示）
        this._applySettings();

        // 若 App.siteSettings 尚未載入（商品頁可能有延遲），延遲更新
        if (typeof App !== 'undefined' && !App.siteSettings) {
            setTimeout(() => this._applySettings(), 600);
        }

        // 關閉購物車側邊欄
        if (typeof Cart.close === 'function') {
            Cart.close();
        } else {
            Cart.toggle(); // Fallback for safety
        }

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
                // 使用我們送出的 orderId，因為後端可能只回傳 success
                document.getElementById('orderNumber').textContent = orderId;

                // 更新自定義成功訊息 (使用 paymentNote 欄位)
                const customMsgContainer = document.getElementById('successCustomMessage');
                if (customMsgContainer && typeof App !== 'undefined' && App.siteSettings && App.siteSettings.paymentNote) {
                    customMsgContainer.innerHTML = App.siteSettings.paymentNote.replace(/\n/g, '<br>');
                    customMsgContainer.style.display = 'block';
                } else if (customMsgContainer) {
                    customMsgContainer.style.display = 'none';
                }

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
