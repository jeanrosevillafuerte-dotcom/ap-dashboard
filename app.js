// ============================================================
//  app.js  —  Dashboard Logic
//  应用逻辑
// ============================================================

let ALL_DATA = null;
let ACTIVE_FILTER = "all";
let ACTIVE_SUPPLIER = null;

// ── UTILITIES ───────────────────────────────────────────────
function fmt(n) {
  return CONFIG.currency + " " + Number(n || 0).toLocaleString(CONFIG.locale, {
    minimumFractionDigits: 2, maximumFractionDigits: 2
  });
}
function fmtDate(str) {
  if (!str) return "—";
  const d = new Date(str);
  if (isNaN(d)) return str;
  return d.toLocaleDateString("en-GB");
}
function daysDiff(dateStr) {
  if (!dateStr) return 0;
  const due = new Date(dateStr);
  const now = new Date();
  return Math.floor((now - due) / 86400000);
}
function ageBucket(daysOverdue) {
  if (daysOverdue <= 0) return "current";
  if (daysOverdue <= 30) return "30";
  if (daysOverdue <= 60) return "60";
  if (daysOverdue <= 90) return "90";
  return "over";
}

// ── RENDER KPIs ─────────────────────────────────────────────
function renderKPIs(data) {
  const today = new Date();

  let totalOutstanding = 0, overdueAmt = 0, overdueCount = 0;
  let pdcIssuedAmt = 0, pdcIssuedCount = 0;
  let totalPaid = 0;
  let invoiceCount = 0;

  data.invoices.forEach(inv => {
    if (inv.balanceDue > 0) {
      totalOutstanding += inv.balanceDue;
      invoiceCount++;
      const days = daysDiff(inv.dueDate);
      if (days > CONFIG.overdueThresholdDays) {
        overdueAmt += inv.balanceDue;
        overdueCount++;
      }
    }
  });
  data.pdc.forEach(p => {
    if (p.status === "Issued") { pdcIssuedAmt += p.amount; pdcIssuedCount++; }
  });
  data.payments.forEach(p => { totalPaid += p.amount; });

  document.getElementById("kpi-total").textContent = fmt(totalOutstanding);
  document.getElementById("kpi-total-count").textContent = `${invoiceCount} invoices | ${invoiceCount} 张发票`;
  document.getElementById("kpi-overdue").textContent = fmt(overdueAmt);
  document.getElementById("kpi-overdue-count").textContent = `${overdueCount} invoices | ${overdueCount} 张逾期发票`;
  document.getElementById("kpi-pdc").textContent = fmt(pdcIssuedAmt);
  document.getElementById("kpi-pdc-count").textContent = `${pdcIssuedCount} checks | ${pdcIssuedCount} 张支票`;
  document.getElementById("kpi-paid").textContent = fmt(totalPaid);
  document.getElementById("kpi-paid-count").textContent = `${data.payments.length} payments | ${data.payments.length} 次付款`;
}

// ── RENDER AGING ─────────────────────────────────────────────
function renderAging(data) {
  const buckets = { current:0, "30":0, "60":0, "90":0, over:0 };
  const counts  = { current:0, "30":0, "60":0, "90":0, over:0 };

  data.invoices.forEach(inv => {
    if (inv.balanceDue <= 0) return;
    const days = daysDiff(inv.dueDate);
    const b = ageBucket(days);
    buckets[b] += inv.balanceDue;
    counts[b]++;
  });

  const map = { current:"current", "30":"30", "60":"60", "90":"90", over:"over" };
  Object.keys(map).forEach(k => {
    document.getElementById(`aging-${k}`).textContent = fmt(buckets[k]);
    document.getElementById(`aging-${k}-c`).textContent = `${counts[k]} invoice(s) | ${counts[k]} 张`;
  });
}

