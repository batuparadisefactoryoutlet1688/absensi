/*******************************************************************
 * PROJECT      : Sistem Absensi
 * MODULE       : API Client
 * FILE         : js/api.js
 * VERSION      : v1.0.0
 * AUTHOR       : Tim Pengembang
 * CREATED      : 2026-08-30
 * LAST UPDATE  : 2026-08-30
 *
 * DESCRIPTION
 * -----------------------------------------------------------------
 * Satu-satunya tempat konfigurasi URL Apps Script API dan fungsi
 * pemanggilnya. Dipakai oleh seluruh halaman lewat <script src>.
 ******************************************************************/

/*******************************************************************
 * VERSION HISTORY
 * -----------------------------------------------------------------
 * v1.0.0
 * - Initial Release.
 ******************************************************************/

/*******************************************************************
 * CONFIGURATION
 * -----------------------------------------------------------------
 * WAJIB DIGANTI kalau Bapak deploy ulang Apps Script sebagai
 * deployment BARU (URL exec berubah). Kalau cuma "New version" di
 * deployment yang sama, URL ini TIDAK berubah.
 ******************************************************************/
const APPSCRIPT_API_URL = "https://script.google.com/macros/s/AKfycbyvLTfMC_I9PAQ0yIP6wqHwPisuF5HVUkdCSr-_7fKQFaOivVvZFTPrrhy3tGSJgaZ7gg/exec";

/*******************************************************************
 * PEMANGGIL API
 * -----------------------------------------------------------------
 ******************************************************************/

/******************************************************************
 * Function : panggilApi_(aksi, payload)
 * Tujuan   : Memanggil Apps Script API lewat fetch(). Content-Type
 *            sengaja "text/plain" agar tidak memicu CORS preflight.
 ******************************************************************/
async function panggilApi_(aksi, payload) {
  const response = await fetch(APPSCRIPT_API_URL, {
    method: "POST",
    headers: { "Content-Type": "text/plain;charset=utf-8" },
    body: JSON.stringify({ action: aksi, payload: payload || {} })
  });

  if (!response.ok) {
    throw new Error("Server merespons status " + response.status);
  }

  return response.json();
}
