"use strict";

// ============================================================
// Storage / State Persistence Module
// ============================================================

(function(global) {
  var App = global.App || {};
  var STORAGE_KEY = global.STORAGE_KEY;
  var APP_DATA_VERSION = global.APP_DATA_VERSION;

  // Module-level state
  var state = null;
  var expandedClamps = new Set();
  var clampPage = 1;
  var treePages = {};
  var treeSearchQueries = {};
  var clampSearchQuery = "";
  var bkphData = {};

  function defaultState() {
    return {
      version: APP_DATA_VERSION,
      tvls: {},
      species: [],
      clamps: [],
      bkphOptions: [],
      rphOptions: [],
      tvlSync: {
        indexVersion: null,
        serverUpdatedAt: null,
        lastCheckedAt: null,
        lastUpdatedAt: null,
        managedIds: [],
        dataSource: "local",
        lastSyncError: null
      }
    };
  }

  function initState() {
    state = loadState();
  }

  function loadState() {
    try {
      var parsed = JSON.parse(localStorage.getItem(STORAGE_KEY));
      if (!parsed || typeof parsed !== "object") return defaultState();
      return {
        __proto__: defaultState(),
        version: APP_DATA_VERSION,
        tvls: parsed.tvls && typeof parsed.tvls === "object" ? parsed.tvls : {},
        species: Array.isArray(parsed.species) ? parsed.species : [],
        clamps: Array.isArray(parsed.clamps) ? parsed.clamps : [],
        bkphOptions: Array.isArray(parsed.bkphOptions) ? parsed.bkphOptions : [],
        rphOptions: Array.isArray(parsed.rphOptions) ? parsed.rphOptions : [],
        tvlSync: (function() {
          var def = defaultState().tvlSync;
          var syn = parsed.tvlSync || {};
          return {
            indexVersion: syn.indexVersion !== undefined ? syn.indexVersion : def.indexVersion,
            serverUpdatedAt: syn.serverUpdatedAt !== undefined ? syn.serverUpdatedAt : def.serverUpdatedAt,
            lastCheckedAt: syn.lastCheckedAt !== undefined ? syn.lastCheckedAt : def.lastCheckedAt,
            lastUpdatedAt: syn.lastUpdatedAt !== undefined ? syn.lastUpdatedAt : def.lastUpdatedAt,
            managedIds: Array.isArray(syn.managedIds) ? syn.managedIds : def.managedIds,
            dataSource: syn.dataSource !== undefined ? syn.dataSource : def.dataSource,
            lastSyncError: syn.lastSyncError !== undefined ? syn.lastSyncError : def.lastSyncError
          };
        })()
      };
    } catch (e) {
      return defaultState();
    }
  }

  function saveState() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (e) {
      console.error("Data lokal gagal disimpan:", e);
    }
  }

  function getSpecies(id) {
    return state.species.find(function(item) { return item.id === id; });
  }

  function isSpeciesUsed(speciesId) {
    return state.clamps.some(function(clamp) {
      return clamp.speciesId === speciesId || (clamp.trees && clamp.trees.some(function(t) { return t.speciesId === speciesId; }));
    });
  }

  function isTvlUsed(tvlId) {
    return state.species.some(function(item) { return item.tvlId === tvlId; });
  }

  function createClampCode() {
    var date = new Date();
    var ymd = date.getFullYear() + pad(date.getMonth() + 1) + pad(date.getDate());
    var prefix = "KLM-" + ymd + "-";
    var seq = state.clamps
      .map(function(c) { return c.code || ""; })
      .filter(function(c) { return c.indexOf(prefix) === 0; })
      .map(function(c) { return Number(c.slice(prefix.length)); })
      .filter(Number.isFinite)
      .reduce(function(m, v) { return Math.max(m, v); }, 0) + 1;
    return prefix + String(seq).padStart(3, "0");
  }

  function getTreePage(clampId) {
    if (!treePages[clampId]) treePages[clampId] = 1;
    return treePages[clampId];
  }

  function setTreePage(clampId, page) {
    treePages[clampId] = page;
  }

  function getTreeSearch(clampId) {
    return treeSearchQueries[clampId] || "";
  }

  function setTreeSearch(clampId, query) {
    treeSearchQueries[clampId] = query;
    setTreePage(clampId, 1);
  }

  function filterTrees(trees, query) {
    if (!query) return trees;
    var q = query.toLowerCase();
    return trees.filter(function(tree) {
      var species = getSpecies(tree.speciesId);
      return (tree.treeNumber || "").toLowerCase().indexOf(q) !== -1 ||
        (species && species.name || "").toLowerCase().indexOf(q) !== -1 ||
        (tree.note || "").toLowerCase().indexOf(q) !== -1 ||
        String(tree.circumference).indexOf(q) !== -1 ||
        String(tree.volume).indexOf(q) !== -1;
    });
  }

  function matchesClampSearch(clamp, query) {
    var species = getSpecies(clamp.speciesId);
    var haystack = [clamp.code, clamp.bkph, clamp.rph, clamp.block, clamp.compartment,
      clamp.forestClass, clamp.plantingYear, species && species.name,
      (clamp.trees || []).map(function(t) { return t.treeNumber; }).join(" ")
    ].filter(Boolean).join(" ").toLowerCase();
    return haystack.indexOf(query) !== -1;
  }

  function clearAllDataExceptTvl() {
    var totalTrees = state.clamps.reduce(function(s, c) { return s + (c.trees || []).length; }, 0);
    var msg = "Yakin ingin menghapus semua data berikut?\n\n" +
      "• " + state.species.length + " jenis kayu\n" +
      "• " + state.clamps.length + " daftar klem\n" +
      "• " + totalTrees + " data pohon\n\n" +
      "Data TVL dan pengaturan sinkronisasi tidak akan dihapus.";
    if (!confirm(msg)) return;
    state.species = [];
    state.clamps = [];
    state.bkphOptions = [];
    state.rphOptions = [];
    expandedClamps.clear();
    treePages = {};
    treeSearchQueries = {};
    clampPage = 1;
    saveState();
  }

  function pad(n) { return String(n).padStart(2, "0"); }

  App.storage = {
    get state() { return state; },
    set state(v) { state = v; },
    get expandedClamps() { return expandedClamps; },
    get clampPage() { return clampPage; },
    set clampPage(v) { clampPage = v; },
    get clampSearchQuery() { return clampSearchQuery; },
    set clampSearchQuery(v) { clampSearchQuery = v; },
    get bkphData() { return bkphData; },
    initState: initState,
    loadState: loadState,
    saveState: saveState,
    defaultState: defaultState,
    getSpecies: getSpecies,
    isSpeciesUsed: isSpeciesUsed,
    isTvlUsed: isTvlUsed,
    createClampCode: createClampCode,
    getTreePage: getTreePage,
    setTreePage: setTreePage,
    getTreeSearch: getTreeSearch,
    setTreeSearch: setTreeSearch,
    filterTrees: filterTrees,
    matchesClampSearch: matchesClampSearch,
    clearAllDataExceptTvl: clearAllDataExceptTvl
  };

  global.App = App;
})(window);
