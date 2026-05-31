// ============================================================
//  config.js  —  EDIT THIS FILE WITH YOUR OWN SETTINGS
//  配置文件  —  请在此处填写您的设置
// ============================================================

const CONFIG = {
  // ── COMPANY INFO ────────────────────────────────────────────
  companyName: "Wintex Logistics Corporation",      // Change this | 公司名称
  companyNameCN: "WLC",                    // Chinese name | 中文名称

  // ── GOOGLE SHEETS ───────────────────────────────────────────
  // Step 1: Publish your Google Sheet (File > Share > Publish to web > CSV)
  // Step 2: Copy the SHEET ID from the URL (the long string between /d/ and /edit)
  // 步骤：发布 Google Sheet 后，将 Sheet ID 填写在下方

  sheetId: "11k3d0vC6uKYEKHNOd-vZT4YbmKydtDKKaBjO7U4qQj0",   // ← REPLACE THIS

  // The GID numbers for each sheet tab (visible in the URL when you click each tab)
  // 各工作表的 GID（点击每个标签时 URL 中显示的数字）
  sheets: {
    suppliers:  "0",       // Tab: Suppliers   (GID shown in URL)
    invoices:   "1038390416",  // Tab: Invoices    ← replace with real GID
    payments:   "1864278303",  // Tab: Payments    ← replace with real GID
    pdc:        "1987635973",  // Tab: PDC         ← replace with real GID
  },

  // ── CURRENCY ────────────────────────────────────────────────
  currency: "Php",          // e.g.  RM, $, ¥, €
  locale:   "en-PH",       // for number formatting

  // ── DATE FORMAT ─────────────────────────────────────────────
  dateFormat: "DD/MM/YYYY",  // display format (informational)

  // ── AUTO REFRESH ─────────────────────────────────────────────
  autoRefreshMinutes: 15,    // set 0 to disable

  // ── OVERDUE THRESHOLD ────────────────────────────────────────
  overdueThresholdDays: 0,   // 0 = overdue if past due date
};
