(function () {
  var source = (window.__appParts || []).join("");

  function replaceRequired(label, before, after) {
    if (source.indexOf(before) < 0) throw new Error("NSL v87 hotfix target not found: " + label);
    source = source.replace(before, after);
  }

  replaceRequired(
    "effective placement clicks",
    [
      "      function effectivePlacementActual(item) {",
      "        if (!item || item.actual == null || item.actual === \"\") return null;",
      "        var actual = Number(item.actual);",
      "        return Number.isFinite(actual) && actual >= 0 && actual <= MAX_REACH_PER_FORMAT ? actual : null;",
      "      }"
    ].join("\n"),
    [
      "      function effectivePlacementActual(item) {",
      "        if (!item || item.actual == null || item.actual === \"\") return null;",
      "        var actual = Number(item.actual);",
      "        return Number.isFinite(actual) && actual >= 0 && actual <= MAX_REACH_PER_FORMAT ? actual : null;",
      "      }",
      "      function confirmedEvidenceClicksForPlacement(item) {",
      "        if (!item) return null;",
      "        var identity = normalizeBloggerIdentity(item.sourceKey || item.tag || item.bloggerLink);",
      "        var date = placementIsoDate(item) || item.sortDate || item.start || \"\";",
      "        var values = evidenceReports.filter(function (report) {",
      "          return normalizeBloggerIdentity(report.blogger) === identity && String(report.date || \"\") === String(date) && (!report.status || report.status === \"Подтверждено\");",
      "        }).map(function (report) { return Number(report.clicks); }).filter(function (value) { return Number.isFinite(value) && value >= 0; });",
      "        return values.length ? Math.max.apply(Math,values) : null;",
      "      }",
      "      function effectivePlacementClicks(item) {",
      "        var placementValue = item && item.clicks != null && item.clicks !== \"\" ? Number(item.clicks) : null;",
      "        if (!Number.isFinite(placementValue) || placementValue < 0) placementValue = null;",
      "        var evidenceValue = confirmedEvidenceClicksForPlacement(item);",
      "        if (placementValue == null) return evidenceValue;",
      "        if (evidenceValue == null) return placementValue;",
      "        return Math.max(placementValue,evidenceValue);",
      "      }"
    ].join("\n")
  );

  replaceRequired(
    "direction click maps",
    [
      "        var placementKeys = {};",
      "        var placementReachByKey = {};",
      "        var bloggerKeys = {};"
    ].join("\n"),
    [
      "        var placementKeys = {};",
      "        var placementReachByKey = {};",
      "        var placementClicksByKey = {};",
      "        var bloggerKeys = {};"
    ].join("\n")
  );

  replaceRequired(
    "direction placement clicks",
    [
      "          var actual = Number(effectivePlacementActual(item) || 0);",
      "          placementKeys[placementKey] = true;",
      "          placementReachByKey[placementKey] = Number(placementReachByKey[placementKey] || 0) + actual;",
      "          bloggerKeys[identity] = true;",
      "          total.exits += 1;",
      "          total.guaranteed += Number(item.guaranteed || 0);",
      "          total.reach += actual;",
      "          total.leads += Number(item.leads || 0);"
    ].join("\n"),
    [
      "          var actual = Number(effectivePlacementActual(item) || 0);",
      "          var clicks = Number(effectivePlacementClicks(item) || 0);",
      "          placementKeys[placementKey] = true;",
      "          placementReachByKey[placementKey] = Number(placementReachByKey[placementKey] || 0) + actual;",
      "          placementClicksByKey[placementKey] = Math.max(Number(placementClicksByKey[placementKey] || 0),clicks);",
      "          bloggerKeys[identity] = true;",
      "          total.exits += 1;",
      "          total.guaranteed += Number(item.guaranteed || 0);",
      "          total.reach += actual;",
      "          total.clicks += clicks;",
      "          total.leads += Number(item.leads || 0);"
    ].join("\n")
  );

  replaceRequired(
    "direction totals clicks",
    "        },{direction:direction,exits:0,guaranteed:0,reach:0,leads:0,sales:0,revenue:0,costs:0,bloggers:0,source:\"Единый реестр\"});",
    "        },{direction:direction,exits:0,guaranteed:0,reach:0,clicks:0,leads:0,sales:0,revenue:0,costs:0,bloggers:0,source:\"Единый реестр\"});"
  );

  replaceRequired(
    "direction reels clicks",
    [
      "          result.guaranteed += Number(item.guaranteed || 0);",
      "          result.reach += actual;",
      "          result.leads += Number(item.leads || 0);"
    ].join("\n"),
    [
      "          result.guaranteed += Number(item.guaranteed || 0);",
      "          result.reach += actual;",
      "          result.clicks += Number(item.clicks || 0);",
      "          result.leads += Number(item.leads || 0);"
    ].join("\n")
  );

  replaceRequired(
    "direction evidence clicks",
    [
      "          var recordedReach = Number(placementReachByKey[evidenceKey] || 0);",
      "          if (!placementKeys[evidenceKey]) {",
      "            placementKeys[evidenceKey] = true;",
      "            result.exits += 1;",
      "          }",
      "          if (reach > recordedReach) {",
      "            result.reach += reach - recordedReach;",
      "            placementReachByKey[evidenceKey] = reach;",
      "          }"
    ].join("\n"),
    [
      "          var recordedReach = Number(placementReachByKey[evidenceKey] || 0);",
      "          var reportClicks = Math.max(0,Number(report.clicks || 0));",
      "          var recordedClicks = Number(placementClicksByKey[evidenceKey] || 0);",
      "          if (!placementKeys[evidenceKey]) {",
      "            placementKeys[evidenceKey] = true;",
      "            result.exits += 1;",
      "          }",
      "          if (reach > recordedReach) {",
      "            result.reach += reach - recordedReach;",
      "            placementReachByKey[evidenceKey] = reach;",
      "          }",
      "          if (reportClicks > recordedClicks) {",
      "            result.clicks += reportClicks - recordedClicks;",
      "            placementClicksByKey[evidenceKey] = reportClicks;",
      "          }"
    ].join("\n")
  );

  replaceRequired(
    "direction fallback clicks",
    [
      "            result.reach += Number(item.reach || 0);",
      "            result.leads += Number(item.leads || 0);"
    ].join("\n"),
    [
      "            result.reach += Number(item.reach || 0);",
      "            result.clicks += Number(item.clicks || 0);",
      "            result.leads += Number(item.leads || 0);"
    ].join("\n")
  );

  replaceRequired(
    "direction card clicks",
    "<div class=\"team-stat\"><strong>' + number(item.bloggers) + '</strong><span>Блогеры</span></div><div class=\"team-stat\"><strong>' + number(item.leads) + '</strong><span>Лиды</span></div>",
    "<div class=\"team-stat\"><strong>' + number(item.bloggers) + '</strong><span>Блогеры</span></div><div class=\"team-stat\"><strong>' + number(item.clicks) + '</strong><span>Клики</span></div><div class=\"team-stat\"><strong>' + number(item.leads) + '</strong><span>Лиды</span></div>"
  );

  replaceRequired(
    "dashboard total clicks",
    [
      "          [\"exits\",\"guaranteed\",\"reach\",\"leads\",\"sales\",\"revenue\",\"costs\",\"bloggers\"].forEach(function (field) { sum[field] += Number(item[field] || 0); });",
      "          return sum;",
      "        },{exits:0,guaranteed:0,reach:0,leads:0,sales:0,revenue:0,costs:0,bloggers:0});"
    ].join("\n"),
    [
      "          [\"exits\",\"guaranteed\",\"reach\",\"clicks\",\"leads\",\"sales\",\"revenue\",\"costs\",\"bloggers\"].forEach(function (field) { sum[field] += Number(item[field] || 0); });",
      "          return sum;",
      "        },{exits:0,guaranteed:0,reach:0,clicks:0,leads:0,sales:0,revenue:0,costs:0,bloggers:0});"
    ].join("\n")
  );

  replaceRequired(
    "dashboard clicks card",
    [
      "          {label:\"Фактический охват\",value:number(totals.factReach),plan:number(totals.planReach),pct:rate(totals.factReach,totals.planReach),icon:\"◉\"},",
      "          {label:\"Выручка\",value:money(totals.factRevenue),plan:money(totals.planRevenue),pct:rate(totals.factRevenue,totals.planRevenue),icon:\"₽\"}"
    ].join("\n"),
    [
      "          {label:\"Фактический охват\",value:number(totals.factReach),plan:number(totals.planReach),pct:rate(totals.factReach,totals.planReach),icon:\"◉\"},",
      "          {label:\"Клики\",value:number(directionTotal.clicks),plan:\"\",planLabel:\"от охвата\",pct:rate(directionTotal.clicks,totals.factReach),progressLabel:\"CTR\",icon:\"↗\"},",
      "          {label:\"Выручка\",value:money(totals.factRevenue),plan:money(totals.planRevenue),pct:rate(totals.factRevenue,totals.planRevenue),icon:\"₽\"}"
    ].join("\n")
  );

  replaceRequired(
    "dashboard clicks progress label",
    [
      "        document.getElementById(\"dashboardMonthKpis\").innerHTML = cards.map(function (card) {",
      "          return '<article class=\"kpi\" style=\"border:1px solid var(--line);border-radius:14px\"><div class=\"kpi-top\"><span>' + card.label + '</span><span class=\"kpi-icon\">' + card.icon + '</span></div><div class=\"kpi-value\">' + card.value + '</div><div class=\"kpi-foot\"><span class=\"' + metricState(card.pct,100) + '\">' + percent(card.pct,1) + '</span> · ' + (card.planLabel || \"план \" + card.plan) + '</div><div class=\"plan-row\"><div><span>Факт / план</span><span>' + percent(card.pct,0) + '</span></div><div class=\"progress\"><i style=\"width:' + Math.min(100,card.pct) + '%\"></i></div></div></article>';",
      "        }).join(\"\");"
    ].join("\n"),
    [
      "        document.getElementById(\"dashboardMonthKpis\").innerHTML = cards.map(function (card) {",
      "          return '<article class=\"kpi\" style=\"border:1px solid var(--line);border-radius:14px\"><div class=\"kpi-top\"><span>' + card.label + '</span><span class=\"kpi-icon\">' + card.icon + '</span></div><div class=\"kpi-value\">' + card.value + '</div><div class=\"kpi-foot\"><span class=\"' + metricState(card.pct,100) + '\">' + percent(card.pct,1) + '</span> · ' + (card.planLabel || \"план \" + card.plan) + '</div><div class=\"plan-row\"><div><span>' + (card.progressLabel || \"Факт / план\") + '</span><span>' + percent(card.pct,card.progressLabel ? 1 : 0) + '</span></div><div class=\"progress\"><i style=\"width:' + Math.min(100,card.pct) + '%\"></i></div></div></article>';",
      "        }).join(\"\");"
    ].join("\n")
  );

  replaceRequired(
    "finance direction clicks",
    [
      "          var lnCost = programDirectionCostMetric(entry.month,\"ЛН\");",
      "          var fitCost = programDirectionCostMetric(entry.month,\"FIT PRO\");",
      "          if (directions.ln) { directions.ln.metrics.outreach = {plan:null,fact:null,progress:null}; directions.ln.metrics.costs = lnCost; }",
      "          if (directions.fit) { directions.fit.metrics.outreach = {plan:null,fact:null,progress:null}; directions.fit.metrics.costs = fitCost; }",
      "          if (entry.combined) {",
      "            entry.combined.metrics.outreach = programOutreachMetric(entry.month);",
      "            entry.combined.metrics.costs = {plan:null,fact:Number(lnCost.fact || 0) + Number(fitCost.fact || 0),progress:null,source:\"Размещения и карточки блогеров\"};"
    ].join("\n"),
    [
      "          var lnCost = programDirectionCostMetric(entry.month,\"ЛН\");",
      "          var fitCost = programDirectionCostMetric(entry.month,\"FIT PRO\");",
      "          var lnFact = monthlyDirectionFact(entry.month,\"ЛН\");",
      "          var fitFact = monthlyDirectionFact(entry.month,\"FIT PRO\");",
      "          if (directions.ln) { directions.ln.metrics.outreach = {plan:null,fact:null,progress:null}; directions.ln.metrics.costs = lnCost; directions.ln.metrics.clicks = {plan:null,fact:Number(lnFact.clicks || 0),progress:null,source:\"Карточки и подтверждённые отчёты\"}; }",
      "          if (directions.fit) { directions.fit.metrics.outreach = {plan:null,fact:null,progress:null}; directions.fit.metrics.costs = fitCost; directions.fit.metrics.clicks = {plan:null,fact:Number(fitFact.clicks || 0),progress:null,source:\"Карточки и подтверждённые отчёты\"}; }",
      "          if (entry.combined) {",
      "            entry.combined.metrics.outreach = programOutreachMetric(entry.month);",
      "            entry.combined.metrics.clicks = {plan:null,fact:Number(lnFact.clicks || 0) + Number(fitFact.clicks || 0),progress:null,source:\"Карточки и подтверждённые отчёты\"};",
      "            entry.combined.metrics.costs = {plan:null,fact:Number(lnCost.fact || 0) + Number(fitCost.fact || 0),progress:null,source:\"Размещения и карточки блогеров\"};"
    ].join("\n")
  );

  replaceRequired(
    "placement result clicks",
    "(item.clicks == null ? \"—\" : number(item.clicks))",
    "(effectivePlacementClicks(item) == null ? \"—\" : number(effectivePlacementClicks(item)))"
  );

  replaceRequired(
    "placement detail clicks",
    "number(item.clicks) + ' кликов",
    "number(effectivePlacementClicks(item)) + ' кликов"
  );

  replaceRequired(
    "card placement clicks value",
    [
      "        var selected = rows.find(function (item) { return placementOverrideKey(item) === select.value; }) || rows[0];",
      "        populateCardActualFormats(selected);",
      "        populateCardWarmupDates(selected);"
    ].join("\n"),
    [
      "        var selected = rows.find(function (item) { return placementOverrideKey(item) === select.value; }) || rows[0];",
      "        populateCardActualFormats(selected);",
      "        populateCardWarmupDates(selected);",
      "        document.getElementById(\"cardActualClicks\").value = effectivePlacementClicks(selected) == null ? \"\" : effectivePlacementClicks(selected);"
    ].join("\n")
  );

  replaceRequired(
    "card placement change clicks",
    [
      "        populateCardActualFormats(item);",
      "        populateCardWarmupDates(item);",
      "        cardActualDirty = false;"
    ].join("\n"),
    [
      "        populateCardActualFormats(item);",
      "        populateCardWarmupDates(item);",
      "        document.getElementById(\"cardActualClicks\").value = effectivePlacementClicks(item) == null ? \"\" : effectivePlacementClicks(item);",
      "        cardActualDirty = false;"
    ].join("\n")
  );

  replaceRequired(
    "card clicks validation",
    [
      "        if (invalid) { showToast(\"Введите охват от 0 до \" + number(MAX_REACH_PER_FORMAT) + \" для каждого источника\"); return Promise.reject(new Error(\"invalid reach\")); }",
      "        var previousFacts = Object.assign({},placementFormatActuals[key] || {});",
      "        var previousActual = item.actual;"
    ].join("\n"),
    [
      "        if (invalid) { showToast(\"Введите охват от 0 до \" + number(MAX_REACH_PER_FORMAT) + \" для каждого источника\"); return Promise.reject(new Error(\"invalid reach\")); }",
      "        var clicksInput = document.getElementById(\"cardActualClicks\");",
      "        var clicks = clicksInput.value === \"\" ? 0 : Number(clicksInput.value);",
      "        if (!Number.isFinite(clicks) || clicks < 0 || clicks > 1000000000) { showToast(\"Введите корректное количество кликов\"); return Promise.reject(new Error(\"invalid clicks\")); }",
      "        clicks = Math.round(clicks);",
      "        var previousFacts = Object.assign({},placementFormatActuals[key] || {});",
      "        var previousActual = item.actual;",
      "        var previousClicks = item.clicks;"
    ].join("\n")
  );

  replaceRequired(
    "card clicks assignment",
    [
      "        item.actual = Object.keys(placementFormatActuals[key]).reduce(function (sum,itemFormat) { return sum + Number(placementFormatActuals[key][itemFormat] || 0); },0);",
      "        var baseComment = String(item.comment || \"\").replace(/(?: · )?Факт:.*$/,\"\" );"
    ].join("\n"),
    [
      "        item.actual = Object.keys(placementFormatActuals[key]).reduce(function (sum,itemFormat) { return sum + Number(placementFormatActuals[key][itemFormat] || 0); },0);",
      "        item.clicks = clicks;",
      "        var baseComment = String(item.comment || \"\").replace(/(?: · )?Факт:.*$/,\"\" );"
    ].join("\n")
  );

  replaceRequired(
    "card clicks shared save",
    [
      "        return persistReachActual({placementKey:key,bloggerKey:String(blogger.sourceKey || blogger.name || blogger.id),facts:placementFormatActuals[key],comment:item.comment}).then(function (savedRecord) {",
      "          applyReachActualRecord(savedRecord);"
    ].join("\n"),
    [
      "        return persistReachActual({placementKey:key,bloggerKey:String(blogger.sourceKey || blogger.name || blogger.id),facts:placementFormatActuals[key],comment:item.comment}).then(function (savedRecord) {",
      "          return persistSharedStateRecords([sharedPlacementRecord(item)]).then(function () { return savedRecord; });",
      "        }).then(function (savedRecord) {",
      "          applyReachActualRecord(savedRecord);"
    ].join("\n")
  );

  replaceRequired(
    "card clicks status",
    "status.textContent = \"Сохранено в общей базе · общий факт \" + number(item.actual) + \" · размещения и дашборд обновлены\";",
    "status.textContent = \"Сохранено в общей базе · охват \" + number(item.actual) + \" · клики \" + number(item.clicks) + \" · статистика обновлена\";"
  );

  replaceRequired(
    "card clicks rollback",
    [
      "          item.actual = previousActual;",
      "          item.comment = previousComment;"
    ].join("\n"),
    [
      "          item.actual = previousActual;",
      "          item.clicks = previousClicks;",
      "          item.comment = previousComment;"
    ].join("\n")
  );

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

  window.__appParts = [source];
})();
