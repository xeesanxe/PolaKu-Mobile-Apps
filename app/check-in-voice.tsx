import { useState } from 'react';
import { StyleSheet, Pressable, ScrollView, TextInput, ActivityIndicator, View as RNView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';

import { Text, View } from '@/components/Themed';
import { VoiceRecorder } from '@/components/voice-recorder';
import { extractVoiceCheckIn, saveDailyLog, type ExtractedFields } from '@/services/voice-checkin';
import { AuthDesign, AuthSpacing, AuthRadius, cardStyle } from '@/constants/AuthDesign';

const MOOD_OPTIONS = ['senang', 'biasa', 'sedih', 'marah', 'kecewa', 'cemas'];
const SYMPTOM_OPTIONS = [
  'Pusing',
  'Maag/asam lambung kambuh',
  'Capek berlebihan/mudah lelah',
  'Susah tidur/insomnia',
  'Mata lelah/sakit kepala',
  'Nyeri otot/pegal',
];

const FIELD_QUESTIONS: Record<string, string> = {
  sleepHours: 'Berapa jam kamu tidur semalam?',
  symptoms: 'Ada keluhan fisik yang kamu rasakan hari ini?',
  mealFrequency: 'Berapa kali kamu makan hari ini?',
  stressLevel: 'Seberapa stres perasaanmu hari ini? (0-100)',
  mood: 'Bagaimana mood kamu hari ini?',
};

const FIELD_LABELS: Record<string, string> = {
  sleepHours: 'Jam Tidur',
  symptoms: 'Gejala',
  mealFrequency: 'Frekuensi Makan',
  stressLevel: 'Level Stres',
  mood: 'Mood',
};

const FIELD_ICONS: Record<string, keyof typeof MaterialIcons.glyphMap> = {
  sleepHours: 'bedtime',
  symptoms: 'healing',
  mealFrequency: 'restaurant',
  stressLevel: 'psychology',
  mood: 'sentiment-satisfied',
};

type Phase = 'intro' | 'processing' | 'followup' | 'summary' | 'submitting';

export default function CheckInVoiceScreen() {
  const [phase, setPhase] = useState<Phase>('intro');
  const [fields, setFields] = useState<ExtractedFields>({});
  const [missingFields, setMissingFields] = useState<string[]>([]);
  const [lastTranscript, setLastTranscript] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [manualInput, setManualInput] = useState('');
  const [editingField, setEditingField] = useState<string | null>(null);

  const currentMissingField = missingFields[0];
  const filledCount = Object.keys(FIELD_LABELS).length - missingFields.length;
  const totalCount = Object.keys(FIELD_LABELS).length;

  const processRecording = async (uri: string) => {
    setPhase('processing');
    setError(null);
    try {
      const result = await extractVoiceCheckIn(uri);
      setLastTranscript(result.transcript);

      const merged = { ...fields, ...result.extractedFields };
      setFields(merged);

      const stillMissing = Object.keys(FIELD_QUESTIONS).filter(
        (key) => merged[key as keyof ExtractedFields] === undefined,
      );
      setMissingFields(stillMissing);

      setPhase(stillMissing.length > 0 ? 'followup' : 'summary');
    } catch (err: any) {
      setError(err?.message ?? 'Gagal memproses rekaman. Coba lagi.');
      setPhase('intro');
    }
  };

  const handleManualSubmit = () => {
    if (!currentMissingField || !manualInput.trim()) return;

    let value: any = manualInput.trim();
    if (
      currentMissingField === 'sleepHours' ||
      currentMissingField === 'mealFrequency' ||
      currentMissingField === 'stressLevel'
    ) {
      value = Number(value);
      if (isNaN(value)) return;
    }
    if (currentMissingField === 'symptoms') {
      value = [manualInput.trim()];
    }

    const merged = { ...fields, [currentMissingField]: value };
    setFields(merged);
    setManualInput('');

    const remaining = missingFields.slice(1);
    setMissingFields(remaining);
    setPhase(remaining.length > 0 ? 'followup' : 'summary');
  };

  const handleChoiceSubmit = (value: string) => {
    const merged = { ...fields, [currentMissingField]: value };
    setFields(merged);

    const remaining = missingFields.slice(1);
    setMissingFields(remaining);
    setPhase(remaining.length > 0 ? 'followup' : 'summary');
  };

  const toggleSymptomChoice = (symptom: string) => {
    const current = (fields.symptoms as string[]) || [];
    const updated = current.includes(symptom)
      ? current.filter((s) => s !== symptom)
      : [...current, symptom];
    setFields({ ...fields, symptoms: updated });
  };

  const confirmSymptomChoice = () => {
    const remaining = missingFields.slice(1);
    setMissingFields(remaining);
    setPhase(remaining.length > 0 ? 'followup' : 'summary');
  };

  const handleSubmit = async () => {
    setPhase('submitting');
    setError(null);
    try {
      const today = new Date().toISOString().split('T')[0];
      await saveDailyLog({
        date: today,
        sleepHours: fields.sleepHours!,
        symptoms: fields.symptoms || [],
        mealFrequency: fields.mealFrequency!,
        stressLevel: fields.stressLevel!,
        mood: fields.mood!,
        inputMethod: 'voice',
      });
      router.replace('/(tabs)');
    } catch (err: any) {
      setError(err?.message ?? 'Gagal menyimpan. Coba lagi.');
      setPhase('summary');
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

        {phase !== 'intro' && (
          <View style={styles.progressRow} lightColor="transparent">
            {Object.keys(FIELD_LABELS).map((key) => {
              const isFilled = fields[key as keyof ExtractedFields] !== undefined;
              return (
                <RNView
                  key={key}
                  style={[
                    styles.progressDot,
                    { backgroundColor: isFilled ? AuthDesign.primary : AuthDesign.outlineVariant },
                  ]}
                />
              );
            })}
            <Text style={[styles.progressText, { color: AuthDesign.onSurfaceVariant }]}>
              {filledCount}/{totalCount} terisi
            </Text>
          </View>
        )}

        <ScrollView contentContainerStyle={styles.scrollContent}>
          {error && (
            <View style={[styles.errorBox, { backgroundColor: AuthDesign.error + '10' }]}>
              <MaterialIcons name="error-outline" size={16} color={AuthDesign.error} />
              <Text style={{ color: AuthDesign.error, fontSize: 13, flex: 1 }}>{error}</Text>
            </View>
          )}

          {phase === 'intro' && (
            <View style={[cardStyle, styles.card]}>
              <RNView style={[styles.introIcon, { backgroundColor: AuthDesign.primary + '12' }]}>
                <MaterialIcons name="record-voice-over" size={32} color={AuthDesign.primary} />
              </RNView>
              <Text style={styles.promptTitle}>Ceritakan keseharianmu</Text>
              <Text style={[styles.promptHint, { color: AuthDesign.onSurfaceVariant }]}>
                Sebutkan kalau bisa: jam tidur, keluhan fisik, jumlah makan, tingkat stres, dan
                mood kamu hari ini. Ngobrol santai aja, nggak perlu berurutan.
              </Text>
              <VoiceRecorder onRecordingReady={processRecording} onReset={() => {}} />
            </View>
          )}

          {phase === 'processing' && (
            <View style={[cardStyle, styles.card, styles.centerContent]}>
              <ActivityIndicator color={AuthDesign.primary} size="large" />
              <Text style={{ color: AuthDesign.onSurfaceVariant, marginTop: 12, fontSize: 14 }}>
                Mendengarkan dan memahami ceritamu...
              </Text>
            </View>
          )}

          {(phase === 'followup' || phase === 'summary') && lastTranscript && (
            <View style={[cardStyle, styles.transcriptCard]}>
              <View style={styles.transcriptHeader} lightColor="transparent">
                <MaterialIcons name="format-quote" size={16} color={AuthDesign.outline} />
                <Text style={[styles.debugLabel, { color: AuthDesign.onSurfaceVariant }]}>
                  Kamu bilang
                </Text>
              </View>
              <Text style={{ color: AuthDesign.onSurface, fontSize: 14, lineHeight: 20 }}>
                {lastTranscript}
              </Text>
            </View>
          )}

          {phase === 'followup' && currentMissingField && (
            <View style={[cardStyle, styles.card]}>
              <RNView style={[styles.followupIcon, { backgroundColor: AuthDesign.primary + '12' }]}>
                <MaterialIcons
                  name={FIELD_ICONS[currentMissingField]}
                  size={24}
                  color={AuthDesign.primary}
                />
              </RNView>
              <Text style={styles.promptTitle}>{FIELD_QUESTIONS[currentMissingField]}</Text>

              <VoiceRecorder onRecordingReady={processRecording} onReset={() => {}} />

              <View style={styles.dividerRow} lightColor="transparent">
                <RNView style={[styles.dividerLine, { backgroundColor: AuthDesign.outlineVariant }]} />
                <Text style={[styles.orText, { color: AuthDesign.outline }]}>atau ketik</Text>
                <RNView style={[styles.dividerLine, { backgroundColor: AuthDesign.outlineVariant }]} />
              </View>

              {currentMissingField === 'mood' ? (
                <View style={styles.chipGrid}>
                  {MOOD_OPTIONS.map((m) => (
                    <Pressable
                      key={m}
                      onPress={() => handleChoiceSubmit(m)}
                      style={[styles.chip, { borderColor: AuthDesign.outlineVariant }]}
                    >
                      <Text style={{ color: AuthDesign.onSurface, fontSize: 13 }}>{m}</Text>
                    </Pressable>
                  ))}
                </View>
              ) : currentMissingField === 'symptoms' ? (
                <>
                  <View style={styles.chipGrid}>
                    {SYMPTOM_OPTIONS.map((s) => {
                      const active = ((fields.symptoms as string[]) || []).includes(s);
                      return (
                        <Pressable
                          key={s}
                          onPress={() => toggleSymptomChoice(s)}
                          style={[
                            styles.chip,
                            {
                              borderColor: active ? AuthDesign.primary : AuthDesign.outlineVariant,
                              backgroundColor: active ? AuthDesign.primary + '14' : 'transparent',
                            },
                          ]}
                        >
                          <Text
                            style={{
                              color: active ? AuthDesign.primary : AuthDesign.onSurface,
                              fontSize: 13,
                            }}
                          >
                            {s}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>
                  <Pressable
                    onPress={confirmSymptomChoice}
                    style={[styles.continueButton, { backgroundColor: AuthDesign.primary }]}
                  >
                    <Text style={[styles.continueButtonText, { color: AuthDesign.onPrimary }]}>
                      Lanjut
                    </Text>
                  </Pressable>
                </>
              ) : (
                <>
                  <TextInput
                    value={manualInput}
                    onChangeText={setManualInput}
                    keyboardType="numeric"
                    placeholder="Ketik jawaban di sini"
                    placeholderTextColor={AuthDesign.outline}
                    style={[
                      styles.textInput,
                      { borderColor: AuthDesign.outlineVariant, color: AuthDesign.onSurface },
                    ]}
                  />
                  <Pressable
                    onPress={handleManualSubmit}
                    style={[styles.continueButton, { backgroundColor: AuthDesign.primary }]}
                  >
                    <Text style={[styles.continueButtonText, { color: AuthDesign.onPrimary }]}>
                      Lanjut
                    </Text>
                  </Pressable>
                </>
              )}
            </View>
          )}

          {(phase === 'summary' || phase === 'submitting') && (
            <View style={[cardStyle, styles.card]}>
              <View style={styles.summaryHeaderRow} lightColor="transparent">
                <MaterialIcons name="checklist" size={20} color={AuthDesign.primary} />
                <Text style={styles.promptTitle}>Ringkasan Hari Ini</Text>
              </View>

              {Object.entries(FIELD_LABELS).map(([key, label]) =>
                editingField === key ? (
                  <View key={key} style={styles.editRow} lightColor="transparent">
                    <Text
                      style={{ color: AuthDesign.onSurfaceVariant, fontSize: 13, marginBottom: 6 }}
                    >
                      {label}
                    </Text>
                    {key === 'mood' ? (
                      <View style={styles.chipGrid}>
                        {MOOD_OPTIONS.map((m) => (
                          <Pressable
                            key={m}
                            onPress={() => {
                              setFields({ ...fields, mood: m });
                              setEditingField(null);
                            }}
                            style={[
                              styles.chip,
                              {
                                borderColor:
                                  fields.mood === m ? AuthDesign.primary : AuthDesign.outlineVariant,
                                backgroundColor:
                                  fields.mood === m ? AuthDesign.primary + '14' : 'transparent',
                              },
                            ]}
                          >
                            <Text style={{ color: AuthDesign.onSurface, fontSize: 13 }}>{m}</Text>
                          </Pressable>
                        ))}
                      </View>
                    ) : key === 'symptoms' ? (
                      <>
                        <View style={styles.chipGrid}>
                          {SYMPTOM_OPTIONS.map((s) => {
                            const active = ((fields.symptoms as string[]) || []).includes(s);
                            return (
                              <Pressable
                                key={s}
                                onPress={() => toggleSymptomChoice(s)}
                                style={[
                                  styles.chip,
                                  {
                                    borderColor: active
                                      ? AuthDesign.primary
                                      : AuthDesign.outlineVariant,
                                    backgroundColor: active
                                      ? AuthDesign.primary + '14'
                                      : 'transparent',
                                  },
                                ]}
                              >
                                <Text
                                  style={{
                                    color: active ? AuthDesign.primary : AuthDesign.onSurface,
                                    fontSize: 13,
                                  }}
                                >
                                  {s}
                                </Text>
                              </Pressable>
                            );
                          })}
                        </View>
                        <Pressable
                          onPress={() => setEditingField(null)}
                          style={[styles.smallDoneButton, { borderColor: AuthDesign.primary }]}
                        >
                          <Text style={{ color: AuthDesign.primary, fontSize: 12, fontWeight: '600' }}>
                            Selesai
                          </Text>
                        </Pressable>
                      </>
                    ) : (
                      <TextInput
                        value={String(fields[key as keyof ExtractedFields] ?? '')}
                        onChangeText={(text) => {
                          const num = Number(text);
                          setFields({ ...fields, [key]: isNaN(num) ? text : num });
                        }}
                        onBlur={() => setEditingField(null)}
                        keyboardType="numeric"
                        autoFocus
                        style={[
                          styles.textInput,
                          { borderColor: AuthDesign.primary, color: AuthDesign.onSurface },
                        ]}
                      />
                    )}
                  </View>
                ) : (
                  <Pressable key={key} onPress={() => setEditingField(key)} style={styles.summaryRow}>
                    <View style={styles.summaryLeftRow} lightColor="transparent">
                      <MaterialIcons name={FIELD_ICONS[key]} size={18} color={AuthDesign.outline} />
                      <Text style={{ color: AuthDesign.onSurfaceVariant, fontSize: 13 }}>{label}</Text>
                    </View>
                    <View style={styles.summaryValueRow} lightColor="transparent">
                      <Text style={{ color: AuthDesign.onSurface, fontSize: 13, fontWeight: '600' }}>
                        {Array.isArray(fields[key as keyof ExtractedFields])
                          ? (fields[key as keyof ExtractedFields] as string[]).join(', ') || '-'
                          : String(fields[key as keyof ExtractedFields] ?? '-')}
                      </Text>
                      <MaterialIcons name="edit" size={14} color={AuthDesign.outline} />
                    </View>
                  </Pressable>
                ),
              )}

              <View style={styles.actionRow} lightColor="transparent">
                <Pressable
                  onPress={() => {
                    setPhase('intro');
                    setFields({});
                    setMissingFields([]);
                    setLastTranscript('');
                  }}
                  style={[styles.adjustButton, { borderColor: AuthDesign.outlineVariant }]}
                >
                  <Text style={{ color: AuthDesign.onSurfaceVariant, fontWeight: '600' }}>
                    Rekam Ulang
                  </Text>
                </Pressable>

                <Pressable
                  onPress={handleSubmit}
                  disabled={phase === 'submitting'}
                  style={[styles.submitButton, { backgroundColor: AuthDesign.primary }]}
                >
                  <Text style={[styles.continueButtonText, { color: AuthDesign.onPrimary }]}>
                    {phase === 'submitting' ? 'Menyimpan...' : 'Submit'}
                  </Text>
                </Pressable>
              </View>
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
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: AuthSpacing.screenPadding,
    paddingVertical: 12,
  },
  backButton: { padding: 4 },
  headerTitle: { flex: 1, textAlign: 'center', fontSize: 16, fontWeight: '700' },
  headerSpacer: { width: 30 },
  progressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingBottom: 12,
  },
  progressDot: { width: 8, height: 8, borderRadius: 4 },
  progressText: { fontSize: 11, marginLeft: 6 },
  scrollContent: { padding: AuthSpacing.screenPadding, gap: 16, flexGrow: 1 },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 12,
    borderRadius: 10,
  },
  card: { gap: 12, alignItems: 'center' },
  introIcon: { width: 64, height: 64, borderRadius: 32, alignItems: 'center', justifyContent: 'center' },
  followupIcon: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
  centerContent: { alignItems: 'center', justifyContent: 'center', paddingVertical: 40 },
  promptTitle: { fontSize: 17, fontWeight: '700', textAlign: 'center' },
  promptHint: { fontSize: 13, lineHeight: 19, textAlign: 'center' },
  transcriptCard: { gap: 8, backgroundColor: 'transparent' },
  transcriptHeader: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  debugLabel: { fontWeight: '600', fontSize: 12 },
  dividerRow: { flexDirection: 'row', alignItems: 'center', gap: 10, width: '100%' },
  dividerLine: { flex: 1, height: 1 },
  orText: { fontSize: 11 },
  chipGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, justifyContent: 'center' },
  chip: { paddingVertical: 8, paddingHorizontal: 14, borderRadius: 999, borderWidth: 1.5 },
  textInput: {
    borderWidth: 1.5,
    borderRadius: AuthRadius.input,
    paddingHorizontal: 14,
    height: 46,
    fontSize: 14,
    width: '100%',
  },
  continueButton: {
    paddingVertical: 14,
    borderRadius: AuthRadius.button,
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
  },
  continueButtonText: { fontSize: 14, fontWeight: '700' },
  summaryHeaderRow: { flexDirection: 'row', alignItems: 'center', gap: 8, alignSelf: 'flex-start' },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
    width: '100%',
  },
  summaryLeftRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  summaryValueRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  editRow: { paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#eee', width: '100%' },
  smallDoneButton: {
    alignSelf: 'flex-start',
    marginTop: 8,
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: 999,
    borderWidth: 1.5,
  },
  actionRow: { flexDirection: 'row', gap: 10, marginTop: 8, width: '100%' },
  adjustButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: AuthRadius.button,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
  },
  submitButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: AuthRadius.button,
    alignItems: 'center',
    justifyContent: 'center',
  },
});