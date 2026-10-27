export const DAILY_REWARD=1;
const PREVIOUS_REWARD=9;
const LEGACY_REWARD=3;
export const DOWNLOAD_COST=1;
export const SHOP_ITEMS={
  'room-greenhouse':{cost:9,kind:'room',value:'greenhouse'},
  'track-pop-1':{cost:3,kind:'track',value:'pop-1'},
  'track-pop-2':{cost:3,kind:'track',value:'pop-2'},
  'track-pop-3':{cost:3,kind:'track',value:'pop-3'},
  'track-pop-4':{cost:3,kind:'track',value:'pop-4'}
};
export const emptyWallet=()=>({version:4,days:[],legacyDays:[],singleDays:[],purchases:[],downloads:[],seenEntryIds:[],rewardedEntryIds:[]});
export function validateWallet(wallet){
  const validDate=date=>typeof date==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(date)&&Number.isFinite(Date.parse(date))&&new Date(date).toISOString().slice(0,10)===date;
  const validId=id=>typeof id==='string'&&/^[a-zA-Z0-9-]{1,100}$/.test(id);
  if(!wallet||![1,2,3,4].includes(wallet.version)||!Array.isArray(wallet.days)||wallet.days.length>5000||wallet.days.some(d=>!validDate(d))||!Array.isArray(wallet.purchases)||wallet.purchases.some(id=>!Object.hasOwn(SHOP_ITEMS,id))||!Array.isArray(wallet.downloads)||wallet.downloads.length>100000||wallet.downloads.some(id=>!validId(id))||new Set(wallet.days).size!==wallet.days.length||new Set(wallet.purchases).size!==wallet.purchases.length||new Set(wallet.downloads).size!==wallet.downloads.length)throw new Error('INVALID_WALLET');
  const legacyDays=wallet.version===1?wallet.days:wallet.legacyDays;
  const daySet=new Set(wallet.days);
  if(!Array.isArray(legacyDays)||legacyDays.some(day=>!daySet.has(day))||new Set(legacyDays).size!==legacyDays.length)throw new Error('INVALID_WALLET');
  const singleDays=wallet.version>=3?wallet.singleDays:[];
  if(!Array.isArray(singleDays)||singleDays.some(day=>!daySet.has(day)||legacyDays.includes(day))||new Set(singleDays).size!==singleDays.length)throw new Error('INVALID_WALLET');
  const seenEntryIds=wallet.version===4?wallet.seenEntryIds:[],rewardedEntryIds=wallet.version===4?wallet.rewardedEntryIds:[];
  const validEntryId=id=>typeof id==='string'&&id.length>0&&id.length<=100;
  if(!Array.isArray(seenEntryIds)||seenEntryIds.length>100000||seenEntryIds.some(id=>!validEntryId(id))||!Array.isArray(rewardedEntryIds))throw new Error('INVALID_WALLET');
  const seen=new Set(seenEntryIds);
  if(seen.size!==seenEntryIds.length||rewardedEntryIds.some(id=>!seen.has(id))||new Set(rewardedEntryIds).size!==rewardedEntryIds.length)throw new Error('INVALID_WALLET');
  return {version:4,days:[...wallet.days],legacyDays:[...legacyDays],singleDays:[...singleDays],purchases:[...wallet.purchases],downloads:[...wallet.downloads],seenEntryIds:[...seenEntryIds],rewardedEntryIds:[...rewardedEntryIds]};
}
export function walletBalance(wallet){const w=validateWallet(wallet);return Math.max(0,w.days.length*PREVIOUS_REWARD-w.legacyDays.length*(PREVIOUS_REWARD-LEGACY_REWARD)-w.singleDays.length*(PREVIOUS_REWARD-DAILY_REWARD)+w.rewardedEntryIds.length*DAILY_REWARD-w.purchases.reduce((sum,id)=>sum+SHOP_ITEMS[id].cost,0)-w.downloads.length*DOWNLOAD_COST);}
export function recognizeEntries(wallet,entries){const w=validateWallet(wallet);w.seenEntryIds=[...new Set([...w.seenEntryIds,...entries.map(entry=>entry.id)])];return validateWallet(w);}
export function awardEntry(wallet,id){const w=validateWallet(wallet);if(!w.seenEntryIds.includes(id)){w.seenEntryIds.push(id);w.rewardedEntryIds.push(id);}return validateWallet(w);}
export function awardLegacyDays(wallet,entries){const w=validateWallet(wallet),known=new Set(w.days),added=[...new Set(entries.map(entry=>entry.date))].filter(day=>!known.has(day));w.days=[...w.days,...added].sort();w.legacyDays=[...w.legacyDays,...added].sort();return validateWallet(w);}
export function mergeWallets(a,b){
  const x=validateWallet(a),y=validateWallet(b),days=[...new Set([...x.days,...y.days])].sort();
  const amount=w=>new Map(w.days.map(day=>[day,w.singleDays.includes(day)?DAILY_REWARD:w.legacyDays.includes(day)?LEGACY_REWARD:PREVIOUS_REWARD]));
  const aRewards=amount(x),bRewards=amount(y),total=day=>Math.max(aRewards.get(day)||0,bRewards.get(day)||0);
  return validateWallet({version:4,days,legacyDays:days.filter(day=>total(day)===LEGACY_REWARD),singleDays:days.filter(day=>total(day)===DAILY_REWARD),purchases:[...new Set([...x.purchases,...y.purchases])],downloads:[...new Set([...x.downloads,...y.downloads])],seenEntryIds:[...new Set([...x.seenEntryIds,...y.seenEntryIds])],rewardedEntryIds:[...new Set([...x.rewardedEntryIds,...y.rewardedEntryIds])]});
}
export function purchaseItem(wallet,id){const w=validateWallet(wallet),item=SHOP_ITEMS[id];if(!item)throw new Error('UNKNOWN_ITEM');if(w.purchases.includes(id))return w;if(walletBalance(w)<item.cost)throw new Error('INSUFFICIENT_NOTES');w.purchases.push(id);return w;}
export function spendDownload(wallet,id){const w=validateWallet(wallet);if(w.downloads.includes(id))return w;if(walletBalance(w)<DOWNLOAD_COST)throw new Error('INSUFFICIENT_NOTES');w.downloads.push(id);return validateWallet(w);}
export function refundDownload(wallet,id){const w=validateWallet(wallet);w.downloads=w.downloads.filter(value=>value!==id);return w;}
