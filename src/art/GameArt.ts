import Phaser from "phaser";
import { ENTITIES, type EntityType } from "../data/tiles";

const PLAYER_KEY = "art-player-v2";
const ENTITY_PREFIX = "art-entity-v2-";
const COMBAT_PREFIX = "art-combat-v2-";

type Ctx = CanvasRenderingContext2D;

function rounded(ctx: Ctx, x: number, y: number, w: number, h: number, r: number): void {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.lineTo(x + w - rr, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + rr);
  ctx.lineTo(x + w, y + h - rr);
  ctx.quadraticCurveTo(x + w, y + h, x + w - rr, y + h);
  ctx.lineTo(x + rr, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - rr);
  ctx.lineTo(x, y + rr);
  ctx.quadraticCurveTo(x, y, x + rr, y);
  ctx.closePath();
}

function ellipse(ctx: Ctx, x: number, y: number, rx: number, ry: number, color: string): void {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
  ctx.fill();
}

function polygon(ctx: Ctx, points: number[], color: string): void {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(points[0], points[1]);
  for (let i = 2; i < points.length; i += 2) ctx.lineTo(points[i], points[i + 1]);
  ctx.closePath();
  ctx.fill();
}

function stroke(ctx: Ctx, points: number[], color: string, width: number): void {
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.beginPath();
  ctx.moveTo(points[0], points[1]);
  for (let i = 2; i < points.length; i += 2) ctx.lineTo(points[i], points[i + 1]);
  ctx.stroke();
}

function dot(ctx: Ctx, x: number, y: number, r: number, color: string): void {
  ellipse(ctx, x, y, r, r, color);
}

function makeCanvas(scene: Phaser.Scene, key: string, size: number, draw: (ctx: Ctx, size: number) => void): void {
  if (scene.textures.exists(key)) return;
  const texture = scene.textures.createCanvas(key, size, size);
  if (!texture) return;
  const ctx = texture.getContext();
  ctx.clearRect(0, 0, size, size);
  ctx.imageSmoothingEnabled = true;
  draw(ctx, size);
  texture.refresh();
}

function drawTree(ctx: Ctx): void {
  rounded(ctx, 42, 48, 12, 34, 5); ctx.fillStyle = "#6d3f24"; ctx.fill();
  rounded(ctx, 46, 50, 5, 29, 2); ctx.fillStyle = "#a36a38"; ctx.fill();
  ellipse(ctx, 48, 37, 25, 24, "#174e31");
  ellipse(ctx, 34, 39, 17, 16, "#236b3c");
  ellipse(ctx, 57, 26, 18, 18, "#2f8650");
  ellipse(ctx, 43, 22, 17, 16, "#3b9b58");
  ellipse(ctx, 31, 28, 12, 11, "#55aa63");
  ellipse(ctx, 38, 20, 6, 5, "#8bd47f");
}

function drawBush(ctx: Ctx, berries = false): void {
  stroke(ctx, [34, 75, 47, 52, 58, 75], "#4d3823", 5);
  ellipse(ctx, 34, 57, 19, 18, "#215c38");
  ellipse(ctx, 52, 53, 20, 20, "#2d7844");
  ellipse(ctx, 64, 61, 16, 16, "#388a4c");
  ellipse(ctx, 43, 42, 17, 15, "#4a9c55");
  if (berries) {
    [[31,53],[44,47],[55,57],[64,52],[47,67],[58,39]].forEach(([x,y], i) => {
      dot(ctx, x, y, 4, i % 2 ? "#6f3dac" : "#8d58ca");
      dot(ctx, x - 1, y - 1, 1.2, "#d6b8ff");
    });
  }
}

function drawRock(ctx: Ctx): void {
  polygon(ctx, [16,72,24,40,42,22,68,28,82,57,75,76,33,82], "#606c78");
  polygon(ctx, [24,40,42,22,45,48,16,72], "#93a0aa");
  polygon(ctx, [45,48,68,28,82,57,58,60], "#75818d");
  stroke(ctx, [45,48,51,59,44,68], "#46515d", 3);
  stroke(ctx, [26,69,40,64], "#bdc6cc", 2);
}

