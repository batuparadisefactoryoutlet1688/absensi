/*******************************************************************
 * PROJECT      : Sistem Absensi
 * MODULE       : Absensi Page Logic
 * FILE         : js/absensi.js
 * VERSION      : v1.0.0
 * AUTHOR       : Tim Pengembang
 * CREATED      : 2026-08-30
 * LAST UPDATE  : 2026-08-30
 *
 * DESCRIPTION
 * -----------------------------------------------------------------
 * Logic khusus absensi.html: filter Tanggal/PT/Divisi/Lantai,
 * grid card pegawai untuk Check In / Check Kembali / Update, dan
 * 3 modal (pilih shift, konfirmasi kembali, update/koreksi).
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
let daftarShiftCache_ = [];
let petaPegawai_ = {};
let daftarAbsensiHariIni_ = [];

let idKaryawanTerpilihCheckIn_ = [];
let dataUntukCheckKembali_ = null;
let dataUntukUpdate_ = null;

/*******************************************************************
 * UTILITAS TANGGAL
 * -----------------------------------------------------------------
 ******************************************************************/

/******************************************************************
 * Function : formatTanggalUntukApi_(nilaiInputDate)
 * Tujuan   : Mengubah value <input type="date"> ("yyyy-mm-dd")
 *            menjadi format dd/MM/yyyy yang dipakai backend.
 ******************************************************************/
function formatTanggalUntukApi_(nilaiInputDate) {
  const bagian = nilaiInputDate.split("-");
  return bagian[2] + "/" + bagian[1] + "/" + bagian[0];
}

/******************************************************************
 * Function : tanggalHariIniUntukInput_()
 * Tujuan   : Mengambil tanggal hari ini dalam format yyyy-mm-dd
 *            (untuk value default <input type="date">).
 ******************************************************************/
function tanggalHariIniUntukInput_() {
  const sekarang = new Date();
  const tahun = sekarang.getFullYear();
  const bulan = String(sekarang.getMonth() + 1).padStart(2, "0");
  const tanggal = String(sekarang.getDate()).padStart(2, "0");
  return tahun + "-" + bulan + "-" + tanggal;
}

/*******************************************************************
 * TAB SWITCHING (dipakai tab utama & sub-tab modal update)
 * -----------------------------------------------------------------
 ******************************************************************/

/******************************************************************
 * Function : pasangTabBar_(selectorTab, atributData, selectorKonten)
 * Tujuan   : Fungsi umum untuk memasang tab switching.
 ******************************************************************/
function pasangTabBar_(kontainer, atributData) {
  const semuaTab = kontainer.querySelectorAll(".tabItem");
  semuaTab.forEach(function (tab) {
    tab.addEventListener("click", function () {
      semuaTab.forEach(function (t) { t.classList.remove("aktif"); });
      kontainer.querySelectorAll(".tabKonten").forEach(function (k) { k.classList.remove("aktif"); });

      tab.classList.add("aktif");
      document.getElementById(tab.getAttribute(atributData)).classList.add("aktif");
    });
  });
}

/*******************************************************************
 * FILTER: PT -> DIVISI -> LANTAI
 * -----------------------------------------------------------------
 ******************************************************************/

/******************************************************************
 * Function : muatDropdownPt_()
 ******************************************************************/
