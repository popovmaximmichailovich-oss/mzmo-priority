import {loadBaseData, loadLocalObjects, saveLocalObjects, clearLocalObjects} from './data.js';
import {createCalculator} from './calculator.js';
import {renderDashboard} from './dashboard.js';
import {exportJson, exportCsv, exportExcel, readJsonFile} from './export.js';

let fields=[], dicts={}, config={}, baseRows=[], rows=[], calcApi=null, selectedIndex=0, currentPage=1, fullPage=1, filtered=[], wizardStep=0;
const $ = id => document.getElementById(id);
const scenarios = {
  balanced:{name:'Сбалансированная', weights:{F1:30,F2:20,F3:15,F4:20,F5:10,F6:5}},
  technical:{name:'Технический риск', weights:{F1:45,F2:15,F3:10,F4:20,F5:5,F6:5}},
  access:{name:'Безальтернативность', weights:{F1:20,F2:35,F3:10,F4:15,F5:15,F6:5}},
  legal:{name:'Надзорные риски', weights:{F1:20,F2:10,F3:10,F4:40,F5:10,F6:10}},
  load:{name:'Медицинская нагрузка', weights:{F1:20,F2:15,F3:10,F4:15,F5:15,F6:25}}
};
const formSections = [
  '1.1 Идентификация объекта','1.2 Техническое состояние и строительный риск','1.3 Программный/управленческий блок','1.4 Население',
  '2.1 Территориальная доступность','2.2 Медицинская нагрузка (для поликлиник)','2.3 Медицинская нагрузка (для стационаров)','2.4 Специализированная помощь',
  '2.5 Надзор и юридические риски','3. Автоматическая оценка по аналогии'
];
const wizardGroups = [
  {name:'Паспорт', letters:['A','B','C','D','E','F','G','H']},
  {name:'Техническое состояние', letters:['I','J','K','L','M','N']},
  {name:'Доступность', letters:['R','S','T','U']},
  {name:'Медицинская роль', letters:['V','W','X','Y','Z','AA','AB','AC','AD','AE','AF','AG','AH','AI','AJ','AK','AL']},
  {name:'Надзорные риски', letters:['P','Q','AM','AN','AO','AP']},
  {name:'Итог', letters:['AX','BB','BC']}
];

init();

async function init(){
  const loaded = await loadBaseData();
  fields = loaded.fields; dicts = loaded.dicts; config = loaded.config; baseRows = loaded.objects;
  rows = loadLocalObjects() || structuredClone(baseRows);
  config.weights = scenarios.balanced.weights;
  calcApi = createCalculator(fields, config);
  setupControls();
  renderAll();
}

function rebuildCalculator(){
  const sc = $('scenarioSelect').value || 'balanced';
  config.weights = scenarios[sc].weights;
  calcApi = createCalculator(fields, config);
}

