"use strict";

(function(global) {
  var App = global.App || {};
  var TVL_INDEX_PATH = global.TVL_INDEX_PATH;
  var TVL_REMOTE_INDEX = global.TVL_REMOTE_INDEX || "";
  var TVL_REMOTE_BASE = global.TVL_REMOTE_BASE || "";
  var FALLBACK_TVL_FILES = global.FALLBACK_TVL_FILES || [];
  var MANIFEST_STORAGE_KEY = global.TVL_MANIFEST_STORAGE_KEY || "bliforest-tvl-manifest";
  var RAW_STORAGE_PREFIX = global.TVL_RAW_STORAGE_PREFIX || "bliforest-tvl-raw:";

  var PI = 3.14159265358979323846264338327950288419716939937510;
  var refreshInFlight = null;

  
  
  

  function calculateVolume(tvl, circumference) {
    if (!tvl || !tvl.coefficients || !Number.isFinite(circumference)) return null;
    var a = Number(tvl.coefficients.a);
    var b = Number(tvl.coefficients.b);
    var factor = Number(tvl.coefficients.factor);
    if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
    if (!Number.isFinite(factor) || factor === 0) factor = 1;
    return a * Math.pow(circumference, b) * factor;
  }

  function calculateDiameter(tvl, circumference) {
    if (!Number.isFinite(circumference)) return null;
    return circumference / PI;
  }

  function calculateHeight(tvl, circumference) {
    if (!tvl || !tvl.coefficients || !Number.isFinite(circumference)) return null;
    var a = Number(tvl.coefficients.a);
    var b = Number(tvl.coefficients.b);
    if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
    return 40000 * PI * a * Math.pow(circumference, b - 2);
  }

  function calculateTreeMetrics(tvl, circumference) {
    return {
      volume: calculateVolume(tvl, circumference),
      diameter: calculateDiameter(tvl, circumference),
      height: calculateHeight(tvl, circumference),
      circumference: circumference
    };
  }

  

  function normalizeFilename(file) {
    var filename = String(file || "").split("?")[0].split("/").pop();
    return filename
      .replace("tvl_acc_mangium", "tvl_akasia_mangium")
      .replace("tvl_acc_au", "tvl_akasia_au");
  }

  function localPathForFile(file) {
    return "data/tvl/" + normalizeFilename(file);
  }

  function remotePathForFile(file) {
    var filename = normalizeFilename(file);
    return TVL_REMOTE_BASE ? TVL_REMOTE_BASE.replace(/\/$/, "") + "/" + filename : localPathForFile(filename);
  }

  function rawStorageKey(path) {
    return RAW_STORAGE_PREFIX + normalizeFilename(path).replace(/\.json$/i, "");
  }

  function readJsonStorage(key) {
    try {
      var raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : null;
    } catch (e) {
      console.warn("Cache localStorage tidak dapat dibaca:", key, e);
      return null;
    }
  }

  function writeJsonStorage(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch (e) {
      console.warn("Cache localStorage tidak dapat disimpan:", key, e);
      return false;
    }
  }

  function getLocalStorageTvl(path) {
    var currentKey = rawStorageKey(path);
    var current = readJsonStorage(currentKey);
    if (current) return current;

    
    var legacyKey = "tvl_raw_" + normalizeFilename(path).replace(/\.json$/i, "");
    var legacy = readJsonStorage(legacyKey);
    if (legacy) writeJsonStorage(currentKey, legacy);
    return legacy;
  }

  function cacheTvlToLocalStorage(path, json) {
    return writeJsonStorage(rawStorageKey(path), json);
  }

  function getLocalManifest() {
    return readJsonStorage(MANIFEST_STORAGE_KEY);
  }

  function cacheManifest(manifest) {
    return writeJsonStorage(MANIFEST_STORAGE_KEY, manifest);
  }

  function cacheMatchJson(url) {
    if (!global.caches || typeof global.caches.match !== "function") return Promise.resolve(null);
    return global.caches.match(url).then(function(response) {
      if (!response) return null;
      return response.clone().json().catch(function() { return null; });
    }).catch(function() { return null; });
  }

  function fetchNetworkJson(url) {
    var separator = url.indexOf("?") === -1 ? "?" : "&";
    var freshUrl = url + separator + "refresh=" + Date.now() + "-" + Math.random().toString(16).slice(2);
    return fetch(freshUrl, {
      method: "GET",
      cache: "no-store",
      credentials: "omit"
    }).then(function(response) {
      if (!response.ok) throw new Error("HTTP " + response.status + " saat mengambil " + url);
      return response.json();
    });
  }

  function fetchPackagedJson(path) {
    return fetch(path, { method: "GET", cache: "default", credentials: "same-origin" })
      .then(function(response) {
        if (!response.ok) throw new Error("HTTP " + response.status + " saat membaca " + path);
        return response.json();
      });
  }

  
  
  function loadLocalTvlRaw(path) {
    var stored = getLocalStorageTvl(path);
    if (stored) return Promise.resolve(stored);

    var localPath = localPathForFile(path);
    return cacheMatchJson(localPath).then(function(cached) {
      if (cached) return cached;
      return fetchPackagedJson(localPath).catch(function() { return null; });
    }).then(function(raw) {
      if (raw) cacheTvlToLocalStorage(localPath, raw);
      return raw;
    });
  }

  

  function tvlSignature(tvl) {
    if (!tvl) return "";
    if (tvl.model === "berkhout") {
      return JSON.stringify({
        id: tvl.id || "",
        name: tvl.name || "",
        species: tvl.species || "",
        version: tvl.version || "",
        updatedAt: tvl.updatedAt || "",
        model: tvl.model,
        coefficients: tvl.coefficients
      });
    }
    return JSON.stringify({
      id: tvl.id || "",
      name: tvl.name || "",
      species: tvl.species || "",
      version: tvl.version || "",
      updatedAt: tvl.updatedAt || "",
      entries: Array.isArray(tvl.entries) ? tvl.entries : []
    });
  }

  function normalizeTvl(raw, filename) {
    filename = filename || "tvl.json";
    var isBerkhout = raw && raw.model === "berkhout";

    if (isBerkhout) {
      return {
        id: String(raw.id || "").trim() || ("tvl_" + Date.now()),
        name: String(raw.name || raw.title || "TVL").trim(),
        species: String(raw.species || "").trim(),
        normalizedSpecies: String(raw.normalizedSpecies || "").trim(),
        version: String(raw.version || "").trim() || null,
        updatedAt: String(raw.updatedAt || "").trim() || null,
        model: "berkhout",
        formula: raw.formula || {},
        coefficients: {
          a: Number(raw.coefficients && raw.coefficients.a) || 0,
          b: Number(raw.coefficients && raw.coefficients.b) || 0,
          factor: Number(raw.coefficients && raw.coefficients.factor) || 1
        },
        K: raw.K || { unit: "cm" },
        diameter: raw.diameter || { unit: "cm" },
        height: raw.height || { unit: "m" },
        volume: raw.volume || { unit: "m3" }
      };
    }

    var sourceRows;
    if (Array.isArray(raw)) sourceRows = raw;
    else sourceRows = (raw && (raw.entries || raw.data || raw.tvl || raw.rows)) || [];

    var entries = sourceRows.map(function(row) {
      var circumference;
      var volume;
      if (Array.isArray(row)) {
        circumference = Number(row[0]);
        volume = Number(row[1]);
      } else {
        circumference = Number(row && (row.circumference || row.keliling || row.circumference_cm || row.cm));
        volume = Number(row && (row.volume || row.volume_m3 || row.m3 || row.vol));
      }
      return { circumference: circumference, volume: volume };
    }).filter(function(row) {
      return Number.isFinite(row.circumference) && Number.isFinite(row.volume) && row.circumference >= 0 && row.volume >= 0;
    }).sort(function(a, b) { return a.circumference - b.circumference; });

    var baseName = filename.replace(/\.json$/i, "").replace(/[_-]+/g, " ").trim();
    var name = String((raw && (raw.name || raw.title || raw.species || raw.jenis)) || baseName || "TVL Impor").trim();
    var rawId = String((raw && raw.id) || ("tvl_" + name)).toLowerCase();
    var id = rawId.replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "") || ("tvl_" + Date.now());

    return {
      id: id,
      name: name,
      species: String(raw && (raw.species || raw.jenis) || "").trim(),
      normalizedSpecies: String(raw && raw.normalizedSpecies || "").trim(),
      unitCircumference: "cm",
      unitVolume: "m3",
      version: String(raw && (raw.version || raw.revision) || "").trim() || null,
      updatedAt: String(raw && (raw.updatedAt || raw.updated_at) || "").trim() || null,
      entries: entries
    };
  }

  function validateTvl(tvl) {
    if (!tvl || !tvl.id) throw new Error("TVL tidak memiliki ID yang valid.");
    if (tvl.model === "berkhout") {
      if (!tvl.coefficients || !Number.isFinite(tvl.coefficients.a) || !Number.isFinite(tvl.coefficients.b) || tvl.coefficients.a === 0 || tvl.coefficients.b === 0) {
        throw new Error("TVL berkhout tidak memiliki koefisien a dan b yang valid.");
      }
    } else if (!Array.isArray(tvl.entries) || !tvl.entries.length) {
      throw new Error("TVL tidak memiliki pasangan keliling dan volume yang valid.");
    }
    return tvl;
  }

  function normalizeManifest(raw) {
    var items = Array.isArray(raw) ? raw : (raw && raw.files) || [];
    var files = items.map(function(item) {
      return typeof item === "string" ? item : (item && item.file);
    }).filter(Boolean).map(function(file) {
      return "tvl/" + normalizeFilename(file);
    });

    if (!files.length) throw new Error("Indeks TVL kosong.");

    return {
      version: Array.isArray(raw) ? null : String(raw.version || raw.indexVersion || "").trim() || null,
      updatedAt: Array.isArray(raw) ? null : String(raw.updatedAt || raw.updated_at || "").trim() || null,
      source: Array.isArray(raw) ? null : (raw.source || null),
      files: files
    };
  }

  function fallbackManifest() {
    return {
      version: null,
      updatedAt: null,
      source: "bundled",
      files: FALLBACK_TVL_FILES.map(function(file) { return "tvl/" + normalizeFilename(file); })
    };
  }

    

  function loadLocalManifest() {
    var stored = getLocalManifest();
    if (stored) {
      try { return Promise.resolve(normalizeManifest(stored)); }
      catch (e) { console.warn("Manifest localStorage rusak, memakai paket lokal.", e); }
    }

    return cacheMatchJson(TVL_INDEX_PATH).then(function(cached) {
      if (cached) return cached;
      return fetchPackagedJson(TVL_INDEX_PATH).catch(function() { return null; });
    }).then(function(raw) {
      if (!raw) return fallbackManifest();
      var manifest = normalizeManifest(raw);
      cacheManifest(manifest);
      return manifest;
    }).catch(function() {
      return fallbackManifest();
    });
  }

  function loadRemoteManifest() {
    var url = TVL_REMOTE_INDEX || TVL_INDEX_PATH;
    return fetchNetworkJson(url).then(function(raw) {
      var manifest = normalizeManifest(raw);
      cacheManifest(manifest);
      return manifest;
    });
  }

  function loadTvlsFromManifest(manifest, source) {
    var loaded = {};
    var isRemote = source === "remote";

    var jobs = manifest.files.map(function(file) {
      var filename = normalizeFilename(file);
      var localPath = localPathForFile(filename);
      var promise = isRemote
        ? fetchNetworkJson(remotePathForFile(filename))
        : loadLocalTvlRaw(localPath);

      return promise.then(function(raw) {
        if (!raw) throw new Error("Data " + filename + " tidak tersedia.");
        var tvl = validateTvl(normalizeTvl(raw, filename));
        loaded[tvl.id] = tvl;
        cacheTvlToLocalStorage(localPath, raw);
      }).catch(function(error) {
        if (isRemote) throw new Error("Gagal mengambil " + filename + ": " + error.message);
        console.warn("TVL lokal tidak dapat dimuat:", filename, error);
      });
    });

    return Promise.all(jobs).then(function() { return loaded; });
  }

  function bundledTvls() {
    var source = Array.isArray(global.BLIFOREST_BUILTIN_TVLS) ? global.BLIFOREST_BUILTIN_TVLS : [];
    var loaded = {};
    source.forEach(function(raw, index) {
      try {
        var tvl = validateTvl(normalizeTvl(raw, "tvl-bundle-" + (index + 1) + ".json"));
        loaded[tvl.id] = tvl;
      } catch (e) { }
    });
    return loaded;
  }

  function incomingIsNewer(current, incoming) {
    if (!current) return true;
    if (tvlSignature(current) === tvlSignature(incoming)) return false;

    var currentDate = Date.parse(current.updatedAt || "");
    var incomingDate = Date.parse(incoming.updatedAt || "");
    if (Number.isFinite(incomingDate) && (!Number.isFinite(currentDate) || incomingDate > currentDate)) return true;

    if (incoming.version && current.version && incoming.version !== current.version) {
      return String(incoming.version).localeCompare(String(current.version), undefined, { numeric: true }) > 0;
    }

    
    return false;
  }

  function mergePreferredLocalTvls(loaded) {
    var changedIds = [];
    var state = App.storage.state;
    Object.keys(loaded).forEach(function(id) {
      if (incomingIsNewer(state.tvls[id], loaded[id])) {
        state.tvls[id] = loaded[id];
        changedIds.push(id);
      }
    });
    return changedIds;
  }

  function mergeMissingTvls(loaded) {
    var changed = false;
    var state = App.storage.state;
    Object.keys(loaded).forEach(function(id) {
      if (!state.tvls[id]) {
        state.tvls[id] = loaded[id];
        changed = true;
      }
    });
    return changed;
  }

  function migrateLegacyDirectTvlSpecies() {
    var state = App.storage.state;
    var migratedIds = [];

    (state.species || []).forEach(function(species) {
      var baseTvl = state.tvls && state.tvls[species.tvlId];
      if (!baseTvl || baseTvl.version === "custom") return;

      // Versi lama menyimpan perkalian=1 dengan menunjuk langsung ke TVL induk.
      // Itu keliru: TVL induk hanya sumber koefisien a dan b; faktor bawaan TVL
      // tidak boleh ikut ke jenis pohon. Semua referensi legacy langsung ini
      // dikonversi menjadi TVL custom dengan faktor eksplisit 1.
      var a = Number(baseTvl.coefficients && baseTvl.coefficients.a);
      var b = Number(baseTvl.coefficients && baseTvl.coefficients.b);
      if (!Number.isFinite(a) || !Number.isFinite(b) || a <= 0 || b <= 0) return;

      var safeSpeciesId = String(species.id || Date.now()).replace(/[^a-zA-Z0-9_-]/g, "_");
      var newId = "tvl_custom_factor1_" + safeSpeciesId;
      var derived = state.tvls[newId];

      if (!derived) {
        derived = {
          id: newId,
          name: "TVL " + species.name,
          species: species.name,
          normalizedSpecies: species.name,
          version: "custom",
          updatedAt: new Date().toISOString(),
          model: "berkhout",
          sourceMode: "tvl",
          baseTvlId: baseTvl.id,
          formula: {
            volume: "V = a * K^b * f",
            diameter: "D = K / π",
            height: "H = 40000 * π * a * K^(b-2)"
          },
          coefficients: {
            a: a,
            b: b,
            factor: 1
          },
          K: { unit: "cm", description: "Keliling" },
          diameter: { unit: "cm" },
          height: { unit: "m" },
          volume: { unit: "m3" }
        };
        state.tvls[newId] = derived;
      }

      species.tvlId = newId;
      migratedIds.push(newId);
    });

    return migratedIds;
  }

  function replaceTvls(loaded) {
    var changedIds = [];
    var state = App.storage.state;
    Object.keys(loaded).forEach(function(id) {
      var current = state.tvls[id];
      if (!current || tvlSignature(current) !== tvlSignature(loaded[id])) {
        state.tvls[id] = loaded[id];
        changedIds.push(id);
      }
    });
    return changedIds;
  }

  
  function loadBuiltinTvls() {
    var state = App.storage.state;
    state.tvls = state.tvls && typeof state.tvls === "object" ? state.tvls : {};
    state.tvlSync = state.tvlSync || {};

    mergeMissingTvls(bundledTvls());

    return loadLocalManifest().then(function(manifest) {
      return loadTvlsFromManifest(manifest, "local").then(function(loaded) {
        var changedIds = mergePreferredLocalTvls(loaded);
        var loadedIds = Object.keys(loaded);

        state.tvlSync.indexVersion = state.tvlSync.indexVersion || manifest.version || null;
        state.tvlSync.serverUpdatedAt = state.tvlSync.serverUpdatedAt || manifest.updatedAt || null;
        state.tvlSync.managedIds = Array.from(new Set((state.tvlSync.managedIds || []).concat(loadedIds)));
        state.tvlSync.dataSource = navigator.onLine ? "local-ready" : "local-offline";

        var migratedIds = migrateLegacyDirectTvlSpecies();
        if (changedIds.length) recalculateTreeVolumes(changedIds);
        if (migratedIds.length) recalculateTreeVolumes(migratedIds);
        App.storage.saveState();

        return { manifest: manifest, loadedIds: loadedIds, changedTvlIds: changedIds.concat(migratedIds), source: "local" };
      });
    }).catch(function(error) {
      console.warn("TVL lokal tidak dapat dimuat sepenuhnya:", error);
      App.storage.saveState();
      return { manifest: fallbackManifest(), loadedIds: Object.keys(state.tvls), changedTvlIds: [], source: "state" };
    });
  }

    

  function lookupVolume(speciesId, circumference) {
    if (!speciesId || !Number.isFinite(circumference) || circumference < 0) return null;
    var state = App.storage.state;
    var species = App.storage.getSpecies(speciesId);
    var tvl = null;

    if (species && species.tvlId) {
      tvl = state.tvls[species.tvlId];
    } else if (state.tvls && state.tvls[speciesId]) {
      
      tvl = state.tvls[speciesId];
    }

    if (!tvl) return null;

    if (tvl.model === "berkhout") {
      var metrics = calculateTreeMetrics(tvl, circumference);
      if (metrics.volume === null) return null;
      metrics.exact = true;
      return metrics;
    }

    if (!tvl.entries || !tvl.entries.length) return null;
    var nearest = tvl.entries[0];
    for (var i = 0; i < tvl.entries.length; i++) {
      var row = tvl.entries[i];
      if (Math.abs(row.circumference - circumference) < Math.abs(nearest.circumference - circumference)) nearest = row;
    }

    return {
      volume: Number(nearest.volume),
      diameter: calculateDiameter(tvl, circumference),
      height: calculateHeight(tvl, circumference),
      matchedCircumference: Number(nearest.circumference),
      exact: Math.abs(nearest.circumference - circumference) < 1e-9
    };
  }

  function recalculateTreeVolumes(changedTvlIds) {
    var changedSet = Array.isArray(changedTvlIds) ? new Set(changedTvlIds) : null;
    var result = { scanned: 0, updated: 0, unchanged: 0, failed: 0, totalBefore: 0, totalAfter: 0 };
    var updatedAt = new Date().toISOString();
    var state = App.storage.state;

    (state.clamps || []).forEach(function(clamp) {
      (clamp.trees || []).forEach(function(tree) {
        var species = App.storage.getSpecies(tree.speciesId);
        var tvlId = species && species.tvlId;
        if (!tvlId || (changedSet && !changedSet.has(tvlId))) return;

        result.scanned++;
        var before = Number(tree.volume) || 0;
        var lookup = lookupVolume(tree.speciesId, Number(tree.circumference));
        if (!lookup) { result.failed++; return; }

        result.totalBefore += before;
        result.totalAfter += lookup.volume;

        var tvl = state.tvls[tvlId];
        var isBerkhout = tvl && tvl.model === "berkhout";
        var changed = Math.abs(before - lookup.volume) > 1e-12 ||
          (!isBerkhout && Number(tree.tvlCircumference) !== Number(lookup.matchedCircumference)) ||
          tree.tvlId !== tvlId;

        tree.volume = lookup.volume;
        tree.tvlCircumference = isBerkhout ? tree.circumference : lookup.matchedCircumference;
        tree.tvlId = tvlId;
        tree.tvlVersion = (state.tvls[tvlId] && state.tvls[tvlId].version) || (state.tvlSync && state.tvlSync.indexVersion) || null;
        tree.volumeUpdatedAt = updatedAt;

        if (isBerkhout) {
          tree.diameter = lookup.diameter;
          tree.height = lookup.height;
        }

        if (changed) result.updated++; else result.unchanged++;
      });
    });

    return result;
  }

    

  function refreshTvls(options) {
    options = options || {};
    if (refreshInFlight) return refreshInFlight;
    if (navigator.onLine === false) return Promise.reject(new Error("Perangkat sedang offline. Data lokal tetap digunakan."));

    var button = options.button;
    var originalText = button && button.textContent;
    if (button) { button.disabled = true; button.textContent = "Memeriksa…"; }

    refreshInFlight = loadRemoteManifest().then(function(manifest) {
      return loadTvlsFromManifest(manifest, "remote").then(function(loaded) {
        var loadedIds = Object.keys(loaded);
        if (!loadedIds.length) throw new Error("Server tidak mengembalikan TVL yang valid.");

        var state = App.storage.state;
        var changedTvlIds = loadedIds.filter(function(id) {
          return !state.tvls[id] || tvlSignature(state.tvls[id]) !== tvlSignature(loaded[id]);
        });

        loadedIds.forEach(function(id) { state.tvls[id] = loaded[id]; });

        var prevManaged = new Set((state.tvlSync && state.tvlSync.managedIds) || []);
        var incoming = new Set(loadedIds);
        var retained = [];
        prevManaged.forEach(function(id) {
          if (incoming.has(id)) return;
          if (App.storage.isTvlUsed(id)) retained.push(id);
          else delete state.tvls[id];
        });

        var checkedAt = new Date().toISOString();
        state.version = global.APP_DATA_VERSION;
        state.tvlSync = state.tvlSync || {};
        state.tvlSync.indexVersion = manifest.version || null;
        state.tvlSync.serverUpdatedAt = manifest.updatedAt || null;
        state.tvlSync.lastCheckedAt = checkedAt;
        state.tvlSync.lastUpdatedAt = changedTvlIds.length ? checkedAt : (state.tvlSync.lastUpdatedAt || null);
        state.tvlSync.managedIds = loadedIds.concat(retained);
        state.tvlSync.dataSource = "github";
        state.tvlSync.lastSyncError = null;

        var calculation = recalculateTreeVolumes(changedTvlIds);
        App.storage.saveState();

        if (navigator.serviceWorker && navigator.serviceWorker.getRegistration) {
          navigator.serviceWorker.getRegistration().then(function(registration) {
            if (registration && registration.update) registration.update();
          }).catch(function() {});
        }

        return { manifest: manifest, changedTvlIds: changedTvlIds, calculation: calculation, source: "github" };
      });
    }).catch(function(error) {
      console.error("Pembaruan TVL gagal; data lokal dipertahankan:", error);
      var state = App.storage.state;
      state.tvlSync = state.tvlSync || {};
      state.tvlSync.lastCheckedAt = new Date().toISOString();
      state.tvlSync.dataSource = "local-fallback";
      state.tvlSync.lastSyncError = error.message || String(error);
      App.storage.saveState();
      throw error;
    }).finally(function() {
      if (button) { button.disabled = false; button.textContent = originalText; }
      refreshInFlight = null;
    });

    return refreshInFlight;
  }

    

  function importTvlFromFile(file) {
    return file.text().then(function(text) {
      var raw = JSON.parse(text);
      var tvl = validateTvl(normalizeTvl(raw, file.name));
      var state = App.storage.state;
      var changed = !state.tvls[tvl.id] || tvlSignature(state.tvls[tvl.id]) !== tvlSignature(tvl);
      state.tvls[tvl.id] = tvl;
      cacheTvlToLocalStorage(file.name, raw);
      var calculation = changed ? recalculateTreeVolumes([tvl.id]) : { updated: 0 };
      App.storage.saveState();
      return { tvl: tvl, changed: changed, calculation: calculation };
    });
  }

  App.tvl = {
    tvlSignature: tvlSignature,
    normalizeTvl: normalizeTvl,
    bundledTvls: bundledTvls,
    loadBuiltinTvls: loadBuiltinTvls,
    refreshTvls: refreshTvls,
    lookupVolume: lookupVolume,
    recalculateTreeVolumes: recalculateTreeVolumes,
    importTvlFromFile: importTvlFromFile,
    replaceTvls: replaceTvls,
    calculateVolume: calculateVolume,
    calculateDiameter: calculateDiameter,
    calculateHeight: calculateHeight,
    calculateTreeMetrics: calculateTreeMetrics,
    localPathForFile: localPathForFile,
    getLocalStorageTvl: getLocalStorageTvl,
    loadLocalManifest: loadLocalManifest
  };

  global.App = App;
})(window);
