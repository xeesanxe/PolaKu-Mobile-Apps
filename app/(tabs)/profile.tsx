import React, { useState, useCallback } from 'react';
import {
  StyleSheet,
  Pressable,
  ScrollView,
  Modal,
  TextInput,
  Image,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { signOut, onAuthStateChanged } from 'firebase/auth';
import {
  doc,
  getDoc,
  updateDoc,
  collection,
  query,
  where,
  orderBy,
  limit,
  getDocs,
  getCountFromServer,
} from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';

import { Text, View } from '@/components/Themed';
import { auth, db, storage } from '@/services/firebase';
import { AuthDesign, AuthSpacing } from '@/constants/AuthDesign';

const REMINDER_PRESETS = ['07:00', '12:00', '18:00', '20:00', '21:00'];

// "Streak saat ini" — hari berturut-turut check-in. Kalau hari ini belum
// check-in, itu belum dianggap putus (masih bisa isi sampai hari berakhir),
// jadi mulai ngitung dari kemarin.
function computeStreak(logDates: Set<string>): number {
  const cursor = new Date();
  const todayStr = cursor.toISOString().split('T')[0];
  if (!logDates.has(todayStr)) {
    cursor.setDate(cursor.getDate() - 1);
  }
  let streak = 0;
  while (logDates.has(cursor.toISOString().split('T')[0])) {
    streak++;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}

export default function ProfileScreen() {
  // ===================== LOGIC =====================
  const [uid, setUid] = useState<string | null>(null);
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [photoURL, setPhotoURL] = useState<string | null>(null);
  const [reminderTime, setReminderTime] = useState<string | null>(null);

  const [streak, setStreak] = useState(0);
  const [totalCheckins, setTotalCheckins] = useState(0);
  const [statsLoading, setStatsLoading] = useState(true);

  const [editVisible, setEditVisible] = useState(false);
  const [editName, setEditName] = useState('');
  const [editPhotoUri, setEditPhotoUri] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [reminderSaving, setReminderSaving] = useState(false);

  const fetchProfile = useCallback(async (userId: string) => {
    try {
      const snap = await getDoc(doc(db, 'users', userId));
      const data = snap.data();
      setName(data?.name || '');
      setPhotoURL(data?.photoURL || null);
      setReminderTime(data?.reminderTime || null);
    } catch (error) {
      console.error('Gagal ambil profil:', error);
    }
  }, []);

  const fetchStats = useCallback(async (userId: string) => {
    setStatsLoading(true);
    try {
      const logsCol = collection(db, 'daily_logs');
      const userLogsQuery = query(logsCol, where('userId', '==', userId));

      const [countSnap, recentSnap] = await Promise.all([
        getCountFromServer(userLogsQuery),
        getDocs(query(userLogsQuery, orderBy('date', 'desc'), limit(90))),
      ]);

      setTotalCheckins(countSnap.data().count);
      const dates = new Set(recentSnap.docs.map((d) => d.data().date as string));
      setStreak(computeStreak(dates));
    } catch (error) {
      console.error('Gagal ambil statistik:', error);
      setTotalCheckins(0);
      setStreak(0);
    } finally {
      setStatsLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      const unsubscribe = onAuthStateChanged(auth, (user) => {
        if (user) {
          setUid(user.uid);
          setEmail(user.email || '');
          fetchProfile(user.uid);
          fetchStats(user.uid);
        }
      });
      return unsubscribe;
    }, [fetchProfile, fetchStats])
  );

  const openEditModal = () => {
    setEditName(name);
    setEditPhotoUri(photoURL);
    setEditVisible(true);
  };

  const pickPhoto = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Izin Ditolak', 'Butuh izin akses galeri buat ganti foto profil.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.7,
    });
    if (!result.canceled && result.assets[0]) {
      setEditPhotoUri(result.assets[0].uri);
    }
  };

  const saveProfile = async () => {
    if (!uid) return;
    if (!editName.trim()) {
      Alert.alert('Belum Lengkap', 'Nama gak boleh kosong.');
      return;
    }

    setSaving(true);
    try {
      let newPhotoURL = photoURL;

      // Foto baru dipilih (URI lokal, beda dari URL yang udah tersimpan) — upload dulu.
      if (editPhotoUri && editPhotoUri !== photoURL) {
        const response = await fetch(editPhotoUri);
        const blob = await response.blob();
        const photoRef = ref(storage, `profile-photos/${uid}/photo.jpg`);
        await uploadBytes(photoRef, blob);
        newPhotoURL = await getDownloadURL(photoRef);
      }

      await updateDoc(doc(db, 'users', uid), {
        name: editName.trim(),
        photoURL: newPhotoURL,
      });

      setName(editName.trim());
      setPhotoURL(newPhotoURL);
      setEditVisible(false);
    } catch (error: any) {
      console.error('Gagal simpan profil:', error);
      Alert.alert('Gagal', 'Gagal menyimpan profil, coba lagi.');
    } finally {
      setSaving(false);
    }
  };

  const selectReminderTime = async (time: string) => {
    if (!uid) return;
    setReminderSaving(true);
    try {
      // Jam pengingat selalu ke-simpen duluan, terlepas dari berhasil/gaknya
      // penjadwalan notifikasi — biar preferensinya gak hilang kalau
      // notifikasinya gagal (mis. keterbatasan Expo Go di bawah).
      await updateDoc(doc(db, 'users', uid), { reminderTime: time });
      setReminderTime(time);

      try {
        // require() dinamis, sengaja BUKAN import statis di atas — modul
        // expo-notifications punya kode level-modul yang otomatis nyoba
        // setup auto-registration push token pas di-import, dan itu THROW
        // di Android+Expo Go (SDK 53+, batasan resmi Expo Go, bukan bug
        // kita). Local scheduling (yang kita pakai) sebenernya masih
        // didukung, tapi cuma bisa dites di development build.
        const Notifications = require('expo-notifications');

        const permission = await Notifications.requestPermissionsAsync();
        if (!permission.granted) {
          Alert.alert(
            'Izin Ditolak',
            'Jam pengingat kesimpen, tapi butuh izin notifikasi buat ' +
            'beneran ngingetin kamu.'
          );
          return;
        }

        const [hour, minute] = time.split(':').map(Number);
        await Notifications.cancelAllScheduledNotificationsAsync();
        await Notifications.scheduleNotificationAsync({
          content: {
            title: 'Waktunya Check-in! 👋',
            body: 'Yuk isi Daily Check-in kamu hari ini di PolaKu.',
          },
          trigger: {
            type: Notifications.SchedulableTriggerInputTypes.DAILY,
            hour,
            minute,
          },
        });
      } catch (notifError) {
        console.warn('Notifikasi lokal gak bisa dijadwalin:', notifError);
        Alert.alert(
          'Jam Tersimpan',
          'Jam pengingat udah kesimpen. Notifikasinya belum bisa aktif di ' +
          'Expo Go — coba pakai development build buat ngetes ini.'
        );
      }
    } catch (error) {
      console.error('Gagal atur reminder:', error);
      Alert.alert('Gagal', 'Gagal menyimpan jam pengingat, coba lagi.');
    } finally {
      setReminderSaving(false);
    }
  };

  const initial = name ? name.charAt(0).toUpperCase() : '?';

  // ===================== TAMPILAN =====================
  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.topBar} lightColor={AuthDesign.background}>
        <View style={styles.brandBadge}>
          <MaterialIcons name="favorite" size={18} color="#fff" />
        </View>
        <Text style={styles.brandText}>PolaKu</Text>
      </View>

      <ScrollView style={styles.container} contentContainerStyle={styles.scrollContent}>
        {/* Hero */}
        <View style={styles.heroCard}>
          <Pressable style={styles.avatarWrap} onPress={openEditModal}>
            {photoURL ? (
              <Image source={{ uri: photoURL }} style={styles.avatarImage} />
            ) : (
              <View style={styles.avatarFallback} lightColor="transparent">
                <Text style={styles.avatarFallbackText}>{initial}</Text>
              </View>
            )}
          </Pressable>
          <Text style={styles.heroName}>{name || 'Tanpa Nama'}</Text>
          <Pressable style={styles.editButton} onPress={openEditModal}>
            <Text style={styles.editButtonText}>Edit Profil</Text>
          </Pressable>
        </View>

        {/* Statistik Ringkas */}
        <View style={styles.sectionBlock} lightColor="transparent">
          <Text style={styles.sectionLabel}>Statistik Ringkas</Text>
          <View style={styles.statsRow} lightColor="transparent">
            <View style={styles.statCard}>
              <MaterialIcons name="local-fire-department" size={22} color={AuthDesign.primary} />
              {statsLoading ? (
                <ActivityIndicator color={AuthDesign.primary} style={{ marginVertical: 4 }} />
              ) : (
                <Text style={styles.statValue}>{streak} Hari</Text>
              )}
              <Text style={styles.statLabel}>Streak Saat Ini</Text>
            </View>
            <View style={styles.statCard}>
              <MaterialIcons name="task-alt" size={22} color={AuthDesign.primary} />
              {statsLoading ? (
                <ActivityIndicator color={AuthDesign.primary} style={{ marginVertical: 4 }} />
              ) : (
                <Text style={styles.statValue}>{totalCheckins}</Text>
              )}
              <Text style={styles.statLabel}>Total Check-in</Text>
            </View>
          </View>
        </View>

        {/* Informasi Pribadi */}
        <View style={styles.sectionBlock} lightColor="transparent">
          <Text style={styles.sectionLabel}>Informasi Pribadi</Text>
          <View style={styles.infoCard}>
            <View style={styles.infoIconBox}>
              <MaterialIcons name="mail" size={20} color={AuthDesign.primary} />
            </View>
            <View style={styles.infoTextBox} lightColor="transparent">
              <Text style={styles.infoLabel}>Email</Text>
              <Text style={styles.infoValue}>{email}</Text>
            </View>
          </View>
        </View>

        {/* Pengaturan Aplikasi */}
        <View style={styles.sectionBlock} lightColor="transparent">
          <Text style={styles.sectionLabel}>Pengaturan Aplikasi</Text>
          <View style={styles.settingsCard}>
            <View style={styles.settingsRowTop} lightColor="transparent">
              <View style={styles.infoIconBox}>
                <MaterialIcons name="notifications" size={20} color={AuthDesign.primary} />
              </View>
              <View style={styles.infoTextBox} lightColor="transparent">
                <Text style={styles.infoLabel}>Pengingat Check-in Harian</Text>
                <Text style={styles.infoValue}>
                  {reminderTime ? `Jam ${reminderTime}` : 'Belum diatur'}
                </Text>
              </View>
              {reminderSaving && <ActivityIndicator color={AuthDesign.primary} />}
            </View>
            <View style={styles.reminderChipRow} lightColor="transparent">
              {REMINDER_PRESETS.map((time) => (
                <Pressable
                  key={time}
                  onPress={() => selectReminderTime(time)}
                  disabled={reminderSaving}
                  style={[styles.reminderChip, reminderTime === time && styles.reminderChipActive]}
                >
                  <Text
                    style={[
                      styles.reminderChipText,
                      reminderTime === time && styles.reminderChipTextActive,
                    ]}
                  >
                    {time}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>
        </View>

        {/* Logout */}
        <Pressable style={styles.logoutButton} onPress={() => signOut(auth)}>
          <MaterialIcons name="logout" size={20} color={AuthDesign.error} />
          <Text style={styles.logoutText}>Logout</Text>
        </Pressable>
        <Text style={styles.versionText}>Versi Aplikasi 1.0.0 (PolaKu)</Text>
      </ScrollView>

      {/* Edit Profil modal */}
      <Modal
        visible={editVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setEditVisible(false)}
      >
        <Pressable style={styles.modalBackdrop} onPress={() => setEditVisible(false)}>
          <Pressable style={styles.modalSheet} onPress={(e) => e.stopPropagation()}>
            <View style={styles.modalHandle} />
            <Text style={styles.modalTitle}>Edit Profil</Text>

            <Pressable style={styles.editAvatarWrap} onPress={pickPhoto}>
              {editPhotoUri ? (
                <Image source={{ uri: editPhotoUri }} style={styles.avatarImage} />
              ) : (
                <View style={styles.avatarFallback} lightColor={AuthDesign.brandAccent}>
                  <Text style={styles.avatarFallbackText}>{initial}</Text>
                </View>
              )}
              <View style={styles.editAvatarBadge}>
                <MaterialIcons name="photo-camera" size={16} color="#fff" />
              </View>
            </Pressable>

            <Text style={styles.fieldLabel}>Nama</Text>
            <TextInput
              value={editName}
              onChangeText={setEditName}
              placeholder="Nama lengkap"
              placeholderTextColor={AuthDesign.outline}
              style={styles.textInput}
            />

            <Pressable
              style={styles.saveButton}
              onPress={saveProfile}
              disabled={saving}
            >
              {saving ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.saveButtonText}>Simpan</Text>
              )}
            </Pressable>
            <Pressable onPress={() => setEditVisible(false)} disabled={saving}>
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
    padding: AuthSpacing.screenPadding,
    paddingBottom: 40,
    gap: 24,
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
  heroCard: {
    borderRadius: 24,
    padding: 24,
    backgroundColor: AuthDesign.primary,
    alignItems: 'center',
  },
  avatarWrap: {
    width: 88,
    height: 88,
    borderRadius: 44,
    borderWidth: 3,
    borderColor: 'rgba(255,255,255,0.3)',
    padding: 3,
    marginBottom: 12,
  },
  avatarImage: { width: '100%', height: '100%', borderRadius: 44 },
  avatarFallback: {
    width: '100%',
    height: '100%',
    borderRadius: 44,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  avatarFallbackText: { fontSize: 32, fontWeight: '700', color: '#fff' },
  heroName: { fontSize: 22, fontWeight: '700', color: '#fff' },
  editButton: {
    marginTop: 12,
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingVertical: 8,
    paddingHorizontal: 20,
    borderRadius: 999,
  },
  editButtonText: { color: '#fff', fontWeight: '600', fontSize: 13 },
  sectionBlock: { gap: 10 },
  sectionLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: AuthDesign.onSurfaceVariant,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginLeft: 4,
  },
  statsRow: { flexDirection: 'row', gap: 12 },
  statCard: {
    flex: 1,
    backgroundColor: AuthDesign.brandAccent,
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
    gap: 2,
  },
  statValue: { fontSize: 20, fontWeight: '700', color: AuthDesign.primary },
  statLabel: { fontSize: 11, color: AuthDesign.onSurfaceVariant },
  infoCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: AuthDesign.outlineVariant,
    borderRadius: 16,
    padding: 14,
  },
  infoIconBox: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: '#f0f0f7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  infoTextBox: { flex: 1 },
  infoLabel: { fontSize: 11, color: AuthDesign.onSurfaceVariant },
  infoValue: { fontSize: 14, color: AuthDesign.onSurface, fontWeight: '500' },
  settingsCard: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: AuthDesign.outlineVariant,
    borderRadius: 16,
    padding: 14,
    gap: 12,
  },
  settingsRowTop: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  reminderChipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  reminderChip: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: AuthDesign.outlineVariant,
  },
  reminderChipActive: { backgroundColor: AuthDesign.primary, borderColor: AuthDesign.primary },
  reminderChipText: { fontSize: 13, fontWeight: '600', color: AuthDesign.onSurfaceVariant },
  reminderChipTextActive: { color: '#fff' },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#ffdad6',
    paddingVertical: 16,
    borderRadius: 16,
  },
  logoutText: { color: AuthDesign.error, fontWeight: '700', fontSize: 14 },
  versionText: {
    textAlign: 'center',
    fontSize: 11,
    color: AuthDesign.outline,
    marginTop: -12,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(25,27,33,0.4)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: 20,
    paddingBottom: 32,
    alignItems: 'center',
    gap: 12,
  },
  modalHandle: {
    width: 48,
    height: 6,
    borderRadius: 3,
    backgroundColor: AuthDesign.outlineVariant,
    marginBottom: 4,
  },
  modalTitle: { fontSize: 18, fontWeight: '700', color: AuthDesign.onSurface },
  editAvatarWrap: { width: 88, height: 88, marginVertical: 8 },
  editAvatarBadge: {
    position: 'absolute',
    right: 0,
    bottom: 0,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: AuthDesign.primary,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#fff',
  },
  fieldLabel: {
    alignSelf: 'flex-start',
    fontSize: 13,
    fontWeight: '600',
    color: AuthDesign.onSurface,
  },
  textInput: {
    width: '100%',
    borderWidth: 1.5,
    borderColor: AuthDesign.outlineVariant,
    borderRadius: 12,
    paddingHorizontal: 14,
    height: 48,
    fontSize: 15,
    color: AuthDesign.onSurface,
  },
  saveButton: {
    width: '100%',
    backgroundColor: AuthDesign.primary,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 8,
  },
  saveButtonText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  modalCancel: {
    fontSize: 14,
    fontWeight: '600',
    color: AuthDesign.onSurfaceVariant,
    paddingVertical: 8,
  },
});
