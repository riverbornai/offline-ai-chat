import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import 'react-native-get-random-values';
import 'react-native-reanimated';
import * as RN from 'react-native';
import React from 'react';

const OriginalText = RN.Text;

const SoraText = React.forwardRef((props: any, ref: any) => {
  let fontFamily = 'Sora-Medium';
  let hasWeight = false;
  const style = props.style;
  
  if (style) {
    const flatStyle = RN.StyleSheet.flatten(style);
    if (flatStyle) {
      if (flatStyle.fontFamily) {
        if (
          flatStyle.fontFamily === 'SpaceMono' ||
          flatStyle.fontFamily.startsWith('Sora-')
        ) {
          return <OriginalText ref={ref} {...props} />;
        }
      }
      
      if (
        flatStyle.fontWeight === 'bold' || 
        flatStyle.fontWeight === '700' || 
        flatStyle.fontWeight === '800' || 
        flatStyle.fontWeight === '900' ||
        flatStyle.fontWeight === 'semibold' ||
        flatStyle.fontWeight === '600'
      ) {
        fontFamily = 'Sora-Bold';
        hasWeight = true;
      } else if (
        flatStyle.fontWeight === '300' || 
        flatStyle.fontWeight === '100' || 
        flatStyle.fontWeight === '200'
      ) {
        fontFamily = 'Sora-Light';
        hasWeight = true;
      } else if (flatStyle.fontWeight) {
        hasWeight = true;
      }
    }
  }

  const newStyle = hasWeight
    ? [style, { fontFamily, fontWeight: 'normal' as const }]
    : [style, { fontFamily }];

  return <OriginalText ref={ref} {...props} style={newStyle} />;
});

// Copy all static properties of Text
Object.keys(OriginalText).forEach(key => {
  (SoraText as any)[key] = (OriginalText as any)[key];
});

try {
  Object.defineProperty(RN, 'Text', {
    get() {
      return SoraText;
    },
    configurable: true,
  });
} catch (e) {
  console.warn('Failed to globally override RN.Text via defineProperty:', e);
  try {
    (RN as any).Text = SoraText;
  } catch (err) {
    console.warn('Failed to globally override RN.Text via direct assignment:', err);
  }
}

import { useColorScheme } from '@/hooks/useColorScheme';
import { StoreProvider } from '../components/StoreProvider';
import { quickSetup } from '../utils/modelSetup';

import { Colors } from '../constants/Colors';

const CustomLightTheme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    primary: Colors.light.primary,
    background: Colors.light.background,
    card: Colors.light.surface,
    text: Colors.light.text,
    border: Colors.light.border,
  },
};

const CustomDarkTheme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    primary: Colors.dark.primary,
    background: Colors.dark.background,
    card: Colors.dark.surface,
    text: Colors.dark.text,
    border: Colors.dark.border,
  },
};

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const [loaded] = useFonts({
    SpaceMono: require('../assets/fonts/SpaceMono-Regular.ttf'),
    'Sora-Light': require('../assets/fonts/Sora-Light.ttf'),
    'Sora-Medium': require('../assets/fonts/Sora-Medium.ttf'),
    'Sora-Bold': require('../assets/fonts/Sora-Bold.ttf'),
  });

  // Initialize models on app start
  useEffect(() => {
    const initializeModels = async () => {
      try {
        console.log('🚀 Initializing language learning models...');
        await quickSetup();
      } catch (error) {
        console.error('Failed to initialize models:', error);
        // App continues to work, user can manually initialize from Models tab
      }
    };

    // Only initialize after fonts are loaded
    if (loaded) {
      initializeModels();
    }
  }, [loaded]);

  if (!loaded) {
    // Async font loading only occurs in development.
    return null;
  }

  return (
    <StoreProvider>
      <ThemeProvider value={colorScheme === 'dark' ? CustomDarkTheme : CustomLightTheme}>
        <Stack>
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen name="+not-found" />
        </Stack>
        <StatusBar style="auto" />
      </ThemeProvider>
    </StoreProvider>
  );
}
