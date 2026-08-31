import { useEffect, useState } from "react";
import { Platform } from "react-native";
import * as ScreenCapture from "expo-screen-capture";

/**
 * Protección anti-captura. Es la razón de ser de esta app: la galería web no
 * puede tocar el sistema operativo, una app nativa sí.
 *
 * Qué hace cada plataforma, sin adornos:
 *   Android — `FLAG_SECURE`. Bloqueo real: la captura sale negra, la
 *     grabación sale negra y la app sale en blanco en el conmutador.
 *   iOS 13+ — bloquea captura y grabación. En iOS 12 y anteriores no hace
 *     nada, y por eso el listener de abajo no es opcional.
 *
 * Lo que NINGUNA capa resuelve: fotografiar la pantalla con otro teléfono.
 * SafeFrame tampoco lo resuelve y lo dice en su web. Lo que sí lo mitiga es
 * servir previews degradadas, que hoy queda fuera de alcance.
 */

const KEY = "nayra-gallery";

/**
 * Sin soporte no se muestra la galería. Es la política honesta: la promesa al
 * fotógrafo es que sus fotos no se pueden capturar, y en un dispositivo donde
 * eso no se cumple es mejor no enseñarlas.
 */
export function useProtectionAvailable(): boolean | null {
  const [available, setAvailable] = useState<boolean | null>(null);

  useEffect(() => {
    let active = true;
    ScreenCapture.isAvailableAsync()
      .then((ok) => {
        if (active) setAvailable(ok);
      })
      .catch(() => {
        if (active) setAvailable(false);
      });
    return () => {
      active = false;
    };
  }, []);

  return available;
}

/**
 * Activa las capas mientras el componente esté montado. Va en el layout de
 * `gallery/`, no en el raíz: la pantalla del código no necesita protección y
 * acotarlo hace evidente en el código qué está protegido.
 */
export function useCaptureProtection(onScreenshot?: () => void): void {
  ScreenCapture.usePreventScreenCapture(KEY);

  // La vista previa del conmutador de apps es una captura que hace el propio
  // sistema; en iOS se desenfoca aparte.
  useEffect(() => {
    if (Platform.OS !== "ios") return;
    void ScreenCapture.enableAppSwitcherProtectionAsync();
    return () => {
      void ScreenCapture.disableAppSwitcherProtectionAsync();
    };
  }, []);

  // Red de seguridad: cubre iOS 12 y cualquier dispositivo donde el bloqueo
  // falle en silencio. Si llega a ocurrir, al menos se sabe y se avisa.
  //
  // En Android 13 o anterior no llega a dispararse, porque detectar capturas
  // ahí exige READ_MEDIA_IMAGES y ese permiso no se pide: Google Play lo
  // trata como acceso sensible a la fototeca y lo rechaza a las apps que no
  // gestionan fotos. No se pierde nada — en Android FLAG_SECURE ya bloquea
  // la captura de raíz, así que no hay nada que detectar.
  ScreenCapture.useScreenshotListener(() => {
    onScreenshot?.();
  });
}
