"use strict";

// ============================================================
// Shared Utility Functions
// ============================================================

(function(global) {
  // ---- Escape HTML ----
  function escapeHtml(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  // ---- Safe structured clone ----
  function structuredCloneSafe(value) {
    if (typeof structuredClone === "function") return structuredClone(value);
    return JSON.parse(JSON.stringify(value));
  }

  // ---- Format number with Indonesian locale ----
  function formatNumber(value, digits) {
    digits = digits === undefined ? 2 : digits;
    return new Intl.NumberFormat("id-ID", {
      minimumFractionDigits: digits,
      maximumFractionDigits: digits
    }).format(Number(value) || 0);
  }

  // ---- Format date short ----
  function formatDateShort(value) {
    if (!value) return "-";
    var date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return new Intl.DateTimeFormat("id-ID", {
      day: "2-digit", month: "long", year: "numeric"
    }).format(date);
  }

  // ---- Format datetime ----
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

  // ---- Format updated badge ----
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

  // ---- Format TVL sync badge ----
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

  // ---- Date stamp YYYY-MM-DD ----
  function dateStamp() {
    var d = new Date();
    return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate());
  }

  function pad(n) { return String(n).padStart(2, "0"); }

  // ---- Unique ID ----
  function createId(prefix) {
    var random = window.crypto && window.crypto.randomUUID
      ? window.crypto.randomUUID()
      : Date.now() + "-" + Math.random().toString(16).slice(2);
    return prefix + "-" + random;
  }

  // ---- Sum ----
  function sum(items, getter) {
    return items.reduce(function(total, item) {
      return total + Number(getter(item) || 0);
    }, 0);
  }

  // ---- Download blob ----
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

  // ---- CSV cell ----
  function csvCell(value) {
    return '"' + String(value ?? "").replace(/"/g, '""') + '"';
  }

  // ---- Empty state HTML ----
  function emptyState(title, description) {
    return '<div class="empty-state"><strong>' + escapeHtml(title) + '</strong>' + escapeHtml(description) + '</div>';
  }

  // ---- Icons ----
  function eyeIcon() {
    return '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6Z" fill="none" stroke="currentColor" stroke-width="1.8"/><circle cx="12" cy="12" r="2.7" fill="none" stroke="currentColor" stroke-width="1.8"/></svg>';
  }

  function downloadIcon() {
    return '<svg viewBox="0 0 24 24" aria-hidden="true" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4m4-5l5 5 5-5m-5 5V3"/></svg>';
  }

  function trashIcon() {
    return '<svg viewBox="0 0 24 24" aria-hidden="true" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>';
  }

  // ---- Excel HTML ----
  function dataToExcel(data) {
    var headers = data[0];
    var rows = data.slice(1);
    var headerHtml = headers.map(function(h) { return "<th>" + escapeHtml(String(h)) + "</th>"; }).join("");
    var rowsHtml = rows.map(function(row) {
      return "<tr>" + row.map(function(cell) {
        return "<td>" + escapeHtml(String(cell ?? "")) + "</td>";
      }).join("") + "</tr>";
    }).join("");
    return '<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">' +
      '<head><meta charset="utf-8"><style>td,th{border:1px solid #d0d0d0;padding:6px 10px;font-size:12px}th{background:#125e3d;color:#fff;font-weight:bold}</style></head>' +
      '<body><table><thead><tr>' + headerHtml + '</tr></thead><tbody>' + rowsHtml + '</tbody></table></body></html>';
  }

  // Export to global
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
    csvCell: csvCell,
    emptyState: emptyState,
    eyeIcon: eyeIcon,
    downloadIcon: downloadIcon,
    trashIcon: trashIcon,
    dataToExcel: dataToExcel
  };
})(window);
