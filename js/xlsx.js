(function(global) {
  "use strict";

  var MIME_XLSX = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
  var MIME_CSV = "text/csv;charset=utf-8";

  function xmlEscape(value) {
    return String(value == null ? "" : value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&apos;");
  }

  function utf8Bytes(text) {
    if (global.TextEncoder) return new TextEncoder().encode(String(text));
    var encoded = unescape(encodeURIComponent(String(text)));
    var out = new Uint8Array(encoded.length);
    for (var i = 0; i < encoded.length; i += 1) out[i] = encoded.charCodeAt(i);
    return out;
  }

  function concatBytes(parts) {
    var total = parts.reduce(function(sum, part) { return sum + part.length; }, 0);
    var out = new Uint8Array(total);
    var offset = 0;
    parts.forEach(function(part) {
      out.set(part, offset);
      offset += part.length;
    });
    return out;
  }

  function le16(value) {
    return new Uint8Array([value & 255, (value >>> 8) & 255]);
  }

  function le32(value) {
    return new Uint8Array([
      value & 255,
      (value >>> 8) & 255,
      (value >>> 16) & 255,
      (value >>> 24) & 255
    ]);
  }

  var CRC_TABLE = (function() {
    var table = new Uint32Array(256);
    for (var n = 0; n < 256; n += 1) {
      var c = n;
      for (var k = 0; k < 8; k += 1) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
      table[n] = c >>> 0;
    }
    return table;
  })();

  function crc32(bytes) {
    var crc = 0xFFFFFFFF;
    for (var i = 0; i < bytes.length; i += 1) crc = CRC_TABLE[(crc ^ bytes[i]) & 255] ^ (crc >>> 8);
    return (crc ^ 0xFFFFFFFF) >>> 0;
  }

  function dosDateTime(date) {
    var d = date || new Date();
    var year = Math.max(1980, d.getFullYear());
    return {
      time: ((d.getHours() & 31) << 11) | ((d.getMinutes() & 63) << 5) | ((Math.floor(d.getSeconds() / 2)) & 31),
      date: (((year - 1980) & 127) << 9) | (((d.getMonth() + 1) & 15) << 5) | (d.getDate() & 31)
    };
  }

  function zipStore(files) {
    var localParts = [];
    var centralParts = [];
    var offset = 0;
    var stamp = dosDateTime(new Date());

    files.forEach(function(file) {
      var name = utf8Bytes(file.name);
      var data = file.data instanceof Uint8Array ? file.data : utf8Bytes(file.data);
      var crc = crc32(data);
      var flags = 0x0800;

      var local = concatBytes([
        le32(0x04034B50), le16(20), le16(flags), le16(0), le16(stamp.time), le16(stamp.date),
        le32(crc), le32(data.length), le32(data.length), le16(name.length), le16(0), name, data
      ]);
      localParts.push(local);

      var central = concatBytes([
        le32(0x02014B50), le16(20), le16(20), le16(flags), le16(0), le16(stamp.time), le16(stamp.date),
        le32(crc), le32(data.length), le32(data.length), le16(name.length), le16(0), le16(0),
        le16(0), le16(0), le32(0), le32(offset), name
      ]);
      centralParts.push(central);
      offset += local.length;
    });

    var central = concatBytes(centralParts);
    var end = concatBytes([
      le32(0x06054B50), le16(0), le16(0), le16(files.length), le16(files.length),
      le32(central.length), le32(offset), le16(0)
    ]);

    return concatBytes(localParts.concat([central, end]));
  }

  function columnName(index) {
    var name = "";
    var n = index + 1;
    while (n > 0) {
      var rem = (n - 1) % 26;
      name = String.fromCharCode(65 + rem) + name;
      n = Math.floor((n - 1) / 26);
    }
    return name;
  }

  function cellXml(value, rowIndex, colIndex, styleIndex) {
    var ref = columnName(colIndex) + rowIndex;
    var style = styleIndex ? ' s="' + styleIndex + '"' : "";
    if (typeof value === "number" && isFinite(value)) {
      return '<c r="' + ref + '"' + style + '><v>' + value + '</v></c>';
    }
    if (typeof value === "boolean") {
      return '<c r="' + ref + '" t="b"' + style + '><v>' + (value ? 1 : 0) + '</v></c>';
    }
    var text = String(value == null ? "" : value);
    if (!text) return '<c r="' + ref + '"' + style + '/>';
    return '<c r="' + ref + '" t="inlineStr"' + style + '><is><t xml:space="preserve">' + xmlEscape(text) + '</t></is></c>';
  }

  function worksheetXml(data, options) {
    options = options || {};
    var headerRows = options.headerRows || [];
    var labelRows = options.labelRows || [];
    var maxCols = Math.max(1, data.reduce(function(max, row) { return Math.max(max, (row || []).length); }, 0));
    var maxRows = Math.max(1, data.length);
    var dimension = "A1:" + columnName(maxCols - 1) + maxRows;

    var cols = "";
    if (options.widths && options.widths.length) {
      cols = "<cols>" + options.widths.map(function(width, i) {
        return '<col min="' + (i + 1) + '" max="' + (i + 1) + '" width="' + Number(width || 12) + '" customWidth="1"/>';
      }).join("") + "</cols>";
    }

    var rows = data.map(function(row, rowZero) {
      var rowNumber = rowZero + 1;
      var rowStyle = headerRows.indexOf(rowNumber) !== -1 ? 1 : 0;
      var cells = (row || []).map(function(value, colIndex) {
        var styleIndex = rowStyle;
        if (!styleIndex && labelRows.indexOf(rowNumber) !== -1 && colIndex === 0) styleIndex = 2;
        return cellXml(value, rowNumber, colIndex, styleIndex);
      }).join("");
      return '<row r="' + rowNumber + '">' + cells + '</row>';
    }).join("");

    return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">' +
      '<dimension ref="' + dimension + '"/><sheetViews><sheetView workbookViewId="0"/></sheetViews><sheetFormatPr defaultRowHeight="15"/>' +
      cols + '<sheetData>' + rows + '</sheetData></worksheet>';
  }

  function workbookFiles(data, options) {
    options = options || {};
    var sheetName = xmlEscape((options.sheetName || "Data").slice(0, 31));
    var now = new Date().toISOString();

    var contentTypes = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
      '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
      '<Default Extension="xml" ContentType="application/xml"/>' +
      '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>' +
      '<Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>' +
      '<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>' +
      '<Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>' +
      '<Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/>' +
      '</Types>';

    var rootRels = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
      '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>' +
      '<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/>' +
      '<Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/>' +
      '</Relationships>';

    var workbook = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">' +
      '<bookViews><workbookView/></bookViews><sheets><sheet name="' + sheetName + '" sheetId="1" r:id="rId1"/></sheets><calcPr calcId="191029"/></workbook>';

    var workbookRels = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
      '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>' +
      '<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>' +
      '</Relationships>';

    var styles = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' +
      '<fonts count="2"><font><sz val="11"/><name val="Calibri"/><family val="2"/></font><font><b/><color rgb="FFFFFFFF"/><sz val="11"/><name val="Calibri"/><family val="2"/></font></fonts>' +
      '<fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FF125E3D"/><bgColor indexed="64"/></patternFill></fill></fills>' +
      '<borders count="2"><border><left/><right/><top/><bottom/><diagonal/></border><border><left style="thin"><color rgb="FFD0D0D0"/></left><right style="thin"><color rgb="FFD0D0D0"/></right><top style="thin"><color rgb="FFD0D0D0"/></top><bottom style="thin"><color rgb="FFD0D0D0"/></bottom><diagonal/></border></borders>' +
      '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>' +
      '<cellXfs count="3"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="2" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center" wrapText="1"/></xf><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0" applyFont="1"><alignment horizontal="left"/></xf></cellXfs>' +
      '<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>';

    var core = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:dcmitype="http://purl.org/dc/dcmitype/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">' +
      '<dc:creator>BliForest</dc:creator><cp:lastModifiedBy>BliForest</cp:lastModifiedBy><dcterms:created xsi:type="dcterms:W3CDTF">' + now + '</dcterms:created><dcterms:modified xsi:type="dcterms:W3CDTF">' + now + '</dcterms:modified></cp:coreProperties>';

    var app = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties" xmlns:vt="http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes"><Application>BliForest</Application><AppVersion>1.5.4</AppVersion></Properties>';

    return [
      { name: "[Content_Types].xml", data: contentTypes },
      { name: "_rels/.rels", data: rootRels },
      { name: "docProps/core.xml", data: core },
      { name: "docProps/app.xml", data: app },
      { name: "xl/workbook.xml", data: workbook },
      { name: "xl/_rels/workbook.xml.rels", data: workbookRels },
      { name: "xl/styles.xml", data: styles },
      { name: "xl/worksheets/sheet1.xml", data: worksheetXml(data, options) }
    ];
  }

  function xlsxBlob(data, options) {
    var bytes = zipStore(workbookFiles(data, options));
    return new Blob([bytes], { type: MIME_XLSX });
  }

  function csvText(data, delimiter) {
    delimiter = delimiter || ";";
    return data.map(function(row) {
      return (row || []).map(function(cell) {
        var value = String(cell == null ? "" : cell);
        if (value.indexOf('"') !== -1) value = value.replace(/"/g, '""');
        return /["\r\n;,]/.test(value) ? '"' + value + '"' : value;
      }).join(delimiter);
    }).join("\r\n");
  }

  function csvBlob(data) {
    return new Blob(["\uFEFF", csvText(data, ";")], { type: MIME_CSV });
  }

  function replaceExtension(filename, extension) {
    return String(filename || "export").replace(/\.[^.]+$/, "") + extension;
  }

  function download(data, filename, options) {
    try {
      var blob = xlsxBlob(data, options || {});
      global.Utils.downloadBlob(blob, replaceExtension(filename, ".xlsx"), MIME_XLSX);
      return { ok: true, format: "xlsx" };
    } catch (error) {
      console.error("XLSX export failed; falling back to CSV.", error);
      global.Utils.downloadBlob(csvBlob(data), replaceExtension(filename, ".csv"), MIME_CSV);
      return { ok: true, format: "csv", fallback: true };
    }
  }

  global.ExcelExport = {
    xlsxBlob: xlsxBlob,
    csvBlob: csvBlob,
    download: download
  };
})(window);
