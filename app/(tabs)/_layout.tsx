import { MaterialIcons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import type { ComponentProps } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AuthDesign } from '@/constants/AuthDesign';

function TabPillIcon({
  name,
  label,
  focused,
}: {
  name: ComponentProps<typeof MaterialIcons>['name'];
  label: string;
  focused: boolean;
}) {
  return (
    <View style={[styles.pill, focused && styles.pillActive]}>
      <MaterialIcons
        name={name}
        size={22}
        color={focused ? AuthDesign.onPrimary : AuthDesign.outline}
      />
      <Text
        style={[styles.pillLabel, focused && styles.pillLabelActive]}
        numberOfLines={1}
      >
        {label}
      </Text>
    </View>
  );
}

export default function TabLayout() {
  const insets = useSafeAreaInsets();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarShowLabel: false,
        tabBarStyle: {
          backgroundColor: AuthDesign.background,
          height: 64 + insets.bottom,
          paddingBottom: insets.bottom,
          borderTopWidth: 0,
          elevation: 0,
          shadowOpacity: 0,
          shadowColor: 'transparent',
        },
        tabBarItemStyle: { height: 56, paddingVertical: 4 },
        tabBarIconStyle: { width: '100%', height: '100%' },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarIcon: ({ focused }) => (
            <TabPillIcon name="home" label="Beranda" focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="history"
        options={{
          title: 'History',
          tabBarIcon: ({ focused }) => (
            <TabPillIcon name="history" label="Riwayat" focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: ({ focused }) => (
            <TabPillIcon name="person" label="Profil" focused={focused} />
          ),
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 12,
  },
  pillActive: { backgroundColor: AuthDesign.primaryLight },
  pillLabel: { fontSize: 12, fontWeight: '600', color: AuthDesign.outline },
  pillLabelActive: { color: AuthDesign.onPrimary },
});
