// ============================================================
// AOG Teens Jaktim — Auto Sync Supabase → Google Sheets
// SAFE VERSION: Hanya update data ke kolom/baris yang sudah ada
// TIDAK insert kolom/baris baru — manual saja kalau perlu
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
const STATUS_COLORS = {'Hadir':{bg:'#c6efce',font:'#276221'},'Izin':{bg:'#bdd7ee',font:'#1f497d'},'Sakit':{bg:'#ffeb9c',font:'#9c6500'},'Alpa':{bg:'#ffc7ce',font:'#9c0006'},'':{bg:null,font:null}};

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

function syncAbsensi(region,sheetName,dateStartCol){
  var sheet=SpreadsheetApp.getActiveSpreadsheet().getSheetByName(sheetName);
  if(!sheet)return;
  var members=fetchSupabase('/rest/v1/members?select=id,nama,cg&region=eq.'+region+'&order=cg,nama');
  var dates=fetchSupabase('/rest/v1/dates?select=id,label,month_code&region=eq.'+region+'&order=sort_order');
  var attendance=fetchSupabase('/rest/v1/attendance?select=member_id,date_id,status');
  if(!members||!dates||!attendance)return;
  var memberMap={},memberIds=new Set();
  members.forEach(function(m){memberMap[m.id]=m;memberIds.add(m.id);});
  var dateMap={},dateIds=new Set();
  dates.forEach(function(d){dateMap[d.id]=d.label;dateIds.add(d.id);});
  var attMap={};
  attendance.forEach(function(a){
    if(!memberIds.has(a.member_id)||!dateIds.has(a.date_id))return;
    var m=memberMap[a.member_id];if(!m)return;
    if(!attMap[m.nama])attMap[m.nama]={};
    attMap[m.nama][dateMap[a.date_id]]=a.status;
  });
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
  Logger.log('Absensi '+sheetName+': '+updated+' cell diupdate.');
}

function syncDetail(region,sheetName){
  var sheet=SpreadsheetApp.getActiveSpreadsheet().getSheetByName(sheetName);
  if(!sheet)return;
  var members=fetchSupabase('/rest/v1/members?select=*&region=eq.'+region+'&order=cg,nama');
  if(!members||members.length===0)return;
  var lastRow=sheet.getLastRow(),dataCount=lastRow-DETAIL_DATA_ROW+1;if(dataCount<1)return;
  var names=sheet.getRange(DETAIL_DATA_ROW,DETAIL_COLS.nama,dataCount,1).getValues();
  var updated=0;
  members.forEach(function(m){
    var tr=-1,nn=norm(m.nama);
    for(var i=0;i<names.length;i++){if(norm(names[i][0])===nn){tr=DETAIL_DATA_ROW+i;break;}}
    if(tr<0)return;
    sheet.getRange(tr,DETAIL_COLS.status,1,5).setValues([[m.status||'',m.lahir||'',m.wa||'',m.kelurahan||'',m.kecamatan||'']]);
    sheet.getRange(tr,DETAIL_COLS.msj1,1,8).setValues([[m.msj1?'TRUE':'FALSE',m.msj2?'TRUE':'FALSE',m.msj3?'TRUE':'FALSE',m.cgt1?'TRUE':'FALSE',m.cgt2?'TRUE':'FALSE',m.cgt3?'TRUE':'FALSE',m.baptis_air?'TRUE':'FALSE',m.baptis_roh?'TRUE':'FALSE']]);
    sheet.getRange(tr,DETAIL_COLS.sekolah,1,2).setValues([[m.sekolah||'',m.kelas||'']]);
    var boolRange=sheet.getRange(tr,DETAIL_COLS.msj1,1,8);
    var vals=boolRange.getValues()[0];
    var bgs=[],fcs=[];
    vals.forEach(function(v){
      if(v==='TRUE'){bgs.push('#c6efce');fcs.push('#276221');}
      else{bgs.push('#ffc7ce');fcs.push('#9c0006');}
    });
    boolRange.setBackgrounds([bgs]).setFontColors([fcs]);
    updated++;
  });
  SpreadsheetApp.flush();
  Logger.log('Detail '+sheetName+': '+updated+' members diupdate.');
}

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
  s=String(s||'').trim();
  var dm=s.match(/^\w+\s+(\w+)\s+(\d+)\s+(\d+)/);
  if(dm){var mo2={Jan:1,Feb:2,Mar:3,Apr:4,May:5,Jun:6,Jul:7,Aug:8,Sep:9,Oct:10,Nov:11,Dec:12};if(mo2[dm[1]])return dm[2]+'-'+mo2[dm[1]];}
  var mo={jan:1,feb:2,mar:3,apr:4,mei:5,may:5,jun:6,jul:7,agu:8,aug:8,sep:9,okt:10,oct:10,nov:11,des:12,dec:12};
  var m=s.match(/^(\d+)\s+([a-zA-Z]+)/);if(m){var n=mo[m[2].toLowerCase()];return n?m[1]+'-'+n:s.toLowerCase();}
  m=s.match(/^(\d+)[\/\-](\d+)[\/\-]/);if(m)return m[1]+'-'+parseInt(m[2]);
  m=s.match(/^(\d+)[\/\-](\d+)$/);if(m)return m[1]+'-'+parseInt(m[2]);
  return s.toLowerCase();
}

function applyColor(cell,status){
  var c=STATUS_COLORS[status]||STATUS_COLORS[''];
  if(c.bg){cell.setBackground(c.bg);cell.setFontColor(c.font);}
  else{cell.setBackground(null);cell.setFontColor(null);}
}
