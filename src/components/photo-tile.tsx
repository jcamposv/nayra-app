import { memo, useCallback, useMemo } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { Image } from "expo-image";
import { useTranslation } from "react-i18next";
import { Heart } from "lucide-react-native";

import { colors, radius } from "@/lib/theme";

type Props = {
  id: string;
  url: string | null;
  selected: boolean;
  /** Ancho de columna; el alto sale de la proporción real de la foto. */
  columnWidth: number;
  ratio: number;
  /** Separación entre tiles, aplicada como padding del propio ítem. */
  gap: number;
  /** Con la selección enviada ya no se puede cambiar: se oculta el corazón. */
  locked: boolean;
  onOpen: (id: string) => void;
  onToggle: (id: string) => void;
  onError: (id: string) => void;
};

/**
 * Ítem de la grilla. Memoizado y con callbacks que reciben el id en vez de
 * cerrar sobre él desde el padre: así una galería de 300 fotos no
 * re-renderiza entera cada vez que cambia una favorita.
 */
export const PhotoTile = memo(function PhotoTile({
  id,
  url,
  selected,
  columnWidth,
  ratio,
  gap,
  locked,
  onOpen,
  onToggle,
  onError,
}: Props) {
  const { t } = useTranslation();

  const open = useCallback(() => onOpen(id), [onOpen, id]);
  const toggle = useCallback(() => onToggle(id), [onToggle, id]);
  const error = useCallback(() => onError(id), [onError, id]);

  // La geometría vive en el elemento raíz: masonry mide lo que devuelve
  // renderItem, y un alto puesto en un hijo interior no le llega.
  const cell = useMemo(
    () => ({
      width: columnWidth + gap,
      height: Math.round(columnWidth / ratio) + gap,
      padding: gap / 2,
    }),
    [columnWidth, ratio, gap],
  );

  return (
    <View style={cell}>
      <Pressable
        accessibilityRole="imagebutton"
        accessibilityLabel={t("gallery.openPhoto")}
        onPress={open}
        // Solo opacidad: no mueve los límites del ítem ni dispara layout.
        style={({ pressed }) => [styles.press, pressed && styles.pressed]}
      >
        <Image
          // `cacheKey` fija la entrada de caché al id de la foto: la URL
          // firmada rota cada dos horas, pero los bytes ya descargados se
          // siguen reusando en vez de bajarse otra vez.
          source={url ? { uri: url, cacheKey: id } : null}
          // La caché de expo-image vive en el sandbox de la app: no es la
          // fototeca, no se ve en Fotos y se borra con la app.
          cachePolicy="memory-disk"
          // Sin esto el reciclado de FlashList enseña la foto anterior un
          // instante al hacer scroll rápido.
          recyclingKey={id}
          contentFit="cover"
          transition={140}
          onError={error}
          style={styles.image}
        />
      </Pressable>

      {locked ? null : (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t(selected ? "gallery.unselect" : "gallery.select")}
          accessibilityState={{ selected }}
          onPress={toggle}
          hitSlop={8}
          style={({ pressed }) => [
            styles.heart,
            selected && styles.heartSelected,
            pressed && styles.pressed,
          ]}
        >
          <Heart
            size={16}
            strokeWidth={2.25}
            color={selected ? colors.canvas : colors.foreground}
            fill={selected ? colors.canvas : "transparent"}
          />
        </Pressable>
      )}
    </View>
  );
});

const styles = StyleSheet.create({
  press: { flex: 1, borderRadius: radius.md, overflow: "hidden" },
  pressed: { opacity: 0.82 },
  image: { flex: 1, backgroundColor: colors.surfaceMuted },
  heart: {
    position: "absolute",
    right: 8,
    bottom: 8,
    // 32 visibles + hitSlop 8 = 48 de área táctil, por encima del mínimo.
    width: 32,
    height: 32,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.pill,
    backgroundColor: "rgba(255, 255, 255, 0.92)",
  },
  heartSelected: { backgroundColor: colors.secondary },
});
