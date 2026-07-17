"use strict";

// ============================================================
// UI Components / Rendering Module
// ============================================================

(function(global) {
  var App = global.App || {};
  var U = global.Utils || {};
  var CLAMPS_PER_PAGE = global.CLAMPS_PER_PAGE || 10;

  // ---- Element cache ----
  var _el = null;

  function cacheElements() {
    var ids = [
      "toast", "sidebar", "sidebar-overlay", "sidebar-open", "sidebar-close",
      "page-kicker", "page-title", "tree-form", "tree-name", "tvl-select",
      "tvl-preview-title", "tvl-count", "tvl-preview-body", "tree-count", "tree-list",
      "clamp-form", "clamp-bkph", "clamp-rph", "clamp-species", "clamp-block",
      "clamp-block-area", "clamp-compartment", "clamp-standard-area", "clamp-cut-area",
      "clamp-forest-class", "clamp-planting-year", "clamp-count", "clamp-list",
      "summary-cards", "recap-body", "clamp-search-form", "clamp-search",
      "clamp-search-btn", "clamp-search-clear", "export-btn", "online-dot",
      "online-label", "install-btn", "backup-btn", "restore-btn", "restore-file",
      "update-tvl-btn", "tvl-sync-info", "refresh-all-btn",
      "master-species-count", "master-clamps-count", "master-trees-count",
      "clear-all-btn", "about-version", "about-date", "about-tvl-check",
      "about-developer", "clamp-modal", "modal-title", "modal-body", "modal-close"
    ];
    _el = {};
    ids.forEach(function(id) { _el[id] = document.getElementById(id); });
  }

  function el(id) { return _el && _el[id]; }

  // ---- Toast ----
  var _toastTimer = null;
  function showToast(message) {
    if (!_el || !_el.toast) return;
    clearTimeout(_toastTimer);
    _el.toast.textContent = message;
    _el.toast.classList.add("show");
    _toastTimer = setTimeout(function() { _el.toast.classList.remove("show"); }, 3200);
  }

  // ---- Page / Navigation ----
  function switchPage(page, save) {
    save = save !== false;
    var meta = global.PAGE_META;
    if (!meta || !meta[page]) return;
    if (save) localStorage.setItem(global.STORAGE_PAGE_KEY, page);

    document.querySelectorAll(".nav-item").forEach(function(btn) {
      btn.classList.toggle("active", btn.dataset.page === page);
    });
    document.querySelectorAll(".page").forEach(function(sec) {
      sec.classList.toggle("active-page", sec.id === "page-" + page);
    });

    _el["page-kicker"].textContent = meta[page].kicker;
    _el["page-title"].textContent = meta[page].title;

    if (page === "trees") {
      renderTvlSelect();
      renderSpecies();
    } else if (page === "clamps") {
      App.handlers.bindClampForm();
      renderClamps();
    } else if (page === "recap") {
      renderRecap();
    } else if (page === "master") {
      renderMasterData();
    } else if (page === "about") {
      renderAbout();
    }

    closeSidebar();
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  // ---- Sidebar ----
  function openSidebar() {
    _el.sidebar && _el.sidebar.classList.add("open");
    _el["sidebar-overlay"] && _el["sidebar-overlay"].classList.add("open");
  }
  function closeSidebar() {
    _el.sidebar && _el.sidebar.classList.remove("open");
    _el["sidebar-overlay"] && _el["sidebar-overlay"].classList.remove("open");
  }

  // ---- Modal ----
  function closeModal() {
    App.storage.expandedClamps.clear();
    renderClamps();
  }

  // ---- Trees page ----
  function renderTvlSelect(preferredId) {
    var state = App.storage.state;
    var current = preferredId || (_el["tvl-select"] && _el["tvl-select"].value) || "";
    var tvls = Object.values(state.tvls || {}).sort(function(a, b) { return a.name.localeCompare(b.name, "id"); });
    if (!_el["tvl-select"]) return;
    _el["tvl-select"].innerHTML = tvls.length
      ? tvls.map(function(t) { return '<option value="' + U.escapeHtml(t.id) + '">' + U.escapeHtml(t.name) + '</option>'; }).join("")
      : '<option value="">TVL belum tersedia</option>';
    if (current && state.tvls[current]) _el["tvl-select"].value = current;
  }

  function renderSpecies() {
    var state = App.storage.state;
    if (!_el["tree-count"] || !_el["tree-list"]) return;
    _el["tree-count"].textContent = state.species.length + " jenis";
    if (!state.species.length) {
      _el["tree-list"].innerHTML = U.emptyState("Belum ada jenis kayu", "Tambahkan nama pohon dan hubungkan dengan TVL.");
      return;
    }
    _el["tree-list"].innerHTML = state.species.map(function(item) {
      var tvl = state.tvls && state.tvls[item.tvlId];
      var used = state.clamps && state.clamps.some(function(c) {
        return c.speciesId === item.id || (c.trees && c.trees.some(function(t) { return t.speciesId === item.id; }));
      });
      var isBerkhout = tvl && tvl.model === "berkhout";
      return '<article class="tree-card">' +
        '<div class="tree-card-head">' +
          '<div><h4>' + U.escapeHtml(item.name) + '</h4>' +
          '<p>' + U.escapeHtml(tvl && tvl.name || "TVL tidak ditemukan") + '</p></div>' +
          '<button class="small-action" type="button" data-action="delete-species" data-id="' + item.id + '"' +
            (used ? ' disabled' : '') + ' title="' + (used ? "Jenis digunakan dalam daftar klem" : "Hapus jenis") + '">' +
            '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">' +
            '<path d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>' +
          '</button>' +
        '</div>' +
        '<div class="tree-meta">' +
          '<span class="meta-pill">' + (isBerkhout ? "Berkhout" : (tvl && tvl.entries && tvl.entries.length || 0) + " baris") + '</span>' +
          (tvl && tvl.version ? '<span class="meta-pill">Versi ' + U.escapeHtml(tvl.version) + '</span>' : '') +
          '<span class="meta-pill">Keliling cm</span><span class="meta-pill">Diameter cm</span><span class="meta-pill">Tinggi m</span><span class="meta-pill">Volume m³</span>' +
        '</div>' +
      '</article>';
    }).join("");
  }

  // ---- Species options HTML ----
  function speciesOptionsHtml(selectedId) {
    var state = App.storage.state;
    return (state.species || []).slice()
      .sort(function(a, b) { return a.name.localeCompare(b.name, "id"); })
      .map(function(item) {
        return '<option value="' + item.id + '"' + (item.id === selectedId ? ' selected' : '') + '>' +
          U.escapeHtml(item.name) + '</option>';
      }).join("");
  }

  // ---- Clamp species select ----
  function renderClampSpeciesSelect() {
    if (!_el["clamp-species"]) return;
    var current = _el["clamp-species"].value;
    _el["clamp-species"].innerHTML = '<option value="">Pilih jenis kayu</option>' + speciesOptionsHtml(current);
    if (current && App.storage.state.species.some(function(s) { return s.id === current; })) {
      _el["clamp-species"].value = current;
    }
  }

  // ---- Clamp cards ----
  function renderClamps() {
    var state = App.storage.state;
    var query = App.storage.clampSearchQuery;
    var filtered = query
      ? state.clamps.filter(function(c) { return App.storage.matchesClampSearch(c, query); })
      : state.clamps;

    var totalPages = Math.max(1, Math.ceil(filtered.length / CLAMPS_PER_PAGE));
    var safePage = Math.min(Math.max(1, App.storage.clampPage), totalPages);
    var start = (safePage - 1) * CLAMPS_PER_PAGE;
    var paged = filtered.slice(start, start + CLAMPS_PER_PAGE);

    if (_el["clamp-count"]) {
      _el["clamp-count"].textContent = query
        ? filtered.length + " dari " + state.clamps.length + " daftar"
        : state.clamps.length + " daftar";
    }
    if (!_el["clamp-list"]) return;

    if (!state.clamps.length) {
      _el["clamp-list"].innerHTML = U.emptyState("Belum ada daftar klem", "Isi informasi blok, petak, dan jenis kayu utama untuk membuat daftar.");
      return;
    }
    if (!filtered.length) {
      _el["clamp-list"].innerHTML = U.emptyState("Tidak ada hasil", 'Tidak ada daftar klem yang cocok dengan pencarian "' + U.escapeHtml(query) + '".');
      return;
    }
    _el["clamp-list"].innerHTML = paged.map(function(clamp) { return renderClampCard(clamp); }).join("") +
      (filtered.length > CLAMPS_PER_PAGE ? renderClampPagination(safePage, totalPages) : "");
    Array.prototype.slice.call(document.querySelectorAll(".tree-entry-form")).forEach(updateVolumeForForm);
  }

  function renderClampPagination(curPage, totalPages) {
    return '<div class="pagination clamp-pagination">' +
      '<button type="button" class="page-btn" data-action="clamp-prev"' + (curPage <= 1 ? ' disabled' : '') + '>' +
        '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><path d="M15 18l-6-6 6-6"/></svg>' +
      '</button>' +
      '<span class="page-info">Halaman ' + curPage + ' dari ' + totalPages + '</span>' +
      '<button type="button" class="page-btn" data-action="clamp-next"' + (curPage >= totalPages ? ' disabled' : '') + '>' +
        '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 18l6-6-6-6"/></svg>' +
      '</button>' +
    '</div>';
  }

  function renderClampCard(clamp) {
    var state = App.storage.state;
    var species = App.storage.getSpecies(clamp.speciesId);
    var totalVol = U.sum(clamp.trees || [], function(t) { return t.volume; });
    var expanded = App.storage.expandedClamps.has(clamp.id);
    var treeSq = App.storage.getTreeSearch(clamp.id);
    var filteredTrees = App.storage.filterTrees(clamp.trees || [], treeSq);
    var curPage = App.storage.getTreePage(clamp.id);
    var totalPages = Math.max(1, Math.ceil(filteredTrees.length / TREES_PER_PAGE));
    var safePage = Math.min(Math.max(1, curPage), totalPages);
    var start = (safePage - 1) * TREES_PER_PAGE;
    var paged = filteredTrees.slice(start, start + TREES_PER_PAGE);

    return '<article class="clamp-card' + (expanded ? " expanded" : "") + '" data-clamp-id="' + clamp.id + '">' +
      '<div class="clamp-summary">' +
        '<div><h4>' + U.escapeHtml(clamp.code) + '</h4>' +
        '<p>Blok ' + U.escapeHtml(clamp.block) + ' · Petak ' + U.escapeHtml(clamp.compartment) + ' · ' + U.escapeHtml(clamp.forestClass) + '</p></div>' +
        '<div class="summary-item"><span>BKPH / RPH</span><strong>' + U.escapeHtml(clamp.bkph) + ' / ' + U.escapeHtml(clamp.rph) + '</strong></div>' +
        '<div class="summary-item"><span>Jenis utama</span><strong>' + U.escapeHtml(species && species.name || "-") + '</strong></div>' +
        '<div class="summary-item"><span>Tahun Tanam</span><strong>' + (clamp.plantingYear || "-") + '</strong></div>' +
        '<div class="summary-item"><span>Hasil</span><strong>' + (clamp.trees && clamp.trees.length || 0) + ' batang · ' + U.formatNumber(totalVol, 4) + ' m3</strong></div>' +
        '<div class="clamp-actions">' +
          '<button class="eye-btn" type="button" data-action="toggle-clamp" data-id="' + clamp.id + '" aria-label="Lihat detail">' + U.eyeIcon() + '</button>' +
          '<button class="export-clamp-btn" type="button" data-action="export-clamp" data-id="' + clamp.id + '" aria-label="Ekspor">' + U.downloadIcon() + '</button>' +
          '<button class="trash-btn" type="button" data-action="delete-clamp" data-id="' + clamp.id + '" aria-label="Hapus">' + U.trashIcon() + '</button>' +
        '</div>' +
      '</div>' +
      (expanded ? '<div class="clamp-detail">' +
        '<div class="clamp-detail-meta">' +
          '<span><b>Blok:</b> ' + U.escapeHtml(clamp.block) + '</span>' +
          '<span><b>Petak:</b> ' + U.escapeHtml(clamp.compartment) + '</span>' +
          '<span><b>Kelas:</b> ' + U.escapeHtml(clamp.forestClass) + '</span>' +
          '<span><b>BKPH/RPH:</b> ' + U.escapeHtml(clamp.bkph) + ' / ' + U.escapeHtml(clamp.rph) + '</span>' +
          '<span><b>Jenis:</b> ' + U.escapeHtml(species && species.name || "-") + '</span>' +
          '<span><b>Luas Baku:</b> ' + U.formatNumber(clamp.standardArea, 2) + ' ha</span>' +
          '<span><b>Luas Tebangan:</b> ' + U.formatNumber(clamp.cutArea, 2) + ' ha</span>' +
          '<span><b>Tahun Tanam:</b> ' + (clamp.plantingYear || "-") + '</span>' +
        '</div>' +
        '<h5 class="detail-title">Tambah Data Pohon</h5>' +
        '<form class="tree-entry-form" data-clamp-id="' + clamp.id + '">' +
          '<label class="field"><span>No. Pohon</span><input name="treeNumber" type="text" required maxlength="60" placeholder="Contoh: J-001"></label>' +
          '<label class="field"><span>Jenis Kayu</span><select name="speciesId" required>' + speciesOptionsHtml(clamp.speciesId) + '</select></label>' +
          '<label class="field"><span>Keliling (cm)</span><input name="circumference" type="number" min="0" step="0.1" required placeholder="0"></label>' +
          '<label class="field"><span>Diameter (cm)</span><input name="diameter" type="text" readonly value="0,00"></label>' +
          '<label class="field"><span>Tinggi (m)</span><input name="height" type="text" readonly value="0,00"></label>' +
          '<label class="field"><span>Volume (m3)</span><input name="volume" type="text" readonly value="0,0000"></label>' +
          '<label class="field"><span>Keterangan</span><textarea name="note" maxlength="500" placeholder="Keterangan"></textarea></label>' +
          '<button class="plus-btn" type="submit" aria-label="Tambahkan pohon">' +
            '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>' +
          '</button>' +
          '<div class="volume-help" data-role="volume-help">Masukkan keliling untuk menghitung volume.</div>' +
        '</form>' +
        '<div class="table-wrap detail-table">' +
          '<div class="tree-search-bar">' +
            '<input type="text" class="tree-search-input" placeholder="Cari pohon…" value="' + U.escapeHtml(treeSq) + '" data-action="tree-search" data-clamp-id="' + clamp.id + '">' +
            '<button type="button" class="tree-search-btn" data-action="tree-do-search" data-clamp-id="' + clamp.id + '" title="Cari">' +
              '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>' +
            '</button>' +
            (treeSq ? '<button type="button" class="tree-search-clear" data-action="tree-clear-search" data-clamp-id="' + clamp.id + '" title="Hapus pencarian">✕</button>' : '') +
            '<span class="tree-search-count">' + (treeSq ? filteredTrees.length + " dari " + (clamp.trees && clamp.trees.length || 0) + " data" : (clamp.trees && clamp.trees.length || 0) + " data") + '</span>' +
          '</div>' +
          '<table>' +
            '<thead><tr><th>No Pohon</th><th>Jenis</th><th>Keliling (cm)</th><th>Diameter (cm)</th><th>Tinggi (m)</th><th>Volume (m3)</th><th>Keterangan</th><th>Aksi</th></tr></thead>' +
            '<tbody>' +
              (paged.length ? paged.map(function(t) { return renderTreeRow(clamp, t); }).join("") :
                '<tr><td colspan="8" class="muted">' + (treeSq ? 'Tidak ada pohon yang cocok dengan "' + U.escapeHtml(treeSq) + '".' : "Belum ada data pohon pada daftar ini.") + '</td></tr>') +
            '</tbody>' +
          '</table>' +
          (filteredTrees.length > TREES_PER_PAGE ? '<div class="pagination">' +
            '<button type="button" class="page-btn" data-action="tree-prev" data-clamp-id="' + clamp.id + '"' + (safePage <= 1 ? ' disabled' : '') + '>' +
              '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><path d="M15 18l-6-6 6-6"/></svg>' +
            '</button>' +
            '<span class="page-info">Halaman ' + safePage + ' dari ' + totalPages + '</span>' +
            '<button type="button" class="page-btn" data-action="tree-next" data-clamp-id="' + clamp.id + '"' + (safePage >= totalPages ? ' disabled' : '') + '>' +
              '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 18l6-6-6-6"/></svg>' +
            '</button>' +
          '</div>' : '') +
        '</div>' +
      '</div>' : '') +
    '</article>';
  }

  function renderTreeRow(clamp, tree) {
    var species = App.storage.getSpecies(tree.speciesId);
    return '<tr>' +
      '<td><strong>' + U.escapeHtml(tree.treeNumber) + '</strong></td>' +
      '<td>' + U.escapeHtml(species && species.name || "-") + '</td>' +
      '<td class="numeric">' + U.formatNumber(tree.circumference, 2) + '</td>' +
      '<td class="numeric">' + U.formatNumber(tree.diameter || 0, 2) + '</td>' +
      '<td class="numeric">' + U.formatNumber(tree.height || 0, 2) + '</td>' +
      '<td class="numeric">' + U.formatNumber(tree.volume, 4) + '</td>' +
      '<td>' + U.escapeHtml(tree.note || "-") + '</td>' +
      '<td><button class="row-delete" type="button" data-action="delete-tree" data-clamp-id="' + clamp.id + '" data-tree-id="' + tree.id + '">' +
        '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>' +
      '</button></td>' +
    '</tr>';
  }

  function updateVolumeForForm(form) {
    var speciesId = form.elements && form.elements.speciesId && form.elements.speciesId.value;
    var circumference = Number(form.elements && form.elements.circumference && form.elements.circumference.value);
    var volInput = form.elements && form.elements.volume;
    var diameterInput = form.elements && form.elements.diameter;
    var heightInput = form.elements && form.elements.height;
    var help = form.querySelector && form.querySelector('[data-role="volume-help"]');
    if (!volInput || !help) return;
    var lookup = App.tvl && App.tvl.lookupVolume(speciesId, circumference);
    if (!lookup) {
      volInput.value = "0,0000";
      if (diameterInput) diameterInput.value = "0,00";
      if (heightInput) heightInput.value = "0,00";
      help.textContent = "Masukkan keliling untuk menghitung volume.";
      return;
    }
    volInput.value = U.formatNumber(lookup.volume, 4);
    if (diameterInput) diameterInput.value = U.formatNumber(lookup.diameter, 2);
    if (heightInput) heightInput.value = U.formatNumber(lookup.height, 2);
    help.textContent = "";
  }

  // ---- Recap ----
  function renderRecap() {
    var state = App.storage.state;
    if (!_el["summary-cards"] || !_el["recap-body"]) return;
    var totalTrees = U.sum(state.clamps || [], function(c) { return (c.trees || []).length; });
    var totalVol = U.sum(state.clamps || [], function(c) { return U.sum(c.trees || [], function(t) { return t.volume; }); });
    var circumfs = state.clamps && state.clamps.reduce ? state.clamps.reduce(function(acc, c) {
      return acc.concat((c.trees || []).map(function(t) { return Number(t.circumference); }));
    }, []) : [];
    var diameters = state.clamps && state.clamps.reduce ? state.clamps.reduce(function(acc, c) {
      return acc.concat((c.trees || []).map(function(t) { return Number(t.diameter || 0); }));
    }, []) : [];
    var heights = state.clamps && state.clamps.reduce ? state.clamps.reduce(function(acc, c) {
      return acc.concat((c.trees || []).map(function(t) { return Number(t.height || 0); }));
    }, []) : [];
    var avgCirc = circumfs.length ? U.sum(circumfs, function(v) { return v; }) / circumfs.length : 0;
    var avgDiam = diameters.length ? U.sum(diameters, function(v) { return v; }) / diameters.length : 0;
    var avgHeight = heights.length ? U.sum(heights, function(v) { return v; }) / heights.length : 0;

    _el["summary-cards"].innerHTML = [
      ["Daftar Klem", state.clamps && state.clamps.length || 0, "Daftar Tersimpan"],
      ["Jumlah Batang", totalTrees, "Seluruh Daftar"],
      ["Rata-rata Keliling", U.formatNumber(avgCirc, 2) + " cm", "Seluruh Batang"],
      ["Rata-rata Diameter", U.formatNumber(avgDiam, 2) + " cm", "Seluruh Batang"],
      ["Rata-rata Tinggi", U.formatNumber(avgHeight, 2) + " m", "Seluruh Batang"],
      ["Total Volume", U.formatNumber(totalVol, 4) + " m³", "Seluruh Daftar"]
    ].map(function(row) {
      return '<article class="summary-card"><span>' + row[0] + '</span><strong>' + row[1] + '</strong><small>' + row[2] + '</small></article>';
    }).join("");

    if (!state.clamps || !state.clamps.length) {
      _el["recap-body"].innerHTML = '<tr><td colspan="9" class="muted">Belum ada daftar klem untuk direkap.</td></tr>';
      return;
    }
    _el["recap-body"].innerHTML = state.clamps.map(function(clamp) {
      var trees = clamp.trees || [];
      var avgCirc = trees.length ? U.sum(trees, function(t) { return t.circumference; }) / trees.length : 0;
      var avgDiam = trees.length ? U.sum(trees, function(t) { return t.diameter || 0; }) / trees.length : 0;
      var avgHeight = trees.length ? U.sum(trees, function(t) { return t.height || 0; }) / trees.length : 0;
      var tot = U.sum(trees, function(t) { return t.volume; });
      var sp = App.storage.getSpecies(clamp.speciesId);
      return '<tr>' +
        '<td><strong>' + U.escapeHtml(clamp.code) + '</strong><br><span class="muted">Blok ' + U.escapeHtml(clamp.block) + ' · Petak ' + U.escapeHtml(clamp.compartment) + '</span></td>' +
        '<td>' + U.escapeHtml(clamp.bkph) + ' / ' + U.escapeHtml(clamp.rph) + '</td>' +
        '<td>' + U.escapeHtml(sp && sp.name || "-") + '</td>' +
        '<td>' + (clamp.plantingYear || "-") + '</td>' +
        '<td class="numeric">' + U.formatNumber(avgCirc, 2) + ' cm</td>' +
        '<td class="numeric">' + U.formatNumber(avgDiam, 2) + ' cm</td>' +
        '<td class="numeric">' + U.formatNumber(avgHeight, 2) + ' m</td>' +
        '<td class="numeric">' + (trees.length || 0) + '</td>' +
        '<td class="numeric">' + U.formatNumber(tot, 4) + ' m³</td>' +
      '</tr>';
    }).join("");
  }

  // ---- Master data ----
  function renderMasterData() {
    var state = App.storage.state;
    var totalTrees = U.sum(state.clamps || [], function(c) { return (c.trees || []).length; });
    if (_el["master-species-count"]) _el["master-species-count"].textContent = state.species && state.species.length || 0;
    if (_el["master-clamps-count"]) _el["master-clamps-count"].textContent = state.clamps && state.clamps.length || 0;
    if (_el["master-trees-count"]) _el["master-trees-count"].textContent = totalTrees;
  }

  // ---- About ----
  function renderAbout() {
    var sync = App.storage.state && App.storage.state.tvlSync || {};
    if (_el["about-version"]) _el["about-version"].textContent = global.APP_VERSION || "1.1.1";
    if (_el["about-date"]) _el["about-date"].textContent = U.formatUpdatedBadge(global.APP_UPDATED_AT || "");
    if (_el["about-tvl-check"]) _el["about-tvl-check"].textContent = sync.lastCheckedAt ? U.formatDateTime(sync.lastCheckedAt) : "Belum pernah";
  }

  // ---- TVL sync status ----
  function updateTvlSyncStatus() {
    if (!_el["tvl-sync-info"]) return;
    var sync = App.storage.state && App.storage.state.tvlSync || {};
    _el["tvl-sync-info"].textContent = sync.lastCheckedAt ? U.formatTvlSyncBadge(sync.lastCheckedAt) : "Belum pernah memeriksa pembaruan TVL.";
  }

  // ---- Export ----
  function exportClampCsv(clampId) {
    var state = App.storage.state;
    var clamp = (state.clamps || []).find(function(c) { return c.id === clampId; });
    if (!clamp || !(clamp.trees && clamp.trees.length)) return;
    var data = [["No Pohon", "Jenis", "Keliling (cm)", "Diameter (cm)", "Tinggi (m)", "Volume (m3)", "Keterangan"]];
    clamp.trees.forEach(function(t) {
      var sp = App.storage.getSpecies(t.speciesId);
      data.push([t.treeNumber, (sp && sp.name) || "", Number(t.circumference).toFixed(2), Number(t.diameter || 0).toFixed(2), Number(t.height || 0).toFixed(2), Number(t.volume).toFixed(4), t.note || ""]);
    });
    var safeCode = (clamp.code || "daftar-klem").replace(/[^a-z0-9_-]+/gi, "-");
    U.downloadBlob(U.dataToExcel(data), safeCode + "-data-pohon-" + U.dateStamp() + ".xls", "application/vnd.ms-excel;charset=utf-8");
  }

  function exportRecapCsv() {
    var state = App.storage.state;
    if (!state.clamps || !state.clamps.length) return;
    var data = [["Daftar Klem", "BKPH", "RPH", "Blok", "Petak", "Jenis Utama", "Tahun Tanam", "Rata-rata Keliling (cm)", "Rata-rata Diameter (cm)", "Rata-rata Tinggi (m)", "Jumlah Batang", "Total Volume (m3)"]];
    state.clamps.forEach(function(clamp) {
      var trees = clamp.trees || [];
      var avgCirc = trees.length ? U.sum(trees, function(t) { return t.circumference; }) / trees.length : 0;
      var avgDiam = trees.length ? U.sum(trees, function(t) { return t.diameter || 0; }) / trees.length : 0;
      var avgHeight = trees.length ? U.sum(trees, function(t) { return t.height || 0; }) / trees.length : 0;
      var sp = App.storage.getSpecies(clamp.speciesId);
      data.push([clamp.code, clamp.bkph, clamp.rph, clamp.block, clamp.compartment,
        (sp && sp.name) || "", clamp.plantingYear || "",
        avgCirc.toFixed(2), avgDiam.toFixed(2), avgHeight.toFixed(2),
        trees.length || 0,
        U.sum(trees, function(t) { return t.volume; }).toFixed(4)
      ]);
    });
    U.downloadBlob(U.dataToExcel(data), "rekap-klem-" + U.dateStamp() + ".xls", "application/vnd.ms-excel;charset=utf-8");
  }

  // ---- Full render ----
  function renderAll() {
    renderTvlSelect();
    renderSpecies();
    renderClampSpeciesSelect();
    renderClamps();
    renderRecap();
    renderMasterData();
    renderAbout();
    updateTvlSyncStatus();
  }

  App.components = {
    cacheElements: cacheElements,
    el: el,
    showToast: showToast,
    switchPage: switchPage,
    openSidebar: openSidebar,
    closeSidebar: closeSidebar,
    closeModal: closeModal,
    renderTvlSelect: renderTvlSelect,
    renderSpecies: renderSpecies,
    renderClampSpeciesSelect: renderClampSpeciesSelect,
    renderClamps: renderClamps,
    renderClampCard: renderClampCard,
    renderTreeRow: renderTreeRow,
    updateVolumeForForm: updateVolumeForForm,
    speciesOptionsHtml: speciesOptionsHtml,
    renderRecap: renderRecap,
    renderMasterData: renderMasterData,
    renderAbout: renderAbout,
    updateTvlSyncStatus: updateTvlSyncStatus,
    exportClampCsv: exportClampCsv,
    exportRecapCsv: exportRecapCsv,
    renderAll: renderAll
  };

  global.App = App;
})(window);
