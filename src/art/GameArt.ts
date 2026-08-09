import Phaser from "phaser";
import { ENTITIES, type EntityType } from "../data/tiles";

const PLAYER_PREFIX = "art-player-v3-";
const ENTITY_PREFIX = "art-entity-v3-";
const COMBAT_PREFIX = "art-combat-v2-";

type Ctx = CanvasRenderingContext2D;
export type PlayerDirection = "down" | "left" | "up" | "right";

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

function drawTree(ctx: Ctx, variant: number): void {
  const v = variant % 4;
  if (v === 0) {
    rounded(ctx, 42, 48, 12, 34, 5); ctx.fillStyle = "#6d3f24"; ctx.fill();
    rounded(ctx, 46, 50, 5, 29, 2); ctx.fillStyle = "#a36a38"; ctx.fill();
    ellipse(ctx, 48, 37, 25, 24, "#174e31"); ellipse(ctx, 34, 39, 17, 16, "#236b3c");
    ellipse(ctx, 57, 26, 18, 18, "#2f8650"); ellipse(ctx, 43, 22, 17, 16, "#3b9b58");
    ellipse(ctx, 31, 28, 12, 11, "#55aa63"); ellipse(ctx, 38, 20, 6, 5, "#8bd47f");
  } else if (v === 1) {
    polygon(ctx, [44,82,47,34,55,33,58,82], "#70462c"); stroke(ctx, [51,66,37,45,25,39], "#765036", 6);
    ellipse(ctx, 47, 29, 19, 25, "#235f38"); ellipse(ctx, 29, 35, 16, 18, "#317746");
    ellipse(ctx, 62, 38, 18, 19, "#3e8d50"); ellipse(ctx, 51, 16, 13, 12, "#65ad62");
    ellipse(ctx, 23, 31, 7, 6, "#8bc779");
  } else if (v === 2) {
    rounded(ctx, 39, 45, 17, 38, 6); ctx.fillStyle = "#5c3a28"; ctx.fill();
    stroke(ctx, [46,66,63,44,74,38], "#69442e", 7); stroke(ctx, [45,57,31,39,20,36], "#69442e", 6);
    ellipse(ctx, 48, 29, 26, 18, "#17533b"); ellipse(ctx, 69, 34, 17, 14, "#28704a");
    ellipse(ctx, 27, 32, 19, 15, "#398955"); ellipse(ctx, 54, 18, 18, 12, "#58a966");
    dot(ctx, 70, 29, 3, "#d49a45"); dot(ctx, 32, 27, 3, "#d49a45");
  } else {
    rounded(ctx, 45, 43, 10, 40, 4); ctx.fillStyle = "#80603a"; ctx.fill();
    stroke(ctx, [50,51,35,31,22,24], "#80603a", 5); stroke(ctx, [51,47,65,28,78,23], "#80603a", 5);
    [[22,24],[34,28],[48,20],[63,25],[78,22]].forEach(([x,y], i) => {
      ellipse(ctx, x, y, 13 + (i % 2) * 2, 11, i % 2 ? "#4d934e" : "#2d713f");
    });
    ellipse(ctx, 49, 13, 11, 9, "#79ba64");
  }
}

function drawBush(ctx: Ctx, berries = false, variant = 0): void {
  const v = variant % 3;
  const lobes = v === 0
    ? [[34,57,19,18],[52,53,20,20],[64,61,16,16],[43,42,17,15]]
    : v === 1
      ? [[28,62,16,14],[42,50,18,18],[59,48,17,17],[68,63,17,15],[49,66,20,16]]
      : [[31,53,17,19],[47,43,19,18],[64,53,18,20],[38,67,18,14],[58,68,17,14]];
  stroke(ctx, v === 1 ? [27,76,46,51,69,76] : [34,75,47,52,58,75], "#4d3823", 5);
  lobes.forEach(([x,y,rx,ry], i) => ellipse(ctx, x, y, rx, ry, ["#215c38","#2d7844","#388a4c","#4a9c55"][i % 4]));
  if (berries) {
    const berryColors = v === 1 ? ["#b9474f", "#dc6671"] : v === 2 ? ["#385c9d", "#6384c4"] : ["#6f3dac", "#8d58ca"];
    const positions = v === 0 ? [[31,53],[44,47],[55,57],[64,52],[47,67],[58,39]] : v === 1 ? [[29,61],[39,50],[53,45],[64,58],[51,67]] : [[29,50],[43,39],[60,49],[37,65],[59,66]];
    positions.forEach(([x,y], i) => { dot(ctx, x, y, 4, berryColors[i % 2]); dot(ctx, x - 1, y - 1, 1.2, "#f2d5e7"); });
  }
}

