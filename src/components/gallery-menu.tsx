import { memo } from "react";
import {
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
  type ColorValue,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTranslation } from "react-i18next";
import { Download, Images, LogOut, ShieldCheck, X } from "lucide-react-native";

import { colors, fonts, fontSize, radius, spacing } from "@/lib/theme";

type Props = {
  visible: boolean;
  onClose: () => void;
  onDownload: () => void;
  onSwitch: () => void;
  onExit: () => void;
};

type ItemProps = {
  icon: typeof Download;
  label: string;
  hint?: string;
  tint?: ColorValue;
  onPress: () => void;
};

function Item({ icon: Icon, label, hint, tint, onPress }: ItemProps) {
  const color = tint ?? colors.foreground;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={hint}
      onPress={onPress}
      style={({ pressed }) => [styles.item, pressed && styles.itemPressed]}
    >
      <Icon size={22} color={color} strokeWidth={1.75} />
      <View style={styles.itemText}>
        <Text style={[styles.itemLabel, { color }]}>{label}</Text>
        {hint ? <Text style={styles.itemHint}>{hint}</Text> : null}
      </View>
    </Pressable>
  );
}

/**
 * Menú de la galería. Hoja inferior nativa: se cierra tocando fuera o con la
 * X, y el gesto de volver del sistema la cierra sola (`onRequestClose`).
 */
export const GalleryMenu = memo(function GalleryMenu({
  visible,
  onClose,
  onDownload,
  onSwitch,
  onExit,
}: Props) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      {/* Scrim: aísla la hoja del fondo y sirve de zona de descarte. */}
      <Pressable
        style={styles.scrim}
        accessibilityRole="button"
        accessibilityLabel={t("menu.close")}
        onPress={onClose}
      />
      <View style={[styles.sheet, { paddingBottom: insets.bottom + spacing.md }]}>
        <View style={styles.grabber} />

        <View style={styles.header}>
          <Text style={styles.title}>{t("menu.title")}</Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t("menu.close")}
            onPress={onClose}
            hitSlop={12}
            style={styles.close}
          >
            <X size={20} color={colors.muted} strokeWidth={2} />
          </Pressable>
        </View>

        <Item icon={Download} label={t("download.toggle")} onPress={onDownload} />
        <Item
          icon={Images}
          label={t("menu.switch")}
          hint={t("menu.switchHint")}
          onPress={onSwitch}
        />
        <Item
          icon={LogOut}
          label={t("menu.exit")}
          hint={t("menu.exitHint")}
          tint={colors.destructive}
          onPress={onExit}
        />

        <View style={styles.note}>
          <ShieldCheck size={18} color={colors.primary} strokeWidth={1.75} />
          <Text style={styles.noteText}>{t("menu.protection")}</Text>
        </View>
      </View>
    </Modal>
  );
});

const styles = StyleSheet.create({
  scrim: { flex: 1, backgroundColor: colors.scrim },
  sheet: {
    backgroundColor: colors.canvas,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
  },
  grabber: {
    alignSelf: "center",
    width: 40,
    height: 4,
    borderRadius: radius.pill,
    backgroundColor: colors.border,
    marginBottom: spacing.md,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: spacing.xs,
  },
  title: {
    fontFamily: fonts.serifSemibold,
    fontSize: fontSize.lg,
    color: colors.foreground,
  },
  close: {
    width: 44,
    height: 44,
    alignItems: "flex-end",
    justifyContent: "center",
  },
  item: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    minHeight: 56,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.md,
  },
  // Solo color de fondo: no mueve los límites del elemento al pulsar.
  itemPressed: { backgroundColor: colors.surfaceMuted },
  itemText: { flex: 1, gap: 2 },
  itemLabel: { fontFamily: fonts.sansSemibold, fontSize: fontSize.md },
  itemHint: {
    fontFamily: fonts.sans,
    fontSize: fontSize.xs,
    color: colors.subtle,
  },
  note: {
    flexDirection: "row",
    gap: spacing.sm,
    marginTop: spacing.sm,
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
