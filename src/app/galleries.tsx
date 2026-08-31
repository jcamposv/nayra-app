import { useCallback, useState } from "react";
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { router, useFocusEffect } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { useTranslation } from "react-i18next";
import { ChevronRight, Images, Plus, Trash2 } from "lucide-react-native";

import { Button } from "@/components/button";
import { Wordmark } from "@/components/wordmark";
import {
  listSessions,
  removeSession,
  setActiveSession,
  type StoredSession,
} from "@/lib/session";
import { useLayout } from "@/lib/layout";
import { colors, fonts, fontSize, radius, spacing } from "@/lib/theme";

/**
 * Las galerías guardadas en este dispositivo. Un cliente puede tener la de
 * su boda y la de la sesión familiar, o de dos fotógrafos distintos; sin
 * esta pantalla, ver la otra obligaba a salir y volver a teclear el código.
 */
export default function GalleriesScreen() {
  const { t } = useTranslation();
  const { contentWidth, isTablet } = useLayout();
  const [sessions, setSessions] = useState<StoredSession[]>([]);

  // Al volver de una galería la lista se reordena por uso reciente.
  useFocusEffect(
    useCallback(() => {
      let active = true;
      listSessions()
        .then((list) => {
          if (active) setSessions(list);
        })
        .catch(() => {
          if (active) setSessions([]);
        });
      return () => {
        active = false;
      };
    }, []),
  );

  const open = useCallback(async (galleryId: string) => {
    await setActiveSession(galleryId);
    router.replace("/gallery");
  }, []);

  const confirmRemove = useCallback(
    (session: StoredSession) => {
      Alert.alert(t("galleries.removeTitle"), t("galleries.removeBody"), [
        { text: t("galleries.cancel"), style: "cancel" },
        {
          text: t("galleries.confirm"),
          style: "destructive",
          onPress: () => {
            void removeSession(session.galleryId).then(async () => {
              const list = await listSessions();
              setSessions(list);
              if (list.length === 0) router.replace("/access");
            });
          },
        },
      ]);
    },
    [t],
  );

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView
        contentContainerStyle={[
          styles.content,
          { maxWidth: contentWidth },
          isTablet && styles.centered,
        ]}
      >
        <Wordmark width={112} style={styles.logo} />
        <Text style={styles.title}>{t("galleries.title")}</Text>
        <Text style={styles.subtitle}>{t("galleries.subtitle")}</Text>

        <View style={styles.list}>
          {sessions.map((session) => (
            <View key={session.galleryId} style={styles.row}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`${session.galleryTitle}. ${t("galleries.open")}`}
                onPress={() => void open(session.galleryId)}
                style={({ pressed }) => [
                  styles.card,
                  pressed && styles.cardPressed,
                ]}
              >
                <View style={styles.thumb}>
                  <Images size={20} color={colors.primary} strokeWidth={1.75} />
                </View>
                <View style={styles.cardText}>
                  <Text style={styles.cardTitle} numberOfLines={1}>
                    {session.galleryTitle}
                  </Text>
                  <Text style={styles.cardStudio} numberOfLines={1}>
                    {session.studioName}
                  </Text>
                </View>
                <ChevronRight
                  size={20}
                  color={colors.subtle}
                  strokeWidth={1.75}
                />
              </Pressable>

              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`${t("galleries.remove")}: ${session.galleryTitle}`}
                onPress={() => confirmRemove(session)}
                hitSlop={8}
                style={({ pressed }) => [
                  styles.remove,
                  pressed && styles.cardPressed,
                ]}
              >
                <Trash2 size={18} color={colors.subtle} strokeWidth={1.75} />
              </Pressable>
            </View>
          ))}
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <Button
          label={t("galleries.add")}
          variant="ghost"
          onPress={() => router.push("/access")}
        />
        <View style={styles.plus} pointerEvents="none">
          <Plus size={18} color={colors.primary} strokeWidth={2} />
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.canvas },
  content: { padding: spacing.lg, gap: spacing.xs, width: "100%" },
  centered: { alignSelf: "center" },
  logo: { marginBottom: spacing.md },
  title: {
    fontFamily: fonts.serifSemibold,
    fontSize: fontSize.xl,
    color: colors.foreground,
  },
  subtitle: {
    fontFamily: fonts.sans,
    fontSize: fontSize.sm,
    color: colors.muted,
  },
  list: { marginTop: spacing.lg, gap: spacing.sm },
  row: { flexDirection: "row", alignItems: "center", gap: spacing.xs },
  card: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    minHeight: 72,
    paddingHorizontal: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    backgroundColor: colors.surface,
  },
  // Solo color de fondo: no mueve los límites de la fila al pulsar.
  cardPressed: { backgroundColor: colors.surfaceMuted },
  thumb: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.md,
    backgroundColor: colors.cream,
  },
  cardText: { flex: 1, gap: 2 },
  cardTitle: {
    fontFamily: fonts.sansSemibold,
    fontSize: fontSize.md,
    color: colors.foreground,
  },
  cardStudio: {
    fontFamily: fonts.sans,
    fontSize: fontSize.xs,
    color: colors.subtle,
  },
  remove: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.md,
  },
  footer: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.borderSubtle,
    paddingTop: spacing.sm,
  },
  plus: {
    position: "absolute",
    left: spacing.lg + spacing.md,
    top: spacing.sm + 17,
  },
});
