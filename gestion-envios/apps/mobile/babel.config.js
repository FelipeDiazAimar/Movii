// NativeWind se quitó del build: ninguna pantalla real usa className y su
// transformación de JSX (jsxImportSource "nativewind") envolvía cada
// componente; en el APK (modo producción) los Pressable con style={({ pressed }) => ...}
// perdían sus estilos (botones sin fondo, filas en columna). En Expo Go (modo
// desarrollo) no se notaba.
module.exports = function (api) {
  api.cache(true);
  return {
    presets: ["babel-preset-expo"],
    plugins: ["react-native-worklets/plugin"],
  };
};