// ── BUILD SUPPLIER SUMMARY ────────────────────────────────────
function buildSupplierSummaries(data) {
  const map = {};

  data.suppliers.forEach(s => {
    map[s.id] = {
      ...s,
      outstanding: 0, current: 0, d30: 0, d60: 0, d90: 0, dOver: 0,
      hasPDCIssued: false, pdcIssuedAmt: 0, isOverdue: false,
      totalExpenses: 0, totalPaid: 0, pdcClearedAmt: 0
    };
  });

  data.invoices.forEach(inv => {
    if (!map[inv.supplierID]) return;
    const m = map[inv.supplierID];
    m.totalExpenses += inv.amount;
    if (inv.balanceDue <= 0) return;
    m.outstanding += inv.balanceDue;
    const days = daysDiff(inv.dueDate);
    const b = ageBucket(days);
    if (b === "current") m.current += inv.balanceDue;
    else if (b === "30")   m.d30   += inv.balanceDue;
    else if (b === "60")   m.d60   += inv.balanceDue;
    else if (b === "90")   m.d90   += inv.balanceDue;
    else                   m.dOver += inv.balanceDue;
    if (days > CONFIG.overdueThresholdDays) m.isOverdue = true;
  });

  data.payments.forEach(p => {
    if (!map[p.supplierID]) return;
    map[p.supplierID].totalPaid += p.amount;
  });

  data.pdc.forEach(p => {
    if (!map[p.supplierID]) return;
    const m = map[p.supplierID];
    if (p.status === "Issued") {
      m.hasPDCIssued = true;
      m.pdcIssuedAmt += p.amount;
    } else {
      m.pdcClearedAmt += p.amount;
    }
  });

  return Object.values(map).filter(s => s.outstanding > 0 || s.totalPaid > 0 || s.hasPDCIssued);
}

// ── RENDER SUPPLIER TABLE ─────────────────────────────────────
function renderSupplierTable(summaries) {
  const tbody = document.getElementById("supplier-tbody");
  tbody.innerHTML = "";

  const q = document.getElementById("supplier-search").value.toLowerCase();
  const filtered = summaries.filter(s => {
    const matchSearch = !q || s.name.toLowerCase().includes(q) || (s.nameCN||"").includes(q);
    if (!matchSearch) return false;
    if (ACTIVE_FILTER === "overdue") return s.isOverdue;
    if (ACTIVE_FILTER === "pdc")     return s.hasPDCIssued;
    if (ACTIVE_FILTER === "current") return !s.isOverdue;
    return true;
  });

  if (!filtered.length) {
    tbody.innerHTML = `<tr><td colspan="9" style="text-align:center;padding:40px;color:var(--muted);font-size:0.8rem;">
      No suppliers found | 未找到供应商</td></tr>`;
    return;
  }

  filtered.forEach(s => {
    const statusBadge = s.isOverdue
      ? `<span class="badge badge-red">Overdue 逾期</span>`
      : `<span class="badge badge-green">Current 正常</span>`;

    const pdcBadge = s.hasPDCIssued
      ? `<span class="pdc-indicator">●&nbsp;PDC Issued 已开支票</span>`
      : `<span style="color:var(--muted);font-size:0.65rem;">— None 无</span>`;

    const tr = document.createElement("tr");
    if (ACTIVE_SUPPLIER === s.id) tr.classList.add("active-row");
    tr.onclick = () => showDetail(s.id);
    tr.innerHTML = `
      <td class="supplier-name">${s.name}<span class="supplier-cn">${s.nameCN||""}</span></td>
      <td class="amount ${s.isOverdue?"danger":""}">${fmt(s.outstanding)}</td>
      <td class="amount">${s.current>0?fmt(s.current):"—"}</td>
      <td class="amount ${s.d30>0?"warn":""}">${s.d30>0?fmt(s.d30):"—"}</td>
      <td class="amount ${s.d60>0?"warn":""}">${s.d60>0?fmt(s.d60):"—"}</td>
      <td class="amount ${s.d90>0?"danger":""}">${s.d90>0?fmt(s.d90):"—"}</td>
      <td class="amount danger">${s.dOver>0?fmt(s.dOver):"—"}</td>
      <td>${pdcBadge}</td>
      <td>${statusBadge}</td>
    `;
    tbody.appendChild(tr);
  });

  // Totals row
  const totals = filtered.reduce((a,s) => ({
    outstanding: a.outstanding+s.outstanding,
    current:     a.current+s.current,
    d30: a.d30+s.d30, d60: a.d60+s.d60,
    d90: a.d90+s.d90, dOver: a.dOver+s.dOver
  }), {outstanding:0,current:0,d30:0,d60:0,d90:0,dOver:0});

  const totalRow = document.createElement("tr");
  totalRow.classList.add("totals-row");
  totalRow.innerHTML = `
    <td style="font-family:'DM Serif Display',serif;">TOTAL 合计 (${filtered.length})</td>
    <td class="amount">${fmt(totals.outstanding)}</td>
    <td class="amount">${fmt(totals.current)}</td>
    <td class="amount">${fmt(totals.d30)}</td>
    <td class="amount">${fmt(totals.d60)}</td>
    <td class="amount">${fmt(totals.d90)}</td>
    <td class="amount">${fmt(totals.dOver)}</td>
    <td></td><td></td>
  `;
  tbody.appendChild(totalRow);
}

