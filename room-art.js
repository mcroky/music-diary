export const ROOM_ART={
  attic:{src:'./assets/rooms/attic.webp',skyBottom:365,window:'M420 510V340C420 195 535 110 674 110C814 110 925 210 925 345V620H660L650 600Z M674 110H696V630H674Z M420 319L930 341V363L420 341Z',lamp:[94,32],moon:[805,232]},
  bedroom:{src:'./assets/rooms/bedroom.webp',skyBottom:280,window:'M503 40Q760 -75 936 168V530H503Z M678 0H699V540H678Z M500 374H940V391H500Z',lamp:[97,43],moon:[816,190]},
  studio:{src:'./assets/rooms/studio.webp',skyBottom:240,window:'M446 42L1013 107V468H577L553 385L446 350Z M516 45L538 48V470H516Z M692 66L713 69V479H692Z M864 84L885 87V479H864Z M444 184L1014 226V241L444 200Z M444 341L1014 348V363L444 357Z',lamp:[78,35],moon:[781,153]},
  cabin:{src:'./assets/rooms/cabin.webp',skyBottom:260,window:'M317 88L1003 148V442L925 505H505L448 487L317 466Z',lamp:[82,36],moon:[795,227]},
  seaside:{src:'./assets/rooms/seaside.webp',skyBottom:350,window:'M485 52L1075 85V527L1020 562L627 579V545L485 485Z',lamp:[85,33],moon:[893,207]},
  greenhouse:{src:'./assets/rooms/greenhouse.png',skyBottom:300,window:'M520 28 Q650 -10 770 28 L770 370 L520 370 Z',lamp:[91,38],moon:[680,170]}
};

let request=0,requestedRoom=null;
export async function loadRoomArtwork(room,{force=false,onState=()=>{}}={}){
  const image=document.getElementById('roomImage');
  if(!force&&requestedRoom===room)return;
  requestedRoom=room;const token=++request;
  onState('loading');
  try{
    const pending=new Image();pending.decoding='async';pending.src=ROOM_ART[room].src;
    await pending.decode();
    if(token!==request)return;
    image.src=pending.src;image.dataset.room=room;onState('ready');
  }catch{
    if(token!==request)return;
    onState('error');
  }
}
