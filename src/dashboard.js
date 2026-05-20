export function renderDashboard(el, rows, calc, label){
  const calced = rows.map(r=>({row:r,c:calc(r)}));
  const zones=countBy(calced,x=>x.c.zone.key); const types=countBy(calced,x=>label(x.row[4]));
  const need=calced.filter(x=>x.c.confidence<70||x.c.actuality.score>=2||x.c.mismatch).length;
  const top=calced.slice().sort((a,b)=>b.c.rating-a.c.rating).slice(0,20);
  el.innerHTML = `
    ${kpi('Всего объектов', rows.length)}${kpi('Зона I–II', (zones.I||0)+(zones.II||0))}${kpi('Требуют данных', need)}${kpi('Макс. рейтинг', top[0]?.c.rating??0)}
    ${barChart('Распределение по зонам', zones, ['I','II','III','IV'])}
    ${barChart('Распределение по типам', types, Object.keys(types).sort((a,b)=>types[b]-types[a]).slice(0,8))}
    <div class="chart"><h3>ТОП-20 по рейтингу</h3>${top.map(x=>`<div class="barRow"><span>${escapeHtml(String(x.row[2]||'—')).slice(0,42)}</span><div class="bar"><span style="width:${x.c.rating}%"></span></div><b>${x.c.rating}</b></div>`).join('')}</div>
    <div class="chart"><h3>Контроль качества данных</h3>${barChartInner({'Достаточные данные':rows.length-need,'Требуют уточнения':need})}</div>
  `;
}
function kpi(name,value){return `<div class="kpi"><div class="name">${name}</div><div class="value">${value}</div></div>`}
function countBy(arr,fn){const o={}; arr.forEach(x=>{const k=fn(x)||'нет данных'; o[k]=(o[k]||0)+1}); return o}
function barChart(title,obj,keys){return `<div class="chart"><h3>${title}</h3>${barChartInner(obj,keys)}</div>`}
function barChartInner(obj,keys){keys=keys||Object.keys(obj); const max=Math.max(1,...keys.map(k=>obj[k]||0)); return keys.map(k=>`<div class="barRow"><span>${escapeHtml(k)}</span><div class="bar"><span style="width:${Math.round((obj[k]||0)/max*100)}%"></span></div><b>${obj[k]||0}</b></div>`).join('')}
function escapeHtml(s){return String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]))}
