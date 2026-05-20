export async function loadBaseData(){
  const [fields, objects, dicts, config] = await Promise.all([
    fetch('data/fields.json').then(r=>r.json()),
    fetch('data/objects.json').then(r=>r.json()),
    fetch('data/dictionaries.json').then(r=>r.json()),
    fetch('data/config.json').then(r=>r.json())
  ]);
  return {fields, objects, dicts, config};
}
export function loadLocalObjects(){
  try{return JSON.parse(localStorage.getItem('mzmo_priority_objects_v2')||'null')}catch(e){return null}
}
export function saveLocalObjects(rows){localStorage.setItem('mzmo_priority_objects_v2', JSON.stringify(rows));}
export function clearLocalObjects(){localStorage.removeItem('mzmo_priority_objects_v2');}
