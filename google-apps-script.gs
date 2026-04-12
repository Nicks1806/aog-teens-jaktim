// ============================================================
// AOG Teens Jaktim — Auto Sync Supabase → Google Sheets
// Support: JAKTIM 1 & JAKTIM 2 (dual region)
//
// SETUP:
// 1. Buat Google Spreadsheet dengan 4 tab:
//    - "JAKTIM 1"       (absensi jaktim 1)
//    - "JAKTIM 2"       (absensi jaktim 2)
//    - "DETAIL JAKTIM 1" (detail member jaktim 1)
//    - "DETAIL JAKTIM 2" (detail member jaktim 2)
// 2. Paste kode ini di Extensions → Apps Script
// 3. Isi SUPABASE_URL dan SUPABASE_KEY di bawah
// 4. Klik tombol "▶ syncAll" sekali untuk test
// 5. Klik "Triggers (jam)" → tambah trigger runAutoSync tiap 5 menit
// ============================================================

// ── CONFIG ───────────────────────────────────────────────────
const SUPABASE_URL  = 'https://gqppviugodokncxezdwd.supabase.co';
const SUPABASE_KEY  = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdxcHB2aXVnb2Rva25jeGV6ZHdkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ4NjIwOTcsImV4cCI6MjA5MDQzODA5N30.w2oUJYWk4yr_tJQuhk0UyxJKwgH1C3FkmJB6CXclSpk';

// Sheet config per region
const REGION_CONFIG = {
  jaktim1: {
    sheetAbsensi: 'JAKTIM 1',
    sheetDetail:  'DETAIL JAKTIM 1',
  },
  jaktim2: {
    sheetAbsensi: 'JAKTIM 2',
    sheetDetail:  'DETAIL JAKTIM 2',
  }
};

// Layout config (sama untuk kedua region)
const HEADER_DATE_ROW = 3;   // Row 3 = tanggal
const DATA_START_ROW  = 4;   // Row 4 = mulai data nama
const NAMA_COL        = 3;   // Kolom C = Nama
const CG_COL          = 1;   // Kolom A = CG
const NO_COL          = 2;   // Kolom B = No
const DATE_START_COL  = 5;   // Kolom E = tanggal pertama

// Detail sheet layout
const DETAIL_HEADER_ROW = 3;
const DETAIL_DATA_ROW   = 4;
const DETAIL_COLS = {
  cg: 1, no: 2, nama: 3, status: 4, lahir: 5, wa: 6,
  kelurahan: 7, kecamatan: 8,
  msj1: 9, msj2: 10, msj3: 11, cgt1: 12, cgt2: 13, cgt3: 14,
  baptisAir: 15, baptisRoh: 16,
  sekolah: 17, kelas: 18
};

const STATUS_COLORS = {
  'Hadir': { bg:'#c6efce', font:'#276221' },
  'Izin':  { bg:'#bdd7ee', font:'#1f497d' },
  'Sakit': { bg:'#ffeb9c', font:'#9c6500' },
  'Alpa':  { bg:'#ffc7ce', font:'#9c0006' },
  '':      { bg:null,      font:null      },
};

// ── WEB APP ENDPOINT ─────────────────────────────────────────
function doGet(e) {
  var action = (e.parameter.action || '').trim();
  var region = (e.parameter.region || 'jaktim1').trim();
  var callback = e.parameter.callback || '';

  if (action === 'ping') {
    return jsonpResponse(callback, { ok: true, message: 'Connected! Region: ' + region });
  }

  if (action === 'syncAll') {
    syncRegion(region);
    return jsonpResponse(callback, { ok: true, message: 'Sync ' + region + ' selesai!' });
  }

  if (action === 'update_attendance') {
    var data = {};
    try {
      data = JSON.parse(decodeURIComponent(e.parameter.data || '{}'));
    } catch(ex) { data = e.parameter; }
    var r = data.region || region;
    updateSingleAttendance(data.nama, data.tanggal, data.status, r);
    return jsonpResponse(callback, { ok: true });
  }

  if (action === 'update_detail') {
    var data = {};
    try {
      data = JSON.parse(decodeURIComponent(e.parameter.data || '{}'));
    } catch(ex) { data = e.parameter; }
    var r = data.region || region;
    updateSingleDetail(data.nama, data.fields || data, r);
    return jsonpResponse(callback, { ok: true });
  }

  return jsonpResponse(callback, { ok: false, message: 'Unknown action: ' + action });
}

