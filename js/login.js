/*******************************************************************
 * PROJECT      : Sistem Absensi
 * MODULE       : Login Page Logic
 * FILE         : js/login.js
 * VERSION      : v1.0.0
 * AUTHOR       : Tim Pengembang
 * CREATED      : 2026-08-30
 * LAST UPDATE  : 2026-08-30
 *
 * DESCRIPTION
 * -----------------------------------------------------------------
 * Logic khusus halaman index.html (Login). Memanggil API "login",
 * menyimpan sesi lewat auth.js, lalu redirect ke dashboard.html.
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
 * Required : js/api.js (panggilApi_), js/auth.js (simpanSesi)
 ******************************************************************/

/******************************************************************
 * Function : tampilkanPesanLogin(teks, jenis)
 * Tujuan   : Menampilkan pesan error/sukses di form login.
 ******************************************************************/
function tampilkanPesanLogin(teks, jenis) {
  const kotak = document.getElementById("pesanLogin");
  kotak.textContent = teks;
  kotak.className = "pesan " + jenis;
}

/******************************************************************
 * Function : aturTombolLogin(nonaktif, teks)
 * Tujuan   : Mengunci tombol submit saat proses login berjalan.
 ******************************************************************/
function aturTombolLogin(nonaktif, teks) {
  const tombol = document.getElementById("tombolLogin");
  tombol.disabled = nonaktif;
  tombol.textContent = teks;
}

/******************************************************************
 * Function : submitFormLogin(event)
 * Tujuan   : Mengirim data login ke API dan menangani hasilnya.
 ******************************************************************/
async function submitFormLogin(event) {
  event.preventDefault();

  const username = document.getElementById("inputUsername").value.trim();
  const password = document.getElementById("inputPassword").value;
  const penanda = document.getElementById("inputPenanda").value;

  if (!username || !password || !penanda) {
    tampilkanPesanLogin("Semua kolom wajib diisi.", "error");
    return;
  }

  aturTombolLogin(true, "Memproses...");

  try {
    const hasil = await panggilApi_("login", {
      username: username,
      password: password,
      penandaAdmin: penanda
    });

    aturTombolLogin(false, "Login");

    if (!hasil.success) {
      tampilkanPesanLogin(hasil.message, "error");
      return;
    }

    simpanSesi(hasil);
    window.location.href = "dashboard.html";
  } catch (error) {
    aturTombolLogin(false, "Login");
    tampilkanPesanLogin("[LOGIN] " + error.message, "error");
  }
}

/******************************************************************
 * INISIALISASI HALAMAN
 * ----------------------------------------------------------------
 * Kalau sudah login sebelumnya (sesi masih ada), langsung lempar
 * ke dashboard supaya tidak perlu login ulang.
 ******************************************************************/
(function inisialisasiHalamanLogin_() {
  if (ambilSesi()) {
    window.location.href = "dashboard.html";
    return;
  }
  document.getElementById("formLogin").addEventListener("submit", submitFormLogin);
})();
