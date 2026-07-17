import { useState, useEffect, useRef } from 'react';
import { StyleSheet, Pressable, View as RNView } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useAudioRecorder, RecordingPresets, AudioModule, setAudioModeAsync } from 'expo-audio';
import * as FileSystem from 'expo-file-system/legacy';

import { Text, View } from '@/components/Themed';
import { AuthDesign } from '@/constants/AuthDesign';

type Props = {
  onRecordingReady: (uri: string) => void;
};

function formatDuration(millis: number) {
  const totalSeconds = Math.floor(millis / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

// Workaround untuk bug expo-audio Android: recorder.uri kadang tidak valid.
// Cari file rekaman terbaru langsung dari cache directory.
async function findLatestRecordingFile(): Promise<string | null> {
  try {
    const cacheDir = FileSystem.cacheDirectory;
    if (!cacheDir) return null;

    const dirs = await FileSystem.readDirectoryAsync(cacheDir);
    const audioDir = dirs.find((d) => d.toLowerCase().includes('audio') || d.toLowerCase().includes('av'));

    const searchDir = audioDir ? `${cacheDir}${audioDir}/` : cacheDir;
    const files = await FileSystem.readDirectoryAsync(searchDir);

    const audioFiles = files.filter(
      (f) => f.endsWith('.m4a') || f.endsWith('.caf') || f.endsWith('.wav') || f.endsWith('.mp4'),
    );
    if (audioFiles.length === 0) return null;

    let latestFile: string | null = null;
    let latestTime = 0;

    for (const file of audioFiles) {
      const fullPath = `${searchDir}${file}`;
      const info = await FileSystem.getInfoAsync(fullPath);
      if (info.exists && info.modificationTime && info.modificationTime > latestTime) {
        latestTime = info.modificationTime;
        latestFile = fullPath;
      }
    }

    return latestFile;
  } catch (err) {
    console.log('[VoiceRecorder] findLatestRecordingFile error:', err);
    return null;
  }
}

export function VoiceRecorder({ onRecordingReady }: Props) {
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const [permissionDenied, setPermissionDenied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [stopping, setStopping] = useState(false);
  const [durationMillis, setDurationMillis] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    (async () => {
      const status = await AudioModule.requestRecordingPermissionsAsync();
      if (!status.granted) {
        setPermissionDenied(true);
        return;
      }
      await setAudioModeAsync({
        allowsRecording: true,
        playsInSilentMode: true,
      });
    })();

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  const startRecording = async () => {
    setError(null);
    try {
      await recorder.prepareToRecordAsync();
      recorder.record();
      setIsRecording(true);
      setDurationMillis(0);
      timerRef.current = setInterval(() => {
        setDurationMillis((prev) => prev + 1000);
      }, 1000);
    } catch (err: any) {
      console.log('[VoiceRecorder] startRecording error:', err?.message);
      setError('Gagal memulai rekaman. Coba lagi.');
    }
  };

  const stopRecording = async () => {
    if (timerRef.current) clearInterval(timerRef.current);
    setIsRecording(false);
    setStopping(true);
    setError(null);

    try {
      await recorder.stop();
    } catch (err: any) {
      console.log('[VoiceRecorder] stop() error (diabaikan, lanjut cari file):', err?.message);
    }

    try {
      await new Promise((resolve) => setTimeout(resolve, 500));

      let uri: string | null = null;
      try {
        uri = recorder.uri;
      } catch {
        uri = null;
      }

      if (!uri) {
        uri = await findLatestRecordingFile();
      }

      if (uri) {
        onRecordingReady(uri);
      } else {
        setError('Rekaman gagal disimpan. Coba rekam ulang.');
      }
    } catch (err: any) {
      console.log('[VoiceRecorder] stopRecording fallback error:', err?.message);
      setError('Gagal menyimpan rekaman. Coba rekam ulang.');
    } finally {
      setStopping(false);
    }
  };

  if (permissionDenied) {
    return (
      <View style={styles.centerBox} lightColor="transparent">
        <MaterialIcons name="mic-off" size={40} color={AuthDesign.error} />
        <Text style={[styles.permissionText, { color: AuthDesign.error }]}>
          Izin mikrofon diperlukan. Aktifkan izin di pengaturan HP.
        </Text>
      </View>
    );
  }

  if (isRecording || stopping) {
    return (
      <View style={styles.centerBox} lightColor="transparent">
        <RNView style={[styles.pulseCircle, { backgroundColor: AuthDesign.error + '22' }]}>
          <RNView style={[styles.recordDot, { backgroundColor: AuthDesign.error }]} />
        </RNView>
        <Text style={[styles.timerText, { color: AuthDesign.onSurface }]}>
          {stopping ? 'Menyimpan...' : formatDuration(durationMillis)}
        </Text>
        {!stopping && (
          <Pressable
            onPress={stopRecording}
            style={[styles.stopButton, { backgroundColor: AuthDesign.error }]}
          >
            <MaterialIcons name="stop" size={28} color="#fff" />
          </Pressable>
        )}
      </View>
    );
  }

  return (
    <View style={styles.centerBox} lightColor="transparent">
      {error && (
        <Text style={[styles.permissionText, { color: AuthDesign.error }]}>{error}</Text>
      )}
      <Pressable
        onPress={startRecording}
        style={[styles.micButton, { backgroundColor: AuthDesign.primary }]}
      >
        <MaterialIcons name="mic" size={32} color="#fff" />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  centerBox: { alignItems: 'center', justifyContent: 'center', gap: 12, paddingVertical: 12 },
  micButton: { width: 72, height: 72, borderRadius: 36, alignItems: 'center', justifyContent: 'center' },
  stopButton: { width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center', marginTop: 4 },
  pulseCircle: { width: 80, height: 80, borderRadius: 40, alignItems: 'center', justifyContent: 'center' },
  recordDot: { width: 16, height: 16, borderRadius: 8 },
  timerText: { fontSize: 24, fontWeight: '700', fontVariant: ['tabular-nums'] },
  permissionText: { fontSize: 13, textAlign: 'center', paddingHorizontal: 24 },
});