function jsonpResponse(callback, obj) {
  if (callback) {
    return ContentService.createTextOutput(callback + '(' + JSON.stringify(obj) + ')')
      .setMimeType(ContentService.MimeType.JAVASCRIPT);
  }
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

// ── MAIN SYNC: Sync satu region ──────────────────────────────
function syncRegion(region) {
  region = region || 'jaktim1';
  var cfg = REGION_CONFIG[region];
  if (!cfg) { Logger.log('❌ Region tidak dikenal: ' + region); return; }

  Logger.log('🔄 Sync ' + region + '...');
  syncAbsensi(region, cfg.sheetAbsensi);
  syncDetail(region, cfg.sheetDetail);
  Logger.log('✅ Sync ' + region + ' selesai!');
}

// ── SYNC ABSENSI ─────────────────────────────────────────────
function syncAbsensi(region, sheetName) {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(sheetName);
  if (!sheet) { Logger.log('❌ Sheet tidak ditemukan: ' + sheetName); return; }

  // Fetch dari Supabase dengan filter region
  var members = fetchSupabase('/rest/v1/members?select=id,nama,cg&region=eq.' + region + '&order=cg,nama');
  var dates = fetchSupabase('/rest/v1/dates?select=id,label,month_code&region=eq.' + region + '&order=sort_order');
  var attendance = fetchSupabase('/rest/v1/attendance?select=member_id,date_id,status');

  if (!members || !dates || !attendance) { Logger.log('❌ Gagal fetch data'); return; }
  Logger.log('✓ ' + region + ' - Members: ' + members.length + ', Dates: ' + dates.length + ', Att: ' + attendance.length);

  // Build lookup maps
  var memberMap = {};
  members.forEach(function(m) { memberMap[m.id] = m; });
  var memberIds = new Set(members.map(function(m) { return m.id; }));

  var dateMap = {};
  dates.forEach(function(d) { dateMap[d.id] = d.label; });
  var dateIds = new Set(dates.map(function(d) { return d.id; }));

  // Build attendance lookup: nama → {dateLabel → status}
  var attMap = {};
  attendance.forEach(function(a) {
    if (!memberIds.has(a.member_id)) return; // skip other region
    if (!dateIds.has(a.date_id)) return;
    var m = memberMap[a.member_id];
    if (!m) return;
    if (!attMap[m.nama]) attMap[m.nama] = {};
    attMap[m.nama][dateMap[a.date_id]] = a.status;
  });

  // Get sheet date headers
  var lastCol = sheet.getLastColumn();
  var dateCount = lastCol - DATE_START_COL + 1;
  if (dateCount < 1) { Logger.log('⚠️ Tidak ada kolom tanggal'); return; }
  var sheetDates = sheet.getRange(HEADER_DATE_ROW, DATE_START_COL, 1, dateCount).getValues()[0];

  // Get all names in sheet
  var lastRow = sheet.getLastRow();
  var nameCount = lastRow - DATA_START_ROW + 1;
  if (nameCount < 1) { Logger.log('⚠️ Tidak ada data di sheet'); return; }
  var sheetNames = sheet.getRange(DATA_START_ROW, NAMA_COL, nameCount, 1).getValues();

  // Update cells
  var updated = 0;
  sheetNames.forEach(function(row, ri) {
    var sheetNama = norm(row[0]);
    if (!sheetNama) return;

    var supabaseName = Object.keys(attMap).find(function(n) { return norm(n) === sheetNama; });
    if (!supabaseName) return;

    var memberAtt = attMap[supabaseName];
    var memberRow = DATA_START_ROW + ri;

    sheetDates.forEach(function(sheetDate, ci) {
      var dateLabel = normDate(String(sheetDate));
      var attKey = Object.keys(memberAtt).find(function(k) { return normDate(k) === dateLabel; });
      if (!attKey) return;

      var status = memberAtt[attKey] || '';
      var statusMap = { H:'Hadir', I:'Izin', S:'Sakit', A:'Alpa' };
      var val = statusMap[status] || status;

      var cell = sheet.getRange(memberRow, DATE_START_COL + ci);
      if (cell.getValue() !== val) {
        cell.setValue(val);
        applyColor(cell, val);
        updated++;
      }
    });
  });

  SpreadsheetApp.flush();
  Logger.log('✓ Absensi ' + sheetName + ': ' + updated + ' cell diupdate.');
}

// ── SYNC DETAIL ──────────────────────────────────────────────
function syncDetail(region, sheetName) {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(sheetName);
  if (!sheet) {
    Logger.log('⚠️ Sheet detail tidak ditemukan: ' + sheetName + ' — buat dulu!');
    sheet = createDetailSheet(sheetName);
    if (!sheet) return;
  }

  var members = fetchSupabase('/rest/v1/members?select=*&region=eq.' + region + '&order=cg,nama');
  if (!members || members.length === 0) { Logger.log('⚠️ Tidak ada members untuk ' + region); return; }

  // Group by CG
  var cgOrder = [];
  var cgMap = {};
  members.forEach(function(m) {
    if (!cgMap[m.cg]) { cgMap[m.cg] = []; cgOrder.push(m.cg); }
    cgMap[m.cg].push(m);
  });

  // Write headers if empty
  var headerCheck = sheet.getRange(DETAIL_HEADER_ROW, 1).getValue();
  if (!headerCheck) {
    writeDetailHeaders(sheet);
  }

  // Clear data area & write fresh
  var dataRows = members.length + cgOrder.length; // members + CG header spacers
  if (sheet.getLastRow() >= DETAIL_DATA_ROW) {
    sheet.getRange(DETAIL_DATA_ROW, 1, Math.max(sheet.getLastRow() - DETAIL_DATA_ROW + 1, 1), 18).clear();
  }

  var row = DETAIL_DATA_ROW;
  var no = 0;
  cgOrder.forEach(function(cg) {
    no = 0;
    cgMap[cg].forEach(function(m, idx) {
      no++;
      sheet.getRange(row, DETAIL_COLS.cg).setValue(idx === 0 ? cg : '');
      sheet.getRange(row, DETAIL_COLS.no).setValue(no);
      sheet.getRange(row, DETAIL_COLS.nama).setValue(m.nama || '');
      sheet.getRange(row, DETAIL_COLS.status).setValue(m.status || '');
      sheet.getRange(row, DETAIL_COLS.lahir).setValue(m.lahir || '');
      sheet.getRange(row, DETAIL_COLS.wa).setValue(m.wa || '');
      sheet.getRange(row, DETAIL_COLS.kelurahan).setValue(m.kelurahan || '');
      sheet.getRange(row, DETAIL_COLS.kecamatan).setValue(m.kecamatan || '');
      sheet.getRange(row, DETAIL_COLS.msj1).setValue(m.msj1 ? 'TRUE' : 'FALSE');
      sheet.getRange(row, DETAIL_COLS.msj2).setValue(m.msj2 ? 'TRUE' : 'FALSE');
      sheet.getRange(row, DETAIL_COLS.msj3).setValue(m.msj3 ? 'TRUE' : 'FALSE');
      sheet.getRange(row, DETAIL_COLS.cgt1).setValue(m.cgt1 ? 'TRUE' : 'FALSE');
      sheet.getRange(row, DETAIL_COLS.cgt2).setValue(m.cgt2 ? 'TRUE' : 'FALSE');
      sheet.getRange(row, DETAIL_COLS.cgt3).setValue(m.cgt3 ? 'TRUE' : 'FALSE');
      sheet.getRange(row, DETAIL_COLS.baptisAir).setValue(m.baptis_air ? 'TRUE' : 'FALSE');
      sheet.getRange(row, DETAIL_COLS.baptisRoh).setValue(m.baptis_roh ? 'TRUE' : 'FALSE');
      sheet.getRange(row, DETAIL_COLS.sekolah).setValue(m.sekolah || '');
      sheet.getRange(row, DETAIL_COLS.kelas).setValue(m.kelas || '');

      // Color TRUE/FALSE cells
      for (var c = DETAIL_COLS.msj1; c <= DETAIL_COLS.baptisRoh; c++) {
        var cell = sheet.getRange(row, c);
        var v = cell.getValue();
        if (v === 'TRUE') {
          cell.setBackground('#c6efce').setFontColor('#276221');
        } else {
          cell.setBackground('#ffc7ce').setFontColor('#9c0006');
        }
      }
      row++;
    });
  });

  SpreadsheetApp.flush();
  Logger.log('✓ Detail ' + sheetName + ': ' + members.length + ' members diupdate.');
}

// ── CREATE DETAIL SHEET ──────────────────────────────────────
function createDetailSheet(name) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.insertSheet(name);
  writeDetailHeaders(sheet);
  return sheet;
}

