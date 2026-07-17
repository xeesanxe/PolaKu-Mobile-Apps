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
import { TrendChart } from '@/components/TrendChart';
import * as Print from 'expo-print';
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
import { AuthDesign, AuthSpacing, AuthRadius } from '@/constants/AuthDesign';

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

// expo-print di Android kadang nyangkut tanpa pernah resolve/reject
// (known issue: https://github.com/expo/expo/issues/27570) — timeout ini
// jaga-jaga biar user dapet pesan error yang jelas, bukan spinner selamanya.
const PDF_TIMEOUT_MS = 15000;
function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error('Proses generate PDF timeout')), ms)
    ),
  ]);
}

// Manual, gak pakai toLocaleString/Intl — sama alasan kayak dayLabel() di
// bawah, Hermes kadang gak reliable dukung locale formatting di RN.
function formatNow() {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getDate()} ${MONTH_LABELS[d.getMonth()]} ${d.getFullYear()}, ${pad(d.getHours())}:${pad(d.getMinutes())}`;
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

// ===== PDF export (PMA-48,49,50,51) =====
// Rule-based, sama persis formula computeCorrelationFlags di functions/index.js
// — sengaja diduplikasi di client (bukan panggil Cloud Function) karena PDF
// TIDAK BOLEH menyertakan teks insight/rekomendasi LLM (PMA-49), jadi murni
// hitungan deterministik dari log yang udah ada di device.
function computeFlagsForPdf(logs: DailyLog[]) {
  const totalLogged = logs.length;
  const lowSleepDays = logs.filter((l) => l.sleepHours < 5);
  const lowSleepWithSymptoms = lowSleepDays.filter(
    (l) => Array.isArray(l.symptoms) && l.symptoms.some((s) => s !== 'Tidak ada keluhan')
  );
  const irregularMealDays = logs.filter((l) => l.mealFrequency < 3);
  const negativeMoodDays = logs.filter((l) =>
    ['sedih', 'marah', 'kecewa', 'cemas'].includes(l.mood)
  );
  const avgStress =
    totalLogged === 0 ? 0 : logs.reduce((sum, l) => sum + (l.stressLevel || 0), 0) / totalLogged;

  return [
    {
      label: 'Tidur &lt; 5 jam disertai gejala',
      active: lowSleepDays.length >= 3 && lowSleepWithSymptoms.length >= 2,
      frequency: `${lowSleepDays.length} dari ${totalLogged} hari`,
    },
    {
      label: 'Pola makan tidak teratur (&lt;3x/hari)',
      active: irregularMealDays.length >= 4,
      frequency: `${irregularMealDays.length} dari ${totalLogged} hari`,
    },
    {
      label: 'Level stres tinggi',
      active: avgStress >= 70,
      frequency: `rata-rata ${Math.round(avgStress)}/100`,
    },
    {
      label: 'Mood negatif',
      active: negativeMoodDays.length >= 4,
      frequency: `${negativeMoodDays.length} dari ${totalLogged} hari`,
    },
  ];
}

function buildSparklinePolyline(values: number[], width: number, height: number) {
  if (values.length === 0) return '';
  const max = Math.max(...values, 1);
  const min = Math.min(...values, 0);
  const range = max - min || 1;
  const stepX = values.length > 1 ? width / (values.length - 1) : 0;
  return values
    .map((v, i) => {
      const x = i * stepX;
      const y = height - ((v - min) / range) * height;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');
}

function buildPdfHtml(recap: WeeklyRecap, logs: DailyLog[], rangeLabel: string) {
  const disclaimer =
    'Dokumen ini berisi data self-report dari aplikasi PolaKu, disusun sebagai ' +
    'bahan diskusi dengan tenaga medis — BUKAN hasil diagnosis medis.';

  const flags = computeFlagsForPdf(logs);
  const activeFlags = flags.filter((f) => f.active);

  const rows = logs
    .map(
      (l) => `<tr>
        <td>${l.date}</td>
        <td>${l.sleepHours} jam</td>
        <td>${l.symptoms?.length ? l.symptoms.join(', ') : '-'}</td>
        <td>${l.mealFrequency}x</td>
        <td>${l.stressLevel}</td>
        <td>${l.mood}</td>
      </tr>`
    )
    .join('');

  const sparkline = buildSparklinePolyline(
    logs.map((l) => l.sleepHours),
    280,
    60
  );

  return `
  <html>
    <head>
      <meta charset="utf-8" />
      <style>
        body { font-family: Helvetica, Arial, sans-serif; color: #191b21; padding: 24px; }
        h1 { font-size: 18px; color: #024594; margin-bottom: 4px; }
        .disclaimer { background: #fff3cd; border: 1px solid #ffe08a; padding: 10px 12px;
          border-radius: 8px; font-size: 11px; margin: 12px 0; }
        h2 { font-size: 14px; color: #024594; margin-top: 24px; margin-bottom: 8px; }
        table { width: 100%; border-collapse: collapse; font-size: 11px; }
        th, td { border: 1px solid #c3c6d3; padding: 6px 8px; text-align: left; }
        th { background: #f0f0f7; }
        .score-grid { display: flex; gap: 12px; flex-wrap: wrap; }
        .score-box { border: 1px solid #c3c6d3; border-radius: 8px; padding: 10px 14px; }
        .score-box b { display: block; font-size: 16px; color: #024594; }
        .flag { padding: 6px 0; font-size: 12px; border-bottom: 1px solid #e2e2e9; }
        .footer { font-size: 10px; color: #737782; margin-top: 24px; }
      </style>
    </head>
    <body>
      <h1>Riwayat Pola Hidup — PolaKu</h1>
      <p style="font-size:11px;color:#434751">Rentang data: ${rangeLabel}</p>
      <div class="disclaimer">${disclaimer}</div>

      <h2>Ringkasan Skor Mingguan (dari recap terakhir)</h2>
      <div class="score-grid">
        <div class="score-box">Tidur<b>${recap.support.avgSleepHours}j</b></div>
        <div class="score-box">Makan<b>${recap.mealScore}%</b></div>
        <div class="score-box">Stres<b>${recap.stressScore}/100</b></div>
        <div class="score-box">Mood<b>${recap.support.moodDaysOk}/${recap.support.totalLogged} hari</b></div>
        <div class="score-box">Keseluruhan<b>${recap.overallScore}/100</b></div>
      </div>

      <h2>Grafik Tren Tidur (jam)</h2>
      <svg width="280" height="60"><polyline points="${sparkline}" fill="none" stroke="#024594" stroke-width="2"/></svg>

      <h2>Tabel Log Harian</h2>
      <table>
        <tr><th>Tanggal</th><th>Tidur</th><th>Gejala</th><th>Makan</th><th>Stres</th><th>Mood</th></tr>
        ${rows}
      </table>

      <h2>Pola yang Terdeteksi</h2>
      ${
        activeFlags.length === 0
          ? '<p style="font-size:12px">Tidak ada pola signifikan terdeteksi pada rentang ini.</p>'
          : activeFlags
              .map((f) => `<div class="flag"><b>${f.label}</b> — ${f.frequency}</div>`)
              .join('')
      }

      <div class="disclaimer">${disclaimer}</div>
      <p class="footer">Dibuat otomatis oleh PolaKu pada ${formatNow()}.</p>
    </body>
  </html>`;
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
  const [pdfGenerating, setPdfGenerating] = useState(false);

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

  const handleExportPdf = async () => {
    // PMA-50: validasi rentang tanggal (yang lagi dipilih di toggle grafik) punya data.
    if (chartLogs.length === 0) {
      Alert.alert('Belum Ada Data', 'Rentang tanggal ini belum ada data check-in-nya.');
      return;
    }
    if (!recap) {
      Alert.alert(
        'Belum Ada Rekap',
        'Butuh minimal 7 hari check-in dulu buat bikin ringkasan skor mingguan.'
      );
      return;
    }

    setPdfGenerating(true);
    try {
      const rangeLabel = CHART_RANGES.find((r) => r.key === chartRange)!.label;
      const html = buildPdfHtml(recap, chartLogs, rangeLabel);

      // printAsync (bukan printToFileAsync + Sharing) — buka dialog print
      // native Android langsung, biar Android sendiri yang nanganin file PDF
      // & opsi "Save as PDF"/share, gak lewat file URI antar modul kita.
      // Ini yang bikin dua percobaan sebelumnya (printToFileAsync + Sharing,
      // dengan/tanpa copy manual) sama-sama kena "Missing/Not allowed READ".
      await withTimeout(Print.printAsync({ html }), PDF_TIMEOUT_MS);
    } catch (error) {
      console.error('Gagal generate PDF:', error);
      Alert.alert('Gagal', 'Gagal membuat PDF, coba lagi.');
    } finally {
      setPdfGenerating(false);
    }
  };

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
              <View style={styles.overallScoreRow} lightColor="transparent">
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
          <View style={styles.sectionBlock} lightColor="transparent">
            <View style={styles.trendHeader} lightColor="transparent">
              <Text style={styles.sectionTitle}>Rekap Mingguan</Text>
              <Text style={styles.dateRangeLabel}>{formatDateRangeLabel(recapLogs)}</Text>
            </View>
            <View style={styles.recapGrid} lightColor="transparent">
              <View style={styles.recapCard}>
                <View style={styles.recapCardHeader} lightColor="transparent">
                  <MaterialIcons name="bedtime" size={18} color={AuthDesign.primary} />
                  <Text style={styles.recapCardLabel}>Tidur</Text>
                </View>
                <View style={styles.recapCardValueRow} lightColor="transparent">
                  <Text style={styles.recapCardValue}>{recap.support.avgSleepHours}j</Text>
                  <Text style={styles.recapCardSubvalue}>Target 7j</Text>
                </View>
              </View>

              <View style={styles.recapCard}>
                <View style={styles.recapCardHeader} lightColor="transparent">
                  <MaterialIcons name="restaurant" size={18} color={AuthDesign.primary} />
                  <Text style={styles.recapCardLabel}>Makan</Text>
                </View>
                <View style={styles.recapCardValueRow} lightColor="transparent">
                  <Text style={styles.recapCardValue}>{recap.mealScore}%</Text>
                  <Text style={styles.recapCardSubvalue}>
                    {MEAL_LABELS[SCORE_TIER(recap.mealScore)]}
                  </Text>
                </View>
              </View>

              <View style={styles.recapCard}>
                <View style={styles.recapCardHeader} lightColor="transparent">
                  <MaterialIcons name="psychology" size={18} color={AuthDesign.primary} />
                  <Text style={styles.recapCardLabel}>Stres</Text>
                </View>
                <View style={styles.recapCardValueRow} lightColor="transparent">
                  <Text style={styles.recapCardValue}>
                    {STRESS_LABELS[SCORE_TIER(recap.stressScore)]}
                  </Text>
                  <Text style={styles.recapCardSubvalue}>Skor {recap.stressScore}/100</Text>
                </View>
              </View>

              <View style={styles.recapCard}>
                <View style={styles.recapCardHeader} lightColor="transparent">
                  <MaterialIcons name="sentiment-satisfied" size={18} color={AuthDesign.primary} />
                  <Text style={styles.recapCardLabel}>Mood</Text>
                </View>
                <View style={styles.recapCardValueRow} lightColor="transparent">
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
        <View style={styles.sectionBlock} lightColor="transparent">
          <View style={styles.trendHeader} lightColor="transparent">
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

          <View style={styles.rangeTabs} lightColor="transparent">
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
              <TrendChart
                data={chartLogs.map((l) => ({
                  date: l.date,
                  value: chartMetric === 'sleep' ? l.sleepHours : l.stressLevel,
                }))}
                metric={chartMetric}
                labels={chartLogs.map((l) => dayLabel(l.date))}
              />
            )}
          </View>
        </View>

        {/* Riwayat Harian */}
        <View style={styles.sectionBlock} lightColor="transparent">
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

        {/* Export PDF (PMA-48,49,50,51) — rentang tanggalnya ngikutin toggle grafik di atas */}
        <Pressable
          style={styles.pdfButton}
          onPress={handleExportPdf}
          disabled={pdfGenerating}
        >
          {pdfGenerating ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <MaterialIcons name="picture-as-pdf" size={20} color="#fff" />
          )}
          <Text style={styles.pdfButtonText}>
            {pdfGenerating ? 'Menyiapkan PDF...' : 'Unduh PDF untuk Dokter'}
          </Text>
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
    borderRadius: AuthRadius.card,
    padding: 24,
    backgroundColor: AuthDesign.primary,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
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
    borderRadius: AuthRadius.card,
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
    backgroundColor: AuthDesign.brandAccent + '30',
    borderRadius: AuthRadius.chip,
    padding: 3,
    gap: 2,
  },
  trendTab: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: AuthRadius.chip },
  trendTabActive: { backgroundColor: AuthDesign.primaryLight },
  trendTabText: { fontSize: 12, fontWeight: '600', color: AuthDesign.onSurfaceVariant },
  trendTabTextActive: { color: '#fff' },
  rangeTabs: { flexDirection: 'row', gap: 8 },
  rangeTab: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: AuthRadius.chip,
    borderWidth: 1,
    borderColor: AuthDesign.outlineVariant,
  },
  rangeTabActive: { backgroundColor: AuthDesign.primary, borderColor: AuthDesign.primary },
  rangeTabText: { fontSize: 12, fontWeight: '600', color: AuthDesign.onSurfaceVariant },
  rangeTabTextActive: { color: '#fff' },
  chartCard: {
    height: 256,
    borderRadius: AuthRadius.card,
    borderWidth: 1,
    borderColor: AuthDesign.outlineVariant + '4D',
    backgroundColor: AuthDesign.surface,
    padding: 16,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.02,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  },
  trendChart: { borderRadius: AuthRadius.card },
  trendEmpty: { alignItems: 'center', justifyContent: 'center' },
  logRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: AuthDesign.surface,
    borderWidth: 1,
    borderColor: AuthDesign.outlineVariant + '4D',
    borderRadius: AuthRadius.card,
    padding: 12,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOpacity: 0.02,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
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
    borderRadius: AuthRadius.chip,
  },
  pdfButtonText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  pdfNote: {
    fontSize: 11,
    color: AuthDesign.outline,
    textAlign: 'center',
    marginTop: -12,
  },
});
