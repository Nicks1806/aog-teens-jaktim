// ============================================================
// AOG Teens Jaktim — Auto Sync Supabase → Google Sheets
// PILIHAN B: Auto-insert kolom tanggal & baris member baru (sorted)
// ============================================================

const SUPABASE_URL  = 'https://gqppviugodokncxezdwd.supabase.co';
const SUPABASE_KEY  = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdxcHB2aXVnb2Rva25jeGV6ZHdkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ4NjIwOTcsImV4cCI6MjA5MDQzODA5N30.w2oUJYWk4yr_tJQuhk0UyxJKwgH1C3FkmJB6CXclSpk';

const REGION_CONFIG = {
  jaktim1: { sheetAbsensi: 'JAKTIM 1', sheetDetail: 'DETAIL JAKTIM 1 ', dateStartCol: 5 },
  jaktim2: { sheetAbsensi: 'JAKTIM 2', sheetDetail: 'DETAIL JAKTIM 2 ', dateStartCol: 4 }
};

const HEADER_DATE_ROW = 3;
const DATA_START_ROW  = 4;
const NAMA_COL        = 3;
const CG_COL          = 1;
const NO_COL          = 2;
const DETAIL_DATA_ROW = 4;
const DETAIL_COLS = {cg:1,no:2,nama:3,status:4,lahir:5,wa:6,kelurahan:7,kecamatan:8,msj1:9,msj2:10,msj3:11,cgt1:12,cgt2:13,cgt3:14,baptisAir:15,baptisRoh:16,sekolah:17,kelas:18};

const STATUS_COLORS = {'Hadir':{bg:'#c6efce',font:'#276221'},'Izin':{bg:'#bdd7ee',font:'#1f497d'},'Sakit':{bg:'#ffeb9c',font:'#9c6500'},'Alpa':{bg:'#ffc7ce',font:'#9c0006'},'':{bg:null,font:null}};

// Role priority for sorting members within a CG
const ROLE_ORDER = {'cgl':0,'leader':0,'sponsor':1,'member':2,'simpatisan':3,'vip':4};
function roleRank(s){return ROLE_ORDER[(s||'member').toLowerCase().trim()] !== undefined ? ROLE_ORDER[(s||'member').toLowerCase().trim()] : 5;}

const MONTHS_ID = {1:'JAN',2:'FEB',3:'MAR',4:'APR',5:'MEI',6:'JUN',7:'JUL',8:'AGS',9:'SEP',10:'OKT',11:'NOV',12:'DES'};

// Max inserts per run (avoid timeout)
const MAX_INSERTS_PER_RUN = 5;

// ───────────────────────────────────────────────────────────
// WEB APP ENDPOINT
// ───────────────────────────────────────────────────────────
function doGet(e){
  var action=(e.parameter.action||'').trim(),region=(e.parameter.region||'jaktim1').trim(),callback=e.parameter.callback||'';
  if(action==='ping') return jr(callback,{ok:true,message:'Connected!'});
  if(action==='syncAll'){syncRegion(region);return jr(callback,{ok:true,message:'Sync '+region+' selesai!'});}
  return jr(callback,{ok:false,message:'Unknown action'});
}
function jr(cb,obj){if(cb)return ContentService.createTextOutput(cb+'('+JSON.stringify(obj)+')').setMimeType(ContentService.MimeType.JAVASCRIPT);return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);}

function syncRegion(region){
  region=region||'jaktim1';var cfg=REGION_CONFIG[region];if(!cfg)return;
  syncAbsensi(region,cfg.sheetAbsensi,cfg.dateStartCol);
  syncDetail(region,cfg.sheetDetail);
}

function syncAll(){syncRegion('jaktim1');syncRegion('jaktim2');}
function runAutoSync(){try{syncAll();}catch(e){Logger.log('Error: '+e.message);}}

