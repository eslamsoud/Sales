const fs = require('fs');

let c = fs.readFileSync('src/components/ManageTab.tsx', 'utf8');

const newGSCode = `function doPost(e) {
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var data = JSON.parse(e.postData.contents);
    
    if (data.type === 'تقرير_كامل') {
      
      // 1. الفواتير
      var invoicesSheet = ss.getSheetByName('الفواتير');
      if (!invoicesSheet) {
        invoicesSheet = ss.insertSheet('الفواتير');
        invoicesSheet.appendRow(['التاريخ', 'رقم الفاتورة', 'العميل', 'المنطقة', 'إجمالي الفاتورة', 'الملاحظات']);
        invoicesSheet.getRange(1, 1, 1, invoicesSheet.getLastColumn()).setFontWeight("bold").setBackground("#e0e0e0");
      }
      if (data.invoices && data.invoices.length > 0) {
        if (invoicesSheet.getLastRow() > 1) {
          invoicesSheet.getRange(2, 1, invoicesSheet.getLastRow() - 1, invoicesSheet.getLastColumn()).clearContent();
        }
        var invoiceRows = data.invoices.map(function(inv) {
          return [inv.date, inv.invNum, inv.customerName, inv.area, inv.total, inv.notes || ''];
        });
        invoicesSheet.getRange(2, 1, invoiceRows.length, invoiceRows[0].length).setValues(invoiceRows);
      }
      
      // 2. الماليات
      var expensesSheet = ss.getSheetByName('الماليات');
      if (!expensesSheet) {
        expensesSheet = ss.insertSheet('الماليات');
        expensesSheet.appendRow(['التاريخ', 'الفئة', 'المبلغ', 'البيان']);
        expensesSheet.getRange(1, 1, 1, expensesSheet.getLastColumn()).setFontWeight("bold").setBackground("#e0e0e0");
      }
      if (data.expenses && data.expenses.length > 0) {
        if (expensesSheet.getLastRow() > 1) {
          expensesSheet.getRange(2, 1, expensesSheet.getLastRow() - 1, expensesSheet.getLastColumn()).clearContent();
        }
        var expenseRows = data.expenses.map(function(exp) {
          return [exp.date, exp.category, exp.amount, exp.description || ''];
        });
        expensesSheet.getRange(2, 1, expenseRows.length, expenseRows[0].length).setValues(expenseRows);
      }

      // 3. المشاوير والتحصيل
      var tripsSheet = ss.getSheetByName('المشاوير');
      if (!tripsSheet) {
        tripsSheet = ss.insertSheet('المشاوير');
        tripsSheet.appendRow(['التاريخ', 'المنطقة', 'الأجرة', 'الحالة']);
        tripsSheet.getRange(1, 1, 1, tripsSheet.getLastColumn()).setFontWeight("bold").setBackground("#ffe599");
      }
      if (data.trips && data.trips.length > 0) {
        if (tripsSheet.getLastRow() > 1) {
          tripsSheet.getRange(2, 1, tripsSheet.getLastRow() - 1, tripsSheet.getLastColumn()).clearContent();
        }
        var tripRows = data.trips.map(function(t) {
          return [t.date, t.area, t.price, t.status];
        });
        tripsSheet.getRange(2, 1, tripRows.length, tripRows[0].length).setValues(tripRows);
      }

      // 4. العملاء
      var customersSheet = ss.getSheetByName('العملاء');
      if (!customersSheet) {
        customersSheet = ss.insertSheet('العملاء');
        customersSheet.appendRow(['اسم العميل', 'رقم الهاتف', 'المنطقة']);
        customersSheet.getRange(1, 1, 1, customersSheet.getLastColumn()).setFontWeight("bold").setBackground("#d9ead3");
      }
      if (data.customers && data.customers.length > 0) {
        if (customersSheet.getLastRow() > 1) {
          customersSheet.getRange(2, 1, customersSheet.getLastRow() - 1, customersSheet.getLastColumn()).clearContent();
        }
        var currRows = data.customers.map(function(c) {
          return [c.name, c.phone, c.area];
        });
        customersSheet.getRange(2, 1, currRows.length, currRows[0].length).setValues(currRows);
      }

      // 5. المنتجات
      var productsSheet = ss.getSheetByName('المنتجات');
      if (!productsSheet) {
        productsSheet = ss.insertSheet('المنتجات');
        productsSheet.appendRow(['الماركة والصنف', 'سعر الشراء الإداري', 'عدد الأوزان المتاحة']);
        productsSheet.getRange(1, 1, 1, productsSheet.getLastColumn()).setFontWeight("bold").setBackground("#cfe2f3");
      }
      if (data.products && data.products.length > 0) {
        if (productsSheet.getLastRow() > 1) {
          productsSheet.getRange(2, 1, productsSheet.getLastRow() - 1, productsSheet.getLastColumn()).clearContent();
        }
        var pRows = data.products.map(function(p) {
          return [p.name, p.purchasingPrice, p.count];
        });
        productsSheet.getRange(2, 1, pRows.length, pRows[0].length).setValues(pRows);
      }
      
      // 6. الملخص
      var summarySheet = ss.getSheetByName('الملخص');
      if (!summarySheet) {
        summarySheet = ss.insertSheet('الملخص');
        summarySheet.appendRow(['تاريخ المزامنة', 'إجمالي المبيعات', 'المنصرف والمصروفات', 'صافي الأرباح']);
        summarySheet.getRange(1, 1, 1, summarySheet.getLastColumn()).setFontWeight("bold").setBackground("#d9ead3");
      }
      
      if (data.metadata) {
        if (summarySheet.getLastRow() > 1) {
           summarySheet.getRange(2, 1, summarySheet.getLastRow() - 1, summarySheet.getLastColumn()).clearContent();
        }
        summarySheet.appendRow([data.metadata.syncedAt, data.metadata.totalSales, data.metadata.totalExpenses, data.metadata.netProfit]);
      }
      
      return ContentService.createTextOutput(JSON.stringify({"status": "success"})).setMimeType(ContentService.MimeType.JSON);
    }
    
    return ContentService.createTextOutput(JSON.stringify({"status": "ignored", "message": "Unknown payload."})).setMimeType(ContentService.MimeType.JSON);
    
  } catch(error) {
    return ContentService.createTextOutput(JSON.stringify({"error": error.toString()})).setMimeType(ContentService.MimeType.JSON);
  }
}`;

let str1 = 'const scriptCode = `function doPost(e) {\\n  try {';
let idx1 = c.indexOf(str1);

let endStr1 = '}`;\\n                            navigator.clipboard.writeText(scriptCode);';
let endIdx1 = c.indexOf(endStr1, idx1);

if (idx1 !== -1 && endIdx1 !== -1) {
  c = c.substring(0, idx1) + 'const scriptCode = `' + newGSCode + '`;\n                            navigator.clipboard.writeText(scriptCode);' + c.substring(endIdx1 + endStr1.length);
}

// Second replacement for the visual preview block
let str2 = '{`function doPost(e) {\\n  try {';
let idx2 = c.indexOf(str2);

let endStr2 = '}`}';
let endIdx2 = c.indexOf(endStr2, idx2);

if(idx2 !== -1 && endIdx2 !== -1) {
  c = c.substring(0, idx2) + '={`' + newGSCode + '`}' + c.substring(endIdx2 + endStr2.length);
}

fs.writeFileSync('src/components/ManageTab.tsx', c);
