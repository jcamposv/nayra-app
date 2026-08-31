import { getLocales } from "expo-localization";
import i18n from "i18next";
import { initReactI18next } from "react-i18next";

import es from "@/locales/es/translation.json";
import ptBR from "@/locales/pt-BR/translation.json";

/**
 * Mismas convenciones que la web: `es` es la fuente de verdad y `pt-BR` se
 * mantiene en paridad de claves. Un idioma nuevo es una carpeta nueva.
 */
const resources = {
  es: { translation: es },
  "pt-BR": { translation: ptBR },
} as const;

/** Cualquier variante de portugués cae en pt-BR; el resto, en español. */
function deviceLanguage(): keyof typeof resources {
  const tag = getLocales()[0]?.languageTag ?? "es";
  return tag.toLowerCase().startsWith("pt") ? "pt-BR" : "es";
}

void i18n.use(initReactI18next).init({
  resources,
  lng: deviceLanguage(),
  fallbackLng: "es",
  interpolation: { escapeValue: false },
});

export default i18n;
