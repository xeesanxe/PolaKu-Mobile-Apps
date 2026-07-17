import { TrendChart } from "@/components/TrendChart";
import { MaterialIcons } from "@expo/vector-icons";
import { router, useFocusEffect } from "expo-router";
import { onAuthStateChanged } from "firebase/auth";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  where,
} from "firebase/firestore";
import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Dimensions,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { Text } from "@/components/Themed";
import { auth, db } from "@/services/firebase";
import { AuthDesign, AuthSpacing, AuthRadius } from "@/constants/AuthDesign";

type DailyInsight = {
  insightText: string;
  triggeredFlags: {
    low_sleep_symptom_flag: boolean;
    irregular_meal_flag: boolean;
    high_stress_flag: boolean;
    negative_mood_flag: boolean;
  };
  source: "llm" | "fallback" | "default";
  date: string;
};

type TrendLog = {
  date: string;
  sleepHours: number;
  stressLevel: number;
};

const DAY_LABELS = ["Min", "Sen", "Sel", "Rab", "Kam", "Jum", "Sab"];
const SCREEN_WIDTH = Dimensions.get("window").width;

function dayLabel(dateStr: string) {
  const d = new Date(`${dateStr}T00:00:00`);
  return DAY_LABELS[d.getDay()];
}

export default function HomeScreen() {
  // ===================== LOGIC =====================
  const [insight, setInsight] = useState<DailyInsight | null>(null);
  const [loading, setLoading] = useState(true);
  const [userName, setUserName] = useState<string>("");
  const [uid, setUid] = useState<string | null>(null);

  const [trendLogs, setTrendLogs] = useState<TrendLog[]>([]);
  const [trendMetric, setTrendMetric] = useState<"sleep" | "stress">("sleep");

  const [modeModalVisible, setModeModalVisible] = useState(false);

  const fetchTodayInsight = useCallback(async (uid: string) => {
    setLoading(true);
    try {
      const today = new Date().toISOString().split("T")[0];
      const docRef = doc(db, "daily_insights", `${uid}_${today}`);
      const snap = await getDoc(docRef);

      if (snap.exists()) {
        setInsight(snap.data() as DailyInsight);
      } else {
        setInsight(null); // belum ada check-in/insight hari ini
      }
    } catch (error) {
      console.error("Gagal ambil insight:", error);
      setInsight(null);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchWeeklyTrend = useCallback(async (uid: string) => {
    try {
      const q = query(
        collection(db, "daily_logs"),
        where("userId", "==", uid),
        orderBy("date", "desc"),
        limit(7),
      );
      const snap = await getDocs(q);
      const logs = snap.docs.map((d) => d.data() as TrendLog).reverse();
      setTrendLogs(logs);
    } catch (error) {
      console.error("Gagal ambil data tren:", error);
      setTrendLogs([]);
    }
  }, []);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        setUserName(user.displayName || user.email?.split("@")[0] || "Kamu");
        setUid(user.uid);
      }
    });
    return unsubscribe;
  }, []);

  // Refetch tiap kali tab Home ke-focus (mis. balik dari Check-in setelah submit),
  // bukan cuma sekali pas login/app-load.
  useFocusEffect(
    useCallback(() => {
      if (uid) {
        fetchTodayInsight(uid);
        fetchWeeklyTrend(uid);
      }
    }, [uid, fetchTodayInsight, fetchWeeklyTrend]),
  );

  const openCheckIn = () => {
    setModeModalVisible(false);
    router.push("/checkin");
  };

  const openVoiceCheckIn = () => {
    setModeModalVisible(false);
    router.push("/check-in-voice");
  };

  // ===================== TAMPILAN =====================
  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.topBar}>
        <View style={styles.topBarLeft}>
          <View style={styles.avatar}>
            <MaterialIcons name="person" size={20} color="#fff" />
          </View>
          <Text style={styles.greeting}>Halo, {userName}</Text>
        </View>
        {/* Belum ada sistem notifikasi — ikon placeholder, belum ada onPress */}
        <Pressable style={styles.notifButton}>
          <MaterialIcons
            name="notifications-none"
            size={22}
            color={AuthDesign.primary}
          />
        </Pressable>
      </View>

      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.scrollContent}
      >
        {/* Insight Card - PMA-35 */}
        <View style={styles.insightCard}>
          <View style={styles.insightHeader}>
            <MaterialIcons
              name="auto-awesome"
              size={18}
              color={AuthDesign.primary}
            />
            <Text style={styles.insightLabel}>AI Ringkasan</Text>
          </View>

          {loading ? (
            <ActivityIndicator
              color={AuthDesign.primary}
              style={{ marginVertical: 8 }}
            />
          ) : insight ? (
            <Text style={styles.insightText}>{insight.insightText}</Text>
          ) : (
            <Text style={styles.insightEmptyText}>
              Belum ada insight hari ini. Yuk isi Daily Check-in dulu!
            </Text>
          )}

          <MaterialIcons
            name="bedtime"
            size={90}
            color={AuthDesign.primary}
            style={styles.insightDecoration}
          />
        </View>

        {/* Grafik tren 7 hari terakhir, data asli dari daily_logs */}
        <View style={styles.sectionBlock}>
          <View style={styles.trendHeader}>
            <Text style={styles.sectionTitle}>
              Pola Kesehatan 7 Hari Terakhir
            </Text>
            <View style={styles.trendTabs}>
              <Pressable
                onPress={() => setTrendMetric("sleep")}
                style={[
                  styles.trendTab,
                  trendMetric === "sleep" && styles.trendTabActive,
                ]}
              >
                <Text
                  style={[
                    styles.trendTabText,
                    trendMetric === "sleep" && styles.trendTabTextActive,
                  ]}
                >
                  Tidur
                </Text>
              </Pressable>
              <Pressable
                onPress={() => setTrendMetric("stress")}
                style={[
                  styles.trendTab,
                  trendMetric === "stress" && styles.trendTabActive,
                ]}
              >
                <Text
                  style={[
                    styles.trendTabText,
                    trendMetric === "stress" && styles.trendTabTextActive,
                  ]}
                >
                  Stres
                </Text>
              </Pressable>
            </View>
          </View>

          <View style={styles.chartCard}>
            {trendLogs.length < 2 ? (
              <View style={styles.trendEmpty}>
                <Text style={styles.insightEmptyText}>
                  {trendLogs.length === 0
                    ? "Belum ada data check-in buat ditampilin grafiknya."
                    : "Baru 1 hari data, isi check-in lagi biar grafiknya kebentuk."}
                </Text>
              </View>
            ) : (
              <TrendChart
                data={trendLogs.map((l) => ({
                  date: l.date,
                  value: trendMetric === "sleep" ? l.sleepHours : l.stressLevel,
                }))}
                metric={trendMetric}
                labels={trendLogs.map((l) => dayLabel(l.date))}
              />
            )}
          </View>
        </View>

        {/* Detail Pola Terkini — DUMMY, nunggu keputusan tim soal sumber data
            (lihat memory: project_home_detail_pola_dummy) */}
        <View style={styles.sectionBlock}>
          <Text style={styles.sectionTitle}>Detail Pola Terkini</Text>
          <View style={styles.detailCard}>
            <View style={styles.insightHeader}>
              <MaterialIcons
                name="bedtime"
                size={18}
                color={AuthDesign.primary}
              />
              <Text style={styles.insightLabel}>Analisis Tidur</Text>
            </View>
            <Text style={styles.insightText}>
              Rata-rata tidur Anda minggu ini adalah 6 jam 20 menit per hari,
              dengan kualitas yang cukup baik namun perlu konsistensi.
            </Text>
          </View>

          <Pressable style={styles.detailRow}>
            <View style={styles.detailRowLeft}>
              <View style={styles.detailRowIconBox}>
                <MaterialIcons
                  name="psychology"
                  size={20}
                  color={AuthDesign.error}
                />
              </View>
              <View style={styles.detailRowTextBox}>
                <Text style={styles.detailRowTitle}>Wawasan Stres</Text>
                <Text style={styles.detailRowDesc}>
                  Level stres meningkat saat durasi tidur di bawah 6 jam.
                </Text>
              </View>
            </View>
            <MaterialIcons
              name="chevron-right"
              size={20}
              color={AuthDesign.onSurfaceVariant}
            />
          </Pressable>
        </View>
      </ScrollView>

      <Pressable style={styles.fab} onPress={() => setModeModalVisible(true)}>
        <MaterialIcons name="add" size={22} color="#fff" />
        <Text style={styles.fabText}>Catat Hari Ini</Text>
      </Pressable>

      <Modal
        visible={modeModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setModeModalVisible(false)}
      >
        <Pressable
          style={styles.modalBackdrop}
          onPress={() => setModeModalVisible(false)}
        >
          <Pressable
            style={styles.modalSheet}
            onPress={(e) => e.stopPropagation()}
          >
            <View style={styles.modalHandle} />
            <Text style={styles.modalTitle}>Pilih Mode Input</Text>
            <Text style={styles.modalSubtitle}>
              Pilih cara ternyamanmu untuk mencatat aktivitas.
            </Text>

            <Pressable style={styles.modeOption} onPress={openCheckIn}>
              <View style={styles.modeIconBox}>
                <MaterialIcons
                  name="fact-check"
                  size={28}
                  color={AuthDesign.primary}
                />
              </View>
              <View style={styles.modeOptionTextBox}>
                <Text style={styles.modeOptionTitle}>Mode Pilihan</Text>
                <Text style={styles.modeOptionDesc}>
                  Tap cepat dengan pilihan ikon yang tersedia
                </Text>
              </View>
            </Pressable>

            <Pressable style={styles.modeOption} onPress={openVoiceCheckIn}>
              <View style={styles.modeIconBox}>
                <MaterialIcons
                  name="mic"
                  size={28}
                  color={AuthDesign.primary}
                />
              </View>
              <View style={styles.modeOptionTextBox}>
                <Text style={styles.modeOptionTitle}>Mode Suara</Text>
                <Text style={styles.modeOptionDesc}>
                  Ceritakan harimu, kami yang akan mencatatnya
                </Text>
              </View>
            </Pressable>

            <Pressable onPress={() => setModeModalVisible(false)}>
              <Text style={styles.modalCancel}>Batal</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  container: { flex: 1 },
  scrollContent: {
    paddingHorizontal: AuthSpacing.screenPadding,
    paddingBottom: 140,
    gap: 24,
  },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: AuthSpacing.screenPadding,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: AuthDesign.brandAccent + "30",
    backgroundColor: AuthDesign.background,
  },
  topBarLeft: { flexDirection: "row", alignItems: "center", gap: 10 },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: AuthDesign.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  notifButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  greeting: { fontSize: 16, fontWeight: "700", color: AuthDesign.onSurface },

  insightCard: {
    borderRadius: AuthRadius.card,
    padding: AuthSpacing.cardPadding,
    overflow: "hidden",
    position: "relative",
    backgroundColor: AuthDesign.surface,
    borderWidth: 1,
    borderColor: AuthDesign.brandAccent + "4D",
    shadowColor: "#000",
    shadowOpacity: 0.04,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  insightHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 8,
  },
  insightLabel: {
    fontSize: 11,
    fontWeight: "700",
    color: AuthDesign.primary,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  insightText: {
    fontSize: 15,
    fontWeight: "500",
    color: AuthDesign.onSurface,
    lineHeight: 22,
  },
  insightEmptyText: {
    fontSize: 13,
    color: AuthDesign.onSurfaceVariant,
    lineHeight: 19,
  },
  insightDecoration: {
    position: "absolute",
    right: -12,
    bottom: -12,
    opacity: 0.08,
  },

  sectionBlock: { gap: 12 },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: AuthDesign.onSurface,
  },
  trendHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  trendTabs: {
    flexDirection: "row",
    backgroundColor: AuthDesign.brandAccent + "30",
    borderRadius: AuthRadius.chip,
    padding: 3,
    gap: 2,
  },
  trendTab: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: AuthRadius.chip },
  trendTabActive: { backgroundColor: AuthDesign.primaryLight },
  trendTabText: {
    fontSize: 12,
    fontWeight: "600",
    color: AuthDesign.onSurfaceVariant,
  },
  trendTabTextActive: { color: "#fff" },
  chartCard: {
    height: 240,
    borderRadius: AuthRadius.card,
    borderWidth: 1,
    borderColor: AuthDesign.outlineVariant + "4D",
    backgroundColor: AuthDesign.surface,
    padding: 16,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOpacity: 0.02,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  },
  trendChart: { borderRadius: AuthRadius.card },
  trendEmpty: {
    alignItems: "center",
    justifyContent: "center",
  },

  detailCard: {
    borderRadius: AuthRadius.card,
    padding: AuthSpacing.cardPadding,
    backgroundColor: AuthDesign.surface,
    borderWidth: 1,
    borderColor: AuthDesign.brandAccent + "4D",
    shadowColor: "#000",
    shadowOpacity: 0.02,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  },
  detailRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderWidth: 1,
    borderColor: AuthDesign.outlineVariant + "4D",
    borderRadius: AuthRadius.card,
    padding: 14,
    backgroundColor: AuthDesign.surface,
    shadowColor: "#000",
    shadowOpacity: 0.02,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  },
  detailRowLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    flex: 1,
  },
  detailRowIconBox: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: AuthDesign.error + "15",
    alignItems: "center",
    justifyContent: "center",
  },
  detailRowTextBox: { flex: 1 },
  detailRowTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: AuthDesign.onSurface,
  },
  detailRowDesc: { fontSize: 12, color: AuthDesign.onSurfaceVariant, marginTop: 2, lineHeight: 16 },

  fab: {
    position: "absolute",
    right: AuthSpacing.screenPadding,
    bottom: 24,
    backgroundColor: AuthDesign.primary,
    height: 52,
    paddingHorizontal: 20,
    borderRadius: 26,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    elevation: 4,
    shadowColor: AuthDesign.primary,
    shadowOpacity: 0.25,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
  },
  fabText: { color: "#fff", fontWeight: "700", fontSize: 14 },

  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(25,27,33,0.4)",
    justifyContent: "flex-end",
  },
  modalSheet: {
    backgroundColor: AuthDesign.background,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: AuthSpacing.screenPadding,
    paddingTop: 16,
    paddingBottom: 28,
    gap: 12,
  },
  modalHandle: {
    width: 48,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: AuthDesign.outlineVariant,
    alignSelf: "center",
    marginBottom: 8,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: AuthDesign.onSurface,
    textAlign: "center",
  },
  modalSubtitle: {
    fontSize: 13,
    color: AuthDesign.onSurfaceVariant,
    textAlign: "center",
    marginBottom: 8,
  },
  modeOption: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    padding: 14,
    borderWidth: 1.5,
    borderColor: AuthDesign.outlineVariant + "50",
    borderRadius: AuthRadius.card,
    backgroundColor: AuthDesign.surface,
  },
  modeIconBox: {
    width: 52,
    height: 52,
    borderRadius: 14,
    backgroundColor: AuthDesign.brandAccent,
    alignItems: "center",
    justifyContent: "center",
  },
  modeOptionTextBox: { flex: 1 },
  modeOptionTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: AuthDesign.onSurface,
  },
  modeOptionDesc: { fontSize: 12, color: AuthDesign.onSurfaceVariant, marginTop: 2, lineHeight: 16 },
  modalCancel: {
    textAlign: "center",
    fontSize: 14,
    fontWeight: "600",
    color: AuthDesign.onSurfaceVariant,
    paddingVertical: 12,
  },
});