// ───────────────────────────────────────────────────────────
// SYNC ABSENSI (with auto-insert columns & rows)
// ───────────────────────────────────────────────────────────
function syncAbsensi(region, sheetName, dateStartCol){
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(sheetName);
  if(!sheet){Logger.log('Sheet tidak ditemukan: '+sheetName);return;}

  var members = fetchSupabase('/rest/v1/members?select=id,nama,cg,status&region=eq.'+region+'&order=cg,nama');
  var dates = fetchSupabase('/rest/v1/dates?select=id,label,month_code,sort_order&region=eq.'+region+'&order=sort_order');
  var attendance = fetchSupabase('/rest/v1/attendance?select=member_id,date_id,status');
  if(!members||!dates||!attendance) return;

  // ───── 1. Auto-insert NEW DATE COLUMNS (sorted) ─────
  var insertedCols = autoInsertDateColumns(sheet, dates, dateStartCol);
  if(insertedCols > 0) Logger.log('+'+insertedCols+' kolom tanggal baru di '+sheetName);

  // ───── 2. Auto-insert NEW MEMBER ROWS (per CG group) ─────
  var insertedRows = autoInsertMemberRows(sheet, members, false);
  if(insertedRows > 0) Logger.log('+'+insertedRows+' baris member baru di '+sheetName);

  // ───── 3. Build attendance lookup ─────
  var memberMap={}, memberIds=new Set();
  members.forEach(function(m){memberMap[m.id]=m;memberIds.add(m.id);});
  var dateMap={}, dateIds=new Set();
  dates.forEach(function(d){dateMap[d.id]=d.label;dateIds.add(d.id);});
  var attMap={};
  attendance.forEach(function(a){
    if(!memberIds.has(a.member_id)||!dateIds.has(a.date_id))return;
    var m=memberMap[a.member_id];if(!m)return;
    if(!attMap[m.nama])attMap[m.nama]={};
    attMap[m.nama][dateMap[a.date_id]]=a.status;
  });

  // ───── 4. Update existing cells with attendance data ─────
  var lastCol=sheet.getLastColumn(),dateCount=lastCol-dateStartCol+1;
  if(dateCount<1)return;
  var sheetDates=sheet.getRange(HEADER_DATE_ROW,dateStartCol,1,dateCount).getValues()[0];
  var lastRow=sheet.getLastRow(),nameCount=lastRow-DATA_START_ROW+1;if(nameCount<1)return;
  var sheetNames=sheet.getRange(DATA_START_ROW,NAMA_COL,nameCount,1).getValues();
  var updated=0;
  sheetNames.forEach(function(row,ri){
    var sn=norm(row[0]);if(!sn)return;
    var key=Object.keys(attMap).find(function(n){return norm(n)===sn;});if(!key)return;
    var ma=attMap[key],mr=DATA_START_ROW+ri;
    sheetDates.forEach(function(sd,ci){
      var dl=normDate(sd);
      var ak=Object.keys(ma).find(function(k){return normDate(k)===dl;});if(!ak)return;
      var st=ma[ak]||'',sm={H:'Hadir',I:'Izin',S:'Sakit',A:'Alpa'},val=sm[st]||st;
      var cell=sheet.getRange(mr,dateStartCol+ci);
      if(cell.getValue()!==val){cell.setValue(val);applyColor(cell,val);updated++;}
    });
  });
  SpreadsheetApp.flush();
  Logger.log('Absensi '+sheetName+': '+updated+' cell, +'+insertedCols+' kolom, +'+insertedRows+' baris');
}

