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
  var loadStart = Date.now();
  App.tvl.loadBuiltinTvls().then(function() {
    var elapsed = Date.now() - loadStart;
    var minDisplay = 1500;
    var remaining = Math.max(0, minDisplay - elapsed);
    setTimeout(function() {
      var loader = document.getElementById("app-loader");
      if (loader) {
        loader.classList.add("hidden");
        setTimeout(function() { loader.style.display = "none"; }, 500);
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
        App.pwa.syncWhenOnline({ showToast: true, button: el("update-tvl-btn"), reason: "manual-tvl" });
      });

      // 10. Cek GitHub di belakang layar
      App.pwa.syncWhenOnline({ showToast: false, reason: "startup" });
    }, remaining);
  });
}