function setupControls(){
  $('scenarioSelect').innerHTML = Object.entries(scenarios).map(([k,v])=>`<option value="${k}">${v.name}</option>`).join('');
  $('scenarioSelect').onchange = () => { rebuildCalculator(); renderAll(); };
  $('btnReloadBase').onclick = () => {
    if(confirm('Восстановить исходную базу из data/objects.json? Локальные изменения будут удалены.')){
      clearLocalObjects(); rows = structuredClone(baseRows); selectedIndex=0; currentPage=1; renderAll();
    }
  };
  $('btnExportJson').onclick = () => exportJson(rows);
  $('btnExportCsv').onclick = () => exportCsv(buildExportRows(), buildExportFields());
  $('btnExportXls').onclick = () => exportExcel(buildExportRows(), buildExportFields());
  $('btnPrintCard').onclick = () => { showTab('decision'); window.print(); };
  $('jsonImport').onchange = async e => {
    const f=e.target.files[0]; if(!f) return;
    const data = await readJsonFile(f);
    if(!Array.isArray(data)) return alert('JSON должен быть массивом строк.');
    rows=data; saveLocalObjects(rows); selectedIndex=0; currentPage=1; renderAll();
  };
  ['searchInput','zoneFilter','typeFilter','qualityFilter','pageSize'].forEach(id=>{
    $(id).oninput = $(id).onchange = () => { currentPage=1; renderTable(); renderDashboard($('dashboard'), getFilteredRaw(), calcApi.calc, calcApi.label); };
  });
  $('btnApplyFilters').onclick = () => { currentPage=1; renderAll(); };
  $('objectSelect').onchange = e => { selectedIndex = Number(e.target.value); renderDecision(); renderCard(); renderWizard(); showTab('decision'); };
  $('btnSaveObject').onclick = () => saveObjectFromForm();
  $('btnSaveFromDecision').onclick = () => saveObjectFromForm();
  $('cardMode').onchange = renderCard;
  $('bulkField').onchange = renderBulkValueControl;
  $('btnBulkPreview').onclick = bulkPreview;
  $('btnBulkApply').onclick = () => bulkApply(false);
  $('btnBulkClear').onclick = () => bulkApply(true);
  $('prevPage').onclick = () => { if(currentPage>1){ currentPage--; renderTable(); } };
  $('nextPage').onclick = () => { const pages = Math.max(1, Math.ceil(filtered.length / Number($('pageSize').value))); if(currentPage<pages){ currentPage++; renderTable(); } };
  $('fullPrevPage').onclick = () => { if(fullPage>1){ fullPage--; renderFullTable(); } };
  $('fullNextPage').onclick = () => { const pages = Math.max(1, Math.ceil(getFullFiltered().length / Number($('fullPageSize').value))); if(fullPage<pages){ fullPage++; renderFullTable(); } };
  $('fullPageSize').onchange = () => { fullPage=1; renderFullTable(); };
  $('onlyEmptyRows').onchange = () => { fullPage=1; renderFullTable(); };
  $('btnSaveFullTable').onclick = () => { saveLocalObjects(rows); alert('Изменения полной таблицы сохранены локально. Для обновления GitHub-базы экспортируйте JSON и замените data/objects.json.'); };
  $('wizardPrev').onclick = () => { wizardStep=Math.max(0,wizardStep-1); renderWizard(); };
  $('wizardNext').onclick = () => { saveWizardFields(); wizardStep=Math.min(wizardGroups.length-1,wizardStep+1); renderWizard(); renderDecision(); renderCard(); };
  document.querySelectorAll('.tabBtn').forEach(btn=>btn.onclick=()=>showTab(btn.dataset.tab));
}

function showTab(name){
  document.querySelectorAll('.tabBtn').forEach(b=>b.classList.toggle('active', b.dataset.tab===name));
  document.querySelectorAll('.tabPane').forEach(p=>p.classList.toggle('active', p.id==='tab_'+name));
  if(name==='dashboard') renderDashboard($('dashboard'), getFilteredRaw(), calcApi.calc, calcApi.label);
  if(name==='registry') renderTable();
  if(name==='fulltable') renderFullTable();
  if(name==='decision') renderDecision();
  if(name==='wizard') renderWizard();
  if(name==='methodology') renderMethodology();
}

function renderAll(){ fillSelects(); fillBulkFields(); renderDecision(); renderDashboard($('dashboard'), rows, calcApi.calc, calcApi.label); renderCard(); renderWizard(); renderTable(); renderFullTable(); renderMethodology(); }

function fillSelects(){
  const sel=$('objectSelect');
  sel.innerHTML = rows.map((r,i)=>{
    const id = r[0] || ('AUTO-'+String(i+1).padStart(4,'0'));
    return `<option value="${i}">${escapeHtml(id+' — '+short(r[1],44)+' — '+short(r[2],54))}</option>`;
  }).join('');
  sel.value = selectedIndex;
  const zones=new Set(), types=new Set();
  rows.forEach(r=>{ zones.add(calcApi.calc(r).zone.key); types.add(calcApi.label(r[4])); });
  $('zoneFilter').innerHTML='<option value="">Все</option>'+[...zones].sort().map(z=>`<option>${z}</option>`).join('');
  $('typeFilter').innerHTML='<option value="">Все</option>'+[...types].sort((a,b)=>a.localeCompare(b,'ru')).map(t=>`<option value="${escapeAttr(t)}">${escapeHtml(t)}</option>`).join('');
}

function currentRow(){ return rows[selectedIndex] || rows[0] || []; }
function currentCalc(){ return calcApi.calc(currentRow()); }

