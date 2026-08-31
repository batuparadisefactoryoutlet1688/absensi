/*******************************************************************
 * PROJECT      : Sistem Absensi
 * MODULE       : Pegawai Page Logic
 * FILE         : js/pegawai.js
 * VERSION      : v1.0.0
 * AUTHOR       : Tim Pengembang
 * CREATED      : 2026-08-30
 * LAST UPDATE  : 2026-08-30
 *
 * DESCRIPTION
 * -----------------------------------------------------------------
 * Logic khusus pegawai.html: tab Tambah Pegawai (form + dropdown
 * cascading PT->Divisi->Lantai) dan tab Update/Pindah (tabel cari
 * pegawai, modal pindah PT/Divisi/Lantai, tombol nonaktifkan).
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
 * Required : js/api.js, js/auth.js
 ******************************************************************/

/*******************************************************************
 * STATE
 ******************************************************************/
let sesiAktif_ = null;
let daftarPtCache_ = [];
let daftarDivisiCache_ = [];
let daftarPegawaiCache_ = [];
let idPegawaiDipilihUntukPindah_ = null;

/*******************************************************************
 * TAB SWITCHING
 * -----------------------------------------------------------------
 ******************************************************************/

/******************************************************************
 * Function : pasangTabBar_()
 * Tujuan   : Memasang event klik untuk berpindah tab.
 ******************************************************************/
function pasangTabBar_() {
  document.querySelectorAll(".tabItem").forEach(function (tab) {
    tab.addEventListener("click", function () {
      document.querySelectorAll(".tabItem").forEach(function (t) { t.classList.remove("aktif"); });
      document.querySelectorAll(".tabKonten").forEach(function (k) { k.classList.remove("aktif"); });

      tab.classList.add("aktif");
      document.getElementById(tab.getAttribute("data-tab")).classList.add("aktif");

      if (tab.getAttribute("data-tab") === "tabUpdate" && daftarPegawaiCache_.length === 0) {
        muatDaftarPegawai_();
      }
    });
  });
}

/*******************************************************************
 * DROPDOWN CASCADING (dipakai form Tambah & modal Pindah)
 * -----------------------------------------------------------------
 ******************************************************************/

/******************************************************************
 * Function : isiDropdownPt_(elemenSelect)
 * Tujuan   : Mengisi dropdown PT dari cache.
 ******************************************************************/
function isiDropdownPt_(elemenSelect) {
  elemenSelect.innerHTML = '<option value="">Pilih PT</option>';
  daftarPtCache_.forEach(function (pt) {
    const opsi = document.createElement("option");
    opsi.value = pt.ID_PT;
    opsi.textContent = pt.NAMA_PT;
    elemenSelect.appendChild(opsi);
  });
}

/******************************************************************
 * Function : tanganiPilihPt_(idPt, elemenDivisi, elemenBlokLantai, elemenLantai)
 * Tujuan   : Memuat Divisi & Lantai sesuai PT yang dipilih.
 ******************************************************************/
async function tanganiPilihPt_(idPt, elemenDivisi, elemenBlokLantai, elemenLantai) {
  elemenDivisi.disabled = true;
  elemenDivisi.innerHTML = '<option value="">Memuat...</option>';
  elemenBlokLantai.classList.add("hidden");

  if (!idPt) {
    elemenDivisi.innerHTML = '<option value="">Pilih PT dulu</option>';
    return;
  }

  const [hasilDivisi, hasilLantai] = await Promise.all([
    panggilApi_("daftarDivisi", { idPt: idPt }),
    panggilApi_("daftarLantai", { idPt: idPt })
  ]);

  elemenDivisi.innerHTML = '<option value="">Pilih Divisi</option>';
  if (hasilDivisi.success) {
    hasilDivisi.data.forEach(function (divisi) {
      const opsi = document.createElement("option");
      opsi.value = divisi.ID_DIVISI;
      opsi.textContent = divisi.NAMA_DIVISI;
      elemenDivisi.appendChild(opsi);
    });
  }
  elemenDivisi.disabled = false;

  if (hasilLantai.success && hasilLantai.data.length > 0) {
    elemenLantai.innerHTML = '<option value="">Pilih Lantai</option>';
    hasilLantai.data.forEach(function (lantai) {
      const opsi = document.createElement("option");
      opsi.value = lantai.ID_LANTAI;
      opsi.textContent = lantai.NAMA_LANTAI;
      elemenLantai.appendChild(opsi);
    });
    elemenBlokLantai.classList.remove("hidden");
  }
}

