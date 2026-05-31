// ============================================================
//  data.js  —  Fetches data from Google Sheets (CSV export)
//  数据层  —  从 Google Sheet 获取数据
// ============================================================

const SAMPLE_DATA = {
  suppliers: [
    { id:"S001", name:"ABC Trading Co.",        nameCN:"ABC贸易有限公司",  contact:"0123456789" },
    { id:"S002", name:"XYZ Supply Sdn Bhd",     nameCN:"XYZ供应有限公司", contact:"0198765432" },
  ],
  invoices: [
    { supplierID:"S001", invoiceNo:"INV-001", date:"2024-11-01", dueDate:"2024-12-01", description:"Goods Purchase", amount:15000, balanceDue:15000 },
    { supplierID:"S002", invoiceNo:"INV-002", date:"2024-10-20", dueDate:"2024-11-20", description:"Raw Materials",  amount:45000, balanceDue:45000 },
  ],
  payments: [
    { supplierID:"S001", paymentNo:"PAY-001", date:"2025-01-05", method:"Bank Transfer", reference:"TRF001", invoiceNo:"INV-001", amount:5000, notes:"Partial" },
  ],
  pdc: []
};

// ── ROBUST CSV PARSER ────────────────────────────────────────
// Handles quoted fields that contain commas (e.g. "1,443,180.58")
function parseCSV(text) {
  const lines = text.trim().split(/\r?\n/);
  if (lines.length < 2) return [];

  function parseLine(line) {
    const fields = [];
    let cur = "", inQuote = false;
    for (let i = 0; i < line.length; i++) {
      const c = line[i];
      if (c === '"') {
        if (inQuote && line[i+1] === '"') { cur += '"'; i++; }
        else inQuote = !inQuote;
      } else if (c === ',' && !inQuote) {
        fields.push(cur); cur = "";
      } else {
        cur += c;
      }
    }
    fields.push(cur);
    return fields;
  }

  const headers = parseLine(lines[0]).map(h => h.trim());
  return lines.slice(1).map(line => {
    const vals = parseLine(line);
    const obj = {};
    headers.forEach((h, i) => { obj[h] = (vals[i] || "").trim(); });
    return obj;
  }).filter(row => Object.values(row).some(v => v !== ""));
}

// ── SAFE NUMBER PARSER ────────────────────────────────────────
function parseNum(val) {
  if (!val && val !== 0) return 0;
  // Remove currency symbols, spaces, commas then parse
  const cleaned = String(val).replace(/[^0-9.\-]/g, "");
  const n = parseFloat(cleaned);
  return isNaN(n) ? 0 : n;
}

// ── FETCH FROM GOOGLE SHEETS ────────────────────────────────
async function fetchSheet(sheetName, gid) {
  const url = `https://docs.google.com/spreadsheets/d/${CONFIG.sheetId}/gviz/tq?tqx=out:csv&gid=${gid}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status} for sheet ${sheetName}`);
  const text = await res.text();
  return parseCSV(text);
}

function mapSuppliers(rows) {
  return rows.map(r => ({
    id:      r["SupplierID"]     || r["supplierID"]     || "",
    name:    r["SupplierName"]   || r["supplierName"]   || "",
    nameCN:  r["SupplierNameCN"] || r["supplierNameCN"] || "",
    contact: r["Contact"]        || "",
  })).filter(r => r.id);
}

function mapInvoices(rows) {
  return rows.map(r => ({
    supplierID:  r["SupplierID"]  || r["supplierID"]  || "",
    invoiceNo:   r["InvoiceNo"]   || r["invoiceNo"]   || "",
    date:        r["Date"]        || r["date"]        || "",
    dueDate:     r["DueDate"]     || r["dueDate"]     || "",
    description: r["Description"] || r["description"] || "",
    amount:      parseNum(r["Amount"]     || r["amount"]),
    balanceDue:  parseNum(r["BalanceDue"] || r["balanceDue"]),
  })).filter(r => r.supplierID);
}

function mapPayments(rows) {
  return rows.map(r => ({
    supplierID: r["SupplierID"] || r["supplierID"] || "",
    paymentNo:  r["PaymentNo"] || r["paymentNo"]  || "",
    date:       r["Date"]      || r["date"]       || "",
    method:     r["Method"]    || r["method"]     || "",
    reference:  r["Reference"] || r["reference"]  || "",
    invoiceNo:  r["InvoiceNo"] || r["invoiceNo"]  || "",
    amount:     parseNum(r["Amount"] || r["amount"]),
    notes:      r["Notes"]     || r["notes"]      || "",
  })).filter(r => r.supplierID);
}

function mapPDC(rows) {
  return rows.map(r => ({
    supplierID:  r["SupplierID"]  || r["supplierID"]  || "",
    checkNo:     r["CheckNo"]     || r["checkNo"]     || "",
    issueDate:   r["IssueDate"]   || r["issueDate"]   || "",
    checkDate:   r["CheckDate"]   || r["checkDate"]   || "",
    bank:        r["Bank"]        || r["bank"]        || "",
    invoiceNo:   r["InvoiceNo"]   || r["invoiceNo"]   || "",
    amount:      parseNum(r["Amount"] || r["amount"]),
    status:      r["Status"]      || r["status"]      || "Issued",
    clearedDate: r["ClearedDate"] || r["clearedDate"] || "",
    notes:       r["Notes"]       || r["notes"]       || "",
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

    const result = {
      suppliers: mapSuppliers(suppRaw),
      invoices:  mapInvoices(invRaw),
      payments:  mapPayments(payRaw),
      pdc:       mapPDC(pdcRaw),
    };

    console.log("Loaded:", result.suppliers.length, "suppliers,",
      result.invoices.length, "invoices,",
      result.payments.length, "payments,",
      result.pdc.length, "PDC");

    return result;
  } catch (err) {
    console.error("Failed to load Google Sheets:", err);
    document.getElementById("error-banner").classList.add("show");
    return SAMPLE_DATA;
  }
}
