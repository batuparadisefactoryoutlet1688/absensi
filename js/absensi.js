/*******************************************************************
 * PROJECT      : Sistem Absensi
 * MODULE       : Absensi Page Logic
 * FILE         : js/absensi.js
 * VERSION      : v1.1.0
 * AUTHOR       : Tim Pengembang
 * CREATED      : 2026-08-30
 * LAST UPDATE  : 2026-08-31
 *
 * DESCRIPTION
 * -----------------------------------------------------------------
 * Logic khusus absensi.html: filter Tanggal/PT/Divisi/Lantai, dan
 * 4 tab: Absen Masuk (shift+status gabungan, multi-select), Absen
 * Istirahat (hanya yang sudah shift-in), Telat (checkIn + menit
 * telat), Update (roster penuh - update kejadian ATAU input status
 * langsung untuk yang belum absen).
 ******************************************************************/

/*******************************************************************
 * VERSION HISTORY
 * -----------------------------------------------------------------
 * v1.0.0
 * - Initial Release (Check In / Check Kembali / Update, shift saja).
 *
 * v1.1.0
 * - Rename: Check In -> Absen Masuk, Check Kembali -> Absen Istirahat.
 * - Menambahkan tab Telat (checkIn dengan keterangan menit telat).
 * - Panel aksi Absen Masuk sekarang gabungan tombol Shift + Status
 *   non-hadir dalam satu grid (data-kode untuk pewarnaan CSS).
 * - Tab Update sekarang roster penuh (semua pegawai), dengan
 *   percabangan: sudah ada absensi -> modal Update lama; belum ada
 *   -> modal Input Status Langsung baru.
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
let daftarStatusCache_ = [];
let petaPegawai_ = {};
let daftarAbsensiHariIni_ = [];
let petaAbsensiHariIni_ = {};

let terpilih_ = { masuk: [], telat: [] };
let dataUntukCheckKembali_ = null;
let dataUntukUpdate_ = null;
let idKaryawanUntukInputLangsung_ = null;

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
 ******************************************************************/
function tanggalHariIniUntukInput_() {
  const sekarang = new Date();
  const tahun = sekarang.getFullYear();
  const bulan = String(sekarang.getMonth() + 1).padStart(2, "0");
  const tanggal = String(sekarang.getDate()).padStart(2, "0");
  return tahun + "-" + bulan + "-" + tanggal;
}

/*******************************************************************
 * TAB SWITCHING
 * -----------------------------------------------------------------
 ******************************************************************/

/******************************************************************
 * Function : pasangTabBar_(kontainer, atributData)
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
 * Tujuan   : Mengambil data pegawai (roster + posisi asli tiap orang)
 *            + status absensi hari ini, lalu render 4 grid.
 ******************************************************************/
async function muatDaftarAbsensi_() {
  const filter = ambilFilterAktif_();

  if (!filter.tanggal || filter.tanggal === "//") {
    return;
  }

  ["gridAbsenMasuk", "gridAbsenIstirahat", "gridTelat", "gridUpdate"].forEach(function (idGrid) {
    document.getElementById(idGrid).innerHTML = '<p class="teksMuted">Memuat data...</p>';
  });

  const [hasilPegawai, hasilAbsensi] = await Promise.all([
    panggilApi_("daftarPegawai", { idPt: filter.idPt, idDivisi: filter.idDivisi, idLantai: filter.idLantai }),
    panggilApi_("daftarAbsensiHariIni", filter)
  ]);

  if (!hasilPegawai.success || !hasilAbsensi.success) {
    ["gridAbsenMasuk", "gridAbsenIstirahat", "gridTelat", "gridUpdate"].forEach(function (idGrid) {
      document.getElementById(idGrid).innerHTML = '<p class="teksMuted">Gagal memuat data.</p>';
    });
    return;
  }

  petaPegawai_ = {};
  hasilPegawai.data.forEach(function (pegawai) {
    petaPegawai_[pegawai.ID_KARYAWAN] = pegawai;
  });

  daftarAbsensiHariIni_ = hasilAbsensi.data;
  petaAbsensiHariIni_ = {};
  daftarAbsensiHariIni_.forEach(function (item) {
    if (item.sudahCheckIn) petaAbsensiHariIni_[item.idKaryawan] = item;
  });

  terpilih_ = { masuk: [], telat: [] };
  renderSemuaGrid_();
  perbaruiLabelTerpilih_("masuk");
  perbaruiLabelTerpilih_("telat");
}

