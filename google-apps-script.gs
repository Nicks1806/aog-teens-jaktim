// ============================================================
// AOG Teens Jaktim — Auto Sync (FAST batch version)
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
const DETAIL_DATA_ROW = 4;
const DETAIL_COLS = {cg:1,no:2,nama:3,status:4,lahir:5,wa:6,kelurahan:7,kecamatan:8,msj1:9,msj2:10,msj3:11,cgt1:12,cgt2:13,cgt3:14,baptisAir:15,baptisRoh:16,sekolah:17,kelas:18};
const STATUS_BG   = {'Hadir':'#c6efce','Izin':'#bdd7ee','Sakit':'#ffeb9c','Alpa':'#ffc7ce','':null};
const STATUS_FONT = {'Hadir':'#276221','Izin':'#1f497d','Sakit':'#9c6500','Alpa':'#9c0006','':null};

function doGet(e){
  var action=(e.parameter.action||'').trim(),region=(e.parameter.region||'jaktim1').trim(),callback=e.parameter.callback||'';
  if(action==='ping') return jr(callback,{ok:true});
  if(action==='syncAll'){syncRegion(region);return jr(callback,{ok:true});}
  return jr(callback,{ok:false});
}
function jr(cb,obj){if(cb)return ContentService.createTextOutput(cb+'('+JSON.stringify(obj)+')').setMimeType(ContentService.MimeType.JAVASCRIPT);return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);}

function syncRegion(region){
  region=region||'jaktim1';var cfg=REGION_CONFIG[region];if(!cfg)return;
  syncAbsensi(region,cfg.sheetAbsensi,cfg.dateStartCol);
  syncDetail(region,cfg.sheetDetail);
}
function syncAll(){syncRegion('jaktim1');syncRegion('jaktim2');}
function runAutoSync(){try{syncAll();}catch(e){Logger.log('Error: '+e.message);}}

// ───────── SYNC ABSENSI (BATCH) ─────────
function syncAbsensi(region,sheetName,dateStartCol){
  var sheet=SpreadsheetApp.getActiveSpreadsheet().getSheetByName(sheetName);
  if(!sheet)return;
  var members=fetchSupabase('/rest/v1/members?select=id,nama,cg&region=eq.'+region);
  var dates=fetchSupabase('/rest/v1/dates?select=id,label&region=eq.'+region);
  var attendance=fetchSupabase('/rest/v1/attendance?select=member_id,date_id,status');
  if(!members||!dates||!attendance)return;

  var memberMap={},memberIds={};
  members.forEach(function(m){memberMap[m.id]=m;memberIds[m.id]=true;});
  var dateMap={},dateIds={};
  dates.forEach(function(d){dateMap[d.id]=d.label;dateIds[d.id]=true;});
  var attMap={};
  for(var i=0;i<attendance.length;i++){
    var a=attendance[i];
    if(!memberIds[a.member_id]||!dateIds[a.date_id])continue;
    var m=memberMap[a.member_id];if(!m)continue;
    var nn=norm(m.nama);
    if(!attMap[nn])attMap[nn]={};
    attMap[nn][normDate(dateMap[a.date_id])]=a.status;
  }

  var lastCol=sheet.getLastColumn(),dateCount=lastCol-dateStartCol+1;
  if(dateCount<1)return;
  var lastRow=sheet.getLastRow(),nameCount=lastRow-DATA_START_ROW+1;
  if(nameCount<1)return;

  // BATCH READ
  var sheetDates=sheet.getRange(HEADER_DATE_ROW,dateStartCol,1,dateCount).getValues()[0];
  var sheetNames=sheet.getRange(DATA_START_ROW,NAMA_COL,nameCount,1).getValues();
  var dataRange=sheet.getRange(DATA_START_ROW,dateStartCol,nameCount,dateCount);
  var currentValues=dataRange.getValues();
  var currentBgs=dataRange.getBackgrounds();
  var currentFonts=dataRange.getFontColors();

  // Normalize date columns once
  var dateNorms=sheetDates.map(function(d){return normDate(d);});

  // Compute new values
  var newValues=[],newBgs=[],newFonts=[];
  var sm={H:'Hadir',I:'Izin',S:'Sakit',A:'Alpa'};
  var changed=false;
  for(var r=0;r<nameCount;r++){
    var sn=norm(sheetNames[r][0]);
    var rowVals=currentValues[r].slice();
    var rowBgs=currentBgs[r].slice();
    var rowFonts=currentFonts[r].slice();
    if(sn && attMap[sn]){
      var ma=attMap[sn];
      for(var c=0;c<dateCount;c++){
        var dn=dateNorms[c];if(!dn)continue;
        var st=ma[dn];
        if(st===undefined)continue;
        var val=sm[st]||st||'';
        if(rowVals[c]!==val){
          rowVals[c]=val;
          rowBgs[c]=STATUS_BG[val]||null;
          rowFonts[c]=STATUS_FONT[val]||null;
          changed=true;
        }
      }
    }
    newValues.push(rowVals);
    newBgs.push(rowBgs);
    newFonts.push(rowFonts);
  }

  // BATCH WRITE
  if(changed){
    dataRange.setValues(newValues);
    dataRange.setBackgrounds(newBgs);
    dataRange.setFontColors(newFonts);
    SpreadsheetApp.flush();
  }
  Logger.log('Absensi '+sheetName+' selesai');
}

