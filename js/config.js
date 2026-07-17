"use strict";

// ============================================================
// App Configuration
// ============================================================

window.APP_VERSION = "1.1.1";
window.APP_UPDATED_AT = "2026-07-17T09:39:00+07:00";
window.APP_DATA_VERSION = 5;
window.STORAGE_KEY = "bliforest-offline-data";
window.STORAGE_PAGE_KEY = "bliforest-offline-page";
window.TVL_INDEX_PATH = "data/tvl-index.json";
window.TREES_PER_PAGE = 10;
window.CLAMPS_PER_PAGE = 10;

window.FALLBACK_TVL_FILES = [
  "data/tvl/tvl_jati.json",
  "data/tvl/tvl_sengon.json",
  "data/tvl/tvl_mahoni.json",
  "data/tvl/tvl_pinus.json",
  "data/tvl/tvl_damar.json",
  "data/tvl/tvl_maesosis.json",
  "data/tvl/tvl_acc_mangium.json",
  "data/tvl/tvl_acc_au.json",
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