/*******************************************************************
 * KARTU PEGAWAI (builder umum)
 * -----------------------------------------------------------------
 ******************************************************************/

/******************************************************************
 * Function : buatKartuPegawai_(nama, badge, info, kelasEkstra)
 * Tujuan   : Membuat elemen card pegawai. badge = kode shift/nama
 *            status (opsional), info = teks kecil di bawahnya.
 ******************************************************************/
function buatKartuPegawai_(nama, badge, info, kelasEkstra) {
  const kartu = document.createElement("div");
  kartu.className = "kartuPegawai" + (kelasEkstra ? " " + kelasEkstra : "");
  let html = '<div class="namaPegawai">' + nama + '</div>';
  if (badge) html += '<div class="shiftPegawai">' + badge + '</div>';
  html += '<div class="infoPegawai">' + (info || "") + '</div>';
  kartu.innerHTML = html;
  return kartu;
}

/******************************************************************
 * Function : cariKodeShift_(idShift)
 ******************************************************************/
function cariKodeShift_(idShift) {
  const shift = daftarShiftCache_.filter(function (s) { return s.ID_SHIFT === idShift; })[0];
  return shift ? shift.KODE_SHIFT : "";
}

/******************************************************************
 * Function : cariNamaStatusById_(idStatus)
 ******************************************************************/
function cariNamaStatusById_(idStatus) {
  const status = daftarStatusCache_.filter(function (s) { return s.ID_STATUS === idStatus; })[0];
  return status ? status.NAMA_STATUS : "-";
}

/*******************************************************************
 * RENDER SEMUA GRID
 * -----------------------------------------------------------------
 ******************************************************************/

/******************************************************************
 * Function : renderSemuaGrid_()
 ******************************************************************/
function renderSemuaGrid_() {
  renderGridPilihMasuk_("gridAbsenMasuk", "masuk");
  renderGridPilihMasuk_("gridTelat", "telat");
  renderGridAbsenIstirahat_();
  renderGridUpdate_();
}

/******************************************************************
 * Function : renderGridPilihMasuk_(idGrid, kunciTerpilih)
 * Tujuan   : Dipakai untuk grid Absen Masuk & Telat - keduanya
 *            menampilkan pegawai yang BELUM absen, tapi punya
 *            state pilihan terpisah (kunciTerpilih: "masuk"/"telat").
 ******************************************************************/
function renderGridPilihMasuk_(idGrid, kunciTerpilih) {
  const grid = document.getElementById(idGrid);
  grid.innerHTML = "";
  let ada = false;

  daftarAbsensiHariIni_.forEach(function (item) {
    if (item.sudahCheckIn) return;
    ada = true;

    const kartu = buatKartuPegawai_(item.nickname, "", "Belum Absen", "");
    if (terpilih_[kunciTerpilih].indexOf(item.idKaryawan) !== -1) {
      kartu.classList.add("terpilih");
    }
    kartu.addEventListener("click", function () {
      toggleTerpilih_(kunciTerpilih, item.idKaryawan, kartu);
    });
    grid.appendChild(kartu);
  });

  if (!ada) grid.innerHTML = '<p class="teksMuted">Semua pegawai sudah absen.</p>';
}

/******************************************************************
 * Function : renderGridAbsenIstirahat_()
 * Tujuan   : Hanya menampilkan pegawai yang sudah Absen Masuk lewat
 *            shift (punya JAM_MASUK) dan belum Absen Istirahat.
 ******************************************************************/
