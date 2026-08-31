import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";

import "@/lib/i18n";
import { colors } from "@/lib/theme";

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <StatusBar style="dark" />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: colors.canvas },
          // Native stack: la navegación la maneja el sistema, no JS.
          animation: "slide_from_right",
        }}
      />
    </SafeAreaProvider>
  );
}
