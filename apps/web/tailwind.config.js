/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: "class",
  content: [
    "./src/**/*.{js,ts,jsx,tsx,mdx}"
  ],
  theme: {
    extend: {
      colors: {
        sre: {
          bg: "#0B0F19",
          card: "#111827",
          border: "#1F2937",
          accent: "#10B981",
          alert: "#EF4444",
          warning: "#F59E0B"
        }
      }
    }
  },
  plugins: []
}

// [milestone]: chore: configure typescript, tailwind css, and eslint

// [milestone]: chore: configure github actions ci workflow for automated tests

// [milestone]: feat: add healthcheck endpoint for load balancer monitoring