function renderGridAbsenIstirahat_() {
  const grid = document.getElementById("gridAbsenIstirahat");
  grid.innerHTML = "";
  let ada = false;

  daftarAbsensiHariIni_.forEach(function (item) {
    if (!item.jamMasuk || item.sudahCheckKembali) return;
    ada = true;

    const kartu = buatKartuPegawai_(item.nickname, cariKodeShift_(item.idShift), "✓ " + item.jamMasuk, "sudahCheckIn");
    kartu.addEventListener("click", function () {
      bukaModalKembali_(item.idAbsensi, item.nickname, item.jamMasuk);
    });
    grid.appendChild(kartu);
  });

  if (!ada) grid.innerHTML = '<p class="teksMuted">Tidak ada yang menunggu Absen Istirahat.</p>';
}

/******************************************************************
 * Function : renderGridUpdate_()
 * Tujuan   : Menampilkan SEMUA pegawai (roster penuh). Yang sudah
 *            ada absensi -> klik buka modal Update; yang belum ->
 *            klik buka modal Input Status Langsung.
 ******************************************************************/
function renderGridUpdate_() {
  const grid = document.getElementById("gridUpdate");
  grid.innerHTML = "";

  const semuaPegawai = Object.values(petaPegawai_);
  if (semuaPegawai.length === 0) {
    grid.innerHTML = '<p class="teksMuted">Tidak ada pegawai pada filter ini.</p>';
    return;
  }

  semuaPegawai.forEach(function (pegawai) {
    const absensi = petaAbsensiHariIni_[pegawai.ID_KARYAWAN];

    if (absensi) {
      let badge, info, kelas;
      if (absensi.idShift) {
        badge = cariKodeShift_(absensi.idShift);
        info = "✓ " + absensi.jamMasuk + (absensi.sudahCheckKembali ? " / ↩ " + absensi.jamKembali : "");
        kelas = absensi.sudahCheckKembali ? "sudahKembali" : "sudahCheckIn";
      } else {
        badge = cariNamaStatusById_(absensi.idStatus);
        info = "Non-hadir";
        kelas = "nonHadir";
      }

      const kartu = buatKartuPegawai_(pegawai.NICKNAME, badge, info, kelas);
      kartu.addEventListener("click", function () {
        bukaModalUpdate_(absensi.idAbsensi, pegawai.NICKNAME);
      });
      grid.appendChild(kartu);
    } else {
      const kartu = buatKartuPegawai_(pegawai.NICKNAME, "", "Belum ada data", "belumAda");
      kartu.addEventListener("click", function () {
        bukaModalInputLangsung_(pegawai.ID_KARYAWAN, pegawai.NICKNAME);
      });
      grid.appendChild(kartu);
    }
  });
}

/*******************************************************************
 * PILIH PEGAWAI (MULTI-SELECT) - ABSEN MASUK & TELAT
 * -----------------------------------------------------------------
 ******************************************************************/

/******************************************************************
 * Function : toggleTerpilih_(kunci, idKaryawan, kartuEl)
 ******************************************************************/
function toggleTerpilih_(kunci, idKaryawan, kartuEl) {
  const arr = terpilih_[kunci];
  const index = arr.indexOf(idKaryawan);
  if (index === -1) {
    arr.push(idKaryawan);
    kartuEl.classList.add("terpilih");
  } else {
    arr.splice(index, 1);
    kartuEl.classList.remove("terpilih");
  }
  perbaruiLabelTerpilih_(kunci);
}

/******************************************************************
 * Function : perbaruiLabelTerpilih_(kunci)
 ******************************************************************/
function perbaruiLabelTerpilih_(kunci) {
  const idLabel = kunci === "masuk" ? "labelJumlahTerpilihMasuk" : "labelJumlahTerpilihTelat";
  const idPesan = kunci === "masuk" ? "pesanAbsenMasuk" : "pesanTelat";
  const jumlah = terpilih_[kunci].length;

  document.getElementById(idLabel).textContent =
    jumlah === 0 ? "Belum ada pegawai dipilih" : jumlah + " pegawai dipilih";
  document.getElementById(idPesan).className = "pesan";
}

/*******************************************************************
 * TOMBOL AKSI (SHIFT & STATUS) - BUILDER UMUM
 * -----------------------------------------------------------------
 ******************************************************************/

/******************************************************************
 * Function : buatTombolAksi_(kode, teks, onClick)
 ******************************************************************/