// ───────────────────────────────────────────────────────────
// AUTO-INSERT NEW DATE COLUMNS (with smart sorting)
// ───────────────────────────────────────────────────────────
function autoInsertDateColumns(sheet, supaDates, dateStartCol){
  var lastCol = sheet.getLastColumn();
  var dateCount = lastCol - dateStartCol + 1;
  var existingDates = dateCount > 0 ? sheet.getRange(HEADER_DATE_ROW, dateStartCol, 1, dateCount).getValues()[0] : [];
  var existingNorms = existingDates.map(function(d){return normDate(d);});

  // Find missing dates from Supabase
  var missing = supaDates.filter(function(d){
    return existingNorms.indexOf(normDate(d.label)) < 0;
  });
  if(missing.length === 0) return 0;

  // Limit per run
  missing = missing.slice(0, MAX_INSERTS_PER_RUN);
  var inserted = 0;

  missing.forEach(function(newDate){
    // Find insert position: find first existing date that should come AFTER this one
    // Use sort_order from Supabase as truth
    var supaSortMap = {};
    supaDates.forEach(function(d){supaSortMap[normDate(d.label)] = d.sort_order;});
    var newSort = newDate.sort_order;

    // Get fresh existing dates after each insert
    var lc = sheet.getLastColumn();
    var dc = lc - dateStartCol + 1;
    var curDates = dc > 0 ? sheet.getRange(HEADER_DATE_ROW, dateStartCol, 1, dc).getValues()[0] : [];

    var insertCol = -1;
    for(var i = 0; i < curDates.length; i++){
      var n = normDate(curDates[i]);
      if(!n) continue;
      var existSort = supaSortMap[n];
      if(existSort !== undefined && existSort > newSort){
        insertCol = dateStartCol + i;
        break;
      }
    }
    if(insertCol < 0) insertCol = dateStartCol + curDates.length; // append at end

    // Insert column
    if(insertCol < dateStartCol + curDates.length){
      sheet.insertColumnBefore(insertCol);
    } else {
      // Append at end - just write to next column
      insertCol = dateStartCol + curDates.length;
    }

    // Write headers
    var dnParts = normDate(newDate.label).split('-');
    var dateFormatted = dnParts[0] + '-' + dnParts[1] + '-26';
    var mc = (newDate.month_code || '').toUpperCase();

    // Check previous column's month — only write month label if changed
    var prevMC = '';
    if(insertCol > dateStartCol){
      var prevLabel = sheet.getRange(HEADER_DATE_ROW, insertCol - 1).getValue();
      var prevND = normDate(prevLabel);
      if(prevND){
        var prevParts = prevND.split('-');
        prevMC = MONTHS_ID[parseInt(prevParts[1])] || '';
      }
    }

    if(mc && mc !== prevMC){
      sheet.getRange(1, insertCol).setValue(mc).setFontWeight('bold').setHorizontalAlignment('center');
      sheet.getRange(2, insertCol).setValue('IBADAH').setFontWeight('bold').setHorizontalAlignment('center');
    }
    sheet.getRange(HEADER_DATE_ROW, insertCol).setValue(dateFormatted)
      .setFontWeight('bold').setHorizontalAlignment('center').setNumberFormat('@');
    sheet.setColumnWidth(insertCol, 80);
    inserted++;
  });

  if(inserted > 0) SpreadsheetApp.flush();
  return inserted;
}

// ───────────────────────────────────────────────────────────
// AUTO-INSERT NEW MEMBER ROWS (per CG group, sorted by role)
// ───────────────────────────────────────────────────────────
function autoInsertMemberRows(sheet, supaMembers, isDetail){
  var lastRow = sheet.getLastRow();
  var dataStart = isDetail ? DETAIL_DATA_ROW : DATA_START_ROW;
  var nameCol = isDetail ? DETAIL_COLS.nama : NAMA_COL;
  var cgCol = isDetail ? DETAIL_COLS.cg : CG_COL;
  var nameCount = lastRow - dataStart + 1;
  if(nameCount < 1) return 0;

  // Read all sheet rows (CG, name)
  var range = sheet.getRange(dataStart, 1, nameCount, Math.max(cgCol, nameCol));
  var values = range.getValues();
  var existingNames = new Set();
  values.forEach(function(r){
    var n = norm(r[nameCol-1]);
    if(n) existingNames.add(n);
  });

  // Find missing members
  var missing = supaMembers.filter(function(m){return !existingNames.has(norm(m.nama));});
  if(missing.length === 0) return 0;

  // Sort missing by CG then role
  missing.sort(function(a,b){
    var ca = (a.cg||'').localeCompare(b.cg||'');
    if(ca !== 0) return ca;
    return roleRank(a.status) - roleRank(b.status);
  });

  // Limit per run
  missing = missing.slice(0, MAX_INSERTS_PER_RUN);
  var inserted = 0;

  missing.forEach(function(newM){
    // Find row range of CG group in sheet
    var lr = sheet.getLastRow();
    var nc = lr - dataStart + 1;
    if(nc < 1) return;
    var rows = sheet.getRange(dataStart, 1, nc, Math.max(cgCol, nameCol)).getValues();

    // Track current CG group based on cgCol (header row of CG)
    var groupStart = -1, groupEnd = -1;
    var curCG = '';
    for(var i = 0; i < rows.length; i++){
      var rowCG = String(rows[i][cgCol-1]||'').trim();
      if(rowCG) curCG = rowCG;
      if(curCG === newM.cg){
        if(groupStart < 0) groupStart = dataStart + i;
        groupEnd = dataStart + i;
      } else if(groupStart >= 0){
        break;
      }
    }

    if(groupStart < 0){
      // CG group doesn't exist yet — append at end
      var insertRow = lr + 1;
      sheet.insertRowAfter(lr);
      writeMemberRow(sheet, insertRow, newM, true, isDetail);
    } else {
      // Find insert position within group based on role
      var newRank = roleRank(newM.status);
      var insertRow = groupEnd + 1; // default: end of group
      for(var j = groupStart; j <= groupEnd; j++){
        var existingNama = sheet.getRange(j, nameCol).getValue();
        var existingMember = supaMembers.find(function(m){return norm(m.nama) === norm(existingNama);});
        if(existingMember){
          var existRank = roleRank(existingMember.status);
          if(existRank > newRank){
            insertRow = j;
            break;
          }
        }
      }

      sheet.insertRowBefore(insertRow);
      var isFirstInGroup = (insertRow === groupStart);
      writeMemberRow(sheet, insertRow, newM, isFirstInGroup, isDetail);

      // If we inserted at top of group, the old top row no longer needs CG label
      // (but we keep it for safety - user can clean up)
    }

    // Update No column for this CG group
    renumberCG(sheet, newM.cg, dataStart, cgCol, isDetail);
    inserted++;
  });

  if(inserted > 0) SpreadsheetApp.flush();
  return inserted;
}

