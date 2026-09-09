// Запись живого сайта «Воздух Алматы» (прод) в один цикл: долгий герой с горами и
// прохожим → плавный тур вниз → пауза → назад → курсор, клик по теме (день) → назад в ночь.
// Выход: raw.mp4 + timings.json (TL событий от старта записи).
import puppeteer from "puppeteer-core";
import { PuppeteerScreenRecorder } from "puppeteer-screen-recorder";
import fs from "node:fs";
import { fileURLToPath } from "node:url";

const W = fileURLToPath(new URL(".", import.meta.url));
const CHROME = "C:/Program Files (x86)/Google/Chrome/Application/chrome.exe";
const FFMPEG = "E:/projects/neon-tap/node_modules/ffmpeg-static/ffmpeg.exe";
const BASE = process.argv[2] || "https://almaty-air-two.vercel.app/";
const WIDTH = 1280, HEIGHT = 800;

const TL = {
  heroHold: 12000,
  scrollDown: 12000, scrollDownDur: 14000,
  scrollUp: 27800, scrollUpDur: 6000,
  cursorTo: 34200, themeClick: 35100,
  themeBack: 39600, cursorHide: 40300,
  loop: 41800,
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const b = await puppeteer.launch({
  executablePath: CHROME, headless: true,
  args: ["--no-sandbox", "--hide-scrollbars", "--force-color-profile=srgb", "--disable-features=CalculateNativeWinOcclusion"],
});
const p = await b.newPage();
await p.setViewport({ width: WIDTH, height: HEIGHT, deviceScaleFactor: 1 });
await p.emulateMediaFeatures([{ name: "prefers-color-scheme", value: "dark" }]);
await p.goto(BASE, { waitUntil: "networkidle2", timeout: 120000 });
// тайлы карты — до старта записи, чтобы в туре не было серой сетки
await p.waitForFunction(() => { const t = [...document.querySelectorAll("img.leaflet-tile")]; return t.length > 0 && t.every((i) => i.classList.contains("leaflet-tile-loaded")); }, { timeout: 25000 }).catch(() => {});
await p.evaluate(() => {
  window.scrollTo(0, 0);
  // прохожий: сдвигаем его цикл, чтобы он уже шёл по склону в первые секунды
  const person = document.querySelector('[data-walker="person"]');
  if (person) person.style.animationDelay = "-19s";
  // синтетический курсор
  const c = document.createElement("div");
  c.id = "vcursor";
  c.innerHTML = '<svg viewBox="0 0 24 24" width="22" height="22"><path d="M5 3l14 8-6 1.6L9.6 19 5 3z" fill="#fff" stroke="#111" stroke-width="1.4" stroke-linejoin="round"/></svg>';
  Object.assign(c.style, { position: "fixed", left: "0", top: "0", zIndex: "9999", pointerEvents: "none", opacity: "0", transform: "translate(640px,520px)", transition: "transform .9s cubic-bezier(.5,.05,.2,1), opacity .3s", filter: "drop-shadow(0 2px 3px rgba(0,0,0,.4))" });
  document.body.appendChild(c);
  window.__smoothScroll = (to, dur) => new Promise((res) => {
    const from = window.scrollY; let t0 = null;
    const step = (t) => { if (!t0) t0 = t; const k = Math.min(1, (t - t0) / dur); const e = k < .5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2; window.scrollTo(0, from + (to - from) * e); if (k < 1) requestAnimationFrame(step); else res(); };
    requestAnimationFrame(step);
  });
  window.__cursorTo = (sel) => { const el = document.querySelector(sel); const r = el.getBoundingClientRect(); const c = document.getElementById("vcursor"); c.style.opacity = "1"; c.style.transform = `translate(${r.left + r.width / 2 - 3}px,${r.top + r.height / 2 - 2}px)`; };
  window.__cursorHide = () => { document.getElementById("vcursor").style.opacity = "0"; };
});
await sleep(600);

const rec = new PuppeteerScreenRecorder(p, { fps: 30, ffmpeg_Path: FFMPEG, videoFrame: { width: WIDTH, height: HEIGHT } });
await rec.start(W + "raw.mp4");
const t0 = Date.now();
const until = async (ms) => { const d = ms - (Date.now() - t0); if (d > 0) await sleep(d); };

await until(TL.scrollDown);
await p.evaluate((dur) => window.__smoothScroll(document.documentElement.scrollHeight - window.innerHeight, dur), TL.scrollDownDur);
await until(TL.scrollUp);
await p.evaluate((dur) => window.__smoothScroll(0, dur), TL.scrollUpDur);
await until(TL.cursorTo);
await p.evaluate(() => window.__cursorTo('header button[aria-label^="Тема"]'));
await until(TL.themeClick);
await p.evaluate(() => { const b = document.querySelector('header button[aria-label^="Тема"]'); b.click(); if (document.documentElement.getAttribute('data-theme') !== 'light') b.click(); });
await until(TL.themeBack);
await p.evaluate(() => { const b = document.querySelector('header button[aria-label^="Тема"]'); b.click(); if (document.documentElement.getAttribute('data-theme') !== 'dark') b.click(); });
await until(TL.cursorHide);
await p.evaluate(() => window.__cursorHide());
await until(TL.loop + 400);
await rec.stop();
await b.close();
fs.writeFileSync(W + "timings.json", JSON.stringify({ TL }, null, 1));
console.log("raw.mp4 готово; цикл " + TL.loop + " мс");
