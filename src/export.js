export function exportJson(rows){download('objects.json', JSON.stringify(rows,null,2), 'application/json')}
export function exportCsv(rows, fields){ const header=fields.map(f=>f.label); const lines=[header,...rows].map(r=>r.map(csv).join(';')).join('\n'); download('mzmo_priority_export.csv', lines, 'text/csv;charset=utf-8'); }
function csv(v){return '"'+String(v??'').replace(/"/g,'""')+'"'}
function download(name,text,type){const blob=new Blob([text],{type}); const url=URL.createObjectURL(blob); const a=document.createElement('a'); a.href=url; a.download=name; a.click(); URL.revokeObjectURL(url)}
export function readJsonFile(file){return new Promise((resolve,reject)=>{const r=new FileReader(); r.onload=()=>{try{resolve(JSON.parse(r.result))}catch(e){reject(e)}}; r.onerror=reject; r.readAsText(file,'utf-8')})}
