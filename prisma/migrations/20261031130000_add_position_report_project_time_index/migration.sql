-- CONCURRENTLY agar kiriman GPS tidak terkunci selama index dibuat.
-- Harus satu-satunya perintah di file ini (tidak boleh di dalam transaksi).
CREATE INDEX CONCURRENTLY IF NOT EXISTS "position_reports_projectId_reported_at_idx" ON "position_reports"("projectId", "reported_at" DESC);
