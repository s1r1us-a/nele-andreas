/* Welche Kombination der 4 Änderungen ergibt ein ausgewogenes Duell?
   C1 = eigene Schlag-Timer (sonst geteilter min-Takt)
   C2 = Rüstungs-HP-DR (sonst armor*4) + Mitigations-Deckel
   C3 = Vielseitigkeit nur einmal (sonst Doppelnutzen)
   C4 = keine Tränke (sonst 3×50%)
   Aufruf: node sim/duel-combos.mjs */
const HP_PER_ARMOR=4, ARMOR_RED=0.3, SOFT=150, DR=1.5;
const rnd=v=>1+(Math.random()*2-1)*v;
const hpDR=a=>{a=Math.max(0,a||0);return a<=SOFT?a*HP_PER_ARMOR:SOFT*HP_PER_ARMOR+(a-SOFT)*DR;};

function mk(b,o){
  const armorHp=o.C2?hpDR(b.armor):b.armor*HP_PER_ARMOR;
  const maxHp=Math.round(100+armorHp+(b.maxHpAffix||0));
  // C3: Vers nur defensiv → offensive Komponente aus atk strippen
  const atk=o.C3?Math.round(b.atk/(1+b.vers)):b.atk;
  return {...b,atk,maxHp,hp:maxHp,pot:3};
}
function strike(att,def,enr,o){
  const crit=Math.random()<Math.min(1,att.crit);
  let dmg=Math.max(1,Math.round(att.atk*enr*rnd(0.15)*(crit?att.critMult:1)));
  if(Math.random()<def.dodge)return{dodged:true};
  const armorRed=def.armor*ARMOR_RED+(def.block||0);
  dmg=o.C2?Math.max(1,Math.round(dmg-Math.min(armorRed,dmg*0.75)))
          :Math.max(1,Math.round(dmg-armorRed));
  // Vers defensiv: bei C3 (nur defensiv) und im Alt-Modell (Doppelnutzen) anwenden
  dmg=Math.max(1,Math.round(dmg*(1-def.vers)));
  return{dmg,crit};
}
function ap(att,def,res){if(res.dodged)return;def.hp-=res.dmg;if(att.lifesteal>0)att.hp=Math.min(att.maxHp,att.hp+Math.round(res.dmg*att.lifesteal));if(att.thorns>0)def.hp-=att.thorns;}
function heal(s,o){if(!o.C4&&s.pot>0&&s.hp<s.maxHp*0.45){s.hp=Math.min(s.maxHp,s.hp+Math.round(s.maxHp*0.5));s.pot--;}}

function fight(A,B,o){
  const h=mk(A,o),g=mk(B,o);
  if(o.C1){ // eigene Timer, virtuelle Uhr, Enrage 35s
    let now=0;h.nextSwingAt=h.interval;g.nextSwingAt=g.interval;let enr=1;
    while(now<120000){
      now=Math.min(h.nextSwingAt,g.nextSwingAt);
      const ov=now-35000;enr=ov>0?Math.pow(1.06,ov/1000):1;
      heal(h,o);heal(g,o);
      for(const[a,d]of[[h,g],[g,h]]){let gd=0;while(now>=a.nextSwingAt&&gd<2){ap(a,d,strike(a,d,enr,o));a.nextSwingAt+=a.interval;gd++;if(d.hp<=0)break;}}
      if(h.hp<=0||g.hp<=0)return h.hp<=0&&g.hp<=0?'draw':(h.hp<=0?'B':'A');
    }
    return 'draw';
  } else { // geteilter min-Takt, beide pro Runde
    const iv=Math.min(900,Math.max(420,Math.min(h.interval,g.interval)));
    let enr=1,turn=0;
    while(turn<4000){turn++;if(turn>35)enr*=1.06;heal(h,o);heal(g,o);
      const hr=strike(h,g,enr,o),gr=strike(g,h,enr,o);ap(h,g,hr);ap(g,h,gr);
      if(h.hp<=0||g.hp<=0)return h.hp<=0&&g.hp<=0?'draw':(h.hp<=0?'B':'A');}
    return 'draw';
  }
}
function wr(A,B,o,n=8000){let a=0,d=0;for(let i=0;i<n;i++){const r=fight(A,B,o);if(r==='A')a++;else if(r==='draw')d++;}return{a:a/n,d:d/n};}

const SCHURKE={atk:225,crit:0.55,critMult:2.8,interval:300,armor:80,block:0,dodge:0.20,vers:0.10,lifesteal:0.20,thorns:0,maxHpAffix:150};
const TANK={atk:101,crit:0.20,critMult:2.6,interval:675,armor:600,block:60,dodge:0.05,vers:0.30,lifesteal:0,thorns:30,maxHpAffix:200};
const pct=x=>(x*100).toFixed(1)+'%';

const combos=[
  ['ALT (keine Änderung)',           {C1:0,C2:0,C3:0,C4:0}],
  ['nur C1 (Timer)',                 {C1:1,C2:0,C3:0,C4:0}],
  ['nur C4 (keine Tränke)',          {C1:0,C2:0,C3:0,C4:1}],
  ['C1+C4',                          {C1:1,C2:0,C3:0,C4:1}],
  ['C1+C4+C3',                       {C1:1,C2:0,C3:1,C4:1}],
  ['C1+C4+C2',                       {C1:1,C2:1,C3:0,C4:1}],
  ['ALLE (C1+C2+C3+C4)',             {C1:1,C2:1,C3:1,C4:1}],
];
console.log('Schurke-vs-Tank, Schurke (A) Win-Rate je Kombination:\n');
for(const[name,o]of combos){const r=wr(SCHURKE,TANK,o);console.log(`  ${name.padEnd(28)} Schurke ${pct(r.a)}  (Unent. ${pct(r.d)})`);}

// ---- FINALE Variante (im Code umgesetzt): C1 (eigene Timer) + C4 (keine Tränke) ----
const FINAL={C1:1,C2:0,C3:0,C4:1};
console.log('\n=== UMGESETZT: C1+C4 – Tempo-Empfindlichkeit (Schurke-Win-Rate je attackSpeed) ===');
for(const as of [0.0,0.1,0.2,0.3,0.4,0.5,0.6]){
  const interval=Math.max(220,750*(1-as));
  const r=wr({...SCHURKE,interval},TANK,FINAL,8000);
  console.log(`  attackSpeed ${as.toFixed(2)} → interval ${Math.round(interval)}ms → Schurke ${pct(r.a)}`);
}
