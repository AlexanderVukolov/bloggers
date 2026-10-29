import {PERMISSIONS,OperationError,fail,clone,equal,canonical,model,permission,requirePermission,managerNames,inScope,placementKey,diagnostics,totals,change,rowChange,editPlan,archivePlan,relinkPlan,mergePlan,importPlan,isoDate} from './operations-core.mjs';
export const WORKBOOK='1jk00dqQbaA4HuA-jr-qNAvPvpXCx3WqOjnbhTQZFtaw';
const env=name=>Deno.env.get(name)||'';
export async function all(admin,table,select='*') {
  const rows=[];for(let from=0;;from+=500){const {data,error}=await admin.from(table).select(select).range(from,from+499);if(error)throw error;rows.push(...data);if(data.length<500)break;}return rows;
}
export async function loadModel(admin) {
  const [rows,reports,links,contracts,actuals,schedules,employees,mappings]=await Promise.all(['blogger_shared_state','blogger_evidence_reports','blogger_evidence_placement_links','blogger_contracts','blogger_reach_actuals','blogger_placement_schedules','blogger_employees','blogger_external_ids'].map(t=>all(admin,t)));
  const m=model(rows,reports,links,contracts,actuals,schedules);m.mappings=mappings;m.managers=new Set(employees.filter(e=>e.status==='active').flatMap(e=>[e.name,...(e.history_aliases||[])]));return m;
}
export async function accessFor(admin,profile) {
  const [{data:access,error},{data:employee}]=await Promise.all([
    admin.from('blogger_access').select('*').eq('user_id',profile.id).maybeSingle(),
    admin.from('blogger_employees').select('*').eq('profile_id',profile.id).maybeSingle(),
  ]);
  if(error)fail('ACCESS_NOT_CONFIGURED','Настройки полномочий пока не установлены',503);
  if(!employee||employee.status!=='active')fail('FORBIDDEN','Кабинет сотрудника приостановлен',403);
  const result={role:access?.role||employee.role,permissions:access?.permissions||{},employee,names:managerNames(employee,profile)};
  if(!access&&employee.role==='leader')result.role='unconfigured';
  return result;
}
export function filterShared(rows,access) {
  if(access.role==='owner')return rows;
  const operational=new Set(['bootstrap_meta','bootstrap_bloggers','bootstrap_placements','bootstrap_reels','bootstrap_weekly_exits','bootstrap_eugenia','blogger','blogger_create','blogger_contract','placement','manager_report','assistant_report','placement_format','placement_delete']);
  return rows.filter(r=>operational.has(r.namespace)).flatMap(r=>{
    if(permission(access,'read_all'))return [r];
    if(['bootstrap_bloggers','bootstrap_placements','bootstrap_reels','bootstrap_weekly_exits'].includes(r.namespace))return [{...r,value_json:(r.value_json||[]).filter(v=>inScope(v,access))}];
    if(r.namespace==='bootstrap_meta')return [{...r,value_json:{source:'Ограниченная рабочая область'}}];
    if(r.namespace==='bootstrap_eugenia')return [];
    return inScope(r.value_json,access)?[r]:[];
  });
}
export function scopedPlacement(m,key,access) {const p=[...m.placements.values()].find(p=>placementKey(p)===key);if(!p||!inScope(p,access))fail('FORBIDDEN','Нет доступа к размещению',403);return p;}
export function scopedBlogger(m,id,access) {const b=m.bloggers.get(String(id));if(!b||!inScope(b,access))fail('FORBIDDEN','Нет доступа к карточке',403);return b;}
export async function savePreview(admin,actor,kind,reason,plan,source='crm') {
  if(!String(reason||'').trim())fail('REASON_REQUIRED','Укажите причину изменения');
  // Collapse exact duplicate patches; conflicting patches in the same preview are rejected.
  const unique=new Map();for(const c of plan.changes||[]){const key=c.table+canonical(c.key);if(unique.has(key)&&!equal(unique.get(key),c))fail('DUPLICATE_CHANGE','Одна запись изменяется дважды');unique.set(key,c);}
  plan.changes=[...unique.values()].filter(c=>!equal(c.before,c.after));
  const {data,error}=await admin.from('blogger_operations').insert({actor,kind,reason:reason.trim().slice(0,1000),source,plan}).select('id,expires_at').single();if(error)throw error;
  return {...data,...plan,changes:plan.changes.map(c=>({table:c.table,key:c.key,before:c.before,after:c.after})),requiresConfirmation:true};
}
export async function commit(admin,actor,id) {
  const {data,error}=await admin.rpc('blogger_commit_operation',{p_actor:actor,p_operation:id});
  if(error){const message=String(error.message||'');if(message.includes('CONFLICT'))fail('CONFLICT','Запись уже изменена другим сотрудником. Повторите предварительную проверку.',409);if(message.includes('FORBIDDEN'))fail('FORBIDDEN','Операция больше не разрешена',403);if(message.includes('PREVIEW'))fail('PREVIEW_EXPIRED','Проверка устарела или содержит ошибки. Выполните её заново.',409);throw error;}
  return data;
}
export async function legacyCommit(admin,profile,access,changes,reason='Ручное изменение в CRM') {
  const preview=await savePreview(admin,profile.id,'legacy_write',reason,{changes},'crm');return commit(admin,profile.id,preview.id);
}
function stripServer(row) {const v=clone(row);delete v.updated_at;delete v.updated_by;return v;}
export async function sharedWrite(admin,profile,access,raw) {
  if(!Array.isArray(raw)||!raw.length||raw.length>500)fail('INVALID_BATCH','Передайте от 1 до 500 записей');
  const m=await loadModel(admin),changes=[];
  const allowed=new Set(['blogger','blogger_create','blogger_contract','placement','manager_report','assistant_report','placement_format']);
  const ownerOnly=new Set(['bootstrap_meta','bootstrap_bloggers','bootstrap_placements','bootstrap_reels','bootstrap_weekly_exits','bootstrap_eugenia','monthly_plan','manager_metrics','placement_delete']);
  for(const item of raw) {
    const ns=String(item.namespace),key=String(item.key||'');if(!key||key.length>300)fail('INVALID_KEY','Неверный ID');
    if(!allowed.has(ns)&&!(access.role==='owner'&&ownerOnly.has(ns)))fail('FORBIDDEN','Раздел недоступен для записи',403);
    if(access.role==='supervisor') {requirePermission(access,ns==='placement_format'?'dictionaries':'edit_work');if(item.value?.manager)requirePermission(access,'assign');}
    if(!['owner','supervisor','manager','assistant'].includes(access.role))fail('FORBIDDEN','Доступ только на чтение',403);
    const before=m.rows.find(r=>r.namespace===ns&&r.record_key===key);
    if(before?.value_json?.excludedFromCalculations)fail('ARCHIVED','Восстановите запись через раздел исправлений');
    for(const field of ['excludedFromCalculations','exclusionReason','mergedInto'])if(!equal(before?.value_json?.[field],item.value?.[field]))fail('PREVIEW_REQUIRED','Архивирование и объединение выполняются через предварительный просмотр');
    if(before?.value_json?.stablePlacementKey&&!equal(before.value_json.stablePlacementKey,item.value?.stablePlacementKey))fail('INVALID_KEY','Постоянный ключ размещения нельзя менять');
    if(before&&item.expectedUpdatedAt!==before.updated_at)fail('CONFLICT','Запись изменилась или клиент устарел. Обновите страницу.',409);
    if(!before&&item.expectedUpdatedAt)fail('CONFLICT','Версия записи не найдена',409);
    if(!inScope(item.value,access)||(before&&!inScope(before.value_json,access)))fail('FORBIDDEN','Чужая рабочая область',403);
    if(ns==='placement'&&item.value.bloggerId!=null)scopedBlogger(m,item.value.bloggerId,access);
    if(ns==='blogger'&&access.role!=='owner'&&access.role!=='supervisor')fail('FORBIDDEN','Редактирование карточки требует роли руководителя',403);
    if(['blogger','blogger_create','placement'].includes(ns)&&String(item.value?.id)!==key)fail('INVALID_KEY','ID записи и ключ различаются');
    changes.push(rowChange(m,ns,key,item.value));
  }
  const result=await legacyCommit(admin,profile,access,changes);
  return {records:result.changes.map(c=>({namespace:c.after.namespace,key:c.after.record_key,value:c.after.value_json,updatedAt:c.after.updated_at,updatedBy:profile.id})),latestUpdatedAt:result.changes.at(-1)?.after?.updated_at||new Date().toISOString()};
}

