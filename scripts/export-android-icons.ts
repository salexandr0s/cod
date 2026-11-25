#!/usr/bin/env node

// Android masks a 72dp safe area inside 108dp; full-bleed backgrounds and a separate wordmark avoid double silhouettes/cropping.

import * as NodeRuntime from "@effect/platform-node/NodeRuntime";
import * as NodeServices from "@effect/platform-node/NodeServices";
import * as Console from "effect/Console";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as Path from "effect/Path";
import * as Schema from "effect/Schema";
import sharp from "sharp";

type IconVariant = "dev" | "nightly" | "prod";

const ADAPTIVE_CANVAS = 432;
const SPLASH_CANVAS = 1152;
const TEXT = { x: 16, y: 25.5, width: 96, height: 75 };
const WORDMARK_FRACTION = 0.48;
const SVG_DENSITY = 300;
const OUTPUT_DIRECTORY = "apps/mobile/assets";
const BACKGROUNDS = { prod: "#10272B", dev: "#193E60", nightly: "#302744" } as const;

export class AndroidIconRenderError extends Schema.TaggedError<AndroidIconRenderError>()(
  "AndroidIconRenderError",
  { layer: Schema.String, cause: Schema.Defect() },
) {}

const wordmarkTransform = (size: number) => {
  const scale = (size * WORDMARK_FRACTION) / TEXT.width;
  const tx = (size - TEXT.width * scale) / 2 - TEXT.x * scale;
  const ty = (size - TEXT.height * scale) / 2 - TEXT.y * scale;
  return `translate(${tx.toFixed(3)} ${ty.toFixed(3)}) scale(${scale.toFixed(4)})`;
};

const canvasSvg = (size: number, inner: string) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" fill="none">${inner}</svg>`;

const rasterize = (layer: string, svg: string, width: number, height = width) =>
  Effect.tryPromise({
    try: () =>
      sharp(Buffer.from(svg), { density: SVG_DENSITY })
        .resize(width, height, { fit: "contain", background: "transparent" })
        .png()
        .toBuffer(),
    catch: (cause) => new AndroidIconRenderError({ layer, cause }),
  });

const composite = (
  layer: string,
  base: Buffer,
  overlays: ReadonlyArray<{ input: Buffer; left?: number; top?: number }>,
) =>
  Effect.tryPromise({
    try: () =>
      sharp(base)
        .composite([...overlays])
        .png()
        .toBuffer(),
    catch: (cause) => new AndroidIconRenderError({ layer, cause }),
  });

const solidCanvas = (layer: string, size: number, background: string) =>
  Effect.tryPromise({
    try: () =>
      sharp({ create: { width: size, height: size, channels: 4, background } })
        .png()
        .toBuffer(),
    catch: (cause) => new AndroidIconRenderError({ layer, cause }),
  });

const readLayerSource = Effect.fn("androidIcons.readLayerSource")(function* (
  repositoryRoot: string,
  variant: IconVariant,
  file: string,
) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  return yield* fs.readFileString(
    path.join(repositoryRoot, "assets", variant, "app-icon.icon", "Assets", file),
  );
});

const renderForeground = Effect.fn("androidIcons.renderForeground")(function* (
  repositoryRoot: string,
  size: number,
  monochrome = false,
) {
  const text = yield* readLayerSource(repositoryRoot, "prod", "text.svg");
  const artwork = monochrome ? text.replace(/fill="#[0-9a-f]+"/gi, 'fill="white"') : text;
  return yield* rasterize(
    "foreground",
    canvasSvg(size, `<g transform="${wordmarkTransform(size)}">${artwork}</g>`),
    size,
  );
});

const renderSplashIcon = Effect.fn("androidIcons.renderSplashIcon")(function* (
  repositoryRoot: string,
  variant: IconVariant,
) {
  const background = yield* solidCanvas(variant, SPLASH_CANVAS, BACKGROUNDS[variant]);
  const foreground = yield* renderForeground(repositoryRoot, SPLASH_CANVAS);
  return yield* composite(`${variant}-splash`, background, [{ input: foreground }]);
});

const exportAndroidIcons = Effect.gen(function* () {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const repositoryRoot = path.resolve(import.meta.dirname, "..");
  const mark = yield* renderForeground(repositoryRoot, ADAPTIVE_CANVAS);
  const fish = yield* fs.readFileString(
    path.join(repositoryRoot, "apps/mobile/assets/widget/Cod3Mark.svg"),
  );
  const notification = fish.replace("<path ", '<path fill="white" ');
  const outputs = [
    ["android-icon-foreground.png", mark],
    ["android-icon-mark.png", yield* renderForeground(repositoryRoot, ADAPTIVE_CANVAS, true)],
    ["android-notification-icon.png", yield* rasterize("notification", notification, 96)],
    [
      "android-icon-background-dev.png",
      yield* solidCanvas("dev", ADAPTIVE_CANVAS, BACKGROUNDS.dev),
    ],
    [
      "android-icon-background-nightly.png",
      yield* solidCanvas("nightly", ADAPTIVE_CANVAS, BACKGROUNDS.nightly),
    ],
    ["android-splash-icon-dev.png", yield* renderSplashIcon(repositoryRoot, "dev")],
    ["android-splash-icon-nightly.png", yield* renderSplashIcon(repositoryRoot, "nightly")],
    ["android-splash-icon-prod.png", yield* renderSplashIcon(repositoryRoot, "prod")],
  ] as const;
  for (const [name, contents] of outputs) {
    yield* fs.writeFile(path.join(repositoryRoot, OUTPUT_DIRECTORY, name), contents);
    yield* Console.log(`wrote ${OUTPUT_DIRECTORY}/${name}`);
  }
});

if (import.meta.main) {
  exportAndroidIcons.pipe(Effect.provide(NodeServices.layer), NodeRuntime.runMain);
}
