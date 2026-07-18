"use strict";

// ============================================================
// PWA Module — instalasi, konektivitas, dan sinkronisasi otomatis
// ============================================================

(function(global) {
  var App = global.App || {};
  var deferredInstallPrompt = null;
  var syncInProgress = false;
  var onlineHandlerBound = false;

  function updateConnectivity(syncing) {
    var dot = document.getElementById("online-dot");
    var label = document.getElementById("online-label");
    var online = navigator.onLine;

    if (dot) dot.classList.toggle("online", online);
    if (!label) return;

    if (!online) {
      label.textContent = "Mode Offline • data lokal";
    } else if (syncing || syncInProgress) {
      label.textContent = "Online • menyinkronkan";
    } else {
      label.textContent = "Mode Online • data tersimpan";
    }
  }

  function isStandalone() {
    return global.matchMedia("(display-mode: standalone)").matches || global.navigator.standalone === true;
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
    navigator.storage.persist().catch(function(error) {
      console.warn("Penyimpanan persisten tidak dapat diminta:", error);
    });
  }

  function registerServiceWorker() {
    if (!("serviceWorker" in navigator) || !/^https?:$/.test(location.protocol)) return;

    var hadController = !!navigator.serviceWorker.controller;
    var reloading = false;
    navigator.serviceWorker.addEventListener("controllerchange", function() {
      // Service worker lama benar-benar diganti oleh versi aplikasi baru.
      if (!hadController || reloading) return;
      reloading = true;
      global.location.reload();
    });

    navigator.serviceWorker.register("./sw.js", { updateViaCache: "none" })
      .then(function(registration) {
        registration.update().catch(function() {});
      })
      .catch(function(error) {
        console.warn("Service worker gagal didaftarkan:", error);
      });
  }

  function refreshRenderedData() {
    if (App.components && typeof App.components.renderAll === "function") App.components.renderAll();
    if (App.components && typeof App.components.updateTvlSyncStatus === "function") App.components.updateTvlSyncStatus();
  }

  function syncWhenOnline(options) {
    options = options || {};
    var showToast = !!options.showToast;
    var button = options.button || null;

    if (!navigator.onLine) {
      updateConnectivity(false);
      refreshRenderedData();
      if (showToast) App.components.showToast("Perangkat offline. Aplikasi memakai data yang tersimpan di perangkat.");
      return Promise.resolve({ offline: true, changedTvlIds: [] });
    }

    if (syncInProgress) return Promise.resolve({ pending: true, changedTvlIds: [] });

    syncInProgress = true;
    updateConnectivity(true);

    return App.tvl.refreshTvls({ button: button }).then(function(result) {
      refreshRenderedData();
      updateConnectivity(false);

      var changed = result && result.changedTvlIds ? result.changedTvlIds.length : 0;
      if (showToast) {
        if (changed) {
          App.components.showToast("Sinkronisasi selesai: " + changed + " TVL diperbarui dan disimpan untuk mode offline.");
        } else {
          App.components.showToast("Sinkronisasi selesai. Data lokal sudah menggunakan versi terbaru.");
        }
      } else if (changed) {
        App.components.showToast(changed + " TVL baru telah diperbarui dan disimpan secara lokal.");
      }
      return result;
    }).catch(function(error) {
      refreshRenderedData();
      updateConnectivity(false);
      if (showToast) {
        App.components.showToast("Server tidak dapat dijangkau. Data lokal tetap digunakan.");
      }
      console.warn("Sinkronisasi otomatis gagal; memakai data lokal:", error);
      return { error: error, changedTvlIds: [], localFallback: true };
    }).finally(function() {
      syncInProgress = false;
      updateConnectivity(false);
    });
  }

  function initPwa() {
    global.addEventListener("beforeinstallprompt", function(event) {
      event.preventDefault();
      deferredInstallPrompt = event;
      updateInstallButton();
    });

    global.addEventListener("appinstalled", function() {
      deferredInstallPrompt = null;
      updateInstallButton();
      App.components.showToast("Aplikasi berhasil dipasang di perangkat.");
    });

    if (!onlineHandlerBound) {
      onlineHandlerBound = true;
      global.addEventListener("online", function() {
        updateConnectivity(true);
        syncWhenOnline({ showToast: false, reason: "reconnect" });
      });
      global.addEventListener("offline", function() {
        updateConnectivity(false);
        App.components.showToast("Koneksi terputus. Aplikasi beralih ke data lokal.");
      });
    }

    updateConnectivity(false);
  }

  function refreshApplication() {
    var button = document.getElementById("refresh-all-btn");
    return syncWhenOnline({ showToast: true, button: button, reason: "manual" });
  }

  App.pwa = {
    initPwa: initPwa,
    updateConnectivity: updateConnectivity,
    isStandalone: isStandalone,
    updateInstallButton: updateInstallButton,
    installApp: installApp,
    requestPersistentStorage: requestPersistentStorage,
    registerServiceWorker: registerServiceWorker,
    refreshApplication: refreshApplication,
    syncWhenOnline: syncWhenOnline
  };

  global.App = App;
})(window);
