import React, { useState, useCallback } from 'react';
import {
  StyleSheet,
  ActivityIndicator,
  Pressable,
  ScrollView,
  Dimensions,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { LineChart } from 'react-native-chart-kit';
import { onAuthStateChanged } from 'firebase/auth';
import { getFunctions, httpsCallable } from 'firebase/functions';
import {
  collection,
  query,
  where,
  orderBy,
  limit,
  getDocs,
} from 'firebase/firestore';

import { Text, View } from '@/components/Themed';
import { auth, db } from '@/services/firebase';
import { AuthDesign, AuthSpacing } from '@/constants/AuthDesign';

type DailyLog = {
  date: string;
  sleepHours: number;
  mealFrequency: number;
  stressLevel: number;
  mood: string;
  symptoms: string[];
};

type RecapSupport = {
  totalLogged: number;
  avgSleepHours: number;
  moodDaysOk: number;
};

type WeeklyRecap = {
  date: string;
  sleepScore: number;
  mealScore: number;
  stressScore: number;
  moodScore: number;
  overallScore: number;
  support: RecapSupport;
  lowestComponent: 'sleep' | 'meal' | 'stress' | 'mood';
  recommendationText: string;
  source: 'llm' | 'fallback';
};

const GOOD_MOODS = ['senang', 'biasa'];
const MONTH_LABELS = [
  'Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun',
  'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des',
];
const DAY_LABELS = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];
const SCREEN_WIDTH = Dimensions.get('window').width;

const CHART_RANGES: { key: 'week' | 'month' | 'quarter'; label: string; days: number }[] = [
  { key: 'week', label: 'Seminggu', days: 7 },
  { key: 'month', label: 'Sebulan', days: 30 },
  { key: 'quarter', label: '90 Hari', days: 90 },
];

function parseDate(dateStr: string) {
  return new Date(`${dateStr}T00:00:00`);
}

function dayLabel(dateStr: string) {
  return DAY_LABELS[parseDate(dateStr).getDay()];
}

function formatDateRangeLabel(logs: DailyLog[]) {
  if (logs.length === 0) return '';
  const start = parseDate(logs[0].date);
  const end = parseDate(logs[logs.length - 1].date);
  const fmt = (d: Date) => `${d.getDate()} ${MONTH_LABELS[d.getMonth()]}`;
  return `${fmt(start)} - ${fmt(end)}`;
}

// Skor per-hari, versi mini dari formula PRD 2.2 tapi buat 1 hari doang —
// dipakai buat nentuin area paling lemah hari itu (Riwayat Harian).
function computeDayScores(log: DailyLog) {
  return {
    sleep: Math.min(100, Math.max(0, (log.sleepHours / 7) * 100)),
    meal: log.mealFrequency >= 3 ? 100 : 0,
    stress: 100 - log.stressLevel,
    mood: GOOD_MOODS.includes(log.mood) ? 100 : 0,
  };
}

const DAY_SUMMARY_TEMPLATES: Record<string, { title: string; desc: (log: DailyLog) => string }> = {
  sleep: {
    title: 'Sedikit Kurang Tidur',
    desc: (log) => `Tidur cuma ${log.sleepHours} jam hari ini.`,
  },
  meal: {
    title: 'Pola Makan Kurang Teratur',
    desc: () => 'Frekuensi makan hari ini di bawah 3x.',
  },
  stress: {
    title: 'Hari yang Cukup Menegangkan',
    desc: () => 'Level stres hari ini cukup tinggi.',
  },
  mood: {
    title: 'Mood Kurang Baik',
    desc: () => 'Suasana hati hari ini kurang positif.',
  },
};

function buildDaySummary(log: DailyLog) {
  const dayScores = computeDayScores(log);
  const entries = Object.entries(dayScores) as [keyof typeof dayScores, number][];
  const [lowestKey, lowestValue] = entries.reduce((a, b) => (b[1] < a[1] ? b : a));

  if (lowestValue >= 70) {
    return { title: 'Hari Sangat Produktif', desc: 'Pola hidupmu terjaga baik hari ini.' };
  }
  const template = DAY_SUMMARY_TEMPLATES[lowestKey];
  return { title: template.title, desc: template.desc(log) };
}

