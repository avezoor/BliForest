"use strict";

window.addEventListener("DOMContentLoaded", init);

function init() {
  
  App.components.cacheElements();

  
  App.storage.initState();

  
  App.handlers.bindNav();
  App.handlers.bindSidebar();
  App.handlers.bindTree();
  
  App.handlers.bindClampEvents();
  App.handlers.bindRecap();
  App.handlers.bindMaster();
  App.handlers.bindGlobal();

  
  App.bkph.loadBkphRphData().then(function() {
    App.handlers.bindClampForm();
  });

  
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

      
      App.components.renderAll();
      App.pwa.updateConnectivity();

      
      App.pwa.initPwa();
      App.pwa.registerServiceWorker();
      App.pwa.requestPersistentStorage();
      App.pwa.updateInstallButton();

      
      var savedPage = localStorage.getItem(window.STORAGE_PAGE_KEY);
      if (savedPage && ["trees", "clamps", "recap", "master", "about"].indexOf(savedPage) !== -1) {
        App.components.switchPage(savedPage, false);
      } else {
        App.components.switchPage("clamps", false);
      }

      
      var el = App.components.el;
      el("install-btn") && el("install-btn").addEventListener("click", App.pwa.installApp);
      el("refresh-all-btn") && el("refresh-all-btn").addEventListener("click", App.pwa.refreshApplication);
      el("update-tvl-btn") && el("update-tvl-btn").addEventListener("click", function() {
        App.pwa.syncWhenOnline({ showToast: true, button: el("update-tvl-btn"), reason: "manual-tvl" });
      });

      
      App.pwa.syncWhenOnline({ showToast: false, reason: "startup" });
    }, remaining);
  });
}
