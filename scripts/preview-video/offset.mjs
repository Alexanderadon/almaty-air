// Сдвиг записи: кадр, где фон шапки стал светлым (клик по теме в TL.themeClick).
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
const W = fileURLToPath(new URL(".", import.meta.url));
const FFMPEG = "E:/projects/neon-tap/node_modules/ffmpeg-static/ffmpeg.exe";
const j = JSON.parse(fs.readFileSync(W + "timings.json", "utf8"));
const expect = j.TL.themeClick / 1000;
const from = expect - 1.2, span = 2.4, fps = 30;
const raw = execFileSync(FFMPEG, ["-loglevel", "error", "-ss", from.toFixed(3), "-t", String(span), "-i", W + "raw.mp4", "-vf", `fps=${fps},crop=1:1:1200:60,format=gray`, "-f", "rawvideo", "-"]);
const vals = [...raw];
const idx = vals.findIndex((v, i) => i > 0 && v > vals[0] + 25);
const flipAt = from + idx / fps;
const offsetMs = Math.round((flipAt - expect) * 1000);
console.log(JSON.stringify({ expect, flipAt: +flipAt.toFixed(3), offsetMs, first: vals[0], around: vals.slice(Math.max(0, idx - 2), idx + 4) }));
fs.writeFileSync(W + "timings.json", JSON.stringify({ ...j, offsetMs }, null, 1));
