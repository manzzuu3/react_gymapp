import React, { useEffect } from 'react';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { AppProvider, useApp } from '../context/AppContext';
import Constants, { ExecutionEnvironment } from 'expo-constants';
import '../global.css';

SplashScreen.preventAutoHideAsync();

const isExpoGo = Constants.executionEnvironment === ExecutionEnvironment.StoreClient;

if (!isExpoGo) {
  try {
    const Notifications = require('expo-notifications');
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: false,
        shouldShowBanner: true,
        shouldShowList: true,
      }),
    });
  } catch (err) {
    console.warn('Failed to initialize expo-notifications:', err);
  }
}

function RootLayoutContent() {
  const { dbReady } = useApp();

  useEffect(() => {
    async function requestPermissions() {
      if (isExpoGo) return;
      try {
        const Notifications = require('expo-notifications');
        const { status } = await Notifications.getPermissionsAsync();
        if (status !== 'granted') {
          await Notifications.requestPermissionsAsync();
        }
      } catch (err) {
        console.warn('Failed to request notification permissions:', err);
      }
    }
    requestPermissions();
  }, []);

  useEffect(() => {
    if (dbReady) {
      SplashScreen.hideAsync();
    }
  }, [dbReady]);

  if (!dbReady) {
    return null; // Hold splash screen until db is initialized and seeded
  }

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="active-workout" options={{ presentation: 'fullScreenModal' }} />
      <Stack.Screen name="workout-detail" options={{ presentation: 'modal' }} />
      <Stack.Screen name="exercise-detail" options={{ presentation: 'modal' }} />
      <Stack.Screen name="onboarding" options={{ presentation: 'modal' }} />
    </Stack>
  );
}

export default function RootLayout() {
  return (
    <AppProvider>
      <RootLayoutContent />
    </AppProvider>
  );
}
