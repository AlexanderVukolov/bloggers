import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.102.0";

const allowedOrigins = new Set([
  "https://alexandervukolov.github.io",
  "https://wmnymdmjiczbmjyztcze.supabase.co",
]);
const bucketId = "blogger-files";
const adminSummarySheetId = "17iw2lcrrR8OG3wlpzfwyq3VUalJQoLsY1ZzowgyklWc";
const adminSummarySheetGid = "2146185285";
const adminSummarySheetUrl = `https://docs.google.com/spreadsheets/d/${adminSummarySheetId}/edit`;
const adminSummaryManualNamespace = "admin_summary_month";
const adminSummaryCacheNamespace = "admin_summary_source";
const adminSummaryCacheKey = "sheet-v1";
const sharedNamespaces = new Set(["bootstrap_meta", "bootstrap_bloggers", "bootstrap_placements", "bootstrap_reels", "bootstrap_weekly_exits", "bootstrap_eugenia", "blogger", "blogger_create", "blogger_contract", "placement", "manager_report", "assistant_report", "monthly_plan", "placement_format", "manager_metrics", "placement_delete"]);
const sharedAdminOnly = new Set(["bootstrap_meta", "bootstrap_bloggers", "bootstrap_placements", "bootstrap_reels", "bootstrap_weekly_exits", "bootstrap_eugenia", "blogger", "monthly_plan", "manager_metrics", "placement_delete"]);

function corsHeaders(request: Request) {
  const origin = request.headers.get("origin") || "";
  const allowed = allowedOrigins.has(origin) ? origin : "null";
  return {
    "access-control-allow-origin": allowed,
    "access-control-allow-headers": "authorization, apikey, cache-control, content-type, x-client-info, x-nsl-role",
    "x-content-type-options": "nosniff",
    "referrer-policy": "no-referrer",
    "access-control-allow-methods": "GET, POST, DELETE, OPTIONS",
    "access-control-expose-headers": "content-disposition, content-type, content-length",
    "access-control-max-age": "86400",
    vary: "Origin",
  };
}

function json(request: Request, data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { ...corsHeaders(request), "content-type": "application/json; charset=utf-8", "cache-control": "no-store" } });
}

function appRole(profile: { is_admin?: boolean; role?: string | null }) {
  if (profile.is_admin) return "leader";
  const value = String(profile.role || "").toLowerCase();
  if (value.includes("ассистент") || value === "assistant") return "assistant";
  if (value.includes("аналитик") || value === "analyst") return "analyst";
  return "manager";
}

function profileRole(value: string) {
  return ({ leader: "Администратор", manager: "Менеджер", assistant: "Ассистент", analyst: "Аналитик" } as Record<string, string>)[value] || "Сотрудник";
}

function randomAccessToken() {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return [...bytes].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function employeePayload(row: any, role: string) {
  const inviteActive = Boolean(row.invite_expires_at && new Date(row.invite_expires_at).getTime() > Date.now());
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    role: row.role,
    assignedManager: row.assigned_manager,
    status: row.status,
    baseSalary: role === "leader" ? Number(row.base_salary || 0) : 0,
    historyAliases: Array.isArray(row.history_aliases) ? row.history_aliases : [],
    accessStatus: row.profile_id ? "connected" : inviteActive ? "invited" : "not_created",
    registeredAt: row.registered_at || "",
    inviteExpiresAt: inviteActive ? row.invite_expires_at : "",
    updatedAt: row.updated_at,
  };
}