function renderDecision(){
  const row=currentRow(), c=currentCalc(), errors=validateRow(row,c), explain=explainRating(row,c);
  $('decisionView').innerHTML = `
    <div class="decisionBody">
      <div class="decisionTop">
        ${big('Рейтинг', c.rating)}
        ${big('Зона', c.zone.title, 'zone'+c.zone.key)}
        ${big('Очередь', c.queue)}
        ${big('Достоверность', c.confidence+'%')}
        ${big('Рекомендация', c.recommendation)}
      </div>
      <div class="explainGrid">
        <div class="box"><h3>Объект</h3>
          <p><b>${escapeHtml(row[2]||'Объект не указан')}</b></p>
          <p>${escapeHtml(row[1]||'ЛПУ не указано')}</p>
          <p>${escapeHtml(row[3]||'Адрес не указан')}</p>
          <p class="hint">Тип: ${escapeHtml(calcApi.label(row[4]))}. Статус: ${escapeHtml(calcApi.label(row[6]))}. Год постройки: ${escapeHtml(row[7]||'нет данных')}.</p>
        </div>
        <div class="box"><h3>Почему такой рейтинг</h3><ul>${explain.map(x=>`<li>${escapeHtml(x)}</li>`).join('')}</ul></div>
        <div class="box"><h3>Что мешает принять решение</h3><ul>${blockers(row,c,errors).map(x=>`<li>${escapeHtml(x)}</li>`).join('')}</ul></div>
        <div class="box"><h3>Что дозаполнить в первую очередь</h3><ul>${importantMissing(row).slice(0,12).map(x=>`<li>${escapeHtml(x)}</li>`).join('') || '<li>Критичных пропусков не выявлено.</li>'}</ul></div>
      </div>
    </div>`;
  $('errorView').innerHTML = errors.length ? errors.map(e=>`<div class="issue ${e.level}"><b>${escapeHtml(e.title)}</b><br>${escapeHtml(e.text)}</div>`).join('') : '<div class="issue ok">Критичных противоречий по выбранному объекту не выявлено.</div>';
}

function big(name,value,cls=''){ return `<div class="bigCard ${cls}"><div class="name">${name}</div><div class="value">${escapeHtml(value)}</div></div>`; }

function explainRating(row,c){
  const out=[];
  const f=c.factors;
  out.push(`F1 технический риск = ${f.F1}: износ ЛПУ «${calcApi.label(row[9])}», бух. износ «${calcApi.label(row[8])}», состояние «${calcApi.label(row[11])}», год постройки ${row[7]||'не указан'}.`);
  out.push(`F2 безальтернативность = ${f.F2}: доезд «${calcApi.label(row[18])}», альтернативы «${calcApi.label(row[19])}», транспорт «${calcApi.label(row[20])}».`);
  out.push(`F3 управленческий контур = ${f.F3}: адресный перечень ${row[14]||'нет'}, поручения «${calcApi.label(row[16])}», контур «${calcApi.label(row[41])}».`);
  out.push(`F4 надзорный/юридический риск = ${f.F4}: предписания «${calcApi.label(row[15])}», уровень риска «${calcApi.label(row[38])}», суд/исполнение «${calcApi.label(row[39])}», остановка «${calcApi.label(row[40])}».`);
  out.push(`F5 системная роль = ${f.F5}: ЦАОП/диагностика/опорность/маршрутизация/уникальность учтены по максимальному подтверждённому признаку.`);
  out.push(`F6 нагрузка = ${f.F6}: план/факт, профили, койки и экстренные обращения учтены по доступным данным.`);
  if(c.critical) out.push('Сработал критический триггер: объект не может быть ниже зоны II при риске остановки/критическом надзорном риске.');
  return out;
}

function blockers(row,c,errors){
  const b=[];
  if(c.confidence<70) b.push(`Недостаточная полнота данных: ${c.confidence}%.`);
  if(c.actuality.score>=2) b.push(`Оценка состояния неактуальна: ${c.actuality.text}.`);
  if(c.mismatch) b.push('Существенное расхождение бухгалтерского износа и мнения ЛПУ.');
  errors.forEach(e=>b.push(e.title));
  if(!b.length) b.push('Данных достаточно для предварительного управленческого решения.');
  return b;
}

