import { useCallback, useMemo, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/button";
import { useGallery } from "@/lib/gallery-context";
import { useLayout } from "@/lib/layout";
import { colors, fonts, fontSize, spacing } from "@/lib/theme";

export default function SubmitSelectionScreen() {
  const { t, i18n } = useTranslation();
  const { manifest, selected, submit } = useGallery();
  const { contentWidth, isTablet } = useLayout();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Crear un Intl.NumberFormat es caro; se construye una vez por locale y
  // moneda en vez de en cada render.
  const money = useMemo(
    () =>
      new Intl.NumberFormat(i18n.language, {
        style: "currency",
        currency: manifest?.gallery.currency ?? "USD",
      }),
    [i18n.language, manifest?.gallery.currency],
  );

  const onConfirm = useCallback(async () => {
    setPending(true);
    setError(null);
    const ok = await submit();
    setPending(false);
    if (ok) router.replace("/gallery");
    else setError(t("errors.generic"));
  }, [submit, t]);

  if (!manifest) return null;

  const { gallery } = manifest;
  const count = selected.size;
  const limit = gallery.selectionLimit;
  const extras = limit === null ? 0 : Math.max(0, count - limit);
  const price = gallery.extraPhotoPriceCents;

  const description =
    extras > 0 && price !== null
      ? t("gallery.confirmDescriptionExtras", {
          count,
          extras,
          price: money.format(price / 100),
        })
      : t("gallery.confirmDescription", { count });

  return (
    <SafeAreaView style={styles.safe}>
      <View
        style={[
          styles.content,
          { maxWidth: contentWidth },
          isTablet && styles.centered,
        ]}
      >
        <Text style={styles.title}>{t("gallery.confirmTitle")}</Text>
        <Text style={styles.body}>{description}</Text>
        {error ? <Text style={styles.error}>{error}</Text> : null}
      </View>
      <View style={styles.actions}>
        <Button
          label={t("gallery.submit")}
          onPress={() => void onConfirm()}
          loading={pending}
          disabled={count === 0}
        />
        <Button
          label={t("gallery.cancel")}
          variant="ghost"
          onPress={() => router.back()}
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.canvas,
    paddingHorizontal: spacing.lg,
  },
  content: { flex: 1, justifyContent: "center", gap: spacing.md, width: "100%" },
  centered: { alignSelf: "center" },
  title: {
    fontFamily: fonts.serifSemibold,
    fontSize: fontSize.xl,
    color: colors.foreground,
  },
  body: {
    fontFamily: fonts.sans,
    fontSize: fontSize.md,
    color: colors.muted,
    lineHeight: 24,
  },
  error: {
    fontFamily: fonts.sans,
    color: colors.destructive,
    fontSize: fontSize.sm,
  },
  actions: { gap: spacing.sm, paddingBottom: spacing.lg },
});