/*******************************************************************
 * TAB: TAMBAH PEGAWAI
 * -----------------------------------------------------------------
 ******************************************************************/

/******************************************************************
 * Function : tampilkanPesanTambah_(teks, jenis)
 ******************************************************************/
function tampilkanPesanTambah_(teks, jenis) {
  const kotak = document.getElementById("pesanTambahPegawai");
  kotak.textContent = teks;
  kotak.className = "pesan " + jenis;
}

/******************************************************************
 * Function : submitFormTambahPegawai_(event)
 * Tujuan   : Mengirim data pegawai baru ke API "tambahPegawai".
 ******************************************************************/
async function submitFormTambahPegawai_(event) {
  event.preventDefault();

  const namaAsli = document.getElementById("tpNamaAsli").value.trim();
  const nickname = document.getElementById("tpNickname").value.trim();
  const idPt = document.getElementById("tpPt").value;
  const idDivisi = document.getElementById("tpDivisi").value;
  const idLantai = document.getElementById("tpLantai").value;

  if (!namaAsli || !nickname || !idPt || !idDivisi) {
    tampilkanPesanTambah_("Nama, Nickname, PT, dan Divisi wajib diisi.", "error");
    return;
  }

  const tombol = document.getElementById("tombolTambahPegawai");
  tombol.disabled = true;
  tombol.textContent = "Menyimpan...";

  try {
    const hasil = await panggilApi_("tambahPegawai", {
      namaAsli: namaAsli,
      nickname: nickname,
      idPt: idPt,
      idDivisi: idDivisi,
      idLantai: idLantai,
      username: sesiAktif_.username,
      penandaAdmin: sesiAktif_.penandaAdmin
    });

    tombol.disabled = false;
    tombol.textContent = "Tambah Pegawai";

    if (!hasil.success) {
      tampilkanPesanTambah_(hasil.message, "error");
      return;
    }

    tampilkanPesanTambah_(hasil.message, "sukses");
    document.getElementById("formTambahPegawai").reset();
    document.getElementById("tpDivisi").innerHTML = '<option value="">Pilih PT dulu</option>';
    document.getElementById("tpBlokLantai").classList.add("hidden");
    daftarPegawaiCache_ = [];
  } catch (error) {
    tombol.disabled = false;
    tombol.textContent = "Tambah Pegawai";
    tampilkanPesanTambah_("[TAMBAH PEGAWAI] " + error.message, "error");
  }
}

/*******************************************************************
 * TAB: UPDATE / PINDAH
 * -----------------------------------------------------------------
 ******************************************************************/

/******************************************************************
 * Function : muatDaftarPegawai_()
 * Tujuan   : Mengambil seluruh pegawai aktif + nama PT/Divisi/Lantai
 *            (untuk ditampilkan, bukan ID mentah) lalu render tabel.
 ******************************************************************/
async function muatDaftarPegawai_() {
  const [hasilPegawai, hasilPt, hasilDivisi] = await Promise.all([
    panggilApi_("daftarPegawai", {}),
    panggilApi_("daftarPT", {}),
    panggilApi_("daftarDivisi", {})
  ]);

  if (!hasilPegawai.success) {
    document.getElementById("tabelPegawaiBody").innerHTML =
      '<tr><td colspan="6" class="teksMuted">Gagal memuat data: ' + hasilPegawai.message + '</td></tr>';
    return;
  }

  daftarPegawaiCache_ = hasilPegawai.data;

  const petaPt = {};
  (hasilPt.data || []).forEach(function (pt) { petaPt[pt.ID_PT] = pt.NAMA_PT; });

  const petaDivisi = {};
  (hasilDivisi.data || []).forEach(function (d) { petaDivisi[d.ID_DIVISI] = d.NAMA_DIVISI; });

  daftarPegawaiCache_.forEach(function (pegawai) {
    pegawai._NAMA_PT = petaPt[pegawai.PT] || pegawai.PT;
    pegawai._NAMA_DIVISI = petaDivisi[pegawai.DIVISI] || pegawai.DIVISI;
  });

  renderTabelPegawai_(daftarPegawaiCache_);
}