function validateRow(row,c){
  const e=[];
  const type=calcApi.label(row[4]).toLowerCase();
  if(c.confidence<60) e.push({level:'error',title:'Недостаточно данных',text:'Заполнено менее 60% обязательных полей. Рейтинг нельзя считать окончательным.'});
  if(c.mismatch) e.push({level:'error',title:'Расхождение износа',text:'Бухгалтерский износ и мнение ЛПУ расходятся на 2 и более уровня.'});
  if(c.critical && c.factors.F4<3) e.push({level:'error',title:'Критический риск не отражён в F4',text:'Есть риск остановки или критический надзорный признак, но блок F4 ниже 3.'});
  if(score(row[40])>=2 && c.factors.F4<2) e.push({level:'error',title:'Риск остановки не учтён',text:'Указан риск ограничения/остановки, но юридический блок занижен.'});
  if(score(row[35])>=2 && c.factors.F5<2) e.push({level:'warn',title:'Уникальность не раскрыта',text:'Указана уникальность, но системная роль не подтверждена дополнительными признаками.'});
  if(type.includes('стационар') && empty(row[28])) e.push({level:'warn',title:'Не указана коечная мощность',text:'Для стационара требуется заполнить коечную мощность.'});
  if(type.includes('поликлиник') && empty(row[21])) e.push({level:'warn',title:'Не указана плановая мощность',text:'Для поликлиники требуется плановая мощность.'});
  if(row[14] && empty(row[53])) e.push({level:'warn',title:'Нет года приоритета',text:'Объект включён в адресный перечень, но год приоритета не заполнен.'});
  if(c.factors.F1>=2 && score(row[11])<=1) e.push({level:'warn',title:'Проверьте состояние',text:'Технический риск высокий, но текущее состояние указано как низкорисковое.'});
  return e;
}

function renderCard(){
  const row=currentRow(), c=currentCalc(), mode=$('cardMode').value;
  $('calcSummary').innerHTML = [
    ['Рейтинг', c.rating],['Зона', c.zone.title],['Очередь', c.queue],['Данные', c.confidence+'%'],['Решение', c.recommendation],['Готовность', c.readiness]
  ].map((x,i)=>`<div class="summaryCard ${i===1?'zone'+c.zone.key:''}"><div class="name">${x[0]}</div><div class="value">${escapeHtml(x[1])}</div></div>`).join('');
  $('missingBox').innerHTML = renderQuality(row,c);
  $('objectForm').innerHTML = formHtml(row, mode);
}

function formHtml(row, mode){
  const allowed = sectionsByMode(mode);
  let html='', last='';
  fields.forEach((f,i)=>{
    if(!allowed.includes(f.section)) return;
    const auto = i>=42 && i!==49 && i!==53 && i!==54;
    if(f.section!==last){ last=f.section; html += `<div class="fieldGroup">${escapeHtml(cleanSection(last))}</div>`; }
    html += fieldHtml(f,i,row[i],auto);
  });
  return html;
}

function sectionsByMode(mode){
  if(mode==='brief') return ['1.1 Идентификация объекта','1.2 Техническое состояние и строительный риск','1.3 Программный/управленческий блок','2.5 Надзор и юридические риски','3. Автоматическая оценка по аналогии'];
  if(mode==='tech') return ['1.1 Идентификация объекта','1.2 Техническое состояние и строительный риск','1.3 Программный/управленческий блок'];
  if(mode==='medical') return ['1.4 Население','2.1 Территориальная доступность','2.2 Медицинская нагрузка (для поликлиник)','2.3 Медицинская нагрузка (для стационаров)','2.4 Специализированная помощь'];
  if(mode==='legal') return ['1.3 Программный/управленческий блок','2.5 Надзор и юридические риски'];
  return formSections;
}

function renderQuality(row,c){
  const notes=[];
  if(c.confidence>=80 && c.actuality.score<=1 && !c.mismatch) notes.push(`<div class="warning ok">Данные достаточны для предварительного управленческого решения.</div>`);
  if(c.confidence<70) notes.push(`<div class="warning">Низкая полнота данных: ${c.confidence}%. Расчёт предварительный.</div>`);
  if(c.actuality.score>=2) notes.push(`<div class="warning">Актуальность оценки: ${escapeHtml(c.actuality.text)}. Требуется обновление.</div>`);
  if(c.mismatch) notes.push(`<div class="warning">Расхождение между бух. износом и мнением ЛПУ. Нужна верификация.</div>`);
  if(c.critical) notes.push(`<div class="warning">Есть критический надзорный/юридический риск или риск остановки деятельности.</div>`);
  return notes.join('');
}