function buatTombolAksi_(kode, teks, onClick) {
  const tombol = document.createElement("button");
  tombol.type = "button";
  tombol.className = "tombolAksi";
  tombol.setAttribute("data-kode", kode);
  tombol.textContent = teks || kode;
  tombol.addEventListener("click", onClick);
  return tombol;
}

/******************************************************************
 * Function : daftarStatusNonHadir_()
 * Tujuan   : Status yang relevan untuk input langsung (bukan Hadir,
 *            bukan kategori UPDATE seperti Tidak Kembali).
 ******************************************************************/
function daftarStatusNonHadir_() {
  return daftarStatusCache_.filter(function (s) {
    return s.KATEGORI !== "HADIR" && s.KATEGORI !== "UPDATE";
  });
}

/******************************************************************
 * Function : isiGridAksiMasuk_()
 * Tujuan   : Mengisi panel Absen Masuk dengan tombol Shift + Status.
 ******************************************************************/
function isiGridAksiMasuk_() {
  const grid = document.getElementById("gridAksiMasuk");
  grid.innerHTML = "";

  daftarShiftCache_.forEach(function (shift) {
    grid.appendChild(buatTombolAksi_(shift.KODE_SHIFT, shift.KODE_SHIFT, function () {
      jalankanAksiMasukMassal_("shift", shift.ID_SHIFT);
    }));
  });

  daftarStatusNonHadir_().forEach(function (status) {
    grid.appendChild(buatTombolAksi_(status.KODE, status.NAMA_STATUS, function () {
      jalankanAksiMasukMassal_("status", status.ID_STATUS);
    }));
  });
}

/******************************************************************
 * Function : isiGridAksiTelat_()
 * Tujuan   : Mengisi panel Telat dengan tombol Shift saja.
 ******************************************************************/
function isiGridAksiTelat_() {
  const grid = document.getElementById("gridAksiTelat");
  grid.innerHTML = "";

  daftarShiftCache_.forEach(function (shift) {
    grid.appendChild(buatTombolAksi_(shift.KODE_SHIFT, shift.KODE_SHIFT, function () {
      jalankanCheckInTelatMassal_(shift.ID_SHIFT);
    }));
  });
}

/*******************************************************************
 * AKSI: ABSEN MASUK MASSAL (SHIFT / STATUS)
 * -----------------------------------------------------------------
 ******************************************************************/

/******************************************************************
 * Function : jalankanAksiMasukMassal_(tipe, id)
 * Tujuan   : tipe "shift" -> Check In; tipe "status" -> Input Status.
 *            Dijalankan berurutan untuk seluruh pegawai terpilih.
 ******************************************************************/
async function jalankanAksiMasukMassal_(tipe, id) {
  const kotak = document.getElementById("pesanAbsenMasuk");
  const daftarTerpilih = terpilih_.masuk.slice();

  if (daftarTerpilih.length === 0) {
    kotak.textContent = "Pilih minimal satu pegawai dulu.";
    kotak.className = "pesan error";
    return;
  }

  const tanggal = formatTanggalUntukApi_(document.getElementById("fTanggal").value);
  const jamManual = document.getElementById("fJamManualMasuk").value;

  kotak.textContent = "Memproses untuk " + daftarTerpilih.length + " pegawai...";
  kotak.className = "pesan info";

  let jumlahBerhasil = 0;
  const pesanGagal = [];

  for (const idKaryawan of daftarTerpilih) {
    const pegawai = petaPegawai_[idKaryawan];
    const idLantaiKirim = pegawai.LANTAI === "-" ? "" : pegawai.LANTAI;

    try {
      let hasil;
      if (tipe === "shift") {
        hasil = await panggilApi_("checkIn", {
          tanggal: tanggal, idKaryawan: idKaryawan, idPt: pegawai.PT, idDivisi: pegawai.DIVISI,
          idLantai: idLantaiKirim, idShift: id, jamManual: jamManual, keterangan: "",
          username: sesiAktif_.username, penandaAdmin: sesiAktif_.penandaAdmin
        });
      } else {
        hasil = await panggilApi_("inputStatus", {
          tanggal: tanggal, idKaryawan: idKaryawan, idPt: pegawai.PT, idDivisi: pegawai.DIVISI,
          idLantai: idLantaiKirim, idStatus: id, keterangan: "",
          username: sesiAktif_.username, penandaAdmin: sesiAktif_.penandaAdmin
        });
      }

      if (hasil.success) jumlahBerhasil++;
      else pesanGagal.push((pegawai ? pegawai.NICKNAME : idKaryawan) + ": " + hasil.message);
    } catch (error) {
      pesanGagal.push((pegawai ? pegawai.NICKNAME : idKaryawan) + ": " + error.message);
    }
  }

  if (pesanGagal.length === 0) {
    kotak.textContent = jumlahBerhasil + " pegawai berhasil diproses.";
    kotak.className = "pesan sukses";
  } else {
    kotak.textContent = jumlahBerhasil + " berhasil, " + pesanGagal.length + " gagal — " + pesanGagal.join("; ");
    kotak.className = "pesan error";
  }

  muatDaftarAbsensi_();
}

