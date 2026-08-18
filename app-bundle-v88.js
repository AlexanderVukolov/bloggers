(function () {
  var saveActualField = document.getElementById("saveCardActualBtn").closest(".field");
  saveActualField.insertAdjacentHTML("beforebegin", '<div class="field"><label>Клики по размещению</label><input class="input" id="cardActualClicks" type="number" min="0" max="1000000000" step="1" placeholder="Введите количество кликов"><small>Сохраняются вместе с охватом и попадают в общую статистику.</small></div>');

  var localNow = new Date();
  var localToday = localNow.getFullYear() + "-" + String(localNow.getMonth() + 1).padStart(2,"0") + "-" + String(localNow.getDate()).padStart(2,"0");
  ["reportDate","assistantReportDate"].forEach(function (id) {
    var input = document.getElementById(id);
    if (!input) return;
    input.max = localToday;
    input.closest(".field").insertAdjacentHTML("beforeend", '<small>Можно выбрать любую предыдущую дату и дополнить факт рассылок.</small>');
  });
  ["reportOutreach","assistantReportFact"].forEach(function (id) {
    var input = document.getElementById(id);
    if (input) input.min = "0";
  });

})();
/*__IMPORTED_DATA__*/
    /*__EUGENIA_STATS__*/
    /*__REACH_UPDATES__*/
    (function () {
      var SUPABASE_URL = "https://wmnymdmjiczbmjyztcze.supabase.co";
      var SUPABASE_KEY = "sb_publishable_Uqq-PpfJkZVkPYbd6CsYlQ_zKlTJPG4";
      var API_ROOT = SUPABASE_URL + "/functions/v1/bloggers-api";
      var supabaseClient = window.supabase.createClient(SUPABASE_URL,SUPABASE_KEY,{auth:{persistSession:true,storage:window.localStorage,autoRefreshToken:true,detectSessionInUrl:true}});
      var currentSession = null;
      var sessionActivationPromise = null;
      var currentUserProfile = null;
      var currentEmployeeProfile = null;
      var employeeProfileTargetId = "";
      var registrationInviteMatch = String(window.location.hash || "").match(/(?:^#|&)invite=([a-f0-9]{64})(?:&|$)/i);
      var registrationInviteToken = registrationInviteMatch ? registrationInviteMatch[1].toLowerCase() : "";
      var adminAccessMatch = String(window.location.hash || "").match(/(?:^#|&)access=([a-f0-9]{64})(?:&|$)/i);
      var adminLinkOpened = Boolean(adminAccessMatch);
      if (adminAccessMatch) localStorage.setItem("nslAdminAccess",adminAccessMatch[1].toLowerCase());
      if (adminAccessMatch || registrationInviteMatch) history.replaceState(null,"",window.location.pathname + window.location.search);
      var adminAccessToken = localStorage.getItem("nslAdminAccess") || "";
      function publicApiFetch(path,init) {
        var options = Object.assign({},init || {});
        var headers = new Headers(options.headers || {});
        headers.set("apikey",SUPABASE_KEY);
        options.headers = headers;
        return window.fetch(API_ROOT + path,options);
      }
      function apiFetch(path,init) {
        var options = Object.assign({},init || {});
        var headers = new Headers(options.headers || {});
        headers.set("apikey",SUPABASE_KEY);
        if (currentSession && currentSession.access_token) headers.set("authorization","Bearer " + currentSession.access_token);
        else if (adminAccessToken) headers.set("x-nsl-access",adminAccessToken);
        options.headers = headers;
        return window.fetch(API_ROOT + path,options);
      }
      var deferredInstallPrompt = null;
      var importedData = window.NSL_IMPORTED_DATA || null;
      var MAX_REACH_PER_FORMAT = 100000000;
      var MAX_BLOGGER_REACH = 1000000000;
      var importedEugeniaStats = window.NSL_EUGENIA_STATS || {dailyReports:{},monthly:{}};
      var currentFinanceData = null;
      var baseBloggers = importedData ? importedData.bloggers : [];
      var datasetVersion = importedData ? "google-sheets-" + importedData.meta.snapshot + "-" + importedData.meta.bloggers : "demo";
      var storedBloggers = JSON.parse(sessionStorage.getItem("nslBloggers") || "null");
      var bloggers = sessionStorage.getItem("nslDatasetVersion") === datasetVersion && storedBloggers ? storedBloggers : baseBloggers;
      if (sessionStorage.getItem("nslDatasetVersion") !== datasetVersion) {
        sessionStorage.setItem("nslDatasetVersion", datasetVersion);
        sessionStorage.setItem("nslBloggers", JSON.stringify(baseBloggers));
      }
      var importedBloggerIds = {};
      baseBloggers.forEach(function (item) { if (item && item.id != null) importedBloggerIds[String(item.id)] = true; });
      var locallyCreatedBloggerRecovery = (bloggers || []).filter(function (item) {
        return item && item.id != null && item.createdAt && !importedBloggerIds[String(item.id)];
      }).map(function (item) { return Object.assign({},item,{platforms:(item.platforms || []).slice(),contractFiles:[]}); });
      bloggers = bloggers.map(function (b, index) {
        var commercialDefaults = ["Подписан","Нет","Нет","На оформлении","Нет","Подписан","На оформлении","Нет"];
        var barterDefaults = ["Подписан","Подписан","На оформлении","Нет","Подписан","Подписан","Нет","Нет"];
        b.commercialContract = b.commercialContract || commercialDefaults[index % commercialDefaults.length];
        b.barterContract = b.barterContract || barterDefaults[index % barterDefaults.length];
        b.platforms = Array.isArray(b.platforms) && b.platforms.length ? b.platforms : ["ig"];
        b.cooperationType = b.cooperationType || (b.commercialContract !== "Нет" && b.barterContract !== "Нет" ? "Смешанный" : b.commercialContract !== "Нет" ? "Коммерция" : "Бартер");
        b.contractFiles = Array.isArray(b.contractFiles) ? b.contractFiles : [];
        b.category = b.category || "Без категории";
        if (!b.createdAt && Number(b.id) > 1000000000000) b.createdAt = new Date(Number(b.id)).toISOString();
        if (!Number.isFinite(Number(b.reach)) || Number(b.reach) < 0 || Number(b.reach) > MAX_BLOGGER_REACH) {
          b.importedReachWarning = b.reach;
          b.reach = 0;
        }
        if (b.status === "В пуле") b.status = "Вышел";
        return b;
      });
      bloggers = consolidateBloggerCards(bloggers);
      var bloggerEditMode = false;
      var bloggerEditSnapshot = null;
      var currentBloggerId = null;
      var currentBrand = "ln";
      var role = "manager";
      var departmentMonths = [{month:systemMonthKey(),status:"active",createdAt:new Date().toISOString(),closedAt:"",updatedBy:"system"}];
      var pendingEvidenceImages = [];
      var evidenceReports = JSON.parse(sessionStorage.getItem("nslEvidenceReports") || "null") || [];
      var baseManagerMetrics = {};
      var managerMetrics = JSON.parse(sessionStorage.getItem("nslManagerMetrics") || "null") || baseManagerMetrics;
      var baseDailyManagerReports = {};
      var dailyManagerReports = JSON.parse(sessionStorage.getItem("nslDailyManagerReports") || "null") || baseDailyManagerReports;
      Object.keys(importedEugeniaStats.dailyReports || {}).forEach(function (date) {
        if (!dailyManagerReports[date]) dailyManagerReports[date] = {};
        var importedManager = importedEugeniaStats.manager || "";
        if (importedManager && !dailyManagerReports[date][importedManager]) dailyManagerReports[date][importedManager] = importedEugeniaStats.dailyReports[date];
      });
      var baseDailyAssistantReports = {};
      var dailyAssistantReports = JSON.parse(sessionStorage.getItem("nslDailyAssistantReports") || "null") || baseDailyAssistantReports;
      var monthlyManagerPlans = JSON.parse(sessionStorage.getItem("nslMonthlyManagerPlans") || "null") || {};
      var salarySettings = JSON.parse(sessionStorage.getItem("nslSalarySettings") || "null") || {};
      var KPI_RULES = {
        planReach:0,
        categories:{a:{min:Infinity,max:null,amount:0},b:{min:Infinity,max:null,amount:0},c:{min:Infinity,max:null,amount:0}},
        reachTiers:[{min:0,amount:0,share:0}]
      };
      var kpiAdjustmentsLoaded = false;
      var kpiMonthBloggers = [];
      var kpiRosterLoadedMonths = {};
      var baseEmployees = [];
      var employees = JSON.parse(sessionStorage.getItem("nslEmployees") || "null") || baseEmployees.map(function (item) { return Object.assign({},item); });
      var placementRecords = importedData ? importedData.placements : [];
      var reelRecords = importedData ? importedData.reels : [];
      var deletedPlacements = JSON.parse(sessionStorage.getItem("nslDeletedPlacements") || "{}");
      var customPlacementRecords = JSON.parse(sessionStorage.getItem("nslCustomPlacements") || "[]").map(function (item) {
        if (!item.createdAt && Number(item.id) > 1000000000000) item.createdAt = new Date(Number(item.id)).toISOString();
        return item;
      });
      var virtualCardReachRecords = [];
      placementRecords = customPlacementRecords.concat(placementRecords);
      placementRecords.forEach(function (item) {
        if (item.actual == null || item.actual === "") return;
        var importedActual = Number(item.actual);
        if (!Number.isFinite(importedActual) || importedActual < 0 || importedActual > MAX_REACH_PER_FORMAT) {
          item.importedActualWarning = item.actual;
          item.actual = null;
        }
      });
      var placementActualOverrides = JSON.parse(sessionStorage.getItem("nslPlacementActualOverrides") || "{}");
      var placementFormatActuals = JSON.parse(sessionStorage.getItem("nslPlacementFormatActuals") || "{}");
      function legacyPlacementOverrideKey(item) {
        return [item.sourceKey || item.tag || "",item.sortDate || item.start || "",item.type || "",item.dealType || ""].join("|");
      }
      function placementOverrideKey(item) {
        return ["placement-v2",item.sourceKey || item.tag || "",item.sortDate || item.start || "",item.type || "",item.dealType || "",item.id == null ? "" : item.id].join("|");
      }
      function warmupIso(day,month,year) {
        var value = String(year) + "-" + String(month).padStart(2,"0") + "-" + String(day).padStart(2,"0");
        var parsed = new Date(value + "T00:00:00Z");
        return Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0,10) !== value ? "" : value;
      }
      function initializeWarmupDates(item) {
        if (!item || (item.warmupStart && item.warmupEnd)) return item;
        var match = String(item.warmup || "").match(/(\d{1,2})\.(\d{1,2})(?:\.(\d{4}))?\s*[–—-]\s*(\d{1,2})\.(\d{1,2})(?:\.(\d{4}))?/);
        if (!match) return item;
        var fallbackYear = String(item.sortDate || "").slice(0,4) || "2026";
        item.warmupStart = item.warmupStart || warmupIso(match[1],match[2],match[3] || fallbackYear);
        item.warmupEnd = item.warmupEnd || warmupIso(match[4],match[5],match[6] || match[3] || fallbackYear);
        return item;
      }
      function shortIsoDate(value) {
        var parts = String(value || "").split("-");
        return parts.length === 3 ? parts[2] + "." + parts[1] : "";
      }
      function displayIsoDate(value) {
        var parts = String(value || "").split("-");
        return parts.length === 3 ? parts[2] + "." + parts[1] + "." + parts[0] : "—";
      }
      function warmupRangeLabel(item) {
        initializeWarmupDates(item);
        if (item && item.warmupStart && item.warmupEnd) return shortIsoDate(item.warmupStart) + "–" + shortIsoDate(item.warmupEnd);
        return String((item && item.warmup) || "—");
      }
      function findPlacementByOverrideKey(key) {
        return placementRecords.concat(virtualCardReachRecords).find(function (item) { return placementOverrideKey(item) === key; });
      }
      placementRecords.forEach(initializeWarmupDates);
      placementRecords.forEach(function (item) {
        var key = placementOverrideKey(item);
        var legacyKey = legacyPlacementOverrideKey(item);
        var cachedKey = Object.prototype.hasOwnProperty.call(placementActualOverrides,key) ? key : Object.prototype.hasOwnProperty.call(placementActualOverrides,legacyKey) ? legacyKey : "";
        if (cachedKey) {
          var cachedActual = Number(placementActualOverrides[cachedKey]);
          var validCachedActual = Number.isFinite(cachedActual) && cachedActual >= 0 && cachedActual <= MAX_REACH_PER_FORMAT * 3;
          if (validCachedActual) item.actual = cachedActual;
          else delete placementActualOverrides[cachedKey];
          if (validCachedActual && cachedKey === legacyKey && cachedKey !== key) {
            placementActualOverrides[key] = cachedActual;
            if (placementFormatActuals[legacyKey] && !placementFormatActuals[key]) placementFormatActuals[key] = Object.assign({},placementFormatActuals[legacyKey]);
          }
        }
      });
      function weeklyExitFromPlacement(item) {
        var dateParts = String(item.sortDate || "").split("-");
        return {
          id:"placement-exit-" + item.id,sourcePlacementId:item.id,sourceKey:item.sourceKey,createdAt:item.createdAt || "",
          date:item.start || (dateParts.length === 3 ? dateParts[2] + "." + dateParts[1] : "—"),sortDate:item.sortDate || "",
          month:dateParts.length === 3 ? dateParts[1] + "." + dateParts[0] : "",tag:item.tag || item.fullName || "—",
          manager:item.manager || "—",warmupDay:warmupRangeLabel(item),format:item.type || "—",plannedReach:Number(item.guaranteed || 0),
          bloggerLink:item.platform || "",source:"Ручное добавление"
        };
      }
      var weeklyExits = importedData ? importedData.weeklyExits : [];
      var customExitKeys = {};
      var customExitRows = customPlacementRecords.map(function (item) { var row = weeklyExitFromPlacement(item); customExitKeys[String(row.sourcePlacementId)] = true; return row; });
      weeklyExits = customExitRows.concat(weeklyExits.filter(function (item) { return !customExitKeys[String(item.sourcePlacementId || "")]; }));
      var placementPage = 1;
      var placementQuickFilter = "all";
      var expandedPlacementId = null;
      var additionalPlacementFormats = JSON.parse(sessionStorage.getItem("nslPlacementFormats") || "[]");
      var exitPage = 1;
      var placementCreateOrigin = "placements";
      var PAGE_SIZE = 50;

      var loginScreen = document.getElementById("loginScreen");
      var appShell = document.getElementById("appShell");
      var overlay = document.getElementById("overlay");
      var drawer = document.getElementById("bloggerDrawer");
      var toast = document.getElementById("toast");
      var pageMeta = {
        dashboard:["Главная","Рабочий путь и основные показатели"],
        profile:["Мой кабинет","Роль и история показателей"],
        finance:["Финансы","План, факт, затраты и эффективность отдела"],
        bloggers:["Блогеры","Общая база ЛН и FIT PRO"],
        placements:["Единый реестр размещений","Одна строка — одно размещение, все форматы внутри карточки"],
        calendar:["Выходы","Календарь публикаций и прогревов"],
        reports:["Отчёты и контроль","День, месяц и фактические охваты"],
        kpi:["KPI, зарплата и регламент","Автоматический расчёт и правила отдела"],
        team:["Сотрудники","Кабинеты, планы и зарплаты"],
        integrations:["Интеграции","amoCRM и Google Таблицы"]
      };
      function money(value) {
        return new Intl.NumberFormat("ru-RU").format(value) + " ₽";
      }
      function number(value) {
        return new Intl.NumberFormat("ru-RU").format(value || 0);
      }
      function rate(numerator, denominator) {
        return denominator ? numerator / denominator * 100 : 0;
      }
      function percent(value, digits) {
        return Number(value || 0).toLocaleString("ru-RU", {minimumFractionDigits:digits == null ? 1 : digits,maximumFractionDigits:digits == null ? 1 : digits}) + "%";
      }
      var FINANCE_METRICS = [
        {id:"paidIntegrations",label:"Платные интеграции",format:"number"},{id:"paidBudget",label:"Платный бюджет",format:"money"},
        {id:"reach",label:"Охват",format:"number"},{id:"clicks",label:"Клики",format:"number"},{id:"outreach",label:"Рассылки · общая метрика отдела",format:"number"},
        {id:"leads",label:"Лиды",format:"number"},{id:"qualifiedLeads",label:"Квал. лиды",format:"number"},{id:"sales",label:"Продажи",format:"number"},
        {id:"revenue",label:"Выручка",format:"money"},{id:"exits",label:"Количество выходов",format:"number"},{id:"roi",label:"ROI с учётом затрат",format:"percent"},
        {id:"romi",label:"ROMI",format:"percent"},{id:"costs",label:"Затраты всего",format:"money"}
      ];
      function financeMetricValue(id,value) {
        if (value == null || !Number.isFinite(Number(value))) return "—";
        var meta = FINANCE_METRICS.find(function (item) { return item.id === id; }) || {format:"number"};
        if (meta.format === "money") return money(Math.round(Number(value)));
        if (meta.format === "percent") return percent(Number(value),2);
        return number(Math.round(Number(value)));
      }
      function programOutreachMetric(month) {
        var latestDate = dashboardReportDates(month)[0] || month + "-01";
        var managerTotal = activeEmployeeManagers().reduce(function (total,name) {
          var item = managerOutreachSummary(name,month,latestDate);
          total.plan += Number(item.monthPlan || 0); total.fact += Number(item.monthFact || 0); return total;
        },{plan:0,fact:0});
        var assistantTotal = activeEmployeeAssistants().reduce(function (total,name) {
          var item = assistantOutreachSummary(name,month,latestDate);
          total.plan += Number(item.monthPlan || 0); total.fact += Number(item.monthFact || 0); return total;
        },{plan:0,fact:0});
        var plan = managerTotal.plan + assistantTotal.plan;
        var fact = managerTotal.fact + assistantTotal.fact;
        return {plan:plan,fact:fact,progress:plan > 0 ? fact / plan * 100 : null,source:"Ежедневные отчёты сотрудников"};
      }
      function programDirectionCostMetric(month,direction) {
        var fact = synchronizedPlacementRecords().filter(function (item) {
          return placementDirection(item) === direction && (monthFromDateValue(item.sortDate) || monthFromDateValue(item.start)) === month;
        }).reduce(function (sum,item) { return sum + Math.max(0,Number(item.cost || 0)); },0);
        if (!fact) fact = bloggers.filter(function (blogger) {
          var bloggerMonth = monthFromDateValue(blogger.sortDate) || monthFromDateValue(blogger.last) || String(blogger.importMonth || "").slice(0,7);
          return blogger.brand === direction && bloggerMonth === month;
        }).reduce(function (sum,blogger) { return sum + Math.max(0,Number(blogger.spent || 0)); },0);
        return {plan:null,fact:fact,progress:null,source:"Размещения и карточки блогеров"};
      }
      function attachProgramFinanceMetrics(data) {
        if (!data) return data;
        (data.archive || []).concat(data.current ? [data.current] : []).forEach(function (entry) {
          if (!entry || !entry.month) return;
          var directions = entry.directions || {};
          var lnCost = programDirectionCostMetric(entry.month,"ЛН");
          var fitCost = programDirectionCostMetric(entry.month,"FIT PRO");
          var lnFact = monthlyDirectionFact(entry.month,"ЛН");
          var fitFact = monthlyDirectionFact(entry.month,"FIT PRO");
          if (directions.ln) { directions.ln.metrics.outreach = {plan:null,fact:null,progress:null}; directions.ln.metrics.costs = lnCost; directions.ln.metrics.clicks = {plan:null,fact:Number(lnFact.clicks || 0),progress:null,source:"Карточки и подтверждённые отчёты"}; }
          if (directions.fit) { directions.fit.metrics.outreach = {plan:null,fact:null,progress:null}; directions.fit.metrics.costs = fitCost; directions.fit.metrics.clicks = {plan:null,fact:Number(fitFact.clicks || 0),progress:null,source:"Карточки и подтверждённые отчёты"}; }
          if (entry.combined) {
            entry.combined.metrics.outreach = programOutreachMetric(entry.month);
            entry.combined.metrics.clicks = {plan:null,fact:Number(lnFact.clicks || 0) + Number(fitFact.clicks || 0),progress:null,source:"Карточки и подтверждённые отчёты"};
            entry.combined.metrics.costs = {plan:null,fact:Number(lnCost.fact || 0) + Number(fitCost.fact || 0),progress:null,source:"Размещения и карточки блогеров"};
          }
        });
        return data;
      }
      function financeProgressClass(id,metric) {
        if (!metric || metric.progress == null) return "";
        if (id === "costs" || id === "paidBudget") return Number(metric.fact || 0) <= Number(metric.plan || 0) ? "trend-up" : "trend-down";
        return metricState(metric.progress,100);
      }
      function financeDirectionCard(item,highlight) {
        var metrics = (item && item.metrics) || {};
        return '<article class="kpi" style="border:1px solid ' + (highlight ? 'var(--green)' : 'var(--line)') + ';border-radius:14px"><div class="kpi-top"><span>' + safeText((item && item.title) || "Нет данных") + '</span><span class="kpi-icon">' + (highlight ? 'Σ' : '₽') + '</span></div><div class="kpi-value">' + financeMetricValue("revenue",metrics.revenue && metrics.revenue.fact) + '</div><div class="kpi-foot">Выручка · <span class="' + financeProgressClass("revenue",metrics.revenue) + '">' + (metrics.revenue && metrics.revenue.progress != null ? percent(metrics.revenue.progress,1) : '—') + ' плана</span></div><div class="team-stats" style="margin-top:12px"><div class="team-stat"><strong>' + financeMetricValue("reach",metrics.reach && metrics.reach.fact) + '</strong><span>Охват</span></div><div class="team-stat"><strong>' + financeMetricValue("costs",metrics.costs && metrics.costs.fact) + '</strong><span>Затраты</span></div><div class="team-stat"><strong>' + financeMetricValue("roi",metrics.roi && metrics.roi.fact) + '</strong><span>ROI</span></div></div></article>';
      }
      function renderFinanceKpis(data) {
        var grid = document.getElementById("financeKpiGrid");
        if (!grid) return;
        if (role !== "leader") { grid.innerHTML = ""; return; }
        var current = data && data.current;
        if (!current) {
          grid.innerHTML = ["Лиды","Квал. лиды","Продажи","Выручка"].map(function (label) { return '<article class="card kpi"><div class="kpi-top"><span>' + label + '</span><span class="kpi-icon">…</span></div><div class="kpi-value">—</div><div class="kpi-foot">Загружаю актуальные данные…</div></article>'; }).join("");
          return;
        }
        var direction = currentBrand === "all" ? current.combined : (current.directions || {})[currentBrand];
        var metrics = (direction && direction.metrics) || {};
        var configs = [{id:"leads",label:"Лиды",icon:"↗"},{id:"qualifiedLeads",label:"Квал. лиды",icon:"✓"},{id:"sales",label:"Продажи",icon:"₽"},{id:"revenue",label:"Выручка",icon:"◆"}];
        grid.innerHTML = configs.map(function (config) {
          var metric = metrics[config.id] || {};
          var progress = metric.progress == null ? null : Number(metric.progress);
          var progressLabel = progress == null ? "Без плана" : percent(progress,1);
          var planLabel = metric.plan == null ? "план не задан" : "план " + financeMetricValue(config.id,metric.plan);
          return '<article class="card kpi"><div class="kpi-top"><span>' + config.label + '</span><span class="kpi-icon">' + config.icon + '</span></div><div class="kpi-value">' + financeMetricValue(config.id,metric.fact) + '</div><div class="kpi-foot"><span class="' + financeProgressClass(config.id,metric) + '">' + progressLabel + '</span> · ' + planLabel + '</div><div class="plan-row"><div><span>Выполнение</span><span>' + progressLabel + '</span></div><div class="progress"><i style="width:' + Math.min(100,Math.max(0,progress || 0)) + '%"></i></div></div></article>';
        }).join("");
      }
      function renderFinanceTrend(data) {
        var chart = document.getElementById("financeTrendChart");
        var note = document.getElementById("financeTrendNote");
        if (!chart) return;
        if (role !== "leader" || !data || !data.current) {
          chart.innerHTML = '<div class="empty-state">Нет данных для построения динамики.</div>';
          if (note) note.textContent = "График появится после загрузки финансовой сводки.";
          return;
        }
        var periods = (data.archive || []).concat([data.current]).map(function (entry) {
          var direction = currentBrand === "all" ? entry.combined : ((entry.directions || {})[currentBrand]);
          var metrics = (direction && direction.metrics) || {};
          return {
            month:entry.month,
            leads:Number(metrics.leads && metrics.leads.fact || 0),
            revenue:Number(metrics.revenue && metrics.revenue.fact || 0)
          };
        }).filter(function (entry) { return entry.month; }).sort(function (a,b) { return a.month.localeCompare(b.month); }).slice(-8);
        if (!periods.length) {
          chart.innerHTML = '<div class="empty-state">За выбранное направление пока нет данных.</div>';
          if (note) note.textContent = "Выберите другое направление или обновите финансовую таблицу.";
          return;
        }
        var maxLeads = Math.max.apply(null,periods.map(function (entry) { return entry.leads; }).concat([1]));
        var maxRevenue = Math.max.apply(null,periods.map(function (entry) { return entry.revenue; }).concat([1]));
        chart.innerHTML = periods.map(function (entry) {
          var leadsHeight = Math.max(5,Math.round(entry.leads / maxLeads * 145));
          var revenueHeight = Math.max(5,Math.round(entry.revenue / maxRevenue * 145));
          return '<div class="finance-trend-month"><div class="finance-trend-bars"><div class="finance-trend-bar" style="height:' + leadsHeight + 'px" title="Лиды: ' + number(entry.leads) + '"><strong>' + number(entry.leads) + '</strong></div><div class="finance-trend-bar revenue" style="height:' + revenueHeight + 'px" title="Выручка: ' + money(entry.revenue) + '"><strong>' + money(entry.revenue) + '</strong></div></div><label>' + safeText(activeMonthLabel(entry.month)) + '</label></div>';
        }).join("");
        var directionLabel = currentBrand === "ln" ? "ЛН" : currentBrand === "fit" ? "FIT PRO" : "всех направлений";
        if (note) note.textContent = "Фактическая динамика " + directionLabel + " по текущему и архивным месяцам. Шкалы лидов и выручки нормализованы отдельно.";
      }
      function renderFinanceArchive(items) {
        var details = document.getElementById("financeArchiveDetails");
        if (!items || !items.length) { details.classList.add("hidden"); return; }
        details.classList.remove("hidden");
        document.getElementById("financeArchiveTitle").textContent = "Архив прошлых месяцев · " + items.length;
        document.getElementById("financeArchive").innerHTML = '<div class="table-wrap"><table style="min-width:1050px"><thead><tr><th>Месяц</th><th>Данные направлений</th><th>Охват</th><th>Лиды</th><th>Продажи</th><th>Выручка</th><th>Выходы</th><th>Затраты</th><th>ROI</th><th>ROMI</th></tr></thead><tbody>' + items.map(function (entry) {
          var metrics = (entry.combined && entry.combined.metrics) || {};
          var directions = (entry.availableDirections || []).map(function (id) { return id === "ln" ? "ЛН" : id === "fit" ? "FIT PRO" : id; });
          return '<tr><td><b>' + activeMonthLabel(entry.month) + '</b></td><td><span class="badge ' + (directions.length > 1 ? 'badge-green' : 'badge-amber') + '">' + safeText(directions.join(" + ") || "Нет данных") + '</span></td><td>' + financeMetricValue("reach",metrics.reach && metrics.reach.fact) + '</td><td>' + financeMetricValue("leads",metrics.leads && metrics.leads.fact) + '</td><td>' + financeMetricValue("sales",metrics.sales && metrics.sales.fact) + '</td><td><b>' + financeMetricValue("revenue",metrics.revenue && metrics.revenue.fact) + '</b></td><td>' + financeMetricValue("exits",metrics.exits && metrics.exits.fact) + '</td><td>' + financeMetricValue("costs",metrics.costs && metrics.costs.fact) + '</td><td>' + financeMetricValue("roi",metrics.roi && metrics.roi.fact) + '</td><td>' + financeMetricValue("romi",metrics.romi && metrics.romi.fact) + '</td></tr>';
        }).join("") + '</tbody></table></div><div class="table-note">Прошлые месяцы участвуют в статистике архива и не смешиваются с показателями действующего месяца. Если направления нет в исходной таблице за месяц, оно не добавляется в итог.</div>';
      }
      function renderFinanceCenter(data,isFallback) {
        if (role !== "leader" || !data || !data.current) return;
        currentFinanceData = data;
        var current = data.current;
        var directions = current.directions || {};
        document.getElementById("financeCenterTitle").textContent = "Финансы и результат отдела · " + activeMonthLabel(current.month);
        document.getElementById("financeDirectionCards").innerHTML = financeDirectionCard(directions.ln,false) + financeDirectionCard(directions.fit,false) + financeDirectionCard(current.combined,true);
        document.getElementById("financeMetricsTable").innerHTML = FINANCE_METRICS.map(function (meta) {
          var ln = directions.ln && directions.ln.metrics[meta.id];
          var fit = directions.fit && directions.fit.metrics[meta.id];
          var total = current.combined && current.combined.metrics[meta.id];
          var progress = total && total.progress != null ? '<span class="' + financeProgressClass(meta.id,total) + '">' + percent(total.progress,1) + '</span>' : '<span class="trend-warn">Без плана</span>';
          return '<tr><td><b>' + meta.label + '</b></td><td>' + financeMetricValue(meta.id,ln && ln.plan) + '</td><td><b>' + financeMetricValue(meta.id,ln && ln.fact) + '</b></td><td>' + financeMetricValue(meta.id,fit && fit.plan) + '</td><td><b>' + financeMetricValue(meta.id,fit && fit.fact) + '</b></td><td>' + financeMetricValue(meta.id,total && total.plan) + '</td><td><b>' + financeMetricValue(meta.id,total && total.fact) + '</b></td><td>' + progress + '</td></tr>';
        }).join("");
        var updated = data.updatedAt ? new Date(data.updatedAt).toLocaleString("ru-RU",{day:"2-digit",month:"2-digit",hour:"2-digit",minute:"2-digit"}) : "—";
        document.getElementById("financeSyncStatus").className = "badge " + (isFallback ? "badge-amber" : "badge-green");
        document.getElementById("financeSyncStatus").textContent = isFallback ? "Резервный снимок" : "Google Sheets · актуально";
        document.getElementById("financeSourceNote").textContent = (isFallback ? "Показан последний сохранённый снимок. " : "Данные получены напрямую из Google Sheets. ") + "Листы: «Отчет ЛН» и «Отчет FIT PRO» · обновлено " + updated + ". Рассылки в сводной не удваиваются; общий ROI и ROMI пересчитываются по суммарной выручке и затратам.";
        renderFinanceKpis(data);
        renderFinanceTrend(data);
        renderFinanceArchive(data.archive || []);
      }
      function hydrateFinanceCenter() {
        if (role !== "leader") return Promise.resolve();
        var button = document.getElementById("refreshFinanceBtn");
        button.disabled = true;
        document.getElementById("financeSyncStatus").textContent = "Обновляю…";
        return apiFetch("/api/finance-summary",{headers:{"cache-control":"no-store","x-nsl-role":role}}).then(function (response) {
          if (!response.ok) throw new Error("finance sync failed");
          return response.json();
        }).then(function (data) { data = attachProgramFinanceMetrics(data); renderFinanceCenter(data,Boolean(data.source && data.source.mode === "exact-sheet-cache")); }).catch(function () {
          currentFinanceData = null;
          renderFinanceKpis(null);
          document.getElementById("financeSyncStatus").className = "badge badge-red";
          document.getElementById("financeSyncStatus").textContent = "Ошибка обновления";
          document.getElementById("financeDirectionCards").innerHTML = "";
          document.getElementById("financeMetricsTable").innerHTML = "";
          renderFinanceTrend(null);
          document.getElementById("financeSourceNote").textContent = "Не удалось получить актуальные данные. Нажмите «Обновить» ещё раз.";
        }).finally(function () { button.disabled = false; });
      }
      function metricState(value, target, warningShare) {
        if (value >= target) return "trend-up";
        if (value >= target * (warningShare || .8)) return "trend-warn";
        return "trend-down";
      }
      function emptyDailyManagerMetrics(name) {
        var plan = managerMetrics[name] || {};
        return {planOutreach:Number(plan.planOutreach || 150),outreach:0,replies:0,approvals:0,closedBloggers:0,refusals:0,dialog:0,exitsLn:0,exitsFit:0,planReachLn:Number(plan.planReachLn || 0),factReachLn:0,planReachFit:Number(plan.planReachFit || 0),factReachFit:0,extraTags:0,reels:0,transfers:0,onTime:0,evidence:0,commercial:0,barter:0,revenueLn:0,revenueFit:0,revenuePlan:Number(plan.revenuePlan || 0),_missing:true};
      }
      function normalizeBloggerIdentity(value) {
        var text = String(value || "").trim().toLowerCase();
        text = text.replace(/^(ig|tg|vk):/,"");
        text = text.replace(/^https?:\/\/(?:www\.)?(?:instagram\.com|t\.me|vk\.com|vk\.ru)\//,"");
        text = text.split(/[?#]/)[0].replace(/^@/,"").replace(/\/+$/,"");
        return text;
      }
      var bloggerLookupIndex = null;
      var synchronizedPlacementCache = null;
      var synchronizedExitCache = null;
      function invalidateDerivedData() {
        bloggerLookupIndex = null;
        synchronizedPlacementCache = null;
        synchronizedExitCache = null;
      }
      function ensureBloggerLookupIndex() {
        if (bloggerLookupIndex) return bloggerLookupIndex;
        var byId = {};
        var byIdentity = {};
        bloggers.forEach(function (blogger) {
          byId[String(blogger.id)] = blogger;
          [blogger.sourceKey,blogger.name,blogger.display,blogger.link].map(normalizeBloggerIdentity).filter(Boolean).forEach(function (identity) {
            if (!byIdentity[identity]) byIdentity[identity] = [];
            if (byIdentity[identity].indexOf(blogger) < 0) byIdentity[identity].push(blogger);
          });
        });
        bloggerLookupIndex = {byId:byId,byIdentity:byIdentity};
        return bloggerLookupIndex;
      }
      function bloggerContractRank(value) {
        return {"Нет":0,"Запрос данных":1,"На оформлении":2,"Готов":3,"Подписан":4}[String(value || "")] || 0;
      }
      function isManuallyCreatedBlogger(item) {
        var id = Number(item && item.id);
        return Boolean(item && item.createdAt && Number.isFinite(id) && id >= 1577836800000 && id < 2208988800000);
      }
      function consolidateBloggerCards(items) {
        var groups = {};
        (items || []).forEach(function (item,index) {
          var identity = isManuallyCreatedBlogger(item) ? ("created:" + item.id) : normalizeBloggerIdentity(item.sourceKey || item.link || item.name || item.display) || ("id:" + item.id);
          if (!groups[identity]) groups[identity] = [];
          groups[identity].push({item:item,index:index});
        });
        return Object.keys(groups).map(function (identity) {
          var group = groups[identity].slice().sort(function (a,b) {
            var dateCompare = String(b.item.sortDate || bloggerLastIso(b.item.last) || "").localeCompare(String(a.item.sortDate || bloggerLastIso(a.item.last) || ""));
            return dateCompare || createdTimestamp(b.item) - createdTimestamp(a.item) || a.index - b.index;
          });
          var card = Object.assign({},group[0].item);
          card.platforms = group.reduce(function (result,entry) {
            (entry.item.platforms || []).forEach(function (platform) { if (result.indexOf(platform) < 0) result.push(platform); });
            return result;
          },[]);
          card.duplicateSourceIds = group.map(function (entry) { return entry.item.id; });
          ["commercialContract","barterContract"].forEach(function (field) {
            card[field] = group.map(function (entry) { return entry.item[field]; }).sort(function (a,b) { return bloggerContractRank(b) - bloggerContractRank(a); })[0] || "Нет";
          });
          if (!card.category || card.category === "Без категории") {
            var category = group.map(function (entry) { return entry.item.category; }).find(function (value) { return value && value !== "Без категории"; });
            if (category) card.category = category;
          }
          if (!card.link) card.link = group.map(function (entry) { return entry.item.link; }).find(Boolean) || "";
          card.spent = Math.max.apply(Math,group.map(function (entry) { return Number(entry.item.spent || 0); }).concat([0]));
          card._mergedCardCount = group.length;
          return card;
        });
      }
      function placementMatchesBlogger(item,blogger) {
        if (!item || !blogger) return false;
        if (item.bloggerId != null && String(item.bloggerId) === String(blogger.id)) return true;
        var placementIdentities = [item.sourceKey,item.tag,item.bloggerLink].map(normalizeBloggerIdentity).filter(Boolean);
        var bloggerIdentities = [blogger.sourceKey,blogger.name,blogger.display,blogger.link].map(normalizeBloggerIdentity).filter(Boolean);
        return placementIdentities.some(function (identity) { return bloggerIdentities.indexOf(identity) >= 0; });
      }
      function linkedBloggerForPlacement(item) {
        if (!item) return undefined;
        var index = ensureBloggerLookupIndex();
        if (item.bloggerId != null && index.byId[String(item.bloggerId)]) return index.byId[String(item.bloggerId)];
        var found = {};
        [item.sourceKey,item.tag,item.bloggerLink].map(normalizeBloggerIdentity).filter(Boolean).forEach(function (identity) {
          (index.byIdentity[identity] || []).forEach(function (blogger) { found[String(blogger.id)] = blogger; });
        });
        var matches = Object.keys(found).map(function (id) { return found[id]; });
        if (matches.length < 2) return matches[0];
        var tag = normalizeBloggerIdentity(item.tag);
        return matches.sort(function (a,b) {
          function score(blogger) {
            var value = 0;
            if (tag && [blogger.name,blogger.display].map(normalizeBloggerIdentity).indexOf(tag) >= 0) value += 8;
            if (item.brand && blogger.brand === item.brand) value += 4;
            if (item.manager && blogger.manager === item.manager) value += 2;
            return value;
          }
          return score(b) - score(a) || Number(a.id || 0) - Number(b.id || 0);
        })[0];
      }
      function placementValueMissing(value) {
        return value == null || value === "" || ["—","Не заполнено","Не назначен","Не указан"].indexOf(String(value).trim()) >= 0;
      }
      function bloggerCardDate(blogger) {
        if (/^\d{4}-\d{2}-\d{2}$/.test(String(blogger && blogger.sortDate || ""))) return blogger.sortDate;
        return bloggerLastIso(blogger && blogger.last);
      }
      function bloggerPlatformLabel(blogger) {
        var labels = {ig:"Instagram",tg:"Telegram",vk:"VK",yt:"YouTube"};
        var platforms = Array.isArray(blogger && blogger.platforms) ? blogger.platforms : [];
        return platforms.map(function (platform) { return labels[platform] || String(platform).toUpperCase(); }).join(" + ");
      }
      function bloggerContractForPlacement(blogger,item) {
        var type = String((item && item.dealType) || (blogger && blogger.cooperationType) || "");
        if (type === "Коммерция") return blogger.commercialContract || "Нет";
        if (type === "Бартер") return blogger.barterContract || "Нет";
        if (blogger.commercialContract === "Подписан" || blogger.barterContract === "Подписан") return "Подписан";
        if (blogger.commercialContract === "На оформлении" || blogger.barterContract === "На оформлении") return "На оформлении";
        return "Нет";
      }
      function synchronizePlacementMetadata(item,blogger) {
        if (!item || !blogger) return item;
        item._cardSyncedMeta = item._cardSyncedMeta || {};
        function sync(field,value,placeholder) {
          if (value == null || value === "") return;
          if (item._cardSyncedMeta[field] || placeholder(item[field])) {
            item[field] = value;
            item._cardSyncedMeta[field] = true;
          }
        }
        item.bloggerId = blogger.id;
        sync("tag",blogger.name || blogger.display,placementValueMissing);
        sync("bloggerLink",blogger.link,placementValueMissing);
        sync("manager",blogger.manager,placementValueMissing);
        sync("platform",bloggerPlatformLabel(blogger),placementValueMissing);
        sync("fullName",blogger.display || blogger.name,placementValueMissing);
        sync("brand",blogger.brand,placementValueMissing);
        sync("direction",blogger.brand,placementValueMissing);
        sync("dealType",blogger.cooperationType,placementValueMissing);
        var contract = bloggerContractForPlacement(blogger,item);
        if (item._cardSyncedMeta.contract || placementValueMissing(item.contract) || (item.contract === "Нет" && contract !== "Нет")) sync("contract",contract,function () { return true; });
        var cardDate = bloggerCardDate(blogger);
        if (cardDate && !item.sortDate) sync("sortDate",cardDate,placementValueMissing);
        if (cardDate && placementValueMissing(item.start)) sync("start",displayIsoDate(cardDate),placementValueMissing);
        return item;
      }
      function placementAnalyticsKey(item) {
        if (!item) return "";
        if (item.isCardReach || Number(item.id) > 1000000000000 || String(item.id || "").indexOf("card-reach-") === 0) return "unique:" + String(item.id);
        var identity = normalizeBloggerIdentity(item.sourceKey || item.tag || item.bloggerLink);
        var date = item.sortDate || item.start;
        if (!identity || !date || date === "—") return "unique:" + String(item.id);
        return [identity,date,String(item.type || "").trim().toLowerCase(),String(item.dealType || "").trim().toLowerCase(),String(item.brand || item.direction || "").trim().toLowerCase()].join("|");
      }
      function deduplicatePlacementRows(rows) {
        var groups = {};
        (rows || []).forEach(function (item) {
          var key = placementAnalyticsKey(item);
          if (!groups[key]) groups[key] = [];
          groups[key].push(item);
        });
        return Object.keys(groups).map(function (key) {
          var group = groups[key];
          if (group.length === 1) { group[0]._mergedDuplicateCount = 1; return group[0]; }
          function score(item) {
            return (item.actual != null ? 16 : 0) + (item.contentLink ? 8 : 0) + (["Готов","Подписан"].indexOf(item.contract) >= 0 ? 4 : 0) + (item.fullName && item.fullName !== "Не заполнено" ? 2 : 0) + (item.comment ? 1 : 0);
          }
          var target = group.slice().sort(function (a,b) { return score(b)-score(a) || createdTimestamp(b)-createdTimestamp(a); })[0];
          ["guaranteed","actual","clicks","leads","sales","revenue","cost"].forEach(function (field) {
            var values = group.map(function (item) { return item[field]; }).filter(function (value) { return value != null && Number.isFinite(Number(value)); }).map(Number);
            if (values.length) target[field] = Math.max.apply(Math,values);
          });
          ["bloggerLink","manager","platform","fullName","brief","contract","contentLink","comment","direction","brand"].forEach(function (field) {
            if (!placementValueMissing(target[field])) return;
            var value = group.map(function (item) { return item[field]; }).find(function (candidate) { return !placementValueMissing(candidate); });
            if (value != null) target[field] = value;
          });
          target._mergedDuplicateCount = group.length;
          return target;
        });
      }
      function synchronizedPlacementRecords() {
        if (synchronizedPlacementCache) return synchronizedPlacementCache;
        var rows = placementRecords.filter(function (item) { return !placementIsDeleted(item); });
        var rowsByBloggerId = {};
        rows.forEach(function (item) {
          if (!item._cardBaseMetrics) item._cardBaseMetrics = {actual:item.actual,leads:item.leads,sales:item.sales,revenue:item.revenue};
          var key = placementOverrideKey(item);
          if (item._cardSyncedActual && !Object.prototype.hasOwnProperty.call(placementActualOverrides,key)) item.actual = item._cardBaseMetrics.actual;
          ["leads","sales","revenue"].forEach(function (field) {
            if (item._cardSyncedMetrics && item._cardSyncedMetrics[field]) item[field] = item._cardBaseMetrics[field];
          });
          item._cardSyncedActual = false;
          item._cardSyncedMetrics = {};
          var blogger = linkedBloggerForPlacement(item);
          if (blogger) {
            synchronizePlacementMetadata(item,blogger);
            var bloggerId = String(blogger.id);
            if (!rowsByBloggerId[bloggerId]) rowsByBloggerId[bloggerId] = [];
            rowsByBloggerId[bloggerId].push(item);
          }
        });
        var additions = [];
        bloggers.forEach(function (blogger) {
          var cardDate = bloggerCardDate(blogger);
          if (!cardDate) return;
          var exact = (rowsByBloggerId[String(blogger.id)] || []).filter(function (item) { return item.sortDate === cardDate; });
          var cardReach = Number(blogger.reach || 0);
          var validReach = Number.isFinite(cardReach) && cardReach > 0 && cardReach <= MAX_BLOGGER_REACH;
          if (!exact.length) {
            if (blogger.status === "Вышел") {
              var cardPlacement = manualCardReachPlacement(blogger);
              if (!placementIsDeleted(cardPlacement)) additions.push(cardPlacement);
            }
            return;
          }
          var hasRecordedActual = exact.some(function (item) {
            return Object.prototype.hasOwnProperty.call(placementActualOverrides,placementOverrideKey(item)) || (item.actual != null && Number(item.actual) > 0);
          });
          var target = exact.find(function (item) { return item.actual == null || Number(item.actual) === 0; }) || exact[0];
          if (!hasRecordedActual && validReach && target) {
            target.actual = cardReach;
            target._cardSyncedActual = true;
          }
          if (target) {
            [["leads",blogger.leads],["sales",blogger.sales],["revenue",blogger.revenue]].forEach(function (entry) {
              var field = entry[0];
              var value = Number(entry[1] || 0);
              if (value > 0 && Number(target[field] || 0) === 0) {
                target[field] = value;
                target._cardSyncedMetrics[field] = true;
              }
            });
          }
        });
        synchronizedPlacementCache = deduplicatePlacementRows(additions.concat(rows));
        return synchronizedPlacementCache;
      }
      function effectivePlacementActual(item) {
        if (!item || item.actual == null || item.actual === "") return null;
        var actual = Number(item.actual);
        return Number.isFinite(actual) && actual >= 0 && actual <= MAX_REACH_PER_FORMAT ? actual : null;
      }
      function confirmedEvidenceClicksForPlacement(item) {
        if (!item) return null;
        var identity = normalizeBloggerIdentity(item.sourceKey || item.tag || item.bloggerLink);
        var date = placementIsoDate(item) || item.sortDate || item.start || "";
        var values = evidenceReports.filter(function (report) {
          return normalizeBloggerIdentity(report.blogger) === identity && String(report.date || "") === String(date) && (!report.status || report.status === "Подтверждено");
        }).map(function (report) { return Number(report.clicks); }).filter(function (value) { return Number.isFinite(value) && value >= 0; });
        return values.length ? Math.max.apply(Math,values) : null;
      }
      function effectivePlacementClicks(item) {
        var placementValue = item && item.clicks != null && item.clicks !== "" ? Number(item.clicks) : null;
        if (!Number.isFinite(placementValue) || placementValue < 0) placementValue = null;
        var evidenceValue = confirmedEvidenceClicksForPlacement(item);
        if (placementValue == null) return evidenceValue;
        if (evidenceValue == null) return placementValue;
        return Math.max(placementValue,evidenceValue);
      }
      function placementCountsAsExit(item) {
        if (!item) return false;
        if (effectivePlacementActual(item) != null) return true;
        var blogger = linkedBloggerForPlacement(item);
        return Boolean(blogger && blogger.status === "Вышел" && bloggerCardDate(blogger) && bloggerCardDate(blogger) === placementIsoDate(item));
      }
      function placementActiveOnDate(item,date) {
        if (!item || !/^\d{4}-\d{2}-\d{2}$/.test(String(date || ""))) return false;
        initializeWarmupDates(item);
        var start = String(item.warmupStart || "");
        var end = String(item.warmupEnd || "");
        if (inclusiveIsoDays(start,end).length && date >= start && date <= end) return true;
        return placementIsoDate(item) === date;
      }
      function autoManagerDailyMetrics(name,date,manual) {
        var result = Object.assign(emptyDailyManagerMetrics(name),manual || {});
        var metricRecord = employeeMetricRecord(name);
        result.planOutreach = Number(manual && manual.planOutreach != null ? manual.planOutreach : metricRecord.planOutreach || result.planOutreach || 150);
        result.revenuePlan = Number(metricRecord.revenuePlan || result.revenuePlan || 0);
        if (manual && Number(manual.reportedExits || 0) > 0) result.exitsLn = Number(manual.reportedExits);
        if (manual && Number(manual.reportedPlanReach || 0) > 0) result.planReachLn = Number(manual.reportedPlanReach);
        if (manual && Number(manual.reportedFactReach || 0) > 0) result.factReachLn = Number(manual.reportedFactReach);
        var rows = synchronizedPlacementRecords().filter(function (item) {
          if (!employeeNameMatches(name,item.manager) || !placementActiveOnDate(item,date)) return false;
          var hasPeriod = inclusiveIsoDays(item.warmupStart,item.warmupEnd).length > 0;
          return hasPeriod ? date <= localTodayIso() : placementCountsAsExit(item);
        });
        var rowKeys = {};
        rows.forEach(function (item) { rowKeys[(item.sourceKey || item.tag || "") + "|" + date] = true; });
        var dayReels = reelRecords.filter(function (item) {
          var actual = Number(item.reelsReach || 0) + Number(item.carouselReach || 0);
          var key = (item.sourceKey || item.tag || "") + "|" + date;
          return employeeNameMatches(name,item.manager) && item.sortDate === date && actual > 0 && actual <= MAX_REACH_PER_FORMAT && !rowKeys[key];
        });
        if (!rows.length && !dayReels.length) return result;
        var auto = {exitsLn:0,exitsFit:0,planReachLn:0,factReachLn:0,planReachFit:0,factReachFit:0,extraTags:0,reels:0,transfers:0,onTime:0,evidence:0,commercial:0,barter:0,revenueLn:0,revenueFit:0};
        rows.forEach(function (item) {
          var blogger = linkedBloggerForPlacement(item);
          var direction = blogger ? blogger.brand : "ЛН";
          var isFit = direction === "FIT PRO";
          auto[isFit ? "exitsFit" : "exitsLn"] += 1;
          auto[isFit ? "planReachFit" : "planReachLn"] += Number(item.guaranteed || 0);
          auto[isFit ? "factReachFit" : "factReachLn"] += Number(item.actual || 0);
          auto[isFit ? "revenueFit" : "revenueLn"] += Number(item.revenue || 0);
          if (/reels|рилс|ролик/i.test(item.type || "")) auto.reels += 1;
          if (/доп|отмет/i.test((item.type || "") + " " + (item.warmup || ""))) auto.extraTags += 1;
          if (/перенос/i.test((item.comment || "") + " " + (item.decision || ""))) auto.transfers += 1;
          if (item.actual != null && !/перенос/i.test(item.comment || "")) auto.onTime += 1;
          if (item.dealType === "Коммерция") auto.commercial += 1; else auto.barter += 1;
          if (evidenceReports.some(function (report) { return report.date === date && String(report.blogger || "").toLowerCase().indexOf(String(item.tag || "").toLowerCase().replace(/^@/,"")) >= 0; })) auto.evidence += 1;
        });
        dayReels.forEach(function (item) {
          var blogger = linkedBloggerForPlacement(item);
          var isFit = blogger && blogger.brand === "FIT PRO";
          var actual = Number(item.reelsReach || 0) + Number(item.carouselReach || 0);
          auto[isFit ? "exitsFit" : "exitsLn"] += 1;
          auto[isFit ? "planReachFit" : "planReachLn"] += Number(item.guaranteed || 0);
          auto[isFit ? "factReachFit" : "factReachLn"] += actual;
          auto[isFit ? "revenueFit" : "revenueLn"] += Number(item.revenue || 0);
          auto.reels += 1;
          auto.onTime += 1;
          auto.barter += 1;
        });
        Object.keys(auto).forEach(function (field) { result[field] = auto[field]; });
        result._missing = !manual;
        return result;
      }
      function selectedDailyManagerMetrics() {
        var date = document.getElementById("managerDailyDateFilter").value || localTodayIso();
        var source = dailyManagerReports[date] || {};
        return activeEmployeeManagers().reduce(function (result,name) {
          result[name] = autoManagerDailyMetrics(name,date,employeeNamedRecord(source,name));
          return result;
        },{});
      }
      function dailyDateLabel(value) {
        if (!value) return "—";
        var parts = value.split("-");
        return parts.length === 3 ? parts[2] + "." + parts[1] + "." + parts[0] : value;
      }
      function emptyDailyAssistantMetrics(name) {
        var employee = employees.find(function (item) { return item.name === name && item.role === "assistant"; });
        var base = {};
        Object.keys(dailyAssistantReports).sort().reverse().some(function (date) {
          var previous = employeeNamedRecord(dailyAssistantReports[date] || {},name);
          if (!previous) return false;
          base = previous;
          return true;
        });
        return {manager:employee && employee.assignedManager || base.manager || activeEmployeeManagers()[0] || "",plan:Number(base.plan || 325),fact:0,replies:0,approvals:0,refusals:0,dialog:0,transferred:0,comment:"",_missing:true};
      }
      function renderAssistantDailySummary(selectedName) {
        var date = document.getElementById("managerDailyDateFilter").value || localTodayIso();
        var source = dailyAssistantReports[date] || {};
        var names = selectedName && activeEmployeeAssistants().indexOf(selectedName) >= 0 ? [selectedName] : selectedName ? [] : activeEmployeeAssistants();
        document.getElementById("assistantDailyTable").innerHTML = names.map(function (name) {
          var item = source[name] || emptyDailyAssistantMetrics(name);
          var planPct = rate(item.fact,item.plan);
          var transferPct = rate(item.transferred,item.fact);
          var badgeClassName = item._missing ? "badge-red" : planPct >= 100 ? "badge-green" : planPct >= 80 ? "badge-amber" : "badge-red";
          var status = item._missing ? "Отчёт не заполнен" : planPct >= 100 ? "План выполнен" : "Ниже плана";
          return '<tr><td><div class="blogger-cell"><div class="mini-avatar">' + initials(name) + '</div><div><strong>' + name + '</strong><small>Ассистент</small></div></div></td><td><b>' + dailyDateLabel(date) + '</b></td><td>' + safeText(item.manager) + '</td><td>' + number(item.plan) + '</td><td><b>' + number(item.fact) + '</b></td><td><span class="' + metricState(planPct,100) + '">' + percent(planPct,1) + '</span></td><td>' + number(item.replies) + '</td><td>' + number(item.approvals) + '</td><td>' + number(item.refusals || 0) + '</td><td>' + number(item.dialog || 0) + '</td><td><b>' + number(item.transferred) + '</b></td><td>' + percent(transferPct,1) + '</td><td>' + safeText(item.comment || '—') + '</td><td><span class="badge ' + badgeClassName + '">' + status + '</span></td></tr>';
        }).join("") || '<tr><td colspan="14"><div class="empty-state">По выбранному сотруднику отчёта ассистента нет.</div></td></tr>';
      }
      function fillAssistantReportForm(name) {
        var date = document.getElementById("assistantReportDate").value || document.getElementById("managerDailyDateFilter").value || localTodayIso();
        var item = (dailyAssistantReports[date] || {})[name] || emptyDailyAssistantMetrics(name);
        document.getElementById("assistantReportName").value = name;
        document.getElementById("assistantReportManager").value = item.manager;
        document.getElementById("assistantReportPlan").value = item.plan;
        document.getElementById("assistantReportFact").value = item.fact;
        document.getElementById("assistantReportReplies").value = item.replies;
        document.getElementById("assistantReportApprovals").value = item.approvals;
        document.getElementById("assistantReportRefusals").value = item.refusals || 0;
        document.getElementById("assistantReportDialog").value = item.dialog || 0;
        document.getElementById("assistantReportTransferred").value = item.transferred;
        document.getElementById("assistantReportComment").value = item.comment || "";
      }
      function aggregateManagerMetrics(source) {
        source = source || managerMetrics;
        var fields = ["planOutreach","outreach","replies","approvals","closedBloggers","refusals","dialog","exitsLn","exitsFit","planReachLn","factReachLn","planReachFit","factReachFit","extraTags","reels","transfers","onTime","evidence","commercial","barter","revenueLn","revenueFit","revenuePlan"];
        return activeEmployeeManagers().reduce(function (total, name) {
          var item = source[name] || emptyDailyManagerMetrics(name);
          fields.forEach(function (field) { total[field] = (total[field] || 0) + Number(item[field] || 0); });
          return total;
        }, {});
      }
      function currentManagerMetrics() {
        var filter = document.getElementById("managerMetricsFilter").value;
        var source = selectedDailyManagerMetrics();
        return filter === "all" ? aggregateManagerMetrics(source) : (source[filter] || emptyDailyManagerMetrics(filter));
      }
      function monthFromDateValue(value) {
        var raw = String(value || "").trim();
        if (/^\d{4}-\d{2}/.test(raw)) return raw.slice(0,7);
        var match = raw.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
        return match ? match[3] + "-" + String(match[2]).padStart(2,"0") : "";
      }
      function placementIsoDate(item) {
        if (/^\d{4}-\d{2}-\d{2}$/.test(String(item && item.sortDate || ""))) return item.sortDate;
        var match = String(item && item.start || "").match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
        return match ? match[3] + "-" + String(match[2]).padStart(2,"0") + "-" + String(match[1]).padStart(2,"0") : "";
      }
      function localTodayIso() {
        var now = new Date();
        return [now.getFullYear(),String(now.getMonth()+1).padStart(2,"0"),String(now.getDate()).padStart(2,"0")].join("-");
      }
      function currentWeekBounds() {
        var today = new Date(localTodayIso() + "T00:00:00");
        var offset = (today.getDay() + 6) % 7;
        var start = new Date(today); start.setDate(today.getDate()-offset);
        var end = new Date(start); end.setDate(start.getDate()+6);
        function iso(date) { return [date.getFullYear(),String(date.getMonth()+1).padStart(2,"0"),String(date.getDate()).padStart(2,"0")].join("-"); }
        return {start:iso(start),end:iso(end)};
      }
      function monthlyPlanSetting(manager,month) {
        if (!monthlyManagerPlans[month]) monthlyManagerPlans[month] = {};
        if (!monthlyManagerPlans[month][manager]) {
          monthlyManagerPlans[month][manager] = {
            exits:0,
            reach:Number(KPI_RULES.planReach || 0),
            revenue:Number((managerMetrics[manager] || {}).revenuePlan || 0)
          };
        }
        return monthlyManagerPlans[month][manager];
      }
      function monthlyManagerFact(manager,month) {
        var releasedPlacements = synchronizedPlacementRecords().filter(function (item) {
          return employeeNameMatches(manager,item.manager) && (monthFromDateValue(item.sortDate) || monthFromDateValue(item.start)) === month && placementCountsAsExit(item);
        });
        var placementKeys = {};
        releasedPlacements.forEach(function (item) { placementKeys[(item.sourceKey || item.tag || "") + "|" + (item.sortDate || item.start || "")] = true; });
        var validReels = reelRecords.filter(function (item) {
          var actual = Number(item.reelsReach || 0) + Number(item.carouselReach || 0);
          var key = (item.sourceKey || item.tag || "") + "|" + (item.sortDate || item.date || "");
          return employeeNameMatches(manager,item.manager) && (monthFromDateValue(item.sortDate) || monthFromDateValue(item.date)) === month && actual > 0 && actual <= MAX_REACH_PER_FORMAT && !placementKeys[key];
        });
        var placementDates = {};
        var combined = releasedPlacements.reduce(function (total,item) {
          if (item.sortDate) placementDates[item.sortDate] = true;
          total.exits += 1;
          total.guaranteed += Number(item.guaranteed || 0);
          total.reach += Number(effectivePlacementActual(item) || 0);
          total.revenue += Number(item.revenue || 0);
          return total;
        },{exits:0,guaranteed:0,reach:0,revenue:0,dailyDays:0});
        validReels.forEach(function (item) {
          if (item.sortDate) placementDates[item.sortDate] = true;
          combined.exits += 1;
          combined.guaranteed += Number(item.guaranteed || 0);
          combined.reach += Number(item.reelsReach || 0) + Number(item.carouselReach || 0);
          combined.revenue += Number(item.revenue || 0);
        });
        Object.keys(dailyManagerReports).filter(function (date) { return date.slice(0,7) === month && !placementDates[date] && !releasedPlacements.length && !validReels.length; }).forEach(function (date) {
          var manual = employeeNamedRecord(dailyManagerReports[date] || {},manager);
          if (!manual) return;
          var item = autoManagerDailyMetrics(manager,date,manual);
          combined.exits += Number(item.exitsLn || 0) + Number(item.exitsFit || 0);
          combined.guaranteed += Number(item.planReachLn || 0) + Number(item.planReachFit || 0);
          combined.reach += Number(item.factReachLn || 0) + Number(item.factReachFit || 0);
          combined.revenue += Number(item.revenueLn || 0) + Number(item.revenueFit || 0);
          combined.dailyDays += 1;
        });
        if (releasedPlacements.length || validReels.length || combined.dailyDays) {
          return {
            exits:combined.exits,
            guaranteed:combined.guaranteed,
            reach:combined.reach,
            revenue:combined.revenue,
            source:releasedPlacements.length && validReels.length ? "Единый реестр + Reels/карусели" : releasedPlacements.length ? "Единый реестр" : validReels.length ? "Reels/карусели" : "Ежедневная сводка"
          };
        }
        var releasedBloggers = bloggers.filter(function (item) {
          return employeeNameMatches(manager,item.manager) && item.status === "Вышел" && (monthFromDateValue(item.last) || monthFromDateValue(item.sortDate)) === month;
        });
        var reachAnomalies = releasedBloggers.filter(function (item) { var value = Number(item.reach); return !Number.isFinite(value) || value < 0 || value > MAX_BLOGGER_REACH; }).length;
        return {
          exits:releasedBloggers.length,
          guaranteed:0,
          reach:releasedBloggers.reduce(function (sum,item) { var value = Number(item.reach); return sum + (Number.isFinite(value) && value >= 0 && value <= MAX_BLOGGER_REACH ? value : 0); },0),
          revenue:releasedBloggers.reduce(function (sum,item) { return sum + Number(item.revenue || 0); },0),
          source:"Карточки блогеров" + (reachAnomalies ? " · исключено аномалий: " + reachAnomalies : "")
        };
      }
      function monthlyPlanInput(manager,month,field,value) {
        if (role !== "leader") return '<b>' + (field === "revenue" ? money(value) : number(value)) + '</b>';
        return '<input class="inline-edit-control inline-edit-number" type="number" min="0" value="' + Number(value || 0) + '" data-monthly-plan="' + safeText(manager) + '" data-monthly-month="' + month + '" data-monthly-field="' + field + '">';
      }
      function renderMonthlyPlanFact() {
        var month = document.getElementById("managerMonthlyPlanFilter").value || "2026-07";
        var filter = document.getElementById("managerMetricsFilter").value;
        var managers = filter === "all" ? activeEmployeeManagers() : [filter];
        var totals = {planExits:0,factExits:0,planReach:0,guaranteedReach:0,factReach:0,planRevenue:0,factRevenue:0};
        var rows = managers.map(function (manager) {
          var plan = monthlyPlanSetting(manager,month);
          var fact = monthlyManagerFact(manager,month);
          var exitsPct = rate(fact.exits,plan.exits);
          var reachPct = rate(fact.reach,plan.reach);
          var revenuePct = rate(fact.revenue,plan.revenue);
          totals.planExits += Number(plan.exits || 0); totals.factExits += fact.exits;
          totals.planReach += Number(plan.reach || 0); totals.guaranteedReach += Number(fact.guaranteed || 0); totals.factReach += fact.reach;
          totals.planRevenue += Number(plan.revenue || 0); totals.factRevenue += fact.revenue;
          return '<tr><td><div class="blogger-cell"><div class="mini-avatar">' + initials(manager) + '</div><div><strong>' + safeText(manager) + '</strong><small>План на месяц</small></div></div></td><td>' + monthlyPlanInput(manager,month,"exits",plan.exits) + '</td><td><b>' + number(fact.exits) + '</b></td><td><span class="' + metricState(exitsPct,100) + '">' + percent(exitsPct,1) + '</span></td><td>' + monthlyPlanInput(manager,month,"reach",plan.reach) + '</td><td><b>' + number(fact.guaranteed) + '</b></td><td><b>' + number(fact.reach) + '</b></td><td><span class="' + metricState(reachPct,100) + '">' + percent(reachPct,1) + '</span></td><td>' + monthlyPlanInput(manager,month,"revenue",plan.revenue) + '</td><td><b>' + money(fact.revenue) + '</b></td><td><span class="' + metricState(revenuePct,100) + '">' + percent(revenuePct,1) + '</span></td><td><span class="badge badge-blue">' + fact.source + '</span></td></tr>';
        });
        document.getElementById("managerMonthlyPlanTable").innerHTML = rows.join("");
        var exitsPct = rate(totals.factExits,totals.planExits);
        var reachPct = rate(totals.factReach,totals.planReach);
        var revenuePct = rate(totals.factRevenue,totals.planRevenue);
        var cards = [
          {label:"Выходы за месяц",value:number(totals.factExits),foot:"план " + number(totals.planExits),pct:exitsPct,icon:"▶"},
          {label:"Гарантированный охват",value:number(totals.guaranteedReach),foot:"по интеграциям",pct:rate(totals.factReach,totals.guaranteedReach),icon:"◎"},
          {label:"Охват за месяц",value:number(totals.factReach),foot:"план " + number(totals.planReach),pct:reachPct,icon:"◉"},
          {label:"Выручка за месяц",value:money(totals.factRevenue),foot:"план " + money(totals.planRevenue),pct:revenuePct,icon:"₽"}
        ];
        document.getElementById("monthlyPlanKpis").innerHTML = cards.map(function (card) {
          return '<article class="card kpi"><div class="kpi-top"><span>' + card.label + '</span><span class="kpi-icon">' + card.icon + '</span></div><div class="kpi-value">' + card.value + '</div><div class="kpi-foot"><span class="' + metricState(card.pct,100) + '">' + percent(card.pct,1) + '</span> ' + card.foot + '</div><div class="plan-row"><div><span>Факт / план</span><span>' + percent(card.pct,0) + '</span></div><div class="progress"><i style="width:' + Math.min(100,card.pct) + '%"></i></div></div></article>';
        }).join("");
        var now = new Date();
        document.getElementById("monthlyPlanFactBadge").textContent = "Автообновление · " + now.toLocaleTimeString("ru-RU",{hour:"2-digit",minute:"2-digit"});
        renderDashboardMonthSummary();
      }
      function systemMonthKey() {
        var now = new Date();
        return now.getFullYear() + "-" + String(now.getMonth()+1).padStart(2,"0");
      }
      function activeOperationalMonth() {
        return departmentMonths.filter(function (item) { return item.status === "active"; }).sort(function (a,b) { return String(b.month).localeCompare(String(a.month)); })[0] || null;
      }
      function activeMonthKey() {
        var active = activeOperationalMonth();
        if (active) return active.month;
        var latest = departmentMonths.slice().sort(function (a,b) { return String(b.month).localeCompare(String(a.month)); })[0];
        return latest ? latest.month : systemMonthKey();
      }
      function activeMonthLabel(month) {
        var parts = String(month || systemMonthKey()).split("-");
        var label = new Date(Number(parts[0]),Number(parts[1])-1,1).toLocaleDateString("ru-RU",{month:"long",year:"numeric"});
        return label.charAt(0).toUpperCase() + label.slice(1);
      }
      function nextMonthKey(month) {
        var parts = String(month || systemMonthKey()).split("-");
        var date = new Date(Number(parts[0]),Number(parts[1]),1);
        return date.getFullYear() + "-" + String(date.getMonth()+1).padStart(2,"0");
      }
      function allDepartmentMonthKeys() {
        var keys = departmentMonths.map(function (item) { return item.month; });
        synchronizedPlacementRecords().forEach(function (item) {
          [item.sortDate || item.start,item.warmupStart,item.warmupEnd].forEach(function (dateValue) { var value = monthFromDateValue(dateValue); if (value) keys.push(value); });
        });
        weeklyExits.forEach(function (item) { var value = monthFromDateValue(item.sortDate); if (value) keys.push(value); });
        bloggers.forEach(function (item) {
          [monthFromDateValue(item.createdAt),monthFromDateValue(item.sortDate),monthFromDateValue(item.last)].forEach(function (value) { if (value) keys.push(value); });
        });
        return keys.filter(function (value,index,array) { return /^\d{4}-\d{2}$/.test(String(value || "")) && array.indexOf(value) === index; }).sort().reverse();
      }
      function refreshMonthFilters(forceMonth) {
        var months = allDepartmentMonthKeys();
        var fallback = forceMonth || activeMonthKey();
        ["bloggerMonthFilter","placementMonthFilter","exitMonthFilter"].forEach(function (id) {
          var select = document.getElementById(id);
          if (!select) return;
          var previous = select.value;
          var wasReady = select.dataset.monthReady === "true";
          select.innerHTML = '<option value="">Все месяцы</option>' + months.map(function (value) { return '<option value="' + value + '">' + activeMonthLabel(value) + '</option>'; }).join("");
          var target = forceMonth || (wasReady ? previous : fallback);
          select.value = months.indexOf(target) >= 0 ? target : "";
          select.dataset.monthReady = "true";
        });
      }
      function renderDepartmentMonthControl() {
        var active = activeOperationalMonth();
        var latest = departmentMonths.slice().sort(function (a,b) { return String(b.month).localeCompare(String(a.month)); })[0];
        var next = nextMonthKey(latest ? latest.month : systemMonthKey());
        document.getElementById("departmentMonthTitle").textContent = active ? "Рабочий месяц · " + activeMonthLabel(active.month) : "Рабочий месяц закрыт";
        document.getElementById("departmentMonthHint").textContent = active ? "Этот период автоматически выбран в блогерах, размещениях и выходах" : "Добавьте " + activeMonthLabel(next) + ", чтобы продолжить работу в новом периоде";
        var status = document.getElementById("departmentMonthStatus");
        status.className = "badge " + (active ? "badge-green" : "badge-amber");
        status.textContent = active ? "Активен" : "Ожидает нового месяца";
        var closeButton = document.getElementById("closeDepartmentMonthBtn");
        var addButton = document.getElementById("addNextDepartmentMonthBtn");
        closeButton.disabled = !active;
        closeButton.textContent = active ? "Закрыть " + activeMonthLabel(active.month) : "Месяц закрыт";
        addButton.disabled = !!active;
        addButton.textContent = "Добавить " + activeMonthLabel(next);
        addButton.dataset.nextMonth = next;
        var archived = departmentMonths.filter(function (item) { return item.status === "archived"; }).sort(function (a,b) { return String(b.month).localeCompare(String(a.month)); });
        var details = document.getElementById("departmentMonthArchiveDetails");
        details.classList.toggle("hidden",!archived.length);
        document.getElementById("departmentMonthArchiveTitle").textContent = "Архив месяцев · " + archived.length;
        document.getElementById("departmentMonthArchive").innerHTML = archived.map(function (item) {
          var closed = item.closedAt ? new Date(item.closedAt).toLocaleDateString("ru-RU") : "—";
          return '<div class="quality-item"><div><strong>' + activeMonthLabel(item.month) + '</strong><small>Закрыт ' + closed + ' · данные доступны только через фильтр периода</small></div><div class="actions"><button class="btn btn-sm btn-outline" type="button" data-archive-month="' + item.month + '" data-archive-page="bloggers">Блогеры</button><button class="btn btn-sm btn-outline" type="button" data-archive-month="' + item.month + '" data-archive-page="placements">Размещения</button><button class="btn btn-sm btn-outline" type="button" data-archive-month="' + item.month + '" data-archive-page="calendar">Выходы</button></div></div>';
        }).join("");
      }
      function persistDepartmentMonth(action,month) {
        return apiFetch("/api/department-months",{method:"POST",headers:{"content-type":"application/json","x-nsl-role":role},body:JSON.stringify({action:action,month:month})}).then(function (response) {
          return response.json().catch(function () { return {}; }).then(function (data) { if (!response.ok) throw new Error(data.error || "Не удалось обновить рабочий месяц"); return data; });
        });
      }
      function hydrateDepartmentMonths() {
        return apiFetch("/api/department-months",{headers:{"cache-control":"no-store"}}).then(function (response) {
          if (!response.ok) throw new Error("department month sync failed");
          return response.json();
        }).then(function (data) {
          if (Array.isArray(data.periods) && data.periods.length) departmentMonths = data.periods;
          refreshMonthFilters();
          renderDepartmentMonthControl();
          renderCurrentPageData();
        }).catch(function () { renderDepartmentMonthControl(); });
      }
      function openDepartmentMonthArchive(page,month) {
        var filterId = page === "bloggers" ? "bloggerMonthFilter" : page === "placements" ? "placementMonthFilter" : "exitMonthFilter";
        var select = document.getElementById(filterId);
        if (select) select.value = month;
        navigate(page);
        if (page === "bloggers") renderBloggers();
        else if (page === "placements") { placementPage = 1; expandedPlacementId = null; renderPlacementRecords(); }
        else { exitPage = 1; renderWeeklyExits(); }
      }
      function dashboardReportDates(month) {
        return Object.keys(dailyManagerReports).concat(Object.keys(dailyAssistantReports)).filter(function (date,index,array) {
          return date.slice(0,7) === month && array.indexOf(date) === index;
        }).sort().reverse();
      }
      function managerOutreachSummary(manager,month,date) {
        var daily = employeeNamedRecord(dailyManagerReports[date] || {},manager) || {};
        var metricRecord = employeeMetricRecord(manager);
        return Object.keys(dailyManagerReports).filter(function (itemDate) { return itemDate.slice(0,7) === month; }).reduce(function (total,itemDate) {
          var item = employeeNamedRecord(dailyManagerReports[itemDate] || {},manager);
          if (item) {
            total.monthPlan += Number(item.planOutreach || metricRecord.planOutreach || 150);
            total.monthFact += Number(item.outreach || 0);
          }
          return total;
        },{dayPlan:Number(daily.planOutreach || metricRecord.planOutreach || 150),dayFact:Number(daily.outreach || 0),monthPlan:0,monthFact:0});
      }
      function assistantOutreachNames(month) {
        return activeEmployeeAssistants();
      }
      function assistantOutreachSummary(name,month,date) {
        var daily = employeeNamedRecord(dailyAssistantReports[date] || {},name) || {};
        return Object.keys(dailyAssistantReports).filter(function (itemDate) { return itemDate.slice(0,7) === month; }).reduce(function (total,itemDate) {
          var item = employeeNamedRecord(dailyAssistantReports[itemDate] || {},name);
          if (item) {
            total.monthPlan += Number(item.plan || 0);
            total.monthFact += Number(item.fact || 0);
            if (item.manager) total.manager = item.manager;
          }
          return total;
        },{manager:daily.manager || "Не назначен",dayPlan:Number(daily.plan || 0),dayFact:Number(daily.fact || 0),monthPlan:0,monthFact:0});
      }
      function monthlyDepartmentPlanSetting(month) {
        var monthPlans = monthlyManagerPlans[month] || {};
        var value = monthPlans.__department__ || monthPlans["План отдела"] || {};
        return value && typeof value === "object" ? value : {};
      }
      function monthlyExitGuarantee(month,direction) {
        var placementsById = {};
        synchronizedPlacementRecords().forEach(function (item) {
          if (item && item.id != null) placementsById[String(item.id)] = item;
        });
        var candidates = syncedWeeklyExits().map(function (item) {
          var date = String(item.sortDate || "");
          if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || date.slice(0,7) !== month) return null;
          var placement = item.sourcePlacementId != null && item.sourcePlacementId !== "" ? placementsById[String(item.sourcePlacementId)] : null;
          var blogger = linkedBloggerForPlacement(placement || item);
          var itemDirection = placement ? placementDirection(placement) : (item.direction || item.brand || (blogger && blogger.brand) || "ЛН");
          if (itemDirection !== direction) return null;
          var identity = normalizeBloggerIdentity(item.sourceKey || item.tag || item.bloggerLink) || String(item.id || "");
          var source = String((placement && placement.source) || item.source || "").toLowerCase();
          var format = String(item.format || (placement && placement.type) || "").toLowerCase();
          return {identity:identity,date:date,format:format,source:source,value:Math.max(0,Number(item.plannedReach != null ? item.plannedReach : placement && placement.guaranteed || 0))};
        }).filter(Boolean);
        var importedBundles = {};
        candidates.forEach(function (item) {
          if (item.source.indexOf("рилсы и карусели") < 0 || ["reels","рилс","карусель","carousel"].indexOf(item.format) < 0) return;
          var bundle = importedBundles[item.identity] || {value:0,dates:{}};
          bundle.value = Math.max(bundle.value,item.value);
          bundle.dates[item.date] = true;
          importedBundles[item.identity] = bundle;
        });
        var guaranteeByExit = {};
        candidates.forEach(function (item) {
          var bundle = importedBundles[item.identity];
          var isImportedBundle = item.source.indexOf("рилсы и карусели") >= 0 && ["reels","рилс","карусель","carousel"].indexOf(item.format) >= 0;
          if (isImportedBundle || (bundle && bundle.dates[item.date])) return;
          var key = item.identity + "|" + item.date;
          guaranteeByExit[key] = Math.max(Number(guaranteeByExit[key] || 0),item.value);
        });
        var total = Object.keys(guaranteeByExit).reduce(function (sum,key) { return sum + guaranteeByExit[key]; },0);
        return Object.keys(importedBundles).reduce(function (sum,key) { return sum + importedBundles[key].value; },total);
      }
      function monthlyDirectionFact(month,direction) {
        var placementKeys = {};
        var placementReachByKey = {};
        var placementClicksByKey = {};
        var bloggerKeys = {};
        var rows = synchronizedPlacementRecords().filter(function (item) {
          var itemDirection = placementDirection(item);
          var inMonth = (monthFromDateValue(item.sortDate) || monthFromDateValue(item.start)) === month;
          return itemDirection === direction && inMonth && placementCountsAsExit(item);
        });
        var result = rows.reduce(function (total,item) {
          var identity = normalizeBloggerIdentity(item.sourceKey || item.tag || item.bloggerLink) || String(item.id);
          var date = placementIsoDate(item) || item.sortDate || item.start || "";
          var placementKey = identity + "|" + date;
          var actual = Number(effectivePlacementActual(item) || 0);
          var clicks = Number(effectivePlacementClicks(item) || 0);
          placementKeys[placementKey] = true;
          placementReachByKey[placementKey] = Number(placementReachByKey[placementKey] || 0) + actual;
          placementClicksByKey[placementKey] = Math.max(Number(placementClicksByKey[placementKey] || 0),clicks);
          bloggerKeys[identity] = true;
          total.exits += 1;
          total.guaranteed += Number(item.guaranteed || 0);
          total.reach += actual;
          total.clicks += clicks;
          total.leads += Number(item.leads || 0);
          total.sales += Number(item.sales || 0);
          total.revenue += Number(item.revenue || 0);
          total.costs += Number(item.cost || 0);
          return total;
        },{direction:direction,exits:0,guaranteed:0,reach:0,clicks:0,leads:0,sales:0,revenue:0,costs:0,bloggers:0,source:"Единый реестр"});
        reelRecords.forEach(function (item) {
          var blogger = linkedBloggerForPlacement(item);
          var itemDirection = item.direction || item.brand || (blogger && blogger.brand) || "ЛН";
          var actual = Number(item.reelsReach || 0) + Number(item.carouselReach || 0);
          var identity = normalizeBloggerIdentity(item.sourceKey || item.tag || item.bloggerLink) || String(item.id);
          var date = item.sortDate || item.date || "";
          var placementKey = identity + "|" + date;
          if (itemDirection !== direction || monthFromDateValue(date) !== month || actual <= 0 || actual > MAX_REACH_PER_FORMAT || placementKeys[placementKey]) return;
          placementKeys[placementKey] = true;
          placementReachByKey[placementKey] = actual;
          bloggerKeys[identity] = true;
          result.exits += 1;
          result.guaranteed += Number(item.guaranteed || 0);
          result.reach += actual;
          result.clicks += Number(item.clicks || 0);
          result.leads += Number(item.leads || 0);
          result.sales += Number(item.sales || 0);
          result.revenue += Number(item.revenue || 0);
        });
        var evidenceKeys = {};
        var evidenceIncluded = false;
        evidenceReports.forEach(function (report) {
          var date = String(report.date || "");
          var identity = normalizeBloggerIdentity(report.blogger);
          var reach = Number(report.reach || 0);
          if (!identity || date.slice(0,7) !== month || reach <= 0 || reach > MAX_BLOGGER_REACH) return;
          if (report.status && report.status !== "Подтверждено") return;
          var evidenceKey = identity + "|" + date;
          if (evidenceKeys[evidenceKey]) return;
          evidenceKeys[evidenceKey] = true;
          var matches = ensureBloggerLookupIndex().byIdentity[identity] || [];
          var blogger = matches[0];
          if (!blogger || blogger.brand !== direction) return;
          var recordedReach = Number(placementReachByKey[evidenceKey] || 0);
          var reportClicks = Math.max(0,Number(report.clicks || 0));
          var recordedClicks = Number(placementClicksByKey[evidenceKey] || 0);
          if (!placementKeys[evidenceKey]) {
            placementKeys[evidenceKey] = true;
            result.exits += 1;
          }
          if (reach > recordedReach) {
            result.reach += reach - recordedReach;
            placementReachByKey[evidenceKey] = reach;
          }
          if (reportClicks > recordedClicks) {
            result.clicks += reportClicks - recordedClicks;
            placementClicksByKey[evidenceKey] = reportClicks;
          }
          bloggerKeys[identity] = true;
          evidenceIncluded = true;
        });
        if (evidenceIncluded) result.source = "Размещения и подтверждённые отчёты";
        if (!result.exits) {
          bloggers.filter(function (item) {
            return item.brand === direction && item.status === "Вышел" && (monthFromDateValue(item.last) || monthFromDateValue(item.sortDate)) === month;
          }).forEach(function (item) {
            var identity = normalizeBloggerIdentity(item.sourceKey || item.link || item.name || item.display) || String(item.id);
            bloggerKeys[identity] = true;
            result.exits += 1;
            result.reach += Number(item.reach || 0);
            result.clicks += Number(item.clicks || 0);
            result.leads += Number(item.leads || 0);
            result.sales += Number(item.sales || 0);
            result.revenue += Number(item.revenue || 0);
            result.costs += Number(item.spent || 0);
          });
          result.source = "Карточки блогеров";
        }
        result.guaranteed = monthlyExitGuarantee(month,direction);
        result.source = result.source === "Размещения и подтверждённые отчёты" ? "Выходы и подтверждённые отчёты" : "Выходы";
        result.bloggers = Object.keys(bloggerKeys).length;
        return result;
      }
      function dashboardDirectionCard(item,month) {
        var isLn = item.direction === "ЛН";
        var label = isLn ? "Отдел ЛН" : "Отдел FIT PRO";
        var badge = isLn ? "badge-green" : "badge-purple";
        var guaranteePct = rate(item.reach,item.guaranteed);
        return '<article class="kpi" style="border:1px solid ' + (isLn ? 'var(--green)' : '#8d6bd8') + ';border-radius:14px"><div class="kpi-top"><span>' + label + '</span><span class="badge ' + badge + '">' + activeMonthLabel(month) + '</span></div><div class="kpi-value">' + number(item.reach) + '</div><div class="kpi-foot">Фактический охват · <span class="' + metricState(guaranteePct,100,.7) + '">' + percent(guaranteePct,1) + ' гаранта</span></div><div class="team-stats" style="margin-top:12px"><div class="team-stat"><strong>' + number(item.exits) + '</strong><span>Выходы</span></div><div class="team-stat"><strong>' + number(item.guaranteed) + '</strong><span>Гарант</span></div><div class="team-stat"><strong>' + number(item.bloggers) + '</strong><span>Блогеры</span></div><div class="team-stat"><strong>' + number(item.clicks) + '</strong><span>Клики</span></div><div class="team-stat"><strong>' + number(item.leads) + '</strong><span>Лиды</span></div><div class="team-stat"><strong>' + number(item.sales) + '</strong><span>Продажи</span></div><div class="team-stat"><strong>' + money(item.revenue) + '</strong><span>Выручка</span></div></div><div class="table-note" style="margin-top:10px">Источник: ' + safeText(item.source) + '</div></article>';
      }
      function renderDashboardMonthSummary() {
        var month = activeMonthKey();
        var managers = activeEmployeeManagers();
        var dateSelect = document.getElementById("dashboardOutreachDate");
        var previousDate = dateSelect.value;
        var preferredDate = dateSelect.dataset.preferredDate || "";
        var reportDates = dashboardReportDates(month);
        if (!reportDates.length) reportDates = [month + "-01"];
        dateSelect.innerHTML = reportDates.map(function (date) { return '<option value="' + date + '">' + dailyDateLabel(date) + '</option>'; }).join("");
        dateSelect.value = reportDates.indexOf(preferredDate) >= 0 ? preferredDate : reportDates.indexOf(previousDate) >= 0 ? previousDate : reportDates[0];
        delete dateSelect.dataset.preferredDate;
        var selectedDate = dateSelect.value;
        var assistantNames = assistantOutreachNames(month);
        var assistantSummaries = {};
        var totals = {planExits:0,factExits:0,planReach:0,guaranteedReach:0,factReach:0,planRevenue:0,factRevenue:0,dayOutreachPlan:0,dayOutreachFact:0,monthOutreachPlan:0,monthOutreachFact:0};
        assistantNames.forEach(function (name) {
          var item = assistantOutreachSummary(name,month,selectedDate);
          assistantSummaries[name] = item;
          totals.dayOutreachPlan += item.dayPlan; totals.dayOutreachFact += item.dayFact;
          totals.monthOutreachPlan += item.monthPlan; totals.monthOutreachFact += item.monthFact;
        });
        var rows = managers.map(function (manager) {
          var plan = monthlyPlanSetting(manager,month);
          var fact = monthlyManagerFact(manager,month);
          var outreach = managerOutreachSummary(manager,month,selectedDate);
          totals.planExits += Number(plan.exits || 0); totals.factExits += Number(fact.exits || 0);
          totals.planReach += Number(plan.reach || 0); totals.guaranteedReach += Number(fact.guaranteed || 0); totals.factReach += Number(fact.reach || 0);
          totals.planRevenue += Number(plan.revenue || 0); totals.factRevenue += Number(fact.revenue || 0);
          totals.dayOutreachPlan += outreach.dayPlan; totals.dayOutreachFact += outreach.dayFact;
          totals.monthOutreachPlan += outreach.monthPlan; totals.monthOutreachFact += outreach.monthFact;
          var reachPct = rate(fact.reach,plan.reach);
          var revenuePct = rate(fact.revenue,plan.revenue);
          var dailyOutreachPct = rate(outreach.dayFact,outreach.dayPlan);
          var monthOutreachPct = rate(outreach.monthFact,outreach.monthPlan);
          return '<tr><td><div class="blogger-cell"><div class="mini-avatar">' + initials(manager) + '</div><div><strong>' + safeText(manager) + '</strong><small>Действующий месяц</small></div></div></td><td><b>' + number(outreach.dayPlan) + ' / ' + number(outreach.dayFact) + '</b><small style="display:block" class="' + metricState(dailyOutreachPct,100) + '">' + percent(dailyOutreachPct,1) + '</small></td><td><b>' + number(outreach.monthPlan) + ' / ' + number(outreach.monthFact) + '</b><small style="display:block" class="' + metricState(monthOutreachPct,100) + '">' + percent(monthOutreachPct,1) + '</small></td><td><b>' + number(plan.exits) + ' / ' + number(fact.exits) + '</b></td><td>' + number(plan.reach) + ' / <b>' + number(fact.reach) + '</b></td><td><b>' + number(fact.guaranteed) + ' / ' + number(fact.reach) + '</b></td><td><span class="' + metricState(reachPct,100) + '">' + percent(reachPct,1) + '</span></td><td>' + money(plan.revenue) + ' / <b>' + money(fact.revenue) + '</b></td><td><span class="' + metricState(revenuePct,100) + '">' + percent(revenuePct,1) + '</span></td></tr>';
        });
        var directionFacts = [monthlyDirectionFact(month,"ЛН"),monthlyDirectionFact(month,"FIT PRO")];
        var departmentPlan = monthlyDepartmentPlanSetting(month);
        var financeCurrent = currentFinanceData && currentFinanceData.current && currentFinanceData.current.month === month ? currentFinanceData.current : null;
        directionFacts.forEach(function (item) {
          var financeKey = item.direction === "FIT PRO" ? "fit" : "ln";
          var financeRevenue = financeCurrent && financeCurrent.directions && financeCurrent.directions[financeKey] && financeCurrent.directions[financeKey].metrics && financeCurrent.directions[financeKey].metrics.revenue;
          var fallbackValue = item.direction === "FIT PRO" ? departmentPlan.revenueFitFact : departmentPlan.revenueLnFact;
          var sourceValue = financeRevenue && financeRevenue.fact != null ? financeRevenue.fact : fallbackValue;
          if (sourceValue != null && Number.isFinite(Number(sourceValue)) && Number(sourceValue) >= 0) {
            item.revenue = Number(sourceValue);
            item.source = String(item.source || "").replace(/\s*·\s*Выручка:.*$/,"") + " · Выручка: Отчет " + (item.direction === "FIT PRO" ? "FIT PRO" : "ЛН");
          }
        });
        var directionTotal = directionFacts.reduce(function (sum,item) {
          ["exits","guaranteed","reach","clicks","leads","sales","revenue","costs","bloggers"].forEach(function (field) { sum[field] += Number(item[field] || 0); });
          return sum;
        },{exits:0,guaranteed:0,reach:0,clicks:0,leads:0,sales:0,revenue:0,costs:0,bloggers:0});
        totals.factExits = directionTotal.exits;
        totals.guaranteedReach = directionTotal.guaranteed;
        totals.factReach = directionTotal.reach;
        totals.factRevenue = directionTotal.revenue;
        var financeCombinedRevenue = financeCurrent && financeCurrent.combined && financeCurrent.combined.metrics && financeCurrent.combined.metrics.revenue;
        if (financeCombinedRevenue && financeCombinedRevenue.fact != null && Number.isFinite(Number(financeCombinedRevenue.fact))) totals.factRevenue = Number(financeCombinedRevenue.fact);
        else if (departmentPlan.revenueFact != null && Number.isFinite(Number(departmentPlan.revenueFact))) totals.factRevenue = Number(departmentPlan.revenueFact);
        if (Number.isFinite(Number(departmentPlan.revenue)) && Number(departmentPlan.revenue) > 0) totals.planRevenue = Number(departmentPlan.revenue);
        document.getElementById("dashboardDirectionCards").innerHTML = directionFacts.map(function (item) { return dashboardDirectionCard(item,month); }).join("");
        var cards = [
          {label:"Выходы",value:number(totals.factExits),plan:number(totals.planExits),pct:rate(totals.factExits,totals.planExits),icon:"▶"},
          {label:"Гарант охвата",value:number(totals.guaranteedReach),plan:"",planLabel:"факт " + number(totals.factReach),pct:rate(totals.factReach,totals.guaranteedReach),icon:"◎"},
          {label:"Фактический охват",value:number(totals.factReach),plan:number(totals.planReach),pct:rate(totals.factReach,totals.planReach),icon:"◉"},
          {label:"Клики",value:number(directionTotal.clicks),plan:"",planLabel:"от охвата",pct:rate(directionTotal.clicks,totals.factReach),progressLabel:"CTR",icon:"↗"},
          {label:"Выручка",value:money(totals.factRevenue),plan:money(totals.planRevenue),pct:rate(totals.factRevenue,totals.planRevenue),icon:"₽"}
        ];
        document.getElementById("dashboardMonthTitle").textContent = "Сводка за " + activeMonthLabel(month) + " · ЛН и FIT PRO";
        document.getElementById("dashboardMonthBadge").textContent = "Два отдела · " + activeMonthLabel(month).toLowerCase();
        document.getElementById("dashboardMonthKpis").innerHTML = cards.map(function (card) {
          return '<article class="kpi" style="border:1px solid var(--line);border-radius:14px"><div class="kpi-top"><span>' + card.label + '</span><span class="kpi-icon">' + card.icon + '</span></div><div class="kpi-value">' + card.value + '</div><div class="kpi-foot"><span class="' + metricState(card.pct,100) + '">' + percent(card.pct,1) + '</span> · ' + (card.planLabel || "план " + card.plan) + '</div><div class="plan-row"><div><span>' + (card.progressLabel || "Факт / план") + '</span><span>' + percent(card.pct,card.progressLabel ? 1 : 0) + '</span></div><div class="progress"><i style="width:' + Math.min(100,card.pct) + '%"></i></div></div></article>';
        }).join("");
        var outreachCards = [
          {label:"План рассылок за день",value:number(totals.dayOutreachPlan),foot:"все сотрудники",pct:100,icon:"↗"},
          {label:"Факт рассылок за день",value:number(totals.dayOutreachFact),foot:"из " + number(totals.dayOutreachPlan),pct:rate(totals.dayOutreachFact,totals.dayOutreachPlan),icon:"✓"},
          {label:"План рассылок за месяц",value:number(totals.monthOutreachPlan),foot:"накопительный план",pct:100,icon:"◫"},
          {label:"Факт рассылок за месяц",value:number(totals.monthOutreachFact),foot:"из " + number(totals.monthOutreachPlan),pct:rate(totals.monthOutreachFact,totals.monthOutreachPlan),icon:"◎"}
        ];
        document.getElementById("dashboardOutreachKpis").innerHTML = outreachCards.map(function (card) {
          return '<article class="kpi" style="border:1px solid var(--line);border-radius:14px"><div class="kpi-top"><span>' + card.label + '</span><span class="kpi-icon">' + card.icon + '</span></div><div class="kpi-value">' + card.value + '</div><div class="kpi-foot"><span class="' + metricState(card.pct,100) + '">' + percent(card.pct,1) + '</span> · ' + card.foot + '</div><div class="plan-row"><div><span>Факт / план</span><span>' + percent(card.pct,0) + '</span></div><div class="progress"><i style="width:' + Math.min(100,card.pct) + '%"></i></div></div></article>';
        }).join("");
        document.getElementById("dashboardMonthManagers").innerHTML = rows.join("");
        var assistantRows = assistantNames.map(function (name) {
          var item = assistantSummaries[name];
          var dayPct = rate(item.dayFact,item.dayPlan);
          var monthPct = rate(item.monthFact,item.monthPlan);
          return '<tr><td><div class="blogger-cell"><div class="mini-avatar">' + initials(name) + '</div><div><strong>' + safeText(name) + '</strong><small>Ассистент</small></div></div></td><td>' + safeText(item.manager) + '</td><td><b>' + dailyDateLabel(selectedDate) + '</b></td><td><b>' + number(item.dayPlan) + ' / ' + number(item.dayFact) + '</b></td><td><span class="' + metricState(dayPct,100) + '">' + percent(dayPct,1) + '</span></td><td><b>' + number(item.monthPlan) + ' / ' + number(item.monthFact) + '</b></td><td><span class="' + metricState(monthPct,100) + '">' + percent(monthPct,1) + '</span></td></tr>';
        });
        document.getElementById("dashboardAssistantOutreach").innerHTML = assistantRows.length ? assistantRows.join("") : '<tr><td colspan="7"><div class="empty-state">За текущий месяц отчёты ассистентов ещё не заполнены.</div></td></tr>';
        document.getElementById("dashboardAssistantMonthBadge").textContent = activeMonthLabel(month);
        managers.forEach(function (manager) {
          var outreach = managerOutreachSummary(manager,month,selectedDate);
          var fact = monthlyManagerFact(manager,month);
          var bloggerCount = bloggers.filter(function (blogger) { return blogger.manager === manager; }).length;
          var bloggerElement = document.querySelector('[data-team-bloggers="' + manager + '"]');
          var outreachElement = document.querySelector('[data-team-outreach="' + manager + '"]');
          var exitsElement = document.querySelector('[data-team-exits="' + manager + '"]');
          if (bloggerElement) bloggerElement.textContent = number(bloggerCount);
          if (outreachElement) outreachElement.textContent = number(outreach.monthFact);
          if (exitsElement) exitsElement.textContent = number(fact.exits);
        });
        var updated = importedData && importedData.meta.reachUpdatedAt ? importedData.meta.reachUpdatedAt : new Date().toLocaleString("ru-RU");
        document.getElementById("dashboardMonthNote").textContent = "ЛН и FIT PRO рассчитываются отдельно по направлению блогера; фактические охваты обновляются из подтверждённых отчётов, общий итог равен сумме двух отделов. Рассылки обновляются после сохранения ежедневного отчёта · обновлено " + updated + ".";
      }
      function initials(text) {
        var clean = text.replace("@","").replace(/[_\-.]/g," ").trim().split(/\s+/);
        return clean.slice(0,2).map(function (x) { return x.charAt(0).toUpperCase(); }).join("");
      }
      function validManagerName(value) {
        var raw = String(value || "").trim();
        return !!raw && raw !== "Не назначен" && raw !== "Менеджер" && !/^https?:/i.test(raw) && !/^\d{4}-\d{2}/.test(raw) && !/ассистент/i.test(raw);
      }
      function badgeClass(status) {
        return status === "Вышел" ? "badge-green" : status === "Тест" ? "badge-blue" : status === "На оформлении" ? "badge-amber" : "badge-red";
      }
      function contractBadge(status) {
        var cls = status === "Подписан" || status === "Готов" ? "badge-green" : status === "На оформлении" || status === "Запрос данных" ? "badge-amber" : "badge-red";
        return '<span class="badge ' + cls + '">' + status + '</span>';
      }
      function evidencePlaceholder(label, value, color) {
        var svg = '<svg xmlns="http://www.w3.org/2000/svg" width="640" height="480"><rect width="640" height="480" rx="28" fill="' + color + '"/><rect x="38" y="40" width="564" height="400" rx="22" fill="white"/><text x="72" y="105" font-family="Arial" font-size="24" fill="#69766e">Статистика блогера</text><text x="72" y="205" font-family="Arial" font-size="34" font-weight="700" fill="#17211b">' + label + '</text><text x="72" y="285" font-family="Arial" font-size="64" font-weight="800" fill="#1f8a57">' + value + '</text><rect x="72" y="340" width="410" height="18" rx="9" fill="#e9f6ef"/><rect x="72" y="340" width="305" height="18" rx="9" fill="#1f8a57"/></svg>';
        return "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg);
      }
      evidenceReports.forEach(function (report, index) {
        if (!report.images || !report.images.length) {
          report.images = [
            evidencePlaceholder("Охват Stories", new Intl.NumberFormat("ru-RU").format(report.reach), index ? "#edf3ff" : "#e9f6ef"),
            evidencePlaceholder("Клики", new Intl.NumberFormat("ru-RU").format(report.clicks), index ? "#f0ecff" : "#fff3de")
          ];
        }
      });
      function platformHtml(items) {
        return items.map(function (p) {
          var labels = {ig:"IG",tg:"TG",vk:"VK"};
          return '<span class="platform ' + p + '">' + labels[p] + '</span>';
        }).join("");
      }
      function saveData() {
        sessionStorage.setItem("nslBloggers", JSON.stringify(bloggers));
      }
      var sharedStateLastSync = "";
      var sharedStateLastSuccessfulFetch = 0;
      var sharedStateHydrating = false;
      var sharedStateHydrationPromise = null;
      var sharedStateSeedAttempted = false;
      var sharedStateWriteTimer = null;
      var sharedStateWriteQueue = {};
      var sharedStateStatus = "ready";
      var sharedStateChannel = typeof BroadcastChannel !== "undefined" ? new BroadcastChannel("nsl-shared-state-v1") : null;
      function sharedStateClean(value) {
        return JSON.parse(JSON.stringify(value,function (key,item) {
          if (key.charAt && key.charAt(0) === "_") return undefined;
          if (key === "contractFiles") return undefined;
          return item;
        }));
      }
      function sharedStateRecord(namespace,key,value) {
        return {namespace:namespace,key:String(key),value:sharedStateClean(value)};
      }
      function sharedBloggerRecord(blogger) { return sharedStateRecord("blogger",blogger.id,blogger); }
      function sharedNewBloggerRecord(blogger) { return sharedStateRecord("blogger_create",blogger.id,blogger); }
      function sharedContractRecord(blogger) { return sharedStateRecord("blogger_contract",blogger.id,{id:blogger.id,sourceKey:blogger.sourceKey,name:blogger.name,link:blogger.link,commercialContract:blogger.commercialContract,barterContract:blogger.barterContract,cooperationType:blogger.cooperationType}); }
      function sharedPlacementRecord(item) { return sharedStateRecord("placement",item.id,item); }
      function placementDeletionKey(item) {
        if (item && item.sourcePlacementId != null && item.sourcePlacementId !== "") return String(item.sourcePlacementId);
        var identity = normalizeBloggerIdentity((item && (item.sourceKey || item.tag || item.bloggerLink)) || "") || "unknown";
        return ["exit",identity,(item && (item.sortDate || item.date)) || "unknown",String((item && (item.format || item.type)) || "unknown").toLowerCase()].join(":").slice(0,300);
      }
      function placementDeletionSnapshot(item) {
        return {id:item && item.sourcePlacementId != null && item.sourcePlacementId !== "" ? item.sourcePlacementId : "",sourceKey:(item && item.sourceKey) || "",tag:(item && item.tag) || "",bloggerLink:(item && item.bloggerLink) || "",sortDate:(item && item.sortDate) || "",type:(item && (item.type || item.format)) || "",deletedAt:new Date().toISOString()};
      }
      function placementIsDeleted(item) {
        if (!item) return false;
        var sourceId = item.sourcePlacementId != null && item.sourcePlacementId !== "" ? String(item.sourcePlacementId) : (item.id != null && !/^blogger-exit-/.test(String(item.id)) ? String(item.id) : "");
        if (sourceId && deletedPlacements[sourceId]) return true;
        var identity = normalizeBloggerIdentity(item.sourceKey || item.tag || item.bloggerLink || "");
        var date = String(item.sortDate || "");
        if (!identity || !date) return false;
        return Object.keys(deletedPlacements).some(function (key) {
          var deleted = deletedPlacements[key] || {};
          var deletedIdentity = normalizeBloggerIdentity(deleted.sourceKey || deleted.tag || deleted.bloggerLink || "");
          return Boolean(deletedIdentity && deletedIdentity === identity && deleted.sortDate === date);
        });
      }
      function queueSharedStateRecords(records) {
        (records || []).forEach(function (record) {
          if (!record || !record.namespace || record.key == null) return;
          sharedStateWriteQueue[record.namespace + "|" + record.key] = record;
        });
        window.clearTimeout(sharedStateWriteTimer);
        sharedStateWriteTimer = window.setTimeout(flushSharedStateWrites,180);
      }
      function persistSharedStateRecords(records) {
        if (!records || !records.length) return Promise.resolve({records:[]});
        sharedStateStatus = "saving"; renderDataHealth();
        return apiFetch("/api/shared-state",{
          method:"POST",headers:{"content-type":"application/json","x-nsl-role":role},body:JSON.stringify({records:records})
        }).then(function (response) {
          if (!response.ok) return response.json().catch(function () { return {}; }).then(function (data) { throw new Error(data.error || "Не удалось синхронизировать изменения"); });
          return response.json();
        }).then(function (data) {
          sharedStateLastSync = data.latestUpdatedAt || sharedStateLastSync;
          sharedStateStatus = "ready";
          if (sharedStateChannel) sharedStateChannel.postMessage({type:"changed",updatedAt:sharedStateLastSync});
          renderDataHealth();
          return data;
        }).catch(function (error) {
          sharedStateStatus = "error"; renderDataHealth();
          throw error;
        });
      }
      function flushSharedStateWrites() {
        var records = Object.keys(sharedStateWriteQueue).map(function (key) { return sharedStateWriteQueue[key]; });
        sharedStateWriteQueue = {};
        if (!records.length) return Promise.resolve();
        return persistSharedStateRecords(records).catch(function () { showToast("Изменения сохранены локально, общая база временно недоступна"); });
      }
      function sharedBloggerComparable(blogger) {
        var fields = ["name","display","link","platforms","status","manager","brand","reach","leads","sales","revenue","last","sortDate","commercialContract","barterContract","cooperationType","category","spent","admission","comment","importMonth","plannedReach"];
        return fields.reduce(function (result,field) { result[field] = blogger[field] == null ? null : blogger[field]; return result; },{});
      }
      function localSharedSeedRecords() {
        var canonicalBase = consolidateBloggerCards(baseBloggers.map(function (item) { return Object.assign({},item,{platforms:(item.platforms || []).slice()}); }));
        var baseByIdentity = {};
        canonicalBase.forEach(function (item) { baseByIdentity[normalizeBloggerIdentity(item.sourceKey || item.link || item.name)] = item; });
        var records = [];
        bloggers.forEach(function (blogger) {
          var base = baseByIdentity[normalizeBloggerIdentity(blogger.sourceKey || blogger.link || blogger.name)];
          if (!base || JSON.stringify(sharedBloggerComparable(base)) !== JSON.stringify(sharedBloggerComparable(blogger))) records.push(sharedBloggerRecord(blogger));
        });
        customPlacementRecords.forEach(function (item) { records.push(sharedPlacementRecord(item)); });
        Object.keys(dailyManagerReports).forEach(function (date) { Object.keys(dailyManagerReports[date] || {}).forEach(function (name) { records.push(sharedStateRecord("manager_report",date + "|" + name,{date:date,name:name,report:dailyManagerReports[date][name]})); }); });
        Object.keys(dailyAssistantReports).forEach(function (date) { Object.keys(dailyAssistantReports[date] || {}).forEach(function (name) { records.push(sharedStateRecord("assistant_report",date + "|" + name,{date:date,name:name,report:dailyAssistantReports[date][name]})); }); });
        Object.keys(monthlyManagerPlans).forEach(function (month) { Object.keys(monthlyManagerPlans[month] || {}).forEach(function (name) { records.push(sharedStateRecord("monthly_plan",month + "|" + name,{month:month,name:name,plan:monthlyManagerPlans[month][name]})); }); });
        additionalPlacementFormats.forEach(function (item) { records.push(sharedStateRecord("placement_format",item.id,item)); });
        Object.keys(managerMetrics).forEach(function (name) { records.push(sharedStateRecord("manager_metrics",name,{name:name,metrics:managerMetrics[name]})); });
        return records.slice(0,500);
      }
      function normalizeBootstrapBlogger(item,index) {
        var blogger = Object.assign({},item);
        var commercialDefaults = ["Подписан","Нет","Нет","На оформлении","Нет","Подписан","На оформлении","Нет"];
        var barterDefaults = ["Подписан","Подписан","На оформлении","Нет","Подписан","Подписан","Нет","Нет"];
        blogger.commercialContract = blogger.commercialContract || commercialDefaults[index % commercialDefaults.length];
        blogger.barterContract = blogger.barterContract || barterDefaults[index % barterDefaults.length];
        blogger.platforms = Array.isArray(blogger.platforms) && blogger.platforms.length ? blogger.platforms : ["ig"];
        blogger.cooperationType = blogger.cooperationType || (blogger.commercialContract !== "Нет" && blogger.barterContract !== "Нет" ? "Смешанный" : blogger.commercialContract !== "Нет" ? "Коммерция" : "Бартер");
        blogger.contractFiles = [];
        blogger.category = blogger.category || "Без категории";
        if (!blogger.createdAt && Number(blogger.id) > 1000000000000) blogger.createdAt = new Date(Number(blogger.id)).toISOString();
        if (!Number.isFinite(Number(blogger.reach)) || Number(blogger.reach) < 0 || Number(blogger.reach) > MAX_BLOGGER_REACH) { blogger.importedReachWarning = blogger.reach; blogger.reach = 0; }
        if (blogger.status === "В пуле") blogger.status = "Вышел";
        return blogger;
      }
      function applySharedStateRecord(record) {
        if (!record || !record.namespace || !record.value) return;
        var value = record.value;
        if (record.namespace === "bootstrap_meta") {
          importedData = {meta:value};
          datasetVersion = "secure-" + (value.snapshot || "current") + "-" + (value.bloggers || 0);
          sessionStorage.setItem("nslDatasetVersion",datasetVersion);
          return;
        }
        if (record.namespace === "bootstrap_bloggers" && Array.isArray(value)) {
          baseBloggers = value.map(normalizeBootstrapBlogger);
          bloggers = consolidateBloggerCards(baseBloggers.map(function (item) { return Object.assign({},item,{platforms:(item.platforms || []).slice(),contractFiles:[]}); }));
          return;
        }
        if (record.namespace === "bootstrap_placements" && Array.isArray(value)) {
          customPlacementRecords = [];
          placementRecords = value.map(function (item) {
            var placement = Object.assign({},item);
            if (placement.actual != null && placement.actual !== "") {
              var actual = Number(placement.actual);
              if (!Number.isFinite(actual) || actual < 0 || actual > MAX_REACH_PER_FORMAT) { placement.importedActualWarning = placement.actual; placement.actual = null; }
            }
            initializeWarmupDates(placement);
            return placement;
          });
          return;
        }
        if (record.namespace === "bootstrap_reels" && Array.isArray(value)) { reelRecords = value; return; }
        if (record.namespace === "bootstrap_weekly_exits" && Array.isArray(value)) { weeklyExits = value; return; }
        if (record.namespace === "bootstrap_eugenia") {
          importedEugeniaStats = value || {dailyReports:{},monthly:{}};
          Object.keys(importedEugeniaStats.dailyReports || {}).forEach(function (date) {
            if (!dailyManagerReports[date]) dailyManagerReports[date] = {};
            var manager = importedEugeniaStats.manager || "";
            if (manager) dailyManagerReports[date][manager] = importedEugeniaStats.dailyReports[date];
          });
          return;
        }
        if (record.namespace === "bootstrap_kpi_rules" && role === "leader") {
          var incomingRules = value || {};
          var categories = incomingRules.categories || {};
          var tiers = Array.isArray(incomingRules.reachTiers) ? incomingRules.reachTiers : [];
          if (Number(incomingRules.planReach) > 0 && categories.a && categories.b && categories.c && tiers.length) {
            KPI_RULES = incomingRules;
          }
          return;
        }
        if (record.namespace === "blogger" || record.namespace === "blogger_create") {
          var existingBlogger = bloggers.find(function (item) { return String(item.id) === String(value.id); });
          if (!existingBlogger && record.namespace === "blogger") existingBlogger = bloggers.find(function (item) { return normalizeBloggerIdentity(item.sourceKey || item.link || item.name) === normalizeBloggerIdentity(value.sourceKey || value.link || value.name); });
          if (existingBlogger) Object.assign(existingBlogger,value); else bloggers.unshift(value);
          return;
        }
        if (record.namespace === "blogger_contract") {
          var contractBlogger = bloggers.find(function (item) { return String(item.id) === String(value.id); }) || bloggers.find(function (item) { return normalizeBloggerIdentity(item.sourceKey || item.link || item.name) === normalizeBloggerIdentity(value.sourceKey || value.link || value.name); });
          if (contractBlogger) {
            contractBlogger.commercialContract = value.commercialContract || contractBlogger.commercialContract;
            contractBlogger.barterContract = value.barterContract || contractBlogger.barterContract;
            contractBlogger.cooperationType = value.cooperationType || contractBlogger.cooperationType;
          }
          return;
        }
        if (record.namespace === "placement") {
          var existingPlacement = placementRecords.find(function (item) { return String(item.id) === String(value.id); });
          var existingCustom = customPlacementRecords.find(function (item) { return String(item.id) === String(value.id); });
          if (existingPlacement) Object.assign(existingPlacement,value); else placementRecords.unshift(value);
          if (existingCustom) Object.assign(existingCustom,value); else customPlacementRecords.unshift(value);
          initializeWarmupDates(existingPlacement || value);
          return;
        }
        if (record.namespace === "placement_delete") {
          deletedPlacements[String(record.key)] = Object.assign({},value,{deletedAt:value.deletedAt || record.updatedAt || ""});
          return;
        }
        if (record.namespace === "manager_report" && value.date && value.name) {
          if (!dailyManagerReports[value.date]) dailyManagerReports[value.date] = {};
          dailyManagerReports[value.date][value.name] = value.report || {};
          return;
        }
        if (record.namespace === "assistant_report" && value.date && value.name) {
          if (!dailyAssistantReports[value.date]) dailyAssistantReports[value.date] = {};
          dailyAssistantReports[value.date][value.name] = value.report || {};
          return;
        }
        if (record.namespace === "monthly_plan" && value.month && value.name) {
          if (!monthlyManagerPlans[value.month]) monthlyManagerPlans[value.month] = {};
          monthlyManagerPlans[value.month][value.name] = value.plan || {};
          return;
        }
        if (record.namespace === "placement_format") {
          var formatIndex = additionalPlacementFormats.findIndex(function (item) { return String(item.id) === String(value.id); });
          if (formatIndex >= 0) additionalPlacementFormats[formatIndex] = value; else additionalPlacementFormats.push(value);
          return;
        }
        if (record.namespace === "manager_metrics" && value.name) managerMetrics[value.name] = value.metrics || {};
      }
      function cacheSharedStateLocally() {
        sessionStorage.setItem("nslBloggers",JSON.stringify(bloggers));
        sessionStorage.setItem("nslCustomPlacements",JSON.stringify(customPlacementRecords));
        sessionStorage.setItem("nslDailyManagerReports",JSON.stringify(dailyManagerReports));
        sessionStorage.setItem("nslDailyAssistantReports",JSON.stringify(dailyAssistantReports));
        sessionStorage.setItem("nslMonthlyManagerPlans",JSON.stringify(monthlyManagerPlans));
        sessionStorage.setItem("nslPlacementFormats",JSON.stringify(additionalPlacementFormats));
        sessionStorage.setItem("nslManagerMetrics",JSON.stringify(managerMetrics));
        sessionStorage.setItem("nslDeletedPlacements",JSON.stringify(deletedPlacements));
      }
      function refreshAllDerivedViews() {
        function safely(name,callback) {
          try { callback(); }
          catch (error) { console.error("NSL derived view failed:",name,error); }
        }
        safely("invalidate",invalidateDerivedData);
        safely("blogger cards",function () { bloggers = consolidateBloggerCards(bloggers); });
        safely("blogger counters",refreshBloggerCounters);
        safely("local cache",cacheSharedStateLocally);
        safely("imported data",initializeImportedData);
        safely("staff selectors",refreshStaffSelectors);
        safely("KPI controls",populateKpiControls);
        safely("month filters",refreshMonthFilters);
        safely("current page",renderCurrentPageData);
        safely("data health",renderDataHealth);
        if (currentBloggerId) safely("blogger card",function () {
          var current = bloggers.find(function (item) { return String(item.id) === String(currentBloggerId); });
          if (current) { populateCardActualPlacements(current); renderBloggerHistory(current); renderCardContractFiles(current); }
        });
      }
      function hydrateSharedState(options) {
        options = options || {};
        if (sharedStateHydrationPromise) return sharedStateHydrationPromise;
        sharedStateHydrating = true;
        var isFullSharedLoad = Boolean(options.full || !sharedStateLastSync);
        var since = isFullSharedLoad ? "" : ("?since=" + encodeURIComponent(sharedStateLastSync));
        sharedStateHydrationPromise = apiFetch("/api/shared-state" + since,{headers:{"cache-control":"no-store","x-nsl-role":role}}).then(function (response) {
          if (!response.ok) throw new Error("Общая база временно недоступна");
          return response.json();
        }).then(function (data) {
          sharedStateLastSuccessfulFetch = Date.now();
          var remoteBloggerIds = {};
          if (isFullSharedLoad && locallyCreatedBloggerRecovery.length) {
            (data.records || []).forEach(function (record) {
              if (record.namespace === "bootstrap_bloggers" && Array.isArray(record.value)) record.value.forEach(function (item) { if (item && item.id != null) remoteBloggerIds[String(item.id)] = true; });
              else if ((record.namespace === "blogger" || record.namespace === "blogger_create") && record.value && record.value.id != null) remoteBloggerIds[String(record.value.id)] = true;
            });
          }
          var recoveryRecords = isFullSharedLoad ? locallyCreatedBloggerRecovery.filter(function (item) { return !remoteBloggerIds[String(item.id)]; }) : [];
          var applyErrors = 0;
          var orderedRecords = (data.records || []).slice().sort(function (a,b) {
            var aBootstrap = /^bootstrap_/.test(String(a && a.namespace || "")) ? 0 : 1;
            var bBootstrap = /^bootstrap_/.test(String(b && b.namespace || "")) ? 0 : 1;
            return aBootstrap - bBootstrap || String(a && a.updatedAt || "").localeCompare(String(b && b.updatedAt || ""));
          });
          orderedRecords.forEach(function (record) {
            try { applySharedStateRecord(record); }
            catch (error) { applyErrors += 1; console.error("NSL shared record skipped:",record && record.namespace,record && record.key,error); }
          });
          if (recoveryRecords.length) {
            recoveryRecords.forEach(function (item) { bloggers.unshift(item); });
            bloggers = consolidateBloggerCards(bloggers);
            locallyCreatedBloggerRecovery = [];
            persistSharedStateRecords(recoveryRecords.map(sharedNewBloggerRecord)).then(function () {
              saveData(); refreshBloggerCounters();
              showToast("Восстановлено карточек из предыдущей версии: " + recoveryRecords.length);
            }).catch(function () {
              locallyCreatedBloggerRecovery = recoveryRecords;
              showToast("Локальные карточки восстановлены, но общая база пока недоступна");
            });
          }
          if (data.latestUpdatedAt) sharedStateLastSync = data.latestUpdatedAt;
          sharedStateStatus = "ready";
          if (!data.records.length && !sharedStateLastSync && !sharedStateSeedAttempted && role === "leader") {
            sharedStateSeedAttempted = true;
            var seed = localSharedSeedRecords();
            return persistSharedStateRecords(seed).then(function () { refreshAllDerivedViews(); });
          }
          if (data.records.length || options.full) refreshAllDerivedViews(); else renderDataHealth();
          if (applyErrors) console.warn("NSL shared state loaded with skipped records:",applyErrors);
        }).catch(function (error) { sharedStateStatus = "error"; renderDataHealth(); throw error; }).finally(function () {
          sharedStateHydrating = false;
          sharedStateHydrationPromise = null;
        });
        return sharedStateHydrationPromise;
      }
      function dataHealthSnapshot() {
        var month = activeMonthKey();
        var today = localTodayIso();
        var rows = synchronizedPlacementRecords();
        var activeRows = rows.filter(function (item) { return monthFromDateValue(item.sortDate || item.start) === month; });
        var unresolvedFacts = activeRows.filter(function (item) {
          return item.decision !== "Убираем" && item.sortDate && item.sortDate <= today && effectivePlacementActual(item) == null;
        }).length;
        var orphanRows = rows.filter(function (item) { return !linkedBloggerForPlacement(item); }).length;
        var managerMismatches = rows.filter(function (item) {
          var blogger = linkedBloggerForPlacement(item);
          return blogger && item.manager && blogger.manager && item.manager !== blogger.manager;
        }).length;
        var anomalies = bloggers.filter(function (item) { return item.importedReachWarning != null; }).length + rows.filter(function (item) { return item.importedActualWarning != null; }).length;
        return {
          month:month,bloggers:bloggers.length,placements:rows.length,
          mergedCards:bloggers.reduce(function (sum,item) { return sum + Math.max(0,Number(item._mergedCardCount || 1)-1); },0),
          mergedPlacements:rows.reduce(function (sum,item) { return sum + Math.max(0,Number(item._mergedDuplicateCount || 1)-1); },0),
          unresolvedFacts:unresolvedFacts,orphans:orphanRows,managerMismatches:managerMismatches,anomalies:anomalies
        };
      }
      function renderDataHealth() {
        var title = document.getElementById("syncHealthTitle");
        var meta = document.getElementById("syncHealthMeta");
        if (!title || !meta) return;
        var health = dataHealthSnapshot();
        var labels = {saving:"Сохраняю изменения в общей базе",error:"Общая база временно недоступна",ready:"Данные синхронизированы между вкладками"};
        title.textContent = (sharedStateStatus === "saving" ? "↻ " : sharedStateStatus === "error" ? "⚠ " : "✓ ") + labels[sharedStateStatus];
        var details = [health.bloggers + " карточек",health.placements + " размещений"];
        if (health.mergedCards || health.mergedPlacements) details.push("объединено дублей: " + (health.mergedCards + health.mergedPlacements));
        if (health.anomalies) details.push("исключено аномалий: " + health.anomalies);
        if (health.orphans) details.push("без карточки: " + health.orphans);
        if (health.managerMismatches) details.push("расхождений менеджера: " + health.managerMismatches);
        details.push("ожидают факта за " + activeMonthLabel(health.month).toLowerCase() + ": " + health.unresolvedFacts);
        if (sharedStateLastSync) details.push("обновлено " + new Date(sharedStateLastSync).toLocaleTimeString("ru-RU",{hour:"2-digit",minute:"2-digit"}));
        meta.textContent = details.join(" · ");
      }
      function syncAllData(showResult) {
        sharedStateStatus = "saving"; renderDataHealth();
        var tasks = [hydrateSharedState({full:true}),hydrateReachActuals(),hydratePlacementSchedules(),hydrateDepartmentMonths(),hydrateEvidenceReports(),hydrateEmployees()];
        if (role === "leader") tasks.push(hydrateKpiAdjustments(),hydrateKpiMonthBloggers(activeMonthKey()),hydrateFinanceCenter());
        return Promise.allSettled(tasks).then(function (results) {
          var failed = results.filter(function (result) { return result.status === "rejected"; }).length;
          var sharedFailed = results[0] && results[0].status === "rejected";
          sharedStateStatus = sharedFailed ? "error" : "ready";
          refreshAllDerivedViews();
          if (showResult) showToast(sharedFailed ? "Общая база временно недоступна" : failed ? "Общая база загружена, часть дополнительных показателей временно недоступна: " + failed : "Все вкладки и расчёты обновлены");
          return {failed:failed,sharedFailed:sharedFailed,total:results.length};
        });
      }
      var staleSessionRefreshPromise = null;
      function refreshStaleSessionData() {
        if ((!currentSession && !adminAccessToken) || !appShell || appShell.classList.contains("hidden")) return Promise.resolve();
        if (staleSessionRefreshPromise) return staleSessionRefreshPromise;
        if (sharedStateLastSuccessfulFetch && Date.now() - sharedStateLastSuccessfulFetch < 5 * 60 * 1000) return Promise.resolve();
        staleSessionRefreshPromise = syncAllData(false).finally(function () { staleSessionRefreshPromise = null; });
        return staleSessionRefreshPromise;
      }
      function employeeRoleLabel(value) {
        return {leader:"Администратор",manager:"Менеджер",assistant:"Ассистент",analyst:"Аналитик"}[value] || "Сотрудник";
      }
      function employeeRoleBadge(value) {
        return value === "manager" ? "badge-blue" : value === "assistant" ? "badge-purple" : value === "leader" ? "badge-amber" : "badge-green";
      }
      function persistEmployee(employee) {
        return apiFetch("/api/employees",{
          method:"POST",
          headers:{"content-type":"application/json","x-nsl-role":role},
          body:JSON.stringify(employee)
        }).then(function (response) {
          if (!response.ok) return response.json().catch(function () { return {}; }).then(function (data) { throw new Error(data.error || "Не удалось сохранить сотрудника"); });
          return response.json();
        }).then(function (data) { return data.employee; });
      }
      function createEmployeeAccess(employeeId) {
        return apiFetch("/api/employees/" + encodeURIComponent(employeeId) + "/invite",{
          method:"POST",
          headers:{"content-type":"application/json","x-nsl-role":role},
          body:JSON.stringify({appUrl:new URL(".",window.location.href).href})
        }).then(function (response) {
          if (!response.ok) return response.json().catch(function () { return {}; }).then(function (data) { throw new Error(data.error || "Не удалось сформировать доступ"); });
          return response.json();
        });
      }
      function removeEmployeeAccess(employeeId) {
        return apiFetch("/api/employees/" + encodeURIComponent(employeeId),{method:"DELETE",headers:{"x-nsl-role":role}}).then(function (response) {
          if (!response.ok) return response.json().catch(function () { return {}; }).then(function (data) { throw new Error(data.error || "Не удалось убрать сотрудника"); });
          return response.json();
        });
      }
      function persistKpiAdjustment(manager,month,sanctions,manualReachKpi) {
        return apiFetch("/api/kpi-adjustments",{
          method:"POST",
          headers:{"content-type":"application/json","x-nsl-role":role},
          body:JSON.stringify({manager:manager,month:month,sanctions:sanctions,manualReachKpi:manualReachKpi})
        }).then(function (response) {
          if (!response.ok) return response.json().catch(function () { return {}; }).then(function (data) { throw new Error(data.error || "Не удалось сохранить санкции"); });
          return response.json();
        }).then(function (data) { return data.adjustment; });
      }
      function hydrateKpiAdjustments() {
        if (role !== "leader") return Promise.resolve();
        return apiFetch("/api/kpi-adjustments",{headers:{"cache-control":"no-store","x-nsl-role":role}}).then(function (response) {
          if (!response.ok) throw new Error("Не удалось загрузить корректировки KPI");
          return response.json();
        }).then(function (data) {
          (data.adjustments || []).forEach(function (item) {
            var setting = salarySetting(item.manager);
            setting.sanctions[item.month] = Number(item.sanctions || 0);
            if (item.manualReachKpi != null) setting.manualReachKpi[item.month] = Number(item.manualReachKpi || 0);
          });
          kpiAdjustmentsLoaded = true;
          sessionStorage.setItem("nslSalarySettings",JSON.stringify(salarySettings));
          renderSalaryTable(); renderEmployees(); loadKpiFromData();
        });
      }
      function hydrateKpiMonthBloggers(month) {
        if (role !== "leader" || !/^\d{4}-\d{2}$/.test(String(month || ""))) return Promise.resolve([]);
        return apiFetch("/api/kpi-bloggers?month=" + encodeURIComponent(month),{headers:{"cache-control":"no-store","x-nsl-role":role}}).then(function (response) {
          if (!response.ok) return response.json().catch(function () { return {}; }).then(function (data) { throw new Error(data.error || "Не удалось загрузить блогеров KPI"); });
          return response.json();
        }).then(function (data) {
          kpiMonthBloggers = kpiMonthBloggers.filter(function (item) { return item.month !== month; }).concat(data.bloggers || []);
          kpiRosterLoadedMonths[month] = true;
          renderKpiBloggerRoster(); renderSalaryTable(); loadKpiFromData();
          return data.bloggers || [];
        });
      }
      function persistKpiMonthBlogger(record) {
        return apiFetch("/api/kpi-bloggers",{method:"POST",headers:{"content-type":"application/json","x-nsl-role":role},body:JSON.stringify(record)}).then(function (response) {
          if (!response.ok) return response.json().catch(function () { return {}; }).then(function (data) { throw new Error(data.error || "Не удалось добавить блогера в KPI"); });
          return response.json();
        }).then(function (data) {
          var saved = data.blogger;
          kpiMonthBloggers = kpiMonthBloggers.filter(function (item) { return !(item.month === saved.month && item.bloggerKey === saved.bloggerKey); });
          kpiMonthBloggers.push(saved);
          kpiRosterLoadedMonths[saved.month] = true;
          return saved;
        });
      }
      function deleteKpiMonthBlogger(month,bloggerKey) {
        return apiFetch("/api/kpi-bloggers?month=" + encodeURIComponent(month) + "&bloggerKey=" + encodeURIComponent(bloggerKey),{method:"DELETE",headers:{"x-nsl-role":role}}).then(function (response) {
          if (!response.ok) return response.json().catch(function () { return {}; }).then(function (data) { throw new Error(data.error || "Не удалось удалить блогера из KPI"); });
          kpiMonthBloggers = kpiMonthBloggers.filter(function (item) { return !(item.month === month && item.bloggerKey === bloggerKey); });
        });
      }
      function cacheEmployees() {
        sessionStorage.setItem("nslEmployees",JSON.stringify(employees));
      }
      function hydrateEmployees() {
        return apiFetch("/api/employees",{headers:{"cache-control":"no-store","x-nsl-role":role}}).then(function (response) {
          if (!response.ok) throw new Error("Не удалось загрузить сотрудников");
          return response.json();
        }).then(function (data) {
          var records = data.employees || [];
          if (!records.length) {
            return Promise.all(baseEmployees.map(persistEmployee)).then(function (saved) { return saved; });
          }
          return records;
        }).then(function (records) {
          records.forEach(function (next) {
            var previous = employees.find(function (item) { return item.id === next.id; });
            if (previous) migrateEmployeeReferences(previous,next);
          });
          employees = records;
          if (currentEmployeeProfile) currentEmployeeProfile = employees.find(function (item) { return item.id === currentEmployeeProfile.id; }) || currentEmployeeProfile;
          employees.forEach(function (employee) {
            if (employee.role === "manager") {
              ensureManagerMetrics(employee.name);
              salarySetting(employee.name).base = Number(employee.baseSalary || 0);
            }
          });
          cacheEmployees();
          sessionStorage.setItem("nslManagerMetrics",JSON.stringify(managerMetrics));
          sessionStorage.setItem("nslSalarySettings",JSON.stringify(salarySettings));
          refreshStaffSelectors();
          populateKpiControls();
          renderEmployees();
          renderSalaryTable();
          loadKpiFromData();
          renderManagerMetrics();
        });
      }
      function renameRecordKey(object,oldName,newName) {
        if (!object || !oldName || oldName === newName || !Object.prototype.hasOwnProperty.call(object,oldName)) return;
        object[newName] = object[oldName];
        delete object[oldName];
      }
      function migrateEmployeeReferences(previous,next) {
        if (!previous || !next || previous.name === next.name) return;
        var oldName = previous.name;
        var newName = next.name;
        bloggers.forEach(function (item) { if (item.manager === oldName) item.manager = newName; });
        placementRecords.forEach(function (item) { if (item.manager === oldName) item.manager = newName; });
        reelRecords.forEach(function (item) { if (item.manager === oldName) item.manager = newName; });
        renameRecordKey(managerMetrics,oldName,newName);
        renameRecordKey(salarySettings,oldName,newName);
        Object.keys(dailyManagerReports).forEach(function (date) { renameRecordKey(dailyManagerReports[date],oldName,newName); });
        Object.keys(monthlyManagerPlans).forEach(function (month) { renameRecordKey(monthlyManagerPlans[month],oldName,newName); });
        Object.keys(dailyAssistantReports).forEach(function (date) {
          renameRecordKey(dailyAssistantReports[date],oldName,newName);
          Object.keys(dailyAssistantReports[date] || {}).forEach(function (assistant) {
            if (dailyAssistantReports[date][assistant].manager === oldName) dailyAssistantReports[date][assistant].manager = newName;
          });
        });
        employees.forEach(function (item) { if (item.assignedManager === oldName) item.assignedManager = newName; });
        saveData();
        sessionStorage.setItem("nslManagerMetrics",JSON.stringify(managerMetrics));
        sessionStorage.setItem("nslDailyManagerReports",JSON.stringify(dailyManagerReports));
        sessionStorage.setItem("nslDailyAssistantReports",JSON.stringify(dailyAssistantReports));
        sessionStorage.setItem("nslMonthlyManagerPlans",JSON.stringify(monthlyManagerPlans));
        sessionStorage.setItem("nslSalarySettings",JSON.stringify(salarySettings));
      }
      function employeeAliases(employeeOrName) {
        var employee = typeof employeeOrName === "string" ? employees.find(function (item) { return item.name === employeeOrName; }) : employeeOrName;
        var values = employee ? [employee.name].concat(Array.isArray(employee.historyAliases) ? employee.historyAliases : []) : [String(employeeOrName || "")];
        var seen = {};
        return values.map(function (value) { return String(value || "").trim(); }).filter(function (value) { var key = value.toLowerCase(); if (!value || seen[key]) return false; seen[key] = true; return true; });
      }
      function employeeNameMatches(employeeOrName,recordName) {
        var normalized = String(recordName || "").trim().toLowerCase();
        return employeeAliases(employeeOrName).some(function (value) { return value.toLowerCase() === normalized; });
      }
      function employeeNamedRecord(source,employeeOrName) {
        source = source || {};
        var aliases = employeeAliases(employeeOrName);
        for (var index = 0; index < aliases.length; index += 1) if (source[aliases[index]]) return source[aliases[index]];
        return null;
      }
      function employeeMetricRecord(employeeOrName) { return employeeNamedRecord(managerMetrics,employeeOrName) || {}; }
      function activeEmployeeManagers() {
        return employees.filter(function (item) {
          if (item.status !== "active") return false;
          if (item.role === "manager") return true;
          return item.role === "leader" && (Number(item.baseSalary || 0) > 0 || (item.historyAliases || []).length > 0);
        }).map(function (item) { return item.name; }).sort(function (a,b) { return a.localeCompare(b,"ru"); });
      }
      function activeEmployeeAssistants() {
        return employees.filter(function (item) { return item.role === "assistant" && item.status === "active"; }).map(function (item) { return item.name; }).sort(function (a,b) { return a.localeCompare(b,"ru"); });
      }
      function activeEmployeeNames() {
        return activeSalaryEmployees().map(function (item) { return item.name; }).sort(function (a,b) { return a.localeCompare(b,"ru"); });
      }
      function ensureManagerMetrics(name) {
        if (name && !managerMetrics[name]) managerMetrics[name] = {planOutreach:0,outreach:0,replies:0,approvals:0,refusals:0,dialog:0,exitsLn:0,exitsFit:0,planReachLn:0,factReachLn:0,planReachFit:0,factReachFit:0,extraTags:0,reels:0,transfers:0,onTime:0,evidence:0,commercial:0,barter:0,revenueLn:0,revenueFit:0,revenuePlan:0};
        return managerMetrics[name];
      }
      function activeSalaryEmployees() {
        return employees.filter(function (item) { return item && item.id && item.name && item.status === "active"; });
      }
      function refreshStaffSelectors() {
        var employeeManagers = activeEmployeeManagers();
        var employeeAssistants = activeEmployeeAssistants();
        var employeeNames = activeEmployeeNames();
        function replaceOptions(id,names,allLabel,allValue) {
          var select = document.getElementById(id);
          if (!select) return;
          var current = select.value;
          var emptyValue = allValue == null ? "all" : String(allValue);
          select.innerHTML = (allLabel ? '<option value="' + safeText(emptyValue) + '">' + safeText(allLabel) + '</option>' : '') + names.map(function (name) { return '<option value="' + safeText(name) + '">' + safeText(name) + '</option>'; }).join("");
          if (names.indexOf(current) >= 0 || (allLabel && current === emptyValue)) select.value = current;
          else select.value = allLabel ? emptyValue : (names[0] || "");
        }
        ["managerFilter","placementManagerFilter","exitManagerFilter"].forEach(function (id) { replaceOptions(id,employeeNames,"Все сотрудники",""); });
        ["editManager","newManager","newPlacementManager","reportManager"].forEach(function (id) { replaceOptions(id,employeeNames); });
        replaceOptions("assistantReportManager",employeeManagers);
        replaceOptions("employeeAssignedManager",employeeManagers);
        replaceOptions("managerMetricsFilter",employeeNames,"Все сотрудники","all");
        replaceOptions("evidenceEmployeeFilter",employeeNames,"Все сотрудники","all");
        replaceOptions("evidenceEmployee",employeeNames);
        replaceOptions("assistantReportName",employeeAssistants);
      }
      function applyReachActualRecord(record) {
        if (!record || !record.placementKey) return;
        var placement = findPlacementByOverrideKey(record.placementKey) || placementRecords.find(function (item) { return legacyPlacementOverrideKey(item) === record.placementKey; });
        var targetKey = placement ? placementOverrideKey(placement) : record.placementKey;
        placementActualOverrides[targetKey] = Number(record.actual || 0);
        placementFormatActuals[targetKey] = Object.assign({},record.facts || {});
        if (placement) {
          placement.actual = Number(record.actual || 0);
          if (record.comment) placement.comment = record.comment;
        }
        invalidateDerivedData();
        return targetKey;
      }
      function persistReachActual(record) {
        return apiFetch("/api/reach-actuals",{
          method:"POST",
          headers:{"content-type":"application/json","x-nsl-role":role},
          body:JSON.stringify(record)
        }).then(function (response) {
          if (!response.ok) return response.json().catch(function () { return {}; }).then(function (data) { throw new Error(data.error || "reach save failed"); });
          return response.json();
        }).then(function (data) { return data.record; });
      }
      function hydrateReachActuals() {
        return apiFetch("/api/reach-actuals",{headers:{"cache-control":"no-store"}}).then(function (response) {
          if (!response.ok) throw new Error("reach load failed");
          return response.json();
        }).then(function (data) {
          var serverCoverage = {};
          (data.records || []).forEach(function (record) {
            var targetKey = applyReachActualRecord(record);
            if (targetKey) serverCoverage[targetKey] = true;
          });
          var cachedRecords = placementRecords.map(function (item) {
            var key = placementOverrideKey(item);
            var facts = placementFormatActuals[key] || {};
            var validFacts = {};
            Object.keys(facts).forEach(function (format) {
              var value = Number(facts[format]);
              if (["stories","reels","carousel","post"].indexOf(format) >= 0 && Number.isFinite(value) && value >= 0 && value <= MAX_REACH_PER_FORMAT) validFacts[format] = value;
            });
            if (serverCoverage[key] || !Object.keys(validFacts).length) return null;
            return {placementKey:key,bloggerKey:String(item.sourceKey || item.tag || item.id),facts:validFacts,comment:item.comment || ""};
          }).filter(Boolean);
          return Promise.all(cachedRecords.map(function (record) { return persistReachActual(record).then(applyReachActualRecord); })).then(function () {
          bloggers.forEach(function (blogger) {
            var hasSavedReach = placementRowsForBlogger(blogger).some(function (item) { return Object.prototype.hasOwnProperty.call(placementActualOverrides,placementOverrideKey(item)); });
            if (hasSavedReach) recalculateBloggerActuals(blogger);
          });
          try {
            sessionStorage.setItem("nslPlacementActualOverrides",JSON.stringify(placementActualOverrides));
            sessionStorage.setItem("nslPlacementFormatActuals",JSON.stringify(placementFormatActuals));
          } catch (cacheError) {}
          if (currentBloggerId) {
            var current = bloggers.find(function (blogger) { return blogger.id === currentBloggerId; });
            if (current) { populateCardActualPlacements(current); renderBloggerHistory(current); }
          }
          renderCurrentPageData();
          });
        });
      }
      function updateWeeklyExitWarmup(item) {
        weeklyExits.forEach(function (exit) {
          var sameId = String(exit.sourcePlacementId || "") === String(item.id || "");
          var samePlacement = exit.sourceKey === item.sourceKey && exit.sortDate === item.sortDate && (!exit.format || exit.format === item.type);
          if (sameId || samePlacement) exit.warmupDay = warmupRangeLabel(item);
        });
      }
      function applyPlacementScheduleRecord(record) {
        if (!record || !record.placementKey) return null;
        var item = findPlacementByOverrideKey(record.placementKey);
        if (!item) return null;
        item.warmupStart = record.warmupStart;
        item.warmupEnd = record.warmupEnd;
        item.warmup = warmupRangeLabel(item);
        updateWeeklyExitWarmup(item);
        invalidateDerivedData();
        return item;
      }
      function persistPlacementSchedule(item,warmupStart,warmupEnd) {
        return apiFetch("/api/placement-schedules",{
          method:"POST",
          headers:{"content-type":"application/json","x-nsl-role":role},
          body:JSON.stringify({placementKey:placementOverrideKey(item),warmupStart:warmupStart,warmupEnd:warmupEnd})
        }).then(function (response) {
          if (!response.ok) return response.json().catch(function () { return {}; }).then(function (data) { throw new Error(data.error || "Не удалось сохранить даты прогрева"); });
          return response.json();
        }).then(function (data) { applyPlacementScheduleRecord(data.record); return data.record; });
      }
      function hydratePlacementSchedules() {
        return apiFetch("/api/placement-schedules",{headers:{"cache-control":"no-store"}}).then(function (response) {
          if (!response.ok) throw new Error("Не удалось загрузить даты прогрева");
          return response.json();
        }).then(function (data) {
          (data.records || []).forEach(applyPlacementScheduleRecord);
          if (currentBloggerId) {
            var blogger = bloggers.find(function (item) { return item.id === currentBloggerId; });
            if (blogger) populateCardActualPlacements(blogger);
          }
          renderCurrentPageData();
        });
      }
      function contractOwnerKey(blogger) {
        return String(blogger.sourceKey || blogger.name || blogger.id);
      }
      function contractWriteHeaders() {
        return {"x-nsl-role":role};
      }
      function refreshContractFiles(blogger) {
        return apiFetch("/api/contracts?blogger=" + encodeURIComponent(contractOwnerKey(blogger))).then(function (response) {
          if (!response.ok) throw new Error("contract list failed");
          return response.json();
        }).then(function (data) {
          blogger.contractFiles = Array.isArray(data.files) ? data.files : [];
          if (currentBloggerId === blogger.id) { renderCardContractFiles(blogger); renderBloggerHistory(blogger); }
          return blogger.contractFiles;
        });
      }
      function storeContractFile(blogger,type,file) {
        var payload = new FormData();
        payload.append("blogger",contractOwnerKey(blogger));
        payload.append("type",type);
        payload.append("file",file,file.name);
        return apiFetch("/api/contracts",{method:"POST",headers:contractWriteHeaders(),body:payload}).then(function (response) {
          if (!response.ok) throw new Error("contract upload failed");
          return response.json();
        });
      }
      function readContractFile(blogger,id) {
        return apiFetch("/api/contracts/" + encodeURIComponent(id) + "?blogger=" + encodeURIComponent(contractOwnerKey(blogger))).then(function (response) {
          if (!response.ok) throw new Error("contract read failed");
          return response.blob();
        });
      }
      function removeContractFile(blogger,id) {
        return apiFetch("/api/contracts/" + encodeURIComponent(id) + "?blogger=" + encodeURIComponent(contractOwnerKey(blogger)),{method:"DELETE",headers:contractWriteHeaders()}).then(function (response) {
          if (!response.ok) throw new Error("contract delete failed");
          return response.json();
        });
      }
      function fileSize(value) {
        var bytes = Number(value || 0);
        if (bytes < 1024) return bytes + " Б";
        if (bytes < 1024 * 1024) return Math.round(bytes / 1024) + " КБ";
        return (bytes / 1024 / 1024).toLocaleString("ru-RU",{maximumFractionDigits:1}) + " МБ";
      }
      function showToast(text) {
        toast.textContent = text;
        toast.classList.add("show");
        window.setTimeout(function () { toast.classList.remove("show"); }, 2300);
      }
      function openLayer(el) {
        closeLayers();
        overlay.classList.add("show");
        el.classList.add("show");
      }
      function closeLayers() {
        overlay.classList.remove("show");
        document.querySelectorAll(".drawer.show,.modal.show").forEach(function (el) { el.classList.remove("show"); });
      }
      function openInfo(title, text) {
        document.getElementById("infoTitle").textContent = title;
        document.getElementById("infoText").textContent = text;
        openLayer(document.getElementById("infoModal"));
      }
      function renderKpis() {
        renderFinanceKpis(currentFinanceData);
      }
      function renderSelectedNonManagerMetrics(employee,selectedDate) {
        var name = employee && employee.name || "Сотрудник";
        document.getElementById("managerFunnelPeriod").textContent = dailyDateLabel(selectedDate);
        if (employee && employee.role === "assistant") {
          var item = (dailyAssistantReports[selectedDate] || {})[name] || emptyDailyAssistantMetrics(name);
          var planPct = rate(item.fact,item.plan);
          var responsePct = rate(item.replies,item.fact);
          var approvalPct = rate(item.approvals,item.replies);
          var transferPct = rate(item.transferred,item.fact);
          var cards = [
            {label:"Рассылки",value:number(item.fact),foot:"из плана " + number(item.plan),pct:planPct,icon:"↗"},
            {label:"Ответы",value:number(item.replies),foot:percent(responsePct,1) + " от рассылок",pct:responsePct,icon:"◎"},
            {label:"Согласия",value:number(item.approvals),foot:percent(approvalPct,1) + " от ответов",pct:approvalPct,icon:"✓"},
            {label:"Передано менеджеру",value:number(item.transferred),foot:percent(transferPct,1) + " от рассылок",pct:transferPct,icon:"▶"}
          ];
          document.getElementById("managerKpiGrid").innerHTML = cards.map(function (card) {
            return '<article class="card kpi"><div class="kpi-top"><span>' + card.label + '</span><span class="kpi-icon">' + card.icon + '</span></div><div class="kpi-value">' + card.value + '</div><div class="kpi-foot"><span class="' + metricState(card.pct,100) + '">' + percent(card.pct,1) + '</span> · ' + card.foot + '</div><div class="plan-row"><div><span>Факт</span><span>' + Math.min(100,Math.round(card.pct)) + '%</span></div><div class="progress"><i style="width:' + Math.min(100,card.pct) + '%"></i></div></div></article>';
          }).join("");
          var stages = [
            {label:"Рассылки",count:item.fact,conversion:100},
            {label:"Ответы",count:item.replies,conversion:responsePct},
            {label:"Согласия",count:item.approvals,conversion:approvalPct},
            {label:"Передано",count:item.transferred,conversion:transferPct}
          ];
          document.getElementById("managerFunnel").innerHTML = stages.map(function (stage) {
            return '<div class="funnel-row"><div class="funnel-label"><strong>' + stage.label + '</strong><small>Ассистент</small></div><div class="funnel-track"><div class="funnel-fill" style="width:' + Math.max(3,Math.min(100,rate(stage.count,item.fact))) + '%">' + number(stage.count) + '</div></div><div class="funnel-conversion"><strong>' + percent(stage.conversion,1) + '</strong><small>конверсия</small></div></div>';
          }).join("");
          document.getElementById("managerQuality").innerHTML = [
            {title:"Статус отчёта",value:item._missing ? "Не заполнен" : "Заполнен",state:item._missing ? "badge-red" : "badge-green"},
            {title:"Выполнение плана",value:percent(planPct,1),state:planPct >= 100 ? "badge-green" : "badge-amber"},
            {title:"Закреплён за",value:item.manager || "Не назначен",state:item.manager ? "badge-blue" : "badge-red"}
          ].map(function (row) { return '<div class="quality-item"><div><strong>' + row.title + '</strong><small>' + employeeRoleLabel(employee.role) + '</small></div><span class="badge ' + row.state + '">' + safeText(row.value) + '</span></div>'; }).join("");
          document.getElementById("managerMetricsTable").innerHTML = '<tr><td colspan="22"><div class="empty-state">Выбран ассистент — его показатели показаны в блоке «Ассистенты» ниже.</div></td></tr>';
          renderAssistantDailySummary(name);
        } else {
          var roleName = employee ? employeeRoleLabel(employee.role) : "Сотрудник";
          document.getElementById("managerKpiGrid").innerHTML = '<div class="card empty-state" style="grid-column:1/-1">Для роли «' + safeText(roleName) + '» ежедневные показатели не ведутся.</div>';
          document.getElementById("managerFunnel").innerHTML = '<div class="empty-state">Выберите менеджера или ассистента.</div>';
          document.getElementById("managerQuality").innerHTML = '<div class="empty-state">Нет показателей за выбранный день.</div>';
          document.getElementById("managerMetricsTable").innerHTML = '<tr><td colspan="22"><div class="empty-state">У сотрудника нет менеджерского отчёта.</div></td></tr>';
          document.getElementById("assistantDailyTable").innerHTML = '<tr><td colspan="14"><div class="empty-state">У сотрудника нет отчёта ассистента.</div></td></tr>';
        }
        renderMonthlyPlanFact();
      }
      function renderManagerMetrics() {
        var employeeFilter = document.getElementById("managerMetricsFilter").value;
        var selectedEmployee = employeeFilter !== "all" ? employeeByName(employeeFilter) : null;
        var selectedDate = document.getElementById("managerDailyDateFilter").value || localTodayIso();
        if (selectedEmployee && selectedEmployee.role !== "manager") return renderSelectedNonManagerMetrics(selectedEmployee,selectedDate);
        var d = currentManagerMetrics();
        document.getElementById("managerFunnelPeriod").textContent = dailyDateLabel(selectedDate);
        var exits = d.exitsLn + d.exitsFit;
        var planReach = d.planReachLn + d.planReachFit;
        var factReach = d.factReachLn + d.factReachFit;
        var revenue = d.revenueLn + d.revenueFit;
        var outreachPct = rate(d.outreach,d.planOutreach);
        var responsePct = rate(d.replies,d.outreach);
        var approvalPct = rate(d.approvals,d.replies);
        var exitPct = rate(exits,d.approvals);
        var reachPct = rate(factReach,planReach);
        var onTimePct = rate(d.onTime,exits);
        var evidencePct = rate(d.evidence,exits);
        var revenuePct = rate(revenue,d.revenuePlan);
        var cards = [
          {label:"Рассылки",value:number(d.outreach),badge:percent(outreachPct,0),foot:"плана " + number(d.planOutreach),progress:"План / факт",width:outreachPct,state:metricState(outreachPct,100),icon:"↗"},
          {label:"Конверсия в ответ",value:percent(responsePct,1),badge:number(d.replies) + " ответов",foot:"цель ≥ 10%",progress:"Ответы / рассылки",width:responsePct / 10 * 100,state:metricState(responsePct,10),icon:"◎"},
          {label:"Согласия из ответов",value:percent(approvalPct,1),badge:number(d.approvals) + " согласий",foot:"цель ≥ 35%",progress:"Согласия / ответы",width:approvalPct / 35 * 100,state:metricState(approvalPct,35),icon:"✓"},
          {label:"Согласие → выход",value:percent(exitPct,1),badge:number(exits) + " выходов",foot:"цель ≥ 55%",progress:"Выходы / согласия",width:exitPct / 55 * 100,state:metricState(exitPct,55),icon:"▶"},
          {label:"Выполнение охвата",value:percent(reachPct,1),badge:number(factReach),foot:"из " + number(planReach),progress:"Факт / план",width:reachPct,state:metricState(reachPct,90),icon:"◉"},
          {label:"Выходы вовремя",value:percent(onTimePct,1),badge:d.onTime + " из " + exits,foot:"цель ≥ 95%",progress:"Без переноса / выходы",width:onTimePct,state:metricState(onTimePct,95),icon:"⌚"},
          {label:"Отчёты с фото",value:percent(evidencePct,1),badge:d.evidence + " из " + exits,foot:"цель 100%",progress:"Подтверждено / выходы",width:evidencePct,state:metricState(evidencePct,100,.75),icon:"▧"},
          {label:"Финансовый план",value:percent(revenuePct,2),badge:money(revenue),foot:"из " + money(d.revenuePlan),progress:"План месяца",width:revenuePct,state:metricState(revenuePct,45,.67),icon:"₽"}
        ];
        document.getElementById("managerKpiGrid").innerHTML = cards.map(function (card) {
          return '<article class="card kpi"><div class="kpi-top"><span>' + card.label + '</span><span class="kpi-icon">' + card.icon + '</span></div><div class="kpi-value">' + card.value + '</div><div class="kpi-foot"><span class="' + card.state + '">' + card.badge + '</span> ' + card.foot + '</div><div class="plan-row"><div><span>' + card.progress + '</span><span>' + Math.min(100,Math.round(card.width)) + '%</span></div><div class="progress"><i style="width:' + Math.min(100,card.width) + '%"></i></div></div></article>';
        }).join("");

        var stages = [
          {label:"Рассылки",count:d.outreach,small:"Исходящий контакт",conversion:100,from:"вся база"},
          {label:"Ответы",count:d.replies,small:"Получен ответ",conversion:responsePct,from:"от рассылок"},
          {label:"Согласия",count:d.approvals,small:"Готовы к работе",conversion:approvalPct,from:"от ответов"},
          {label:"Выходы",count:exits,small:"Публикация вышла",conversion:exitPct,from:"от согласий"},
          {label:"Фотоотчёты",count:d.evidence,small:"Охват подтверждён",conversion:evidencePct,from:"от выходов"}
        ];
        document.getElementById("managerFunnel").innerHTML = stages.map(function (stage) {
          var width = Math.max(3,rate(stage.count,d.outreach));
          return '<div class="funnel-row"><div class="funnel-label"><strong>' + stage.label + '</strong><small>' + stage.small + '</small></div><div class="funnel-track"><div class="funnel-fill" style="width:' + Math.min(100,width) + '%">' + number(stage.count) + '</div></div><div class="funnel-conversion"><strong>' + percent(stage.conversion,1) + '</strong><small>' + stage.from + '</small></div></div>';
        }).join("");

        var missingEvidence = Math.max(0,exits - d.evidence);
        var late = Math.max(0,exits - d.onTime);
        var contractCount = d.commercial + d.barter;
        var quality = [
          {title:"Переносы выходов",text:d.transfers ? "Нужно проверить причины" : "Переносов нет",value:d.transfers,state:d.transfers ? "badge-amber" : "badge-green"},
          {title:"Отчёты без фото",text:missingEvidence ? "Охват пока не подтверждён" : "Все охваты подтверждены",value:missingEvidence,state:missingEvidence ? "badge-red" : "badge-green"},
          {title:"Выходы с опозданием",text:late ? "Нарушен план публикаций" : "Все публикации вовремя",value:late,state:late ? "badge-red" : "badge-green"},
          {title:"Договоры оформлены",text:"Коммерция " + d.commercial + " · бартер " + d.barter,value:contractCount + " / " + exits,state:contractCount >= exits ? "badge-green" : "badge-amber"},
          {title:"Отказы",text:"Фиксировать причину в карточке",value:d.refusals,state:d.refusals ? "badge-amber" : "badge-green"}
        ];
        document.getElementById("managerQuality").innerHTML = quality.map(function (item) {
          return '<div class="quality-item"><div><strong>' + item.title + '</strong><small>' + item.text + '</small></div><span class="badge ' + item.state + '">' + item.value + '</span></div>';
        }).join("");

        var filter = document.getElementById("managerMetricsFilter").value;
        var dailySource = selectedDailyManagerMetrics();
        var names = filter === "all" ? activeEmployeeManagers() : [filter];
        var rows = names.map(function (name) { return managerMetricsRow(name,dailySource[name] || emptyDailyManagerMetrics(name),false,selectedDate); });
        if (filter === "all") rows.push(managerMetricsRow("Итого",aggregateManagerMetrics(dailySource),true,selectedDate));
        document.getElementById("managerMetricsTable").innerHTML = rows.join("");
        renderAssistantDailySummary(employeeFilter === "all" ? "" : employeeFilter);
        renderMonthlyPlanFact();
      }
      function managerMetricsRow(name,d,isTotal,selectedDate) {
        var exits = d.exitsLn + d.exitsFit;
        var planReach = d.planReachLn + d.planReachFit;
        var factReach = d.factReachLn + d.factReachFit;
        var revenue = d.revenueLn + d.revenueFit;
        var responsePct = rate(d.replies,d.outreach);
        var approvalPct = rate(d.approvals,d.replies);
        var reachPct = rate(factReach,planReach);
        var onTimePct = rate(d.onTime,exits);
        var evidencePct = rate(d.evidence,exits);
        var revenuePct = rate(revenue,d.revenuePlan);
        return '<tr class="' + (isTotal ? "manager-total" : "") + '"><td><div class="blogger-cell"><div class="mini-avatar">' + (isTotal ? "Σ" : initials(name)) + '</div><div><strong>' + name + '</strong><small>' + (isTotal ? "Все менеджеры" : d._missing ? "Отчёт не заполнен" : d._source || "Дневной отчёт") + '</small></div></div></td><td><b>' + dailyDateLabel(selectedDate) + '</b></td><td><b>' + number(d.planOutreach) + ' / ' + number(d.outreach) + '</b></td><td>' + number(d.replies) + '</td><td><span class="' + metricState(responsePct,10) + '">' + percent(responsePct,1) + '</span></td><td>' + number(d.approvals) + '</td><td><span class="' + metricState(approvalPct,35) + '">' + percent(approvalPct,1) + '</span></td><td><b>' + number(d.closedBloggers) + '</b></td><td>' + number(d.refusals) + '</td><td>' + number(d.dialog) + '</td><td><b>' + d.exitsLn + ' / ' + d.exitsFit + '</b></td><td>' + number(planReach) + ' / <b>' + number(factReach) + '</b></td><td><span class="' + metricState(reachPct,90) + '">' + percent(reachPct,1) + '</span></td><td>' + d.extraTags + ' / ' + d.reels + '</td><td>' + d.transfers + '</td><td><span class="' + metricState(onTimePct,95) + '">' + percent(onTimePct,1) + '</span></td><td><span class="' + metricState(evidencePct,100,.75) + '">' + percent(evidencePct,1) + '</span></td><td>' + d.commercial + ' / ' + d.barter + '</td><td>' + money(d.revenueLn) + '</td><td>' + money(d.revenueFit) + '</td><td><b>' + money(revenue) + '</b></td><td><span class="' + metricState(revenuePct,45,.67) + '">' + percent(revenuePct,2) + '</span></td></tr>';
      }
      function kpiManagers() {
        return activeEmployeeManagers();
      }
      function kpiMonths() {
        return [activeMonthKey()].concat(departmentMonths.map(function (item) { return item.month; }),synchronizedPlacementRecords().map(function (item) { return (item.sortDate || "").slice(0,7); })).filter(function (value,index,array) { return value && /^\d{4}-\d{2}$/.test(value) && array.indexOf(value) === index; }).sort().reverse();
      }
      function kpiMonthLabel(value) {
        var names = ["Январь","Февраль","Март","Апрель","Май","Июнь","Июль","Август","Сентябрь","Октябрь","Ноябрь","Декабрь"];
        var parts = value.split("-");
        return names[Number(parts[1])-1] + " " + parts[0];
      }
      function salarySetting(manager) {
        if (!salarySettings[manager]) salarySettings[manager] = {base:0,sanctions:{},manualReachKpi:{}};
        if (!salarySettings[manager].sanctions) salarySettings[manager].sanctions = {};
        if (!salarySettings[manager].manualReachKpi) salarySettings[manager].manualReachKpi = {};
        return salarySettings[manager];
      }
      function reachKpiAmount(reach) {
        var tier = KPI_RULES.reachTiers.find(function (item) { return Number(reach || 0) >= item.min; });
        return tier ? tier.amount : 0;
      }
      function employeeByName(name) {
        return employees.find(function (item) { return item.name === name; });
      }
      function kpiEvidenceForPlacement(item) {
        var identities = [item.sourceKey,item.tag,item.bloggerLink].map(normalizeBloggerIdentity).filter(Boolean);
        return evidenceReports.some(function (report) {
          var sameBlogger = identities.indexOf(normalizeBloggerIdentity(report.blogger)) >= 0;
          var sameDate = !report.date || !item.sortDate || report.date === item.sortDate;
          return sameBlogger && sameDate && Array.isArray(report.images) && report.images.length > 0;
        });
      }
      function kpiRowsForManager(manager,month) {
        return synchronizedPlacementRecords().filter(function (item) {
          var actual = Number(item.actual);
          return employeeNameMatches(manager,item.manager) && (item.sortDate || "").slice(0,7) === month && item.actual != null && Number.isFinite(actual) && actual > 0 && actual <= MAX_REACH_PER_FORMAT;
        });
      }
      function calculateManagerSalary(manager,month) {
        var rows = kpiRowsForManager(manager,month);
        var pending = synchronizedPlacementRecords().filter(function (item) { return employeeNameMatches(manager,item.manager) && (item.sortDate || "").slice(0,7) === month && !(item.actual != null && Number(item.actual) > 0 && Number(item.actual) <= MAX_REACH_PER_FORMAT); }).length;
        var counts = {a:0,b:0,c:0};
        var factReach = 0;
        var bloggerReach = {};
        var evidenceCount = 0;
        rows.forEach(function (item) {
          var reach = Number(item.actual || 0);
          factReach += reach;
          if (kpiEvidenceForPlacement(item)) evidenceCount += 1;
          var linkedBlogger = linkedBloggerForPlacement(item);
          var key = linkedBlogger ? "id:" + String(linkedBlogger.id) : (normalizeBloggerIdentity(item.sourceKey || item.tag) || String(item.sourceKey || item.tag));
          bloggerReach[key] = Math.max(Number(bloggerReach[key] || 0),reach);
        });
        var manualRows = kpiMonthBloggers.filter(function (item) { return item.month === month && employeeNameMatches(manager,item.manager); });
        manualRows.forEach(function (item) {
          var key = "id:" + String(item.bloggerKey);
          var previous = Number(bloggerReach[key] || 0);
          var manualReach = Number(item.factReach || 0);
          if (manualReach > previous) factReach += manualReach - previous;
          bloggerReach[key] = Math.max(previous,manualReach);
        });
        factReach = Math.round(factReach);
        Object.keys(bloggerReach).forEach(function (key) {
          var reach = bloggerReach[key];
          if (reach >= KPI_RULES.categories.c.min) counts.c += 1;
          else if (reach >= KPI_RULES.categories.b.min) counts.b += 1;
          else if (reach >= KPI_RULES.categories.a.min) counts.a += 1;
        });
        var setting = salarySetting(manager);
        var employee = employeeByName(manager);
        var base = employee ? Number(employee.baseSalary || 0) : Number(setting.base || 0);
        setting.base = base;
        var bloggerKpi = counts.a * KPI_RULES.categories.a.amount + counts.b * KPI_RULES.categories.b.amount + counts.c * KPI_RULES.categories.c.amount;
        var autoReachKpi = reachKpiAmount(factReach);
        var hasManualReachKpi = Object.prototype.hasOwnProperty.call(setting.manualReachKpi,month);
        var manualReachKpi = hasManualReachKpi ? Number(setting.manualReachKpi[month] || 0) : null;
        var reachKpi = hasManualReachKpi ? manualReachKpi : autoReachKpi;
        var sanctions = Number(setting.sanctions[month] || 0);
        var totalKpi = Math.max(0,bloggerKpi + reachKpi - sanctions);
        return {manager:manager,a:counts.a,b:counts.b,c:counts.c,factReach:factReach,reachPct:factReach/Math.max(1,Number(KPI_RULES.planReach || 0))*100,bloggerKpi:bloggerKpi,autoReachKpi:autoReachKpi,manualReachKpi:manualReachKpi,reachKpi:reachKpi,sanctions:sanctions,totalKpi:totalKpi,base:base,salary:base+totalKpi,confirmed:Object.keys(bloggerReach).length,pending:pending,evidenceCount:evidenceCount,placements:rows.length,manualCount:manualRows.length};
      }
      function kpiReachCategory(reach) {
        if (Number(reach || 0) >= KPI_RULES.categories.c.min) return "C · " + money(KPI_RULES.categories.c.amount);
        if (Number(reach || 0) >= KPI_RULES.categories.b.min) return "B · " + money(KPI_RULES.categories.b.amount);
        if (Number(reach || 0) >= KPI_RULES.categories.a.min) return "A · " + money(KPI_RULES.categories.a.amount);
        return "Не достигнут минимум";
      }
      function populateKpiBloggerSelect() {
        var select = document.getElementById("kpiBloggerSelect");
        var managerSelect = document.getElementById("kpiRosterManagerSelect");
        if (!select || !managerSelect) return;
        var currentBlogger = select.value;
        var currentManager = managerSelect.value || document.getElementById("kpiManagerSelect").value;
        select.innerHTML = bloggers.slice().sort(function (a,b) { return String(a.display || a.name).localeCompare(String(b.display || b.name),"ru"); }).map(function (blogger) { return '<option value="' + safeText(blogger.id) + '">' + safeText(blogger.display || blogger.name) + ' · ' + safeText(blogger.brand) + '</option>'; }).join("");
        managerSelect.innerHTML = kpiManagers().map(function (manager) { return '<option>' + safeText(manager) + '</option>'; }).join("");
        if (Array.from(select.options).some(function (option) { return option.value === currentBlogger; })) select.value = currentBlogger;
        if (kpiManagers().indexOf(currentManager) >= 0) managerSelect.value = currentManager;
        updateKpiBloggerDefaults(false);
      }
      function updateKpiBloggerDefaults(force) {
        var select = document.getElementById("kpiBloggerSelect");
        if (!select) return;
        var blogger = bloggers.find(function (item) { return String(item.id) === String(select.value); });
        var month = document.getElementById("kpiMonthSelect").value || activeMonthKey();
        if (!blogger) return;
        if (force || !document.getElementById("kpiRosterManagerSelect").value) document.getElementById("kpiRosterManagerSelect").value = kpiManagers().indexOf(blogger.manager) >= 0 ? blogger.manager : (document.getElementById("kpiManagerSelect").value || kpiManagers()[0] || "");
        var monthlyReach = placementRowsForBlogger(blogger).filter(function (item) { return (item.sortDate || "").slice(0,7) === month; }).reduce(function (sum,item) { var value = Number(item.actual || 0); return sum + (Number.isFinite(value) && value > 0 ? value : 0); },0);
        var saved = kpiMonthBloggers.find(function (item) { return item.month === month && String(item.bloggerKey) === String(blogger.id); });
        document.getElementById("kpiBloggerReach").value = saved ? Number(saved.factReach || 0) : Math.round(monthlyReach);
        document.getElementById("kpiBloggerNote").value = saved ? saved.note || "" : "";
        if (saved) document.getElementById("kpiRosterManagerSelect").value = saved.manager;
      }
      function renderKpiBloggerRoster() {
        var table = document.getElementById("kpiBloggerRosterTable");
        if (!table) return;
        var month = document.getElementById("kpiMonthSelect").value || activeMonthKey();
        document.getElementById("kpiRosterMonthBadge").textContent = kpiMonthLabel(month);
        var records = kpiMonthBloggers.filter(function (item) { return item.month === month; }).sort(function (a,b) { return String(a.bloggerName).localeCompare(String(b.bloggerName),"ru"); });
        table.innerHTML = records.map(function (item) {
          var blogger = bloggers.find(function (entry) { return String(entry.id) === String(item.bloggerKey); });
          var open = blogger ? ' data-open-blogger="' + safeText(blogger.id) + '"' : '';
          return '<tr><td><div class="blogger-cell' + (blogger ? ' blogger-card-link' : '') + '"' + open + '><div class="mini-avatar">' + initials(item.bloggerName) + '</div><div><strong>' + safeText(item.bloggerName) + '</strong><small>' + (blogger ? 'Открыть карточку' : 'Карточка не найдена') + '</small></div></div></td><td>' + safeText(kpiMonthLabel(item.month)) + '</td><td>' + safeText(item.manager) + '</td><td><b>' + number(item.factReach) + '</b></td><td><span class="badge badge-blue">' + safeText(kpiReachCategory(item.factReach)) + '</span></td><td>' + safeText(item.note || '—') + '</td><td><button class="btn btn-sm btn-outline" type="button" data-remove-kpi-blogger="' + safeText(item.bloggerKey) + '" data-kpi-month="' + safeText(item.month) + '">Удалить</button></td></tr>';
        }).join("") || '<tr><td colspan="7"><div class="empty-state">В ' + kpiMonthLabel(month).toLowerCase() + ' блогеры KPI ещё не добавлены. Добавьте их вручную выше.</div></td></tr>';
      }
      function populateKpiControls() {
        var managers = kpiManagers();
        var months = kpiMonths();
        var currentManager = document.getElementById("kpiManagerSelect").value;
        var currentKpiMonth = document.getElementById("kpiMonthSelect").value || activeMonthKey();
        var currentSalaryMonth = document.getElementById("salaryMonthFilter").value || activeMonthKey();
        var managerOptions = managers.map(function (value) { return '<option>' + safeText(value) + '</option>'; }).join("");
        var monthOptions = months.map(function (value) { return '<option value="' + value + '">' + kpiMonthLabel(value) + '</option>'; }).join("");
        document.getElementById("kpiManagerSelect").innerHTML = managerOptions;
        document.getElementById("kpiMonthSelect").innerHTML = monthOptions;
        document.getElementById("salaryMonthFilter").innerHTML = monthOptions;
        if (managers.indexOf(currentManager) >= 0) document.getElementById("kpiManagerSelect").value = currentManager;
        if (months.indexOf(currentKpiMonth) >= 0) document.getElementById("kpiMonthSelect").value = currentKpiMonth;
        if (months.indexOf(currentSalaryMonth) >= 0) document.getElementById("salaryMonthFilter").value = currentSalaryMonth;
        populateKpiBloggerSelect();
        renderKpiBloggerRoster();
      }
      function renderSalaryTable() {
        if (role !== "leader") { document.getElementById("salaryTable").innerHTML = ""; document.getElementById("salarySummaryGrid").innerHTML = ""; return; }
        var month = document.getElementById("salaryMonthFilter").value || activeMonthKey();
        var entries = activeSalaryEmployees().map(function (employee) {
          var isManager = activeEmployeeManagers().indexOf(employee.name) >= 0;
          var result = isManager ? calculateManagerSalary(employee.name,month) : {a:0,b:0,c:0,factReach:0,reachPct:0,bloggerKpi:0,autoReachKpi:0,manualReachKpi:null,reachKpi:0,sanctions:0,totalKpi:0,base:Number(employee.baseSalary || 0),salary:Number(employee.baseSalary || 0),confirmed:0,pending:0,evidenceCount:0};
          return {employee:employee,isManager:isManager,result:result};
        });
        var totals = entries.reduce(function (sum,entry) {
          var result = entry.result;
          sum.employees += 1;
          if (entry.isManager) sum.managers += 1;
          ["base","a","b","c","factReach","bloggerKpi","reachKpi","sanctions","totalKpi","salary"].forEach(function (field) { sum[field] += Number(result[field] || 0); });
          return sum;
        },{employees:0,managers:0,base:0,a:0,b:0,c:0,factReach:0,bloggerKpi:0,reachKpi:0,sanctions:0,totalKpi:0,salary:0});
        var grossKpi = totals.bloggerKpi + totals.reachKpi;
        var totalReachPct = rate(totals.factReach,totals.managers * KPI_RULES.planReach);
        var summaryCards = [
          {label:"Общий оклад",value:money(totals.base),foot:totals.employees + " активных сотрудников",icon:"₽",state:"trend-up"},
          {label:"Начислено KPI",value:money(grossKpi),foot:"до вычета санкций",icon:"◆",state:"trend-up"},
          {label:"Санкции",value:money(totals.sanctions),foot:"удержания за " + kpiMonthLabel(month).toLowerCase(),icon:"−",state:totals.sanctions ? "trend-down" : "trend-up"},
          {label:"Итого к выплате",value:money(totals.salary),foot:"оклады + KPI после санкций",icon:"Σ",state:"trend-up"}
        ];
        document.getElementById("salarySummaryGrid").innerHTML = summaryCards.map(function (card) { return '<article class="card kpi"><div class="kpi-top"><span>' + card.label + '</span><span class="kpi-icon">' + card.icon + '</span></div><div class="kpi-value">' + card.value + '</div><div class="kpi-foot"><span class="' + card.state + '">' + safeText(kpiMonthLabel(month)) + '</span> · ' + card.foot + '</div></article>'; }).join("");
        var rows = entries.map(function (entry) {
          var employee = entry.employee;
          var isManager = entry.isManager;
          var result = entry.result;
          var baseCell = role === "leader" ? '<input class="inline-edit-control inline-edit-number" type="number" min="0" value="' + result.base + '" data-salary-employee="' + safeText(employee.id) + '" data-salary-manager="' + safeText(employee.name) + '" data-salary-field="base">' : '<b>' + money(result.base) + '</b>';
          var sanctionCell = isManager ? (role === "leader" ? '<input class="inline-edit-control inline-edit-number" type="number" min="0" value="' + result.sanctions + '" data-salary-employee="' + safeText(employee.id) + '" data-salary-manager="' + safeText(employee.name) + '" data-salary-month="' + month + '" data-salary-field="sanctions">' : money(result.sanctions)) : '—';
          var reachKpiCell = isManager ? (role === "leader" ? '<input class="inline-edit-control inline-edit-number" type="number" min="0" value="' + result.reachKpi + '" title="Автоматически: ' + money(result.autoReachKpi) + '" data-salary-employee="' + safeText(employee.id) + '" data-salary-manager="' + safeText(employee.name) + '" data-salary-month="' + month + '" data-salary-field="reachKpi">' : money(result.reachKpi)) : '—';
          var detail = isManager ? result.confirmed + ' зачтено · ' + result.pending + ' ожидают факта' : 'Фиксированный оклад';
          var status = employee.status === "paused" ? '<span class="badge badge-red">Приостановлен</span>' : '<span class="badge badge-green">Активен</span>';
          return '<tr><td><div class="blogger-cell"><div class="mini-avatar">' + initials(employee.name) + '</div><div><strong>' + safeText(employee.name) + '</strong><small>' + detail + '</small></div></div></td><td><span class="badge ' + employeeRoleBadge(employee.role) + '">' + employeeRoleLabel(employee.role) + '</span></td><td>' + baseCell + '</td><td>' + (isManager ? result.a : '—') + '</td><td>' + (isManager ? result.b : '—') + '</td><td>' + (isManager ? result.c : '—') + '</td><td><b>' + (isManager ? number(result.factReach) : '—') + '</b></td><td>' + (isManager ? '<span class="' + metricState(result.reachPct,100,.7) + '">' + percent(result.reachPct,1) + '</span>' : '—') + '</td><td>' + (isManager ? money(result.bloggerKpi) : '—') + '</td><td>' + reachKpiCell + '</td><td>' + sanctionCell + '</td><td><b>' + money(result.totalKpi) + '</b></td><td><b style="color:var(--green-2)">' + money(result.salary) + '</b></td><td>' + status + '</td></tr>';
        });
        if (entries.length) rows.push('<tr class="manager-total"><td><div class="blogger-cell"><div class="mini-avatar">Σ</div><div><strong>Итого по всем сотрудникам</strong><small>' + safeText(kpiMonthLabel(month)) + ' · оклад + KPI − санкции</small></div></div></td><td><span class="badge badge-green">Все роли</span></td><td><b>' + money(totals.base) + '</b></td><td><b>' + number(totals.a) + '</b></td><td><b>' + number(totals.b) + '</b></td><td><b>' + number(totals.c) + '</b></td><td><b>' + number(totals.factReach) + '</b></td><td><span class="' + metricState(totalReachPct,100,.7) + '">' + percent(totalReachPct,1) + '</span></td><td><b>' + money(totals.bloggerKpi) + '</b></td><td><b>' + money(totals.reachKpi) + '</b></td><td><b style="color:var(--red)">− ' + money(totals.sanctions) + '</b></td><td><b>' + money(totals.totalKpi) + '</b></td><td><b style="color:var(--green-2)">' + money(totals.salary) + '</b></td><td><span class="badge badge-green">' + totals.employees + ' сотрудников</span></td></tr>');
        document.getElementById("salaryTable").innerHTML = rows.join("") || '<tr><td colspan="14"><div class="empty-state">Добавьте активных сотрудников в разделе «Сотрудники» — после этого расчёт появится автоматически.</div></td></tr>';
      }
      function employeeAssistantMonthStats(name,month) {
        return Object.keys(dailyAssistantReports).filter(function (date) { return date.slice(0,7) === month; }).reduce(function (total,date) {
          var item = employeeNamedRecord(dailyAssistantReports[date] || {},name);
          if (!item) return total;
          total.outreach += Number(item.fact || 0);
          total.approvals += Number(item.approvals || 0);
          total.transferred += Number(item.transferred || 0);
          return total;
        },{outreach:0,approvals:0,transferred:0});
      }
      function renderEmployees() {
        var grid = document.getElementById("teamGrid");
        if (!grid) return;
        if (role !== "leader") { grid.innerHTML = ""; return; }
        var month = activeMonthKey();
        var monthLabel = activeMonthLabel(month);
        var latestDate = dashboardReportDates(month)[0] || new Date().toISOString().slice(0,10);
        grid.innerHTML = employees.map(function (employee) {
          var stats = [];
          var salary = Number(employee.baseSalary || 0);
          if (employee.role === "manager") {
            var outreach = managerOutreachSummary(employee.name,month,latestDate);
            var fact = monthlyManagerFact(employee.name,month);
            stats = [[bloggers.filter(function (blogger) { return employeeNameMatches(employee,blogger.manager); }).length,"блогеров"],[outreach.monthFact,"рассылок за месяц"],[fact.exits,"выходов за месяц"]];
            salary = calculateManagerSalary(employee.name,month).salary;
          } else if (employee.role === "assistant") {
            var assistant = employeeAssistantMonthStats(employee.name,month);
            stats = [[assistant.transferred,"передано"],[assistant.outreach,"рассылок"],[assistant.approvals,"согласий"]];
          } else if (employee.role === "analyst") {
            stats = [["Отчёты","доступ"],["Дашборды","доступ"],["Просмотр","режим"]];
          } else {
            stats = [[employees.length,"сотрудников"],["Все","разделы"],["Полный","доступ"]];
          }
          var statusLabel = employee.status === "paused" ? "Приостановлен" : "Активен";
          var statusClass = employee.status === "paused" ? "badge-red" : "badge-green";
          var accessLabel = employee.accessStatus === "connected" ? "Кабинет подключён" : employee.accessStatus === "invited" ? "Ссылка создана" : "Доступ не создан";
          var accessClass = employee.accessStatus === "connected" ? "badge-green" : employee.accessStatus === "invited" ? "badge-amber" : "badge-red";
          var assigned = employee.role === "assistant" && employee.assignedManager ? " · закреплён за " + safeText(employee.assignedManager) : "";
          return '<article class="card team-card"><div class="team-top"><div class="avatar">' + initials(employee.name) + '</div><div><h4>' + safeText(employee.name) + '</h4><p>' + safeText(employee.email) + assigned + '</p></div><span class="badge ' + employeeRoleBadge(employee.role) + ' team-role">' + employeeRoleLabel(employee.role) + '</span></div><div class="team-stats">' + stats.map(function (item) { return '<div class="team-stat"><strong>' + (typeof item[0] === "number" ? number(item[0]) : safeText(item[0])) + '</strong><span>' + item[1] + '</span></div>'; }).join("") + '</div><div class="salary"><span>Оклад / зарплата · ' + monthLabel.toLowerCase() + '</span><b>' + money(salary) + '</b></div><div class="access-status"><span class="badge ' + statusClass + '">' + statusLabel + '</span><span class="badge ' + accessClass + '">' + accessLabel + '</span></div><div class="team-card-actions"><button class="btn btn-sm btn-outline" type="button" data-open-employee-profile="' + safeText(employee.id) + '">Кабинет</button><button class="btn btn-sm btn-outline" type="button" data-create-employee-access="' + safeText(employee.id) + '">' + (employee.accessStatus === "connected" ? "Новая ссылка" : "Создать доступ") + '</button><button class="btn btn-sm btn-outline" type="button" data-edit-employee="' + safeText(employee.id) + '">Редактировать</button></div></article>';
        }).join("") || '<div class="card empty-state">Сотрудники ещё не добавлены.</div>';
      }
      function employeeHistoryMonths(employee) {
        var values = [activeMonthKey()];
        Object.keys(dailyManagerReports).forEach(function (date) { values.push(date.slice(0,7)); });
        Object.keys(dailyAssistantReports).forEach(function (date) { values.push(date.slice(0,7)); });
        synchronizedPlacementRecords().forEach(function (item) { if (employeeNameMatches(employee,item.manager)) values.push((item.sortDate || "").slice(0,7)); });
        departmentMonths.forEach(function (item) { values.push(item.month); });
        return values.filter(function (value,index,array) { return /^\d{4}-\d{2}$/.test(value) && array.indexOf(value) === index; }).sort().reverse().slice(0,24);
      }
      function managerMonthActivity(employee,month) {
        var dates = Object.keys(dailyManagerReports).filter(function (date) { return date.slice(0,7) === month; }).sort().reverse();
        var outreach = managerOutreachSummary(employee.name,month,dates[0] || month + "-01");
        var approvals = dates.reduce(function (total,date) { var item = employeeNamedRecord(dailyManagerReports[date] || {},employee); return total + Number(item && item.approvals || 0); },0);
        var fact = monthlyManagerFact(employee.name,month);
        return {outreach:outreach.monthFact,exits:fact.exits,reach:fact.reach,approvals:approvals,transferred:0,source:fact.source || "Отчёты менеджера"};
      }
      function assistantMonthActivity(employee,month) {
        var stats = employeeAssistantMonthStats(employee.name,month);
        return {outreach:stats.outreach,exits:0,reach:0,approvals:stats.approvals,transferred:stats.transferred,source:"Ежедневные отчёты ассистента"};
      }
      function leaderMonthActivity(month) {
        var directionFacts = [monthlyDirectionFact(month,"ЛН"),monthlyDirectionFact(month,"FIT PRO")];
        var totals = directionFacts.reduce(function (result,item) {
          result.exits += Number(item.exits || 0);
          result.reach += Number(item.reach || 0);
          return result;
        },{exits:0,reach:0});
        var outreach = 0;
        var approvals = 0;
        Object.keys(dailyManagerReports).filter(function (date) { return date.slice(0,7) === month; }).forEach(function (date) {
          Object.keys(dailyManagerReports[date] || {}).forEach(function (name) {
            var report = dailyManagerReports[date][name] || {};
            outreach += Number(report.outreach || 0);
            approvals += Number(report.approvals || 0);
          });
        });
        Object.keys(dailyAssistantReports).filter(function (date) { return date.slice(0,7) === month; }).forEach(function (date) {
          Object.keys(dailyAssistantReports[date] || {}).forEach(function (name) {
            var report = dailyAssistantReports[date][name] || {};
            outreach += Number(report.outreach || 0);
            approvals += Number(report.approvals || 0);
          });
        });
        return {outreach:outreach,exits:totals.exits,reach:totals.reach,approvals:approvals,transferred:0,source:"Общая сводка отдела"};
      }
      function employeeMonthActivity(employee,month) {
        if (employee.role === "manager") return managerMonthActivity(employee,month);
        if (employee.role === "assistant") return assistantMonthActivity(employee,month);
        if (employee.role === "leader") return leaderMonthActivity(month);
        return {outreach:0,exits:0,reach:0,approvals:0,transferred:0,source:"Профиль сотрудника"};
      }
      function refreshBloggerCounters() {
        var badge = document.getElementById("bloggerCountBadge");
        if (badge) badge.textContent = number(bloggers.length);
      }
      function renderEmployeeProfile() {
        var employee = employees.find(function (item) { return item.id === employeeProfileTargetId; }) || employees.find(function (item) { return currentEmployeeProfile && item.id === currentEmployeeProfile.id; }) || currentEmployeeProfile;
        if (!employee) {
          document.getElementById("employeeProfileName").textContent = currentUserProfile && (currentUserProfile.name || currentUserProfile.email) || "Сотрудник NSL";
          document.getElementById("employeeProfileHistory").innerHTML = '<tr><td colspan="8"><div class="empty-state">Профиль сотрудника ещё не связан с вкладкой «Сотрудники».</div></td></tr>';
          return;
        }
        var viewingOther = Boolean(employeeProfileTargetId && (!currentEmployeeProfile || employeeProfileTargetId !== currentEmployeeProfile.id));
        document.getElementById("employeeProfilePageTitle").textContent = viewingOther ? "Кабинет сотрудника" : "Мой кабинет";
        document.getElementById("backToTeamBtn").classList.toggle("hidden",role !== "leader" || !viewingOther);
        document.getElementById("employeeProfileAvatar").textContent = initials(employee.name);
        document.getElementById("employeeProfileName").textContent = employee.name;
        document.getElementById("employeeProfileMeta").textContent = employee.email + " · " + employeeRoleLabel(employee.role) + (employee.assignedManager ? " · закреплён за " + employee.assignedManager : "");
        var accessLabel = employee.accessStatus === "connected" ? "Кабинет подключён" : employee.accessStatus === "invited" ? "Ожидает регистрации" : "Доступ не создан";
        document.getElementById("employeeProfileBadges").innerHTML = '<span class="badge ' + employeeRoleBadge(employee.role) + '">' + employeeRoleLabel(employee.role) + '</span><span class="badge ' + (employee.status === "active" ? "badge-green" : "badge-red") + '">' + (employee.status === "active" ? "Активен" : "Приостановлен") + '</span><span class="badge ' + (employee.accessStatus === "connected" ? "badge-green" : "badge-amber") + '">' + accessLabel + '</span>';
        var month = activeMonthKey();
        var current = employeeMonthActivity(employee,month);
        var databaseBloggerCount = bloggers.length;
        var cards = employee.role === "assistant" ? [[current.outreach,"Рассылки за месяц"],[current.approvals,"Согласия"],[current.transferred,"Передано менеджеру"],[employee.assignedManager || "—","Закреплён за"]] : [[databaseBloggerCount,"Блогеров в базе"],[current.exits,"Выходов за месяц"],[current.reach,"Фактический охват"],[current.outreach,"Рассылки за месяц"]];
        document.getElementById("employeeProfileKpis").innerHTML = cards.map(function (item) { return '<article class="card kpi"><div class="kpi-top"><span>' + safeText(item[1]) + '</span><span class="kpi-icon">✓</span></div><div class="kpi-value">' + (typeof item[0] === "number" ? number(item[0]) : safeText(item[0])) + '</div><div class="kpi-foot">' + activeMonthLabel(month) + '</div></article>'; }).join("");
        var rows = employeeHistoryMonths(employee).map(function (historyMonth) {
          var item = employeeMonthActivity(employee,historyMonth);
          return '<tr><td><b>' + safeText(kpiMonthLabel(historyMonth)) + '</b></td><td><span class="badge ' + employeeRoleBadge(employee.role) + '">' + employeeRoleLabel(employee.role) + '</span></td><td>' + number(item.outreach) + '</td><td>' + number(item.exits) + '</td><td><b>' + number(item.reach) + '</b></td><td>' + number(item.approvals) + '</td><td>' + number(item.transferred) + '</td><td>' + safeText(item.source) + '</td></tr>';
        });
        document.getElementById("employeeProfileHistory").innerHTML = rows.join("") || '<tr><td colspan="8"><div class="empty-state">История появится после первого отчёта.</div></td></tr>';
      }
      function openEmployeeProfile(employee) {
        employeeProfileTargetId = employee && employee.id || "";
        navigate("profile");
      }
      function toggleEmployeeManagerField() {
        document.getElementById("employeeManagerField").classList.toggle("hidden",document.getElementById("employeeRole").value !== "assistant");
      }
      function openEmployeeEditor(employee) {
        if (role !== "leader") return showToast("Редактировать сотрудников может только администратор");
        refreshStaffSelectors();
        var item = employee || {id:"",name:"",email:"",role:"assistant",assignedManager:activeEmployeeManagers()[0] || "",status:"active",baseSalary:0};
        document.getElementById("employeeModalTitle").textContent = employee ? "Редактировать сотрудника" : "Пригласить сотрудника";
        document.getElementById("employeeId").value = item.id || "";
        document.getElementById("employeeName").value = item.name || "";
        document.getElementById("employeeEmail").value = item.email || "";
        document.getElementById("employeeRole").value = item.role || "assistant";
        document.getElementById("employeeStatus").value = item.status || "active";
        document.getElementById("employeeAssignedManager").value = activeEmployeeManagers().indexOf(item.assignedManager) >= 0 ? item.assignedManager : (activeEmployeeManagers()[0] || "");
        document.getElementById("employeeBaseSalary").value = Number(item.baseSalary || 0);
        document.getElementById("employeeHistoryAliases").value = (item.historyAliases || []).join(", ");
        document.getElementById("removeEmployeeBtn").classList.toggle("hidden",!employee || employee.role === "leader" || employee.status === "paused");
        document.getElementById("employeeFormNote").textContent = employee ? "Изменения сохранятся в общей базе и обновят доступ сотрудника." : "После сохранения появится новый кабинет сотрудника.";
        toggleEmployeeManagerField();
        openLayer(document.getElementById("employeeModal"));
      }
      function openEmployeeAccess(employee) {
        if (!employee || role !== "leader") return;
        showToast("Формирую персональный доступ…");
        createEmployeeAccess(employee.id).then(function (data) {
          document.getElementById("employeeAccessText").innerHTML = "Отправьте эту ссылку сотруднику <b>" + safeText(employee.name) + "</b>. При регистрации автоматически применятся роль «" + safeText(employeeRoleLabel(employee.role)) + "» и история прошлых месяцев.";
          document.getElementById("employeeAccessLink").value = data.accessUrl || "";
          document.getElementById("employeeAccessExpiry").textContent = data.expiresAt ? "до " + new Date(data.expiresAt).toLocaleDateString("ru-RU") : "7 дней";
          employee.accessStatus = "invited";
          employee.inviteExpiresAt = data.expiresAt || "";
          renderEmployees();
          openLayer(document.getElementById("employeeAccessModal"));
        }).catch(function (error) { showToast(error.message || "Не удалось сформировать доступ"); });
      }
      function applySavedEmployee(saved,previous) {
        if (previous) migrateEmployeeReferences(previous,saved);
        var index = employees.findIndex(function (item) { return item.id === saved.id; });
        if (index >= 0) employees[index] = saved; else employees.push(saved);
        if (saved.role === "manager") {
          ensureManagerMetrics(saved.name);
          salarySetting(saved.name).base = Number(saved.baseSalary || 0);
        }
        cacheEmployees();
        sessionStorage.setItem("nslManagerMetrics",JSON.stringify(managerMetrics));
        sessionStorage.setItem("nslSalarySettings",JSON.stringify(salarySettings));
        queueSharedStateRecords(localSharedSeedRecords());
        refreshStaffSelectors();
        populateKpiControls();
        renderEmployees(); renderManagerMetrics(); renderMonthlyPlanFact(); renderSalaryTable(); loadKpiFromData();
      }
      function renderKpiCalculator() {
        if (role !== "leader") return;
        var a = Number(document.getElementById("kpiCategoryA").value || 0);
        var b = Number(document.getElementById("kpiCategoryB").value || 0);
        var c = Number(document.getElementById("kpiCategoryC").value || 0);
        var factReach = Number(document.getElementById("kpiFactReach").value || 0);
        var manualReachKpi = Math.max(0,Number(document.getElementById("kpiManualReachAmount").value || 0));
        var base = Number(document.getElementById("kpiBaseSalary").value || 0);
        var sanctions = Number(document.getElementById("kpiSanctions").value || 0);
        var bloggerKpi = a*KPI_RULES.categories.a.amount + b*KPI_RULES.categories.b.amount + c*KPI_RULES.categories.c.amount;
        var reachKpi = manualReachKpi;
        var totalKpi = Math.max(0,bloggerKpi + reachKpi - sanctions);
        document.getElementById("kpiBloggersAmount").textContent = money(bloggerKpi);
        document.getElementById("kpiReachPercent").textContent = percent(factReach/KPI_RULES.planReach*100,1);
        document.getElementById("kpiReachAmount").textContent = money(reachKpi);
        document.getElementById("kpiTotalAmount").textContent = money(totalKpi);
        document.getElementById("kpiSalaryAmount").textContent = money(base + totalKpi);
      }
      function loadKpiFromData() {
        if (role !== "leader") return;
        var manager = document.getElementById("kpiManagerSelect").value;
        var month = document.getElementById("kpiMonthSelect").value;
        if (!manager || !month) return;
        var result = calculateManagerSalary(manager,month);
        document.getElementById("kpiCategoryA").value = result.a;
        document.getElementById("kpiCategoryB").value = result.b;
        document.getElementById("kpiCategoryC").value = result.c;
        document.getElementById("kpiFactReach").value = result.factReach;
        document.getElementById("kpiManualReachAmount").value = result.reachKpi;
        document.getElementById("kpiBaseSalary").value = result.base;
        document.getElementById("kpiSanctions").value = result.sanctions;
        document.getElementById("kpiCalculatorSource").textContent = "Расчёт за " + kpiMonthLabel(month).toLowerCase() + ": " + result.placements + " размещений с фактическим охватом, " + result.manualCount + " блогеров добавлено администратором, " + result.confirmed + " зачтено в KPI, " + result.pending + " ожидают ввода. Автоматическая сумма KPI за охват — " + money(result.autoReachKpi) + "; администратор может заменить её вручную.";
        renderKpiCalculator();
      }
      function renderAcceptanceStatus() {
        var checks = Array.from(document.querySelectorAll("#acceptanceChecklist input"));
        var complete = checks.length && checks.every(function (item) { return item.checked; });
        var badge = document.getElementById("acceptanceStatus");
        badge.className = "badge " + (complete ? "badge-green" : "badge-red");
        badge.textContent = complete ? "Зачтено в KPI" : "Не зачтено";
      }
      function fillManagerReportForm(name) {
        var date = document.getElementById("reportDate").value || document.getElementById("managerDailyDateFilter").value || localTodayIso();
        var d = autoManagerDailyMetrics(name,date,(dailyManagerReports[date] || {})[name]);
        if (!d) return;
        document.getElementById("reportManager").value = name;
        document.getElementById("reportPlanOutreach").value = d.planOutreach;
        var mapping = {Outreach:"outreach",Replies:"replies",Approvals:"approvals",Refusals:"refusals",Dialog:"dialog"};
        Object.keys(mapping).forEach(function (suffix) { document.getElementById("report" + suffix).value = d[mapping[suffix]]; });
        document.getElementById("reportComment").value = d.comment || "";
      }
      function safeText(value) {
        return String(value == null ? "" : value).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");
      }
      function filteredPlacementRecords() {
        var query = document.getElementById("placementSearch").value.toLowerCase().trim();
        var month = document.getElementById("placementMonthFilter").value;
        var manager = document.getElementById("placementManagerFilter").value;
        var decision = document.getElementById("placementDecisionFilter").value;
        var directionFilter = document.getElementById("placementDirectionFilter").value;
        var dealType = document.getElementById("placementDealTypeFilter").value;
        var statusFilter = document.getElementById("placementStatusFilter").value;
        var formatFilter = document.getElementById("placementFormatFilter").value.toLowerCase();
        var reachMinRaw = document.getElementById("placementReachMin").value;
        var reachMaxRaw = document.getElementById("placementReachMax").value;
        var reachMin = reachMinRaw === "" ? null : Number(reachMinRaw);
        var reachMax = reachMaxRaw === "" ? null : Number(reachMaxRaw);
        var dateFrom = document.getElementById("placementDateFrom").value;
        var dateTo = document.getElementById("placementDateTo").value;
        var contractFilter = document.getElementById("placementContractFilter").value;
        var sort = document.getElementById("placementSortFilter").value;
        var synchronizedRows = synchronizedPlacementRecords();
        var counts = synchronizedRows.reduce(function (result,item) { var key=item.sourceKey || item.tag; result[key]=(result[key]||0)+1; return result; },{});
        var today = localTodayIso();
        var week = currentWeekBounds();
        var rows = synchronizedRows.filter(function (item) {
          var blogger = linkedBloggerForPlacement(item);
          var direction = placementDirection(item);
          var key = item.sourceKey || item.tag;
          var status = placementStatus(item);
          var reach = item.actual == null ? Number(item.guaranteed || 0) : Number(item.actual || 0);
          var contractReady = ["Готов","Подписан"].indexOf(item.contract) >= 0;
          var haystack = [item.tag,item.manager,item.type,item.comment,item.fullName,blogger && blogger.category,blogger && blogger.display].join(" ").toLowerCase();
          var quick = placementQuickFilter === "all" ||
            (placementQuickFilter === "mine" && item.manager === (document.getElementById("placementManagerFilter").value || activeEmployeeManagers()[0] || "")) ||
            (placementQuickFilter === "ln" && direction === "ЛН") ||
            (placementQuickFilter === "fit" && direction === "FIT PRO") ||
            (placementQuickFilter === "today" && item.sortDate === today) ||
            (placementQuickFilter === "week" && item.sortDate >= week.start && item.sortDate <= week.end) ||
            (placementQuickFilter === "stats" && item.actual == null) ||
            (placementQuickFilter === "overdue" && item.sortDate < today && item.actual == null) ||
            (placementQuickFilter === "contract" && ["Готов","Подписан"].indexOf(item.contract) < 0) ||
            (placementQuickFilter === "guarantee" && item.actual != null && Number(item.actual) < Number(item.guaranteed || 0)) ||
            (placementQuickFilter === "barter" && item.dealType === "Бартер") ||
            (placementQuickFilter === "commercial" && item.dealType === "Коммерция") ||
            (placementQuickFilter === "repeat" && counts[key] > 1) ||
            (placementQuickFilter === "approval" && item.decision === "На оценке");
          return quick &&
            (!query || haystack.indexOf(query) >= 0) &&
            (!month || monthFromDateValue(item.sortDate || item.start) === month) &&
            (!manager || employeeNameMatches(manager,item.manager)) &&
            (!decision || item.decision === decision) &&
            (!directionFilter || direction === directionFilter) &&
            (!dealType || item.dealType === dealType) &&
            (!statusFilter || status === statusFilter) &&
            (!formatFilter || String(item.type || "").toLowerCase().indexOf(formatFilter) >= 0) &&
            (reachMin == null || reach >= reachMin) &&
            (reachMax == null || reach <= reachMax) &&
            (!dateFrom || (item.sortDate && item.sortDate >= dateFrom)) &&
            (!dateTo || (item.sortDate && item.sortDate <= dateTo)) &&
            (!contractFilter || (contractFilter === "ready" ? contractReady : !contractReady));
        });
        rows.sort(function (a,b) {
          var reachA = a.actual == null ? Number(a.guaranteed || 0) : Number(a.actual || 0);
          var reachB = b.actual == null ? Number(b.guaranteed || 0) : Number(b.actual || 0);
          if (sort === "created-desc") return createdTimestamp(b)-createdTimestamp(a);
          if (sort === "date-asc") return String(a.sortDate || "").localeCompare(String(b.sortDate || ""));
          if (sort === "reach-desc") return reachB-reachA;
          if (sort === "reach-asc") return reachA-reachB;
          if (sort === "revenue-desc") return Number(b.revenue || 0)-Number(a.revenue || 0);
          return String(b.sortDate || "").localeCompare(String(a.sortDate || ""));
        });
        return rows;
      }
      function filteredReelRecords() {
        var query = document.getElementById("placementSearch").value.toLowerCase().trim();
        var month = document.getElementById("placementMonthFilter").value;
        var manager = document.getElementById("placementManagerFilter").value;
        return reelRecords.filter(function (item) {
          return (!query || item.tag.toLowerCase().indexOf(query) >= 0) && (!month || monthFromDateValue(item.sortDate || item.date) === month) && (!manager || employeeNameMatches(manager,item.manager));
        });
      }
      function placementDecisionBadge(value) {
        var cls = value === "Оставляем" ? "badge-green" : value === "Убираем" ? "badge-red" : "badge-amber";
        return '<span class="badge ' + cls + '">' + value + '</span>';
      }
      function placementBloggerCell(item) {
        var blogger = linkedBloggerForPlacement(item);
        var action = blogger ? ' data-open-blogger="' + blogger.id + '" title="Открыть карточку блогера"' : '';
        return '<div class="blogger-cell' + (blogger ? ' blogger-card-link' : '') + '"' + action + '><div class="mini-avatar">' + initials(item.tag) + '</div><div><strong>' + safeText(item.tag) + '</strong><small>' + item.dealType + ' · ' + item.manager + (blogger ? ' · Открыть карточку' : '') + '</small></div></div>';
      }
      function placementStatus(item) {
        if (item.decision === "Убираем") return "Отказ";
        if (item.actual != null) return "Завершён";
        if (!["Готов","Подписан"].includes(item.contract)) return "Ждём договор";
        if (item.brief !== "Готово") return "Ждём ТЗ";
        if (item.sortDate && item.sortDate < localTodayIso()) return "Ждём статистику";
        if (item.warmup && item.warmup !== "—") return "Прогрев";
        return "Согласование";
      }
      function placementDirection(item) { var blogger=linkedBloggerForPlacement(item); return item.direction || (blogger ? blogger.brand : "ЛН"); }
      function renderUnifiedPlacementTable(pageRows,rows,pages) {
        document.getElementById("placementUnifiedTable").innerHTML = pageRows.map(function (item) {
          var blogger = linkedBloggerForPlacement(item) || {};
          var direction = placementDirection(item);
          var status = placementStatus(item);
          var pct = item.actual == null || !item.guaranteed ? null : item.actual/item.guaranteed*100;
          var statusClass = status === "Отказ" ? "badge-red" : status === "Ждём статистику" || status === "Ждём договор" || status === "Ждём ТЗ" ? "badge-amber" : "badge-blue";
          var expanded = String(expandedPlacementId) === String(item.id);
          var main = '<tr class="placement-main-row" data-placement-expand="' + item.id + '"><td><button class="more-btn" aria-label="Раскрыть">' + (expanded ? '−' : '+') + '</button></td><td>' + placementBloggerCell(item) + '</td><td><span class="badge ' + (direction === "ЛН" ? "badge-green" : "badge-purple") + '">' + direction + '</span></td><td>' + safeText(blogger.category || "Без категории") + '</td><td>' + safeText(item.manager) + '</td><td><span class="badge ' + (item.dealType === "Коммерция" ? "badge-purple" : "badge-green") + '">' + item.dealType + '</span></td><td><b>' + safeText(item.start) + '</b></td><td><b>' + displayIsoDate(item.warmupStart) + '</b></td><td><b>' + displayIsoDate(item.warmupEnd) + '</b></td><td><b>' + number(item.guaranteed) + '</b> / ' + (item.actual == null ? '—' : number(item.actual)) + (pct == null ? '' : '<small style="display:block" class="' + metricState(pct,100,.7) + '">' + percent(pct,1) + '</small>') + '</td><td><span class="badge ' + statusClass + '">' + status + '</span></td><td>' + placementDecisionBadge(item.decision) + '</td></tr>';
          if (!expanded) return main;
          var extraFormats = additionalPlacementFormats.filter(function (format) { return String(format.placementId) === String(item.id); });
          var formats = [{name:item.type || "Stories",date:item.start,guarantee:item.guaranteed,fact:item.actual,link:""}].concat(extraFormats);
          var formatHtml = formats.map(function (format) { return '<div class="placement-format"><b>' + safeText(format.name) + '</b><span>План: ' + safeText(format.date || item.start) + '</span><span>Факт: ' + (item.actual == null ? '—' : safeText(item.start)) + '</span><span>Гарант: ' + number(format.guarantee) + '</span><span>Охват: ' + (format.fact == null ? '—' : number(format.fact)) + '</span><span>' + (format.link ? '<a href="' + safeText(format.link) + '" target="_blank">Публикация ↗</a>' : 'Ссылка не добавлена') + '</span></div>'; }).join('');
          var shortage = Math.max(0,Number(item.guaranteed || 0)-Number(item.actual || 0));
          var finalDecision = item.decision === "Оставляем" ? "Повторить" : item.decision === "Убираем" ? "Остановить" : "Ретест";
          var detail = '<tr class="placement-detail-row"><td colspan="12"><div class="placement-detail"><div class="placement-detail-grid"><div class="placement-detail-card"><span>Основная площадка</span><strong>' + safeText(item.platform || blogger.link || '—') + '</strong></div><div class="placement-detail-card"><span>Рабочий чат</span><strong>' + (item.chat ? 'Создан · доступ по роли' : 'Не создан') + '</strong></div><div class="placement-detail-card"><span>ТЗ / договор</span><strong>' + safeText(item.brief) + ' · ' + safeText(item.contract) + '</strong></div><div class="placement-detail-card"><span>Условия / продукт</span><strong>' + money(item.cost) + ' · ' + safeText(item.duration || '—') + '</strong></div></div><div class="placement-detail-card"><span>Форматы размещения</span>' + formatHtml + '</div><div class="placement-detail-grid"><div class="placement-detail-card"><span>Результат</span><strong>' + number(effectivePlacementClicks(item)) + ' кликов · ' + number(item.leads) + ' лидов · ' + number(Math.round(Number(item.leads||0)*.55)) + ' квал. · ' + number(item.sales) + ' продаж</strong></div><div class="placement-detail-card"><span>Экономика</span><strong>' + money(item.revenue) + ' выручки' + (item.cost ? ' · ROMI ' + Math.round((item.revenue-item.cost)/item.cost*100) + '%' : '') + '</strong></div><div class="placement-detail-card"><span>Гарант / компенсация</span><strong>' + (shortage ? 'Недобор ' + number(shortage) + ' · нужна компенсация' : item.actual == null ? 'Ожидается факт' : 'Гарант выполнен') + '</strong></div><div class="placement-detail-card"><span>Итоговое решение</span><strong>' + finalDecision + '</strong></div></div><div class="placement-detail-card"><span>Рабочие заметки</span><strong>' + safeText(item.comment || 'Нет комментария') + '</strong></div><div class="placement-detail-actions"><button class="btn btn-sm btn-outline" data-add-format="' + item.id + '">＋ Добавить формат</button><button class="btn btn-sm btn-primary evidence-add-btn" data-evidence-blogger="' + safeText(item.tag) + '">▧ Добавить фактический охват</button></div></div></td></tr>';
          return main + detail;
        }).join("");
        document.getElementById("placementUnifiedPagerText").textContent = rows.length ? "Страница " + placementPage + " из " + pages + " · " + rows.length + " размещений" : "Нет размещений по выбранному фильтру";
        document.getElementById("placementUnifiedPrev").disabled = placementPage <= 1;
        document.getElementById("placementUnifiedNext").disabled = placementPage >= pages;
      }
      function placementSummaryHasNarrowFilters() {
        if (placementQuickFilter !== "all") return true;
        return ["placementSearch","placementManagerFilter","placementDecisionFilter","placementDealTypeFilter","placementStatusFilter","placementFormatFilter","placementReachMin","placementReachMax","placementDateFrom","placementDateTo","placementContractFilter"].some(function (id) {
          var element = document.getElementById(id);
          return Boolean(element && String(element.value || "").trim());
        });
      }
      function placementOfficialRevenue(month,direction) {
        if (!month) return null;
        var departmentPlan = monthlyDepartmentPlanSetting(month);
        var financeCurrent = currentFinanceData && currentFinanceData.current && currentFinanceData.current.month === month ? currentFinanceData.current : null;
        function directionRevenue(value) {
          var financeKey = value === "FIT PRO" ? "fit" : "ln";
          var financeRevenue = financeCurrent && financeCurrent.directions && financeCurrent.directions[financeKey] && financeCurrent.directions[financeKey].metrics && financeCurrent.directions[financeKey].metrics.revenue;
          var fallbackValue = value === "FIT PRO" ? departmentPlan.revenueFitFact : departmentPlan.revenueLnFact;
          var sourceValue = financeRevenue && financeRevenue.fact != null ? financeRevenue.fact : fallbackValue;
          if (sourceValue == null || sourceValue === "" || !Number.isFinite(Number(sourceValue)) || Number(sourceValue) < 0) return null;
          return Number(sourceValue);
        }
        if (direction) return directionRevenue(direction);
        var ln = directionRevenue("ЛН");
        var fit = directionRevenue("FIT PRO");
        if (ln == null && fit == null) return null;
        return Number(ln || 0) + Number(fit || 0);
      }
      function placementSummaryMetrics(rows) {
        var month = document.getElementById("placementMonthFilter").value;
        var direction = document.getElementById("placementDirectionFilter").value;
        var actual = rows.reduce(function (sum,item) { return sum + Number(effectivePlacementActual(item) || 0); },0);
        var revenue = rows.reduce(function (sum,item) { return sum + Number(item.revenue || 0); },0);
        var reported = rows.filter(function (item) { return effectivePlacementActual(item) != null; }).length;
        var actualSource = reported + " отчётов из размещений";
        var revenueSource = "из карточек по фильтру";
        var canonical = Boolean(month && !placementSummaryHasNarrowFilters());
        if (canonical) {
          var directions = direction ? [direction] : ["ЛН","FIT PRO"];
          var facts = directions.map(function (value) { return monthlyDirectionFact(month,value); });
          actual = facts.reduce(function (sum,item) { return sum + Number(item.reach || 0); },0);
          reported = facts.reduce(function (sum,item) { return sum + Number(item.exits || 0); },0);
          actualSource = reported + " выходов · размещения и подтверждённые отчёты";
          var officialRevenue = placementOfficialRevenue(month,direction);
          if (officialRevenue != null) {
            revenue = officialRevenue;
            revenueSource = direction ? "Отчет " + direction : "Отчет ЛН + Отчет FIT PRO";
          }
        }
        return {actual:actual,revenue:revenue,reported:reported,actualSource:actualSource,revenueSource:revenueSource,canonical:canonical};
      }
      function renderPlacementRecords() {
        var rows = filteredPlacementRecords();
        document.getElementById("placementFilterCount").textContent = "Найдено: " + number(rows.length) + " из " + number(synchronizedPlacementRecords().length) + (document.getElementById("placementMonthFilter").value ? " · выбран " + activeMonthLabel(document.getElementById("placementMonthFilter").value) : " · вся база");
        var pages = Math.max(1,Math.ceil(rows.length / PAGE_SIZE));
        placementPage = Math.min(placementPage,pages);
        var pageRows = rows.slice((placementPage-1)*PAGE_SIZE,placementPage*PAGE_SIZE);
        var guaranteed = rows.reduce(function (sum,item) { return sum + (item.guaranteed || 0); },0);
        var placementSummaryMetricsValue = placementSummaryMetrics(rows);
        var actual = placementSummaryMetricsValue.actual;
        var revenue = placementSummaryMetricsValue.revenue;
        var reported = placementSummaryMetricsValue.reported;
        var syncedReported = rows.filter(function (item) { return item._cardSyncedActual || item.isCardReach; }).length;
        var syncedFields = rows.filter(function (item) { return item._cardSyncedActual || item.isCardReach || Object.keys(item._cardSyncedMeta || {}).length || Object.keys(item._cardSyncedMetrics || {}).length; }).length;
        document.getElementById("placementImportMeta").textContent = rows.length + " размещений · " + syncedFields + " дополнено из карточек · итоги синхронизированы с главной";
        var summary = [
          ["Размещений",number(rows.length),"из реестра","▤"],
          ["Гарантированный охват",number(guaranteed),"план","◉"],
          ["Фактический охват",number(actual),placementSummaryMetricsValue.actualSource,"✓"],
          ["Выручка",money(revenue),placementSummaryMetricsValue.revenueSource,"₽"]
        ];
        document.getElementById("placementSummary").innerHTML = summary.map(function (item) { return '<article class="card kpi"><div class="kpi-top"><span>' + item[0] + '</span><span class="kpi-icon">' + item[3] + '</span></div><div class="kpi-value">' + item[1] + '</div><div class="kpi-foot"><span class="trend-up">' + item[2] + '</span></div></article>'; }).join("");
        document.getElementById("placementPlanTable").innerHTML = pageRows.map(function (item) {
          var prep = item.brief === "Готово" && (item.contract === "Готов" || item.contract === "Подписан") ? '<span class="badge badge-green">Готово</span>' : '<span class="badge badge-amber">Нужны данные</span>';
          return '<tr><td><b>' + item.start + '</b></td><td>' + safeText(warmupRangeLabel(item)) + '</td><td>' + placementBloggerCell(item) + '</td><td>' + placementDecisionBadge(item.decision) + '</td><td>' + item.manager + '</td><td><span class="badge ' + (item.dealType === "Коммерция" ? "badge-purple" : "badge-green") + '">' + item.dealType + '</span></td><td><span class="badge badge-blue">' + safeText(item.source) + '</span></td><td>' + prep + '</td></tr>';
        }).join("");
        document.getElementById("placementDocsTable").innerHTML = pageRows.map(function (item) {
          var briefClass = item.brief === "Готово" ? "badge-green" : "badge-amber";
          return '<tr><td>' + placementBloggerCell(item) + '</td><td>' + safeText(item.fullName) + '</td><td><span class="badge ' + briefClass + '">' + item.brief + '</span></td><td>' + contractBadge(item.contract) + '</td><td><span class="locked-link">' + (item.chat ? "🔒 Доступ после входа" : "Не создан") + '</span></td><td>' + item.manager + '</td></tr>';
        }).join("");
        document.getElementById("placementTermsTable").innerHTML = pageRows.map(function (item) {
          return '<tr><td>' + placementBloggerCell(item) + '</td><td><span class="badge ' + (item.dealType === "Коммерция" ? "badge-purple" : "badge-green") + '">' + item.dealType + '</span></td><td>' + safeText(item.platform) + '</td><td><b>' + safeText(item.type) + '</b></td><td>' + item.duration + '</td><td><b>' + money(item.cost) + '</b></td><td><b>' + number(item.guaranteed) + '</b></td></tr>';
        }).join("");
        document.getElementById("placementResultsTable").innerHTML = pageRows.map(function (item) {
          var pct = item.actual == null || !item.guaranteed ? null : item.actual / item.guaranteed * 100;
          var pctClass = pct == null ? "" : pct >= 100 ? "guarantee-good" : pct >= 70 ? "guarantee-warn" : "guarantee-bad";
          var efficiency = item.revenue > 0 && item.cost > 0 ? "ROMI " + Math.round((item.revenue-item.cost)/item.cost*100) + "%" : item.revenue > 0 ? "Есть выручка" : item.sales > 0 ? "Есть продажи" : "На оценке";
          return '<tr><td>' + placementBloggerCell(item) + '</td><td>' + number(item.guaranteed) + '</td><td><b>' + (item.actual == null ? "—" : number(item.actual)) + '</b></td><td><span class="' + pctClass + '">' + (pct == null ? "Нет отчёта" : percent(pct,2)) + '</span></td><td>' + (effectivePlacementClicks(item) == null ? "—" : number(effectivePlacementClicks(item))) + '</td><td>' + number(item.leads) + '</td><td>' + number(item.sales) + '</td><td><b>' + money(item.revenue) + '</b></td><td>' + efficiency + '</td><td><div class="result-note">' + safeText(item.comment) + '</div></td></tr>';
        }).join("");
        document.getElementById("placementPagerText").textContent = rows.length ? "Страница " + placementPage + " из " + pages + " · записи " + ((placementPage-1)*PAGE_SIZE+1) + "–" + Math.min(placementPage*PAGE_SIZE,rows.length) + " из " + rows.length : "Нет записей";
        document.getElementById("placementPrev").disabled = placementPage <= 1;
        document.getElementById("placementNext").disabled = placementPage >= pages;
        var reelRows = filteredReelRecords();
        document.getElementById("placementReelsTable").innerHTML = reelRows.map(function (item) {
          var publication = item.contentLink ? '<a href="' + safeText(item.contentLink) + '" target="_blank" rel="noopener">Открыть ↗</a>' : '<span style="color:var(--muted)">Не добавлена</span>';
          return '<tr><td><b>' + safeText(item.date) + '</b></td><td><div class="blogger-cell"><div class="mini-avatar">' + initials(item.tag) + '</div><div><strong>' + safeText(item.tag) + '</strong><small>' + safeText(item.type) + '</small></div></div></td><td>' + safeText(item.manager) + '</td><td>' + safeText(item.platform) + '</td><td><span class="badge ' + (item.brief === "Готово" ? "badge-green" : "badge-amber") + '">' + safeText(item.brief) + '</span></td><td>' + contractBadge(item.contract) + '</td><td>' + number(item.guaranteed) + '</td><td><b>' + number(item.reelsReach) + '</b></td><td>' + number(item.carouselReach) + '</td><td>' + number(item.leads) + '</td><td>' + number(item.sales) + '</td><td><b>' + money(item.revenue) + '</b></td><td>' + publication + '</td></tr>';
        }).join("");
        renderUnifiedPlacementTable(pageRows,rows,pages);
      }
      function renderTopBloggers() {
        document.getElementById("topBloggers").innerHTML = bloggers.filter(function (b) { return b.revenue > 0; }).sort(function (a,b) { return b.revenue-a.revenue; }).slice(0,4).map(function (b) {
          var romi = Math.round((b.revenue / Math.max(25000,b.reach*2.2))*100);
          return '<tr data-open-blogger="' + b.id + '"><td><div class="blogger-cell"><div class="mini-avatar">' + initials(b.display) + '</div><div><strong>' + b.display + '</strong><small>' + b.name + '</small></div></div></td><td><span class="badge ' + (b.brand === "ЛН" ? "badge-green" : "badge-purple") + '">' + b.brand + '</span></td><td><b>' + b.leads + '</b></td><td>' + b.sales + '</td><td><b>' + money(b.revenue) + '</b></td><td><span class="' + (romi > 200 ? "trend-up" : "trend-down") + '">' + romi + '%</span></td></tr>';
        }).join("");
      }
      function bloggerEditInput(blogger, field, value, type, extraClass) {
        return '<input class="inline-edit-control ' + (extraClass || '') + '" type="' + (type || 'text') + '" value="' + safeText(value) + '" data-blogger-edit="' + blogger.id + '" data-blogger-field="' + field + '">';
      }
      function bloggerEditSelect(blogger, field, value, options) {
        return '<select class="inline-edit-control" data-blogger-edit="' + blogger.id + '" data-blogger-field="' + field + '">' + options.map(function (option) { return '<option' + (option === value ? ' selected' : '') + '>' + safeText(option) + '</option>'; }).join('') + '</select>';
      }
      function bloggerLastIso(value) {
        var match = String(value || "").match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
        return match ? match[3] + "-" + String(match[2]).padStart(2,"0") + "-" + String(match[1]).padStart(2,"0") : "";
      }
      function createdTimestamp(item) {
        var parsed = Date.parse((item && item.createdAt) || "");
        if (Number.isFinite(parsed)) return parsed;
        var numericId = Number(item && item.id);
        return numericId > 1000000000000 ? numericId : 0;
      }
      function renderBloggers() {
        var q = document.getElementById("bloggerSearch").value.toLowerCase().trim();
        var month = document.getElementById("bloggerMonthFilter").value;
        var st = document.getElementById("statusFilter").value;
        var mg = document.getElementById("managerFilter").value;
        var br = document.getElementById("brandFilter").value;
        var category = document.getElementById("categoryFilter").value;
        var platform = document.getElementById("bloggerPlatformFilter").value;
        var contract = document.getElementById("bloggerContractFilter").value;
        var reachMinRaw = document.getElementById("bloggerReachMin").value;
        var reachMaxRaw = document.getElementById("bloggerReachMax").value;
        var leadsMinRaw = document.getElementById("bloggerLeadsMin").value;
        var salesMinRaw = document.getElementById("bloggerSalesMin").value;
        var revenueMinRaw = document.getElementById("bloggerRevenueMin").value;
        var reachMin = reachMinRaw === "" ? null : Number(reachMinRaw);
        var reachMax = reachMaxRaw === "" ? null : Number(reachMaxRaw);
        var leadsMin = leadsMinRaw === "" ? null : Number(leadsMinRaw);
        var salesMin = salesMinRaw === "" ? null : Number(salesMinRaw);
        var revenueMin = revenueMinRaw === "" ? null : Number(revenueMinRaw);
        var lastFrom = document.getElementById("bloggerLastFrom").value;
        var lastTo = document.getElementById("bloggerLastTo").value;
        var sort = document.getElementById("bloggerSortFilter").value;
        var filtered = bloggers.filter(function (b) {
          var haystack = [b.name,b.display,b.link,b.manager,b.brand,b.category].join(" ").toLowerCase();
          var commercialReady = b.commercialContract === "Подписан";
          var barterReady = b.barterContract === "Подписан";
          var contractMatch = !contract ||
            (contract === "all-ready" && commercialReady && barterReady) ||
            (contract === "commercial" && commercialReady) ||
            (contract === "barter" && barterReady) ||
            (contract === "missing" && !commercialReady && !barterReady) ||
            (contract === "processing" && (b.commercialContract === "На оформлении" || b.barterContract === "На оформлении"));
          var lastIso = bloggerLastIso(b.last);
          var monthMatch = !month || [monthFromDateValue(b.createdAt),monthFromDateValue(b.sortDate),monthFromDateValue(b.last)].indexOf(month) >= 0 || placementRowsForBlogger(b).some(function (item) { return monthFromDateValue(item.sortDate || item.start) === month; });
          return (!q || haystack.indexOf(q) >= 0) &&
            monthMatch &&
            (!st || b.status === st) && (!mg || b.manager === mg) && (!br || b.brand === br) && (!category || b.category === category) &&
            (!platform || (b.platforms || []).indexOf(platform) >= 0) && contractMatch &&
            (reachMin == null || Number(b.reach || 0) >= reachMin) && (reachMax == null || Number(b.reach || 0) <= reachMax) &&
            (leadsMin == null || Number(b.leads || 0) >= leadsMin) && (salesMin == null || Number(b.sales || 0) >= salesMin) &&
            (revenueMin == null || Number(b.revenue || 0) >= revenueMin) &&
            (!lastFrom || (lastIso && lastIso >= lastFrom)) && (!lastTo || (lastIso && lastIso <= lastTo));
        });
        filtered.sort(function (a,b) {
          if (sort === "created-desc") return createdTimestamp(b)-createdTimestamp(a);
          if (sort === "reach-desc") return Number(b.reach || 0)-Number(a.reach || 0);
          if (sort === "reach-asc") return Number(a.reach || 0)-Number(b.reach || 0);
          if (sort === "leads-desc") return Number(b.leads || 0)-Number(a.leads || 0);
          if (sort === "sales-desc") return Number(b.sales || 0)-Number(a.sales || 0);
          if (sort === "revenue-desc") return Number(b.revenue || 0)-Number(a.revenue || 0);
          if (sort === "last-desc") return bloggerLastIso(b.last).localeCompare(bloggerLastIso(a.last));
          return String(a.display || a.name).localeCompare(String(b.display || b.name),"ru");
        });
        var body = document.getElementById("bloggersTable");
        body.closest("table").classList.toggle("table-editing",bloggerEditMode);
        body.innerHTML = filtered.map(function (b) {
          if (bloggerEditMode) {
            return '<tr><td style="min-width:210px">' + bloggerEditInput(b,'display',b.display) + bloggerEditInput(b,'name',b.name) + bloggerEditInput(b,'link',b.link) + '</td><td>' + bloggerEditSelect(b,'brand',b.brand,['ЛН','FIT PRO']) + '</td><td>' + bloggerEditInput(b,'platforms',(b.platforms || []).join(', ')) + '</td><td style="min-width:170px">' + bloggerEditInput(b,'category',b.category) + '</td><td>' + bloggerEditSelect(b,'status',b.status,['Вышел','Тест','На оформлении','Отказ']) + '</td><td>' + bloggerEditInput(b,'manager',b.manager) + '</td><td>' + bloggerEditSelect(b,'commercialContract',b.commercialContract,['Подписан','На оформлении','Нет']) + '</td><td>' + bloggerEditSelect(b,'barterContract',b.barterContract,['Подписан','На оформлении','Нет']) + '</td><td>' + bloggerEditInput(b,'reach',b.reach,'number','inline-edit-number') + '</td><td>' + bloggerEditInput(b,'leads',b.leads,'number','inline-edit-number') + '</td><td>' + bloggerEditInput(b,'sales',b.sales,'number','inline-edit-number') + '</td><td>' + bloggerEditInput(b,'revenue',b.revenue,'number','inline-edit-number') + '</td><td>' + bloggerEditInput(b,'last',b.last) + '</td><td><span class="badge badge-amber">Редактируется</span></td></tr>';
          }
          return '<tr><td><div class="blogger-cell blogger-card-link" data-open-blogger="' + b.id + '" title="Открыть карточку блогера"><div class="mini-avatar">' + initials(b.display) + '</div><div><strong>' + safeText(b.display) + '</strong><small>' + safeText(b.name) + ' · Открыть карточку</small></div></div></td><td><span class="badge ' + (b.brand === "ЛН" ? "badge-green" : "badge-purple") + '">' + safeText(b.brand) + '</span></td><td><div class="platforms">' + platformHtml(b.platforms) + '</div></td><td><span class="badge badge-blue">' + safeText(b.category) + '</span></td><td><span class="badge ' + badgeClass(b.status) + '">' + safeText(b.status) + '</span></td><td>' + safeText(b.manager) + '</td><td>' + contractBadge(b.commercialContract) + '</td><td>' + contractBadge(b.barterContract) + '</td><td>' + new Intl.NumberFormat("ru-RU").format(b.reach) + '</td><td><b>' + b.leads + '</b></td><td><b>' + b.sales + '</b></td><td><b>' + money(b.revenue) + '</b></td><td>' + safeText(b.last) + '</td><td><div class="row-actions"><button class="btn btn-sm btn-outline" data-open-blogger="' + b.id + '">Карточка →</button></div></td></tr>';
        }).join("");
        document.getElementById("bloggersEmpty").classList.toggle("hidden", filtered.length > 0);
        document.getElementById("bloggerResultCount").textContent = "Найдено: " + filtered.length + " из " + bloggers.length + (month ? " · выбран " + activeMonthLabel(month) : " · вся база");
        document.getElementById("bloggerCountBadge").textContent = bloggers.length;
      }
      function syncBloggerEditControls() {
        var toggle = document.getElementById("toggleBloggerEditBtn");
        var cancel = document.getElementById("cancelBloggerEditBtn");
        toggle.textContent = bloggerEditMode ? "✓ Сохранить изменения" : "✎ Редактировать таблицу";
        toggle.classList.toggle("btn-primary",bloggerEditMode);
        toggle.classList.toggle("btn-outline",!bloggerEditMode);
        toggle.classList.toggle("hidden",role !== "leader");
        cancel.classList.toggle("hidden",role !== "leader" || !bloggerEditMode);
      }
      function startBloggerEditing() {
        if (role !== "leader") return showToast("Редактирование всей таблицы доступно только администратору");
        bloggerEditSnapshot = JSON.parse(JSON.stringify(bloggers));
        bloggerEditMode = true;
        syncBloggerEditControls();
        renderBloggers();
        showToast("Режим редактирования включён");
      }
      function saveBloggerEdits() {
        bloggerEditMode = false;
        bloggerEditSnapshot = null;
        saveData();
        queueSharedStateRecords(bloggers.map(sharedBloggerRecord));
        initializeImportedData();
        syncBloggerEditControls();
        renderBloggers();
        renderTopBloggers();
        renderMonthlyPlanFact();
        refreshMonthFilters();
        renderWeeklyExits();
        showToast("Изменения в базе блогеров сохранены");
      }
      function cancelBloggerEdits(silent) {
        if (bloggerEditSnapshot) bloggers = bloggerEditSnapshot;
        bloggerEditSnapshot = null;
        bloggerEditMode = false;
        syncBloggerEditControls();
        renderBloggers();
        if (!silent) showToast("Изменения отменены");
      }
      function updateBloggerInline(control) {
        var blogger = bloggers.find(function (item) { return item.id === Number(control.dataset.bloggerEdit); });
        if (!blogger || role !== "leader" || !bloggerEditMode) return;
        var field = control.dataset.bloggerField;
        if (field === "platforms") {
          var aliases = {instagram:"ig",ig:"ig",telegram:"tg",tg:"tg",vk:"vk",вк:"vk"};
          blogger.platforms = control.value.toLowerCase().split(/[,;\s]+/).map(function (value) { return aliases[value] || value; }).filter(function (value,index,array) { return ["ig","tg","vk"].indexOf(value) >= 0 && array.indexOf(value) === index; });
          if (!blogger.platforms.length) blogger.platforms = ["ig"];
          return;
        }
        if (["reach","leads","sales","revenue"].indexOf(field) >= 0) blogger[field] = Math.max(0,Number(control.value || 0));
        else blogger[field] = control.value.trim();
      }
      function initializeImportedData() {
        var categories = bloggers.map(function (item) { return item.category; }).filter(function (value,index,array) { return value && array.indexOf(value) === index; }).sort();
        document.getElementById("categoryFilter").innerHTML = '<option value="">Все категории</option>' + categories.map(function (value) { return '<option>' + safeText(value) + '</option>'; }).join("");
        if (importedData) {
          document.getElementById("bloggerImportMeta").textContent = importedData.meta.bloggers + " блогеров · " + importedData.meta.categories + " с категорией · снимок " + importedData.meta.snapshot + " · ручное редактирование доступно администратору";
          document.getElementById("placementImportMeta").textContent = importedData.meta.placements + " размещений · " + importedData.meta.reels + " Reels · снимок " + importedData.meta.snapshot;
        }
        populatePlacementBloggerSelect();
        refreshMonthFilters();
        refreshStaffSelectors();
        if (document.getElementById("page-calendar").classList.contains("active")) refreshExitSourceMeta();
      }
      function populatePlacementBloggerSelect() {
        var select = document.getElementById("newPlacementBlogger");
        if (!select) return;
        var current = select.value;
        var search = document.getElementById("newPlacementBloggerSearch");
        var query = String(search ? search.value : "").trim().toLowerCase();
        var normalizedQuery = query.replace(/^@/,"");
        var matches = bloggers.filter(function (blogger) {
          if (!query) return true;
          return [blogger.name,blogger.display,blogger.link,blogger.sourceKey].some(function (value) {
            var text = String(value || "").toLowerCase();
            return text.indexOf(query) >= 0 || (normalizedQuery && text.replace(/^@/,"").indexOf(normalizedQuery) >= 0);
          });
        }).sort(function (a,b) { return String(a.display || a.name).localeCompare(String(b.display || b.name),"ru"); });
        select.innerHTML = '<option value="">' + (matches.length ? 'Выберите блогера из найденных…' : 'Блогеры не найдены') + '</option>' + matches.map(function (blogger) {
          return '<option value="' + blogger.id + '">' + safeText(blogger.display || blogger.name) + ' · ' + safeText(blogger.name) + ' · ' + safeText(blogger.brand) + '</option>';
        }).join('');
        if (current && matches.some(function (blogger) { return String(blogger.id) === String(current); })) select.value = current;
        else if (query && matches.length === 1) select.value = String(matches[0].id);
        var meta = document.getElementById("newPlacementBloggerSearchMeta");
        if (meta) meta.textContent = query ? "Найдено: " + matches.length + (matches.length === 1 ? " · карточка выбрана автоматически" : "") : "Можно искать по @нику, имени или ссылке";
        updatePlacementBloggerPreview();
      }
      function updatePlacementBloggerPreview() {
        var id = document.getElementById("newPlacementBlogger").value;
        var blogger = bloggers.find(function (item) { return String(item.id) === String(id); });
        var button = document.getElementById("openSelectedBloggerBtn");
        button.disabled = !blogger;
        if (!blogger) {
          document.getElementById("newPlacementBloggerName").textContent = "Блогер не выбран";
          document.getElementById("newPlacementBloggerMeta").textContent = "Выберите карточку из общей базы выше";
          return;
        }
        document.getElementById("newPlacementBloggerName").textContent = blogger.display + " · " + blogger.name;
        document.getElementById("newPlacementBloggerMeta").textContent = blogger.brand + " · " + blogger.manager + " · " + blogger.category;
        document.getElementById("newPlacementManager").value = activeEmployeeManagers().indexOf(blogger.manager) >= 0 ? blogger.manager : (activeEmployeeManagers()[0] || "");
        document.getElementById("newPlacementDirection").value = blogger.brand;
      }
      function bloggerExitIsoDate(blogger) {
        var sortDate = String((blogger && blogger.sortDate) || "");
        if (/^\d{4}-\d{2}-\d{2}$/.test(sortDate)) return sortDate;
        var match = String((blogger && blogger.last) || "").match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
        if (match) return match[3] + "-" + String(match[2]).padStart(2,"0") + "-" + String(match[1]).padStart(2,"0");
        var createdAt = String((blogger && blogger.createdAt) || "").slice(0,10);
        return /^\d{4}-\d{2}-\d{2}$/.test(createdAt) ? createdAt : "";
      }
      function bloggerExitFormat(blogger) {
        var labels = {ig:"Instagram",tg:"Telegram",vk:"VK"};
        return (blogger.platforms || []).map(function (platform) { return labels[platform] || String(platform).toUpperCase(); }).join(" + ") || "Не указан";
      }
      function bloggerExitHistorySources() {
        var grouped = {};
        (baseBloggers || []).concat(bloggers).forEach(function (blogger) {
          if (!blogger || ["Вышел","В пуле"].indexOf(blogger.status) < 0) return;
          var isoDate = bloggerExitIsoDate(blogger);
          var identity = normalizeBloggerIdentity(blogger.sourceKey || blogger.link || blogger.name || blogger.display);
          if (!isoDate || !identity) return;
          grouped[identity + "|" + isoDate] = blogger;
        });
        return Object.keys(grouped).map(function (key) { return grouped[key]; });
      }
      function syncedWeeklyExits() {
        if (synchronizedExitCache) return synchronizedExitCache;
        var placementByIdentityDate = {};
        var placementById = {};
        synchronizedPlacementRecords().forEach(function (placement) {
          var date = placementIsoDate(placement);
          if (placement.id != null) placementById[String(placement.id)] = placement;
          [placement.sourceKey,placement.tag,placement.bloggerLink].map(normalizeBloggerIdentity).filter(Boolean).forEach(function (identity) {
            var key = identity + "|" + date;
            var current = placementByIdentityDate[key];
            if (!current || (effectivePlacementActual(current) == null && effectivePlacementActual(placement) != null)) placementByIdentityDate[key] = placement;
          });
        });
        var rows = weeklyExits.filter(function (item) { return !placementIsDeleted(item); }).map(function (item) {
          var blogger = linkedBloggerForPlacement(item);
          var identity = normalizeBloggerIdentity(item.sourceKey || item.tag || item.bloggerLink);
          var exact = placementById[String(item.sourcePlacementId || "")] || placementByIdentityDate[identity + "|" + item.sortDate];
          var actual = effectivePlacementActual(exact);
          return Object.assign({},item,blogger ? {tag:blogger.name || item.tag,manager:blogger.manager || item.manager,bloggerLink:blogger.link || item.bloggerLink,cardBloggerId:blogger.id} : {},exact ? {_periodStart:exact.warmupStart || "",_periodEnd:exact.warmupEnd || ""} : {},actual == null ? {} : {_resolvedActual:actual});
        });
        var representedPlacementIds = {};
        rows.forEach(function (item) { if (item.sourcePlacementId != null && item.sourcePlacementId !== "") representedPlacementIds[String(item.sourcePlacementId)] = true; });
        synchronizedPlacementRecords().forEach(function (placement) {
          initializeWarmupDates(placement);
          if (!placementIsoDate(placement) || representedPlacementIds[String(placement.id)]) return;
          var row = weeklyExitFromPlacement(placement);
          var actual = effectivePlacementActual(placement);
          rows.push(Object.assign({},row,{_periodStart:placement.warmupStart || "",_periodEnd:placement.warmupEnd || ""},actual == null ? {} : {_resolvedActual:actual}));
          representedPlacementIds[String(placement.id)] = true;
        });
        bloggerExitHistorySources().forEach(function (blogger) {
          var isoDate = bloggerExitIsoDate(blogger);
          if (!isoDate) return;
          if (placementIsDeleted({sourceKey:blogger.sourceKey,tag:blogger.name || blogger.display,bloggerLink:blogger.link,sortDate:isoDate})) return;
          var identity = normalizeBloggerIdentity(blogger.sourceKey || blogger.link || blogger.name || blogger.display);
          var currentCard = linkedBloggerForPlacement({sourceKey:blogger.sourceKey,tag:blogger.name || blogger.display,bloggerLink:blogger.link,brand:blogger.brand,manager:blogger.manager}) || blogger;
          var exactIndex = rows.findIndex(function (item) { return placementMatchesBlogger(item,blogger) && item.sortDate === isoDate; });
          var placement = placementByIdentityDate[identity + "|" + isoDate] || null;
          var dateParts = isoDate.split("-");
          var placementActual = effectivePlacementActual(placement);
          var cardActual = Number(blogger.reach);
          cardActual = Number.isFinite(cardActual) && cardActual >= 0 && cardActual <= MAX_BLOGGER_REACH ? cardActual : null;
          var cardValues = {
            tag:blogger.name || blogger.display || "—",manager:blogger.manager || currentCard.manager || "Не назначен",bloggerLink:blogger.link || currentCard.link || "",cardBloggerId:currentCard.id,cardActualPreferred:true,_resolvedActual:placementActual == null ? cardActual : placementActual,
            date:dateParts[2] + "." + dateParts[1] + "." + dateParts[0],sortDate:isoDate,month:dateParts[1] + "." + dateParts[0],
            warmupDay:placement ? warmupRangeLabel(placement) : "—",format:placement ? (placement.type || bloggerExitFormat(blogger)) : bloggerExitFormat(blogger),
            plannedReach:placement ? Number(placement.guaranteed || 0) : 0,sourceKey:placement ? placement.sourceKey : (blogger.sourceKey || "blogger:" + blogger.id),
            sourcePlacementId:placement ? placement.id : "",createdAt:isoDate + "T00:00:00Z",source:"История базы блогеров",
            _periodStart:placement ? (placement.warmupStart || "") : "",_periodEnd:placement ? (placement.warmupEnd || "") : ""
          };
          if (exactIndex >= 0) rows[exactIndex] = Object.assign({},rows[exactIndex],cardValues);
          else rows.push(Object.assign({id:"blogger-exit-" + blogger.id},cardValues));
        });
        var deduplicated = {};
        rows.forEach(function (item) {
          var identity = normalizeBloggerIdentity(item.sourceKey || item.tag || item.bloggerLink);
          var key = [identity || ("id:" + item.id),item.sortDate || item.date,String(item.format || "").trim().toLowerCase()].join("|");
          var existing = deduplicated[key];
          if (!existing || item.cardActualPreferred || (!existing.bloggerLink && item.bloggerLink)) deduplicated[key] = item;
        });
        synchronizedExitCache = Object.keys(deduplicated).map(function (key) { return deduplicated[key]; });
        return synchronizedExitCache;
      }
      function inclusiveIsoDays(start,end) {
        if (!/^\d{4}-\d{2}-\d{2}$/.test(String(start || "")) || !/^\d{4}-\d{2}-\d{2}$/.test(String(end || "")) || start > end) return [];
        var first = new Date(start + "T00:00:00Z");
        var last = new Date(end + "T00:00:00Z");
        var total = Math.round((last-first)/86400000) + 1;
        if (!Number.isFinite(total) || total < 1 || total > 45) return [];
        return Array.from({length:total},function (_,index) { return new Date(first.getTime()+index*86400000).toISOString().slice(0,10); });
      }
      function operationalWeeklyExits() {
        var result = [];
        var seen = {};
        syncedWeeklyExits().forEach(function (item) {
          var periodDays = inclusiveIsoDays(item._periodStart,item._periodEnd);
          var days = periodDays.slice();
          if (item.sortDate && days.indexOf(item.sortDate) < 0) days.push(item.sortDate);
          if (!days.length) days = [item.sortDate || ""];
          days.sort();
          days.forEach(function (day,index) {
            var dateParts = String(day || "").split("-");
            var baseKey = item.sourcePlacementId != null && item.sourcePlacementId !== "" ? "placement:" + item.sourcePlacementId : [normalizeBloggerIdentity(item.sourceKey || item.tag || item.bloggerLink) || ("id:" + item.id),item.sortDate || item.date,String(item.format || "").trim().toLowerCase()].join("|");
            var key = baseKey + "|day:" + day;
            if (seen[key]) return;
            seen[key] = true;
            var isPeriodDay = periodDays.indexOf(day) >= 0;
            result.push(Object.assign({},item,{
              id:String(item.id || baseKey) + "-day-" + day,
              sortDate:day,
              date:dateParts.length === 3 ? dateParts[2] + "." + dateParts[1] + "." + dateParts[0] : item.date,
              month:dateParts.length === 3 ? dateParts[1] + "." + dateParts[0] : item.month,
              warmupDay:isPeriodDay && periodDays.length > 1 ? warmupRangeLabel({_periodStart:item._periodStart,_periodEnd:item._periodEnd,warmupStart:item._periodStart,warmupEnd:item._periodEnd}) + " · день " + (periodDays.indexOf(day)+1) + "/" + periodDays.length : item.warmupDay,
              _periodDay:isPeriodDay ? periodDays.indexOf(day)+1 : 0,
              _periodDays:periodDays.length
            }));
          });
        });
        return result;
      }
      function refreshExitSourceMeta() {
        var sourceRows = syncedWeeklyExits();
        var rows = operationalWeeklyExits();
        var select = document.getElementById("exitFormatFilter");
        var current = select.value;
        var formats = rows.map(function (item) { return item.format; }).filter(function (value,index,array) { return value && value !== "—" && array.indexOf(value) === index; }).sort(function (a,b) { return a.localeCompare(b,"ru"); });
        select.innerHTML = '<option value="">Все форматы</option>' + formats.map(function (value) { return '<option>' + safeText(value) + '</option>'; }).join("");
        if (formats.indexOf(current) >= 0) select.value = current;
        var periodRows = rows.filter(function (item) { return item._periodDays > 1; }).length;
        document.getElementById("exitImportMeta").textContent = sourceRows.length + " размещений · " + rows.length + " дней учёта" + (periodRows ? " · период прогрева учитывается ежедневно" : "") + " · без фоновой проверки";
      }
      function filteredWeeklyExits() {
        var query = document.getElementById("exitSearch").value.toLowerCase().trim();
        var month = document.getElementById("exitMonthFilter").value;
        var manager = document.getElementById("exitManagerFilter").value;
        var format = document.getElementById("exitFormatFilter").value;
        var reachMin = document.getElementById("exitReachMin").value;
        var reachMax = document.getElementById("exitReachMax").value;
        var dateFrom = document.getElementById("exitDateFrom").value;
        var dateTo = document.getElementById("exitDateTo").value;
        var actualState = document.getElementById("exitActualFilter").value;
        var sort = document.getElementById("exitSortFilter").value;
        var rows = operationalWeeklyExits().filter(function (item) {
          var actual = actualForExit(item);
          var reach = actual == null ? Number(item.plannedReach || 0) : Number(actual);
          return (!query || item.tag.toLowerCase().indexOf(query) >= 0) && (!month || monthFromDateValue(item.sortDate) === month) && (!manager || employeeNameMatches(manager,item.manager)) &&
            (!format || item.format === format) && (reachMin === "" || reach >= Number(reachMin)) && (reachMax === "" || reach <= Number(reachMax)) &&
            (!dateFrom || item.sortDate >= dateFrom) && (!dateTo || item.sortDate <= dateTo) &&
            (!actualState || (actualState === "ready" && actual != null) || (actualState === "missing" && actual == null));
        });
        rows.sort(function (a,b) {
          var reachA = actualForExit(a); reachA = reachA == null ? Number(a.plannedReach || 0) : Number(reachA);
          var reachB = actualForExit(b); reachB = reachB == null ? Number(b.plannedReach || 0) : Number(reachB);
          if (sort === "created-desc") return String(b.sortDate || "").localeCompare(String(a.sortDate || "")) || createdTimestamp(b)-createdTimestamp(a);
          if (sort === "date-asc") return String(a.sortDate).localeCompare(String(b.sortDate));
          if (sort === "reach-desc") return reachB-reachA;
          if (sort === "reach-asc") return reachA-reachB;
          return String(b.sortDate).localeCompare(String(a.sortDate));
        });
        return rows;
      }
      function actualForExit(item) {
        return item && item._resolvedActual != null && Number.isFinite(Number(item._resolvedActual)) ? Number(item._resolvedActual) : null;
      }
      function renderWeeklyExits() {
        refreshExitSourceMeta();
        var rows = filteredWeeklyExits();
        var pages = Math.max(1,Math.ceil(rows.length / PAGE_SIZE));
        exitPage = Math.min(exitPage,pages);
        var pageRows = rows.slice((exitPage-1)*PAGE_SIZE,exitPage*PAGE_SIZE);
        document.getElementById("weeklyExitsTable").innerHTML = pageRows.map(function (item) {
          var blogger = linkedBloggerForPlacement(item);
          var profile = item.bloggerLink ? '<a href="' + safeText(item.bloggerLink) + '" target="_blank" rel="noopener">Площадка ↗</a>' : '—';
          var action = blogger ? ' data-open-blogger="' + blogger.id + '" title="Открыть карточку блогера"' : '';
          var actual = actualForExit(item);
          var actualCell = actual == null ? '<span class="trend-warn">Ожидается</span>' : '<b>' + number(actual) + '</b>';
          var status = actual == null ? '<span class="badge badge-amber">Ждём факт</span>' : '<span class="badge badge-green">Факт внесён</span>';
          var remove = role === "leader" ? '<button class="btn btn-sm btn-outline" type="button" data-delete-exit="' + safeText(placementDeletionKey(item)) + '" aria-label="Удалить выход">Удалить</button>' : '—';
          return '<tr><td><b>' + safeText(item.date) + '</b></td><td><div class="blogger-cell' + (blogger ? ' blogger-card-link' : '') + '"' + action + '><div class="mini-avatar">' + initials(item.tag) + '</div><div><strong>' + safeText(item.tag) + '</strong><small>' + (blogger ? 'Открыть карточку' : 'Карточка не найдена') + '</small></div></div></td><td>' + safeText(item.manager) + '</td><td>' + safeText(item.warmupDay) + '</td><td><span class="badge badge-blue">' + safeText(item.format) + '</span></td><td><b>' + number(item.plannedReach) + '</b></td><td>' + actualCell + '</td><td>' + status + '</td><td>' + profile + '</td><td>' + remove + '</td></tr>';
        }).join("") || '<tr><td colspan="10"><div class="empty-state">По выбранным фильтрам выходы не найдены.</div></td></tr>';
        document.getElementById("exitResultCount").textContent = "Найдено: " + rows.length + " дней учёта · " + syncedWeeklyExits().length + " размещений" + (document.getElementById("exitMonthFilter").value ? " · выбран " + activeMonthLabel(document.getElementById("exitMonthFilter").value) : " · вся база");
        document.getElementById("exitPagerText").textContent = rows.length ? "Страница " + exitPage + " из " + pages + " · записи " + ((exitPage-1)*PAGE_SIZE+1) + "–" + Math.min(exitPage*PAGE_SIZE,rows.length) + " из " + rows.length : "Нет записей";
        document.getElementById("exitPrev").disabled = exitPage <= 1;
        document.getElementById("exitNext").disabled = exitPage >= pages;
      }
      function renderEvidenceReports() {
        var body = document.getElementById("evidenceTable");
        var employeeFilter = document.getElementById("evidenceEmployeeFilter").value;
        var visibleReports = employeeFilter === "all" ? evidenceReports : evidenceReports.filter(function (report) { return employeeNameMatches(employeeFilter,report.uploader); });
        body.innerHTML = visibleReports.map(function (report) {
          var images = (report.images || []).slice(0, 3).map(function (src) {
            return '<img class="proof-thumb" src="' + src + '" alt="Скриншот фактического охвата">';
          }).join("");
          var proof = images
            ? '<div class="proof-stack">' + images + '<button class="proof-more" data-view-evidence="' + report.id + '">Открыть (' + report.images.length + ')</button></div>'
            : '<span class="badge badge-red">Нет файлов</span>';
          return '<tr><td><div class="blogger-cell"><div class="mini-avatar">' + initials(report.blogger) + '</div><div><strong>' + report.blogger + '</strong><small>Отчёт по выходу</small></div></div></td><td>' + report.date.split("-").reverse().join(".") + '</td><td><b>' + new Intl.NumberFormat("ru-RU").format(report.reach) + '</b></td><td>' + new Intl.NumberFormat("ru-RU").format(report.clicks || 0) + '</td><td>' + proof + '</td><td>' + report.uploader + '</td><td><span class="badge badge-green">' + report.status + '</span></td></tr>';
        }).join("") || '<tr><td colspan="7"><div class="empty-state">У выбранного сотрудника пока нет отчётов по охватам.</div></td></tr>';
        document.getElementById("evidenceCountBadge").textContent = visibleReports.length + " из " + evidenceReports.length + " отчётов";
      }
      function renderEvidencePreview() {
        document.getElementById("evidencePreview").innerHTML = pendingEvidenceImages.map(function (item, index) {
          return '<div class="evidence-image"><img src="' + safeText(item.preview) + '" alt="Прикреплённый скриншот ' + (index + 1) + '"><button type="button" aria-label="Удалить фотографию" data-remove-evidence="' + index + '">×</button></div>';
        }).join("");
        document.getElementById("evidenceUploadCount").textContent = "Выбрано " + pendingEvidenceImages.length + " из 10";
      }
      function releasePendingEvidenceImages() {
        pendingEvidenceImages.forEach(function (item) { if (item && /^blob:/.test(item.preview || "")) URL.revokeObjectURL(item.preview); });
      }
      function populateEvidenceBloggers(selected) {
        var names = bloggers.map(function (b) { return b.name; }).concat(["@fit_with_anna","@alexey_vlasov"]);
        if (selected && names.indexOf(selected) < 0) names.unshift(selected);
        names = names.filter(function (name, index) { return names.indexOf(name) === index; });
        var select = document.getElementById("evidenceBlogger");
        select.innerHTML = names.map(function (name) { return '<option>' + name + '</option>'; }).join("");
        if (selected) select.value = selected;
      }
      function openEvidenceForm(blogger) {
        if (role === "analyst") return showToast("У аналитика доступ только на просмотр");
        document.getElementById("evidenceForm").reset();
        document.getElementById("evidenceDate").value = localTodayIso();
        populateEvidenceBloggers(blogger || "");
        refreshStaffSelectors();
        var preferredEmployee = currentEmployeeProfile && currentEmployeeProfile.name || document.getElementById("evidenceEmployeeFilter").value;
        if (activeEmployeeNames().indexOf(preferredEmployee) >= 0) document.getElementById("evidenceEmployee").value = preferredEmployee;
        releasePendingEvidenceImages();
        pendingEvidenceImages = [];
        renderEvidencePreview();
        openLayer(document.getElementById("evidenceModal"));
      }
      function compressEvidenceImage(file) {
        return new Promise(function (resolve, reject) {
          if (!file || !/^image\/(jpeg|png|webp)$/i.test(file.type || "")) return reject(new Error("Неподдерживаемый формат"));
          if (file.size > 15 * 1024 * 1024) return reject(new Error("Файл больше 15 МБ"));
          var originalUrl = URL.createObjectURL(file);
          var image = new Image();
          image.onerror = function () { resolve({file:file,preview:originalUrl,name:file.name || "screenshot"}); };
          image.onload = function () {
            var ratio = Math.min(1, 1600 / image.width, 5000 / image.height);
            var canvas = document.createElement("canvas");
            canvas.width = Math.max(1, Math.round(image.width * ratio));
            canvas.height = Math.max(1, Math.round(image.height * ratio));
            canvas.getContext("2d").drawImage(image, 0, 0, canvas.width, canvas.height);
            canvas.toBlob(function (blob) {
              if (!blob) { resolve({file:file,preview:originalUrl,name:file.name || "screenshot"}); return; }
              URL.revokeObjectURL(originalUrl);
              var base = String(file.name || "screenshot").replace(/\.[^.]+$/,"").slice(0,100) || "screenshot";
              var compressed = new File([blob],base + ".jpg",{type:"image/jpeg",lastModified:Date.now()});
              resolve({file:compressed,preview:URL.createObjectURL(blob),name:compressed.name});
            },"image/jpeg",.82);
          };
          image.src = originalUrl;
        });
      }
      function addEvidenceFiles(fileList) {
        var remaining = Math.max(0,10 - pendingEvidenceImages.length);
        var selected = Array.from(fileList || []);
        if (!remaining) { showToast("Можно прикрепить не больше 10 фотографий"); return Promise.resolve(); }
        if (selected.length > remaining) showToast("Добавлены первые " + remaining + " файлов из выбранных");
        selected = selected.slice(0,remaining);
        return Promise.allSettled(selected.map(compressEvidenceImage)).then(function (results) {
          var added = results.filter(function (result) { return result.status === "fulfilled"; }).map(function (result) { return result.value; });
          pendingEvidenceImages = pendingEvidenceImages.concat(added).slice(0,10);
          renderEvidencePreview();
          if (added.length) showToast("Фотографии прикреплены: " + pendingEvidenceImages.length);
          if (added.length < results.length) showToast("Некоторые файлы не удалось обработать");
        });
      }
      function openEvidenceViewer(id) {
        var report = evidenceReports.find(function (item) { return item.id === Number(id); });
        if (!report) report = evidenceReports.find(function (item) { return String(item.id) === String(id); });
        if (!report) return;
        document.getElementById("evidenceViewerTitle").textContent = "Фактические охваты · " + report.blogger;
        document.getElementById("evidenceViewerGallery").innerHTML = (report.images || []).map(function (src,index) {
          return '<figure class="evidence-viewer-item"><a href="' + safeText(src) + '" target="_blank" rel="noopener" title="Открыть оригинал"><img src="' + safeText(src) + '" alt="Скриншот охвата ' + (index + 1) + '"></a><figcaption>Фото ' + (index + 1) + ' из ' + report.images.length + ' · показано целиком, нажмите для оригинала</figcaption></figure>';
        }).join("");
        document.getElementById("evidenceViewerMeta").textContent = "Выход " + report.date.split("-").reverse().join(".") + " · Охват " + new Intl.NumberFormat("ru-RU").format(report.reach) + " · " + report.comment;
        openLayer(document.getElementById("evidenceViewerModal"));
      }
      function applyEvidenceFactsToBloggers() {
        var latestByIdentity = {};
        evidenceReports.forEach(function (report) {
          var identity = normalizeBloggerIdentity(report.blogger);
          if (!identity || !/^\d{4}-\d{2}-\d{2}$/.test(String(report.date || ""))) return;
          if (!latestByIdentity[identity] || String(report.date) > String(latestByIdentity[identity].date)) latestByIdentity[identity] = report;
        });
        bloggers.forEach(function (blogger) {
          var identities = [blogger.sourceKey,blogger.name,blogger.display,blogger.link].map(normalizeBloggerIdentity).filter(Boolean);
          var report = identities.map(function (identity) { return latestByIdentity[identity]; }).find(Boolean);
          if (!report) return;
          var reach = Number(report.reach);
          if (!Number.isFinite(reach) || reach < 0 || reach > MAX_BLOGGER_REACH) return;
          var cardDate = bloggerCardDate(blogger);
          if (!cardDate || String(report.date) >= String(cardDate) || !Number(blogger.reach || 0)) {
            blogger.reach = reach;
            blogger.sortDate = report.date;
            blogger.last = displayIsoDate(report.date);
            blogger.status = "Вышел";
          }
        });
      }
      function hydrateEvidenceReports() {
        var localReports = evidenceReports.slice();
        return apiFetch("/api/evidence-reports",{headers:{"cache-control":"no-store"}}).then(function (response) {
          if (!response.ok) throw new Error("Не удалось загрузить фотоотчёты");
          return response.json();
        }).then(function (data) {
          var remoteReports = Array.isArray(data.reports) ? data.reports : [];
          var remoteIds = remoteReports.map(function (item) { return String(item.id); });
          evidenceReports = remoteReports.concat(localReports.filter(function (item) { return remoteIds.indexOf(String(item.id)) < 0; }));
          applyEvidenceFactsToBloggers();
          refreshAllDerivedViews();
        });
      }
      function bloggerTrackedSpend(blogger) {
        return placementRowsForBlogger(blogger).reduce(function (sum,item) { return sum + Math.max(0,Number(item.cost || 0)); },0);
      }
      function bloggerTotalSpend(blogger) {
        return blogger.spent == null || blogger.spent === "" ? bloggerTrackedSpend(blogger) : Math.max(0,Number(blogger.spent || 0));
      }
      function contractFilesHtml(blogger) {
        var files = Array.isArray(blogger.contractFiles) ? blogger.contractFiles : [];
        var labels = {commercial:"Коммерческий",barter:"Бартерный"};
        if (!files.length) return '<div class="empty-state" style="padding:16px">Договоры ещё не прикреплены.</div>';
        return files.map(function (file) {
          return '<div class="contract-file"><div><strong>' + safeText(file.name) + '</strong><small>' + (labels[file.type] || 'Договор') + ' · ' + fileSize(file.size) + ' · ' + safeText(file.date) + '</small></div><div class="contract-file-actions"><button class="btn btn-sm btn-outline" type="button" data-contract-download="' + safeText(file.id) + '">Скачать</button>' + (role === "analyst" ? '' : '<button class="btn btn-sm btn-outline" type="button" data-contract-remove="' + safeText(file.id) + '">Удалить</button>') + '</div></div>';
        }).join("");
      }
      function renderCardContractFiles(blogger) {
        document.getElementById("cardContractFileList").innerHTML = contractFilesHtml(blogger);
      }
      function openBlogger(id) {
        var b = bloggers.find(function (x) { return x.id === Number(id); });
        if (!b) return;
        currentBloggerId = b.id;
        document.getElementById("drawerAvatar").textContent = initials(b.display);
        document.getElementById("drawerName").textContent = b.name;
        document.getElementById("drawerMeta").textContent = b.brand + " · " + b.manager + " · " + b.platforms.map(function (x) { return x.toUpperCase(); }).join(", ");
        document.getElementById("editName").value = b.name;
        document.getElementById("editManager").value = activeEmployeeManagers().indexOf(b.manager) >= 0 ? b.manager : (activeEmployeeManagers()[0] || "");
        document.getElementById("editLink").value = b.link;
        document.querySelectorAll("[data-edit-platform]").forEach(function (input) { input.checked = b.platforms.indexOf(input.value) >= 0; });
        document.getElementById("editBrand").value = b.brand;
        document.getElementById("editStatus").value = b.status;
        document.getElementById("editCommercialContract").value = b.commercialContract;
        document.getElementById("editBarterContract").value = b.barterContract;
        document.getElementById("editCooperationType").value = b.cooperationType || "Бартер";
        document.getElementById("editSpent").value = bloggerTotalSpend(b);
        document.getElementById("editReach").value = b.reach;
        document.getElementById("editComment").value = b.comment || "";
        var trackedSpend = bloggerTrackedSpend(b);
        document.getElementById("trackedSpendNote").textContent = "В реестре размещений учтено " + money(trackedSpend) + ". Поле «Потрачено всего» можно скорректировать вручную.";
        document.getElementById("drawerLeads").textContent = b.leads;
        document.getElementById("drawerSales").textContent = b.sales;
        document.getElementById("drawerRevenue").textContent = money(b.revenue);
        document.getElementById("drawerSpent").textContent = money(bloggerTotalSpend(b));
        document.getElementById("contractUploadFile").value = "";
        renderCardContractFiles(b);
        refreshContractFiles(b).catch(function () { showToast("Не удалось обновить список договоров"); });
        populateCardActualPlacements(b);
        renderBloggerHistory(b);
        document.querySelectorAll(".drawer-tab").forEach(function (tab) { tab.classList.toggle("active",tab.dataset.drawerView === "card"); });
        document.querySelectorAll(".drawer-view").forEach(function (view) { view.classList.add("hidden"); });
        document.getElementById("drawerViewCard").classList.remove("hidden");
        document.getElementById("drawerFoot").classList.remove("hidden");
        openLayer(drawer);
      }
      function placementRowsForBlogger(blogger) {
        return placementRecords.concat(virtualCardReachRecords).filter(function (item) {
          return placementMatchesBlogger(item,blogger);
        }).sort(function (a,b) { return String(b.sortDate || "").localeCompare(String(a.sortDate || "")); });
      }
      function manualCardReachPlacement(blogger) {
        var existing = virtualCardReachRecords.find(function (item) { return String(item.bloggerId) === String(blogger.id); });
        var isoDate = bloggerCardDate(blogger) || new Date().toISOString().slice(0,10);
        var parts = isoDate.split("-");
        var displayDate = parts[2] + "." + parts[1] + "." + parts[0];
        var currentReach = Number(blogger.reach || 0);
        if (existing) {
          existing.start = displayDate; existing.sortDate = isoDate; existing.tag = blogger.name || blogger.display;
          existing.bloggerLink = blogger.link || ""; existing.manager = blogger.manager || "Не назначен";
          existing.dealType = blogger.cooperationType || "Бартер"; existing.fullName = blogger.display || blogger.name;
          existing.contract = bloggerContractForPlacement(blogger,existing); existing.platform = bloggerPlatformLabel(blogger);
          existing.cost = Number(blogger.spent || 0); existing.actual = Number.isFinite(currentReach) && currentReach > 0 && currentReach <= MAX_BLOGGER_REACH ? currentReach : null;
          existing.leads = Number(blogger.leads || 0); existing.sales = Number(blogger.sales || 0); existing.revenue = Number(blogger.revenue || 0);
          existing.brand = blogger.brand || "ЛН"; existing.createdAt = blogger.createdAt || existing.createdAt || "";
          existing._cardSyncedActual = true;
          return existing;
        }
        var item = {
          id:"card-reach-" + blogger.id,bloggerId:blogger.id,isCardReach:true,isVirtualCardReach:true,
          source:"Ручной факт из карточки",sourceKey:blogger.sourceKey || "blogger:" + blogger.id,start:displayDate,sortDate:isoDate,warmup:"—",
          tag:blogger.name || blogger.display,bloggerLink:blogger.link || "",decision:"На оценке",manager:blogger.manager || "Не назначен",
          dealType:blogger.cooperationType || "Бартер",brief:"Нужны данные",fullName:blogger.display || blogger.name,
          contract:bloggerContractForPlacement(blogger,{dealType:blogger.cooperationType}),chat:false,platform:bloggerPlatformLabel(blogger),type:"Факт из карточки",duration:"—",cost:Number(blogger.spent || 0),
          guaranteed:0,actual:Number.isFinite(currentReach) && currentReach > 0 && currentReach <= MAX_BLOGGER_REACH ? currentReach : null,
          clicks:null,leads:Number(blogger.leads || 0),sales:Number(blogger.sales || 0),revenue:Number(blogger.revenue || 0),comment:"Данные подтянуты из карточки блогера",brand:blogger.brand || "ЛН",contentLink:"",createdAt:blogger.createdAt || "",_cardSyncedActual:true
        };
        virtualCardReachRecords.push(item);
        return item;
      }
      function populateCardActualPlacements(blogger) {
        var select = document.getElementById("cardActualPlacement");
        var current = select.value;
        var rows = placementRowsForBlogger(blogger);
        if (!rows.length) rows = [manualCardReachPlacement(blogger)];
        select.innerHTML = rows.length ? rows.map(function (item) {
          return '<option value="' + safeText(placementOverrideKey(item)) + '">' + safeText(item.start) + ' · ' + safeText(item.type) + ' · гарант ' + number(item.guaranteed) + (item.actual == null ? (item.importedActualWarning != null ? ' · факт требует исправления' : ' · факт не внесён') : ' · факт ' + number(item.actual)) + '</option>';
        }).join("") : '<option value="">Нет связанных размещений</option>';
        if (current && rows.some(function (item) { return placementOverrideKey(item) === current; })) select.value = current;
        var selected = rows.find(function (item) { return placementOverrideKey(item) === select.value; }) || rows[0];
        populateCardActualFormats(selected);
        populateCardWarmupDates(selected);
        document.getElementById("cardActualClicks").value = effectivePlacementClicks(selected) == null ? "" : effectivePlacementClicks(selected);
        cardActualDirty = false;
        document.getElementById("saveCardActualBtn").disabled = !rows.length || !canEditActualReach();
        document.getElementById("cardActualSaveStatus").style.display = "none";
      }
      function populateCardWarmupDates(item) {
        initializeWarmupDates(item);
        document.getElementById("cardWarmupStart").value = item && item.warmupStart ? item.warmupStart : "";
        document.getElementById("cardWarmupEnd").value = item && item.warmupEnd ? item.warmupEnd : "";
        document.getElementById("cardWarmupStart").disabled = !item || !canEditActualReach();
        document.getElementById("cardWarmupEnd").disabled = !item || !canEditActualReach();
        document.getElementById("saveCardWarmupBtn").disabled = !item || !canEditActualReach();
        document.getElementById("cardWarmupSaveStatus").style.display = "none";
      }
      function canEditActualReach() {
        return ["leader","manager","assistant"].indexOf(role) >= 0;
      }
      function canEditDailyReports() {
        return ["leader","manager","assistant"].indexOf(role) >= 0;
      }
      function placementFormats(item) {
        var raw = String((item && item.type) || "").toLowerCase();
        var formats = [];
        if (/stories|сторис|истори/.test(raw)) formats.push("stories");
        if (/reels|рилс|ролик/.test(raw)) formats.push("reels");
        if (/карусел|carousel/.test(raw)) formats.push("carousel");
        if (/пост|post/.test(raw)) formats.push("post");
        return formats;
      }
      function formatActualValue(item,format) {
        if (!item) return null;
        var facts = placementFormatActuals[placementOverrideKey(item)] || {};
        if (Object.prototype.hasOwnProperty.call(facts,format)) return Number(facts[format]);
        var formats = placementFormats(item);
        if (!Object.keys(facts).length && formats.length === 1 && formats[0] === format && item.actual != null) return Number(item.actual);
        return null;
      }
      function populateCardActualFormats(item) {
        var labels = {stories:"Сторис",reels:"Reels",carousel:"Карусель",post:"Пост"};
        var recommended = placementFormats(item);
        var facts = item ? placementFormatActuals[placementOverrideKey(item)] || {} : {};
        var selected = Object.keys(facts).length ? Object.keys(facts) : recommended;
        document.getElementById("cardActualFormatChoices").innerHTML = ["stories","reels","carousel","post"].map(function (format) {
          var checked = selected.indexOf(format) >= 0 ? " checked" : "";
          var hint = recommended.indexOf(format) >= 0 ? " · в размещении" : "";
          return '<label class="format-choice"><input type="checkbox" value="' + format + '" data-actual-format' + checked + '><span>' + labels[format] + hint + '</span></label>';
        }).join("");
        renderCardActualFormatInputs(item);
        renderCardActualFormatSummary(item);
      }
      function selectedCardActualFormats() {
        return Array.from(document.querySelectorAll("[data-actual-format]:checked")).map(function (input) { return input.value; });
      }
      function renderCardActualFormatInputs(item,draft) {
        var labels = {stories:"Сторис",reels:"Reels",carousel:"Карусель",post:"Пост"};
        var selected = selectedCardActualFormats();
        document.getElementById("cardActualFormatInputs").innerHTML = selected.length ? selected.map(function (format) {
          var value = draft && Object.prototype.hasOwnProperty.call(draft,format) ? draft[format] : formatActualValue(item,format);
          return '<div class="field"><label>' + labels[format] + ' — фактический охват</label><input class="input" type="number" min="0" max="' + MAX_REACH_PER_FORMAT + '" placeholder="Введите охват" data-actual-reach="' + format + '" value="' + (value == null ? "" : value) + '"></div>';
        }).join("") : '<div class="empty-state" style="grid-column:1/-1;padding:14px">Выберите хотя бы один источник охвата.</div>';
      }
      function renderCardActualFormatSummary(item) {
        var labels = {stories:"Сторис",reels:"Reels",carousel:"Карусель",post:"Пост"};
        var facts = item ? placementFormatActuals[placementOverrideKey(item)] || {} : {};
        var hasSplit = Object.keys(facts).length > 0;
        var total = hasSplit ? Object.keys(facts).reduce(function (sum,format) { return sum + Number(facts[format] || 0); },0) : Number((item && item.actual) || 0);
        var importWarning = item && item.importedActualWarning != null ? '<p class="evidence-note" style="margin:8px 0 0;color:var(--red)">В исходной таблице был некорректный факт ' + number(item.importedActualWarning) + '. Он исключён из расчёта — внесите фактический охват заново.</p>' : '';
        document.getElementById("cardActualFormatSummary").innerHTML = '<div class="team-stats" style="width:100%">' + ["stories","reels","carousel","post"].map(function (format) {
          var value = formatActualValue(item,format);
          return '<div class="team-stat"><strong>' + (value == null ? '—' : number(value)) + '</strong><span>' + labels[format] + '</span></div>';
        }).join("") + '<div class="team-stat"><strong>' + number(total) + '</strong><span>Общий факт</span></div></div>' + importWarning + (!hasSplit && item && item.actual != null && placementFormats(item).length > 1 ? '<p class="evidence-note" style="margin:8px 0 0">Сейчас сохранён только общий факт ' + number(item.actual) + '. Внесите охваты по форматам, чтобы заменить его детализацией.</p>' : '');
      }
      function recalculateBloggerActuals(blogger) {
        var actualRows = placementRowsForBlogger(blogger).filter(function (item) { return item.actual != null && Number(item.actual) >= 0; });
        if (!actualRows.length) return;
        blogger.reach = Math.round(actualRows.reduce(function (sum,item) { return sum + Number(item.actual || 0); },0));
        var latest = actualRows[0];
        blogger.last = latest.start || blogger.last;
        blogger.sortDate = latest.sortDate || blogger.sortDate;
        blogger.status = "Вышел";
      }
      bloggers.forEach(function (blogger) {
        var hasSavedReach = placementRowsForBlogger(blogger).some(function (item) {
          return Object.prototype.hasOwnProperty.call(placementActualOverrides,placementOverrideKey(item));
        });
        if (hasSavedReach) recalculateBloggerActuals(blogger);
      });
      function setReportView(view) {
        var target = document.getElementById("report-view-" + view);
        if (!target) return;
        document.querySelectorAll("#reportViewSwitch .segment").forEach(function (button) { button.classList.toggle("active",button.dataset.reportView === view); });
        document.querySelectorAll(".report-view").forEach(function (item) { item.classList.toggle("hidden",item !== target); });
      }
      function renderBloggerHistory(blogger) {
        var rows = placementRowsForBlogger(blogger);
        document.getElementById("drawerPlacementHistory").innerHTML = rows.length ? rows.map(function (item) {
          return '<tr><td><b>' + safeText(item.start) + '</b></td><td>' + safeText(item.type) + '</td><td>' + number(item.guaranteed) + '</td><td><b>' + (item.actual == null ? '—' : number(item.actual)) + '</b></td><td>' + number(item.leads) + '</td><td>' + number(item.sales) + '</td><td>' + placementDecisionBadge(item.decision) + '</td></tr>';
        }).join('') : '<tr><td colspan="7">Размещений пока нет</td></tr>';
        var last = rows.slice(0,3);
        function average(field) { return last.length ? Math.round(last.reduce(function (sum,item) { return sum + Number(item[field] || 0); },0)/last.length) : 0; }
        document.getElementById("drawerHistoryAverages").innerHTML = [['Охват',number(average('actual'))],['Лиды',number(average('leads'))],['Продажи',number(average('sales'))],['Выручка',money(average('revenue'))],['Переносы',number(last.filter(function(item){return /перенос/i.test(item.comment||'');}).length)],['Размещений',number(rows.length)]].map(function(item){return '<div class="team-stat"><strong>' + item[1] + '</strong><span>' + item[0] + '</span></div>';}).join('');
        var lastDecision = rows[0] ? (rows[0].decision === 'Оставляем' ? 'Повторить сотрудничество' : rows[0].decision === 'Убираем' ? 'Остановить сотрудничество' : 'Провести ретест') : 'Решение появится после первого размещения';
        document.getElementById("drawerHistoryDecision").innerHTML = '<div class="quality-item"><div><strong>' + lastDecision + '</strong><small>На основе последнего размещения</small></div><span class="badge badge-blue">' + rows.length + ' в истории</span></div>';
        var recentDocs = rows.slice(0,5);
        document.getElementById("drawerDocumentHistory").innerHTML = '<div class="quality-item"><div><strong>Коммерческий договор</strong><small>Постоянные данные карточки</small></div>' + contractBadge(blogger.commercialContract) + '</div><div class="quality-item"><div><strong>Бартерный договор</strong><small>Постоянные данные карточки</small></div>' + contractBadge(blogger.barterContract) + '</div>' + recentDocs.map(function(item){return '<div class="quality-item"><div><strong>' + safeText(item.start) + ' · ' + safeText(item.type) + '</strong><small>ТЗ: ' + safeText(item.brief) + '</small></div>' + contractBadge(item.contract) + '</div>';}).join('') + '<div class="report-section-head" style="margin-top:14px"><div><h3>Прикреплённые файлы</h3><p>Договоры из карточки блогера</p></div></div><div class="contract-file-list">' + contractFilesHtml(blogger) + '</div>';
      }
      function currentPageName() {
        var active = document.querySelector(".page.active");
        return active ? active.id.replace(/^page-/,"") : "dashboard";
      }
      function renderCurrentPageData() {
        var page = currentPageName();
        if (page === "dashboard") { renderKpis(); renderTopBloggers(); renderDashboardMonthSummary(); renderDepartmentMonthControl(); }
        else if (page === "profile") renderEmployeeProfile();
        else if (page === "bloggers") renderBloggers();
        else if (page === "placements") renderPlacementRecords();
        else if (page === "calendar") renderWeeklyExits();
        else if (page === "reports") { renderEvidenceReports(); renderManagerMetrics(); renderMonthlyPlanFact(); }
        else if (page === "kpi") { renderSalaryTable(); renderKpiBloggerRoster(); loadKpiFromData(); }
        else if (page === "team") renderEmployees();
      }
      function navigate(page) {
        if ((page === "team" || page === "integrations" || page === "kpi" || page === "finance") && role !== "leader") {
          showToast(page === "kpi" ? "KPI и зарплата доступны только администратору" : page === "finance" ? "Финансы доступны только администратору" : "Раздел доступен только руководителю");
          return;
        }
        document.querySelectorAll(".page").forEach(function (p) { p.classList.remove("active"); });
        document.getElementById("page-" + page).classList.add("active");
        document.querySelectorAll(".nav-btn").forEach(function (b) { b.classList.toggle("active", b.dataset.page === page); });
        document.querySelectorAll(".mobile-nav-btn").forEach(function (b) { b.classList.toggle("active", b.dataset.mobilePage === page); });
        document.getElementById("topTitle").textContent = pageMeta[page][0];
        document.getElementById("topSubtitle").textContent = pageMeta[page][1];
        document.getElementById("sidebar").classList.remove("open");
        document.getElementById("mobileOverlay").classList.remove("show");
        if (page === "finance") hydrateFinanceCenter();
        if (page === "reports") hydrateEvidenceReports().catch(function () {});
        if (page === "kpi" && role === "leader") { hydrateKpiAdjustments().catch(function () {}); hydrateKpiMonthBloggers(document.getElementById("kpiMonthSelect").value || activeMonthKey()).catch(function () {}); }
        if (page === "placements") placementPage = 1;
        if (page === "calendar") exitPage = 1;
        renderCurrentPageData();
        window.scrollTo({top:0,behavior:"smooth"});
      }
      function setRole(next) {
        if (next !== "leader" && bloggerEditMode) cancelBloggerEdits(true);
        role = next;
        var names = {leader:"Администратор",manager:"Менеджер",assistant:"Ассистент",analyst:"Аналитик"};
        document.getElementById("sideRole").textContent = names[role];
        document.querySelectorAll(".leader-only").forEach(function (el) { el.classList.toggle("hidden", role !== "leader"); });
        document.getElementById("saveBloggerBtn").classList.toggle("hidden",role !== "leader");
        document.getElementById("contractUploadFile").disabled = role === "analyst";
        document.getElementById("contractUploadType").disabled = role === "analyst";
        document.getElementById("kpiSanctions").disabled = role !== "leader";
        if (currentBloggerId) {
          var current = bloggers.find(function (item) { return item.id === currentBloggerId; });
          if (current) { populateCardActualPlacements(current); renderCardContractFiles(current); renderBloggerHistory(current); }
        }
        syncBloggerEditControls();
        var canEdit = role !== "analyst";
        document.querySelectorAll(".add-blogger-btn,#quickAddBtn,#addPlacementBtn,#calendarAddBtn,#fillReportBtn,#fillAssistantReportBtn,#addEvidenceBtn,.evidence-add-btn").forEach(function (el) { el.classList.toggle("hidden", !canEdit); });
        if (role === "manager") {
          document.getElementById("managerMetricsFilter").value = activeEmployeeManagers()[0] || "all";
          renderManagerMetrics();
        } else if (role === "leader") {
          document.getElementById("managerMetricsFilter").value = "all";
          renderManagerMetrics();
        }
        if (role !== "leader" && (document.getElementById("page-team").classList.contains("active") || document.getElementById("page-integrations").classList.contains("active") || document.getElementById("page-kpi").classList.contains("active") || document.getElementById("page-finance").classList.contains("active"))) navigate("dashboard");
        if (role === "leader") { renderEmployees(); renderSalaryTable(); loadKpiFromData(); hydrateKpiAdjustments().catch(function () {}); hydrateKpiMonthBloggers(activeMonthKey()).catch(function () {}); if (!currentFinanceData) hydrateFinanceCenter(); }
        else { document.getElementById("teamGrid").innerHTML = ""; document.getElementById("salaryTable").innerHTML = ""; renderFinanceKpis(null); }
        renderMonthlyPlanFact();
        renderDepartmentMonthControl();
        showToast("Роль: " + names[role]);
      }

      function activateSession(session) {
        if (sessionActivationPromise) return sessionActivationPromise;
        currentSession = session || null;
        sessionActivationPromise = apiFetch("/whoami").then(function (response) {
          if (!response.ok) return response.json().catch(function () { return {}; }).then(function (data) { throw new Error(data.error || "Нет доступа к отделу блогеров"); });
          return response.json();
        }).then(function (data) {
          var profile = data.profile || {};
          var appRole = data.appRole || "manager";
          currentUserProfile = profile;
          currentEmployeeProfile = data.employee || null;
          employeeProfileTargetId = "";
          role = appRole;
          var name = profile.name || profile.email || "Сотрудник NSL";
          document.getElementById("sideUserName").textContent = name;
          document.getElementById("sideAvatar").textContent = name.split(/\s+/).filter(Boolean).slice(0,2).map(function (part) { return part.charAt(0).toUpperCase(); }).join("") || "НС";
          document.getElementById("roleSwitcher").value = appRole;
          loginScreen.classList.add("hidden");
          appShell.classList.remove("hidden");
          return hydrateSharedState({full:true}).then(function () {
            var tasks = [hydrateReachActuals(),hydrateDepartmentMonths(),hydrateEmployees(),hydratePlacementSchedules(),hydrateEvidenceReports()];
            if (appRole === "leader") tasks.push(hydrateKpiAdjustments(),hydrateKpiMonthBloggers(systemMonthKey()),hydrateFinanceCenter());
            return Promise.allSettled(tasks);
          }).then(function (results) {
            try { setRole(appRole); }
            catch (error) { console.error("Role UI initialization failed",error); }
            var rejected = results.filter(function (item) { return item.status === "rejected"; }).length;
            sharedStateStatus = "ready";
            refreshAllDerivedViews();
            renderCurrentPageData();
            if (rejected) showToast("Основная база загружена, но часть показателей временно недоступна: " + rejected);
          });
        }).catch(function (error) {
          sharedStateStatus = "error";
          renderDataHealth();
          throw error;
        }).finally(function () { sessionActivationPromise = null; });
        return sessionActivationPromise;
      }

      document.getElementById("loginForm").addEventListener("submit", function (e) {
        e.preventDefault();
        var button = e.target.querySelector('button[type="submit"]');
        var message = document.getElementById("loginMessage");
        var mode = document.getElementById("loginMode").value;
        var password = document.getElementById("loginPassword").value;
        button.disabled = true; button.textContent = mode === "register" ? "Создаю кабинет…" : "Вхожу…";
        if (mode === "register") {
          var confirmation = document.getElementById("loginPasswordConfirm").value;
          if (password.length < 12 || password !== confirmation) {
            message.innerHTML = "<b>Проверьте пароль.</b> Минимум 12 символов, оба поля должны совпадать.";
            button.disabled = false; button.textContent = "Зарегистрироваться"; return;
          }
          message.innerHTML = "Активирую персональный кабинет и связываю историю…";
          publicApiFetch("/api/register-access",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({inviteToken:registrationInviteToken,password:password})}).then(function (response) {
            if (!response.ok) return response.json().catch(function () { return {}; }).then(function (data) { throw new Error(data.error || "Не удалось зарегистрироваться"); });
            return response.json();
          }).then(function (data) {
            registrationInviteToken = "";
            return supabaseClient.auth.signInWithPassword({email:data.email,password:password}).then(function (result) { if (result.error) throw result.error; return activateSession(result.data.session); });
          }).catch(function (error) {
            message.innerHTML = "<b>Регистрация не завершена.</b> " + safeText(error.message || "Попросите администратора создать новую ссылку");
          }).finally(function () { button.disabled = false; button.textContent = "Зарегистрироваться"; });
          return;
        }
        var email = document.getElementById("loginEmail").value.trim().toLowerCase();
        message.innerHTML = "Проверяю рабочий аккаунт…";
        supabaseClient.auth.signInWithPassword({email:email,password:password}).then(function (result) {
          if (result.error) throw result.error;
          return activateSession(result.data.session);
        }).catch(function (error) {
          currentSession = null;
          message.innerHTML = "<b>Не удалось войти.</b> Проверьте почту и пароль или попросите администратора сформировать новую ссылку доступа.";
        }).finally(function () { button.disabled = false; button.textContent = "Войти"; });
      });
      document.getElementById("logoutBtn").addEventListener("click", function () {
        localStorage.removeItem("nslAdminAccess");
        adminAccessToken = "";
        sessionStorage.clear();
        supabaseClient.auth.signOut().finally(function () { currentSession = null; appShell.classList.add("hidden"); loginScreen.classList.remove("hidden"); });
      });
      document.querySelectorAll(".nav-btn").forEach(function (b) { b.addEventListener("click", function () { if (b.dataset.page === "profile") employeeProfileTargetId = ""; navigate(b.dataset.page); }); });
      document.getElementById("backToTeamBtn").addEventListener("click",function () { employeeProfileTargetId = ""; navigate("team"); });
      document.querySelectorAll(".mobile-nav-btn").forEach(function (b) { b.addEventListener("click", function () { navigate(b.dataset.mobilePage); }); });
      document.querySelectorAll("[data-page-jump]").forEach(function (b) { b.addEventListener("click", function () { navigate(b.dataset.pageJump); }); });
      document.getElementById("reportViewSwitch").addEventListener("click", function (event) {
        var button = event.target.closest("[data-report-view]");
        if (button) setReportView(button.dataset.reportView);
      });
      document.querySelectorAll("[data-report-jump]").forEach(function (button) {
        button.addEventListener("click",function () { navigate("reports"); setReportView(button.dataset.reportJump); });
      });
      document.querySelectorAll("[data-placement-jump-filter]").forEach(function (button) {
        button.addEventListener("click",function () {
          placementQuickFilter = button.dataset.placementJumpFilter;
          placementPage = 1; expandedPlacementId = null;
          document.querySelectorAll("#placementQuickFilters .quick-filter").forEach(function (item) { item.classList.toggle("active",item.dataset.placementQuick === placementQuickFilter); });
          navigate("placements"); renderPlacementRecords();
        });
      });
      document.getElementById("brandSwitch").addEventListener("click", function (e) {
        var b = e.target.closest("[data-brand]"); if (!b) return;
        currentBrand = b.dataset.brand;
        document.querySelectorAll("#brandSwitch .segment").forEach(function (x) { x.classList.toggle("active", x === b); });
        renderFinanceKpis(currentFinanceData);
        renderFinanceTrend(currentFinanceData);
      });
      ["bloggerSearch","bloggerMonthFilter","statusFilter","managerFilter","brandFilter","categoryFilter","bloggerPlatformFilter","bloggerContractFilter","bloggerReachMin","bloggerReachMax","bloggerLeadsMin","bloggerSalesMin","bloggerRevenueMin","bloggerLastFrom","bloggerLastTo","bloggerSortFilter"].forEach(function (id) { document.getElementById(id).addEventListener("input", renderBloggers); });
      document.getElementById("resetBloggerFilters").addEventListener("click",function () {
        ["bloggerSearch","statusFilter","managerFilter","brandFilter","categoryFilter","bloggerPlatformFilter","bloggerContractFilter","bloggerReachMin","bloggerReachMax","bloggerLeadsMin","bloggerSalesMin","bloggerRevenueMin","bloggerLastFrom","bloggerLastTo"].forEach(function (id) { document.getElementById(id).value = ""; });
        document.getElementById("bloggerMonthFilter").value = activeMonthKey();
        document.getElementById("bloggerSortFilter").value = "created-desc";
        renderBloggers(); showToast("Все фильтры блогеров сброшены");
      });
      document.getElementById("toggleBloggerEditBtn").addEventListener("click",function () { bloggerEditMode ? saveBloggerEdits() : startBloggerEditing(); });
      document.getElementById("cancelBloggerEditBtn").addEventListener("click",function () { cancelBloggerEdits(false); });
      document.getElementById("bloggersTable").addEventListener("input",function (event) { var control = event.target.closest("[data-blogger-edit]"); if (control) updateBloggerInline(control); });
      document.getElementById("bloggersTable").addEventListener("change",function (event) { var control = event.target.closest("[data-blogger-edit]"); if (control) updateBloggerInline(control); });
      document.addEventListener("click", function (e) {
        var open = e.target.closest("[data-open-blogger]");
        if (open) openBlogger(open.dataset.openBlogger);
      });
      document.querySelectorAll(".add-blogger-btn,#quickAddBtn").forEach(function (b) { b.addEventListener("click", function () {
        if (role === "analyst") return showToast("У аналитика доступ только на просмотр");
        openLayer(document.getElementById("addBloggerModal"));
      }); });
      document.getElementById("addBloggerForm").addEventListener("submit", function (e) {
        e.preventDefault();
        var form = e.target;
        var selectedPlatforms = Array.from(document.querySelectorAll("[data-new-platform]:checked")).map(function (input) { return input.value; });
        if (!selectedPlatforms.length) return showToast("Выберите хотя бы одну площадку");
        var name = document.getElementById("newName").value.trim();
        var newBlogger = {
          id: Date.now(), createdAt:new Date().toISOString(), name:name, display:name.replace("@",""), link:document.getElementById("newLink").value.trim(),
          platforms:selectedPlatforms, status:document.getElementById("newStatus").value,
          manager:document.getElementById("newManager").value, brand:document.getElementById("newBrand").value,
          commercialContract:document.getElementById("newCommercialContract").value,
          barterContract:document.getElementById("newBarterContract").value,
          cooperationType:document.getElementById("newCommercialContract").value !== "Нет" && document.getElementById("newBarterContract").value !== "Нет" ? "Смешанный" : document.getElementById("newCommercialContract").value !== "Нет" ? "Коммерция" : "Бартер",
          spent:0, contractFiles:[], reach:Number(document.getElementById("newReach").value || 0), leads:0, sales:0, revenue:0, last:"—", comment:document.getElementById("newComment").value.trim()
        };
        var submitButton = form.querySelector('button[type="submit"]');
        if (submitButton) submitButton.disabled = true;
        showToast("Сохраняю карточку в общей базе…");
        persistSharedStateRecords([sharedNewBloggerRecord(newBlogger)]).then(function () {
          bloggers.unshift(newBlogger);
          bloggers = consolidateBloggerCards(bloggers);
          saveData();
          invalidateDerivedData();
          refreshAllDerivedViews();
          refreshBloggerCounters();
          form.reset();
          closeLayers();
          showToast("Карточка сохранена · в базе " + number(bloggers.length) + " блогеров");
        }).catch(function (error) {
          showToast(error && error.message ? error.message : "Карточка не сохранилась в общей базе");
        }).finally(function () {
          if (submitButton) submitButton.disabled = false;
        });
      });
      document.getElementById("saveBloggerBtn").addEventListener("click", function () {
        if (role !== "leader") return showToast("Основные поля карточки меняет администратор; менеджеру доступна отдельная корректировка фактического охвата");
        var b = bloggers.find(function (x) { return x.id === currentBloggerId; });
        var selectedPlatforms = Array.from(document.querySelectorAll("[data-edit-platform]:checked")).map(function (input) { return input.value; });
        if (!selectedPlatforms.length) return showToast("Выберите хотя бы одну площадку блогера");
        b.name = document.getElementById("editName").value.trim();
        b.manager = document.getElementById("editManager").value;
        b.link = document.getElementById("editLink").value.trim();
        b.platforms = selectedPlatforms;
        b.brand = document.getElementById("editBrand").value;
        b.status = document.getElementById("editStatus").value;
        b.commercialContract = document.getElementById("editCommercialContract").value;
        b.barterContract = document.getElementById("editBarterContract").value;
        b.cooperationType = document.getElementById("editCooperationType").value;
        b.spent = Math.max(0,Number(document.getElementById("editSpent").value || 0));
        b.comment = document.getElementById("editComment").value.trim();
        var finishCardSave = function () { saveData(); queueSharedStateRecords([sharedBloggerRecord(b)]); refreshAllDerivedViews(); closeLayers(); showToast("Изменения сохранены · все вкладки и статистика обновлены"); };
        if (cardActualDirty) saveCurrentCardActuals().then(finishCardSave).catch(function () {});
        else finishCardSave();
      });
      document.getElementById("contractUploadFile").addEventListener("change",function (event) {
        var input = event.target;
        var file = (input.files || [])[0];
        var blogger = bloggers.find(function (item) { return item.id === currentBloggerId; });
        if (!file || !blogger) return;
        if (role === "analyst") { input.value = ""; return showToast("У аналитика доступ только на просмотр"); }
        if (file.size > 15 * 1024 * 1024) { input.value = ""; return showToast("Размер договора не должен превышать 15 МБ"); }
        if (!/\.(pdf|doc|docx|jpe?g|png|webp)$/i.test(file.name)) { input.value = ""; return showToast("Поддерживаются PDF, DOC, DOCX и изображения"); }
        var type = document.getElementById("contractUploadType").value;
        storeContractFile(blogger,type,file).then(function (result) {
          var metadata = result.file;
          var previousStatus = type === "commercial" ? blogger.commercialContract : blogger.barterContract;
          blogger.contractFiles = Array.isArray(blogger.contractFiles) ? blogger.contractFiles : [];
          blogger.contractFiles.unshift(metadata);
          if (type === "commercial" && blogger.commercialContract === "Нет") blogger.commercialContract = "На оформлении";
          if (type === "barter" && blogger.barterContract === "Нет") blogger.barterContract = "На оформлении";
          try {
            saveData();
            queueSharedStateRecords([sharedContractRecord(blogger)]);
          } catch (error) {
            blogger.contractFiles.shift();
            if (type === "commercial") blogger.commercialContract = previousStatus; else blogger.barterContract = previousStatus;
            removeContractFile(blogger,metadata.id).catch(function () {});
            throw error;
          }
          document.getElementById("editCommercialContract").value = blogger.commercialContract;
          document.getElementById("editBarterContract").value = blogger.barterContract;
          renderCardContractFiles(blogger);
          renderBloggerHistory(blogger);
          renderBloggers();
          input.value = "";
          showToast("Договор прикреплён к карточке");
        }).catch(function () {
          input.value = "";
          showToast("Не удалось сохранить договор. Повторите загрузку");
        });
      });
      document.addEventListener("click",function (event) {
        var download = event.target.closest("[data-contract-download]");
        var remove = event.target.closest("[data-contract-remove]");
        if (!download && !remove) return;
        var blogger = bloggers.find(function (item) { return item.id === currentBloggerId; });
        if (!blogger) return;
        var id = (download || remove).dataset.contractDownload || (download || remove).dataset.contractRemove;
        var metadata = (blogger.contractFiles || []).find(function (file) { return file.id === id; });
        if (!metadata) return showToast("Файл договора не найден");
        if (download) {
          readContractFile(blogger,id).then(function (blob) {
            var url = URL.createObjectURL(blob);
            var link = document.createElement("a");
            link.href = url; link.download = metadata.name; document.body.appendChild(link); link.click(); link.remove();
            window.setTimeout(function () { URL.revokeObjectURL(url); },1000);
          }).catch(function () { showToast("Не удалось открыть договор"); });
          return;
        }
        if (role === "analyst") return showToast("У аналитика доступ только на просмотр");
        if (!window.confirm("Удалить договор «" + metadata.name + "» из карточки?")) return;
        removeContractFile(blogger,id).then(function () {
          blogger.contractFiles = (blogger.contractFiles || []).filter(function (file) { return file.id !== id; });
          saveData(); queueSharedStateRecords([sharedContractRecord(blogger)]); renderCardContractFiles(blogger); renderBloggerHistory(blogger); renderBloggers();
          showToast("Договор удалён");
        }).catch(function () { showToast("Не удалось удалить договор"); });
      });
      var cardActualDirty = false;
      document.getElementById("cardActualPlacement").addEventListener("change",function (event) {
        var item = findPlacementByOverrideKey(event.target.value);
        populateCardActualFormats(item);
        populateCardWarmupDates(item);
        document.getElementById("cardActualClicks").value = effectivePlacementClicks(item) == null ? "" : effectivePlacementClicks(item);
        cardActualDirty = false;
      });
      document.getElementById("saveCardWarmupBtn").addEventListener("click",function () {
        if (!canEditActualReach()) return showToast("У вашей роли нет права менять даты прогрева");
        var item = findPlacementByOverrideKey(document.getElementById("cardActualPlacement").value);
        var start = document.getElementById("cardWarmupStart").value;
        var end = document.getElementById("cardWarmupEnd").value;
        var status = document.getElementById("cardWarmupSaveStatus");
        if (!item) return showToast("Выберите связанное размещение");
        if (!start || !end) return showToast("Укажите обе даты прогрева");
        if (end < start) return showToast("Дата окончания не может быть раньше даты старта");
        document.getElementById("saveCardWarmupBtn").disabled = true;
        status.style.display = "inline"; status.textContent = "Сохраняю…";
        persistPlacementSchedule(item,start,end).then(function () {
          var custom = customPlacementRecords.find(function (record) { return String(record.id) === String(item.id); });
          if (custom) {
            custom.warmupStart = item.warmupStart; custom.warmupEnd = item.warmupEnd; custom.warmup = item.warmup;
            sessionStorage.setItem("nslCustomPlacements",JSON.stringify(customPlacementRecords));
            queueSharedStateRecords([sharedPlacementRecord(custom)]);
          }
          renderPlacementRecords(); renderWeeklyExits(); renderBloggerHistory(bloggers.find(function (record) { return record.id === currentBloggerId; }));
          status.textContent = "Сохранено: " + warmupRangeLabel(item); showToast("Даты прогрева сохранены");
        }).catch(function (error) {
          status.textContent = error.message || "Не удалось сохранить"; showToast("Не удалось сохранить даты прогрева");
        }).finally(function () { document.getElementById("saveCardWarmupBtn").disabled = !canEditActualReach(); });
      });
      document.getElementById("cardActualFormatChoices").addEventListener("change",function () {
        var key = document.getElementById("cardActualPlacement").value;
        var item = findPlacementByOverrideKey(key);
        var draft = {};
        document.querySelectorAll("[data-actual-reach]").forEach(function (input) { if (input.value !== "") draft[input.dataset.actualReach] = input.value; });
        renderCardActualFormatInputs(item,draft);
        cardActualDirty = true;
      });
      document.getElementById("cardActualFormatInputs").addEventListener("input",function () { cardActualDirty = true; });
      function saveCurrentCardActuals() {
        if (!canEditActualReach()) { showToast("У вашей роли нет права менять фактические охваты"); return Promise.reject(new Error("forbidden")); }
        var key = document.getElementById("cardActualPlacement").value;
        var item = findPlacementByOverrideKey(key);
        var blogger = bloggers.find(function (record) { return record.id === currentBloggerId; });
        if (!item || !blogger) { showToast("Выберите связанное размещение"); return Promise.reject(new Error("placement required")); }
        var labels = {stories:"Сторис",reels:"Reels",carousel:"Карусель",post:"Пост"};
        var selectedFormats = selectedCardActualFormats();
        if (!selectedFormats.length) { showToast("Выберите хотя бы один источник охвата"); return Promise.reject(new Error("format required")); }
        var values = {};
        var invalid = selectedFormats.some(function (format) {
          var input = document.querySelector('[data-actual-reach="' + format + '"]');
          if (!input || input.value === "" || !Number.isFinite(Number(input.value)) || Number(input.value) < 0 || Number(input.value) > MAX_REACH_PER_FORMAT) return true;
          values[format] = Number(input.value);
          return false;
        });
        if (invalid) { showToast("Введите охват от 0 до " + number(MAX_REACH_PER_FORMAT) + " для каждого источника"); return Promise.reject(new Error("invalid reach")); }
        var clicksInput = document.getElementById("cardActualClicks");
        var clicks = clicksInput.value === "" ? 0 : Number(clicksInput.value);
        if (!Number.isFinite(clicks) || clicks < 0 || clicks > 1000000000) { showToast("Введите корректное количество кликов"); return Promise.reject(new Error("invalid clicks")); }
        clicks = Math.round(clicks);
        var previousFacts = Object.assign({},placementFormatActuals[key] || {});
        var previousActual = item.actual;
        var previousClicks = item.clicks;
        var previousComment = item.comment;
        var previousImportWarning = item.importedActualWarning;
        var previousBlogger = {reach:blogger.reach,last:blogger.last,sortDate:blogger.sortDate,status:blogger.status};
        var hadPreviousOverride = Object.prototype.hasOwnProperty.call(placementActualOverrides,key);
        var previousOverride = placementActualOverrides[key];
        placementFormatActuals[key] = {};
        selectedFormats.forEach(function (format) { placementFormatActuals[key][format] = values[format]; });
        item.actual = Object.keys(placementFormatActuals[key]).reduce(function (sum,itemFormat) { return sum + Number(placementFormatActuals[key][itemFormat] || 0); },0);
        item.clicks = clicks;
        var baseComment = String(item.comment || "").replace(/(?: · )?Факт:.*$/,"" );
        item.comment = (baseComment ? baseComment + " · " : "") + "Факт: " + selectedFormats.map(function (format) { return labels[format] + " " + number(values[format]); }).join(", ");
        placementActualOverrides[key] = item.actual;
        recalculateBloggerActuals(blogger);
        var saveButton = document.getElementById("saveCardActualBtn");
        var status = document.getElementById("cardActualSaveStatus");
        saveButton.disabled = true;
        status.style.display = "block";
        status.textContent = "Сохраняю фактические охваты в общей базе…";
        return persistReachActual({placementKey:key,bloggerKey:String(blogger.sourceKey || blogger.name || blogger.id),facts:placementFormatActuals[key],comment:item.comment}).then(function (savedRecord) {
          return persistSharedStateRecords([sharedPlacementRecord(item)]).then(function () { return savedRecord; });
        }).then(function (savedRecord) {
          applyReachActualRecord(savedRecord);
          item.importedActualWarning = null;
          if (item.isVirtualCardReach) {
            item.isVirtualCardReach = false;
            virtualCardReachRecords = virtualCardReachRecords.filter(function (record) { return record !== item; });
            placementRecords.unshift(item);
            if (!customPlacementRecords.some(function (record) { return String(record.id) === String(item.id); })) customPlacementRecords.unshift(item);
            sessionStorage.setItem("nslCustomPlacements",JSON.stringify(customPlacementRecords));
            queueSharedStateRecords([sharedPlacementRecord(item)]);
          }
          var customActualRecord = customPlacementRecords.find(function (record) { return String(record.id) === String(item.id); });
          if (customActualRecord) { Object.assign(customActualRecord,item); queueSharedStateRecords([sharedPlacementRecord(customActualRecord)]); }
          bloggers.filter(function (record) { return placementMatchesBlogger(item,record); }).forEach(recalculateBloggerActuals);
          cardActualDirty = false;
          try {
            sessionStorage.setItem("nslPlacementActualOverrides",JSON.stringify(placementActualOverrides));
            sessionStorage.setItem("nslPlacementFormatActuals",JSON.stringify(placementFormatActuals));
          } catch (cacheError) {}
          populateCardActualPlacements(blogger);
          document.getElementById("editReach").value = blogger.reach;
          renderBloggerHistory(blogger);
          refreshAllDerivedViews();
          status.style.display = "block";
          status.textContent = "Сохранено в общей базе · охват " + number(item.actual) + " · клики " + number(item.clicks) + " · статистика обновлена";
          showToast("Фактические охваты сохранены · общий факт " + number(item.actual));
          return savedRecord;
        }).catch(function (error) {
          placementFormatActuals[key] = previousFacts;
          item.actual = previousActual;
          item.clicks = previousClicks;
          item.comment = previousComment;
          item.importedActualWarning = previousImportWarning;
          if (hadPreviousOverride) placementActualOverrides[key] = previousOverride; else delete placementActualOverrides[key];
          blogger.reach = previousBlogger.reach;
          blogger.last = previousBlogger.last;
          blogger.sortDate = previousBlogger.sortDate;
          blogger.status = previousBlogger.status;
          renderBloggerHistory(blogger);
          status.style.display = "block";
          status.textContent = "Не сохранено · " + (error && error.message ? error.message : "общая база недоступна") + ". Повторите ещё раз";
          showToast("Не удалось сохранить фактические охваты");
          throw error;
        }).finally(function () {
          saveButton.disabled = !canEditActualReach();
        });
      }
      document.getElementById("saveCardActualBtn").addEventListener("click",function () {
        saveCurrentCardActuals().catch(function () {});
      });
      document.querySelectorAll(".close-layer").forEach(function (b) { b.addEventListener("click", closeLayers); });
      overlay.addEventListener("click", closeLayers);
      document.getElementById("fillReportBtn").addEventListener("click", function () {
        if (!canEditDailyReports()) return showToast("У вашей роли нет права заполнять ежедневный отчёт");
        var selected = document.getElementById("managerMetricsFilter").value;
        document.getElementById("reportDate").value = document.getElementById("managerDailyDateFilter").value || localTodayIso();
        var managerName = selected === "all" ? activeEmployeeManagers()[0] : selected;
        if (!managerName) return showToast("Сначала добавьте активного менеджера во вкладке «Сотрудники»");
        fillManagerReportForm(managerName);
        openLayer(document.getElementById("reportModal"));
      });
      document.getElementById("reportManager").addEventListener("change", function (e) { fillManagerReportForm(e.target.value); });
      document.getElementById("reportDate").addEventListener("change", function () { fillManagerReportForm(document.getElementById("reportManager").value); });
      document.getElementById("dailyReportForm").addEventListener("submit", function (e) {
        e.preventDefault();
        if (!canEditDailyReports()) return showToast("У вашей роли нет права сохранять ежедневный отчёт");
        var name = document.getElementById("reportManager").value;
        var date = document.getElementById("reportDate").value;
        var mapping = {Outreach:"outreach",Replies:"replies",Approvals:"approvals",Refusals:"refusals",Dialog:"dialog"};
        var report = {planOutreach:Number(document.getElementById("reportPlanOutreach").value || (managerMetrics[name] || {}).planOutreach || 150),comment:document.getElementById("reportComment").value.trim()};
        Object.keys(mapping).forEach(function (suffix) { report[mapping[suffix]] = Number(document.getElementById("report" + suffix).value || 0); });
        if (!dailyManagerReports[date]) dailyManagerReports[date] = {};
        dailyManagerReports[date][name] = report;
        sessionStorage.setItem("nslDailyManagerReports",JSON.stringify(dailyManagerReports));
        queueSharedStateRecords([sharedStateRecord("manager_report",date + "|" + name,{date:date,name:name,report:report})]);
        document.getElementById("managerDailyDateFilter").value = date;
        document.getElementById("dashboardOutreachDate").dataset.preferredDate = date;
        renderManagerMetrics(); closeLayers(); showToast("Дневной отчёт за " + dailyDateLabel(date) + " сохранён");
      });
      document.getElementById("managerMetricsFilter").addEventListener("change", renderManagerMetrics);
      document.getElementById("evidenceEmployeeFilter").addEventListener("change", renderEvidenceReports);
      document.getElementById("managerDailyDateFilter").addEventListener("change", renderManagerMetrics);
      document.getElementById("fillAssistantReportBtn").addEventListener("click", function () {
        if (!canEditDailyReports()) return showToast("У вашей роли нет права заполнять ежедневный отчёт");
        document.getElementById("assistantReportDate").value = document.getElementById("managerDailyDateFilter").value || localTodayIso();
        var assistantName = currentEmployeeProfile && currentEmployeeProfile.role === "assistant" && currentEmployeeProfile.status === "active" ? currentEmployeeProfile.name : activeEmployeeAssistants()[0];
        if (!assistantName) return showToast("Сначала добавьте активного ассистента во вкладке «Сотрудники»");
        fillAssistantReportForm(assistantName);
        openLayer(document.getElementById("assistantReportModal"));
      });
      document.getElementById("assistantReportName").addEventListener("change", function (event) { fillAssistantReportForm(event.target.value); });
      document.getElementById("assistantReportDate").addEventListener("change", function () { fillAssistantReportForm(document.getElementById("assistantReportName").value); });
      document.getElementById("assistantDailyReportForm").addEventListener("submit", function (event) {
        event.preventDefault();
        if (!canEditDailyReports()) return showToast("У вашей роли нет права сохранять ежедневный отчёт");
        var date = document.getElementById("assistantReportDate").value;
        var name = document.getElementById("assistantReportName").value;
        if (!dailyAssistantReports[date]) dailyAssistantReports[date] = {};
        dailyAssistantReports[date][name] = {
          manager:document.getElementById("assistantReportManager").value,
          plan:Number(document.getElementById("assistantReportPlan").value || 0),
          fact:Number(document.getElementById("assistantReportFact").value || 0),
          replies:Number(document.getElementById("assistantReportReplies").value || 0),
          approvals:Number(document.getElementById("assistantReportApprovals").value || 0),
          refusals:Number(document.getElementById("assistantReportRefusals").value || 0),
          dialog:Number(document.getElementById("assistantReportDialog").value || 0),
          transferred:Number(document.getElementById("assistantReportTransferred").value || 0),
          comment:document.getElementById("assistantReportComment").value.trim()
        };
        sessionStorage.setItem("nslDailyAssistantReports",JSON.stringify(dailyAssistantReports));
        queueSharedStateRecords([sharedStateRecord("assistant_report",date + "|" + name,{date:date,name:name,report:dailyAssistantReports[date][name]})]);
        document.getElementById("managerDailyDateFilter").value = date;
        document.getElementById("dashboardOutreachDate").dataset.preferredDate = date;
        renderManagerMetrics();
        closeLayers();
        showToast("Отчёт ассистента за " + dailyDateLabel(date) + " сохранён");
      });
      document.getElementById("managerMonthlyPlanFilter").addEventListener("change", renderMonthlyPlanFact);
      document.getElementById("dashboardOutreachDate").addEventListener("change",renderDashboardMonthSummary);
      document.getElementById("managerMonthlyPlanTable").addEventListener("change", function (event) {
        var input = event.target.closest("[data-monthly-plan]");
        if (!input || role !== "leader") return;
        var plan = monthlyPlanSetting(input.dataset.monthlyPlan,input.dataset.monthlyMonth);
        plan[input.dataset.monthlyField] = Math.max(0,Number(input.value || 0));
        sessionStorage.setItem("nslMonthlyManagerPlans",JSON.stringify(monthlyManagerPlans));
        queueSharedStateRecords([sharedStateRecord("monthly_plan",input.dataset.monthlyMonth + "|" + input.dataset.monthlyPlan,{month:input.dataset.monthlyMonth,name:input.dataset.monthlyPlan,plan:plan})]);
        renderMonthlyPlanFact();
        showToast("План на месяц сохранён");
      });
      document.getElementById("managerExportBtn").addEventListener("click", function () { showToast("Данные выбранного раздела подготовлены к выгрузке"); });
      ["placementSearch","placementMonthFilter","placementManagerFilter","placementDecisionFilter","placementDirectionFilter","placementDealTypeFilter","placementStatusFilter","placementFormatFilter","placementReachMin","placementReachMax","placementDateFrom","placementDateTo","placementContractFilter","placementSortFilter"].forEach(function (id) { document.getElementById(id).addEventListener("input",function () { placementPage = 1; expandedPlacementId = null; renderPlacementRecords(); }); });
      document.getElementById("resetPlacementFilters").addEventListener("click",function () {
        ["placementSearch","placementManagerFilter","placementDecisionFilter","placementDirectionFilter","placementDealTypeFilter","placementStatusFilter","placementFormatFilter","placementReachMin","placementReachMax","placementDateFrom","placementDateTo","placementContractFilter"].forEach(function (id) { document.getElementById(id).value = ""; });
        document.getElementById("placementMonthFilter").value = activeMonthKey();
        document.getElementById("placementSortFilter").value = "created-desc";
        placementQuickFilter = "all"; placementPage = 1; expandedPlacementId = null;
        document.querySelectorAll("#placementQuickFilters .quick-filter").forEach(function (item) { item.classList.toggle("active",item.dataset.placementQuick === "all"); });
        renderPlacementRecords(); showToast("Все фильтры сброшены");
      });
      document.getElementById("placementPrev").addEventListener("click",function () { placementPage = Math.max(1,placementPage-1); renderPlacementRecords(); });
      document.getElementById("placementNext").addEventListener("click",function () { placementPage += 1; renderPlacementRecords(); });
      document.getElementById("placementUnifiedPrev").addEventListener("click",function () { placementPage = Math.max(1,placementPage-1); renderPlacementRecords(); });
      document.getElementById("placementUnifiedNext").addEventListener("click",function () { placementPage += 1; renderPlacementRecords(); });
      document.getElementById("placementQuickFilters").addEventListener("click",function (event) {
        var button = event.target.closest("[data-placement-quick]");
        if (!button) return;
        placementQuickFilter = button.dataset.placementQuick;
        placementPage = 1; expandedPlacementId = null;
        document.querySelectorAll("#placementQuickFilters .quick-filter").forEach(function (item) { item.classList.toggle("active",item === button); });
        renderPlacementRecords();
      });
      document.getElementById("placementUnifiedTable").addEventListener("click",function (event) {
        var openBloggerCard = event.target.closest("[data-open-blogger]");
        if (openBloggerCard) { event.stopPropagation(); openBlogger(openBloggerCard.dataset.openBlogger); return; }
        var addFormat = event.target.closest("[data-add-format]");
        if (addFormat) {
          event.stopPropagation();
          var name = window.prompt("Название формата: Stories, Reels, карусель, Telegram, VK / Shorts или дополнительный выход");
          if (!name) return;
          var formatRecord = {id:Date.now(),placementId:addFormat.dataset.addFormat,name:name,date:"Дата не задана",guarantee:0,fact:null,link:""};
          additionalPlacementFormats.push(formatRecord);
          sessionStorage.setItem("nslPlacementFormats",JSON.stringify(additionalPlacementFormats));
          queueSharedStateRecords([sharedStateRecord("placement_format",formatRecord.id,formatRecord)]);
          renderPlacementRecords(); showToast("Формат добавлен в карточку размещения");
          return;
        }
        var evidence = event.target.closest("[data-evidence-blogger]");
        if (evidence) { event.stopPropagation(); openEvidenceForm(evidence.dataset.evidenceBlogger); return; }
        var row = event.target.closest("[data-placement-expand]");
        if (!row) return;
        expandedPlacementId = String(expandedPlacementId) === String(row.dataset.placementExpand) ? null : row.dataset.placementExpand;
        renderPlacementRecords();
      });
      ["exitSearch","exitMonthFilter","exitManagerFilter","exitFormatFilter","exitReachMin","exitReachMax","exitDateFrom","exitDateTo","exitActualFilter","exitSortFilter"].forEach(function (id) { document.getElementById(id).addEventListener("input",function () { exitPage = 1; renderWeeklyExits(); }); });
      document.getElementById("resetExitFilters").addEventListener("click",function () {
        ["exitSearch","exitManagerFilter","exitFormatFilter","exitReachMin","exitReachMax","exitDateFrom","exitDateTo","exitActualFilter"].forEach(function (id) { document.getElementById(id).value = ""; });
        document.getElementById("exitMonthFilter").value = activeMonthKey();
        document.getElementById("exitSortFilter").value = "created-desc";
        exitPage = 1; renderWeeklyExits(); showToast("Фильтры выходов сброшены");
      });
      document.getElementById("exitPrev").addEventListener("click",function () { exitPage = Math.max(1,exitPage-1); renderWeeklyExits(); });
      document.getElementById("exitNext").addEventListener("click",function () { exitPage += 1; renderWeeklyExits(); });
      document.getElementById("weeklyExitsTable").addEventListener("click",function (event) {
        var button = event.target.closest("[data-delete-exit]");
        if (!button) return;
        event.preventDefault(); event.stopPropagation();
        if (role !== "leader") return showToast("Удалять выходы может только администратор");
        var key = button.dataset.deleteExit;
        var item = operationalWeeklyExits().find(function (row) { return placementDeletionKey(row) === key; });
        if (!item) return showToast("Выход не найден — обновите список");
        var periodNote = Number(item._periodDays || 0) > 1 ? " Будет удалено всё размещение и все дни его прогрева." : "";
        if (!window.confirm("Удалить выход " + (item.tag || "") + " от " + (item.date || "") + "?" + periodNote)) return;
        var snapshot = placementDeletionSnapshot(item);
        deletedPlacements[key] = snapshot;
        try { sessionStorage.setItem("nslDeletedPlacements",JSON.stringify(deletedPlacements)); } catch (cacheError) { console.warn("NSL deleted placements cache skipped",cacheError); }
        invalidateDerivedData(); refreshAllDerivedViews();
        persistSharedStateRecords([sharedStateRecord("placement_delete",key,snapshot)]).then(function () {
          showToast("Выход удалён. Статистика и KPI пересчитаны");
        }).catch(function (error) {
          delete deletedPlacements[key];
          try { sessionStorage.setItem("nslDeletedPlacements",JSON.stringify(deletedPlacements)); } catch (cacheError) {}
          invalidateDerivedData(); refreshAllDerivedViews();
          showToast(error && error.message ? error.message : "Не удалось удалить выход из общей базы");
        });
      });
      document.getElementById("regulationViewSwitch").addEventListener("click",function (event) {
        var button = event.target.closest("[data-regulation-view]");
        if (!button) return;
        document.querySelectorAll("#regulationViewSwitch .segment").forEach(function (item) { item.classList.toggle("active",item === button); });
        document.querySelectorAll(".regulation-view").forEach(function (view) { view.classList.add("hidden"); });
        document.getElementById("regulation-view-" + button.dataset.regulationView).classList.remove("hidden");
      });
      document.getElementById("openKpiRegulationBtn").addEventListener("click",function () {
        var popup = window.open("about:blank","_blank","noopener,noreferrer");
        apiFetch("/api/kpi-regulation").then(function (response) {
          if (!response.ok) return response.json().catch(function () { return {}; }).then(function (data) { throw new Error(data.error || "Не удалось открыть положение"); });
          return response.json();
        }).then(function (data) {
          if (!data.url) throw new Error("Файл положения недоступен");
          if (popup) popup.location.replace(data.url); else window.location.assign(data.url);
        }).catch(function (error) {
          if (popup) popup.close();
          showToast(error.message || "Не удалось открыть положение");
        });
      });
      document.getElementById("salaryMonthFilter").addEventListener("change",function (event) {
        var month = event.target.value;
        if (role === "leader" && !kpiRosterLoadedMonths[month]) hydrateKpiMonthBloggers(month).catch(function () { showToast("Не удалось обновить список блогеров KPI"); });
        else renderSalaryTable();
      });
      document.getElementById("refreshFinanceBtn").addEventListener("click",hydrateFinanceCenter);
      document.getElementById("closeDepartmentMonthBtn").addEventListener("click",function () {
        if (role !== "leader") return showToast("Закрыть месяц может только администратор");
        var active = activeOperationalMonth();
        if (!active) return showToast("Активного месяца нет");
        if (!window.confirm("Закрыть " + activeMonthLabel(active.month) + "? Данные останутся в архиве и будут доступны через фильтры.")) return;
        var button = document.getElementById("closeDepartmentMonthBtn");
        button.disabled = true;
        persistDepartmentMonth("close",active.month).then(function (data) {
          departmentMonths = data.periods || departmentMonths;
          refreshMonthFilters(active.month);
          renderDepartmentMonthControl(); renderBloggers(); renderPlacementRecords(); renderWeeklyExits(); renderDashboardMonthSummary();
          showToast(activeMonthLabel(active.month) + " закрыт и перенесён в архив");
        }).catch(function (error) { showToast(error.message || "Не удалось закрыть месяц"); }).finally(function () { renderDepartmentMonthControl(); });
      });
      document.getElementById("addNextDepartmentMonthBtn").addEventListener("click",function (event) {
        if (role !== "leader") return showToast("Добавить месяц может только администратор");
        var month = event.currentTarget.dataset.nextMonth;
        if (!month) return;
        event.currentTarget.disabled = true;
        persistDepartmentMonth("add",month).then(function (data) {
          departmentMonths = data.periods || departmentMonths;
          refreshMonthFilters(month);
          document.getElementById("managerMonthlyPlanFilter").value = month;
          populateKpiControls();
          renderDepartmentMonthControl(); renderBloggers(); renderPlacementRecords(); renderWeeklyExits(); renderMonthlyPlanFact();
          showToast(activeMonthLabel(month) + " добавлен и выбран во всех разделах");
        }).catch(function (error) { showToast(error.message || "Не удалось добавить месяц"); }).finally(function () { renderDepartmentMonthControl(); });
      });
      document.getElementById("departmentMonthArchive").addEventListener("click",function (event) {
        var button = event.target.closest("[data-archive-month]");
        if (button) openDepartmentMonthArchive(button.dataset.archivePage,button.dataset.archiveMonth);
      });
      document.getElementById("salaryTable").addEventListener("change",function (event) {
        var input = event.target.closest("[data-salary-manager]");
        if (!input || role !== "leader") return showToast("Оклад и санкции может менять только администратор");
        var value = Math.max(0,Number(input.value || 0));
        input.disabled = true;
        if (input.dataset.salaryField === "base") {
          var employee = employees.find(function (item) { return item.id === input.dataset.salaryEmployee; });
          if (!employee) { input.disabled = false; return showToast("Сотрудник не найден"); }
          var previous = Object.assign({},employee);
          var updated = Object.assign({},employee,{baseSalary:value});
          persistEmployee(updated).then(function (saved) {
            applySavedEmployee(saved,previous);
            showToast("Оклад сохранён в карточке сотрудника");
          }).catch(function () { renderSalaryTable(); showToast("Не удалось сохранить оклад"); });
        } else {
          var manager = input.dataset.salaryManager;
          var month = input.dataset.salaryMonth || document.getElementById("salaryMonthFilter").value;
          var setting = salarySetting(manager);
          var nextSanctions = input.dataset.salaryField === "sanctions" ? value : Number(setting.sanctions[month] || 0);
          var currentSalary = calculateManagerSalary(manager,month);
          var nextReachKpi = input.dataset.salaryField === "reachKpi" ? value : currentSalary.reachKpi;
          persistKpiAdjustment(manager,month,nextSanctions,nextReachKpi).then(function (adjustment) {
            var savedSetting = salarySetting(adjustment.manager);
            savedSetting.sanctions[adjustment.month] = adjustment.sanctions;
            savedSetting.manualReachKpi[adjustment.month] = adjustment.manualReachKpi;
            sessionStorage.setItem("nslSalarySettings",JSON.stringify(salarySettings));
            renderSalaryTable(); loadKpiFromData(); renderEmployees();
            showToast(input.dataset.salaryField === "reachKpi" ? "Сумма KPI за охват сохранена" : "Санкции KPI сохранены за " + kpiMonthLabel(month));
          }).catch(function () { renderSalaryTable(); showToast("Не удалось сохранить корректировку KPI"); });
        }
      });
      document.getElementById("loadKpiFromDataBtn").addEventListener("click",loadKpiFromData);
      document.getElementById("kpiManagerSelect").addEventListener("change",function () { populateKpiBloggerSelect(); loadKpiFromData(); });
      document.getElementById("kpiMonthSelect").addEventListener("change",function (event) {
        var month = event.target.value;
        renderKpiBloggerRoster(); updateKpiBloggerDefaults(true);
        if (!kpiRosterLoadedMonths[month]) hydrateKpiMonthBloggers(month).catch(function () { showToast("Не удалось обновить список блогеров KPI"); });
        else loadKpiFromData();
      });
      document.getElementById("kpiBloggerSelect").addEventListener("change",function () { updateKpiBloggerDefaults(true); });
      document.getElementById("addKpiBloggerBtn").addEventListener("click",function (event) {
        if (role !== "leader") return showToast("Блогеров KPI может добавлять только администратор");
        var blogger = bloggers.find(function (item) { return String(item.id) === String(document.getElementById("kpiBloggerSelect").value); });
        var month = document.getElementById("kpiMonthSelect").value;
        var manager = document.getElementById("kpiRosterManagerSelect").value;
        var factReach = Number(document.getElementById("kpiBloggerReach").value || 0);
        if (!blogger || !month || !manager || !Number.isFinite(factReach) || factReach < 0) return showToast("Проверьте блогера, менеджера и фактический охват");
        event.currentTarget.disabled = true;
        persistKpiMonthBlogger({month:month,bloggerKey:String(blogger.id),bloggerName:blogger.display || blogger.name,manager:manager,factReach:Math.round(factReach),note:document.getElementById("kpiBloggerNote").value}).then(function () {
          renderKpiBloggerRoster(); renderSalaryTable(); loadKpiFromData(); renderEmployees();
          showToast("Блогер добавлен в KPI за " + kpiMonthLabel(month));
        }).catch(function (error) { showToast(error.message || "Не удалось добавить блогера в KPI"); }).finally(function () { event.currentTarget.disabled = false; });
      });
      document.getElementById("kpiBloggerRosterTable").addEventListener("click",function (event) {
        var button = event.target.closest("[data-remove-kpi-blogger]");
        if (!button) return;
        if (!window.confirm("Удалить блогера из KPI за " + kpiMonthLabel(button.dataset.kpiMonth) + "?")) return;
        button.disabled = true;
        deleteKpiMonthBlogger(button.dataset.kpiMonth,button.dataset.removeKpiBlogger).then(function () {
          renderKpiBloggerRoster(); renderSalaryTable(); loadKpiFromData(); renderEmployees();
          showToast("Блогер удалён из KPI месяца");
        }).catch(function (error) { button.disabled = false; showToast(error.message || "Не удалось удалить блогера из KPI"); });
      });
      document.querySelectorAll(".kpi-calc-input").forEach(function (input) { input.addEventListener("input",renderKpiCalculator); });
      document.getElementById("kpiSanctions").addEventListener("change",function (event) {
        if (role !== "leader") return loadKpiFromData();
        var manager = document.getElementById("kpiManagerSelect").value;
        var month = document.getElementById("kpiMonthSelect").value;
        var sanctions = Math.max(0,Number(event.target.value || 0));
        var reachKpi = Math.max(0,Number(document.getElementById("kpiManualReachAmount").value || 0));
        persistKpiAdjustment(manager,month,sanctions,reachKpi).then(function (adjustment) {
          var setting = salarySetting(adjustment.manager);
          setting.sanctions[adjustment.month] = adjustment.sanctions;
          setting.manualReachKpi[adjustment.month] = adjustment.manualReachKpi;
          sessionStorage.setItem("nslSalarySettings",JSON.stringify(salarySettings));
          renderKpiCalculator(); renderSalaryTable(); renderEmployees();
          showToast("Корректировка KPI сохранена");
        }).catch(function () { loadKpiFromData(); showToast("Не удалось сохранить корректировку KPI"); });
      });
      document.getElementById("kpiManualReachAmount").addEventListener("change",function (event) {
        if (role !== "leader") return loadKpiFromData();
        var manager = document.getElementById("kpiManagerSelect").value;
        var month = document.getElementById("kpiMonthSelect").value;
        var reachKpi = Math.max(0,Number(event.target.value || 0));
        var sanctions = Math.max(0,Number(document.getElementById("kpiSanctions").value || 0));
        persistKpiAdjustment(manager,month,sanctions,reachKpi).then(function (adjustment) {
          var setting = salarySetting(adjustment.manager);
          setting.sanctions[adjustment.month] = adjustment.sanctions;
          setting.manualReachKpi[adjustment.month] = adjustment.manualReachKpi;
          sessionStorage.setItem("nslSalarySettings",JSON.stringify(salarySettings));
          renderKpiCalculator(); renderSalaryTable(); renderEmployees();
          showToast("Сумма KPI за охват сохранена");
        }).catch(function () { loadKpiFromData(); showToast("Не удалось сохранить сумму KPI за охват"); });
      });
      document.getElementById("acceptanceChecklist").addEventListener("change",renderAcceptanceStatus);
      document.getElementById("addEvidenceBtn").addEventListener("click", function () { openEvidenceForm(""); });
      document.querySelectorAll(".evidence-add-btn").forEach(function (button) {
        button.addEventListener("click", function () { openEvidenceForm(button.dataset.evidenceBlogger); });
      });
      document.getElementById("evidenceFiles").addEventListener("change", function (event) {
        var files = Array.from(event.target.files || []);
        event.target.value = "";
        addEvidenceFiles(files);
      });
      var evidenceUploadZone = document.querySelector("#evidenceModal .upload-zone");
      ["dragenter","dragover"].forEach(function (eventName) { evidenceUploadZone.addEventListener(eventName,function (event) { event.preventDefault(); evidenceUploadZone.classList.add("drag-active"); }); });
      ["dragleave","drop"].forEach(function (eventName) { evidenceUploadZone.addEventListener(eventName,function (event) { event.preventDefault(); evidenceUploadZone.classList.remove("drag-active"); }); });
      evidenceUploadZone.addEventListener("drop",function (event) { addEvidenceFiles(event.dataTransfer && event.dataTransfer.files); });
      document.getElementById("evidencePreview").addEventListener("click", function (event) {
        var button = event.target.closest("[data-remove-evidence]");
        if (!button) return;
        var removed = pendingEvidenceImages.splice(Number(button.dataset.removeEvidence), 1)[0];
        if (removed && /^blob:/.test(removed.preview || "")) URL.revokeObjectURL(removed.preview);
        renderEvidencePreview();
      });
      document.getElementById("evidenceForm").addEventListener("submit", function (event) {
        event.preventDefault();
        if (!pendingEvidenceImages.length) return showToast("Прикрепите хотя бы одно фото статистики");
        var saveButton = document.getElementById("saveEvidenceBtn");
        var previousLabel = saveButton.textContent;
        var form = new FormData();
        form.append("blogger",document.getElementById("evidenceBlogger").value);
        form.append("date",document.getElementById("evidenceDate").value);
        form.append("uploader",document.getElementById("evidenceEmployee").value);
        form.append("reach",document.getElementById("evidenceReach").value || "0");
        form.append("clicks",document.getElementById("evidenceClicks").value || "0");
        form.append("comment",document.getElementById("evidenceComment").value || "Фото статистики от блогера");
        pendingEvidenceImages.forEach(function (item) { form.append("files",item.file,item.name || item.file.name || "screenshot.jpg"); });
        saveButton.disabled = true;
        saveButton.textContent = "Сохраняю " + pendingEvidenceImages.length + " фото…";
        apiFetch("/api/evidence-reports",{method:"POST",headers:{"x-nsl-role":role},body:form}).then(function (response) {
          if (!response.ok) return response.json().catch(function () { return {}; }).then(function (data) { throw new Error(data.error || "Не удалось сохранить фотографии"); });
          return response.json();
        }).then(function (data) {
          var record = data.report;
          evidenceReports = [record].concat(evidenceReports.filter(function (item) { return String(item.id) !== String(record.id); }));
          applyEvidenceFactsToBloggers();
          saveData();
          releasePendingEvidenceImages(); pendingEvidenceImages = [];
          refreshAllDerivedViews();
          closeLayers(); navigate("reports"); showToast("Сохранено фотографий: " + record.images.length);
        }).catch(function (error) {
          showToast(error && error.message ? error.message : "Не удалось сохранить фотографии");
        }).finally(function () { saveButton.disabled = false; saveButton.textContent = previousLabel; });
      });
      document.getElementById("evidenceTable").addEventListener("click", function (event) {
        var button = event.target.closest("[data-view-evidence]");
        if (button) openEvidenceViewer(button.dataset.viewEvidence);
      });
      function openPlacementCreator(origin) {
        if (role === "analyst") return showToast("У аналитика доступ только на просмотр");
        placementCreateOrigin = origin === "calendar" ? "calendar" : "placements";
        document.getElementById("newPlacementBloggerSearch").value = "";
        populatePlacementBloggerSelect();
        var today = localTodayIso();
        document.getElementById("newPlacementDate").value = today;
        document.getElementById("newPlacementWarmupStart").value = today;
        document.getElementById("newPlacementWarmupEnd").value = today;
        var modal = document.getElementById("addPlacementModal");
        var title = modal.querySelector(".modal-head h3");
        var hint = modal.querySelector(".modal-head p");
        var submit = modal.querySelector('button[type="submit"]');
        title.textContent = placementCreateOrigin === "calendar" ? "Новый выход" : "Новое размещение";
        hint.textContent = placementCreateOrigin === "calendar" ? "Добавьте выход вручную — он сохранится в общей базе и карточке блогера" : "Сначала выберите блогера из общей базы";
        submit.textContent = placementCreateOrigin === "calendar" ? "Добавить выход" : "Создать размещение";
        openLayer(modal);
      }
      document.getElementById("addPlacementBtn").addEventListener("click", function () {
        openPlacementCreator("placements");
      });
      document.getElementById("newPlacementBlogger").addEventListener("change",updatePlacementBloggerPreview);
      document.getElementById("newPlacementBloggerSearch").addEventListener("input",populatePlacementBloggerSelect);
      document.getElementById("openSelectedBloggerBtn").addEventListener("click",function () {
        var id = document.getElementById("newPlacementBlogger").value;
        if (id) openBlogger(id);
      });
      document.getElementById("addPlacementForm").addEventListener("submit",function (event) {
        event.preventDefault();
        var bloggerId = document.getElementById("newPlacementBlogger").value;
        var blogger = bloggers.find(function (item) { return String(item.id) === String(bloggerId); });
        if (!blogger) return showToast("Сначала выберите блогера из базы");
        var isoDate = document.getElementById("newPlacementDate").value;
        var warmupStart = document.getElementById("newPlacementWarmupStart").value;
        var warmupEnd = document.getElementById("newPlacementWarmupEnd").value;
        if (warmupEnd < warmupStart) return showToast("Дата окончания прогрева не может быть раньше даты старта");
        var parts = isoDate.split("-");
        var displayDate = parts.length === 3 ? parts[2] + "." + parts[1] + "." + parts[0] : isoDate;
        var record = {
          id:Date.now(),createdAt:new Date().toISOString(),start:displayDate,sortDate:isoDate,warmupStart:warmupStart,warmupEnd:warmupEnd,warmup:shortIsoDate(warmupStart) + "–" + shortIsoDate(warmupEnd),
          tag:blogger.name || blogger.display,sourceKey:blogger.sourceKey || "blogger-" + blogger.id,direction:document.getElementById("newPlacementDirection").value,
          decision:document.getElementById("newPlacementDecision").value,manager:document.getElementById("newPlacementManager").value,
          dealType:document.getElementById("newPlacementDealType").value,brief:document.getElementById("newPlacementBrief").value,
          fullName:blogger.display,contract:document.getElementById("newPlacementContract").value,chat:false,
          platform:blogger.link || (blogger.platforms || []).join(", "),type:document.getElementById("newPlacementFormat").value,duration:"—",
          cost:Number(document.getElementById("newPlacementCost").value || 0),guaranteed:Number(document.getElementById("newPlacementGuarantee").value || 0),
          actual:null,clicks:null,leads:0,sales:0,revenue:0,comment:document.getElementById("newPlacementComment").value.trim() || "Новое размещение",
          source:"Ручное добавление"
        };
        customPlacementRecords.unshift(record); placementRecords.unshift(record); weeklyExits.unshift(weeklyExitFromPlacement(record));
        invalidateDerivedData();
        var sharedPlacementSave = persistSharedStateRecords([sharedPlacementRecord(record)]);
        try { sessionStorage.setItem("nslCustomPlacements",JSON.stringify(customPlacementRecords)); } catch (cacheError) { console.warn("NSL local placement cache skipped",cacheError); }
        persistPlacementSchedule(record,warmupStart,warmupEnd).catch(function () { showToast("Размещение создано, но даты прогрева не синхронизировались"); });
        expandedPlacementId = record.id; placementPage = 1; placementQuickFilter = "all";
        document.querySelectorAll("#placementQuickFilters .quick-filter").forEach(function (item) { item.classList.toggle("active",item.dataset.placementQuick === "all"); });
        var destination = placementCreateOrigin === "calendar" ? "calendar" : "placements";
        refreshAllDerivedViews();
        if (destination === "calendar") {
          var recordMonth = monthFromDateValue(record.sortDate);
          var monthFilter = document.getElementById("exitMonthFilter");
          if (monthFilter && recordMonth) monthFilter.value = recordMonth;
          ["exitSearch","exitReachMin","exitReachMax","exitDateFrom","exitDateTo"].forEach(function (id) { var control = document.getElementById(id); if (control) control.value = ""; });
          ["exitManagerFilter","exitFormatFilter","exitActualFilter"].forEach(function (id) { var control = document.getElementById(id); if (control) control.value = ""; });
          exitPage = 1;
        }
        closeLayers(); event.target.reset(); navigate(destination);
        showToast((destination === "calendar" ? "Выход добавлен в список для " : "Размещение создано для ") + (blogger.display || blogger.name));
        sharedPlacementSave.then(function () {
          if (destination === "calendar") showToast("Выход сохранён в общей базе");
        }).catch(function (error) {
          showToast(error && error.message ? error.message : "Выход показан локально, но не сохранился в общей базе");
        });
        placementCreateOrigin = "placements";
      });
      document.getElementById("calendarAddBtn").addEventListener("click", function () { openPlacementCreator("calendar"); });
      document.getElementById("inviteBtn").addEventListener("click", function () { openEmployeeEditor(null); });
      document.getElementById("employeeRole").addEventListener("change",toggleEmployeeManagerField);
      document.getElementById("teamGrid").addEventListener("click",function (event) {
        var button = event.target.closest("[data-edit-employee],[data-create-employee-access],[data-open-employee-profile]");
        if (!button) return;
        var employeeId = button.dataset.editEmployee || button.dataset.createEmployeeAccess || button.dataset.openEmployeeProfile;
        var employee = employees.find(function (item) { return item.id === employeeId; });
        if (!employee) return;
        if (button.dataset.editEmployee) openEmployeeEditor(employee);
        else if (button.dataset.createEmployeeAccess) openEmployeeAccess(employee);
        else openEmployeeProfile(employee);
      });
      document.getElementById("employeeForm").addEventListener("submit",function (event) {
        event.preventDefault();
        if (role !== "leader") return showToast("Редактировать сотрудников может только администратор");
        var id = document.getElementById("employeeId").value;
        var previous = employees.find(function (item) { return item.id === id; });
        var name = document.getElementById("employeeName").value.trim();
        var email = document.getElementById("employeeEmail").value.trim().toLowerCase();
        if (!name) return showToast("Укажите имя сотрудника");
        if (employees.some(function (item) { return item.id !== id && item.name.toLowerCase() === name.toLowerCase(); })) return showToast("Сотрудник с таким именем уже есть");
        var employee = {
          id:id || "employee-" + Date.now(),name:name,email:email,role:document.getElementById("employeeRole").value,
          assignedManager:document.getElementById("employeeRole").value === "assistant" ? document.getElementById("employeeAssignedManager").value : "",
          status:document.getElementById("employeeStatus").value,baseSalary:Math.max(0,Number(document.getElementById("employeeBaseSalary").value || 0)),
          historyAliases:document.getElementById("employeeHistoryAliases").value.split(",").map(function (value) { return value.trim(); }).filter(Boolean)
        };
        if (previous && previous.name !== name && employee.historyAliases.indexOf(previous.name) < 0) employee.historyAliases.push(previous.name);
        var button = document.getElementById("saveEmployeeBtn");
        button.disabled = true;
        document.getElementById("employeeFormNote").textContent = "Сохраняю изменения в общей базе…";
        persistEmployee(employee).then(function (saved) {
          applySavedEmployee(saved,previous);
          closeLayers();
          showToast(previous ? "Сотрудник обновлён" : "Сотрудник добавлен");
          if (!previous) openEmployeeAccess(saved);
        }).catch(function (error) {
          document.getElementById("employeeFormNote").textContent = error.message || "Не удалось сохранить сотрудника";
          showToast("Не удалось сохранить сотрудника");
        }).finally(function () { button.disabled = false; });
      });
      document.getElementById("removeEmployeeBtn").addEventListener("click",function () {
        var employeeId = document.getElementById("employeeId").value;
        var employee = employees.find(function (item) { return item.id === employeeId; });
        if (!employee || !window.confirm("Убрать " + employee.name + " из активной команды? История и отчёты сохранятся.")) return;
        var button = document.getElementById("removeEmployeeBtn");
        button.disabled = true;
        removeEmployeeAccess(employee.id).then(function (data) {
          var index = employees.findIndex(function (item) { return item.id === employee.id; });
          if (index >= 0) employees[index] = data.employee;
          cacheEmployees(); refreshStaffSelectors(); renderEmployees(); renderSalaryTable(); closeLayers();
          showToast("Сотрудник убран из активной команды, история сохранена");
        }).catch(function (error) { showToast(error.message || "Не удалось убрать сотрудника"); }).finally(function () { button.disabled = false; });
      });
      document.getElementById("copyEmployeeAccessBtn").addEventListener("click",function () {
        var input = document.getElementById("employeeAccessLink");
        var copy = navigator.clipboard && navigator.clipboard.writeText ? navigator.clipboard.writeText(input.value) : Promise.reject();
        copy.catch(function () { input.select(); document.execCommand("copy"); }).finally(function () { showToast("Ссылка доступа скопирована"); });
      });
      document.getElementById("syncAllBtn").addEventListener("click", function () { syncAllData(true); });
      document.getElementById("openUtmRulesBtn").addEventListener("click", function () { openInfo("Правила UTM","Для каждого размещения программа создаёт уникальный utm_content. Публикация не переводится в статус «Готово», пока ссылка не прошла автоматическую проверку."); });
      document.getElementById("menuBtn").addEventListener("click", function () { document.getElementById("sidebar").classList.add("open"); document.getElementById("mobileOverlay").classList.add("show"); });
      document.getElementById("mobileOverlay").addEventListener("click", function () { document.getElementById("sidebar").classList.remove("open"); document.getElementById("mobileOverlay").classList.remove("show"); });
      window.addEventListener("beforeinstallprompt",function (event) {
        event.preventDefault();
        deferredInstallPrompt = event;
        document.getElementById("installAppBtn").classList.remove("hidden");
      });
      document.getElementById("installAppBtn").addEventListener("click",function () {
        if (deferredInstallPrompt) {
          deferredInstallPrompt.prompt();
          deferredInstallPrompt.userChoice.finally(function () { deferredInstallPrompt = null; document.getElementById("installAppBtn").classList.add("hidden"); });
          return;
        }
        showToast("На iPhone: нажмите «Поделиться» → «На экран Домой»");
      });
      if (/iphone|ipad|ipod/i.test(navigator.userAgent) && !window.navigator.standalone) document.getElementById("installAppBtn").classList.remove("hidden");
      document.getElementById("globalSearch").addEventListener("keydown", function (e) {
        if (e.key === "Enter") {
          navigate("bloggers");
          document.getElementById("bloggerSearch").value = e.target.value;
          renderBloggers();
        }
      });
      document.querySelectorAll(".drawer-tab").forEach(function (tab) {
        tab.addEventListener("click", function () {
          document.querySelectorAll(".drawer-tab").forEach(function (x) { x.classList.remove("active"); });
          tab.classList.add("active");
          document.querySelectorAll(".drawer-view").forEach(function (view) { view.classList.add("hidden"); });
          var target = tab.dataset.drawerView;
          document.getElementById("drawerView" + target.charAt(0).toUpperCase() + target.slice(1)).classList.remove("hidden");
          document.getElementById("drawerFoot").classList.toggle("hidden",target !== "card");
        });
      });
      var initialToday = localTodayIso();
      ["managerDailyDateFilter","reportDate","assistantReportDate","evidenceDate","newPlacementDate"].forEach(function (id) { var input = document.getElementById(id); if (input) input.value = initialToday; });
      document.getElementById("managerMonthlyPlanFilter").value = activeMonthKey();
      if (sharedStateChannel) sharedStateChannel.addEventListener("message",function (event) { if (event.data && event.data.type === "changed") hydrateSharedState({full:true}).catch(function () {}); });
      initializeImportedData(); syncBloggerEditControls(); refreshStaffSelectors(); populateKpiControls(); refreshBloggerCounters(); renderCurrentPageData(); renderAcceptanceStatus(); renderDataHealth();
      if (registrationInviteToken) {
        document.getElementById("loginMode").value = "register";
        document.getElementById("loginTitle").textContent = "Регистрация сотрудника";
        document.getElementById("loginSubtitle").textContent = "Создайте пароль — роль, закрепление и история прошлых месяцев подключатся автоматически.";
        document.getElementById("loginEmailField").classList.add("hidden");
        document.getElementById("loginPasswordLabel").textContent = "Придумайте пароль";
        document.getElementById("loginPassword").setAttribute("autocomplete","new-password");
        document.getElementById("loginPasswordConfirmField").classList.remove("hidden");
        document.getElementById("loginPasswordConfirm").required = true;
        document.getElementById("loginSubmitBtn").textContent = "Зарегистрироваться";
        document.getElementById("loginMessage").innerHTML = "<b>Персональное приглашение найдено.</b> После регистрации вы сразу попадёте в свой кабинет.";
      }
      supabaseClient.auth.onAuthStateChange(function (event,session) {
        if (!registrationInviteToken && !adminLinkOpened && session && (!currentSession || currentSession.access_token !== session.access_token)) activateSession(session).catch(function () {});
        if (event === "SIGNED_OUT") { currentSession = null; appShell.classList.add("hidden"); loginScreen.classList.remove("hidden"); }
      });
      supabaseClient.auth.getSession().then(function (result) {
        if (registrationInviteToken) { loginScreen.classList.remove("hidden"); appShell.classList.add("hidden"); return; }
        if (adminLinkOpened && adminAccessToken) return activateSession(null);
        if (result.data && result.data.session) return activateSession(result.data.session);
        if (adminAccessToken) return activateSession(null);
        loginScreen.classList.remove("hidden"); appShell.classList.add("hidden");
      }).catch(function () { loginScreen.classList.remove("hidden"); appShell.classList.add("hidden"); });
      window.addEventListener("pageshow",function () { refreshStaleSessionData().catch(function () {}); });
      document.addEventListener("visibilitychange",function () { if (!document.hidden) refreshStaleSessionData().catch(function () {}); });
      if ("serviceWorker" in navigator) window.addEventListener("load",function () {
        navigator.serviceWorker.register("sw.js?v=89",{updateViaCache:"none"}).then(function (registration) { return registration.update(); }).catch(function () {});
      });
    })();