function renderWizard(){
  const row=currentRow(), g=wizardGroups[wizardStep];
  $('wizardView').innerHTML = `<div class="wizardBody">
    <div class="wizardSteps">${wizardGroups.map((x,i)=>`<span class="wizardStep ${i===wizardStep?'active':''}">${i+1}. ${escapeHtml(x.name)}</span>`).join('')}</div>
    <div class="wizardFields">${g.letters.map(l=>fieldByLetter(l,row)).join('') || '<p>Нет полей.</p>'}</div>
  </div>`;
}

function fieldByLetter(letter,row){
  const i=fields.findIndex(f=>f.letter===letter);
  if(i<0) return '';
  return fieldHtml(fields[i], i, row[i], false, 'wiz_');
}

function saveWizardFields(){
  const row=currentRow();
  wizardGroups[wizardStep].letters.forEach(l=>{
    const i=fields.findIndex(f=>f.letter===l);
    const el=$('wiz_field_'+i);
    if(el) row[i]=el.value;
  });
  saveLocalObjects(rows);
}

function fieldHtml(f,i,value,auto,prefix=''){
  const id=prefix+'field_'+i;
  let control='';
  if(f.type==='select' && f.dict && dicts[f.dict]){
    control = `<select id="${id}" ${auto?'disabled':''}>${dicts[f.dict].map(([v,t])=>`<option value="${escapeAttr(v)}" ${String(value??'')===String(v)?'selected':''}>${escapeHtml(t)}</option>`).join('')}</select>`;
  } else if(String(value??'').length>90 || f.type==='text') {
    control = `<textarea id="${id}" ${auto?'readonly':''}>${escapeHtml(value??'')}</textarea>`;
  } else {
    control = `<input id="${id}" type="${f.type==='date'?'text':(f.type||'text')}" value="${escapeAttr(value??'')}" ${auto?'readonly':''}>`;
  }
  const full = i===1 || i===2 || i===3 || i===13 || i===54;
  return `<div class="field ${auto?'auto':''} ${full?'full':''}"><label>${escapeHtml(cleanLabel(f.label))}</label>${control}</div>`;
}

function saveObjectFromForm(){
  const row=currentRow();
  fields.forEach((f,i)=>{
    const el=$('field_'+i);
    if(el && !(i>=42 && i!==49 && i!==53 && i!==54)) row[i]=el.value;
  });
  saveLocalObjects(rows); renderAll();
  alert('Сохранено локально. Для общей базы экспортируйте JSON и замените data/objects.json в GitHub.');
}

function getFilteredRaw(){ return getFiltered().map(x=>x.r); }
function getFiltered(){
  const q=$('searchInput').value.trim().toLowerCase(), z=$('zoneFilter').value, t=$('typeFilter').value, qual=$('qualityFilter').value;
  return rows.map((r,i)=>({r,i,c:calcApi.calc(r)})).filter(x=>{
    const errors=validateRow(x.r,x.c);
    const hay=[x.r[0],x.r[1],x.r[2],x.r[3],calcApi.label(x.r[4]),calcApi.label(x.r[6])].join(' ').toLowerCase();
    if(q && !hay.includes(q)) return false;
    if(z && x.c.zone.key!==z) return false;
    if(t && calcApi.label(x.r[4])!==t) return false;
    const bad = x.c.confidence<70 || x.c.actuality.score>=2 || x.c.mismatch;
    if(qual==='bad' && !bad) return false;
    if(qual==='errors' && !errors.length) return false;
    if(qual==='critical' && !x.c.critical) return false;
    if(qual==='ok' && bad) return false;
    return true;
  }).sort((a,b)=>b.c.rating-a.c.rating);
}

