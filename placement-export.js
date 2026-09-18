/* A small XLSX writer for the two placement report sheets. ZIP entries are stored uncompressed. */
(function () {
  "use strict";
  var encoder = new TextEncoder();
  function xml(value) {
    return String(value == null ? "" : value).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&apos;");
  }
  function column(index) {
    var label = "";
    for (index += 1; index; index = Math.floor((index - 1) / 26)) label = String.fromCharCode(65 + (index - 1) % 26) + label;
    return label;
  }
  function sheet(rows) {
    return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews><sheetData>' + rows.map(function (row,r) {
      return '<row r="' + (r + 1) + '">' + row.map(function (value,c) {
        var ref = column(c) + (r + 1);
        if (value === "" || value == null) return '<c r="' + ref + '"/>';
        if (typeof value === "number" && Number.isFinite(value)) return '<c r="' + ref + '"' + (r === 0 ? ' s="1"' : '') + '><v>' + value + '</v></c>';
        return '<c r="' + ref + '" t="inlineStr"' + (r === 0 ? ' s="1"' : '') + '><is><t xml:space="preserve">' + xml(value) + '</t></is></c>';
      }).join("") + '</row>';
    }).join("") + '</sheetData></worksheet>';
  }
  var crcTable = Array.from({length:256},function (_,i) {
    for (var j=0;j<8;j++) i = i & 1 ? 0xedb88320 ^ (i >>> 1) : i >>> 1;
    return i >>> 0;
  });
  function crc32(data) {
    var crc = -1;
    for (var i=0;i<data.length;i++) crc = crcTable[(crc ^ data[i]) & 255] ^ (crc >>> 8);
    return (crc ^ -1) >>> 0;
  }
  function zip(files) {
    var chunks = [], central = [], offset = 0, centralLength = 0;
    files.forEach(function (file) {
      var name = encoder.encode(file[0]), data = encoder.encode(file[1]), crc = crc32(data);
      var local = new Uint8Array(30 + name.length), lv = new DataView(local.buffer);
      lv.setUint32(0,0x04034b50,true); lv.setUint16(4,20,true); lv.setUint16(6,0x800,true);
      lv.setUint32(14,crc,true); lv.setUint32(18,data.length,true); lv.setUint32(22,data.length,true); lv.setUint16(26,name.length,true);
      local.set(name,30); chunks.push(local,data);
      var entry = new Uint8Array(46 + name.length), ev = new DataView(entry.buffer);
      ev.setUint32(0,0x02014b50,true); ev.setUint16(4,20,true); ev.setUint16(6,20,true); ev.setUint16(8,0x800,true);
      ev.setUint32(16,crc,true); ev.setUint32(20,data.length,true); ev.setUint32(24,data.length,true);
      ev.setUint16(28,name.length,true); ev.setUint32(42,offset,true); entry.set(name,46);
      central.push(entry); centralLength += entry.length; offset += local.length + data.length;
    });
    var end = new Uint8Array(22), view = new DataView(end.buffer);
    view.setUint32(0,0x06054b50,true); view.setUint16(8,files.length,true); view.setUint16(10,files.length,true);
    view.setUint32(12,centralLength,true); view.setUint32(16,offset,true);
    return new Blob(chunks.concat(central,end),{type:"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"});
  }
  function workbook(sheets) {
    var types = '<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>' + sheets.map(function (_,i) { return '<Override PartName="/xl/worksheets/sheet' + (i+1) + '.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>'; }).join("") + '</Types>';
    var files = [
      ["[Content_Types].xml",types],
      ["_rels/.rels",'<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>'],
      ["xl/workbook.xml",'<?xml version="1.0" encoding="UTF-8"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>' + sheets.map(function (entry,i) { return '<sheet name="' + xml(entry[0]) + '" sheetId="' + (i+1) + '" r:id="rId' + (i+1) + '"/>'; }).join("") + '</sheets></workbook>'],
      ["xl/_rels/workbook.xml.rels",'<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' + sheets.map(function (_,i) { return '<Relationship Id="rId' + (i+1) + '" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet' + (i+1) + '.xml"/>'; }).join("") + '<Relationship Id="rId' + (sheets.length+1) + '" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>'],
      ["xl/styles.xml",'<?xml version="1.0" encoding="UTF-8"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><fonts count="2"><font/><font><b/></font></fonts><fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills><borders count="1"><border/></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="2"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0"/></cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>']
    ];
    sheets.forEach(function (entry,i) { files.push(["xl/worksheets/sheet" + (i+1) + ".xml",sheet(entry[1])]); });
    return zip(files);
  }
  window.downloadPlacementXlsx = function (sheets,filename) {
    var url = URL.createObjectURL(workbook(sheets)), link = document.createElement("a");
    link.href = url; link.download = filename; document.body.appendChild(link); link.click(); link.remove();
    setTimeout(function () { URL.revokeObjectURL(url); },60000);
  };
})();
