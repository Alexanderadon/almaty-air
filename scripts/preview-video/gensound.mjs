// Синтез всех звуков превью прямо в Node (WAV 44,1 кГц, моно, 16 бит) — без чужих сэмплов и треков.
// Выход: click.wav, whoosh.wav (смена темы), swoosh_down.wav / swoosh_up.wav (тур-скролл),
// swell.wav (вступительный подъём), music.wav (лоу-фай подложка ровно на длину цикла — луп без шва).
import fs from "node:fs";

import { fileURLToPath } from "node:url";
const W = fileURLToPath(new URL(".", import.meta.url));
const RATE = 44100;
const CYCLE_MS = Number(process.argv[2] || 27400);

function wav(samples) {
  const n = samples.length;
  const buf = Buffer.alloc(44 + n * 2);
  buf.write("RIFF", 0); buf.writeUInt32LE(36 + n * 2, 4); buf.write("WAVE", 8);
  buf.write("fmt ", 12); buf.writeUInt32LE(16, 16); buf.writeUInt16LE(1, 20); buf.writeUInt16LE(1, 22);
  buf.writeUInt32LE(RATE, 24); buf.writeUInt32LE(RATE * 2, 28); buf.writeUInt16LE(2, 32); buf.writeUInt16LE(16, 34);
  buf.write("data", 36); buf.writeUInt32LE(n * 2, 40);
  for (let i = 0; i < n; i++) buf.writeInt16LE(Math.round(Math.max(-1, Math.min(1, samples[i])) * 32767), 44 + i * 2);
  return buf;
}
let seed = 20260909;
const rnd = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff * 2 - 1; };
const save = (name, s) => { fs.writeFileSync(W + name, wav(s)); console.log(name, (s.length / RATE).toFixed(2) + "s"); };

/* ---------- клик: два тона с быстрым затуханием + шумовой атак ---------- */
{
  const n = Math.floor(RATE * 0.07), s = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const t = i / RATE;
    const tone = (Math.sin(2 * Math.PI * 2100 * t) * 0.6 + Math.sin(2 * Math.PI * 3300 * t) * 0.4) * Math.exp(-t / 0.011);
    s[i] = (tone * 0.8 + rnd() * Math.exp(-t / 0.0018) * 0.25) * 0.6;
  }
  save("click.wav", s);
}

/* ---------- фильтрованный шум: однополюсный lowpass с плавающей частотой ---------- */
function noiseSweep(dur, cutoffAt, envAt, gain) {
  const n = Math.floor(RATE * dur), s = new Float32Array(n);
  let y = 0;
  for (let i = 0; i < n; i++) {
    const t = i / RATE, k = t / dur;
    const fc = cutoffAt(k);
    const a = 1 - Math.exp(-2 * Math.PI * fc / RATE);
    y += a * (rnd() - y);
    s[i] = y * envAt(k) * gain;
  }
  return s;
}
// смена темы: короткий «вжух» сверху вниз + мягкий низкий толчок
{
  const s = noiseSweep(0.5, (k) => 3200 * Math.pow(0.18, k), (k) => Math.pow(Math.sin(Math.PI * Math.min(1, k * 1.15)), 1.4), 0.9);
  for (let i = 0; i < s.length; i++) { const t = i / RATE; s[i] += Math.sin(2 * Math.PI * 95 * t) * Math.exp(-t / 0.09) * 0.22; }
  save("whoosh.wav", s);
}
// тур вниз: долгий «ветер» — нарастает, проходит, стихает (под 7-секундный скролл берём 2,2 с в начале)
save("swoosh_down.wav", noiseSweep(2.2, (k) => 350 + 1900 * Math.sin(Math.PI * k), (k) => Math.pow(Math.sin(Math.PI * k), 1.6), 0.7));
// возврат наверх: короче и выше по тону
save("swoosh_up.wav", noiseSweep(1.4, (k) => 2400 - 1700 * k, (k) => Math.pow(Math.sin(Math.PI * k), 1.6), 0.6));

/* ---------- вступительный свелл: A-E-A квинта с медленной атакой и лёгким «шиммером» ---------- */
{
  const dur = 2.8, n = Math.floor(RATE * dur), s = new Float32Array(n);
  const notes = [220, 329.63, 440];
  for (let i = 0; i < n; i++) {
    const t = i / RATE, k = t / dur;
    const env = Math.pow(Math.sin(Math.PI * Math.min(1, k)), 1.2) * (k < 0.55 ? Math.pow(k / 0.55, 1.5) : 1);
    let v = 0;
    notes.forEach((f, j) => { v += (Math.sin(2 * Math.PI * f * t) + 0.5 * Math.sin(2 * Math.PI * (f * 1.003) * t)) * (1 - j * 0.22); });
    v += Math.sin(2 * Math.PI * 880 * t) * 0.12 * Math.max(0, k - 0.4);
    s[i] = v * env * 0.11;
  }
  save("swell.wav", s);
}

