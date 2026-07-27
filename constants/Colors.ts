/**
 * Riverborn Design System — Brand Colors & Theme Palette
 * Vendored from riverborn-website (styles/riverborn-tokens.css)
 */

// ---- PRIMARY PALETTE ----
export const RiverbornTokens = {
  // Core Brand Colors
  forest: '#0d2b22',       // Primary deep forest green
  lime: '#d4f53c',         // Vibrant yellow-green accent
  frost: '#f2ffee',        // Light mint/frost page background
  midnight: '#060f0c',     // Deep dark background
  forestDeep: '#0d2626',   // Dark forest surface

  // Supporting Neutrals
  white: '#ffffff',
  riverMist: '#9fcebe',    // Soft teal green
  deepForest: '#1a4435',   // Secondary dark green
  stone: '#e8ede6',        // Cool grey-green border/surface
  frostTint: '#ebf5f1',    // Subtle tinted surface

  // Forest Tint / Shade Scale
  forest50: '#ebf5f1',
  forest100: '#cce8df',
  forest200: '#9fcebe',
  forest300: '#6aa98c',
  forest400: '#33755a',
  forest500: '#265c48',
  forest600: '#1a4435',
  forest700: '#0d2b22',
  forest800: '#091e17',
  forest900: '#060f0c',

  // Lime Tint / Shade Scale
  lime50: '#fafeed',
  lime100: '#f6fcd2',
  lime200: '#f1fbb9',
  lime300: '#ecf9a0',
  lime400: '#e6f887',
  lime500: '#e0f76e',
  lime600: '#daf655',
  lime700: '#d4f53c',
  lime800: '#b8d830',
  lime900: '#8faa20',

  // Functional Colors
  warning: '#f59e0b',
  error: '#ef4444',
  success: '#10b981',
};

const {
  forest,
  lime,
  frost,
  midnight,
  forestDeep,
  white,
  riverMist,
  stone,
  forest300,
  forest500,
  forest50,
  lime900,
  lime300,
  warning,
  error,
} = RiverbornTokens;

export const Colors = {
  brand: RiverbornTokens,

  light: {
    text: forest,
    textSecondary: forest500,
    background: frost,
    surface: white,
    surfaceMuted: forest50,
    primary: forest,
    secondary: lime900,
    accent: lime,
    muted: '#546565',
    border: 'rgba(13, 43, 34, 0.12)',
    borderStrong: forest,
    tint: forest,
    icon: forest,
    tabIconDefault: riverMist,
    tabIconSelected: forest,
    shadow: 'rgba(13, 43, 34, 0.08)',
    success: forest,
    warning: warning,
    error: error,
    disabled: riverMist,
  },
  dark: {
    text: frost,
    textSecondary: riverMist,
    background: midnight,
    surface: forestDeep,
    surfaceMuted: '#091e17',
    primary: lime,
    secondary: riverMist,
    accent: lime,
    muted: riverMist,
    border: 'rgba(255, 255, 255, 0.15)',
    borderStrong: riverMist,
    tint: lime,
    icon: riverMist,
    tabIconDefault: forest300,
    tabIconSelected: lime,
    shadow: 'rgba(0, 0, 0, 0.4)',
    success: lime,
    warning: lime300,
    error: error,
    disabled: forest300,
  },
};
