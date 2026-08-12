const VN_TIMEZONE = 'Asia/Ho_Chi_Minh';

/** YYYY-MM-DD theo giờ Việt Nam */
function getVnDateString(date = new Date()) {
    return new Intl.DateTimeFormat('en-CA', {
        timeZone: VN_TIMEZONE,
    }).format(date);
}

/** Cộng/trừ ngày trên chuỗi YYYY-MM-DD (theo lịch, không phụ thuộc UTC) */
function shiftVnDateString(dateStr, deltaDays) {
    const [year, month, day] = dateStr.split('-').map(Number);
    const dt = new Date(Date.UTC(year, month - 1, day + deltaDays, 12, 0, 0));
    return `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, '0')}-${String(dt.getUTCDate()).padStart(2, '0')}`;
}

/** Thứ trong tuần (0=CN … 6=T7) từ YYYY-MM-DD */
function getVnWeekdayIndex(dateStr) {
    const [year, month, day] = dateStr.split('-').map(Number);
    return new Date(Date.UTC(year, month - 1, day, 12, 0, 0)).getUTCDay();
}

/** Nhãn hiển thị: T3 11/8 */
function formatVnChartLabel(dateStr) {
    const dayLabels = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];
    const [year, month, day] = dateStr.split('-').map(Number);
    const dayName = dayLabels[getVnWeekdayIndex(dateStr)];
    return `${dayName} ${day}/${month}`;
}

module.exports = {
    VN_TIMEZONE,
    getVnDateString,
    shiftVnDateString,
    getVnWeekdayIndex,
    formatVnChartLabel,
};