/* ---------- лоу-фай подложка на длину цикла (луп: всё рендерится по модулю длины) ---------- */
{
  const dur = CYCLE_MS / 1000, n = Math.floor(RATE * dur), s = new Float32Array(n);
  const add = (i, v) => { const j = ((i % n) + n) % n; s[j] += v; };
  const chordDur = dur / 4;             // четыре аккорда на цикл
  const beat = chordDur / 8;            // 8 долей на аккорд (~70 BPM)
  // Am7 · Fmaj7 · Cmaj7 · G6 — тёплый минорный круг, бас — корень октавой ниже
  const chords = [
    { pad: [220, 261.63, 329.63, 392], bass: 110 },
    { pad: [174.61, 220, 261.63, 329.63], bass: 87.31 },
    { pad: [261.63, 329.63, 392, 493.88], bass: 130.81 },
    { pad: [196, 246.94, 293.66, 329.63], bass: 98 },
  ];
  // пэд: детюн-пары синусов, медленная атака/релиз, нахлёст на соседний аккорд
  chords.forEach((c, ci) => {
    const t0 = ci * chordDur, len = chordDur + 1.4, N = Math.floor(RATE * len);
    for (let i = 0; i < N; i++) {
      const t = i / RATE;
      const env = Math.min(1, t / 0.9) * (t > chordDur ? Math.max(0, 1 - (t - chordDur) / 1.4) : 1);
      let v = 0;
      c.pad.forEach((f, j) => {
        const ph = 2 * Math.PI * f * t;
        v += (Math.sin(ph) + 0.6 * Math.sin(ph * 1.004 + j) + 0.15 * Math.sin(2 * ph)) * (1 - j * 0.12);
      });
      add(Math.round((t0 + t) * RATE), v * env * 0.028);
    }
    // бас: щипок на 1-й и 5-й долях
    [0, 4].forEach((b) => {
      const tb = t0 + b * beat, N2 = Math.floor(RATE * 1.6);
      for (let i = 0; i < N2; i++) {
        const t = i / RATE;
        const v = (Math.sin(2 * Math.PI * c.bass * t) + 0.35 * Math.sin(2 * Math.PI * c.bass * 2 * t)) * Math.exp(-t / 0.55) * Math.min(1, t / 0.012);
        add(Math.round((tb + t) * RATE), v * 0.16);
      }
    });
    // ритм: мягкий кик на 1 и 5 (и призрачный на 7,5), хэт восьмыми с акцентами
    for (let b = 0; b < 8; b++) {
      const tb = t0 + b * beat;
      if (b === 0 || b === 4 || b === 6.5) { /* placeholder */ }
      const kickAt = (tt, g) => { const N3 = Math.floor(RATE * 0.22); for (let i = 0; i < N3; i++) { const t = i / RATE; const f = 55 + 90 * Math.exp(-t / 0.035); add(Math.round((tt + t) * RATE), Math.sin(2 * Math.PI * f * t) * Math.exp(-t / 0.09) * g); } };
      if (b === 0) kickAt(tb, 0.32);
      if (b === 4) kickAt(tb, 0.26);
      if (b === 6) kickAt(tb + beat / 2, 0.14);
      for (let h = 0; h < 2; h++) {
        const th = tb + h * beat / 2, N4 = Math.floor(RATE * 0.045), accent = (b % 2 === 0 && h === 0) ? 0.07 : 0.04;
        let hp = 0, prev = 0;
        for (let i = 0; i < N4; i++) { const x = rnd(); hp = 0.8 * (hp + x - prev); prev = x; add(Math.round((th + i / RATE) * RATE), hp * Math.exp(-i / RATE / 0.012) * accent); }
      }
    }
  });
  // винил: редкие тихие потрескивания
  for (let i = 0; i < 90; i++) { const at = Math.floor(Math.abs(rnd()) * n); const N5 = 40 + Math.floor(Math.abs(rnd()) * 120); for (let k = 0; k < N5; k++) add(at + k, rnd() * Math.exp(-k / 25) * 0.05); }
  // лёгкий lowpass для тепла и нормализация
  let y = 0; const a = 1 - Math.exp(-2 * Math.PI * 5200 / RATE);
  for (let i = 0; i < n; i++) { y += a * (s[i] - y); s[i] = y; }
  let peak = 0; for (let i = 0; i < n; i++) peak = Math.max(peak, Math.abs(s[i]));
  for (let i = 0; i < n; i++) s[i] = s[i] / peak * 0.8;
  save("music.wav", s);
}
