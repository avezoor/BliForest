"use strict";

// ============================================================
// PWA Module — install prompt & connectivity
// ============================================================

(function(global) {
  var App = global.App || {};
  var deferredInstallPrompt = null;

  function updateConnectivity() {
    var dot = document.getElementById("online-dot");
    var label = document.getElementById("online-label");
    var online = navigator.onLine;
    if (dot) dot.classList.toggle("online", online);
    if (label) label.textContent = online ? "Mode Online" : "Mode Offline";
  }

  function isStandalone() {
    return window.matchMedia("(display-mode: standalone)").matches || window.navigator.standalone === true;
  }

  function updateInstallButton() {
    var btn = document.getElementById("install-btn");
    if (!btn) return;
    if (isStandalone()) {
      btn.textContent = "Aplikasi Terpasang";
      btn.disabled = true;
    } else {
      btn.textContent = deferredInstallPrompt ? "Pasang Aplikasi" : "Petunjuk Pemasangan";
      btn.disabled = false;
    }
  }

  function installApp() {
    if (isStandalone()) {
      App.components.showToast("Aplikasi sudah terpasang pada perangkat.");
      return;
    }
    if (deferredInstallPrompt) {
      deferredInstallPrompt.prompt();
      deferredInstallPrompt.userChoice.then(function() {
        deferredInstallPrompt = null;
        updateInstallButton();
      });
      return;
    }
    App.components.showToast('Di Chrome Android, buka menu ⋮ lalu pilih "Instal aplikasi" atau "Tambahkan ke layar utama".');
  }

  function requestPersistentStorage() {
    if (!navigator.storage || !navigator.storage.persist) return;
    navigator.storage.persist().catch(function(e) { console.warn("Penyimpanan persisten tidak dapat diminta:", e); });
  }

  function registerServiceWorker() {
    if (!("serviceWorker" in navigator) || !/^https?:$/.test(location.protocol)) return;
    var reloading = false;
    navigator.serviceWorker.addEventListener("controllerchange", function() {
      if (reloading) return;
      reloading = true;
      window.location.reload();
    });
    navigator.serviceWorker.register("./sw.js").catch(function(e) { console.warn("Service worker gagal didaftarkan:", e); });
  }

  function initPwa() {
    window.addEventListener("beforeinstallprompt", function(e) {
      e.preventDefault();
      deferredInstallPrompt = e;
      updateInstallButton();
    });
    window.addEventListener("appinstalled", function() {
      deferredInstallPrompt = null;
      updateInstallButton();
      App.components.showToast("Aplikasi berhasil dipasang di perangkat.");
    });
    window.addEventListener("online", updateConnectivity);
    window.addEventListener("offline", updateConnectivity);
  }

  function refreshApplication() {
    var btn = document.getElementById("refresh-all-btn");
    var original = btn && btn.textContent;
    if (btn) { btn.disabled = true; btn.textContent = navigator.onLine ? "Menyinkronkan…" : "Menyegarkan…"; }

    if (navigator.onLine) {
      App.tvl.refreshTvls({ showResultToast: false }).then(function(result) {
        App.components.updateTvlSyncStatus();
        updateConnectivity();
        if (result && result.changedTvlIds && result.changedTvlIds.length) {
          App.components.showToast("Sinkronisasi selesai: " + result.changedTvlIds.length + " TVL berubah dan " + (result.calculation && result.calculation.scanned || 0) + " pohon dihitung ulang.");
        } else {
          App.components.showToast("Sinkronisasi selesai. Data lokal dan TVL sudah terbaru.");
        }
      }).catch(function(err) {
        App.components.showToast("Sinkronisasi gagal: " + (err.message || "Error tidak diketahui"));
      }).finally(function() {
        if (btn) { btn.disabled = false; btn.textContent = original; }
      });
    } else {
      App.storage.state = App.storage.loadState();
      App.tvl.loadBuiltinTvls().then(function() {
        var bundled = App.tvl.bundledTvls();
        var changed = App.tvl.replaceTvls(bundled);
        App.storage.state.tvlSync.managedIds = Array.from(new Set(
          (App.storage.state.tvlSync && App.storage.state.tvlSync.managedIds || []).concat(Object.keys(bundled))
        ));
        App.tvl.recalculateTreeVolumes(changed.length ? changed : Object.keys(App.storage.state.tvls));
        App.storage.saveState();
        App.components.updateTvlSyncStatus();
        updateConnectivity();
        var msg = changed.length ? " " + changed.length + " TVL bawaan diperbarui;" : "";
        App.components.showToast("Mode offline disegarkan." + msg);
      }).catch(function() {
        App.components.showToast("Server tidak dapat dijangkau. Aplikasi disegarkan dari data lokal.");
      }).finally(function() {
        if (btn) { btn.disabled = false; btn.textContent = original; }
      });
    }
  }

  App.pwa = {
    initPwa: initPwa,
    updateConnectivity: updateConnectivity,
    isStandalone: isStandalone,
    updateInstallButton: updateInstallButton,
    installApp: installApp,
    requestPersistentStorage: requestPersistentStorage,
    registerServiceWorker: registerServiceWorker,
    refreshApplication: refreshApplication
  };

  global.App = App;
})(window);
