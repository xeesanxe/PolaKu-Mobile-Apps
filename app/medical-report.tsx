import React, { useState } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator, Alert, ScrollView } from 'react-native';
import { handleGenerateMedicalReportPDF, SAMPLE_HEALTH_LOG_DATA } from '@/services/medical-report-service';

/**
 * Medical Report Screen
 * Path: app/medical-report.tsx
 */

export default function MedicalReportScreen() {
  const [isGenerating, setIsGenerating] = useState(false);

  const handleDownloadReport = async () => {
    setIsGenerating(true);
    try {
      await handleGenerateMedicalReportPDF(SAMPLE_HEALTH_LOG_DATA);
      Alert.alert('Sukses', 'Laporan medis berhasil dibuat. Pilih folder untuk menyimpan file.');
    } catch (error) {
      Alert.alert(
        'Gagal',
        `Terjadi kesalahan saat membuat laporan: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
      console.error(error);
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <ScrollView style={{ flex: 1, backgroundColor: '#FFFFFF', padding: 20 }}>
      {/* Header */}
      <View style={{ marginBottom: 30 }}>
        <Text style={{ fontSize: 24, fontWeight: 'bold', color: '#1E3A8A', marginBottom: 8 }}>
          Laporan Kesehatan 7 Hari
        </Text>
        <Text style={{ fontSize: 14, color: '#6B7280' }}>
          Periode: {SAMPLE_HEALTH_LOG_DATA.period}
        </Text>
      </View>

      {/* Statistics Cards */}
      <View style={{ marginBottom: 25 }}>
        <Text style={{ fontSize: 14, fontWeight: 'bold', color: '#1E3A8A', marginBottom: 12 }}>
          Ringkasan Data:
        </Text>

        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 }}>
          <View
            style={{
              flex: 1,
              backgroundColor: '#F3F4F6',
              padding: 12,
              borderRadius: 8,
              marginRight: 8,
              borderLeftWidth: 4,
              borderLeftColor: '#2563EB',
            }}
          >
            <Text style={{ fontSize: 11, color: '#6B7280', marginBottom: 4 }}>Rerata Tidur</Text>
            <Text style={{ fontSize: 18, fontWeight: 'bold', color: '#1E3A8A' }}>
              {SAMPLE_HEALTH_LOG_DATA.averages.sleepHours.toFixed(1)} Jam
            </Text>
          </View>

          <View
            style={{
              flex: 1,
              backgroundColor: '#F3F4F6',
              padding: 12,
              borderRadius: 8,
              marginRight: 8,
              borderLeftWidth: 4,
              borderLeftColor: '#7C3AED',
            }}
          >
            <Text style={{ fontSize: 11, color: '#6B7280', marginBottom: 4 }}>Frekuensi Makan</Text>
            <Text style={{ fontSize: 18, fontWeight: 'bold', color: '#7C3AED' }}>
              {SAMPLE_HEALTH_LOG_DATA.averages.mealFrequency.toFixed(1)}x / Hari
            </Text>
          </View>
        </View>

        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
          <View
            style={{
              flex: 1,
              backgroundColor: '#F3F4F6',
              padding: 12,
              borderRadius: 8,
              marginRight: 8,
              borderLeftWidth: 4,
              borderLeftColor: '#DC2626',
            }}
          >
            <Text style={{ fontSize: 11, color: '#6B7280', marginBottom: 4 }}>Tingkat Stres</Text>
            <Text style={{ fontSize: 18, fontWeight: 'bold', color: '#DC2626' }}>
              {SAMPLE_HEALTH_LOG_DATA.averages.stressLevel.toFixed(1)} / 10
            </Text>
          </View>

          <View
            style={{
              flex: 1,
              backgroundColor: '#F3F4F6',
              padding: 12,
              borderRadius: 8,
              borderLeftWidth: 4,
              borderLeftColor: '#F59E0B',
            }}
          >
            <Text style={{ fontSize: 11, color: '#6B7280', marginBottom: 4 }}>Mood Dominan</Text>
            <Text style={{ fontSize: 16, fontWeight: 'bold', color: '#F59E0B' }}>
              {SAMPLE_HEALTH_LOG_DATA.averages.dominantMood}
            </Text>
          </View>
        </View>
      </View>

      {/* Symptom Cluster */}
      <View
        style={{
          backgroundColor: '#FEF2F2',
          borderLeftWidth: 4,
          borderLeftColor: '#DC2626',
          padding: 12,
          borderRadius: 8,
          marginBottom: 25,
        }}
      >
        <Text style={{ fontSize: 12, fontWeight: 'bold', color: '#DC2626', marginBottom: 4 }}>
          Gejala Utama Terdeteksi:
        </Text>
        <Text style={{ fontSize: 13, color: '#1F2937' }}>
          <Text style={{ fontWeight: 'bold' }}>
            {SAMPLE_HEALTH_LOG_DATA.symptomClusterAnalysis.mostFrequentSymptom}
          </Text>{' '}
          (Frekuensi: {SAMPLE_HEALTH_LOG_DATA.symptomClusterAnalysis.frequencyCount}x)
        </Text>
      </View>

      {/* Download Button */}
      <TouchableOpacity
        onPress={handleDownloadReport}
        disabled={isGenerating}
        style={{
          backgroundColor: isGenerating ? '#9CA3AF' : '#1E3A8A',
          padding: 14,
          borderRadius: 8,
          alignItems: 'center',
          marginBottom: 15,
        }}
      >
        {isGenerating ? (
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <ActivityIndicator color="#FFFFFF" size="small" style={{ marginRight: 8 }} />
            <Text style={{ color: '#FFFFFF', fontSize: 14, fontWeight: 'bold' }}>
              Membuat Laporan...
            </Text>
          </View>
        ) : (
          <Text style={{ color: '#FFFFFF', fontSize: 14, fontWeight: 'bold' }}>
            📥 Unduh Laporan PDF
          </Text>
        )}
      </TouchableOpacity>

      {/* Info Box */}
      <View
        style={{
          backgroundColor: '#EFF6FF',
          borderLeftWidth: 4,
          borderLeftColor: '#3B82F6',
          padding: 12,
          borderRadius: 8,
        }}
      >
        <Text style={{ fontSize: 12, fontWeight: 'bold', color: '#1E40AF', marginBottom: 4 }}>
          ℹ️ Informasi:
        </Text>
        <Text style={{ fontSize: 12, color: '#1F2937', lineHeight: 18 }}>
          Laporan medis ini berisi analisis komprehensif dari 7 hari pemantauan kesehatan Anda.
          File PDF dapat dibagikan kepada dokter untuk evaluasi lebih lanjut.
        </Text>
      </View>
    </ScrollView>
  );
}
