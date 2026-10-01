(function () {
  "use strict";

  function currentMonth() {
    var now = new Date();
    return now.getFullYear() + "-" + String(now.getMonth() + 1).padStart(2,"0");
  }

  function monthLabel(month) {
    var parts = String(month || "").split("-");
    if (parts.length !== 2) return month;
    var label = new Date(Number(parts[0]),Number(parts[1]) - 1,1)
      .toLocaleDateString("ru-RU",{month:"long",year:"numeric"});
    return label.charAt(0).toUpperCase() + label.slice(1);
  }

  function selectCurrentBloggerMonth() {
    var select = document.getElementById("bloggerMonthFilter");
    var month = currentMonth();
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
    if (select.value !== month) {
      select.value = month;
      select.dispatchEvent(new Event("input",{bubbles:true}));
      select.dispatchEvent(new Event("change",{bubbles:true}));
    }
  }

  function scheduleMonthSelection(delays) {
    delays.forEach(function (delay) {
      window.setTimeout(selectCurrentBloggerMonth,delay);
    });
  }

  function install() {
    var form = document.getElementById("addBloggerForm");
    if (!form) return;

    scheduleMonthSelection([0,500,1500,3500]);
    document.querySelectorAll(".add-blogger-btn,#quickAddBtn").forEach(function (button) {
      button.addEventListener("click",selectCurrentBloggerMonth,true);
    });
    form.addEventListener("submit",function () {
      scheduleMonthSelection([100,500,1500,3500,7000]);
    },true);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded",install,{once:true});
  } else {
    install();
  }
})();
