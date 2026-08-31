/**
 * Paleta de Nayra, espejo de `src/app/globals.css` en la app web, con una
 * base blanca: en una app cuyo contenido son fotos, el lienzo tiene que
 * desaparecer. El crema de marca queda como acento, no como fondo.
 */
export const colors = {
  /** Lienzo principal. */
  canvas: "#FFFFFF",
  surface: "#FFFFFF",
  /** Campos, chips y estados en reposo. */
  surfaceMuted: "#F6F3EF",
  /** Crema de marca; se usa en zonas de acento, no de fondo. */
  cream: "#F4EEE4",
  border: "#E8DDCE",
  borderSubtle: "#EDE8E1",
  foreground: "#211D18",
  muted: "#6B5E52",
  /** Texto terciario: cumple 4.5:1 sobre blanco. */
  subtle: "#8A7D71",
  primary: "#0F3D33",
  primaryHover: "#185347",
  secondary: "#A9472F",
  destructive: "#A63D32",
  /** Fondo del visor a pantalla completa: ahí la foto manda de verdad. */
  viewer: "#141210",
  onPrimary: "#F4EEE4",
  scrim: "rgba(33, 29, 24, 0.5)",
} as const;

export const radius = { sm: 8, md: 12, lg: 20, xl: 28, pill: 999 } as const;

export const spacing = { xs: 4, sm: 8, md: 16, lg: 24, xl: 32 } as const;

/**
 * Tipografías de marca, iguales que en la web: Manrope para interfaz y
 * Newsreader para los títulos. Van embebidas por el config plugin de
 * expo-font, así que existen desde el primer frame — no hay `useFonts` ni
 * parpadeo de texto sin estilar.
 *
 * Los nombres son los PostScript de cada TTF, y los archivos en
 * `assets/fonts/` se llaman igual a propósito: iOS resuelve la familia por
 * el nombre PostScript y Android por el del archivo, así que hacerlos
 * coincidir es lo único que evita que una de las dos plataformas caiga al
 * tipo del sistema sin avisar.
 */
export const fonts = {
  sans: "Manrope-Regular",
  sansSemibold: "Manrope-SemiBold",
  sansBold: "Manrope-Bold",
  serif: "Newsreader-Regular",
  serifSemibold: "Newsreader-SemiBold",
} as const;

export const fontSize = {
  xs: 12,
  sm: 14,
  md: 16,
  lg: 20,
  xl: 28,
} as const;
