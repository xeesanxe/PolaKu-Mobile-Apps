import { useState, useEffect } from 'react';
import { View, StyleSheet, Pressable } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import {
  useAudioRecorder,
  useAudioRecorderState,
  useAudioPlayer,
  useAudioPlayerStatus,
  RecordingPresets,
  AudioModule,
} from 'expo-audio';

import { Text } from '@/components/Themed';
import { AuthDesign, AuthRadius } from '@/constants/AuthDesign';

const SLEEP_COLOR = AuthDesign.primary;

type Props = {
  onRecordingReady: (uri: string) => void;
  onReset: () => void;
};

function formatDuration(millis: number) {
  const totalSeconds = Math.floor(millis / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

export function VoiceRecorder({ onRecordingReady, onReset }: Props) {
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const recorderState = useAudioRecorderState(recorder);
  const [recordedUri, setRecordedUri] = useState<string | null>(null);
  const [permissionDenied, setPermissionDenied] = useState(false);

  const player = useAudioPlayer(recordedUri ?? undefined);
  const playerStatus = useAudioPlayerStatus(player);

  useEffect(() => {
    (async () => {
      const status = await AudioModule.requestRecordingPermissionsAsync();
      if (!status.granted) {
        setPermissionDenied(true);
      }
    })();
  }, []);

  const startRecording = async () => {
    setRecordedUri(null);
    await recorder.prepareToRecordAsync();
    recorder.record();
  };

  const stopRecording = async () => {
    await recorder.stop();
    if (recorder.uri) {
      setRecordedUri(recorder.uri);
      onRecordingReady(recorder.uri);
    }
  };

  const togglePlayback = () => {
    if (playerStatus.playing) {
      player.pause();
    } else {
      player.seekTo(0);
      player.play();
    }
  };

  const handleReset = () => {
    setRecordedUri(null);
    onReset();
  };

  if (permissionDenied) {
    return (
      <View style={styles.centerBox}>
        <MaterialIcons name="mic-off" size={40} color={AuthDesign.error} />
        <Text style={[styles.permissionText, { color: AuthDesign.error }]}>
          Izin mikrofon diperlukan untuk merekam voice note. Aktifkan izin di pengaturan HP.
        </Text>
      </View>
    );
  }

  if (recordedUri) {
    return (
      <View style={styles.centerBox}>
        <View style={[styles.playbackCard, { borderColor: AuthDesign.brandAccent }]}>
          <Pressable
            onPress={togglePlayback}
            style={[styles.playButton, { backgroundColor: AuthDesign.primary }]}
          >
            <MaterialIcons
              name={playerStatus.playing ? 'pause' : 'play-arrow'}
              size={28}
              color="#fff"
            />
          </Pressable>
          <View style={styles.playbackInfo}>
            <Text style={[styles.playbackLabel, { color: AuthDesign.onSurface }]}>
              Rekaman siap
            </Text>
            <Text style={[styles.playbackDuration, { color: AuthDesign.onSurfaceVariant }]}>
              {formatDuration(playerStatus.currentTime * 1000)} /{' '}
              {formatDuration(playerStatus.duration * 1000)}
            </Text>
          </View>
        </View>

        <Pressable onPress={handleReset} style={styles.rerecordButton}>
          <MaterialIcons name="refresh" size={18} color={AuthDesign.outline} />
          <Text style={{ color: AuthDesign.outline, fontWeight: '600' }}>Rekam Ulang</Text>
        </Pressable>
      </View>
    );
  }

  if (recorderState.isRecording) {
    return (
      <View style={styles.centerBox}>
        <View style={[styles.pulseCircle, { backgroundColor: AuthDesign.error + '22' }]}>
          <View style={[styles.recordDot, { backgroundColor: AuthDesign.error }]} />
        </View>
        <Text style={[styles.timerText, { color: AuthDesign.onSurface }]}>
          {formatDuration(recorderState.durationMillis)}
        </Text>
        <Text style={[styles.hintText, { color: AuthDesign.onSurfaceVariant }]}>
          Ceritakan kondisimu hari ini...
        </Text>
        <Pressable
          onPress={stopRecording}
          style={[styles.stopButton, { backgroundColor: AuthDesign.error }]}
        >
          <MaterialIcons name="stop" size={28} color="#fff" />
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.centerBox}>
      <Text style={[styles.hintText, { color: AuthDesign.onSurfaceVariant, marginBottom: 20 }]}>
        Tekan tombol untuk mulai merekam
      </Text>
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
  centerBox: { alignItems: 'center', justifyContent: 'center', gap: 12, paddingVertical: 20 },
  micButton: {
    width: 80, height: 80, borderRadius: 40,
    alignItems: 'center', justifyContent: 'center',
  },
  stopButton: {
    width: 64, height: 64, borderRadius: 32,
    alignItems: 'center', justifyContent: 'center', marginTop: 8,
  },
  pulseCircle: {
    width: 90, height: 90, borderRadius: 45,
    alignItems: 'center', justifyContent: 'center',
  },
  recordDot: { width: 16, height: 16, borderRadius: 8 },
  timerText: { fontSize: 28, fontWeight: '700', fontVariant: ['tabular-nums'] },
  hintText: { fontSize: 13, textAlign: 'center' },
  permissionText: { fontSize: 13, textAlign: 'center', paddingHorizontal: 24 },
  playbackCard: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    borderWidth: 1.5, borderRadius: AuthRadius.card,
    padding: 16, width: '100%',
  },
  playButton: {
    width: 48, height: 48, borderRadius: 24,
    alignItems: 'center', justifyContent: 'center',
  },
  playbackInfo: { flex: 1, gap: 2 },
  playbackLabel: { fontSize: 14, fontWeight: '600' },
  playbackDuration: { fontSize: 12 },
  rerecordButton: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    marginTop: 4, paddingVertical: 8, paddingHorizontal: 16,
  },
}); 