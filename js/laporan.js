/*******************************************************************
 * PROJECT      : Sistem Absensi
 * MODULE       : Laporan Page Logic
 * FILE         : js/laporan.js
 * VERSION      : v1.0.0
 * AUTHOR       : Tim Pengembang
 * CREATED      : 2026-08-30
 * LAST UPDATE  : 2026-08-30
 *
 * DESCRIPTION
 * -----------------------------------------------------------------
 * Logic khusus laporan.html: menampilkan/menyembunyikan blok filter
 * sesuai jenis laporan yang dipilih, memanggil API yang sesuai, dan
 * merender hasilnya sebagai tabel.
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
 * CONSTANTS
 ******************************************************************/
const NAMA_BULAN_ = [
  "Januari", "Februari", "Maret", "April", "Mei", "Juni",
  "Juli", "Agustus", "September", "Oktober", "November", "Desember"
];

/*******************************************************************
 * STATE
 ******************************************************************/
let sesiAktif_ = null;
let daftarShiftCache_ = [];

/*******************************************************************
 * PENGISIAN DROPDOWN UMUM
 * -----------------------------------------------------------------
 ******************************************************************/

/******************************************************************
 * Function : isiDropdownBulanTahun_()
 * Tujuan   : Mengisi seluruh dropdown Bulan & default Tahun ke bulan/tahun berjalan.
 ******************************************************************/
function isiDropdownBulanTahun_() {
  const sekarang = new Date();
  const idDropdownBulan = ["iBulan", "sBulan", "bBulan", "oBulan"];
  const idInputTahun = ["iTahun", "sTahun", "bTahun", "oTahun"];

  idDropdownBulan.forEach(function (id) {
    const select = document.getElementById(id);
    NAMA_BULAN_.forEach(function (nama, index) {
      const opsi = document.createElement("option");
      opsi.value = index + 1;
      opsi.textContent = nama;
      if (index + 1 === sekarang.getMonth() + 1) opsi.selected = true;
      select.appendChild(opsi);
    });
  });

  idInputTahun.forEach(function (id) {
    document.getElementById(id).value = sekarang.getFullYear();
  });
}

/******************************************************************
 * Function : isiDropdownPt_(idSelect)
 ******************************************************************/
async function isiDropdownPt_(idSelect) {
  const hasil = await panggilApi_("daftarPT", {});
  const select = document.getElementById(idSelect);
  if (hasil.success) {
    hasil.data.forEach(function (pt) {
      const opsi = document.createElement("option");
      opsi.value = pt.ID_PT;
      opsi.textContent = pt.NAMA_PT;
      select.appendChild(opsi);
    });
  }
}

/******************************************************************
 * Function : pasangCascadingDivisi_(idPt, idDivisi, idLantai, idBlokLantai)
 * Tujuan   : Memuat Divisi (dan Lantai jika ada elemen-nya) saat PT dipilih.
 ******************************************************************/
function pasangCascadingDivisi_(idPt, idDivisi, idLantai, idBlokLantai) {
  document.getElementById(idPt).addEventListener("change", async function () {
    const selectDivisi = document.getElementById(idDivisi);
    selectDivisi.innerHTML = '<option value="">Semua Divisi</option>';

    if (!this.value) {
      selectDivisi.disabled = true;
      return;
    }

    selectDivisi.disabled = false;
    const hasilDivisi = await panggilApi_("daftarDivisi", { idPt: this.value });
    if (hasilDivisi.success) {
      hasilDivisi.data.forEach(function (divisi) {
        const opsi = document.createElement("option");
        opsi.value = divisi.ID_DIVISI;
        opsi.textContent = divisi.NAMA_DIVISI;
        selectDivisi.appendChild(opsi);
      });
    }

    if (idLantai && idBlokLantai) {
      const selectLantai = document.getElementById(idLantai);
      const blokLantai = document.getElementById(idBlokLantai);
      const hasilLantai = await panggilApi_("daftarLantai", { idPt: this.value });

      blokLantai.classList.add("hidden");
      if (hasilLantai.success && hasilLantai.data.length > 0) {
        selectLantai.innerHTML = '<option value="">Semua Lantai</option>';
        hasilLantai.data.forEach(function (lantai) {
          const opsi = document.createElement("option");
          opsi.value = lantai.ID_LANTAI;
          opsi.textContent = lantai.NAMA_LANTAI;
          selectLantai.appendChild(opsi);
        });
        blokLantai.classList.remove("hidden");
      }
    }
  });
}

/******************************************************************
 * Function : isiDropdownPegawai_()
 ******************************************************************/
async function isiDropdownPegawai_() {
  const hasil = await panggilApi_("daftarPegawai", {});
  const select = document.getElementById("iKaryawan");
  if (hasil.success) {
    hasil.data.forEach(function (pegawai) {
      const opsi = document.createElement("option");
      opsi.value = pegawai.ID_KARYAWAN;
      opsi.textContent = pegawai.NAMA_ASLI + " (" + pegawai.NICKNAME + ")";
      select.appendChild(opsi);
    });
  }
}

