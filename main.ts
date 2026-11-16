import { mkdir, writeFile } from 'node:fs/promises';
import { deflateSync } from 'node:zlib';
import { join, resolve } from 'node:path';

const W = 1024;
const H = 1024;
const S = 2;
const SW = W * S;
const SH = H * S;
const pixels = Buffer.alloc(SW * SH * 3);
type Color = readonly [number, number, number];
const clamp = (n: number, a = 0, b = 255) => Math.max(a, Math.min(b, n));
function blendPixel(x: number, y: number, color: Color, alpha = 1): void {
  if (x < 0 || y < 0 || x >= SW || y >= SH || alpha <= 0) return;
  const i = (y * SW + x) * 3;
  pixels[i] = pixels[i] * (1 - alpha) + color[0] * alpha;
  pixels[i + 1] = pixels[i + 1] * (1 - alpha) + color[1] * alpha;
  pixels[i + 2] = pixels[i + 2] * (1 - alpha) + color[2] * alpha;
}
function rect(x: number, y: number, w: number, h: number, c: Color): void {
  const x0 = Math.max(0, Math.floor(x * S)), y0 = Math.max(0, Math.floor(y * S));
  const x1 = Math.min(SW, Math.ceil((x + w) * S)), y1 = Math.min(SH, Math.ceil((y + h) * S));
  for (let py = y0; py < y1; py++) for (let px = x0; px < x1; px++) blendPixel(px, py, c);
}
function circle(cx: number, cy: number, r: number, c: Color, alpha = 1): void {
  const x0 = Math.max(0, Math.floor((cx - r) * S)), x1 = Math.min(SW, Math.ceil((cx + r) * S));
  const y0 = Math.max(0, Math.floor((cy - r) * S)), y1 = Math.min(SH, Math.ceil((cy + r) * S));
  const rr = r * r;
  for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) {
    const dx = (x + 0.5) / S - cx, dy = (y + 0.5) / S - cy;
    const d = dx * dx + dy * dy;
    if (d <= rr + 1 / S) blendPixel(x, y, c, alpha * clamp((r + 0.5 / S - Math.sqrt(d)) * S, 0, 1));
  }
}
function line(x1: number, y1: number, x2: number, y2: number, width: number, c: Color, alpha = 1): void {
  const minX = Math.max(0, Math.floor((Math.min(x1, x2) - width) * S));
  const maxX = Math.min(SW, Math.ceil((Math.max(x1, x2) + width) * S));
  const minY = Math.max(0, Math.floor((Math.min(y1, y2) - width) * S));
  const maxY = Math.min(SH, Math.ceil((Math.max(y1, y2) + width) * S));
  const dx = x2 - x1, dy = y2 - y1, len2 = dx * dx + dy * dy;
  for (let py = minY; py < maxY; py++) for (let px = minX; px < maxX; px++) {
    const x = (px + 0.5) / S, y = (py + 0.5) / S;
    const t = len2 ? clamp(((x - x1) * dx + (y - y1) * dy) / len2, 0, 1) : 0;
    const d = Math.hypot(x - (x1 + t * dx), y - (y1 + t * dy));
    if (d <= width / 2 + 0.5 / S) blendPixel(px, py, c, alpha * clamp((width / 2 + 0.5 / S - d) * S, 0, 1));
  }
}
function polygon(points: readonly (readonly [number, number])[], c: Color): void {
  const minY = Math.max(0, Math.floor(Math.min(...points.map(p => p[1])) * S));
  const maxY = Math.min(SH, Math.ceil(Math.max(...points.map(p => p[1])) * S));
  const minX = Math.max(0, Math.floor(Math.min(...points.map(p => p[0])) * S));
  const maxX = Math.min(SW, Math.ceil(Math.max(...points.map(p => p[0])) * S));
  for (let py = minY; py < maxY; py++) for (let px = minX; px < maxX; px++) {
    const x = (px + 0.5) / S, y = (py + 0.5) / S; let inside = false;
    for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
      const [xi, yi] = points[i], [xj, yj] = points[j];
      if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) inside = !inside;
    }
    if (inside) blendPixel(px, py, c);
  }
}
function ellipse(cx: number, cy: number, rx: number, ry: number, c: Color, angle = 0): void {
  const ca = Math.cos(angle), sa = Math.sin(angle);
  const bound = Math.max(rx, ry);
  const x0 = Math.max(0, Math.floor((cx - bound) * S)), x1 = Math.min(SW, Math.ceil((cx + bound) * S));
  const y0 = Math.max(0, Math.floor((cy - bound) * S)), y1 = Math.min(SH, Math.ceil((cy + bound) * S));
  for (let py = y0; py < y1; py++) for (let px = x0; px < x1; px++) {
    const dx = (px + 0.5) / S - cx, dy = (py + 0.5) / S - cy;
    const u = dx * ca + dy * sa, v = -dx * sa + dy * ca;
    if (u * u / (rx * rx) + v * v / (ry * ry) <= 1) blendPixel(px, py, c);
  }
}

