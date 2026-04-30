import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./lib/**/*.{ts,tsx,ts}"],
  theme: {
    extend: {
      colors: {
        ink: "#101820",
        field: "#f5f7f4",
        mint: "#9ee7c5",
        flame: "#f36b3d",
        cobalt: "#3462ff"
      },
      boxShadow: {
        lift: "0 18px 50px rgba(16, 24, 32, 0.14)"
      }
    }
  },
  plugins: []
};

export default config;
