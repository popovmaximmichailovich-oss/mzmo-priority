import {loadBaseData, loadLocalObjects, saveLocalObjects, clearLocalObjects} from './data.js';
import {createCalculator} from './calculator.js';
import {renderDashboard} from './dashboard.js';
import {exportJson, exportCsv, readJsonFile} from './export.js';

let fields=[], dicts={}, config={}, baseRows=[], rows=[], calcApi=null, selectedIndex=0, currentPage=1, filtered=[];
const $ = id => document.getElementById(id);

init();
async function init(){
  const loaded = await loadBaseData(); fields=loaded.fields; dicts=loaded.dicts; config=loaded.config; baseRows=loaded.objects; rows=loadLocalObjects()||structuredClone(baseRows); calcApi=createCalculator(fields,config);
  setupControls(); renderAll();
}
function setupControls(){
  $('btnReloadBase').onclick=()=>{ if(confirm('Восстановить исходную базу из data/objects.json? Локальные изменения будут удалены.')){clearLocalObjects(); rows=structuredClone(baseRows); selectedIndex=0; renderAll();} };
  $('btnExportJson').onclick=()=>exportJson(rows);
  $('btnExportCsv').onclick=()=>exportCsv(rows,fields);
  $('jsonImport').onchange=async e=>{const f=e.target.files[0]; if(!f)return; const data=await readJsonFile(f); if(!Array.isArray(data)) return alert('JSON должен быть массивом строк.'); rows=data; saveLocalObjects(rows); selectedIndex=0; renderAll();};
  $('btnApplyFilters').onclick=()=>{currentPage=1; renderTable();};
  $('searchInput').oninput=()=>{currentPage=1; renderTable();}; $('zoneFilter').onchange=()=>{currentPage=1; renderTable();}; $('typeFilter').onchange=()=>{currentPage=1; renderTable();}; $('qualityFilter').onchange=()=>{currentPage=1; renderTable();}; $('pageSize').onchange=()=>{currentPage=1; renderTable();}; $('fullMode').onchange=renderTable;
  $('objectSelect').onchange=e=>{selectedIndex=Number(e.target.value); renderForm();};
  $('btnSaveObject').onclick=()=>saveObjectFromForm(); $('btnPrint').onclick=()=>window.print();
  $('bulkField').onchange=renderBulkValueControl;
  $('btnBulkPreview').onclick=()=>bulkPreview();
  $('btnBulkApply').onclick=()=>bulkApply(false);
  $('btnBulkClear').onclick=()=>bulkApply(true);
  $('prevPage').onclick=()=>{if(currentPage>1){currentPage--; renderTable();}}; $('nextPage').onclick=()=>{const pages=Math.max(1,Math.ceil(filtered.length/Number($('pageSize').value))); if(currentPage<pages){currentPage++; renderTable();}};
}
function renderAll(){ fillSelects(); fillBulkFields(); renderDashboard($('dashboard'), rows, calcApi.calc, calcApi.label); renderForm(); renderTable(); }
function fillSelects(){
  const sel=$('objectSelect'); sel.innerHTML=rows.map((r,i)=>`<option value="${i}">${escapeHtml((r[0]||('AUTO-'+String(i+1).padStart(4,'0')))+' — '+(r[1]||'')+' — '+(r[2]||''))}</option>`).join(''); sel.value=selectedIndex;
  const zones=new Set(), types=new Set(); rows.forEach(r=>{zones.add(calcApi.calc(r).zone.key); types.add(calcApi.label(r[4]));});
  $('zoneFilter').innerHTML='<option value="">Все</option>'+[...zones].sort().map(z=>`<option>${z}</option>`).join('');
  $('typeFilter').innerHTML='<option value="">Все</option>'+[...types].sort().map(t=>`<option value="${escapeHtml(t)}">${escapeHtml(t)}</option>`).join('');
}

