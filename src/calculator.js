export function createCalculator(fields, config){
  const byLetter = Object.fromEntries(fields.map((c,i)=>[c.letter,i]));
  const col = name => byLetter[config.columnMap[name]];
  const idx = Object.fromEntries(Object.keys(config.columnMap).map(k=>[k,col(k)]));
  const weights = config.weights;
  const year = config.currentYear || new Date().getFullYear();
  const required = (config.requiredLetters||[]).map(l=>byLetter[l]).filter(v=>v!==undefined);

  function parseScore(v){ if(v===undefined||v===null||v==='') return null; const s=String(v); if(s.startsWith('na|')) return null; const n=Number(s.split('|')[0]); return Number.isFinite(n)?n:null; }
  function score(v){ const s=parseScore(v); return s===null?0:s; }
  function max(...vals){ const n=vals.map(parseScore).filter(v=>v!==null); return n.length?Math.max(...n):0; }
  function num(v){ if(v===undefined||v===null||String(v).trim()==='') return null; const n=Number(String(v).replace(',','.')); return Number.isFinite(n)?n:null; }
  function label(v){ if(v===undefined||v===null||v==='') return 'нет данных'; const s=String(v); return s.includes('|')?s.split('|').slice(1).join('|'):s; }
  function dateValue(v){
    if(!v) return null;
    const n=num(v);
    if(n && n>20000 && n<80000){ const d=new Date(Math.round((n-25569)*86400*1000)); return d; }
    const d=new Date(String(v).slice(0,10)+'T00:00:00');
    return isNaN(d.getTime())?null:d;
  }
  function ageRisk(y){ const n=num(y); if(!n) return 0; const a=year-n; if(a>70) return 3; if(a>40) return 2; if(a>20) return 1; return 0; }
  function repairRisk(y){ const n=num(y); if(!n) return 2; const d=year-n; if(d>15) return 3; if(d>10) return 2; if(d>5) return 1; return 0; }
  function loadRisk(planned, actual){ const p=num(planned), a=num(actual); if(!p||!a||p<=0) return 0; const r=a/p; if(r>1.25) return 3; if(r>1.0) return 2; if(r>0.8) return 1; return 0; }
  function confidence(row){ let f=0; required.forEach(i=>{const v=row[i]; if(v!==undefined&&v!==null&&String(v).trim()!==''&&!String(v).startsWith('na|')) f++;}); return required.length?Math.round(f/required.length*100):0; }
  function actuality(row){ const d=dateValue(row[idx.assessmentDate]); if(!d) return {score:3,text:'дата оценки отсутствует'}; const ref=new Date(year,4,20); const y=(ref-d)/(365.25*86400*1000); if(y<=1)return{score:0,text:'до 1 года'}; if(y<=3)return{score:1,text:'1–3 года'}; if(y<=5)return{score:2,text:'3–5 лет'}; return{score:3,text:'старше 5 лет'}; }
  function mismatch(row){ const a=parseScore(row[idx.wearAccounting]), b=parseScore(row[idx.wearLpu]); return a!==null&&b!==null&&Math.abs(a-b)>=2; }
  function zoneByRating(r, critical){ if(r>=80) return {key:'I',title:'I — первоочередно'}; if(r>=60||critical) return {key:'II',title:'II — высокий приоритет'}; if(r>=40) return {key:'III',title:'III — плановый приоритет'}; return {key:'IV',title:'IV — мониторинг'}; }
  function calc(row){
    const F1=Math.max(score(row[idx.wearAccounting]),score(row[idx.wearLpu]),score(row[idx.condition]),ageRisk(row[idx.yearBuilt]),repairRisk(row[idx.lastRepair]));
    const F2=max(row[idx.travelTime],row[idx.alternatives],row[idx.transport]);
    const addressList=num(row[idx.addressListYear])?2:0;
    const F3=Math.max(addressList,score(row[idx.orders]),score(row[idx.priorityContour]));
    const F4=max(row[idx.predpisaniya],row[idx.nadzor],row[idx.court],row[idx.stop]);
    const F5=max(row[idx.caop],row[idx.ctMri],row[idx.xray],row[idx.support],row[idx.rsc],row[idx.routing],row[idx.socialDiseases],row[idx.unique],row[idx.routingLevel]);
    const F6=Math.max(loadRisk(row[idx.plannedCapacity],row[idx.actualCapacity]),score(row[idx.polyProfiles]),score(row[idx.beds]),score(row[idx.inpatientProfiles]),score(row[idx.emergencyInpatient]),score(row[idx.emergencyApplicable]));
    const factors={F1,F2,F3,F4,F5,F6};
    let auto=0; Object.keys(factors).forEach(k=>auto+=(factors[k]/3)*weights[k]);
    const override=num(row[idx.override]);
    const critical=score(row[idx.stop])>=3||score(row[idx.court])>=3||score(row[idx.nadzor])>=3||score(row[idx.predpisaniya])>=3;
    let rating=override!==null?Math.max(0,Math.min(100,override)):Math.round(auto);
    if(critical && rating<70) rating=70;
    const z=zoneByRating(rating,critical); const conf=confidence(row); const act=actuality(row); const mis=mismatch(row);
    const recommendation = recommend(factors,conf,act,critical,mis);
    const readiness = conf>=80&&act.score<=1?'А. Можно включать в приоритет':critical&&conf>=60?'Б. Можно включать условно':(conf<60||act.score>=3||mis)?'В. Требуется дообследование':'Г. Мониторинг / уточнение';
    return {factors,autoRating:Math.round(auto),rating,zone:z,queue:z.key==='I'?1:z.key==='II'?2:z.key==='III'?3:4,confidence:conf,actuality:act,mismatch:mis,critical,recommendation,readiness};
  }
  function recommend(f,conf,act,critical,mis){ if(conf<60||act.score>=3||mis) return 'Дополнительное обследование'; if(critical) return 'Капитальный ремонт / срочные меры'; if(f.F1>=3&&f.F6>=2) return 'Реконструкция / замещение мощности'; if(f.F1>=2&&f.F5>=2) return 'Капитальный ремонт с сохранением функции'; if(f.F1>=2) return 'Капитальный ремонт'; if(f.F2>=2||f.F5>=2) return 'Плановое мероприятие с учётом системной роли'; return 'Мониторинг / текущий ремонт'; }
  function conclusion(row,c){ const reasons=[]; if(c.factors.F1>=2)reasons.push('технический риск'); if(c.factors.F2>=2)reasons.push('безальтернативность'); if(c.factors.F3>=2)reasons.push('управленческий контур'); if(c.factors.F4>=2)reasons.push('надзорный/юридический риск'); if(c.factors.F5>=2)reasons.push('системная роль'); if(c.factors.F6>=2)reasons.push('медицинская нагрузка'); return `Объект: ${row[idx.object]||'не указан'}\nЛПУ: ${row[idx.lpu]||'не указано'}\nРейтинг: ${c.rating}/100. Зона: ${c.zone.title}. Очередь: ${c.queue}.\nОснования: ${reasons.length?reasons.join(', '):'подтверждённые риски низкие или данные неполные'}.\nРекомендация: ${c.recommendation}.\nГотовность: ${c.readiness}.\nДостоверность данных: ${c.confidence}%. Актуальность оценки: ${c.actuality.text}.`; }
  return {idx,byLetter,calc,label,score,num,conclusion};
}
