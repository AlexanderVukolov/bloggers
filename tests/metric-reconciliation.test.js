const assert = require("node:assert/strict");
const fs = require("node:fs");
const test = require("node:test");
const vm = require("node:vm");

const source = fs.readFileSync(require("node:path").join(__dirname,"..","app-bundle-v88.js"),"utf8");

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

test("finance keeps sheet costs and recalculates exits, ROI and ROMI",() => {
  const facts = {"ЛН":{exits:2,clicks:20},"FIT PRO":{exits:1,clicks:10}};
  const context = {
    Object,Number,String,Math,
    dashboardReportDates:() => [],activeEmployeeManagers:() => [],activeEmployeeAssistants:() => [],
    managerOutreachSummary:() => ({monthPlan:0,monthFact:0}),assistantOutreachSummary:() => ({monthPlan:0,monthFact:0}),
    monthlyDepartmentPlanSetting:() => ({outreachMonth:9000}),
    synchronizedPlacementRecords:() => [],placementDirection:() => "ЛН",monthFromDateValue:() => "",bloggers:[],
    monthlyDirectionFact:(month,direction) => facts[direction],
  };
  ["programOutreachMetric","programDirectionCostMetric","attachProgramFinanceMetrics"].forEach(name => {
    vm.createContext(context);
    vm.runInContext(extractFunction(name),context);
  });
  const data = {current:{month:"2026-08",directions:{
    ln:{metrics:{revenue:{fact:3000},costs:{fact:1000},paidBudget:{fact:500}}},
    fit:{metrics:{revenue:{fact:1000},costs:{fact:500},paidBudget:{fact:250}}},
  },combined:{metrics:{revenue:{fact:4000},costs:{fact:1500},paidBudget:{fact:750}}}}};
  context.attachProgramFinanceMetrics(data);
  assert.equal(data.current.directions.ln.metrics.costs.fact,1000);
  assert.equal(data.current.directions.ln.metrics.exits.fact,2);
  assert.equal(data.current.directions.ln.metrics.roi.fact,200);
  assert.equal(data.current.directions.ln.metrics.romi.fact,500);
  assert.equal(data.current.combined.metrics.exits.fact,3);
  assert.equal(data.current.combined.metrics.costs.fact,1500);
  assert.equal(data.current.combined.metrics.roi.fact,(4000-1500)/1500*100);
});

test("dashboard direction uses leads, sales and revenue from the matching sheet",() => {
  const context = {
    Object,Number,String,Math,
    currentFinanceData:{current:{month:"2026-08",directions:{fit:{metrics:{leads:{fact:41},sales:{fact:7},revenue:{fact:910000}}}}}},
    monthlyDepartmentPlanSetting:() => ({}),
  };
  ["financeEntryForMonth","officialDirectionMetric","applyOfficialDirectionMetrics"].forEach(name => {
    vm.createContext(context);
    vm.runInContext(extractFunction(name),context);
  });
  const direction = context.applyOfficialDirectionMetrics({direction:"FIT PRO",leads:1,sales:1,revenue:1,source:"Выходы"},"2026-08");
  assert.equal(direction.leads,41);
  assert.equal(direction.sales,7);
  assert.equal(direction.revenue,910000);
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
