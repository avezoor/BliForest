"use strict";

(function(global) {
  function escapeHtml(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }
  function structuredCloneSafe(value) {
    if (typeof structuredClone === "function") return structuredClone(value);
    return JSON.parse(JSON.stringify(value));
  }
  function formatNumber(value, digits) {
    digits = digits === undefined ? 2 : digits;
    return new Intl.NumberFormat("id-ID", {
      minimumFractionDigits: digits,
      maximumFractionDigits: digits
    }).format(Number(value) || 0);
  }
  function formatDateShort(value) {
    if (!value) return "-";
    var date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return new Intl.DateTimeFormat("id-ID", {
      day: "2-digit", month: "long", year: "numeric"
    }).format(date);
  }
  function formatDateTime(value) {
    var date = new Date(value);
    if (Number.isNaN(date.getTime())) return "-";
    var tz = "Asia/Jakarta";
    return Intl.DateTimeFormat("id-ID", {
      dateStyle: "medium", timeStyle: "short", timeZone: tz
    }).format(date) + " " + getIndonesianTimeZoneLabel(tz);
  }

  function getIndonesianTimeZoneLabel(tz) {
    if (tz === "Asia/Jakarta") return "WIB";
    if (tz === "Asia/Makassar") return "WITA";
    if (tz === "Asia/Jayapura") return "WIT";
    var offset = new Date().getTimezoneOffset() * -1;
    if (offset === 420) return "WIB";
    if (offset === 480) return "WITA";
    if (offset === 540) return "WIT";
    return "WIB";
  }
  function formatUpdatedBadge(value) {
    if (!value) return "-";
    var date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    var datePart = Intl.DateTimeFormat("id-ID", {
      day: "2-digit", month: "short", year: "numeric", timeZone: "Asia/Jakarta"
    }).format(date);
    var timePart = Intl.DateTimeFormat("id-ID", {
      hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "Asia/Jakarta"
    }).format(date).replace(":", ".");
    return "Terakhir Diperbarui " + datePart + ", " + timePart + " WIB";
  }
  function formatTvlSyncBadge(value) {
    if (!value) return "-";
    var date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    var datePart = Intl.DateTimeFormat("id-ID", {
      day: "2-digit", month: "short", year: "numeric", timeZone: "Asia/Jakarta"
    }).format(date);
    var timePart = Intl.DateTimeFormat("id-ID", {
      hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "Asia/Jakarta"
    }).format(date).replace(":", ".");
    return "Terakhir Diperbarui " + datePart + ", " + timePart + " WIB.";
  }
  function dateStamp() {
    var d = new Date();
    return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate());
  }

  function pad(n) { return String(n).padStart(2, "0"); }
  function createId(prefix) {
    var random = window.crypto && window.crypto.randomUUID
      ? window.crypto.randomUUID()
      : Date.now() + "-" + Math.random().toString(16).slice(2);
    return prefix + "-" + random;
  }
  function sum(items, getter) {
    return items.reduce(function(total, item) {
      return total + Number(getter(item) || 0);
    }, 0);
  }
  function downloadBlob(content, filename, type) {
    var blob = content instanceof Blob ? content : new Blob([content], { type: type });
    var url = URL.createObjectURL(blob);
    var anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = filename;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    setTimeout(function() { URL.revokeObjectURL(url); }, 1000);
  }

  function emptyState(title, description) {
    return '<div class="empty-state"><strong>' + escapeHtml(title) + '</strong>' + escapeHtml(description) + '</div>';
  }
  function eyeIcon() {
    return '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6Z" fill="none" stroke="currentColor" stroke-width="1.8"/><circle cx="12" cy="12" r="2.7" fill="none" stroke="currentColor" stroke-width="1.8"/></svg>';
  }

  function downloadIcon() {
    return '<svg viewBox="0 0 24 24" aria-hidden="true" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4m4-5l5 5 5-5m-5 5V3"/></svg>';
  }

  function trashIcon() {
    return '<svg viewBox="0 0 24 24" aria-hidden="true" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>';
  }

  function editIcon() {
    return '<svg viewBox="0 0 24 24" aria-hidden="true" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>';
  }
  global.Utils = {
    escapeHtml: escapeHtml,
    structuredCloneSafe: structuredCloneSafe,
    formatNumber: formatNumber,
    formatDateShort: formatDateShort,
    formatDateTime: formatDateTime,
    formatUpdatedBadge: formatUpdatedBadge,
    formatTvlSyncBadge: formatTvlSyncBadge,
    dateStamp: dateStamp,
    createId: createId,
    sum: sum,
    downloadBlob: downloadBlob,
    emptyState: emptyState,
    eyeIcon: eyeIcon,
    downloadIcon: downloadIcon,
    trashIcon: trashIcon,
    editIcon: editIcon
  };
})(window);
