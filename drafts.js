import {validateEntry} from './storage.js';
export const DRAFT_PREFIX='roky-music-draft.v1.';
export const DRAFT_POINTER='roky-music-draft-pointer.v1';
const identifier=value=>typeof value==='string'&&/^[a-zA-Z0-9-]{1,100}$/.test(value);

export function validateDraft(value){
  if(!value||value.app!=='roky-music-diary-draft'||![1,2].includes(value.version)||!identifier(value.id)||!identifier(value.revision)||typeof value.editing!=='boolean'||!Number.isSafeInteger(value.updatedAt)||value.updatedAt<0||value.updatedAt>8_640_000_000_000_000)throw new Error('INVALID_DRAFT');
  if(value.version===2&&(!value.entry?.arrangement||(value.editing&&!value.baseEntry?.arrangement)))throw new Error('INVALID_DRAFT');
  // An empty date is a valid unfinished input, but cannot become a published diary.
  const entry=validateEntry({...value.entry,date:value.entry?.date===''?'2000-01-01':value.entry?.date});
  if(value.entry.date==='')entry.date='';
  const baseEntry=value.editing?validateEntry(value.baseEntry):null;
  if(value.editing&&baseEntry.id!==entry.id)throw new Error('INVALID_DRAFT_BASE');
  let parent=null;
  if(value.parent!==null&&value.parent!==undefined){if(!identifier(value.parent.id)||!identifier(value.parent.revision)||value.parent.id===value.id)throw new Error('INVALID_DRAFT_PARENT');parent={id:value.parent.id,revision:value.parent.revision};}
  return {app:'roky-music-diary-draft',version:value.version,id:value.id,revision:value.revision,updatedAt:value.updatedAt,editing:value.editing,baseEntry,entry,parent};
}
export function parseDraft(raw){
  if(typeof raw!=='string'||raw.length>100_000)throw new Error('INVALID_DRAFT');
  return validateDraft(JSON.parse(raw));
}
export function writeDraft(storage,value){
  const draft=validateDraft(value);storage.setItem(DRAFT_PREFIX+draft.id,JSON.stringify(draft));return draft;
}
export function readDrafts(storage){
  const records=[],invalid=[];
  for(let i=0;i<storage.length;i++){
    const key=storage.key(i);if(!key?.startsWith(DRAFT_PREFIX))continue;
    const raw=storage.getItem(key);if(raw===null)continue;
    try{const draft=parseDraft(raw);if(key!==DRAFT_PREFIX+draft.id)throw new Error('INVALID_KEY');records.push(draft);}catch{invalid.push({key,raw});}
  }
  // Every document writes its own slot. A restored copy supersedes only the
  // exact source revision; another window's later edits remain separate heads.
  const hidden=new Set();const byId=new Map(records.map(d=>[d.id,d]));
  for(const draft of records){const parent=byId.get(draft.parent?.id);if(parent&&parent.revision===draft.parent.revision)hidden.add(parent.id);}
  let drafts=records.filter(d=>!hidden.has(d.id));
  // Preserve visibility even if an externally altered file introduces a cycle.
  if(!drafts.length&&records.length)drafts=records;
  drafts.sort((a,b)=>b.updatedAt-a.updatedAt||a.id.localeCompare(b.id));
  return {drafts,records,invalid};
}
export function removeDraftBranch(storage,draft){
  let current={id:draft.id,revision:draft.revision};let first=true;const visited=new Set();
  while(current&&!visited.has(current.id)){
    visited.add(current.id);const key=DRAFT_PREFIX+current.id,raw=storage.getItem(key);
    if(raw===null)break;
    let stored;try{stored=parseDraft(raw);}catch{return !first;}
    if(stored.revision!==current.revision)return !first;
    storage.removeItem(key);current=stored.parent;first=false;
  }
  return true;
}
