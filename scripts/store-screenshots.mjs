/**
 * Compone las capturas de las tiendas a partir de capturas crudas del
 * simulador.
 *
 *   xcrun simctl io booted screenshot store/raw/01-acceso.png
 *   node scripts/store-screenshots.mjs
 *
 * Las crudas se toman en un iPhone 17 Pro Max (1320x2868), que es justo el
 * tamaño de 6.9" que pide App Store — así no se reescalan. Google Play no
 * acepta más de 2:1 y esa proporción es 2.17, así que sus imágenes se
 * componen sobre un lienzo 1080x1920.
 *
 * Requiere sharp:  pnpm add -D sharp
 */
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const RAW = path.join(ROOT, "store/raw");
const RAW_IPAD = path.join(ROOT, "store/raw-ipad");

const COLORS = {
  cream: "#F4EEE4",
  green: "#0F3D33",
  ink: "#211D18",
  muted: "#6B5E52",
};

/** Cada captura con su titular. El orden es el de la ficha. */
const SHOTS = [
  { file: "01-acceso.png", title: "Tus fotos,\nen un solo toque", body: "Abre tu galería con el código que te dio tu fotógrafo.", theme: "light" },
  { file: "02-galeria.png", title: "Elige tus\nfavoritas", body: "Marca las que quieres y envíaselas a tu fotógrafo.", theme: "light" },
  { file: "03-visor.png", title: "Capturas\nbloqueadas", body: "Las fotos no se pueden capturar mientras las miras.", theme: "dark" },
  { file: "04-descarga.png", title: "Descarga\ntus fotos", body: "Cuando tu fotógrafo las libere, en alta y sin marca.", theme: "light" },
];

const TARGETS = [
  { name: "app-store", width: 1320, height: 2868, shot: 1000, pad: 150, caption: 430 },
  { name: "play", width: 1080, height: 1920, shot: 690, pad: 100, caption: 320 },
  // iPad 13 pulgadas: la captura del simulador ya sale a 2064x2752, el
  // tamaño exacto que pide Apple. El aparato se compone algo mas chico
  // porque su proporcion es mas cuadrada y si no, no cabe el titular.
  {
    name: "app-store-ipad",
    width: 2064,
    height: 2752,
    // El iPad es más cuadrado que un teléfono, así que cabe más ancho sin
    // desbordar el alto: con 1420 sobraba un cuarto de lienzo vacío.
    shot: 1660,
    pad: 110,
    caption: 380,
    raw: RAW_IPAD,
  },
];

/**
 * Fontconfig apuntando a las fuentes del repo. librsvg resuelve por familia
 * y no mira una carpeta suelta; es la misma técnica que usa el watermark del
 * servidor.
 */
async function ensureFonts() {
  const dir = "/tmp/nayra-fontconfig";
  await mkdir(dir, { recursive: true });
  const file = path.join(dir, "fonts.conf");
  await writeFile(
    file,
    `<?xml version="1.0"?>
<!DOCTYPE fontconfig SYSTEM "fonts.dtd">
<fontconfig>
  <dir>${path.join(ROOT, "assets/fonts")}</dir>
  <dir>/System/Library/Fonts</dir>
  <dir>/Library/Fonts</dir>
  <cachedir>/tmp/nayra-fontconfig-cache</cachedir>
</fontconfig>`,
  );
  // FONTCONFIG_FILE y no FONTCONFIG_PATH: el segundo solo indica dónde
  // buscar un fonts.conf y algunas builds de librsvg lo ignoran a favor del
  // que traen compilado. Este apunta al fichero y no admite dudas.
  process.env.FONTCONFIG_FILE = file;
  process.env.FONTCONFIG_PATH = dir;
}

const escape = (s) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

