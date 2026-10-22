import * as ImagePicker from "expo-image-picker";

// quality < 1 hace que el picker comprima a JPEG (la API exige JPEG ≤ 5 MB).
const OPCIONES: ImagePicker.ImagePickerOptions = { mediaTypes: ["images"], quality: 0.5, base64: true, exif: false };

/**
 * Saca una foto con la cámara y devuelve su base64 (sin prefijo data:).
 * Si no hay permiso de cámara o el dispositivo no tiene (simulador), abre la
 * galería. null si el usuario cancela.
 */
export async function tomarFotoJPEG(): Promise<string | null> {
  let resultado: ImagePicker.ImagePickerResult;
  try {
    const permiso = await ImagePicker.requestCameraPermissionsAsync();
    resultado = permiso.granted ? await ImagePicker.launchCameraAsync(OPCIONES) : await ImagePicker.launchImageLibraryAsync(OPCIONES);
  } catch {
    resultado = await ImagePicker.launchImageLibraryAsync(OPCIONES);
  }
  if (resultado.canceled) return null;
  return resultado.assets[0]?.base64 ?? null;
}
