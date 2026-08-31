import { useCallback, useEffect, useState } from "react";
import {
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Image } from "expo-image";
import { router } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { useTranslation } from "react-i18next";
import { Download, KeyRound, ShieldCheck, X } from "lucide-react-native";

import {
  ApiError,
  fetchCover,
  redeemDownloadCode,
  refreshDownloads,
  type DownloadItem,
} from "@/api/client";
import { Button } from "@/components/button";
import { useGallery } from "@/lib/gallery-context";
import { useLayout } from "@/lib/layout";
import { colors, fonts, fontSize, radius, spacing } from "@/lib/theme";

const ERRORS: Record<string, string> = {
  invalid_code: "download.errors.invalid",
  code_expired: "download.errors.expired",
  code_exhausted: "download.errors.exhausted",
  code_revoked: "download.errors.revokedError",
  needs_selection: "download.errors.needsSelection",
  no_photos: "download.errors.noPhotos",
  too_many_attempts: "download.errors.tooManyAttempts",
  offline: "errors.offline",
};

export default function DownloadScreen() {
  const { t } = useTranslation();
  const { session, manifest } = useGallery();
  const { contentWidth, isTablet } = useLayout();
  const [code, setCode] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [items, setItems] = useState<DownloadItem[] | null>(null);
  const [zipUrl, setZipUrl] = useState<string | null>(null);
  const [grant, setGrant] = useState<string | null>(null);
  const [cover, setCover] = useState<string | null>(null);

  // La portada de la propia galería: es contenido, no adorno — le dice al
  // cliente de qué sesión son las fotos que está a punto de descargar.
  useEffect(() => {
    const token = session?.token;
    if (!token || !manifest?.gallery.hasCover) return;
    let active = true;
    fetchCover(token)
      .then((result) => {
        if (active) setCover(result.url);
      })
      .catch(() => {
        // Sin portada la pantalla funciona igual.
      });
    return () => {
      active = false;
    };
  }, [session?.token, manifest?.gallery.hasCover]);

  const onRedeem = useCallback(async () => {
    if (!session) return;
    setPending(true);
    setError(null);
    try {
      const result = await redeemDownloadCode(session.token, code);
      setItems(result.items);
      setZipUrl(result.zipUrl);
      setGrant(result.grant ?? null);
    } catch (cause) {
      const key = cause instanceof ApiError ? ERRORS[cause.code] : undefined;
      setError(t(key ?? "errors.generic"));
    } finally {
      setPending(false);
    }
  }, [session, code, t]);

  /**
   * Las URLs firmadas viven 15 minutos. Si ya caducaron se piden otras con el
   * grant, que NO gasta un uso del código — a diferencia de la web, donde el
   * cliente tiene que volver a canjear solo por haber tardado.
   */
  const open = useCallback(
    async (url: string) => {
      try {
        await Linking.openURL(url);
      } catch {
        if (!session || !grant) return;
        try {
          const fresh = await refreshDownloads(session.token, grant);
          setItems(fresh.items);
          setZipUrl(fresh.zipUrl);
        } catch {
          setError(t("errors.generic"));
        }
      }
    },
    [session, grant, t],
  );

  const ready = items !== null;

  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
      <View
        style={[
          styles.bar,
          { maxWidth: contentWidth },
          isTablet && styles.centered,
        ]}
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t("download.close")}
          onPress={() => router.back()}
          hitSlop={8}
          style={({ pressed }) => [styles.iconButton, pressed && styles.pressed]}
        >
          <X size={22} color={colors.foreground} strokeWidth={1.75} />
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={[
          styles.content,
          { maxWidth: contentWidth },
          // En tablet el contenido se centra en el hueco: sin esto queda
          // colgando arriba con media pantalla en blanco debajo.
          isTablet && styles.centeredFill,
        ]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.hero}>
          {cover ? (
            <Image
              source={{ uri: cover, cacheKey: "gallery-cover" }}
              contentFit="cover"
              transition={220}
              accessibilityElementsHidden
              importantForAccessibility="no"
              style={styles.heroImage}
            />
          ) : (
            <View style={styles.heroFallback}>
              <Download size={28} color={colors.primary} strokeWidth={1.5} />
            </View>
          )}
        </View>

        <Text style={styles.title}>
          {ready ? t("download.ready") : t("download.title")}
        </Text>
        <Text style={styles.hint}>
          {ready ? t("download.readyHint") : t("download.hint")}
        </Text>

        {ready ? (
          <>
            {zipUrl ? (
              <Button
                label={t("download.zipAll", { count: items.length })}
                onPress={() => void open(zipUrl)}
              />
            ) : null}

            <View style={styles.list}>
              {items.map((item, i) => (
                <Pressable
                  key={item.name}
                  accessibilityRole="button"
                  accessibilityLabel={t("download.photo", { number: i + 1 })}
                  onPress={() => void open(item.url)}
                  style={({ pressed }) => [
                    styles.item,
                    pressed && styles.itemPressed,
                  ]}
                >
                  <Text style={styles.itemLabel}>
                    {t("download.photo", { number: i + 1 })}
                  </Text>
                  <Download size={18} color={colors.primary} strokeWidth={1.75} />
                </Pressable>
              ))}
            </View>

            <View style={styles.note}>
              <ShieldCheck size={18} color={colors.primary} strokeWidth={1.75} />
              <Text style={styles.noteText}>{t("protection.downloadHint")}</Text>
            </View>
          </>
        ) : (
          <>
            <View style={styles.field}>
              <Text style={styles.label}>{t("download.label")}</Text>
              <View
                style={[styles.inputWrap, error ? styles.inputWrapError : null]}
              >
                <KeyRound
                  size={20}
                  color={error ? colors.destructive : colors.subtle}
                  strokeWidth={1.75}
                />
                <TextInput
                  value={code}
                  onChangeText={(value) => {
                    setCode(value.toUpperCase());
                    setError(null);
                  }}
                  placeholder={t("download.placeholder")}
                  placeholderTextColor={colors.subtle}
                  autoCapitalize="characters"
                  autoCorrect={false}
                  maxLength={20}
                  style={styles.input}
                  accessibilityLabel={t("download.label")}
                />
              </View>
              {error ? (
                <Text style={styles.error} accessibilityRole="alert">
                  {error}
                </Text>
              ) : null}
            </View>

            <Button
              label={pending ? t("download.redeeming") : t("download.redeem")}
              onPress={() => void onRedeem()}
              loading={pending}
              disabled={code.trim().length === 0}
            />
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.canvas },
  pressed: { opacity: 0.6 },
  bar: { paddingHorizontal: spacing.sm, width: "100%" },
  iconButton: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  content: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xl,
    gap: spacing.md,
    width: "100%",
  },
  centered: { alignSelf: "center" },
  centeredFill: {
    alignSelf: "center",
    flexGrow: 1,
    justifyContent: "center",
  },
  hero: {
    height: 168,
    borderRadius: radius.lg,
    overflow: "hidden",
    backgroundColor: colors.cream,
    marginBottom: spacing.xs,
  },
  heroImage: { flex: 1 },
  heroFallback: { flex: 1, alignItems: "center", justifyContent: "center" },
  title: {
    fontFamily: fonts.serifSemibold,
    fontSize: fontSize.lg,
    color: colors.foreground,
  },
  hint: {
    fontFamily: fonts.sans,
    fontSize: fontSize.sm,
    color: colors.muted,
    lineHeight: 21,
  },
  field: { gap: spacing.xs },
  label: {
    fontFamily: fonts.sansSemibold,
    fontSize: fontSize.xs,
    color: colors.foreground,
    letterSpacing: 0.4,
    textTransform: "uppercase",
  },
  inputWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    height: 58,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceMuted,
  },
  inputWrapError: { borderColor: colors.destructive },
  input: {
    flex: 1,
    fontFamily: fonts.sansSemibold,
    fontSize: fontSize.md,
    letterSpacing: 2,
    color: colors.foreground,
  },
  error: {
    fontFamily: fonts.sans,
    fontSize: fontSize.sm,
    color: colors.destructive,
  },
  list: { gap: spacing.xs },
  item: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    minHeight: 52,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    backgroundColor: colors.surface,
  },
  itemPressed: { backgroundColor: colors.surfaceMuted },
  itemLabel: {
    fontFamily: fonts.sans,
    fontSize: fontSize.md,
    color: colors.foreground,
  },
  note: {
    flexDirection: "row",
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.cream,
  },
  noteText: {
    flex: 1,
    fontFamily: fonts.sans,
    fontSize: fontSize.xs,
    color: colors.muted,
    lineHeight: 18,
  },
});