/*******************************************************************
 * AKSI: TELAT MASSAL (SHIFT + KETERANGAN MENIT TELAT)
 * -----------------------------------------------------------------
 ******************************************************************/

/******************************************************************
 * Function : jalankanCheckInTelatMassal_(idShift)
 ******************************************************************/
async function jalankanCheckInTelatMassal_(idShift) {
  const kotak = document.getElementById("pesanTelat");
  const daftarTerpilih = terpilih_.telat.slice();

  if (daftarTerpilih.length === 0) {
    kotak.textContent = "Pilih minimal satu pegawai dulu.";
    kotak.className = "pesan error";
    return;
  }

  const menitTelat = document.getElementById("tMenitTelat").value;
  if (!menitTelat || parseInt(menitTelat, 10) <= 0) {
    kotak.textContent = "Isi menit telat terlebih dahulu (angka lebih dari 0).";
    kotak.className = "pesan error";
    return;
  }

  const keterangan = "Telat " + menitTelat + " menit";
  const tanggal = formatTanggalUntukApi_(document.getElementById("fTanggal").value);
  const jamManual = document.getElementById("fJamManualMasuk").value;

  kotak.textContent = "Memproses untuk " + daftarTerpilih.length + " pegawai...";
  kotak.className = "pesan info";

  let jumlahBerhasil = 0;
  const pesanGagal = [];

  for (const idKaryawan of daftarTerpilih) {
    const pegawai = petaPegawai_[idKaryawan];
    const idLantaiKirim = pegawai.LANTAI === "-" ? "" : pegawai.LANTAI;

    try {
      const hasil = await panggilApi_("checkIn", {
        tanggal: tanggal, idKaryawan: idKaryawan, idPt: pegawai.PT, idDivisi: pegawai.DIVISI,
        idLantai: idLantaiKirim, idShift: idShift, jamManual: jamManual, keterangan: keterangan,
        username: sesiAktif_.username, penandaAdmin: sesiAktif_.penandaAdmin
      });

      if (hasil.success) jumlahBerhasil++;
      else pesanGagal.push((pegawai ? pegawai.NICKNAME : idKaryawan) + ": " + hasil.message);
    } catch (error) {
      pesanGagal.push((pegawai ? pegawai.NICKNAME : idKaryawan) + ": " + error.message);
    }
  }

  if (pesanGagal.length === 0) {
    kotak.textContent = jumlahBerhasil + " pegawai berhasil dicatat telat.";
    kotak.className = "pesan sukses";
    document.getElementById("tMenitTelat").value = "";
  } else {
    kotak.textContent = jumlahBerhasil + " berhasil, " + pesanGagal.length + " gagal — " + pesanGagal.join("; ");
    kotak.className = "pesan error";
  }

  muatDaftarAbsensi_();
}

/*******************************************************************
 * MODAL: ABSEN ISTIRAHAT (Check Kembali)
 * -----------------------------------------------------------------
 ******************************************************************/

/******************************************************************
 * Function : bukaModalKembali_(idAbsensi, nickname, jamMasuk)
 ******************************************************************/
function bukaModalKembali_(idAbsensi, nickname, jamMasuk) {
  dataUntukCheckKembali_ = idAbsensi;
  document.getElementById("judulModalKembali").textContent = "Absen Istirahat - " + nickname;
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
    kotak.textContent = "[ABSEN ISTIRAHAT] " + error.message;
    kotak.className = "pesan error";
  }
}

