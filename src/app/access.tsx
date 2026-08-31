import { useCallback, useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from "react-native";
import { Image } from "expo-image";
import { router, useLocalSearchParams } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTranslation } from "react-i18next";
import { ChevronLeft, KeyRound } from "lucide-react-native";

import { ApiError, openGallery } from "@/api/client";
import { Button } from "@/components/button";
import { Wordmark } from "@/components/wordmark";
import {
  ACCESS_CODE_LENGTH,
  formatAccessCode,
  normalizeCode,
} from "@/lib/access-code";
import { useLayout } from "@/lib/layout";
import { colors, fonts, fontSize, radius, spacing } from "@/lib/theme";

const HERO = require("../../assets/images/hero.jpg");

/** Códigos del backend → texto. La API responde con códigos estables, sin
 *  prosa ni claves de i18n, así que los textos los pone la app. */
const ERRORS: Record<string, string> = {
  invalid_code: "access.invalid",
  gallery_unavailable: "access.unavailable",
  too_many_attempts: "access.tooManyAttempts",
  offline: "errors.offline",
};

export default function AccessCodeScreen() {
  const { t } = useTranslation();
  const { height } = useWindowDimensions();
  const { contentWidth, isTablet } = useLayout();
  const insets = useSafeAreaInsets();
  // Un enlace que falló manda aquí el código y el motivo, para que el
  // cliente no tenga que reescribirlo ni adivinar qué pasó.
  const params = useLocalSearchParams<{ code?: string; reason?: string }>();
  const [code, setCode] = useState(() => formatAccessCode(params.code ?? ""));
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(() =>
    params.reason ? t(ERRORS[params.reason] ?? "errors.generic") : null,
  );


  const onChange = useCallback((value: string) => {
    setCode(formatAccessCode(value));
    setError(null);
  }, []);

  const onSubmit = useCallback(async () => {
    setPending(true);
    setError(null);
    try {
      await openGallery(normalizeCode(code));
      router.replace("/gallery");
    } catch (cause) {
      const key = cause instanceof ApiError ? ERRORS[cause.code] : undefined;
      setError(t(key ?? "errors.generic"));
    } finally {
      setPending(false);
    }
  }, [code, t]);


  const ready = normalizeCode(code).length === ACCESS_CODE_LENGTH;
  // El hero ocupa poco más de un tercio: deja sitio al teclado en pantallas
  // pequeñas sin que el formulario quede aplastado.
  const heroHeight = Math.round(height * (isTablet ? 0.32 : 0.4));

  return (
    <View style={styles.root}>
      {/* El hero es claro: en blanco, la hora y los iconos del sistema se
          pierden sobre el beige. */}
      <StatusBar style="dark" />

      <View style={[styles.hero, { height: heroHeight }]}>
        <Image
          source={HERO}
          contentFit="cover"
          transition={220}
          // Decorativa: no aporta información que no esté en el texto.
          accessibilityElementsHidden
          importantForAccessibility="no"
          style={styles.heroImage}
        />
        {/* Salida visible cuando se llega desde "Tus galerías": el gesto del
            sistema existe, pero no se ve. */}
        {router.canGoBack() ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t("galleries.title")}
            onPress={() => router.back()}
            hitSlop={8}
            style={({ pressed }) => [
              styles.back,
              { top: insets.top + spacing.xs },
              pressed && styles.backPressed,
            ]}
          >
            <ChevronLeft size={22} color={colors.foreground} strokeWidth={2} />
          </Pressable>
        ) : null}
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={styles.flex}
      >
        <ScrollView
          contentContainerStyle={[
            styles.content,
            // En tablet el contenido se centra y se acota: un campo de
            // 2000px de ancho no es un formulario, es una pancarta.
            { paddingBottom: insets.bottom + spacing.xl, maxWidth: contentWidth },
            // En tablet sobra alto: el bloque se centra en el hueco en vez
            // de quedar colgando de la parte de arriba.
            isTablet && styles.contentCentered,
          ]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <Wordmark width={116} style={styles.logo} />

          <Text style={styles.title}>{t("access.title")}</Text>
          <Text style={styles.hint}>{t("access.hint")}</Text>

          <View style={styles.field}>
            {/* Etiqueta visible, no solo placeholder: al escribir, un
                placeholder desaparece y con él la única pista de qué va aquí. */}
            <Text style={styles.label} nativeID="access-code-label">
              {t("access.label")}
            </Text>
            <View
              style={[
                styles.inputWrap,
                error ? styles.inputWrapError : null,
              ]}
            >
              <KeyRound
                size={20}
                color={error ? colors.destructive : colors.subtle}
                strokeWidth={1.75}
              />
              <TextInput
                value={code}
                onChangeText={onChange}
                placeholder={t("access.placeholder")}
                placeholderTextColor={colors.subtle}
                autoCapitalize="characters"
                autoCorrect={false}
                autoComplete="off"
                // 10 caracteres + el guión que inserta el formateador.
                maxLength={ACCESS_CODE_LENGTH + 1}
                style={styles.input}
                accessibilityLabelledBy="access-code-label"
                accessibilityLabel={t("access.label")}
                onSubmitEditing={ready ? () => void onSubmit() : undefined}
                returnKeyType="go"
              />
            </View>
            {error ? (
              // Junto al campo y con role alert para que lectores de
              // pantalla lo anuncien al aparecer.
              <Text style={styles.error} accessibilityRole="alert">
                {error}
              </Text>
            ) : null}
          </View>

          <Button
            label={pending ? t("access.opening") : t("access.submit")}
            onPress={() => void onSubmit()}
            disabled={!ready}
            loading={pending}
          />

          <Text style={styles.footer}>{t("access.noCode")}</Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.canvas },
  flex: { flex: 1 },
  hero: {
    // Arco suave, no cúpula: con radios muy grandes las dos esquinas se
    // juntan en el centro y la foto se recorta en semicírculo.
    borderBottomLeftRadius: 88,
    borderBottomRightRadius: 88,
    overflow: "hidden",
    backgroundColor: colors.surfaceMuted,
  },
  heroImage: { flex: 1 },
  back: {
    position: "absolute",
    left: spacing.md,
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.pill,
    backgroundColor: "rgba(255, 255, 255, 0.92)",
  },
  backPressed: { opacity: 0.7 },
  content: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    gap: spacing.md,
    width: "100%",
  },
  contentCentered: {
    alignSelf: "center",
    flexGrow: 1,
    justifyContent: "center",
  },
  logo: { marginBottom: spacing.xs },
  title: {
    fontFamily: fonts.serifSemibold,
    fontSize: fontSize.xl,
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
    fontSize: 20,
    letterSpacing: 4,
    color: colors.foreground,
  },
  error: {
    fontFamily: fonts.sans,
    fontSize: fontSize.sm,
    color: colors.destructive,
  },
  footer: {
    fontFamily: fonts.sans,
    fontSize: fontSize.xs,
    color: colors.subtle,
    textAlign: "center",
    lineHeight: 18,
  },
});