function renderTable(){
  filtered=getFiltered();
  const pageSize=Number($('pageSize').value), pages=Math.max(1,Math.ceil(filtered.length/pageSize));
  currentPage=Math.min(currentPage,pages);
  const part=filtered.slice((currentPage-1)*pageSize,(currentPage-1)*pageSize+pageSize);
  $('pageInfo').textContent=`${currentPage} / ${pages} · найдено ${filtered.length}`;
  $('registryTable').innerHTML = `<thead><tr>
    <th>ID</th><th>ЛПУ</th><th>Объект</th><th>Тип</th><th>Статус</th><th>Год</th><th>Износ ЛПУ</th>
    <th>F1</th><th>F2</th><th>F3</th><th>F4</th><th>F5</th><th>F6</th><th>Рейтинг</th><th>Зона</th><th>Данные</th><th>Ошибки</th><th>Рекомендация</th><th></th>
  </tr></thead><tbody>${part.map(rowHtml).join('')}</tbody>`;
}

function rowHtml(x){
  const r=x.r,c=x.c, err=validateRow(r,c).length;
  return `<tr>
    <td>${escapeHtml(r[0]||'')}</td><td class="lpuCell">${escapeHtml(short(r[1],80))}</td><td class="objectCell">${escapeHtml(short(r[2],90))}</td>
    <td>${escapeHtml(calcApi.label(r[4]))}</td><td>${escapeHtml(calcApi.label(r[6]))}</td><td class="numCell">${escapeHtml(r[7]||'')}</td><td>${escapeHtml(calcApi.label(r[9]))}</td>
    <td class="numCell">${c.factors.F1}</td><td class="numCell">${c.factors.F2}</td><td class="numCell">${c.factors.F3}</td><td class="numCell">${c.factors.F4}</td><td class="numCell">${c.factors.F5}</td><td class="numCell">${c.factors.F6}</td>
    <td class="ratingCell">${c.rating}</td><td><span class="zoneBadge zone${c.zone.key}">${c.zone.title}</span></td><td class="numCell">${c.confidence}%</td><td class="numCell">${err}</td>
    <td>${escapeHtml(c.recommendation)}</td><td><button class="ghost" onclick="window.__openRow(${x.i})">Открыть</button></td>
  </tr>`;
}
window.__openRow = i => { selectedIndex=i; $('objectSelect').value=i; renderDecision(); renderCard(); renderWizard(); showTab('decision'); window.scrollTo({top:0, behavior:'smooth'}); };


function getFullFiltered(){
  let base = getFiltered();
  if($('onlyEmptyRows')?.checked){
    base = base.filter(x => hasEmptyCells(x.r));
  }
  return base;
}

function hasEmptyCells(row){
  return fields.some((f,i)=> !isAutoField(i) && empty(row[i]));
}

function renderFullTable(){
  if(!$('fullTable')) return;
  const all = getFullFiltered();
  const pageSize = Number($('fullPageSize').value);
  const pages = Math.max(1, Math.ceil(all.length / pageSize));
  fullPage = Math.min(fullPage, pages);
  const part = all.slice((fullPage-1)*pageSize, (fullPage-1)*pageSize + pageSize);
  $('fullPageInfo').textContent = `${fullPage} / ${pages} · найдено ${all.length}`;

  const calcCols = [
    {key:'F1', label:'F1 расчёт'}, {key:'F2', label:'F2 расчёт'}, {key:'F3', label:'F3 расчёт'},
    {key:'F4', label:'F4 расчёт'}, {key:'F5', label:'F5 расчёт'}, {key:'F6', label:'F6 расчёт'},
    {key:'rating', label:'Итоговый рейтинг'}, {key:'zone', label:'Зона'}, {key:'confidence', label:'Достоверность'}, {key:'errors', label:'Ошибки'}
  ];
  const header = `<tr>
    <th class="stickyCell">ID</th><th class="stickyObj">Объект</th>
    ${fields.map((f,i)=>`<th title="${escapeAttr(f.section || '')}">${escapeHtml(f.letter || '')}<br>${escapeHtml(cleanLabel(f.label))}</th>`).join('')}
    ${calcCols.map(c=>`<th>${escapeHtml(c.label)}</th>`).join('')}
  </tr>`;
  const body = part.map(x=>fullRowHtml(x, calcCols)).join('');
  $('fullTable').innerHTML = `<thead>${header}</thead><tbody>${body}</tbody>`;
}

