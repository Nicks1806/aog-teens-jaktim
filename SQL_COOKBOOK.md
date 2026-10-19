# SQL Cookbook — AOG Teens Jaktim

Semua SQL siap-pakai untuk operasi database Supabase. Copy-paste ke Supabase SQL Editor.

**Prinsip Aman:**
- Selalu wrap dengan `BEGIN; ... COMMIT;` — kalau ada error di tengah, auto rollback
- Test dulu di 1 row dengan `WHERE ... LIMIT 1` sebelum bulk operation
- Untuk DELETE → **pakai archive dulu** (`UPDATE cg='ARSIP...'`), bukan hard delete

---

# TABLE OF CONTENTS

1. [Setup Awal (One-Time)](#1-setup-awal)
2. [Schema DDL (CREATE TABLE)](#2-schema-ddl)
3. [Query Sehari-hari](#3-query-sehari-hari)
4. [Member Management](#4-member-management)
5. [CG Management](#5-cg-management)
6. [Attendance Operations](#6-attendance-operations)
7. [Dates / Ibadah Management](#7-dates-management)
8. [Vision & Dev Plan](#8-vision--dev-plan)
9. [Events](#9-events)
10. [Pelayanan](#10-pelayanan)
11. [Arsip & Restore](#11-arsip--restore)
12. [Debug & Verify](#12-debug--verify)
13. [Backup & Export](#13-backup--export)
14. [Emergency Recovery](#14-emergency-recovery)

---

## 1. Setup Awal

### 1.1 Enable Realtime Publication (WAJIB pertama kali)
```sql
ALTER PUBLICATION supabase_realtime ADD TABLE attendance;
ALTER PUBLICATION supabase_realtime ADD TABLE members;
ALTER PUBLICATION supabase_realtime ADD TABLE dates;
ALTER PUBLICATION supabase_realtime ADD TABLE cg_info;
ALTER PUBLICATION supabase_realtime ADD TABLE cg_pelayanan;
ALTER PUBLICATION supabase_realtime ADD TABLE cg_events;
ALTER PUBLICATION supabase_realtime ADD TABLE events;
ALTER PUBLICATION supabase_realtime ADD TABLE cg_vision;
ALTER PUBLICATION supabase_realtime ADD TABLE cg_dev_plans;
ALTER PUBLICATION supabase_realtime ADD TABLE member_notes;
ALTER PUBLICATION supabase_realtime ADD TABLE coach_notes;
```

**Jika error `already member of publication`** → skip, artinya sudah aktif. Aman.

### 1.2 Disable RLS Semua Tabel
```sql
ALTER TABLE members DISABLE ROW LEVEL SECURITY;
ALTER TABLE attendance DISABLE ROW LEVEL SECURITY;
ALTER TABLE dates DISABLE ROW LEVEL SECURITY;
ALTER TABLE cg_info DISABLE ROW LEVEL SECURITY;
ALTER TABLE cg_events DISABLE ROW LEVEL SECURITY;
ALTER TABLE events DISABLE ROW LEVEL SECURITY;
ALTER TABLE cg_vision DISABLE ROW LEVEL SECURITY;
ALTER TABLE cg_dev_plans DISABLE ROW LEVEL SECURITY;
ALTER TABLE cg_pelayanan DISABLE ROW LEVEL SECURITY;
ALTER TABLE cg_custom_roles DISABLE ROW LEVEL SECURITY;
ALTER TABLE member_notes DISABLE ROW LEVEL SECURITY;
ALTER TABLE coach_notes DISABLE ROW LEVEL SECURITY;
```

### 1.3 Verify Setup
```sql
-- Cek tabel yang ter-publish realtime
SELECT tablename FROM pg_publication_tables 
WHERE pubname = 'supabase_realtime' 
ORDER BY tablename;

-- Cek RLS status per tabel
SELECT schemaname, tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public' 
ORDER BY tablename;
```

---

## 2. Schema DDL

### 2.1 members
```sql
CREATE TABLE IF NOT EXISTS members (
  id            BIGSERIAL PRIMARY KEY,
  nama          TEXT NOT NULL,
  cg            TEXT,                 -- e.g. 'TEEN 01', 'ARSIP JAKTIM 1'
  status        TEXT DEFAULT 'Member', -- CGL/Sponsor/Member/Simpatisan/VIP/Alumni
  region        TEXT NOT NULL,        -- jaktim1 | jaktim2
  lahir         TEXT,                 -- YYYY-MM-DD
  wa            TEXT,
  sekolah       TEXT,
  kelas         TEXT,
  kelurahan     TEXT,
  kecamatan     TEXT,
  msj1          BOOL DEFAULT false,
  msj2          BOOL DEFAULT false,
  msj3          BOOL DEFAULT false,
  cgt1          BOOL DEFAULT false,
  cgt2          BOOL DEFAULT false,
  cgt3          BOOL DEFAULT false,
  baptis_air    BOOL DEFAULT false,
  baptis_roh    BOOL DEFAULT false,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_members_cg ON members(cg);
CREATE INDEX IF NOT EXISTS idx_members_region ON members(region);
```

### 2.2 attendance
```sql
CREATE TABLE IF NOT EXISTS attendance (
  member_id  BIGINT NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  date_id    BIGINT NOT NULL REFERENCES dates(id) ON DELETE CASCADE,
  status     TEXT NOT NULL,  -- H | I | S | A
  PRIMARY KEY (member_id, date_id)
);
CREATE INDEX IF NOT EXISTS idx_attendance_member ON attendance(member_id);
CREATE INDEX IF NOT EXISTS idx_attendance_date ON attendance(date_id);
```

### 2.3 dates
```sql
CREATE TABLE IF NOT EXISTS dates (
  id           BIGSERIAL PRIMARY KEY,
  label        TEXT NOT NULL,       -- e.g. '16 Mei 2026' atau '3-1-26'
  region       TEXT NOT NULL,
  sort_order   INT DEFAULT 0,
  month_code   TEXT                 -- e.g. 'MEI'
);
CREATE INDEX IF NOT EXISTS idx_dates_region ON dates(region, sort_order);
```

### 2.4 cg_info
```sql
CREATE TABLE IF NOT EXISTS cg_info (
  cg         TEXT PRIMARY KEY,
  leader     TEXT,
  hari_jam   TEXT,
  lokasi     TEXT
);
```

### 2.5 cg_vision
```sql
CREATE TABLE IF NOT EXISTS cg_vision (
  id         BIGSERIAL PRIMARY KEY,
  cg         TEXT NOT NULL,
  region     TEXT NOT NULL,
  visi       TEXT,
  misi       TEXT,
  UNIQUE (cg, region)
);
```

### 2.6 cg_dev_plans
```sql
CREATE TABLE IF NOT EXISTS cg_dev_plans (
  id                BIGSERIAL PRIMARY KEY,
  cg                TEXT NOT NULL,
  region            TEXT NOT NULL,
  member_name       TEXT NOT NULL,
  current_status    TEXT,
  target_status     TEXT,       -- CGL | Sponsor | Member
  deadline          DATE,
  created_at        TIMESTAMPTZ DEFAULT NOW()
);
```

### 2.7 cg_pelayanan
```sql
CREATE TABLE IF NOT EXISTS cg_pelayanan (
  cg              TEXT NOT NULL,
  region          TEXT NOT NULL,
  month           TEXT NOT NULL,       -- '2026-05'
  week_date       TEXT NOT NULL,       -- '2026-05-03'
  role_name       TEXT NOT NULL,
  member_name     TEXT,                -- comma-separated for multi-assignee
  PRIMARY KEY (cg, week_date, role_name)
);
```

### 2.8 cg_custom_roles
```sql
CREATE TABLE IF NOT EXISTS cg_custom_roles (
  id          BIGSERIAL PRIMARY KEY,
  cg          TEXT NOT NULL,
  region      TEXT NOT NULL,
  role_name   TEXT NOT NULL,
  abbr        TEXT,
  color       TEXT,
  bg          TEXT
);
```

### 2.9 events (legacy)
```sql
CREATE TABLE IF NOT EXISTS events (
  id           BIGSERIAL PRIMARY KEY,
  name         TEXT NOT NULL,
  date_start   DATE,
  date_end     DATE,
  cat          TEXT,
  note         TEXT,
  image        TEXT
);
```

### 2.10 cg_events (with 3-level scope)
```sql
CREATE TABLE IF NOT EXISTS cg_events (
  id           BIGSERIAL PRIMARY KEY,
  cg           TEXT NOT NULL DEFAULT 'ALL',
  region       TEXT NOT NULL,           -- 'all' untuk global
  is_shared    BOOL NOT NULL DEFAULT false,
  name         TEXT NOT NULL,
  date_start   DATE,                    -- nullable (v22+)
  date_end     DATE,
  cat          TEXT,
  note         TEXT,
  image        TEXT
);

-- Kalau date_start NOT NULL error:
ALTER TABLE cg_events ALTER COLUMN date_start DROP NOT NULL;
```

### 2.11 member_notes
```sql
CREATE TABLE IF NOT EXISTS member_notes (
  member_id  BIGINT PRIMARY KEY REFERENCES members(id) ON DELETE CASCADE,
  cgl_note   TEXT
);
```

### 2.12 coach_notes
```sql
CREATE TABLE IF NOT EXISTS coach_notes (
  cg       TEXT NOT NULL,
  region   TEXT NOT NULL,
  note     TEXT,
  PRIMARY KEY (cg, region)
);
```

---

## 3. Query Sehari-hari

### 3.1 List Member per Region
```sql
SELECT cg, status, nama 
FROM members 
WHERE region = 'jaktim1' AND cg NOT LIKE 'ARSIP%'
ORDER BY cg, 
  CASE LOWER(status) 
    WHEN 'cgl' THEN 0 WHEN 'sponsor' THEN 1 WHEN 'member' THEN 2 
    WHEN 'simpatisan' THEN 3 WHEN 'vip' THEN 4 ELSE 5 
  END, nama;
```

### 3.2 List CG Aktif per Region
```sql
SELECT DISTINCT cg 
FROM members 
WHERE region = 'jaktim1' AND cg NOT LIKE 'ARSIP%'
ORDER BY cg;
```

### 3.3 Count Member per CG
```sql
SELECT cg, COUNT(*) AS total 
FROM members 
WHERE region = 'jaktim1' AND cg NOT LIKE 'ARSIP%'
GROUP BY cg 
ORDER BY total DESC;
```

### 3.4 Cari Member by Nama (fuzzy)
```sql
SELECT id, nama, cg, region, status 
FROM members 
WHERE LOWER(nama) LIKE LOWER('%olivia%')
ORDER BY nama;
```

### 3.5 Lihat CGL + Info Kontak
```sql
SELECT c.cg, c.leader, c.hari_jam, c.lokasi, m.wa
FROM cg_info c
LEFT JOIN members m ON m.nama = c.leader AND m.region = 'jaktim1'
WHERE c.cg IN (SELECT DISTINCT cg FROM members WHERE region='jaktim1' AND cg NOT LIKE 'ARSIP%')
ORDER BY c.cg;
```

---

## 4. Member Management

### 4.1 Tambah Member Baru
```sql
INSERT INTO members (nama, cg, status, region, wa, lahir, sekolah, kelas, kelurahan, kecamatan)
VALUES ('Nama Baru', 'TEEN 01', 'Member', 'jaktim1', '08123456789', '2010-05-15', 'SMAK ABC', '10', 'Kelurahan X', 'Kecamatan Y');
```

### 4.2 Update Detail Member
```sql
UPDATE members 
SET wa = '08123456789', 
    sekolah = 'SMAK XYZ',
    kelurahan = 'Pulomas',
    kecamatan = 'Pulogadung'
WHERE nama = 'Nama Member' AND region = 'jaktim1';
```

### 4.3 Ganti Status Role (promote/demote)
```sql
UPDATE members SET status = 'Sponsor' 
WHERE nama = 'Nama Member' AND cg = 'TEEN 01';
```

### 4.4 Toggle Milestone
```sql
UPDATE members SET msj1 = true, msj2 = true, cgt1 = true 
WHERE nama = 'Nama Member' AND region = 'jaktim1';
```

### 4.5 Pindah Member ke CG Lain
```sql
UPDATE members SET cg = 'TEEN 06' 
WHERE nama = 'Nama Member' AND region = 'jaktim1';
```

### 4.6 Reassign Massal (Rebalance CG)
```sql
BEGIN;
UPDATE members SET cg = 'TEEN 01' 
WHERE region = 'jaktim1' AND nama IN (
  'Graciana Felice Esterina',
  'Nadia Amanda Simorangkir',
  'Arron',
  'Ricardo Jevin Santosa'
);

UPDATE members SET cg = 'TEEN 06' 
WHERE region = 'jaktim1' AND nama IN (
  'Godwin Rafael T Dese',
  'Arsenio Owen',
  'Elaine',
  'Virginia Renata Maureen Isevac',
  'Jefferson Louis Wijaya'
);
COMMIT;
```

### 4.7 Hard Delete Member (IRREVERSIBLE — pakai archive dulu!)
```sql
BEGIN;
-- Hapus attendance
DELETE FROM attendance WHERE member_id IN (
  SELECT id FROM members WHERE nama = 'Nama Hapus' AND region = 'jaktim1'
);
-- Hapus notes
DELETE FROM member_notes WHERE member_id IN (
  SELECT id FROM members WHERE nama = 'Nama Hapus' AND region = 'jaktim1'
);
-- Hapus member
DELETE FROM members WHERE nama = 'Nama Hapus' AND region = 'jaktim1';
COMMIT;
```

---

## 5. CG Management

### 5.1 Buat CG Baru
```sql
INSERT INTO cg_info (cg, leader, hari_jam, lokasi)
VALUES ('TEEN 25', 'Nama CGL', 'Senin/Kamis - 17.00', 'Rumah CGL')
ON CONFLICT (cg) DO UPDATE SET leader = EXCLUDED.leader;

-- Set CGL nya
UPDATE members SET cg = 'TEEN 25', status = 'CGL' 
WHERE nama = 'Nama CGL' AND region = 'jaktim1';
```

### 5.2 Ganti CGL
```sql
BEGIN;
-- Promote CGL baru
UPDATE members SET status = 'CGL' 
WHERE nama = 'CGL Baru' AND cg = 'TEEN 17';

-- Demote CGL lama (opsional — atau langsung archive)
UPDATE members SET status = 'Member' 
WHERE nama = 'CGL Lama' AND cg = 'TEEN 17';

-- Update cg_info
UPDATE cg_info SET leader = 'CGL Baru' WHERE cg = 'TEEN 17';
COMMIT;
```

### 5.3 Update Info CG (Hari/Jam/Lokasi)
```sql
UPDATE cg_info 
SET hari_jam = 'Selasa/Jumat - 18.00', 
    lokasi = 'Rumah Baru'
WHERE cg = 'TEEN 01';
```

### 5.4 Rename CG (misal `__TEEN_NEW__` → `TEEN 25`)
```sql
BEGIN;
UPDATE members SET cg = 'TEEN 25' WHERE cg = '__TEEN_NEW__';
UPDATE cg_info SET cg = 'TEEN 25' WHERE cg = '__TEEN_NEW__';
UPDATE cg_events SET cg = 'TEEN 25' WHERE cg = '__TEEN_NEW__';
UPDATE cg_vision SET cg = 'TEEN 25' WHERE cg = '__TEEN_NEW__';
UPDATE cg_pelayanan SET cg = 'TEEN 25' WHERE cg = '__TEEN_NEW__';
UPDATE cg_dev_plans SET cg = 'TEEN 25' WHERE cg = '__TEEN_NEW__';
UPDATE cg_custom_roles SET cg = 'TEEN 25' WHERE cg = '__TEEN_NEW__';
UPDATE coach_notes SET cg = 'TEEN 25' WHERE cg = '__TEEN_NEW__';
COMMIT;
```

### 5.5 Hapus CG Kosong (setelah semua member pindah)
```sql
-- Cek kosong dulu
SELECT COUNT(*) FROM members WHERE cg = 'TEEN OLD';

-- Kalau 0, hapus cg_info
DELETE FROM cg_info WHERE cg = 'TEEN OLD';
DELETE FROM cg_vision WHERE cg = 'TEEN OLD';
DELETE FROM coach_notes WHERE cg = 'TEEN OLD';
```

---

## 6. Attendance Operations

### 6.1 Insert Attendance (H/I/S/A untuk 1 member 1 tanggal)
```sql
INSERT INTO attendance (member_id, date_id, status)
VALUES (12, 54, 'H')
ON CONFLICT (member_id, date_id) DO UPDATE SET status = EXCLUDED.status;
```

### 6.2 Bulk Mark All CG Hadir untuk Tanggal Tertentu
```sql
INSERT INTO attendance (member_id, date_id, status)
SELECT m.id, 54, 'H'
FROM members m
WHERE m.cg = 'TEEN 01' AND m.region = 'jaktim1'
ON CONFLICT (member_id, date_id) DO NOTHING;
```

### 6.3 Copy Attendance dari Tanggal Lain (Untuk Backfill)
```sql
-- Contoh: copy attendance tanggal id=53 ke id=54 untuk CG TEEN 01
INSERT INTO attendance (member_id, date_id, status)
SELECT a.member_id, 54, a.status
FROM attendance a
JOIN members m ON m.id = a.member_id
WHERE a.date_id = 53 AND m.cg = 'TEEN 01'
ON CONFLICT (member_id, date_id) DO NOTHING;
```

### 6.4 Hapus Attendance untuk 1 Tanggal (untuk 1 CG)
```sql
DELETE FROM attendance 
WHERE date_id = 54 
  AND member_id IN (SELECT id FROM members WHERE cg = 'TEEN 01');
```

### 6.5 Hitung Persentase Kehadiran per Member
```sql
SELECT 
  m.nama, m.cg,
  COUNT(a.status) FILTER (WHERE a.status = 'H') AS hadir,
  COUNT(a.status) AS total,
  ROUND(COUNT(a.status) FILTER (WHERE a.status = 'H') * 100.0 / NULLIF(COUNT(a.status), 0), 1) AS pct
FROM members m
LEFT JOIN attendance a ON a.member_id = m.id
WHERE m.region = 'jaktim1' AND m.cg NOT LIKE 'ARSIP%'
GROUP BY m.id, m.nama, m.cg
ORDER BY pct DESC NULLS LAST;
```

### 6.6 Hitung Persentase per CG
```sql
SELECT 
  m.cg,
  COUNT(*) FILTER (WHERE a.status = 'H') AS hadir,
  COUNT(*) AS total,
  ROUND(COUNT(*) FILTER (WHERE a.status = 'H') * 100.0 / NULLIF(COUNT(*), 0), 1) AS pct_hadir
FROM members m
JOIN attendance a ON a.member_id = m.id
WHERE m.region = 'jaktim1' AND m.cg NOT LIKE 'ARSIP%'
GROUP BY m.cg
ORDER BY pct_hadir DESC;
```

---

## 7. Dates Management

### 7.1 Insert Tanggal Ibadah Baru
```sql
INSERT INTO dates (label, region, sort_order, month_code) 
VALUES ('16 Mei 2026', 'jaktim1', 100, 'MEI');
```

### 7.2 Generate Sabtu untuk 1 Bulan (Manual)
```sql
-- Contoh: Sabtu Juli 2026 untuk jaktim1
INSERT INTO dates (label, region, sort_order, month_code) VALUES
  ('4 Juli 2026', 'jaktim1', 200, 'JUL'),
  ('11 Juli 2026', 'jaktim1', 201, 'JUL'),
  ('18 Juli 2026', 'jaktim1', 202, 'JUL'),
  ('25 Juli 2026', 'jaktim1', 203, 'JUL');
```

### 7.3 Cek Duplikat Tanggal
```sql
SELECT label, region, COUNT(*) 
FROM dates 
GROUP BY label, region 
HAVING COUNT(*) > 1;
```

### 7.4 Hapus Duplikat Tanggal (keep yang paling awal)
```sql
DELETE FROM dates 
WHERE id NOT IN (
  SELECT MIN(id) 
  FROM dates 
  GROUP BY label, region
);
```

### 7.5 Rename Label Tanggal
```sql
UPDATE dates SET label = '16 Mei 2026' 
WHERE label = '16-5-26' AND region = 'jaktim1';
```

### 7.6 Delete Tanggal + Cascade Attendance
```sql
-- CASCADE otomatis karena FK
DELETE FROM dates WHERE id = 54;
-- attendance dengan date_id=54 akan ikut ke-delete
```

---

## 8. Vision & Dev Plan

### 8.1 Set Visi Coach Region
```sql
INSERT INTO cg_vision (cg, region, visi, misi) 
VALUES ('__COACH_jaktim1__', 'jaktim1', 'Visi Coach text...', 'Misi text...')
ON CONFLICT (cg, region) DO UPDATE 
SET visi = EXCLUDED.visi, misi = EXCLUDED.misi;
```

### 8.2 Set Visi per CG
```sql
INSERT INTO cg_vision (cg, region, visi, misi) 
VALUES ('TEEN 01', 'jaktim1', 'Visi CG text...', 'Misi CG text...')
ON CONFLICT (cg, region) DO UPDATE 
SET visi = EXCLUDED.visi, misi = EXCLUDED.misi;
```

### 8.3 Tambah Dev Plan
```sql
INSERT INTO cg_dev_plans (cg, region, member_name, current_status, target_status, deadline)
VALUES ('TEEN 01', 'jaktim1', 'Nama Member', 'Member', 'Sponsor', '2026-12-31');
```

### 8.4 List Dev Plan Overdue
```sql
SELECT cg, member_name, target_status, deadline,
       (CURRENT_DATE - deadline) AS days_overdue
FROM cg_dev_plans 
WHERE deadline < CURRENT_DATE
ORDER BY days_overdue DESC;
```

### 8.5 Hapus Dev Plan
```sql
DELETE FROM cg_dev_plans WHERE id = 123;
-- atau
DELETE FROM cg_dev_plans 
WHERE cg = 'TEEN 01' AND member_name = 'Nama Member' AND target_status = 'Sponsor';
```

---

## 9. Events

### 9.1 Buat Event Global
```sql
INSERT INTO cg_events (cg, region, is_shared, name, date_start, cat, note)
VALUES ('ALL', 'all', true, 'Kebaktian Umum', '2026-07-06', 'Ibadah', 'Ibadah gabungan');
```

### 9.2 Buat Event Region
```sql
INSERT INTO cg_events (cg, region, is_shared, name, date_start, cat)
VALUES ('ALL', 'jaktim1', true, 'Outreach Jaktim 1', '2026-06-20', 'Outreach');
```

### 9.3 Buat Event Per CG
```sql
INSERT INTO cg_events (cg, region, is_shared, name, date_start, date_end, cat, note)
VALUES ('TEEN 01', 'jaktim1', false, 'CG Meeting Special', '2026-06-15', '2026-06-15', 'CG Event', 'Bawa snack');
```

### 9.4 Cleanup Event Lewat
```sql
-- Delete event yang > 7 hari lewat, skip global
DELETE FROM cg_events 
WHERE date_end < (CURRENT_DATE - INTERVAL '7 days') 
  AND is_shared = false;

DELETE FROM cg_events 
WHERE date_start < (CURRENT_DATE - INTERVAL '7 days') 
  AND date_end IS NULL 
  AND is_shared = false;
```

### 9.5 List Event Upcoming
```sql
SELECT cg, name, date_start, cat, is_shared 
FROM cg_events 
WHERE date_start >= CURRENT_DATE 
ORDER BY date_start;
```

---

## 10. Pelayanan

### 10.1 Assign Role Pelayanan
```sql
INSERT INTO cg_pelayanan (cg, region, month, week_date, role_name, member_name)
VALUES ('TEEN 01', 'jaktim1', '2026-05', '2026-05-03', 'Firman CG', 'Olivia Isabel Pramono')
ON CONFLICT (cg, week_date, role_name) DO UPDATE 
SET member_name = EXCLUDED.member_name;
```

### 10.2 Multi-Assignee (comma-separated)
```sql
UPDATE cg_pelayanan 
SET member_name = 'Nama 1, Nama 2, Nama 3'
WHERE cg = 'TEEN 01' AND week_date = '2026-05-03' AND role_name = 'Game';
```

### 10.3 Hapus Assignment
```sql
DELETE FROM cg_pelayanan 
WHERE cg = 'TEEN 01' AND week_date = '2026-05-03' AND role_name = 'Firman CG';
```

### 10.4 Tambah Custom Role
```sql
INSERT INTO cg_custom_roles (cg, region, role_name, abbr, color, bg)
VALUES ('TEEN 01', 'jaktim1', 'Worship Leader', 'WL', '#7c3aed', '#faf5ff');
```

### 10.5 Statistik Top Pelayanan
```sql
SELECT member_name, COUNT(*) AS total_pelayanan
FROM cg_pelayanan
WHERE cg = 'TEEN 01' AND member_name IS NOT NULL
GROUP BY member_name
ORDER BY total_pelayanan DESC
LIMIT 10;
```

---

## 11. Arsip & Restore

### 11.1 Arsipkan Member (Soft Delete)
```sql
BEGIN;
UPDATE members 
SET cg = 'ARSIP JAKTIM 1', status = 'Alumni'
WHERE nama = 'Nama Member' AND region = 'jaktim1';
COMMIT;
```

### 11.2 Buat CG Arsip (kalau belum ada)
```sql
INSERT INTO cg_info (cg, leader, hari_jam, lokasi)
VALUES ('ARSIP JAKTIM 1', '(Arsip)', '', '')
ON CONFLICT (cg) DO NOTHING;
```

### 11.3 Restore Member dari Arsip
```sql
UPDATE members 
SET cg = 'TEEN 01', status = 'Member'
WHERE nama = 'Nama Member' AND cg = 'ARSIP JAKTIM 1';
```

### 11.4 List Semua Arsip
```sql
SELECT cg, nama, status, region 
FROM members 
WHERE cg LIKE 'ARSIP%'
ORDER BY cg, nama;
```

---

## 12. Debug & Verify

### 12.1 Count Semua Tabel
```sql
SELECT 
  'members' AS tabel, COUNT(*) AS total FROM members
UNION ALL SELECT 'attendance', COUNT(*) FROM attendance
UNION ALL SELECT 'dates', COUNT(*) FROM dates
UNION ALL SELECT 'cg_info', COUNT(*) FROM cg_info
UNION ALL SELECT 'cg_vision', COUNT(*) FROM cg_vision
UNION ALL SELECT 'cg_events', COUNT(*) FROM cg_events
UNION ALL SELECT 'cg_pelayanan', COUNT(*) FROM cg_pelayanan
UNION ALL SELECT 'cg_dev_plans', COUNT(*) FROM cg_dev_plans
UNION ALL SELECT 'member_notes', COUNT(*) FROM member_notes
UNION ALL SELECT 'coach_notes', COUNT(*) FROM coach_notes;
```

### 12.2 Cek Orphan Attendance (member sudah di-delete)
```sql
SELECT a.member_id, a.date_id, a.status
FROM attendance a
LEFT JOIN members m ON m.id = a.member_id
WHERE m.id IS NULL;
```

### 12.3 Cek Attendance Duplikat
```sql
SELECT member_id, date_id, COUNT(*)
FROM attendance
GROUP BY member_id, date_id
HAVING COUNT(*) > 1;
```

### 12.4 Cek Member Tanpa CG
```sql
SELECT id, nama, region FROM members WHERE cg IS NULL OR cg = '';
```

### 12.5 Cek CG di members tapi Tidak Ada di cg_info
```sql
SELECT DISTINCT m.cg 
FROM members m
LEFT JOIN cg_info c ON c.cg = m.cg
WHERE c.cg IS NULL AND m.cg IS NOT NULL AND m.cg NOT LIKE 'ARSIP%';
```

### 12.6 Cek Member Baru Belum Diabsen
```sql
SELECT m.nama, m.cg
FROM members m
WHERE NOT EXISTS (
  SELECT 1 FROM attendance a WHERE a.member_id = m.id
)
AND m.cg NOT LIKE 'ARSIP%'
AND m.region = 'jaktim1';
```

### 12.7 Cek Tanggal Duplikat
```sql
SELECT label, region, COUNT(*), array_agg(id) AS ids
FROM dates
GROUP BY label, region
HAVING COUNT(*) > 1;
```

### 12.8 Cek Realtime Publication
```sql
SELECT tablename FROM pg_publication_tables 
WHERE pubname = 'supabase_realtime' 
ORDER BY tablename;
```

### 12.9 Cek RLS Status
```sql
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public'
ORDER BY tablename;
-- rowsecurity=false = OK (RLS disabled)
```

### 12.10 Cek Ukuran Tabel
```sql
SELECT 
  schemaname||'.'||tablename AS full_name,
  pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;
```

---

## 13. Backup & Export

### 13.1 Export Members ke CSV (via SQL Editor)
```sql
SELECT id, nama, cg, status, region, wa, lahir, sekolah, kelas, kelurahan, kecamatan,
       msj1, msj2, msj3, cgt1, cgt2, cgt3, baptis_air, baptis_roh
FROM members
ORDER BY region, cg, nama;
```
Klik **Download CSV** di Supabase SQL Editor result panel.

### 13.2 Export Attendance ke CSV
```sql
SELECT a.member_id, m.nama, m.cg, a.date_id, d.label, d.region, a.status
FROM attendance a
JOIN members m ON m.id = a.member_id
JOIN dates d ON d.id = a.date_id
ORDER BY m.region, m.cg, m.nama, d.sort_order;
```

### 13.3 Backup Full Schema + Data (via pg_dump)
```bash
# Di terminal (butuh psql installed)
pg_dump "postgresql://postgres:PASSWORD@db.gqppviugodokncxezdwd.supabase.co:5432/postgres" \
  --schema=public --no-owner --no-privileges \
  > backup_$(date +%Y%m%d).sql
```

### 13.4 Restore dari Backup
```bash
psql "postgresql://postgres:PASSWORD@db.gqppviugodokncxezdwd.supabase.co:5432/postgres" \
  < backup_20260516.sql
```

---

## 14. Emergency Recovery

### 14.1 Restore dari Supabase Auto-Backup
1. Supabase Dashboard → **Database → Backups**
2. Pilih tanggal → **Restore**
3. WARNING: seluruh DB revert ke titik itu, semua data setelahnya hilang

### 14.2 Rollback Specific Table (kalau tidak mau full restore)
Kalau baru saja run destructive query dan mau undo — sayangnya Supabase Free tier tidak punya per-table restore. Solusinya:
1. Restore full backup ke temp project
2. Export tabel yang mau restore
3. Import ke production

### 14.3 Prevention Pattern (WAJIB)
```sql
-- SELALU pakai transaction untuk destructive query
BEGIN;

-- 1. Cek dulu berapa row yang akan kena
SELECT COUNT(*) FROM members WHERE ... ; 
-- lihat hasilnya, kalau masuk akal → lanjut

-- 2. Test query (misal SELECT dulu, bukan langsung UPDATE)
SELECT * FROM members WHERE ... LIMIT 5;

-- 3. Baru execute UPDATE/DELETE
UPDATE members SET ... WHERE ...;

-- 4. Verify hasil
SELECT COUNT(*) FROM members WHERE (kondisi setelah update);

-- 5. Kalau OK, commit. Kalau ada yang aneh:
-- ROLLBACK;
COMMIT;
```

### 14.4 Recreate Publication Realtime kalau Broken
```sql
-- Drop dan buat ulang
DROP PUBLICATION IF EXISTS supabase_realtime;
CREATE PUBLICATION supabase_realtime;

-- Re-add tables (copy dari section 1.1)
```

### 14.5 Reset Sequence ID (kalau ada gap besar)
```sql
-- Set members id sequence ke MAX + 1
SELECT setval('members_id_seq', (SELECT MAX(id) FROM members));
```

---

## 📌 SQL Anti-Patterns (JANGAN DILAKUKAN)

### ❌ DELETE tanpa WHERE
```sql
DELETE FROM members;  -- HAPUS SEMUA! Bencana total.
```

### ❌ UPDATE tanpa WHERE
```sql
UPDATE members SET status = 'Alumni';  -- Semua jadi Alumni!
```

### ❌ Query di production tanpa test
Selalu:
1. Cek `SELECT COUNT(*) WHERE ...` dulu
2. Test `SELECT * WHERE ... LIMIT 5`
3. Wrap dengan `BEGIN; ... COMMIT;`

### ❌ Enable RLS tanpa policies
```sql
ALTER TABLE members ENABLE ROW LEVEL SECURITY;  -- Semua query dari anon key gagal!
```

### ❌ ALTER PUBLICATION dengan syntax salah
```sql
-- Salah: tidak ada spasi
ALTER PUBLICATION supabase_realtime ADDTABLE members;
```

---

## 🔗 Related Files
- `CLAUDE.md` — project docs
- `MASTER_HANDOFF.md` — full context
- `AUTO_ACCESS_SETUP.md` — setup psql direct SQL execution
