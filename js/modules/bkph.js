"use strict";

// ============================================================
// BKPH / RPH Data Module
// ============================================================

(function(global) {
  var App = global.App || {};

  function isValidBkphData(value) {
    if (!value || typeof value !== "object" || Array.isArray(value)) return false;
    return Object.entries(value).every(function(entry) {
      var bkph = entry[0], rph = entry[1];
      return typeof bkph === "string" && bkph.trim() &&
        Array.isArray(rph) && rph.length > 0 &&
        rph.every(function(item) { return typeof item === "string" && item.trim(); });
    });
  }

  function loadBkphRphData() {
    var bundled = window.KLEM_KAYU_BKPH_DATA;
    var clone = global.Utils ? global.Utils.structuredCloneSafe : function(v) {
      return JSON.parse(JSON.stringify(v));
    };
    var data = isValidBkphData(bundled) ? clone(bundled) : {};

    // If offline, skip network fetch entirely (bundled data is primary source)
    if (!navigator.onLine) {
      Object.assign(App.storage.bkphData, data);
      return Promise.resolve();
    }

    return fetch("data/bkph.json?t=" + Date.now(), { cache: "no-store" })
      .then(function(r) { if (!r.ok) throw new Error("HTTP " + r.status); return r.json(); })
      .then(function(fetched) {
        if (isValidBkphData(fetched)) Object.assign(data, fetched);
      })
      .catch(function(e) { console.warn("BKPH/RPH JSON tidak dapat dimuat:", e); })
      .then(function() { Object.assign(App.storage.bkphData, data); });
  }

  function renderBkphSelect(select) {
    var keys = Object.keys(App.storage.bkphData).sort(function(a, b) { return a.localeCompare(b, "id"); });
    renderSelect(select, keys, "Pilih BKPH");
  }

  function renderRphSelect(select, bkphValue) {
    var options = bkphValue && Array.isArray(App.storage.bkphData[bkphValue])
      ? App.storage.bkphData[bkphValue].slice().sort(function(a, b) { return a.localeCompare(b, "id"); })
      : [];
    renderSelect(select, options, bkphValue ? "Pilih RPH" : "Pilih BKPH terlebih dahulu");
    select.disabled = !bkphValue;
  }

  function renderSelect(select, options, placeholder) {
    var current = select.value;
    var html = '<option value="">' + (global.Utils ? global.Utils.escapeHtml(placeholder) : placeholder) + '</option>';
    for (var i = 0; i < options.length; i++) {
      html += '<option value="' + (global.Utils ? global.Utils.escapeHtml(options[i]) : options[i]) + '">' +
        (global.Utils ? global.Utils.escapeHtml(options[i]) : options[i]) + '</option>';
    }
    select.innerHTML = html;
    if (current && options.indexOf(current) !== -1) select.value = current;
  }

  App.bkph = {
    loadBkphRphData: loadBkphRphData,
    renderBkphSelect: renderBkphSelect,
    renderRphSelect: renderRphSelect
  };

  global.App = App;
})(window);
