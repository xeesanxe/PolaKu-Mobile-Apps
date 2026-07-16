import { useState } from 'react';
import { StyleSheet, Pressable, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';

import { Text, View } from '@/components/Themed';
import { VoiceRecorder } from '@/components/voice-recorder';
import { extractVoiceCheckIn } from '@/services/voice-checkin';
import { AuthDesign, AuthSpacing, AuthRadius, cardStyle } from '@/constants/AuthDesign';

export default function CheckInVoiceScreen() {
  const [recordingUri, setRecordingUri] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleContinue = async () => {
    if (!recordingUri) return;
    setError(null);
    setProcessing(true);
    try {
      const result = await extractVoiceCheckIn(recordingUri);
      router.push({
        pathname: '/check-in-confirm',
        params: { result: JSON.stringify(result) },
      });
    } catch (err: any) {
      setError(
        err?.message ?? 'Rekaman tidak dapat diproses, coba rekam ulang atau gunakan mode pilihan.',
      );
    } finally {
      setProcessing(false);
    }
  };

  return (
    <View style={styles.page} lightColor={AuthDesign.background}>
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.headerRow} lightColor="transparent">
          <Pressable onPress={() => router.back()} style={styles.backButton}>
            <MaterialIcons name="arrow-back" size={22} color={AuthDesign.onSurface} />
          </Pressable>
          <Text style={styles.headerTitle}>Voice Check-in</Text>
          <View style={styles.headerSpacer} lightColor="transparent" />
        </View>

        <ScrollView contentContainerStyle={styles.scrollContent}>
          <View style={[cardStyle, styles.card]}>
            <VoiceRecorder
              onRecordingReady={setRecordingUri}
              onReset={() => setRecordingUri(null)}
            />
          </View>

          {error && (
            <Text style={{ color: AuthDesign.error, fontSize: 13, textAlign: 'center' }}>
              {error}
            </Text>
          )}

          <Pressable
            onPress={handleContinue}
            disabled={!recordingUri || processing}
            style={[
              styles.continueButton,
              { backgroundColor: recordingUri ? AuthDesign.primary : AuthDesign.outlineVariant },
            ]}
          >
            <Text
              style={[
                styles.continueButtonText,
                { color: recordingUri ? AuthDesign.onPrimary : AuthDesign.outline },
              ]}
            >
              {processing ? 'Memproses rekaman...' : 'Gunakan Rekaman Ini'}
            </Text>
          </Pressable>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1 },
  safeArea: { flex: 1 },
  headerRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: AuthSpacing.screenPadding, paddingVertical: 12,
  },
  backButton: { padding: 4 },
  headerTitle: { flex: 1, textAlign: 'center', fontSize: 16, fontWeight: '700' },
  headerSpacer: { width: 30 },
  scrollContent: { padding: AuthSpacing.screenPadding, gap: 20, flexGrow: 1 },
  card: { minHeight: 260, justifyContent: 'center' },
  continueButton: {
    paddingVertical: 16, borderRadius: AuthRadius.button,
    alignItems: 'center', justifyContent: 'center',
  },
  continueButtonText: { fontSize: 15, fontWeight: '700' },
});