function editableFieldIndexes(){
  return fields.map((f,i)=>({f,i})).filter(x=>!(x.i>=42 && x.i!==49 && x.i!==53 && x.i!==54)).map(x=>x.i);
}
function fillBulkFields(){
  const bulk=$('bulkField');
  const previous=bulk.value;
  const items=editableFieldIndexes().filter(i=>i!==0); // ID не меняем массово
  bulk.innerHTML=items.map(i=>`<option value="${i}">${escapeHtml(fields[i].letter+'. '+fields[i].label)}</option>`).join('');
  if(previous && items.includes(Number(previous))) bulk.value=previous;
  renderBulkValueControl();
}
function renderBulkValueControl(){
  const i=Number($('bulkField').value);
  const f=fields[i];
  const select=$('bulkSelectValue');
  const input=$('bulkTextValue');
  if(f && f.type==='select' && f.dict && dicts[f.dict]){
    select.style.display='block'; input.style.display='none';
    select.innerHTML=dicts[f.dict].map(([v,t])=>`<option value="${escapeAttr(v)}">${escapeHtml(t)}</option>`).join('');
  } else {
    select.style.display='none'; input.style.display='block'; input.value='';
  }
  $('bulkStatus').textContent='Охват: не рассчитан.';
}
function bulkTargetIndexes(){
  const list=getFiltered();
  return list.map(x=>x.i);
}
function bulkValue(){
  const i=Number($('bulkField').value), f=fields[i];
  if(f && f.type==='select' && f.dict && dicts[f.dict]) return $('bulkSelectValue').value;
  return $('bulkTextValue').value;
}
function bulkPreview(){
  const targets=bulkTargetIndexes();
  const i=Number($('bulkField').value), f=fields[i];
  $('bulkStatus').textContent=`Охват: ${targets.length} объектов. Поле: ${f?.letter || ''} ${f?.label || ''}.`;
}
function bulkApply(clear){
  const targets=bulkTargetIndexes();
  if(!targets.length){ $('bulkStatus').textContent='Нет объектов в текущем фильтре.'; return; }
  const i=Number($('bulkField').value), f=fields[i];
  const val=clear ? '' : bulkValue();
  const msg = clear
    ? `Очистить поле «${f.letter}. ${f.label}» у ${targets.length} объектов текущего фильтра?`
    : `Проставить значение «${calcApi.label(val)}» в поле «${f.letter}. ${f.label}» для ${targets.length} объектов текущего фильтра?`;
  if(!confirm(msg)) return;
  targets.forEach(idx=>{ rows[idx][i]=val; });
  saveLocalObjects(rows);
  renderDashboard($('dashboard'), rows, calcApi.calc, calcApi.label);
  renderForm(); renderTable();
  $('bulkStatus').textContent=`Готово: обновлено ${targets.length} объектов. Для закрепления в GitHub нажмите «Экспорт JSON» и замените data/objects.json.`;
}

