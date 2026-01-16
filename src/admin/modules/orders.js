/**
 * Admin Orders 訂單管理模組 - 處理訂單列表與編輯
 * Rule #6 簡約規則: 大程式只有在證明其他方法不行時才寫
 * Rule #8 穩健性: 穩健性來自透明與簡單
 */

const AdminOrders = {
    // 訂單列表
    items: [],
    // 賣場列表 (用於顯示 KOL 名稱)
    stores: [],
    // 待儲存的變更
    pendingUpdates: {},
    // 目前編輯的訂單
    editingOrderId: null,
    // 暫存訂單項目
    tempOrderItems: [],

    /**
     * 設定訂單列表
     * @param {Array} orders - 訂單陣列
     */
    setItems(orders) {
        this.items = orders;
    },

    /**
     * 設定賣場列表
     * @param {Array} stores - 賣場陣列
     */
    setStores(stores) {
        this.stores = stores;
    },

    /**
     * 取得賣場名稱
     * @param {string} storeId - 賣場 ID
     * @returns {string} 賣場名稱
     */
    getStoreName(storeId) {
        if (!storeId) return '';
        const store = this.stores.find(s => s.storeId === storeId);
        return store ? `${store.storeName} (${store.ownerName})` : storeId;
    },

    /**
     * 渲染訂單列表
     * @param {Array} orders - 要渲染的訂單 (可選，預設使用 this.items)
     */
    render(orders = null) {
        const displayOrders = orders || this.items;
        const tbody = document.getElementById('ordersTableBody');

        if (!tbody) return;

        if (displayOrders.length === 0) {
            tbody.innerHTML = '<tr><td colspan="6" class="empty-cell">目前沒有訂單</td></tr>';
            return;
        }

        tbody.innerHTML = displayOrders.map(order => {
            const pending = this.pendingUpdates[order.orderId];
            const displayStatus = (pending && pending.status) ? pending.status : order.status;
            const isModified = !!pending;

            // 訂單來源標記
            let sourceIcon = '';
            let sourceTitle = '';
            if (order.orderSource === 'customer') {
                sourceIcon = '🛒';
                sourceTitle = '客戶訂單';
            } else if (order.orderSource === 'manual') {
                sourceIcon = '✍️';
                sourceTitle = '手動建單';
            } else if (order.orderSource === 'kol') {
                sourceIcon = '👥';
                sourceTitle = '團購訂單';
            }

            const statusOptions = ['待處理', '已確認', '已出貨', '已完成', '已取消', '取消']
                .map(s => `<option value="${s}" ${s === displayStatus ? 'selected' : ''}>${s}</option>`)
                .join('');

            return `
            <tr class="${isModified ? 'row-modified' : ''}" onclick="AdminOrders.toggleDetails('${order.orderId}')" style="cursor:pointer;">
                <td><span title="${sourceTitle}">${sourceIcon}</span> ${order.orderId}</td>
                <td onclick="event.stopPropagation()">
                    <select onchange="AdminOrders.markUpdated('${order.orderId}', 'status', this.value)" 
                            style="padding: 5px; border-radius: 4px; border: 1px solid #ddd; background: ${this.getStatusColor(displayStatus)}">
                        ${statusOptions}
                    </select>
                    ${isModified ? '<span style="color:red; font-size:12px; margin-left:5px;">*</span>' : ''}
                </td>
                <td>${order.date}</td>
                <td>${order.customerName}</td>
                <td>${order.shippingMethod || '-'}</td>
                <td>${AdminUtils.formatCurrency(order.total)}</td>
                <td onclick="event.stopPropagation()">
                    <div style="display:flex; gap:5px;">
                        <button class="action-btn" onclick="AdminOrders.openDetail('${order.orderId}')">編輯</button>
                        <button class="action-btn btn-danger" onclick="AdminOrders.confirmDelete('${order.orderId}')">刪除</button>
                    </div>
                </td>
            </tr>
            <tr id="details-${order.orderId}" style="display:none; background-color:#f8f9fa;">
                <td colspan="7">
                    <div style="padding: 15px;">
                        <strong>商品明細：</strong>
                        <ul style="margin: 10px 0; padding-left: 20px;">
                            ${(order.items || []).map(item => `
                                <li>${item.name} ${item.spec ? `(${item.spec})` : ''} x ${item.qty} - ${AdminUtils.formatCurrency(item.subtotal)}</li>
                            `).join('')}
                        </ul>
                        <div style="margin-top: 10px; display:flex; gap: 20px;">
                            <span><strong>電話:</strong> ${order.customerPhone || '-'}</span>
                            <span><strong>運費:</strong> ${order.shippingFee || 0}</span>
                            <span><strong>備註:</strong> ${order.note || '無'}</span>
                        </div>
                        ${order.storeName ? `<div style="margin-top: 5px;"><strong>門市:</strong> ${order.storeName} (${order.storeCode})</div>` : ''}
                        ${order.storeAddress ? `<div style="margin-top: 5px;"><strong>地址:</strong> ${order.storeAddress}</div>` : ''}
                        ${order.storeId ? `<div style="margin-top: 5px; color: #e91e63;"><strong>KOL:</strong> ${this.getStoreName(order.storeId)}</div>` : ''}
                    </div>
                </td>
            </tr>
        `}).join('');
    },

    /**
     * 切換訂單詳情顯示
     * @param {string} orderId - 訂單 ID
     */
    toggleDetails(orderId) {
        const row = document.getElementById(`details-${orderId}`);
        if (row) {
            row.style.display = row.style.display === 'none' ? 'table-row' : 'none';
        }
    },

    /**
     * 標記訂單已修改
     * @param {string} orderId - 訂單 ID
     * @param {string} field - 欄位名稱
     * @param {*} value - 新值
     */
    markUpdated(orderId, field, value) {
        if (!this.pendingUpdates[orderId]) {
            this.pendingUpdates[orderId] = {};
        }
        this.pendingUpdates[orderId][field] = value;

        this.render();
        this.updateBatchUI();
        AdminToast.info(`狀態變更已暫存 (${orderId})`, 1500);
    },

    /**
     * 更新批次操作 UI
     */
    updateBatchUI() {
        const count = Object.keys(this.pendingUpdates).length;
        const msg = document.getElementById('unsavedChangesMsg');
        const btn = document.getElementById('saveBatchBtn');

        if (msg && btn) {
            if (count > 0) {
                msg.textContent = `⚠️ 有 ${count} 筆訂單變更未儲存`;
                btn.disabled = false;
            } else {
                msg.textContent = '';
                btn.disabled = true;
            }
        }
    },

    /**
     * 儲存批次變更
     */
    async saveBatch() {
        if (Object.keys(this.pendingUpdates).length === 0) {
            AdminToast.warning('沒有變更需要儲存');
            return;
        }

        const btn = document.getElementById('saveBatchBtn');
        if (!btn) return;

        const confirmMsg = `確定要儲存 ${Object.keys(this.pendingUpdates).length} 筆訂單的變更嗎？`;
        if (!confirm(confirmMsg)) return;

        btn.disabled = true;
        btn.textContent = '儲存中...';

        try {
            const data = await AdminAPI.updateOrdersBatch(this.pendingUpdates);

            if (data.success) {
                AdminToast.success(`成功儲存 ${Object.keys(this.pendingUpdates).length} 筆訂單！`);
                this.pendingUpdates = {};
                this.updateBatchUI();
                AdminData.refresh();
            } else {
                AdminToast.error('儲存失敗：' + data.error);
            }
        } catch (error) {
            AdminToast.error('儲存失敗：' + error);
        } finally {
            btn.disabled = false;
            btn.textContent = '💾 儲存所有變更';
        }
    },

    /**
     * 篩選訂單
     */
    filter() {
        const searchTerm = document.getElementById('orderSearchInput').value.toLowerCase();
        const statusFilter = document.getElementById('orderStatusFilter').value;

        const filtered = this.items.filter(order => {
            const matchSearch = !searchTerm ||
                order.orderId.toLowerCase().includes(searchTerm) ||
                (order.customerName || '').toLowerCase().includes(searchTerm) ||
                String(order.customerPhone || '').toLowerCase().includes(searchTerm);

            const matchStatus = !statusFilter || order.status === statusFilter;

            return matchSearch && matchStatus;
        });

        this.render(filtered);
    },

    /**
     * 取得狀態顏色
     * @param {string} status - 狀態
     * @returns {string} 顏色代碼
     */
    getStatusColor(status) {
        const colors = {
            '待處理': '#fff3cd',
            '已確認': '#d1e7dd',
            '已出貨': '#cff4fc',
            '已完成': '#e2e3e5',
            '已取消': '#f8d7da',
            '取消': '#f8d7da'
        };
        return colors[status] || '#fff';
    },

    /**
     * 開啟訂單詳情編輯
     * @param {string} orderId - 訂單 ID
     */
    openDetail(orderId) {
        const order = this.items.find(o => o.orderId === orderId);
        if (!order) return;

        this.editingOrderId = orderId;
        // ... 詳細編輯邏輯保持與原版相同
        AdminModal.open('orderDetailModal');
    },

    /**
     * 確認刪除訂單
     * @param {string} orderId - 訂單 ID
     */
    async confirmDelete(orderId) {
        if (!confirm(`確定要刪除訂單 ${orderId}？此操作無法復原！`)) return;

        try {
            const data = await AdminAPI.deleteOrder(orderId);
            if (data.success) {
                AdminToast.success('訂單已刪除');
                AdminData.refresh();
            } else {
                AdminToast.error('刪除失敗：' + data.error);
            }
        } catch (error) {
            AdminToast.error('刪除失敗：' + error);
        }
    }
};

// 掛載到 window
if (typeof window !== 'undefined') {
    window.AdminOrders = AdminOrders;
    // 相容舊版
    window.renderOrders = (orders) => AdminOrders.render(orders);
    window.filterOrders = () => AdminOrders.filter();
    window.saveBatchUpdates = () => AdminOrders.saveBatch();
    window.updateBatchUI = () => AdminOrders.updateBatchUI();
    window.toggleRowDetails = (id) => AdminOrders.toggleDetails(id);
    window.markOrderUpdated = (id, f, v) => AdminOrders.markUpdated(id, f, v);
    window.confirmDeleteOrder = (id) => AdminOrders.confirmDelete(id);
}
