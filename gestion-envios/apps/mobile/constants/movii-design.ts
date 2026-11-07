/** Identidad Movii: asfalto, hormigón y amarillo vial (la misma que el panel web). */
export const M = {
  asfalto: "#1A1A1A",
  asfalto2: "#222222",
  asfalto3: "#2A2A2A",
  asfalto4: "#343434",
  hormigon50: "#F6F7F8",
  hormigon100: "#EEF0F2",
  hormigon200: "#E1E4E8",
  hormigon300: "#C9CED5",
  amarillo: "#F4B400",
  amarilloClaro: "#FFD452",
  amarilloSuave: "#FFF4CC",
  amarilloOscuro: "#806700",
  texto: "#1C1C1E",
  gris: "#6E6E73",
  grisClaro: "#AEAEB2",
  verde: "#16A34A",
  rojo: "#DC2626",
  naranja: "#D97706",
  azul: "#2563EB",
} as const;

export const SOMBRA = {
  panel: { shadowColor: "#14181F", shadowOpacity: 0.08, shadowRadius: 18, shadowOffset: { width: 0, height: 8 }, elevation: 2 },
  lift: { shadowColor: "#14181F", shadowOpacity: 0.22, shadowRadius: 26, shadowOffset: { width: 0, height: 14 }, elevation: 8 },
} as const;
