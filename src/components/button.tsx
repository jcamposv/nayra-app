import { memo } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  type StyleProp,
  type ViewStyle,
} from "react-native";

import { colors, fonts, fontSize, radius, spacing } from "@/lib/theme";

type Props = {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
  variant?: "primary" | "ghost";
  style?: StyleProp<ViewStyle>;
};

/** Pressable y no TouchableOpacity: es la API vigente y respeta el feedback
 *  nativo de cada plataforma. */
export const Button = memo(function Button({
  label,
  onPress,
  disabled = false,
  loading = false,
  variant = "primary",
  style,
}: Props) {
  const isPrimary = variant === "primary";
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: disabled || loading }}
      disabled={disabled || loading}
      onPress={onPress}
      style={({ pressed }) => [
        styles.base,
        isPrimary ? styles.primary : styles.ghost,
        pressed && styles.pressed,
        (disabled || loading) && styles.disabled,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={isPrimary ? colors.onPrimary : colors.primary} />
      ) : (
        <Text style={isPrimary ? styles.primaryLabel : styles.ghostLabel}>
          {label}
        </Text>
      )}
    </Pressable>
  );
});

const styles = StyleSheet.create({
  base: {
    minHeight: 52,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing.lg,
    borderRadius: radius.md,
  },
  primary: { backgroundColor: colors.primary },
  ghost: { backgroundColor: "transparent" },
  // Solo opacity: se compone en la GPU y no dispara layout.
  pressed: { opacity: 0.85 },
  disabled: { opacity: 0.45 },
  primaryLabel: {
    fontFamily: fonts.sansSemibold,
    color: colors.onPrimary,
    fontSize: fontSize.md,
  },
  ghostLabel: {
    fontFamily: fonts.sansSemibold,
    color: colors.primary,
    fontSize: fontSize.md,
  },
});
