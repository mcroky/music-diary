import {RoomAudio} from './audio.js';
import {KEY,SOUNDS,MOODS,ROOMS,LIGHTS,WEATHERS,TIMES,readEntries,readWallet,walletFromBackup,writeEntries,encodeBackup,parseBackup,mergeEntries,validateEntry} from './storage.js';
import {emptyWallet,awardDays,mergeWallets,walletBalance,purchaseItem,spendDownload,refundDownload,SHOP_ITEMS} from './rewards.js';
import {translate,locales} from './translations.js';
import {musicExpression} from './music.js';
import {CATEGORIES,TRACKS,getTrack,localized,LEADS,RHYTHMS,DENSITIES,defaultArrangement,trackLead} from './catalog.js';
import {ROOM_ART,loadRoomArtwork} from './room-art.js';
import {DRAFT_PREFIX,DRAFT_POINTER,parseDraft,readDrafts,writeDraft,removeDraftBranch} from './drafts.js';
import {entriesForMonth,albumSummary,canHear,nextAudible,AlbumPlayer} from './album.js';
import {exportPlan,estimatedBytes,renderAlbumWav,renderAlbumMp3,MAX_WAV_BYTES,SAMPLE_RATE} from './album-export.js';
import {isAndroid,saveFile,connectAndroid,minimizeApp} from './platform.js';
const $=id=>document.getElementById(id);
const face={calm:'◡',happy:'☺',sad:'☂',tired:'☾',hopeful:'✧',restless:'〰'};
const icons={rain:'☂',fire:'♨',waves:'≋',wind:'〰',birds:'♧',cafe:'☕',piano:'♩',drums:'◉',bass:'♪',keys:'▥',guitar:'♬',bell:'♧'};
const moodColors={calm:'#9cae88',happy:'#d0b26d',sad:'#8fa6b0',tired:'#b1a1b8',hopeful:'#c49c82',restless:'#a6a199'};
const localDate=(date=new Date())=>`${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
let lang='ko';try{lang=localStorage.getItem('roky-music-language')||'ko';}catch{}if(!locales[lang])lang='ko';
const t=key=>translate(lang,key);
function fresh(date=localDate()){return {id:crypto.randomUUID(),date,title:'',note:'',moods:['calm'],room:'attic',light:'warm',weather:'rainy',time:'sunset',tempo:72,master:65,brightness:75,trackId:null,arrangement:defaultArrangement(),sounds:Object.fromEntries(SOUNDS.map(s=>[s,s==='rain'?35:s==='piano'?55:0]))};}
let state=fresh(),entries=[],editing=false,dirty=false,locked=false,rawOriginal=null,rawDownloaded=false,loadedVersion=null;
let calendarDate=new Date(new Date().getFullYear(),new Date().getMonth(),1,12),selectedDay=localDate();
let timerEnd=0,sleepMinutes=0,timerTick,toastTimeout,confirmResolve;
const audio=new RoomAudio(),lastFocus=new Map();
let albumDate=new Date(new Date().getFullYear(),new Date().getMonth(),1,12),albumIndex=0,albumError=false;
let albumExportJob=null,albumExportFeedback='';
let dayExportJob=null,dayExportFeedback='',wallet=emptyWallet();
const albumAudio=new RoomAudio();
const albumPlayer=new AlbumPlayer(albumAudio,{onChange:player=>{if(player.index>=0)albumIndex=player.index;if($('albumDialog')?.open)renderAlbum();},onError:()=>{albumError=true;if($('albumDialog').open)renderAlbum();}});
let catalogCategory='all',catalogQuery='',catalogLimit=8;
let draftId=crypto.randomUUID(),draftParent=null,lastDraft=null,draftStatus='idle',draftSavedAt=0,draftTimer,maxDraftTimer,draftFailureNotified=false;
let draftCatalogue={drafts:[],records:[],invalid:[]},draftReadFailed=false;
try{entries=readEntries(localStorage);wallet=awardDays(readWallet(localStorage),entries);}catch{locked=true;try{rawOriginal=localStorage.getItem(KEY);}catch{}}
const owns=id=>wallet.purchases.includes(id);
function updateWallet(change){
  const latest=readEntries(localStorage),current=awardDays(readWallet(localStorage),latest),next=change(current);
  writeEntries(localStorage,latest,next);entries=latest;wallet=next;return next;
}
function refreshRewards(){if($('rewardBalance'))$('rewardBalance').textContent=String(walletBalance(wallet));if($('shopDialog')?.open)renderShop();}
async function saveAudioWithReward(blob,name,signal){
  if(signal?.aborted)throw new DOMException('Cancelled','AbortError');
  const id=crypto.randomUUID();updateWallet(w=>spendDownload(w,id));refreshRewards();
  try{if(signal?.aborted)throw new DOMException('Cancelled','AbortError');await saveFile(blob,name,{signal});}
  catch(error){try{updateWallet(w=>refundDownload(w,id));refreshRewards();}catch{throw new Error('REWARD_REFUND_FAILED');}throw error;}
}
function toast(key){clearTimeout(toastTimeout);$('toast').textContent=t(key);$('toast').classList.add('show');toastTimeout=setTimeout(()=>$('toast').classList.remove('show'),5200);}
async function download(data,name){await saveFile(new Blob([data],{type:'application/json'}),name);}
async function backupFile(button,data,name,onSuccess){
  button.disabled=true;
  try{await download(data,name);onSuccess?.();toast(isAndroid?'fileSaved':'exported');}
  catch(error){toast(error?.name==='AbortError'?'fileCancelled':'fileSaveFailed');}
  finally{button.disabled=false;}
}
function showDialog(id){const dialog=$(id);lastFocus.set(dialog,document.activeElement);if(!dialog.open)dialog.showModal();}
function closeDialog(dialog){if(dialog.id==='immersionDialog'){$('roomChoices').before($('roomScene'));document.body.classList.remove('is-immersed');}if(dialog.id==='albumDialog'){cancelAlbumExport();albumPlayer.stop();}if(dialog.id==='dayExportDialog')cancelDayExport();dialog.close();lastFocus.get(dialog)?.focus();}
function ask(key,accept){$('confirmText').textContent=t(key);$('confirmAccept').textContent=t(accept);showDialog('confirmDialog');return new Promise(resolve=>{confirmResolve=resolve;});}
function finishConfirm(result){closeDialog($('confirmDialog'));confirmResolve?.(result);confirmResolve=null;}
async function canLeaveDraft(){if(!dirty||flushDraft())return true;const discard=await ask('draftWarn','discard');if(discard)finishActiveDraft();return discard;}
function setFill(input){input.style.setProperty('--fill',`${(Number(input.value)-Number(input.min))/(Number(input.max)-Number(input.min))*100}%`);}
function markDirty(){dirty=true;draftStatus='pending';clearTimeout(draftTimer);draftTimer=setTimeout(flushDraft,800);if(!maxDraftTimer)maxDraftTimer=setTimeout(flushDraft,4500);updateSave();}
function updateSave(){
  const label=dirty?(draftStatus==='saved'?`${t('draftSaved')} · ${new Date(draftSavedAt).toLocaleTimeString(locales[lang],{hour:'2-digit',minute:'2-digit'})}`:t(draftStatus==='error'?'draftSaveError':'draftSaving')):t(editing?'savedStatus':'clean');
  if($('saveIndicator').textContent!==label)$('saveIndicator').textContent=label;
  $('saveIndicator').classList.toggle('save-error',dirty&&draftStatus==='error');$('draftError').hidden=!(dirty&&draftStatus==='error');
  $('saveLabel').textContent=t(editing?'update':'save');$('deleteEntry').hidden=!editing;$('save').disabled=locked;
  $('storageError').hidden=!locked;
}
function clearDraftTimers(){clearTimeout(draftTimer);clearTimeout(maxDraftTimer);draftTimer=null;maxDraftTimer=null;}
function resetDraftContext(){clearDraftTimers();draftId=crypto.randomUUID();draftParent=null;lastDraft=null;draftStatus='idle';draftSavedAt=0;draftFailureNotified=false;}
function refreshDrafts(){
  try{draftCatalogue=readDrafts(localStorage);draftReadFailed=false;}catch{draftReadFailed=true;}
  const available=draftCatalogue.drafts.filter(d=>d.id!==draftId);
  $('draftBanner').hidden=available.length===0;
  $('draftCount').textContent=String(available.length);$('draftLatestTitle').textContent=available[0]?.entry.title||t('untitled');
  if($('draftsDialog').open)renderDraftManager();
}
function flushDraft(){
  clearDraftTimers();if(!dirty)return true;
  try{
    let matches=false;
    if(lastDraft){
      const raw=localStorage.getItem(DRAFT_PREFIX+draftId);let stored;
      try{if(raw!==null)stored=parseDraft(raw);}catch{}
      matches=stored?.revision===lastDraft.revision;
      if(raw!==null&&!matches){draftParent={id:lastDraft.id,revision:lastDraft.revision};draftId=crypto.randomUUID();lastDraft=null;}
    }
    if(draftStatus==='saved'&&matches)return true;
    lastDraft=writeDraft(localStorage,{app:'roky-music-diary-draft',version:2,id:draftId,revision:crypto.randomUUID(),parent:draftParent,updatedAt:Date.now(),editing,baseEntry:editing?JSON.parse(loadedVersion):null,entry:state});
    draftStatus='saved';draftSavedAt=lastDraft.updatedAt;draftFailureNotified=false;try{sessionStorage.setItem(DRAFT_POINTER,draftId);}catch{}
    updateSave();refreshDrafts();return true;
  }catch{draftStatus='error';updateSave();if(!draftFailureNotified)toast('draftSaveError');draftFailureNotified=true;return false;}
}
function finishActiveDraft(){
  clearDraftTimers();if(lastDraft){try{removeDraftBranch(localStorage,lastDraft);}catch{}}
  try{if(sessionStorage.getItem(DRAFT_POINTER)===draftId)sessionStorage.removeItem(DRAFT_POINTER);}catch{}
  resetDraftContext();refreshDrafts();
}
function applyRecoveredDraft(source){
  resetDraftContext();draftParent={id:source.id,revision:source.revision};state=structuredClone(source.entry);editing=source.editing;loadedVersion=editing?JSON.stringify(source.baseEntry):null;
  // Two restored new diaries must never accidentally publish over each other.
  if(!editing)state.id=crypto.randomUUID();dirty=true;draftStatus='pending';renderDraft();flushDraft();toast('draftRestored');
}
async function recoverDraft(source){
  if(!await canLeaveDraft())return;
  let latest;try{latest=readDrafts(localStorage).records.find(d=>d.id===source.id);}catch{toast('draftReadError');return;}
  if(!latest){toast('draftChanged');refreshDrafts();return;}
  await stopAudio();if($('draftsDialog').open)closeDialog($('draftsDialog'));applyRecoveredDraft(latest);window.scrollTo({top:0,behavior:'auto'});
}
function renderDraftManager(){
  const focused=document.activeElement,focusInList=$('draftList').contains(focused),focusedId=focused?.dataset.draftId,focusedAction=focused?.dataset.draftAction;
  const available=draftCatalogue.drafts.filter(d=>d.id!==draftId);
  $('draftRecoveryWarning').hidden=!(draftReadFailed||draftCatalogue.invalid.length);$('draftRecoveryWarning').textContent=t('draftReadError');$('exportDraftOriginal').hidden=draftCatalogue.invalid.length===0;
  const cards=available.map(draft=>{
    const card=document.createElement('article');card.className='draft-card';const title=document.createElement('h3');title.textContent=draft.entry.title||t('untitled');
    const meta=document.createElement('p');meta.textContent=`${draft.entry.date||t('draftDatePending')} · ${t(draft.entry.room)} · ${new Date(draft.updatedAt).toLocaleString(locales[lang],{month:'short',day:'numeric',hour:'2-digit',minute:'2-digit'})}`;
    const actions=document.createElement('div');const resume=document.createElement('button');resume.className='secondary-button';resume.textContent=t('resumeDraft');resume.dataset.draftId=draft.id;resume.dataset.draftAction='resume';resume.addEventListener('click',()=>recoverDraft(draft));
    const remove=document.createElement('button');remove.className='text-button danger';remove.textContent=t('deleteDraft');remove.dataset.draftId=draft.id;remove.dataset.draftAction='discard';remove.addEventListener('click',async()=>{if(!await ask('deleteDraftAsk','deleteDraft'))return;try{if(!removeDraftBranch(localStorage,draft)){toast('draftChanged');}else toast('draftDeleted');refreshDrafts();}catch{toast('draftReadError');}});
    actions.append(resume,remove);card.append(title,meta,actions);return card;
  });
  if(!cards.length){const p=document.createElement('p');p.className='draft-empty';p.textContent=t('noDrafts');cards.push(p);}
  $('draftList').replaceChildren(...cards);
  if(focusInList){const target=[...$('draftList').querySelectorAll('button')].find(button=>button.dataset.draftId===focusedId&&button.dataset.draftAction===focusedAction)||$('draftsDialog').querySelector('.close-dialog');target.focus({preventScroll:true});}
}
function renderMoods(){
  $('moodButtons').replaceChildren(...MOODS.map(m=>{const button=document.createElement('button');button.className='mood-chip';button.setAttribute('aria-pressed',String(state.moods.includes(m)));const symbol=document.createElement('span');symbol.className='mood-face';symbol.textContent=face[m];symbol.setAttribute('aria-hidden','true');const text=document.createElement('span');text.textContent=t(m);button.append(symbol,text);button.addEventListener('click',()=>{state.moods=state.moods.includes(m)?state.moods.filter(x=>x!==m):[...state.moods,m];button.setAttribute('aria-pressed',String(state.moods.includes(m)));markDirty();audio.update(state);});return button;}));
}
function renderSettings(){
  const field=(id,options)=>{const label=document.createElement('label');label.className='setting-field';const span=document.createElement('span');span.textContent=t(id);const select=document.createElement('select');select.id=`setting-${id}`;select.setAttribute('aria-label',t(id));for(const value of options){const option=new Option(t(value),value);select.add(option);}select.value=state[id];select.addEventListener('change',()=>{state[id]=select.value;markDirty();updateScene();});label.append(span,select);return label;};
  const pair=document.createElement('div');pair.className='setting-pair';pair.append(field('weather',WEATHERS),field('time',TIMES));
  $('sceneControls').replaceChildren(field('room',ROOMS.filter(room=>room!=='greenhouse'||owns('room-greenhouse')||state.room===room)),field('light',LIGHTS),pair);
  $('sleepTimer').replaceChildren(...[0,15,30,60].map(v=>new Option(v?`${v} ${t('minutes')}`:t('none'),String(v))));$('sleepTimer').value=String(sleepMinutes);
}
function renderSounds(){
  function tile(id){
    const wrap=document.createElement('div');wrap.className=`sound-tile${state.sounds[id]>0?' active':''}`;wrap.id=`tile-${id}`;
    const button=document.createElement('button');button.className='sound-toggle';button.setAttribute('aria-label',t(id));button.setAttribute('aria-pressed',String(state.sounds[id]>0));
    const symbol=document.createElement('span');symbol.className='sound-icon';symbol.textContent=icons[id];symbol.setAttribute('aria-hidden','true');const dot=document.createElement('span');dot.className='dot';button.append(symbol,dot);
    const label=document.createElement('label');label.className='sound-label';label.htmlFor=`sound-${id}`;const name=document.createElement('span');name.textContent=t(id);const output=document.createElement('output');output.id=`output-${id}`;output.textContent=`${state.sounds[id]}%`;label.append(name,output);
    const range=document.createElement('input');Object.assign(range,{id:`sound-${id}`,type:'range',min:'0',max:'100',value:String(state.sounds[id])});range.setAttribute('aria-label',t(id));setFill(range);
    const update=value=>{state.sounds[id]=value;range.value=String(value);output.textContent=`${value}%`;wrap.classList.toggle('active',value>0);button.setAttribute('aria-pressed',String(value>0));setFill(range);markDirty();audio.update(state);};
    range.addEventListener('input',()=>update(Number(range.value)));button.addEventListener('click',()=>update(state.sounds[id]>0?0:45));wrap.append(button,label,range);return wrap;
  }
  $('environmentSounds').replaceChildren(...SOUNDS.slice(0,6).map(tile));$('instrumentSounds').replaceChildren(...SOUNDS.slice(6).map(tile));
}
function updateScene(){
  for(const prop of ['room','light','weather','time'])$('roomScene').dataset[prop]=state[prop];
  $('roomDescription').textContent=`${t(state.room)} · ${t(state.time)}`;$('sceneCaption').textContent=`${t(state.weather)} / ${t(state.light)}`;$('sceneTitle').textContent=t('roomAlt');
  document.querySelector('.room-edition').textContent=`ROOM Nº ${String(ROOMS.indexOf(state.room)+1).padStart(2,'0')}`;
  const art=ROOM_ART[state.room];$('paintedWindowPath').setAttribute('d',art.window);$('paintedMoon').setAttribute('cx',art.moon[0]);$('paintedMoon').setAttribute('cy',art.moon[1]);$('paintedStarField').setAttribute('height',art.skyBottom);$('roomScene').style.setProperty('--lamp-x',`${art.lamp[0]}%`);$('roomScene').style.setProperty('--lamp-y',`${art.lamp[1]}%`);
  $('roomImage').alt=`${t(state.room)} · ${t(state.time)} · ${t(state.weather)} · ${t(state.light)}`;
  $('immersionDescription').textContent=`${t(state.room)} · ${t(state.time)} · ${t(state.weather)}`;
  for(const button of $('roomChoices').children)button.setAttribute('aria-pressed',String(button.dataset.room===state.room));
  revealSelectedRoom();
  sceneState($('roomScene').dataset.status||'loading');loadRoomArtwork(state.room,{onState:sceneState});
}
function revealSelectedRoom(){const row=$('roomChoices'),selected=row.querySelector('[aria-pressed="true"]');if(selected){const rowBox=row.getBoundingClientRect(),itemBox=selected.getBoundingClientRect();if(row.clientWidth>0)row.scrollTo({left:row.scrollLeft+itemBox.left-rowBox.left-(row.clientWidth-itemBox.width)/2,behavior:'auto'});}}
function sceneState(status){$('roomScene').dataset.status=status;$('sceneStatusText').textContent=t(status==='error'?'sceneError':'sceneLoading');$('retryScene').hidden=status!=='error';}
function renderRoomChoices(){
  $('roomChoices').setAttribute('aria-label',t('room'));
  $('roomChoices').replaceChildren(...ROOMS.filter(room=>room!=='greenhouse'||owns('room-greenhouse')||state.room===room).map(room=>{const button=document.createElement('button');button.className='room-thumbnail';button.dataset.room=room;button.setAttribute('aria-pressed',String(state.room===room));const image=document.createElement('img');image.src=ROOM_ART[room].src;image.alt='';image.loading='lazy';image.decoding='async';const label=document.createElement('span');label.textContent=t(room);button.append(image,label);button.addEventListener('click',()=>chooseRoom(room));return button;}));
}
function chooseRoom(room){state.room=room;$('setting-room').value=room;markDirty();updateScene();}
function updatePlayer(){
  document.body.classList.toggle('is-playing',audio.running);$('playIcon').textContent=audio.running?'Ⅱ':'▶';$('playLabel').textContent=t(audio.running?'pause':'play');$('playState').textContent=t(audio.running?'playing':'paused');$('play').setAttribute('aria-pressed',String(audio.running));
  $('catalogPlay').textContent=t(audio.running?'pause':'listenTrack');$('catalogPlay').setAttribute('aria-pressed',String(audio.running));
  $('immersionPlay').textContent=t(audio.running?'pause':'play');$('immersionPlay').setAttribute('aria-pressed',String(audio.running));
}
function renderDateStamp(){const date=new Date(state.date+'T12:00:00');if(!Number.isFinite(date.getTime()))return;$('stampDay').textContent=date.getDate();$('stampMonth').textContent=date.toLocaleDateString(locales[lang],{month:'short',year:'numeric'});$('stampWeekday').textContent=date.toLocaleDateString(locales[lang],{weekday:'long'});}
function renderDraft(){
  renderMoods();renderSettings();renderSounds();renderRoomChoices();updateScene();updatePlayer();updateSave();renderDateStamp();
  $('entryDate').value=state.date;$('entryTitle').value=state.title;$('entryNote').value=state.note;$('tempo').value=state.tempo;$('tempoOutput').value=state.tempo;$('master').value=state.master;$('masterOutput').value=`${state.master}%`;setFill($('tempo'));setFill($('master'));
  renderExpression();renderArrangement();
  renderCatalog();
}
function renderExpression(){
  const zone=musicExpression(state.brightness).zone;
  $('brightness').value=state.brightness;$('brightnessOutput').textContent=t(zone);$('brightness').setAttribute('aria-label',t('musicExpression'));$('brightness').setAttribute('aria-valuetext',`${t(zone)} · ${state.brightness}%`);setFill($('brightness'));
}
function renderCatalog(){
  const all=document.createElement('button');all.textContent=t('allTracks');all.setAttribute('aria-pressed',String(catalogCategory==='all'));all.addEventListener('click',()=>setCategory('all'));
  const buttons=CATEGORIES.map(category=>{const button=document.createElement('button');button.textContent=`${category.icon} ${localized(category.title,lang)}`;button.setAttribute('aria-pressed',String(catalogCategory===category.id));button.addEventListener('click',()=>setCategory(category.id));return button;});
  $('catalogFilters').replaceChildren(all,...buttons);$('catalogFilters').setAttribute('aria-label',t('backgroundMusic'));$('catalogSearch').value=catalogQuery;$('catalogSearch').setAttribute('aria-label',t('searchTracks'));renderTrackCards();
}
function setCategory(category){catalogCategory=category;catalogLimit=8;renderCatalog();[...$('catalogFilters').children].find(button=>button.getAttribute('aria-pressed')==='true')?.focus();}
function renderTrackCards(){
  const normalize=value=>value.normalize('NFKD').replace(/\p{M}/gu,'').toLocaleLowerCase();
  const query=normalize(catalogQuery.trim());
  const tracks=TRACKS.filter(track=>{const category=CATEGORIES.find(c=>c.id===track.category);return (catalogCategory==='all'||track.category===catalogCategory)&&(!query||[...track.title,...category.title].some(name=>normalize(name).includes(query)));});
  const cards=tracks.slice(0,catalogLimit).map(track=>{
    const category=CATEGORIES.find(c=>c.id===track.category),card=document.createElement('button');card.id=`track-${track.id}`;card.className='track-card';card.setAttribute('aria-pressed',String(track.id===state.trackId));card.setAttribute('aria-label',`${t('chooseTrack')}: ${localized(track.title,lang)}`);
    const cover=document.createElement('span');cover.className='track-cover';cover.style.setProperty('--cover',category.color);cover.setAttribute('aria-hidden','true');const icon=document.createElement('span');icon.textContent=category.icon;const num=document.createElement('small');num.textContent=String(track.seed+1).padStart(2,'0');cover.append(icon,num);
    const title=document.createElement('strong');title.textContent=localized(track.title,lang);const meta=document.createElement('small');const seconds=Math.round(3840/track.tempo);const duration=`${Math.floor(seconds/60)}:${String(seconds%60).padStart(2,'0')}`;meta.textContent=`${localized(category.title,lang)} · ${track.tempo} BPM · ${duration} ${t('loopLabel')}`;card.setAttribute('aria-label',`${t('chooseTrack')}: ${localized(track.title,lang)}, ${meta.textContent}`);
    const lockedTrack=Object.hasOwn(SHOP_ITEMS,`track-${track.id}`)&&!owns(`track-${track.id}`)&&track.id!==state.trackId;
    const action=document.createElement('span');action.className='track-action';action.textContent=lockedTrack?t('shopUnlock'):track.id===state.trackId?`✓ ${t('selectedTrack')}`:t('chooseTrack');if(lockedTrack)card.setAttribute('aria-label',`${localized(track.title,lang)}: ${t('shopUnlock')}`);card.append(cover,title,meta,action);card.addEventListener('click',()=>{if(lockedTrack){renderShop();showDialog('shopDialog');}else selectTrack(track);});return card;
  });
  if(!cards.length){const empty=document.createElement('p');empty.className='catalog-empty';empty.textContent=t('noTracks');cards.push(empty);}
  $('trackGrid').replaceChildren(...cards);$('catalogCount').textContent=`${tracks.length} / ${TRACKS.length}`;$('moreTracks').hidden=tracks.length<=catalogLimit;
  const selected=getTrack(state.trackId);$('selectedTrackTitle').textContent=selected?localized(selected.title,lang):t('customTrack');$('currentTrackLabel').textContent=selected?`${t('backgroundMusic')} · ${localized(selected.title,lang)}`:t('customTrack');$('clearTrack').hidden=!selected;
  $('immersionTrack').textContent=$('currentTrackLabel').textContent;
}
const arrangementPresets=[
  {id:'piano',label:'presetPiano',arrangement:{lead:'piano',rhythm:'gentle',density:'sparse'},mix:{piano:65,keys:22,bass:20,drums:14}},
  {id:'cafe',label:'presetCafe',arrangement:{lead:'keys',rhythm:'groove',density:'balanced'},mix:{keys:58,piano:22,bass:32,drums:26}},
  {id:'walk',label:'presetWalk',arrangement:{lead:'guitar',rhythm:'bossa',density:'full'},mix:{guitar:62,keys:22,piano:20,bass:30,drums:22}},
  {id:'dream',label:'presetDream',arrangement:{lead:'bell',rhythm:'gentle',density:'full'},mix:{bell:55,keys:40,piano:20,bass:16,drums:12}}
];
function syncArrangement(){
  const enabled=Boolean(getTrack(state.trackId));$('arrangementControls').disabled=!enabled;$('arrangeStart').hidden=enabled;$('arrangeEmpty').hidden=enabled;
  for(const [field,id] of [['lead','arrangeLead'],['rhythm','arrangeRhythm'],['density','arrangeDensity']])$(id).value=state.arrangement[field];
}
function renderArrangement(){
  const labels={original:'arrangeOriginal',gentle:'rhythmGentle',steady:'rhythmSteady',groove:'rhythmGroove',bossa:'rhythmBossa',sparse:'densitySparse',balanced:'densityBalanced',full:'densityFull'};
  for(const [id,values]of [['arrangeLead',LEADS],['arrangeRhythm',RHYTHMS],['arrangeDensity',DENSITIES]])$(id).replaceChildren(...values.map(value=>new Option(t(labels[value]||value),value)));
  $('arrangementPresets').replaceChildren(...arrangementPresets.map(preset=>{const button=document.createElement('button');button.type='button';button.className='arrangement-preset';button.dataset.preset=preset.id;button.textContent=t(preset.label);button.addEventListener('click',()=>applyArrangementPreset(preset));return button;}));
  syncArrangement();
}
function arrangementChanged(){syncArrangement();renderSounds();markDirty();audio.update(state);}
function applyArrangementPreset(preset){
  if(!getTrack(state.trackId))return;
  state.arrangement={...preset.arrangement};for(const id of SOUNDS.slice(6))state.sounds[id]=preset.mix[id]||0;arrangementChanged();
}
function selectTrack(track,{focus=true}={}){
  state.trackId=track.id;state.tempo=track.tempo;state.brightness=track.brightness;state.arrangement=defaultArrangement();
  // A composition supplies the instrument mix; the user's room and environmental sounds stay personal.
  for(const id of SOUNDS.slice(6))state.sounds[id]=track.mix[id]||0;
  renderSounds();renderExpression();$('tempo').value=state.tempo;$('tempoOutput').value=state.tempo;setFill($('tempo'));renderTrackCards();syncArrangement();if(focus)$(`track-${track.id}`)?.focus();markDirty();audio.update(state);toast(audio.running?'trackQueued':'trackSelected');
}
function entryCard(entry){
  const button=document.createElement('button');button.className='entry-card';button.setAttribute('aria-label',`${t('openEntry')}: ${entry.title||t('untitled')}, ${entry.date}`);
  const preview=document.createElement('span');preview.className='entry-preview';preview.dataset.room=entry.room;preview.dataset.time=entry.time;
  const faceEl=document.createElement('span');faceEl.textContent=(entry.moods.length?entry.moods:['calm']).slice(0,3).map(m=>face[m]).join(' ');faceEl.setAttribute('aria-hidden','true');const wave=document.createElement('span');wave.className='mini-wave';wave.setAttribute('aria-hidden','true');for(const height of [5,12,19,10,23,15,6,12,18,7,14]){const bar=document.createElement('i');bar.style.height=`${height}px`;wave.append(bar);}preview.append(faceEl,wave);
  const body=document.createElement('span');body.className='entry-body';const date=document.createElement('time');date.dateTime=entry.date;date.textContent=new Date(entry.date+'T12:00:00').toLocaleDateString(locales[lang],{year:'numeric',month:'short',day:'numeric',weekday:'short'});
  const title=document.createElement('strong');title.textContent=entry.title||t('untitled');const details=document.createElement('small');const track=getTrack(entry.trackId);details.textContent=`${entry.moods.map(t).join(' · ')}${entry.moods.length?' / ':''}${t(entry.room)}${track?' · '+localized(track.title,lang):''}`;body.append(date,title,details);button.append(preview,body);button.addEventListener('click',()=>openEntry(entry));return button;
}
function emptyState(){const wrap=document.createElement('div');wrap.className='empty-state';const symbol=document.createElement('span');symbol.className='empty-icon';symbol.textContent='♬';symbol.setAttribute('aria-hidden','true');const strong=document.createElement('strong');strong.textContent=t('empty');const p=document.createElement('p');p.textContent=t('emptyHelp');wrap.append(symbol,strong,p);return wrap;}
function renderEntries(){const sorted=[...entries].reverse().sort((a,b)=>b.date.localeCompare(a.date));$('recentEntries').replaceChildren(...(sorted.length?sorted.slice(0,6).map(entryCard):[emptyState()]));if($('calendarDialog').open)renderCalendar();if($('albumDialog').open){cancelAlbumExport();albumPlayer.stop();renderAlbum();}}
async function openEntry(entry){
  if(!await canLeaveDraft())return;
  await stopAudio();resetDraftContext();state=structuredClone(entry);loadedVersion=JSON.stringify(entry);editing=true;dirty=false;renderDraft();refreshDrafts();if($('calendarDialog').open)closeDialog($('calendarDialog'));if($('albumDialog').open)closeDialog($('albumDialog'));window.scrollTo({top:0,behavior:'auto'});toast('opened');
}
async function newDiary(date=localDate()){
  if(!await canLeaveDraft())return;
  await stopAudio();resetDraftContext();state=fresh(date);loadedVersion=null;editing=false;dirty=false;renderDraft();refreshDrafts();if($('calendarDialog').open)closeDialog($('calendarDialog'));window.scrollTo({top:0,behavior:'auto'});
}
function renderCalendar(){
  $('calendarMonth').textContent=calendarDate.toLocaleDateString(locales[lang],{year:'numeric',month:'long'});
  $('prevMonth').setAttribute('aria-label',t('prev'));$('nextMonth').setAttribute('aria-label',t('next'));
  $('weekdays').replaceChildren(...Array.from({length:7},(_,i)=>{const span=document.createElement('span');span.textContent=new Date(2026,9,25+i,12).toLocaleDateString(locales[lang],{weekday:'narrow'});return span;}));
  const days=new Date(calendarDate.getFullYear(),calendarDate.getMonth()+1,0).getDate(),offset=calendarDate.getDay();const cells=[];
  for(let i=0;i<offset;i++){const span=document.createElement('span');span.setAttribute('aria-hidden','true');cells.push(span);}
  for(let day=1;day<=days;day++){
    const date=localDate(new Date(calendarDate.getFullYear(),calendarDate.getMonth(),day,12)),records=entries.filter(e=>e.date===date),button=document.createElement('button');
    button.className=`calendar-day${records.length?' has-entry':''}${date===selectedDay?' selected':''}${date===localDate()?' is-today':''}`;button.textContent=String(day);button.setAttribute('aria-label',`${date}, ${records.length} ${t('entries')}`);button.setAttribute('aria-pressed',String(date===selectedDay));if(date===localDate())button.setAttribute('aria-current','date');
    if(records.length){const dot=document.createElement('i');dot.style.setProperty('--day-color',moodColors[records[0].moods[0]]||'#9cae88');button.append(dot);}
    button.addEventListener('click',()=>{selectedDay=date;renderCalendar();$('calendarGrid').querySelector('[aria-pressed="true"]')?.focus();});cells.push(button);
  }
  $('calendarGrid').replaceChildren(...cells);
  const records=entries.filter(e=>e.date===selectedDay),p=document.createElement('p');p.textContent=selectedDay;
  const children=[p];if(records.length)children.push(...records.map(entryCard));else{const empty=document.createElement('p');empty.textContent=t('noDay');children.push(empty);}
  const create=document.createElement('button');create.className='secondary-button';create.textContent=t('dayWrite');create.addEventListener('click',()=>newDiary(selectedDay));children.push(create);$('dayEntries').replaceChildren(...children);
}
function albumEntries(){return entriesForMonth(entries,albumDate.getFullYear(),albumDate.getMonth());}
function renderShop(){
  $('shopBalance').textContent=t('rewardBalance').replace('{count}',walletBalance(wallet));
  $('shopItems').replaceChildren(...Object.entries(SHOP_ITEMS).map(([id,item])=>{
    const row=document.createElement('article');row.className='shop-item';
    const body=document.createElement('div'),title=document.createElement('strong'),description=document.createElement('p');
    title.textContent=item.kind==='room'?t('greenhouse'):localized(getTrack(item.value).title,lang);
    description.textContent=item.kind==='room'?t('shopRoomHelp'):t('shopTrackHelp');body.append(title,description);
    const button=document.createElement('button');button.type='button';button.className='secondary-button';button.disabled=locked||owns(id)||walletBalance(wallet)<item.cost;
    button.textContent=owns(id)?t('shopOwned'):t('shopPrice').replace('{count}',item.cost);
    button.addEventListener('click',()=>{try{updateWallet(w=>purchaseItem(w,id));refreshRewards();renderRoomChoices();renderSettings();renderTrackCards();toast('shopPurchased');}catch(error){toast(error.message==='INSUFFICIENT_NOTES'?'rewardNotEnough':'errorSave');}});
    if(item.kind==='room'){const image=document.createElement('img');image.src=ROOM_ART[item.value].src;image.alt='';image.loading='lazy';row.append(image);}row.append(body,button);return row;
  }));
}
function renderDayExport(){
  const plan=exportPlan([state],$('dayExportMode').value),format=$('dayExportFormat').value,job=dayExportJob;
  const supported=Boolean(globalThis.OfflineAudioContext||globalThis.webkitOfflineAudioContext)&&(format==='wav'||typeof Worker==='function'&&typeof WebAssembly==='object');
  const seconds=Math.round(plan.frames/SAMPLE_RATE),duration=`${Math.floor(seconds/60)}:${String(seconds%60).padStart(2,'0')}`;
  $('dayExportEstimate').textContent=t('dayExportEstimate').replace('{duration}',duration).replace('{size}',(estimatedBytes(plan,format)/1_000_000).toFixed(1));
  $('dayExportFormat').disabled=Boolean(job);$('dayExportMode').disabled=Boolean(job);
  $('dayExportStart').disabled=Boolean(job)||locked||!supported||!plan.segments.length||walletBalance(wallet)<1;
  $('dayExportCancel').hidden=!job;$('dayExportCancel').disabled=Boolean(job?.controller.signal.aborted);
  $('dayExportProgress').hidden=!job;if(job){$('dayExportProgress').max=job.total;$('dayExportProgress').value=job.done;}
  $('dayExportStatus').textContent=job?(job.controller.signal.aborted?t('albumExportCancelling'):t('albumExportWorking').replace('{done}',job.done).replace('{total}',job.total)):dayExportFeedback?t(dayExportFeedback):!supported?t('albumExportUnavailable'):!plan.segments.length?t('noSounds'):walletBalance(wallet)<1?t('rewardNotEnough'):'';
}
function cancelDayExport(){if(dayExportJob){dayExportJob.controller.abort();if($('dayExportDialog').open)renderDayExport();}}
async function exportDay(){
  if(dayExportJob)return;
  const entry=structuredClone(state),format=$('dayExportFormat').value,plan=exportPlan([entry],$('dayExportMode').value);
  if(!plan.segments.length||locked||walletBalance(wallet)<1||!(globalThis.OfflineAudioContext||globalThis.webkitOfflineAudioContext)||(format==='mp3'&&(typeof Worker!=='function'||typeof WebAssembly!=='object')))return;
  const job={controller:new AbortController(),done:0,total:1};dayExportJob=job;dayExportFeedback='';renderDayExport();$('dayExportCancel').focus();
  try{
    await stopAudio();await albumPlayer.stop();
    const blob=await (format==='mp3'?renderAlbumMp3:renderAlbumWav)(plan,{signal:job.controller.signal,onProgress:(done,total)=>{job.done=done;job.total=total;if($('dayExportDialog').open)renderDayExport();}});
    if(job.controller.signal.aborted)throw new DOMException('Cancelled','AbortError');
    await saveAudioWithReward(blob,`roky-music-day-${entry.date||localDate()}.${format}`,job.controller.signal);dayExportFeedback=isAndroid?'fileSaved':'dayExportDone';
  }catch(error){dayExportFeedback=error?.name==='AbortError'?'albumExportCancelled':error.message==='INSUFFICIENT_NOTES'?'rewardNotEnough':'albumExportFailed';}
  finally{if(dayExportJob===job)dayExportJob=null;if($('dayExportDialog').open){renderDayExport();$('dayExportStart').focus();}}
}
function renderAlbumExport(records=albumEntries()){
  const mode=$('albumExportMode').value,format=$('albumExportFormat').value,plan=exportPlan(records,mode),supported=Boolean(globalThis.OfflineAudioContext||globalThis.webkitOfflineAudioContext)&&(format==='wav'||(typeof Worker==='function'&&typeof WebAssembly==='object')),job=albumExportJob;
  const seconds=Math.round(plan.frames/SAMPLE_RATE),duration=`${Math.floor(seconds/60)}:${String(seconds%60).padStart(2,'0')}`,size=(estimatedBytes(plan,format)/1_000_000).toFixed(1);
  let estimate=t('albumExportEstimate').replace('{count}',plan.segments.length).replace('{duration}',duration).replace('{size}',size);
  if(plan.skipped)estimate+=` ${t('albumExportSkipped').replace('{count}',plan.skipped)}`;
  $('albumExportEstimate').textContent=estimate;
  $('albumExportMode').disabled=Boolean(job);$('albumExportFormat').disabled=Boolean(job);$('albumExport').disabled=Boolean(job)||locked||!supported||!plan.segments.length||plan.bytes>MAX_WAV_BYTES||walletBalance(wallet)<1;
  $('albumExportCancel').hidden=!job;$('albumExportCancel').disabled=Boolean(job?.controller.signal.aborted);
  $('albumExportProgress').setAttribute('aria-label',t('albumExportTitle'));$('albumExportProgress').hidden=!job;if(job){$('albumExportProgress').max=job.total;$('albumExportProgress').value=job.done;}
  let status=job?(job.controller.signal.aborted?t('albumExportCancelling'):t('albumExportWorking').replace('{done}',job.done).replace('{total}',job.total)):
    albumExportFeedback?t(albumExportFeedback):!supported?t('albumExportUnavailable'):plan.bytes>MAX_WAV_BYTES?t('albumExportLarge'):walletBalance(wallet)<1?t('rewardNotEnough'):'';
  if($('albumExportStatus').textContent!==status)$('albumExportStatus').textContent=status;
}
function cancelAlbumExport(){if(!albumExportJob)return;albumExportJob.controller.abort();if($('albumDialog').open)renderAlbumExport();}
async function exportAlbum(){
  if(albumExportJob)return;
  const records=structuredClone(albumEntries()),format=$('albumExportFormat').value,plan=exportPlan(records,$('albumExportMode').value);
  if(!plan.segments.length||locked||walletBalance(wallet)<1||plan.bytes>MAX_WAV_BYTES||!(globalThis.OfflineAudioContext||globalThis.webkitOfflineAudioContext)||(format==='mp3'&&(typeof Worker!=='function'||typeof WebAssembly!=='object')))return;
  const filename=`roky-music-album-${String(albumDate.getFullYear()).padStart(4,'0')}-${String(albumDate.getMonth()+1).padStart(2,'0')}.${format}`;
  const job={controller:new AbortController(),done:0,total:plan.segments.length};albumExportJob=job;albumExportFeedback='';renderAlbum();$('albumExportCancel').focus();
  try{
    await albumPlayer.stop();
    const render=format==='mp3'?renderAlbumMp3:renderAlbumWav;
    const blob=await render(plan,{signal:job.controller.signal,onProgress:(done,total)=>{job.done=done;job.total=total;if($('albumDialog').open)renderAlbumExport();}});
    if(job.controller.signal.aborted)throw new DOMException('Cancelled','AbortError');
    await saveAudioWithReward(blob,filename,job.controller.signal);albumExportFeedback=isAndroid?'fileSaved':'albumExportDone';
  }catch(error){albumExportFeedback=error?.name==='AbortError'?'albumExportCancelled':error.message==='INSUFFICIENT_NOTES'?'rewardNotEnough':'albumExportFailed';}
  finally{if(albumExportJob===job)albumExportJob=null;if($('albumDialog').open){renderAlbum();$('albumExport').focus();}}
}
function renderAlbum(){
  const records=albumEntries(),summary=albumSummary(records);albumIndex=records.length?Math.max(0,Math.min(albumIndex,records.length-1)):0;
  const chosen=records[albumIndex],month=albumDate.toLocaleDateString(locales[lang],{year:'numeric',month:'long'});
  $('albumMonth').textContent=month;$('albumCoverMonth').textContent=month;
  $('albumPreviousMonth').setAttribute('aria-label',t('albumPrevious'));$('albumNextMonth').setAttribute('aria-label',t('albumNext'));
  $('albumPreviousMonth').disabled=Boolean(albumExportJob)||(albumDate.getFullYear()===0&&albumDate.getMonth()===0);$('albumNextMonth').disabled=Boolean(albumExportJob)||(albumDate.getFullYear()===9999&&albumDate.getMonth()===11);
  $('albumCounts').textContent=t('albumCounts').replace('{days}',summary.days).replace('{entries}',summary.entries);
  $('albumCoverImage').src=ROOM_ART[chosen?.room||'attic'].src;$('albumCover').dataset.empty=String(!chosen);
  $('albumMoods').replaceChildren(...MOODS.filter(mood=>summary.moods[mood]).map(mood=>{const chip=document.createElement('span');chip.textContent=`${face[mood]} ${t(mood)} · ${summary.moods[mood]}`;return chip;}));
  $('albumCurrent').textContent=chosen?`${chosen.date} · ${chosen.title||t('untitled')}`:t('albumNoSelection');
  const available=nextAudible(records,0)!==-1;
  $('albumStatus').textContent=albumError?t('errorAudio'):albumPlayer.loading?t('albumLoading'):albumPlayer.playing?t('albumPlaying'):albumPlayer.ended?t('albumEnded'):records.length&&!available?t('albumNoSound'):t('albumReady');
  $('albumPlay').textContent=t(albumPlayer.playing||albumPlayer.loading?'albumStop':'albumPlay');$('albumPlay').disabled=Boolean(albumExportJob)||(!(albumPlayer.playing||albumPlayer.loading)&&nextAudible(records,albumIndex)===-1);
  renderAlbumExport(records);
  $('albumTrackCount').textContent=String(records.length);$('albumEmpty').hidden=records.length>0;
  const active=document.activeElement,focusId=active?.dataset.albumId,focusAction=active?.dataset.albumAction;
  const rows=records.map((entry,index)=>{
    const row=document.createElement('article');row.className='album-track';row.dataset.selected=String(index===albumIndex);
    const select=document.createElement('button');select.type='button';select.className='album-track-select';select.dataset.albumId=entry.id;select.dataset.albumAction='select';select.setAttribute('aria-pressed',String(index===albumIndex));select.setAttribute('aria-label',`${t('albumSelect')}: ${entry.date} · ${entry.title||t('untitled')}`);
    const number=document.createElement('span');number.className='album-track-number';number.textContent=String(index+1).padStart(2,'0');
    const art=document.createElement('img');art.src=ROOM_ART[entry.room].src;art.alt='';art.loading='lazy';
    const body=document.createElement('span');body.className='album-track-info';const title=document.createElement('strong');title.textContent=entry.title||t('untitled');const details=document.createElement('small');const track=getTrack(entry.trackId);details.textContent=`${entry.date} · ${track?localized(track.title,lang):t('customTrack')}${canHear(entry)?'':` · ${t('albumMuted')}`}`;body.append(title,details);select.append(number,art,body);
    select.disabled=Boolean(albumExportJob);select.addEventListener('click',()=>{albumIndex=index;albumError=false;if(albumPlayer.playing||albumPlayer.loading)albumPlayer.playFrom(records,index);else renderAlbum();});
    const open=document.createElement('button');open.type='button';open.className='album-open text-button';open.disabled=Boolean(albumExportJob);open.dataset.albumId=entry.id;open.dataset.albumAction='open';open.textContent=t('albumOpen');open.setAttribute('aria-label',`${t('albumOpen')}: ${entry.title||t('untitled')}, ${entry.date}`);open.addEventListener('click',()=>openEntry(entry));row.append(select,open);return row;
  });
  $('albumTracks').replaceChildren(...rows);
  if(focusId){[...$('albumTracks').querySelectorAll('button')].find(button=>button.dataset.albumId===focusId&&button.dataset.albumAction===focusAction)?.focus({preventScroll:true});}
}
async function openAlbum(){
  await stopAudio();albumPlayer.stop();albumDate=new Date(new Date().getFullYear(),new Date().getMonth(),1,12);albumIndex=0;albumError=false;albumExportFeedback='';renderAlbum();showDialog('albumDialog');
}
function changeAlbumMonth(offset){
  if(albumExportJob)return;
  const total=albumDate.getFullYear()*12+albumDate.getMonth()+offset;if(total<0||total>9999*12+11)return;
  albumPlayer.stop();const next=new Date(0);next.setFullYear(Math.floor(total/12),total%12,1);next.setHours(12,0,0,0);albumDate=next;albumIndex=0;albumError=false;renderAlbum();
}
function renderLanguage(){
  document.documentElement.lang=lang;document.title=`${t('brand')} · ${t('subtitle')}`;$('language').value=lang;
  for(const el of document.querySelectorAll('[data-i18n]'))el.textContent=t(el.dataset.i18n);
  if(isAndroid)for(const el of document.querySelectorAll('[data-i18n="localNotice"]'))el.textContent=t('androidLocalNotice');
  for(const el of document.querySelectorAll('[data-placeholder]'))el.placeholder=t(el.dataset.placeholder);
  for(const el of document.querySelectorAll('.close-dialog'))el.setAttribute('aria-label',t('close'));
  for(const el of document.querySelectorAll('a[target="_blank"]'))el.setAttribute('aria-label',`${el.textContent.trim()} (${t('newTab')})`);
  $('master').setAttribute('aria-label',t('master'));$('tempo').setAttribute('aria-label',t('tempo'));
  renderDraft();renderEntries();refreshDrafts();refreshRewards();if($('calendarDialog').open)renderCalendar();if($('dayExportDialog').open)renderDayExport();if($('albumDialog').open)renderAlbum();
}
function restartTimer(){
  clearInterval(timerTick);timerEnd=0;
  if(!audio.running||!sleepMinutes)return;
  timerEnd=Date.now()+sleepMinutes*60_000;
  timerTick=setInterval(()=>{const remain=timerEnd-Date.now();if(remain<=0){stopAudio();toast('timerDone');}else if(remain<10000&&audio.context)audio.output.gain.setTargetAtTime(state.master/100*.62*(remain/10000),audio.context.currentTime,.5);},1000);
}
async function stopAudio(){clearInterval(timerTick);timerEnd=0;await audio.stop();updatePlayer();}
$('play').addEventListener('click',async()=>{
  if(audio.running){await stopAudio();return;}
  if(!Object.values(state.sounds).some(v=>v>0)){toast('noSounds');return;}
  $('play').disabled=true;
  try{await audio.start(state);updatePlayer();restartTimer();}catch{await audio.stop();toast('errorAudio');updatePlayer();}finally{$('play').disabled=false;}
});
for(const id of ['master','tempo'])$(id).addEventListener('input',()=>{state[id]=Number($(id).value);$(`${id}Output`).value=id==='master'?`${state[id]}%`:String(state[id]);setFill($(id));markDirty();audio.update(state);});
$('brightness').addEventListener('input',()=>{state.brightness=Number($('brightness').value);renderExpression();markDirty();audio.update(state);});
$('catalogSearch').addEventListener('input',()=>{catalogQuery=$('catalogSearch').value;catalogLimit=8;renderTrackCards();});
$('moreTracks').addEventListener('click',()=>{const count=$('trackGrid').children.length;catalogLimit+=8;renderTrackCards();$('trackGrid').children[count]?.focus();});
$('catalogPlay').addEventListener('click',()=>{if(!$('play').disabled)$('play').click();});
$('browseMusic').addEventListener('click',()=>{$('catalogDetails').open=true;$('catalogSection').scrollIntoView({block:'start',behavior:'auto'});});
$('goWrite').addEventListener('click',()=>document.querySelector('.journal-section').scrollIntoView({block:'start',behavior:'auto'}));
$('enterImmersion').addEventListener('click',()=>{const focus=document.activeElement;$('immersiveStage').append($('roomScene'));document.body.classList.add('is-immersed');showDialog('immersionDialog');lastFocus.set($('immersionDialog'),focus);});
$('leaveImmersion').addEventListener('click',()=>closeDialog($('immersionDialog')));
$('immersionPlay').addEventListener('click',()=>{if(!$('play').disabled)$('play').click();});
$('nextRoom').addEventListener('click',()=>chooseRoom(ROOMS[(ROOMS.indexOf(state.room)+1)%ROOMS.length]));
$('retryScene').addEventListener('click',()=>loadRoomArtwork(state.room,{force:true,onState:sceneState}));
$('clearTrack').addEventListener('click',()=>{state.trackId=null;state.arrangement=defaultArrangement();renderTrackCards();syncArrangement();markDirty();audio.update(state);});
$('arrangeStart').addEventListener('click',()=>{selectTrack(TRACKS[0],{focus:false});$('arrangeLead').focus();});
for(const [field,id]of [['lead','arrangeLead'],['rhythm','arrangeRhythm'],['density','arrangeDensity']])$(id).addEventListener('change',()=>{
  const track=getTrack(state.trackId);if(!track)return;
  state.arrangement[field]=$(id).value;
  if(field==='lead'){const lead=state.arrangement.lead==='original'?trackLead(track):state.arrangement.lead;if(state.sounds[lead]===0)state.sounds[lead]=50;}
  if(field==='rhythm'&&state.arrangement.rhythm!=='original'&&state.sounds.drums===0)state.sounds.drums=22;
  arrangementChanged();
});
$('arrangeReset').addEventListener('click',()=>{const track=getTrack(state.trackId);if(!track)return;state.arrangement=defaultArrangement();for(const id of SOUNDS.slice(6))state.sounds[id]=track.mix[id]||0;arrangementChanged();});
$('sleepTimer').addEventListener('change',()=>{sleepMinutes=Number($('sleepTimer').value);restartTimer();});
$('suggest').addEventListener('click',()=>{
  const recipes={calm:{rain:30,piano:48,keys:15},happy:{birds:25,piano:45,drums:25,bass:28},sad:{rain:40,piano:52,bell:12},tired:{fire:35,keys:45,piano:22},hopeful:{waves:30,guitar:48,bell:20,bass:18},restless:{wind:20,waves:25,keys:40}};
  const moods=state.moods.length?state.moods:['calm'];state.sounds=Object.fromEntries(SOUNDS.map(s=>[s,Math.round(moods.reduce((sum,m)=>sum+(recipes[m][s]||0),0)/moods.length)]));state.tempo=moods.includes('tired')||moods.includes('sad')?62:moods.includes('happy')?92:72;
  const expressions={calm:50,happy:85,sad:15,tired:25,hopeful:78,restless:30};state.brightness=Math.round(moods.reduce((sum,m)=>sum+expressions[m],0)/moods.length);renderExpression();
  renderSounds();$('tempo').value=state.tempo;$('tempoOutput').value=state.tempo;setFill($('tempo'));audio.update(state);markDirty();toast('suggested');
});
$('resetMix').addEventListener('click',()=>{for(const key of SOUNDS)state.sounds[key]=0;renderSounds();audio.update(state);markDirty();toast('clearAll');});
for(const [id,prop]of [['entryDate','date'],['entryTitle','title'],['entryNote','note']])$(id).addEventListener('input',()=>{state[prop]=$(id).value;markDirty();if(prop==='date')renderDateStamp();});
$('diaryForm').addEventListener('submit',async event=>{
  event.preventDefault();if(locked){toast('errorLoad');return;}
  state.date=$('entryDate').value;state.title=$('entryTitle').value;state.note=$('entryNote').value;
  let safe;try{safe=validateEntry(state);}catch{toast('dateInvalid');return;}
  flushDraft();
  try{
    let latest=readEntries(localStorage);
    const current=latest.find(e=>e.id===safe.id);
    if(editing&&JSON.stringify(current)!==loadedVersion){
      if(!await ask('conflict','saveCopy'))return;
      safe.id=crypto.randomUUID();latest=readEntries(localStorage);
    }
    const updated=latest.some(e=>e.id===safe.id)?latest.map(e=>e.id===safe.id?safe:e):[...latest,safe];
    const previousWallet=awardDays(readWallet(localStorage),latest),next=awardDays(previousWallet,updated),earned=next.days.length>previousWallet.days.length;
    writeEntries(localStorage,updated,next);wallet=next;entries=updated;state=safe;loadedVersion=JSON.stringify(safe);editing=true;dirty=false;finishActiveDraft();updateSave();renderEntries();refreshRewards();toast(earned?'rewardEarned':'saved');
  }catch{toast('errorSave');}
});
$('newEntry').addEventListener('click',()=>newDiary());
$('deleteEntry').addEventListener('click',async()=>{if(locked||!editing||!await ask('deleteAsk','delete'))return;try{const latest=readEntries(localStorage);if(JSON.stringify(latest.find(e=>e.id===state.id))!==loadedVersion){toast('conflict');return;}const updated=latest.filter(e=>e.id!==state.id),next=awardDays(readWallet(localStorage),latest);writeEntries(localStorage,updated,next);wallet=next;entries=updated;dirty=false;finishActiveDraft();await newDiary(state.date);renderEntries();refreshRewards();toast('deleted');}catch{toast('errorSave');}});
for(const id of ['calendarNav','calendarMore'])$(id).addEventListener('click',()=>{selectedDay=state.date||localDate();calendarDate=new Date(selectedDay+'T12:00:00');calendarDate.setDate(1);renderCalendar();showDialog('calendarDialog');});
for(const id of ['albumNav','albumMore'])$(id).addEventListener('click',openAlbum);
for(const [id,offset]of [['albumPreviousMonth',-1],['albumNextMonth',1]])$(id).addEventListener('click',()=>changeAlbumMonth(offset));
$('albumPlay').addEventListener('click',async()=>{if(albumPlayer.playing||albumPlayer.loading){albumPlayer.stop();return;}const records=albumEntries();if(nextAudible(records,albumIndex)===-1)return;albumError=false;await stopAudio();if($('albumDialog').open)albumPlayer.playFrom(records,albumIndex);});
$('albumExportMode').addEventListener('change',()=>{albumExportFeedback='';renderAlbumExport();});
$('albumExportFormat').addEventListener('change',()=>{albumExportFeedback='';renderAlbumExport();});
$('albumExport').addEventListener('click',exportAlbum);$('albumExportCancel').addEventListener('click',cancelAlbumExport);
$('shopNav').addEventListener('click',()=>{renderShop();showDialog('shopDialog');});
$('dayExportOpen').addEventListener('click',()=>{dayExportFeedback='';renderDayExport();showDialog('dayExportDialog');});
for(const id of ['dayExportFormat','dayExportMode'])$(id).addEventListener('change',()=>{dayExportFeedback='';renderDayExport();});
$('dayExportStart').addEventListener('click',exportDay);$('dayExportCancel').addEventListener('click',cancelDayExport);
$('todayNav').addEventListener('click',()=>window.scrollTo({top:0,behavior:'auto'}));
for(const [id,offset]of [['prevMonth',-1],['nextMonth',1]])$(id).addEventListener('click',()=>{calendarDate.setMonth(calendarDate.getMonth()+offset);renderCalendar();});
$('language').addEventListener('change',()=>{lang=$('language').value;try{localStorage.setItem('roky-music-language',lang);}catch{}renderLanguage();});
$('manageDrafts').addEventListener('click',()=>{if(dirty)flushDraft();refreshDrafts();renderDraftManager();showDialog('draftsDialog');});
$('bannerDrafts').addEventListener('click',()=>{refreshDrafts();renderDraftManager();showDialog('draftsDialog');});
$('resumeLatestDraft').addEventListener('click',()=>{const source=draftCatalogue.drafts.find(d=>d.id!==draftId);if(source)recoverDraft(source);});
$('retryDraftSave').addEventListener('click',()=>{draftStatus='pending';flushDraft();});
$('exportDraftOriginal').addEventListener('click',()=>backupFile($('exportDraftOriginal'),JSON.stringify({app:'roky-music-draft-recovery',exportedAt:new Date().toISOString(),originals:draftCatalogue.invalid},null,2),`roky-draft-originals-${Date.now()}.json`));
$('export').addEventListener('click',()=>{if(locked){$('rawBackup').click();return;}try{const latest=readEntries(localStorage),current=awardDays(readWallet(localStorage),latest);backupFile($('export'),encodeBackup(latest,current),`roky-music-diary-${localDate()}.json`);}catch{toast('errorLoad');}});
$('rawBackup').addEventListener('click',()=>{if(rawOriginal===null){toast('errorLoad');return;}const original=rawOriginal;backupFile($('rawBackup'),original,`roky-original-${Date.now()}.json`,()=>{if(rawOriginal===original)rawDownloaded=true;});});
$('import').addEventListener('click',()=>{if(locked&&!rawDownloaded){toast('errorLoad');$('storageError').scrollIntoView({behavior:'smooth',block:'center'});return;}$('importFile').click();});
$('importFile').addEventListener('change',async()=>{
  const file=$('importFile').files[0];if(!file)return;
  try{if(file.size>5_000_000)throw new Error('TOO_LARGE');const raw=await file.text(),imported=parseBackup(raw),incoming=walletFromBackup(raw),updated=locked?imported:mergeEntries(readEntries(localStorage),imported),current=locked?emptyWallet():readWallet(localStorage),next=awardDays(mergeWallets(current,incoming),updated);writeEntries(localStorage,updated,next);wallet=next;entries=updated;locked=false;updateSave();renderEntries();refreshRewards();renderDraft();toast('imported');}catch(error){toast(error?.name==='QuotaExceededError'||error?.name==='SecurityError'?'errorSave':'invalidBackup');}finally{$('importFile').value='';}
});
for(const button of document.querySelectorAll('[data-dialog]'))button.addEventListener('click',()=>showDialog(button.dataset.dialog));
for(const button of document.querySelectorAll('.close-dialog'))button.addEventListener('click',()=>closeDialog(button.closest('dialog')));
for(const dialog of document.querySelectorAll('dialog:not(#confirmDialog)'))dialog.addEventListener('cancel',event=>{event.preventDefault();closeDialog(dialog);});
$('confirmCancel').addEventListener('click',()=>finishConfirm(false));$('confirmAccept').addEventListener('click',()=>finishConfirm(true));$('confirmDialog').addEventListener('cancel',event=>{event.preventDefault();finishConfirm(false);});
$('copyBank')?.addEventListener('click',async()=>{try{await navigator.clipboard.writeText('3333071025774');$('copyStatus').textContent=t('copied');}catch{$('copyStatus').textContent=t('copyFail');$('bankNumber').focus();$('bankNumber').select();}});
document.addEventListener('visibilitychange',()=>{if(document.hidden){flushDraft();if(audio.running){stopAudio();toast('hiddenPause');}if(albumPlayer.playing||albumPlayer.loading)albumPlayer.stop();}});
function pauseAndroid(){flushDraft();stopAudio();albumPlayer.stop();}
let backPending=false;
connectAndroid({onPause:pauseAndroid,onBack:async()=>{
  if(backPending)return;backPending=true;
  try{
    const dialog=[...document.querySelectorAll('dialog[open]')].at(-1);
    if(dialog){if(dialog.id==='confirmDialog')finishConfirm(false);else closeDialog(dialog);return;}
    if(window.scrollY>20){window.scrollTo({top:0,behavior:'auto'});return;}
    if(await canLeaveDraft()){pauseAndroid();await minimizeApp();}
  }finally{backPending=false;}
}}).catch(()=>toast('androidConnectionFailed'));
window.addEventListener('pagehide',()=>{flushDraft();cancelAlbumExport();cancelDayExport();audio.stop();albumPlayer.stop();});
window.addEventListener('beforeunload',event=>{if(dirty&&!flushDraft()){event.preventDefault();event.returnValue='';}});
window.addEventListener('storage',event=>{if(event.key?.startsWith(DRAFT_PREFIX)||event.key===null)refreshDrafts();if(event.key!==KEY&&event.key!==null)return;try{entries=readEntries(localStorage);wallet=awardDays(readWallet(localStorage),entries);renderEntries();refreshRewards();renderRoomChoices();renderSettings();renderTrackCards();if($('albumDialog').open)renderAlbum();if($('dayExportDialog').open)renderDayExport();}catch{locked=true;rawOriginal=event.newValue;rawDownloaded=false;updateSave();}});
// Keep the frequently used diary near the room on narrow screens; desktop keeps its original order.
const mobileLayout=matchMedia('(max-width: 750px)');
function applyMobileLayout(){
  const studio=document.querySelector('.studio'),journal=document.querySelector('.journal-section');
  if(mobileLayout.matches)studio.after(journal);else $('storageError').before(journal);
  for(const id of ['roomDetails','catalogDetails','arrangementDetails','mixerDetails'])$(id).open=!mobileLayout.matches;
}
applyMobileLayout();mobileLayout.addEventListener('change',applyMobileLayout);
renderLanguage();
try{const pointer=sessionStorage.getItem(DRAFT_POINTER),source=draftCatalogue.drafts.find(d=>d.id===pointer);if(source)applyRecoveredDraft(source);}catch{}
if('ResizeObserver'in window)new ResizeObserver(revealSelectedRoom).observe($('roomChoices'));
else window.addEventListener('resize',revealSelectedRoom);
if(!isAndroid&&'serviceWorker'in navigator)navigator.serviceWorker.register('./sw.js').catch(()=>{/* Online use remains available if offline caching is blocked. */});