async function muatDropdownPt_() {
  const hasil = await panggilApi_("daftarPT", {});
  const select = document.getElementById("fPt");
  select.innerHTML = '<option value="">Pilih PT</option>';
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
 * Function : tanganiPilihPtFilter_()
 * Tujuan   : Memuat Divisi & Lantai sesuai PT yang dipilih di filter.
 ******************************************************************/
async function tanganiPilihPtFilter_() {
  const idPt = document.getElementById("fPt").value;
  const selectDivisi = document.getElementById("fDivisi");
  const blokLantai = document.getElementById("fBlokLantai");
  const selectLantai = document.getElementById("fLantai");

  selectDivisi.innerHTML = '<option value="">Semua Divisi</option>';
  blokLantai.classList.add("hidden");

  if (!idPt) {
    selectDivisi.disabled = true;
    selectDivisi.innerHTML = '<option value="">Pilih PT dulu</option>';
    return;
  }

  selectDivisi.disabled = false;

  const [hasilDivisi, hasilLantai] = await Promise.all([
    panggilApi_("daftarDivisi", { idPt: idPt }),
    panggilApi_("daftarLantai", { idPt: idPt })
  ]);

  if (hasilDivisi.success) {
    hasilDivisi.data.forEach(function (divisi) {
      const opsi = document.createElement("option");
      opsi.value = divisi.ID_DIVISI;
      opsi.textContent = divisi.NAMA_DIVISI;
      selectDivisi.appendChild(opsi);
    });
  }

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

  muatDaftarAbsensi_();
}

/*******************************************************************
 * MUAT DATA ABSENSI HARI INI
 * -----------------------------------------------------------------
 ******************************************************************/

/******************************************************************
 * Function : ambilFilterAktif_()
 * Tujuan   : Mengambil nilai filter yang sedang dipilih.
 ******************************************************************/
function ambilFilterAktif_() {
  return {
    tanggal: formatTanggalUntukApi_(document.getElementById("fTanggal").value),
    idPt: document.getElementById("fPt").value,
    idDivisi: document.getElementById("fDivisi").value,
    idLantai: document.getElementById("fLantai").value
  };
}

/******************************************************************
 * Function : muatDaftarAbsensi_()
 * Tujuan   : Mengambil data pegawai (untuk tahu PT/Divisi/Lantai asli
 *            tiap orang) + status absensi hari ini, lalu render 3 grid.
 ******************************************************************/
async function muatDaftarAbsensi_() {
  const filter = ambilFilterAktif_();

  if (!filter.tanggal || filter.tanggal === "//") {
    return;
  }

  ["gridCheckIn", "gridCheckKembali", "gridUpdate"].forEach(function (idGrid) {
    document.getElementById(idGrid).innerHTML = '<p class="teksMuted">Memuat data...</p>';
  });

  const [hasilPegawai, hasilAbsensi] = await Promise.all([
    panggilApi_("daftarPegawai", { idPt: filter.idPt, idDivisi: filter.idDivisi, idLantai: filter.idLantai }),
    panggilApi_("daftarAbsensiHariIni", filter)
  ]);

  if (!hasilPegawai.success || !hasilAbsensi.success) {
    ["gridCheckIn", "gridCheckKembali", "gridUpdate"].forEach(function (idGrid) {
      document.getElementById(idGrid).innerHTML = '<p class="teksMuted">Gagal memuat data.</p>';
    });
    return;
  }

  petaPegawai_ = {};
  hasilPegawai.data.forEach(function (pegawai) {
    petaPegawai_[pegawai.ID_KARYAWAN] = pegawai;
  });

  daftarAbsensiHariIni_ = hasilAbsensi.data;
  idKaryawanTerpilihCheckIn_ = [];
  renderGridAbsensi_();
  perbaruiLabelJumlahTerpilihCheckIn_();
}

/******************************************************************
 * Function : renderGridAbsensi_()
 * Tujuan   : Merender 3 grid (Check In, Check Kembali, Update)
 *            berdasarkan status absensi hari ini per pegawai.
 ******************************************************************/
function renderGridAbsensi_() {
  const gridCheckIn = document.getElementById("gridCheckIn");
  const gridCheckKembali = document.getElementById("gridCheckKembali");
  const gridUpdate = document.getElementById("gridUpdate");

  gridCheckIn.innerHTML = "";
  gridCheckKembali.innerHTML = "";
  gridUpdate.innerHTML = "";

  let adaCheckIn = false;
  let adaCheckKembali = false;
  let adaUpdate = false;

  daftarAbsensiHariIni_.forEach(function (item) {
    if (!item.sudahCheckIn) {
      adaCheckIn = true;
      const kartu = buatKartuPegawai_(item.nickname, "Belum Check In", "");
      if (idKaryawanTerpilihCheckIn_.indexOf(item.idKaryawan) !== -1) {
        kartu.classList.add("terpilih");
      }
      kartu.addEventListener("click", function () {
        toggleKaryawanTerpilihCheckIn_(item.idKaryawan, kartu);
      });
      gridCheckIn.appendChild(kartu);
      return;
    }

    if (!item.sudahCheckKembali) {
      adaCheckKembali = true;
      const kartuKembali = buatKartuPegawaiShift_(item.nickname, cariKodeShift_(item.idShift), "✓ " + item.jamMasuk, "sudahCheckIn");
      kartuKembali.addEventListener("click", function () {
        bukaModalKembali_(item.idAbsensi, item.nickname, item.jamMasuk);
      });
      gridCheckKembali.appendChild(kartuKembali);
    }

    adaUpdate = true;
    const infoUpdate = "✓ " + item.jamMasuk + (item.sudahCheckKembali ? " / ↩ " + item.jamKembali : "");
    const kartuUpdate = buatKartuPegawaiShift_(item.nickname, cariKodeShift_(item.idShift), infoUpdate, item.sudahCheckKembali ? "sudahKembali" : "sudahCheckIn");
    kartuUpdate.addEventListener("click", function () {
      bukaModalUpdate_(item.idAbsensi, item.nickname);
    });
    gridUpdate.appendChild(kartuUpdate);
  });

  if (!adaCheckIn) gridCheckIn.innerHTML = '<p class="teksMuted">Semua pegawai sudah Check In.</p>';
  if (!adaCheckKembali) gridCheckKembali.innerHTML = '<p class="teksMuted">Tidak ada yang menunggu Check Kembali.</p>';
  if (!adaUpdate) gridUpdate.innerHTML = '<p class="teksMuted">Belum ada data absensi hari ini.</p>';
}

/******************************************************************
 * Function : cariKodeShift_(idShift)
 * Tujuan   : Mencari KODE_SHIFT (mis. "P") dari ID_SHIFT (mis. "SH001").
 ******************************************************************/
function cariKodeShift_(idShift) {
  const shift = daftarShiftCache_.filter(function (s) { return s.ID_SHIFT === idShift; })[0];
  return shift ? shift.KODE_SHIFT : "";
}

/******************************************************************
 * Function : buatKartuPegawaiShift_(nama, kodeShift, info, kelasEkstra)
 * Tujuan   : Sama seperti buatKartuPegawai_ tapi dengan baris shift
 *            di tengah (dipakai untuk pegawai yang sudah Check In,
 *            sesuai format Blueprint: nama / shift / ✓ jam).
 ******************************************************************/
function buatKartuPegawaiShift_(nama, kodeShift, info, kelasEkstra) {
  const kartu = document.createElement("div");
  kartu.className = "kartuPegawai" + (kelasEkstra ? " " + kelasEkstra : "");
  kartu.innerHTML =
    '<div class="namaPegawai">' + nama + '</div>' +
    '<div class="shiftPegawai">' + (kodeShift || "-") + '</div>' +
    '<div class="infoPegawai">' + info + '</div>';
  return kartu;
}

/******************************************************************
 * Function : buatKartuPegawai_(nama, info, kelasEkstra)
 * Tujuan   : Membuat elemen card pegawai untuk grid.
 ******************************************************************/
function buatKartuPegawai_(nama, info, kelasEkstra) {
  const kartu = document.createElement("div");
  kartu.className = "kartuPegawai" + (kelasEkstra ? " " + kelasEkstra : "");
  kartu.innerHTML =
    '<div class="namaPegawai">' + nama + '</div>' +
    '<div class="infoPegawai">' + info + '</div>';
  return kartu;
}

/*******************************************************************
 * PILIH SHIFT MASSAL (CHECK IN MULTI-SELECT)
 * -----------------------------------------------------------------
 * Alur baru: klik nama-nama pegawai dulu (toggle terpilih/tidak,
 * bisa lebih dari satu), lalu klik satu tombol shift di panel bawah
 * grid -> semua pegawai yang terpilih di-Check In sekaligus dengan
 * shift yang sama.
 ******************************************************************/

/******************************************************************
 * Function : toggleKaryawanTerpilihCheckIn_(idKaryawan, kartuEl)
 * Tujuan   : Menandai/membatalkan tanda pegawai terpilih untuk
 *            Check In massal saat kartunya diklik.
 ******************************************************************/
function toggleKaryawanTerpilihCheckIn_(idKaryawan, kartuEl) {
  const index = idKaryawanTerpilihCheckIn_.indexOf(idKaryawan);
  if (index === -1) {
    idKaryawanTerpilihCheckIn_.push(idKaryawan);
    kartuEl.classList.add("terpilih");
  } else {
    idKaryawanTerpilihCheckIn_.splice(index, 1);
    kartuEl.classList.remove("terpilih");
  }
  perbaruiLabelJumlahTerpilihCheckIn_();
}

/******************************************************************
 * Function : perbaruiLabelJumlahTerpilihCheckIn_()
 * Tujuan   : Memperbarui teks jumlah pegawai yang sedang terpilih
 *            di atas panel pilihan shift.
 ******************************************************************/
function perbaruiLabelJumlahTerpilihCheckIn_() {
  const label = document.getElementById("labelJumlahTerpilihCheckIn");
  const jumlah = idKaryawanTerpilihCheckIn_.length;
  label.textContent = jumlah === 0 ? "Belum ada pegawai dipilih" : jumlah + " pegawai dipilih";
  document.getElementById("pesanCheckInMassal").className = "pesan";
}

/******************************************************************
 * Function : isiGridPilihanShiftCheckIn_()
 * Tujuan   : Mengisi tombol-tombol shift di panel Check In massal.
 *            Dipanggil sekali saat halaman dimuat (daftar shift
 *            tidak berubah-ubah dalam satu sesi).
 ******************************************************************/
function isiGridPilihanShiftCheckIn_() {
  const grid = document.getElementById("gridPilihanShiftCheckIn");
  grid.innerHTML = "";
  daftarShiftCache_.forEach(function (shift) {
    const tombol = document.createElement("button");
    tombol.type = "button";
    tombol.className = "tombolShift";
    tombol.textContent = shift.KODE_SHIFT;
    tombol.addEventListener("click", function () { jalankanCheckInMassal_(shift.ID_SHIFT); });
    grid.appendChild(tombol);
  });
}

/******************************************************************
 * Function : jalankanCheckInMassal_(idShift)
 * Tujuan   : Mengirim Check In untuk SELURUH pegawai yang terpilih,
 *            satu per satu (berurutan, bukan paralel, supaya ID
 *            absensi yang di-generate di backend tidak bentrok),
 *            memakai PT/Divisi/Lantai asli milik masing-masing
 *            pegawai (bukan filter).
 ******************************************************************/
async function jalankanCheckInMassal_(idShift) {
  const kotak = document.getElementById("pesanCheckInMassal");

  if (idKaryawanTerpilihCheckIn_.length === 0) {
    kotak.textContent = "Pilih minimal satu pegawai dulu.";
    kotak.className = "pesan error";
    return;
  }

  const tanggal = formatTanggalUntukApi_(document.getElementById("fTanggal").value);
  const jamManual = document.getElementById("fJamManualMasuk").value;
  const daftarTerpilih = idKaryawanTerpilihCheckIn_.slice();

  kotak.textContent = "Memproses Check In untuk " + daftarTerpilih.length + " pegawai...";
  kotak.className = "pesan info";

  let jumlahBerhasil = 0;
  const pesanGagal = [];

  for (const idKaryawan of daftarTerpilih) {
    const pegawai = petaPegawai_[idKaryawan];
    try {
      const hasil = await panggilApi_("checkIn", {
        tanggal: tanggal,
        idKaryawan: idKaryawan,
        idPt: pegawai.PT,
        idDivisi: pegawai.DIVISI,
        idLantai: pegawai.LANTAI === "-" ? "" : pegawai.LANTAI,
        idShift: idShift,
        jamManual: jamManual,
        username: sesiAktif_.username,
        penandaAdmin: sesiAktif_.penandaAdmin
      });

      if (hasil.success) {
        jumlahBerhasil++;
      } else {
        pesanGagal.push((pegawai ? pegawai.NICKNAME : idKaryawan) + ": " + hasil.message);
      }
    } catch (error) {
      pesanGagal.push((pegawai ? pegawai.NICKNAME : idKaryawan) + ": " + error.message);
    }
  }

  if (pesanGagal.length === 0) {
    kotak.textContent = jumlahBerhasil + " pegawai berhasil Check In (Shift sama).";
    kotak.className = "pesan sukses";
  } else {
    kotak.textContent = jumlahBerhasil + " berhasil, " + pesanGagal.length + " gagal — " + pesanGagal.join("; ");
    kotak.className = "pesan error";
  }

  muatDaftarAbsensi_();
}

/*******************************************************************
 * MODAL: CHECK KEMBALI
 * -----------------------------------------------------------------
 ******************************************************************/

/******************************************************************
 * Function : bukaModalKembali_(idAbsensi, nickname, jamMasuk)
 ******************************************************************/
function bukaModalKembali_(idAbsensi, nickname, jamMasuk) {
  dataUntukCheckKembali_ = idAbsensi;
  document.getElementById("judulModalKembali").textContent = "Check Kembali - " + nickname;
  document.getElementById("infoModalKembali").textContent = "Jam Masuk: " + jamMasuk;
  document.getElementById("pesanModalKembali").className = "pesan";
  document.getElementById("modalKembali").classList.add("tampil");
}

/******************************************************************
 * Function : jalankanCheckKembali_()
 ******************************************************************/
async function jalankanCheckKembali_() {
  const jamManual = document.getElementById("fJamManualKembali").value;

  try {
    const hasil = await panggilApi_("checkKembali", {
      idAbsensi: dataUntukCheckKembali_,
      jamManual: jamManual,
      username: sesiAktif_.username,
      penandaAdmin: sesiAktif_.penandaAdmin
    });

    if (!hasil.success) {
      const kotak = document.getElementById("pesanModalKembali");
      kotak.textContent = hasil.message;
      kotak.className = "pesan error";
      return;
    }

    document.getElementById("modalKembali").classList.remove("tampil");
    muatDaftarAbsensi_();
  } catch (error) {
    const kotak = document.getElementById("pesanModalKembali");
    kotak.textContent = "[CHECK KEMBALI] " + error.message;
    kotak.className = "pesan error";
  }
}

/*******************************************************************
 * MODAL: UPDATE / KOREKSI
 * -----------------------------------------------------------------
 ******************************************************************/

/******************************************************************
 * Function : bukaModalUpdate_(idAbsensi, nickname)
 ******************************************************************/
function bukaModalUpdate_(idAbsensi, nickname) {
  dataUntukUpdate_ = idAbsensi;
  document.getElementById("judulModalUpdate").textContent = "Update - " + nickname;
  document.getElementById("pesanModalUpdate").className = "pesan";
  document.getElementById("muKeterangan").value = "";
  document.getElementById("mjJamBaru").value = "";

  const gridShift = document.getElementById("gridKoreksiShift");
  gridShift.innerHTML = "";
  daftarShiftCache_.forEach(function (shift) {
    const tombol = document.createElement("button");
    tombol.type = "button";
    tombol.className = "tombolShift";
    tombol.textContent = shift.KODE_SHIFT;
    tombol.addEventListener("click", function () { jalankanKoreksiShift_(shift.ID_SHIFT); });
    gridShift.appendChild(tombol);
  });

  document.getElementById("modalUpdate").classList.add("tampil");
}

/******************************************************************
 * Function : jalankanSimpanKejadian_()
 ******************************************************************/
async function jalankanSimpanKejadian_() {
  const statusUpdate = document.getElementById("muStatus").value;
  const keterangan = document.getElementById("muKeterangan").value.trim();
  const kotak = document.getElementById("pesanModalUpdate");

  try {
    const hasil = await panggilApi_("updateStatus", {
      idAbsensi: dataUntukUpdate_,
      statusUpdate: statusUpdate,
      keterangan: keterangan,
      username: sesiAktif_.username,
      penandaAdmin: sesiAktif_.penandaAdmin
    });

    kotak.textContent = hasil.message;
    kotak.className = "pesan " + (hasil.success ? "sukses" : "error");

    if (hasil.success) muatDaftarAbsensi_();
  } catch (error) {
    kotak.textContent = "[UPDATE] " + error.message;
    kotak.className = "pesan error";
  }
}

/******************************************************************
 * Function : jalankanKoreksiJam_()
 ******************************************************************/
async function jalankanKoreksiJam_() {
  const kolomJam = document.getElementById("mjKolom").value;
  const jamBaru = document.getElementById("mjJamBaru").value;
  const kotak = document.getElementById("pesanModalUpdate");

  if (!jamBaru) {
    kotak.textContent = "Jam baru wajib diisi.";
    kotak.className = "pesan error";
    return;
  }

  try {
    const hasil = await panggilApi_("koreksiJam", {
      idAbsensi: dataUntukUpdate_,
      kolomJam: kolomJam,
      jamBaru: jamBaru,
      username: sesiAktif_.username,
      penandaAdmin: sesiAktif_.penandaAdmin
    });

    kotak.textContent = hasil.message;
    kotak.className = "pesan " + (hasil.success ? "sukses" : "error");

    if (hasil.success) muatDaftarAbsensi_();
  } catch (error) {
    kotak.textContent = "[KOREKSI JAM] " + error.message;
    kotak.className = "pesan error";
  }
}

/******************************************************************
 * Function : jalankanKoreksiShift_(idShiftBaru)
 ******************************************************************/
async function jalankanKoreksiShift_(idShiftBaru) {
  const kotak = document.getElementById("pesanModalUpdate");

  try {
    const hasil = await panggilApi_("koreksiShift", {
      idAbsensi: dataUntukUpdate_,
      idShiftBaru: idShiftBaru,
      username: sesiAktif_.username,
      penandaAdmin: sesiAktif_.penandaAdmin
    });

    kotak.textContent = hasil.message;
    kotak.className = "pesan " + (hasil.success ? "sukses" : "error");

    if (hasil.success) muatDaftarAbsensi_();
  } catch (error) {
    kotak.textContent = "[KOREKSI SHIFT] " + error.message;
    kotak.className = "pesan error";
  }
}

/*******************************************************************
 * INISIALISASI HALAMAN
 * -----------------------------------------------------------------
 ******************************************************************/
(async function inisialisasiHalamanAbsensi_() {
  const sesi = wajibLogin();
  if (!sesi) return;

  sesiAktif_ = sesi;
  tampilkanInfoUser(sesi);

  document.getElementById("fTanggal").value = tanggalHariIniUntukInput_();

  pasangTabBar_(document.querySelector(".kontenHalaman"), "data-tab");
  pasangTabBar_(document.getElementById("modalUpdate"), "data-subtab");

  const hasilShift = await panggilApi_("daftarShift", {});
  if (hasilShift.success) daftarShiftCache_ = hasilShift.data;
  isiGridPilihanShiftCheckIn_();

  await muatDropdownPt_();

  document.getElementById("fTanggal").addEventListener("change", muatDaftarAbsensi_);
  document.getElementById("fPt").addEventListener("change", tanganiPilihPtFilter_);
  document.getElementById("fDivisi").addEventListener("change", muatDaftarAbsensi_);
  document.getElementById("fLantai").addEventListener("change", muatDaftarAbsensi_);

  document.getElementById("tombolBatalPilihanCheckIn").addEventListener("click", function () {
    idKaryawanTerpilihCheckIn_ = [];
    renderGridAbsensi_();
    perbaruiLabelJumlahTerpilihCheckIn_();
  });

  document.getElementById("tombolBatalKembali").addEventListener("click", function () {
    document.getElementById("modalKembali").classList.remove("tampil");
  });
  document.getElementById("tombolKonfirmasiKembali").addEventListener("click", jalankanCheckKembali_);

  document.getElementById("tombolTutupModalUpdate").addEventListener("click", function () {
    document.getElementById("modalUpdate").classList.remove("tampil");
  });
  document.getElementById("tombolSimpanKejadian").addEventListener("click", jalankanSimpanKejadian_);
  document.getElementById("tombolSimpanKoreksiJam").addEventListener("click", jalankanKoreksiJam_);
})();
