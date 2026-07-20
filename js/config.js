"use strict";

// ============================================================
// App Configuration
// ============================================================

window.APP_VERSION = "1.4.6";
window.APP_UPDATED_AT = "2026-07-20 09:03";
window.APP_DATA_VERSION = 6;

// Data utama pengguna. Semua klem, pohon, jenis, dan TVL ternormalisasi
// disimpan dalam satu state localStorage agar tetap tersedia saat offline.
window.STORAGE_KEY = "bliforest-offline-data";
window.STORAGE_PAGE_KEY = "bliforest-offline-page";

// Cache mentah TVL/manifest di localStorage. Cache ini menjadi fallback
// tambahan apabila jaringan dan Cache Storage milik service worker tidak ada.
window.TVL_MANIFEST_STORAGE_KEY = "bliforest-tvl-manifest";
window.TVL_RAW_STORAGE_PREFIX = "bliforest-tvl-raw:";

window.TVL_INDEX_PATH = "data/tvl-index.json";
window.TVL_REMOTE_INDEX = "https://raw.githubusercontent.com/avezoor/BliForest/main/data/tvl-index.json";
window.TVL_REMOTE_BASE = "https://raw.githubusercontent.com/avezoor/BliForest/main/data/tvl";

window.TREES_PER_PAGE = 10;
window.CLAMPS_PER_PAGE = 10;

window.FALLBACK_TVL_FILES = [
  "data/tvl/tvl_jati.json",
  "data/tvl/tvl_sengon.json",
  "data/tvl/tvl_mahoni.json",
  "data/tvl/tvl_pinus.json",
  "data/tvl/tvl_damar.json",
  "data/tvl/tvl_maesosis.json",
  "data/tvl/tvl_akasia_mangium.json",
  "data/tvl/tvl_akasia_au.json",
  "data/tvl/tvl_johar.json",
  "data/tvl/tvl_lokes.json",
  "data/tvl/tvl_eupcaliptus.json",
  "data/tvl/tvl_mindi.json",
  "data/tvl/tvl_flamboyan.json",
  "data/tvl/tvl_gemilina.json",
  "data/tvl/tvl_sonokeling.json"
];

window.PAGE_META = {
  trees:  { kicker: "MASTER DATA",   title: "Tambah Pohon" },
  clamps: { kicker: "DATA LAPANGAN", title: "Tambah Klem Pohon" },
  recap:  { kicker: "RINGKASAN",     title: "Rekapan Hasil" },
  master: { kicker: "PENGELOLAAN",   title: "Master Data" },
  about:  { kicker: "INFORMASI",     title: "Tentang" }
};
