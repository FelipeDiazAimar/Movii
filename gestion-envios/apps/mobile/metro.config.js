const { getDefaultConfig } = require("expo/metro-config");

// Config de Metro por defecto de Expo (sin NativeWind, ver babel.config.js).
module.exports = getDefaultConfig(__dirname);