function drawAnimal(ctx: Ctx, kind: "rabbit" | "wolf" | "boar" | "bear"): void {
  const palette = {
    rabbit: ["#b78a62", "#e3c7a8", "#593f31"],
    wolf: ["#697887", "#a9b3bb", "#26303a"],
    boar: ["#6e4633", "#a56f50", "#2c211d"],
    bear: ["#604633", "#956e4d", "#261d18"],
  }[kind];
  const [base, light, dark] = palette;
  ellipse(ctx, 47, 58, kind === "bear" ? 28 : 25, kind === "bear" ? 23 : 18, base);
  ellipse(ctx, 66, 48, kind === "bear" ? 18 : 16, kind === "bear" ? 18 : 14, base);
  if (kind === "rabbit") {
    ellipse(ctx, 62, 25, 6, 19, base); ellipse(ctx, 73, 27, 6, 18, base);
    ellipse(ctx, 62, 25, 2, 13, "#e6a9ac"); ellipse(ctx, 73, 27, 2, 12, "#e6a9ac");
    ellipse(ctx, 22, 55, 9, 9, light);
  } else if (kind === "wolf") {
    polygon(ctx, [57,38,60,20,70,36], dark); polygon(ctx, [69,35,80,20,79,43], dark);
    polygon(ctx, [18,57,5,45,24,49], dark);
  } else if (kind === "boar") {
    polygon(ctx, [62,37,64,25,72,38], dark); polygon(ctx, [74,38,82,27,82,47], dark);
    polygon(ctx, [77,52,91,47,84,60], light);
    stroke(ctx, [18,56,10,49,13,42], dark, 3);
  } else {
    ellipse(ctx, 57, 34, 7, 7, dark); ellipse(ctx, 75, 34, 7, 7, dark);
    ellipse(ctx, 82, 51, 8, 7, light);
  }
  ellipse(ctx, 69, 52, kind === "bear" ? 10 : 9, kind === "bear" ? 8 : 6, light);
  dot(ctx, 71, 44, 2.3, "#0b1115"); dot(ctx, 79, 52, 2.5, dark);
  rounded(ctx, 29, 68, 9, 17, 4); ctx.fillStyle = dark; ctx.fill();
  rounded(ctx, 57, 68, 9, 17, 4); ctx.fillStyle = dark; ctx.fill();
  if (kind === "boar") {
    polygon(ctx, [82,54,91,58,83,61], "#efe0bb");
  }
  ctx.globalAlpha = 0.32; ellipse(ctx, 48, 54, 19, 10, light); ctx.globalAlpha = 1;
}

function drawFlame(ctx: Ctx, x = 48, y = 52, scale = 1): void {
  polygon(ctx, [x,y-31*scale,x-17*scale,y-2*scale,x-10*scale,y+19*scale,x+12*scale,y+19*scale,x+19*scale,y-4*scale], "#ef5b2d");
  polygon(ctx, [x,y-20*scale,x-9*scale,y+1*scale,x-3*scale,y+15*scale,x+8*scale,y+10*scale,x+10*scale,y-3*scale], "#ffc845");
  polygon(ctx, [x,y-8*scale,x-3*scale,y+7*scale,x+4*scale,y+9*scale,x+6*scale,y], "#fff3a0");
}