function captionSvg({ width, height, title, body, theme, titleSize, bodySize }) {
  const fg = theme === "dark" ? COLORS.cream : COLORS.ink;
  const sub = theme === "dark" ? "#B9AC9F" : COLORS.muted;
  const lines = title.split("\n");
  // La `y` de un <text> es la LÍNEA BASE, así que la parte alta de las letras
  // queda por encima. Sin este mínimo, con titulares grandes el primer
  // renglón se salía del lienzo por arriba.
  const ascender = titleSize * 0.86;
  const centred = height / 2 - ((lines.length - 1) * titleSize * 1.12) / 2 - bodySize;
  const top = Math.max(ascender, centred);
  return Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
  ${lines
    .map(
      (line, i) =>
        // Manrope Bold y no Newsreader: librsvg en macOS no resuelve las
        // fuentes del repo por fontconfig (Manrope funciona solo porque
        // además está instalada en el sistema). En una ficha de tienda un
        // titular en sans pesada se lee mejor de todas formas, y sigue
        // siendo tipografía de marca. La familia va en cada <text>: heredada
        // desde un <g>, librsvg la ignora.
        `<text x="${width / 2}" y="${top + i * titleSize * 1.12}" text-anchor="middle" font-family="Manrope" font-weight="700" font-size="${titleSize}" fill="${fg}">${escape(line)}</text>`,
    )
    .join("\n  ")}
  <text x="${width / 2}" y="${top + lines.length * titleSize * 1.12 + bodySize * 0.6}"
        text-anchor="middle" font-family="Manrope" font-size="${bodySize}" fill="${sub}">${escape(body)}</text>
</svg>`);
}

/** Esquinas redondeadas sobre la captura, como se ve en un teléfono real. */
async function rounded(buffer, width, radius) {
  const resized = await sharp(buffer).resize({ width }).png().toBuffer();
  const { height } = await sharp(resized).metadata();
  const mask = Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"><rect width="${width}" height="${height}" rx="${radius}" ry="${radius}" fill="#fff"/></svg>`,
  );
  return {
    buffer: await sharp(resized)
      .composite([{ input: mask, blend: "dest-in" }])
      .png()
      .toBuffer(),
    height,
  };
}

async function main() {
  let made = 0;

  for (const target of TARGETS) {
    await mkdir(path.join(ROOT, "store", target.name), { recursive: true });

    for (const [index, shot] of SHOTS.entries()) {
      const source = path.join(target.raw ?? RAW, shot.file);
      if (!existsSync(source)) {
        console.log(`  falta ${shot.file} — se omite`);
        continue;
      }

      const scale = target.width / 1320;
      const titleSize = Math.round(78 * scale);
      const bodySize = Math.round(34 * scale);

      const { buffer: device, height: deviceHeight } = await rounded(
        await readFile(source),
        target.shot,
        Math.round(58 * scale),
      );

      const background = shot.theme === "dark" ? COLORS.green : COLORS.cream;
      const out = path.join(
        ROOT,
        "store",
        target.name,
        `${String(index + 1).padStart(2, "0")}.png`,
      );

      await sharp({
        create: {
          width: target.width,
          height: target.height,
          channels: 4,
          background,
        },
      })
        .composite([
          {
            input: captionSvg({
              width: target.width,
              height: target.caption,
              title: shot.title,
              body: shot.body,
              theme: shot.theme,
              titleSize,
              bodySize,
            }),
            top: target.pad,
            left: 0,
          },
          {
            input: device,
            top: target.pad + target.caption,
            left: Math.round((target.width - target.shot) / 2),
          },
        ])
        .png()
        .toFile(out);

      const fits = target.pad + target.caption + deviceHeight <= target.height;
      console.log(
        `  ${target.name}/${path.basename(out)}  ${fits ? "ok" : "SE SALE del lienzo"}`,
      );
      made += 1;
    }
  }
  await brandAssets();
  console.log(made > 0 ? `\n${made} capturas en store/` : "\nsin capturas crudas todavía");
}

/**
 * Piezas de marca que piden las fichas y no salen de una captura: el icono
 * de 512 de Play y su gráfico destacado de 1024x500.
 */
async function brandAssets() {
  const icon = path.join(ROOT, "assets/images/icon.png");
  const out = path.join(ROOT, "store/play");
  await mkdir(out, { recursive: true });

  await sharp(icon).resize(512, 512).png().toFile(path.join(out, "icon-512.png"));

  const mark = await sharp(path.join(ROOT, "assets/images/wordmark-light.png"))
    .resize({ width: 420 })
    .png()
    .toBuffer();
  const { height: markHeight } = await sharp(mark).metadata();
  const claim = Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="60">
      <text x="512" y="42" text-anchor="middle" font-family="Manrope" font-size="30" fill="#B9AC9F">Galerías protegidas para clientes de fotógrafos</text>
    </svg>`,
  );

  await sharp({
    create: { width: 1024, height: 500, channels: 4, background: COLORS.green },
  })
    .composite([
      { input: mark, top: Math.round(190 - markHeight / 2), left: 302 },
      { input: claim, top: 300, left: 0 },
    ])
    .png()
    .toFile(path.join(out, "feature-graphic-1024x500.png"));

  console.log("  play/icon-512.png  ok");
  console.log("  play/feature-graphic-1024x500.png  ok");
}

// libvips inicializa fontconfig al importarse, así que la configuración
// tiene que existir ANTES: con un `import` estático de sharp arriba, las
// fuentes del repo llegaban tarde y el texto caía a la del sistema.
await ensureFonts();
const sharp = (await import("sharp")).default;

void main().catch((error) => {
  console.error(error);
  process.exit(1);
});
