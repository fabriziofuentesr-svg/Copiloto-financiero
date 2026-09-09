/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      fontFamily: {
        display: ["Lora", "serif"],
        sans: ["IBM Plex Sans", "sans-serif"],
      },
      colors: {
        paper: "#F3F0E4",
        "paper-raised": "#EAE5D4",
        ink: "#22302C",
        "ink-soft": "#55635C",
        teal: { DEFAULT: "#1F5C56", light: "#3D7A72" },
        ochre: "#C1892E",
        brick: "#A63D2C",
        line: "#D3CCB6",
      },
      borderRadius: {
        DEFAULT: "6px",
      },
    },
  },
  plugins: [],
};