// ───────── SYNC DETAIL (BATCH) ─────────
function syncDetail(region,sheetName){
  var sheet=SpreadsheetApp.getActiveSpreadsheet().getSheetByName(sheetName);
  if(!sheet)return;
  var members=fetchSupabase('/rest/v1/members?select=*&region=eq.'+region);
  if(!members||members.length===0)return;

  var lastRow=sheet.getLastRow(),dataCount=lastRow-DETAIL_DATA_ROW+1;
  if(dataCount<1)return;

  // Map sheet name → row index
  var names=sheet.getRange(DETAIL_DATA_ROW,DETAIL_COLS.nama,dataCount,1).getValues();
  var nameToRow={};
  for(var i=0;i<names.length;i++){
    var nn=norm(names[i][0]);
    if(nn)nameToRow[nn]=DETAIL_DATA_ROW+i;
  }

  // BATCH READ: columns status..kecamatan (col 4..8) = 5 cols
  var statusRange=sheet.getRange(DETAIL_DATA_ROW,DETAIL_COLS.status,dataCount,5);
  var statusValues=statusRange.getValues();
  // BATCH READ: milestones (col 9..16) = 8 cols
  var msRange=sheet.getRange(DETAIL_DATA_ROW,DETAIL_COLS.msj1,dataCount,8);
  var msValues=msRange.getValues();
  var msBgs=msRange.getBackgrounds();
  var msFonts=msRange.getFontColors();
  // BATCH READ: sekolah, kelas (col 17..18) = 2 cols
  var sekRange=sheet.getRange(DETAIL_DATA_ROW,DETAIL_COLS.sekolah,dataCount,2);
  var sekValues=sekRange.getValues();

  var changedStatus=false,changedMs=false,changedSek=false;

  members.forEach(function(m){
    var nn=norm(m.nama);
    var rowIdx=nameToRow[nn];
    if(!rowIdx)return;
    var i=rowIdx-DETAIL_DATA_ROW;

    // status..kecamatan
    var newStatus=[m.status||'',m.lahir||'',m.wa||'',m.kelurahan||'',m.kecamatan||''];
    for(var k=0;k<5;k++){
      if(String(statusValues[i][k])!==String(newStatus[k])){statusValues[i][k]=newStatus[k];changedStatus=true;}
    }
    // milestones
    var newMs=[m.msj1?'TRUE':'FALSE',m.msj2?'TRUE':'FALSE',m.msj3?'TRUE':'FALSE',m.cgt1?'TRUE':'FALSE',m.cgt2?'TRUE':'FALSE',m.cgt3?'TRUE':'FALSE',m.baptis_air?'TRUE':'FALSE',m.baptis_roh?'TRUE':'FALSE'];
    for(var k=0;k<8;k++){
      if(String(msValues[i][k])!==newMs[k]){
        msValues[i][k]=newMs[k];
        msBgs[i][k]=newMs[k]==='TRUE'?'#c6efce':'#ffc7ce';
        msFonts[i][k]=newMs[k]==='TRUE'?'#276221':'#9c0006';
        changedMs=true;
      }
    }
    // sekolah, kelas
    var newSek=[m.sekolah||'',m.kelas||''];
    for(var k=0;k<2;k++){
      if(String(sekValues[i][k])!==String(newSek[k])){sekValues[i][k]=newSek[k];changedSek=true;}
    }
  });

  // BATCH WRITE
  if(changedStatus) statusRange.setValues(statusValues);
  if(changedMs){msRange.setValues(msValues);msRange.setBackgrounds(msBgs);msRange.setFontColors(msFonts);}
  if(changedSek) sekRange.setValues(sekValues);
  if(changedStatus||changedMs||changedSek)SpreadsheetApp.flush();
  Logger.log('Detail '+sheetName+' selesai');
}

// ───────── HELPERS ─────────
function fetchSupabase(path){
  try{
    var r=UrlFetchApp.fetch(SUPABASE_URL+path,{method:'GET',headers:{'apikey':SUPABASE_KEY,'Authorization':'Bearer '+SUPABASE_KEY,'Content-Type':'application/json'},muteHttpExceptions:true});
    if(r.getResponseCode()!==200)return null;
    return JSON.parse(r.getContentText());
  }catch(e){return null;}
}
function norm(s){return String(s||'').trim().toLowerCase().replace(/\s+/g,' ');}
function normDate(s){
  if(s instanceof Date)return s.getDate()+'-'+(s.getMonth()+1);
  s=String(s||'').trim();if(!s)return '';
  var dm=s.match(/^\w+\s+(\w+)\s+(\d+)\s+(\d+)/);
  if(dm){var mo2={Jan:1,Feb:2,Mar:3,Apr:4,May:5,Jun:6,Jul:7,Aug:8,Sep:9,Oct:10,Nov:11,Dec:12};if(mo2[dm[1]])return dm[2]+'-'+mo2[dm[1]];}
  var mo={jan:1,feb:2,mar:3,apr:4,mei:5,may:5,jun:6,jul:7,agu:8,aug:8,sep:9,okt:10,oct:10,nov:11,des:12,dec:12};
  var m=s.match(/^(\d+)\s+([a-zA-Z]+)/);if(m){var n=mo[m[2].toLowerCase()];return n?m[1]+'-'+n:s.toLowerCase();}
  m=s.match(/^(\d+)[\/\-](\d+)[\/\-]/);if(m)return m[1]+'-'+parseInt(m[2]);
  m=s.match(/^(\d+)[\/\-](\d+)$/);if(m)return m[1]+'-'+parseInt(m[2]);
  return s.toLowerCase();
}
