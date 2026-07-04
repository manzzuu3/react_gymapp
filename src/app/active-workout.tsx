import React, { useState, useEffect } from 'react';
import { 
  View, Text, ScrollView, TouchableOpacity, TextInput, 
  Alert, useColorScheme, KeyboardAvoidingView, Platform 
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useApp } from '../context/AppContext';
import { WorkoutStore } from '../database/WorkoutStore';
import { WorkoutDay } from '../database/types';
import { router } from 'expo-router';
import { Haptics } from '../utils/Haptics';
import { 
  X, Check, Trash2, ArrowLeft, ArrowRight, Clock, PlusCircle 
} from 'lucide-react-native';

export default function ActiveWorkoutScreen() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  
  const { 
    weightUnit, activeWorkoutDay, startTimer, adjustTimer, 
    restTimeRemaining, isTimerActive, cancelWorkout, finishWorkout 
  } = useApp();

  const [dayData, setDayData] = useState<WorkoutDay | null>(null);
  const [elapsedTime, setElapsedTime] = useState('00:00:00');
  const [activeExerciseIndex, setActiveExerciseIndex] = useState(0);

  // Sync with store
  const loadActiveDayData = async () => {
    if (!activeWorkoutDay) {
      router.replace('/(tabs)');
      return;
    }
    const full = await WorkoutStore.fetchWorkoutDayWithEntries(activeWorkoutDay.date);
    if (full) {
      setDayData(full);
    }
  };

  useEffect(() => {
    loadActiveDayData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeWorkoutDay]);

  // Elapsed Timer ticker
  useEffect(() => {
    if (!activeWorkoutDay) return;
    const startMs = new Date(activeWorkoutDay.startedAt || new Date().toISOString()).getTime();
    
    const interval = setInterval(() => {
      const diffSecs = Math.floor((Date.now() - startMs) / 1000);
      const hours = String(Math.floor(diffSecs / 3600)).padStart(2, '0');
      const mins = String(Math.floor((diffSecs % 3600) / 60)).padStart(2, '0');
      const secs = String(diffSecs % 60).padStart(2, '0');
      setElapsedTime(`${hours}:${mins}:${secs}`);
    }, 1000);

    return () => clearInterval(interval);
  }, [activeWorkoutDay]);

  if (!dayData) return null;

  // Handle cell edit
  const handleSetEdit = async (
    entryIndex: number, 
    setIndex: number, 
    field: 'weightKg' | 'reps' | 'isDone' | 'rpe' | 'isWarmup', 
    val: any
  ) => {
    if (!dayData.entries) return;
    
    const entries = [...dayData.entries];
    const set = { ...entries[entryIndex].sets![setIndex] };

    if (field === 'isDone') {
      const isDone = val as boolean;
      set.isDone = isDone;
      Haptics.light();
      // Auto-fill from target values if not logged yet
      if (isDone) {
        if (set.weightKg === undefined || set.weightKg === null) {
          set.weightKg = entries[entryIndex].targetWeightKg;
        }
        if (set.reps === undefined || set.reps === null) {
          set.reps = entries[entryIndex].targetReps;
        }
        
        // Trigger Rest Timer
        const restLengthStr = await AsyncStorage.getItem('defaultRestSeconds');
        const restLength = parseInt(restLengthStr || '90', 10);
        startTimer(restLength);
      }
    } else if (field === 'weightKg') {
      const parsed = parseFloat(val);
      set.weightKg = isNaN(parsed) ? undefined : (weightUnit === 'lb' ? parsed / 2.20462 : parsed);
    } else if (field === 'reps') {
      const parsed = parseInt(val, 10);
      set.reps = isNaN(parsed) ? undefined : parsed;
    } else if (field === 'rpe') {
      const parsed = parseFloat(val);
      set.rpe = isNaN(parsed) ? undefined : parsed;
    } else if (field === 'isWarmup') {
      set.isWarmup = val as boolean;
    }

    entries[entryIndex].sets![setIndex] = set;
    
    // Save to database atomically
    await WorkoutStore.updateSetEntry(set);
    
    setDayData({
      ...dayData,
      entries
    });
  };

  // Add set to active exercise
  const handleAddSet = async (entryIndex: number) => {
    if (!dayData.entries) return;
    const entry = dayData.entries[entryIndex];
    const nextSetNum = (entry.sets?.length || 0) + 1;

    const newSet = await WorkoutStore.addSetToEntry(entry.id, nextSetNum);
    
    const entries = [...dayData.entries];
    entries[entryIndex].sets = [...(entry.sets || []), newSet];
    setDayData({ ...dayData, entries });
  };

  // Delete set
  const handleDeleteSet = async (entryIndex: number, setIndex: number) => {
    if (!dayData.entries) return;
    const entries = [...dayData.entries];
    const sets = [...(entries[entryIndex].sets || [])];
    const deletedSet = sets[setIndex];

    await WorkoutStore.deleteSetEntry(deletedSet.id);
    sets.splice(setIndex, 1);
    
    // Re-index set numbers
    for (let i = 0; i < sets.length; i++) {
      sets[i].setNumber = i + 1;
      await WorkoutStore.updateSetEntry(sets[i]);
    }

    entries[entryIndex].sets = sets;
    setDayData({ ...dayData, entries });
  };

  // Discard workout
  const handleDiscard = () => {
    Haptics.warning();
    Alert.alert(
      'Discard Session?',
      'Are you sure you want to discard this workout? Active progress will not be saved.',
      [
        { text: 'Resume', style: 'cancel', onPress: () => Haptics.light() },
        { 
          text: 'Discard', 
          style: 'destructive',
          onPress: () => {
            Haptics.error();
            cancelWorkout();
            router.replace('/(tabs)');
          }
        }
      ]
    );
  };

  // Finish Workout
  const handleFinish = async () => {
    // Audit completed sets
    const totalSets = dayData.entries?.flatMap(e => e.sets || []) || [];
    const doneSets = totalSets.filter(s => s.isDone).length;

    if (doneSets === 0) {
      Haptics.error();
      Alert.alert('No completed sets', 'Log at least one set as completed before finishing.');
      return;
    }

    // Save final timestamps and status
    const finishedAt = new Date().toISOString();
    const finalDay = {
      ...dayData,
      finishedAt
    };
    await WorkoutStore.updateWorkoutDay(finalDay);
    
    await finishWorkout(activeWorkoutDay!.startedAt!, finishedAt);
    Haptics.success();
    Alert.alert('Workout Finished!', `Congratulations! Logged ${doneSets} working sets.`);
    router.replace('/(tabs)');
  };

  const activeEntry = dayData.entries?.[activeExerciseIndex];

  return (
    <KeyboardAvoidingView 
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      className={`flex-1 ${isDark ? 'bg-brand-background-dark' : 'bg-brand-background-light'}`}
    >
      {/* HEADER SECTION */}
      <View className={`px-4 pt-12 pb-4 border-b flex-row justify-between items-center ${isDark ? 'bg-brand-card-dark border-brand-border-dark' : 'bg-white border-brand-border-light'}`}>
        <TouchableOpacity onPress={handleDiscard} className="p-1.5 bg-brand-red-light/10 rounded-full">
          <X color={isDark ? '#FF453A' : '#FF3B30'} size={20} />
        </TouchableOpacity>

        <View className="items-center">
          <Text className={`text-base font-extrabold ${isDark ? 'text-white' : 'text-brand-primaryText-light'}`}>
            {dayData.title || 'Workout'}
          </Text>
          <View className="flex-row items-center gap-1 mt-0.5">
            <Clock color={isDark ? 'rgba(255,255,255,0.4)' : '#7A7A7A'} size={12} />
            <Text className={`text-[10px] font-semibold ${isDark ? 'text-white/40' : 'text-brand-secondaryText-light'}`}>
              ELAPSED: {elapsedTime}
            </Text>
          </View>
        </View>

        <TouchableOpacity 
          onPress={handleFinish}
          className="bg-brand-green-light px-4 py-2 rounded-xl shadow-sm"
        >
          <Text className="text-white font-bold text-xs">Finish</Text>
        </TouchableOpacity>
      </View>

      {/* FLOATING REST TIMER DRAWER */}
      {isTimerActive && (
        <View className="mx-4 mt-3 p-3.5 rounded-2xl bg-brand-accent-light flex-row justify-between items-center shadow-lg">
          <View className="flex-row items-center gap-2">
            <Clock color="#FFFFFF" size={18} />
            <Text className="text-white font-bold text-sm">
              Rest Timer: {restTimeRemaining}s
            </Text>
          </View>
          <View className="flex-row gap-2">
            <TouchableOpacity 
              onPress={() => { Haptics.light(); adjustTimer(15); }}
              className="bg-white/20 px-3 py-1.5 rounded-lg"
            >
              <Text className="text-white font-bold text-[10px]">+15s</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              onPress={() => { Haptics.light(); adjustTimer(-15); }}
              className="bg-white/20 px-3 py-1.5 rounded-lg"
            >
              <Text className="text-white font-bold text-[10px]">-15s</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* EXERCISE PAGED CARDS VIEW */}
      {dayData.entries && dayData.entries.length > 0 ? (
        <View className="flex-1 px-4 py-4 justify-between">
          <View className={`flex-1 p-5 rounded-3xl border ${isDark ? 'bg-brand-card-dark border-brand-border-dark' : 'bg-white border-brand-border-light'}`}>
            {activeEntry && (
              <ScrollView className="flex-1">
                <Text className={`text-xl font-extrabold ${isDark ? 'text-white' : 'text-brand-primaryText-light'}`}>
                  {activeEntry.exerciseName}
                </Text>
                <Text className={`text-xs uppercase font-semibold mt-1 mb-4 ${isDark ? 'text-white/40' : 'text-brand-secondaryText-light'}`}>
                  Exercise {activeExerciseIndex + 1} of {dayData.entries.length} • {activeEntry.muscleGroupRaw}
                </Text>

                {activeEntry.note && (
                  <View className={`p-3 rounded-xl border mb-4 ${isDark ? 'bg-brand-noteBg-dark border-brand-noteBorder-dark' : 'bg-brand-noteBg-light border-brand-noteBorder-light'}`}>
                    <Text className="text-brand-tan-light text-xs italic">
                      Note: {activeEntry.note}
                    </Text>
                  </View>
                )}

                {/* Sets log table */}
                <View className="mb-4">
                  {/* Table headers */}
                  <View className="flex-row py-1 border-b border-brand-hairline-light/20 mb-2">
                    <Text className={`w-8 text-[10px] font-bold ${isDark ? 'text-white/40' : 'text-brand-secondaryText-light'}`}>SET</Text>
                    <Text className={`flex-1 text-[10px] font-bold text-center ${isDark ? 'text-white/40' : 'text-brand-secondaryText-light'}`}>TARGET</Text>
                    <Text className={`w-20 text-[10px] font-bold text-center ${isDark ? 'text-white/40' : 'text-brand-secondaryText-light'}`}>{weightUnit.toUpperCase()}</Text>
                    <Text className={`w-14 text-[10px] font-bold text-center ${isDark ? 'text-white/40' : 'text-brand-secondaryText-light'}`}>REPS</Text>
                    <Text className={`w-10 text-[10px] font-bold text-right ${isDark ? 'text-white/40' : 'text-brand-secondaryText-light'}`}>DONE</Text>
                  </View>

                  {/* Set rows */}
                  {activeEntry.sets?.map((set, setIdx) => {
                    const weightVal = set.weightKg !== undefined && set.weightKg !== null
                      ? (weightUnit === 'lb' ? (set.weightKg * 2.20462).toFixed(1) : set.weightKg.toString())
                      : '';
                    const repsVal = set.reps !== undefined && set.reps !== null ? set.reps.toString() : '';

                    return (
                      <View key={set.id} className="flex-row items-center py-2 border-b border-brand-hairline-light/10">
                        
                        {/* Set Index / Warmup indicator */}
                        <TouchableOpacity 
                          onPress={() => handleSetEdit(activeExerciseIndex, setIdx, 'isWarmup', !set.isWarmup)}
                          className="w-8"
                        >
                          <Text className={`text-xs font-bold ${set.isWarmup ? 'text-brand-orange-light' : (isDark ? 'text-white' : 'text-brand-primaryText-light')}`}>
                            {set.isWarmup ? 'W' : set.setNumber}
                          </Text>
                        </TouchableOpacity>

                        {/* Target values details */}
                        <Text className={`flex-1 text-xs text-center ${isDark ? 'text-white/40' : 'text-brand-secondaryText-light'}`}>
                          {weightUnit === 'lb' ? Math.round(activeEntry.targetWeightKg * 2.20462) : Math.round(activeEntry.targetWeightKg)}x{activeEntry.targetReps}
                        </Text>

                        {/* Logged Weight */}
                        <TextInput
                          className={`w-20 text-center p-1 rounded border text-xs ${isDark ? 'bg-brand-inputBg-dark text-white border-brand-border-dark' : 'bg-brand-inputBg-light text-brand-primaryText-light border-brand-border-light'}`}
                          keyboardType="decimal-pad"
                          placeholder="—"
                          placeholderTextColor={isDark ? '#7A7A7A' : '#9E9E9E'}
                          value={weightVal}
                          onChangeText={(val) => handleSetEdit(activeExerciseIndex, setIdx, 'weightKg', val)}
                        />

                        {/* Logged Reps */}
                        <TextInput
                          className={`w-14 text-center p-1 rounded border text-xs ml-2 ${isDark ? 'bg-brand-inputBg-dark text-white border-brand-border-dark' : 'bg-brand-inputBg-light text-brand-primaryText-light border-brand-border-light'}`}
                          keyboardType="number-pad"
                          placeholder="—"
                          placeholderTextColor={isDark ? '#7A7A7A' : '#9E9E9E'}
                          value={repsVal}
                          onChangeText={(val) => handleSetEdit(activeExerciseIndex, setIdx, 'reps', val)}
                        />

                        {/* Done Checkbox */}
                        <TouchableOpacity
                          onPress={() => handleSetEdit(activeExerciseIndex, setIdx, 'isDone', !set.isDone)}
                          className={`w-7 h-7 rounded-lg items-center justify-center ml-3 border ${set.isDone ? 'bg-brand-green-light border-brand-green-light' : (isDark ? 'border-brand-border-dark bg-brand-inputBg-dark' : 'border-brand-border-light bg-brand-inputBg-light')}`}
                        >
                          {set.isDone && <Check color="#FFFFFF" size={14} strokeWidth={3} />}
                        </TouchableOpacity>

                        {/* Delete Set option */}
                        {activeEntry.sets!.length > 1 && (
                          <TouchableOpacity 
                            onPress={() => handleDeleteSet(activeExerciseIndex, setIdx)}
                            className="p-1 ml-1"
                          >
                            <Trash2 color={isDark ? '#FF453A' : '#FF3B30'} size={12} />
                          </TouchableOpacity>
                        )}
                      </View>
                    );
                  })}
                </View>

                {/* Add set button */}
                <TouchableOpacity 
                  onPress={() => handleAddSet(activeExerciseIndex)}
                  className="flex-row items-center gap-1.5 py-2"
                >
                  <PlusCircle color={isDark ? '#0A84FF' : '#007AFF'} size={16} />
                  <Text className="text-brand-accent-light font-bold text-xs">Add Set Line</Text>
                </TouchableOpacity>

              </ScrollView>
            )}
          </View>

          {/* Navigation Controls */}
          <View className="flex-row justify-between items-center mt-4">
            <TouchableOpacity
              onPress={() => setActiveExerciseIndex(prev => Math.max(0, prev - 1))}
              disabled={activeExerciseIndex === 0}
              className={`p-3.5 rounded-full ${activeExerciseIndex === 0 ? 'opacity-30' : (isDark ? 'bg-brand-card-dark' : 'bg-white shadow-sm')}`}
            >
              <ArrowLeft color={isDark ? '#FFFFFF' : '#1A1A1A'} size={20} />
            </TouchableOpacity>

            <Text className={`text-xs font-semibold ${isDark ? 'text-white/40' : 'text-brand-secondaryText-light'}`}>
              Swipe or use arrows to navigate exercises
            </Text>

            <TouchableOpacity
              onPress={() => setActiveExerciseIndex(prev => Math.min(dayData.entries!.length - 1, prev + 1))}
              disabled={activeExerciseIndex === dayData.entries.length - 1}
              className={`p-3.5 rounded-full ${activeExerciseIndex === dayData.entries.length - 1 ? 'opacity-30' : (isDark ? 'bg-brand-card-dark' : 'bg-white shadow-sm')}`}
            >
              <ArrowRight color={isDark ? '#FFFFFF' : '#1A1A1A'} size={20} />
            </TouchableOpacity>
          </View>
        </View>
      ) : (
        <View className="flex-1 items-center justify-center">
          <Text className={isDark ? 'text-white' : 'text-brand-primaryText-light'}>
            No exercises added to this workout.
          </Text>
        </View>
      )}
    </KeyboardAvoidingView>
  );
}
