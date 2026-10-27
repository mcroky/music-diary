// Original procedural compositions. Titles and composition settings are bundled locally.
const LANGS=['ko','en','ja','zh'];
export const localized=(labels,lang)=>labels[LANGS.indexOf(lang)]||labels[0];
export const CATEGORIES=[
 ['cafe','☕',['카페','Café','カフェ','咖啡馆'],'#c3a47c',60,82,70],
 ['rain','☂',['비 오는 날','Rainy days','雨の日','雨天'],'#91a6ad',60,64,28],
 ['night','☾',['깊은 밤','Late night','夜更け','深夜'],'#808da4',57,60,35],
 ['walk','♧',['가벼운 산책','A little walk','お散歩','散步'],'#a1b18a',62,94,82],
 ['forest','❋',['숲과 자연','Forest','森と自然','森林自然'],'#8da48d',60,70,65],
 ['sea','≋',['바다와 여행','By the sea','海と旅','海边旅行'],'#8eb5b7',62,84,80],
 ['fire','♨',['따뜻한 휴식','Warm comfort','温かな休息','温暖休憩'],'#bc9479',57,66,56],
 ['focus','▥',['몰입과 작업','Deep focus','集中と作業','专注工作'],'#9ca394',60,78,50],
 ['memory','◷',['추억과 그리움','Memories','思い出','回忆思念'],'#baa0a5',57,62,22],
 ['hope','✧',['설렘과 시작','New beginnings','ときめく始まり','心动启程'],'#c2b276',64,92,88],
 ['dream','✦',['몽환적인 꿈','Daydreams','夢うつつ','梦幻'],'#a6a0bc',59,58,48],
 ['rest','◡',['잠들기 전','Before sleep','おやすみ前','睡前'],'#abae9d',60,52,45]
].map(([id,icon,title,color,tonic,tempo,brightness])=>({id,icon,title,color,tonic,tempo,brightness}));

const TITLES=[
 [['창가의 첫 커피','First coffee by the window','窓辺の一杯','窗边第一杯咖啡'],['오후 세 시의 재즈','Three o’clock jazz','午後三時のジャズ','午后三点的爵士'],['크림빛 일요일','A cream-colored Sunday','クリーム色の日曜日','奶油色星期天'],['작은 카페의 안부','Hello from a little café','小さなカフェから','小咖啡馆的问候']],
 [['빗방울이 쓰는 편지','Letters in the rain','雨粒の手紙','雨滴的信'],['젖은 골목 끝에서','At the end of a rainy lane','濡れた路地の先','湿巷尽头'],['우산 아래 둘만의 박자','A rhythm under the umbrella','傘の下のリズム','伞下的节拍'],['비가 그치기 전까지','Until the rain lets go','雨がやむまで','等雨停之前']],
 [['모두 잠든 창문','When every window sleeps','眠りについた窓','窗户都已入睡'],['새벽 두 시의 메모','A note at two a.m.','午前二時のメモ','凌晨两点的便笺'],['달빛을 접어두고','Folding up the moonlight','月明かりをたたんで','折好月光'],['별 하나 남은 밤','One last star tonight','星ひとつの夜','还剩一颗星的夜']],
 [['운동화 끈을 묶고','Laces tied, off we go','靴ひもを結んで','系好鞋带'],['햇살이 걷는 속도','The pace of sunlight','日差しの歩く速さ','阳光散步的速度'],['처음 가보는 골목','A street I’ve never taken','はじめての路地','未曾走过的小巷'],['조금 먼 길로 돌아서','Taking the longer way','少し遠回りして','绕一点远路']],
 [['잎사귀 사이의 빛','Light between the leaves','葉の間の光','叶隙间的光'],['초록이 깊어지는 시간','When the green grows deeper','緑が深まる時間','绿意渐深时'],['이끼 위의 작은 발걸음','Small steps on moss','苔の上の小さな足音','苔上的小脚步'],['나무 그늘의 낮잠','A nap beneath the trees','木陰のうたた寝','树荫下的小憩']],
 [['첫 파도가 닿으면','When the first wave arrives','最初の波が届くとき','第一道浪抵达时'],['창문 너머 수평선','A horizon beyond the window','窓の向こうの水平線','窗外地平线'],['이름 없는 여름 해변','An unnamed summer shore','名前のない夏の浜辺','无名的夏日海岸'],['돌아오는 기차 안에서','On the train back home','帰りの列車で','返程的列车上']],
 [['담요 한 장의 온도','The warmth of a blanket','毛布一枚のぬくもり','一条毯子的温度'],['장작 옆에 앉아서','A seat beside the fire','薪のそばに座って','坐在柴火旁'],['오늘은 여기까지만','Enough for today','今日はここまで','今天就到这里'],['따뜻한 컵을 두 손에','A warm cup in both hands','温かなカップを両手に','双手捧着温热的杯']],
 [['생각을 한 줄씩','One thought at a time','考えを一行ずつ','思绪一行行'],['책상 위 작은 우주','A little universe on my desk','机の上の小宇宙','书桌上的小宇宙'],['연필 끝의 리듬','A pencil-tip rhythm','鉛筆の先のリズム','笔尖的节奏'],['흐름을 따라 천천히','Slowly into the flow','流れにゆっくり乗って','慢慢进入心流']],
 [['오래된 사진 뒷면','The back of an old photograph','古い写真の裏側','旧照片的背面'],['그때의 우리에게','To who we were','あの頃の私たちへ','致当时的我们'],['다시 읽는 편지','A letter read again','読み返す手紙','重读那封信'],['돌아갈 수 없는 계절','A season we can’t return to','戻れない季節','回不去的季节']],
 [['첫 장을 펼치는 마음','Opening the first page','最初のページを開く気持ち','翻开第一页'],['아직 모르는 좋은 일','Good things yet unknown','まだ知らないいいこと','尚未遇见的好事'],['내일로 가는 작은 문','A small door to tomorrow','明日へ続く小さな扉','通往明天的小门'],['새로운 봄의 예감','A hint of a new spring','新しい春の予感','新春的预感']],
 [['구름 위 우체국','A post office in the clouds','雲の上の郵便局','云上的邮局'],['물속에 잠긴 별','A star beneath the water','水に沈んだ星','水下的星星'],['보랏빛 안개의 정원','A garden of violet mist','紫の霧の庭','紫雾花园'],['아주 느린 시간 여행','A very slow journey through time','とてもゆっくりな時間旅行','缓慢的时间旅行']],
 [['불을 끄기 십 분 전','Ten minutes before lights out','消灯まであと十分','熄灯前十分钟'],['베개 옆 작은 멜로디','A melody beside the pillow','枕元の小さなメロディー','枕边的小旋律'],['긴 하루를 내려놓고','Setting down a long day','長い一日を置いて','放下漫长的一天'],['좋은 꿈의 입구','The doorway to a good dream','いい夢の入り口','好梦的入口']]
];

