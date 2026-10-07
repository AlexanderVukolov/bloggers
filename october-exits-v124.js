(function () {
  "use strict";

  function monthFromDate(value) {
    var match = String(value || "").match(/^(\d{4})-(\d{2})-\d{2}$/);
    return match ? match[1] + "-" + match[2] : "";
  }

  function monthLabel(value) {
    var parts = String(value || "").split("-");
    if (parts.length !== 2) return value;
    var label = new Date(Number(parts[0]),Number(parts[1]) - 1,1)
      .toLocaleDateString("ru-RU",{month:"long",year:"numeric"});
    return label.charAt(0).toUpperCase() + label.slice(1);
  }

  function selectMonth(id,month) {
    var select = document.getElementById(id);
    if (!select || !month) return;
    var exists = Array.prototype.some.call(select.options,function (option) {
      return option.value === month;
    });
    if (!exists) {
      var option = document.createElement("option");
      option.value = month;
      option.textContent = monthLabel(month);
      select.appendChild(option);
    }
    select.value = month;
    select.dispatchEvent(new Event("input",{bubbles:true}));
    select.dispatchEvent(new Event("change",{bubbles:true}));
  }

  function install() {
    var form = document.getElementById("addPlacementForm");
    var date = document.getElementById("newPlacementDate");
    var start = document.getElementById("newPlacementWarmupStart");
    var end = document.getElementById("newPlacementWarmupEnd");
    if (!form || !date || !start || !end) return;

    date.addEventListener("change",function () {
      if (document.getElementById("newPlacementMode")) return; // The batch creator manages the complete warmup range.
      if (!monthFromDate(date.value)) return;
      if (!start.value || start.value === end.value) start.value = date.value;
      if (!end.value || end.value < start.value) end.value = date.value;
    });

    form.addEventListener("submit",function () {
      if (document.getElementById("newPlacementMode")) return; // Month changes follow successful batch persistence.
      var month = monthFromDate(date.value);
      if (!month) return;
      window.setTimeout(function () {
        selectMonth("placementMonthFilter",month);
        selectMonth("exitMonthFilter",month);
      },50);
    },true);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded",install,{once:true});
  } else {
    install();
  }
})();
