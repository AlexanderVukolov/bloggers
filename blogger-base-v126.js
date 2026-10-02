(function () {
  "use strict";

  var userSelectedMonth = false;
  var applyingDefault = false;

  function showFullBloggerBase() {
    var select = document.getElementById("bloggerMonthFilter");
    if (!select || userSelectedMonth || select.value === "") return;
    applyingDefault = true;
    select.value = "";
    select.dispatchEvent(new Event("input",{bubbles:true}));
    select.dispatchEvent(new Event("change",{bubbles:true}));
    applyingDefault = false;
  }

  function scheduleFullBase() {
    [0,250,750,1500,3000,5000,8000].forEach(function (delay) {
      window.setTimeout(showFullBloggerBase,delay);
    });
  }

  function applyRoleActions() {
    var switcher = document.getElementById("roleSwitcher");
    if (!switcher) return;
    var role = switcher.value || "manager";
    var managerReport = document.getElementById("fillReportBtn");
    var assistantReport = document.getElementById("fillAssistantReportBtn");
    if (managerReport) managerReport.classList.toggle("hidden",role !== "leader" && role !== "manager");
    if (assistantReport) assistantReport.classList.toggle("hidden",role !== "leader" && role !== "assistant");
  }

  function install() {
    var select = document.getElementById("bloggerMonthFilter");
    var form = document.getElementById("addBloggerForm");
    var reset = document.getElementById("resetBloggerFilters");
    if (!select || !form || !reset) return;

    select.addEventListener("change",function (event) {
      if (!applyingDefault && event.isTrusted) userSelectedMonth = true;
    },true);
    form.addEventListener("submit",function () {
      userSelectedMonth = false;
      scheduleFullBase();
    },true);
    reset.addEventListener("click",function () {
      userSelectedMonth = false;
      window.setTimeout(showFullBloggerBase,0);
    },true);

    var observer = new MutationObserver(function () {
      showFullBloggerBase();
      applyRoleActions();
    });
    observer.observe(select,{childList:true});
    observer.observe(document.getElementById("appShell"),{attributes:true,attributeFilter:["class"]});
    scheduleFullBase();
    [0,500,1500,3500,8000].forEach(function (delay) { window.setTimeout(applyRoleActions,delay); });
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded",install,{once:true});
  else install();
})();
