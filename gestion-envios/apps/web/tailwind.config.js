/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        // Una sola familia con eje de ancho: Expanded para títulos y cifras
        // (como la cartelería de rutas), normal para el cuerpo.
        sans: ['"Archivo"', "system-ui", "sans-serif"],
        display: ['"Archivo"', "system-ui", "sans-serif"],
      },
      colors: {
        movii: {
          50: "#fffbeb",
          100: "#fef3c7",
          400: "#fbbf24",
          500: "#f4b400",
          600: "#d19700",
          700: "#9a6f00",
          900: "#1a1a1a",
        },
        // Asfalto (sidebar y superficies oscuras)
        asfalto: {
          700: "#2a2a2a",
          800: "#222222",
          900: "#1a1a1a",
        },
        // Hormigón (fondo de trabajo, gris frío)
        hormigon: {
          50: "#f6f7f8",
          100: "#eef0f2",
          200: "#e1e4e8",
          300: "#c9ced5",
        },
      },
      borderRadius: {
        panel: "1.25rem",
      },
      boxShadow: {
        panel: "0 1px 0 rgba(20, 24, 31, 0.04), 0 8px 24px -12px rgba(20, 24, 31, 0.12)",
        lift: "0 1px 0 rgba(20, 24, 31, 0.05), 0 18px 40px -18px rgba(20, 24, 31, 0.28)",
      },
      keyframes: {
        carril: { to: { backgroundPosition: "0 -24px" } },
        "carril-x": { to: { backgroundPosition: "30px 0" } },
      },
      animation: {
        carril: "carril 1.2s linear infinite",
        "carril-x": "carril-x 0.6s linear infinite",
      },
    },
  },
  plugins: [],
};
