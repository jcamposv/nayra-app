import { useEffect } from "react";
import { ActivityIndicator, StyleSheet, View } from "react-native";
import { router } from "expo-router";

import { listSessions } from "@/lib/session";
import { colors } from "@/lib/theme";

/**
 * Arranque. Decide a dónde entra el cliente según lo que tenga guardado:
 * sin galerías pide el código, con una entra directo, y con varias muestra
 * la lista para que elija — que es lo que se espera de una app y no de una
 * página que solo sabe abrir una cosa.
 */
export default function BootScreen() {
  useEffect(() => {
    let active = true;
    listSessions()
      .then((sessions) => {
        if (!active) return;
        if (sessions.length === 0) router.replace("/access");
        else if (sessions.length === 1) router.replace("/gallery");
        else router.replace("/galleries");
      })
      .catch(() => {
        if (active) router.replace("/access");
      });
    return () => {
      active = false;
    };
  }, []);

  return (
    <View style={styles.root}>
      <ActivityIndicator color={colors.primary} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.canvas,
  },
});
