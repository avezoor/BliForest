"use strict";

// ============================================================
// Event Handlers Module
// ============================================================

(function(global) {
  var App = global.App || {};
  var U = global.Utils || {};
  var TREES_PER_PAGE = global.TREES_PER_PAGE || 10;

  // ---- Navigation ----
  function bindNav() {
    document.querySelectorAll(".nav-item").forEach(function(btn) {
      btn.addEventListener("click", function() {
        App.components.switchPage(btn.dataset.page);
      });
    });
  }

  // ---- Sidebar ----
  function bindSidebar() {
    var el = App.components.el;
    el("sidebar-open") && el("sidebar-open").addEventListener("click", App.components.openSidebar);
    el("sidebar-close") && el("sidebar-close").addEventListener("click", App.components.closeSidebar);
    el("sidebar-overlay") && el("sidebar-overlay").addEventListener("click", App.components.closeSidebar);
  }

  // ---- Trees page ----
  function bindTree() {
    var el = App.components.el;
    el("tree-form") && el("tree-form").addEventListener("submit", handleTreeSubmit);
    el("tree-list") && el("tree-list").addEventListener("click", handleTreeListClick);
    // Custom species form
    el("species-custom-form") && el("species-custom-form").addEventListener("submit", handleCustomSpeciesSubmit);
  }

  // ---- Handle custom species submit ----
  function handleCustomSpeciesSubmit(e) {
    e.preventDefault();
    var el = App.components.el;
    var name = (el("custom-species-name") && el("custom-species-name").value || "").trim();
    var a = Number(el("custom-coef-a") && el("custom-coef-a").value);
    var b = Number(el("custom-coef-b") && el("custom-coef-b").value);
    var factor = Number(el("custom-factor") && el("custom-factor").value) || 1;
    var fc = Number(el("custom-factor-correction") && el("custom-factor-correction").value) || 0.7;
    var state = App.storage.state;

    if (!name) {
      App.components.showToast("Nama jenis kayu harus diisi.");
      return;
    }
    if (!a || !b || a <= 0 || b <= 0) {
      App.components.showToast("Koefisien a dan b harus diisi dengan nilai yang valid.");
      return;
    }
    if (state.species.some(function(s) { return s.name.toLowerCase() === name.toLowerCase(); })) {
      App.components.showToast("Nama jenis kayu tersebut sudah tersimpan.");
      return;
    }

    // Create custom TVL for this species
    var tvlId = "tvl_custom_" + U.createId("custom");
    var customTvl = {
      id: tvlId,
      name: "TVL " + name,
      species: name,
      normalizedSpecies: name,
      version: "custom",
      updatedAt: new Date().toISOString(),
      model: "berkhout",
      formula: {
        volume: "V = a * K^b * f",
        diameter: "D = K / π",
        height: "H = (40000 * π * a * K^(b-2)) / fc"
      },
      coefficients: {
        a: a,
        b: b,
        factor: factor,
        factor_correction: fc
      },
      K: { unit: "cm", description: "Keliling" },
      diameter: { unit: "cm" },
      height: { unit: "m" },
      volume: { unit: "m3" }
    };

    // Add species with reference to custom TVL
    state.species.push({
      id: U.createId("species"),
      name: name,
      tvlId: tvlId,
      createdAt: new Date().toISOString()
    });

    // Save custom TVL
    state.tvls[tvlId] = customTvl;

    App.storage.saveState();
    e.target.reset();
    App.components.renderTvlSelect(tvlId);
    App.components.renderSpecies();
    App.components.renderClampSpeciesSelect();
    App.components.renderClamps();
    App.components.showToast('Jenis kayu "' + name + '" ditambahkan dengan TVL custom.');
  }

  function handleTreeSubmit(e) {
    e.preventDefault();
    var el = App.components.el;
    var name = (el("tree-name") && el("tree-name").value || "").trim();
    var tvlId = el("tvl-select") && el("tvl-select").value;
    var state = App.storage.state;

    if (!name || !state.tvls[tvlId]) {
      App.components.showToast("Isi nama pohon dan pilih TVL yang valid.");
      return;
    }
    if (state.species.some(function(s) { return s.name.toLowerCase() === name.toLowerCase(); })) {
      App.components.showToast("Nama jenis kayu tersebut sudah tersimpan.");
      return;
    }
    state.species.push({
      id: U.createId("species"),
      name: name,
      tvlId: tvlId,
      createdAt: new Date().toISOString()
    });
    App.storage.saveState();
    e.target.reset();
    App.components.renderTvlSelect(tvlId);
    App.components.renderSpecies();
    App.components.renderClampSpeciesSelect();
    App.components.renderClamps();
    App.components.showToast('Jenis kayu "' + name + '" ditambahkan.');
  }

  function handleTreeListClick(e) {
    var btn = e.target.closest('[data-action="delete-species"]');
    if (!btn) return;
    var id = btn.dataset.id;
    var state = App.storage.state;
    var used = state.clamps && state.clamps.some(function(c) {
      return c.speciesId === id || (c.trees && c.trees.some(function(t) { return t.speciesId === id; }));
    });
    if (btn.disabled || used) {
      App.components.showToast("Jenis kayu tidak dapat dihapus karena digunakan dalam daftar klem.");
      return;
    }
    var item = state.species.find(function(s) { return s.id === id; });
    if (!item) return;
    if (!confirm('Hapus jenis kayu "' + item.name + '"?')) return;
    state.species = state.species.filter(function(s) { return s.id !== id; });
    App.storage.saveState();
    App.components.renderSpecies();
    App.components.renderClampSpeciesSelect();
    App.components.renderClamps();
    App.components.showToast("Jenis kayu dihapus.");
  }

  // ---- Clamp form ----
  function bindClampForm() {
    var el = App.components.el;
    // Render BKPH select
    var bkphKeys = Object.keys(App.storage.bkphData || {}).sort(function(a, b) { return a.localeCompare(b, "id"); });
    el("clamp-bkph").innerHTML = '<option value="">Pilih BKPH</option>' +
      bkphKeys.map(function(k) { return '<option value="' + U.escapeHtml(k) + '">' + U.escapeHtml(k) + '</option>'; }).join("");

    el("clamp-bkph") && el("clamp-bkph").addEventListener("change", function() {
      var bkphVal = el("clamp-bkph").value;
      var rphOpts = bkphVal && Array.isArray(App.storage.bkphData[bkphVal])
        ? App.storage.bkphData[bkphVal].slice().sort(function(a, b) { return a.localeCompare(b, "id"); })
        : [];
      el("clamp-rph").innerHTML = '<option value="">' + (bkphVal ? "Pilih RPH" : "Pilih BKPH terlebih dahulu") + '</option>' +
        rphOpts.map(function(r) { return '<option value="' + U.escapeHtml(r) + '">' + U.escapeHtml(r) + '</option>'; }).join("");
      el("clamp-rph").disabled = !bkphVal;
    });
  }

  function bindClampEvents() {
    var el = App.components.el;
    el("clamp-form") && el("clamp-form").addEventListener("submit", handleClampSubmit);
    el("clamp-search-form") && el("clamp-search-form").addEventListener("submit", function(e) {
      e.preventDefault();
      App.storage.clampSearchQuery = ((el("clamp-search") && el("clamp-search").value) || "").trim().toLowerCase();
      App.storage.clampPage = 1;
      App.components.renderClamps();
    });
    el("clamp-search-clear") && el("clamp-search-clear").addEventListener("click", function() {
      App.storage.clampSearchQuery = "";
      if (el("clamp-search")) el("clamp-search").value = "";
      App.storage.clampPage = 1;
      App.components.renderClamps();
    });
    el("clamp-list") && el("clamp-list").addEventListener("click", handleClampListClick);
    el("clamp-list") && el("clamp-list").addEventListener("submit", handleTreeEntrySubmit);
    el("clamp-list") && el("clamp-list").addEventListener("input", handleTreeEntryVolumeUpdate);
    el("clamp-list") && el("clamp-list").addEventListener("change", handleTreeEntryVolumeUpdate);
    el("clamp-list") && el("clamp-list").addEventListener("click", handleTreeSearchClick);
  }

  function handleClampSubmit(e) {
    e.preventDefault();
    var el = App.components.el;
    var state = App.storage.state;
    if (!state.species.length) {
      App.components.showToast("Tambahkan jenis kayu terlebih dahulu.");
      App.components.switchPage("trees");
      return;
    }
    var clamp = {
      id: U.createId("clamp"),
      code: App.storage.createClampCode(),
      bkph: el("clamp-bkph") && el("clamp-bkph").value || "",
      rph: el("clamp-rph") && el("clamp-rph").value || "",
      speciesId: el("clamp-species") && el("clamp-species").value || "",
      block: (el("clamp-block") && el("clamp-block").value || "").trim(),
      blockArea: Number(el("clamp-block-area") && el("clamp-block-area").value) || 0,
      compartment: (el("clamp-compartment") && el("clamp-compartment").value || "").trim(),
      standardArea: Number(el("clamp-standard-area") && el("clamp-standard-area").value) || 0,
      cutArea: Number(el("clamp-cut-area") && el("clamp-cut-area").value) || 0,
      forestClass: (el("clamp-forest-class") && el("clamp-forest-class").value || "").trim(),
      plantingYear: Number(el("clamp-planting-year") && el("clamp-planting-year").value) || null,
      trees: [],
      createdAt: new Date().toISOString()
    };
    if (!clamp.bkph || !clamp.rph || !clamp.speciesId || !clamp.block || !clamp.compartment || !clamp.forestClass) {
      App.components.showToast("Lengkapi seluruh data daftar klem.");
      return;
    }
    state.clamps.unshift(clamp);
    App.storage.expandedClamps.add(clamp.id);
    App.storage.saveState();
    e.target.reset();
    bindClampForm();
    App.components.renderClampSpeciesSelect();
    App.components.renderClamps();
    App.components.renderRecap();
    App.components.showToast(clamp.code + " berhasil dibuat.");
  }

  function handleClampListClick(e) {
    var btn = e.target.closest("[data-action]");
    if (!btn) return;
    var action = btn.dataset.action;
    var id = btn.dataset.id;
    var state = App.storage.state;

    if (action === "toggle-clamp") {
      var clamp = state.clamps.find(function(c) { return c.id === id; });
      if (!clamp) return;
      if (App.storage.expandedClamps.has(clamp.id)) {
        App.storage.expandedClamps.delete(clamp.id);
      } else {
        App.storage.expandedClamps.add(clamp.id);
      }
      App.components.renderClamps();
      var card = document.querySelector('[data-clamp-id="' + clamp.id + '"]');
      card && card.scrollIntoView({ behavior: "smooth", block: "start" });
      return;
    }
    if (action === "export-clamp") {
      App.components.exportClampCsv(id);
      var c = state.clamps.find(function(cl) { return cl.id === id; });
      App.components.showToast("Data pohon " + (c && c.code || "") + " berhasil diekspor.");
      return;
    }
    if (action === "delete-clamp") {
      var clamp2 = state.clamps.find(function(c) { return c.id === id; });
      if (!clamp2 || !confirm("Hapus " + clamp2.code + " beserta seluruh data pohonnya?")) return;
      state.clamps = state.clamps.filter(function(c) { return c.id !== clamp2.id; });
      App.storage.expandedClamps.delete(clamp2.id);
      App.storage.clampPage = 1;
      App.storage.saveState();
      App.components.renderSpecies();
      App.components.renderClamps();
      App.components.renderRecap();
      App.components.showToast("Daftar klem dihapus.");
      return;
    }
    if (action === "delete-tree") {
      var clamp3 = state.clamps.find(function(c) { return c.id === btn.dataset.clampId; });
      if (!clamp3) return;
      var tree = (clamp3.trees || []).find(function(t) { return t.id === btn.dataset.treeId; });
      if (!tree || !confirm("Hapus data pohon " + tree.treeNumber + "?")) return;
      clamp3.trees = (clamp3.trees || []).filter(function(t) { return t.id !== tree.id; });
      App.storage.setTreePage(clamp3.id, 1);
      App.storage.saveState();
      App.components.renderClamps();
      App.components.renderRecap();
      App.components.showToast("Data pohon dihapus.");
      return;
    }
    if (action === "tree-prev" || action === "tree-next") {
      var clamp4 = state.clamps.find(function(c) { return c.id === btn.dataset.clampId; });
      if (!clamp4) return;
      var tSq = App.storage.getTreeSearch(clamp4.id);
      var fTrees = App.storage.filterTrees(clamp4.trees || [], tSq);
      var totP = Math.max(1, Math.ceil(fTrees.length / TREES_PER_PAGE));
      var cur = App.storage.getTreePage(clamp4.id);
      if (action === "tree-prev") cur = Math.max(1, cur - 1);
      if (action === "tree-next") cur = Math.min(totP, cur + 1);
      App.storage.setTreePage(clamp4.id, cur);
      App.components.renderClamps();
    }
    if (action === "clamp-prev") {
      App.storage.clampPage = Math.max(1, App.storage.clampPage - 1);
      App.components.renderClamps();
    }
    if (action === "clamp-next") {
      var total = App.storage.clampSearchQuery
        ? state.clamps.filter(function(c) { return App.storage.matchesClampSearch(c, App.storage.clampSearchQuery); }).length
        : state.clamps.length;
      var tp = Math.max(1, Math.ceil(total / (global.CLAMPS_PER_PAGE || 10)));
      App.storage.clampPage = Math.min(tp, App.storage.clampPage + 1);
      App.components.renderClamps();
    }
  }

  function handleTreeEntrySubmit(e) {
    var form = e.target.closest(".tree-entry-form");
    if (!form) return;
    e.preventDefault();
    var clamp = App.storage.state.clamps.find(function(c) { return c.id === form.dataset.clampId; });
    if (!clamp) return;
    var data = new FormData(form);
    var speciesId = String(data.get("speciesId") || "");
    var circumference = Number(data.get("circumference"));
    var lookup = App.tvl && App.tvl.lookupVolume(speciesId, circumference);
    var treeNumber = String(data.get("treeNumber") || "").trim();
    var state = App.storage.state;

    if (!state.species.length) {
      App.components.showToast("Belum ada jenis kayu. Tambahkan di halaman \"Tambah Pohon\" terlebih dahulu.");
      return;
    }
    if (!speciesId) {
      App.components.showToast("Pilih jenis kayu.");
      return;
    }
    if (!treeNumber || !Number.isFinite(circumference) || !lookup) {
      App.components.showToast("Lengkapi nomor pohon, jenis kayu, dan keliling yang valid.");
      return;
    }
    if ((clamp.trees || []).some(function(t) { return t.treeNumber.toLowerCase() === treeNumber.toLowerCase(); })) {
      App.components.showToast("Nomor pohon tersebut sudah ada pada daftar ini.");
      return;
    }
    var sp = App.storage.getSpecies(speciesId);
    var tvlId = sp && sp.tvlId || null;
    var tvl = tvlId && App.storage.state.tvls[tvlId];
    var isBerkhout = tvl && tvl.model === "berkhout";
    clamp.trees = clamp.trees || [];
    var newTree = {
      id: U.createId("tree"),
      treeNumber: treeNumber,
      speciesId: speciesId,
      circumference: circumference,
      volume: lookup.volume,
      tvlCircumference: isBerkhout ? circumference : lookup.matchedCircumference,
      tvlId: tvlId,
      tvlVersion: (tvl && tvl.version) || (App.storage.state.tvlSync && App.storage.state.tvlSync.indexVersion) || null,
      volumeUpdatedAt: new Date().toISOString(),
      note: String(data.get("note") || "").trim(),
      createdAt: new Date().toISOString()
    };
    // Save diameter and height for berkhout model
    if (isBerkhout) {
      newTree.diameter = lookup.diameter;
      newTree.height = lookup.height;
    }
    clamp.trees.push(newTree);
    App.storage.setTreePage(clamp.id, 1);
    App.storage.saveState();
    form.reset();
    App.components.renderClamps();
    App.components.renderRecap();
    App.components.showToast("Pohon " + treeNumber + " ditambahkan dengan volume " + U.formatNumber(lookup.volume, 4) + " m3.");
  }

  function handleTreeEntryVolumeUpdate(e) {
    var form = e.target.closest(".tree-entry-form");
    if (!form) return;
    if (e.target.name !== "circumference" && e.target.name !== "speciesId") return;
    App.components.updateVolumeForForm(form);
  }

  function handleTreeSearchClick(e) {
    var btn = e.target.closest('[data-action="tree-do-search"]');
    if (btn) {
      var inp = document.querySelector('[data-action="tree-search"][data-clamp-id="' + btn.dataset.clampId + '"]');
      if (inp) App.storage.setTreeSearch(btn.dataset.clampId, inp.value.trim());
      App.components.renderClamps();
      return;
    }
    var clr = e.target.closest('[data-action="tree-clear-search"]');
    if (clr) {
      App.storage.setTreeSearch(clr.dataset.clampId, "");
      App.components.renderClamps();
    }
  }

  // ---- Recap ----
  function bindRecap() {
    var el = App.components.el;
    el("export-btn") && el("export-btn").addEventListener("click", function() {
      App.components.exportRecapCsv();
      App.components.showToast("Rekap Excel berhasil dibuat.");
    });
  }

  // ---- Master data ----
  function bindMaster() {
    var el = App.components.el;
    el("backup-btn") && el("backup-btn").addEventListener("click", function() {
      var state = App.storage.state;
      var payload = { app: "BliForest", version: global.APP_DATA_VERSION, exportedAt: new Date().toISOString(), data: state };
      U.downloadBlob(JSON.stringify(payload, null, 2), "backup-BliForest-" + U.dateStamp() + ".json", "application/json");
      App.components.showToast("Cadangan data berhasil dibuat.");
    });
    el("restore-btn") && el("restore-btn").addEventListener("click", function() {
      var inp = el("restore-file");
      if (inp) inp.click();
    });
    el("restore-file") && el("restore-file").addEventListener("change", handleRestore);
    el("clear-all-btn") && el("clear-all-btn").addEventListener("click", function() {
      App.storage.clearAllDataExceptTvl();
      App.components.renderAll();
      App.components.showToast("Semua data berhasil dihapus. TVL tetap tersimpan.");
    });
  }

  function handleRestore(e) {
    var file = e.target.files && e.target.files[0];
    if (!file) return;
    file.text().then(function(text) {
      var parsed = JSON.parse(text);
      var restored = parsed.data || parsed;
      if (!restored || !Array.isArray(restored.species) || !Array.isArray(restored.clamps)) {
        throw new Error("Format cadangan tidak dikenali.");
      }
      if (!confirm("Pulihkan cadangan ini? Data yang sedang tersimpan akan diganti.")) return;
      var state = App.storage.state;
      state.tvls = restored.tvls && typeof restored.tvls === "object" ? restored.tvls : {};
      state.species = restored.species;
      state.clamps = restored.clamps;
      state.bkphOptions = Array.isArray(restored.bkphOptions) ? restored.bkphOptions : [];
      state.rphOptions = Array.isArray(restored.rphOptions) ? restored.rphOptions : [];
      state.tvlSync = state.tvlSync || {};
      if (restored.tvlSync && typeof restored.tvlSync === "object") {
        Object.assign(state.tvlSync, restored.tvlSync);
        state.tvlSync.managedIds = Array.isArray(restored.tvlSync.managedIds) ? restored.tvlSync.managedIds : [];
      }
      App.storage.saveState();
      App.storage.expandedClamps.clear();
      App.storage.clampPage = 1;
      App.components.renderAll();
      App.components.showToast("Cadangan data berhasil dipulihkan.");
    }).catch(function(err) {
      App.components.showToast(err.message || "Cadangan tidak dapat dipulihkan.");
    }).finally(function() { e.target.value = ""; });
  }

  // ---- Global ----
  function bindGlobal() {
    var el = App.components.el;
    el("modal-close") && el("modal-close").addEventListener("click", App.components.closeModal);
    el("clamp-modal") && el("clamp-modal").addEventListener("click", function(e) {
      if (e.target === el("clamp-modal")) App.components.closeModal();
    });
    window.addEventListener("keydown", function(e) {
      if (e.key === "Escape" && el("clamp-modal") && el("clamp-modal").classList.contains("open")) {
        App.components.closeModal();
      }
    });
  }

  App.handlers = {
    bindNav: bindNav,
    bindSidebar: bindSidebar,
    bindTree: bindTree,
    bindClampForm: bindClampForm,
    bindClampEvents: bindClampEvents,
    bindRecap: bindRecap,
    bindMaster: bindMaster,
    bindGlobal: bindGlobal
  };

  global.App = App;
})(window);
