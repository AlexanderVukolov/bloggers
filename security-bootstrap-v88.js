(function () {
  "use strict";

  // Remove operational browser caches once, but keep authentication and the
  // legacy protected access token. Clearing auth on every page load signed all
  // employees out and made the CRM look unavailable after the v88 migration.
  var cleanupMarker = "nslSecureShellCleanupV89";
  if (localStorage.getItem(cleanupMarker) !== "done") {
    for (var index = localStorage.length - 1; index >= 0; index -= 1) {
      var key = localStorage.key(index) || "";
      if (key.indexOf("nsl") === 0 && key !== "nslAdminAccess" && key !== cleanupMarker) localStorage.removeItem(key);
    }
    localStorage.setItem(cleanupMarker,"done");
  }

  // The public shell contains no operational records. They arrive only after /whoami.
  window.NSL_IMPORTED_DATA = null;
  window.NSL_EUGENIA_STATS = { dailyReports: {}, monthly: {} };

  if (window.top !== window.self) {
    document.documentElement.innerHTML = "";
    window.top.location = window.self.location;
  }
})();
