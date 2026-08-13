(function () {
  var source = (window.__appParts || []).join("");

  function replaceRequired(label, before, after) {
    if (source.indexOf(before) < 0) throw new Error("NSL v86 hotfix target not found: " + label);
    source = source.replace(before, after);
  }

  replaceRequired(
    "manual cards",
    [
      "      function consolidateBloggerCards(items) {",
      "        var groups = {};",
      "        (items || []).forEach(function (item,index) {",
      "          var identity = normalizeBloggerIdentity(item.sourceKey || item.link || item.name || item.display) || (\"id:\" + item.id);",
      "          if (!groups[identity]) groups[identity] = [];",
      "          groups[identity].push({item:item,index:index});",
      "        });"
    ].join("\n"),
    [
      "      function isManuallyCreatedBlogger(item) {",
      "        var id = Number(item && item.id);",
      "        return Boolean(item && item.createdAt && Number.isFinite(id) && id >= 1577836800000 && id < 2208988800000);",
      "      }",
      "      function consolidateBloggerCards(items) {",
      "        var groups = {};",
      "        (items || []).forEach(function (item,index) {",
      "          var identity = isManuallyCreatedBlogger(item) ? (\"created:\" + item.id) : normalizeBloggerIdentity(item.sourceKey || item.link || item.name || item.display) || (\"id:\" + item.id);",
      "          if (!groups[identity]) groups[identity] = [];",
      "          groups[identity].push({item:item,index:index});",
      "        });"
    ].join("\n")
  );

  replaceRequired(
    "blogger create",
    [
      "        if (record.namespace === \"blogger\" || record.namespace === \"blogger_create\") {",
      "          var existingBlogger = bloggers.find(function (item) { return String(item.id) === String(value.id); }) || bloggers.find(function (item) { return normalizeBloggerIdentity(item.sourceKey || item.link || item.name) === normalizeBloggerIdentity(value.sourceKey || value.link || value.name); });",
      "          if (existingBlogger) Object.assign(existingBlogger,value); else bloggers.unshift(value);",
      "          return;",
      "        }"
    ].join("\n"),
    [
      "        if (record.namespace === \"blogger\" || record.namespace === \"blogger_create\") {",
      "          var existingBlogger = bloggers.find(function (item) { return String(item.id) === String(value.id); });",
      "          if (!existingBlogger && record.namespace === \"blogger\") existingBlogger = bloggers.find(function (item) { return normalizeBloggerIdentity(item.sourceKey || item.link || item.name) === normalizeBloggerIdentity(value.sourceKey || value.link || value.name); });",
      "          if (existingBlogger) Object.assign(existingBlogger,value); else bloggers.unshift(value);",
      "          return;",
      "        }"
    ].join("\n")
  );

  replaceRequired(
    "shared state order",
    [
      "          var applyErrors = 0;",
      "          (data.records || []).forEach(function (record) {",
      "            try { applySharedStateRecord(record);"
    ].join("\n"),
    [
      "          var applyErrors = 0;",
      "          var orderedRecords = (data.records || []).slice().sort(function (a,b) {",
      "            var aBootstrap = /^bootstrap_/.test(String(a && a.namespace || \"\")) ? 0 : 1;",
      "            var bBootstrap = /^bootstrap_/.test(String(b && b.namespace || \"\")) ? 0 : 1;",
      "            return aBootstrap - bBootstrap || String(a && a.updatedAt || \"\").localeCompare(String(b && b.updatedAt || \"\"));",
      "          });",
      "          orderedRecords.forEach(function (record) {",
      "            try { applySharedStateRecord(record);"
    ].join("\n")
  );

  window.__appParts = [source];
})();
