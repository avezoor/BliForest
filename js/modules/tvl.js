"use strict";

// ============================================================
// TVL Data Module
// ============================================================

(function(global) {
  var App = global.App || {};
  var TVL_INDEX_PATH = global.TVL_INDEX_PATH;
  var FALLBACK_TVL_FILES = global.FALLBACK_TVL_FILES;

  // ---- Fetch JSON ----
  function fetchJson(path, fresh) {
    var url = fresh
      ? path + (path.indexOf("?") !== -1 ? "&" : "?") + "refresh=" + Date.now() + "-" + Math.random().toString(16).slice(2)
      : path;
    return fetch(url, {
      cache: fresh ? "no-store" : "default",
      headers: fresh ? { "Cache-Control": "no-cache" } : undefined
    }).then(function(r) {
      if (!r.ok) throw new Error("HTTP " + r.status);
      return r.json();
    });
  }

  // ---- TVL signature ----
  function tvlSignature(tvl) {
    return JSON.stringify({
      id: tvl && tvl.id || "",
      name: tvl && tvl.name || "",
      species: tvl && tvl.species || "",
      source: tvl && tvl.source || "",
      version: tvl && tvl.version || "",
      updatedAt: tvl && tvl.updatedAt || "",
      entries: Array.isArray(tvl && tvl.entries) ? tvl.entries : []
    });
  }

  // ---- Normalize TVL from raw JSON ----
  function normalizeTvl(raw, filename) {
    filename = filename || "tvl.json";
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
      unitCircumference: "cm",
      unitVolume: "m3",
      source: String(raw && raw.source || raw && raw.sumber || "Impor lokal").trim(),
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
        if (tvl.entries.length) loaded[tvl.id] = tvl;
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
    return fetchJson(TVL_INDEX_PATH, fresh).then(function(raw) {
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
      return { version: null, updatedAt: null, files: FALLBACK_TVL_FILES };
    });
  }

  function loadTvlsFromManifest(manifest, fresh) {
    var state = App.storage.state;
    var loaded = {};
    var promises = manifest.files.map(function(file) {
      var path = file.indexOf("data/") === 0 ? file : ("data/" + file);
      return fetchJson(path, fresh).then(function(raw) {
        var tvl = normalizeTvl(raw, path.split("/").pop());
        if (!tvl.entries.length) throw new Error("TVL tidak memiliki baris yang valid");
        loaded[tvl.id] = tvl;
      }).catch(function(e) {
        if (fresh) throw new Error("Gagal mengambil " + path + ": " + e.message);
        console.warn("Gagal memuat " + path + ":", e);
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

  // ---- Volume lookup ----
  function lookupVolume(speciesId, circumference) {
    if (!speciesId || !Number.isFinite(circumference) || circumference < 0) return null;
    var species = App.storage.getSpecies(speciesId);
    var tvl = species ? App.storage.state.tvls[species.tvlId] : null;
    if (!tvl || !tvl.entries || !tvl.entries.length) return null;
    var nearest = tvl.entries[0];
    for (var i = 0; i < tvl.entries.length; i++) {
      var row = tvl.entries[i];
      if (Math.abs(row.circumference - circumference) < Math.abs(nearest.circumference - circumference)) {
        nearest = row;
      }
    }
    return {
      volume: Number(nearest.volume),
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
        var changed = Math.abs(before - lookup.volume) > 1e-12 ||
          Number(tree.tvlCircumference) !== Number(lookup.matchedCircumference) ||
          tree.tvlId !== tvlId;

        tree.volume = lookup.volume;
        tree.tvlCircumference = lookup.matchedCircumference;
        tree.tvlId = tvlId;
        tree.tvlVersion = (state.tvls[tvlId] && state.tvls[tvlId].version) || (state.tvlSync && state.tvlSync.indexVersion) || null;
        tree.volumeUpdatedAt = updatedAt;
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
      if (!tvl.entries.length) throw new Error("TVL tidak memiliki pasangan keliling dan volume yang valid.");
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
    replaceTvls: replaceTvls
  };

  global.App = App;
})(window);
