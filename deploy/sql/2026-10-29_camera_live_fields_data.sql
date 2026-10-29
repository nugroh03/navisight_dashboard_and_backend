-- Isi kolom live view (go2rtc) untuk 8 kamera, dicocokkan lewat ID monitor Shinobi di URL kamera.
-- Jalankan SETELAH migrasi 20261029090000_add_camera_live_fields diterapkan.
-- ptzEnabled/audioEnabled sengaja false: diaktifkan setelah fitur PTZ (Rilis 2) dan mic (Rilis 3) selesai.

-- 1) PRATINJAU: pastikan tiap monitor cocok dengan tepat 1 kamera sebelum UPDATE.
SELECT m.stream, m.host, m.monitor_id, count(c.id) AS cocok, string_agg(c.name, ', ') AS kamera
FROM (VALUES
  ('cam34',  '192.168.1.34',  'cSLk5GJCDC'),
  ('cam43',  '192.168.1.43',  'IWZbQL1uJm'),  -- dugaan (kamera mati saat pemetaan), cek manual
  ('cam51',  '192.168.1.51',  'lvWkO76ScO'),
  ('cam102', '192.168.1.102', 'jzPE6pDnUs'),
  ('cam106', '192.168.1.106', 'L1czXsWT8h'),
  ('cam130', '192.168.1.130', '5IlPRRxheX'),
  ('cam141', '192.168.1.141', 'f960kt4AKJ'),
  ('cam170', '192.168.1.170', 'LQIwuTCf5g')
) AS m(stream, host, monitor_id)
LEFT JOIN cameras c ON c.ulr_camera LIKE '%' || m.monitor_id || '%'
GROUP BY m.stream, m.host, m.monitor_id
ORDER BY m.stream;

-- 2) UPDATE (jalankan hanya jika semua baris di atas "cocok = 1").
BEGIN;
UPDATE cameras c
SET "go2rtcStream" = m.stream,
    "isapiHost"    = m.host
FROM (VALUES
  ('cam34',  '192.168.1.34',  'cSLk5GJCDC'),
  ('cam43',  '192.168.1.43',  'IWZbQL1uJm'),
  ('cam51',  '192.168.1.51',  'lvWkO76ScO'),
  ('cam102', '192.168.1.102', 'jzPE6pDnUs'),
  ('cam106', '192.168.1.106', 'L1czXsWT8h'),
  ('cam130', '192.168.1.130', '5IlPRRxheX'),
  ('cam141', '192.168.1.141', 'f960kt4AKJ'),
  ('cam170', '192.168.1.170', 'LQIwuTCf5g')
) AS m(stream, host, monitor_id)
WHERE c.ulr_camera LIKE '%' || m.monitor_id || '%';
-- Periksa jumlah baris (harus 8), lalu COMMIT; atau ROLLBACK; bila tidak sesuai.
-- COMMIT;
