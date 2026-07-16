import { StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';

import { Text, View } from '@/components/Themed';
import { AuthDesign, AuthSpacing } from '@/constants/AuthDesign';

export default function ProfileScreen() {
  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container} lightColor={AuthDesign.background}>
        <View style={styles.iconBadge} lightColor={AuthDesign.primary}>
          <MaterialIcons name="person" size={28} color="#fff" />
        </View>
        <Text style={styles.title}>Profile</Text>
        <Text style={[styles.subtitle, { color: AuthDesign.onSurfaceVariant }]}>
          Info akun, pengaturan, dan logout akan tampil di sini.
        </Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  container: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
    padding: AuthSpacing.screenPadding, gap: 8,
  },
  iconBadge: {
    width: 56, height: 56, borderRadius: 16, alignItems: 'center',
    justifyContent: 'center', marginBottom: 8,
  },
  title: { fontSize: 22, fontWeight: '700' },
  subtitle: { fontSize: 13, textAlign: 'center', paddingHorizontal: 24 },
});