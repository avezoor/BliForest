"use strict";

// ============================================================
// BliForest — Main Entry Point
// ============================================================

window.addEventListener("DOMContentLoaded", init);

function init() {
  // 1. Cache DOM elements
  App.components.cacheElements();

  // 2. Initialize state from localStorage
  App.storage.initState();

  // 3. Bind all events
  App.handlers.bindNav();
  App.handlers.bindSidebar();
  App.handlers.bindTree();
  App.handlers.bindClampForm();
  App.handlers.bindClampEvents();
  App.handlers.bindRecap();
  App.handlers.bindMaster();
  App.handlers.bindGlobal();

  // 4. Load BKPH/RPH data
  App.bkph.loadBkphRphData().then(function() {
    App.handlers.bindClampForm();
  });

  // 5. Load TVL data
  App.tvl.loadBuiltinTvls().then(function() {
    // Hide loading overlay
    var loader = document.getElementById("app-loader");
    if (loader) {
      loader.classList.add("hidden");
      setTimeout(function() { loader.style.display = "none"; }, 450);
    }

    // 6. Initial render
    App.components.renderAll();
    App.pwa.updateConnectivity();

    // 7. PWA
    App.pwa.initPwa();
    App.pwa.registerServiceWorker();
    App.pwa.requestPersistentStorage();
    App.pwa.updateInstallButton();

    // 8. Restore last active page
    var savedPage = localStorage.getItem(window.STORAGE_PAGE_KEY);
    if (savedPage && ["trees", "clamps", "recap", "master", "about"].indexOf(savedPage) !== -1) {
      App.components.switchPage(savedPage, false);
    }

    // 9. Bind PWA buttons
    var el = App.components.el;
    el("install-btn") && el("install-btn").addEventListener("click", App.pwa.installApp);
    el("refresh-all-btn") && el("refresh-all-btn").addEventListener("click", App.pwa.refreshApplication);
    el("update-tvl-btn") && el("update-tvl-btn").addEventListener("click", function() {
      App.tvl.refreshTvls({ showResultToast: false }).then(function(result) {
        App.components.updateTvlSyncStatus();
        if (result && result.changedTvlIds && result.changedTvlIds.length) {
          App.components.showToast(result.changedTvlIds.length + " TVL diperbarui; " + (result.calculation && result.calculation.scanned || 0) + " data pohon dihitung ulang.");
        } else {
          App.components.showToast("TVL sudah menggunakan versi terbaru.");
        }
      }).catch(function(err) {
        App.components.showToast(err.message || "TVL gagal diperbarui.");
      });
    });
  });
}
