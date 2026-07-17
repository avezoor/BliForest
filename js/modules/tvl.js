"use strict";

// ============================================================
// TVL Data Module (Berkhout Formula)
// ============================================================
// Volume = a * K^b * factor
// Diameter = K / π
// Height = (40000 * π * a * K^(b-2)) / factor_correction
// ============================================================

(function(global) {
  var App = global.App || {};
  var TVL_INDEX_PATH = global.TVL_INDEX_PATH;
  var FALLBACK_TVL_FILES = global.FALLBACK_TVL_FILES;
  var TVL_REMOTE_BASE = global.TVL_REMOTE_BASE || "";

  // Math constants
  var PI = Math.PI;
  var MATH_40000_PI = 40000 * PI;

  // ---- Calculate volume using berkhout formula ----
  function calculateVolume(tvl, circumference) {
    if (!tvl || !tvl.coefficients || !Number.isFinite(circumference)) return null;
    var a = tvl.coefficients.a;
    var b = tvl.coefficients.b;
    var factor = tvl.coefficients.factor || 1;
    if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
    return a * Math.pow(circumference, b) * factor;
  }

  // ---- Calculate diameter using keliling ----
  function calculateDiameter(tvl, circumference) {
    if (!Number.isFinite(circumference)) return null;
    return circumference / PI;
  }

  // ---- Calculate height using berkhout formula ----
  function calculateHeight(tvl, circumference) {
    if (!tvl || !tvl.coefficients || !Number.isFinite(circumference)) return null;
    var a = tvl.coefficients.a;
    var b = tvl.coefficients.b;
    var factor_correction = tvl.coefficients.factor_correction || 1;
    if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
    return (MATH_40000_PI * a * Math.pow(circumference, b - 2)) / factor_correction;
  }

  // ---- Calculate all tree metrics ----
  function calculateTreeMetrics(tvl, circumference) {
    var volume = calculateVolume(tvl, circumference);
    var diameter = calculateDiameter(tvl, circumference);
    var height = calculateHeight(tvl, circumference);
    return {
      volume: volume,
      diameter: diameter,
      height: height,
      circumference: circumference
    };
  }

  // ---- Fetch JSON (offline-aware: check connectivity first, then appropriate fetch) ----
  function fetchJson(path, fresh) {
    var isOnline = navigator.onLine;

    // Convert to GitHub raw URL for TVL files if online
    var remotePath = path;
    if (TVL_REMOTE_BASE && (path.indexOf("data/tvl/") !== -1 || path.indexOf("tvl-index") !== -1)) {
      var filename = path.split("/").pop();
      remotePath = TVL_REMOTE_BASE + "/" + filename;
    }

    // ---- OFFLINE path ----
    if (!isOnline) {
      // Try SW cache first (PWA pre-cached), then localStorage
      return caches.match(remotePath).then(function(cached) {
        if (cached) return cached.json();
        return caches.match(path).then(function(c) { return c ? c.json() : null; });
      }).then(function(result) {
        if (result) return result;
        // No SW cache: try localStorage
        return getLocalStorageTvl(path);
      }).then(function(result) {
        if (result) return result;
        // No localStorage either: load from local files via fetch
        return fetch(path).then(function(r) { return r ? r.json() : null; }).catch(function() { return null; });
      });
    }

    // ---- ONLINE path ----
    if (fresh) {
      // Force fresh: network only, bust cache, fallback to offline sources
      var url = remotePath + (remotePath.indexOf("?") !== -1 ? "&" : "?") + "refresh=" + Date.now() + "-" + Math.random().toString(16).slice(2);
      return fetch(url, { cache: "no-store", headers: { "Cache-Control": "no-cache" } })
        .then(function(r) {
          if (!r.ok) throw new Error("HTTP " + r.status);
          return r.json();
        })
        .catch(function() {
          // Network failed: try SW cache → localStorage
          return caches.match(remotePath).then(function(cached) { return cached ? cached.json() : null; })
            .then(function(result) { return result || getLocalStorageTvl(path); })
            .then(function(result) {
              if (result) return result;
              return caches.match(path).then(function(c) { return c ? c.json() : null; });
            });
        });
    }

    // Normal load online: SW cache → network (SW auto-caches)
    return caches.match(remotePath).then(function(cached) {
      if (cached) return cached.json();
      return fetch(remotePath).then(function(r) {
        if (!r.ok) throw new Error("HTTP " + r.status);
        return r.json();
      }).catch(function() {
        // Network failed: try localStorage
        return getLocalStorageTvl(path);
      });
    });
  }

  // ---- localStorage TVL cache helpers ----
  function getLocalStorageTvl(path) {
    try {
      var key = "tvl_raw_" + path.split("/").pop().replace(".json", "");
      var raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : null;
    } catch (e) { return null; }
  }

  function setLocalStorageTvl(path, json) {
    try {
      var key = "tvl_raw_" + path.split("/").pop().replace(".json", "");
      localStorage.setItem(key, JSON.stringify(json));
    } catch (e) {}
  }

  function cacheTvlToLocalStorage(path, json) {
    setLocalStorageTvl(path, json);
  }

  // ---- TVL signature (for change detection) ----
  function tvlSignature(tvl) {
    if (!tvl) return "";
    // For berkhout model, signature includes coefficients
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
    // Legacy format with entries
    return JSON.stringify({
      id: tvl && tvl.id || "",
      name: tvl && tvl.name || "",
      species: tvl && tvl.species || "",
      version: tvl && tvl.version || "",
      updatedAt: tvl && tvl.updatedAt || "",
      entries: Array.isArray(tvl && tvl.entries) ? tvl.entries : []
    });
  }

  // ---- Normalize TVL from raw JSON (Berkhout format) ----
  function normalizeTvl(raw, filename) {
    filename = filename || "tvl.json";

    // Check if TVL uses berkhout model (no entries array)
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
          factor: Number(raw.coefficients && raw.coefficients.factor) || 1,
          factor_correction: Number(raw.coefficients && raw.coefficients.factor_correction) || 1
        },
        K: raw.K || { unit: "cm" },
        diameter: raw.diameter || { unit: "cm" },
        height: raw.height || { unit: "m" },
        volume: raw.volume || { unit: "m3" }
      };
    }

    // Legacy format with entries array (table lookup)
    var sourceRows;
    if (Array.isArray(raw)) {
      sourceRows = raw;
    } else {
      sourceRows = (raw && (raw.entries || raw.data || raw.tvl || raw.rows)) || [];
    }

    var entries = sourceRows.map(function(row) {
      var circumference, volume;
      if (Array.isArray(row)) {
        circumference = Number(row[0]);
        volume = Number(row[1]);
      } else {
        circumference = Number(row && (row.circumference || row.keliling || row.circumference_cm || row.cm));
        volume = Number(row && (row.volume || row.volume_m3 || row.m3 || row.vol));
      }
      return { circumference: circumference, volume: volume };
    }).filter(function(row) {
      return Number.isFinite(row.circumference) && Number.isFinite(row.volume)
        && row.circumference >= 0 && row.volume >= 0;
    }).sort(function(a, b) { return a.circumference - b.circumference; });

    var baseName = (filename || "tvl").replace(/\.json$/i, "").replace(/[_-]+/g, " ").trim();
    var name = String((raw && (raw.name || raw.title || raw.species || raw.jenis)) || baseName || "TVL Impor").trim();
    var rawId = String((raw && raw.id) || ("tvl_" + name)).toLowerCase();
    var id = rawId.replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "") || ("tvl_" + Date.now());

    return {
      id: id,
      name: name,
      species: String(raw && raw.species || raw && raw.jenis || "").trim(),
      normalizedSpecies: String(raw && raw.normalizedSpecies || "").trim(),
      unitCircumference: "cm",
      unitVolume: "m3",
      version: String(raw && (raw.version || raw.revision) || "").trim() || null,
      updatedAt: String(raw && (raw.updatedAt || raw.updated_at) || "").trim() || null,
      entries: entries
    };
  }

  // ---- Bundled TVLs ----
  function bundledTvls() {
    var source = Array.isArray(window.KLEM_KAYU_BUILTIN_TVLS) ? window.KLEM_KAYU_BUILTIN_TVLS : [];
    var loaded = {};
    source.forEach(function(raw, index) {
      try {
        var tvl = normalizeTvl(raw, "tvl-bundle-" + (index + 1) + ".json");
        // For berkhout model, we need coefficients
        if (tvl.model === "berkhout") {
          if (tvl.coefficients && tvl.coefficients.a && tvl.coefficients.b) {
            loaded[tvl.id] = tvl;
          }
        } else if (tvl.entries && tvl.entries.length) {
          // Legacy format needs entries
          loaded[tvl.id] = tvl;
        }
      } catch (e) { /* skip invalid */ }
    });
    return loaded;
  }

  function mergeMissingTvls(loaded) {
    var changed = false;
    var state = App.storage.state;
    Object.values(loaded).forEach(function(tvl) {
      if (!state.tvls[tvl.id]) {
        state.tvls[tvl.id] = tvl;
        changed = true;
      }
    });
    return changed;
  }

  function replaceTvls(loaded) {
    var changedIds = [];
    var state = App.storage.state;
    Object.values(loaded).forEach(function(tvl) {
      var current = state.tvls[tvl.id];
      if (!current || tvlSignature(current) !== tvlSignature(tvl)) {
        state.tvls[tvl.id] = tvl;
        changedIds.push(tvl.id);
      }
    });
    return changedIds;
  }

  // ---- Load manifest ----
  function loadTvlManifest(fresh) {
    // If offline, skip network fetch entirely and use local manifest or fallback
    if (!navigator.onLine && !fresh) {
      return caches.match("data/tvl-index.json").then(function(cached) {
        if (cached) return cached.json();
        // No local manifest: use fallback files list directly
        return null;
      }).then(function(raw) {
        if (raw) {
          var items = Array.isArray(raw) ? raw : (raw && raw.files) || [];
          var files = items.map(function(item) {
            return typeof item === "string" ? item : (item && item.file);
          }).filter(Boolean);
          return { version: null, updatedAt: null, files: files };
        }
        // Fallback: map old manifest names to current filenames
        return {
          version: null, updatedAt: null,
          files: FALLBACK_TVL_FILES.map(function(f) { return f.replace("data/", ""); })
        };
      });
    }

    var manifestPath = TVL_REMOTE_BASE
      ? TVL_REMOTE_BASE.replace("/tvl", "/tvl-index.json").replace("/data/tvl", "/data/tvl-index.json")
      : TVL_INDEX_PATH;
    return fetchJson(manifestPath, fresh).then(function(raw) {
      var items = Array.isArray(raw) ? raw : (raw && raw.files) || [];
      if (!items.length) throw new Error("Indeks TVL kosong");
      var version = Array.isArray(raw) ? null : String(raw.version || raw.indexVersion || "").trim() || null;
      var updatedAt = Array.isArray(raw) ? null : String(raw.updatedAt || raw.updated_at || "").trim() || null;
      var files = items.map(function(item) {
        return typeof item === "string" ? item : (item && item.file);
      }).filter(Boolean);
      return { version: version, updatedAt: updatedAt, files: files };
    }).catch(function(e) {
      if (fresh) throw e;
      console.warn("Indeks TVL tidak dapat dimuat:", e);
      return { version: null, updatedAt: null, files: FALLBACK_TVL_FILES.map(function(f) { return f.replace("data/", ""); }) };
    });
  }

  function loadTvlsFromManifest(manifest, fresh) {
    var state = App.storage.state;
    var loaded = {};
    var promises = manifest.files.map(function(file) {
      // Normalize filename: manifest may have old names, map to actual local files
      var filename = file.split("/").pop();
      // Map old acc_* names to akasia_*
      filename = filename.replace("tvl_acc_mangium", "tvl_akasia_mangium")
                         .replace("tvl_acc_au", "tvl_akasia_au");
      var localPath = "data/" + filename;
      var remotePath = TVL_REMOTE_BASE ? (TVL_REMOTE_BASE + "/" + filename) : localPath;

      return fetchJson(remotePath, fresh).then(function(raw) {
        var tvl = normalizeTvl(raw, filename);
        // Validate TVL
        if (tvl.model === "berkhout") {
          if (!tvl.coefficients || !tvl.coefficients.a || !tvl.coefficients.b) {
            throw new Error("TVL berkhout tidak memiliki koefisien yang valid");
          }
        } else if (!tvl.entries || !tvl.entries.length) {
          throw new Error("TVL tidak memiliki baris yang valid");
        }
        loaded[tvl.id] = tvl;
        // Cache raw JSON to localStorage for offline use
        cacheTvlToLocalStorage(localPath, raw);
      }).catch(function(e) {
        if (fresh) throw new Error("Gagal mengambil " + filename + ": " + e.message);
        console.warn("Gagal memuat " + filename + ":", e);
      });
    });
    return Promise.all(promises).then(function() { return loaded; });
  }

  // ---- Main loader ----
  function loadBuiltinTvls() {
    var bundled = bundledTvls();
    mergeMissingTvls(bundled);

    var state = App.storage.state;
    return loadTvlManifest(false).then(function(manifest) {
      return loadTvlsFromManifest(manifest, false).then(function(fetched) {
        mergeMissingTvls(fetched);
        var loadedIds = Object.keys(bundled).concat(Object.keys(fetched));
        var sync = state.tvlSync;
        sync.indexVersion = sync.indexVersion || manifest.version || null;
        sync.serverUpdatedAt = sync.serverUpdatedAt || manifest.updatedAt || null;
        sync.managedIds = Array.from(new Set((sync.managedIds || []).concat(loadedIds)));
        App.storage.saveState();
      });
    }).catch(function(e) {
      console.warn("TVL JSON tidak dapat dimuat:", e);
    });
  }

  // ---- Volume lookup (supports both legacy and berkhout) ----
  function lookupVolume(speciesId, circumference) {
    if (!speciesId || !Number.isFinite(circumference) || circumference < 0) return null;
    var species = App.storage.getSpecies(speciesId);
    var tvl = species ? App.storage.state.tvls[species.tvlId] : null;
    if (!tvl) return null;

    // Check if TVL uses berkhout model
    if (tvl.model === "berkhout") {
      var volume = calculateVolume(tvl, circumference);
      var diameter = calculateDiameter(tvl, circumference);
      var height = calculateHeight(tvl, circumference);
      if (volume === null) return null;
      return {
        volume: volume,
        diameter: diameter,
        height: height,
        circumference: circumference,
        exact: true
      };
    }

    // Legacy table lookup
    if (!tvl.entries || !tvl.entries.length) return null;
    var nearest = tvl.entries[0];
    for (var i = 0; i < tvl.entries.length; i++) {
      var row = tvl.entries[i];
      if (Math.abs(row.circumference - circumference) < Math.abs(nearest.circumference - circumference)) {
        nearest = row;
      }
    }
    return {
      volume: Number(nearest.volume),
      diameter: calculateDiameter(tvl, circumference),
      height: calculateHeight(tvl, circumference),
      matchedCircumference: Number(nearest.circumference),
      exact: Math.abs(nearest.circumference - circumference) < 1e-9
    };
  }

  // ---- Recalculate volumes ----
  function recalculateTreeVolumes(changedTvlIds) {
    var changedSet = Array.isArray(changedTvlIds) ? new Set(changedTvlIds) : null;
    var result = { scanned: 0, updated: 0, unchanged: 0, failed: 0, totalBefore: 0, totalAfter: 0 };
    var updatedAt = new Date().toISOString();
    var state = App.storage.state;

    state.clamps.forEach(function(clamp) {
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
          (isBerkhout ? false : (Number(tree.tvlCircumference) !== Number(lookup.matchedCircumference))) ||
          tree.tvlId !== tvlId;

        tree.volume = lookup.volume;
        tree.tvlCircumference = isBerkhout ? tree.circumference : lookup.matchedCircumference;
        tree.tvlId = tvlId;
        tree.tvlVersion = (state.tvls[tvlId] && state.tvls[tvlId].version) || (state.tvlSync && state.tvlSync.indexVersion) || null;
        tree.volumeUpdatedAt = updatedAt;

        // Save diameter and height for berkhout model
        if (isBerkhout) {
          tree.diameter = lookup.diameter;
          tree.height = lookup.height;
        }

        if (changed) result.updated++; else result.unchanged++;
      });
    });
    return result;
  }

  // ---- Refresh TVLs (online) ----
  function refreshTvls(options) {
    options = options || {};
    if (!navigator.onLine) return Promise.resolve(null);

    var button = options.button;
    var originalText = button && button.textContent;
    if (button) { button.disabled = true; button.textContent = "Memeriksa…"; }

    return loadTvlManifest(true).then(function(manifest) {
      return loadTvlsFromManifest(manifest, true).then(function(loaded) {
        var loadedIds = Object.keys(loaded);
        if (!loadedIds.length) throw new Error("Server tidak mengembalikan TVL yang valid.");

        var state = App.storage.state;
        var changedTvlIds = loadedIds.filter(function(id) {
          var current = state.tvls[id];
          return !current || tvlSignature(current) !== tvlSignature(loaded[id]);
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

        var calc = recalculateTreeVolumes(changedTvlIds);
        App.storage.saveState();

        navigator.serviceWorker && navigator.serviceWorker.getRegistration().then(function(reg) {
          reg && reg.update && reg.update();
        }).catch(function() {});

        return { manifest: manifest, changedTvlIds: changedTvlIds, calculation: calc };
      });
    }).catch(function(e) {
      console.error("Pembaruan TVL gagal:", e);
      var state = App.storage.state;
      if (state.tvlSync) {
        state.tvlSync.lastCheckedAt = new Date().toISOString();
        App.storage.saveState();
      }
      throw e;
    }).finally(function() {
      if (button) { button.disabled = false; button.textContent = originalText; }
    });
  }

  // ---- Import TVL from file ----
  function importTvlFromFile(file) {
    return file.text().then(function(text) {
      var raw = JSON.parse(text);
      var tvl = normalizeTvl(raw, file.name);

      // Validate imported TVL
      if (tvl.model === "berkhout") {
        if (!tvl.coefficients || !tvl.coefficients.a || !tvl.coefficients.b) {
          throw new Error("TVL berkhout tidak memiliki koefisien a dan b yang valid.");
        }
      } else if (!tvl.entries || !tvl.entries.length) {
        throw new Error("TVL tidak memiliki pasangan keliling dan volume yang valid.");
      }

      var state = App.storage.state;
      var changed = !state.tvls[tvl.id] || tvlSignature(state.tvls[tvl.id]) !== tvlSignature(tvl);
      state.tvls[tvl.id] = tvl;
      var calc = changed ? recalculateTreeVolumes([tvl.id]) : { updated: 0 };
      App.storage.saveState();
      return { tvl: tvl, changed: changed, calculation: calc };
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
    // Expose calculation functions
    calculateVolume: calculateVolume,
    calculateDiameter: calculateDiameter,
    calculateHeight: calculateHeight,
    calculateTreeMetrics: calculateTreeMetrics
  };

  global.App = App;
})(window);
