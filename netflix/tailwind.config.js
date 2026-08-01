/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './index.html',
    './src/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        'netflix-red': '#E50914',
        'netflix-black': '#141414',
        'netflix-gray': '#808080',
        white: '#FFFFFF',
        black: '#000000',
        transparent: 'transparent',
        current: 'currentColor',
        green: {
          500: '#22c55e'
        },
        gray: {
          300: '#d1d5db',
          500: '#6b7280'
        },
        zinc: {
          900: '#18181b'
        }
      },
      backgroundImage: {
        'gradient-to-b': 'linear-gradient(to bottom,rgba(20,20,20,0) 0,rgba(20,20,20,.15) 15%,rgba(20,20,20,.35) 29%,rgba(20,20,20,.58) 44%,#141414 68%,#141414 100%);',
      },
      lineClamp: {
        2: '2',
        3: '3',
        4: '4'
      },
      aspectRatio: {
        'video': '16 / 9'
      },
      minWidth: {
        '100px': '100px',
        '130px': '130px',
        '220px': '220px'
      },
      minHeight: {
        '400px': '400px'
      },
      maxWidth: {
        '4xl': '56rem'
      },
      height: {
        '18px': '18px',
        '32px': '32px',
        '68px': '68px',
        '70px': '70px'
      },
      width: {
        '18px': '18px',
        '32px': '32px'
      },
      fontSize: {
        '11px': '11px',
        '13px': '13px',
        '14px': '14px',
        '16px': '16px'
      },
      padding: {
        '10px': '10px'
      },
      margin: {
        '9px': '9px',
        '10px': '10px',
        '25px': '25px'
      },
      zIndex: {
        '90': '90',
        '99': '99',
        '100': '100',
        '200': '200'
      }
    },
  },
  plugins: [
    function({ addUtilities }) {
      addUtilities({
        '.scrollbar-hide': {
          '-ms-overflow-style': 'none',
          'scrollbar-width': 'none',
          '&::-webkit-scrollbar': {
            display: 'none',
          },
        },
      });
    },
    function({ addComponents }) {
      addComponents({
        '.nav-link': {
          '@apply text-[14px] text-white hover:text-[#e5e5e5] transition-colors px-[10px]': {}
        },
        '.dropdown-link': {
          '@apply block px-[10px] py-[5px] text-[13px] text-[#b3b3b3] hover:underline': {}
        },
        '.btn-primary': {
          '@apply bg-netflix-red text-white hover:bg-[#e50914] transition-colors duration-300': {}
        },
        '.btn-secondary': {
          '@apply bg-[rgba(109,109,110,0.7)] text-white hover:bg-[rgba(109,109,110,0.4)] transition-colors duration-300': {}
        }
      });
    }
  ],
}