/*******************************************************************
 * MODAL: UPDATE / KOREKSI (pegawai yang SUDAH ada absensi)
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
    gridShift.appendChild(buatTombolAksi_(shift.KODE_SHIFT, shift.KODE_SHIFT, function () {
      jalankanKoreksiShift_(shift.ID_SHIFT);
    }));
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
 * MODAL: INPUT STATUS LANGSUNG (pegawai yang BELUM ada absensi)
 * -----------------------------------------------------------------
 ******************************************************************/

/******************************************************************
 * Function : bukaModalInputLangsung_(idKaryawan, nickname)
 ******************************************************************/
function bukaModalInputLangsung_(idKaryawan, nickname) {
  idKaryawanUntukInputLangsung_ = idKaryawan;
  document.getElementById("judulModalInputLangsung").textContent = "Input Status - " + nickname;
  document.getElementById("pesanModalInputLangsung").className = "pesan";

  const grid = document.getElementById("gridStatusLangsung");
  grid.innerHTML = "";
  daftarStatusNonHadir_().forEach(function (status) {
    grid.appendChild(buatTombolAksi_(status.KODE, status.NAMA_STATUS, function () {
      jalankanInputStatusLangsung_(status.ID_STATUS);
    }));
  });

  document.getElementById("modalInputLangsung").classList.add("tampil");
}

/******************************************************************
 * Function : jalankanInputStatusLangsung_(idStatus)
 ******************************************************************/
async function jalankanInputStatusLangsung_(idStatus) {
  const kotak = document.getElementById("pesanModalInputLangsung");
  const pegawai = petaPegawai_[idKaryawanUntukInputLangsung_];
  const tanggal = formatTanggalUntukApi_(document.getElementById("fTanggal").value);

  try {
    const hasil = await panggilApi_("inputStatus", {
      tanggal: tanggal,
      idKaryawan: idKaryawanUntukInputLangsung_,
      idPt: pegawai.PT,
      idDivisi: pegawai.DIVISI,
      idLantai: pegawai.LANTAI === "-" ? "" : pegawai.LANTAI,
      idStatus: idStatus,
      keterangan: "",
      username: sesiAktif_.username,
      penandaAdmin: sesiAktif_.penandaAdmin
    });

    if (!hasil.success) {
      kotak.textContent = hasil.message;
      kotak.className = "pesan error";
      return;
    }

    document.getElementById("modalInputLangsung").classList.remove("tampil");
    muatDaftarAbsensi_();
  } catch (error) {
    kotak.textContent = "[INPUT STATUS] " + error.message;
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

  const [hasilShift, hasilStatus] = await Promise.all([
    panggilApi_("daftarShift", {}),
    panggilApi_("daftarStatus", {})
  ]);
  if (hasilShift.success) daftarShiftCache_ = hasilShift.data;
  if (hasilStatus.success) daftarStatusCache_ = hasilStatus.data;

  isiGridAksiMasuk_();
  isiGridAksiTelat_();

  await muatDropdownPt_();

  document.getElementById("fTanggal").addEventListener("change", muatDaftarAbsensi_);
  document.getElementById("fPt").addEventListener("change", tanganiPilihPtFilter_);
  document.getElementById("fDivisi").addEventListener("change", muatDaftarAbsensi_);
  document.getElementById("fLantai").addEventListener("change", muatDaftarAbsensi_);

  document.getElementById("tombolBatalPilihanMasuk").addEventListener("click", function () {
    terpilih_.masuk = [];
    renderGridPilihMasuk_("gridAbsenMasuk", "masuk");
    perbaruiLabelTerpilih_("masuk");
  });

  document.getElementById("tombolBatalPilihanTelat").addEventListener("click", function () {
    terpilih_.telat = [];
    renderGridPilihMasuk_("gridTelat", "telat");
    perbaruiLabelTerpilih_("telat");
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

  document.getElementById("tombolTutupModalInputLangsung").addEventListener("click", function () {
    document.getElementById("modalInputLangsung").classList.remove("tampil");
  });
})();
