/**
 * Below are the colors that are used in the app. The colors are defined in the light and dark mode.
 * There are many other ways to style your app. For example, [Nativewind](https://www.nativewind.dev/), [Tamagui](https://tamagui.dev/), [unistyles](https://reactnativeunistyles.vercel.app), etc.
 */

/**
 * Professional color scheme for the Speech-to-Text app
 */

const primaryBlue = '#3b82f6';
const primaryGreen = '#10b981';
const primaryRed = '#ef4444';
const neutralGray = '#64748b';
const lightGray = '#f1f5f9';
const darkGray = '#1e293b';

export const Colors = {
  light: {
    text: '#1a1a1a',
    background: '#f8fafc',
    surface: '#ffffff',
    primary: primaryBlue,
    secondary: primaryGreen,
    accent: primaryRed,
    muted: neutralGray,
    border: '#e2e8f0',
    tint: primaryBlue,
    icon: '#64748b',
    tabIconDefault: '#94a3b8',
    tabIconSelected: primaryBlue,
    shadow: 'rgba(0, 0, 0, 0.1)',
    success: primaryGreen,
    warning: '#f59e0b',
    error: primaryRed,
    disabled: '#94a3b8',
  },
  dark: {
    text: '#f8fafc',
    background: '#0f172a',
    surface: '#1e293b',
    primary: '#60a5fa',
    secondary: '#34d399',
    accent: '#f87171',
    muted: '#94a3b8',
    border: '#334155',
    tint: '#60a5fa',
    icon: '#94a3b8',
    tabIconDefault: '#64748b',
    tabIconSelected: '#60a5fa',
    shadow: 'rgba(0, 0, 0, 0.3)',
    success: '#34d399',
    warning: '#fbbf24',
    error: '#f87171',
    disabled: '#64748b',
  },
};