const STYLES={
 jazz:{mix:{piano:50,keys:20,bass:32,drums:18},lead:'piano',stride:1,swing:.15,kick:[0,4],snare:[2,6],hat:[0,2,4,6]},
 lofi:{mix:{keys:50,piano:15,bass:32,drums:28},lead:'keys',stride:1,swing:.12,kick:[0,3,4],snare:[2,6],hat:[0,1,2,3,4,5,6,7]},
 acoustic:{mix:{guitar:58,piano:18,bass:24,drums:12},lead:'guitar',stride:1,swing:0,kick:[0,5],snare:[4],hat:[0,2,4,6]},
 piano:{mix:{piano:62,keys:18,bass:12},lead:'piano',stride:1,swing:0,kick:[],snare:[],hat:[]},
 ambient:{mix:{keys:56,bell:22,piano:12},lead:'bell',stride:2,swing:0,kick:[],snare:[],hat:[]},
 musicbox:{mix:{bell:52,keys:25,piano:15},lead:'bell',stride:1,swing:0,kick:[],snare:[],hat:[]},
 bossa:{mix:{guitar:52,keys:18,bass:32,drums:20},lead:'guitar',stride:1,swing:.04,kick:[0,3,6],snare:[2,5],hat:[0,2,3,4,6,7]},
 mellow:{mix:{piano:40,keys:34,guitar:20,bass:18},lead:'piano',stride:2,swing:.03,kick:[],snare:[],hat:[]}
};
const PALETTES=[['lofi','jazz','bossa','mellow'],['piano','ambient','lofi','mellow'],['lofi','piano','ambient','musicbox'],['acoustic','bossa','jazz','lofi'],['piano','ambient','acoustic','mellow'],['bossa','mellow','acoustic','piano'],['mellow','acoustic','piano','jazz'],['lofi','ambient','jazz','mellow'],['piano','mellow','musicbox','acoustic'],['acoustic','jazz','bossa','piano'],['ambient','musicbox','mellow','piano'],['musicbox','ambient','mellow','piano']];
const PROGRESSIONS=[[0,5,3,4,0,2,3,4],[0,3,5,4,2,5,3,0],[5,3,0,4,5,2,3,4],[0,2,5,3,1,4,0,4],[3,4,2,5,1,4,0,0],[0,5,1,4,3,2,1,4],[5,4,3,0,1,2,4,5],[0,4,5,2,3,0,1,4]];
const MOTIFS=[[0,null,1,2,null,1,3,2],[2,1,null,0,1,null,4,2],[0,2,4,null,3,2,null,1],[1,null,2,0,null,3,2,4],[4,2,1,null,0,1,null,2],[0,1,null,3,2,null,1,0],[2,null,3,4,null,2,1,0],[0,null,4,2,1,null,3,1],[1,2,3,null,4,2,0,null],[0,3,null,2,4,null,1,2],[4,null,2,3,1,null,0,1],[2,0,1,null,2,4,null,3]];
export const TRACKS=CATEGORIES.flatMap((category,c)=>TITLES[c].map((title,index)=>{
  const seed=c*4+index,style=PALETTES[c][index];
  return {id:`${category.id}-${index+1}`,category:category.id,title,seed,style,tonic:category.tonic+[0,2,-2,1][index],tempo:Math.max(50,Math.min(120,category.tempo+[0,6,-4,3][index])),brightness:Math.max(0,Math.min(100,category.brightness+[0,9,-8,4][index])),mix:STYLES[style].mix};
}));
const TRACK_MAP=new Map(TRACKS.map(track=>[track.id,track]));
export const getTrack=id=>TRACK_MAP.get(id)||null;
export const isTrackId=id=>id===null||TRACK_MAP.has(id);
export const LEADS=['original','piano','keys','guitar','bell'];
export const RHYTHMS=['original','gentle','steady','groove','bossa'];
export const DENSITIES=['sparse','balanced','full'];
export const defaultArrangement=()=>({lead:'original',rhythm:'original',density:'balanced'});
export const trackLead=track=>STYLES[track.style].lead;
const RHYTHM_PATTERNS={
 gentle:{kick:[0],snare:[4],hat:[0,4],swing:0},
 steady:{kick:[0,4],snare:[2,6],hat:[0,2,4,6],swing:0},
 groove:{kick:[0,3,4,7],snare:[2,6],hat:[0,1,2,3,4,5,6,7],swing:.12},
 bossa:{kick:[0,3,6],snare:[2,5],hat:[0,2,3,4,6,7],swing:.04}
};

