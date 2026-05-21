export function exportJson(rows){
  download('objects.json', JSON.stringify(rows,null,2), 'application/json;charset=utf-8');
}
export function exportCsv(rows, fields){
  const headers = fields.map(f=>f.label || f.key || 'field');
  const text=[headers,...rows].map(r=>r.map(csv).join(';')).join('\n');
  download('mzmo_priority_export.csv', text, 'text/csv;charset=utf-8');
}
export function exportExcel(rows, fields){
  const headers = fields.map(f=>f.label || f.key || 'field');
  const html = `<!doctype html><html><head><meta charset="utf-8"></head><body><table border="1"><thead><tr>${headers.map(h=>`<th>${esc(h)}</th>`).join('')}</tr></thead><tbody>${rows.map(r=>`<tr>${r.map(v=>`<td>${esc(v)}</td>`).join('')}</tr>`).join('')}</tbody></table></body></html>`;
  download('mzmo_priority_export.xls', html, 'application/vnd.ms-excel;charset=utf-8');
}
export function readJsonFile(file){
  return new Promise((resolve,reject)=>{
    const reader=new FileReader();
    reader.onload=()=>{try{resolve(JSON.parse(reader.result))}catch(e){reject(e)}};
    reader.onerror=reject;
    reader.readAsText(file,'utf-8');
  });
}
function csv(v){ return '"' + String(v ?? '').replace(/"/g,'""') + '"'; }
function esc(v){ return String(v ?? '').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m])); }
function download(filename, text, mime){
  const blob=new Blob([text],{type:mime});
  const url=URL.createObjectURL(blob);
  const a=document.createElement('a');
  a.href=url; a.download=filename; a.click();
  URL.revokeObjectURL(url);
}
