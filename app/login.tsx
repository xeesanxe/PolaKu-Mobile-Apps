import { useState } from 'react';
import { Pressable, StyleSheet, TextInput, ScrollView, View as RNView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Link, router } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';

import { Text, View } from '@/components/Themed';
import { auth, db } from '@/services/firebase';
import { AuthDesign, AuthRadius, AuthSpacing, inputBoxStyle, cardStyle } from '@/constants/AuthDesign';

function getErrorMessage(code: string) {
  switch (code) {
    case 'auth/invalid-credential':
    case 'auth/wrong-password':
    case 'auth/user-not-found':
      return 'Email atau password salah.';
    case 'auth/invalid-email':
      return 'Format email tidak valid.';
    case 'auth/too-many-requests':
      return 'Terlalu banyak percobaan, coba lagi nanti.';
    default:
      return 'Gagal login. Coba lagi.';
  }
}

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    setError(null);
    if (!email || !password) {
      setError('Email dan password wajib diisi.');
      return;
    }
    setLoading(true);
    try {
      const credential = await signInWithEmailAndPassword(auth, email, password);

      // Cek apakah user sudah menyelesaikan onboarding (baseline PMA-16)
      const userDoc = await getDoc(doc(db, 'users', credential.user.uid));
      const initialSymptoms = userDoc.data()?.initialSymptoms;

      if (!initialSymptoms || initialSymptoms.length === 0) {
        router.replace('/onboarding');
      } else {
        router.replace('/(tabs)');
      }
    } catch (err: any) {
      setError(getErrorMessage(err?.code ?? ''));
    } finally {
      setLoading(false);
    }
  };

  return (
    <RNView style={[styles.page, { backgroundColor: AuthDesign.background }]}>
      <RNView style={[styles.blob, { backgroundColor: AuthDesign.brandAccent }]} />

      <SafeAreaView style={styles.safeArea}>
        <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
          <View style={styles.header} lightColor="transparent">
            <RNView style={[styles.logoBox, { backgroundColor: AuthDesign.primary }]}>
              <Text style={styles.logoText}>P</Text>
            </RNView>
            <Text style={[styles.appName, { color: AuthDesign.primary }]}>PolaKu</Text>
            <Text style={[styles.tagline, { color: AuthDesign.onSurfaceVariant }]}>
              Tingkatkan produktivitas dan keseimbangan akademik Anda.
            </Text>
          </View>

          <RNView style={[cardStyle, styles.card]}>
            <View style={styles.fieldGroup} lightColor="transparent">
              <Text style={[styles.label, { color: AuthDesign.onSurface }]}>Email</Text>
              <RNView style={inputBoxStyle}>
                <MaterialIcons name="mail" size={20} color={AuthDesign.outline} style={styles.icon} />
                <TextInput
                  value={email}
                  onChangeText={setEmail}
                  autoCapitalize="none"
                  keyboardType="email-address"
                  placeholder="nama@email.com"
                  placeholderTextColor={AuthDesign.outline}
                  style={[styles.input, { color: AuthDesign.onSurface }]}
                />
              </RNView>
            </View>

            <View style={styles.fieldGroup} lightColor="transparent">
              <View style={styles.labelRow} lightColor="transparent">
                <Text style={[styles.label, { color: AuthDesign.onSurface }]}>Password</Text>
                <Text style={[styles.forgotLink, { color: AuthDesign.primary }]}>Lupa Password?</Text>
              </View>
              <RNView style={inputBoxStyle}>
                <MaterialIcons name="lock" size={20} color={AuthDesign.outline} style={styles.icon} />
                <TextInput
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry={!showPassword}
                  placeholder="••••••••"
                  placeholderTextColor={AuthDesign.outline}
                  style={[styles.input, { color: AuthDesign.onSurface }]}
                />
                <Pressable onPress={() => setShowPassword((v) => !v)}>
                  <MaterialIcons
                    name={showPassword ? 'visibility-off' : 'visibility'}
                    size={20}
                    color={AuthDesign.outline}
                  />
                </Pressable>
              </RNView>
            </View>

            {error && <Text style={[styles.errorText, { color: AuthDesign.error }]}>{error}</Text>}

            <Pressable
              onPress={handleLogin}
              disabled={loading}
              style={[styles.submitButton, { backgroundColor: AuthDesign.primary }]}
            >
              <Text style={[styles.submitButtonText, { color: AuthDesign.onPrimary }]}>
                {loading ? 'Memproses...' : 'Masuk'}
              </Text>
            </Pressable>
          </RNView>

          <View style={styles.footerRow} lightColor="transparent">
            <Text style={[styles.footerText, { color: AuthDesign.onSurfaceVariant }]}>
              Belum punya akun PolaKu?{' '}
            </Text>
            <Link href="/register" asChild>
              <Pressable>
                <Text style={[styles.footerLink, { color: AuthDesign.primary }]}>Daftar</Text>
              </Pressable>
            </Link>
          </View>
        </ScrollView>
      </SafeAreaView>
    </RNView>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1 },
  blob: {
    position: 'absolute', bottom: -100, left: -100, width: 320, height: 320,
    borderRadius: 160, opacity: 0.15,
  },
  safeArea: { flex: 1 },
  scrollContent: { flexGrow: 1, justifyContent: 'center', padding: AuthSpacing.screenPadding },
  header: { alignItems: 'center', marginBottom: 24 },
  logoBox: {
    width: 64, height: 64, borderRadius: 18, alignItems: 'center',
    justifyContent: 'center', marginBottom: 10,
  },
  logoText: { color: '#fff', fontSize: 28, fontWeight: '700' },
  appName: { fontSize: 26, fontWeight: '700', letterSpacing: -0.3 },
  tagline: { fontSize: 13, marginTop: 6, textAlign: 'center', paddingHorizontal: 24 },
  card: { gap: AuthSpacing.fieldGap },
  fieldGroup: { gap: AuthSpacing.labelGap },
  labelRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  label: { fontSize: 13, fontWeight: '600' },
  forgotLink: { fontSize: 11, fontWeight: '600' },
  icon: { marginRight: 8 },
  input: { flex: 1, fontSize: 15 },
  errorText: { fontSize: 13, textAlign: 'center' },
  submitButton: {
    paddingVertical: 14, borderRadius: AuthRadius.button, alignItems: 'center', justifyContent: 'center',
  },
  submitButtonText: { fontSize: 14, fontWeight: '700', letterSpacing: 0.3 },
  footerRow: { flexDirection: 'row', justifyContent: 'center', marginTop: 20 },
  footerText: { fontSize: 14 },
  footerLink: { fontSize: 14, fontWeight: '700' },
});