function writeDetailHeaders(sheet) {
  var headers = ['CG', 'No', 'Nama', 'Status', 'Tanggal Lahir', 'NO WA',
                 'Kelurahan', 'Kecamatan',
                 'MSJ 1', 'MSJ 2', 'MSJ 3', 'CGT 1', 'CGT 2', 'CGT 3',
                 'B. Air', 'B. Roh Kudus', 'Sekolah', 'Kelas'];

  // Write title row
  sheet.getRange(1, 1).setValue('DETAIL MEMBER').setFontWeight('bold').setFontSize(14);
  // Write sub-headers in row 2
  sheet.getRange(2, 7).setValue('Lokasi').setFontWeight('bold');
  sheet.getRange(2, 9).setValue('EDUKASI').setFontWeight('bold');
  sheet.getRange(2, 15).setValue('Baptisan').setFontWeight('bold');
  // Write headers in row 3
  headers.forEach(function(h, i) {
    var cell = sheet.getRange(DETAIL_HEADER_ROW, i + 1);
    cell.setValue(h).setFontWeight('bold').setBackground('#d9e2f3').setFontColor('#1f497d');
  });
  // Auto-resize
  for (var i = 1; i <= 18; i++) sheet.autoResizeColumn(i);
}

// ── UPDATE SINGLE ATTENDANCE (dari web app) ──────────────────
function updateSingleAttendance(nama, tanggal, status, region) {
  region = region || 'jaktim1';
  var cfg = REGION_CONFIG[region];
  if (!cfg) return;

  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(cfg.sheetAbsensi);
  if (!sheet) return;

  var statusMap = { H:'Hadir', I:'Izin', S:'Sakit', A:'Alpa' };
  var val = statusMap[status] || status || '';

  // Find name row
  var lastRow = sheet.getLastRow();
  var nameCount = lastRow - DATA_START_ROW + 1;
  if (nameCount < 1) return;
  var names = sheet.getRange(DATA_START_ROW, NAMA_COL, nameCount, 1).getValues();
  var targetRow = -1;
  var normNama = norm(nama);
  for (var i = 0; i < names.length; i++) {
    if (norm(names[i][0]) === normNama) { targetRow = DATA_START_ROW + i; break; }
  }
  if (targetRow < 0) return;

  // Find date column
  var lastCol = sheet.getLastColumn();
  var dateCount = lastCol - DATE_START_COL + 1;
  if (dateCount < 1) return;
  var sheetDates = sheet.getRange(HEADER_DATE_ROW, DATE_START_COL, 1, dateCount).getValues()[0];
  var targetCol = -1;
  var normTgl = normDate(tanggal);
  for (var j = 0; j < sheetDates.length; j++) {
    if (normDate(String(sheetDates[j])) === normTgl) { targetCol = DATE_START_COL + j; break; }
  }
  if (targetCol < 0) return;

  var cell = sheet.getRange(targetRow, targetCol);
  cell.setValue(val);
  applyColor(cell, val);
  SpreadsheetApp.flush();
}

