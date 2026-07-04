import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { WorkoutDay } from '../database/types';
import { WorkoutScheduler } from '../utils/WorkoutScheduler';
import { initDb } from '../database/db';
import { initFoodCatalog } from '../database/FoodDatabase';

interface AppContextProps {
  dbReady: boolean;
  weightUnit: 'kg' | 'lb';
  calendarMode: 'day' | 'week' | 'month';
  weekStartsMonday: boolean;
  appearanceMode: 'light' | 'dark' | 'system';
  kcalTarget: number;
  proteinTarget: number;
  activeWorkoutDay: WorkoutDay | null;
  restTimeRemaining: number;
  restTimeTotal: number;
  isTimerActive: boolean;
  timerEndDate: number | null;
  
  setPreference: (key: string, value: any) => Promise<void>;
  startWorkout: (day: WorkoutDay) => void;
  finishWorkout: (startedAt: string, finishedAt: string) => Promise<void>;
  cancelWorkout: () => void;
  startTimer: (seconds: number) => void;
  stopTimer: () => void;
  adjustTimer: (seconds: number) => void;
}

const AppContext = createContext<AppContextProps | undefined>(undefined);

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [dbReady, setDbReady] = useState(false);
  const [weightUnit, setWeightUnit] = useState<'kg' | 'lb'>('kg');
  const [calendarMode, setCalendarMode] = useState<'day' | 'week' | 'month'>('day');
  const [weekStartsMonday, setWeekStartsMonday] = useState(true);
  const [appearanceMode, setAppearanceMode] = useState<'light' | 'dark' | 'system'>('system');
  const [kcalTarget, setKcalTarget] = useState(2000);
  const [proteinTarget, setProteinTarget] = useState(130);

  // Active workout
  const [activeWorkoutDay, setActiveWorkoutDay] = useState<WorkoutDay | null>(null);

  // Rest timer
  const [restTimeRemaining, setRestTimeRemaining] = useState(0);
  const [restTimeTotal, setRestTimeTotal] = useState(90);
  const [isTimerActive, setIsTimerActive] = useState(false);
  const [timerEndDate, setTimerEndDate] = useState<number | null>(null);

  const timerIntervalRef = useRef<any>(null);

  // Initialize DB and load preferences
  useEffect(() => {
    async function initApp() {
      try {
        console.log('Initializing SQLite Databases...');
        await initDb();
        await initFoodCatalog();
        console.log('Databases initialized.');

        // Load settings
        const unit = await AsyncStorage.getItem('weightUnit');
        if (unit === 'kg' || unit === 'lb') setWeightUnit(unit);

        const calMode = await AsyncStorage.getItem('calendarMode');
        if (calMode === 'day' || calMode === 'week' || calMode === 'month') setCalendarMode(calMode);

        const startsMonday = await AsyncStorage.getItem('weekStartsMonday');
        if (startsMonday !== null) setWeekStartsMonday(startsMonday === 'true');

        const appear = await AsyncStorage.getItem('appearanceMode');
        if (appear === 'light' || appear === 'dark' || appear === 'system') setAppearanceMode(appear);

        const kcal = await AsyncStorage.getItem('dailyKcalTarget');
        if (kcal) setKcalTarget(parseInt(kcal, 10));

        const prot = await AsyncStorage.getItem('dailyProteinTarget');
        if (prot) setProteinTarget(parseInt(prot, 10));

        // Top up schedules on startup
        await WorkoutScheduler.topUpOngoing();

        setDbReady(true);
      } catch (err) {
        console.error('Error during app initialization:', err);
        setDbReady(true); // set ready anyway to show ui
      }
    }
    initApp();
  }, []);

  // Sync Timer when app resumes or countdown ticks
  useEffect(() => {
    if (isTimerActive && timerEndDate !== null) {
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);

      timerIntervalRef.current = setInterval(() => {
        const remaining = Math.max(0, Math.round((timerEndDate - Date.now()) / 1000));
        setRestTimeRemaining(remaining);

        if (remaining <= 0) {
          setIsTimerActive(false);
          setTimerEndDate(null);
          if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
        }
      }, 1000);
    } else {
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    }

    return () => {
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    };
  }, [isTimerActive, timerEndDate]);

  const setPreference = async (key: string, value: any) => {
    try {
      await AsyncStorage.setItem(key, String(value));
      if (key === 'weightUnit') setWeightUnit(value);
      if (key === 'calendarMode') setCalendarMode(value);
      if (key === 'weekStartsMonday') setWeekStartsMonday(value === 'true' || value === true);
      if (key === 'appearanceMode') setAppearanceMode(value);
      if (key === 'dailyKcalTarget') setKcalTarget(parseInt(value, 10));
      if (key === 'dailyProteinTarget') setProteinTarget(parseInt(value, 10));
    } catch (err) {
      console.error('Failed to save preference:', key, err);
    }
  };

  const startWorkout = (day: WorkoutDay) => {
    const dayWithTimes = {
      ...day,
      startedAt: day.startedAt || new Date().toISOString()
    };
    setActiveWorkoutDay(dayWithTimes);
  };

  const finishWorkout = async (startedAt: string, finishedAt: string) => {
    setActiveWorkoutDay(null);
    stopTimer();
  };

  const cancelWorkout = () => {
    setActiveWorkoutDay(null);
    stopTimer();
  };

  const startTimer = (seconds: number) => {
    const endDate = Date.now() + seconds * 1000;
    setRestTimeTotal(seconds);
    setRestTimeRemaining(seconds);
    setTimerEndDate(endDate);
    setIsTimerActive(true);
  };

  const stopTimer = () => {
    setIsTimerActive(false);
    setTimerEndDate(null);
    setRestTimeRemaining(0);
  };

  const adjustTimer = (seconds: number) => {
    if (!isTimerActive || timerEndDate === null) return;
    const newEndDate = timerEndDate + seconds * 1000;
    const remaining = Math.max(0, Math.round((newEndDate - Date.now()) / 1000));
    setRestTimeRemaining(remaining);
    setTimerEndDate(newEndDate);
  };

  return (
    <AppContext.Provider
      value={{
        dbReady,
        weightUnit,
        calendarMode,
        weekStartsMonday,
        appearanceMode,
        kcalTarget,
        proteinTarget,
        activeWorkoutDay,
        restTimeRemaining,
        restTimeTotal,
        isTimerActive,
        timerEndDate,
        setPreference,
        startWorkout,
        finishWorkout,
        cancelWorkout,
        startTimer,
        stopTimer,
        adjustTimer,
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => {
  const context = useContext(AppContext);
  if (context === undefined) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
};
