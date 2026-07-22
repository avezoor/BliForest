"use strict";

(function(global) {
  var App = global.App || {};
  var U = global.Utils || {};
  var TREES_PER_PAGE = global.TREES_PER_PAGE || 10;

  function bindNav() {
    document.querySelectorAll(".nav-item").forEach(function(btn) {
      btn.addEventListener("click", function() {
        App.components.switchPage(btn.dataset.page);
      });
    });
  }

  function bindSidebar() {
    var el = App.components.el;
    el("sidebar-open") && el("sidebar-open").addEventListener("click", App.components.openSidebar);
    el("sidebar-close") && el("sidebar-close").addEventListener("click", App.components.closeSidebar);
    el("sidebar-overlay") && el("sidebar-overlay").addEventListener("click", App.components.closeSidebar);
  }

  function bindTree() {
    var el = App.components.el;
    el("species-custom-form") && el("species-custom-form").addEventListener("submit", handleCustomSpeciesSubmit);
    el("tree-list") && el("tree-list").addEventListener("click", handleTreeListClick);
    el("custom-tvl-source") && el("custom-tvl-source").addEventListener("change", handleTvlSourceToggle);
    handleTvlSourceToggle();
  }

  function handleTvlSourceToggle() {
    var el = App.components.el;
    var source = el("custom-tvl-source") && el("custom-tvl-source").value;
    var tvlFields = el("tvl-mode-fields");
    var nontvlFields = el("nontvl-mode-fields");
    if (tvlFields) tvlFields.style.display = source === "tvl" ? "" : "none";
    if (nontvlFields) nontvlFields.style.display = source === "custom" ? "" : "none";
  }

  function handleCustomSpeciesSubmit(e) {
    e.preventDefault();
    var el = App.components.el;
    var name = (el("custom-species-name") && el("custom-species-name").value || "").trim();
    var source = el("custom-tvl-source") && el("custom-tvl-source").value;
    var state = App.storage.state;

    if (!name) {
      App.components.showToast("Nama jenis pohon harus diisi.");
      return;
    }
    if (state.species.some(function(s) { return s.name.toLowerCase() === name.toLowerCase(); })) {
      App.components.showToast("Nama jenis pohon tersebut sudah tersimpan.");
      return;
    }

    var speciesId = U.createId("species");
    var tvlId = null;

    if (source === "tvl") {
      var selectedTvlId = el("custom-tvl-select") && el("custom-tvl-select").value;
      var factor = Number(el("custom-factor-tvl") && el("custom-factor-tvl").value) || 1;

      if (!selectedTvlId || !state.tvls[selectedTvlId]) {
        App.components.showToast("Pilih TVL yang valid.");
        return;
      }

      if (factor === 1) {
        tvlId = selectedTvlId;
      } else {
        tvlId = "tvl_custom_" + U.createId("custom");
        var baseTvl = state.tvls[selectedTvlId];
        var customTvl = JSON.parse(JSON.stringify(baseTvl));
        customTvl.id = tvlId;
        customTvl.name = "TVL " + name;
        customTvl.species = name;
        customTvl.normalizedSpecies = name;
        customTvl.version = "custom";
        customTvl.updatedAt = new Date().toISOString();
        customTvl.coefficients = JSON.parse(JSON.stringify(baseTvl.coefficients || {}));
        customTvl.coefficients.factor = factor;
        delete customTvl.coefficients.factor_correction;
        state.tvls[tvlId] = customTvl;
      }

      state.species.push({
        id: speciesId,
        name: name,
        tvlId: tvlId,
        createdAt: new Date().toISOString()
      });
    } else {
      var a = Number(el("custom-coef-a") && el("custom-coef-a").value);
      var b = Number(el("custom-coef-b") && el("custom-coef-b").value);
      var factor = Number(el("custom-factor") && el("custom-factor").value) || 1;

      if (!a || !b || a <= 0 || b <= 0) {
        App.components.showToast("Koefisien a dan b harus diisi dengan nilai yang valid.");
        return;
      }

      tvlId = "tvl_custom_" + U.createId("custom");
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
          factor: factor
        },
        K: { unit: "cm", description: "Keliling" },
        diameter: { unit: "cm" },
        height: { unit: "m" },
        volume: { unit: "m3" }
      };

      state.tvls[tvlId] = customTvl;
      state.species.push({
        id: speciesId,
        name: name,
        tvlId: tvlId,
        createdAt: new Date().toISOString()
      });
    }

    App.storage.saveState();
    e.target.reset();
    if (el("custom-tvl-source")) el("custom-tvl-source").value = "tvl";
    handleTvlSourceToggle();
    App.components.renderTvlSelect(tvlId);
    App.components.renderCustomTvlSelect();
    App.components.renderSpecies();
    App.components.renderClampSpeciesSelect();
    App.components.renderClamps();
    App.components.showToast('Jenis pohon "' + name + '" ditambahkan.');
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
      App.components.showToast("Jenis pohon tidak dapat dihapus karena digunakan dalam daftar klem.");
      return;
    }
    var item = state.species.find(function(s) { return s.id === id; });
    if (!item) return;
    if (!confirm('Hapus jenis pohon "' + item.name + '"?')) return;

    state.species = state.species.filter(function(s) { return s.id !== id; });
    if (item.tvlId && item.tvlId.startsWith("tvl_custom_")) {
      delete state.tvls[item.tvlId];
    }

    App.storage.saveState();
    App.components.renderSpecies();
    App.components.renderClampSpeciesSelect();
    App.components.renderClamps();
    App.components.renderTvlSelect();
    App.components.renderCustomTvlSelect();
    App.components.showToast("Jenis kayu dihapus.");
  }

  function bindClampForm() {
    var el = App.components.el;
    var bkphKeys = Object.keys(App.storage.bkphData || {}).sort(function(a, b) { return a.localeCompare(b, "id"); });
    if (el("clamp-bkph")) {
      el("clamp-bkph").innerHTML = '<option value="">Pilih BKPH</option>' +
        bkphKeys.map(function(k) { return '<option value="' + U.escapeHtml(k) + '">' + U.escapeHtml(k) + '</option>'; }).join("");
    }
    if (el("clamp-bkph")) {
      el("clamp-bkph").onchange = function() {
        var bkphVal = el("clamp-bkph").value;
        var rphOpts = bkphVal && Array.isArray(App.storage.bkphData[bkphVal])
          ? App.storage.bkphData[bkphVal].slice().sort(function(a, b) { return a.localeCompare(b, "id"); })
          : [];
        if (el("clamp-rph")) {
          el("clamp-rph").innerHTML = '<option value="">' + (bkphVal ? "Pilih RPH" : "Pilih BKPH terlebih dahulu") + '</option>' +
            rphOpts.map(function(r) { return '<option value="' + U.escapeHtml(r) + '">' + U.escapeHtml(r) + '</option>'; }).join("");
          el("clamp-rph").disabled = !bkphVal;
        }
      };
    }
  }

  // ================================================================
  // PREVIEW NOMOR POHON (dipasang saat form tree-entry dirender)
  // ================================================================
  function updateTreeNumberPreview(form) {
    if (!form) return;
    var speciesId = form.elements && form.elements.speciesId && form.elements.speciesId.value;
    var block = form.dataset.block;
    var preview = form.querySelector(".tree-number-preview");
    var noEl = preview && preview.querySelector(".preview-no");
    var ruleEl = preview && preview.querySelector(".preview-rule");
    if (!preview || !noEl || !ruleEl) return;

    if (!speciesId || !block) {
      preview.style.display = "none";
      return;
    }

    var state = App.storage.state;
    var sp = App.storage.getSpecies(speciesId);
    var speciesName = sp ? sp.name : speciesId;

    function parseTreeNum(n) {
      var x = parseInt(n, 10);
      return isNaN(x) ? 0 : x;
    }

    var allTrees = (state.clamps || []).reduce(function(acc, c) {
      return acc.concat((c.trees || []).map(function(t) {
        return { treeNumber: t.treeNumber, speciesId: t.speciesId, block: c.block };
      }));
    }, []);

    function getTreesInBlock(b) {
      return allTrees.filter(function(t) { return t.block === b; });
    }

    function getLastTreeOfSpeciesInBlock(b, sid) {
      var trees = getTreesInBlock(b).filter(function(t) { return t.speciesId === sid; });
      if (!trees.length) return null;
      return trees.reduce(function(prev, curr) {
        return parseTreeNum(prev.treeNumber) >= parseTreeNum(curr.treeNumber) ? prev : curr;
      });
    }

    function getLastTreeInBlock(b) {
      var trees = getTreesInBlock(b);
      if (!trees.length) return null;
      return trees.reduce(function(prev, curr) {
        return parseTreeNum(prev.treeNumber) >= parseTreeNum(curr.treeNumber) ? prev : curr;
      });
    }

    var usedBlocks = [];
    (state.clamps || []).forEach(function(c) {
      if (usedBlocks.indexOf(c.block) === -1) usedBlocks.push(c.block);
    });

    var prevTreeOfSameSpecies = getLastTreeOfSpeciesInBlock(block, speciesId);
    var lastTreeInBlock = getLastTreeInBlock(block);
    var nextNo;
    var ruleText = "";

    if (prevTreeOfSameSpecies) {
      nextNo = parseTreeNum(prevTreeOfSameSpecies.treeNumber) + 1;
      ruleText = "(Blok sama + jenis sama → lanjut sequential)";
    } else if (lastTreeInBlock) {
      nextNo = parseTreeNum(lastTreeInBlock.treeNumber) + 1;
      ruleText = "(Blok sama + jenis berbeda → mulai dari N+1)";
    } else {
      var cbIdx = usedBlocks.indexOf(block);
      var foundPrevBlock = false;
      for (var i = cbIdx - 1; i >= 0; i--) {
        var pb = usedBlocks[i];
        var pbLast = getLastTreeInBlock(pb);
        if (pbLast) {
          nextNo = parseTreeNum(pbLast.treeNumber) + 1;
          ruleText = "(Blok berbeda → lanjut dari Blok " + pb + ")";
          foundPrevBlock = true;
          break;
        }
      }
      if (!foundPrevBlock) {
        nextNo = 1;
        ruleText = "(Blok baru → mulai dari #1)";
      }
    }

    noEl.textContent = "#" + nextNo;
    ruleEl.textContent = ruleText;
    preview.style.display = "block";
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
    // Preview nomor pohon saat species berubah (delegated ke clamp-list)
    el("clamp-list") && el("clamp-list").addEventListener("change", function(e) {
      var speciesSelect = e.target.closest(".tree-entry-form") && e.target.name === "speciesId";
      if (speciesSelect) {
        updateTreeNumberPreview(e.target.closest(".tree-entry-form"));
      }
    });
    el("clamp-list") && el("clamp-list").addEventListener("input", function(e) {
      var speciesSelect = e.target.closest(".tree-entry-form") && e.target.name === "speciesId";
      if (speciesSelect) {
        updateTreeNumberPreview(e.target.closest(".tree-entry-form"));
      }
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
    var bkph = (el("clamp-bkph") && el("clamp-bkph").value || "").trim();
    var rph = (el("clamp-rph") && el("clamp-rph").value || "").trim();
    var speciesId = (el("clamp-species") && el("clamp-species").value || "").trim();
    var block = (el("clamp-block") && el("clamp-block").value || "").trim();
    var compartment = (el("clamp-compartment") && el("clamp-compartment").value || "").trim();

    if (!bkph || !rph || !speciesId || !block || !compartment) {
      App.components.showToast("Lengkapi seluruh data daftar klem.");
      return;
    }

    var clampCode = App.storage.createClampCode();

    var clamp = {
      id: U.createId("clamp"),
      code: clampCode,
      bkph: bkph,
      rph: rph,
      speciesId: speciesId,
      block: block,
      compartment: compartment,
      trees: [],
      createdAt: new Date().toISOString()
    };
    state.clamps.unshift(clamp);
    App.storage.expandedClamps.add(clamp.id);
    App.storage.saveState();
    e.target.reset();
    bindClampForm();
    App.components.renderClampSpeciesSelect();
    App.components.renderClamps();
    App.components.renderRecap();
    App.components.showToast(clampCode + " berhasil dibuat.");
  }

  function showEditClampModal(clamp) {
    var el = App.components.el;
    var modal = document.getElementById("clamp-modal");
    var modalTitle = document.getElementById("modal-title");
    var modalBody = document.getElementById("modal-body");
    if (!modal || !modalTitle || !modalBody) return;

    var bkphKeys = Object.keys(App.storage.bkphData || {}).sort(function(a, b) { return a.localeCompare(b, "id"); });
    var bkphOptions = bkphKeys.map(function(k) {
      return '<option value="' + U.escapeHtml(k) + '"' + (clamp.bkph === k ? ' selected' : '') + '>' + U.escapeHtml(k) + '</option>';
    }).join("");

    var rphOpts = (App.storage.bkphData[clamp.bkph] || []).slice().sort(function(a, b) { return a.localeCompare(b, "id"); });
    var rphOptions = rphOpts.map(function(r) {
      return '<option value="' + U.escapeHtml(r) + '"' + (clamp.rph === r ? ' selected' : '') + '>' + U.escapeHtml(r) + '</option>';
    }).join("");

    var speciesOpts = (function() {
      var state = App.storage.state;
      var options = [];
      var existingSpeciesIds = (state.species || []).map(function(s) { return s.tvlId; });

      (state.species || []).slice().sort(function(a, b) { return a.name.localeCompare(b.name, "id"); }).forEach(function(item) {
        options.push({ value: item.id, label: item.name, selected: item.id === clamp.speciesId });
      });

      Object.values(state.tvls || {}).forEach(function(tvl) {
        if (existingSpeciesIds.indexOf(tvl.id) !== -1) return;
        options.push({ value: tvl.id, label: tvl.species || tvl.name || tvl.id, selected: tvl.id === clamp.speciesId });
      });

      options.sort(function(a, b) { return a.label.localeCompare(b.label, "id"); });
      return options.map(function(o) {
        return '<option value="' + U.escapeHtml(o.value) + '"' + (o.selected ? ' selected' : '') + '>' + U.escapeHtml(o.label) + '</option>';
      }).join("");
    })();

    modalTitle.textContent = "Edit Daftar Klem";
    modalBody.innerHTML = '<form id="edit-clamp-form" class="form-grid">' +
      '<label class="field"><span>BKPH</span><select id="edit-clamp-bkph" required>' + bkphOptions + '</select></label>' +
      '<label class="field"><span>RPH</span><select id="edit-clamp-rph" required><option value="">Pilih RPH</option>' + rphOptions + '</select></label>' +
      '<label class="field full"><span>Jenis pohon utama</span><select id="edit-clamp-species" required><option value="">Pilih jenis pohon</option>' + speciesOpts + '</select></label>' +
      '<label class="field"><span>Nama blok</span><input id="edit-clamp-block" type="text" required maxlength="120" value="' + U.escapeHtml(clamp.block) + '"></label>' +
      '<label class="field"><span>Anak petak</span><input id="edit-clamp-compartment" type="text" required maxlength="120" value="' + U.escapeHtml(clamp.compartment) + '"></label>' +
      '<input type="hidden" id="edit-clamp-id" value="' + clamp.id + '">' +
      '<button class="btn btn-primary full" type="submit">Simpan Perubahan</button>' +
      '</form>';

    var editBphpSelect = document.getElementById("edit-clamp-bkph");
    if (editBphpSelect) {
      editBphpSelect.onchange = function() {
        var bkphVal = editBphpSelect.value;
        var rphOpts = bkphVal && Array.isArray(App.storage.bkphData[bkphVal])
          ? App.storage.bkphData[bkphVal].slice().sort(function(a, b) { return a.localeCompare(b, "id"); })
          : [];
        var rphSelect = document.getElementById("edit-clamp-rph");
        if (rphSelect) {
          rphSelect.innerHTML = '<option value="">Pilih RPH</option>' +
            rphOpts.map(function(r) { return '<option value="' + U.escapeHtml(r) + '">' + U.escapeHtml(r) + '</option>'; }).join("");
        }
      };
    }

    modal.classList.add("open");
    modal.setAttribute("aria-hidden", "false");
    document.getElementById("edit-clamp-form").addEventListener("submit", handleEditClampSubmit);
  }

  function handleEditClampSubmit(e) {
    e.preventDefault();
    var state = App.storage.state;
    var clampId = document.getElementById("edit-clamp-id") && document.getElementById("edit-clamp-id").value;
    var clamp = state.clamps.find(function(c) { return c.id === clampId; });
    if (!clamp) return;

    var bkph = (document.getElementById("edit-clamp-bkph") && document.getElementById("edit-clamp-bkph").value || "").trim();
    var rph = (document.getElementById("edit-clamp-rph") && document.getElementById("edit-clamp-rph").value || "").trim();
    var speciesId = (document.getElementById("edit-clamp-species") && document.getElementById("edit-clamp-species").value || "").trim();
    var block = (document.getElementById("edit-clamp-block") && document.getElementById("edit-clamp-block").value || "").trim();
    var compartment = (document.getElementById("edit-clamp-compartment") && document.getElementById("edit-clamp-compartment").value || "").trim();

    if (!bkph || !rph || !speciesId || !block || !compartment) {
      App.components.showToast("Lengkapi seluruh data.");
      return;
    }

    clamp.bkph = bkph;
    clamp.rph = rph;
    clamp.speciesId = speciesId;
    clamp.block = block;
    clamp.compartment = compartment;

    App.storage.saveState();
    App.components.closeModal();
    App.components.renderClampSpeciesSelect();
    App.components.renderClamps();
    App.components.renderRecap();
    App.components.showToast("Daftar klem berhasil diperbarui.");
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
      var page = document.getElementById("page-clamps");
      if (App.storage.expandedClamps.has(clamp.id)) {
        App.storage.expandedClamps.delete(clamp.id);
        if (page) page.classList.remove("viewing-clamp");
      } else {
        App.storage.expandedClamps.add(clamp.id);
        if (page) page.classList.add("viewing-clamp");
      }
      App.components.renderClamps();
      var card = document.querySelector('[data-clamp-id="' + clamp.id + '"]');
      card && card.scrollIntoView({ behavior: "smooth", block: "start" });
      return;
    }
    if (action === "edit-clamp") {
      var editClamp = state.clamps.find(function(c) { return c.id === id; });
      if (!editClamp) return;
      showEditClampModal(editClamp);
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
    if (action === "edit-tree") {
      var editClamp = state.clamps.find(function(c) { return c.id === btn.dataset.clampId; });
      if (!editClamp) return;
      var editTree = (editClamp.trees || []).find(function(t) { return t.id === btn.dataset.treeId; });
      if (!editTree) return;
      showEditTreeModal(editClamp, editTree);
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

  function showEditTreeModal(clamp, tree) {
    var modal = document.getElementById("clamp-modal");
    var modalTitle = document.getElementById("modal-title");
    var modalBody = document.getElementById("modal-body");
    if (!modal || !modalTitle || !modalBody) return;

    var state = App.storage.state;
    var speciesOptions = (function() {
      var opts = [];
      var existingIds = (state.species || []).map(function(s) { return s.tvlId; });
      (state.species || []).slice().sort(function(a, b) { return a.name.localeCompare(b.name, "id"); }).forEach(function(item) {
        opts.push({ value: item.id, label: item.name, selected: item.id === tree.speciesId });
      });
      Object.values(state.tvls || {}).forEach(function(tvl) {
        if (existingIds.indexOf(tvl.id) !== -1) return;
        opts.push({ value: tvl.id, label: tvl.species || tvl.name || tvl.id, selected: tvl.id === tree.speciesId });
      });
      opts.sort(function(a, b) { return a.label.localeCompare(b.label, "id"); });
      return opts.map(function(o) {
        return '<option value="' + U.escapeHtml(o.value) + '"' + (o.selected ? ' selected' : '') + '>' + U.escapeHtml(o.label) + '</option>';
      }).join("");
    })();

    modalTitle.textContent = "Edit Pohon " + tree.treeNumber;
    modalBody.innerHTML = '<form id="edit-tree-form" class="form-grid">' +
      '<label class="field full"><span>No. Pohon</span><input id="edit-tree-number" type="text" required maxlength="60" value="' + U.escapeHtml(tree.treeNumber) + '" readonly></label>' +
      '<label class="field full"><span>Jenis Pohon</span><select id="edit-tree-species" required>' + speciesOptions + '</select></label>' +
      '<label class="field full"><span>Keliling (cm)</span><input id="edit-tree-circumference" type="number" min="0" step="0.1" required value="' + tree.circumference + '"></label>' +
      '<label class="field full"><span>Keterangan</span><textarea id="edit-tree-note" maxlength="500">' + U.escapeHtml(tree.note || "") + '</textarea></label>' +
      '<input type="hidden" id="edit-tree-clamp-id" value="' + clamp.id + '">' +
      '<input type="hidden" id="edit-tree-id" value="' + tree.id + '">' +
      '<button class="btn btn-primary full" type="submit">Simpan</button>' +
      '</form>';

    modal.classList.add("open");
    modal.setAttribute("aria-hidden", "false");
    document.getElementById("edit-tree-form").addEventListener("submit", handleEditTreeSubmit);
  }

  function handleEditTreeSubmit(e) {
    e.preventDefault();
    var state = App.storage.state;
    var clampId = document.getElementById("edit-tree-clamp-id") && document.getElementById("edit-tree-clamp-id").value;
    var treeId = document.getElementById("edit-tree-id") && document.getElementById("edit-tree-id").value;
    var clamp = state.clamps.find(function(c) { return c.id === clampId; });
    if (!clamp) return;
    var tree = (clamp.trees || []).find(function(t) { return t.id === treeId; });
    if (!tree) return;

    var newSpeciesId = (document.getElementById("edit-tree-species") && document.getElementById("edit-tree-species").value || "").trim();
    var newCircumference = Number(document.getElementById("edit-tree-circumference") && document.getElementById("edit-tree-circumference").value);
    var newTreeNumber = (document.getElementById("edit-tree-number") && document.getElementById("edit-tree-number").value || "").trim();
    var newNote = (document.getElementById("edit-tree-note") && document.getElementById("edit-tree-note").value || "").trim();

    if (!newSpeciesId || !newTreeNumber) {
      App.components.showToast("Lengkapi data pohon.");
      return;
    }
    if (!Number.isFinite(newCircumference) || newCircumference <= 0) {
      App.components.showToast("Masukkan keliling yang valid.");
      return;
    }

    if ((clamp.trees || []).some(function(t) { return t.id !== treeId && t.treeNumber.toLowerCase() === newTreeNumber.toLowerCase(); })) {
      App.components.showToast("Nomor pohon sudah digunakan.");
      return;
    }

    var lookup = App.tvl && App.tvl.lookupVolume(newSpeciesId, newCircumference);
    var sp = App.storage.getSpecies(newSpeciesId);
    var tvl = sp ? state.tvls[sp.tvlId] : (state.tvls[newSpeciesId] || null);
    var tvlId = (sp && sp.tvlId) || (tvl ? newSpeciesId : null);
    var isBerkhout = tvl && tvl.model === "berkhout";

    tree.treeNumber = newTreeNumber;
    tree.speciesId = newSpeciesId;
    tree.circumference = newCircumference;
    tree.tvlId = tvlId;
    tree.note = newNote;

    if (lookup) {
      tree.volume = lookup.volume;
      tree.diameter = lookup.diameter;
      tree.height = lookup.height;
      tree.tvlCircumference = isBerkhout ? newCircumference : lookup.matchedCircumference;
      tree.volumeUpdatedAt = new Date().toISOString();
    }

    App.storage.saveState();
    App.components.closeModal();
    App.components.renderClamps();
    App.components.renderRecap();
    App.components.showToast("Data pohon berhasil diperbarui.");
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
    var state = App.storage.state;

    if (!speciesId) {
      App.components.showToast("Pilih jenis pohon.");
      return;
    }
    if (!Number.isFinite(circumference) || circumference <= 0) {
      App.components.showToast("Masukkan keliling yang valid.");
      return;
    }
    if (!lookup) {
      App.components.showToast("TVL tidak ditemukan untuk jenis pohon ini.");
      return;
    }

    // ================================================================
    // LOGIKA PENOMORAN POHON (SKHP)
    //
    //   Aturan:
    //   1. Blok sama + Jenis sama     → sequential (1, 2, 3...)
    //   2. Blok sama + Jenis berbeda → mulai dari (no terakhir blok tersebut) + 1
    //   3. Blok berbeda              → lanjut dari no terakhir blok sebelumnya (tidak reset)
    // ================================================================

    var sp = App.storage.getSpecies(speciesId);
    var tvl = sp ? state.tvls && state.tvls[sp.tvlId] : state.tvls && state.tvls[speciesId];
    var speciesName = sp ? sp.name : (tvl ? (tvl.species || tvl.name || "KAYU") : "KAYU");

    // Ambil semua pohon dari SEMUA clamp
    var allTrees = (state.clamps || []).reduce(function(acc, c) {
      return acc.concat((c.trees || []).map(function(t) {
        return { treeNumber: t.treeNumber, speciesId: t.speciesId, block: c.block, clampId: c.id };
      }));
    }, []);

    // Helper: parse nomor pohon jadi integer
    function parseTreeNum(n) {
      var x = parseInt(n, 10);
      return isNaN(x) ? 0 : x;
    }

    // Helper: dapat daftar pohon di blok tertentu
    function getTreesInBlock(block) {
      return allTrees.filter(function(t) { return t.block === block; });
    }

    // Helper: dapat pohon terakhir dari species tertentu dalam blok tertentu
    function getLastTreeOfSpeciesInBlock(block, sid) {
      var trees = getTreesInBlock(block).filter(function(t) { return t.speciesId === sid; });
      if (!trees.length) return null;
      return trees.reduce(function(prev, curr) {
        return parseTreeNum(prev.treeNumber) >= parseTreeNum(curr.treeNumber) ? prev : curr;
      });
    }

    // Helper: dapat pohon terakhir DI BLOK tersebut (apapun speciesnya)
    function getLastTreeInBlock(block) {
      var trees = getTreesInBlock(block);
      if (!trees.length) return null;
      return trees.reduce(function(prev, curr) {
        return parseTreeNum(prev.treeNumber) >= parseTreeNum(curr.treeNumber) ? prev : curr;
      });
    }

    // Helper: dapat blok-blok yang sudah ada dalam urutan (berdasarkan clamp creation atau
    // gunakan kolom block dan urutkan alfabet)
    var usedBlocks = [];
    (state.clamps || []).forEach(function(c) {
      if (usedBlocks.indexOf(c.block) === -1) usedBlocks.push(c.block);
    });

    // Tentukan tree number baru berdasarkan aturan
    var currentBlock = clamp.block;
    var prevTreeOfSameSpecies = getLastTreeOfSpeciesInBlock(currentBlock, speciesId);
    var lastTreeInBlock = getLastTreeInBlock(currentBlock);
    var treeNumber;

    if (prevTreeOfSameSpecies) {
      // ATURAN 1: Blok sama + Jenis sama → sequential
      treeNumber = String(parseTreeNum(prevTreeOfSameSpecies.treeNumber) + 1);
    } else if (lastTreeInBlock) {
      // ATURAN 2: Blok sama + Jenis berbeda → mulai dari N+1 blok tersebut
      treeNumber = String(parseTreeNum(lastTreeInBlock.treeNumber) + 1);
    } else {
      // Blok belum punya pohon sama sekali → cek blok sebelumnya
      var currentBlockIdx = usedBlocks.indexOf(currentBlock);
      var foundPrevBlock = false;
      for (var i = currentBlockIdx - 1; i >= 0; i--) {
        var prevBlock = usedBlocks[i];
        var prevBlockLast = getLastTreeInBlock(prevBlock);
        if (prevBlockLast) {
          // ATURAN 3: Blok berbeda → lanjut dari no terakhir blok sebelumnya
          treeNumber = String(parseTreeNum(prevBlockLast.treeNumber) + 1);
          foundPrevBlock = true;
          break;
        }
      }
      if (!foundPrevBlock) {
        // Benar-benar blok baru pertama
        treeNumber = "1";
      }
    }

    var tvlId = (sp && sp.tvlId) || (tvl ? speciesId : null);
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

  function bindRecap() {
    var el = App.components.el;
    el("export-btn") && el("export-btn").addEventListener("click", function() {
      App.components.exportRecapCsv();
      App.components.showToast("Rekap Excel berhasil dibuat.");
    });
  }

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
      var cleared = App.storage.clearAllDataExceptTvl();
      if (cleared) {
        bindClampForm();
        App.storage.clampPage = 1;
        App.components.renderAll();
        App.components.switchPage("trees", false);
        App.components.showToast("Semua data berhasil dihapus. TVL tetap tersimpan.");
      }
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
    bindGlobal: bindGlobal,
    updateTreeNumberPreview: updateTreeNumberPreview
  };

  global.App = App;
})(window);