/******************************************************************
 * Function : renderTabelPegawai_(daftar)
 * Tujuan   : Menampilkan daftar pegawai ke tabel.
 ******************************************************************/
function renderTabelPegawai_(daftar) {
  const body = document.getElementById("tabelPegawaiBody");

  if (daftar.length === 0) {
    body.innerHTML = '<tr><td colspan="6" class="teksMuted">Tidak ada data.</td></tr>';
    return;
  }

  body.innerHTML = "";
  daftar.forEach(function (pegawai) {
    const baris = document.createElement("tr");
    baris.innerHTML =
      "<td>" + pegawai.NAMA_ASLI + "</td>" +
      "<td>" + pegawai.NICKNAME + "</td>" +
      "<td>" + pegawai._NAMA_PT + "</td>" +
      "<td>" + pegawai._NAMA_DIVISI + "</td>" +
      "<td>" + (pegawai.LANTAI === "-" ? "-" : pegawai.LANTAI) + "</td>" +
      '<td><button type="button" class="tombolKecil tombolPindah" data-id="' + pegawai.ID_KARYAWAN + '" data-nama="' + pegawai.NICKNAME + '">Pindah</button> ' +
      '<button type="button" class="tombolKecil tombolBahaya tombolNonaktif" data-id="' + pegawai.ID_KARYAWAN + '">Nonaktifkan</button></td>';
    body.appendChild(baris);
  });

  document.querySelectorAll(".tombolPindah").forEach(function (tombol) {
    tombol.addEventListener("click", function () {
      bukaModalPindah_(tombol.getAttribute("data-id"), tombol.getAttribute("data-nama"));
    });
  });

  document.querySelectorAll(".tombolNonaktif").forEach(function (tombol) {
    tombol.addEventListener("click", function () {
      jalankanNonaktifkan_(tombol.getAttribute("data-id"));
    });
  });
}

/******************************************************************
 * Function : pasangPencarianPegawai_()
 * Tujuan   : Filter tabel secara real-time berdasarkan input pencarian.
 ******************************************************************/
function pasangPencarianPegawai_() {
  document.getElementById("upCari").addEventListener("input", function (event) {
    const kataKunci = event.target.value.trim().toLowerCase();
    const hasilFilter = daftarPegawaiCache_.filter(function (pegawai) {
      return pegawai.NAMA_ASLI.toLowerCase().indexOf(kataKunci) !== -1 ||
             pegawai.NICKNAME.toLowerCase().indexOf(kataKunci) !== -1;
    });
    renderTabelPegawai_(hasilFilter);
  });
}

/******************************************************************
 * Function : jalankanNonaktifkan_(idKaryawan)
 * Tujuan   : Menonaktifkan pegawai setelah konfirmasi.
 ******************************************************************/
async function jalankanNonaktifkan_(idKaryawan) {
  const yakin = confirm("Yakin ingin menonaktifkan pegawai ini?");
  if (!yakin) return;

  try {
    const hasil = await panggilApi_("nonaktifkanPegawai", {
      idKaryawan: idKaryawan,
      username: sesiAktif_.username,
      penandaAdmin: sesiAktif_.penandaAdmin
    });

    if (!hasil.success) {
      alert(hasil.message);
      return;
    }

    daftarPegawaiCache_ = [];
    muatDaftarPegawai_();
  } catch (error) {
    alert("[NONAKTIFKAN] " + error.message);
  }
}

