/**
 * Los colores salen de MARCA en @gina/shared, para que la web y la app móvil no
 * se desincronicen. El blanco es el lienzo y `tinta` es lo que se ve encima.
 */
/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        marca: '#FFFFFF',
        tinta: '#111111',
        borde: '#E5E2E0',
        suave: '#6B6663',
        fondo: '#FAF9F8',
        superficie: '#FFFFFF',
        acento: '#B03052',
      },
      fontFamily: {
        display: ['"Playfair Display"', '"Cormorant Garamond"', 'Georgia', 'serif'],
        sans: ['Inter', '"Helvetica Neue"', 'system-ui', 'sans-serif'],
      },
      letterSpacing: {
        etiqueta: '0.18em',
      },
      boxShadow: {
        // Sombra muy suave: sobre fondo blanco roto, una tarjeta blanca se
        // separa por elevación, no por color.
        tarjeta: '0 1px 3px rgba(17, 17, 17, 0.04), 0 8px 24px rgba(17, 17, 17, 0.05)',
        marco: '0 4px 12px rgba(17, 17, 17, 0.06), 0 16px 48px rgba(17, 17, 17, 0.08)',
      },
    },
  },
  plugins: [],
};
