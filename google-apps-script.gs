// ============================================================
// AOG Teens Jaktim — Auto Sync (REBUILD + APPEND mode)
// - fullRebuild(): rebuild dari sheet kosong (run sekali manual)
// - syncAll() / runAutoSync(): append data baru + update existing (auto-trigger)
// ============================================================

const SUPABASE_URL = 'https://gqppviugodokncxezdwd.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdxcHB2aXVnb2Rva25jeGV6ZHdkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ4NjIwOTcsImV4cCI6MjA5MDQzODA5N30.w2oUJYWk4yr_tJQuhk0UyxJKwgH1C3FkmJB6CXclSpk';

const REGION_CONFIG = {
  jaktim1: { sheetAbsensi:'JAKTIM 1', sheetDetail:'DETAIL JAKTIM 1 ', dateStartCol:5 },
  jaktim2: { sheetAbsensi:'JAKTIM 2', sheetDetail:'DETAIL JAKTIM 2 ', dateStartCol:4 }
};

const HEADER_MONTH_ROW = 1;
const HEADER_IBADAH_ROW = 2;
const HEADER_DATE_ROW = 3;
const DATA_START_ROW = 4;
const CG_COL = 1;
const NO_COL = 2;
const NAMA_COL = 3;

const DETAIL_HEADER_ROW = 3;
const DETAIL_DATA_ROW = 4;
const DETAIL_COLS = {cg:1,no:2,nama:3,status:4,lahir:5,wa:6,kelurahan:7,kecamatan:8,msj1:9,msj2:10,msj3:11,cgt1:12,cgt2:13,cgt3:14,baptisAir:15,baptisRoh:16,sekolah:17,kelas:18};

const STATUS_BG = {'Hadir':'#c6efce','Izin':'#bdd7ee','Sakit':'#ffeb9c','Alpa':'#ffc7ce'};
const STATUS_FONT = {'Hadir':'#276221','Izin':'#1f497d','Sakit':'#9c6500','Alpa':'#9c0006'};
const ROLE_BG = {cgl:'#fff3e0', sponsor:'#e8eaf6', member:'#ffffff', simpatisan:'#fce4ec', vip:'#f3e5f5'};
const ROLE_ORDER = {'cgl':0,'leader':0,'sponsor':1,'member':2,'simpatisan':3,'vip':4};

const MONTHS_ID = {1:'JAN',2:'FEB',3:'MAR',4:'APR',5:'MEI',6:'JUN',7:'JUL',8:'AGS',9:'SEP',10:'OKT',11:'NOV',12:'DES'};
const STATUS_MAP = {H:'Hadir',I:'Izin',S:'Sakit',A:'Alpa'};

// ═══════════════════════════════════════════════════════════
// ENTRY POINTS
// ═══════════════════════════════════════════════════════════

// RUN MANUAL sekali kalau sheet baru atau mau reset total
function fullRebuild() {
  fullRebuildRegion('jaktim1');
  fullRebuildRegion('jaktim2');
}

// RUN MANUAL untuk 1 region saja
function fullRebuildJaktim1() { fullRebuildRegion('jaktim1'); }
function fullRebuildJaktim2() { fullRebuildRegion('jaktim2'); }

// AUTO TRIGGER every 1 min — hanya update data + append baru
function runAutoSync() {
  try { syncAll(); }
  catch(e) { Logger.log('Auto-sync error: ' + e.message); }
}
function syncAll() {
  syncRegion('jaktim1');
  syncRegion('jaktim2');
}