function drawRock(ctx: Ctx, variant: number): void {
  const v = variant % 4;
  if (v === 0) {
    polygon(ctx, [16,72,24,40,42,22,68,28,82,57,75,76,33,82], "#606c78");
    polygon(ctx, [24,40,42,22,45,48,16,72], "#93a0aa"); polygon(ctx, [45,48,68,28,82,57,58,60], "#75818d");
    stroke(ctx, [45,48,51,59,44,68], "#46515d", 3); stroke(ctx, [26,69,40,64], "#bdc6cc", 2);
  } else if (v === 1) {
    polygon(ctx, [12,75,19,52,36,42,52,55,64,32,83,48,87,76], "#5b6872");
    polygon(ctx, [19,52,36,42,43,61,12,75], "#8998a0"); polygon(ctx, [64,32,83,48,69,59,52,55], "#73838c");
    stroke(ctx, [67,39,63,50,73,56], "#b4c1c5", 2);
  } else if (v === 2) {
    polygon(ctx, [12,73,24,45,48,36,78,48,86,72,72,81,25,81], "#6d777c");
    polygon(ctx, [24,45,48,36,56,55,18,69], "#a2aaab"); polygon(ctx, [56,55,78,48,86,72,66,68], "#505d64");
    stroke(ctx, [31,66,48,61,61,65], "#c0c9c8", 3);
  } else {
    polygon(ctx, [24,79,29,35,44,14,63,24,76,58,69,81], "#56636c");
    polygon(ctx, [29,35,44,14,48,49,24,79], "#89979f"); polygon(ctx, [48,49,63,24,76,58,59,65], "#6c7980");
    stroke(ctx, [48,49,43,60,50,70], "#3e4a51", 3);
  }
}

function drawAnimal(ctx: Ctx, kind: "rabbit" | "wolf" | "boar" | "bear", variant = 0): void {
  const palettes = {
    rabbit: [["#b78a62", "#e3c7a8", "#593f31"], ["#d3d0c5", "#f2eee3", "#66645e"], ["#846e61", "#c8b5a8", "#3e3531"]],
    wolf: [["#697887", "#a9b3bb", "#26303a"], ["#4d555b", "#89939a", "#171d22"], ["#9a8e7c", "#d0c4ae", "#514a42"]],
    boar: [["#6e4633", "#a56f50", "#2c211d"], ["#4f3b31", "#846250", "#201b18"], ["#8a5b39", "#bd835a", "#3b291f"]],
    bear: [["#604633", "#956e4d", "#261d18"], ["#40362f", "#77675a", "#181513"], ["#80583b", "#b0805d", "#33251d"]],
  }[kind];
  const [base, light, dark] = palettes[variant % palettes.length];
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
  if (variant % 3 === 1) {
    ellipse(ctx, 38, 52, kind === "rabbit" ? 8 : 10, kind === "rabbit" ? 6 : 5, light);
  } else if (variant % 3 === 2) {
    stroke(ctx, [29,49,39,53,49,49,59,53], light, kind === "bear" ? 5 : 3);
  }
}

function drawFlame(ctx: Ctx, x = 48, y = 52, scale = 1): void {
  polygon(ctx, [x,y-31*scale,x-17*scale,y-2*scale,x-10*scale,y+19*scale,x+12*scale,y+19*scale,x+19*scale,y-4*scale], "#ef5b2d");
  polygon(ctx, [x,y-20*scale,x-9*scale,y+1*scale,x-3*scale,y+15*scale,x+8*scale,y+10*scale,x+10*scale,y-3*scale], "#ffc845");
  polygon(ctx, [x,y-8*scale,x-3*scale,y+7*scale,x+4*scale,y+9*scale,x+6*scale,y], "#fff3a0");
}

