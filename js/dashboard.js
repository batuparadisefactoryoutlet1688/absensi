/*******************************************************************
 * PROJECT      : Sistem Absensi
 * MODULE       : Dashboard Page Logic
 * FILE         : js/dashboard.js
 * VERSION      : v1.0.0
 * AUTHOR       : Tim Pengembang
 * CREATED      : 2026-08-30
 * LAST UPDATE  : 2026-08-30
 *
 * DESCRIPTION
 * -----------------------------------------------------------------
 * Logic khusus dashboard.html. Halaman ini terproteksi login dan
 * hanya menampilkan info user + tombol keluar (isi menu ada di
 * dashboard.html langsung, tidak perlu render dinamis).
 ******************************************************************/

/*******************************************************************
 * VERSION HISTORY
 * -----------------------------------------------------------------
 * v1.0.0
 * - Initial Release.
 ******************************************************************/

/*******************************************************************
 * DEPENDENCIES
 * -----------------------------------------------------------------
 * Required : js/auth.js (wajibLogin, tampilkanInfoUser)
 ******************************************************************/

/******************************************************************
 * INISIALISASI HALAMAN
 ******************************************************************/
(function inisialisasiDashboard_() {
  const sesi = wajibLogin();
  if (!sesi) return;

  tampilkanInfoUser(sesi);
})();
