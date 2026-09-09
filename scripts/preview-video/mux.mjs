// Монтаж превью «Воздух Алматы»: обрезка в один цикл + звук.
// node aa-mux.mjs [out.mp4] [--music track.mp3]  — без --music подложка = dombra.wav (синтез),
// с --music видео зацикливается под длину трека, трек тише эффектов.
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import { fileURLToPath } from "node:url";

const W = fileURLToPath(new URL(".", import.meta.url));
const FFMPEG = "E:/projects/neon-tap/node_modules/ffmpeg-static/ffmpeg.exe";
const args = process.argv.slice(2);
const mi = args.indexOf("--music");
const music = mi >= 0 ? args[mi + 1] : null;
const OUT = args.find((a, i) => !a.startsWith("--") && i !== mi + 1) || W + (music ? "almaty-air-preview-music.mp4" : "almaty-air-preview.mp4");
const { TL, offsetMs = 0 } = JSON.parse(fs.readFileSync(W + "timings.json", "utf8"));
const CYCLE = TL.loop / 1000;
const ss = Math.max(0, offsetMs), shift = offsetMs - ss;

const events = [
  ["swell.wav", 0, 0.8],
  ["swoosh_down.wav", TL.scrollDown + 150, 0.5],
  ["swoosh_up.wav", TL.scrollUp + 100, 0.42],
  ["click.wav", TL.themeClick, 1.0],
  ["whoosh.wav", TL.themeClick + 40, 0.7],
  ["click.wav", TL.themeBack, 1.0],
  ["whoosh.wav", TL.themeBack + 40, 0.7],
];
// Подложка не генерируется: без --music ролик идёт только с эффектами (клики, ветер, вжух, свелл).

const inputs = ["-y", "-ss", (ss / 1000).toFixed(3), "-t", CYCLE.toFixed(3), "-i", W + "raw.mp4"];
events.forEach(([f]) => inputs.push("-i", W + f));
const d = (t) => Math.max(0, Math.round(t + shift));
const chains = events.map(([, t, g], i) => `[${i + 1}:a]volume=${g},adelay=${d(t)}|${d(t)}[e${i}]`);
const mixIn = events.map((_, i) => `[e${i}]`).join("");
const cycleFilter = `${chains.join(";")};${mixIn}amix=inputs=${events.length}:normalize=0:duration=longest,apad=whole_dur=${CYCLE.toFixed(3)},atrim=0:${CYCLE.toFixed(3)}` + (music ? "[a]" : `,afade=t=out:st=${(CYCLE - 0.25).toFixed(3)}:d=0.25,alimiter=limit=0.95[a]`);
const target = music ? W + "cycle_fx.mp4" : OUT;
execFileSync(FFMPEG, [...inputs, "-filter_complex", cycleFilter, "-map", "0:v", "-map", "[a]",
  "-c:v", "libx264", "-pix_fmt", "yuv420p", "-preset", "slow", "-crf", "19", "-c:a", "aac", "-b:a", "192k", "-movflags", "+faststart", "-shortest", target], { stdio: ["ignore", "ignore", "inherit"] });

if (music) {
  let info = ""; try { execFileSync(FFMPEG, ["-i", music], { stdio: ["ignore", "pipe", "pipe"] }); } catch (e) { info = e.stderr.toString(); }
  const m = info.match(/Duration:\s*(\d+):(\d+):(\d+\.\d+)/); const D = m ? (+m[1]) * 3600 + (+m[2]) * 60 + (+m[3]) : 0;
  if (!D) { console.error("Не прочитать длину трека"); process.exit(1); }
  execFileSync(FFMPEG, ["-y", "-stream_loop", "-1", "-i", target, "-i", music,
    "-filter_complex", `[1:a]volume=0.55[m];[0:a][m]amix=inputs=2:normalize=0:duration=longest,afade=t=out:st=${(D - 1.5).toFixed(2)}:d=1.5,alimiter=limit=0.95[a]`,
    "-map", "0:v", "-map", "[a]", "-t", String(D), "-c:v", "libx264", "-pix_fmt", "yuv420p", "-preset", "veryfast", "-crf", "20", "-c:a", "aac", "-b:a", "192k", "-movflags", "+faststart", OUT], { stdio: ["ignore", "ignore", "inherit"] });
  console.log(OUT, (fs.statSync(OUT).size / 1048576).toFixed(1), "МБ, под трек", D.toFixed(0) + " с");
} else {
  console.log(OUT, (fs.statSync(OUT).size / 1048576).toFixed(2), "МБ; цикл", CYCLE, "с");
}
