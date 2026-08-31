import { useEffect, useRef } from "react";
import { ActivityIndicator, StyleSheet, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";

import { ApiError, openGallery } from "@/api/client";
import { normalizeCode } from "@/lib/access-code";
import { colors } from "@/lib/theme";

/**
 * Destino de los enlaces `nayra://a/<código>` y
 * `https://app.nayraphoto.com/a/<código>`.
 *
 * Existe porque la gente toca enlaces y no teclea diez caracteres: el
 * fotógrafo manda un link por WhatsApp y el cliente entra de un toque. La
 * página web del mismo enlace solo enseña cómo instalar la app, así que
 * quien no la tenga no se queda a medias.
 */
export default function DeepLinkScreen() {
  const { code } = useLocalSearchParams<{ code: string }>();
  // Un enlace tocado dos veces no debe canjear dos veces.
  const handled = useRef(false);

  useEffect(() => {
    if (handled.current) return;
    handled.current = true;

    const normalized = normalizeCode(code ?? "");
    if (!normalized) {
      router.replace("/access");
      return;
    }

    void (async () => {
      try {
        // Siempre se canjea, aunque la galería ya esté en el dispositivo:
        // `saveSession` actualiza por id, así que reabrir el enlace refresca
        // la sesión en vez de duplicarla. Guardar el código en el aparato
        // para ahorrarnos esta llamada sería estado que mantener a cambio de
        // nada.
        await openGallery(normalized);
        router.replace("/gallery");
      } catch (cause) {
        // El formulario retoma con el código ya escrito y enseña el motivo.
        const reason = cause instanceof ApiError ? cause.code : "server_error";
        router.replace(`/access?code=${normalized}&reason=${reason}`);
      }
    })();
  }, [code]);

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