// Deep atmosphere with a restrained amber horizon.
for (let y = 0; y < H; y++) {
  const t = y / (H - 1);
  const r = 5 + 7 * t, g = 34 + 42 * t, b = 57 + 42 * t;
  for (let x = 0; x < W; x++) {
    const i = (y * S * SW + x * S) * 3;
    for (let sy = 0; sy < S; sy++) for (let sx = 0; sx < S; sx++) {
      const k = i + (sy * SW + sx) * 3;
      pixels[k] = r; pixels[k + 1] = g; pixels[k + 2] = b;
    }
  }
}
circle(534, 410, 310, [247, 135, 65], 0.035);
circle(534, 410, 270, [247, 135, 65], 0.055);
circle(534, 410, 238, [234, 130, 55], 0.10);
circle(534, 410, 196, [248, 153, 67], 0.12);
circle(534, 410, 146, [255, 174, 80], 0.18);
circle(534, 410, 112, [255, 194, 106]);
circle(534, 410, 91, [255, 207, 125]);

// Distant water glints and framing plants.
for (const [x, y, w, a] of [[82, 653, 114, .35], [191, 697, 78, .24], [708, 672, 130, .3], [875, 632, 93, .25], [356, 745, 102, .2]] as const)
  line(x, y, x + w, y, 3, [99, 201, 195], a);
polygon([[0, 617], [22, 602], [36, 617], [54, 588], [70, 618], [92, 594], [104, 619], [127, 603], [145, 622], [145, 1024], [0, 1024]], [5, 34, 42]);
polygon([[1024, 625], [997, 605], [985, 624], [966, 582], [950, 624], [929, 599], [916, 628], [893, 610], [874, 632], [874, 1024], [1024, 1024]], [4, 30, 43]);
for (const [x, y, dx, dy] of [[44, 683, 18, -202], [73, 672, -5, -163], [987, 681, -33, -189], [954, 691, 7, -143]] as const) {
  line(x, y, x + dx, y + dy, 8, [9, 61, 63]);
  for (let k = 1; k <= 3; k++) line(x + dx * k / 4, y + dy * k / 4, x + dx * k / 4 - 27, y + dy * k / 4 - 19, 5, [9, 61, 63]);
}

// Low water band and bright surface edge.
rect(0, 714, 1024, 310, [5, 57, 76]);
rect(0, 720, 1024, 3, [67, 209, 207]);
line(0, 728, 1024, 728, 2, [42, 139, 159], .8);
for (const [x, y, w] of [[73, 771, 168], [752, 783, 208], [213, 844, 108], [610, 814, 142], [59, 917, 221], [790, 922, 154]] as const)
  line(x, y, x + w, y, 2, [29, 119, 143], .8);

// Motion streaks trail from the bird's upper-right shoulder.
line(773, 249, 889, 170, 7, [109, 219, 211], .74);
line(798, 278, 934, 220, 5, [71, 178, 187], .65);
line(820, 308, 957, 269, 4, [74, 170, 185], .55);
line(752, 219, 833, 146, 3, [180, 236, 219], .72);

// Kingfisher silhouette, diving on a strong upper-right to lower-left axis.
ellipse(609, 382, 237, 87, [4, 34, 49], -0.77);
// Far wing sweeps back from the shoulder in one clean silhouette.
polygon([[581, 386], [650, 277], [712, 192], [770, 126], [754, 248], [808, 205], [774, 310], [837, 276], [789, 367], [722, 421], [668, 430]], [4, 56, 76]);
polygon([[605, 378], [671, 285], [725, 217], [758, 176], [744, 273], [790, 240], [761, 326], [806, 306], [770, 375], [714, 413], [674, 415]], [9, 118, 145]);
polygon([[626, 375], [680, 302], [723, 252], [719, 317], [760, 291], [740, 357], [774, 345], [729, 394], [680, 411]], [32, 175, 180]);
// Body and tail.
polygon([[346, 572], [406, 480], [501, 376], [586, 322], [692, 313], [761, 363], [753, 433], [696, 495], [613, 540], [520, 577], [439, 615]], [4, 70, 88]);
polygon([[368, 552], [427, 476], [512, 397], [594, 344], [686, 337], [736, 370], [721, 421], [675, 465], [599, 505], [518, 544], [440, 583]], [11, 151, 163]);
polygon([[418, 540], [495, 463], [573, 403], [660, 366], [703, 378], [675, 424], [616, 463], [545, 503], [473, 551]], [38, 195, 183]);
polygon([[433, 570], [330, 659], [462, 594], [511, 556]], [4, 45, 62]);
polygon([[457, 580], [391, 637], [492, 578]], [12, 112, 132]);
// Near wing is a single tapered sweep with a quiet inset highlight.
polygon([[532, 393], [584, 315], [626, 247], [683, 191], [676, 277], [728, 232], [713, 316], [770, 286], [738, 367], [795, 352], [730, 418], [655, 447], [593, 427]], [3, 49, 69]);
polygon([[557, 389], [601, 322], [642, 266], [662, 244], [651, 326], [698, 285], [685, 356], [731, 331], [705, 385], [755, 378], [703, 423], [651, 432], [612, 417]], [8, 112, 143]);
// Orange breast and white throat lead the dive.
ellipse(474, 481, 109, 56, [210, 76, 33], -0.76);
ellipse(482, 472, 91, 43, [248, 119, 42], -0.76);
ellipse(480, 466, 72, 30, [255, 157, 54], -0.76);
ellipse(478, 458, 48, 19, [255, 186, 79], -0.76);
ellipse(514, 426, 24, 17, [243, 243, 219], -0.75);
// One rounded teal head, flowing into the body; eye sits on its upper-front.
ellipse(672, 337, 69, 55, [5, 86, 112], -0.72);
ellipse(681, 321, 57, 34, [16, 164, 174], -0.72);
circle(696, 322, 10, [250, 243, 213]);
circle(698, 322, 5, [8, 25, 35]);
circle(699, 320, 1.8, [255, 255, 255]);
// Shorter dark beak retains the same splash-center tip.
polygon([[711, 353], [775, 401], [1002, 714], [762, 464], [691, 387]], [8, 20, 26]);
polygon([[722, 365], [795, 426], [986, 697], [778, 457]], [29, 40, 42]);
line(777, 411, 989, 699, 3, [102, 104, 89], .8);

