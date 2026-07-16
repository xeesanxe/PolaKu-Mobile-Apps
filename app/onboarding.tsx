import { useState } from 'react';
import { Pressable, StyleSheet, TextInput, ScrollView, View as RNView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { doc, updateDoc } from 'firebase/firestore';

import { Text, View } from '@/components/Themed';
import { auth, db } from '@/services/firebase';
import { AuthDesign, AuthRadius, AuthSpacing, cardStyle } from '@/constants/AuthDesign';

const SYMPTOM_OPTIONS = [
  { key: 'pusing', label: 'Pusing', icon: 'sick' as const },
  { key: 'maag', label: 'Maag/asam lambung kambuh', icon: 'local-fire-department' as const },
  { key: 'capek', label: 'Capek berlebihan/mudah lelah', icon: 'battery-alert' as const },
  { key: 'insomnia', label: 'Susah tidur/insomnia', icon: 'bedtime' as const },
  { key: 'mata', label: 'Mata lelah/sakit kepala', icon: 'visibility' as const },
  { key: 'pegal', label: 'Nyeri otot/pegal', icon: 'fitness-center' as const },
];

const NONE_KEY = 'none';

export default function OnboardingScreen() {
  const [selected, setSelected] = useState<string[]>([]);
  const [customText, setCustomText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const isNoneSelected = selected.includes(NONE_KEY);

  const toggleSymptom = (key: string) => {
    setError(null);
    if (key === NONE_KEY) {
      setSelected((prev) => (prev.includes(NONE_KEY) ? [] : [NONE_KEY]));
      setCustomText('');
      return;
    }
    setSelected((prev) => {
      const withoutNone = prev.filter((k) => k !== NONE_KEY);
      return withoutNone.includes(key)
        ? withoutNone.filter((k) => k !== key)
        : [...withoutNone, key];
    });
  };

  const handleSubmit = async () => {
    setError(null);

    const finalSymptoms = isNoneSelected
      ? ['Tidak ada keluhan']
      : [
          ...selected.map((key) => SYMPTOM_OPTIONS.find((o) => o.key === key)?.label ?? key),
          ...(customText.trim() ? [customText.trim()] : []),
        ];

    if (finalSymptoms.length === 0) {
      setError('Pilih minimal satu gejala, atau pilih "Tidak ada gejala".');
      return;
    }

    const user = auth.currentUser;
    if (!user) {
      setError('Sesi tidak valid, silakan login ulang.');
      return;
    }

    setLoading(true);
    try {
      await updateDoc(doc(db, 'users', user.uid), {
        initialSymptoms: finalSymptoms,
      });
      router.replace('/(tabs)');
    } catch (err) {
      setError('Gagal menyimpan data. Coba lagi.');
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
            <RNView style={[styles.iconBadge, { backgroundColor: AuthDesign.primary }]}>
              <MaterialIcons name="health-and-safety" size={28} color="#fff" />
            </RNView>
            <Text style={[styles.title, { color: AuthDesign.onSurface }]}>
              Kenali Kondisimu Sekarang
            </Text>
            <Text style={[styles.subtitle, { color: AuthDesign.onSurfaceVariant }]}>
              Pilih gejala yang sering kamu alami akhir-akhir ini. Ini bantu PolaKu memahami
              titik awal kondisimu.
            </Text>
          </View>

          <RNView style={[cardStyle, styles.card]}>
            <RNView style={styles.chipGrid}>
              {SYMPTOM_OPTIONS.map((opt) => {
                const active = selected.includes(opt.key);
                return (
                  <Pressable
                    key={opt.key}
                    onPress={() => toggleSymptom(opt.key)}
                    disabled={isNoneSelected}
                    style={[
                      styles.chip,
                      {
                        borderColor: active ? AuthDesign.primary : AuthDesign.outlineVariant,
                        backgroundColor: active ? AuthDesign.primary + '14' : 'transparent',
                        opacity: isNoneSelected ? 0.4 : 1,
                      },
                    ]}
                  >
                    <MaterialIcons
                      name={opt.icon}
                      size={18}
                      color={active ? AuthDesign.primary : AuthDesign.outline}
                    />
                    <Text
                      style={[
                        styles.chipText,
                        { color: active ? AuthDesign.primary : AuthDesign.onSurfaceVariant },
                      ]}
                    >
                      {opt.label}
                    </Text>
                  </Pressable>
                );
              })}
            </RNView>

            <View style={styles.fieldGroup} lightColor="transparent">
              <Text style={[styles.label, { color: AuthDesign.onSurface }]}>
                Gejala lain? (opsional)
              </Text>
              <TextInput
                value={customText}
                onChangeText={setCustomText}
                editable={!isNoneSelected}
                placeholder="Tulis gejala lain yang kamu rasakan"
                placeholderTextColor={AuthDesign.outline}
                style={[
                  styles.customInput,
                  {
                    borderColor: AuthDesign.outlineVariant,
                    color: AuthDesign.onSurface,
                    opacity: isNoneSelected ? 0.4 : 1,
                  },
                ]}
              />
            </View>

            <RNView style={[styles.divider, { backgroundColor: AuthDesign.outlineVariant }]} />

            <Pressable onPress={() => toggleSymptom(NONE_KEY)} style={styles.noneRow}>
              <MaterialIcons
                name={isNoneSelected ? 'check-box' : 'check-box-outline-blank'}
                size={22}
                color={isNoneSelected ? AuthDesign.primary : AuthDesign.outline}
              />
              <Text
                style={[
                  styles.noneText,
                  { color: isNoneSelected ? AuthDesign.primary : AuthDesign.onSurfaceVariant },
                ]}
              >
                Tidak ada gejala saat ini
              </Text>
            </Pressable>

            {error && <Text style={[styles.errorText, { color: AuthDesign.error }]}>{error}</Text>}

            <Pressable
              onPress={handleSubmit}
              disabled={loading}
              style={[styles.submitButton, { backgroundColor: AuthDesign.primary }]}
            >
              <Text style={[styles.submitButtonText, { color: AuthDesign.onPrimary }]}>
                {loading ? 'Menyimpan...' : 'Lanjutkan'}
              </Text>
            </Pressable>
          </RNView>

          <Text style={[styles.footerNote, { color: AuthDesign.outline }]}>
            Data ini membantu PolaKu memahami baseline kondisimu, bukan untuk diagnosis medis.
          </Text>
        </ScrollView>
      </SafeAreaView>
    </RNView>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1 },
  blob: {
    position: 'absolute', top: -120, right: -100, width: 300, height: 300,
    borderRadius: 150, opacity: 0.25,
  },
  safeArea: { flex: 1 },
  scrollContent: { flexGrow: 1, justifyContent: 'center', padding: AuthSpacing.screenPadding },
  header: { alignItems: 'center', marginBottom: 24 },
  iconBadge: {
    width: 56, height: 56, borderRadius: 16, alignItems: 'center',
    justifyContent: 'center', marginBottom: 14,
  },
  title: { fontSize: 22, fontWeight: '700', textAlign: 'center' },
  subtitle: { fontSize: 13, marginTop: 8, textAlign: 'center', paddingHorizontal: 12, lineHeight: 19 },
  card: { gap: AuthSpacing.fieldGap },
  chipGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  chip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingVertical: 10, paddingHorizontal: 14,
    borderRadius: AuthRadius.chip, borderWidth: 1.5,
  },
  chipText: { fontSize: 13, fontWeight: '600' },
  fieldGroup: { gap: AuthSpacing.labelGap },
  label: { fontSize: 13, fontWeight: '600' },
  customInput: {
    borderWidth: 1.5, borderRadius: AuthRadius.input,
    paddingHorizontal: 14, height: 46, fontSize: 14,
  },
  divider: { height: 1, marginVertical: 2 },
  noneRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  noneText: { fontSize: 14, fontWeight: '600' },
  errorText: { fontSize: 13, textAlign: 'center' },
  submitButton: {
    paddingVertical: 14, borderRadius: AuthRadius.button, alignItems: 'center', justifyContent: 'center',
  },
  submitButtonText: { fontSize: 14, fontWeight: '700', letterSpacing: 0.3 },
  footerNote: { fontSize: 11, textAlign: 'center', marginTop: 20, paddingHorizontal: 24, lineHeight: 16 },
});