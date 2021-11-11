module.exports = {
  purge: [
    "./_includes/**/*.html",
    "./_layouts/**/*.html",
    "./_posts/*.md",
    "./*.html",
  ],
  darkMode: false,
  theme: {
    colors: {
      curiosity: {
        lightest: "#EFFFCD",
        light: "#DCE9BE",
        dirt: "#555152",
        magenta: "#2E2633",
        red: "#99173C",
      },
    },
    minWidth: {
      full: "640px",
    },
  },
  variants: {},
  plugins: [require("@tailwindcss/typography")],
};
