import { useState } from 'react';
import { Pressable, StyleSheet, TextInput, ScrollView, View as RNView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';

import { Text, View } from '@/components/Themed';
import { auth, db } from '@/services/firebase';
import { AuthDesign, AuthRadius, AuthSpacing, inputBoxStyle, cardStyle } from '@/constants/AuthDesign';

function getErrorMessage(code: string) {
  switch (code) {
    case 'auth/email-already-in-use':
      return 'Email sudah terdaftar, silakan login.';
    case 'auth/invalid-email':
      return 'Format email tidak valid.';
    case 'auth/weak-password':
      return 'Password terlalu lemah, minimal 6 karakter.';
    default:
      return 'Gagal mendaftar. Coba lagi.';
  }
}

export default function RegisterScreen() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const goToLogin = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/login');
    }
  };

  const handleRegister = async () => {
    setError(null);

    if (!name || !email || !password || !confirmPassword) {
      setError('Semua field wajib diisi.');
      return;
    }
    if (password.length < 6) {
      setError('Password minimal 6 karakter.');
      return;
    }
    if (password !== confirmPassword) {
      setError('Konfirmasi password tidak cocok.');
      return;
    }

    setLoading(true);
    try {
      const credential = await createUserWithEmailAndPassword(auth, email, password);

      await setDoc(doc(db, 'users', credential.user.uid), {
        name,
        email,
        initialSymptoms: [],
        createdAt: serverTimestamp(),
      });

      // User baru wajib lewat Onboarding sebelum masuk Home
      router.replace('/onboarding');
    } catch (err: any) {
      setError(getErrorMessage(err?.code ?? ''));
    } finally {
      setLoading(false);
    }
  };

  return (
    <RNView style={[styles.page, { backgroundColor: AuthDesign.background }]}>
      <RNView style={[styles.blobTopLeft, { backgroundColor: AuthDesign.brandAccent }]} />
      <RNView style={[styles.blobBottomRight, { backgroundColor: AuthDesign.brandAccent }]} />

      <SafeAreaView style={styles.safeArea}>
        <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
          <View style={styles.header} lightColor="transparent">
            <RNView style={[styles.logoBox, { backgroundColor: AuthDesign.primary }]}>
              <Text style={styles.logoText}>P</Text>
            </RNView>
            <Text style={[styles.appName, { color: AuthDesign.primary }]}>PolaKu</Text>
            <Text style={[styles.tagline, { color: AuthDesign.onSurfaceVariant }]}>
              Mulai perjalanan produktivitasmu hari ini.
            </Text>
          </View>

          <RNView style={[cardStyle, styles.card]}>
            <View style={styles.fieldGroup} lightColor="transparent">
              <Text style={[styles.label, { color: AuthDesign.onSurface }]}>Nama Lengkap</Text>
              <RNView style={inputBoxStyle}>
                <MaterialIcons name="person" size={20} color={AuthDesign.outline} style={styles.icon} />
                <TextInput
                  value={name}
                  onChangeText={setName}
                  placeholder="Masukkan nama lengkap"
                  placeholderTextColor={AuthDesign.outline}
                  style={[styles.input, { color: AuthDesign.onSurface }]}
                />
              </RNView>
            </View>

            <View style={styles.fieldGroup} lightColor="transparent">
              <Text style={[styles.label, { color: AuthDesign.onSurface }]}>Email</Text>
              <RNView style={inputBoxStyle}>
                <MaterialIcons name="mail" size={20} color={AuthDesign.outline} style={styles.icon} />
                <TextInput
                  value={email}
                  onChangeText={setEmail}
                  autoCapitalize="none"
                  keyboardType="email-address"
                  placeholder="contoh@student.id"
                  placeholderTextColor={AuthDesign.outline}
                  style={[styles.input, { color: AuthDesign.onSurface }]}
                />
              </RNView>
            </View>

            <View style={styles.fieldGroup} lightColor="transparent">
              <Text style={[styles.label, { color: AuthDesign.onSurface }]}>Password</Text>
              <RNView style={inputBoxStyle}>
                <MaterialIcons name="lock" size={20} color={AuthDesign.outline} style={styles.icon} />
                <TextInput
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry={!showPassword}
                  placeholder="Minimal 6 karakter"
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

            <View style={styles.fieldGroup} lightColor="transparent">
              <Text style={[styles.label, { color: AuthDesign.onSurface }]}>Konfirmasi Password</Text>
              <RNView style={inputBoxStyle}>
                <MaterialIcons name="lock" size={20} color={AuthDesign.outline} style={styles.icon} />
                <TextInput
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                  secureTextEntry={!showConfirmPassword}
                  placeholder="Ulangi password"
                  placeholderTextColor={AuthDesign.outline}
                  style={[styles.input, { color: AuthDesign.onSurface }]}
                />
                <Pressable onPress={() => setShowConfirmPassword((v) => !v)}>
                  <MaterialIcons
                    name={showConfirmPassword ? 'visibility-off' : 'visibility'}
                    size={20}
                    color={AuthDesign.outline}
                  />
                </Pressable>
              </RNView>
            </View>

            {error && <Text style={[styles.errorText, { color: AuthDesign.error }]}>{error}</Text>}

            <Pressable
              onPress={handleRegister}
              disabled={loading}
              style={[styles.submitButton, { backgroundColor: AuthDesign.primary }]}
            >
              <Text style={[styles.submitButtonText, { color: AuthDesign.onPrimary }]}>
                {loading ? 'Memproses...' : 'Daftar'}
              </Text>
            </Pressable>

            <View style={styles.loginRow} lightColor="transparent">
              <Text style={[styles.loginText, { color: AuthDesign.onSurfaceVariant }]}>
                Sudah punya akun?{' '}
              </Text>
              <Pressable onPress={goToLogin}>
                <Text style={[styles.loginLink, { color: AuthDesign.primary }]}>Masuk</Text>
              </Pressable>
            </View>
          </RNView>

          <Text style={[styles.footerText, { color: AuthDesign.outline }]}>
            Dengan mendaftar, Anda menyetujui Ketentuan Layanan dan Kebijakan Privasi PolaKu.
          </Text>
        </ScrollView>
      </SafeAreaView>
    </RNView>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1 },
  blobTopLeft: {
    position: 'absolute', top: -100, left: -100, width: 260, height: 260,
    borderRadius: 130, opacity: 0.3,
  },
  blobBottomRight: {
    position: 'absolute', bottom: -60, right: -100, width: 260, height: 260,
    borderRadius: 130, opacity: 0.3,
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
  tagline: { fontSize: 13, marginTop: 6, textAlign: 'center' },
  card: { gap: AuthSpacing.fieldGap },
  fieldGroup: { gap: AuthSpacing.labelGap },
  label: { fontSize: 13, fontWeight: '600' },
  icon: { marginRight: 8 },
  input: { flex: 1, fontSize: 15 },
  errorText: { fontSize: 13, textAlign: 'center' },
  submitButton: {
    paddingVertical: 14, borderRadius: AuthRadius.button, alignItems: 'center', justifyContent: 'center',
  },
  submitButtonText: { fontSize: 14, fontWeight: '700', letterSpacing: 0.3 },
  loginRow: { flexDirection: 'row', justifyContent: 'center', marginTop: 4 },
  loginText: { fontSize: 14 },
  loginLink: { fontSize: 14, fontWeight: '700' },
  footerText: { fontSize: 11, textAlign: 'center', marginTop: 24, paddingHorizontal: 20 },
});