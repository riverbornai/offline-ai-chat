/**
 * Below are the colors that are used in the app. The colors are defined in the light and dark mode.
 * There are many other ways to style your app. For example, [Nativewind](https://www.nativewind.dev/), [Tamagui](https://tamagui.dev/), [unistyles](https://reactnativeunistyles.vercel.app), etc.
 */

/**
 * Professional color scheme for the Speech-to-Text app
 */

// Riverborn Brand Color Scheme
const forest = '#0d2b22';      // Deep forest green (Primary brand color)
const lime = '#d4f53c';        // Vibrant yellow-green (Accent brand color)
const limeDark = '#8faa20';    // Darker lime green for readability on light backgrounds
const frost = '#f2ffee';       // Very pale minty background
const midnight = '#060f0c';    // Extremely dark green/black for dark mode background
const forestDeep = '#0d2626';  // Alternative deep forest green
const riverMist = '#9fcebe';   // Muted teal/green
const forest300 = '#6aa98c';   // Medium forest green
const stone = '#e8ede6';       // Cool grey-green for borders/light surfaces
const warning = '#fbbf24';
const error = '#ef4444';

export const Colors = {
  light: {
    text: forest,
    background: frost,
    surface: '#ffffff',
    primary: forest,
    secondary: limeDark,
    accent: lime,
    muted: '#546565',
    border: 'rgba(13, 43, 34, 0.12)',
    tint: forest,
    icon: forest,
    tabIconDefault: riverMist,
    tabIconSelected: forest,
    shadow: 'rgba(13, 43, 34, 0.08)',
    success: forest,
    warning: '#f59e0b',
    error: error,
    disabled: riverMist,
  },
  dark: {
    text: frost,
    background: midnight,
    surface: forestDeep,
    primary: lime,
    secondary: riverMist,
    accent: lime,
    muted: riverMist,
    border: 'rgba(255, 255, 255, 0.15)',
    tint: lime,
    icon: riverMist,
    tabIconDefault: forest300,
    tabIconSelected: lime,
    shadow: 'rgba(0, 0, 0, 0.4)',
    success: lime,
    warning: '#ecf9a0',
    error: error,
    disabled: forest300,
  },
};
