import React, { useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Alert,
} from "react-native";
import Slider from "@react-native-community/slider";
import { MaterialIcons } from "@expo/vector-icons";
import { getFunctions, httpsCallable } from "firebase/functions";
import { getAuth } from "firebase/auth";
import { SafeAreaView } from "react-native-safe-area-context";

// ===== KONSTANTA =====
const SLEEP_OPTIONS = [
  { label: "0", value: 0 },
  { label: "2+", value: 2 },
  { label: "4+", value: 4 },
  { label: "6+", value: 6 },
  { label: "8+", value: 8 },
];

const SYMPTOM_OPTIONS = [
  { label: "Pusing", icon: "sentiment-dissatisfied" as const },
  { label: "Maag", icon: "restaurant" as const },
  { label: "Capek", icon: "battery-alert" as const },
  { label: "Mata Lelah", icon: "visibility" as const },
  { label: "Nyeri Otot", icon: "accessibility" as const },
];
const NO_SYMPTOM = "Tidak ada keluhan";

const MEAL_OPTIONS = [
  { label: "1x", value: 1 },
  { label: "2x", value: 2 },
  { label: "3x", value: 3 },
  { label: "3x+", value: 4 },
];

const MOOD_OPTIONS = [
  { label: "Happy", value: "senang", emoji: "😊" },
  { label: "Neutral", value: "biasa", emoji: "😐" },
  { label: "Sad", value: "sedih", emoji: "😔" },
  { label: "Angry", value: "marah", emoji: "😠" },
  { label: "Disappointed", value: "kecewa", emoji: "😞" },
  { label: "Anxious", value: "cemas", emoji: "😰" },
];

const STEPS = ["sleep", "symptoms", "meal", "stress", "mood"] as const;

const COLORS = {
  primary: "#024594",
  primaryContainer: "#2c5ead",
  onPrimaryContainer: "#cbdaff",
  primaryFixed: "#d7e2ff",
  surface: "#f9f9ff",
  background: "#f9f9ff",
  onSurface: "#191b21",
  onSurfaceVariant: "#434751",
  card: "#C4E2F5",
  white: "#ffffff",
  border: "#c3c6d3",
};

