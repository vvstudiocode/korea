/**
 * Admin Dashboard 儀表板模組 - 處理統計數據顯示
 * Rule #7 透明性: 設計可見性，讓檢查和除錯更容易
 * Rule #5 簡單性: 設計簡單；只在必要時增加複雜度
 */

const AdminDashboard = {
    /**
     * 更新儀表板統計
     * @param {Object} stats - 統計資料
     */
    updateStats(stats) {
        const elements = {
            statRevenue: stats.totalRevenue,
            statCost: stats.totalCost,
            statProfit: stats.grossProfit,
            statOrders: stats.totalOrders,
            statPending: stats.pendingOrders
        };

        Object.entries(elements).forEach(([id, value]) => {
            const el = document.getElementById(id);
            if (el) {
                // 金額類型格式化
                if (['statRevenue', 'statCost', 'statProfit'].includes(id)) {
                    el.textContent = AdminUtils.formatCurrency(value);
                } else {
                    el.textContent = value;
                }
            }
        });

        // 計算毛利率
        const profitMargin = stats.totalRevenue > 0
            ? ((stats.grossProfit / stats.totalRevenue) * 100).toFixed(1)
            : 0;
        const marginEl = document.getElementById('statProfitMargin');
        if (marginEl) {
            marginEl.textContent = `毛利率: ${profitMargin}%`;
        }
    },

    /**
     * 日期篩選
     * @param {string} range - 範圍 (today, week, month, year, all, custom)
     */
    filterByDate(range) {
        const customDates = document.getElementById('dashboardCustomDates');

        if (range === 'custom') {
            if (customDates) customDates.style.display = 'flex';
            // 初始化日期選擇器
            if (!document.getElementById('dashStartDate').value) {
                const now = new Date();
                const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
                document.getElementById('dashStartDate').value = this.formatDate(firstDay);
                document.getElementById('dashEndDate').value = this.formatDate(now);
            }
            return;
        } else {
            if (customDates) customDates.style.display = 'none';
        }

        const { startDate, endDate } = this.getDateRange(range);
        AdminData.refresh(
            startDate ? this.formatDate(startDate) : null,
            endDate ? this.formatDate(endDate) : null
        );
    },

    /**
     * 套用自訂日期範圍
     */
    applyCustomDate() {
        const startVal = document.getElementById('dashStartDate').value;
        const endVal = document.getElementById('dashEndDate').value;

        if (!startVal || !endVal) {
            AdminToast.warning('請選擇開始與結束日期');
            return;
        }

        const startDate = new Date(startVal);
        const endDate = new Date(endVal);

        if (startDate > endDate) {
            AdminToast.warning('結束日期不能早於開始日期');
            return;
        }

        AdminData.refresh(startVal, endVal);
    },

    /**
     * 根據範圍取得日期
     * @param {string} range - 範圍
     * @returns {Object} { startDate, endDate }
     */
    getDateRange(range) {
        const now = new Date();
        let startDate = null;
        let endDate = null;

        switch (range) {
            case 'today':
                startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
                endDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);
                break;
            case 'week':
                startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
                startDate.setHours(0, 0, 0, 0);
                endDate = now;
                break;
            case 'month':
                startDate = new Date(now.getFullYear(), now.getMonth(), 1);
                endDate = now;
                break;
            case 'year':
                startDate = new Date(now.getFullYear(), 0, 1);
                endDate = now;
                break;
            case 'all':
            default:
                startDate = null;
                endDate = null;
                break;
        }

        return { startDate, endDate };
    },

    /**
     * 格式化日期為 YYYY-MM-DD
     * @param {Date} date - 日期
     * @returns {string}
     */
    formatDate(date) {
        if (!date) return null;
        return date.getFullYear() + '-' +
            String(date.getMonth() + 1).padStart(2, '0') + '-' +
            String(date.getDate()).padStart(2, '0');
    }
};

// 掛載到 window
if (typeof window !== 'undefined') {
    window.AdminDashboard = AdminDashboard;
    // 相容舊版
    window.filterDashboardByDate = (range) => AdminDashboard.filterByDate(range);
    window.applyDashboardCustomDate = () => AdminDashboard.applyCustomDate();
}
