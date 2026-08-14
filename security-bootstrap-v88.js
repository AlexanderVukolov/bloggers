(function () {
  "use strict";

  // Remove data and old persistent sessions left by releases before v88.
  for (var index = localStorage.length - 1; index >= 0; index -= 1) {
    var key = localStorage.key(index) || "";
    if (key.indexOf("nsl") === 0 || /^sb-[a-z0-9]+-auth-token$/i.test(key)) localStorage.removeItem(key);
  }

  // The public shell contains no operational records. They arrive only after /whoami.
  window.NSL_IMPORTED_DATA = null;
  window.NSL_EUGENIA_STATS = { dailyReports: {}, monthly: {} };

  if (window.top !== window.self) {
    document.documentElement.innerHTML = "";
    window.top.location = window.self.location;
  }
})();
