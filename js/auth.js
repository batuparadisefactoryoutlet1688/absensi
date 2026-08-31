/*******************************************************************
 * PROJECT      : Sistem Absensi
 * MODULE       : Auth / Session
 * FILE         : js/auth.js
 * VERSION      : v1.0.0
 * AUTHOR       : Tim Pengembang
 * CREATED      : 2026-08-30
 * LAST UPDATE  : 2026-08-30
 *
 * DESCRIPTION
 * -----------------------------------------------------------------
 * Mengelola status login di sisi browser memakai sessionStorage
 * (nempel selama tab belum ditutup, hilang otomatis kalau tab
 * ditutup). Karena aplikasi ini multi-halaman (bukan SPA satu file),
 * setiap halaman selain index.html WAJIB memanggil wajibLogin() di
 * awal supaya otomatis dilempar ke index.html kalau belum login.
 ******************************************************************/

/*******************************************************************
 * VERSION HISTORY
 * -----------------------------------------------------------------
 * v1.0.0
 * - Initial Release.
 ******************************************************************/

/*******************************************************************
 * CONSTANTS
 ******************************************************************/
const KUNCI_SESI = "sesiAbsensi";

/*******************************************************************
 * MANAJEMEN SESI
 * -----------------------------------------------------------------
 ******************************************************************/

/******************************************************************
 * Function : simpanSesi(sesi)
 * Tujuan   : Menyimpan data sesi login (hasil dari loginAdmin) ke sessionStorage.
 ******************************************************************/
function simpanSesi(sesi) {
  sessionStorage.setItem(KUNCI_SESI, JSON.stringify(sesi));
}

/******************************************************************
 * Function : ambilSesi()
 * Tujuan   : Mengambil data sesi login. Null jika belum login.
 ******************************************************************/
function ambilSesi() {
  const data = sessionStorage.getItem(KUNCI_SESI);
  return data ? JSON.parse(data) : null;
}

/******************************************************************
 * Function : hapusSesi()
 * Tujuan   : Menghapus data sesi (dipakai saat logout).
 ******************************************************************/
function hapusSesi() {
  sessionStorage.removeItem(KUNCI_SESI);
}

/******************************************************************
 * Function : wajibLogin()
 * Tujuan   : Dipanggil di awal setiap halaman terproteksi. Jika
 *            belum login, langsung redirect ke index.html.
 *            Mengembalikan data sesi jika sudah login.
 ******************************************************************/
function wajibLogin() {
  const sesi = ambilSesi();
  if (!sesi) {
    window.location.href = "index.html";
    return null;
  }
  return sesi;
}

/******************************************************************
 * Function : logout()
 * Tujuan   : Menghapus sesi dan kembali ke halaman Login.
 ******************************************************************/
function logout() {
  hapusSesi();
  window.location.href = "index.html";
}

/******************************************************************
 * Function : tampilkanInfoUser(sesi)
 * Tujuan   : Menampilkan nama & penanda admin yang sedang login
 *            di elemen #labelUserAktif (jika ada di halaman) dan
 *            memasang event logout di #tombolKeluar (jika ada).
 ******************************************************************/
function tampilkanInfoUser(sesi) {
  const label = document.getElementById("labelUserAktif");
  if (label) {
    label.textContent = sesi.nama + " (" + sesi.penandaAdmin + ")";
  }

  const tombol = document.getElementById("tombolKeluar");
  if (tombol) {
    tombol.addEventListener("click", logout);
  }
}
