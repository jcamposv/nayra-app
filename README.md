# Nayra App

Visor nativo de galerías para el cliente final de [Nayra](../nayra), con
bloqueo de captura de pantalla a nivel de sistema operativo.

El cliente abre su galería con un **código de 10 caracteres** que le da su
fotógrafo — sin cuenta, sin correo, sin contraseña. Ve sus fotos, marca
favoritas, envía la selección y, cuando el fotógrafo libera las compradas,
las descarga.

## Por qué existe

El navegador no puede pedirle nada al sistema operativo. Una app nativa sí:
en Android `FLAG_SECURE` bloquea de verdad la captura y la grabación, y en
iOS 13+ `expo-screen-capture` bloquea ambas. Sin eso, cualquiera captura las
previews y les quita la marca de agua con IA en segundos.

Lo que **no** resuelve: fotografiar la pantalla con otro teléfono. Ningún
producto lo resuelve. Lo que lo mitiga es que las previews van a baja
resolución y con marca, así que la captura no sirve para imprimir.

## Navegación

```
/            arranque: decide según lo guardado
/access      pedir código (hero + formulario)
/galleries   tus galerías guardadas
/gallery     la galería activa (aquí vive la protección)
  /gallery/[photoId]   visor a pantalla completa
  /gallery/submit      confirmar y enviar selección
  /gallery/download    canjear código y descargar
```

El dispositivo guarda **varias galerías**, no una: un cliente puede tener la
de su boda y la de la sesión familiar, o de dos fotógrafos distintos. Sin eso,
ver la otra obligaba a salir y volver a teclear el código — y no había ni
forma de salir.

El arranque no añade pasos de más: sin galerías pide el código, con una entra
directo, con varias muestra la lista. Desde el menú de la galería se llega a
"Tus galerías" (cambiar o añadir otra) y a "Salir de la galería", que quita
solo esa y deja el resto.

Cada sesión vive en su propia clave de `expo-secure-store`, con un índice
aparte que solo lleva ids: SecureStore no promete funcionar con valores
grandes en Android, y un único blob con todas crecería sin techo.

## Marca

Todo sale del proyecto web (`../nayra`), no de valores inventados:

| Pieza | Origen |
|---|---|
| Paleta (`src/lib/theme.ts`) | `src/app/globals.css` — crema `#F4EEE4`, verde `#0F3D33`, terracota `#A9472F` |
| Icono, splash y adaptive icon | el colibrí extraído de `public/logo.svg` |
| Logotipo en pantalla (`assets/images/wordmark*.png`) | el mismo SVG, en verde para fondo claro y crema para el visor oscuro |
| Tipografías | Manrope (interfaz) y Newsreader (títulos), las mismas que `src/app/layout.tsx` |

Las tipografías van **vendorizadas en `assets/fonts/` con el nombre PostScript
de cada TTF**, y embebidas por el config plugin de `expo-font`. El nombre
importa: iOS resuelve la familia por el nombre PostScript y Android por el del
archivo, así que si no coinciden una de las dos plataformas cae al tipo del
sistema sin dar ningún error. Las licencias OFL están junto a los archivos.

La galería muestra el logo del estudio cuando tiene `custom_branding`
(Esencial+) y el de Nayra con "Hecho con Nayra" cuando no — misma regla que la
galería web.

## Stack

- Expo SDK 57 · React Native 0.86 · expo-router · TypeScript estricto
- `expo-screen-capture` (protección) · `expo-secure-store` (sesión)
- `expo-image` con `cacheKey` estable · `@shopify/flash-list`
- react-i18next — español (fuente de verdad) y portugués de Brasil

## Arranque

```bash
pnpm install
cp .env.example .env      # apunta EXPO_PUBLIC_API_URL a tu Nayra
npx expo run:ios          # o run:android
```

**No funciona con Expo Go**: `expo-screen-capture` es un módulo nativo, así
que hace falta un development build.

### Parche de `expo-modules-jsi`

`patches/expo-modules-jsi@57.0.6.patch` quita `SWIFT_RETURNS_RETAINED` de dos
constructores de `RuntimeScheduler.h`. Sin él, **el build de iOS falla con
Xcode 26.2**: el Swift nuevo procesa esas anotaciones antes de ver el
`SWIFT_SHARED_REFERENCE` que la clase declara al final, y las rechaza. La
clase sigue siendo un tipo de referencia compartida con su propio
retain/release, así que Swift le aplica igual la convención `+1` — quitar la
anotación explícita no cambia la semántica.

Es un bug upstream de Expo (57.0.6 es la última estable de SDK 57). Cuando lo
arreglen, borrar el parche y la entrada de `pnpm-workspace.yaml`.

En un dispositivo físico, `localhost` es el propio teléfono: hay que poner la
IP LAN de la máquina en `EXPO_PUBLIC_API_URL`.

## Enlaces que abren la app

El cliente no debería teclear diez caracteres si puede tocar un enlace.

```
https://app.nayraphoto.com/a/<código>   ← enlace universal (no pregunta)
nayra://a/<código>                      ← esquema propio (iOS pide confirmar)
```

Ambos entran por `src/app/a/[code].tsx`, que canjea el código y va derecho a
la galería. Si falla, manda a `/access` con el código ya escrito y el motivo,
para que el cliente no tenga que reescribirlo.

El esquema propio funciona desde el primer build y sirve para probar:

```bash
xcrun simctl openurl booted "nayra://a/XXXXXXXXXX"
```

Los enlaces `https://` requieren, además de `associatedDomains` e
`intentFilters` (ya en `app.json`), que el servidor publique los ficheros de
asociación — ver el README de `../nayra`. Sin ellos el enlace abre el
navegador y muestra la página con el código, que es una degradación aceptable.

## API

La app consume `/api/client/v1/*` de la app web de Nayra. Nunca habla con
Supabase ni con R2 directamente: no lleva llave anónima ni credenciales de
almacenamiento, solo baja bytes de URLs que el servidor ya firmó.

La sesión es un token HMAC que guarda el propio dispositivo; el servidor no
guarda ninguna fila por sesión. Cuando el fotógrafo regenera el enlace en su
panel, la sesión muere sola en el siguiente request.

## Capturas para las tiendas

```bash
xcrun simctl io booted screenshot store/raw/01-acceso.png
node scripts/store-screenshots.mjs      # necesita sharp (devDependency)
```

Las crudas se toman en un **iPhone 17 Pro Max**: da 1320x2868, que es justo
el tamaño de 6.9" que pide App Store, así que no se reescalan. Google Play no
admite proporciones mayores de 1:2 y esa es 1:2.17, por eso sus imágenes se
componen sobre un lienzo 1080x1920.

El script produce también el icono de 512 y el gráfico destacado de 1024x500
que pide Play.

**Los titulares van en Manrope Bold, no en Newsreader.** librsvg en macOS no
resuelve las fuentes del repo por fontconfig — Manrope funciona solo porque
además está instalada en el sistema. En una ficha de tienda un titular en sans
pesada se lee mejor de todas formas.

**El simulador sí deja capturar** aunque la app bloquee las capturas: la
protección de iOS no se aplica ahí. En un dispositivo real hay que usar el
simulador para esto.

## Pruebas que importan

El simulador **no** reproduce el bloqueo de captura. Hay que probar en
dispositivo físico:

- Android: captura → negra. Grabación → negra. Conmutador → blanco.
- iOS 13+: captura → bloqueada. Conmutador → desenfocado.
- Aparato sin soporte → la galería no se muestra y lo explica.
- Galería de 300+ fotos: scroll fluido y las URLs se re-firman solas.
