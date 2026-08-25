const assert = require("node:assert/strict");
const fs = require("node:fs");
const test = require("node:test");
const vm = require("node:vm");

const source = fs.readFileSync(require("node:path").join(__dirname,"..","app-bundle-v88.js"),"utf8");
const apiSource = fs.readFileSync(require("node:path").join(__dirname,"..","supabase","functions","bloggers-api","index.ts"),"utf8");

test("login remains compatible with existing eight-character passwords",() => {
  assert.match(source,/passwordInput\.minLength = 8/);
  assert.match(source,/password\.length < 8/);
  assert.doesNotMatch(source,/password\.length < 12/);
  assert.match(source,/Минимум 8 символов/);
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

test("one blogger and date count as one exit while distinct formats add reach",() => {
  const placements = [
    {id:1,sourceKey:"blogger",sortDate:"2026-08-10",direction:"ЛН",manager:"Менеджер",type:"Stories",actual:100,guaranteed:80,clicks:8,leads:3,sales:1,revenue:500,cost:100},
    {id:2,sourceKey:"blogger",sortDate:"2026-08-10",direction:"ЛН",manager:"Менеджер",type:"Stories",actual:120,guaranteed:100,clicks:10,leads:2,sales:1,revenue:400,cost:100},
    {id:3,sourceKey:"blogger",sortDate:"2026-08-10",direction:"ЛН",manager:"Менеджер",type:"Reels",actual:50,guaranteed:90,clicks:4,leads:1,sales:0,revenue:100,cost:50},
    {id:4,sourceKey:"second",sortDate:"2026-08-11",direction:"ЛН",manager:"Менеджер",type:"Stories",actual:70,guaranteed:60,clicks:3,leads:1,sales:0,revenue:50,cost:20},
  ];
  const context = {
    Object,Number,String,Math,
    MAX_REACH_PER_FORMAT:100000000,MAX_BLOGGER_REACH:1000000000,
    synchronizedPlacementRecords:() => placements,
    placementCountsAsExit:() => true,
    placementIsoDate:item => item.sortDate,
    monthFromDateValue:value => String(value || "").slice(0,7),
    placementDirection:item => item.direction,
    employeeNameMatches:(expected,actual) => expected === actual,
    normalizeBloggerIdentity:value => String(value || "").toLowerCase(),
    effectivePlacementActual:item => item.actual,
    effectivePlacementClicks:item => item.clicks,
    linkedBloggerForPlacement:() => null,
    ensureBloggerLookupIndex:() => ({byIdentity:{blogger:[{brand:"ЛН",manager:"Менеджер"}]}}),
    reelRecords:[],
    evidenceReports:[{blogger:"blogger",date:"2026-08-10",reach:200,clicks:12,status:"Подтверждено"}],
    bloggers:[],
  };
  const summarize = runFunction("canonicalMonthlyExitFact",context);
  const result = summarize("2026-08",{direction:"ЛН"});
  assert.deepEqual(JSON.parse(JSON.stringify(result)),{
    direction:"ЛН",exits:2,guaranteed:160,reach:270,clicks:15,leads:4,sales:1,revenue:550,costs:170,source:"Уникальные выходы и подтверждённые отчёты",bloggers:2,
  });
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

test("all bloggers created in the month are present in KPI and a manual row only refines data",() => {
  const context = {
    Object,Number,String,Math,
    bloggers:[
      {id:1,name:"one",display:"One",createdAt:"2026-08-02T10:00:00Z",manager:"Manager",reach:100,createdByName:"Assistant",createdByRole:"assistant"},
      {id:2,name:"two",display:"Two",createdAt:"2026-08-03T10:00:00Z",manager:"Manager",reach:200,createdByName:"Manager",createdByRole:"manager"},
      {id:3,name:"old",display:"Old",createdAt:"2026-07-03T10:00:00Z",manager:"Manager",reach:300},
    ],
    monthFromDateValue:value => String(value || "").slice(0,7),
    kpiMonthBloggers:[{month:"2026-08",bloggerKey:"1",bloggerName:"One",manager:"Manager",factReach:150,note:"checked"}],
  };
  ["newBloggersForMonth","automaticKpiMonthBloggers","resolvedKpiMonthBloggers"].forEach(name => {
    vm.createContext(context);
    vm.runInContext(extractFunction(name),context);
  });
  const records = context.resolvedKpiMonthBloggers("2026-08").sort((a,b) => a.bloggerKey.localeCompare(b.bloggerKey));
  assert.equal(records.length,2);
  assert.equal(records[0].factReach,150);
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

test("assistant salary automatically counts only bloggers assigned to the assistant",() => {
  const setting = {base:0,sanctions:{"2026-08":100},manualReachKpi:{}};
  const context = {
    Object,Number,String,Math,SALARY_RULES:salaryRules,
    resolvedKpiMonthBloggers:() => [
      {assistant:"Юлия Сударинова",manager:"Оксана Пичушкина",factReach:1000},
      {assistant:"Юлия Сударинова",manager:"Оксана Пичушкина",factReach:3000},
      {assistant:"Юлия Сударинова",manager:"Оксана Пичушкина",factReach:5000},
      {assistant:"Другой ассистент",manager:"Оксана Пичушкина",factReach:9000},
    ],
    employeeNameMatches:(expected,actual) => expected === actual,
    salarySetting:() => setting,
    employeeByName:() => ({name:"Юлия Сударинова",baseSalary:15000}),
    effectiveEmployeeBaseSalary:() => 15000,
  };
  ["salaryBloggerCategory","salaryBloggerAmount","bloggerKpiForEmployee","calculateAssistantSalary"].forEach(name => {
    vm.createContext(context);
    vm.runInContext(extractFunction(name),context);
  });
  const result = context.calculateAssistantSalary("Юлия Сударинова","2026-08");
  assert.deepEqual([result.a,result.b,result.c],[1,1,1]);
  assert.equal(result.bloggerKpi,4100);
  assert.equal(result.totalKpi,4000);
  assert.equal(result.salary,19000);
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
  assert.equal(managerFact("Manager A","2026-08").guaranteed,560000);
  assert.equal(directionFact("2026-08","ЛН").guaranteed,560000);
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