export async function scopedFactsRoute(admin,profile,access,path,request) {
  if(!['/api/reach-actuals','/api/placement-schedules'].includes(path))return null;
  const m=await loadModel(admin),facts=path.endsWith('reach-actuals'),table=facts?'blogger_reach_actuals':'blogger_placement_schedules',rows=facts?m.actuals:m.schedules;
  const payload=r=>facts?{placementKey:r.placement_key,bloggerKey:r.blogger_key,actual:Number(r.actual),facts:r.facts_json,comment:r.comment,updatedAt:r.updated_at,updatedBy:r.updated_by}:{placementKey:r.placement_key,warmupStart:r.warmup_start,warmupEnd:r.warmup_end,updatedAt:r.updated_at,updatedBy:r.updated_by};
  if(request.method==='GET')return {records:rows.filter(r=>access.role==='owner'||permission(access,'read_all')||[...m.placements.values()].some(p=>placementKey(p)===r.placement_key&&inScope(p,access))).map(payload)};
  if(request.method!=='POST')fail('METHOD_NOT_ALLOWED','Метод не поддерживается',405);
  if(access.role==='supervisor')requirePermission(access,'edit_work');else if(!['owner','manager','assistant'].includes(access.role))fail('FORBIDDEN','Доступ только на чтение',403);
  const body=await request.json(),p=scopedPlacement(m,body.placementKey,access),before=rows.find(r=>r.placement_key===body.placementKey)||null;
  if(before&&body.expectedUpdatedAt!==before.updated_at)fail('CONFLICT','Факт или период уже изменён. Обновите страницу.',409);
  let after;
  if(facts) {
    const values={};for(const [format,input] of Object.entries(body.facts||{})) {const n=Number(input);if(!['stories','reels','carousel','post'].includes(format)||input==null||input===''||!Number.isInteger(n)||n<0||n>100000000)fail('INVALID_FACT','Некорректный охват по формату');values[format]=n;}
    if(!Object.keys(values).length)fail('INVALID_FACT','Выберите хотя бы один формат');
    // Separate format rows may contain only their own measurements.
    const allowed=/stories|сторис/i.test(p.type)?'stories':/reels|рилс/i.test(p.type)?'reels':/карусел|carousel/i.test(p.type)?'carousel':/пост|post/i.test(p.type)?'post':null;
    if(allowed&&Object.keys(values).some(f=>f!==allowed)&&!/[+/,]/.test(p.type))fail('FORMAT_CONFLICT','Внесите статистику другого формата в отдельное размещение');
    after={placement_key:body.placementKey,blogger_key:String(p.bloggerId??body.bloggerKey??''),actual:Object.values(values).reduce((a,b)=>a+b,0),facts_json:values,comment:String(body.comment||'').slice(0,1500)};
  } else {
    const start=isoDate(body.warmupStart),end=isoDate(body.warmupEnd);if(end<start)fail('INVALID_PERIOD','Окончание раньше начала');
    if(!/stories|сторис/i.test(p.type)&&start!==end)fail('INVALID_PERIOD','Период прогрева доступен только для Stories');after={placement_key:body.placementKey,warmup_start:start,warmup_end:end};
  }
  const result=await legacyCommit(admin,profile,access,[change(table,before,after,{placement_key:body.placementKey})]);return {record:payload(result.changes[0].after)};
}

