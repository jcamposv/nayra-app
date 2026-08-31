import { useWindowDimensions } from "react-native";

/**
 * Adaptación a tablet. La app es de contenido, no de paneles: en un iPad no
 * hace falta una barra lateral, hace falta que el texto no cruce 2000px y
 * que la retícula aproveche el ancho.
 */

/** Un formulario más ancho que esto se vuelve incómodo de leer y de tocar. */
const CONTENT_MAX = 560;

/** A partir de aquí se considera tablet. */
const TABLET_MIN = 700;

export function useLayout() {
  const { width } = useWindowDimensions();
  return {
    isTablet: width >= TABLET_MIN,
    /** Ancho útil del contenido, centrado en pantallas grandes. */
    contentWidth: Math.min(width, CONTENT_MAX),
    /** Columnas de la retícula: más ancho, más fotos por fila. */
    columns: width >= 1100 ? 4 : width >= TABLET_MIN ? 3 : 2,
  };
}