function drawEntity(ctx: Ctx, type: EntityType): void {
  ctx.shadowColor = "rgba(0,0,0,.35)";
  ctx.shadowBlur = 5;
  ctx.shadowOffsetY = 3;
  switch (type) {
    case "tree": drawTree(ctx); break;
    case "berry_bush": drawBush(ctx, true); break;
    case "stone_outcrop": drawRock(ctx); break;
    case "vine":
      stroke(ctx, [22,78,29,57,48,50,59,31,74,22], "#276e38", 7);
      [[29,59],[43,52],[57,34],[70,24],[52,43]].forEach(([x,y], i) => {
        ellipse(ctx, x + (i%2?5:-5), y, 9, 5, i%2 ? "#52a95a" : "#3d8b49");
      });
      break;
    case "shell":
      ellipse(ctx, 48, 58, 25, 20, "#f2cfac"); polygon(ctx, [23,61,34,35,48,26,62,35,73,61], "#f6dcc2");
      for (let x = 34; x <= 62; x += 7) stroke(ctx, [48,30,x,65], "#c78f7b", 2);
      break;
    case "driftwood":
      polygon(ctx, [14,67,21,51,72,31,82,40,76,54,27,75], "#6d472c");
      stroke(ctx, [24,58,70,39], "#b07a46", 5); stroke(ctx, [30,53,20,39], "#8c5d37", 5); stroke(ctx, [64,42,72,25], "#8c5d37", 5);
      break;
    case "mushroom":
      rounded(ctx, 42, 50, 13, 31, 6); ctx.fillStyle = "#e9d6b2"; ctx.fill();
      ellipse(ctx, 48, 45, 27, 19, "#c84442");
      [[35,40],[49,34],[60,45]].forEach(([x,y]) => dot(ctx,x,y,4,"#fff4df"));
      break;
    case "rabbit": case "wolf": case "boar": case "bear": drawAnimal(ctx, type); break;
    case "flower":
      stroke(ctx, [48,78,48,47], "#3a813f", 5);
      for (let i=0;i<8;i++) { const a=i*Math.PI/4; ellipse(ctx,48+Math.cos(a)*14,39+Math.sin(a)*14,8,5,"#fff2e8"); }
      dot(ctx,48,39,7,"#f5b940"); break;
    case "cave_entrance":
      polygon(ctx,[10,79,19,40,38,18,61,22,82,48,88,79],"#626a70");
      ellipse(ctx,49,64,25,28,"#111a20"); stroke(ctx,[24,62,31,40,42,29],"#9da5a8",4); break;
    case "shipwreck":
      polygon(ctx,[9,61,78,49,68,75,24,78],"#633b28"); stroke(ctx,[19,60,67,54],"#c28a54",4);
      stroke(ctx,[49,53,49,18],"#3e2d26",5); polygon(ctx,[50,20,74,39,50,43],"#d7c7a5");
      stroke(ctx,[22,67,31,77],"#2c211c",4); break;
    case "cliff_lookout":
      polygon(ctx,[7,78,28,39,42,54,58,18,90,78],"#697480"); polygon(ctx,[58,18,90,78,70,59],"#48535e");
      polygon(ctx,[28,39,42,54,48,45,37,34],"#d6dde0"); break;
    case "river_spring":
      ellipse(ctx,48,67,29,13,"#479dca"); ellipse(ctx,48,64,22,8,"#87d8e7");
      polygon(ctx,[48,16,31,49,36,60,60,60,66,48],"#5fc4e8"); dot(ctx,42,41,5,"#c3f5ff"); break;
    case "camp_spot":
      ellipse(ctx,48,70,32,11,"#345b34"); stroke(ctx,[25,70,48,31,72,70],"#d5b783",5); polygon(ctx,[48,31,72,70,48,63],"#597e6e"); polygon(ctx,[48,31,25,70,48,63],"#8ca18b"); break;
    case "fishing_spot":
      stroke(ctx,[28,74,39,25,68,58],"#6b4b2f",5); stroke(ctx,[39,25,72,58,69,73],"#d6e7e8",2); ellipse(ctx,68,74,6,3,"#d96a4f"); break;
    case "bonfire_placed":
      stroke(ctx,[24,73,71,56],"#5e3725",8); stroke(ctx,[27,55,69,73],"#825034",8); drawFlame(ctx,48,50,.8); break;
    case "tent_placed":
      polygon(ctx,[9,75,47,25,87,75],"#c59052"); polygon(ctx,[47,25,87,75,55,69],"#96653e"); polygon(ctx,[47,42,39,75,56,75],"#3c3027"); stroke(ctx,[47,24,47,77],"#ead6a3",3); break;
    case "buried_treasure":
      ellipse(ctx,48,70,30,10,"#8a6c43"); stroke(ctx,[28,36,68,75,68,36,28,75],"#c94b45",7); break;
    case "planted_seed":
      ellipse(ctx,48,73,25,8,"#70482b"); stroke(ctx,[48,69,48,41],"#397940",5); ellipse(ctx,38,45,11,6,"#60ad59"); ellipse(ctx,58,40,11,6,"#73bd61"); break;
    case "ripe_plant": drawBush(ctx, true); break;
    case "signal_fire_unlit": case "signal_fire_lit":
      stroke(ctx,[30,78,48,26,66,78,37,57,60,57,30,78],"#735039",6); ellipse(ctx,48,28,18,6,"#4e392c");
      if (type === "signal_fire_lit") drawFlame(ctx,48,23,.62); break;
    case "raft_placed":
      for (let y=45;y<=68;y+=8) { rounded(ctx,18,y,61,7,3); ctx.fillStyle="#8e5b34";ctx.fill(); }
      stroke(ctx,[49,65,49,19],"#4c3828",5); polygon(ctx,[51,20,77,47,51,51],"#e7d8b5"); break;
  }
  ctx.shadowColor = "transparent";
}