function writable(role: string) { return role === "leader" || role === "manager" || role === "assistant"; }
function systemMonth() { const now = new Date(); return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`; }
function routePath(url: URL) {
  const marker = "/bloggers-api";
  const index = url.pathname.lastIndexOf(marker);
  return index >= 0 ? url.pathname.slice(index + marker.length) || "/" : url.pathname;
}
function safeFileName(value: unknown) { return String(value || "file").replace(/[\r\n/\\]/g, " ").slice(0, 180); }
async function sha256Hex(value: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function ensureBucket(admin: any) {
  const { data } = await admin.storage.getBucket(bucketId);
  if (!data) await admin.storage.createBucket(bucketId, { public: false, fileSizeLimit: 15728640, allowedMimeTypes: ["image/jpeg", "image/png", "image/webp", "application/pdf", "application/msword", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"] });
}

async function signedEvidenceReports(admin: any, rows: any[]) {
  return Promise.all(rows.map(async (row) => {
    const images = Array.isArray(row.images_json) ? row.images_json : [];
    const paths = images.map((image: any) => image.path).filter(Boolean);
    let urls: string[] = [];
    if (paths.length) {
      const { data } = await admin.storage.from(bucketId).createSignedUrls(paths, 600);
      urls = (data || []).map((item: any) => item.signedUrl).filter(Boolean);
    }
    return { id: row.id, blogger: row.blogger, date: row.exit_date, reach: Number(row.reach || 0), clicks: Number(row.clicks || 0), uploader: row.uploader, status: row.status || "Подтверждено", comment: row.comment || "", createdAt: row.created_at, images: urls };
  }));
}

function parseCsv(text: string) {
  const rows: string[][] = []; let row: string[] = []; let cell = ""; let quoted = false;
  for (let i = 0; i < text.length; i += 1) { const char = text[i]; if (quoted) { if (char === '"' && text[i + 1] === '"') { cell += '"'; i += 1; } else if (char === '"') quoted = false; else cell += char; } else if (char === '"') quoted = true; else if (char === ',') { row.push(cell); cell = ""; } else if (char === '\n') { row.push(cell.replace(/\r$/, "")); rows.push(row); row = []; cell = ""; } else cell += char; }
  if (cell || row.length) { row.push(cell.replace(/\r$/, "")); rows.push(row); } return rows;
}
function financeNumber(value: unknown) { const raw = String(value || "").replace(/[\s\u00a0₽]/g, "").replace("%", "").replace(",", "."); if (!raw) return null; const parsed = Number(raw); return Number.isFinite(parsed) ? parsed : null; }
const russianSummaryMonths: Record<string, string> = {
  "январь":"01", "января":"01", "февраль":"02", "февраля":"02", "март":"03", "марта":"03",
  "апрель":"04", "апреля":"04", "май":"05", "мая":"05", "июнь":"06", "июня":"06",
  "июль":"07", "июля":"07", "август":"08", "августа":"08", "сентябрь":"09", "сентября":"09",
  "октябрь":"10", "октября":"10", "ноябрь":"11", "ноября":"11", "декабрь":"12", "декабря":"12",
};
function adminSummaryMonthKey(value: unknown, fallbackYear: number) {
  const raw = String(value || "").trim().toLowerCase().replace(/ё/g, "е");
  const iso = raw.match(/\b(20\d{2})[-./](0?[1-9]|1[0-2])\b/);
  if (iso) return `${iso[1]}-${String(Number(iso[2])).padStart(2, "0")}`;
  const reversed = raw.match(/\b(0?[1-9]|1[0-2])[-./](20\d{2})\b/);
  if (reversed) return `${reversed[2]}-${String(Number(reversed[1])).padStart(2, "0")}`;
  const monthName = Object.keys(russianSummaryMonths).find((name) => raw.includes(name));
  if (!monthName) return "";
  const year = Number(raw.match(/\b(20\d{2})\b/)?.[1] || fallbackYear);
  return `${year}-${russianSummaryMonths[monthName]}`;
}
function normalizeAdminSummaryRow(value: any, source = "manual") {
  const month = String(value?.month || "");
  function amount(field: string) { const parsed = Number(value?.[field]); return Number.isFinite(parsed) && parsed >= 0 ? Math.round(parsed * 100) / 100 : 0; }
  const row = {
    month,
    advertisingCosts: amount("advertisingCosts"),
    payrollCosts: amount("payrollCosts"),
    revenue: amount("revenue"),
    barterRevenue: amount("barterRevenue"),
    commercialRevenue: amount("commercialRevenue"),
    source,
    updatedAt: String(value?.updatedAt || ""),
  };
  const totalCosts = row.advertisingCosts + row.payrollCosts;
  return {
    ...row,
    totalCosts,
    roi: totalCosts > 0 ? (row.revenue - totalCosts) / totalCosts * 100 : null,
    romi: row.advertisingCosts > 0 ? (row.revenue - row.advertisingCosts) / row.advertisingCosts * 100 : null,
  };
}
function parseAdminSummarySheet(text: string) {
  const rows = parseCsv(text);
  const titleText = rows.slice(0, 3).flat().join(" ");
  const fallbackYear = Number(titleText.match(/\b(20\d{2})\b/)?.[1] || new Date().getUTCFullYear());
  const headerIndex = rows.findIndex((row) => String(row[0] || "").toLowerCase().includes("месяц") && String(row[1] || "").toLowerCase().includes("расход"));
  if (headerIndex < 0) throw new Error("summary header not found");
  const byMonth: Record<string, any> = {};
  for (let index = headerIndex + 1; index < rows.length; index += 1) {
    const label = String(rows[index]?.[0] || "").trim();
    if (!label || /^итого/i.test(label)) break;
    const month = adminSummaryMonthKey(label, fallbackYear);
    if (!month) continue;
    byMonth[month] = normalizeAdminSummaryRow({
      month,
      advertisingCosts: financeNumber(rows[index]?.[1]) || 0,
      payrollCosts: financeNumber(rows[index]?.[2]) || 0,
      revenue: financeNumber(rows[index]?.[3]) || 0,
    }, "sheet");
  }
  const referenceHeaderIndex = rows.findIndex((row) => String(row[5] || "").trim().toLowerCase() === "месяц");
  if (referenceHeaderIndex >= 0) {
    for (let index = referenceHeaderIndex + 1; index < rows.length; index += 1) {
      const month = adminSummaryMonthKey(rows[index]?.[5], fallbackYear);
      if (!month || !byMonth[month]) continue;
      byMonth[month] = normalizeAdminSummaryRow({
        ...byMonth[month],
        barterRevenue: financeNumber(rows[index]?.[6]) || 0,
        commercialRevenue: financeNumber(rows[index]?.[7]) || 0,
      }, "sheet");
    }
  }
  return Object.values(byMonth).sort((a: any, b: any) => String(a.month).localeCompare(String(b.month)));
}
async function readAdminSummaryRecords(admin: any, namespace: string) {
  const { data, error } = await admin.from("blogger_shared_state").select("record_key,value_json,updated_at").eq("namespace", namespace).order("record_key");
  if (error) throw error;
  return data || [];
}
async function saveAdminSummaryCache(admin: any, rows: any[]) {
  const updatedAt = new Date().toISOString();
  await admin.from("blogger_shared_state").upsert({ namespace: adminSummaryCacheNamespace, record_key: adminSummaryCacheKey, value_json: { rows, updatedAt }, updated_at: updatedAt, updated_by: null });
  return updatedAt;
}
function financeMetricId(label: unknown) { const value = String(label || "").toLowerCase(); if (value.includes("платные интеграции")) return "paidIntegrations"; if (value.includes("платный бюджет")) return "paidBudget"; if (value === "охват") return "reach"; if (value === "клики") return "clicks"; if (value === "рассылки") return "outreach"; if (value.includes("квал")) return "qualifiedLeads"; if (value.includes("лиды")) return "leads"; if (value === "продажи") return "sales"; if (value.includes("выручка")) return "revenue"; if (value.includes("количество выходов")) return "exits"; if (value.startsWith("roi")) return "roi"; if (value.startsWith("romi")) return "romi"; if (value.startsWith("затраты")) return "costs"; return ""; }
function financeMonthKey(endDate: unknown) { const match = String(endDate || "").match(/^(\d{2})\.(\d{2})\.(\d{4})$/); return match ? `${match[3]}-${match[2]}` : ""; }
function parseFinanceSheet(csv: string, tab: any) { const rows = parseCsv(csv); const months: Record<string, any> = {}; let active = ""; for (const row of rows) { const month = financeMonthKey(row[1]); if (month) { active = month; months[active] = { month: active, direction: tab.key, title: tab.title, metrics: {} }; continue; } if (!active) continue; const id = financeMetricId(row[1]); if (!id || id === "outreach" || id === "costs") continue; const plan = financeNumber(row[2]); const fact = financeNumber(row[3]); const progress = financeNumber(row[4]); months[active].metrics[id] = { plan, fact, progress }; } return months; }
const financeMetricOrder = ["paidIntegrations", "paidBudget", "reach", "clicks", "outreach", "leads", "qualifiedLeads", "sales", "revenue", "exits", "roi", "romi", "costs"];
function combineFinanceMonth(month: string, directions: Record<string, any>) { const available = Object.values(directions).filter(Boolean) as any[]; const metrics: Record<string, any> = {}; for (const id of financeMetricOrder) { if (id === "roi" || id === "romi") continue; const values = available.map((item) => item.metrics[id]).filter(Boolean); const shared = id === "outreach"; const plans = values.map((item) => item.plan).filter((value) => value != null); const facts = values.map((item) => item.fact).filter((value) => value != null); const plan = plans.length ? (shared ? Math.max(...plans) : plans.reduce((sum, value) => sum + value, 0)) : null; const fact = facts.length ? (shared ? Math.max(...facts) : facts.reduce((sum, value) => sum + value, 0)) : null; metrics[id] = { plan, fact, progress: plan > 0 && fact != null ? fact / plan * 100 : null }; } const revenue = metrics.revenue || {}; const costs = metrics.costs || {}; const budget = metrics.paidBudget || {}; metrics.roi = { plan: null, fact: costs.fact > 0 && revenue.fact != null ? (revenue.fact - costs.fact) / costs.fact * 100 : null, progress: null }; metrics.romi = { plan: null, fact: budget.fact > 0 && revenue.fact != null ? (revenue.fact - budget.fact) / budget.fact * 100 : null, progress: null }; return { month, directions, combined: { month, direction: "all", title: "Все направления", metrics }, availableDirections: available.map((item) => item.direction) }; }

function financeMetric(plan: unknown, fact: unknown) {
  const parsedPlan = plan == null ? null : Number(plan);
  const parsedFact = fact == null ? null : Number(fact);
  return { plan: Number.isFinite(parsedPlan) ? parsedPlan : null, fact: Number.isFinite(parsedFact) ? parsedFact : null, progress: Number.isFinite(parsedPlan) && parsedPlan > 0 && Number.isFinite(parsedFact) ? parsedFact / parsedPlan * 100 : null };
}
function financeSnapshotDirection(row: any) {
  const direction = row.direction === "fitness" ? "fit" : "ln";
  return {
    month: row.month,
    direction,
    title: direction === "fit" ? "FIT PRO" : "ЛН",
    metrics: {
      leads: financeMetric(row.leads_plan, row.leads_fact),
      qualifiedLeads: financeMetric(null, row.qualified),
      sales: financeMetric(row.sales_plan, row.sales_fact),
      revenue: financeMetric(row.revenue_plan, row.revenue_fact),
    },
  };
}
async function cachedFinanceSummary(admin: any) {
  const { data, error } = await admin.from("finance_sales_snapshots").select("*").in("direction", ["ln", "fitness"]).order("month", { ascending: false });
  if (error || !data?.length) return null;
  const byMonth: Record<string, any> = {};
  let updatedAt = "";
  for (const row of data) {
    const item = financeSnapshotDirection(row);
    if (!byMonth[row.month]) byMonth[row.month] = {};
    byMonth[row.month][item.direction] = item;
    if (String(row.source_updated_at || "") > updatedAt) updatedAt = row.source_updated_at;
  }
  const summaries = Object.keys(byMonth).sort().reverse().map((month) => combineFinanceMonth(month, byMonth[month]));
  return summaries.length ? { updatedAt: updatedAt || new Date().toISOString(), current: summaries[0], archive: summaries.slice(1) } : null;
}

async function cachedDepartmentFinanceSummary(admin: any) {
  const { data, error } = await admin.from("blogger_shared_state").select("value_json,updated_at").eq("namespace", "finance_department").eq("record_key", "ln-fit-plan-fact-v2").maybeSingle();
  if (error || !data?.value_json?.current) return null;
  return { ...data.value_json, updatedAt: data.value_json.updatedAt || data.updated_at };
}
async function saveDepartmentFinanceSummary(admin: any, summary: any) {
  await admin.from("blogger_shared_state").upsert({ namespace: "finance_department", record_key: "ln-fit-plan-fact-v2", value_json: summary, updated_at: new Date().toISOString(), updated_by: null });
}

Deno.serve(async (request: Request) => {
  if (request.method === "OPTIONS") {
    const origin = request.headers.get("origin") || "";
    if (!allowedOrigins.has(origin)) return new Response(null, { status: 403, headers: corsHeaders(request) });
    return new Response(null, { status: 204, headers: corsHeaders(request) });
  }
  const url = new URL(request.url);
  const path = routePath(url);
  const token = (request.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
  const admin = createClient(Deno.env.get("SUPABASE_URL") || "", Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "", { auth: { persistSession: false, autoRefreshToken: false } });

  if (path === "/api/register-access" && request.method === "POST") {
    const origin = request.headers.get("origin") || "";
    if (!allowedOrigins.has(origin)) return json(request, { error: "Недопустимый источник регистрации" }, 403);
    const body = await request.json().catch(() => null);
    const inviteToken = String(body?.inviteToken || "").toLowerCase();
    const password = String(body?.password || "");
    if (!/^[a-f0-9]{64}$/.test(inviteToken) || password.length < 12 || password.length > 128) return json(request, { error: "Проверьте приглашение и пароль (не менее 12 символов)" }, 400);
    const inviteHash = await sha256Hex(inviteToken);
    const { data: employee } = await admin.from("blogger_employees").select("*").eq("invite_token_hash", inviteHash).eq("status", "active").gt("invite_expires_at", new Date().toISOString()).maybeSingle();
    if (!employee) return json(request, { error: "Ссылка приглашения недействительна или истекла" }, 410);

    let authUserId = employee.profile_id || "";
    if (!authUserId) {
      const { data: usersData } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
      const existingUser = (usersData?.users || []).find((item: any) => String(item.email || "").toLowerCase() === String(employee.email).toLowerCase());
      authUserId = existingUser?.id || "";
    }
    const appMetadata = { app_role: employee.role, dept: "bloggers", employee_id: employee.id };
    if (authUserId) {
      const { error } = await admin.auth.admin.updateUserById(authUserId, { email: employee.email, password, email_confirm: true, app_metadata: appMetadata });
      if (error) return json(request, { error: "Не удалось активировать существующий аккаунт" }, 500);
    } else {
      const { data, error } = await admin.auth.admin.createUser({ email: employee.email, password, email_confirm: true, app_metadata: appMetadata });
      if (error || !data.user) return json(request, { error: "Не удалось создать аккаунт сотрудника" }, 500);
      authUserId = data.user.id;
    }
    const isAdmin = employee.role === "leader";
    const { error: profileError } = await admin.from("profiles").upsert({ id: authUserId, name: employee.name, email: employee.email, dept: "bloggers", role: profileRole(employee.role), is_admin: isAdmin, is_active: true });
    if (profileError) return json(request, { error: "Аккаунт создан, но профиль не привязался" }, 500);
    const registeredAt = new Date().toISOString();
    await admin.from("blogger_employees").update({ profile_id: authUserId, registered_at: registeredAt, invite_token_hash: null, invite_expires_at: null, updated_at: registeredAt }).eq("id", employee.id);
    return json(request, { ok: true, email: employee.email, employee: { id: employee.id, name: employee.name, role: employee.role, historyAliases: employee.history_aliases || [] } }, 201);
  }

  if (!token) return json(request, { error: "Сессия истекла. Войдите снова" }, 401);
  const { data: authData, error: authError } = await admin.auth.getUser(token);
  if (authError || !authData.user) return json(request, { error: "Сессия истекла. Войдите снова" }, 401);
  const userId = authData.user.id;
  const result = await admin.from("profiles").select("id,name,email,dept,role,is_admin,is_active").eq("id", userId).maybeSingle();
  const profile: any = result.data;
  if (!profile || !profile.is_active) return json(request, { error: "Кабинет сотрудника не активен" }, 403);
  if (!profile.is_admin && profile.dept !== "bloggers") return json(request, { error: "Нет доступа к отделу блогеров" }, 403);
  const role = appRole(profile);

  if (path === "/api/kpi-regulation") {
    if (request.method !== "GET") return json(request, { error: "Метод не поддерживается" }, 405);
    if (role !== "leader") return json(request, { error: "Недостаточно прав" }, 403);
    const { data, error } = await admin.storage.from("bloggers-public-shell").createSignedUrl("kpi-regulation.pdf", 300);
    if (error || !data?.signedUrl) return json(request, { error: "Положение временно недоступно" }, 503);
    return json(request, { url: data.signedUrl, expiresIn: 300 });
  }

  if (path === "/whoami") {
    const { data: employee } = await admin.from("blogger_employees").select("*").or(`profile_id.eq.${profile.id},email.eq.${profile.email}`).maybeSingle();
    return json(request, { profile, appRole: role, employee: employee ? employeePayload(employee, role) : null });
  }

  if (path === "/api/reach-actuals") {
    if (request.method === "GET") { const { data, error } = await admin.from("blogger_reach_actuals").select("*").order("updated_at", { ascending: false }); if (error) return json(request, { error: error.message }, 500); return json(request, { records: (data || []).map((row: any) => ({ placementKey: row.placement_key, bloggerKey: row.blogger_key, actual: Number(row.actual), facts: row.facts_json, comment: row.comment, updatedAt: row.updated_at, updatedBy: row.updated_by })) }); }
    if (request.method === "POST") { if (!writable(role)) return json(request, { error: "Недостаточно прав" }, 403); const body = await request.json().catch(() => null); const allowed = new Set(["stories", "reels", "carousel", "post"]); const facts: Record<string, number> = {}; for (const [format, value] of Object.entries(body?.facts || {})) { const number = Number(value); if (!allowed.has(format) || !Number.isFinite(number) || number < 0 || number > 100000000) return json(request, { error: "Некорректный охват по формату" }, 400); facts[format] = Math.round(number); } if (!body?.placementKey || !body?.bloggerKey || !Object.keys(facts).length) return json(request, { error: "Проверьте размещение и форматы" }, 400); const record = { placement_key: String(body.placementKey).slice(0, 900), blogger_key: String(body.bloggerKey).slice(0, 300), actual: Object.values(facts).reduce((sum, value) => sum + value, 0), facts_json: facts, comment: String(body.comment || "").slice(0, 1500), updated_at: new Date().toISOString(), updated_by: userId }; const { error } = await admin.from("blogger_reach_actuals").upsert(record); if (error) return json(request, { error: error.message }, 500); return json(request, { record: { placementKey: record.placement_key, bloggerKey: record.blogger_key, actual: record.actual, facts, comment: record.comment, updatedAt: record.updated_at, updatedBy: userId } }); }
  }

  if (path === "/api/placement-schedules") {
    if (request.method === "GET") { const { data, error } = await admin.from("blogger_placement_schedules").select("*").order("updated_at", { ascending: false }); if (error) return json(request, { error: error.message }, 500); return json(request, { records: (data || []).map((row: any) => ({ placementKey: row.placement_key, warmupStart: row.warmup_start, warmupEnd: row.warmup_end, updatedAt: row.updated_at, updatedBy: row.updated_by })) }); }
    if (request.method === "POST") { if (!writable(role)) return json(request, { error: "Недостаточно прав" }, 403); const body = await request.json().catch(() => null); if (!body?.placementKey || !/^\d{4}-\d{2}-\d{2}$/.test(body.warmupStart || "") || !/^\d{4}-\d{2}-\d{2}$/.test(body.warmupEnd || "") || body.warmupEnd < body.warmupStart) return json(request, { error: "Проверьте даты прогрева" }, 400); const record = { placement_key: String(body.placementKey).slice(0, 900), warmup_start: body.warmupStart, warmup_end: body.warmupEnd, updated_at: new Date().toISOString(), updated_by: userId }; const { error } = await admin.from("blogger_placement_schedules").upsert(record); if (error) return json(request, { error: error.message }, 500); return json(request, { record: { placementKey: record.placement_key, warmupStart: record.warmup_start, warmupEnd: record.warmup_end, updatedAt: record.updated_at, updatedBy: userId } }); }
  }

  if (path === "/api/employees") {
    if (request.method === "GET") { const { data, error } = await admin.from("blogger_employees").select("*").order("role").order("name"); if (error) return json(request, { error: error.message }, 500); return json(request, { employees: (data || []).map((row: any) => employeePayload(row, role)) }); }
    if (request.method === "POST") {
      if (role !== "leader") return json(request, { error: "Редактировать сотрудников может только администратор" }, 403);
      const body = await request.json().catch(() => null);
      if (!body?.id || !String(body.name || "").trim() || !/^\S+@\S+\.\S+$/.test(String(body.email || "")) || !["leader", "manager", "assistant", "analyst"].includes(body.role) || !["active", "paused"].includes(body.status)) return json(request, { error: "Проверьте данные сотрудника" }, 400);
      const historyAliases = [...new Set((Array.isArray(body.historyAliases) ? body.historyAliases : []).map((value: unknown) => String(value || "").trim().slice(0, 80)).filter(Boolean))].slice(0, 12);
      const employee = { id: String(body.id).slice(0, 120), name: String(body.name).trim().slice(0, 80), email: String(body.email).trim().toLowerCase().slice(0, 160), role: body.role, assigned_manager: body.role === "assistant" ? String(body.assignedManager || "").slice(0, 80) : "", status: body.status, base_salary: Math.max(0, Math.round(Number(body.baseSalary || 0))), history_aliases: historyAliases, updated_at: new Date().toISOString() };
      const { data: existing, error: existingError } = await admin.from("blogger_employees").select("*").eq("id", employee.id).maybeSingle();
      if (existingError) return json(request, { error: "Не удалось проверить карточку сотрудника" }, 500);
      const { data: duplicateEmail } = await admin.from("blogger_employees").select("id").eq("email", employee.email).neq("id", employee.id).maybeSingle();
      if (duplicateEmail) return json(request, { error: "Этот email уже используется другим сотрудником" }, 409);

      let previousAuthEmail = "";
      if (existing?.profile_id) {
        const { data: authUser } = await admin.auth.admin.getUserById(existing.profile_id);
        previousAuthEmail = String(authUser?.user?.email || existing.email || "").toLowerCase();
        const { error: authUpdateError } = await admin.auth.admin.updateUserById(existing.profile_id, {
          email: employee.email,
          email_confirm: true,
          app_metadata: { app_role: employee.role, dept: "bloggers", employee_id: employee.id },
        });
        if (authUpdateError) {
          const conflict = /already|registered|unique|exists/i.test(authUpdateError.message || "");
          return json(request, { error: conflict ? "Этот email уже используется другим аккаунтом" : "Не удалось изменить email для входа. Проверьте адрес и повторите" }, conflict ? 409 : 500);
        }
        const { error: profileError } = await admin.from("profiles").upsert({ id: existing.profile_id, name: employee.name, email: employee.email, dept: "bloggers", role: profileRole(employee.role), is_admin: employee.role === "leader", is_active: employee.status === "active" });
        if (profileError) {
          if (previousAuthEmail && previousAuthEmail !== employee.email) await admin.auth.admin.updateUserById(existing.profile_id, { email: previousAuthEmail, email_confirm: true });
          return json(request, { error: "Не удалось обновить профиль сотрудника" }, 500);
        }
      }

      const { data, error } = await admin.from("blogger_employees").upsert(employee).select().single();
      if (error) {
        if (existing?.profile_id && previousAuthEmail && previousAuthEmail !== employee.email) {
          await admin.auth.admin.updateUserById(existing.profile_id, { email: previousAuthEmail, email_confirm: true });
          await admin.from("profiles").update({ email: previousAuthEmail }).eq("id", existing.profile_id);
        }
        return json(request, { error: "Не удалось сохранить карточку сотрудника" }, 500);
      }
      return json(request, { employee: employeePayload({ ...data, profile_id: existing?.profile_id || data.profile_id, registered_at: existing?.registered_at || data.registered_at, invite_expires_at: existing?.invite_expires_at || data.invite_expires_at }, role) });
    }
  }

  const employeeRoute = path.match(/^\/api\/employees\/([^/]+)(?:\/(invite))?$/);
  if (employeeRoute) {
    if (role !== "leader") return json(request, { error: "Управлять доступами может только администратор" }, 403);
    const employeeId = decodeURIComponent(employeeRoute[1]);
    const { data: employee } = await admin.from("blogger_employees").select("*").eq("id", employeeId).maybeSingle();
    if (!employee) return json(request, { error: "Сотрудник не найден" }, 404);
    if (employeeRoute[2] === "invite" && request.method === "POST") {
      if (employee.status !== "active") return json(request, { error: "Сначала активируйте кабинет сотрудника" }, 409);
      const body = await request.json().catch(() => null);
      const inviteToken = randomAccessToken();
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
      const { error } = await admin.from("blogger_employees").update({ invite_token_hash: await sha256Hex(inviteToken), invite_expires_at: expiresAt, invited_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq("id", employeeId);
      if (error) return json(request, { error: "Не удалось сформировать доступ" }, 500);
      const requestOrigin = request.headers.get("origin") || "";
      const fallbackOrigin = allowedOrigins.has(requestOrigin) ? requestOrigin : "https://alexandervukolov.github.io";
      let appUrl = `${fallbackOrigin}/`;
      try {
        const candidate = new URL(String(body?.appUrl || ""));
        if (candidate.protocol === "https:" && allowedOrigins.has(candidate.origin) && !candidate.username && !candidate.password) {
          candidate.hash = "";
          candidate.search = "";
          if (!candidate.pathname.endsWith("/")) candidate.pathname = candidate.pathname.replace(/[^/]*$/, "");
          appUrl = candidate.toString();
        }
      } catch { /* Use the verified request origin. */ }
      return json(request, { accessUrl: `${appUrl}#invite=${inviteToken}`, expiresAt, employee: { id: employee.id, name: employee.name, email: employee.email } });
    }
    if (request.method === "DELETE") {
      if (employee.profile_id === profile.id) return json(request, { error: "Нельзя убрать собственный кабинет администратора" }, 409);
      const updatedAt = new Date().toISOString();
      await admin.from("blogger_employees").update({ status: "paused", invite_token_hash: null, invite_expires_at: null, updated_at: updatedAt }).eq("id", employeeId);
      if (employee.profile_id) await admin.from("profiles").update({ is_active: false }).eq("id", employee.profile_id);
      return json(request, { employee: employeePayload({ ...employee, status: "paused", invite_expires_at: null, updated_at: updatedAt }, role), historyPreserved: true });
    }
  }

  if (path === "/api/kpi-adjustments") {
    if (role !== "leader") return json(request, { error: "KPI и зарплата доступны только администратору" }, 403);
    if (request.method === "GET") { const { data, error } = await admin.from("blogger_kpi_adjustments").select("*").order("month", { ascending: false }); if (error) return json(request, { error: error.message }, 500); return json(request, { adjustments: (data || []).map((row: any) => ({ manager: row.manager, month: row.month, sanctions: Number(row.sanctions), manualReachKpi: row.manual_reach_kpi == null ? null : Number(row.manual_reach_kpi), updatedAt: row.updated_at })) }); }
    if (request.method === "POST") { const body = await request.json().catch(() => null); const sanctions = Number(body?.sanctions); const manualReachKpi = Number(body?.manualReachKpi); if (!String(body?.manager || "").trim() || !/^\d{4}-\d{2}$/.test(String(body?.month || "")) || !Number.isFinite(sanctions) || sanctions < 0 || sanctions > 100000000 || !Number.isFinite(manualReachKpi) || manualReachKpi < 0 || manualReachKpi > 100000000) return json(request, { error: "Некорректная корректировка KPI" }, 400); const record = { manager: String(body.manager).trim().slice(0, 80), month: body.month, sanctions: Math.round(sanctions), manual_reach_kpi: Math.round(manualReachKpi), updated_at: new Date().toISOString(), updated_by: userId }; const { error } = await admin.from("blogger_kpi_adjustments").upsert(record); if (error) return json(request, { error: error.message }, 500); return json(request, { adjustment: { manager: record.manager, month: record.month, sanctions: record.sanctions, manualReachKpi: record.manual_reach_kpi, updatedAt: record.updated_at } }); }
  }

  if (path === "/api/kpi-bloggers") {
    if (role !== "leader") return json(request, { error: "Блогеров KPI может настраивать только администратор" }, 403);
    const month = String(url.searchParams.get("month") || "");
    if (request.method === "GET") {
      if (!/^\d{4}-\d{2}$/.test(month)) return json(request, { error: "Не указан отчётный месяц" }, 400);
      const { data, error } = await admin.from("blogger_kpi_month_bloggers").select("*").eq("month", month).order("updated_at", { ascending: false });
      if (error) return json(request, { error: error.message }, 500);
      return json(request, { bloggers: (data || []).map((row: any) => ({ month: row.month, bloggerKey: row.blogger_key, bloggerName: row.blogger_name, manager: row.manager, factReach: Number(row.fact_reach || 0), note: row.note || "", updatedAt: row.updated_at })) });
    }
    if (request.method === "POST") {
      const body = await request.json().catch(() => null);
      const factReach = Number(body?.factReach);
      const recordMonth = String(body?.month || "");
      const bloggerKey = String(body?.bloggerKey || "").trim();
      const bloggerName = String(body?.bloggerName || "").trim();
      const manager = String(body?.manager || "").trim();
      if (!/^\d{4}-\d{2}$/.test(recordMonth) || !bloggerKey || !bloggerName || !manager || !Number.isFinite(factReach) || factReach < 0 || factReach > 1000000000) return json(request, { error: "Проверьте блогера, менеджера, месяц и охват" }, 400);
      const record = { month: recordMonth, blogger_key: bloggerKey.slice(0, 300), blogger_name: bloggerName.slice(0, 180), manager: manager.slice(0, 80), fact_reach: Math.round(factReach), note: String(body?.note || "").trim().slice(0, 1000), updated_at: new Date().toISOString(), updated_by: userId };
      const { error } = await admin.from("blogger_kpi_month_bloggers").upsert(record);
      if (error) return json(request, { error: error.message }, 500);
      return json(request, { blogger: { month: record.month, bloggerKey: record.blogger_key, bloggerName: record.blogger_name, manager: record.manager, factReach: record.fact_reach, note: record.note, updatedAt: record.updated_at } });
    }
    if (request.method === "DELETE") {
      const bloggerKey = String(url.searchParams.get("bloggerKey") || "").trim();
      if (!/^\d{4}-\d{2}$/.test(month) || !bloggerKey) return json(request, { error: "Не указан блогер или месяц" }, 400);
      const { error } = await admin.from("blogger_kpi_month_bloggers").delete().eq("month", month).eq("blogger_key", bloggerKey);
      if (error) return json(request, { error: error.message }, 500);
      return json(request, { ok: true });
    }
  }

  if (path === "/api/shared-state") {
    if (request.method === "GET") { const since = url.searchParams.get("since") || ""; const operationalNamespaces = ["bootstrap_meta","bootstrap_bloggers","bootstrap_placements","bootstrap_reels","bootstrap_weekly_exits","bootstrap_eugenia","blogger","blogger_create","blogger_contract","placement","manager_report","assistant_report","monthly_plan","placement_format","manager_metrics","placement_delete"]; let query = admin.from("blogger_shared_state").select("*").order("updated_at"); if (role !== "leader") query = query.in("namespace", operationalNamespaces); if (since) query = query.gt("updated_at", since); const { data, error } = await query; if (error) return json(request, { error: error.message }, 500); const records = (data || []).map((row: any) => ({ namespace: row.namespace, key: row.record_key, value: row.value_json, updatedAt: row.updated_at, updatedBy: row.updated_by })); return json(request, { records, latestUpdatedAt: records.at(-1)?.updatedAt || since, count: records.length }); }
    if (request.method === "POST") { const body = await request.json().catch(() => null); const raw = Array.isArray(body?.records) ? body.records : body?.namespace ? [body] : []; if (!raw.length || raw.length > 500) return json(request, { error: "Передайте от 1 до 500 записей" }, 400); const updatedAt = new Date().toISOString(); const records = []; for (const item of raw) { const namespace = String(item?.namespace || ""); const key = String(item?.key || "").trim().slice(0, 300); if (!sharedNamespaces.has(namespace) || !key || (sharedAdminOnly.has(namespace) ? role !== "leader" : !writable(role))) return json(request, { error: "Недостаточно прав или неизвестный раздел" }, 403); const valueText = JSON.stringify(item.value); if (valueText.length > 750000) return json(request, { error: "Запись слишком большая" }, 400); records.push({ namespace, record_key: key, value_json: item.value, updated_at: updatedAt, updated_by: userId }); } const { error } = await admin.from("blogger_shared_state").upsert(records); if (error) return json(request, { error: error.message }, 500); return json(request, { records: records.map((row: any) => ({ namespace: row.namespace, key: row.record_key, value: row.value_json, updatedAt, updatedBy: userId })), latestUpdatedAt: updatedAt }); }
  }

  if (path === "/api/admin-summary") {
    if (role !== "leader") return json(request, { error: "Сводка доступна только администратору" }, 403);
    if (request.method === "GET") {
      const source = { spreadsheetId: adminSummarySheetId, url: adminSummarySheetUrl, sheet: "Сводка Март–Август" };
      const [manualRecords, cacheRecords] = await Promise.all([
        readAdminSummaryRecords(admin, adminSummaryManualNamespace),
        readAdminSummaryRecords(admin, adminSummaryCacheNamespace),
      ]);
      const manualRows = manualRecords.map((record: any) => normalizeAdminSummaryRow({ ...record.value_json, month: record.record_key, updatedAt: record.updated_at }, "manual"));
      const cachedValue = cacheRecords.find((record: any) => record.record_key === adminSummaryCacheKey)?.value_json;
      let sheetRows = Array.isArray(cachedValue?.rows) ? cachedValue.rows.map((row: any) => normalizeAdminSummaryRow(row, "sheet-cache")) : [];
      let updatedAt = String(cachedValue?.updatedAt || "");
      let mode = sheetRows.length ? "sheet-cache" : "manual-only";
      const cacheAge = updatedAt ? Date.now() - new Date(updatedAt).getTime() : Infinity;
      if (cacheAge >= 10 * 60 * 1000) {
        try {
          const response = await fetch(`https://docs.google.com/spreadsheets/d/${adminSummarySheetId}/gviz/tq?tqx=out:csv&gid=${adminSummarySheetGid}&range=A1:H1000&_=${Date.now()}`);
          if (!response.ok) throw new Error(String(response.status));
          sheetRows = parseAdminSummarySheet(await response.text());
          if (!sheetRows.length) throw new Error("empty summary source");
          updatedAt = await saveAdminSummaryCache(admin, sheetRows);
          mode = "live-sheet";
        } catch {
          mode = sheetRows.length ? "sheet-cache" : "manual-only";
        }
      }
      const merged: Record<string, any> = {};
      sheetRows.forEach((row: any) => { merged[row.month] = normalizeAdminSummaryRow(row, row.source || "sheet-cache"); });
      manualRows.forEach((row: any) => { merged[row.month] = row; });
      const rows = Object.values(merged).sort((a: any, b: any) => String(b.month).localeCompare(String(a.month)));
      return json(request, { rows, updatedAt, source: { ...source, mode, automaticMonths: true, manualOverrides: true } });
    }
    if (request.method === "POST") {
      const body = await request.json().catch(() => null);
      const month = String(body?.month || "").trim();
      const fields = ["advertisingCosts", "payrollCosts", "revenue", "barterRevenue", "commercialRevenue"];
      if (!/^20\d{2}-(0[1-9]|1[0-2])$/.test(month)) return json(request, { error: "Выберите корректный месяц" }, 400);
      const values: Record<string, number> = {};
      for (const field of fields) {
        const value = Number(body?.[field] || 0);
        if (!Number.isFinite(value) || value < 0 || value > 100000000000) return json(request, { error: "Проверьте числовые значения сводки" }, 400);
        values[field] = Math.round(value * 100) / 100;
      }
      const updatedAt = new Date().toISOString();
      const value = { month, ...values, updatedAt };
      const { error } = await admin.from("blogger_shared_state").upsert({ namespace: adminSummaryManualNamespace, record_key: month, value_json: value, updated_at: updatedAt, updated_by: userId });
      if (error) return json(request, { error: error.message }, 500);
      return json(request, { row: normalizeAdminSummaryRow(value, "manual") });
    }
  }

  if (path === "/api/department-months") {
    if (request.method === "GET") { let { data } = await admin.from("blogger_department_months").select("*").order("month_key", { ascending: false }); if (!data?.length) { await admin.from("blogger_department_months").insert({ month_key: systemMonth(), status: "active", updated_by: userId }); ({ data } = await admin.from("blogger_department_months").select("*").order("month_key", { ascending: false })); } return json(request, { periods: (data || []).map((row: any) => ({ month: row.month_key, status: row.status, createdAt: row.created_at, closedAt: row.closed_at || "", updatedBy: row.updated_by })) }); }
    if (request.method === "POST") { if (role !== "leader") return json(request, { error: "Управлять месяцами может только администратор" }, 403); const body = await request.json().catch(() => null); const month = String(body?.month || ""); if (!["close", "add"].includes(body?.action) || !/^\d{4}-\d{2}$/.test(month)) return json(request, { error: "Проверьте действие и месяц" }, 400); if (body.action === "close") { const { data, error } = await admin.from("blogger_department_months").update({ status: "archived", closed_at: new Date().toISOString(), updated_by: userId }).eq("month_key", month).eq("status", "active").select(); if (error || !data?.length) return json(request, { error: "Месяц уже закрыт" }, 409); } else { const { data: active } = await admin.from("blogger_department_months").select("month_key").eq("status", "active").limit(1); if (active?.length) return json(request, { error: "Сначала закройте текущий месяц" }, 409); const { error } = await admin.from("blogger_department_months").insert({ month_key: month, status: "active", updated_by: userId }); if (error) return json(request, { error: "Этот месяц уже существует" }, 409); } const { data } = await admin.from("blogger_department_months").select("*").order("month_key", { ascending: false }); return json(request, { period: { month, status: body.action === "close" ? "archived" : "active" }, periods: (data || []).map((row: any) => ({ month: row.month_key, status: row.status, createdAt: row.created_at, closedAt: row.closed_at || "", updatedBy: row.updated_by })) }); }
  }

  if (path === "/api/evidence-reports") {
    await ensureBucket(admin);
    if (request.method === "GET") { const { data, error } = await admin.from("blogger_evidence_reports").select("*").order("created_at", { ascending: false }); if (error) return json(request, { error: error.message }, 500); return json(request, { reports: await signedEvidenceReports(admin, data || []) }); }
    if (request.method === "POST") {
      if (!writable(role)) return json(request, { error: "Недостаточно прав" }, 403);
      const form = await request.formData();
      const files = form.getAll("files").filter((file: any) => file && typeof file.arrayBuffer === "function") as File[];
      const blogger = String(form.get("blogger") || "").trim().slice(0, 300);
      const date = String(form.get("date") || "");
      const reach = Number(form.get("reach"));
      const clicks = Number(form.get("clicks") || 0);
      const comment = String(form.get("comment") || "").trim().slice(0, 1500);
      const requestedUploader = String(form.get("uploader") || "").trim().slice(0, 160);
      if (!blogger || !/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(reach) || reach < 0 || !files.length || files.length > 10) return json(request, { error: "Проверьте блогера, дату, охват и фотографии" }, 400);
      let uploader = profile.name || "Сотрудник";
      if (requestedUploader) {
        const { data: selectedEmployee } = await admin.from("blogger_employees").select("name").eq("name", requestedUploader).eq("status", "active").maybeSingle();
        if (!selectedEmployee) return json(request, { error: "Выберите активного сотрудника из списка" }, 400);
        uploader = selectedEmployee.name;
      }
      const id = crypto.randomUUID();
      const images: any[] = [];
      for (const file of files) {
        if (!["image/jpeg", "image/png", "image/webp"].includes(file.type) || file.size > 15728640) return json(request, { error: "Поддерживаются JPG, PNG и WEBP до 15 МБ" }, 415);
        const extension = file.type === "image/png" ? "png" : file.type === "image/webp" ? "webp" : "jpg";
        const imageId = `${crypto.randomUUID()}.${extension}`;
        const objectPath = `evidence/${id}/${imageId}`;
        const { error } = await admin.storage.from(bucketId).upload(objectPath, file, { contentType: file.type, upsert: false });
        if (error) return json(request, { error: "Не удалось загрузить фотографию" }, 500);
        images.push({ id: imageId, name: safeFileName(file.name), size: file.size, type: file.type, path: objectPath });
      }
      const row = { id, blogger, exit_date: date, reach: Math.round(reach), clicks: Math.max(0, Math.round(clicks)), uploader, status: "Подтверждено", comment, images_json: images, created_by: userId };
      const { error } = await admin.from("blogger_evidence_reports").insert(row);
      if (error) return json(request, { error: error.message }, 500);
      const [report] = await signedEvidenceReports(admin, [{ ...row, created_at: new Date().toISOString() }]);
      return json(request, { report }, 201);
    }
  }

  if (path === "/api/contracts" || path.startsWith("/api/contracts/")) {
    await ensureBucket(admin); const blogger = String(url.searchParams.get("blogger") || "");
    if (path === "/api/contracts" && request.method === "GET") { if (!blogger) return json(request, { error: "Не указан блогер" }, 400); const { data, error } = await admin.from("blogger_contracts").select("*").eq("blogger_key", blogger).order("uploaded_at", { ascending: false }); if (error) return json(request, { error: error.message }, 500); return json(request, { files: (data || []).map((row: any) => ({ id: row.id, name: row.file_name, size: Number(row.file_size), type: row.contract_type, date: new Date(row.uploaded_at).toLocaleDateString("ru-RU"), uploadedAt: row.uploaded_at })) }); }
    if (path === "/api/contracts" && request.method === "POST") { if (!writable(role)) return json(request, { error: "Недостаточно прав" }, 403); const form = await request.formData(); const owner = String(form.get("blogger") || ""); const type = form.get("type") === "barter" ? "barter" : "commercial"; const file = form.get("file") as File; if (!owner || !file || typeof file.arrayBuffer !== "function" || file.size > 15728640 || !/\.(pdf|doc|docx|jpe?g|png|webp)$/i.test(file.name || "")) return json(request, { error: "Проверьте файл договора" }, 400); const id = crypto.randomUUID(); const objectPath = `contracts/${encodeURIComponent(owner)}/${id}`; const { error: uploadError } = await admin.storage.from(bucketId).upload(objectPath, file, { contentType: file.type || "application/octet-stream", upsert: false }); if (uploadError) return json(request, { error: "Не удалось загрузить договор" }, 500); const row = { id, blogger_key: owner, contract_type: type, file_name: safeFileName(file.name), file_size: file.size, mime_type: file.type || "application/octet-stream", object_path: objectPath, uploaded_by: userId }; const { error } = await admin.from("blogger_contracts").insert(row); if (error) return json(request, { error: error.message }, 500); return json(request, { file: { id, name: row.file_name, size: row.file_size, type, date: new Date().toLocaleDateString("ru-RU"), uploadedAt: new Date().toISOString() } }, 201); }
    const id = path.split("/").pop() || ""; const { data: record } = await admin.from("blogger_contracts").select("*").eq("id", id).maybeSingle(); if (!record || (blogger && record.blogger_key !== blogger)) return json(request, { error: "Договор не найден" }, 404); if (request.method === "DELETE") { if (!writable(role)) return json(request, { error: "Недостаточно прав" }, 403); await admin.storage.from(bucketId).remove([record.object_path]); await admin.from("blogger_contracts").delete().eq("id", id); return json(request, { ok: true }); } if (request.method === "GET") { const { data, error } = await admin.storage.from(bucketId).download(record.object_path); if (error || !data) return json(request, { error: "Файл не найден" }, 404); return new Response(data, { headers: { ...corsHeaders(request), "content-type": record.mime_type, "content-disposition": `attachment; filename*=UTF-8''${encodeURIComponent(record.file_name)}`, "cache-control": "private, no-store" } }); }
  }

  if (path === "/api/finance-summary" && request.method === "GET") {
    if (role !== "leader") return json(request, { error: "Финансы доступны только администратору" }, 403);
    const sheetId = "1jWHvXtzPssACQ7GCcMwpVx31qjj-riyFu4rTW9ajL9A";
    const tabs = [{ key: "ln", title: "ЛН", gid: "564426579" }, { key: "fit", title: "FIT PRO", gid: "1318734499" }];
    const source = { spreadsheetId: sheetId, url: `https://docs.google.com/spreadsheets/d/${sheetId}/edit`, tabs: tabs.map((tab) => tab.title) };
    const exactCache = await cachedDepartmentFinanceSummary(admin);
    const cacheAge = exactCache?.updatedAt ? Date.now() - new Date(exactCache.updatedAt).getTime() : Infinity;
    if (exactCache && cacheAge < 10 * 60 * 1000) return json(request, { source: { ...source, mode: "exact-sheet-cache" }, ...exactCache });
    try {
      const results = await Promise.all(tabs.map(async (tab) => {
        const response = await fetch(`https://docs.google.com/spreadsheets/d/${sheetId}/gviz/tq?tqx=out:csv&gid=${tab.gid}&range=A1:E80&_=${Date.now()}`);
        if (!response.ok) throw new Error(String(response.status));
        return { tab, months: parseFinanceSheet(await response.text(), tab) };
      }));
      const monthKeys = [...new Set(results.flatMap((item) => Object.keys(item.months)))].sort().reverse();
      const summaries = monthKeys.map((month) => {
        const directions: Record<string, any> = {};
        for (const item of results) if (item.months[month]) directions[item.tab.key] = item.months[month];
        return combineFinanceMonth(month, directions);
      });
      if (!summaries.length) throw new Error("empty finance source");
      const exactSummary = { updatedAt: new Date().toISOString(), current: summaries[0], archive: summaries.slice(1, 3) };
      await saveDepartmentFinanceSummary(admin, exactSummary);
      return json(request, { source: { ...source, mode: "live-sheet" }, ...exactSummary });
    } catch {
      if (exactCache) return json(request, { source: { ...source, mode: "exact-sheet-cache" }, ...exactCache });
      return json(request, { error: "Не удалось обновить отчет ЛН и FIT PRO" }, 502);
    }
  }

  return json(request, { error: "Маршрут не найден" }, 404);
});
