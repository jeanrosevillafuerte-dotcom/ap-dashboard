// ============================================================
//  data.js  —  Fetches data from Google Sheets (CSV export)
//  数据层  —  从 Google Sheet 获取数据
// ============================================================

// ── SAMPLE / FALLBACK DATA ──────────────────────────────────
// Used when Google Sheets is not yet configured or unreachable
// 当 Google Sheet 未配置或无法访问时使用示例数据

const SAMPLE_DATA = {
  suppliers: [
    { id:"S001", name:"ABC Trading Co.",       nameCN:"ABC贸易有限公司",     contact:"0123456789" },
    { id:"S002", name:"XYZ Supply Sdn Bhd",    nameCN:"XYZ供应有限公司",     contact:"0198765432" },
    { id:"S003", name:"Golden Star Enterprise", nameCN:"金星企业",            contact:"0111234567" },
    { id:"S004", name:"Pacific Logistics",      nameCN:"太平洋物流",          contact:"0167654321" },
    { id:"S005", name:"SteelMart Industries",   nameCN:"钢铁市场工业",        contact:"0134567890" },
  ],
  invoices: [
    // supplierID, invoiceNo, date, dueDate, description, amount, balanceDue
    { supplierID:"S001", invoiceNo:"INV-2024-001", date:"2024-11-01", dueDate:"2024-12-01", description:"Goods Purchase",      amount:15000, balanceDue:15000 },
    { supplierID:"S001", invoiceNo:"INV-2024-015", date:"2024-12-15", dueDate:"2025-01-15", description:"Monthly Supply",      amount:8500,  balanceDue:3500  },
    { supplierID:"S001", invoiceNo:"INV-2025-003", date:"2025-01-10", dueDate:"2025-02-10", description:"Special Order",       amount:22000, balanceDue:22000 },
    { supplierID:"S002", invoiceNo:"INV-2024-020", date:"2024-10-20", dueDate:"2024-11-20", description:"Raw Materials",       amount:45000, balanceDue:45000 },
    { supplierID:"S002", invoiceNo:"INV-2025-001", date:"2025-01-05", dueDate:"2025-02-05", description:"Hardware Supply",     amount:12000, balanceDue:12000 },
    { supplierID:"S003", invoiceNo:"INV-2024-018", date:"2024-12-01", dueDate:"2025-01-01", description:"Electrical Parts",    amount:6800,  balanceDue:6800  },
    { supplierID:"S003", invoiceNo:"INV-2025-002", date:"2025-01-20", dueDate:"2025-02-20", description:"Maintenance Items",   amount:3200,  balanceDue:3200  },
    { supplierID:"S004", invoiceNo:"INV-2024-022", date:"2024-11-15", dueDate:"2024-12-15", description:"Freight Services",    amount:9500,  balanceDue:9500  },
    { supplierID:"S004", invoiceNo:"INV-2025-004", date:"2025-01-18", dueDate:"2025-02-18", description:"Delivery Charges",    amount:4200,  balanceDue:4200  },
    { supplierID:"S005", invoiceNo:"INV-2024-030", date:"2024-09-30", dueDate:"2024-10-30", description:"Steel Beams",         amount:78000, balanceDue:38000 },
    { supplierID:"S005", invoiceNo:"INV-2024-045", date:"2024-12-20", dueDate:"2025-01-20", description:"Construction Materials", amount:25000, balanceDue:25000 },
  ],
  payments: [
    // supplierID, paymentNo, date, method, reference, invoiceNo, amount, notes
    { supplierID:"S001", paymentNo:"PAY-001", date:"2025-01-05", method:"Bank Transfer", reference:"TRF2025010501", invoiceNo:"INV-2024-015", amount:5000,  notes:"Partial payment" },
    { supplierID:"S005", paymentNo:"PAY-002", date:"2024-12-01", method:"Cheque",        reference:"CHQ-003456",     invoiceNo:"INV-2024-030", amount:40000, notes:"Partial settlement" },
  ],
  pdc: [
    // supplierID, checkNo, issueDate, checkDate, bank, invoiceNo, amount, status (Issued/Cleared), clearedDate, notes
    { supplierID:"S001", checkNo:"CHQ-2025-001", issueDate:"2025-01-10", checkDate:"2025-02-10", bank:"Maybank",  invoiceNo:"INV-2025-003", amount:22000, status:"Issued",  clearedDate:"",           notes:"PDC for Jan order" },
    { supplierID:"S002", checkNo:"CHQ-2025-002", issueDate:"2025-01-15", checkDate:"2025-02-15", bank:"CIMB",    invoiceNo:"INV-2025-001", amount:12000, status:"Issued",  clearedDate:"",           notes:"" },
    { supplierID:"S004", checkNo:"CHQ-2025-003", issueDate:"2025-01-18", checkDate:"2025-02-18", bank:"RHB",     invoiceNo:"INV-2025-004", amount:4200,  status:"Issued",  clearedDate:"",           notes:"Delivery PDC" },
    { supplierID:"S005", checkNo:"CHQ-2024-098", issueDate:"2024-11-01", checkDate:"2024-12-01", bank:"Maybank", invoiceNo:"INV-2024-030", amount:20000, status:"Cleared", clearedDate:"2024-12-03", notes:"Already cleared" },
  ]
};