function drawPlayer(ctx: Ctx): void {
  ctx.shadowColor = "rgba(0,0,0,.35)"; ctx.shadowBlur = 5; ctx.shadowOffsetY = 3;
  ellipse(ctx,48,24,14,14,"#d7a26f");
  ellipse(ctx,48,18,14,8,"#3b2b24"); polygon(ctx,[34,20,38,10,51,8,61,15,61,22,53,16,45,18],"#33231e");
  rounded(ctx,31,37,34,34,9); ctx.fillStyle="#e7ddca";ctx.fill();
  polygon(ctx,[31,42,18,61,25,66,38,52],"#d6cdbd"); polygon(ctx,[65,42,78,61,71,66,58,52],"#d6cdbd");
  rounded(ctx,27,66,17,20,6);ctx.fillStyle="#334453";ctx.fill(); rounded(ctx,52,66,17,20,6);ctx.fillStyle="#334453";ctx.fill();
  rounded(ctx,23,42,14,26,6);ctx.fillStyle="#6b5438";ctx.fill();
  stroke(ctx,[26,47,35,59,62,59],"#8e6d45",3);
  dot(ctx,43,24,1.8,"#17222a"); dot(ctx,53,24,1.8,"#17222a"); stroke(ctx,[44,31,52,31],"#975d50",1.5);
  ctx.shadowColor="transparent";
}

