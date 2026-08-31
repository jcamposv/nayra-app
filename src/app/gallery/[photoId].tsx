import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import { FlashList, type ViewToken } from "@shopify/flash-list";
import { Image } from "expo-image";
import { router, useLocalSearchParams } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTranslation } from "react-i18next";
import { Heart, X } from "lucide-react-native";

import { fetchPreview, type PhotoMeta } from "@/api/client";
import { useGallery } from "@/lib/gallery-context";
import { colors, fonts, fontSize, radius, spacing } from "@/lib/theme";

const VIEWABILITY = { itemVisiblePercentThreshold: 60 } as const;

export default function PhotoViewerScreen() {
  const { t } = useTranslation();
  const { photoId } = useLocalSearchParams<{ photoId: string }>();
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const { manifest, session, selected, toggle } = useGallery();

  const photos = manifest?.photos ?? [];
  const initialIndex = Math.max(
    0,
    photos.findIndex((photo) => photo.id === photoId),
  );
  const [index, setIndex] = useState(initialIndex);
  const [previews, setPreviews] = useState<Record<string, string>>({});
  // Ids ya pedidos. Sin esto, cada preview que llega vuelve a disparar el
  // efecto y las vecinas se piden dos y tres veces antes de resolver.
  const requested = useRef<Set<string>>(new Set());

  // Se piden los previews de la foto visible y sus vecinas: el volumen es
  // bajo, así que no hace falta ni lote ni ventana como en la grilla.
  useEffect(() => {
    const token = session?.token;
    if (!token) return;
    const wanted = [photos[index - 1], photos[index], photos[index + 1]].filter(
      (photo): photo is PhotoMeta => Boolean(photo),
    );
    let active = true;
    for (const photo of wanted) {
      if (requested.current.has(photo.id)) continue;
      requested.current.add(photo.id);
      fetchPreview(token, photo.id)
        .then((result) => {
          if (active) {
            setPreviews((prev) => ({ ...prev, [photo.id]: result.url }));
          }
        })
        .catch(() => {
          // Se libera para reintentar al volver a pasar por esta foto.
          requested.current.delete(photo.id);
        });
    }
    return () => {
      active = false;
    };
  }, [index, photos, session?.token]);

  const onViewableItemsChanged = useCallback(
    ({ viewableItems }: { viewableItems: ViewToken<PhotoMeta>[] }) => {
      const first = viewableItems[0]?.index;
      if (typeof first === "number") setIndex(first);
    },
    [],
  );

  const renderItem = useCallback(
    ({ item }: { item: PhotoMeta }) => (
      <View style={{ width, height }}>
        <Image
          source={
            previews[item.id]
              ? { uri: previews[item.id], cacheKey: `${item.id}-preview` }
              : null
          }
          // En memoria y no en disco: el preview de 1600px es el artefacto
          // más valioso que toca el dispositivo, y son pocas a la vez.
          cachePolicy="memory"
          recyclingKey={item.id}
          contentFit="contain"
          transition={160}
          style={styles.photo}
        />
        {!previews[item.id] ? (
          <ActivityIndicator style={styles.spinner} color={colors.canvas} />
        ) : null}
      </View>
    ),
    [previews, width, height],
  );

  const keyExtractor = useCallback((item: PhotoMeta) => item.id, []);

  const current = photos[index];
  const isSelected = current ? selected.has(current.id) : false;
  const locked = manifest?.gallery.selectionSubmittedAt != null;

  return (
    <View style={styles.root}>
      <StatusBar style="light" />

      {/* La foto va a sangre y los controles flotan encima: es el patrón de
          cualquier visor, y deja que la imagen ocupe todo lo que puede. */}
      <FlashList
        data={photos}
        renderItem={renderItem}
        keyExtractor={keyExtractor}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        initialScrollIndex={initialIndex}
        onViewableItemsChanged={onViewableItemsChanged}
        viewabilityConfig={VIEWABILITY}
      />

      <View
        style={[styles.top, { paddingTop: insets.top + spacing.xs }]}
        pointerEvents="box-none"
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t("gallery.close")}
          onPress={() => router.back()}
          hitSlop={10}
          style={({ pressed }) => [styles.round, pressed && styles.pressed]}
        >
          <X size={20} color={colors.canvas} strokeWidth={2} />
        </Pressable>

        <View style={styles.counterPill}>
          <Text style={styles.counter}>
            {t("gallery.counter", { current: index + 1, total: photos.length })}
          </Text>
        </View>
      </View>

      {current && !locked ? (
        <View
          style={[styles.bottom, { paddingBottom: insets.bottom + spacing.md }]}
          pointerEvents="box-none"
        >
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t(
              isSelected ? "gallery.unselect" : "gallery.select",
            )}
            accessibilityState={{ selected: isSelected }}
            onPress={() => void toggle(current.id)}
            style={({ pressed }) => [
              styles.heartButton,
              isSelected && styles.heartButtonSelected,
              pressed && styles.pressed,
            ]}
          >
            <Heart
              size={18}
              strokeWidth={2.25}
              color={colors.canvas}
              fill={isSelected ? colors.canvas : "transparent"}
            />
            <Text style={styles.heartLabel}>
              {t(isSelected ? "gallery.unselect" : "gallery.select")}
            </Text>
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.viewer },
  photo: { flex: 1 },
  spinner: { position: "absolute", top: "50%", alignSelf: "center" },
  pressed: { opacity: 0.7 },
  top: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.md,
  },
  // Fondo propio en los controles: sobre una foto clara, texto blanco solo
  // no llega al contraste mínimo.
  round: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.pill,
    backgroundColor: "rgba(20, 18, 16, 0.55)",
  },
  counterPill: {
    height: 30,
    justifyContent: "center",
    paddingHorizontal: spacing.md,
    borderRadius: radius.pill,
    backgroundColor: "rgba(20, 18, 16, 0.55)",
  },
  counter: {
    fontFamily: fonts.sans,
    color: colors.canvas,
    fontSize: fontSize.xs,
  },
  bottom: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    alignItems: "center",
  },
  heartButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    minHeight: 48,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.pill,
    backgroundColor: "rgba(20, 18, 16, 0.65)",
  },
  heartButtonSelected: { backgroundColor: colors.secondary },
  heartLabel: {
    fontFamily: fonts.sansSemibold,
    color: colors.canvas,
    fontSize: fontSize.sm,
  },
});
