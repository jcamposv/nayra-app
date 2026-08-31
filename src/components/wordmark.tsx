import { memo } from "react";
import { Image } from "expo-image";
import type { StyleProp, ImageStyle } from "react-native";

/** Proporción del logotipo original (701 × 245 en el SVG de la web). */
const RATIO = 701 / 245;

const SOURCES = {
  dark: require("../../assets/images/wordmark.png"),
  light: require("../../assets/images/wordmark-light.png"),
} as const;

type Props = {
  /** `dark` = verde de marca sobre fondo claro; `light` = crema sobre oscuro. */
  variant?: keyof typeof SOURCES;
  /** Ancho en puntos; el alto sale de la proporción del logotipo. */
  width?: number;
  style?: StyleProp<ImageStyle>;
};

export const Wordmark = memo(function Wordmark({
  variant = "dark",
  width = 128,
  style,
}: Props) {
  return (
    <Image
      source={SOURCES[variant]}
      contentFit="contain"
      accessibilityLabel="Nayra"
      style={[{ width, height: width / RATIO }, style]}
    />
  );
});