const SCORE_TIER = (score: number) => (score >= 70 ? 2 : score >= 30 ? 1 : 0);
const STRESS_LABELS = ['Tinggi', 'Sedang', 'Rendah'];
const MEAL_LABELS = ['Kurang Teratur', 'Kurang Teratur', 'Teratur'];
const MOOD_LABELS = ['Kurang Stabil', 'Kurang Stabil', 'Stabil'];

function overallScoreDescription(score: number) {
  if (score >= 80) return 'Luar biasa! Pola hidupmu minggu ini sangat stabil dan sehat.';
  if (score >= 50) return 'Lumayan, tapi masih ada ruang buat lebih konsisten lagi.';
  return 'Pola hidupmu minggu ini perlu diperhatikan lebih serius.';
}

export default function HistoryScreen() {
  // ===================== LOGIC =====================
  const [uid, setUid] = useState<string | null>(null);

  const [allLogs, setAllLogs] = useState<DailyLog[]>([]);
  const [logsLoading, setLogsLoading] = useState(true);

  const [recap, setRecap] = useState<WeeklyRecap | null>(null);
  const [recapLoading, setRecapLoading] = useState(true);

  const [chartRange, setChartRange] = useState<'week' | 'month' | 'quarter'>('week');
  const [chartMetric, setChartMetric] = useState<'sleep' | 'stress'>('sleep');

  const fetchLogs = useCallback(async (uid: string) => {
    setLogsLoading(true);
    try {
      const q = query(
        collection(db, 'daily_logs'),
        where('userId', '==', uid),
        orderBy('date', 'desc'),
        limit(90)
      );
      const snap = await getDocs(q);
      setAllLogs(snap.docs.map((d) => d.data() as DailyLog));
    } catch (error) {
      console.error('Gagal ambil riwayat log:', error);
      setAllLogs([]);
    } finally {
      setLogsLoading(false);
    }
  }, []);

  const fetchRecap = useCallback(async (uid: string) => {
    setRecapLoading(true);
    try {
      const functions = getFunctions();
      const generateWeeklyRecap = httpsCallable(functions, 'generateWeeklyRecap');
      const result = await generateWeeklyRecap();
      setRecap(result.data as WeeklyRecap);
    } catch (error: any) {
      // Data belum cukup buat recap baru (< 7 hari sejak recap terakhir) —
      // ini bukan error, cukup tampilkan recap TERAKHIR yang tersimpan.
      try {
        const q = query(
          collection(db, 'weekly_recaps'),
          where('userId', '==', uid),
          orderBy('date', 'desc'),
          limit(1)
        );
        const snap = await getDocs(q);
        setRecap(snap.empty ? null : (snap.docs[0].data() as WeeklyRecap));
      } catch (fallbackError) {
        console.error('Gagal ambil recap tersimpan:', fallbackError);
        setRecap(null);
      }
    } finally {
      setRecapLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      const unsubscribe = onAuthStateChanged(auth, (user) => {
        if (user) {
          setUid(user.uid);
          fetchLogs(user.uid);
          fetchRecap(user.uid);
        }
      });
      return unsubscribe;
    }, [fetchLogs, fetchRecap])
  );

  const chartDays = CHART_RANGES.find((r) => r.key === chartRange)!.days;
  const chartLogs = [...allLogs].slice(0, chartDays).reverse();
  const recapLogs = [...allLogs].slice(0, 7).reverse();

  // ===================== TAMPILAN =====================
  if (!logsLoading && allLogs.length === 0) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.emptyContainer} lightColor={AuthDesign.background}>
          <MaterialIcons name="query-stats" size={48} color={AuthDesign.outline} />
          <Text style={styles.emptyTitle}>Belum Ada Data</Text>
          <Text style={styles.emptyDesc}>
            Isi Daily Check-in pertamamu buat mulai lihat riwayat &amp; rekap di sini.
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.topBar} lightColor={AuthDesign.background}>
        <View style={styles.brandBadge}>
          <MaterialIcons name="favorite" size={18} color="#fff" />
        </View>
        <Text style={styles.brandText}>PolaKu</Text>
      </View>

      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.scrollContent}
      >
        {/* Skor Keseluruhan */}
        <View style={styles.overallCard}>
          <Text style={styles.overallLabel}>Skor Keseluruhan</Text>
          {recapLoading ? (
            <ActivityIndicator color="#fff" style={{ marginVertical: 12 }} />
          ) : recap ? (
            <>
              <View style={styles.overallScoreRow}>
                <Text style={styles.overallScoreNumber}>{recap.overallScore}</Text>
                <Text style={styles.overallScoreMax}>/100</Text>
              </View>
              <Text style={styles.overallDesc}>
                {overallScoreDescription(recap.overallScore)}
              </Text>
            </>
          ) : (
            <Text style={styles.overallDesc}>
              Butuh minimal 7 hari check-in dulu buat rekap mingguan pertamamu.
            </Text>
          )}
        </View>

        {/* Rekap Mingguan */}
        {recap && (
          <View style={styles.sectionBlock}>
            <View style={styles.trendHeader}>
              <Text style={styles.sectionTitle}>Rekap Mingguan</Text>
              <Text style={styles.dateRangeLabel}>{formatDateRangeLabel(recapLogs)}</Text>
            </View>
            <View style={styles.recapGrid}>
              <View style={styles.recapCard}>
                <View style={styles.recapCardHeader}>
                  <MaterialIcons name="bedtime" size={18} color={AuthDesign.primary} />
                  <Text style={styles.recapCardLabel}>Tidur</Text>
                </View>
                <View style={styles.recapCardValueRow}>
                  <Text style={styles.recapCardValue}>{recap.support.avgSleepHours}j</Text>
                  <Text style={styles.recapCardSubvalue}>Target 7j</Text>
                </View>
              </View>

              <View style={styles.recapCard}>
                <View style={styles.recapCardHeader}>
                  <MaterialIcons name="restaurant" size={18} color={AuthDesign.primary} />
                  <Text style={styles.recapCardLabel}>Makan</Text>
                </View>
                <View style={styles.recapCardValueRow}>
                  <Text style={styles.recapCardValue}>{recap.mealScore}%</Text>
                  <Text style={styles.recapCardSubvalue}>
                    {MEAL_LABELS[SCORE_TIER(recap.mealScore)]}
                  </Text>
                </View>
              </View>

              <View style={styles.recapCard}>
                <View style={styles.recapCardHeader}>
                  <MaterialIcons name="psychology" size={18} color={AuthDesign.primary} />
                  <Text style={styles.recapCardLabel}>Stres</Text>
                </View>
                <View style={styles.recapCardValueRow}>
                  <Text style={styles.recapCardValue}>
                    {STRESS_LABELS[SCORE_TIER(recap.stressScore)]}
                  </Text>
                  <Text style={styles.recapCardSubvalue}>Skor {recap.stressScore}/100</Text>
                </View>
              </View>

              <View style={styles.recapCard}>
                <View style={styles.recapCardHeader}>
                  <MaterialIcons name="sentiment-satisfied" size={18} color={AuthDesign.primary} />
                  <Text style={styles.recapCardLabel}>Mood</Text>
                </View>
                <View style={styles.recapCardValueRow}>
                  <Text style={styles.recapCardValue}>
                    {MOOD_LABELS[SCORE_TIER(recap.moodScore)]}
                  </Text>
                  <Text style={styles.recapCardSubvalue}>
                    {recap.support.moodDaysOk}/{recap.support.totalLogged} hari
                  </Text>
                </View>
              </View>
            </View>
          </View>
        )}

        {/* Grafik tren */}
        <View style={styles.sectionBlock}>
          <View style={styles.trendHeader}>
            <Text style={styles.sectionTitle}>Grafik Tren</Text>
            <View style={styles.trendTabs}>
              <Pressable
                onPress={() => setChartMetric('sleep')}
                style={[styles.trendTab, chartMetric === 'sleep' && styles.trendTabActive]}
              >
                <Text
                  style={[styles.trendTabText, chartMetric === 'sleep' && styles.trendTabTextActive]}
                >
                  Tidur
                </Text>
              </Pressable>
              <Pressable
                onPress={() => setChartMetric('stress')}
                style={[styles.trendTab, chartMetric === 'stress' && styles.trendTabActive]}
              >
                <Text
                  style={[styles.trendTabText, chartMetric === 'stress' && styles.trendTabTextActive]}
                >
                  Stres
                </Text>
              </Pressable>
            </View>
          </View>

          <View style={styles.rangeTabs}>
            {CHART_RANGES.map((r) => (
              <Pressable
                key={r.key}
                onPress={() => setChartRange(r.key)}
                style={[styles.rangeTab, chartRange === r.key && styles.rangeTabActive]}
              >
                <Text
                  style={[styles.rangeTabText, chartRange === r.key && styles.rangeTabTextActive]}
                >
                  {r.label}
                </Text>
              </Pressable>
            ))}
          </View>

          <View style={styles.chartCard}>
            {chartLogs.length < 2 ? (
              <View style={styles.trendEmpty}>
                <Text style={styles.emptyDesc}>
                  Belum cukup data buat rentang ini.
                </Text>
              </View>
            ) : (
              <LineChart
                data={{
                  labels: chartLogs.map((l) => dayLabel(l.date)),
                  datasets: [
                    {
                      data: chartLogs.map((l) =>
                        chartMetric === 'sleep' ? l.sleepHours : l.stressLevel
                      ),
                    },
                  ],
                }}
                width={SCREEN_WIDTH - AuthSpacing.screenPadding * 2 - 64}
                height={200}
                bezier
                withInnerLines={false}
                withOuterLines={false}
                withVerticalLabels={chartDays <= 7}
                chartConfig={{
                  backgroundGradientFrom: '#ffffff',
                  backgroundGradientTo: '#ffffff',
                  decimalPlaces: 0,
                  color: (opacity = 1) => `rgba(2, 69, 148, ${opacity})`,
                  labelColor: () => AuthDesign.onSurfaceVariant,
                  propsForDots: { r: chartDays <= 7 ? '4' : '0', strokeWidth: '2', stroke: AuthDesign.primary },
                }}
                style={styles.trendChart}
              />
            )}
          </View>
        </View>

        {/* Riwayat Harian */}
        <View style={styles.sectionBlock}>
          <Text style={styles.sectionTitle}>Riwayat Harian</Text>
          {allLogs.map((log) => {
            const summary = buildDaySummary(log);
            const d = parseDate(log.date);
            return (
              <View key={log.date} style={styles.logRow}>
                <View style={styles.logDateBadge}>
                  <Text style={styles.logDateMonth}>{MONTH_LABELS[d.getMonth()]}</Text>
                  <Text style={styles.logDateDay}>{d.getDate()}</Text>
                </View>
                <View style={styles.logTextBox}>
                  <Text style={styles.logTitle}>{summary.title}</Text>
                  <Text style={styles.logDesc}>{summary.desc}</Text>
                </View>
                <MaterialIcons name="chevron-right" size={20} color={AuthDesign.outline} />
              </View>
            );
          })}
        </View>

        {/* Export PDF — UI placeholder, backend generate-PDF belum ada */}
        <Pressable
          style={styles.pdfButton}
          onPress={() =>
            Alert.alert('Segera Hadir', 'Fitur unduh PDF masih dalam pengembangan.')
          }
        >
          <MaterialIcons name="picture-as-pdf" size={20} color="#fff" />
          <Text style={styles.pdfButtonText}>Unduh PDF untuk Dokter</Text>
        </Pressable>
        <Text style={styles.pdfNote}>
          Data rekapitulasi bisa dibagikan ke tenaga profesional.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  container: { flex: 1 },
  scrollContent: {
    padding: AuthSpacing.screenPadding,
    paddingBottom: 40,
    gap: 24,
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: AuthSpacing.screenPadding,
    gap: 8,
  },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: AuthDesign.onSurface },
  emptyDesc: {
    fontSize: 13,
    color: AuthDesign.onSurfaceVariant,
    textAlign: 'center',
    paddingHorizontal: 24,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: AuthSpacing.screenPadding,
    paddingVertical: 12,
  },
  brandBadge: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: AuthDesign.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  brandText: { fontSize: 18, fontWeight: '700', color: AuthDesign.primary },
  overallCard: {
    borderRadius: 16,
    padding: 24,
    backgroundColor: AuthDesign.primary,
    alignItems: 'center',
  },
  overallLabel: { fontSize: 13, color: '#fff', opacity: 0.8, marginBottom: 4 },
  overallScoreRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 4 },
  overallScoreNumber: { fontSize: 44, fontWeight: '800', color: '#fff' },
  overallScoreMax: { fontSize: 18, color: '#fff', opacity: 0.7, marginBottom: 6 },
  overallDesc: {
    fontSize: 14,
    color: '#fff',
    textAlign: 'center',
    marginTop: 8,
    maxWidth: 240,
  },
  sectionBlock: { gap: 12 },
  sectionTitle: { fontSize: 18, fontWeight: '700', color: AuthDesign.onSurface },
  trendHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  dateRangeLabel: { fontSize: 12, color: AuthDesign.outline },
  recapGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  recapCard: {
    width: '47%',
    backgroundColor: AuthDesign.brandAccent,
    borderRadius: 12,
    padding: 14,
    gap: 8,
  },
  recapCardHeader: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  recapCardLabel: { fontSize: 13, fontWeight: '600', color: AuthDesign.primary },
  recapCardValueRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' },
  recapCardValue: { fontSize: 20, fontWeight: '700', color: AuthDesign.primary },
  recapCardSubvalue: { fontSize: 11, color: AuthDesign.primary, opacity: 0.7 },
  trendTabs: {
    flexDirection: 'row',
    backgroundColor: '#f0f0f7',
    borderRadius: 999,
    padding: 3,
    gap: 2,
  },
  trendTab: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 999 },
  trendTabActive: { backgroundColor: AuthDesign.primaryLight },
  trendTabText: { fontSize: 12, fontWeight: '600', color: AuthDesign.onSurfaceVariant },
  trendTabTextActive: { color: '#fff' },
  rangeTabs: { flexDirection: 'row', gap: 8 },
  rangeTab: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: AuthDesign.outlineVariant,
  },
  rangeTabActive: { backgroundColor: AuthDesign.primary, borderColor: AuthDesign.primary },
  rangeTabText: { fontSize: 12, fontWeight: '600', color: AuthDesign.onSurfaceVariant },
  rangeTabTextActive: { color: '#fff' },
  chartCard: {
    height: 256,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: AuthDesign.outlineVariant + '4D',
    padding: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  trendChart: { borderRadius: 12 },
  trendEmpty: { alignItems: 'center', justifyContent: 'center' },
  logRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: AuthDesign.outlineVariant,
    borderRadius: 12,
    padding: 12,
    marginBottom: 10,
  },
  logDateBadge: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: AuthDesign.brandAccent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logDateMonth: { fontSize: 9, fontWeight: '700', color: AuthDesign.primary, textTransform: 'uppercase' },
  logDateDay: { fontSize: 16, fontWeight: '700', color: AuthDesign.primary },
  logTextBox: { flex: 1 },
  logTitle: { fontSize: 14, fontWeight: '600', color: AuthDesign.onSurface },
  logDesc: { fontSize: 12, color: AuthDesign.outline },
  pdfButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: AuthDesign.primary,
    paddingVertical: 16,
    borderRadius: 12,
  },
  pdfButtonText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  pdfNote: {
    fontSize: 11,
    color: AuthDesign.outline,
    textAlign: 'center',
    marginTop: -12,
  },
});