// ── UPDATE SINGLE DETAIL (dari web app) ──────────────────────
function updateSingleDetail(nama, fields, region) {
  region = region || 'jaktim1';
  var cfg = REGION_CONFIG[region];
  if (!cfg) return;

  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(cfg.sheetDetail);
  if (!sheet) return;

  // Find name row
  var lastRow = sheet.getLastRow();
  var dataCount = lastRow - DETAIL_DATA_ROW + 1;
  if (dataCount < 1) return;
  var names = sheet.getRange(DETAIL_DATA_ROW, DETAIL_COLS.nama, dataCount, 1).getValues();
  var targetRow = -1;
  var normNama = norm(nama);
  for (var i = 0; i < names.length; i++) {
    if (norm(names[i][0]) === normNama) { targetRow = DETAIL_DATA_ROW + i; break; }
  }
  if (targetRow < 0) return;

  // Update fields
  if (fields.status !== undefined) sheet.getRange(targetRow, DETAIL_COLS.status).setValue(fields.status);
  if (fields.lahir !== undefined) sheet.getRange(targetRow, DETAIL_COLS.lahir).setValue(fields.lahir);
  if (fields.wa !== undefined) sheet.getRange(targetRow, DETAIL_COLS.wa).setValue(fields.wa);
  if (fields.kelurahan !== undefined) sheet.getRange(targetRow, DETAIL_COLS.kelurahan).setValue(fields.kelurahan);
  if (fields.kecamatan !== undefined) sheet.getRange(targetRow, DETAIL_COLS.kecamatan).setValue(fields.kecamatan);
  if (fields.sekolah !== undefined) sheet.getRange(targetRow, DETAIL_COLS.sekolah).setValue(fields.sekolah);
  if (fields.kelas !== undefined) sheet.getRange(targetRow, DETAIL_COLS.kelas).setValue(fields.kelas);

  // Milestone booleans
  var boolFields = {msj1:'msj1',msj2:'msj2',msj3:'msj3',cgt1:'cgt1',cgt2:'cgt2',cgt3:'cgt3',
                    baptis_air:'baptisAir',baptis_roh:'baptisRoh'};
  for (var key in boolFields) {
    var col = DETAIL_COLS[boolFields[key]] || DETAIL_COLS[key];
    if (col && fields[key] !== undefined) {
      var cell = sheet.getRange(targetRow, col);
      var val = fields[key] ? 'TRUE' : 'FALSE';
      cell.setValue(val);
      if (val === 'TRUE') cell.setBackground('#c6efce').setFontColor('#276221');
      else cell.setBackground('#ffc7ce').setFontColor('#9c0006');
    }
  }

  SpreadsheetApp.flush();
}