/******************************************************************
 * Function : isiDropdownStatus_()
 ******************************************************************/
async function isiDropdownStatus_() {
  const hasil = await panggilApi_("daftarStatus", {});
  const select = document.getElementById("sStatus");
  if (hasil.success) {
    hasil.data.forEach(function (status) {
      const opsi = document.createElement("option");
      opsi.value = status.KODE;
      opsi.textContent = status.NAMA_STATUS;
      select.appendChild(opsi);
    });
  }
}

/*******************************************************************
 * SWITCH JENIS LAPORAN
 * -----------------------------------------------------------------
 ******************************************************************/

/******************************************************************
 * Function : tanganiGantiJenisLaporan_()
 ******************************************************************/
function tanganiGantiJenisLaporan_() {
  const jenis = document.getElementById("jenisLaporan").value;
  const petaBlok = {
    harian: "filterHarian",
    individu: "filterIndividu",
    status: "filterStatus",
    bulanan: "filterBulanan",
    off: "filterOff"
  };

  Object.values(petaBlok).forEach(function (idBlok) {
    document.getElementById(idBlok).classList.add("hidden");
  });
  document.getElementById(petaBlok[jenis]).classList.remove("hidden");
}

/*******************************************************************
 * TAMPILKAN LAPORAN
 * -----------------------------------------------------------------
 ******************************************************************/

/******************************************************************
 * Function : tampilkanPesanLaporan_(teks, jenis)
 ******************************************************************/
function tampilkanPesanLaporan_(teks, jenis) {
  const kotak = document.getElementById("pesanLaporan");
  kotak.textContent = teks;
  kotak.className = "pesan " + jenis;
}

/******************************************************************
 * Function : renderTabel_(headerArray, barisArray)
 * Tujuan   : Merender header + baris ke #tabelLaporan.
 ******************************************************************/
function renderTabel_(headerArray, barisArray) {
  const tabel = document.getElementById("tabelLaporan");
  let html = "<thead><tr>";
  headerArray.forEach(function (h) { html += "<th>" + h + "</th>"; });
  html += "</tr></thead><tbody>";

  if (barisArray.length === 0) {
    html += '<tr><td colspan="' + headerArray.length + '" class="teksMuted">Tidak ada data.</td></tr>';
  } else {
    barisArray.forEach(function (baris) {
      html += "<tr>";
      baris.forEach(function (sel) { html += "<td>" + sel + "</td>"; });
      html += "</tr>";
    });
  }

  html += "</tbody>";
  tabel.innerHTML = html;
}

/******************************************************************
 * Function : cariKodeShift_(idShift)
 ******************************************************************/
function cariKodeShift_(idShift) {
  const found = daftarShiftCache_.filter(function (s) { return s.ID_SHIFT === idShift; });
  return found.length > 0 ? found[0].KODE_SHIFT : "-";
}

/******************************************************************
 * Function : jalankanLaporanHarian_()
 ******************************************************************/
async function jalankanLaporanHarian_() {
  const payload = {
    tanggal: (function () {
      const v = document.getElementById("hTanggal").value;
      if (!v) return "";
      const b = v.split("-");
      return b[2] + "/" + b[1] + "/" + b[0];
    })(),
    idPt: document.getElementById("hPt").value,
    idDivisi: document.getElementById("hDivisi").value,
    idLantai: document.getElementById("hLantai").value
  };

  const hasil = await panggilApi_("laporanHarian", payload);
  if (!hasil.success) { tampilkanPesanLaporan_(hasil.message, "error"); return; }

  const baris = hasil.data.map(function (item) {
    return [
      item.namaAsli, cariKodeShift_(item.idShift), item.jamMasuk || "-", item.jamKembali || "-",
      item.statusAwal || "-", item.statusAkhir || "-", item.keterangan || "-"
    ];
  });

  renderTabel_(["Nama", "Shift", "Jam Masuk", "Jam Kembali", "Status Awal", "Status Akhir", "Keterangan"], baris);
}

/******************************************************************
 * Function : jalankanLaporanIndividu_()
 ******************************************************************/
async function jalankanLaporanIndividu_() {
  const payload = {
    idKaryawan: document.getElementById("iKaryawan").value,
    bulan: document.getElementById("iBulan").value,
    tahun: document.getElementById("iTahun").value
  };

  if (!payload.idKaryawan) { tampilkanPesanLaporan_("Pilih pegawai terlebih dahulu.", "error"); return; }

  const hasil = await panggilApi_("laporanIndividu", payload);
  if (!hasil.success) { tampilkanPesanLaporan_(hasil.message, "error"); return; }

  const baris = hasil.data.detail.map(function (item) {
    return [item.tanggal, cariKodeShift_(item.idShift), item.jamMasuk || "-", item.jamKembali || "-", item.statusAwal || "-", item.statusAkhir || "-"];
  });

  renderTabel_(["Tanggal", "Shift", "Jam Masuk", "Jam Kembali", "Status Awal", "Status Akhir"], baris);
}