function drawEntity(ctx: Ctx, type: EntityType, variant: number): void {
  const v = variant % entityVariantCount(type);
  ctx.shadowColor = "rgba(0,0,0,.35)";
  ctx.shadowBlur = 5;
  ctx.shadowOffsetY = 3;
  switch (type) {
    case "tree": drawTree(ctx, v); break;
    case "berry_bush": drawBush(ctx, true, v); break;
    case "stone_outcrop": drawRock(ctx, v); break;
    case "vine":
      stroke(ctx, v === 0 ? [22,78,29,57,48,50,59,31,74,22] : v === 1 ? [17,74,35,65,31,44,52,36,69,17] : [24,20,32,38,57,43,67,61,76,78], v === 2 ? "#3c7b38" : "#276e38", 7);
      (v === 0 ? [[29,59],[43,52],[57,34],[70,24],[52,43]] : v === 1 ? [[25,65],[32,48],[47,40],[61,27],[67,18]] : [[28,31],[40,41],[56,45],[66,58],[72,72]]).forEach(([x,y], i) => {
        ellipse(ctx, x + (i%2?5:-5), y, v === 1 ? 7 : 9, v === 1 ? 7 : 5, i%2 ? "#65b35d" : "#3d8b49");
      });
      break;
    case "shell":
      if (v === 0) {
        ellipse(ctx, 48, 58, 25, 20, "#f2cfac"); polygon(ctx, [23,61,34,35,48,26,62,35,73,61], "#f6dcc2");
        for (let x = 34; x <= 62; x += 7) stroke(ctx, [48,30,x,65], "#c78f7b", 2);
      } else if (v === 1) {
        ellipse(ctx, 48, 54, 23, 23, "#d89a75"); stroke(ctx, [48,54,55,45,54,35,43,30,31,38,28,54,38,68,56,70,70,58], "#f2c3a1", 6);
        dot(ctx, 48, 54, 5, "#a76656");
      } else if (v === 2) {
        ellipse(ctx, 48, 59, 27, 16, "#e8c7a5"); polygon(ctx, [22,59,34,39,62,39,75,59,65,70,31,70], "#f5dcc1");
        stroke(ctx, [25,58,70,58], "#b98473", 3); stroke(ctx, [35,44,41,65,48,42,54,65,62,44], "#c8957f", 2);
      } else {
        polygon(ctx, [48,25,56,43,75,38,62,54,75,69,55,63,48,82,41,63,21,69,34,54,21,38,40,43], "#f2d3a2");
        stroke(ctx, [48,31,48,72,28,43,68,64,68,43,28,64], "#c89475", 2);
      }
      break;
    case "driftwood":
      if (v === 0) {
        polygon(ctx, [14,67,21,51,72,31,82,40,76,54,27,75], "#6d472c"); stroke(ctx, [24,58,70,39], "#b07a46", 5); stroke(ctx, [30,53,20,39], "#8c5d37", 5); stroke(ctx, [64,42,72,25], "#8c5d37", 5);
      } else if (v === 1) {
        stroke(ctx, [18,69,43,50,75,22], "#785235", 12); stroke(ctx, [39,53,24,32], "#9c7047", 7); stroke(ctx, [52,43,74,55], "#9c7047", 7); stroke(ctx, [24,66,67,30], "#c09261", 3);
      } else {
        stroke(ctx, [17,67,77,47], "#805638", 11); stroke(ctx, [23,39,67,72], "#68442f", 10); stroke(ctx, [28,62,68,50], "#b37b4c", 3); stroke(ctx, [31,44,60,67], "#9d6d49", 3);
      }
      break;
    case "mushroom":
      if (v === 0) {
        rounded(ctx, 42, 50, 13, 31, 6); ctx.fillStyle = "#e9d6b2"; ctx.fill(); ellipse(ctx, 48, 45, 27, 19, "#c84442");
        [[35,40],[49,34],[60,45]].forEach(([x,y]) => dot(ctx,x,y,4,"#fff4df"));
      } else if (v === 1) {
        [[31,58,8,20,17],[49,49,10,27,22],[66,61,7,17,15]].forEach(([x,y,stem,capW,capH], i) => {
          rounded(ctx, x-stem/2, y, stem, 22-(i%2)*5, 4); ctx.fillStyle="#ead5b0";ctx.fill(); ellipse(ctx,x,y,capW,capH/2,i===1?"#dc8d35":"#e8ad47");
        });
      } else if (v === 2) {
        rounded(ctx, 43, 42, 11, 39, 5);ctx.fillStyle="#d7cab7";ctx.fill(); ellipse(ctx,48,38,21,14,"#765887");
        ellipse(ctx,39,36,6,4,"#9f83ad"); ellipse(ctx,57,39,5,3,"#b39ac0"); stroke(ctx,[39,58,56,58],"#b9aa93",3);
      } else {
        rounded(ctx, 39, 49, 18, 33, 7);ctx.fillStyle="#eee0bd";ctx.fill(); ellipse(ctx,48,48,30,13,"#b89b67");
        polygon(ctx,[18,49,28,31,48,24,68,31,78,49],"#d6bd82"); stroke(ctx,[26,47,70,47],"#92784e",3);
      }
      break;
    case "rabbit": case "wolf": case "boar": case "bear": drawAnimal(ctx, type, v); break;
    case "flower":
      stroke(ctx, v === 3 ? [39,79,42,51,56,35,60,76] : [48,78,48,47], "#3a813f", 5);
      { const petals = [8,5,6,5][v]; const colors = ["#fff2e8","#f3c6d8","#9fccec","#f2d26e"]; const cx=v===3?56:48; const cy=v===3?34:39;
        for (let i=0;i<petals;i++) { const a=i*Math.PI*2/petals; ellipse(ctx,cx+Math.cos(a)*14,cy+Math.sin(a)*14,v===1?9:8,v===2?4:5,colors[v]); }
        dot(ctx,cx,cy,7,v===2?"#6b4b31":"#f5a940"); if(v===3){ellipse(ctx,38,48,10,6,"#f7e28d");dot(ctx,38,48,4,"#d98934");}
      } break;
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
      ellipse(ctx,48,73,25,8,"#70482b"); stroke(ctx,v===0?[48,69,48,41]:v===1?[48,69,43,48,49,32]:[48,69,55,48,50,35],"#397940",5);
      if(v===0){ellipse(ctx,38,45,11,6,"#60ad59");ellipse(ctx,58,40,11,6,"#73bd61");}
      else if(v===1){ellipse(ctx,34,48,13,6,"#75b95f");ellipse(ctx,55,39,12,7,"#4f9d4d");dot(ctx,49,31,4,"#9dca6b");}
      else{ellipse(ctx,43,49,8,13,"#559d52");ellipse(ctx,61,48,8,12,"#72b864");ellipse(ctx,51,36,7,11,"#8ac773");} break;
    case "ripe_plant": drawBush(ctx, true, v); break;
    case "signal_fire_unlit": case "signal_fire_lit":
      stroke(ctx,[30,78,48,26,66,78,37,57,60,57,30,78],"#735039",6); ellipse(ctx,48,28,18,6,"#4e392c");
      if (type === "signal_fire_lit") drawFlame(ctx,48,23,.62); break;
    case "raft_placed":
      for (let y=45;y<=68;y+=8) { rounded(ctx,18,y,61,7,3); ctx.fillStyle="#8e5b34";ctx.fill(); }
      stroke(ctx,[49,65,49,19],"#4c3828",5); polygon(ctx,[51,20,77,47,51,51],"#e7d8b5"); break;
  }
  ctx.shadowColor = "transparent";
}

