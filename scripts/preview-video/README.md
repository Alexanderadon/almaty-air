# Промо-видео главной (docs/video/preview.mp4)

Живой прод в headless Chrome, один бесшовный цикл 41,8 с, 1280×800, звук синтезирован.

```
cd scripts/preview-video
npm i puppeteer-core puppeteer-screen-recorder      # один раз; ffmpeg — путь FFMPEG в скриптах
node gensound.mjs 41800                              # звуковые эффекты (клик, ветер, вжух, свелл)
node record.mjs [https://almaty-air-two.vercel.app/] # raw.mp4 + timings.json (герой 12 с → тур вниз 14 с → пауза → назад 6 с → курсор, тема день/ночь)
node offset.mjs                                      # сдвиг записи по кадру смены темы → timings.json
node mux.mjs ../../docs/video/preview.mp4            # обрезка в цикл + эффекты (без музыки)
node mux.mjs out.mp4 --music track.mp3 --cut --music-only  # только музыка, один цикл 42 с, затухание 1,5 с — текущий preview.mp4
node mux.mjs out.mp4 --music track.mp3 --cut         # музыка + эффекты внутри одного цикла
node mux.mjs out.mp4 --music track.mp3               # видео зациклено под всю длину трека — полная версия
```

Гочи: рекордер теряет первые десятки–сотни мс — сдвиг всегда измерять (`offset.mjs`);
`--no-proxy-server` только для localhost (на проде с ним Chrome не выходит в сеть);
прохожему на старте ставится `animation-delay: -19s`, чтобы он был в кадре с первых секунд.
