#!/usr/bin/env node
// Buat token untuk agent pemantau (PC lokal) TANPA menyentuh database.
// Usage: node scripts/create-monitor-agent.mjs "PC Kantor"
// - TOKEN: simpan di PC lokal (file env agent, izin 600). Tidak ditampilkan lagi.
// - SQL: jalankan di database produksi; hanya hash token yang disimpan.
import { createHash, randomBytes, randomUUID } from 'node:crypto';

const name = (process.argv[2] || 'PC lokal').replace(/'/g, "''").slice(0, 100);
const token = randomBytes(32).toString('base64url');
const hash = createHash('sha256').update(token, 'utf8').digest('hex');

console.log(`TOKEN=${token}\n`);
console.log(
  `INSERT INTO monitor_agents (id, name, token_hash, updated_at)\n` +
    `VALUES ('${randomUUID()}', '${name}', '${hash}', now());`
);
