# BliForest

Aplikasi web Progressive Web App (PWA) untuk pencatatan klem pohon dan perhitungan volume kayu berbasis formule Berkhout (TVL). Dirancang **offline-first** dengan sinkronisasi data otomatis dari GitHub.

---

## Info Versi

**Versi:** `1.4.1`  
**Update:** `18 Juli 2026, 21.28 WIB`  
**Cache:** `BliForest-1.4.1-2026.07.18`

---

## Fitur

- `[VOL]` Volume - Hitung volume pohon dengan formule Berkhout
- `[OFF]` Offline - Berfungsi penuh tanpa koneksi internet
- `[SYNC]` Sync - Sinkronisasi data TVL saat online
- `[PWA]` PWA - Instalasi seperti aplikasi native
- `[EXP]` Export - Ekspor data ke CSV dan Excel
- `[BAK]` Backup - Cadangkan dan pulihkan data

---

## Struktur Data

Data tersimpan pada kunci localStorage berikut:

- `bliforest-offline-data` - Data klem, pohon, jenis, dan sinkronisasi
- `bliforest-tvl-manifest` - Manifest TVL terakhir
- `bliforest-tvl-raw:*` - Salinan TVL untuk fallback offline

---

## Menjalankan Secara Lokal

Service worker tidak berjalan pada protokol `file://`. Jalankan server lokal:

```bash
python -m http.server 8080
```

Buka **http://localhost:8080** di browser.

---

## Deploy ke GitHub Pages

1. Push seluruh isi proyek ke repository GitHub
2. Buka **Settings > Pages**
3. Pilih branch `main` dan folder root `/`
4. Buka alamat GitHub Pages yang diberikan
5. Di Chrome Android, pilih **⋮ > Instal aplikasi** atau **Tambahkan ke layar utama**

---

## Konfigurasi

Buka `js/config.js` untuk mengatur:

```javascript
window.TVL_REMOTE_INDEX = "https://raw.githubusercontent.com/USERNAME/REPO/main/data/tvl-index.json";
window.TVL_REMOTE_BASE  = "https://raw.githubusercontent.com/USERNAME/REPO/main/data/tvl";
```

Struktur direktori TVL:

```
data/
├── tvl-index.json
└── tvl/
    ├── tvl_jati.json
    ├── tvl_sengon.json
    └── ...
```

---

## Update Versi

Gunakan script `update.py` untuk memperbarui versi:

```bash
python update.py
```

Atau dengan parameter langsung:

```bash
python update.py 1.4.0
```

Script ini akan memperbarui:

- `js/config.js` - Versi aplikasi
- `sw.js` - Nama cache
- `README.md` - Badge info versi

---

## Lisensi

MIT License
