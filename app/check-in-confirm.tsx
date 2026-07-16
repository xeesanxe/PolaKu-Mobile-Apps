import { StyleSheet, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams } from 'expo-router';

import { Text, View } from '@/components/Themed';
import { AuthDesign, AuthSpacing, cardStyle } from '@/constants/AuthDesign';
import type { VoiceExtractResult } from '@/services/voice-checkin';

export default function CheckInConfirmScreen() {
  const params = useLocalSearchParams<{ result: string }>();
  const result: VoiceExtractResult = JSON.parse(params.result);

  return (
    <View style={styles.page} lightColor={AuthDesign.background}>
      <SafeAreaView style={styles.safeArea}>
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <Text style={styles.title}>Konfirmasi Hasil</Text>
          <Text style={[styles.subtitle, { color: AuthDesign.onSurfaceVariant }]}>
            Confidence: {result.confidence}
          </Text>

          <View style={[cardStyle, styles.card]}>
            <Text style={styles.debugLabel}>Transkrip:</Text>
            <Text style={{ color: AuthDesign.onSurfaceVariant, fontSize: 13 }}>
              {result.transcript}
            </Text>
          </View>

          <View style={[cardStyle, styles.card]}>
            <Text style={styles.debugLabel}>Field terdeteksi:</Text>
            <Text style={{ color: AuthDesign.onSurfaceVariant, fontSize: 13 }}>
              {JSON.stringify(result.extractedFields, null, 2)}
            </Text>
          </View>

          {result.missingFields.length > 0 && (
            <View style={[cardStyle, styles.card, { borderColor: AuthDesign.error }]}>
              <Text style={[styles.debugLabel, { color: AuthDesign.error }]}>
                Field yang perlu diisi manual:
              </Text>
              <Text style={{ color: AuthDesign.error, fontSize: 13 }}>
                {result.missingFields.join(', ')}
              </Text>
            </View>
          )}
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1 },
  safeArea: { flex: 1 },
  scrollContent: { padding: AuthSpacing.screenPadding, gap: 16 },
  title: { fontSize: 22, fontWeight: '700' },
  subtitle: { fontSize: 13 },
  card: { gap: 8 },
  debugLabel: { fontWeight: '700', fontSize: 13 },
});