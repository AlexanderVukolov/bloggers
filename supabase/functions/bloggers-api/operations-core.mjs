// Shared, deterministic domain rules. No network, credentials or client authority.
export const PERMISSIONS = Object.freeze([
  'read_all','edit_work','assign','dictionaries','import_preview','import_apply',
  'export','audit','diagnose','relink','merge','archive','undo','recalculate',
]);
export class OperationError extends Error {
  constructor(code, message, status = 400, details = undefined) { super(message); Object.assign(this, {code,status,details}); }
}
export const fail = (code,message,status=400,details) => { throw new OperationError(code,message,status,details); };
export const clone = value => JSON.parse(JSON.stringify(value));
export const canonical = value => JSON.stringify(sort(value));
function sort(v) { return Array.isArray(v) ? v.map(sort) : v && typeof v==='object' ? Object.fromEntries(Object.keys(v).sort().map(k=>[k,sort(v[k])])) : v; }
export const equal = (a,b) => canonical(a ?? null) === canonical(b ?? null);
export const identity = v => String(v||'').trim().toLowerCase().replace(/^(ig|tg|vk):/,'').replace(/^https?:\/\/(www\.)?(instagram\.com|t\.me|vk\.com|vk\.ru)\//,'').replace(/^@/,'').split(/[?#]/)[0].replace(/\/+$/,'');
export function placementKey(p) { return p.stablePlacementKey || ['placement-v2',p.sourceKey||p.tag||'',p.sortDate||p.start||'',p.type||'',p.dealType||'',p.id??''].join('|'); }
export function model(rows, reports=[],links=[],contracts=[],actuals=[],schedules=[]) {
  const bloggers = new Map(), placements = new Map();
  for (const r of rows) {
    if (r.namespace==='bootstrap_bloggers') for (const b of r.value_json||[]) bloggers.set(String(b.id),clone(b));
    if (r.namespace==='bootstrap_placements') for (const p of r.value_json||[]) placements.set(String(p.id),clone(p));
  }
  const ordered = [...rows].sort((a,b)=>String(a.updated_at).localeCompare(String(b.updated_at)));
  for (const r of ordered) {
    if (['blogger','blogger_create'].includes(r.namespace)) bloggers.set(String(r.value_json.id??r.record_key),{...bloggers.get(String(r.record_key)),...clone(r.value_json)});
    if (r.namespace==='placement') placements.set(String(r.value_json.id??r.record_key),{...placements.get(String(r.record_key)),...clone(r.value_json)});
    if (r.namespace==='blogger_contract' && bloggers.has(String(r.record_key))) Object.assign(bloggers.get(String(r.record_key)),r.value_json);
  }
  for (const r of rows.filter(r=>r.namespace==='placement_delete')) {
    const p = placements.get(String(r.record_key)); if(p) p.excludedFromCalculations=true;
  }
  return {rows,bloggers,placements,reports,links,contracts,actuals,schedules};
}
export function permission(access,p) { return access?.role==='owner' || (access?.role==='supervisor' && access.permissions?.[p]===true); }
export function requirePermission(access,p) { if (!permission(access,p)) fail('FORBIDDEN','Недостаточно прав: '+p,403); }
export function managerNames(employee,profile) { return new Set([employee?.name,employee?.assigned_manager,profile?.name,...(employee?.history_aliases||[])].filter(Boolean)); }
export function inScope(v,access) {
  if (access.role==='owner' || permission(access,'read_all')) return true;
  const names=access.names||new Set(); return v && Object.hasOwn(v,'manager') ? names.has(v.manager) : names.has(v?.name);
}
export function effectiveModel(m) {
  const actuals=new Map(m.actuals.map(a=>[a.placement_key,a]));
  return [...m.placements.values()].filter(p=>!p.excludedFromCalculations).map(p=>({...p,actual:actuals.has(placementKey(p))?actuals.get(placementKey(p)).actual:p.actual}));
}
export function totals(m) {
  const result={placements:0,guaranteed:0,actual:0,clicks:0,byProject:{}}; const packages=new Set();
  for(const p of effectiveModel(m)) {
    result.placements++; const brand=p.brand||'Не указан'; const t=result.byProject[brand] ||= {guaranteed:0,actual:0,clicks:0};
    const key=p.packageId ? `${p.packageId}|${brand}` : `id:${p.id}`;
    const guarantee=packages.has(key)?0:Number(p.guaranteed||0); packages.add(key);
    result.guaranteed+=guarantee;t.guaranteed+=guarantee;
    result.actual+=Number(p.actual||0);t.actual+=Number(p.actual||0);
    result.clicks+=Number(p.clicks||0);t.clicks+=Number(p.clicks||0);
  }
  return result;
}
export const FIELDS={
  blogger:['name','display','link','platforms','brand','manager','status','commercialContract','barterContract','cooperationType','plannedReach','comment','category','chatLink'],
  placement:['bloggerId','brand','manager','type','sortDate','warmupStart','warmupEnd','guaranteed','actual','clicks','contentLink','statisticsLink','status','decision','dealType','comment','cost','brief','contract','chatLink','packageId','packageGuaranteeOwner'],
  report:['blogger','blogger_id','exit_date','reach','clicks','status','comment'],
};
const NUMBERS=new Set(['plannedReach','guaranteed','actual','clicks','cost','reach']);
export function isoDate(v) {
  if(typeof v==='number') return new Date(Date.UTC(1899,11,30)+Math.round(v)*86400000).toISOString().slice(0,10);
  const raw=String(v||'').trim(), parts=raw.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
  const date=parts?`${parts[3]}-${parts[2].padStart(2,'0')}-${parts[1].padStart(2,'0')}`:raw;
  const parsed=new Date(date+'T00:00:00Z');
  if(!/^\d{4}-\d{2}-\d{2}$/.test(date)||Number.isNaN(+parsed)||parsed.toISOString().slice(0,10)!==date) fail('INVALID_DATE','Некорректная дата: '+raw);
  return date;
}
export function patch(entity,current,values,{blankMeansUnchanged=true}={}) {
  const out=clone(current||{});
  for(const [key,input] of Object.entries(values||{})) {
    if(!FIELDS[entity]?.includes(key)) fail('UNKNOWN_FIELD','Недоступное поле: '+key);
    if((input===''||input===null||input===undefined)&&blankMeansUnchanged) continue;
    if(input==='⟦ОЧИСТИТЬ⟧'||(input&&typeof input==='object'&&!Array.isArray(input)&&input.clear===true)) { out[key]=null;continue; }
    let value=input;
    if(NUMBERS.has(key)) { value=typeof input==='number'?input:Number(String(input).replace(/[\s\u00a0₽]/g,'').replace(',','.'));if(!Number.isFinite(value)||value<0||value>1000000000) fail('INVALID_NUMBER','Недопустимое число: '+key); if(key!=='cost'&&!Number.isInteger(value))fail('INVALID_NUMBER','Нужно целое число: '+key); }
    else if(['sortDate','warmupStart','warmupEnd','exit_date'].includes(key)) value=isoDate(value);
    else if(key==='platforms') { value=Array.isArray(value)?value:String(value).split(/[,;+]/).map(x=>({Instagram:'ig',Telegram:'tg',VK:'vk',Threads:'threads'}[x.trim()]||x.trim())); if(value.some(x=>!['ig','tg','vk','threads','yt','tt'].includes(x)))fail('INVALID_PLATFORM','Выберите конкретные площадки'); }
    else {value=String(value).trim();if(value.length>4000)fail('FIELD_TOO_LONG','Поле слишком длинное: '+key); if(/Link$|^link$/.test(key)&&value&&!/^https?:\/\//i.test(value)) fail('INVALID_URL','Нужна ссылка http(s): '+key);}
    out[key]=value;
  }
  if(out.brand&&!['ЛН','FIT PRO','Оба'].includes(out.brand))fail('INVALID_PROJECT','Неизвестный проект');
  if(entity==='placement') {
    if(current?.id!=null) out.stablePlacementKey=placementKey(current);
    if(out.sortDate) out.start=out.sortDate.split('-').reverse().join('.');
    if(out.warmupEnd&&out.warmupStart&&out.warmupEnd<out.warmupStart)fail('INVALID_PERIOD','Окончание раньше начала');
    if(!/stories|сторис|истори/i.test(out.type||'')&&out.warmupStart&&out.warmupEnd&&out.warmupEnd!==out.warmupStart) fail('INVALID_PERIOD','Период прогрева допустим только для Stories');
  }
  return out;
}
export function change(table,before,after,key) { return {table,key,before:before??null,after:after??null}; }
export function rowChange(m,namespace,key,value) {
  const before=m.rows.find(r=>r.namespace===namespace&&r.record_key===String(key));
  return change('blogger_shared_state',before||null,{namespace,record_key:String(key),value_json:value}, {namespace,record_key:String(key)});
}
export function entityChange(m,entity,id,value) {
  const ns=entity==='blogger'?(m.rows.some(r=>r.namespace==='blogger_create'&&r.record_key===String(id))?'blogger_create':'blogger'):'placement';
  return rowChange(m,ns,id,value);
}
export function withPlacement(m,p,changes) {
  changes.push(entityChange(m,'placement',p.id,p));
  const a=m.actuals.find(a=>a.placement_key===placementKey(p));
  if(a&&!equal(Number(a.actual),p.actual)&&p.actual!=null) {
    const formats=Object.keys(a.facts_json||{}); if(formats.length>1)fail('FORMAT_CONFLICT','У размещения несколько фактов по форматам. Сначала уточните разбивку.');
    const format=/stories|сторис/i.test(p.type)?'stories':/reels|рилс/i.test(p.type)?'reels':/карусел/i.test(p.type)?'carousel':'post';
    changes.push(change('blogger_reach_actuals',a,{...a,actual:p.actual,facts_json:{[format]:p.actual}},{placement_key:a.placement_key}));
  }
}
function validateManager(m,value) { if(value&&!m.managers?.has(value))fail('INVALID_MANAGER','Неизвестный или неактивный ответственный: '+value); }
export function editPlan(m,body,access) {
  requirePermission(access,'edit_work'); const {entity,id,values}=body;
  if(!['blogger','placement','report'].includes(entity))fail('INVALID_ENTITY','Выберите тип записи');
  const current=entity==='report'?m.reports.find(r=>r.id===id):m[entity==='blogger'?'bloggers':'placements'].get(String(id));
  if(!current)fail('NOT_FOUND','Запись не найдена',404);
  if(values.manager!==undefined&&!equal(current.manager,values.manager))requirePermission(access,'assign');
  const updated=patch(entity,current,values);validateManager(m,updated.manager);
  const changes=[];
  if(entity==='placement') {
    if(!m.bloggers.has(String(updated.bloggerId))&&values.bloggerId!==undefined)fail('INVALID_LINK','Карточка блогера не найдена');
    if(values.bloggerId!==undefined)requirePermission(access,'relink');withPlacement(m,updated,changes);
  } else if(entity==='blogger') changes.push(entityChange(m,entity,id,updated));
  else changes.push(change('blogger_evidence_reports',current,updated,{id}));
  return {changes};
}
export function archivePlan(m,{entity,id,excluded=true,reason},access) {
  requirePermission(access,'archive');if(!String(reason||'').trim())fail('REASON_REQUIRED','Укажите причину');
  const changes=[];
  if(entity==='report') {const r=m.reports.find(r=>r.id===id);if(!r)fail('NOT_FOUND','Отчёт не найден',404);changes.push(change('blogger_evidence_reports',r,{...r,excluded_from_calculations:excluded,exclusion_reason:reason},{id}));}
  else {const r=m[entity==='blogger'?'bloggers':'placements']?.get(String(id));if(!r)fail('NOT_FOUND','Запись не найдена',404);changes.push(entityChange(m,entity,id,{...r,excludedFromCalculations:excluded,exclusionReason:reason}));if(entity==='blogger'&&[...m.placements.values()].some(p=>String(p.bloggerId)===String(id)&&!p.excludedFromCalculations))fail('HAS_LINKS','Сначала перенесите или исключите связанные размещения');}
  return {changes};
}
export function relinkPlan(m,{entity,id,bloggerId,placementId},access) {
  requirePermission(access,'relink');const b=m.bloggers.get(String(bloggerId));if(!b||b.excludedFromCalculations)fail('INVALID_LINK','Активная карточка блогера не найдена');
  const changes=[];
  if(entity==='placement') {const p=m.placements.get(String(id));if(!p)fail('NOT_FOUND','Размещение не найдено',404);withPlacement(m,{...p,stablePlacementKey:placementKey(p),bloggerId:b.id,tag:b.name,bloggerLink:b.link},changes);}
  else if(entity==='report') {
    const r=m.reports.find(r=>r.id===id), p=m.placements.get(String(placementId));
    if(!r||!p||String(p.bloggerId)!==String(bloggerId))fail('INVALID_LINK','Выберите отчёт и размещение выбранного блогера');
    changes.push(change('blogger_evidence_reports',r,{...r,blogger_id:String(b.id),blogger:b.name},{id:r.id}));
    for(const l of m.links.filter(l=>l.report_id===id))changes.push(change('blogger_evidence_placement_links',l,null,{report_id:id,placement_key:l.placement_key}));
    const key=placementKey(p), old=m.links.find(l=>l.report_id===id&&l.placement_key===key);
    const after={report_id:id,placement_key:key,project:p.brand||'',format:p.type||''};
    const i=changes.findIndex(c=>c.table==='blogger_evidence_placement_links'&&c.key.placement_key===key);if(i>=0)changes.splice(i,1);
    changes.push(change('blogger_evidence_placement_links',old||null,after,{report_id:id,placement_key:key}));
  } else fail('INVALID_ENTITY','Можно перепривязать размещение или отчёт');
  return {changes};
}
export function mergePlan(m,{sourceId,targetId,choices={}},access) {
  requirePermission(access,'merge');if(String(sourceId)===String(targetId))fail('INVALID_MERGE','Выберите разные карточки');
  const s=m.bloggers.get(String(sourceId)),t=m.bloggers.get(String(targetId));if(!s||!t||s.excludedFromCalculations||t.excludedFromCalculations)fail('INVALID_MERGE','Нужны две активные карточки');
  const merged=clone(t),conflicts=[];
  for(const f of FIELDS.blogger) {if(equal(s[f],t[f])||s[f]==null||s[f]==='')continue; if(t[f]==null||t[f]===''){merged[f]=s[f];continue;}if(!['source','target'].includes(choices[f]))conflicts.push({field:f,source:s[f],target:t[f]});else if(choices[f]==='source')merged[f]=s[f];}
  if(conflicts.length) return {changes:[],conflicts};
  const changes=[entityChange(m,'blogger',t.id,merged),entityChange(m,'blogger',s.id,{...s,excludedFromCalculations:true,mergedInto:t.id})];
  for(const p of m.placements.values()) if(String(p.bloggerId)===String(s.id))withPlacement(m,{...p,stablePlacementKey:placementKey(p),bloggerId:t.id,tag:merged.name,bloggerLink:merged.link},changes);
  // Never move unconfirmed nickname-only relationships. Surface them for explicit repair.
  const ambiguous=[...m.placements.values()].filter(p=>p.bloggerId==null&&identity(p.sourceKey||p.tag)===identity(s.name));
  const other=[...m.bloggers.values()].some(b=>String(b.id)!==String(s.id)&&String(b.id)!==String(t.id)&&!b.excludedFromCalculations&&identity(b.name)===identity(s.name));
  if(ambiguous.length&&(other||identity(s.name)!==identity(t.name)))fail('AMBIGUOUS_LINK','Сначала явно привяжите размещения: '+ambiguous.map(p=>p.id).join(', '));
  for(const p of ambiguous)withPlacement(m,{...p,stablePlacementKey:placementKey(p),bloggerId:t.id,tag:merged.name,bloggerLink:merged.link},changes);
  for(const r of m.reports.filter(r=>String(r.blogger_id)===String(s.id)||(!r.blogger_id&&!other&&identity(s.name)===identity(t.name)&&identity(r.blogger)===identity(s.name))))changes.push(change('blogger_evidence_reports',r,{...r,blogger_id:String(t.id),blogger:merged.name},{id:r.id}));
  const contractKeys=[String(s.id),...(!other&&identity(s.name)===identity(t.name)?[s.sourceKey,s.name].filter(Boolean):[])];
  for(const r of m.contracts.filter(r=>contractKeys.includes(String(r.blogger_key))))changes.push(change('blogger_contracts',r,{...r,blogger_key:String(t.id)},{id:r.id}));
  for(const r of (m.mappings||[]).filter(r=>r.entity==='blogger'&&String(r.crm_id)===String(s.id)))changes.push(change('blogger_external_ids',r,{...r,crm_id:String(t.id),baseline:merged},{spreadsheet_id:r.spreadsheet_id,entity:r.entity,external_id:r.external_id}));
  return {changes,conflicts:[]};
}
export const SHEETS={
  bloggers:{name:'Блогеры',entity:'blogger',id:'ID CRM',external:'Резервный ID',fields:{'Название / имя':'display','Ник':'name','Ссылка на профиль':'link','Площадки':'platforms','Проект':'brand','Ответственный':'manager','Статус карточки':'status','Условия сотрудничества':'cooperationType','Чат с блогером':'chatLink','Договор коммерция':'commercialContract','Договор бартер':'barterContract','Гарант карточки':'plannedReach','Комментарий менеджера':'comment'}},
  placements:{name:'Размещения',entity:'placement',id:'ID размещения CRM',external:'Резервный ID',fields:{'Резервный ID блогера':'bloggerId','Проект':'brand','Менеджер':'manager','Формат':'type','Сотрудничество':'dealType','Дата выхода / начало Stories':'sortDate','Дата окончания':'warmupEnd','Фактический охват':'actual','Клики':'clicks','Гарант охвата':'guaranteed','Ссылка на публикацию':'contentLink','Ссылка на статистику':'statisticsLink','Статус размещения':'status','Решение':'decision','Стоимость, ₽':'cost','Комментарий менеджера':'comment','Рабочий чат':'chatLink','Статус ТЗ':'brief','Статус договора':'contract','ID пакета':'packageId'}},
};
export function importPlan(m,sheets,mappings,access,{resolutions={},uuid=()=>crypto.randomUUID()}={}) {
  requirePermission(access,'import_preview');const changes=[],newMappings=[],rows=[],reserved=new Map(),seen=new Set(),claimed=new Set();
  const working={...m,bloggers:new Map(m.bloggers),placements:new Map(m.placements)};
  for(const spec of Object.values(SHEETS)) {
    const grid=sheets[spec.name];if(!Array.isArray(grid)||!grid.length)fail('MISSING_SHEET','Нет листа '+spec.name);
    const headers=grid[0].map(h=>String(h||'').trim());const h=new Map(headers.map((v,i)=>[v,i]));
    for(const needed of [spec.id,spec.external,...(spec.entity==='placement'?['Резервный ID блогера','Формат']:['Ник'])])if(!h.has(needed))fail('MISSING_COLUMN',spec.name+': нет столбца '+needed);
    if(new Set(headers.filter(Boolean)).size!==headers.filter(Boolean).length)fail('DUPLICATE_HEADER',spec.name+': повторяются названия столбцов');
    for(let index=1;index<grid.length;index++) {
      const cells=grid[index]||[];if(!cells.some(v=>v!=null&&v!==''))continue;
      const result={sheet:spec.name,row:index+1,entity:spec.entity,action:'error'};rows.push(result);
      try {
        const ext=String(cells[h.get(spec.external)]||'').trim(),rawId=String(cells[h.get(spec.id)]??'').trim();result.externalId=ext;
        if(!ext)fail('MISSING_ID','Нет постоянного резервного ID; задайте его до загрузки');
        const token=`${spec.entity}:${ext}`;if(seen.has(token))fail('DUPLICATE_ID','Резервный ID повторяется в листе');seen.add(token);
        const mapping=mappings.find(x=>x.entity===spec.entity&&x.external_id===ext);
        const resolution=resolutions[token];let id=rawId||mapping?.crm_id||(resolution==='NEW'?'':resolution)||'';
        if(mapping&&rawId&&String(mapping.crm_id)!==rawId)fail('ID_CONFLICT','CRM ID отличается от сохранённого сопоставления');
        const records=working[spec.entity==='blogger'?'bloggers':'placements'];let current=id?records.get(String(id)):undefined;
        if(id&&!current)fail('UNKNOWN_ID','CRM ID не найден: '+id);
        if(current&&current.excludedFromCalculations)fail('ARCHIVED','Запись в архиве; сначала восстановите её');
        const values={};for(const [header,field] of Object.entries(spec.fields))if(h.has(header))values[field]=cells[h.get(header)];
        if(spec.entity==='blogger'&&!id) {
          const matches=[...working.bloggers.values()].filter(b=>identity(b.name||b.link)===identity(values.name||values.link));
          if(matches.length&&resolution!=='NEW')fail('MAPPING_REQUIRED','Есть карточки с таким ником: выберите CRM ID или подтвердите отдельную новую карточку',409,{candidates:matches.map(b=>({id:b.id,name:b.name,project:b.brand,manager:b.manager}))});
        }
        if(spec.entity==='placement') {
          const bExt=String(values.bloggerId||'').trim();const bloggerId=reserved.get(bExt)||mappings.find(x=>x.entity==='blogger'&&x.external_id===bExt)?.crm_id;
          if(!bloggerId)fail('BLOGGER_MAPPING_REQUIRED','Не сопоставлен резервный ID блогера: '+bExt);
          values.bloggerId=String(bloggerId);const b=working.bloggers.get(String(bloggerId));if(!b)fail('INVALID_LINK','Нет связанной карточки');
          if(!values.type&&!current?.type)fail('MISSING_FORMAT','Не указан формат');
          if(!current&&!values.sortDate)fail('MISSING_DATE','Не указана дата выхода');
          if(!id) {
            const candidates=[...working.placements.values()].filter(p=>String(p.bloggerId)===String(bloggerId)&&values.sortDate&&p.sortDate===isoDate(values.sortDate)&&String(p.type).toLowerCase()===String(values.type).toLowerCase());
            if(candidates.length&&resolution!=='NEW')fail('MAPPING_REQUIRED','Похожее размещение: выберите CRM ID или подтвердите повторный выход',409,{candidates:candidates.map(p=>({id:p.id,name:p.tag,project:p.brand,date:p.sortDate}))});
          }
          if(!current&&/stories|сторис/i.test(values.type||'')) {values.warmupStart=values.sortDate; if(!values.warmupEnd) {values.warmupEnd=new Date(+new Date(isoDate(values.sortDate)+'T00:00:00Z')+4*86400000).toISOString().slice(0,10); result.suggestedEnd=values.warmupEnd;} }
          if(current&&values.sortDate&&/stories|сторис/i.test(values.type||current.type||''))values.warmupStart=values.sortDate;
          if(!current&&!/stories|сторис/i.test(values.type||'')) {if(!values.warmupEnd)values.warmupEnd=values.sortDate;values.warmupStart=values.sortDate;}
          if(!current)current={tag:b.name,bloggerLink:b.link,sourceKey:`blogger-${bloggerId}`,brand:b.brand,manager:b.manager,actual:null,clicks:null,guaranteed:0,dealType:'Бартер'};
        }
        const exists=Boolean(id);if(!id)id=`${spec.entity==='blogger'?'b':'p'}-${uuid()}`;
        if(claimed.has(spec.entity+':'+id))fail('DUPLICATE_TARGET','Две строки обновляют один CRM ID');claimed.add(spec.entity+':'+id);
        const next=patch(spec.entity,current||{},values);next.id=current?.id??id;
        if(spec.entity==='placement')next.stablePlacementKey=next.stablePlacementKey||placementKey(next);
        validateManager(m,next.manager);if(!exists&&!next.manager)fail('MISSING_MANAGER','Укажите ответственного');
        if(spec.entity==='blogger'&&!next.name)fail('MISSING_NAME','Не указан ник блогера');
        if(mapping?.baseline)for(const field of FIELDS[spec.entity])if(values[field]!==undefined&&values[field]!==null&&values[field]!==''&&!equal(current?.[field],mapping.baseline[field])&&!equal(next[field],mapping.baseline[field])&&!equal(next[field],current?.[field]))fail('CONFLICT','Поле изменено в CRM и таблице: '+field,409,{field,baseline:mapping.baseline[field],crm:current?.[field],sheet:next[field]});
        if(!exists||!equal(current,next)){if(spec.entity==='placement')withPlacement(m,next,changes);else changes.push(entityChange(m,spec.entity,id,next));}
        records.set(String(id),next);if(spec.entity==='blogger')reserved.set(ext,id);
        newMappings.push({entity:spec.entity,external_id:ext,crm_id:String(id),baseline:next});
        Object.assign(result,{crmId:String(id),action:exists?(equal(current,next)?'skip':'update'):'create',before:exists?current:null,after:next});
      } catch(error) {Object.assign(result,{code:error.code||'INVALID_ROW',reason:error.message,details:error.details});}
    }
  }
  // A package guarantee belongs to exactly one explicitly chosen placement.
  const groups=new Map();for(const p of working.placements.values())if(p.packageId&&!p.excludedFromCalculations)(groups.get(p.packageId)||groups.set(p.packageId,[]).get(p.packageId)).push(p);
  for(const [id,group] of groups)if(group.filter(p=>Number(p.guaranteed)>0).length>1)rows.push({sheet:'Размещения',row:null,action:'error',code:'PACKAGE_GUARANTEE_CONFLICT',reason:'Общий гарант пакета '+id+' указан более одного раза'});
  return {changes,newMappings,rows,blocked:rows.some(r=>r.action==='error'),before:totals(m),after:totals(working)};
}
export function diagnostics(m,now=new Date().toISOString().slice(0,10)) {
  const issues=[],byName=new Map(),byPlacement=new Map();const push=(code,message,entity,ids,extra={})=>issues.push({code,message,entity,ids:ids.map(String),...extra});
  for(const b of m.bloggers.values()) {if(b.excludedFromCalculations)continue;const key=identity(b.name||b.link);if(key)(byName.get(key)||byName.set(key,[]).get(key)).push(b);if(!['ЛН','FIT PRO','Оба'].includes(b.brand))push('PROJECT','Неверный проект','blogger',[b.id]);if(m.managers&&!m.managers.has(b.manager))push('MANAGER','Ответственный не найден или неактивен','blogger',[b.id]);}
  for(const group of byName.values())if(group.length>1)push('POSSIBLE_DUPLICATE','Совпадает ник. Требуется подтверждение; карточки могут быть разными.','blogger',group.map(b=>b.id));
  const effective=effectiveModel(m);
  for(const p of effective) {
    const key=[p.bloggerId||identity(p.sourceKey||p.tag),p.sortDate,p.type,p.brand].join('|');(byPlacement.get(key)||byPlacement.set(key,[]).get(key)).push(p);
    if(p.bloggerId==null||!m.bloggers.has(String(p.bloggerId)))push('BROKEN_LINK','Нет подтверждённой связи по ID','placement',[p.id]);
    if(!['ЛН','FIT PRO','Оба'].includes(p.brand))push('PROJECT','Неверный проект','placement',[p.id]);
    if(m.managers&&!m.managers.has(p.manager))push('MANAGER','Ответственный не найден или неактивен','placement',[p.id]);
    if((p.warmupEnd||p.sortDate||'9999')<now&&p.actual==null)push('MISSING_STATS','Выход без статистики','placement',[p.id]);
  }
  for(const group of byPlacement.values())if(group.length>1)push('POSSIBLE_DUPLICATE','Похожие размещения; повторный выход может быть отдельным','placement',group.map(p=>p.id));
  const keys=new Map([...m.placements.values()].map(p=>[placementKey(p),p]));
  for(const a of m.actuals)if(!keys.has(a.placement_key))push('FACT_OUTSIDE_REGISTER','Факт внесён, связанное размещение не найдено','actual',[a.placement_key]);
  for(const r of m.reports) {
    if(r.excluded_from_calculations)continue;const links=m.links.filter(l=>l.report_id===r.id);
    if(!links.length)push('REPORT_UNLINKED','Отчёт без явной связи с размещением','report',[r.id]);
    for(const l of links) {const p=keys.get(l.placement_key);if(!p)push('REPORT_BROKEN_LINK','Отчёт ссылается на неизвестное размещение','report',[r.id]);else if(p.actual!=null&&Number(r.reach)!==Number(p.actual))push('FACT_DISCREPANCY','Различаются факт реестра и отчёта; проверьте состав и формат','report',[r.id],{placementId:String(p.id),registry:p.actual,report:r.reach});}
  }
  return issues;
}
