import { MaterialIcons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import { useClientOnlyValue } from '@/components/useClientOnlyValue';
import { AuthDesign } from '@/constants/AuthDesign';

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: AuthDesign.primary,
        tabBarInactiveTintColor: AuthDesign.outline,
        headerShown: useClientOnlyValue(false, true),
        headerTintColor: AuthDesign.onSurface,
        headerStyle: { backgroundColor: AuthDesign.background },
        tabBarStyle: { backgroundColor: AuthDesign.background },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarIcon: ({ color }) => <MaterialIcons name="home" size={26} color={color} />,
        }}
      />
      <Tabs.Screen
        name="history"
        options={{
          title: 'History',
          tabBarIcon: ({ color }) => <MaterialIcons name="history" size={26} color={color} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: ({ color }) => <MaterialIcons name="person" size={26} color={color} />,
        }}
      />
    </Tabs>
  );
}