function drawMonster(ctx: Ctx, id: string, size: number): void {
  const s = size / 96;
  ctx.save(); ctx.scale(s,s);
  if (["rabbit","wolf","boar","bear"].includes(id)) {
    drawAnimal(ctx, id as "rabbit"|"wolf"|"boar"|"bear");
  } else if (id === "giant_octopus" || id === "kraken_juvenile" || id === "abyss_tendril") {
    const body = id === "abyss_tendril" ? "#26344b" : id === "kraken_juvenile" ? "#75518e" : "#a04b61";
    for(let i=0;i<7;i++) { const x=19+i*10; stroke(ctx,[48,58,x,73+(i%2)*8,x+(i-3)*4,91],body,8); }
    ellipse(ctx,48,43,27,30,body); ellipse(ctx,48,49,18,15,"#bd7187");
    dot(ctx,38,39,5,"#f0db8d");dot(ctx,58,39,5,"#f0db8d");dot(ctx,38,39,2,"#131822");dot(ctx,58,39,2,"#131822");
  } else if (id === "shark_pack") {
    polygon(ctx,[7,57,44,31,79,44,92,31,88,56,62,70,25,68],"#60798b");
    polygon(ctx,[41,35,53,13,61,41],"#425a6b"); polygon(ctx,[79,44,94,48,85,55],"#b7cad0");
    dot(ctx,68,43,2.5,"#071014"); stroke(ctx,[69,56,82,53],"#e5edf0",2);
  } else if (id === "deep_siren") {
    ellipse(ctx,48,25,13,14,"#93d0c2"); polygon(ctx,[35,38,61,38,70,67,48,88,27,67],"#326d75");
    polygon(ctx,[48,88,73,72,64,92],"#4a95a0"); polygon(ctx,[48,88,23,72,32,92],"#4a95a0");
    for(let i=0;i<7;i++) stroke(ctx,[35+i*4,12,30+i*5,38],"#284a58",3);
    dot(ctx,43,24,2,"#08181c");dot(ctx,54,24,2,"#08181c");
  } else if (id === "blind_shadow") {
    const grad=ctx.createLinearGradient(0,10,0,92);grad.addColorStop(0,"#52617d");grad.addColorStop(1,"#080c16");ctx.fillStyle=grad;
    ellipse(ctx,48,30,18,21,"#283348");
    ctx.fillStyle=grad;ctx.beginPath();ctx.moveTo(30,43);ctx.lineTo(66,43);ctx.lineTo(81,91);ctx.lineTo(15,91);ctx.closePath();ctx.fill();
    stroke(ctx,[30,43,12,72],"#202a3d",8);stroke(ctx,[66,43,84,72],"#202a3d",8);
  } else if (id === "slime_debris") {
    ctx.fillStyle="#66896a";rounded(ctx,14,31,68,54,24);ctx.fill();ellipse(ctx,32,35,16,16,"#829f78");ellipse(ctx,67,32,13,14,"#768f6d");
    dot(ctx,35,52,4,"#1d2920");dot(ctx,60,52,4,"#1d2920");stroke(ctx,[35,68,48,72,61,67],"#26382a",3);
  } else if (id === "stone_effigy") {
    polygon(ctx,[28,89,23,35,34,10,64,10,74,35,68,89],"#6c7478");polygon(ctx,[34,10,64,10,58,35,39,35],"#899194");
    rounded(ctx,34,38,28,30,5);ctx.fillStyle="#7b8385";ctx.fill();stroke(ctx,[38,49,45,46],"#20282b",3);stroke(ctx,[52,46,59,49],"#20282b",3);
  } else if (id === "thorn_vine") {
    for(let i=0;i<6;i++){const x=15+i*13;stroke(ctx,[48,89,x,49+(i%2)*12,x+8,13],"#28643b",8);polygon(ctx,[x+2,47,x-7,42,x,56],"#c6d184");}
    ellipse(ctx,48,58,17,15,"#4c8750");
  } else if (id === "pale_miner") {
    ellipse(ctx,48,27,17,18,"#c6c5b7");polygon(ctx,[27,28,34,9,62,9,70,28],"#c79b43");rounded(ctx,24,43,48,45,10);ctx.fillStyle="#394957";ctx.fill();
    dot(ctx,42,27,3,"#11161b");dot(ctx,56,27,3,"#11161b");stroke(ctx,[70,51,89,86],"#6d4b2e",6);polygon(ctx,[75,55,90,43,94,51,82,63],"#a9b2b7");
  } else {
    ellipse(ctx,48,62,32,25,"#34414c");polygon(ctx,[15,63,26,31,43,50,61,22,82,65,72,86,27,86],"#475561");
    dot(ctx,39,62,5,"#de654f");dot(ctx,58,62,5,"#de654f");stroke(ctx,[39,76,48,80,59,75],"#131a20",4);
  }
  ctx.restore();
}

export function registerWorldArt(scene: Phaser.Scene): void {
  makeCanvas(scene, PLAYER_KEY, 96, drawPlayer);
  for (const type of Object.keys(ENTITIES) as EntityType[]) {
    makeCanvas(scene, entityTextureKey(type), 96, (ctx) => drawEntity(ctx, type));
  }
}

export function playerTextureKey(): string { return PLAYER_KEY; }
export function entityTextureKey(type: EntityType): string { return `${ENTITY_PREFIX}${type}`; }

export function entityDisplaySize(type: EntityType): number {
  if (["tree","shipwreck","cliff_lookout","tent_placed","signal_fire_unlit","signal_fire_lit","raft_placed"].includes(type)) return 42;
  if (["bear","cave_entrance","camp_spot"].includes(type)) return 39;
  return 34;
}

export function ensureCombatTexture(scene: Phaser.Scene, id: string): string {
  const key = `${COMBAT_PREFIX}${id}`;
  makeCanvas(scene, key, 320, (ctx, size) => drawMonster(ctx, id, size));
  return key;
}