function renderForm(){
  const row=rows[selectedIndex]||rows[0]||[]; const c=calcApi.calc(row); $('objectSelect').value=selectedIndex;
  $('calcSummary').innerHTML = [
    ['Рейтинг',c.rating],['Зона',c.zone.title],['Достоверность',c.confidence+'%'],['Очередь',c.queue],['Рекомендация',c.recommendation],['Готовность',c.readiness]
  ].map((x,i)=>`<div class="summaryCard ${i===1?'zone'+c.zone.key:''}"><div class="name">${x[0]}</div><div class="value">${escapeHtml(x[1])}</div></div>`).join('') + `<div class="warns">${escapeHtml(calcApi.conclusion(row,c)).replace(/\n/g,'<br>')}</div>`;
  let html='', last=''; fields.forEach((f,i)=>{ if(f.section!==last){ last=f.section; html+=`<div class="fieldGroup">${escapeHtml(last)}</div>`; } const auto = i>=42 && i!==49 && i!==53 && i!==54; html+=fieldHtml(f,i,row[i],auto); });
  $('objectForm').innerHTML=html;
}
function fieldHtml(f,i,value,auto){
  const id='field_'+i; let control='';
  if(f.type==='select' && f.dict && dicts[f.dict]) control=`<select id="${id}" ${auto?'disabled':''}>${dicts[f.dict].map(([v,t])=>`<option value="${escapeAttr(v)}" ${String(value??'')===String(v)?'selected':''}>${escapeHtml(t)}</option>`).join('')}</select>`;
  else if(String(value??'').length>90 || f.type==='text') control=`<textarea id="${id}" ${auto?'readonly':''}>${escapeHtml(value??'')}</textarea>`;
  else control=`<input id="${id}" type="${f.type==='date'?'text':(f.type||'text')}" value="${escapeAttr(value??'')}" ${auto?'readonly':''}>`;
  return `<div class="field ${auto?'auto':''}"><label>${escapeHtml(f.letter+'. '+f.label)}</label>${control}</div>`;
}
function saveObjectFromForm(){
  const row=rows[selectedIndex]; fields.forEach((f,i)=>{ const el=$('field_'+i); if(el && !(i>=42 && i!==49 && i!==53 && i!==54)) row[i]=el.value; });
  saveLocalObjects(rows); renderDashboard($('dashboard'), rows, calcApi.calc, calcApi.label); renderForm(); renderTable(); alert('Изменения сохранены локально. Для обновления GitHub-базы экспортируйте JSON и замените data/objects.json.');
}
function getFiltered(){
  const q=$('searchInput').value.trim().toLowerCase(); const z=$('zoneFilter').value; const t=$('typeFilter').value; const qual=$('qualityFilter').value;
  return rows.map((r,i)=>({r,i,c:calcApi.calc(r)})).filter(x=>{
    const hay=[x.r[0],x.r[1],x.r[2],x.r[3],calcApi.label(x.r[4]),calcApi.label(x.r[6])].join(' ').toLowerCase();
    if(q && !hay.includes(q)) return false; if(z && x.c.zone.key!==z) return false; if(t && calcApi.label(x.r[4])!==t) return false;
    const bad=x.c.confidence<70||x.c.actuality.score>=2||x.c.mismatch; if(qual==='bad'&&!bad) return false; if(qual==='ok'&&bad) return false; return true;
  }).sort((a,b)=>b.c.rating-a.c.rating);
}
function renderTable(){
  filtered=getFiltered(); const pageSize=Number($('pageSize').value); const pages=Math.max(1,Math.ceil(filtered.length/pageSize)); currentPage=Math.min(currentPage,pages); const start=(currentPage-1)*pageSize; const part=filtered.slice(start,start+pageSize);
  $('pageInfo').textContent=`${currentPage} / ${pages} · найдено ${filtered.length}`;
  const full=$('fullMode').checked; const cols=full?fields:fields.slice(0,8).concat(fields.slice(42,55));
  const table=$('registryTable'); table.innerHTML=`<thead><tr>${cols.map(f=>`<th>${escapeHtml(f.letter)}<br>${escapeHtml(f.label)}</th>`).join('')}<th>Норм. рейтинг</th><th>Достоверность</th><th>Рекомендация</th><th></th></tr></thead><tbody>${part.map(x=>rowHtml(x,cols)).join('')}</tbody>`;
}
function rowHtml(x,cols){ const r=x.r,c=x.c; return `<tr>${cols.map(f=>`<td>${escapeHtml(displayValue(r[fields.indexOf(f)]))}</td>`).join('')}<td><b>${c.rating}</b></td><td>${c.confidence}%</td><td>${escapeHtml(c.recommendation)}</td><td><button class="ghost" onclick="window.__openRow(${x.i})">Открыть</button></td></tr>`; }
window.__openRow = i => { selectedIndex=i; renderForm(); $('objectSelect').value=i; window.scrollTo({top:0,behavior:'smooth'}); };
function displayValue(v){return calcApi.label(v)==='нет данных'?'':calcApi.label(v)}
function escapeHtml(s){return String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]))}
function escapeAttr(s){return escapeHtml(s)}
