import { useCallback, useEffect, useRef, useState } from "react";
import { Animated, StyleSheet, Text, View } from "react-native";
import { Stack } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { useTranslation } from "react-i18next";

import { Wordmark } from "@/components/wordmark";
import { GalleryProvider } from "@/lib/gallery-context";
import { useCaptureProtection, useProtectionAvailable } from "@/lib/protection";
import { colors, fonts, fontSize, radius, spacing } from "@/lib/theme";

/**
 * Aquí vive la protección, y no en el layout raíz: la pantalla del código no
 * la necesita, y acotarla hace evidente en el código qué está protegido.
 */
export default function GalleryLayout() {
  const { t } = useTranslation();
  const available = useProtectionAvailable();
  const [warned, setWarned] = useState(false);
  const opacity = useRef(new Animated.Value(0)).current;

  const onScreenshot = useCallback(() => setWarned(true), []);
  useCaptureProtection(onScreenshot);

  // Solo opacity: se compone en la GPU y no dispara layout.
  useEffect(() => {
    if (!warned) return;
    Animated.timing(opacity, {
      toValue: 1,
      duration: 180,
      useNativeDriver: true,
    }).start();
    const timer = setTimeout(() => {
      Animated.timing(opacity, {
        toValue: 0,
        duration: 220,
        useNativeDriver: true,
      }).start(() => setWarned(false));
    }, 2600);
    return () => clearTimeout(timer);
  }, [warned, opacity]);

  if (available === null) {
    return <View style={styles.blank} />;
  }

  // Sin soporte no se muestran las fotos. La promesa al fotógrafo es que no
  // se pueden capturar; en un aparato donde eso no se cumple, mejor no
  // enseñarlas.
  if (!available) {
    return (
      <SafeAreaView style={styles.unsupported}>
        <Wordmark width={124} style={styles.unsupportedLogo} />
        <Text style={styles.unsupportedTitle}>
          {t("protection.unsupportedTitle")}
        </Text>
        <Text style={styles.unsupportedBody}>{t("protection.unsupported")}</Text>
      </SafeAreaView>
    );
  }

  return (
    <GalleryProvider>
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: colors.viewer },
        }}
      >
        <Stack.Screen name="index" />
        <Stack.Screen
          name="[photoId]"
          options={{ animation: "fade", presentation: "fullScreenModal" }}
        />
        <Stack.Screen name="download" options={{ presentation: "modal" }} />
      </Stack>

      {warned ? (
        <Animated.View style={[styles.toast, { opacity }]} pointerEvents="none">
          <Text style={styles.toastText}>
            {t("protection.screenshotBlocked")}
          </Text>
        </Animated.View>
      ) : null}
    </GalleryProvider>
  );
}

const styles = StyleSheet.create({
  blank: { flex: 1, backgroundColor: colors.viewer },
  unsupported: {
    flex: 1,
    backgroundColor: colors.canvas,
    justifyContent: "center",
    paddingHorizontal: spacing.lg,
    gap: spacing.md,
  },
  unsupportedLogo: { marginBottom: spacing.sm },
  unsupportedTitle: {
    fontFamily: fonts.serifSemibold,
    fontSize: fontSize.lg,
    color: colors.foreground,
  },
  unsupportedBody: {
    fontFamily: fonts.sans,
    fontSize: fontSize.sm,
    color: colors.muted,
    lineHeight: 20,
  },
  toast: {
    position: "absolute",
    left: spacing.md,
    right: spacing.md,
    bottom: 96,
    backgroundColor: colors.foreground,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
  },
  toastText: {
    fontFamily: fonts.sans,
    color: colors.canvas,
    fontSize: fontSize.sm,
    textAlign: "center",
  },
});
