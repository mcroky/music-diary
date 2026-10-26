export function legacyBrightness(moods=[]){
  return moods.some(m=>['sad','tired','restless'].includes(m))?25:75;
}

export function musicExpression(value){
  const brightness=typeof value==='number'&&Number.isFinite(value)?Math.max(0,Math.min(100,value)):75;
  const zone=brightness<40?'wistful':brightness>60?'radiant':'reflective';
  return {
    zone,
    roots:zone==='wistful'?[57,53,60,55]:[60,57,53,55],
    thirds:zone==='wistful'?[3,4,4,4]:zone==='reflective'?[2,2,2,2]:[4,3,4,4],
    cutoff:800+11200*(brightness/100)**1.4
  };
}