function doGet(e) {
  var action = (e.parameter.action||'').trim();
  var region = (e.parameter.region||'jaktim1').trim();
  var cb = e.parameter.callback||'';
  if (action==='ping') return jr(cb,{ok:true});
  if (action==='syncAll') { syncRegion(region); return jr(cb,{ok:true}); }
  if (action==='fullRebuild') { fullRebuildRegion(region); return jr(cb,{ok:true,message:'Rebuilt '+region}); }
  return jr(cb,{ok:false});
}
function jr(cb,obj) {
  if (cb) return ContentService.createTextOutput(cb+'('+JSON.stringify(obj)+')').setMimeType(ContentService.MimeType.JAVASCRIPT);
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

// ═══════════════════════════════════════════════════════════
// FULL REBUILD — clear sheet + write semua dari Supabase
// ═══════════════════════════════════════════════════════════
function fullRebuildRegion(region) {
  var cfg = REGION_CONFIG[region];
  if (!cfg) return;
  Logger.log('=== FULL REBUILD: ' + region + ' ===');

  var members = fetchSupabase('/rest/v1/members?select=*&region=eq.'+region);
  var dates = fetchSupabase('/rest/v1/dates?select=*&region=eq.'+region+'&order=sort_order');
  var attendance = fetchSupabase('/rest/v1/attendance?select=member_id,date_id,status');
  if (!members || !dates) return;

  rebuildAbsensiSheet(cfg.sheetAbsensi, cfg.dateStartCol, members, dates, attendance||[]);
  rebuildDetailSheet(cfg.sheetDetail, members);
  Logger.log('=== DONE: ' + region + ' ===');
}

function rebuildAbsensiSheet(sheetName, dateStartCol, members, dates, attendance) {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(sheetName);
  if (!sheet) { Logger.log('Sheet not found: '+sheetName); return; }

  // Clear everything below header row 3
  var lr = sheet.getMaxRows();
  var lc = sheet.getMaxColumns();
  if (lr > 3) sheet.getRange(4, 1, lr-3, lc).clearContent().clearFormat();
  // Also clear rows 1-3 from dateStartCol onwards (reset date headers)
  if (lc >= dateStartCol) sheet.getRange(1, dateStartCol, 3, lc-dateStartCol+1).clearContent().clearFormat();

  // Sort members: by CG (original Supabase order), then by role priority, then by name
  var cgOrder = [];
  var cgMap = {};
  members.forEach(function(m) {
    if (!cgMap[m.cg]) { cgMap[m.cg] = []; cgOrder.push(m.cg); }
    cgMap[m.cg].push(m);
  });
  cgOrder.forEach(function(cg) {
    cgMap[cg].sort(function(a,b) {
      var ra = roleRank(a.status), rb = roleRank(b.status);
      if (ra !== rb) return ra - rb;
      return (a.nama||'').localeCompare(b.nama||'');
    });
  });

  // Build sorted member list + row mapping
  var orderedMembers = [];
  var memberRow = {}; // member.id → sheet row
  var row = DATA_START_ROW;
  cgOrder.forEach(function(cg) {
    cgMap[cg].forEach(function(m, idx) {
      memberRow[m.id] = row;
      orderedMembers.push({m:m, row:row, isFirstInGroup:idx===0, no:idx+1});
      row++;
    });
  });

  // Write CG, No, Nama in batch
  var mainData = []; // [[cg, no, nama, empty], ...]
  var mainBgs = [];
  orderedMembers.forEach(function(om) {
    var roleKey = (om.m.status||'member').toLowerCase().trim();
    var bg = ROLE_BG[roleKey] || '#ffffff';
    mainData.push([om.isFirstInGroup ? om.m.cg : '', om.no, om.m.nama||'', '']);
    mainBgs.push([bg, bg, bg, bg]);
  });
  if (mainData.length > 0) {
    sheet.getRange(DATA_START_ROW, 1, mainData.length, 4).setValues(mainData).setBackgrounds(mainBgs);
  }

  // Write date columns
  var dateCount = dates.length;
  if (dateCount === 0) return;

  var monthRow = [];
  var ibadahRow = [];
  var dateRow = [];
  var prevMonth = '';
  dates.forEach(function(d) {
    var nd = normDate(d.label);
    var parts = nd.split('-');
    var monthNum = parseInt(parts[1]);
    var monthCode = MONTHS_ID[monthNum] || '';
    var dateStr = parts[0] + '-' + parts[1] + '-26';
    monthRow.push(monthCode !== prevMonth ? monthCode : '');
    ibadahRow.push(monthCode !== prevMonth ? 'IBADAH' : '');
    dateRow.push(dateStr);
    prevMonth = monthCode;
  });

  sheet.getRange(HEADER_MONTH_ROW, dateStartCol, 1, dateCount).setValues([monthRow])
    .setFontWeight('bold').setHorizontalAlignment('center');
  sheet.getRange(HEADER_IBADAH_ROW, dateStartCol, 1, dateCount).setValues([ibadahRow])
    .setFontWeight('bold').setHorizontalAlignment('center').setFontStyle('italic');
  sheet.getRange(HEADER_DATE_ROW, dateStartCol, 1, dateCount).setValues([dateRow])
    .setFontWeight('bold').setHorizontalAlignment('center').setNumberFormat('@');

  for (var c = 0; c < dateCount; c++) sheet.setColumnWidth(dateStartCol+c, 80);

  // Build attendance map
  var attMap = {}; // "memberId_dateId" → status
  attendance.forEach(function(a) { attMap[a.member_id+'_'+a.date_id] = a.status; });

  // Write attendance data in batch
  var attValues = [];
  var attBgs = [];
  var attFonts = [];
  orderedMembers.forEach(function(om) {
    var rowVals = [];
    var rowBgs = [];
    var rowFonts = [];
    dates.forEach(function(d) {
      var st = attMap[om.m.id+'_'+d.id];
      var val = STATUS_MAP[st] || '';
      rowVals.push(val);
      rowBgs.push(STATUS_BG[val] || null);
      rowFonts.push(STATUS_FONT[val] || null);
    });
    attValues.push(rowVals);
    attBgs.push(rowBgs);
    attFonts.push(rowFonts);
  });

  if (attValues.length > 0) {
    var range = sheet.getRange(DATA_START_ROW, dateStartCol, attValues.length, dateCount);
    range.setValues(attValues);
    range.setBackgrounds(attBgs);
    range.setFontColors(attFonts);
    range.setHorizontalAlignment('center');
  }

  SpreadsheetApp.flush();
  Logger.log('Rebuilt '+sheetName+': '+orderedMembers.length+' members, '+dateCount+' dates');
}

function rebuildDetailSheet(sheetName, members) {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(sheetName);
  if (!sheet) { Logger.log('Sheet not found: '+sheetName); return; }

  // Clear below header row 3
  var lr = sheet.getMaxRows();
  if (lr > 3) sheet.getRange(4, 1, lr-3, 18).clearContent().clearFormat();

  // Sort members by CG + role
  var cgOrder = [], cgMap = {};
  members.forEach(function(m) {
    if (!cgMap[m.cg]) { cgMap[m.cg]=[]; cgOrder.push(m.cg); }
    cgMap[m.cg].push(m);
  });
  cgOrder.forEach(function(cg) {
    cgMap[cg].sort(function(a,b) {
      var ra=roleRank(a.status), rb=roleRank(b.status);
      if (ra!==rb) return ra-rb;
      return (a.nama||'').localeCompare(b.nama||'');
    });
  });

  var rows = [];
  var msBgs = [], msFonts = [];
  cgOrder.forEach(function(cg) {
    cgMap[cg].forEach(function(m, idx) {
      rows.push([
        idx===0 ? cg : '',
        idx+1,
        m.nama||'',
        m.status||'',
        m.lahir||'',
        m.wa||'',
        m.kelurahan||'',
        m.kecamatan||'',
        m.msj1?'TRUE':'FALSE',
        m.msj2?'TRUE':'FALSE',
        m.msj3?'TRUE':'FALSE',
        m.cgt1?'TRUE':'FALSE',
        m.cgt2?'TRUE':'FALSE',
        m.cgt3?'TRUE':'FALSE',
        m.baptis_air?'TRUE':'FALSE',
        m.baptis_roh?'TRUE':'FALSE',
        m.sekolah||'',
        m.kelas||''
      ]);
      // milestone row colors (col 9-16)
      var msRowBg = [], msRowFc = [];
      ['msj1','msj2','msj3','cgt1','cgt2','cgt3','baptis_air','baptis_roh'].forEach(function(f) {
        if (m[f]) { msRowBg.push('#c6efce'); msRowFc.push('#276221'); }
        else { msRowBg.push('#ffc7ce'); msRowFc.push('#9c0006'); }
      });
      msBgs.push(msRowBg);
      msFonts.push(msRowFc);
    });
  });

  if (rows.length > 0) {
    sheet.getRange(DETAIL_DATA_ROW, 1, rows.length, 18).setValues(rows);
    sheet.getRange(DETAIL_DATA_ROW, DETAIL_COLS.msj1, rows.length, 8)
      .setBackgrounds(msBgs).setFontColors(msFonts);
  }
  SpreadsheetApp.flush();
  Logger.log('Rebuilt '+sheetName+': '+rows.length+' members');
}

// ═══════════════════════════════════════════════════════════
// INCREMENTAL SYNC — update existing + append baru (SAFE)
// ═══════════════════════════════════════════════════════════
function syncRegion(region) {
  var cfg = REGION_CONFIG[region];
  if (!cfg) return;
  syncAbsensi(region, cfg.sheetAbsensi, cfg.dateStartCol);
  syncDetail(region, cfg.sheetDetail);
}

function syncAbsensi(region, sheetName, dateStartCol) {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(sheetName);
  if (!sheet) return;

  var members = fetchSupabase('/rest/v1/members?select=id,nama,cg,status&region=eq.'+region);
  var dates = fetchSupabase('/rest/v1/dates?select=id,label,month_code,sort_order&region=eq.'+region+'&order=sort_order');
  var attendance = fetchSupabase('/rest/v1/attendance?select=member_id,date_id,status');
  if (!members || !dates || !attendance) return;

  // Cek apakah sheet kosong (belum ada data) — kalau ya, trigger full rebuild
  var lastRow = sheet.getLastRow();
  var lastCol = sheet.getLastColumn();
  if (lastRow < DATA_START_ROW || lastCol < dateStartCol) {
    Logger.log('Sheet empty, running full rebuild: '+sheetName);
    rebuildAbsensiSheet(sheetName, dateStartCol, members, dates, attendance);
    return;
  }

  // Cleanup: hapus kolom tanggal duplikat (kalau ada) sebelum proses lanjut
  dedupDateColumns(sheet, dateStartCol);
  lastCol = sheet.getLastColumn();

  // ═══ Append new dates as columns at end ═══
  var dateCount = lastCol - dateStartCol + 1;
  var sheetDates = dateCount > 0 ? sheet.getRange(HEADER_DATE_ROW, dateStartCol, 1, dateCount).getValues()[0] : [];
  var existingDateNorms = sheetDates.map(function(d){return normDate(d);}).filter(function(x){return x;});

  var newDates = dates.filter(function(d) {
    return existingDateNorms.indexOf(normDate(d.label)) < 0;
  });

  if (newDates.length > 0) {
    // Smart insert: sisipkan di posisi yang benar berdasarkan sort_order Supabase
    newDates.sort(function(a,b){return a.sort_order-b.sort_order;});

    // Build map: normalized date label → sort_order dari Supabase (source of truth urutan)
    var supaSortMap = {};
    dates.forEach(function(d){ supaSortMap[normDate(d.label)] = d.sort_order; });

    // Limit max insert per run untuk hindari timeout
    var MAX_INSERTS = 10;
    var toInsert = newDates.slice(0, MAX_INSERTS);
    var inserted = 0;

    toInsert.forEach(function(nd) {
      var newSort = nd.sort_order;
      var ndn = normDate(nd.label);
      var parts = ndn.split('-');
      var monthCode = MONTHS_ID[parseInt(parts[1])] || '';
      var dateStr = parts[0]+'-'+parts[1]+'-26';

      // Re-read current date columns setiap iteration (karena posisi shift setelah insert)
      var lc = sheet.getLastColumn();
      var dc = lc - dateStartCol + 1;
      var curDates = dc > 0 ? sheet.getRange(HEADER_DATE_ROW, dateStartCol, 1, dc).getValues()[0] : [];

      // Find insert position: kolom pertama yang sort_order-nya > newSort
      var insertCol = -1;
      for (var i = 0; i < curDates.length; i++) {
        var curNorm = normDate(curDates[i]);
        if (!curNorm) continue;
        var curSort = supaSortMap[curNorm];
        if (curSort !== undefined && curSort > newSort) {
          insertCol = dateStartCol + i;
          break;
        }
      }
      // Kalau tidak ada yang lebih besar, append di akhir
      if (insertCol < 0) insertCol = dateStartCol + curDates.length;

      // Insert column (shift existing kanan) kalau bukan append
      if (insertCol < dateStartCol + curDates.length) {
        sheet.insertColumnBefore(insertCol);
      }

      // Determine prevMonth (kolom sebelum insertCol)
      var prevMonth = '';
      if (insertCol > dateStartCol) {
        var prevLabel = sheet.getRange(HEADER_DATE_ROW, insertCol - 1).getValue();
        var prevNorm = normDate(prevLabel);
        if (prevNorm) {
          var pParts = prevNorm.split('-');
          prevMonth = MONTHS_ID[parseInt(pParts[1])] || '';
        }
      }

      // Write month label hanya kalau bulan beda dari kolom sebelumnya
      if (monthCode && monthCode !== prevMonth) {
        sheet.getRange(1, insertCol).setValue(monthCode).setFontWeight('bold').setHorizontalAlignment('center');
        sheet.getRange(2, insertCol).setValue('IBADAH').setFontWeight('bold').setHorizontalAlignment('center').setFontStyle('italic');
      }

      // Write date di row 3
      sheet.getRange(HEADER_DATE_ROW, insertCol).setValue(dateStr).setFontWeight('bold').setHorizontalAlignment('center').setNumberFormat('@');
      sheet.setColumnWidth(insertCol, 80);

      // Cek kolom SETELAH insert — kalau bulannya sama dengan inserted date tapi dia punya month label, hapus labelnya (karena sekarang bukan awal bulan lagi)
      var nextCol = insertCol + 1;
      var nextLabel = sheet.getRange(HEADER_DATE_ROW, nextCol).getValue();
      if (nextLabel) {
        var nextNorm = normDate(nextLabel);
        if (nextNorm) {
          var nParts = nextNorm.split('-');
          var nextMonthCode = MONTHS_ID[parseInt(nParts[1])] || '';
          if (nextMonthCode === monthCode) {
            // Clear month/ibadah di nextCol (duplikat karena kita sisipin sebelumnya)
            var nextMonthVal = sheet.getRange(1, nextCol).getValue();
            if (String(nextMonthVal).toUpperCase() === monthCode) {
              sheet.getRange(1, nextCol).setValue('');
              sheet.getRange(2, nextCol).setValue('');
            }
          }
        }
      }

      inserted++;
    });

    SpreadsheetApp.flush();
    Logger.log('+'+inserted+' date columns di '+sheetName+' (smart insert)');
    lastCol = sheet.getLastColumn();
    dateCount = lastCol - dateStartCol + 1;
    sheetDates = sheet.getRange(HEADER_DATE_ROW, dateStartCol, 1, dateCount).getValues()[0];
  }

  // ═══ Append new members at end ═══
  var nameCount = lastRow - DATA_START_ROW + 1;
  var sheetNameRange = sheet.getRange(DATA_START_ROW, NAMA_COL, nameCount, 1).getValues();
  var existingNames = {};
  sheetNameRange.forEach(function(r) { var n=norm(r[0]); if(n) existingNames[n]=true; });

  var newMembers = members.filter(function(m) { return !existingNames[norm(m.nama)]; });
  if (newMembers.length > 0) {
    // Group new members by CG
    var newByCg = {};
    newMembers.forEach(function(m) {
      var cg = m.cg || '';
      if (!newByCg[cg]) newByCg[cg] = [];
      newByCg[cg].push(m);
    });
    // Sort each CG's new members by role + name
    Object.keys(newByCg).forEach(function(cg) {
      newByCg[cg].sort(function(a,b) {
        var ra = roleRank(a.status), rb = roleRank(b.status);
        if (ra !== rb) return ra - rb;
        return (a.nama||'').localeCompare(b.nama||'');
      });
    });

    // Build map CG → {firstRow, lastRow, count} dari sheet existing
    var cgColVals = sheet.getRange(DATA_START_ROW, CG_COL, nameCount, 1).getValues();
    var cgRanges = {};
    var curCg = null;
    for (var i = 0; i < cgColVals.length; i++) {
      var cgVal = String(cgColVals[i][0]||'').trim();
      var rowIdx = DATA_START_ROW + i;
      if (cgVal) {
        curCg = cgVal;
        cgRanges[curCg] = { firstRow: rowIdx, lastRow: rowIdx, count: 1 };
      } else if (curCg) {
        cgRanges[curCg].lastRow = rowIdx;
        cgRanges[curCg].count++;
      }
    }

    var allCgs = Object.keys(newByCg);
    var existingCgs = allCgs.filter(function(cg){ return cgRanges[cg]; });
    var newCgs = allCgs.filter(function(cg){ return !cgRanges[cg]; });

    // Insert dari bawah ke atas supaya row index CG di atasnya tidak shift
    existingCgs.sort(function(a,b){ return cgRanges[b].lastRow - cgRanges[a].lastRow; });

    var totalInserted = 0;
    existingCgs.forEach(function(cg) {
      var ms = newByCg[cg];
      var insertAfter = cgRanges[cg].lastRow;
      var startNo = cgRanges[cg].count + 1;

      sheet.insertRowsAfter(insertAfter, ms.length);

      var rowData = [];
      var rowBgs = [];
      ms.forEach(function(m, idx) {
        var bg = ROLE_BG[(m.status||'member').toLowerCase().trim()] || '#ffffff';
        rowData.push(['', startNo + idx, m.nama||'', '']);
        rowBgs.push([bg, bg, bg, bg]);
      });
      sheet.getRange(insertAfter+1, 1, rowData.length, 4).setValues(rowData).setBackgrounds(rowBgs);
      totalInserted += ms.length;
    });

    // CG baru yang belum ada → append di bawah
    if (newCgs.length > 0) {
      var lr = sheet.getLastRow();
      var appendRow = lr + 1;
      var appendData = [], appendBgs = [];
      newCgs.forEach(function(cg) {
        var ms = newByCg[cg];
        ms.forEach(function(m, idx) {
          var bg = ROLE_BG[(m.status||'member').toLowerCase().trim()] || '#ffffff';
          appendData.push([idx===0 ? cg : '', idx+1, m.nama||'', '']);
          appendBgs.push([bg, bg, bg, bg]);
        });
      });
      sheet.getRange(appendRow, 1, appendData.length, 4).setValues(appendData).setBackgrounds(appendBgs);
      totalInserted += appendData.length;
    }

    SpreadsheetApp.flush();
    Logger.log('+'+totalInserted+' member rows di '+sheetName+' (in-place per CG)');
    lastRow = sheet.getLastRow();
    nameCount = lastRow - DATA_START_ROW + 1;
    sheetNameRange = sheet.getRange(DATA_START_ROW, NAMA_COL, nameCount, 1).getValues();
  }

  // ═══ BATCH update attendance ═══
  var memberByName = {};
  members.forEach(function(m) { memberByName[norm(m.nama)] = m; });
  var dateByLabel = {};
  dates.forEach(function(d) { dateByLabel[normDate(d.label)] = d; });
  var attMap = {};
  attendance.forEach(function(a) { attMap[a.member_id+'_'+a.date_id] = a.status; });

  var dateNorms = sheetDates.map(function(d){return normDate(d);});
  var dataRange = sheet.getRange(DATA_START_ROW, dateStartCol, nameCount, dateCount);
  var curValues = dataRange.getValues();
  var curBgs = dataRange.getBackgrounds();
  var curFonts = dataRange.getFontColors();

  var changed = false;
  for (var r=0; r<nameCount; r++) {
    var sn = norm(sheetNameRange[r][0]);
    if (!sn) continue;
    var m = memberByName[sn];
    if (!m) continue;
    for (var c=0; c<dateCount; c++) {
      var dn = dateNorms[c];
      if (!dn) continue;
      var d = dateByLabel[dn];
      if (!d) continue;
      var st = attMap[m.id+'_'+d.id];
      var val = STATUS_MAP[st] || '';
      if (curValues[r][c] !== val) {
        curValues[r][c] = val;
        curBgs[r][c] = STATUS_BG[val] || null;
        curFonts[r][c] = STATUS_FONT[val] || null;
        changed = true;
      }
    }
  }
  if (changed) {
    dataRange.setValues(curValues);
    dataRange.setBackgrounds(curBgs);
    dataRange.setFontColors(curFonts);
  }
  SpreadsheetApp.flush();
  Logger.log('Absensi '+sheetName+' synced');
}

function syncDetail(region, sheetName) {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(sheetName);
  if (!sheet) return;
  var members = fetchSupabase('/rest/v1/members?select=*&region=eq.'+region);
  if (!members || members.length === 0) return;

  var lastRow = sheet.getLastRow();
  if (lastRow < DETAIL_DATA_ROW) {
    // Empty — full rebuild
    rebuildDetailSheet(sheetName, members);
    return;
  }

  var dataCount = lastRow - DETAIL_DATA_ROW + 1;
  var names = sheet.getRange(DETAIL_DATA_ROW, DETAIL_COLS.nama, dataCount, 1).getValues();
  var nameToRow = {};
  for (var i=0; i<names.length; i++) {
    var nn = norm(names[i][0]);
    if (nn) nameToRow[nn] = DETAIL_DATA_ROW + i;
  }

  // Append new members — in-place per CG (sisipkan ke grup masing-masing)
  var newMembers = members.filter(function(m) { return !nameToRow[norm(m.nama)]; });
  if (newMembers.length > 0) {
    // Group by CG + sort per role
    var newByCg = {};
    newMembers.forEach(function(m) {
      var cg = m.cg || '';
      if (!newByCg[cg]) newByCg[cg] = [];
      newByCg[cg].push(m);
    });
    Object.keys(newByCg).forEach(function(cg) {
      newByCg[cg].sort(function(a,b) {
        var ra = roleRank(a.status), rb = roleRank(b.status);
        if (ra !== rb) return ra - rb;
        return (a.nama||'').localeCompare(b.nama||'');
      });
    });

    // Map CG → {firstRow, lastRow, count}
    var cgColVals = sheet.getRange(DETAIL_DATA_ROW, DETAIL_COLS.cg, dataCount, 1).getValues();
    var cgRanges = {};
    var curCg = null;
    for (var i=0; i<cgColVals.length; i++) {
      var cgVal = String(cgColVals[i][0]||'').trim();
      var rowIdx = DETAIL_DATA_ROW + i;
      if (cgVal) {
        curCg = cgVal;
        cgRanges[curCg] = { firstRow: rowIdx, lastRow: rowIdx, count: 1 };
      } else if (curCg) {
        cgRanges[curCg].lastRow = rowIdx;
        cgRanges[curCg].count++;
      }
    }

    var allCgs = Object.keys(newByCg);
    var existingCgs = allCgs.filter(function(cg){ return cgRanges[cg]; });
    var newCgs = allCgs.filter(function(cg){ return !cgRanges[cg]; });

    // Insert dari bawah ke atas
    existingCgs.sort(function(a,b){ return cgRanges[b].lastRow - cgRanges[a].lastRow; });

    var buildRow = function(m, no, withCg) {
      return [
        withCg ? (m.cg||'') : '', no, m.nama||'', m.status||'',
        m.lahir||'', m.wa||'', m.kelurahan||'', m.kecamatan||'',
        m.msj1?'TRUE':'FALSE', m.msj2?'TRUE':'FALSE', m.msj3?'TRUE':'FALSE',
        m.cgt1?'TRUE':'FALSE', m.cgt2?'TRUE':'FALSE', m.cgt3?'TRUE':'FALSE',
        m.baptis_air?'TRUE':'FALSE', m.baptis_roh?'TRUE':'FALSE',
        m.sekolah||'', m.kelas||''
      ];
    };
    var buildMs = function(m) {
      var bgs=[], fcs=[];
      ['msj1','msj2','msj3','cgt1','cgt2','cgt3','baptis_air','baptis_roh'].forEach(function(f){
        if (m[f]) { bgs.push('#c6efce'); fcs.push('#276221'); }
        else { bgs.push('#ffc7ce'); fcs.push('#9c0006'); }
      });
      return { bgs: bgs, fcs: fcs };
    };

    var totalInserted = 0;
    existingCgs.forEach(function(cg) {
      var ms = newByCg[cg];
      var insertAfter = cgRanges[cg].lastRow;
      var startNo = cgRanges[cg].count + 1;
      sheet.insertRowsAfter(insertAfter, ms.length);
      var rowData = [], msBgs = [], msFonts = [];
      ms.forEach(function(m, idx) {
        rowData.push(buildRow(m, startNo+idx, false)); // CG col blank krn bukan first
        var msc = buildMs(m); msBgs.push(msc.bgs); msFonts.push(msc.fcs);
      });
      sheet.getRange(insertAfter+1, 1, rowData.length, 18).setValues(rowData);
      sheet.getRange(insertAfter+1, DETAIL_COLS.msj1, rowData.length, 8).setBackgrounds(msBgs).setFontColors(msFonts);
      totalInserted += ms.length;
    });

    if (newCgs.length > 0) {
      var lr = sheet.getLastRow();
      var appendRow = lr + 1;
      var rowData = [], msBgs = [], msFonts = [];
      newCgs.forEach(function(cg) {
        newByCg[cg].forEach(function(m, idx) {
          rowData.push(buildRow(m, idx+1, idx===0));
          var msc = buildMs(m); msBgs.push(msc.bgs); msFonts.push(msc.fcs);
        });
      });
      sheet.getRange(appendRow, 1, rowData.length, 18).setValues(rowData);
      sheet.getRange(appendRow, DETAIL_COLS.msj1, rowData.length, 8).setBackgrounds(msBgs).setFontColors(msFonts);
      totalInserted += rowData.length;
    }

    SpreadsheetApp.flush();
    Logger.log('+'+totalInserted+' detail rows di '+sheetName+' (in-place per CG)');
    // Refresh row mapping
    lastRow = sheet.getLastRow();
    dataCount = lastRow - DETAIL_DATA_ROW + 1;
    names = sheet.getRange(DETAIL_DATA_ROW, DETAIL_COLS.nama, dataCount, 1).getValues();
    nameToRow = {};
    for (var i=0; i<names.length; i++) {
      var nn = norm(names[i][0]);
      if (nn) nameToRow[nn] = DETAIL_DATA_ROW + i;
    }
  }

  // BATCH update existing
  var statusRange = sheet.getRange(DETAIL_DATA_ROW, DETAIL_COLS.status, dataCount, 5);
  var statusValues = statusRange.getValues();
  var msRange = sheet.getRange(DETAIL_DATA_ROW, DETAIL_COLS.msj1, dataCount, 8);
  var msValues = msRange.getValues();
  var msBgs = msRange.getBackgrounds();
  var msFonts = msRange.getFontColors();
  var sekRange = sheet.getRange(DETAIL_DATA_ROW, DETAIL_COLS.sekolah, dataCount, 2);
  var sekValues = sekRange.getValues();

  var cs=false, cm=false, ck=false;
  members.forEach(function(m) {
    var r = nameToRow[norm(m.nama)];
    if (!r) return;
    var i = r - DETAIL_DATA_ROW;
    var ns = [m.status||'',m.lahir||'',m.wa||'',m.kelurahan||'',m.kecamatan||''];
    for (var k=0;k<5;k++) if (String(statusValues[i][k])!==String(ns[k])) { statusValues[i][k]=ns[k]; cs=true; }
    var nm = [m.msj1?'TRUE':'FALSE',m.msj2?'TRUE':'FALSE',m.msj3?'TRUE':'FALSE',m.cgt1?'TRUE':'FALSE',m.cgt2?'TRUE':'FALSE',m.cgt3?'TRUE':'FALSE',m.baptis_air?'TRUE':'FALSE',m.baptis_roh?'TRUE':'FALSE'];
    for (var k=0;k<8;k++) {
      if (String(msValues[i][k])!==nm[k]) {
        msValues[i][k]=nm[k];
        msBgs[i][k] = nm[k]==='TRUE'?'#c6efce':'#ffc7ce';
        msFonts[i][k] = nm[k]==='TRUE'?'#276221':'#9c0006';
        cm=true;
      }
    }
    var nk=[m.sekolah||'',m.kelas||''];
    for (var k=0;k<2;k++) if (String(sekValues[i][k])!==String(nk[k])) { sekValues[i][k]=nk[k]; ck=true; }
  });
  if (cs) statusRange.setValues(statusValues);
  if (cm) { msRange.setValues(msValues); msRange.setBackgrounds(msBgs); msRange.setFontColors(msFonts); }
  if (ck) sekRange.setValues(sekValues);
  SpreadsheetApp.flush();
  Logger.log('Detail '+sheetName+' synced');
}

// ═══════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════
function fetchSupabase(path) {
  try {
    var r = UrlFetchApp.fetch(SUPABASE_URL+path, {
      method:'GET',
      headers:{'apikey':SUPABASE_KEY,'Authorization':'Bearer '+SUPABASE_KEY,'Content-Type':'application/json'},
      muteHttpExceptions:true
    });
    if (r.getResponseCode()!==200) return null;
    return JSON.parse(r.getContentText());
  } catch(e) { return null; }
}

function norm(s) { return String(s||'').trim().toLowerCase().replace(/\s+/g,' '); }

function roleRank(s) {
  var k = (s||'member').toLowerCase().trim();
  return ROLE_ORDER[k] !== undefined ? ROLE_ORDER[k] : 5;
}

function normDate(s) {
  if (s instanceof Date) {
    // Pakai timezone Asia/Jakarta supaya konsisten tanpa tergantung script TZ
    var jktStr = Utilities.formatDate(s, 'Asia/Jakarta', 'd-M');
    return jktStr;
  }
  s = String(s||'').trim();
  if (!s) return '';

  // ISO format: 2026-01-03 atau 2026/01/03 → year first (>31)
  var iso = s.match(/^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})/);
  if (iso) return parseInt(iso[3])+'-'+parseInt(iso[2]);

  // English "Sun Jan 3 2026" or "Sunday Jan 3"
  var dm = s.match(/^\w+\s+(\w+)\s+(\d+)/);
  if (dm) {
    var mo2 = {Jan:1,Feb:2,Mar:3,Apr:4,May:5,Jun:6,Jul:7,Aug:8,Sep:9,Oct:10,Nov:11,Dec:12};
    if (mo2[dm[1]]) return parseInt(dm[2])+'-'+mo2[dm[1]];
  }

  // Indonesian/English "3 Januari" / "3 Jan" / "3 January"
  var mo = {
    jan:1,januari:1,january:1,
    feb:2,februari:2,february:2,
    mar:3,maret:3,march:3,
    apr:4,april:4,
    mei:5,may:5,
    jun:6,juni:6,june:6,
    jul:7,juli:7,july:7,
    agu:8,agt:8,agustus:8,aug:8,august:8,
    sep:9,september:9,
    okt:10,oktober:10,oct:10,october:10,
    nov:11,november:11,
    des:12,desember:12,dec:12,december:12
  };
  var m = s.match(/^(\d+)\s+([a-zA-Z]+)/);
  if (m) {
    var n = mo[m[2].toLowerCase()];
    if (n) return parseInt(m[1])+'-'+n;
  }

  // DD-MM-YY or DD/MM/YYYY: 3-1-26 atau 3/1/2026
  m = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-]/);
  if (m) return parseInt(m[1])+'-'+parseInt(m[2]);

  // DD-MM
  m = s.match(/^(\d{1,2})[\/\-](\d{1,2})$/);
  if (m) return parseInt(m[1])+'-'+parseInt(m[2]);

  return s.toLowerCase();
}