function fullRowHtml(x, calcCols){
  const r=x.r, idx=x.i, c=calcApi.calc(r), errs=validateRow(r,c).length;
  const calcs = {F1:c.factors.F1,F2:c.factors.F2,F3:c.factors.F3,F4:c.factors.F4,F5:c.factors.F5,F6:c.factors.F6,rating:c.rating,zone:c.zone.title,confidence:c.confidence+'%',errors:errs};
  return `<tr>
    <td class="stickyCell">${escapeHtml(r[0]||'')}</td>
    <td class="stickyObj"><b>${escapeHtml(short(r[2],70))}</b><br><span class="hint">${escapeHtml(short(r[1],70))}</span></td>
    ${fields.map((f,i)=>fullCellHtml(f,i,r[i],idx)).join('')}
    ${calcCols.map(col=>`<td class="calcCell ${col.key==='rating'?'ratingMini':''}">${escapeHtml(calcs[col.key])}</td>`).join('')}
  </tr>`;
}

function fullCellHtml(f,i,value,rowIndex){
  const auto = isAutoField(i);
  const cls = `${auto?'calcCell':'manualCell'} ${(!auto && empty(value))?'emptyCell':''}`;
  if(auto){
    return `<td class="${cls}">${escapeHtml(value ?? '')}</td>`;
  }
  const id = `full_${rowIndex}_${i}`;
  let control = '';
  if(f.type==='select' && f.dict && dicts[f.dict]){
    control = `<select id="${id}" data-row="${rowIndex}" data-col="${i}" onchange="window.__fullEdit(this)">${dicts[f.dict].map(([v,t])=>`<option value="${escapeAttr(v)}" ${String(value??'')===String(v)?'selected':''}>${escapeHtml(t)}</option>`).join('')}</select>`;
  } else if(String(value??'').length>60 || f.type==='text') {
    control = `<textarea id="${id}" data-row="${rowIndex}" data-col="${i}" onchange="window.__fullEdit(this)">${escapeHtml(value??'')}</textarea>`;
  } else {
    control = `<input id="${id}" data-row="${rowIndex}" data-col="${i}" type="${f.type==='date'?'text':(f.type||'text')}" value="${escapeAttr(value??'')}" onchange="window.__fullEdit(this)">`;
  }
  return `<td class="${cls}">${control}</td>`;
}

window.__fullEdit = el => {
  const r = Number(el.dataset.row), c = Number(el.dataset.col);
  rows[r][c] = el.value;
  saveLocalObjects(rows);
  renderDecision();
  renderCard();
  renderTable();
  renderFullTable();
  renderDashboard($('dashboard'), getFilteredRaw(), calcApi.calc, calcApi.label);
};

function isAutoField(i){
  return i>=42 && i!==49 && i!==53 && i!==54;
}


function renderMethodology(){
  $('methodologyView').innerHTML = `
    <h3>1. Назначение</h3><p>Модель ранжирует объекты для капитального ремонта, реконструкции, замещения мощности или мониторинга. Расчёт является управленческим фильтром и не заменяет обследование, проектирование и экспертизу.</p>
    <h3>2. F-блоки</h3><ul>
      <li><b>F1</b> — технический риск: износ, состояние, возраст здания, давность капремонта.</li>
      <li><b>F2</b> — территориальная безальтернативность: доезд, альтернативы, транспортная доступность.</li>
      <li><b>F3</b> — программный/управленческий контур: адресный перечень, поручения, контур приоритизации.</li>
      <li><b>F4</b> — надзорный и юридический риск: предписания, суды, исполнительные документы, риск остановки.</li>
      <li><b>F5</b> — системная роль: маршрутизация, уникальность, ЦАОП, КТ/МРТ, РСЦ, опорность.</li>
      <li><b>F6</b> — медицинская нагрузка: мощность, профили, койки, экстренные обращения.</li>
    </ul>
    <h3>3. Рейтинг</h3><p>Каждый F-блок оценивается 0–3. Итоговый рейтинг считается по выбранному сценарию весов. Критический надзорный риск или риск остановки деятельности автоматически поднимает объект не ниже зоны II.</p>
    <h3>4. Зоны</h3><ul><li>I — первоочередно: 80–100.</li><li>II — высокий приоритет: 60–79 или критический триггер.</li><li>III — плановый приоритет: 40–59.</li><li>IV — мониторинг: менее 40.</li></ul>
    <h3>5. Нет данных / не применимо</h3><p>«Нет данных» снижает достоверность расчёта. «Не применимо» не добавляет баллы и не должно использоваться вместо отсутствующих сведений.</p>
    <h3>6. Журнал изменений</h3><p>При обновлении базы фиксируйте изменения в <code>docs/changelog.md</code>: дата, кто обновил, источник, что изменено.</p>
  `;
}

