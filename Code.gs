// 🛡️ دوال مساعدة عامة على مستوى السكربت بالكامل (للوصول إليها من doGet و doPost)
function getSafeString(val) {
  if (val instanceof Date) {
    return val.toISOString();
  }
  return String(val !== undefined && val !== null ? val : '').trim();
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
  return p ? "'" + p : '';
}

function getSafePhone(val) {
  var p = getSafeString(val).replace(/^'/, '').replace(/\s+/g, '').replace(/[^\d]/g, '');
  if (p.startsWith('0020')) p = p.substring(4);
  if (p.startsWith('20') && p.length > 10) p = p.substring(2);
  if (!p.startsWith('0') && p.length >= 7) p = '0' + p;
  return p;
}

// 1. استقبال طلب الجلب والتحديث الميداني ثنائي الاتجاه مع نظام التخزين المؤقت (Cache)
function doGet(e) {
  try {
    // 🚨 مهم جداً: هذا السكربت يجب أن يكون مرفقاً (مثبّتاً) في ملف Google Sheets نفسه
    // إذا أردت استخدام ملف شيت مختلف، ضع رابط الملف بين علامتي التنصيص بالأسفل بدلاً من "":
    // مثال: var SHEET_URL = "https://docs.google.com/spreadsheets/d/1ABCxyz...";
    var SHEET_URL = ""; 
    var ss;
    try {
      ss = SHEET_URL ? SpreadsheetApp.openByUrl(SHEET_URL) : SpreadsheetApp.getActiveSpreadsheet();
    } catch(err) {
      ss = SpreadsheetApp.getActiveSpreadsheet();
    }

    // ☁️ نظام التخزين المؤقت (Cache) لتقليل استهلاك quota وتسريع القراءة
    var cache = CacheService.getScriptCache();
    var cacheKey = "doGet_result_" + ss.getId();
    var cached = cache.get(cacheKey);
    if (cached) {
      return ContentService.createTextOutput(cached)
        .setMimeType(ContentService.MimeType.JSON);
    }

    var result = {};
    
    // دالة مساعدة وأكثر أماناً لجلب البيانات وتخطي الأخطاء
    function safeGetSheetData(sheetName, mapFn) {
      var sheet = ss.getSheetByName(sheetName);
      if (!sheet || sheet.getLastRow() <= 1) return [];
      var data = sheet.getRange(2, 1, sheet.getLastRow() - 1, sheet.getLastColumn()).getValues();
      return data.filter(function(row) { 
        var c0 = getSafeString(row[0]);
        var c1 = getSafeString(row[1]);
        var c2 = getSafeString(row[2]);
        var c3 = getSafeString(row[3]);
        return c0 !== '' || c1 !== '' || c2 !== '' || c3 !== ''; 
      }).map(mapFn);
    }

    // دالة تخطيط الفواتير
    function mapInvoiceRow(row) {
      var items = [];
      var invId = getSafeString(row[0]);
      if (!invId) invId = 'inv-fix-' + getSafeString(row[2]) + '-' + getSafePhone(row[10]);
      try { items = JSON.parse(row[9]); } catch(e) { items = []; }
      return { 
        id: invId, date: getSafeString(row[1]), invoiceNumber: getSafeString(row[2]), // توافق مع invoiceNumber 
        customerName: getSafeString(row[3]), area: getSafeString(row[4]), total: getSafeNumber(row[5]), 
        paidAmount: row[6] !== '' ? getSafeNumber(row[6]) : 0, 
        delegateName: getSafeString(row[7]).replace(/\s*\(.*?\)/g, '').trim(), notes: getSafeString(row[8]),
        items: items, delegatePhone: getSafePhone(row[10]),
        customerId: getSafeString(row[11]),
        totalBeforeDiscount: getSafeNumber(row[12]) || getSafeNumber(row[5]),
        isDelivered: (row[13] === '' || row[13] === undefined) ? true : (row[13] === 'true' || row[13] === true)
      };
    }

    // أ. جلب الفواتير (من النشطة ومن الأرشيف لكي يراها التطبيق كاملة)
    var activeInvoices = safeGetSheetData('الفواتير', mapInvoiceRow);
    var archivedInvoices = safeGetSheetData('أرشيف السداد', mapInvoiceRow);
    result.invoices = activeInvoices.concat(archivedInvoices);

    // ب. جلب المصروفات والماليات
    result.expenses = safeGetSheetData('الماليات', function(row) {
      var expId = getSafeString(row[0]);
      if (!expId || !expId.includes('-')) expId = 'exp-fix-' + getSafeNumber(row[4]) + '-' + getSafeString(row[2]);
      return { 
        id: expId, date: getSafeString(row[1]), category: getSafeString(row[2]), 
        type: getSafeString(row[3]), amount: getSafeNumber(row[4]), description: getSafeString(row[5]),
        delegateName: getSafeString(row[6]).replace(/\s*\(.*?\)/g, '').trim(), delegatePhone: getSafePhone(row[7])
      };
    });

    // ج. جلب المشاوير
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

    // د. جلب العملاء
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

    // هـ. جلب المنتجات والأسعار (النسخة المسطحة)
    var newProductsSheet = ss.getSheetByName('الأصناف_والأوزان');
    result.flatProducts = [];
    if (newProductsSheet && newProductsSheet.getLastRow() > 1) {
      var headers = newProductsSheet.getRange(1, 1, 1, newProductsSheet.getLastColumn()).getValues()[0];
      var hasRetailCarton = headers.indexOf('سعر بيع الكرتونة') !== -1;
      var pData = newProductsSheet.getRange(2, 1, newProductsSheet.getLastRow() - 1, newProductsSheet.getLastColumn()).getValues();
      result.flatProducts = pData.filter(function(row) { 
         var c0 = getSafeString(row[0]);
         var c1 = getSafeString(row[1]);
         var c2 = getSafeString(row[2]);
         var c3 = getSafeString(row[3]);
         return c0 !== '' || c1 !== '' || c2 !== '' || c3 !== '';
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

    // ز. جلب كشوفات المصنع
    var factorySheet = ss.getSheetByName('المصنع');
    result.factoryLoads = [];
    if (factorySheet && factorySheet.getLastRow() > 1) {
      var fHeaders = factorySheet.getRange(1, 1, 1, factorySheet.getLastColumn()).getValues()[0];
      var hasIds = fHeaders.indexOf('معرف الصنف') !== -1;
      var fData = factorySheet.getRange(2, 1, factorySheet.getLastRow() - 1, factorySheet.getLastColumn()).getValues();
      result.factoryLoads = fData.filter(function(row) { 
         var c0 = getSafeString(row[0]);
         var c1 = getSafeString(row[1]);
         var c2 = getSafeString(row[2]);
         var c3 = getSafeString(row[3]);
         var c4 = getSafeString(row[4]);
         return c0 !== '' || c1 !== '' || c2 !== '' || c3 !== '' || c4 !== '';
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
            cartonPrice: getSafeNumber(row[12]), unitPrice: getSafeNumber(row[13])
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

    // ح. جلب صلاحيات المستخدمين
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

    // ط. جلب العملاء المكتشفين
    result.discoveredLeads = safeGetSheetData('عملاء_مكتشفين', function(row) {
      return { 
        id: getSafeString(row[0]), governorate: getSafeString(row[1]), area: getSafeString(row[2]), 
        name: getSafeString(row[3]), phone: getSafePhone(row[4]), detailedAddress: getSafeString(row[5]), 
        locationLink: getSafeString(row[6]), type: getSafeString(row[7]), dateAdded: getSafeString(row[8])
      };
    });

    // ط2. جلب العملاء المحتملين
    result.potentialLeads = safeGetSheetData('عملاء_محتملين', function(row) {
      return { 
        id: getSafeString(row[0]), governorate: getSafeString(row[1]), area: getSafeString(row[2]), 
        name: getSafeString(row[3]), phone: getSafePhone(row[4]), detailedAddress: getSafeString(row[5]), 
        locationLink: getSafeString(row[6]), type: getSafeString(row[7]), dateAdded: getSafeString(row[8])
      };
    });

    // ك. إضافة رقم إصفحة قاعدة البيانات (dbVersion) لدعم التهيئة الكاملة
    var dbVersion = PropertiesService.getScriptProperties().getProperty('dbVersion');
    if (dbVersion) result.dbVersion = Number(dbVersion);

    // تخزين مؤقت في الذاكرة لمدة 15 ثانية (ما عدا لو أرسل المستخدم t=cache-bust)
    var tParam = e && e.parameter && e.parameter.t ? String(e.parameter.t) : '';
    var shouldCache = !tParam;
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

// 2. استقبال طلب الصب والترحيل والنسخ الاحتياطي مع نظام الحماية (LockService)
function doPost(e) {
  try {
    Logger.log("Incoming doPost request. Payload size: " + (e && e.postData && e.postData.contents ? e.postData.contents.length : 0) + " characters.");
  } catch(logErr) {}
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(45000);
    
    // 🚨 مهم جداً: هذا السكربت يجب أن يكون مرفقاً بملف Google Sheets نفسه
    // مثال: var SHEET_URL = "https://docs.google.com/spreadsheets/d/1ABCxyz...";
    var SHEET_URL = "";
    var data = JSON.parse(e.postData.contents);
    var deletedIds = data.deletedIds || [];
    var isOwner = data.syncRole === 'owner' 
      || data.syncPhone === '01228466613' 
      || (data.customRoleName && (data.customRoleName.includes('نائب المدير') || data.customRoleName.includes('مشرف عام')));
    var canEditPrices = data.canEditPrices === true || isOwner;
    if (!isOwner) deletedIds = [];
    
    // 🚨 مسح الذاكرة المؤقتة في البداية لمنع تقديم بيانات قديمة أثناء الكتابة
    var ss;
    try {
      ss = SHEET_URL ? SpreadsheetApp.openByUrl(SHEET_URL) : SpreadsheetApp.getActiveSpreadsheet();
    } catch(err) {
      ss = SpreadsheetApp.getActiveSpreadsheet();
    }
    try { CacheService.getScriptCache().remove("doGet_result_" + ss.getId()); } catch(ce) {}
    
    // ☁️ إضافة استجابة لطلبات إنشاء النسخة الاحتياطية في Google Drive
    if (data.type === 'auto_backup') {
      try {
        var folderName = "نسخ_نظام_سوفانا_الاحتياطية";
        var folders = DriveApp.getFoldersByName(folderName);
        var folder = folders.hasNext() ? folders.next() : DriveApp.createFolder(folderName);
        
        var dateStr = new Date().toISOString().split('T')[0];
        var fileName = "EAGS_Backup_" + dateStr + "_" + (data.syncPhone || "admin") + ".json";
        
        folder.createFile(fileName, JSON.stringify(data.data, null, 2), MimeType.PLAIN_TEXT);
        
        return ContentService.createTextOutput(JSON.stringify({"status": "backup_success"}))
          .setMimeType(ContentService.MimeType.JSON);
      } catch(backupError) {
        return ContentService.createTextOutput(JSON.stringify({"error": backupError.toString()}))
          .setMimeType(ContentService.MimeType.JSON);
      }
    }

    function upsertData(sheetName, headers, dataRows, headerColor, delIds) {
      var sheet = ss.getSheetByName(sheetName);
      if (!sheet) {
        sheet = ss.insertSheet(sheetName);
      }
      
      var existingRange = sheet.getDataRange();
      var existingData = existingRange.getValues();
      
      var dataMap = {}; // الحل الجذري: قاموس المعرفات لمنع تداخل الصفوف تماماً
      var order = []; // 🚨 الإصلاح الجذري: تعريف مصفوفة الترتيب المفقودة التي كانت تسبب الانهيار الصامت لجوجل
      
      if (existingData.length > 1) {
        for (var k = 1; k < existingData.length; k++) {
          var r = existingData[k];
          
          // 🚨 تنظيف ذاتي أعمق وتجاهل كامل للأسطر التالفة والفارغة بالكامل
          if (!r || r.length === 0) continue;
          // تخطي الأسطر الفارغة تماماً (جميع الخلايا فارغة)
          var allEmpty = true;
          for (var chk = 0; chk < r.length; chk++) {
            if (String(r[chk]).trim() !== '') { allEmpty = false; break; }
          }
          if (allEmpty) continue;
          
          if (sheetName === 'الماليات' && isNaN(Number(r[4]))) continue; 
          if (sheetName === 'الفواتير' && isNaN(Number(r[5]))) continue; 
          if (sheetName === 'المصنع' && isNaN(Number(r[7]))) continue; 
          
          var rowId = String(r[0]).replace(/^'/, '').trim();
          // توليد معرف تلقائي للصفوف المضافة يدوياً بدون معرف في العمود الأول
          if (rowId === '') {
            rowId = 'manual_' + sheetName.replace(/[^a-zA-Z0-9]/g, '') + '_' + k + '_' + Date.now();
            r[0] = rowId; // حفظ المعرف المولّد في الصف الأصلي
          }
          var altId = String(r[1]).replace(/^'/, '').trim(); // لالتقاط معرفات المنتجات والعملاء
          if (rowId.length === 10 && rowId.indexOf('1') === 0) rowId = '0' + rowId;
          
          if (delIds && (delIds.indexOf(rowId) !== -1 || delIds.indexOf(altId) !== -1)) continue; // تخطي وحذف السجلات المحذوفة محلياً للأبد
          
          // ضمان تساوي طول المصفوفة لحماية سيرفر جوجل من الانهيار (Jagged Array)
          var paddedRow = [];
          for (var c = 0; c < headers.length; c++) {
            paddedRow.push(r[c] !== undefined ? r[c] : '');
          }
          dataMap[rowId] = paddedRow;
          order.push(rowId);
        }
      }
      
      if (dataRows && dataRows.length > 0) {
        for (var j = 0; j < dataRows.length; j++) {
          var row = dataRows[j];
          if (!row || row.length === 0) continue;
  
          var incomingId = String(row[0]).replace(/^'/, '').trim();
          // توليد معرف تلقائي للصفوف الواردة بدون معرف
          if (incomingId === '') {
            incomingId = 'auto_' + sheetName.replace(/[^a-zA-Z0-9]/g, '') + '_' + j + '_' + Date.now();
          }
          if (incomingId.length === 10 && incomingId.indexOf('1') === 0) incomingId = '0' + incomingId;
          
          if (delIds && delIds.indexOf(incomingId) !== -1) continue; // 🚨 حماية إضافية: منع إضافة السجل المحذوف حتى لو تم إرساله بالخطأ من الذاكرة المحلية
          
          // توحيد طول الصف القادم من التطبيق لسد الثغرات
          var paddedNewRow = [];
          for (var col = 0; col < headers.length; col++) {
            paddedNewRow.push(row[col] !== undefined ? row[col] : '');
          }
          dataMap[incomingId] = paddedNewRow;
          
          // إضافة المعرف للترتيب إذا كان جديداً
          if (order.indexOf(incomingId) === -1) {
            order.push(incomingId);
          }
        }
      }
      
      var finalData = [headers];
      for (var i = 0; i < order.length; i++) {
        finalData.push(dataMap[order[i]]);
      }

      if (sheet.getMaxColumns() < headers.length) {
        sheet.insertColumnsAfter(sheet.getMaxColumns(), headers.length - sheet.getMaxColumns());
      }

      // 🚨 إضافة حماية لزيادة عدد الصفوف تلقائياً إذا تجاوزت البيانات حجم الشيت لتجنب انهيار السكربت
      if (sheet.getMaxRows() < finalData.length) {
        sheet.insertRowsAfter(sheet.getMaxRows(), finalData.length - sheet.getMaxRows());
      }

      sheet.clearContents();
      sheet.getRange(1, 1, finalData.length, headers.length).setValues(finalData);
      SpreadsheetApp.flush(); // 🚨 ضمان كتابة البيانات فوراً قبل أي عملية تالية
      sheet.getRange(1, 1, 1, headers.length).setFontWeight("bold").setBackground(headerColor || "#cfe2f3");
      
      if (sheet.getFilter() === null) {
        sheet.getDataRange().createFilter();
      }
    }

    if (data.type === 'تقرير_كامل') {

      // 🟢 التهيئة الكاملة: مسح جميع الجداول قبل الكتابة (باستثناء صلاحيات المستخدمين)
      // فقط عند تغير dbVersion (تهيئة من المدير) وليس في كل مزامنة
      var currentDbVersion = PropertiesService.getScriptProperties().getProperty('dbVersion');
      if (data.dbVersion !== undefined && data.dbVersion !== null && 
          (!currentDbVersion || Number(data.dbVersion) > Number(currentDbVersion))) {
        PropertiesService.getScriptProperties().setProperty('dbVersion', data.dbVersion.toString());
        ['الفواتير', 'أرشيف السداد', 'الماليات', 'المشاوير', 'العملاء', 'الأصناف_والأوزان', 'المصنع', 'عملاء_مكتشفين', 'عملاء_محتملين'].forEach(function(name) {
          var s = ss.getSheetByName(name);
          if (s && s.getLastRow() > 1) s.getRange(2, 1, s.getLastRow() - 1, s.getLastColumn()).clearContent();
        });
      }
      
      // 1. الفواتير (نظام الفرز الذكي للأرشيف)
      var activeInvRows = [];
      var archivedInvRows = [];
      var activeInvIds = [];
      var archivedInvIds = [];
      
      (data.invoices || []).forEach(function(inv) { 
        var cleanId = String(inv.id).replace(/^'/, '').trim();
        var isDel = inv.hasOwnProperty('isDelivered') ? inv.isDelivered : true;
        var remaining = Math.max(0, (Number(inv.total) || 0) - (Number(inv.paidAmount) || 0));
        var paymentStatus = remaining > 0 ? 'مديونية ⚠️' : 'خالصة ✅';
        
        var rowData = [
          inv.id, inv.date, inv.invNum, inv.customerName, inv.area, 
          inv.total, inv.paidAmount, inv.delegateName, inv.notes || '',
          JSON.stringify(inv.items || []), formatPhone(inv.delegatePhone),
          inv.customerId || '', inv.totalBeforeDiscount || inv.total || 0, isDel ? 'true' : 'false', remaining, paymentStatus
        ]; 
        
        if (remaining === 0 && isDel) {
           archivedInvRows.push(rowData);
           archivedInvIds.push(cleanId);
        } else {
           activeInvRows.push(rowData);
           activeInvIds.push(cleanId);
        }
      });
      upsertData('الفواتير', ['المعرف', 'التاريخ', 'رقم الفاتورة', 'العميل', 'المنطقة', 'إجمالي الفاتورة', 'المدفوع', 'المندوب', 'الملاحظات', 'التفاصيل (JSON)', 'هاتف المندوب', 'معرف العميل', 'الإجمالي قبل الخصم', 'تم التسليم', 'المتبقي (المديونية)', 'حالة السداد'], activeInvRows, "#cfe2f3", deletedIds.concat(archivedInvIds));
      upsertData('أرشيف السداد', ['المعرف', 'التاريخ', 'رقم الفاتورة', 'العميل', 'المنطقة', 'إجمالي الفاتورة', 'المدفوع', 'المندوب', 'الملاحظات', 'التفاصيل (JSON)', 'هاتف المندوب', 'معرف العميل', 'الإجمالي قبل الخصم', 'تم التسليم', 'المتبقي (المديونية)', 'حالة السداد'], archivedInvRows, "#d9ead3", deletedIds.concat(activeInvIds));
      
      // 2. الماليات
      var expRows = (data.expenses || []).map(function(exp) { 
        return [
          "'" + exp.id, exp.date, exp.category, exp.type || 'expense',
          exp.amount, exp.description || '', exp.delegateName || '',
          formatPhone(exp.delegatePhone)
        ]; 
      });
      upsertData('الماليات', ['المعرف', 'التاريخ', 'الفئة', 'النوع', 'المبلغ', 'البيان', 'المندوب', 'هاتف المندوب'], expRows, "#e0e0e0", deletedIds);

      // 3. المشاوير
      var tripRows = (data.trips || []).map(function(t) { 
        return [
          t.id, t.date, t.description || '', t.price, t.status,
          t.delegateName || '', formatPhone(t.delegatePhone),
          t.odometerStart || '', t.odometerEnd || ''
        ]; 
      });
      upsertData('المشاوير', ['المعرف', 'التاريخ', 'البيان', 'الأجرة', 'الحالة', 'المندوب', 'هاتف المندوب', 'عداد البداية', 'عداد النهاية'], tripRows, "#ffe599", deletedIds);

      // 4. العملاء 
      var custRows = (data.customers || []).map(function(c) { 
        return [
          c.id, c.governorate || '', c.area || '', c.name || '', 
          formatPhone(c.phone), c.detailedAddress || '', c.locationLink || '', 
          c.purchasesCount || 0, c.salesManager || '', c.totalSpent || 0, c.lastPurchaseDate || ''
        ]; 
      });
      upsertData('العملاء', ['المعرف', 'المحافظة', 'المنطقة', 'اسم العميل', 'رقم الهاتف', 'العنوان', 'رابط جوجل ماب', 'عدد المشتريات', 'مدير البيع', 'إجمالي المسحوبات', 'آخر شراء'], custRows, "#d9ead3", deletedIds);

      // 5. المنتجات
      if (canEditPrices) {
        var prodRows = [];
        (data.products || []).forEach(function(p) { 
          if (p.weights && p.weights.length > 0) {
            p.weights.forEach(function(w) {
              var retailCarton = (Number(w.cartonPriceFromFactory) || 0) + (Number(w.addedValue) || 0);
              prodRows.push([
                w.id, p.id, p.name, w.size || 'كرتونة', w.cartonPriceFromFactory || 0,
                w.unitsPerCarton || 1, w.factoryPricePerUnit || 0, w.addedValue || 0,
                retailCarton, w.retailPricePerUnit || 0, "'" + String(w.barcode || '')
              ]);
            });
          }
        });
        upsertData('الأصناف_والأوزان', ['معرف الوزن (لا تحذفه)', 'معرف الصنف', 'اسم الصنف', 'الحجم/الوزن', 'سعر الكرتونة', 'العدد بالكرتونة', 'سعر العبوة (مصنع)', 'القيمة المضافة', 'سعر بيع الكرتونة', 'سعر بيع العبوة', 'الباركود'], prodRows, "#cfe2f3", deletedIds);
      }
      
      // 6. المصنع 
      var factoryRows = (data.factoryLoads || []).map(function(fl) { 
        return [
          fl.id, fl.date, fl.productId || '', fl.weightId || '', fl.productName, 
          fl.weightSize || 'كرتونة', fl.cartonsCount || 0, fl.quantity || 0, 
          fl.advanceAmount || 0, fl.warehouseKeeper || '', fl.delegateName || '',
          formatPhone(fl.delegatePhone), fl.cartonPrice || 0, fl.unitPrice || 0
        ]; 
      });
      upsertData('المصنع', ['المعرف', 'التاريخ', 'معرف الصنف', 'معرف الوزن', 'اسم الصنف', 'الحجم/الوزن', 'الكمية (كرتونة)', 'إجمالي الوحدات', 'مقدم المصنع', 'أمين المخزن', 'اسم المندوب', 'هاتف المندوب', 'سعر الكرتونة', 'سعر العبوة'], factoryRows, "#fce5cd", deletedIds);

      // 7. المستخدمين
      if (isOwner) {
        var userRows = (data.users || []).map(function(u) { 
          return [
            formatPhone(u.phone), u.name, u.role, u.status, 
            "'" + String(u.password || ''), u.customRoleName || '', 
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
        upsertData('صلاحيات_المستخدمين', ['رقم الهاتف', 'الاسم', 'الدور/الوظيفة', 'الحالة', 'الرمز السري', 'المسمى الوظيفي', 'الصلاحيات المفعّلة', 'الصلاحيات الفرعية', 'تعديل الأسعار', 'آخر ظهور', 'خط العرض', 'خط الطول', 'المستشار الذكي', 'السماح بالخصم', 'أقصى خصم من الربح', 'أقصى مبلغ خصم إضافي', 'منطقة العمل'], userRows, "#ead1dc", deletedIds);
      }

      // 8. المكتشفين
      var discoveredRows = (data.discoveredLeads || []).map(function(l) { 
        return [
          l.id, l.governorate || '', l.area || '', l.name || '', 
          formatPhone(l.phone), l.detailedAddress || '', l.locationLink || '',
          l.type || '', l.dateAdded || ''
        ]; 
      });
      upsertData('عملاء_مكتشفين', ['المعرف', 'المحافظة', 'المنطقة', 'اسم العميل', 'رقم الهاتف', 'العنوان', 'رابط جوجل ماب', 'النشاط', 'تاريخ الإضافة'], discoveredRows, "#fff2cc", deletedIds);

      // 8b. العملاء المحتملين
      var potentialRows = (data.potentialLeads || []).map(function(l) { 
        return [
          l.id, l.governorate || '', l.area || '', l.name || '', 
          formatPhone(l.phone), l.detailedAddress || '', l.locationLink || '',
          l.type || '', l.dateAdded || ''
        ]; 
      });
      upsertData('عملاء_محتملين', ['المعرف', 'المحافظة', 'المنطقة', 'اسم العميل', 'رقم الهاتف', 'العنوان', 'رابط جوجل ماب', 'النشاط', 'تاريخ الإضافة'], potentialRows, "#d9ead3", deletedIds);

      // 9. الملخص
      var summarySheet = ss.getSheetByName('الملخص');
      if (!summarySheet) {
        summarySheet = ss.insertSheet('الملخص');
      }
      summarySheet.clearContents();
      summarySheet.getRange(1, 1, 2, 4).setValues([
        ['تاريخ المزامنة', 'إجمالي المبيعات', 'المنصرف والمصروفات', 'صافي الأرباح'],
        [data.metadata ? data.metadata.syncedAt : new Date().toISOString(), data.metadata ? (Number(data.metadata.totalSales) || 0) : 0, data.metadata ? (Number(data.metadata.totalExpenses) || 0) : 0, data.metadata ? (Number(data.metadata.netProfit) || 0) : 0]
      ]);
      summarySheet.getRange(1, 1, 1, 4).setFontWeight("bold").setBackground("#d9ead3");
      
      // مسح الذاكرة المؤقتة (Cache) لضمان قراءة أحدث البيانات في المرة القادمة
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