/******************************************************************
 * Function : jalankanLaporanStatus_()
 ******************************************************************/
async function jalankanLaporanStatus_() {
  const payload = {
    kodeStatus: document.getElementById("sStatus").value,
    bulan: document.getElementById("sBulan").value,
    tahun: document.getElementById("sTahun").value
  };

  const hasil = await panggilApi_("laporanStatus", payload);
  if (!hasil.success) { tampilkanPesanLaporan_(hasil.message, "error"); return; }

  const baris = hasil.data.map(function (item) {
    return [item.tanggal, item.namaAsli, item.status];
  });

  renderTabel_(["Tanggal", "Nama", "Status"], baris);
}

/******************************************************************
 * Function : jalankanLaporanBulanan_()
 ******************************************************************/
async function jalankanLaporanBulanan_() {
  const bulan = parseInt(document.getElementById("bBulan").value, 10);
  const tahun = parseInt(document.getElementById("bTahun").value, 10);
  const payload = {
    bulan: bulan,
    tahun: tahun,
    idPt: document.getElementById("bPt").value,
    idDivisi: document.getElementById("bDivisi").value
  };

  const hasil = await panggilApi_("laporanBulanan", payload);
  if (!hasil.success) { tampilkanPesanLaporan_(hasil.message, "error"); return; }

  const jumlahHari = new Date(tahun, bulan, 0).getDate();
  const header = ["Nama"];
  for (let i = 1; i <= jumlahHari; i++) header.push(String(i));
  header.push("SHIFT", "FT", "OFF", "INFO");

  const baris = hasil.data.map(function (item) {
    const sel = [item.namaAsli];
    for (let i = 1; i <= jumlahHari; i++) sel.push(item.days[i] || "");
    sel.push(item.shift, item.ft, item.off, item.info || "-");
    return sel;
  });

  renderTabel_(header, baris);
}

/******************************************************************
 * Function : jalankanLaporanOff_()
 ******************************************************************/
async function jalankanLaporanOff_() {
  const payload = {
    bulan: document.getElementById("oBulan").value,
    tahun: document.getElementById("oTahun").value,
    idPt: document.getElementById("oPt").value,
    idDivisi: document.getElementById("oDivisi").value
  };

  const hasil = await panggilApi_("laporanOff", payload);
  if (!hasil.success) { tampilkanPesanLaporan_(hasil.message, "error"); return; }

  const baris = hasil.data.map(function (item) {
    return [item.namaAsli, item.jatah, item.terpakai, item.sisaMinus];
  });

  renderTabel_(["Nama", "Jatah", "Terpakai", "Sisa / Minus"], baris);
}

/******************************************************************
 * Function : tanganiTampilkanLaporan_()
 ******************************************************************/
async function tanganiTampilkanLaporan_() {
  document.getElementById("pesanLaporan").className = "pesan";
  const jenis = document.getElementById("jenisLaporan").value;

  const tombol = document.getElementById("tombolTampilkan");
  tombol.disabled = true;
  tombol.textContent = "Memuat...";

  try {
    if (jenis === "harian") await jalankanLaporanHarian_();
    else if (jenis === "individu") await jalankanLaporanIndividu_();
    else if (jenis === "status") await jalankanLaporanStatus_();
    else if (jenis === "bulanan") await jalankanLaporanBulanan_();
    else if (jenis === "off") await jalankanLaporanOff_();
  } catch (error) {
    tampilkanPesanLaporan_("[LAPORAN] " + error.message, "error");
  }

  tombol.disabled = false;
  tombol.textContent = "Tampilkan Laporan";
}

/*******************************************************************
 * INISIALISASI HALAMAN
 * -----------------------------------------------------------------
 ******************************************************************/
(async function inisialisasiHalamanLaporan_() {
  const sesi = wajibLogin();
  if (!sesi) return;

  sesiAktif_ = sesi;
  tampilkanInfoUser(sesi);

  isiDropdownBulanTahun_();
  await isiDropdownPegawai_();
  await isiDropdownStatus_();

  const hasilShift = await panggilApi_("daftarShift", {});
  if (hasilShift.success) daftarShiftCache_ = hasilShift.data;

  await isiDropdownPt_("hPt");
  await isiDropdownPt_("bPt");
  await isiDropdownPt_("oPt");

  pasangCascadingDivisi_("hPt", "hDivisi", "hLantai", "hBlokLantai");
  pasangCascadingDivisi_("bPt", "bDivisi", null, null);
  pasangCascadingDivisi_("oPt", "oDivisi", null, null);

  document.getElementById("jenisLaporan").addEventListener("change", tanganiGantiJenisLaporan_);
  document.getElementById("tombolTampilkan").addEventListener("click", tanganiTampilkanLaporan_);
})();
