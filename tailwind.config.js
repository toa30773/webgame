/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ally: "#3b82f6",
        enemy: "#ef4444",
        hpgood: "#22c55e",
        hpwarn: "#f59e0b",
        hpdanger: "#ef4444",
      },
    },
  },
  plugins: [],
};
