export function renderDashboard(el, rows, calc, label){
  const calced = rows.map(r=>({row:r,c:calc(r)}));
  const zones=countBy(calced,x=>x.c.zone.key);
  const need=calced.filter(x=>x.c.confidence<70||x.c.actuality.score>=2||x.c.mismatch).length;
  const critical=calced.filter(x=>x.c.critical||x.c.factors.F4>=3).length;
  const top=calced.slice().sort((a,b)=>b.c.rating-a.c.rating).slice(0,12);
  const byType=countBy(calced,x=>label(x.row[4]));
  const avgRating = calced.length ? Math.round(calced.reduce((s,x)=>s+x.c.rating,0)/calced.length) : 0;
  const ministerText = ministerConclusion(rows.length, zones, critical, need, top);
  el.innerHTML = `
    <div class="ministerConclusion"><b>Управленческий вывод для министра.</b> ${ministerText}</div>
    ${kpi('Всего объектов', rows.length)}
    ${kpi('Зона I–II', (zones.I||0)+(zones.II||0))}
    ${kpi('Критический риск', critical)}
    ${kpi('Средний рейтинг', avgRating)}
    ${kpi('Нужно дозаполнить', need)}
    ${kpi('Достаточные данные', rows.length-need)}
    <div class="chart wide"><h3>Распределение по зонам</h3>${barChartInner({'I':zones.I||0,'II':zones.II||0,'III':zones.III||0,'IV':zones.IV||0})}</div>
    <div class="chart wide"><h3>ТОП-12 объектов по рейтингу</h3>${top.map(x=>`<div class="barRow"><span>${escapeHtml(String(x.row[2]||'—')).slice(0,54)}</span><div class="bar"><span style="width:${x.c.rating}%"></span></div><b>${x.c.rating}</b></div>`).join('')}</div>
    <div class="chart wide"><h3>Типы объектов</h3>${barChartInner(Object.fromEntries(Object.entries(byType).sort((a,b)=>b[1]-a[1]).slice(0,8)))}</div>
    <div class="chart wide"><h3>Качество данных</h3>${barChartInner({'Можно считать':rows.length-need,'Нужно уточнить':need})}</div>
  `;
}
function ministerConclusion(total,zones,critical,need,top){
  const z12=(zones.I||0)+(zones.II||0);
  const topName = top?.[0]?.row?.[2] || 'не определён';
  return `В реестре ${total} объектов. В первоочередной и высокой зоне — ${z12}. Критический риск отмечен по ${critical} объектам. Требуют дозаполнения данных — ${need}. Объект с максимальным рейтингом: «${topName}».`;
}
function kpi(name,value){return `<div class="kpi"><div class="name">${name}</div><div class="value">${value}</div></div>`}
function countBy(arr,fn){const o={}; arr.forEach(x=>{const k=fn(x)||'нет данных'; o[k]=(o[k]||0)+1}); return o}
function barChartInner(obj){
  const keys=Object.keys(obj);
  const max=Math.max(1,...keys.map(k=>obj[k]||0));
  return keys.map(k=>`<div class="barRow"><span>${escapeHtml(k)}</span><div class="bar"><span style="width:${Math.round((obj[k]||0)/max*100)}%"></span></div><b>${obj[k]||0}</b></div>`).join('');
}
function escapeHtml(s){return String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]))}