// Hapus kolom tanggal duplikat (same normDate) — keep yang punya data, hapus yang kosong
function dedupDateColumns(sheet, dateStartCol) {
  var lastCol = sheet.getLastColumn();
  var lastRow = sheet.getLastRow();
  if (lastCol < dateStartCol || lastRow < DATA_START_ROW) return 0;
  var dateCount = lastCol - dateStartCol + 1;
  var sheetDates = sheet.getRange(HEADER_DATE_ROW, dateStartCol, 1, dateCount).getValues()[0];
  var nameCount = lastRow - DATA_START_ROW + 1;
  if (nameCount <= 0) return 0;
  var dataBlock = sheet.getRange(DATA_START_ROW, dateStartCol, nameCount, dateCount).getValues();

  // Map normDate → array of {col, hasData}
  var seen = {};
  for (var c = 0; c < dateCount; c++) {
    var nd = normDate(sheetDates[c]);
    if (!nd) continue;
    var has = false;
    for (var r = 0; r < nameCount; r++) {
      if (String(dataBlock[r][c]||'').trim() !== '') { has = true; break; }
    }
    if (!seen[nd]) seen[nd] = [];
    seen[nd].push({ col: dateStartCol + c, hasData: has });
  }

  // Untuk setiap nd dengan >1 entry: keep one dengan data; hapus yang lain
  var deleteCols = [];
  Object.keys(seen).forEach(function(nd) {
    var arr = seen[nd];
    if (arr.length < 2) return;
    // Sort: yang punya data dulu, lalu yang kiri
    arr.sort(function(a,b){
      if (a.hasData !== b.hasData) return a.hasData ? -1 : 1;
      return a.col - b.col;
    });
    // Keep arr[0], rest hapus
    for (var i = 1; i < arr.length; i++) deleteCols.push(arr[i].col);
  });

  // Hapus dari kanan ke kiri supaya index tidak shift
  deleteCols.sort(function(a,b){ return b - a; });
  deleteCols.forEach(function(col) { sheet.deleteColumn(col); });
  if (deleteCols.length > 0) {
    SpreadsheetApp.flush();
    Logger.log('Dedup: hapus '+deleteCols.length+' kolom tanggal duplikat di '+sheet.getName());
  }
  return deleteCols.length;
}
