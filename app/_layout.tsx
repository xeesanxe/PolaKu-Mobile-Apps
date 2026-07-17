import { useFonts } from 'expo-font';
import { DarkTheme, DefaultTheme, Stack, ThemeProvider, router } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useCallback, useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import 'react-native-reanimated';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';

import { useColorScheme } from '@/components/useColorScheme';
import { auth, db } from '@/services/firebase';

export {
  ErrorBoundary,
} from 'expo-router';

export const unstable_settings = {
  initialRouteName: 'login',
};

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [loaded, error] = useFonts({
    SpaceMono: require('../assets/fonts/SpaceMono-Regular.ttf'),
  });
  // Splash tetap nutup layar sampai auth guard selesai nentuin tujuan,
  // biar Login/Register gak sempet ke-render pas user masih login (sesi persisted).
  const [authChecked, setAuthChecked] = useState(false);
  const onAuthChecked = useCallback(() => setAuthChecked(true), []);

  useEffect(() => {
    if (error) throw error;
  }, [error]);

  useEffect(() => {
    if (loaded && authChecked) {
      SplashScreen.hideAsync();
    }
  }, [loaded, authChecked]);

  if (!loaded) {
    return null;
  }

  return <RootLayoutNav authChecked={authChecked} onAuthChecked={onAuthChecked} />;
}

function RootLayoutNav({
  authChecked,
  onAuthChecked,
}: {
  authChecked: boolean;
  onAuthChecked: () => void;
}) {
  const colorScheme = useColorScheme();

  // Auth guard: Stack sudah ter-mount saat effect ini jalan,
  // sehingga router.replace aman dipanggil. Splash masih nutup layar
  // sampai onAuthChecked() dipanggil, jadi replace ini gak pernah keliatan flash.
  //
  // Nunggu authStateReady() dulu sebelum subscribe onAuthStateChanged:
  // dengan persistence AsyncStorage, callback PERTAMA onAuthStateChanged bisa
  // nembak duluan dengan user=null sebelum sesi tersimpan selesai dimuat dari
  // storage, baru nembak lagi dengan user asli — authStateReady() nunggu
  // proses baca storage itu kelar dulu, jadi callback yang kita pakai buat
  // routing udah pasti mencerminkan sesi yang sebenarnya.
  useEffect(() => {
    let unsubscribe = () => {};
    let cancelled = false;

    auth.authStateReady().then(() => {
      if (cancelled) return;

      unsubscribe = onAuthStateChanged(auth, async (user) => {
        if (!user) {
          router.replace('/login');
          onAuthChecked();
          return;
        }

        try {
          const userDoc = await getDoc(doc(db, 'users', user.uid));
          const initialSymptoms = userDoc.data()?.initialSymptoms;

          if (!initialSymptoms || initialSymptoms.length === 0) {
            router.replace('/onboarding');
          } else {
            router.replace('/(tabs)');
          }
        } catch {
          router.replace('/(tabs)');
        } finally {
          onAuthChecked();
        }
      });
    });

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [onAuthChecked]);

  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <Stack screenOptions={{ animation: 'slide_from_right' }}>
        <Stack.Screen name="login" options={{ headerShown: false }} />
        <Stack.Screen name="register" options={{ headerShown: false }} />
        <Stack.Screen name="onboarding" options={{ headerShown: false, gestureEnabled: false }} />
        <Stack.Screen name="(tabs)" options={{ headerShown: false, animation: 'fade' }} />
        <Stack.Screen name="modal" options={{ presentation: 'modal' }} />
      </Stack>
      {/* Tutup manual pakai View biasa selagi auth guard belum kelar — splash
          native (preventAutoHideAsync/hideAsync) gak kepakai di Expo Go, jadi
          gak bisa diandalkan sendirian buat nyembunyiin Login yang ke-mount
          duluan. Overlay ini yang jamin Login gak pernah keliatan, di Expo Go
          maupun development build. */}
      {!authChecked && <View style={[StyleSheet.absoluteFill, styles.cover]} />}
    </ThemeProvider>
  );
}

const styles = StyleSheet.create({
  cover: { backgroundColor: '#ffffff' },
});