export function reportInScope(m,r,access) {
  if(access.role==='owner'||permission(access,'read_all'))return true;
  if(r.created_by===access.employee.profile_id)return true;
  if(r.blogger_id&&m.bloggers.has(String(r.blogger_id)))return inScope(m.bloggers.get(String(r.blogger_id)),access);
  return m.links.filter(l=>l.report_id===r.id).some(l=>[...m.placements.values()].some(p=>placementKey(p)===l.placement_key&&inScope(p,access)));
}
export async function guardLegacyResources(admin,profile,access,path,request,url) {
  if(path==='/api/finance-summary'&&access.role!=='owner')fail('FORBIDDEN','Финансовая сводка доступна владельцу',403);
  if(path==='/api/evidence-reports'&&request.method==='POST') {
    if(access.role==='supervisor')requirePermission(access,'edit_work');const form=await request.clone().formData(),m=await loadModel(admin);
    let links;try{links=JSON.parse(String(form.get('placementLinks')||'[]'));}catch{fail('INVALID_LINK','Неверный список размещений');}
    if(!['owner','supervisor'].includes(access.role)) {
      if(!links.length)fail('LINK_REQUIRED','Выберите конкретное размещение для отчёта');
      for(const l of links)scopedPlacement(m,l.placementKey||l,access);
      const uploader=String(form.get('uploader')||'');if(uploader&&uploader!==access.employee.name)fail('FORBIDDEN','Нельзя вносить отчёт от имени другого сотрудника',403);
    }
  }
  if(path==='/api/contracts'||path.startsWith('/api/contracts/')) {
    if(access.role==='supervisor'&&request.method!=='GET')requirePermission(access,'edit_work');
    // Deletion is replaced by archiving through diagnostics; uploaded documents stay recoverable.
    if(request.method==='DELETE')fail('ARCHIVE_REQUIRED','Для сохранности истории удаление файлов отключено. Используйте архивирование связанной записи.',403);
    const m=await loadModel(admin);let key=url.searchParams.get('blogger')||'';
    if(request.method==='POST')key=String((await request.clone().formData()).get('blogger')||'');
    if(path!=='/api/contracts') {const c=m.contracts.find(c=>c.id===path.split('/').pop());if(!c)fail('NOT_FOUND','Договор не найден',404);key=c.blogger_key;}
    const candidates=[...m.bloggers.values()].filter(b=>String(b.id)===key||String(b.sourceKey||b.name||b.id)===key);
    if(!candidates.length||candidates.some(b=>!inScope(b,access)))fail('FORBIDDEN','Нет подтверждённого доступа к договору',403);
  }
}