function writeMemberRow(sheet, row, m, isFirstInGroup, isDetail){
  if(isDetail){
    if(isFirstInGroup) sheet.getRange(row, DETAIL_COLS.cg).setValue(m.cg);
    sheet.getRange(row, DETAIL_COLS.nama).setValue(m.nama||'');
    sheet.getRange(row, DETAIL_COLS.status).setValue(m.status||'');
    sheet.getRange(row, DETAIL_COLS.lahir).setValue(m.lahir||'');
    sheet.getRange(row, DETAIL_COLS.wa).setValue(m.wa||'');
    sheet.getRange(row, DETAIL_COLS.kelurahan).setValue(m.kelurahan||'');
    sheet.getRange(row, DETAIL_COLS.kecamatan).setValue(m.kecamatan||'');
    sheet.getRange(row, DETAIL_COLS.sekolah).setValue(m.sekolah||'');
    sheet.getRange(row, DETAIL_COLS.kelas).setValue(m.kelas||'');
    var bools = ['msj1','msj2','msj3','cgt1','cgt2','cgt3','baptis_air','baptis_roh'];
    var detailKeys = ['msj1','msj2','msj3','cgt1','cgt2','cgt3','baptisAir','baptisRoh'];
    bools.forEach(function(b, i){
      var cell = sheet.getRange(row, DETAIL_COLS[detailKeys[i]]);
      var v = m[b] ? 'TRUE' : 'FALSE';
      cell.setValue(v);
      if(v==='TRUE') cell.setBackground('#c6efce').setFontColor('#276221');
      else cell.setBackground('#ffc7ce').setFontColor('#9c0006');
    });
  } else {
    if(isFirstInGroup) sheet.getRange(row, CG_COL).setValue(m.cg);
    sheet.getRange(row, NAMA_COL).setValue(m.nama||'');
    // Color row by role
    var roleBg = {cgl:'#fff3e0', sponsor:'#e8eaf6', member:'#ffffff', simpatisan:'#fce4ec', vip:'#f3e5f5'};
    var bg = roleBg[(m.status||'member').toLowerCase().trim()];
    if(bg) sheet.getRange(row, 1, 1, NAMA_COL+1).setBackground(bg);
  }
}

function renumberCG(sheet, cg, dataStart, cgCol, isDetail){
  var lr = sheet.getLastRow();
  if(lr < dataStart) return;
  var nameCol = isDetail ? DETAIL_COLS.nama : NAMA_COL;
  var noCol = isDetail ? DETAIL_COLS.no : NO_COL;
  var rows = sheet.getRange(dataStart, 1, lr - dataStart + 1, Math.max(cgCol, nameCol)).getValues();
  var curCG = '', no = 0;
  for(var i = 0; i < rows.length; i++){
    var rowCG = String(rows[i][cgCol-1]||'').trim();
    if(rowCG) curCG = rowCG;
    if(curCG === cg){
      no++;
      var n = String(rows[i][nameCol-1]||'').trim();
      if(n) sheet.getRange(dataStart + i, noCol).setValue(no);
    }
  }
}

