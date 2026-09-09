// Домбровый мотив, синтезированный в Node: щипковые струны (Карплус-Стронг), две струны
// в кварту как у домбры, кюй-подобный риф с характерным «тремоло-качем» и низким гулом.
// node gendombra.mjs <длина_мс> → dombra.wav (луп по модулю длины, без шва)
import fs from "node:fs";
import { fileURLToPath } from "node:url";

const W = fileURLToPath(new URL(".", import.meta.url));
const RATE = 44100;
const DUR = Number(process.argv[2] || 41800) / 1000;
const n = Math.floor(RATE * DUR);
const out = new Float32Array(n);
const add = (i, v) => { out[((i % n) + n) % n] += v; };
let seed = 777;
const rnd = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff * 2 - 1; };

/** Щипок струны Карплуса-Стронга: частота, длительность, яркость (0..1), громкость. */
function pluck(at, freq, dur, bright, gain) {
  const N = Math.max(2, Math.round(RATE / freq));
  const buf = new Float32Array(N);
  for (let i = 0; i < N; i++) buf[i] = rnd() * (i < N * bright ? 1 : 0.35);
  const len = Math.floor(RATE * dur);
  let ptr = 0, prev = 0;
  const decay = 0.996;
  for (let i = 0; i < len; i++) {
    const cur = buf[ptr];
    const nxt = buf[(ptr + 1) % N];
    const v = decay * 0.5 * (cur + nxt);
    buf[ptr] = v;
    ptr = (ptr + 1) % N;
    const env = i < 40 ? i / 40 : 1;
    const s = (cur * 0.7 + prev * 0.3) * env;
    prev = cur;
    add(Math.round(at * RATE) + i, s * gain);
  }
}

// Строй домбры: нижняя струна D3 (146.8), верхняя G3 (196) — кварта. Лад — дорийский ре.
const F = { D3: 146.83, E3: 164.81, F3: 174.61, G3: 196, A3: 220, Bb3: 233.08, C4: 261.63, D4: 293.66, E4: 329.63, F4: 349.23, G4: 392, A4: 440 };
const BPM = 118;
const beat = 60 / BPM;
const bars = Math.round(DUR / (beat * 4));
const barLen = DUR / bars;              // подгон, чтобы луп замкнулся ровно
const b8 = barLen / 8;                  // восьмая

// Риф на 4 такта: верхняя струна ведёт мелодию восьмыми, нижняя держит бурдон на D3/A3.
const RIFF = [
  ["D4", "F4", "G4", "A4", "G4", "F4", "D4", "C4"],
  ["D4", "F4", "A4", "C4", "D4", "C4", "A3", "G3"],
  ["F4", "G4", "A4", "G4", "F4", "D4", "C4", "D4"],
  ["A3", "C4", "D4", "F4", "D4", "C4", "A3", "G3"],
];
for (let bar = 0; bar < bars; bar++) {
  const t0 = bar * barLen;
  const line = RIFF[bar % RIFF.length];
  const variation = Math.floor(bar / RIFF.length) % 2 === 1; // каждый второй проход — с двойным ударом
  line.forEach((note, i) => {
    const at = t0 + i * b8;
    const accent = i % 2 === 0 ? 0.26 : 0.19;
    pluck(at, F[note], 0.55, 0.9, accent);
    // нижняя струна — бурдон на сильных долях (характерный домбровый «двухголосный» удар)
    if (i % 2 === 0) pluck(at + 0.004, i % 4 === 0 ? F.D3 : F.A3, 0.7, 0.6, 0.16);
    if (variation && i % 4 === 2) pluck(at + b8 / 2, F[note], 0.3, 0.95, 0.12); // качающий ре-удар
  });
}
// последний такт цикла: короткий «сброс» — три удара по открытым струнам, чтобы луп замкнулся акцентом
for (let k = 0; k < 3; k++) { const at = DUR - barLen + k * b8 * 2; pluck(at, F.D3, 0.9, 0.7, 0.2); pluck(at + 0.004, F.G3, 0.9, 0.7, 0.16); }

// тёплый lowpass (корпус) + лёгкая «комната» (два коротких отражения) + нормализация
let y = 0; const a = 1 - Math.exp(-2 * Math.PI * 4200 / RATE);
for (let i = 0; i < n; i++) { y += a * (out[i] - y); out[i] = y; }
const d1 = Math.round(RATE * 0.023), d2 = Math.round(RATE * 0.041);
const wet = new Float32Array(n);
for (let i = 0; i < n; i++) wet[i] = out[i] + 0.22 * out[((i - d1) % n + n) % n] + 0.14 * out[((i - d2) % n + n) % n];
let peak = 0; for (let i = 0; i < n; i++) peak = Math.max(peak, Math.abs(wet[i]));
for (let i = 0; i < n; i++) wet[i] = wet[i] / peak * 0.85;

const buf = Buffer.alloc(44 + n * 2);
buf.write("RIFF", 0); buf.writeUInt32LE(36 + n * 2, 4); buf.write("WAVE", 8);
buf.write("fmt ", 12); buf.writeUInt32LE(16, 16); buf.writeUInt16LE(1, 20); buf.writeUInt16LE(1, 22);
buf.writeUInt32LE(RATE, 24); buf.writeUInt32LE(RATE * 2, 28); buf.writeUInt16LE(2, 32); buf.writeUInt16LE(16, 34);
buf.write("data", 36); buf.writeUInt32LE(n * 2, 40);
for (let i = 0; i < n; i++) buf.writeInt16LE(Math.round(Math.max(-1, Math.min(1, wet[i])) * 32767), 44 + i * 2);
fs.writeFileSync(W + "dombra.wav", buf);
console.log("dombra.wav", DUR.toFixed(2) + "s", bars, "тактов при ~" + BPM + " BPM");