function b64url(input) {const bytes=typeof input==='string'?new TextEncoder().encode(input):new Uint8Array(input);let text='';for(const b of bytes)text+=String.fromCharCode(b);return btoa(text).replace(/=/g,'').replace(/\+/g,'-').replace(/\//g,'_');}
let googleToken=null;
export async function sheetsToken() {
  if(googleToken?.expires>Date.now()+60000)return googleToken.token;
  const raw=env('BLOGGERS_GOOGLE_SERVICE_ACCOUNT_JSON');if(!raw)fail('GOOGLE_NOT_CONFIGURED','Владелец должен подключить отдельный сервисный аккаунт Google Sheets',503);
  let credentials;try{credentials=JSON.parse(raw);}catch{fail('GOOGLE_NOT_CONFIGURED','Некорректные серверные настройки Google',503);}
  const now=Math.floor(Date.now()/1000),head=b64url(JSON.stringify({alg:'RS256',typ:'JWT'})),body=b64url(JSON.stringify({iss:credentials.client_email,scope:'https://www.googleapis.com/auth/spreadsheets',aud:'https://oauth2.googleapis.com/token',iat:now,exp:now+3600}));
  const der=Uint8Array.from(atob(credentials.private_key.replace(/-----[^-]+-----|\s/g,'')),c=>c.charCodeAt(0));
  const key=await crypto.subtle.importKey('pkcs8',der,{name:'RSASSA-PKCS1-v1_5',hash:'SHA-256'},false,['sign']);
  const signed=b64url(await crypto.subtle.sign('RSASSA-PKCS1-v1_5',key,new TextEncoder().encode(head+'.'+body)));
  const response=await fetch('https://oauth2.googleapis.com/token',{method:'POST',body:new URLSearchParams({grant_type:'urn:ietf:params:oauth:grant-type:jwt-bearer',assertion:head+'.'+body+'.'+signed})});
  if(!response.ok)fail('GOOGLE_AUTH_FAILED','Google отклонил авторизацию сервисного аккаунта',503);const data=await response.json();googleToken={token:data.access_token,expires:Date.now()+data.expires_in*1000};return googleToken.token;
}
async function google(path,body) {
  const token=await sheetsToken();const res=await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${WORKBOOK}${path}`,{method:body?'POST':'GET',headers:{authorization:'Bearer '+token,'content-type':'application/json'},body:body?JSON.stringify(body):undefined});
  if(!res.ok)fail('GOOGLE_REQUEST_FAILED','Google Sheets недоступна: '+res.status,503);return res.json();
}
export async function readSheet() {
  const data=await google('/values:batchGet?ranges='+encodeURIComponent("'Блогеры'!A1:AZ5001")+'&ranges='+encodeURIComponent("'Размещения'!A1:AZ5001")+'&valueRenderOption=UNFORMATTED_VALUE&dateTimeRenderOption=SERIAL_NUMBER');
  const ranges=data.valueRanges||[];if(ranges.some(r=>(r.values||[]).length>5000))fail('TOO_MANY_ROWS','Лимит проверки — 4999 строк данных на лист');
  return {'Блогеры':ranges[0]?.values||[],'Размещения':ranges[1]?.values||[]};
}
async function hash(value) {return b64url(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(canonical(value))));}
export async function writeback(admin,op) {
  const plan=op.plan;if(!plan.newMappings?.length)return {status:'not_needed'};
  const current=await readSheet(),updates=[],meta=await google('?fields=sheets(properties),developerMetadata');
  // Row metadata follows insertions/sorts. Only ID CRM (column A) is written.
  for(const map of plan.newMappings) {
    const sheet=map.entity==='blogger'?'Блогеры':'Размещения',grid=current[sheet],matches=[];
    for(let i=1;i<grid.length;i++)if(String(grid[i]?.[1]||'')===map.external_id)matches.push(i);
    if(matches.length!==1)fail('WRITEBACK_CONFLICT','Не найдена единственная строка резервного ID '+map.external_id,409);
    const index=matches[0],existing=String(grid[index]?.[0]??'');if(existing&&existing!==map.crm_id)fail('WRITEBACK_CONFLICT','CRM ID в таблице уже изменён: '+map.external_id,409);
    const key='nsl_crm_'+map.entity,value=map.external_id;let metadata=(meta.developerMetadata||[]).find(m=>m.metadataKey===key&&m.metadataValue===value);
    if(!metadata) {
      const sheetId=meta.sheets.find(s=>s.properties.title===sheet)?.properties.sheetId;if(sheetId==null)fail('WRITEBACK_CONFLICT','Лист перемещён или переименован',409);
      const result=await google(':batchUpdate',{requests:[{createDeveloperMetadata:{developerMetadata:{metadataKey:key,metadataValue:value,visibility:'DOCUMENT',location:{dimensionRange:{sheetId,dimension:'ROWS',startIndex:index,endIndex:index+1}}}}}]});metadata=result.replies[0].createDeveloperMetadata.developerMetadata;
    }
    const dataFilter={developerMetadataLookup:{metadataId:metadata.metadataId}};
    const anchored=await google('/values:batchGetByDataFilter',{dataFilters:[dataFilter],valueRenderOption:'UNFORMATTED_VALUE'});
    const row=anchored.valueRanges?.[0]?.valueRange?.values?.[0];if(String(row?.[1]||'')!==map.external_id)fail('WRITEBACK_CONFLICT','Строка перемещена во время сопоставления: '+map.external_id,409);
    updates.push({dataFilter,values:[[map.crm_id]],majorDimension:'ROWS'});
  }
  await google('/values:batchUpdateByDataFilter',{valueInputOption:'RAW',data:updates});
  const verified=await readSheet();for(const map of plan.newMappings){const grid=verified[map.entity==='blogger'?'Блогеры':'Размещения'];const rows=grid.slice(1).filter(r=>String(r[1]||'')===map.external_id);if(rows.length!==1||String(rows[0][0])!==map.crm_id)fail('WRITEBACK_CONFLICT','Не подтверждён возврат ID '+map.external_id,409);}
  const result={...op.result,writeback:{status:'complete',at:new Date().toISOString()}};await admin.from('blogger_operations').update({result}).eq('id',op.id);return result.writeback;
}
export async function operationRoute({admin,profile,access,path,request,url}) {
  if(!path.startsWith('/api/operations')&&!path.startsWith('/api/import')&&!['/api/access','/api/audit','/api/diagnostics','/api/work-export'].includes(path))return null;
  const body=request.method==='POST'?await request.json().catch(()=>({})):{};
  if(path==='/api/access') {
    if(access.role!=='owner')fail('FORBIDDEN','Только владелец управляет полномочиями',403);
    if(request.method==='GET'){const {data,error}=await admin.from('blogger_access').select('*');if(error)throw error;return {roles:data,permissions:PERMISSIONS};}
    if(request.method==='POST') {
      const {data:target}=await admin.from('blogger_access').select('*').eq('user_id',body.userId).maybeSingle();
      if(target?.role==='owner'||body.role!=='supervisor')fail('FORBIDDEN','Нельзя назначать или менять владельца через рабочий интерфейс',403);
      const permissions=Object.fromEntries(PERMISSIONS.map(p=>[p,body.permissions?.[p]===true]));
      const {error}=await admin.from('blogger_access').upsert({user_id:body.userId,role:'supervisor',permissions,updated_by:profile.id,updated_at:new Date().toISOString()});if(error)throw error;return {ok:true,permissions};
    }
  }
  if(path==='/api/audit'&&request.method==='GET') {requirePermission(access,'audit');const {data,error}=await admin.from('blogger_audit').select('*').order('id',{ascending:false}).limit(200);if(error)throw error;return {entries:data};}
  if(path==='/api/diagnostics'&&request.method==='GET') {
    requirePermission(access,'diagnose');requirePermission(access,'read_all');const m=await loadModel(admin);
    const {data:operations}=await admin.from('blogger_operations').select('id,kind,status,created_at,result').order('created_at',{ascending:false}).limit(100);
    return {issues:diagnostics(m),totals:totals(m),operations:(operations||[]).map(o=>({...o,result:o.result?{writeback:o.result.writeback,applied:o.result.applied}:null})),bloggers:[...m.bloggers.values()],placements:[...m.placements.values()],reports:m.reports.map(({images_json,...r})=>r),permissions:access.permissions};
  }
  if(path==='/api/work-export'&&request.method==='GET') {requirePermission(access,'export');requirePermission(access,'read_all');const m=await loadModel(admin);return {schemaVersion:1,exportedAt:new Date().toISOString(),bloggers:[...m.bloggers.values()],placements:[...m.placements.values()],reports:m.reports.map(({images_json,...r})=>r)};}
  if(path==='/api/import/status'&&request.method==='GET')return {configured:Boolean(env('BLOGGERS_GOOGLE_SERVICE_ACCOUNT_JSON')),spreadsheetId:WORKBOOK,mode:'manual'};
  if(path==='/api/import/preview'&&request.method==='POST') {
    requirePermission(access,'import_preview');requirePermission(access,'read_all');
    const [m,sheets,{data:mappings,error}]=await Promise.all([loadModel(admin),readSheet(),admin.from('blogger_external_ids').select('*').eq('spreadsheet_id',WORKBOOK)]);if(error)throw error;
    const plan=importPlan(m,sheets,mappings||[],access,{resolutions:body.resolutions||{}});plan.sheetHash=await hash(sheets);plan.writeback={status:'pending'};
    for(const map of plan.newMappings){const before=(mappings||[]).find(x=>x.entity===map.entity&&x.external_id===map.external_id)||null;const after={...map,spreadsheet_id:WORKBOOK};plan.changes.push(change('blogger_external_ids',before,after,{spreadsheet_id:WORKBOOK,entity:map.entity,external_id:map.external_id}));}
    return savePreview(admin,profile.id,'import_apply',body.reason||'Загрузка изменений из рабочей таблицы',plan,'google-sheets');
  }
  const retry=path.match(/^\/api\/import\/([0-9a-f-]{36})\/writeback$/);
  if(retry&&request.method==='POST') {
    requirePermission(access,'import_apply');const {data:op}=await admin.from('blogger_operations').select('*').eq('id',retry[1]).single();if(!op||op.kind!=='import_apply'||op.status!=='committed')fail('NOT_FOUND','Загрузка не найдена',404);return {writeback:await writeback(admin,op)};
  }
  if(path==='/api/operations/preview'&&request.method==='POST') {
    const m=await loadModel(admin);let plan;const kind=body.kind;
    if(kind==='edit_work')plan=editPlan(m,body,access);
    else if(kind==='archive')plan=archivePlan(m,body,access);
    else if(kind==='relink')plan=relinkPlan(m,body,access);
    else if(kind==='merge')plan=mergePlan(m,body,access);
    else if(kind==='undo') {
      requirePermission(access,'undo');const {data:op}=await admin.from('blogger_operations').select('*').eq('id',body.operationId).single();
      if(!op||op.status!=='committed'||op.kind==='import_apply')fail('UNDO_UNAVAILABLE','Отмена недоступна: импорт восстанавливается отдельным исправлением сопоставленных строк');
      plan={changes:[...(op.result?.changes||[])].reverse().map(c=>({table:c.table,key:c.key,before:c.after,after:c.before}))};
    } else if(kind==='recalculate') {requirePermission(access,'recalculate');plan={changes:[],recalculation:true,totals:totals(m),rules:'Действующие формулы клиента, без изменения коэффициентов'};}
    else fail('INVALID_OPERATION','Неизвестное исправление');
    plan.blocked=Boolean(plan.conflicts?.length);return savePreview(admin,profile.id,kind,body.reason,plan);
  }
  const match=path.match(/^\/api\/operations\/([0-9a-f-]{36})\/commit$/);
  if(match&&request.method==='POST') {
    if(body.confirm!==true)fail('CONFIRMATION_REQUIRED','Подтвердите результаты предварительного просмотра');
    const {data:op,error}=await admin.from('blogger_operations').select('*').eq('id',match[1]).single();if(error||!op)fail('NOT_FOUND','Проверка не найдена',404);
    if(op.actor!==profile.id&&access.role!=='owner')fail('FORBIDDEN','Чужая операция',403);requirePermission(access,op.kind==='legacy_write'?'edit_work':op.kind);
    if(op.kind==='import_apply'&&op.status!=='committed'&&await hash(await readSheet())!==op.plan.sheetHash)fail('SHEET_CHANGED','Таблица изменилась после проверки. Проверьте заново.',409);
    const result=await commit(admin,profile.id,op.id);
    if(op.kind==='import_apply') {
      try{return {...result,writeback:await writeback(admin,{...op,result})};}
      catch(error) {const writebackStatus={status:'pending',code:error.code||'GOOGLE_REQUEST_FAILED',message:error.message};await admin.from('blogger_operations').update({result:{...result,writeback:writebackStatus}}).eq('id',op.id);return {...result,writeback:writebackStatus};}
    }
    return result;
  }
  if(path==='/api/operations/bug-report'&&request.method==='POST') {
    requirePermission(access,'diagnose');const id=/^[a-zA-Z0-9|:@._-]{1,300}$/;
    return {report:{action:String(body.action||'').slice(0,500),expected:String(body.expected||'').slice(0,500),actual:String(body.actual||'').slice(0,500),time:new Date().toISOString(),ids:(body.ids||[]).filter(x=>id.test(String(x))).slice(0,30)},note:'Перед отправкой удалите имена, ссылки, контакты и другие персональные данные. Авторизация и содержимое записей не включены.'};
  }
  fail('METHOD_NOT_ALLOWED','Метод не поддерживается',405);
}