// ───────────────────────────────────────────────────────────
// SYNC DETAIL
// ───────────────────────────────────────────────────────────
function syncDetail(region, sheetName){
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(sheetName);
  if(!sheet) return;
  var members = fetchSupabase('/rest/v1/members?select=*&region=eq.'+region+'&order=cg,nama');
  if(!members || members.length === 0) return;

  // Auto-insert new member rows (in detail format)
  var insertedRows = autoInsertMemberRows(sheet, members, true);
  if(insertedRows > 0) Logger.log('+'+insertedRows+' baris detail di '+sheetName);

  // Update existing rows
  var lastRow = sheet.getLastRow(), dataCount = lastRow - DETAIL_DATA_ROW + 1;
  if(dataCount < 1) return;
  var names = sheet.getRange(DETAIL_DATA_ROW, DETAIL_COLS.nama, dataCount, 1).getValues();
  var updated = 0;
  members.forEach(function(m){
    var tr = -1, nn = norm(m.nama);
    for(var i = 0; i < names.length; i++){
      if(norm(names[i][0]) === nn){tr = DETAIL_DATA_ROW + i; break;}
    }
    if(tr < 0) return;
    sheet.getRange(tr, DETAIL_COLS.status, 1, 5).setValues([[m.status||'',m.lahir||'',m.wa||'',m.kelurahan||'',m.kecamatan||'']]);
    sheet.getRange(tr, DETAIL_COLS.msj1, 1, 8).setValues([[m.msj1?'TRUE':'FALSE',m.msj2?'TRUE':'FALSE',m.msj3?'TRUE':'FALSE',m.cgt1?'TRUE':'FALSE',m.cgt2?'TRUE':'FALSE',m.cgt3?'TRUE':'FALSE',m.baptis_air?'TRUE':'FALSE',m.baptis_roh?'TRUE':'FALSE']]);
    sheet.getRange(tr, DETAIL_COLS.sekolah, 1, 2).setValues([[m.sekolah||'',m.kelas||'']]);
    var boolRange = sheet.getRange(tr, DETAIL_COLS.msj1, 1, 8);
    var vals = boolRange.getValues()[0];
    var bgs = [], fcs = [];
    vals.forEach(function(v){
      if(v === 'TRUE'){bgs.push('#c6efce');fcs.push('#276221');}
      else{bgs.push('#ffc7ce');fcs.push('#9c0006');}
    });
    boolRange.setBackgrounds([bgs]).setFontColors([fcs]);
    updated++;
  });
  SpreadsheetApp.flush();
  Logger.log('Detail '+sheetName+': '+updated+' members diupdate, +'+insertedRows+' baris baru');
}

// ───────────────────────────────────────────────────────────
// HELPERS
// ───────────────────────────────────────────────────────────
function fetchSupabase(path){
  try{
    var r = UrlFetchApp.fetch(SUPABASE_URL+path, {
      method:'GET',
      headers:{'apikey':SUPABASE_KEY,'Authorization':'Bearer '+SUPABASE_KEY,'Content-Type':'application/json'},
      muteHttpExceptions:true
    });
    if(r.getResponseCode() !== 200) return null;
    return JSON.parse(r.getContentText());
  } catch(e){return null;}
}

function norm(s){return String(s||'').trim().toLowerCase().replace(/\s+/g,' ');}

function normDate(s){
  if(s instanceof Date) return s.getDate()+'-'+(s.getMonth()+1);
  s = String(s||'').trim();
  var dm = s.match(/^\w+\s+(\w+)\s+(\d+)\s+(\d+)/);
  if(dm){
    var mo2 = {Jan:1,Feb:2,Mar:3,Apr:4,May:5,Jun:6,Jul:7,Aug:8,Sep:9,Oct:10,Nov:11,Dec:12};
    if(mo2[dm[1]]) return dm[2]+'-'+mo2[dm[1]];
  }
  var mo = {jan:1,feb:2,mar:3,apr:4,mei:5,may:5,jun:6,jul:7,agu:8,aug:8,sep:9,okt:10,oct:10,nov:11,des:12,dec:12};
  var m = s.match(/^(\d+)\s+([a-zA-Z]+)/);
  if(m){var n = mo[m[2].toLowerCase()]; return n ? m[1]+'-'+n : s.toLowerCase();}
  m = s.match(/^(\d+)[\/\-](\d+)[\/\-]/);
  if(m) return m[1]+'-'+parseInt(m[2]);
  m = s.match(/^(\d+)[\/\-](\d+)$/);
  if(m) return m[1]+'-'+parseInt(m[2]);
  return s.toLowerCase();
}

function applyColor(cell, status){
  var c = STATUS_COLORS[status] || STATUS_COLORS[''];
  if(c.bg){cell.setBackground(c.bg); cell.setFontColor(c.font);}
  else{cell.setBackground(null); cell.setFontColor(null);}
}