// ── CSV PARSER ──────────────────────────────────────────────
function parseCSV(text) {
  const lines = text.trim().split("\n");
  if (lines.length < 2) return [];
  const headers = lines[0].split(",").map(h => h.trim().replace(/^"|"$/g, ""));
  return lines.slice(1).map(line => {
    const vals = [];
    let inQuote = false, cur = "";
    for (let i = 0; i < line.length; i++) {
      const c = line[i];
      if (c === '"') { inQuote = !inQuote; }
      else if (c === "," && !inQuote) { vals.push(cur.trim()); cur = ""; }
      else { cur += c; }
    }
    vals.push(cur.trim());
    const obj = {};
    headers.forEach((h, i) => { obj[h] = (vals[i] || "").replace(/^"|"$/g, ""); });
    return obj;
  });
}

// ── FETCH FROM GOOGLE SHEETS ────────────────────────────────
async function fetchSheet(sheetName, gid) {
  const url = `https://docs.google.com/spreadsheets/d/${CONFIG.sheetId}/export?format=csv&gid=${gid}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status} for sheet ${sheetName}`);
  const text = await res.text();
  return parseCSV(text);
}

// Map CSV rows from Google Sheets to internal format
function mapSuppliers(rows) {
  return rows.map(r => ({
    id:      r["SupplierID"]   || r["supplierID"]   || "",
    name:    r["SupplierName"] || r["supplierName"] || "",
    nameCN:  r["SupplierNameCN"] || r["supplierNameCN"] || "",
    contact: r["Contact"]      || "",
  })).filter(r => r.id);
}
function mapInvoices(rows) {
  return rows.map(r => ({
    supplierID:  r["SupplierID"]   || "",
    invoiceNo:   r["InvoiceNo"]    || "",
    date:        r["Date"]         || "",
    dueDate:     r["DueDate"]      || "",
    description: r["Description"]  || "",
    amount:      parseFloat(r["Amount"]     || 0),
    balanceDue:  parseFloat(r["BalanceDue"] || 0),
  })).filter(r => r.supplierID);
}
function mapPayments(rows) {
  return rows.map(r => ({
    supplierID: r["SupplierID"] || "",
    paymentNo:  r["PaymentNo"] || "",
    date:       r["Date"]      || "",
    method:     r["Method"]    || "",
    reference:  r["Reference"] || "",
    invoiceNo:  r["InvoiceNo"] || "",
    amount:     parseFloat(r["Amount"] || 0),
    notes:      r["Notes"]     || "",
  })).filter(r => r.supplierID);
}
function mapPDC(rows) {
  return rows.map(r => ({
    supplierID:  r["SupplierID"] || "",
    checkNo:     r["CheckNo"]    || "",
    issueDate:   r["IssueDate"]  || "",
    checkDate:   r["CheckDate"]  || "",
    bank:        r["Bank"]       || "",
    invoiceNo:   r["InvoiceNo"]  || "",
    amount:      parseFloat(r["Amount"] || 0),
    status:      r["Status"]     || "Issued",   // "Issued" or "Cleared"
    clearedDate: r["ClearedDate"] || "",
    notes:       r["Notes"]      || "",
  })).filter(r => r.supplierID);
}

// ── MAIN DATA LOAD ───────────────────────────────────────────
async function loadData() {
  if (!CONFIG.sheetId || CONFIG.sheetId === "YOUR_GOOGLE_SHEET_ID_HERE") {
    console.warn("No Sheet ID configured — using sample data");
    document.getElementById("error-banner").classList.add("show");
    return SAMPLE_DATA;
  }

  try {
    const [suppRaw, invRaw, payRaw, pdcRaw] = await Promise.all([
      fetchSheet("suppliers", CONFIG.sheets.suppliers),
      fetchSheet("invoices",  CONFIG.sheets.invoices),
      fetchSheet("payments",  CONFIG.sheets.payments),
      fetchSheet("pdc",       CONFIG.sheets.pdc),
    ]);
    return {
      suppliers: mapSuppliers(suppRaw),
      invoices:  mapInvoices(invRaw),
      payments:  mapPayments(payRaw),
      pdc:       mapPDC(pdcRaw),
    };
  } catch (err) {
    console.error("Failed to load Google Sheets:", err);
    document.getElementById("error-banner").classList.add("show");
    return SAMPLE_DATA;
  }
}