// ── SHOW DETAIL PANEL ─────────────────────────────────────────
function showDetail(supplierID) {
  const data = ALL_DATA;
  const supplier = data.suppliers.find(s => s.id === supplierID);
  if (!supplier) return;

  ACTIVE_SUPPLIER = supplierID;
  buildSupplierSummaries(data);

  const invoices = data.invoices.filter(i => i.supplierID === supplierID);
  const payments = data.payments.filter(p => p.supplierID === supplierID);
  const pdcList  = data.pdc.filter(p => p.supplierID === supplierID);

  const totalExpenses  = invoices.reduce((a,i) => a+i.amount, 0);
  const totalOutst     = invoices.reduce((a,i) => a+i.balanceDue, 0);
  const totalPaid      = payments.reduce((a,p) => a+p.amount, 0);
  const pdcOutstanding = pdcList.filter(p=>p.status==="Issued").reduce((a,p)=>a+p.amount,0);

  document.getElementById("detail-name").textContent = supplier.name;
  document.getElementById("detail-cn").textContent   = supplier.nameCN || "";
  document.getElementById("ds-outstanding").textContent = fmt(totalOutst);
  document.getElementById("ds-expenses").textContent    = fmt(totalExpenses);
  document.getElementById("ds-paid").textContent        = fmt(totalPaid);
  document.getElementById("ds-pdc").textContent         = fmt(pdcOutstanding);

  // Invoices
  const invBody = document.getElementById("invoice-tbody");
  invBody.innerHTML = "";
  let invTotal = 0, balTotal = 0;
  invoices.forEach(inv => {
    const days = daysDiff(inv.dueDate);
    const overdue = days > 0 && inv.balanceDue > 0;
    invTotal += inv.amount;
    balTotal += inv.balanceDue;
    const statusBadge = inv.balanceDue <= 0
      ? `<span class="badge badge-green">Paid 已付</span>`
      : (overdue ? `<span class="badge badge-red">Overdue 逾期</span>` : `<span class="badge badge-blue">Open 未付</span>`);
    const daysText = inv.balanceDue > 0 && days > 0
      ? `<span style="color:var(--accent);font-weight:600;">${days}d</span>`
      : (inv.balanceDue <= 0 ? `<span style="color:var(--accent2);">Paid</span>` : "Current");
    invBody.innerHTML += `
      <tr>
        <td style="font-family:'DM Mono',monospace;font-size:0.72rem;">${inv.invoiceNo}</td>
        <td>${fmtDate(inv.date)}</td>
        <td style="${days>0&&inv.balanceDue>0?'color:var(--accent);font-weight:600;':''}">${fmtDate(inv.dueDate)}</td>
        <td>${inv.description}</td>
        <td class="amount">${fmt(inv.amount)}</td>
        <td class="amount ${inv.balanceDue>0&&overdue?'danger':inv.balanceDue>0?'':'success'}">${fmt(inv.balanceDue)}</td>
        <td style="text-align:center;">${daysText}</td>
        <td>${statusBadge}</td>
      </tr>`;
  });
  invBody.innerHTML += `<tr class="totals-row">
    <td colspan="4">TOTAL 合计</td>
    <td class="amount">${fmt(invTotal)}</td>
    <td class="amount danger">${fmt(balTotal)}</td>
    <td colspan="2"></td>
  </tr>`;

  // Payments
  const payBody = document.getElementById("payment-tbody");
  payBody.innerHTML = "";
  let payTotal = 0;
  if (!payments.length) {
    payBody.innerHTML = `<tr><td colspan="7" class="empty-state">
      <div class="empty-state-icon">—</div>
      <div class="empty-state-text">No payments recorded | 暂无付款记录</div>
    </td></tr>`;
  } else {
    payments.forEach(p => {
      payTotal += p.amount;
      const methodBadge = p.method.toLowerCase().includes("cheque") || p.method.toLowerCase().includes("check")
        ? `<span class="badge badge-purple">${p.method}</span>`
        : `<span class="badge badge-blue">${p.method}</span>`;
      payBody.innerHTML += `
        <tr>
          <td style="font-family:'DM Mono',monospace;font-size:0.72rem;">${p.paymentNo}</td>
          <td>${fmtDate(p.date)}</td>
          <td>${methodBadge}</td>
          <td style="font-family:'DM Mono',monospace;font-size:0.7rem;">${p.reference||"—"}</td>
          <td style="font-size:0.72rem;">${p.invoiceNo||"—"}</td>
          <td class="amount success">${fmt(p.amount)}</td>
          <td><span class="note-chip">${p.notes||"—"}</span></td>
        </tr>`;
    });
    payBody.innerHTML += `<tr class="totals-row">
      <td colspan="5">TOTAL PAID 已付合计</td>
      <td class="amount success">${fmt(payTotal)}</td>
      <td></td>
    </tr>`;
  }

  // PDC
  const pdcBody = document.getElementById("pdc-tbody");
  pdcBody.innerHTML = "";
  let pdcTotal = 0;
  if (!pdcList.length) {
    pdcBody.innerHTML = `<tr><td colspan="9">
      <div class="empty-state">
        <div class="empty-state-icon">—</div>
        <div class="empty-state-text">No PDC checks | 暂无远期支票</div>
        <div class="empty-state-cn">此供应商无远期支票记录</div>
      </div>
    </td></tr>`;
  } else {
    pdcList.forEach(p => {
      pdcTotal += p.amount;
      const isCleared = p.status === "Cleared";
      const statusEl = isCleared
        ? `<span class="pdc-status pdc-cleared"><span class="dot"></span>Cleared 已兑现</span>`
        : `<span class="pdc-status pdc-issued"><span class="dot"></span>Issued 已开出</span>`;
      pdcBody.innerHTML += `
        <tr>
          <td style="font-family:'DM Mono',monospace;font-weight:600;">${p.checkNo}</td>
          <td>${fmtDate(p.issueDate)}</td>
          <td style="${!isCleared?'color:var(--pdc-pending);font-weight:600;':''}">${fmtDate(p.checkDate)}</td>
          <td>${p.bank}</td>
          <td style="font-size:0.72rem;">${p.invoiceNo||"—"}</td>
          <td class="amount" style="color:var(--pdc-pending);">${fmt(p.amount)}</td>
          <td>${statusEl}</td>
          <td>${isCleared ? fmtDate(p.clearedDate) : '<span style="color:var(--warn);">Pending 待兑现</span>'}</td>
          <td><span class="note-chip">${p.notes||"—"}</span></td>
        </tr>`;
    });
    pdcBody.innerHTML += `<tr class="totals-row">
      <td colspan="5">TOTAL PDC 支票合计</td>
      <td class="amount" style="color:var(--pdc-pending);">${fmt(pdcTotal)}</td>
      <td colspan="3"></td>
    </tr>`;
  }

  const panel = document.getElementById("detail-panel");
  panel.classList.add("open");
  panel.scrollIntoView({ behavior: "smooth", block: "start" });

  showTab("invoices", document.querySelector(".detail-tab"));

  // Refresh table to show active row highlight
  renderSupplierTable(buildSupplierSummaries(data));
}

