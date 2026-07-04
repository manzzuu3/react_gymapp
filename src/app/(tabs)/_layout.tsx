import React from 'react';
import { Tabs } from 'expo-router';
import { useColorScheme, Platform, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BlurView } from 'expo-blur';
import { Haptics } from '../../utils/Haptics';
import { 
  Calendar as CalendarIcon, 
  Dumbbell, 
  Apple, 
  MessageSquare, 
  User, 
  TrendingUp 
} from 'lucide-react-native';

export default function TabsLayout() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const insets = useSafeAreaInsets();

  // Theme colors
  const activeColor = isDark ? '#0A84FF' : '#007AFF';
  const inactiveColor = isDark ? 'rgba(255, 255, 255, 0.6)' : '#7A7A7A';
  const tabBgColor = isDark ? '#2C2C2E' : '#FFFFFF';
  const borderCol = isDark ? '#3A3A3C' : '#D8D4CE';

  return (
    <Tabs
      screenOptions={{
        headerShown: true,
        headerStyle: {
          backgroundColor: tabBgColor,
          borderBottomWidth: 1,
          borderBottomColor: borderCol,
        },
        headerTitleStyle: {
          fontWeight: 'bold',
          color: isDark ? '#FFFFFF' : '#1A1A1A',
        },
        tabBarActiveTintColor: activeColor,
        tabBarInactiveTintColor: inactiveColor,
        tabBarStyle: {
          position: 'absolute',
          bottom: Platform.OS === 'ios' ? insets.bottom + 8 : 12,
          left: 24,
          right: 24,
          height: 64,
          borderRadius: 24,
          borderTopWidth: 0,
          borderWidth: 1,
          borderColor: isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.06)',
          backgroundColor: Platform.OS === 'ios' ? 'transparent' : (isDark ? '#1C1C1E' : '#FFFFFF'),
          elevation: 6,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 6 },
          shadowOpacity: isDark ? 0.35 : 0.08,
          shadowRadius: 12,
          paddingTop: 8,
          paddingBottom: 8,
          overflow: 'hidden',
        },
        tabBarBackground: Platform.OS === 'ios' ? () => (
          <BlurView
            intensity={80}
            tint={isDark ? 'dark' : 'light'}
            style={StyleSheet.absoluteFill}
          />
        ) : undefined,
        tabBarLabelStyle: {
          fontSize: 10,
          fontWeight: '600',
          marginBottom: 2,
        },
        tabBarIconStyle: {
          marginTop: 2,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        listeners={{
          tabPress: () => Haptics.light(),
        }}
        options={{
          title: 'Today',
          tabBarLabel: 'Today',
          tabBarIcon: ({ color, size }) => <Apple color={color} size={size} />,
          headerTitle: 'Today\'s Hub',
        }}
      />
      <Tabs.Screen
        name="workouts"
        listeners={{
          tabPress: () => Haptics.light(),
        }}
        options={{
          title: 'Workouts',
          tabBarLabel: 'Workouts',
          tabBarIcon: ({ color, size }) => <Dumbbell color={color} size={size} />,
          headerTitle: 'Training Plans',
        }}
      />
      <Tabs.Screen
        name="calendar"
        listeners={{
          tabPress: () => Haptics.light(),
        }}
        options={{
          title: 'Calendar',
          tabBarLabel: 'Calendar',
          tabBarIcon: ({ color, size }) => <CalendarIcon color={color} size={size} />,
          headerTitle: 'Calendar',
        }}
      />
      <Tabs.Screen
        name="library"
        listeners={{
          tabPress: () => Haptics.light(),
        }}
        options={{
          title: 'Library',
          tabBarLabel: 'Library',
          tabBarIcon: ({ color, size }) => <TrendingUp color={color} size={size} />,
          headerTitle: 'Exercise Library',
        }}
      />
      <Tabs.Screen
        name="assistant"
        listeners={{
          tabPress: () => Haptics.light(),
        }}
        options={{
          title: 'Assistant',
          tabBarLabel: 'Assistant',
          tabBarIcon: ({ color, size }) => <MessageSquare color={color} size={size} />,
          headerTitle: 'AI Coach',
        }}
      />
      <Tabs.Screen
        name="profile"
        listeners={{
          tabPress: () => Haptics.light(),
        }}
        options={{
          title: 'Settings',
          tabBarLabel: 'Settings',
          tabBarIcon: ({ color, size }) => <User color={color} size={size} />,
          headerTitle: 'Settings',
        }}
      />
    </Tabs>
  );
}