// Impact crown, ripples and droplets.
const ix = 1002, iy = 714;
ellipse(ix - 22, iy + 12, 117, 22, [28, 135, 160], 0);
ellipse(ix - 22, iy + 12, 100, 17, [5, 57, 76], 0);
ellipse(ix - 16, iy + 8, 92, 17, [91, 230, 218], 0);
ellipse(ix - 16, iy + 8, 62, 9, [5, 57, 76], 0);
line(ix - 81, iy + 6, ix - 41, iy - 37, 8, [116, 244, 224]);
line(ix - 41, iy - 37, ix - 20, iy + 1, 8, [116, 244, 224]);
line(ix - 20, iy + 1, ix + 7, iy - 48, 8, [116, 244, 224]);
line(ix + 7, iy - 48, ix + 26, iy + 4, 8, [116, 244, 224]);
line(ix + 26, iy + 4, ix + 59, iy - 23, 8, [116, 244, 224]);
for (const [x, y, r] of [[895, 653, 8], [940, 624, 6], [969, 670, 5], [915, 688, 4], [982, 604, 4], [867, 682, 5], [953, 575, 3], [883, 617, 4], [930, 590, 3], [998, 642, 3], [849, 660, 3], [990, 577, 2.5], [904, 574, 2.5], [976, 553, 2]] as const)
  circle(x, y, r, [171, 255, 235]);
line(857, 690, 902, 657, 4, [193, 255, 238], .9);
line(927, 696, 973, 680, 3, [159, 246, 231], .85);
// Crisp white motion cuts around the bird.
line(234, 388, 302, 347, 5, [220, 253, 235], .9);
line(267, 431, 326, 406, 4, [153, 232, 225], .8);
line(363, 300, 416, 273, 4, [212, 248, 230], .82);
line(532, 217, 576, 190, 3, [180, 239, 225], .8);
line(846, 453, 903, 437, 4, [189, 243, 229], .75);
line(295, 519, 347, 495, 3, [186, 245, 229], .86);
line(405, 234, 451, 214, 3, [177, 241, 227], .78);
line(867, 493, 924, 479, 3, [130, 218, 216], .78);
line(329, 333, 364, 310, 2, [230, 255, 235], .9);

function crc32(data: Buffer): number {
  let crc = 0xffffffff;
  for (const byte of data) {
    crc ^= byte;
    for (let k = 0; k < 8; k++) crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0);
  }
  return (crc ^ 0xffffffff) >>> 0;
}
function chunk(type: string, data: Buffer): Buffer {
  const name = Buffer.from(type, 'ascii');
  const out = Buffer.alloc(12 + data.length);
  out.writeUInt32BE(data.length, 0); name.copy(out, 4); data.copy(out, 8);
  out.writeUInt32BE(crc32(Buffer.concat([name, data])), 8 + data.length);
  return out;
}
const raw = Buffer.alloc(H * (1 + W * 3));
for (let y = 0; y < H; y++) {
  const row = y * (1 + W * 3);
  raw[row] = 0;
  for (let x = 0; x < W; x++) for (let c = 0; c < 3; c++) {
    let total = 0;
    for (let sy = 0; sy < S; sy++) for (let sx = 0; sx < S; sx++) total += pixels[((y * S + sy) * SW + x * S + sx) * 3 + c];
    raw[row + 1 + x * 3 + c] = Math.round(total / (S * S));
  }
}
const ihdr = Buffer.alloc(13);
ihdr.writeUInt32BE(W, 0); ihdr.writeUInt32BE(H, 4); ihdr[8] = 8; ihdr[9] = 2;
const png = Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0))]);
const outDir = resolve(process.env.MAKEFUN_OUTPUT_DIR ?? '/output');
await mkdir(outDir, { recursive: true });
await writeFile(join(outDir, 'entry.png'), png);
console.log(`Wrote ${join(outDir, 'entry.png')} (${png.length} bytes)`);
