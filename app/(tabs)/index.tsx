import { StyleSheet, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { router } from 'expo-router';

import { Text, View } from '@/components/Themed';
import { AuthDesign, AuthSpacing } from '@/constants/AuthDesign';

export default function HomeScreen() {
  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container} lightColor={AuthDesign.background}>
        <View style={styles.iconBadge} lightColor={AuthDesign.primary}>
          <MaterialIcons name="home" size={28} color="#fff" />
        </View>
        <Text style={styles.title}>Home</Text>
        <Text style={[styles.subtitle, { color: AuthDesign.onSurfaceVariant }]}>
          Insight harian dan Daily Check-in akan tampil di sini.
        </Text>

        {/* Sementara — tombol testing PMA-24, akan dipindah ke alur Daily Check-in resmi */}
        <Pressable
          onPress={() => router.push('/check-in-voice')}
          style={[styles.testButton, { borderColor: AuthDesign.primary }]}
        >
          <Text style={{ color: AuthDesign.primary, fontWeight: '600' }}>
            🎤 Test Voice Check-in
          </Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: AuthSpacing.screenPadding,
    gap: 8,
  },
  iconBadge: {
    width: 56,
    height: 56,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  title: { fontSize: 22, fontWeight: '700' },
  subtitle: { fontSize: 13, textAlign: 'center', paddingHorizontal: 24 },
  testButton: {
    marginTop: 24,
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 10,
    borderWidth: 1.5,
  },
});