// ── SYNC SEMUA (kedua region) ────────────────────────────────
function syncAll() {
  syncRegion('jaktim1');
  syncRegion('jaktim2');
}

// Auto-sync trigger
function runAutoSync() {
  try { syncAll(); }
  catch(e) { Logger.log('❌ Auto-sync error: ' + e.message); }
}

// ── SUPABASE FETCH ───────────────────────────────────────────
function fetchSupabase(path) {
  var url = SUPABASE_URL + path;
  var options = {
    method: 'GET',
    headers: {
      'apikey': SUPABASE_KEY,
      'Authorization': 'Bearer ' + SUPABASE_KEY,
      'Content-Type': 'application/json'
    },
    muteHttpExceptions: true
  };
  try {
    var response = UrlFetchApp.fetch(url, options);
    if (response.getResponseCode() !== 200) {
      Logger.log('❌ HTTP ' + response.getResponseCode() + ' dari ' + path);
      return null;
    }
    return JSON.parse(response.getContentText());
  } catch(e) {
    Logger.log('❌ Fetch error: ' + e.message);
    return null;
  }
}

// ── HELPERS ──────────────────────────────────────────────────
function norm(s) {
  return String(s||'').trim().toLowerCase().replace(/\s+/g,' ');
}

function normDate(s) {
  s = String(s||'').trim();
  var mo = {jan:1,feb:2,mar:3,apr:4,mei:5,may:5,jun:6,jul:7,
            agu:8,aug:8,sep:9,okt:10,oct:10,nov:11,des:12,dec:12};
  var m = s.match(/^(\d+)\s+([a-zA-Z]+)/);
  if (m) { var n=mo[m[2].toLowerCase()]; return n ? m[1]+'-'+n : s.toLowerCase(); }
  m = s.match(/^(\d+)[\/\-](\d+)[\/\-]/);
  if (m) return m[1]+'-'+parseInt(m[2]);
  m = s.match(/^(\d+)[\/\-](\d+)$/);
  if (m) return m[1]+'-'+parseInt(m[2]);
  return s.toLowerCase();
}

function applyColor(cell, status) {
  var c = STATUS_COLORS[status] || STATUS_COLORS[''];
  if (c.bg) { cell.setBackground(c.bg); cell.setFontColor(c.font); }
  else { cell.setBackground(null); cell.setFontColor(null); }
}

// ── DEBUG ────────────────────────────────────────────────────
function debugNamaMismatch() {
  ['jaktim1','jaktim2'].forEach(function(region) {
    var cfg = REGION_CONFIG[region];
    var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(cfg.sheetAbsensi);
    if (!sheet) return;
    var members = fetchSupabase('/rest/v1/members?select=id,nama&region=eq.' + region);
    if (!members) return;
    var supaNames = members.map(function(m) { return norm(m.nama); });
    var lastRow = sheet.getLastRow();
    var sheetNames = sheet.getRange(DATA_START_ROW, NAMA_COL, lastRow - DATA_START_ROW + 1, 1).getValues();
    Logger.log('=== ' + region.toUpperCase() + ' ===');
    sheetNames.forEach(function(row) {
      var sn = norm(row[0]);
      if (!sn) return;
      Logger.log((supaNames.indexOf(sn) >= 0 ? '✓ ' : '❌ ') + '"' + row[0] + '"');
    });
  });
}

// ============================================================
// SETUP:
// 1. Buat 4 tab di Google Sheets:
//    "JAKTIM 1", "JAKTIM 2", "DETAIL JAKTIM 1", "DETAIL JAKTIM 2"
// 2. Tab JAKTIM 1 & 2: Row 3 = tanggal, Row 4+ = data
// 3. Paste kode ini → Deploy as Web App
// 4. Set trigger runAutoSync tiap 5 menit
// 5. Paste URL deployment di web app (📊 icon)
// ============================================================
