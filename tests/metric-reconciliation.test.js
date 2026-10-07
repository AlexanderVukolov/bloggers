const assert = require("node:assert/strict");
const fs = require("node:fs");
const test = require("node:test");
const vm = require("node:vm");

const source = fs.readFileSync(require("node:path").join(__dirname,"..","app-bundle-v88.js"),"utf8");
const bodySource = fs.readFileSync(require("node:path").join(__dirname,"..","body-bundle-v88.js"),"utf8");
const apiSource = fs.readFileSync(require("node:path").join(__dirname,"..","supabase","functions","bloggers-api","index.ts"),"utf8");
const index = fs.readFileSync(require("node:path").join(__dirname,"..","index.html"),"utf8");
const serviceWorker = fs.readFileSync(require("node:path").join(__dirname,"..","sw.js"),"utf8");
const octoberPatch = fs.readFileSync(require("node:path").join(__dirname,"..","october-exits-v124.js"),"utf8");
const bloggerBasePatch = fs.readFileSync(require("node:path").join(__dirname,"..","blogger-base-v127.js"),"utf8");

test("existing passwords remain compatible while new invitations require twelve characters",() => {
  assert.match(source,/passwordInput\.minLength = 8/);
  assert.match(source,/password\.length < 12/);
  assert.match(source,/Минимум 12 символов/);
  assert.match(source,/nslRegistrationInviteToken/);
  assert.match(source,/sessionStorage\.removeItem\("nslRegistrationInviteToken"\)/);
  assert.match(source,/Неверная почта или пароль/);
  assert.match(source,/Пароль принят, но кабинет не открылся/);
});

test("admin summary is protected and supports automatic months plus manual overrides",() => {
  assert.match(source,/data-page="summary"/);
  assert.match(source,/page === "summary"\) && role !== "leader"/);
  assert.match(source,/apiFetch\("\/api\/admin-summary"/);
  assert.match(source,/data-edit-admin-summary/);
  assert.match(apiSource,/path === "\/api\/admin-summary"/);
  assert.match(apiSource,/role !== "leader"/);
  assert.match(apiSource,/range=A1:H1000/);
  assert.match(apiSource,/adminSummaryManualNamespace/);
  assert.match(apiSource,/manualRows\.forEach\(\(row: any\) => \{ merged\[row\.month\] = row; \}\)/);
});