export function composeFrame(track,bar,step,brightness=track.brightness,arrangement=defaultArrangement()){
  bar%=16;
  const style=STYLES[track.style],lead=arrangement.lead==='original'?style.lead:arrangement.lead,minor=brightness<40,neutral=brightness>=40&&brightness<=60,scale=minor?[0,2,3,5,7,8,10]:[0,2,4,5,7,9,11];
  const degree=PROGRESSIONS[(track.seed+Math.floor(track.seed/4))%PROGRESSIONS.length][bar%8];
  const degreeNote=n=>track.tonic+scale[((n%7)+7)%7]+12*Math.floor(n/7);
  const chord=[degreeNote(degree),neutral?degreeNote(degree)+2:degreeNote(degree+2),degreeNote(degree+4),degreeNote(degree+6)];
  const motif=MOTIFS[(track.seed+Math.floor(bar/2))%MOTIFS.length];
  const motifIndex=(step+(bar%2?track.seed%3:0))%8;
  const choice=motif[motifIndex],leadPalette=[chord[0],chord[1],chord[2],chord[3],chord[0]+12,degreeNote(degree+8)];
  const notes=[];
  const quiet=bar%16>=12;
  if(choice!==null&&step%style.stride===0&&!(quiet&&step%3===1)&&!(arrangement.density==='sparse'&&step%4!==0))notes.push({id:lead,midi:leadPalette[choice]+12,duration:track.style==='ambient'?2.8:track.style==='musicbox'?1.9:1.15,volume:.12+(track.seed%4)*.012});
  if(step===0){
    chord.slice(0,track.style==='jazz'?4:3).forEach((midi,i)=>notes.push({id:'keys',midi,duration:Math.min(5,240/track.tempo*.95),volume:.045,delay:i*.014}));
    notes.push({id:'bass',midi:chord[0]-12,duration:1.1,volume:.21});
  }
  if(step===4)notes.push({id:'bass',midi:chord[2]-12,duration:.8,volume:.14});
  if(lead!=='guitar'&&step%2===0&&!(arrangement.density==='sparse'&&step===2))notes.push({id:'guitar',midi:chord[(step/2+bar)%3],duration:.7,volume:.09});
  if(lead!=='piano'&&(step===2||step===6))notes.push({id:'piano',midi:chord[step===2?1:2]+12,duration:1.4,volume:.1});
  if(lead!=='bell'&&step===6&&bar%2===1)notes.push({id:'bell',midi:chord[2]+24,duration:2,volume:.07});
  if(arrangement.density==='full'&&(step===3||step===7))notes.push({id:lead,midi:chord[step===3?1:2]+12,duration:.65,volume:.07});
  const percussion=arrangement.rhythm==='original'?(style.hat.length?style:STYLES.jazz):RHYTHM_PATTERNS[arrangement.rhythm];
  const swing=arrangement.rhythm==='original'?style.swing:percussion.swing;
  return {notes,kick:!quiet&&percussion.kick.includes(step),snare:!quiet&&percussion.snare.includes(step),hat:percussion.hat.includes(step),swing:step%2?swing:0};
}
