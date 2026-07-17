// 🛡️ دوال مساعدة عامة مطورة ومقفلة بالكامل على توقيت مصر (تمنع فجوة الـ 3 ساعات نهائياً)

var EGYPT_TZ = 'Africa/Cairo';

function nowEgyptISO() {
  return Utilities.formatDate(new Date(), EGYPT_TZ, "yyyy-MM-dd'T'HH:mm:ss");
}

function todayEgyptISO() {
  return Utilities.formatDate(new Date(), EGYPT_TZ, 'yyyy-MM-dd');
}

function getSafeString(val) {
  if (val instanceof Date) {
    return Utilities.formatDate(val, EGYPT_TZ, "yyyy-MM-dd'T'HH:mm:ss");
  }
  
  var str = String(val !== undefined && val !== null ? val : '').trim();
  
  var utcPattern = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?Z$/;
  var utcPatternShort = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/;
  
  if (utcPattern.test(str) || utcPatternShort.test(str)) {
    try {
      var dateObj = new Date(str);
      if (!isNaN(dateObj.getTime())) {
        return Utilities.formatDate(dateObj, EGYPT_TZ, "yyyy-MM-dd'T'HH:mm:ss");
      }
    } catch(err) {}
  }
  
  return str;
}

function getSafeNumber(val) {
  var n = Number(val);
  return isNaN(n) ? 0 : n;
}

