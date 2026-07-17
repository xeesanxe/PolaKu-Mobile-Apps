import React, { useEffect, useState, useCallback } from 'react';
import { StyleSheet, ActivityIndicator, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { signOut } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';

import { Text, View } from '@/components/Themed';
import { auth, db } from '@/services/firebase';
import { AuthDesign, AuthSpacing } from '@/constants/AuthDesign';

type DailyInsight = {
  insightText: string;
  triggeredFlags: {
    low_sleep_symptom_flag: boolean;
    irregular_meal_flag: boolean;
    high_stress_flag: boolean;
    negative_mood_flag: boolean;
  };
  source: 'llm' | 'fallback' | 'default';
  date: string;
};

const CARD_COLOR = '#C4E2F5';

export default function HomeScreen() {
  // ===================== LOGIC =====================
  const [insight, setInsight] = useState<DailyInsight | null>(null);
  const [loading, setLoading] = useState(true);
  const [userName, setUserName] = useState<string>('');
  const [uid, setUid] = useState<string | null>(null);

  const fetchTodayInsight = useCallback(async (uid: string) => {
    setLoading(true);
    try {
      const today = new Date().toISOString().split('T')[0];
      const docRef = doc(db, 'daily_insights', `${uid}_${today}`);
      const snap = await getDoc(docRef);

      if (snap.exists()) {
        setInsight(snap.data() as DailyInsight);
      } else {
        setInsight(null); // belum ada check-in/insight hari ini
      }
    } catch (error) {
      console.error('Gagal ambil insight:', error);
      setInsight(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        setUserName(user.displayName || user.email?.split('@')[0] || 'Kamu');
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
      }
    }, [uid, fetchTodayInsight])
  );

  // ===================== TAMPILAN =====================
  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container} lightColor={AuthDesign.background}>
        <Text style={styles.greeting}>Halo, {userName}</Text>

        {/* Insight Card - PMA-35 */}
        <View style={styles.insightCard} lightColor={CARD_COLOR}>
          <View style={styles.insightHeader} lightColor={CARD_COLOR}>
            <MaterialIcons name="auto-awesome" size={18} color={AuthDesign.primary} />
            <Text style={styles.insightLabel}>AI Ringkasan</Text>
          </View>

          {loading ? (
            <ActivityIndicator color={AuthDesign.primary} style={{ marginVertical: 8 }} />
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

        {/* Sementara — logout untuk testing alur auth guard */}
        <Pressable
          onPress={() => signOut(auth)}
          style={[styles.logoutButton, { borderColor: AuthDesign.outlineVariant }]}
        >
          <Text style={{ color: AuthDesign.error, fontWeight: '600' }}>Logout (testing)</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  container: {
    flex: 1,
    padding: AuthSpacing.screenPadding,
    gap: 16,
  },
  greeting: { fontSize: 22, fontWeight: '700', marginTop: 8 },
  insightCard: {
    borderRadius: 12,
    padding: 16,
    overflow: 'hidden',
    position: 'relative',
  },
  insightHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  insightLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: AuthDesign.primary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  insightText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#001a40',
    lineHeight: 24,
  },
  insightEmptyText: {
    fontSize: 14,
    color: AuthDesign.onSurfaceVariant,
  },
  insightDecoration: {
    position: 'absolute',
    right: -12,
    bottom: -12,
    opacity: 0.1,
  },
  logoutButton: {
    marginTop: 24,
    alignSelf: 'center',
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 10,
    borderWidth: 1.5,
  },
});