function closeDetail() {
  document.getElementById("detail-panel").classList.remove("open");
  ACTIVE_SUPPLIER = null;
  renderSupplierTable(buildSupplierSummaries(ALL_DATA));
}

// ── TABS ─────────────────────────────────────────────────────
function showTab(name, el) {
  document.querySelectorAll(".detail-pane").forEach(p => p.classList.remove("active"));
  document.querySelectorAll(".detail-tab").forEach(t => t.classList.remove("active"));
  document.getElementById(`tab-${name}`).classList.add("active");
  if (el) el.classList.add("active");
}

// ── FILTERS ──────────────────────────────────────────────────
function setFilter(filter, btn) {
  ACTIVE_FILTER = filter;
  document.querySelectorAll(".filter-btn").forEach(b => b.classList.remove("active"));
  btn.classList.add("active");
  renderSupplierTable(buildSupplierSummaries(ALL_DATA));
}

function filterSuppliers() {
  renderSupplierTable(buildSupplierSummaries(ALL_DATA));
}

// ── INIT ─────────────────────────────────────────────────────
async function init() {
  document.getElementById("company-name").textContent =
    CONFIG.companyName || "Company";

  const now = new Date();
  document.getElementById("last-updated-time").textContent =
    now.toLocaleString("en-MY");
  document.getElementById("as-of-date").textContent =
    now.toLocaleDateString("zh-CN");

  ALL_DATA = await loadData();

  renderKPIs(ALL_DATA);
  renderAging(ALL_DATA);
  renderSupplierTable(buildSupplierSummaries(ALL_DATA));

  // Hide loading screen
  const loading = document.getElementById("loading");
  loading.style.opacity = "0";
  setTimeout(() => loading.style.display = "none", 500);

  // Auto-refresh
  if (CONFIG.autoRefreshMinutes > 0) {
    setInterval(async () => {
      ALL_DATA = await loadData();
      renderKPIs(ALL_DATA);
      renderAging(ALL_DATA);
      renderSupplierTable(buildSupplierSummaries(ALL_DATA));
      document.getElementById("last-updated-time").textContent =
        new Date().toLocaleString("en-MY");
    }, CONFIG.autoRefreshMinutes * 60 * 1000);
  }
}

document.addEventListener("DOMContentLoaded", init);