export default function CheckInScreen() {
  // ===================== LOGIC (jangan disentuh pas redesign) =====================
  const [sleepHours, setSleepHours] = useState<number>(6);
  const [symptoms, setSymptoms] = useState<string[]>([]);
  const [mealFrequency, setMealFrequency] = useState<number>(3);
  const [stressLevel, setStressLevel] = useState<number>(45);
  const [mood, setMood] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // ===== STATE BARU khusus buat navigasi step, gak ngaruh ke data form =====
  const [currentStep, setCurrentStep] = useState(0);
  const isFirstStep = currentStep === 0;
  const isLastStep = currentStep === STEPS.length - 1;

  const toggleSymptom = (symptom: string) => {
    if (symptom === NO_SYMPTOM) {
      setSymptoms(symptoms.includes(NO_SYMPTOM) ? [] : [NO_SYMPTOM]);
    } else {
      const withoutNone = symptoms.filter((s) => s !== NO_SYMPTOM);
      if (withoutNone.includes(symptom)) {
        setSymptoms(withoutNone.filter((s) => s !== symptom));
      } else {
        setSymptoms([...withoutNone, symptom]);
      }
    }
  };

  const goNext = () => {
    if (!isLastStep) setCurrentStep(currentStep + 1);
  };

  const goBack = () => {
    if (!isFirstStep) setCurrentStep(currentStep - 1);
  };

  const handleSubmit = async () => {
    if (!mood) {
      Alert.alert("Belum lengkap", "Pilih mood kamu dulu ya.");
      return;
    }
    const auth = getAuth();
    if (!auth.currentUser) {
      Alert.alert("Belum login", "Silakan login dulu.");
      return;
    }

    setSubmitting(true);
    try {
      const functions = getFunctions();
      const saveDailyLog = httpsCallable(functions, "saveDailyLog");
      const today = new Date().toISOString().split("T")[0];

      const result: any = await saveDailyLog({
        date: today,
        sleepHours,
        symptoms,
        mealFrequency,
        stressLevel,
        mood,
        inputMethod: "pilihan",
      });

      Alert.alert("Berhasil", `Check-in tersimpan (${result.data.status})`);
      setCurrentStep(0); // reset ke step awal setelah berhasil submit
    } catch (error: any) {
      Alert.alert("Gagal", error.message);
    } finally {
      setSubmitting(false);
    }
  };

  // ===================== TAMPILAN =====================
  return (
    <SafeAreaView style={styles.screen} edges={["top"]}>
      <ScrollView contentContainerStyle={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headline}>Halo!</Text>
          <Text style={styles.subtext}>Luangkan 1 menit untuk perbarui kondisimu hari ini.</Text>
        </View>

        {/* Progress dots */}
        <View style={styles.progressRow}>
          {STEPS.map((s, i) => (
            <View
              key={s}
              style={[styles.progressDot, i === currentStep && styles.progressDotActive]}
            />
          ))}
        </View>

        {/* STEP 1: Tidur */}
        {currentStep === 0 && (
          <View style={styles.section}>
            <View style={styles.labelRow}>
              <MaterialIcons name="bedtime" size={20} color={COLORS.primary} />
              <Text style={styles.label}>Durasi Tidur (Jam)</Text>
            </View>
            <View style={styles.card}>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <View style={styles.sleepRow}>
                  {SLEEP_OPTIONS.map((opt) => {
                    const active = sleepHours === opt.value;
                    return (
                      <TouchableOpacity
                        key={opt.label}
                        style={[styles.sleepItem, active && styles.sleepItemActive]}
                        onPress={() => setSleepHours(opt.value)}
                      >
                        <Text style={[styles.sleepText, active && styles.sleepTextActive]}>
                          {opt.label}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </ScrollView>
            </View>
          </View>
        )}

        {/* STEP 2: Gejala */}
        {currentStep === 1 && (
          <View style={styles.section}>
            <View style={styles.labelRow}>
              <MaterialIcons name="medical-services" size={20} color={COLORS.primary} />
              <Text style={styles.label}>Gejala yang Dirasakan</Text>
            </View>
            <View style={styles.symptomGrid}>
              <TouchableOpacity
                style={[styles.symptomChip, symptoms.includes(NO_SYMPTOM) && styles.symptomChipActive]}
                onPress={() => toggleSymptom(NO_SYMPTOM)}
              >
                <MaterialIcons
                  name="check-circle"
                  size={20}
                  color={symptoms.includes(NO_SYMPTOM) ? COLORS.primary : COLORS.onSurface}
                />
                <Text style={styles.symptomText}>{NO_SYMPTOM}</Text>
              </TouchableOpacity>
              {SYMPTOM_OPTIONS.map((s) => {
                const active = symptoms.includes(s.label);
                return (
                  <TouchableOpacity
                    key={s.label}
                    style={[styles.symptomChip, active && styles.symptomChipActive]}
                    onPress={() => toggleSymptom(s.label)}
                  >
                    <MaterialIcons name={s.icon} size={20} color={COLORS.primary} />
                    <Text style={styles.symptomText}>{s.label}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        )}

        {/* STEP 3: Pola Makan */}
        {currentStep === 2 && (
          <View style={styles.section}>
            <View style={styles.labelRow}>
              <MaterialIcons name="restaurant" size={20} color={COLORS.primary} />
              <Text style={styles.label}>Frekuensi Makan Hari Ini</Text>
            </View>
            <View style={styles.mealRow}>
              {MEAL_OPTIONS.map((m) => {
                const active = mealFrequency === m.value;
                return (
                  <TouchableOpacity
                    key={m.label}
                    style={[styles.mealBtn, active && styles.mealBtnActive]}
                    onPress={() => setMealFrequency(m.value)}
                  >
                    <Text style={[styles.mealText, active && styles.mealTextActive]}>{m.label}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        )}

        {/* STEP 4: Tingkat Stres */}
        {currentStep === 3 && (
          <View style={styles.section}>
            <View style={styles.stressHeader}>
              <View style={styles.labelRow}>
                <MaterialIcons name="psychology" size={20} color={COLORS.primary} />
                <Text style={styles.label}>Tingkat Stres</Text>
              </View>
              <Text style={styles.stressValue}>{stressLevel}%</Text>
            </View>
            <View style={styles.card}>
              <Slider
                style={{ width: "100%", height: 40 }}
                minimumValue={0}
                maximumValue={100}
                step={1}
                value={stressLevel}
                minimumTrackTintColor={COLORS.primary}
                maximumTrackTintColor={COLORS.primaryFixed}
                thumbTintColor={COLORS.primary}
                onValueChange={setStressLevel}
              />
            </View>
            <View style={styles.stressLabels}>
              <Text style={styles.stressLabelText}>Rileks</Text>
              <Text style={styles.stressLabelText}>Sangat Stres</Text>
            </View>
          </View>
        )}

        {/* STEP 5: Mood */}
        {currentStep === 4 && (
          <View style={styles.section}>
            <View style={styles.labelRow}>
              <MaterialIcons name="mood" size={20} color={COLORS.primary} />
              <Text style={styles.label}>Bagaimana Perasaanmu?</Text>
            </View>
            <View style={[styles.card, styles.moodRow]}>
              {MOOD_OPTIONS.map((m) => {
                const active = mood === m.value;
                return (
                  <TouchableOpacity
                    key={m.value}
                    style={styles.moodItem}
                    onPress={() => setMood(m.value)}
                  >
                    <View style={[styles.moodCircle, active && styles.moodCircleActive]}>
                      <Text style={{ fontSize: 22 }}>{m.emoji}</Text>
                    </View>
                    <Text style={[styles.moodLabel, active && styles.moodLabelActive]}>{m.label}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        )}

        {/* Navigasi Back / Next / Simpan */}
        <View style={styles.navRow}>
          {!isFirstStep && (
            <TouchableOpacity style={styles.backButton} onPress={goBack}>
              <MaterialIcons name="arrow-back" size={20} color={COLORS.primary} />
              <Text style={styles.backText}>Kembali</Text>
            </TouchableOpacity>
          )}

          {!isLastStep ? (
            <TouchableOpacity style={styles.nextButton} onPress={goNext}>
              <Text style={styles.nextText}>Lanjut</Text>
              <MaterialIcons name="arrow-forward" size={20} color={COLORS.white} />
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={styles.submitButton}
              onPress={handleSubmit}
              disabled={submitting}
            >
              <Text style={styles.submitText}>{submitting ? "Menyimpan..." : "Simpan"}</Text>
              <MaterialIcons name="send" size={20} color={COLORS.white} />
            </TouchableOpacity>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: COLORS.background },
  container: { padding: 20, paddingBottom: 60, gap: 24 },
  header: { gap: 4 },
  headline: { fontSize: 28, fontWeight: "700", color: COLORS.onSurface },
  subtext: { fontSize: 14, color: COLORS.onSurfaceVariant },
  progressRow: { flexDirection: "row", justifyContent: "center", gap: 8 },
  progressDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: COLORS.border,
  },
  progressDotActive: {
    backgroundColor: COLORS.primary,
    width: 20,
  },
  section: { gap: 8, minHeight: 220 },
  labelRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  label: { fontSize: 14, fontWeight: "600", color: COLORS.onSurface },
  card: { backgroundColor: COLORS.card, borderRadius: 12, padding: 16 },
  sleepRow: { flexDirection: "row", gap: 16 },
  sleepItem: {
    width: 64,
    height: 64,
    borderRadius: 12,
    backgroundColor: COLORS.surface,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "transparent",
  },
  sleepItemActive: {
    backgroundColor: COLORS.primaryContainer,
    borderColor: COLORS.primary,
  },
  sleepText: { fontSize: 22, fontWeight: "600", color: COLORS.onSurface },
  sleepTextActive: { color: COLORS.onPrimaryContainer },
  symptomGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  symptomChip: {
    width: "48%",
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    padding: 12,
    borderRadius: 12,
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: "transparent",
  },
  symptomChipActive: {
    backgroundColor: COLORS.primaryFixed,
    borderColor: COLORS.primary,
  },
  symptomText: { fontSize: 14, color: COLORS.onSurface },
  mealRow: { flexDirection: "row", gap: 8 },
  mealBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: COLORS.card,
    alignItems: "center",
  },
  mealBtnActive: { backgroundColor: COLORS.primaryContainer },
  mealText: { fontSize: 14, fontWeight: "600", color: COLORS.onSurface },
  mealTextActive: { color: COLORS.onPrimaryContainer },
  stressHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  stressValue: {
    fontSize: 14,
    fontWeight: "600",
    color: COLORS.primary,
    backgroundColor: COLORS.primaryFixed,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 20,
  },
  stressLabels: { flexDirection: "row", justifyContent: "space-between", paddingHorizontal: 4 },
  stressLabelText: { fontSize: 12, color: COLORS.onSurfaceVariant },
  moodRow: { flexDirection: "row", justifyContent: "space-between" },
  moodItem: { alignItems: "center", gap: 4 },
  moodCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: COLORS.surface,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "transparent",
  },
  moodCircleActive: {
    backgroundColor: COLORS.primaryContainer,
    borderColor: COLORS.primary,
  },
  moodLabel: { fontSize: 12, color: COLORS.onSurfaceVariant },
  moodLabelActive: { color: COLORS.primary, fontWeight: "700" },
  navRow: { flexDirection: "row", gap: 12, marginTop: 8 },
  backButton: {
    flex: 1,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 6,
    borderWidth: 1,
    borderColor: COLORS.primary,
    paddingVertical: 16,
    borderRadius: 12,
  },
  backText: { color: COLORS.primary, fontWeight: "600", fontSize: 14 },
  nextButton: {
    flex: 1,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 8,
    backgroundColor: COLORS.primary,
    paddingVertical: 16,
    borderRadius: 12,
  },
  nextText: { color: COLORS.white, fontWeight: "600", fontSize: 14 },
  submitButton: {
    flex: 1,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 8,
    backgroundColor: COLORS.primary,
    paddingVertical: 16,
    borderRadius: 12,
  },
  submitText: { color: COLORS.white, fontWeight: "600", fontSize: 14 },
});