test("finance summary is editable by admins from August 2026 onward",() => {
  assert.match(source,/id="financeMonthSelect" type="month" min="2026-08"/);
  assert.match(source,/id="editFinanceSummaryBtn"/);
  assert.match(source,/function saveFinanceSummary\(\)/);
  assert.match(source,/apiFetch\("\/api\/finance-summary",\{method:"POST"/);
  assert.match(apiSource,/financeManualNamespace = "finance_manual_month_v1"/);
  assert.match(apiSource,/path === "\/api\/finance-summary" && request\.method === "POST"/);
  assert.match(apiSource,/month < "2026-08"/);
  assert.match(apiSource,/role !== "leader"/);
  assert.match(apiSource,/mergeFinanceManualSummary/);
});

function extractFunction(name) {
  const start = source.indexOf(`function ${name}(`);
  assert.notEqual(start,-1,`function ${name} should exist`);
  const bodyStart = source.indexOf("{",start);
  let depth = 0;
  let quote = "";
  let escaped = false;
  for (let index = bodyStart; index < source.length; index += 1) {
    const character = source[index];
    if (quote) {
      if (escaped) escaped = false;
      else if (character === "\\") escaped = true;
      else if (character === quote) quote = "";
      continue;
    }
    if (character === '"' || character === "'" || character === "`") { quote = character; continue; }
    if (character === "{") depth += 1;
    if (character === "}") {
      depth -= 1;
      if (!depth) return source.slice(start,index + 1);
    }
  }
  throw new Error(`function ${name} is incomplete`);
}

function runFunction(name,context) {
  vm.createContext(context);
  vm.runInContext(`${extractFunction(name)}; this.result = ${name};`,context);
  return context.result;
}

test("placement guarantee is copied from the blogger card and kept separate from actual reach",() => {
  const guaranteeFor = runFunction("bloggerPlacementGuarantee",{Number,Math});
  assert.equal(guaranteeFor({plannedReach:12500,reach:9000}),12500);
  assert.equal(guaranteeFor({plannedReach:0,reach:9000}),0);
  assert.equal(guaranteeFor({reach:9000}),9000);
  assert.equal(guaranteeFor({plannedReach:"invalid",reach:9000}),0);
  assert.match(source,/guaranteeInput\.value = String\(guarantee\)/);
  assert.match(source,/guaranteed:index === 0 \? bloggerPlacementGuarantee\(blogger\) : 0/);
  assert.match(source,/actual:null,clicks:null/);
  assert.match(source,/plannedReach:Number\(document\.getElementById\("newReach"\)\.value \|\| 0\), reach:0/);
  assert.match(source,/id="editPlannedReach"/);
  assert.match(source,/id="createPlacementFromBloggerBtn"/);
});

test("actual reach form searches bloggers instead of exposing the long select",() => {
  const candidates = runFunction("evidenceBloggerCandidates",{
    String,
    normalizeBloggerIdentity:value => String(value || "").trim().toLowerCase().replace(/^https?:\/\/(?:www\.)?instagram\.com\//,"").replace(/^@/,"").replace(/\/+$/,"").split(/[?#]/)[0],
    bloggerIdentityAliases:blogger => [blogger.sourceKey,blogger.name,blogger.display,blogger.link].map(value => String(value || "").trim().toLowerCase().replace(/^https?:\/\/(?:www\.)?instagram\.com\//,"").replace(/^@/,"").replace(/\/+$/,"").split(/[?#]/)[0]).filter(Boolean),
    synchronizedPlacementRecords:() => [],
    evidenceReports:[],
    bloggers:[
      {name:"@anna_fit",display:"Анна",link:"https://instagram.com/anna_fit",sourceKey:"anna-fit"},
      {name:"@maria_nsl",display:"Мария",link:"https://instagram.com/maria_nsl",sourceKey:"maria-nsl"},
    ],
  })("");
  assert.ok(candidates.some(item => item.value === "@anna_fit" && item.search.includes("instagram.com/anna_fit")));
  assert.match(source,/id="evidenceBloggerSearch" type="search"/);
  assert.match(source,/evidenceBloggerSelect\.classList\.add\("hidden"\)/);
  assert.match(source,/addEventListener\("input",updateEvidenceBloggerSearch\)/);
  assert.match(source,/if \(!evidenceBlogger\) return showToast\("Найдите и выберите одного блогера"\)/);
});

test("weekly placement report groups by Monday and keeps missing actual reach blank",() => {
  const context = {
    Number,Object,String,Date,Math,
    placementIsoDate:item => item.sortDate,
    effectivePlacementActual:item => item.actual == null ? null : item.actual,
  };
  vm.createContext(context);
  vm.runInContext(extractFunction("placementWeekBounds"),context);
  const groups = runFunction("placementWeeklyGroups",context)([
    {sortDate:"2026-09-13",guaranteed:100,actual:90},
    {sortDate:"2026-09-14",guaranteed:200,actual:null},
    {sortDate:"2026-09-20",guaranteed:300,actual:310},
    {sortDate:"2026-09-21",guaranteed:400,actual:0},
  ]);
  assert.deepEqual(JSON.parse(JSON.stringify(groups)),[
    {start:"2026-09-21",end:"2026-09-27",count:1,guaranteed:400,actual:0,reported:1},
    {start:"2026-09-14",end:"2026-09-20",count:2,guaranteed:500,actual:310,reported:1},
    {start:"2026-09-07",end:"2026-09-13",count:1,guaranteed:100,actual:90,reported:1},
  ]);
  assert.match(source,/"placementWeekDate"\]\.some/);
});

test("reports and control export the active table to a real workbook",() => {
  assert.match(source,/function exportReportsWorkbook\(\)/);
  assert.match(source,/\["Менеджеры",reportExportTable\("managerMetricsTable"\)\]/);
  assert.match(source,/\["Ассистенты",reportExportTable\("assistantDailyTable"\)\]/);
  assert.match(source,/\["План-факт",reportExportTable\("managerMonthlyPlanTable"\)\]/);
  assert.match(source,/\["Сводка месяца",reportExportTable\("monthlyControlTable"\)\]/);
  assert.match(source,/\["Фактические охваты",reportExportTable\("evidenceTable"\)\]/);
  assert.match(source,/managerExportBtn"\)\.addEventListener\("click",exportReportsWorkbook\)/);
});

test("blogger export downloads the currently filtered rows as Excel",() => {
  const bodySource = fs.readFileSync(require("node:path").join(__dirname,"..","body-bundle-v88.js"),"utf8");
  assert.match(bodySource,/id=\\"bloggerExportBtn\\" type=\\"button\\">⇩ Экспорт в Excel/);
  assert.match(source,/function exportBloggerWorkbook\(\)/);
  assert.match(source,/var rows = filteredBloggerRows\.slice\(\)/);
  assert.match(source,/\[\["Блогеры",detail\]\]/);
  assert.match(source,/"NSL-блогеры-" \+ period \+ "\.xlsx"/);
  assert.match(source,/bloggerExportBtn"\)\.addEventListener\("click",exportBloggerWorkbook\)/);
});

test("KPI groups duplicate blogger cards before counting the first confirmed exit",() => {
  const context = {
    Object,Number,String,Math,
    bloggers:[
      {id:1,name:"@same_blogger",link:"https://instagram.com/same_blogger",createdAt:"2026-08-20T10:00:00Z",createdByRole:"manager",createdByName:"Менеджер"},
      {id:2,name:"same_blogger",link:"https://www.instagram.com/same_blogger?ref=duplicate",createdAt:"2026-09-02T10:00:00Z",createdByRole:"assistant",createdByName:"Ассистент"},
      {id:3,name:"@another",link:"https://instagram.com/another",createdAt:"2026-09-03T10:00:00Z",createdByRole:"assistant",createdByName:"Ассистент"},
    ],
    createdTimestamp:item => Date.parse(item.createdAt || "") || 0,
  };
  vm.createContext(context);
  ["normalizeBloggerIdentity","bloggerIdentityAliases","groupedKpiBloggers"].forEach(name => vm.runInContext(extractFunction(name),context));
  const grouped = context.groupedKpiBloggers();
  assert.equal(grouped.length,2);
  const duplicate = grouped.find(item => item._identityAliases.includes("same_blogger"));
  assert.deepEqual(Array.from(duplicate._kpiDuplicateIds),["1","2"]);
  assert.equal(duplicate.id,1);
  assert.equal(duplicate.createdByRole,"manager");
});

test("monthly fact delegates to auditable placement rows without adding guarantees",() => {
  const expected = {direction:"ЛН",exits:4,guaranteed:330,reach:340,clicks:25,leads:7,sales:2,revenue:1050,costs:270,source:"Проверяемые строки размещений и связанные отчёты",bloggers:2};
  const context = {Object,Number,String,Math,reachAuditFact:(month,options) => {
    assert.equal(month,"2026-08");
    assert.equal(options.direction,"ЛН");
    return expected;
  }};
  const summarize = runFunction("canonicalMonthlyExitFact",context);
  assert.deepEqual(summarize("2026-08",{direction:"ЛН"}),expected);
});

test("reach audit keeps every placement row and separates guarantee from entered fact",() => {
  const context = {Object,Number};
  const summarize = runFunction("reachAuditSummary",context);
  const result = summarize([
    {occurred:true,factReach:100,verifiedReach:100,verifiedReports:[{}],isVerified:true,guarantee:80,identity:"same",placementId:"1"},
    {occurred:true,factReach:120,verifiedReach:0,verifiedReports:[],isVerified:false,guarantee:100,identity:"same",placementId:"2"},
    {occurred:true,factReach:0,verifiedReach:0,verifiedReports:[],isVerified:false,guarantee:90,identity:"same",placementId:"3"},
  ]);
  assert.equal(result.planned,3);
  assert.equal(result.occurred,3);
  assert.equal(result.missing,1);
  assert.equal(result.unverified,1);
  assert.equal(result.verified,1);
  assert.equal(result.guaranteed,270);
  assert.equal(result.reach,220);
  assert.equal(result.verifiedReach,100);
});

test("evidence confirmation CORS and placement links are enabled",() => {
  assert.match(apiSource,/access-control-allow-methods[^\n]+PATCH/);
  assert.match(apiSource,/blogger_evidence_placement_links/);
  assert.match(source,/synchronizedPlacementCache = distinctPlacementRowsById\(additions\.concat\(rows\)\)/);
  assert.match(source,/Выберите конкретное размещение для этого отчёта/);
});

test("one reach report applies to one exact placement in every matching project",() => {
  const placements = [
    {id:"ln-1",project:"ЛН"},
    {id:"fit-1",project:"FIT PRO"},
  ];
  const context = {
    Array,Object,String,
    reachAuditPlacementCandidates:() => placements,
    reachAuditPlacementKey:item => `placement:${item.id}`,
    placementDirection:item => item.project,
  };
  vm.createContext(context);
  vm.runInContext(extractFunction("reachAuditReportPlacementKeys"),context);
  assert.deepEqual(Array.from(context.reachAuditReportPlacementKeys({blogger:"@any_blogger"})),[
    "placement:ln-1",
    "placement:fit-1",
  ]);
  placements.push({id:"ln-2",project:"ЛН"});
  assert.deepEqual(Array.from(context.reachAuditReportPlacementKeys({blogger:"@any_blogger"})),[]);
  assert.doesNotMatch(extractFunction("reachAuditReportPlacementKeys"),/fitby_zlata/);
});

function reachAuditRuntime(placements,reports) {
  let normalizations = 0;
  const context = {
    evidenceReports:reports,
    normalizeBloggerIdentity:value => { normalizations += 1; return String(value || "").toLowerCase().replace(/^@/,""); },
    ensureBloggerLookupIndex:() => ({byIdentity:{alias:[{aliases:["alias","original"]}]}}),
    bloggerIdentityAliases:blogger => blogger.aliases,
    synchronizedPlacementRecords:() => placements,
    placementIsoDate:item => item.date,
    placementDirection:item => item.project,
    placementOverrideKey:item => String(item.id),
    effectivePlacementActual:item => item.actual == null ? null : item.actual,
    localTodayIso:() => "2026-10-06",
    monthFromDateValue:value => value.slice(0,7),
    employeeNameMatches:(expected,actual) => expected === actual,
  };
  vm.createContext(context);
  ["reachAuditPlacementKey","reachAuditCandidateIndex","reachAuditPlacementCandidates","reachAuditReportPlacementKeys","reachAuditReportsForPlacement","reachAuditRow","reachAuditRows"].forEach(name => vm.runInContext(extractFunction(name),context));
  return {context,normalizations:() => normalizations};
}

test("indexed report links preserve aliases, placement order and ambiguous same-day integrations",() => {
  const placements = [
    {id:"1",tag:"original",date:"2026-09-01",project:"ЛН"},
    {id:"2",tag:"alias",date:"2026-09-01",project:"FIT PRO"},
    {id:"3",tag:"original",date:"2026-09-02",project:"ЛН"},
  ];
  const {context} = reachAuditRuntime(placements,[]);
  const report = {blogger:"@alias",date:"2026-09-01"};
  const index = context.reachAuditCandidateIndex(placements);
  assert.deepEqual(Array.from(context.reachAuditPlacementCandidates(report,index)),placements.slice(0,2));
  assert.deepEqual(Array.from(context.reachAuditReportPlacementKeys(report,index)),["1","2"]);
  placements.push({id:"4",tag:"original",date:"2026-09-01",project:"ЛН"});
  assert.deepEqual(Array.from(context.reachAuditReportPlacementKeys(report,context.reachAuditCandidateIndex(placements))),[]);
});

test("indexed reach calculations match legacy row results and immediately see report edits",() => {
  const placements = Array.from({length:30},(_,i) => ({id:String(i),tag:`blogger${i}`,date:"2026-09-01",project:i % 2 ? "FIT PRO" : "ЛН",manager:"Manager",guaranteed:1000,actual:i % 3 ? 500 : null}));
  const reports = Array.from({length:20},(_,i) => ({blogger:`blogger${i}`,date:"2026-09-01",reach:600,status:i % 2 ? "На проверке" : "Подтверждено"}));
  reports.push({placementKeys:["1","1"],reach:700,status:"Подтверждено"});
  const {context} = reachAuditRuntime(placements,reports);
  const naive = placements.map(item => context.reachAuditRow(item));
  assert.equal(JSON.stringify(context.reachAuditRows({month:"2026-09"})),JSON.stringify(naive));
  reports[1].reach = 900;
  reports[1].status = "Подтверждено";
  const changed = context.reachAuditRows({month:"2026-09"}).find(row => row.placementId === "1");
  assert.equal(changed.factReach,900);
  assert.equal(changed.isVerified,true);
  reports[1].placementKeys = ["2"];
  assert.equal(context.reachAuditRows({month:"2026-09"}).find(row => row.placementId === "2").factReach,900);
});

test("large reach register resolves each report once and retains both-project attribution",() => {
  const placements = Array.from({length:1000},(_,i) => ({id:String(i),tag:`blogger${i}`,date:"2026-09-01",project:"ЛН",guaranteed:1000,actual:500}));
  const reports = Array.from({length:299},(_,i) => ({blogger:`blogger${i}`,date:"2026-09-01",reach:600,status:"Подтверждено"}));
  reports[0].placementKeys = ["0"];
  reports[0].placementLinks = [{placementKey:"0",project:"Оба"}];
  const runtime = reachAuditRuntime(placements,reports);
  const rows = runtime.context.reachAuditRows({month:"2026-09"});
  assert.equal(rows.length,1001);
  assert.ok(runtime.normalizations() <= 2300,`normalizations: ${runtime.normalizations()}`);
  const both = rows.filter(row => row.placementId === "0");
  assert.deepEqual(Array.from(both,row => row.project),["ЛН","FIT PRO"]);
  assert.ok(both.every(row => row.factReach === 600 && row.guarantee === 1000));
});

test("evidence blogger search tolerates one typo and keeps unlinked reports saveable",() => {
  const context = {String,Math,Array,normalizeBloggerIdentity:value => String(value || "").trim().toLowerCase().replace(/^@/,"")};
  vm.createContext(context);
  vm.runInContext(extractFunction("bloggerIdentityDistance"),context);
  assert.equal(context.bloggerIdentityDistance("@viktoriyayok7","@viktoriyaok7"),1);
  assert.equal(context.bloggerIdentityDistance("@viktoriyaok7","@viktoriyaok7"),0);
  assert.match(extractFunction("updateEvidenceBloggerSearch"),/distance <= 1/);
  assert.match(source,/размещение не найдено\. Отчёт сохранится без связи/);
  assert.match(source,/!placementLinks\.length && placementSelect && placementSelect\.options\.length/);
});

test("evidence placement lookup handles aliases and card IDs without joining different dates",() => {
  const card = {id:7,name:"@new_name",_identityAliases:["old_name"]};
  const placements = [
    {id:1,tag:"old_name",date:"2026-10-01"},
    {id:2,bloggerId:"7",tag:"different",date:"2026-10-01"},
    {id:3,sourceKey:"legacy",bloggerLink:"https://instagram.com/new_name/",date:"2026-10-01"},
    {id:4,tag:"new_name",date:"2026-10-02"},
    {id:5,tag:"unrelated",date:"2026-10-01"},
  ];
  const context = {String,Array,ensureBloggerLookupIndex:()=>({byIdentity:{new_name:[card]}}),
    synchronizedPlacementRecords:()=>placements,placementIsoDate:item=>item.date};
  vm.createContext(context);
  ["normalizeBloggerIdentity","bloggerIdentityAliases","placementMatchesBlogger","evidencePlacementCandidates"].forEach(name=>vm.runInContext(extractFunction(name),context));
  assert.deepEqual(Array.from(context.evidencePlacementCandidates("@new_name","2026-10-01"),item=>item.id),[1,2,3]);
  assert.equal(context.evidencePlacementCandidates("@new_name","").length,0);
});

test("empty evidence placement choices do not block form validation and become required when populated",() => {
  let candidates = [];
  const select = {options:[],required:true,disabled:false};
  Object.defineProperty(select,"innerHTML",{set:html=>{select.options=Array.from(html.matchAll(/value="([^"]*)" data-project="([^"]*)"/g),match=>({value:match[1],dataset:{project:match[2]},selected:false}));}});
  Object.defineProperty(select,"selectedOptions",{get:()=>select.options.filter(option=>option.selected)});
  const nodes = {evidencePlacementKeys:select,evidenceBlogger:{value:"@blogger"},evidenceDate:{value:"2026-10-01"},evidencePlacementMeta:{textContent:""}};
  const update = runFunction("updateEvidencePlacementChoices",{Array,Object,Math,
    document:{getElementById:id=>nodes[id]},ensureEvidencePlacementUi(){},
    evidencePlacementCandidates:()=>candidates,reachAuditPlacementKey:item=>String(item.id),
    safeText:String,displayIsoDate:value=>value,placementIsoDate:item=>item.date,
    placementDirection:item=>item.project,number:String});
  update();
  assert.equal(select.required,false);
  assert.equal(select.disabled,true);
  assert.match(nodes.evidencePlacementMeta.textContent,/сохранится без связи/);
  candidates=[{id:1,date:"2026-10-01",project:"ЛН"}];
  update();
  assert.equal(select.required,true);
  assert.equal(select.disabled,false);
  assert.equal(select.selectedOptions[0].value,"1");
  candidates.push({id:2,date:"2026-10-01",project:"ЛН"});
  update();
  assert.deepEqual(select.selectedOptions.map(option=>option.value),["1"]);
  candidates=[];
  update();
  assert.equal(select.required,false);
  assert.equal(select.selectedOptions.length,0);
  assert.doesNotMatch(extractFunction("ensureEvidencePlacementUi"),/size="5" required/);
});

test("indexed KPI sources match full scans and retain separate same-day placements",() => {
  const blogger = {id:7,name:"@new_name",_identityAliases:["old_name"]};
  const placements = [
    {id:1,tag:"old_name",sortDate:"2026-09-01",actual:100,manager:"Manager"},
    {id:2,bloggerId:"7",sortDate:"2026-09-01",actual:200},
    {id:3,tag:"other",sortDate:"2026-08-01",actual:9000},
  ];
  const reports = [{blogger:"@old_name",date:"2026-09-01",reach:300,status:"Подтверждено",images:["proof"]}];
  const context = {String,Array,Object,Number,Math,MAX_BLOGGER_REACH:1000000000,
    evidenceReports:reports,synchronizedPlacementRecords:()=>placements,
    placementIsoDate:item=>item.sortDate,placementFormatActuals:{},
    placementOverrideKey:item=>String(item.id),effectivePlacementActual:item=>item.actual,dailyDateLabel:String};
  vm.createContext(context);
  ["normalizeBloggerIdentity","bloggerIdentityAliases","placementMatchesBlogger","kpiExitSourceIndex","indexedKpiExitSources","confirmedKpiExitForBlogger"].forEach(name=>vm.runInContext(extractFunction(name),context));
  const indexed = ()=>({reports:context.indexedKpiExitSources(blogger,context.kpiExitSourceIndex(reports,true)),placements:context.indexedKpiExitSources(blogger,context.kpiExitSourceIndex(placements,false))});
  assert.deepEqual(Array.from(indexed().placements,item=>item.id),[1,2]);
  assert.deepEqual(context.confirmedKpiExitForBlogger(blogger,indexed()),context.confirmedKpiExitForBlogger(blogger));
  reports[0].status="На проверке";
  assert.deepEqual(context.confirmedKpiExitForBlogger(blogger,indexed()),context.confirmedKpiExitForBlogger(blogger));
  assert.equal(context.confirmedKpiExitForBlogger(blogger,indexed()).eligible,false);
});

test("finance uses the two project sheets for clicks, costs and ROI",() => {
  const facts = {"ЛН":{exits:2,clicks:20},"FIT PRO":{exits:1,clicks:10}};
  const context = {
    Object,Number,String,Math,
    dashboardReportDates:() => [],activeEmployeeManagers:() => [],activeEmployeeAssistants:() => [],
    managerOutreachSummary:() => ({monthPlan:0,monthFact:0}),assistantOutreachSummary:() => ({monthPlan:0,monthFact:0}),
    monthlyDepartmentPlanSetting:() => ({outreachMonth:9000}),
    synchronizedPlacementRecords:() => [
      {direction:"ЛН",sortDate:"2026-08-10",cost:999999},
      {direction:"FIT PRO",sortDate:"2026-08-11",cost:888888},
    ],
    placementDirection:item => item.direction,monthFromDateValue:value => String(value || "").slice(0,7),bloggers:[],
    monthlyDirectionFact:(month,direction) => facts[direction],
  };
  ["programOutreachMetric","programDirectionCostMetric","officialDirectionOverrideMetric","attachProgramFinanceMetrics"].forEach(name => {
    vm.createContext(context);
    vm.runInContext(extractFunction(name),context);
  });
  const data = {current:{month:"2026-08",directions:{
    ln:{metrics:{clicks:{fact:1962},sales:{fact:19},revenue:{fact:1012022},costs:{fact:360220},paidBudget:{fact:241840}}},
    fit:{metrics:{clicks:{fact:537},sales:{fact:7},revenue:{fact:1000},costs:{fact:null},paidBudget:{fact:0}}},
  },combined:{metrics:{clicks:{fact:999},sales:{fact:26},revenue:{fact:1013022},costs:{fact:360220},paidBudget:{fact:241840}}}}};
  context.attachProgramFinanceMetrics(data);
  assert.equal(data.current.directions.ln.metrics.clicks.fact,1962);
  assert.equal(data.current.directions.fit.metrics.clicks.fact,537);
  assert.equal(data.current.combined.metrics.clicks.fact,2499);
  assert.equal(data.current.directions.ln.metrics.costs.fact,360220);
  assert.equal(data.current.directions.ln.metrics.roi.fact,(1012022-360220)/360220*100);
  assert.equal(data.current.directions.fit.metrics.sales.fact,1);
  assert.equal(data.current.directions.fit.metrics.revenue.fact,39900);
  assert.equal(data.current.directions.fit.metrics.costs.fact,null);
  assert.equal(data.current.directions.fit.metrics.roi.fact,null);
  assert.equal(data.current.combined.metrics.sales.fact,20);
  assert.equal(data.current.combined.metrics.revenue.fact,1051922);
  assert.equal(data.current.combined.metrics.costs.fact,360220);
  assert.equal(data.current.combined.metrics.roi.fact,(1051922-360220)/360220*100);
});

test("manual CRM finance values override imports and combined efficiency uses summed costs",() => {
  const context = {
    Object,Number,String,Math,
    dashboardReportDates:() => [],activeEmployeeManagers:() => [],activeEmployeeAssistants:() => [],
    managerOutreachSummary:() => ({monthPlan:0,monthFact:0}),assistantOutreachSummary:() => ({monthPlan:0,monthFact:0}),
    monthlyDepartmentPlanSetting:() => ({outreachMonth:0}),
    synchronizedPlacementRecords:() => [],placementDirection:() => "ЛН",monthFromDateValue:() => "",bloggers:[],
    monthlyDirectionFact:() => ({exits:999}),
  };
  ["programOutreachMetric","programDirectionCostMetric","officialDirectionOverrideMetric","attachProgramFinanceMetrics"].forEach(name => {
    vm.createContext(context);
    vm.runInContext(extractFunction(name),context);
  });
  function metric(fact) { return {plan:null,fact,manual:true,source:"CRM"}; }
  const data = {current:{month:"2026-09",directions:{
    ln:{metrics:{exits:metric(2),clicks:metric(100),revenue:metric(5000),costs:metric(1000),paidBudget:metric(500)}},
    fit:{metrics:{exits:metric(3),clicks:metric(200),revenue:metric(3000),costs:metric(1000),paidBudget:metric(500)}},
  },combined:{metrics:{exits:metric(5),clicks:metric(300),revenue:metric(8000),costs:metric(2000),paidBudget:metric(1000)}}}};
  context.attachProgramFinanceMetrics(data);
  assert.equal(data.current.directions.ln.metrics.exits.fact,2);
  assert.equal(data.current.directions.fit.metrics.clicks.fact,200);
  assert.equal(data.current.combined.metrics.revenue.fact,8000);
  assert.equal(data.current.combined.metrics.costs.fact,2000);
  assert.equal(data.current.combined.metrics.roi.fact,300);
  assert.equal(data.current.combined.metrics.romi.fact,700);
});

test("FIT PRO uses the confirmed August sale in every summary",() => {
  const context = {
    Object,Number,String,Math,
    currentFinanceData:{current:{month:"2026-08",directions:{fit:{metrics:{clicks:{fact:537},leads:{fact:5},sales:{fact:1},revenue:{fact:39900}}}}}},
    monthlyDepartmentPlanSetting:() => ({}),
  };
  ["financeEntryForMonth","officialDirectionOverrideMetric","officialDirectionMetric","applyOfficialDirectionMetrics","placementOfficialRevenue"].forEach(name => {
    vm.createContext(context);
    vm.runInContext(extractFunction(name),context);
  });
  const direction = context.applyOfficialDirectionMetrics({direction:"FIT PRO",clicks:1,leads:1,sales:1,revenue:1,source:"Выходы"},"2026-08");
  assert.equal(direction.clicks,537);
  assert.equal(direction.leads,5);
  assert.equal(direction.sales,1);
  assert.equal(direction.revenue,39900);
  assert.equal(context.placementOfficialRevenue("2026-08","FIT PRO"),39900);
  assert.equal(context.officialDirectionOverrideMetric("2026-07","FIT PRO","revenue"),null);
  assert.match(direction.source,/Google Sheets/);
});

test("confirmed manager KPI reach is tied to exit dates inside the blogger creation month",() => {
  const blogger = {id:1,name:"@new_blogger"};
  const context = {
    Object,Number,String,Math,MAX_BLOGGER_REACH:1000000000,
    synchronizedPlacementRecords:() => [
      {id:10,tag:"@new_blogger",sortDate:"2026-08-20",actual:2500},
      {id:11,tag:"@new_blogger",sortDate:"2026-09-01",actual:9000},
      {id:12,tag:"@other",sortDate:"2026-08-20",actual:7000},
    ],
    placementMatchesBlogger:(item) => item.tag === "@new_blogger",
    monthFromDateValue:value => String(value || "").slice(0,7),
    placementIsoDate:item => item.sortDate,
    placementFormatActuals:{},
    placementOverrideKey:item => String(item.id),
    effectivePlacementActual:item => item.actual,
    dailyDateLabel:value => value,
    evidenceReports:[
      {blogger:"@new_blogger",date:"2026-08-20",reach:3000,status:"Подтверждено",images:["proof"]},
      {blogger:"@new_blogger",date:"2026-08-25",reach:500,status:"Подтверждено",images:["proof"]},
      {blogger:"@new_blogger",date:"2026-09-01",reach:10000,status:"Подтверждено",images:["proof"]},
    ],
  };
  const result = runFunction("confirmedKpiExitForBlogger",context)(blogger,"2026-08");
  assert.equal(result.eligible,true);
  assert.equal(result.factReach,3000);
  assert.deepEqual(JSON.parse(JSON.stringify(result.dates)),["2026-08-20"]);
});

test("all bloggers created in the month are present in KPI and a manual row only refines data",() => {
  const context = {
    Object,Number,String,Math,
    bloggers:[
      {id:1,name:"one",display:"One",createdAt:"2026-08-02T10:00:00Z",manager:"Manager",reach:100,createdByName:"Assistant",createdByRole:"assistant"},
      {id:2,name:"two",display:"Two",createdAt:"2026-08-03T10:00:00Z",manager:"Manager",reach:200,createdByName:"Manager",createdByRole:"manager"},
      {id:3,name:"old",display:"Old",createdAt:"2026-07-03T10:00:00Z",manager:"Manager",reach:300},
    ],
    monthFromDateValue:value => String(value || "").slice(0,7),
    groupedKpiBloggers:() => context.bloggers,
    evidenceReports:[],synchronizedPlacementRecords:()=>[],
    normalizeBloggerIdentity:value => String(value || "").toLowerCase().replace(/^@/,""),
    bloggerIdentityAliases:blogger => [blogger.name],
    confirmedKpiExitForBlogger:blogger => blogger.id === 1 ? {eligible:true,factReach:1200,date:"2026-08-20",dates:["2026-08-20"],manager:"Manager",reason:"Подтверждено"} : {eligible:false,factReach:0,date:"",dates:[],manager:"",reason:"Ожидается"},
    dailyDateLabel:value => value,
    kpiMonthBloggers:[{month:"2026-08",bloggerKey:"1",bloggerName:"One",manager:"Manager",factReach:150,note:"checked"}],
  };
  ["kpiExitSourceIndex","indexedKpiExitSources","newBloggersForMonth","automaticKpiMonthBloggers","resolvedKpiMonthBloggers"].forEach(name => {
    vm.createContext(context);
    vm.runInContext(extractFunction(name),context);
  });
  const records = context.resolvedKpiMonthBloggers("2026-08").sort((a,b) => a.bloggerKey.localeCompare(b.bloggerKey));
  assert.equal(records.length,2);
  assert.equal(records[0].factReach,1200);
  assert.equal(records[0].managerFactReach,1200);
  assert.equal(records[0].managerEligible,true);
  assert.equal(records[0].assistant,"Assistant");
  assert.equal(records[0].automatic,true);
  assert.equal(records[1].bloggerName,"Two");
});

test("assistant outreach in leader profile uses fact field",() => {
  const context = {
    Object,Number,String,Math,
    monthlyDirectionFact:() => ({exits:0,reach:0}),
    dailyManagerReports:{"2026-08-01":{Manager:{outreach:100,approvals:1}}},
    dailyAssistantReports:{"2026-08-01":{Assistant:{fact:200,outreach:999,approvals:2}}},
  };
  const activity = runFunction("leaderMonthActivity",context)("2026-08");
  assert.equal(activity.outreach,300);
  assert.equal(activity.approvals,3);
});

test("daily reports wait for shared database confirmation and the current month rolls over automatically",() => {
  assert.match(apiSource,/const staleActiveMonths = \(data \|\| \[\]\)\.filter/);
  assert.match(apiSource,/if \(!hasCurrentMonth\)/);
  assert.match(apiSource,/month_key: currentMonth, status: "active"/);
  assert.match(apiSource,/status: "archived", closed_at: new Date\(\)\.toISOString\(\)/);
  assert.match(source,/return latest && latest\.month > current \? latest\.month : current/);
  assert.match(source,/persistSharedStateRecords\(\[sharedStateRecord\("manager_report"/);
  assert.match(source,/persistSharedStateRecords\(\[sharedStateRecord\("assistant_report"/);
  assert.match(source,/сохранён в общей базе/);
});

test("batch placement creation waits for shared persistence before updating registers",() => {
  const save = extractFunction("submitPlacementCreator");
  assert.ok(save.indexOf("persistSharedStateRecords(records.map(sharedPlacementRecord))") < save.indexOf("customPlacementRecords.unshift(record)"));
  assert.match(save,/placementCreationDraft\.saved = true/);
  assert.match(save,/placementMonthFilter\.value = recordMonth/);
  assert.match(save,/monthFilter\.value = recordMonth/);
});

function placementBatchRuntime() {
  const values = {newPlacementMode:"batch",newPlacementDate:"2026-10-06",newPlacementReelsDate:"2026-10-08",newPlacementCarouselDate:"2026-10-10",newPlacementFormat:"Telegram",newPlacementBlogger:"7",newPlacementCost:"15000",newPlacementDirection:"Оба",newPlacementDecision:"На оценке",newPlacementManager:"Manager",newPlacementDealType:"Коммерция",newPlacementBrief:"Готово",newPlacementContract:"Подписан",newPlacementWarmupStart:"",newPlacementWarmupEnd:"",newPlacementComment:"Package"};
  const nodes = Object.fromEntries(Object.entries(values).map(([id,value])=>[id,{value}]));
  nodes.exitMonthFilter={value:"2026-09"}; nodes.placementMonthFilter={value:"2026-09"};
  const button={disabled:false,textContent:"Сохранить"};
  let resets=0;
  const form={querySelector:()=>button,reset:()=>resets++};
  const saves=[],schedules=[],toasts=[];
  const context={String,Number,Array,Object,Math,Date,Promise,console,
    document:{getElementById:id=>nodes[id],querySelectorAll:()=>[]},
    bloggers:[{id:7,name:"@blogger",display:"blogger",plannedReach:9000}],
    role:"manager",placementCreateOrigin:"calendar",placementCreationDraft:null,placementCreationPending:false,
    customPlacementRecords:[],placementRecords:[],weeklyExits:[],
    bloggerPlacementGuarantee:blogger=>blogger.plannedReach,shortIsoDate:String,
    sharedPlacementRecord:record=>({namespace:"placement",key:record.id,value:record}),
    persistSharedStateRecords:records=>{saves.push(records);return context.persist(records);},
    persist:()=>Promise.resolve(),persistPlacementSchedule:(record,start,end)=>{schedules.push({record,start,end});return Promise.resolve();},
    weeklyExitFromPlacement:record=>({sourcePlacementId:record.id}),
    invalidateDerivedData(){},refreshAllDerivedViews(){},closeLayers(){},navigate(){},
    monthFromDateValue:value=>value.slice(0,7),activeMonthLabel:String,
    sessionStorage:{setItem(){}},showToast:message=>toasts.push(message)};
  vm.createContext(context);
  ["placementCreatorEntries","validPlacementDate","buildPlacementBatch","submitPlacementCreator"].forEach(name=>vm.runInContext(extractFunction(name),context));
  return {context,nodes,button,saves,schedules,toasts,resets:()=>resets,submit:()=>context.submitPlacementCreator({preventDefault(){},target:form})};
}

test("one placement form creates three exact exits without multiplying package cost or guarantee",async () => {
  const runtime=placementBatchRuntime();
  let resolve;
  runtime.context.persist=()=>new Promise(done=>{resolve=done;});
  const pending=runtime.submit();
  assert.equal(runtime.saves.length,1);
  assert.equal(runtime.saves[0].length,3);
  assert.equal(runtime.context.placementRecords.length,0);
  assert.equal(runtime.button.disabled,true);
  runtime.submit();
  assert.equal(runtime.saves.length,1);
  resolve(); await pending;
  const records=runtime.saves[0].map(row=>row.value);
  assert.deepEqual(Array.from(records,item=>[item.type,item.sortDate]),[["Stories","2026-10-06"],["Reels","2026-10-08"],["Карусель / пост","2026-10-10"]]);
  assert.equal(new Set(records.map(item=>item.id)).size,3);
  assert.equal(records.reduce((sum,item)=>sum+item.cost,0),15000);
  assert.equal(records.reduce((sum,item)=>sum+item.guaranteed,0),9000);
  assert.ok(records.every(item=>item.actual===null && item.bloggerId==="7" && item.direction==="Оба"));
  assert.ok(records.every(item=>item.warmupStart==="2026-10-06" && item.warmupEnd==="2026-10-10"));
  assert.equal(runtime.context.weeklyExits.length,3);
  assert.equal(runtime.schedules.length,3);
  assert.equal(runtime.resets(),1);
  assert.equal(runtime.button.disabled,false);
  assert.equal(runtime.nodes.exitMonthFilter.value,"2026-10");
});

test("empty format sections are skipped and legacy single formats remain available",async () => {
  const runtime=placementBatchRuntime();
  runtime.nodes.newPlacementDate.value="";runtime.nodes.newPlacementCarouselDate.value="";
  await runtime.submit();
  assert.equal(runtime.saves[0].length,1);
  assert.equal(runtime.saves[0][0].value.type,"Reels");
  assert.equal(runtime.saves[0][0].value.guaranteed,9000);
  const single=placementBatchRuntime(); single.nodes.newPlacementMode.value="single";
  await single.submit();
  assert.equal(single.saves[0].length,1);
  assert.equal(single.saves[0][0].value.type,"Telegram");
});

test("failed batch saves keep entered values and retry the same IDs without local phantom exits",async () => {
  const runtime=placementBatchRuntime();
  runtime.context.persist=()=>Promise.reject(Error("Offline"));
  await runtime.submit();
  assert.equal(runtime.context.placementRecords.length,0);
  assert.equal(runtime.context.weeklyExits.length,0);
  assert.equal(runtime.resets(),0);
  assert.equal(runtime.button.disabled,false);
  runtime.context.persist=()=>Promise.resolve();
  await runtime.submit();
  assert.deepEqual(runtime.saves[1].map(item=>item.key),runtime.saves[0].map(item=>item.key));
  assert.equal(runtime.context.placementRecords.length,3);
});

test("invalid batch dates, missing exits and read-only roles never write; different months stay visible",async () => {
  for(const date of ["2026-02-30","bad"]){const runtime=placementBatchRuntime();runtime.nodes.newPlacementDate.value=date;await runtime.submit();assert.equal(runtime.saves.length,0);}
  const empty=placementBatchRuntime();["newPlacementDate","newPlacementReelsDate","newPlacementCarouselDate"].forEach(id=>empty.nodes[id].value="");await empty.submit();assert.equal(empty.saves.length,0);
  const analyst=placementBatchRuntime();analyst.context.role="analyst";await analyst.submit();assert.equal(analyst.saves.length,0);
  const mixed=placementBatchRuntime();mixed.nodes.newPlacementCarouselDate.value="2026-11-01";await mixed.submit();assert.equal(mixed.nodes.exitMonthFilter.value,"");assert.equal(mixed.context.placementRecords.length,3);
});

test("schedule failures retain all saved exits and do not ask users to recreate the package",async () => {
  const runtime=placementBatchRuntime();
  runtime.context.persistPlacementSchedule=()=>Promise.reject(Error("Schedule unavailable"));
  await runtime.submit();
  assert.equal(runtime.context.placementRecords.length,3);
  assert.equal(runtime.context.weeklyExits.length,3);
  assert.equal(runtime.saves.length,1);
  assert.equal(runtime.resets(),1);
  assert.match(runtime.toasts.at(-1),/выходы сохранены/);
});

test("future month compatibility patch keeps filters and warmup dates aligned",() => {
  assert.match(octoberPatch,/selectMonth\("placementMonthFilter",month\)/);
  assert.match(octoberPatch,/selectMonth\("exitMonthFilter",month\)/);
  assert.match(octoberPatch,/start\.value = date\.value/);
  assert.match(octoberPatch,/\},true\);/);
  assert.match(index,/october-exits-v124\.js\?v=131/);
  assert.match(serviceWorker,/october-exits-v124\.js/);
});

test("blogger directory opens the full base while placements and exits keep the active month",() => {
  assert.match(source,/if \(active && active\.month >= current\) return active\.month/);
  assert.match(source,/var keys = \[systemMonthKey\(\)\]\.concat/);
  assert.match(source,/refreshMonthFilters\(createdMonth\)/);
  assert.match(source,/id === "bloggerMonthFilter" \? \(wasReady \? previous : ""\)/);
  assert.match(source,/bloggerMonthFilter\.value = ""/);
  assert.match(bloggerBasePatch,/function showFullBloggerBase\(\)/);
  assert.match(bloggerBasePatch,/event\.isTrusted/);
  assert.match(bloggerBasePatch,/form\.addEventListener\("submit"/);
  assert.match(index,/blogger-base-v127\.js\?v=131/);
  assert.doesNotMatch(index,/october-bloggers-v125\.js/);
  assert.match(serviceWorker,/nsl-bloggers-github-v131-multi-exits/);
  assert.match(apiSource,/staleActiveMonths/);
  assert.match(apiSource,/\.in\("month_key", staleActiveMonths\)/);
});

test("blogger directory preserves every source card while KPI grouping stays separate",() => {
  assert.match(source,/bloggers = baseBloggers\.map\(function \(item\)/);
  assert.doesNotMatch(source,/bloggers\s*=\s*consolidateBloggerCards\(/);
  assert.match(source,/function groupedKpiBloggers\(\)/);
  assert.match(source,/function consolidateBloggerCards\(items\)/);
});

test("role actions stay available only to the matching employee role",() => {
  assert.match(source,/fillReportBtn"\)\.classList\.toggle\("hidden",role !== "leader" && role !== "manager"\)/);
  assert.match(source,/fillAssistantReportBtn"\)\.classList\.toggle\("hidden",role !== "leader" && role !== "assistant"\)/);
  assert.match(source,/var canEdit = role !== "analyst"/);
  assert.match(source,/function canEditActualReach\(\) \{\s*return \["leader","manager","assistant"\]/);
  assert.match(apiSource,/function writable\(role: string\) \{ return role === "leader" \|\| role === "manager" \|\| role === "assistant"; \}/);
  assert.match(apiSource,/sharedAdminOnly = new Set/);
  assert.match(bloggerBasePatch,/function applyRoleActions\(\)/);
  assert.match(bloggerBasePatch,/var canOperate = role === "leader" \|\| role === "manager" \|\| role === "assistant"/);
  assert.match(bloggerBasePatch,/button\.disabled = !canOperate/);
  assert.match(bloggerBasePatch,/managerReport\.disabled = role !== "leader" && role !== "manager"/);
  assert.match(bloggerBasePatch,/assistantReport\.disabled = role !== "leader" && role !== "assistant"/);
});

test("shared state loads every database page instead of stopping at the API row cap",() => {
  assert.match(apiSource,/async function readAllSharedStateRows/);
  assert.match(apiSource,/const pageSize = 500/);
  assert.match(apiSource,/\.range\(offset, offset \+ pageSize - 1\)/);
  assert.match(apiSource,/if \(page\.length < pageSize\) break/);
  assert.match(apiSource,/await readAllSharedStateRows\(admin, role, since\)/);
});

test("expired sessions recover once and startup renders are batched",() => {
  assert.match(source,/response\.status !== 401/);
  assert.match(source,/supabaseClient\.auth\.refreshSession\(\)/);
  assert.match(source,/apiSessionRefreshPromise\.then\(request\)/);
  assert.match(source,/function beginHydrationBatch\(\)/);
  assert.match(source,/function endHydrationBatch\(\)/);
  assert.match(source,/Promise\.allSettled\(tasks\)/);
});

test("blocking mobile layers are cleared and blogger ids remain stable",() => {
  assert.match(source,/function resetBlockingLayers\(\)/);
  assert.match(source,/window\.addEventListener\("pageshow",function \(\) \{ resetBlockingLayers\(\)/);
  assert.match(source,/function sameRecordId\(left,right\)/);
  assert.match(source,/var b = bloggers\.find\(function \(x\) \{ return sameRecordId\(x\.id,id\); \}\)/);
});

test("finance hydration is not requested for non-admin roles",() => {
  assert.match(extractFunction("hydrateFinanceCenter"),/if \(!canRenderFinance\) return Promise\.resolve\(null\)/);
});

test("every permanent button with an id is wired to an action",() => {
  let html = "";
  const bodyContext = {document:{body:{set innerHTML(value) { html = value; }}}};
  vm.createContext(bodyContext);
  vm.runInContext(bodySource,bodyContext);
  const buttonIds = Array.from(html.matchAll(/<button\b[^>]*\bid="([^"]+)"[^>]*>/g),match => match[1]);
  const formSubmitButtons = new Set(["loginSubmitBtn","saveEvidenceBtn","saveEmployeeBtn"]);
  const groupedButtons = new Set(["quickAddBtn"]);
  const missing = buttonIds.filter(id => {
    if (formSubmitButtons.has(id) || groupedButtons.has(id)) return false;
    return !source.includes('getElementById("' + id + '").addEventListener');
  });
  assert.deepEqual(missing,[]);
  assert.match(source,/document\.querySelectorAll\("\.add-blogger-btn,#quickAddBtn"\)/);
  assert.match(source,/document\.getElementById\("loginForm"\)\.addEventListener\("submit"/);
  assert.match(source,/document\.getElementById\("evidenceForm"\)\.addEventListener\("submit"/);
  assert.match(source,/document\.getElementById\("employeeForm"\)\.addEventListener\("submit"/);
});

test("outreach summaries calculate replies refusals approvals and response conversion by day and month",() => {
  const context = {
    Object,Number,String,Math,
    dailyManagerReports:{
      "2026-08-10":{Manager:{planOutreach:120,outreach:100,replies:10,refusals:4,approvals:2}},
      "2026-08-11":{Manager:{planOutreach:120,outreach:50,replies:5,refusals:2,approvals:1}},
    },
    dailyAssistantReports:{
      "2026-08-10":{Assistant:{manager:"Manager",plan:80,fact:40,replies:8,refusals:3,approvals:2}},
      "2026-08-11":{Assistant:{manager:"Manager",plan:80,fact:60,replies:12,refusals:4,approvals:3}},
    },
    employeeNamedRecord:(records,name) => records[name] || null,
    employeeMetricRecord:() => ({planOutreach:120}),
    rate:(numerator,denominator) => denominator > 0 ? numerator / denominator * 100 : 0,
  };
  const manager = runFunction("managerOutreachSummary",context)("Manager","2026-08","2026-08-10");
  assert.deepEqual(
    [manager.dayFact,manager.dayReplies,manager.dayRefusals,manager.dayApprovals,manager.dayResponseRate],
    [100,10,4,2,10]
  );
  assert.deepEqual(
    [manager.monthFact,manager.monthReplies,manager.monthRefusals,manager.monthApprovals,manager.monthResponseRate],
    [150,15,6,3,10]
  );
  const assistant = runFunction("assistantOutreachSummary",context)("Assistant","2026-08","2026-08-10");
  assert.deepEqual(
    [assistant.dayFact,assistant.dayReplies,assistant.dayRefusals,assistant.dayApprovals,assistant.dayResponseRate],
    [40,8,3,2,20]
  );
  assert.deepEqual(
    [assistant.monthFact,assistant.monthReplies,assistant.monthRefusals,assistant.monthApprovals,assistant.monthResponseRate],
    [100,20,7,5,20]
  );
  assert.match(source,/Конверсия в ответ за день/);
  assert.match(source,/Конверсия в ответ за месяц/);
  assert.match(source,/Согласованные блогеры/);
});

const salaryRules = {
  categories:{a:{min:1000,max:3000},b:{min:3000,max:5000},c:{min:5000,max:null}},
  bloggerAmounts:{manager:{a:500,b:2700,c:5000},assistant:{a:250,b:1350,c:2500}},
  managerReachPercentTiers:[
    {min:100,amount:20000},
    {min:90,amount:15000},
    {min:80,amount:10000},
    {min:70,amount:6000},
  ],
};

test("salary policy finds the four employees regardless of name order",() => {
  const context = {
    Object,Number,String,Math,
    SALARY_PROFILES:[
      {firstName:"Оксана",lastName:"Пичушкина",role:"manager",baseSalary:35000,contractDate:"2026-02-21"},
      {firstName:"Евгения",lastName:"Оржел",role:"manager",baseSalary:40000,contractDate:"2026-02-24"},
      {firstName:"Ольга",lastName:"Петухова",role:"manager",baseSalary:30000,contractDate:"2026-08-12"},
      {firstName:"Юлия",lastName:"Сударинова",role:"assistant",baseSalary:15000,contractDate:"2026-06-22"},
    ],
  };
  ["normalizedSalaryNameTokens","salaryProfileForName"].forEach(name => {
    vm.createContext(context);
    vm.runInContext(extractFunction(name),context);
  });
  assert.equal(context.salaryProfileForName("Пичушкина Оксана Анатольевна").baseSalary,35000);
  assert.equal(context.salaryProfileForName("Евгения Александровна Оржел").baseSalary,40000);
  assert.equal(context.salaryProfileForName("Петухова Ольга Владимировна").contractDate,"2026-08-12");
  assert.equal(context.salaryProfileForName("Сударинова Юлия Айваровна").role,"assistant");
});

test("blogger KPI boundaries use B from 3000 and C from 5000",() => {
  const context = {Object,Number,String,Math,SALARY_RULES:salaryRules};
  ["salaryBloggerCategory","salaryBloggerAmount","reachKpiAmount"].forEach(name => {
    vm.createContext(context);
    vm.runInContext(extractFunction(name),context);
  });
  assert.equal(context.salaryBloggerCategory(999),"");
  assert.equal(context.salaryBloggerCategory(1000),"a");
  assert.equal(context.salaryBloggerCategory(2999),"a");
  assert.equal(context.salaryBloggerCategory(3000),"b");
  assert.equal(context.salaryBloggerCategory(4999),"b");
  assert.equal(context.salaryBloggerCategory(5000),"c");
  assert.equal(context.salaryBloggerAmount("manager","b"),2700);
  assert.equal(context.salaryBloggerAmount("assistant","b"),1350);
  assert.equal(context.reachKpiAmount(69.99),0);
  assert.equal(context.reachKpiAmount(70),6000);
  assert.equal(context.reachKpiAmount(80),10000);
  assert.equal(context.reachKpiAmount(90),15000);
  assert.equal(context.reachKpiAmount(100),20000);
});

test("manager blogger KPI uses only new bloggers with confirmed exit reach inside the same calendar month",() => {
  const context = {
    Object,Number,String,Math,SALARY_RULES:salaryRules,
    resolvedKpiMonthBloggers:() => [
      {manager:"Manager",factReach:9000,managerFactReach:3500,managerEligible:true},
      {manager:"Manager",factReach:12000,managerFactReach:0,managerEligible:false},
      {manager:"Other",factReach:5000,managerFactReach:5000,managerEligible:true},
    ],
    employeeNameMatches:(expected,actual) => expected === actual,
    salaryProfileForName:() => null,
    normalizedSalaryNameTokens:value => String(value || "").toLowerCase().split(/\s+/),
  };
  ["salaryBloggerCategory","salaryBloggerAmount","salaryEmployeeNameMatches","bloggerKpiForEmployee"].forEach(name => {
    vm.createContext(context);
    vm.runInContext(extractFunction(name),context);
  });
  const result = context.bloggerKpiForEmployee("Manager","manager","2026-08");
  assert.deepEqual([result.a,result.b,result.c],[0,1,0]);
  assert.equal(result.factReach,3500);
  assert.equal(result.amount,2700);
  assert.equal(result.records,1);
});

test("manager KPI backend consolidates technical duplicate blogger cards",() => {
  assert.match(apiSource,/function kpiCardGroupKey\(cardKey: string, card: any\)/);
  assert.match(apiSource,/const consolidatedCards: Record<string, any> = \{\}/);
  assert.match(apiSource,/for \(const \[key, card\] of Object\.entries\(consolidatedCards\)\)/);
  assert.match(apiSource,/const managerFactReach = confirmedExitDates\.reduce/);
  assert.match(apiSource,/managerEligible: managerFactReach > 0/);
});

test("Sudarynova assistant KPI uses the August roster and assistant category amounts",() => {
  const setting = {base:0,sanctions:{"2026-08":0},manualReachKpi:{}};
  const context = {
    Object,Number,String,Math,SALARY_RULES:salaryRules,
    resolvedKpiMonthBloggers:() => [
      {assistant:"Сударинова Юлия",managerFactReach:7000,managerEligible:true},
      {assistant:"Сударинова Юлия",managerFactReach:13000,managerEligible:true},
      {assistant:"Сударинова Юлия",managerFactReach:5000,managerEligible:true},
      {assistant:"Сударинова Юлия",managerFactReach:2500,managerEligible:true},
      {assistant:"Сударинова Юлия",managerFactReach:40000,managerEligible:true},
      {assistant:"Сударинова Юлия",managerFactReach:5000,managerEligible:true},
      {assistant:"Сударинова Юлия",managerFactReach:1500,managerEligible:true},
      {assistant:"Сударинова Юлия",managerFactReach:0,managerEligible:true},
      {assistant:"Сударинова Юлия",managerFactReach:1000,managerEligible:true},
      {assistant:"Сударинова Юлия",managerFactReach:2000,managerEligible:true},
      {assistant:"Сударинова Юлия",managerFactReach:70,managerEligible:true},
      {assistant:"Другой ассистент",manager:"Оксана Пичушкина",managerFactReach:9000,managerEligible:true},
    ],
    employeeNameMatches:(expected,actual) => expected === actual,
    salaryProfileForName:() => ({firstName:"Юлия",lastName:"Сударинова"}),
    normalizedSalaryNameTokens:value => String(value || "").toLowerCase().split(/\s+/),
    salarySetting:() => setting,
    employeeByName:() => ({name:"Сударинова Юлия",baseSalary:15000}),
    effectiveEmployeeBaseSalary:() => 15000,
  };
  ["salaryBloggerCategory","salaryBloggerAmount","salaryEmployeeNameMatches","bloggerKpiForEmployee","calculateAssistantSalary"].forEach(name => {
    vm.createContext(context);
    vm.runInContext(extractFunction(name),context);
  });
  const result = context.calculateAssistantSalary("Сударинова Юлия Айваровна","2026-08");
  assert.deepEqual([result.a,result.b,result.c],[4,0,5]);
  assert.equal(result.pending,2);
  assert.equal(result.bloggerKpi,13500);
  assert.equal(result.totalKpi,13500);
  assert.equal(result.salary,28500);
  assert.match(apiSource,/from\("blogger_shared_state"\)/);
  assert.match(apiSource,/\["blogger_create", "blogger", "placement"\]/);
  assert.match(apiSource,/assistant: card\.createdByRole === "assistant"/);
});

test("manager reach KPI uses the individual monthly reach plan",() => {
  const context = {
    Object,Number,String,Math,SALARY_RULES:salaryRules,KPI_RULES:{planReach:999999},MAX_REACH_PER_FORMAT:100000000,
    kpiRowsForManager:() => [{actual:8000}],
    synchronizedPlacementRecords:() => [{manager:"Оксана Пичушкина",sortDate:"2026-08-10",actual:8000}],
    employeeNameMatches:(expected,actual) => expected === actual,
    kpiEvidenceForPlacement:() => false,
    bloggerKpiForEmployee:() => ({a:1,b:0,c:0,amount:500,confirmed:1,records:1}),
    salarySetting:() => ({base:0,sanctions:{},manualReachKpi:{}}),
    employeeByName:() => ({name:"Оксана Пичушкина",baseSalary:35000}),
    effectiveEmployeeBaseSalary:() => 35000,
    monthlyPlanSetting:() => ({reach:10000}),
  };
  ["reachKpiAmount","calculateManagerSalary"].forEach(name => {
    vm.createContext(context);
    vm.runInContext(extractFunction(name),context);
  });
  const result = context.calculateManagerSalary("Оксана Пичушкина","2026-08");
  assert.equal(result.reachPct,80);
  assert.equal(result.autoReachKpi,10000);
  assert.equal(result.salary,45500);
});


test("guaranteed reach on dashboard is the exact sum of canonical exit rows",() => {
  const placements = [
    {id:1,direction:"ЛН",manager:"Manager A"},
    {id:2,direction:"FIT PRO",manager:"Manager B"},
  ];
  const context = {
    Object,Number,String,Math,
    synchronizedPlacementRecords:() => placements,
    syncedWeeklyExits:() => [
      {id:"one",sourcePlacementId:1,sortDate:"2026-08-10",sourceKey:"blogger-a",format:"Reels",plannedReach:1000},
      {id:"one-stories",sourcePlacementId:1,sortDate:"2026-08-10",sourceKey:"blogger-a",format:"Stories",plannedReach:1200},
      {id:"two",sourcePlacementId:2,sortDate:"2026-08-11",sourceKey:"blogger-b",format:"Reels",plannedReach:2000},
    ],
    linkedBloggerForPlacement:() => null,
    placementDirection:item => item.direction,
    normalizeBloggerIdentity:value => String(value || "").toLowerCase(),
    employeeNameMatches:(expected,actual) => expected === actual,
  };
  const exitGuarantee = runFunction("monthlyExitGuarantee",context);
  assert.equal(exitGuarantee("2026-08","ЛН"),2200);
  assert.equal(exitGuarantee("2026-08","FIT PRO"),2000);
  assert.equal(exitGuarantee("2026-08",null,"Manager A"),2200);
  assert.equal(exitGuarantee("2026-08",null,"Manager B"),2000);

  context.canonicalMonthlyExitFact = () => ({guaranteed:11350});
  context.monthlyExitGuarantee = () => 560000;
  context.applyOfficialDirectionMetrics = item => item;
  const managerFact = runFunction("monthlyManagerFact",context);
  const directionFact = runFunction("monthlyDirectionFact",context);
  assert.equal(managerFact("Manager A","2026-08").guaranteed,11350);
  assert.equal(directionFact("2026-08","ЛН").guaranteed,11350);
});

test("all roles hydrate official Google Sheets metrics",() => {
  assert.match(source,/hydrateEvidenceReports\(\),hydrateFinanceCenter\(\)/);
  assert.match(source,/var fields = \["exits","reach","clicks","leads","sales","revenue"\]/);
});

test("deleted employees disappear from active CRM while work history remains",() => {
  const activeOnly = runFunction("activeSalaryEmployees",{
    employees:[
      {id:"active",name:"Active",status:"active"},
      {id:"deleted",name:"Deleted",status:"paused"},
    ],
  });
  assert.deepEqual(JSON.parse(JSON.stringify(activeOnly())),[{id:"active",name:"Active",status:"active"}]);

  const reportedNames = runFunction("reportedEmployeeNamesForMonth",{Object});
  assert.deepEqual(JSON.parse(JSON.stringify(reportedNames({
    "2026-08-10":{"Deleted Manager":{outreach:10}},
    "2026-07-10":{"Old Month":{outreach:99}},
  },"2026-08"))),["Deleted Manager"]);

  const activity = runFunction("leaderMonthActivity",{
    Object,Number,
    monthlyDirectionFact:(month,direction) => direction === "ЛН" ? {exits:2,reach:1000} : {exits:1,reach:500},
    dailyManagerReports:{"2026-08-10":{"Deleted Manager":{outreach:10,approvals:2}}},
    dailyAssistantReports:{"2026-08-10":{"Deleted Assistant":{fact:5,approvals:1}}},
  });
  assert.deepEqual(JSON.parse(JSON.stringify(activity("2026-08"))),{
    outreach:15,exits:3,reach:1500,approvals:3,transferred:0,source:"ЛН + FIT PRO · единый факт из таблиц",
  });

  assert.match(source,/var visibleEmployees = activeSalaryEmployees\(\)/);
  assert.doesNotMatch(source,/grid\.innerHTML = employees\.map/);
  assert.match(source,/data\.employee \|\| employee,\{status:"paused",accessStatus:"revoked"\}/);
  assert.match(source,/история работы сохранена/);
});

test("employee profile shows selected month and all-time totals",() => {
  const bloggersFixture = [
    {id:1,manager:"Manager",createdAt:"2026-08-02",createdByRole:"manager",createdByName:"Manager"},
    {id:2,manager:"Manager",createdAt:"2026-07-02",createdByRole:"assistant",createdByName:"Assistant"},
    {id:3,manager:"Other",createdAt:"2026-08-03",createdByRole:"assistant",createdByName:"Assistant"},
  ];
  const profileBloggers = runFunction("employeeProfileBloggers",{
    bloggers:bloggersFixture,
    employeeNameMatches:(employee,value) => employee.name === value,
  });
  assert.equal(profileBloggers({name:"Manager",role:"manager"}).length,2);
  assert.equal(profileBloggers({name:"Assistant",role:"assistant"}).length,2);
  assert.equal(profileBloggers({name:"Admin",role:"leader"}).length,3);

  const totalActivity = runFunction("employeeTotalActivity",{
    employeeHistoryMonths:() => ["2026-08","2026-07"],
    employeeMonthActivity:(employee,month) => month === "2026-08"
      ? {outreach:10,exits:2,reach:1000,approvals:3,transferred:1}
      : {outreach:5,exits:1,reach:500,approvals:2,transferred:1},
  });
  assert.deepEqual(JSON.parse(JSON.stringify(totalActivity({name:"Manager",role:"manager"}))),{
    outreach:15,exits:3,reach:1500,approvals:5,transferred:2,
  });

  assert.match(source,/employeeProfileMonthFilter/);
  assert.match(source,/number\(item\.month\) \+ ' \/ ' \+ number\(item\.total\)/);
  assert.match(source,/за всё время/);
});
