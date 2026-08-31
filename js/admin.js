/*******************************************************************
 * PROJECT      : Sistem Absensi
 * MODULE       : Daftar Admin Page Logic
 * FILE         : js/admin.js
 * VERSION      : v1.0.0
 * AUTHOR       : Tim Pengembang
 * CREATED      : 2026-08-30
 * LAST UPDATE  : 2026-08-30
 *
 * DESCRIPTION
 * -----------------------------------------------------------------
 * Logic khusus admin.html. Mengirim data admin baru ke API aksi
 * "tambahAdmin", pencatat aktivitas diambil dari sesi yang login.
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
 * Required : js/api.js (panggilApi_), js/auth.js (wajibLogin, dst)
 ******************************************************************/

/*******************************************************************
 * CONSTANTS
 ******************************************************************/
const PANJANG_PASSWORD_MINIMAL = 4;

let sesiAktif_ = null;

/******************************************************************
 * Function : tampilkanPesan_(teks, jenis)
 * Tujuan   : Menampilkan pesan error/sukses di form.
 ******************************************************************/
function tampilkanPesan_(teks, jenis) {
  const kotak = document.getElementById("pesanForm");
  kotak.textContent = teks;
  kotak.className = "pesan " + jenis;
}

/******************************************************************
 * Function : aturTombolSimpan_(nonaktif, teks)
 * Tujuan   : Mengunci tombol submit saat proses berjalan.
 ******************************************************************/
function aturTombolSimpan_(nonaktif, teks) {
  const tombol = document.getElementById("tombolSimpan");
  tombol.disabled = nonaktif;
  tombol.textContent = teks;
}

/******************************************************************
 * Function : submitFormTambahAdmin_(event)
 * Tujuan   : Validasi dasar, lalu kirim ke API "tambahAdmin".
 ******************************************************************/
async function submitFormTambahAdmin_(event) {
  event.preventDefault();

  const nama = document.getElementById("inputNama").value.trim();
  const username = document.getElementById("inputUsername").value.trim();
  const password = document.getElementById("inputPassword").value;
  const konfirmasi = document.getElementById("inputKonfirmasi").value;

  if (!nama || !username || !password || !konfirmasi) {
    tampilkanPesan_("Semua kolom wajib diisi.", "error");
    return;
  }

  if (password.length < PANJANG_PASSWORD_MINIMAL) {
    tampilkanPesan_("Password minimal " + PANJANG_PASSWORD_MINIMAL + " karakter.", "error");
    return;
  }

  if (password !== konfirmasi) {
    tampilkanPesan_("Konfirmasi password tidak cocok.", "error");
    return;
  }

  aturTombolSimpan_(true, "Menyimpan...");

  try {
    const hasil = await panggilApi_("tambahAdmin", {
      nama: nama,
      username: username,
      password: password,
      usernamePembuat: sesiAktif_.username,
      penandaPembuat: sesiAktif_.penandaAdmin
    });

    aturTombolSimpan_(false, "Tambah Admin");

    if (!hasil.success) {
      tampilkanPesan_(hasil.message, "error");
      return;
    }

    tampilkanPesan_(hasil.message, "sukses");
    document.getElementById("formTambahAdmin").reset();
  } catch (error) {
    aturTombolSimpan_(false, "Tambah Admin");
    tampilkanPesan_("[TAMBAH ADMIN] " + error.message, "error");
  }
}

/******************************************************************
 * INISIALISASI HALAMAN
 ******************************************************************/
(function inisialisasiHalamanAdmin_() {
  const sesi = wajibLogin();
  if (!sesi) return;

  sesiAktif_ = sesi;
  tampilkanInfoUser(sesi);

  document.getElementById("formTambahAdmin").addEventListener("submit", submitFormTambahAdmin_);
})();
