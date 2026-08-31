import { useCallback, useMemo, useState } from "react";
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
import { router } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { SafeAreaView } from "react-native-safe-area-context";
import { useTranslation } from "react-i18next";
import { ImageOff, Menu } from "lucide-react-native";

import type { PhotoMeta } from "@/api/client";
import { Button } from "@/components/button";
import { GalleryMenu } from "@/components/gallery-menu";
import { PhotoTile } from "@/components/photo-tile";
import { Wordmark } from "@/components/wordmark";
import { useGallery } from "@/lib/gallery-context";
import { useLayout } from "@/lib/layout";
import { colors, fonts, fontSize, radius, spacing } from "@/lib/theme";

const GAP = spacing.sm;

/** Cuántas fotos más allá de lo visible se piden por adelantado. */
const PREFETCH_MARGIN = 10;

/** Proporción de reserva cuando el servidor aún no sabe el tamaño real. */
const FALLBACK_RATIO = 3 / 4;

const VIEWABILITY = { itemVisiblePercentThreshold: 1 } as const;

type Filter = "all" | "favorites";

export default function GalleryGridScreen() {
  const { t } = useTranslation();
  const { width } = useWindowDimensions();
  const { columns, isTablet } = useLayout();
  const {
    manifest,
    loading,
    error,
    selected,
    urls,
    ensureUrls,
    markStale,
    toggle,
    leave,
  } = useGallery();
  const [notice, setNotice] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>("all");
  const [menuOpen, setMenuOpen] = useState(false);

  const columnWidth = (width - GAP * (columns + 1)) / columns;

  const all = manifest?.photos ?? [];
  const photos = useMemo(
    () => (filter === "favorites" ? all.filter((p) => selected.has(p.id)) : all),
    [all, filter, selected],
  );

  const onViewableItemsChanged = useCallback(
    ({ viewableItems }: { viewableItems: ViewToken<PhotoMeta>[] }) => {
      if (viewableItems.length === 0) return;
      const indexes = viewableItems
        .map((item) => item.index)
        .filter((i): i is number => i !== null);
      const from = Math.max(0, Math.min(...indexes) - PREFETCH_MARGIN);
      const to = Math.min(photos.length, Math.max(...indexes) + PREFETCH_MARGIN);
      ensureUrls(photos.slice(from, to).map((photo) => photo.id));
    },
    [ensureUrls, photos],
  );

  const onOpen = useCallback((id: string) => {
    router.push(`/gallery/${id}`);
  }, []);

  const submitted = manifest?.gallery.selectionSubmittedAt != null;

  const onToggle = useCallback(
    async (id: string) => {
      const result = await toggle(id);
      if (result === "limit_reached") {
        setNotice(
          t("gallery.limitReached", {
            limit: manifest?.gallery.selectionLimit ?? 0,
          }),
        );
        setTimeout(() => setNotice(null), 2600);
      }
    },
    [toggle, t, manifest?.gallery.selectionLimit],
  );

  const renderItem = useCallback(
    ({ item }: { item: PhotoMeta }) => {
      // Cada tile respeta la proporción real de su foto: eso es lo que hace
      // que la retícula sea masonry y no un mosaico de recortes cuadrados.
      const ratio = item.w && item.h ? item.w / item.h : FALLBACK_RATIO;
      return (
        <PhotoTile
          id={item.id}
          url={urls[item.id]?.url ?? null}
          selected={selected.has(item.id)}
          columnWidth={columnWidth}
          ratio={ratio}
          gap={GAP}
          locked={submitted}
          onOpen={onOpen}
          onToggle={onToggle}
          onError={markStale}
        />
      );
    },
    [urls, selected, columnWidth, submitted, onOpen, onToggle, markStale],
  );

  const keyExtractor = useCallback((item: PhotoMeta) => item.id, []);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  if (error || !manifest) {
    return (
      <SafeAreaView style={styles.center}>
        <ImageOff size={28} color={colors.subtle} strokeWidth={1.5} />
        <Text style={styles.errorTitle}>{t("gallery.notFoundTitle")}</Text>
        <Text style={styles.errorBody}>{t(error ?? "gallery.notFound")}</Text>
      </SafeAreaView>
    );
  }

  const { gallery, studio } = manifest;
  const count = selected.size;
  const limit = gallery.selectionLimit;
  const counter =
    limit === null
      ? t("gallery.counterUnlimited", { count })
      : t("gallery.counterIncluded", { count, limit });

  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
      <StatusBar style="dark" />

      <View style={styles.appBar}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t("menu.open")}
          onPress={() => setMenuOpen(true)}
          hitSlop={8}
          style={({ pressed }) => [styles.iconButton, pressed && styles.pressed]}
        >
          <Menu size={22} color={colors.foreground} strokeWidth={1.75} />
        </Pressable>

        {/* Con `custom_branding` manda la marca del estudio; sin ella, la de
            Nayra — misma regla que la galería web. */}
        <View style={styles.appBarCenter}>
          {studio.branded && studio.logoUrl ? (
            <Image
              source={{ uri: studio.logoUrl }}
              contentFit="contain"
              accessibilityLabel={studio.name}
              style={styles.studioLogo}
            />
          ) : (
            <Wordmark width={92} />
          )}
        </View>

        <View style={styles.iconButton} />
      </View>

      <View style={[styles.titleBlock, isTablet && styles.titleBlockTablet]}>
        <Text style={styles.title} numberOfLines={2}>
          {gallery.title}
        </Text>
        <Text style={styles.subtitle} numberOfLines={1}>
          {submitted
            ? t("gallery.submitted")
            : t("gallery.by", { studio: studio.name })}
        </Text>
      </View>

      {count > 0 ? (
        <View
          style={styles.filters}
          accessibilityRole="tablist"
        >
          {(["all", "favorites"] as const).map((key) => {
            const active = filter === key;
            return (
              <Pressable
                key={key}
                accessibilityRole="tab"
                accessibilityState={{ selected: active }}
                onPress={() => setFilter(key)}
                style={[styles.chip, active && styles.chipActive]}
              >
                <Text style={[styles.chipText, active && styles.chipTextActive]}>
                  {key === "all"
                    ? t("filter.all")
                    : `${t("filter.favorites")} ${count}`}
                </Text>
              </Pressable>
            );
          })}
        </View>
      ) : null}

      <FlashList
        data={photos}
        renderItem={renderItem}
        keyExtractor={keyExtractor}
        numColumns={columns}
        masonry
        onViewableItemsChanged={onViewableItemsChanged}
        viewabilityConfig={VIEWABILITY}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <Text style={styles.empty}>{t("gallery.empty")}</Text>
        }
        ListFooterComponent={
          studio.branded ? null : (
            <View style={styles.madeWith}>
              <Text style={styles.madeWithText}>{t("gallery.madeWith")}</Text>
              <Wordmark width={64} />
            </View>
          )
        }
      />

      {notice ? (
        <View style={styles.notice} accessibilityRole="alert">
          <Text style={styles.noticeText}>{notice}</Text>
        </View>
      ) : null}

      <View style={styles.bar}>
        <Text style={styles.counter} numberOfLines={1}>
          {submitted ? t("gallery.submittedHint") : counter}
        </Text>
        <Button
          label={submitted ? t("download.toggle") : t("gallery.submit")}
          onPress={() =>
            router.push(submitted ? "/gallery/download" : "/gallery/submit")
          }
          disabled={!submitted && count === 0}
          style={styles.cta}
        />
      </View>

      <GalleryMenu
        visible={menuOpen}
        onClose={() => setMenuOpen(false)}
        onDownload={() => {
          setMenuOpen(false);
          router.push("/gallery/download");
        }}
        onSwitch={() => {
          setMenuOpen(false);
          router.push("/galleries");
        }}
        onExit={() => {
          setMenuOpen(false);
          void leave();
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.canvas },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.canvas,
    paddingHorizontal: spacing.lg,
    gap: spacing.sm,
  },
  pressed: { opacity: 0.6 },
  appBar: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: spacing.sm,
  },
  appBarCenter: { flex: 1, alignItems: "center" },
  iconButton: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  studioLogo: { width: 104, height: 26 },
  titleBlockTablet: { paddingHorizontal: spacing.xl },
  titleBlock: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    paddingBottom: spacing.md,
    gap: 2,
  },
  title: {
    fontFamily: fonts.serifSemibold,
    fontSize: fontSize.xl,
    lineHeight: 34,
    color: colors.foreground,
  },
  subtitle: {
    fontFamily: fonts.sans,
    fontSize: fontSize.xs,
    color: colors.subtle,
    letterSpacing: 0.6,
    textTransform: "uppercase",
  },
  filters: {
    flexDirection: "row",
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.md,
  },
  chip: {
    minHeight: 36,
    justifyContent: "center",
    paddingHorizontal: spacing.md,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceMuted,
  },
  chipActive: { backgroundColor: colors.primary },
  chipText: {
    fontFamily: fonts.sansSemibold,
    fontSize: fontSize.sm,
    color: colors.muted,
  },
  chipTextActive: { color: colors.onPrimary },
  // Reserva para la barra fija de abajo: sin esto la última fila queda
  // debajo del contador y del botón.
  list: { paddingHorizontal: GAP / 2, paddingBottom: spacing.xl * 2 },
  empty: {
    fontFamily: fonts.sans,
    color: colors.subtle,
    textAlign: "center",
    marginTop: spacing.xl,
    fontSize: fontSize.sm,
  },
  errorTitle: {
    fontFamily: fonts.serifSemibold,
    color: colors.foreground,
    fontSize: fontSize.lg,
  },
  errorBody: {
    fontFamily: fonts.sans,
    color: colors.muted,
    fontSize: fontSize.sm,
    textAlign: "center",
    lineHeight: 20,
  },
  madeWith: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    paddingVertical: spacing.lg,
    opacity: 0.5,
  },
  madeWithText: {
    fontFamily: fonts.sans,
    fontSize: fontSize.xs,
    color: colors.subtle,
  },
  notice: {
    position: "absolute",
    left: spacing.md,
    right: spacing.md,
    bottom: 104,
    backgroundColor: colors.secondary,
    borderRadius: radius.md,
    padding: spacing.md,
  },
  noticeText: {
    fontFamily: fonts.sans,
    color: colors.canvas,
    fontSize: fontSize.sm,
  },
  bar: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.borderSubtle,
    backgroundColor: colors.canvas,
  },
  counter: {
    flex: 1,
    fontFamily: fonts.sans,
    color: colors.muted,
    fontSize: fontSize.sm,
  },
  cta: { minWidth: 156 },
});