function drawPlayerFront(ctx: Ctx): void {
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

function drawPlayerBack(ctx: Ctx): void {
  ctx.shadowColor = "rgba(0,0,0,.35)"; ctx.shadowBlur = 5; ctx.shadowOffsetY = 3;
  ellipse(ctx,48,24,14,14,"#c58e62");
  ellipse(ctx,48,17,15,9,"#33231e");
  polygon(ctx,[34,19,38,10,52,8,63,17,59,28,50,22,41,27,34,23],"#3b2921");
  rounded(ctx,31,37,34,34,9); ctx.fillStyle="#d9d1c3";ctx.fill();
  polygon(ctx,[31,42,18,61,25,66,38,52],"#c9c0b2"); polygon(ctx,[65,42,78,61,71,66,58,52],"#c9c0b2");
  rounded(ctx,27,66,17,20,6);ctx.fillStyle="#2e3e4d";ctx.fill(); rounded(ctx,52,66,17,20,6);ctx.fillStyle="#2e3e4d";ctx.fill();
  rounded(ctx,30,39,36,31,9);ctx.fillStyle="#735739";ctx.fill();
  rounded(ctx,35,43,26,22,6);ctx.fillStyle="#8b6b46";ctx.fill();
  stroke(ctx,[31,45,48,57,65,45],"#c19a61",3); stroke(ctx,[39,67,57,67],"#4f3b2a",3);
  ctx.shadowColor="transparent";
}

function drawPlayerSide(ctx: Ctx): void {
  ctx.shadowColor = "rgba(0,0,0,.35)"; ctx.shadowBlur = 5; ctx.shadowOffsetY = 3;
  ellipse(ctx,57,25,14,14,"#d7a26f");
  ellipse(ctx,52,18,14,8,"#33231e"); polygon(ctx,[42,20,44,10,56,8,66,15,68,22,59,17,52,22],"#3b2921");
  polygon(ctx,[68,24,75,28,68,31],"#bf835a"); dot(ctx,64,24,2,"#16212a"); stroke(ctx,[64,32,70,31],"#975d50",1.5);
  rounded(ctx,39,38,31,34,9);ctx.fillStyle="#e0d7c8";ctx.fill();
  rounded(ctx,27,41,20,29,7);ctx.fillStyle="#735739";ctx.fill();
  stroke(ctx,[43,44,66,55,78,48],"#cfbfaa",8); dot(ctx,79,48,4,"#d7a26f");
  rounded(ctx,37,66,17,20,6);ctx.fillStyle="#334453";ctx.fill(); rounded(ctx,55,66,17,20,6);ctx.fillStyle="#293946";ctx.fill();
  stroke(ctx,[31,47,41,57,66,58],"#a27c4e",3);
  ctx.shadowColor="transparent";
}

function drawPlayer(ctx: Ctx, direction: PlayerDirection): void {
  if (direction === "down") drawPlayerFront(ctx);
  else if (direction === "up") drawPlayerBack(ctx);
  else if (direction === "right") drawPlayerSide(ctx);
  else {
    ctx.save();
    ctx.translate(96, 0);
    ctx.scale(-1, 1);
    drawPlayerSide(ctx);
    ctx.restore();
  }
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
  for (const direction of ["down", "left", "up", "right"] as PlayerDirection[]) {
    makeCanvas(scene, playerTextureKey(direction), 96, (ctx) => drawPlayer(ctx, direction));
  }
  for (const type of Object.keys(ENTITIES) as EntityType[]) {
    for (let variant = 0; variant < entityVariantCount(type); variant++) {
      makeCanvas(scene, entityTextureKey(type, variant), 96, (ctx) => drawEntity(ctx, type, variant));
    }
  }
}

export function playerTextureKey(direction: PlayerDirection = "down"): string { return `${PLAYER_PREFIX}${direction}`; }
export function entityTextureKey(type: EntityType, variant = 0): string { return `${ENTITY_PREFIX}${type}-${variant}`; }

export function entityVariantCount(type: EntityType): number {
  if (["tree", "stone_outcrop", "shell", "mushroom", "flower"].includes(type)) return 4;
  if (["berry_bush", "vine", "driftwood", "rabbit", "wolf", "boar", "bear", "planted_seed", "ripe_plant"].includes(type)) return 3;
  return 1;
}

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
