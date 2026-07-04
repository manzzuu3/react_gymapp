import React from 'react';
import { Tabs } from 'expo-router';
import { useColorScheme } from 'react-native';
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
          backgroundColor: tabBgColor,
          borderTopWidth: 1,
          borderTopColor: borderCol,
          paddingTop: 5,
          height: 60,
          paddingBottom: 8,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Today',
          tabBarLabel: 'Today',
          tabBarIcon: ({ color, size }) => <Apple color={color} size={size} />,
          headerTitle: 'Today\'s Hub',
        }}
      />
      <Tabs.Screen
        name="workouts"
        options={{
          title: 'Workouts',
          tabBarLabel: 'Workouts',
          tabBarIcon: ({ color, size }) => <Dumbbell color={color} size={size} />,
          headerTitle: 'Training Plans',
        }}
      />
      <Tabs.Screen
        name="calendar"
        options={{
          title: 'Calendar',
          tabBarLabel: 'Calendar',
          tabBarIcon: ({ color, size }) => <CalendarIcon color={color} size={size} />,
          headerTitle: 'Calendar',
        }}
      />
      <Tabs.Screen
        name="library"
        options={{
          title: 'Library',
          tabBarLabel: 'Library',
          tabBarIcon: ({ color, size }) => <TrendingUp color={color} size={size} />,
          headerTitle: 'Exercise Library',
        }}
      />
      <Tabs.Screen
        name="assistant"
        options={{
          title: 'Assistant',
          tabBarLabel: 'Assistant',
          tabBarIcon: ({ color, size }) => <MessageSquare color={color} size={size} />,
          headerTitle: 'AI Coach',
        }}
      />
      <Tabs.Screen
        name="profile"
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