/*******************************************************************
 * MODAL: PINDAH PEGAWAI
 * -----------------------------------------------------------------
 ******************************************************************/

/******************************************************************
 * Function : bukaModalPindah_(idKaryawan, nickname)
 * Tujuan   : Membuka modal pindah dan mengisi dropdown PT.
 ******************************************************************/
function bukaModalPindah_(idKaryawan, nickname) {
  idPegawaiDipilihUntukPindah_ = idKaryawan;
  document.getElementById("judulModalPindah").textContent = "Pindahkan " + nickname;
  document.getElementById("pesanModalPindah").className = "pesan";

  const selectPt = document.getElementById("mpPt");
  isiDropdownPt_(selectPt);
  document.getElementById("mpDivisi").innerHTML = '<option value="">Pilih PT dulu</option>';
  document.getElementById("mpBlokLantai").classList.add("hidden");

  document.getElementById("modalPindah").classList.add("tampil");
}

/******************************************************************
 * Function : tutupModalPindah_()
 ******************************************************************/
function tutupModalPindah_() {
  document.getElementById("modalPindah").classList.remove("tampil");
  idPegawaiDipilihUntukPindah_ = null;
}

/******************************************************************
 * Function : simpanPindahPegawai_()
 * Tujuan   : Mengirim data pindah ke API "pindahPegawai".
 ******************************************************************/
async function simpanPindahPegawai_() {
  const idPtBaru = document.getElementById("mpPt").value;
  const idDivisiBaru = document.getElementById("mpDivisi").value;
  const idLantaiBaru = document.getElementById("mpLantai").value;

  const kotakPesan = document.getElementById("pesanModalPindah");

  if (!idPtBaru || !idDivisiBaru) {
    kotakPesan.textContent = "PT dan Divisi wajib dipilih.";
    kotakPesan.className = "pesan error";
    return;
  }

  try {
    const hasil = await panggilApi_("pindahPegawai", {
      idKaryawan: idPegawaiDipilihUntukPindah_,
      idPtBaru: idPtBaru,
      idDivisiBaru: idDivisiBaru,
      idLantaiBaru: idLantaiBaru,
      username: sesiAktif_.username,
      penandaAdmin: sesiAktif_.penandaAdmin
    });

    if (!hasil.success) {
      kotakPesan.textContent = hasil.message;
      kotakPesan.className = "pesan error";
      return;
    }

    tutupModalPindah_();
    daftarPegawaiCache_ = [];
    muatDaftarPegawai_();
  } catch (error) {
    kotakPesan.textContent = "[PINDAH] " + error.message;
    kotakPesan.className = "pesan error";
  }
}

/*******************************************************************
 * INISIALISASI HALAMAN
 * -----------------------------------------------------------------
 ******************************************************************/
(async function inisialisasiHalamanPegawai_() {
  const sesi = wajibLogin();
  if (!sesi) return;

  sesiAktif_ = sesi;
  tampilkanInfoUser(sesi);
  pasangTabBar_();
  pasangPencarianPegawai_();

  const hasilPt = await panggilApi_("daftarPT", {});
  if (hasilPt.success) {
    daftarPtCache_ = hasilPt.data;
    isiDropdownPt_(document.getElementById("tpPt"));
  }

  document.getElementById("tpPt").addEventListener("change", function () {
    tanganiPilihPt_(
      this.value,
      document.getElementById("tpDivisi"),
      document.getElementById("tpBlokLantai"),
      document.getElementById("tpLantai")
    );
  });

  document.getElementById("mpPt").addEventListener("change", function () {
    tanganiPilihPt_(
      this.value,
      document.getElementById("mpDivisi"),
      document.getElementById("mpBlokLantai"),
      document.getElementById("mpLantai")
    );
  });

  document.getElementById("formTambahPegawai").addEventListener("submit", submitFormTambahPegawai_);
  document.getElementById("tombolBatalPindah").addEventListener("click", tutupModalPindah_);
  document.getElementById("tombolSimpanPindah").addEventListener("click", simpanPindahPegawai_);
})();