function buildExportFields(){
  return [...fields, {label:'F1 calc'}, {label:'F2 calc'}, {label:'F3 calc'}, {label:'F4 calc'}, {label:'F5 calc'}, {label:'F6 calc'}, {label:'Итог calc'}, {label:'Зона calc'}, {label:'Достоверность calc'}, {label:'Ошибки логики'}, {label:'Рекомендация calc'}];
}
function buildExportRows(){
  return rows.map(r=>{ const c=calcApi.calc(r); return [...r,c.factors.F1,c.factors.F2,c.factors.F3,c.factors.F4,c.factors.F5,c.factors.F6,c.rating,c.zone.title,c.confidence,validateRow(r,c).length,c.recommendation]; });
}

function editableFieldIndexes(){ return fields.map((f,i)=>({f,i})).filter(x=>x.i<42 || x.i===49 || x.i===53 || x.i===54).map(x=>x.i); }
function fillBulkFields(){ $('bulkField').innerHTML=editableFieldIndexes().filter(i=>i!==0).map(i=>`<option value="${i}">${escapeHtml(cleanLabel(fields[i].label))}</option>`).join(''); renderBulkValueControl(); }
function renderBulkValueControl(){ const i=Number($('bulkField').value), f=fields[i], select=$('bulkSelectValue'), input=$('bulkTextValue'); if(f?.type==='select'&&f.dict&&dicts[f.dict]){select.style.display='block';input.style.display='none';select.innerHTML=dicts[f.dict].map(([v,t])=>`<option value="${escapeAttr(v)}">${escapeHtml(t)}</option>`).join('');}else{select.style.display='none';input.style.display='block';input.value='';} $('bulkStatus').textContent='Охват: не рассчитан.'; }
function bulkTargetIndexes(){ return getFiltered().map(x=>x.i); }
function bulkValue(){ const i=Number($('bulkField').value), f=fields[i]; return f?.type==='select'&&f.dict&&dicts[f.dict] ? $('bulkSelectValue').value : $('bulkTextValue').value; }
function bulkPreview(){ const targets=bulkTargetIndexes(), i=Number($('bulkField').value); $('bulkStatus').textContent=`Охват: ${targets.length} объектов. Поле: ${cleanLabel(fields[i]?.label||'')}.`; }
function bulkApply(clear){ const targets=bulkTargetIndexes(); if(!targets.length){$('bulkStatus').textContent='Нет объектов в текущем фильтре.';return;} const i=Number($('bulkField').value), f=fields[i], val=clear?'':bulkValue(); const msg=clear?`Очистить поле «${cleanLabel(f.label)}» у ${targets.length} объектов?`:`Проставить «${calcApi.label(val)}» в поле «${cleanLabel(f.label)}» для ${targets.length} объектов?`; if(!confirm(msg))return; targets.forEach(idx=>rows[idx][i]=val); saveLocalObjects(rows); renderAll(); $('bulkStatus').textContent=`Готово: обновлено ${targets.length} объектов. Для общей базы экспортируйте JSON.`; }

function importantMissing(row){ const letters=['G','H','I','J','K','L','P','Q','R','S','T','U','AM','AN','AO','AP']; return letters.map(l=>fields.findIndex(f=>f.letter===l)).filter(i=>i>=0 && empty(row[i])).map(i=>cleanLabel(fields[i].label)); }
function score(v){ const s=String(v??''); if(!s || s.startsWith('na|')) return 0; const n=Number(s.split('|')[0]); return Number.isFinite(n)?n:0; }
function empty(v){ return v===undefined||v===null||String(v).trim()===''; }
function cleanLabel(s){ return String(s??'').replace(/^\d+\.\s*/,'').replace(/^\d+\s*/,'').trim(); }
function cleanSection(s){ return String(s??'').replace(/^\d+(\.\d+)?\s*/,'').trim(); }
function short(s,n){ s=String(s??''); return s.length>n?s.slice(0,n-1)+'…':s; }
function escapeHtml(s){return String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]))}
function escapeAttr(s){return escapeHtml(s)}