function formatPhone(val) {
  var p = String(val !== undefined && val !== null ? val : '')
    .replace(/^'/, '').replace(/\s+/g, '').replace(/[^\d]/g, '');
  if (p.startsWith('0020')) p = p.substring(4);
  if (p.startsWith('20') && p.length > 10) p = p.substring(2);
  if (!p.startsWith('0') && p.length >= 7) p = '0' + p;
  return p;
}

function getSafePhone(val) {
  return formatPhone(val);
}

function doGet(e) {
  try {
    var SHEET_URL = ""; 
    var ss;
    try {
      ss = SHEET_URL ? SpreadsheetApp.openByUrl(SHEET_URL) : SpreadsheetApp.getActiveSpreadsheet();
    } catch(err) {
      ss = SpreadsheetApp.getActiveSpreadsheet();
    }

    var tParam = e && e.parameter && e.parameter.t ? String(e.parameter.t) : '';
    var shouldCache = !tParam;

    var cache = CacheService.getScriptCache();
    var cacheKey = "doGet_result_" + ss.getId();
    if (shouldCache) {
      var cached = cache.get(cacheKey);
      if (cached) {
        return ContentService.createTextOutput(cached)
          .setMimeType(ContentService.MimeType.JSON);
      }
    }

    var result = {};
    
    function safeGetSheetData(sheetName, mapFn) {
      var sheet = ss.getSheetByName(sheetName);
      if (!sheet || sheet.getLastRow() <= 1) return [];
      var data = sheet.getRange(2, 1, sheet.getLastRow() - 1, sheet.getLastColumn()).getValues();
      return data.filter(function(row) { 
        if (!row || row.length === 0) return false;
        for (var i = 0; i < row.length; i++) {
          if (getSafeString(row[i]) !== '') return true;
        }
        return false;
      }).map(mapFn);
    }

    function mapInvoiceRow(row) {
      var items = [];
      var invId = getSafeString(row[0]);
      if (!invId) invId = 'inv-fix-' + getSafeString(row[2]) + '-' + getSafePhone(row[10]);
      try { items = JSON.parse(row[9]); } catch(e) { items = []; }
      return { 
        id: invId, date: getSafeString(row[1]), invoiceNumber: getSafeString(row[2]),
        customerName: getSafeString(row[3]), area: getSafeString(row[4]), total: getSafeNumber(row[5]), 
        paidAmount: row[6] !== '' ? getSafeNumber(row[6]) : 0, 
        delegateName: getSafeString(row[7]).replace(/\s*\(.*?\)/g, '').trim(), notes: getSafeString(row[8]),
        items: items, delegatePhone: getSafePhone(row[10]),
        customerId: getSafeString(row[11]),
        totalBeforeDiscount: getSafeNumber(row[12]) || getSafeNumber(row[5]),
        isDelivered: (row[13] === '' || row[13] === undefined) ? true : (row[13] === 'true' || row[13] === true),
        archivedAt: getSafeString(row[16]),
        archived: row[17] === 'نعم' || row[17] === true,
        isArchived: row[18] === 'نعم' || row[18] === true
      };
    }

    var activeInvoices = safeGetSheetData('الفواتير', mapInvoiceRow);
    var archivedInvoices = safeGetSheetData('أرشيف السداد', mapInvoiceRow);
    result.invoices = activeInvoices.concat(archivedInvoices);

    result.expenses = safeGetSheetData('الماليات', function(row) {
      var expId = getSafeString(row[0]);
      if (!expId || !expId.includes('-')) expId = 'exp-fix-' + getSafeNumber(row[4]) + '-' + getSafeString(row[2]);
      return { 
        id: expId, date: getSafeString(row[1]), category: getSafeString(row[2]), 
        type: getSafeString(row[3]), amount: getSafeNumber(row[4]), description: getSafeString(row[5]),
        delegateName: getSafeString(row[6]).replace(/\s*\(.*?\)/g, '').trim(), delegatePhone: getSafePhone(row[7]),
        archivedAt: getSafeString(row[8]),
        archived: row[9] === 'نعم' || row[9] === true,
        isArchived: row[10] === 'نعم' || row[10] === true
      };
    });

    result.trips = safeGetSheetData('المشاوير', function(row) {
      var tripId = getSafeString(row[0]);
      if (!tripId) tripId = 'trip-fix-' + getSafeNumber(row[3]) + '-' + getSafeString(row[2]);
      return { 
        id: tripId, date: getSafeString(row[1]), description: getSafeString(row[2]), 
        price: getSafeNumber(row[3]), status: getSafeString(row[4]),
        delegateName: getSafeString(row[5]).replace(/\s*\(.*?\)/g, '').trim(), delegatePhone: getSafePhone(row[6]),
        odometerStart: row[7] !== '' ? getSafeNumber(row[7]) : undefined, odometerEnd: row[8] !== '' ? getSafeNumber(row[8]) : undefined
      };
    });

    result.customers = safeGetSheetData('العملاء', function(row) {
      var custId = getSafeString(row[0]);
      if (!custId) custId = 'cust-fix-' + getSafePhone(row[4]);
      return { 
        id: custId, governorate: getSafeString(row[1]), area: getSafeString(row[2]), 
        name: getSafeString(row[3]), detailedAddress: getSafeString(row[5]), 
        locationLink: getSafeString(row[6]), purchasesCount: getSafeNumber(row[7]), phone: getSafePhone(row[4]),
        salesManager: getSafeString(row[8]), totalSpent: getSafeNumber(row[9]),
        lastPurchaseDate: getSafeString(row[10])
      };
    });

    var newProductsSheet = ss.getSheetByName('الأصناف_والأوزان');
    result.flatProducts = [];
    if (newProductsSheet && newProductsSheet.getLastRow() > 1) {
      var headers = newProductsSheet.getRange(1, 1, 1, newProductsSheet.getLastColumn()).getValues()[0];
      var hasRetailCarton = headers.indexOf('سعر بيع الكرتونة') !== -1;
      var pData = newProductsSheet.getRange(2, 1, newProductsSheet.getLastRow() - 1, newProductsSheet.getLastColumn()).getValues();
      result.flatProducts = pData.filter(function(row) { 
        if (!row || row.length === 0) return false;
        for (var i = 0; i < Math.min(row.length, 4); i++) {
          if (getSafeString(row[i]) !== '') return true;
        }
        return false;
      }).map(function(row) {
        return { 
          weightId: getSafeString(row[0]), productId: getSafeString(row[1]), productName: getSafeString(row[2]),
          size: getSafeString(row[3]), cartonPriceFromFactory: getSafeNumber(row[4]),
          unitsPerCarton: getSafeNumber(row[5]) || 1, factoryPricePerUnit: getSafeNumber(row[6]),
          addedValue: getSafeNumber(row[7]), retailPricePerUnit: getSafeNumber(hasRetailCarton ? row[9] : row[8]),
          barcode: getSafeString(hasRetailCarton ? row[10] : row[9])
        };
      });
    }

    var factorySheet = ss.getSheetByName('المصنع');
    result.factoryLoads = [];
    if (factorySheet && factorySheet.getLastRow() > 1) {
      var fHeaders = factorySheet.getRange(1, 1, 1, factorySheet.getLastColumn()).getValues()[0];
      var hasIds = fHeaders.indexOf('معرف الصنف') !== -1;
      var fData = factorySheet.getRange(2, 1, factorySheet.getLastRow() - 1, factorySheet.getLastColumn()).getValues();
      result.factoryLoads = fData.filter(function(row) { 
        if (!row || row.length === 0) return false;
        for (var i = 0; i < Math.min(row.length, 5); i++) {
          if (getSafeString(row[i]) !== '') return true;
        }
        return false;
      }).map(function(row) {
        var loadId = getSafeString(row[0]);
        if (!loadId) loadId = 'load-fix-' + getSafeString(row[2]) + '-' + getSafeString(row[1]);
        if (hasIds) {
          return { 
            id: loadId, date: getSafeString(row[1]), productId: getSafeString(row[2]),
            weightId: getSafeString(row[3]), productName: getSafeString(row[4]), weightSize: getSafeString(row[5]), 
            cartonsCount: getSafeNumber(row[6]), quantity: getSafeNumber(row[7]), 
            advanceAmount: getSafeNumber(row[8]), warehouseKeeper: getSafeString(row[9]),
            delegateName: getSafeString(row[10]).replace(/\s*\(.*?\)/g, '').trim(), delegatePhone: getSafePhone(row[11]),
            cartonPrice: getSafeNumber(row[12]), unitPrice: getSafeNumber(row[13]),
            archivedAt: getSafeString(row[14]),
            archived: row[15] === 'نعم' || row[15] === true,
            isArchived: row[16] === 'نعم' || row[16] === true
          };
        } else {
          return { 
            id: loadId, date: getSafeString(row[1]), productId: '', weightId: '',
            productName: getSafeString(row[2]), weightSize: getSafeString(row[3]), cartonsCount: getSafeNumber(row[4]), 
            quantity: getSafeNumber(row[5]), advanceAmount: getSafeNumber(row[6]),
            warehouseKeeper: getSafeString(row[7]), delegateName: getSafeString(row[8]).replace(/\s*\(.*?\)/g, '').trim(), delegatePhone: getSafePhone(row[9])
          };
        }
      });
    }

    result.users = safeGetSheetData('صلاحيات_المستخدمين', function(row) {
      var phoneStr = getSafePhone(row[0]);
      return { 
        phone: phoneStr, name: getSafeString(row[1]), role: getSafeString(row[2]), status: getSafeString(row[3]), 
        password: getSafeString(row[4]).replace(/^'/, ''), customRoleName: getSafeString(row[5]), 
        permittedTabs: getSafeString(row[6]), permittedSubTabs: getSafeString(row[7]),
        canEditPrices: row[8] === 'لا' ? false : true,
        lastActive: getSafeString(row[9]), 
        lastLat: getSafeNumber(row[10]), 
        lastLng: getSafeNumber(row[11]),
        canUseAiAssistant: row[12] === 'لا' ? false : true,
        canApplyDiscount: row[13] === 'لا' ? false : true,
        maxDiscountPercentOfProfit: row[14] !== undefined && row[14] !== '' ? getSafeNumber(row[14]) : 100,
        maxExtraDiscountAmount: row[15] !== undefined && row[15] !== '' ? getSafeNumber(row[15]) : undefined,
        workArea: getSafeString(row[16]) || 'الكل'
      };
    });

    result.discoveredLeads = safeGetSheetData('عملاء_مكتشفين', function(row) {
      return { 
        id: getSafeString(row[0]), governorate: getSafeString(row[1]), area: getSafeString(row[2]), 
        name: getSafeString(row[3]), phone: getSafePhone(row[4]), detailedAddress: getSafeString(row[5]), 
        locationLink: getSafeString(row[6]), type: getSafeString(row[7]), dateAdded: getSafeString(row[8])
      };
    });

    result.potentialLeads = safeGetSheetData('عملاء_محتملين', function(row) {
      return { 
        id: getSafeString(row[0]), governorate: getSafeString(row[1]), area: getSafeString(row[2]), 
        name: getSafeString(row[3]), phone: getSafePhone(row[4]), detailedAddress: getSafeString(row[5]), 
        locationLink: getSafeString(row[6]), type: getSafeString(row[7]), dateAdded: getSafeString(row[8])
      };
    });

    result.factoryArchiveCycles = safeGetSheetData('أرشيف_دورات_المصنع', function(row) {
      var loads = [];
      var payments = [];
      try { loads = JSON.parse(getSafeString(row[9])); } catch(e) { loads = []; }
      try { payments = JSON.parse(getSafeString(row[10])); } catch(e) { payments = []; }
      return {
        id: getSafeString(row[0]), settledAt: getSafeString(row[1]),
        settledFully: getSafeString(row[2]) === 'نعم',
        rawLoadedValue: getSafeNumber(row[3]), totalWithdrawnValue: getSafeNumber(row[4]),
        totalAdvancePayments: getSafeNumber(row[5]), creditBalance: getSafeNumber(row[6]),
        carriedOverDebtAtTime: getSafeNumber(row[7]), waivedAmount: getSafeNumber(row[8]),
        loads: loads, payments: payments,
        delegatePhone: getSafePhone(row[11]), delegateName: getSafeString(row[12]),
        amountPaidInSettlement: getSafeNumber(row[13]),
        amountCarriedOver: getSafeNumber(row[14]),
        settlementReason: getSafeString(row[15])
      };
    });

    result.returns = safeGetSheetData('المرتجعات', function(row) {
      var items = [];
      try { items = JSON.parse(getSafeString(row[10])); } catch(e) { items = []; }
      var exchangeProduct = null;
      try { exchangeProduct = JSON.parse(getSafeString(row[13])); } catch(e) { exchangeProduct = null; }
      return {
        id: getSafeString(row[0]), date: getSafeString(row[1]),
        invoiceId: getSafeString(row[2]), invoiceNumber: getSafeString(row[3]),
        customerId: getSafeString(row[4]), customerName: getSafeString(row[5]),
        delegatePhone: getSafePhone(row[6]), delegateName: getSafeString(row[7]),
        movementType: getSafeString(row[8]), totalReturnValue: getSafeNumber(row[9]),
        items: items, notes: getSafeString(row[11]),
        exchangeDifference: getSafeNumber(row[12]),
        exchangeProduct: exchangeProduct,
        exchangeSettlementMethod: getSafeString(row[14]),
        archivedAt: getSafeString(row[15]),
        archived: row[16] === 'نعم' || row[16] === true,
        isArchived: row[17] === 'نعم' || row[17] === true
      };
    });

    var dbVersion = PropertiesService.getScriptProperties().getProperty('dbVersion');
    if (dbVersion) result.dbVersion = Number(dbVersion);

    tParam = e && e.parameter && e.parameter.t ? String(e.parameter.t) : '';
    shouldCache = !tParam;
    if (shouldCache) {
      try { cache.put(cacheKey, JSON.stringify(result), 15); } catch(ce) {}
    }

    return ContentService.createTextOutput(JSON.stringify(result))
      .setMimeType(ContentService.MimeType.JSON);
  } catch(error) {
    Logger.log('FATAL doGet ERROR: ' + error.toString() + ' Stack: ' + error.stack);
    return ContentService.createTextOutput(JSON.stringify({"error": error.toString(), "stack": error.stack}))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

function doPost(e) {
  try {
    Logger.log("Incoming doPost request. Payload size: " + (e && e.postData && e.postData.contents ? e.postData.contents.length : 0) + " characters.");
  } catch(logErr) {}
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(45000);
    
    var SHEET_URL = "";
    var data = JSON.parse(e.postData.contents);
    var isOwner = data.syncRole === 'owner' 
      || data.syncPhone === '01228466613' 
      || (data.customRoleName && (data.customRoleName.includes('نائب المدير') || data.customRoleName.includes('مشرف عام')));
    var canEditPrices = data.canEditPrices === true || isOwner;
    
    var ss;
    try {
      ss = SHEET_URL ? SpreadsheetApp.openByUrl(SHEET_URL) : SpreadsheetApp.getActiveSpreadsheet();
    } catch(err) {
      ss = SpreadsheetApp.getActiveSpreadsheet();
    }
    try { CacheService.getScriptCache().remove("doGet_result_" + ss.getId()); } catch(ce) {}
    
    if (data.type === 'auto_backup') {
      try {
        var folderName = "نسخ_نظام_سوفانا_الاحتياطية";
        var folders = DriveApp.getFoldersByName(folderName);
        var folder = folders.hasNext() ? folders.next() : DriveApp.createFolder(folderName);
        var dateStr = todayEgyptISO();
        var fileName = "EAGS_Backup_" + dateStr + "_" + (data.syncPhone || "admin") + ".json";
        folder.createFile(fileName, JSON.stringify(data.data, null, 2), MimeType.PLAIN_TEXT);
        return ContentService.createTextOutput(JSON.stringify({"status": "backup_success"}))
          .setMimeType(ContentService.MimeType.JSON);
      } catch(backupError) {
        return ContentService.createTextOutput(JSON.stringify({"error": backupError.toString()}))
          .setMimeType(ContentService.MimeType.JSON);
      }
    }

    // 🛡️ قراءة المعرفات الحالية من الشيت لمنع الحذف بالخطأ
    function getExistingIds(sheetName) {
      var sheet = ss.getSheetByName(sheetName);
      if (!sheet || sheet.getLastRow() <= 1) return [];
      var colA = sheet.getRange(2, 1, sheet.getLastRow() - 1, 1).getValues();
      var ids = [];
      for (var i = 0; i < colA.length; i++) {
        var id = String(colA[i][0]).replace(/^'/, '').trim();
        if (id) {
          if (id.length === 10 && id.indexOf('1') === 0) id = '0' + id;
          ids.push(id);
        }
      }
      return ids;
    }

    function upsertData(sheetName, headers, dataRows, headerColor) {
      var sheet = ss.getSheetByName(sheetName);
      if (!sheet) {
        sheet = ss.insertSheet(sheetName);
      }
      
      // 🛡️ حماية حاسمة: إذا البيانات الواردة فارغة، لا تحذف شيئاً من الشيت
      if (!dataRows || dataRows.length === 0) {
        Logger.log('⛔ upsertData SKIPPED for ' + sheetName + ': incoming dataRows is empty — preserving existing rows');
        return;
      }
      
      var finalData = [headers];
      for (var j = 0; j < dataRows.length; j++) {
        var row = dataRows[j];
        if (!row || row.length === 0) continue;
        var paddedRow = [];
        for (var col = 0; col < headers.length; col++) {
          paddedRow.push(row[col] !== undefined ? row[col] : '');
        }
        finalData.push(paddedRow);
      }

      if (sheet.getMaxColumns() < headers.length) {
        sheet.insertColumnsAfter(sheet.getMaxColumns(), headers.length - sheet.getMaxColumns());
      }

      var existingRowCount = sheet.getLastRow();
      if (sheet.getMaxRows() < finalData.length) {
        sheet.insertRowsAfter(sheet.getMaxRows(), finalData.length - sheet.getMaxRows());
      }

      // 📝 الكتابة المباشرة — استبدال كامل (البيانات المحذوفة من الـ app مش بتترسل فتمسح من الشيت)
      sheet.getRange(1, 1, finalData.length, headers.length).setValues(finalData);
      if (existingRowCount > finalData.length) {
        sheet.getRange(finalData.length + 1, 1, existingRowCount - finalData.length, headers.length).clearContent();
      }
      sheet.getRange(1, 1, 1, headers.length).setFontWeight("bold").setBackground(headerColor || "#cfe2f3");
      
      if (sheet.getFilter() === null) {
        try { sheet.getDataRange().createFilter(); } catch(fe) {}
      }
    }

    if (data.type === 'تقرير_كامل') {

      // 🛡️ حماية شاملة: إذا جميع الجداول فارغة، لا تتم المزامنة
      var totalRows = (data.invoices || []).length + (data.expenses || []).length + 
                      (data.trips || []).length + (data.customers || []).length + 
                      (data.factoryLoads || []).length + (data.products || []).length +
                      (data.returns || []).length;
      if (totalRows === 0) {
        Logger.log('⛔ doPost BLOCKED: All data arrays are empty — refusing to overwrite sheets');
        return ContentService.createTextOutput(JSON.stringify({"status": "blocked", "message": "All data arrays empty — sheets preserved"}))
          .setMimeType(ContentService.MimeType.JSON);
      }
      
      var currentDbVersion = PropertiesService.getScriptProperties().getProperty('dbVersion');
      if (data.dbVersion !== undefined && data.dbVersion !== null && 
          (!currentDbVersion || Number(data.dbVersion) > Number(currentDbVersion))) {
        PropertiesService.getScriptProperties().setProperty('dbVersion', data.dbVersion.toString());
      }
      
      var activeInvRows = [];
      var archivedInvRows = [];
      
      (data.invoices || []).forEach(function(inv) { 
        var isDel = inv.hasOwnProperty('isDelivered') ? inv.isDelivered : true;
        var remaining = Math.max(0, (Number(inv.total) || 0) - (Number(inv.paidAmount) || 0));
        var paymentStatus = remaining > 0 ? 'مديونية ⚠️' : 'خالصة ✅';
        
        var rowData = [
          inv.id, inv.date, inv.invNum, inv.customerName, inv.area, 
          inv.total, inv.paidAmount, inv.delegateName, inv.notes || '',
          JSON.stringify(inv.items || []), formatPhone(inv.delegatePhone),
          inv.customerId || '', inv.totalBeforeDiscount || inv.total || 0, isDel ? 'true' : 'false', remaining, paymentStatus,
          inv.archivedAt || '', inv.archived ? 'نعم' : 'لا', inv.isArchived ? 'نعم' : 'لا'
        ]; 
        
        if (remaining === 0 && isDel) {
           archivedInvRows.push(rowData);
        } else {
           activeInvRows.push(rowData);
        }
      });
      
      try {
        upsertData('الفواتير', ['المعرف', 'التاريخ', 'رقم الفاتورة', 'العميل', 'المنطقة', 'إجمالي الفاتورة', 'المدفوع', 'المندوب', 'الملاحظات', 'التفاصيل (JSON)', 'هاتف المندوب', 'معرف العميل', 'الإجمالي قبل الخصم', 'تم التسليم', 'المتبقي (المديونية)', 'حالة السداد', 'تاريخ الأرشفة', 'مؤرشف مالي', 'مؤرشف بالكامل'], activeInvRows, "#cfe2f3");
      } catch(err) { Logger.log('Error upserting الفواتير: ' + err); }
      
      try {
        upsertData('أرشيف السداد', ['المعرف', 'التاريخ', 'رقم الفاتورة', 'العميل', 'المنطقة', 'إجمالي الفاتورة', 'المدفوع', 'المندوب', 'الملاحظات', 'التفاصيل (JSON)', 'هاتف المندوب', 'معرف العميل', 'الإجمالي قبل الخصم', 'تم التسليم', 'المتبقي (المديونية)', 'حالة السداد', 'تاريخ الأرشفة', 'مؤرشف مالي', 'مؤرشف بالكامل'], archivedInvRows, "#d9ead3");
      } catch(err) { Logger.log('Error upserting أرشيف السداد: ' + err); }
      
      var expRows = (data.expenses || []).map(function(exp) { 
        return [
          exp.id, exp.date, exp.category, exp.type || 'expense',
          exp.amount, exp.description || '', exp.delegateName || '',
          formatPhone(exp.delegatePhone),
          exp.archivedAt || '', exp.archived ? 'نعم' : 'لا', exp.isArchived ? 'نعم' : 'لا'
        ]; 
      });
      try {
        upsertData('الماليات', ['المعرف', 'التاريخ', 'الفئة', 'النوع', 'المبلغ', 'البيان', 'المندوب', 'هاتف المندوب', 'تاريخ الأرشفة', 'مؤرشف مالي', 'مؤرشف بالكامل'], expRows, "#e0e0e0");
      } catch(err) { Logger.log('Error upserting الماليات: ' + err); }

      var tripRows = (data.trips || []).map(function(t) { 
        return [
          t.id, t.date, t.description || '', t.price, t.status,
          t.delegateName || '', formatPhone(t.delegatePhone),
          t.odometerStart || '', t.odometerEnd || ''
        ]; 
      });
      try {
        upsertData('المشاوير', ['المعرف', 'التاريخ', 'البيان', 'الأجرة', 'الحالة', 'المندوب', 'هاتف المندوب', 'عداد البداية', 'عداد النهاية'], tripRows, "#ffe599");
      } catch(err) { Logger.log('Error upserting المشاوير: ' + err); }

      var custRows = (data.customers || []).map(function(c) { 
        return [
          c.id, c.governorate || '', c.area || '', c.name || '', 
          formatPhone(c.phone), c.detailedAddress || '', c.locationLink || '', 
          c.purchasesCount || 0, c.salesManager || '', c.totalSpent || 0, c.lastPurchaseDate || ''
        ]; 
      });
      try {
        upsertData('العملاء', ['المعرف', 'المحافظة', 'المنطقة', 'اسم العميل', 'رقم الهاتف', 'العنوان', 'رابط جوجل ماب', 'عدد المشتريات', 'مدير البيع', 'إجمالي المسحوبات', 'آخر شراء'], custRows, "#d9ead3");
      } catch(err) { Logger.log('Error upserting العملاء: ' + err); }

      if (canEditPrices) {
        var prodRows = [];
        (data.products || []).forEach(function(p) { 
          if (p.weights && p.weights.length > 0) {
            p.weights.forEach(function(w) {
              var retailCarton = (Number(w.cartonPriceFromFactory) || 0) + (Number(w.addedValue) || 0);
              prodRows.push([
                w.id, p.id, p.name, w.size || 'كرتونة', w.cartonPriceFromFactory || 0,
                w.unitsPerCarton || 1, w.factoryPricePerUnit || 0, w.addedValue || 0,
                retailCarton, w.retailPricePerUnit || 0, String(w.barcode || '')
              ]);
            });
          }
        });
        try {
          upsertData('الأصناف_والأوزان', ['معرف الوزن (لا تحذفه)', 'معرف الصنف', 'اسم الصنف', 'الحجم/الوزن', 'سعر الكرتونة', 'العدد بالكرتونة', 'سعر العبوة (مصنع)', 'القيمة المضافة', 'سعر بيع الكرتونة', 'سعر بيع العبوة', 'الباركود'], prodRows, "#cfe2f3");
        } catch(err) { Logger.log('Error upserting الأصناف: ' + err); }
      }
      
      var factoryRows = (data.factoryLoads || []).map(function(fl) { 
        return [
          fl.id, fl.date, fl.productId || '', fl.weightId || '', fl.productName, 
          fl.weightSize || 'كرتونة', fl.cartonsCount || 0, fl.quantity || 0, 
          fl.advanceAmount || 0, fl.warehouseKeeper || '', fl.delegateName || '',
          formatPhone(fl.delegatePhone), fl.cartonPrice || 0, fl.unitPrice || 0,
          fl.archivedAt || '', fl.archived ? 'نعم' : 'لا', fl.isArchived ? 'نعم' : 'لا'
        ]; 
      });
      try {
        upsertData('المصنع', ['المعرف', 'التاريخ', 'معرف الصنف', 'معرف الوزن', 'اسم الصنف', 'الحجم/الوزن', 'الكمية (كرتونة)', 'إجمالي الوحدات', 'مقدم المصنع', 'أمين المخزن', 'اسم المندوب', 'هاتف المندوب', 'سعر الكرتونة', 'سعر العبوة', 'تاريخ الأرشفة', 'مؤرشف مالي', 'مؤرشف بالكامل'], factoryRows, "#fce5cd");
      } catch(err) { Logger.log('Error upserting المصنع: ' + err); }

      if (isOwner) {
        var userRows = (data.users || []).map(function(u) { 
          return [
            formatPhone(u.phone), u.name, u.role, u.status, 
            String(u.password || ''), u.customRoleName || '', 
            u.permittedTabs || '', u.permittedSubTabs || '',
            u.canEditPrices === false ? 'لا' : 'نعم',
            u.lastActive || '', u.lastLat || '', u.lastLng || '',
            u.canUseAiAssistant === false ? 'لا' : 'نعم',
            u.canApplyDiscount === false ? 'لا' : 'نعم',
            u.maxDiscountPercentOfProfit !== undefined ? u.maxDiscountPercentOfProfit : 100,
            u.maxExtraDiscountAmount !== undefined ? u.maxExtraDiscountAmount : '',
            u.workArea || 'الكل'
          ]; 
        });
        try {
          upsertData('صلاحيات_المستخدمين', ['رقم الهاتف', 'الاسم', 'الدور/الوظيفة', 'الحالة', 'الرمز السري', 'المسمى الوظيفي', 'الصلاحيات المفعّلة', 'الصلاحيات الفرعية', 'تعديل الأسعار', 'آخر ظهور', 'خط العرض', 'خط الطول', 'المستشار الذكي', 'السماح بالخصم', 'أقصى خصم من الربح', 'أقصى مبلغ خصم إضافي', 'منطقة العمل'], userRows, "#ead1dc");
        } catch(err) { Logger.log('Error upserting صلاحيات: ' + err); }
      }

      var discoveredRows = (data.discoveredLeads || []).map(function(l) { 
        return [
          l.id, l.governorate || '', l.area || '', l.name || '', 
          formatPhone(l.phone), l.detailedAddress || '', l.locationLink || '',
          l.type || '', l.dateAdded || ''
        ]; 
      });
      try {
        upsertData('عملاء_مكتشفين', ['المعرف', 'المحافظة', 'المنطقة', 'اسم العميل', 'رقم الهاتف', 'العنوان', 'رابط جوجل ماب', 'النشاط', 'تاريخ الإضافة'], discoveredRows, "#fff2cc");
      } catch(err) { Logger.log('Error upserting عملاء_مكتشفين: ' + err); }

      var potentialRows = (data.potentialLeads || []).map(function(l) { 
        return [
          l.id, l.governorate || '', l.area || '', l.name || '', 
          formatPhone(l.phone), l.detailedAddress || '', l.locationLink || '',
          l.type || '', l.dateAdded || ''
        ]; 
      });
      try {
        upsertData('عملاء_محتملين', ['المعرف', 'المحافظة', 'المنطقة', 'اسم العميل', 'رقم الهاتف', 'العنوان', 'رابط جوجل ماب', 'النشاط', 'تاريخ الإضافة'], potentialRows, "#d9ead3");
      } catch(err) { Logger.log('Error upserting عملاء_محتملين: ' + err); }

      var archiveRows = (data.factoryArchiveCycles || []).map(function(c) {
        return [
          c.id || '', c.settledAt || '', c.settledFully ? 'نعم' : 'لا',
          c.rawLoadedValue || 0, c.totalWithdrawnValue || 0,
          c.totalAdvancePayments || 0, c.creditBalance || 0,
          c.carriedOverDebtAtTime || 0, c.waivedAmount || 0,
          JSON.stringify(c.loads || []), JSON.stringify(c.payments || []),
          c.delegatePhone || '', c.delegateName || '',
          c.amountPaidInSettlement || 0, c.amountCarriedOver || 0,
          c.settlementReason || ''
        ];
      });
      try {
        upsertData('أرشيف_دورات_المصنع', ['معرف الدورة', 'تاريخ الترحيل', 'تم التسديد بالكامل', 'قيمة المحمل الخام', 'إجمالي المحمل', 'إجمالي المسدد', 'الرصيد الدائن', 'دين من دورة سابقة', 'مبلغ متنازل عنه', 'الحمولات (JSON)', 'الدفعات (JSON)', 'هاتف المندوب', 'اسم المندوب', 'المبلغ المسدد عند التسويه', 'المبلغ المرحل للدورة القادمة', 'سبب الترحيل والتسويه'], archiveRows, "#b4a7d6");
      } catch(err) { Logger.log('Error upserting أرشيف_دورات_المصنع: ' + err); }

      var returnRows = (data.returns || []).map(function(r) {
        return [
          r.id || '', r.date || '', r.invoiceId || '', r.invoiceNumber || '',
          r.customerId || '', r.customerName || '',
          formatPhone(r.delegatePhone), r.delegateName || '',
          r.movementType || '', r.totalReturnValue || 0,
          JSON.stringify(r.items || []), r.notes || '',
          r.exchangeDifference || 0,
          r.exchangeProduct ? JSON.stringify(r.exchangeProduct) : '',
          r.exchangeSettlementMethod || '',
          r.archivedAt || '', r.archived ? 'نعم' : 'لا', r.isArchived ? 'نعم' : 'لا'
        ];
      });
      try {
        upsertData('المرتجعات', ['المعرف', 'التاريخ', 'معرف الفاتورة', 'رقم الفاتورة', 'معرف العميل', 'اسم العميل', 'هاتف المندوب', 'اسم المندوب', 'نوع الحركة', 'إجمالي المرتجع', 'التفاصيل (JSON)', 'ملاحظات', 'فرق السعر', 'الصنف البديل (JSON)', 'طريقة تسويه الفرق', 'تاريخ الأرشفة', 'مؤرشف مالي', 'مؤرشف بالكامل'], returnRows, "#ea9999");
      } catch(err) { Logger.log('Error upserting المرتجعات: ' + err); }

      var summarySheet = ss.getSheetByName('الملخص');
      if (!summarySheet) {
        summarySheet = ss.insertSheet('الملخص');
        summarySheet.getRange(1, 1, 2, 4).setValues([
          ['تاريخ المزامنة', 'إجمالي المبيعات', 'المنصرف والمصروفات', 'صافي الأرباح'],
          [data.metadata ? data.metadata.syncedAt : nowEgyptISO(), data.metadata ? (Number(data.metadata.totalSales) || 0) : 0, data.metadata ? (Number(data.metadata.totalExpenses) || 0) : 0, data.metadata ? (Number(data.metadata.netProfit) || 0) : 0]
        ]);
      } else {
        summarySheet.getRange(1, 1, 2, 4).setValues([
          ['تاريخ المزامنة', 'إجمالي المبيعات', 'المنصرف والمصروفات', 'صافي الأرباح'],
          [data.metadata ? data.metadata.syncedAt : nowEgyptISO(), data.metadata ? (Number(data.metadata.totalSales) || 0) : 0, data.metadata ? (Number(data.metadata.totalExpenses) || 0) : 0, data.metadata ? (Number(data.metadata.netProfit) || 0) : 0]
        ]);
      }
      summarySheet.getRange(1, 1, 1, 4).setFontWeight("bold").setBackground("#d9ead3");
      
      try { CacheService.getScriptCache().remove("doGet_result_" + ss.getId()); } catch(ce) {}
      
      return ContentService.createTextOutput(JSON.stringify({"status": "success"}))
        .setMimeType(ContentService.MimeType.JSON);
    }
    
    return ContentService.createTextOutput(JSON.stringify({"status": "ignored", "message": "Unknown payload."}))
      .setMimeType(ContentService.MimeType.JSON);
      
  } catch(error) {
    Logger.log('FATAL doPost ERROR: ' + error.toString() + ' Stack: ' + error.stack);
    return ContentService.createTextOutput(JSON.stringify({"error": error.toString(), "stack": error.stack}))
      .setMimeType(ContentService.MimeType.JSON);
  } finally {
    lock.releaseLock();
  }
}

function fixAllTimezones() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheets = ss.getSheets();
  var totalFixed = 0;

  var utcPattern = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?Z$/;
  var utcPatternShort = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/;

  for (var s = 0; s < sheets.length; s++) {
    var sheet = sheets[s];
    var lastRow = sheet.getLastRow();
    var lastCol = sheet.getLastColumn();
    if (lastRow <= 1 || lastCol <= 0) continue;

    var data = sheet.getRange(1, 1, lastRow, lastCol).getValues();
    var hasChanges = false;

    for (var r = 0; r < data.length; r++) {
      for (var c = 0; c < data[r].length; c++) {
        var cell = data[r][c];
        var val = '';

        if (cell instanceof Date) {
          val = Utilities.formatDate(cell, 'GMT', "yyyy-MM-dd'T'HH:mm:ss'Z'");
        } else if (typeof cell === 'string') {
          val = cell.trim();
        } else {
          continue;
        }

        if (!utcPattern.test(val) && !utcPatternShort.test(val)) continue;

        try {
          var dateObj = new Date(val);
          if (isNaN(dateObj.getTime())) continue;

          var year = Utilities.formatDate(dateObj, EGYPT_TZ, 'yyyy');
          var month = Utilities.formatDate(dateObj, EGYPT_TZ, 'MM');
          var day = Utilities.formatDate(dateObj, EGYPT_TZ, 'dd');
          var hour = Utilities.formatDate(dateObj, EGYPT_TZ, 'HH');
          var min = Utilities.formatDate(dateObj, EGYPT_TZ, 'mm');
          var sec = Utilities.formatDate(dateObj, EGYPT_TZ, 'ss');
          var newDateStr = year + '-' + month + '-' + day + 'T' + hour + ':' + min + ':' + sec;

          if (newDateStr !== val) {
            data[r][c] = newDateStr;
            hasChanges = true;
            totalFixed++;
          }
        } catch(e) {}
      }
    }

    if (hasChanges) {
      sheet.getRange(1, 1, lastRow, lastCol).setValues(data);
      Logger.log('Sheet "' + sheet.getName() + '": fixed timezone entries');
    }
  }

  Logger.log('Total fixed: ' + totalFixed);
  SpreadsheetApp.getUi().alert(
    'تم إصلاح التوقيت بنجاح!\n\n' +
    'عدد القيم المعدّلة: ' + totalFixed + '\n' +
    'ال sheets المفحوصة: ' + sheets.length
  );
}

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('🔧 إصلاح التوقيت')
    .addItem('تحويل UTC → توقيت مصر', 'fixAllTimezones')
    .addToUi();
}
