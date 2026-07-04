import React, { useState, useEffect } from 'react';
import { 
  View, Text, ScrollView, TouchableOpacity, TextInput, 
  Alert, KeyboardAvoidingView, Platform, useColorScheme 
} from 'react-native';
import { useApp } from '../../context/AppContext';
import { NutritionStore, getProductMacros } from '../../database/NutritionStore';
import { BodyweightStore } from '../../database/BodyweightStore';
import { WorkoutStore } from '../../database/WorkoutStore';
import { WorkoutScheduler } from '../../utils/WorkoutScheduler';
import { FoodEntry, WorkoutDay, BodyweightEntry } from '../../database/types';
import { DateHelpers } from '../../utils/DateHelpers';
import { router, useFocusEffect } from 'expo-router';
import { 
  Apple, Dumbbell, Activity, Plus, Trash2, Edit3, 
  ChevronRight, Calendar, Scale, ChevronLeft 
} from 'lucide-react-native';

export default function TodayScreen() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const { 
    weightUnit, kcalTarget, proteinTarget, activeWorkoutDay, 
    startWorkout 
  } = useApp();

  const [todayStr, setTodayStr] = useState(DateHelpers.toISODateString(new Date()));
  const [foodEntries, setFoodEntries] = useState<FoodEntry[]>([]);
  const [bodyweight, setBodyweight] = useState<BodyweightEntry | null>(null);
  const [workoutDay, setWorkoutDay] = useState<WorkoutDay | null>(null);

  // Modal / Inputs state
  const [weightInput, setWeightInput] = useState('');
  const [showWeightInput, setShowWeightInput] = useState(false);

  // Load today's data
  const loadData = async () => {
    try {
      const fEntries = await NutritionStore.fetchFoodEntries(todayStr);
      setFoodEntries(fEntries);

      const bw = await BodyweightStore.fetchBodyweightEntry(todayStr);
      setBodyweight(bw);
      if (bw) setWeightInput(weightUnit === 'lb' ? (bw.weightKg * 2.20462).toFixed(1) : bw.weightKg.toString());
      else setWeightInput('');

      // Get or create day
      let day = await WorkoutStore.fetchWorkoutDayWithEntries(todayStr);
      if (!day) {
        day = await WorkoutScheduler.dayFor(DateHelpers.parseISODate(todayStr)!);
      }
      setWorkoutDay(day);
    } catch (err) {
      console.error('Error loading today screen data:', err);
    }
  };

  // Reload data whenever screen is focused or date changes
  useFocusEffect(
    React.useCallback(() => {
      loadData();
    }, [todayStr, weightUnit])
  );

  useEffect(() => {
    loadData();
  }, [todayStr]);

  // Handle weight submit
  const handleWeightSubmit = async () => {
    const parsed = parseFloat(weightInput);
    if (isNaN(parsed) || parsed <= 0) {
      Alert.alert('Invalid weight', 'Please enter a valid weight number.');
      return;
    }

    const weightInKg = weightUnit === 'lb' ? parsed / 2.20462 : parsed;
    await BodyweightStore.saveBodyweight(todayStr, weightInKg);
    setShowWeightInput(false);
    loadData();
  };

  // Delete food entry
  const handleDeleteFood = async (id: string) => {
    Alert.alert('Delete Food Log', 'Are you sure you want to delete this food item?', [
      { text: 'Cancel', style: 'cancel' },
      { 
        text: 'Delete', 
        style: 'destructive',
        onPress: async () => {
          await NutritionStore.deleteEntry(id);
          loadData();
        } 
      }
    ]);
  };

  // Nutrition calculations
  const totalKcal = foodEntries.reduce((sum, f) => sum + f.kcal, 0);
  const totalProtein = foodEntries.reduce((sum, f) => sum + f.proteinG, 0);
  
  const kcalPercent = Math.min(100, Math.round((totalKcal / kcalTarget) * 100));
  const proteinPercent = Math.min(100, Math.round((totalProtein / proteinTarget) * 100));

  // Date Navigation
  const changeDate = (days: number) => {
    const cur = DateHelpers.parseISODate(todayStr)!;
    const next = DateHelpers.addDays(cur, days);
    setTodayStr(DateHelpers.toISODateString(next));
  };

  return (
    <ScrollView 
      className={`flex-1 ${isDark ? 'bg-brand-background-dark' : 'bg-brand-background-light'}`}
      contentContainerStyle={{ paddingBottom: 40 }}
    >
      {/* Date Bar */}
      <View className={`flex-row justify-between items-center px-4 py-3 border-b ${isDark ? 'bg-brand-card-dark border-brand-border-dark' : 'bg-brand-card-light border-brand-border-light'}`}>
        <TouchableOpacity onPress={() => changeDate(-1)} className="p-2">
          <ChevronLeft color={isDark ? '#FFFFFF' : '#1A1A1A'} size={24} />
        </TouchableOpacity>
        
        <View className="flex-row items-center gap-2">
          <Calendar color={isDark ? '#0A84FF' : '#007AFF'} size={20} />
          <Text className={`font-bold text-lg ${isDark ? 'text-white' : 'text-brand-primaryText-light'}`}>
            {DateHelpers.isToday(DateHelpers.parseISODate(todayStr)!) 
              ? 'Today' 
              : DateHelpers.medium(DateHelpers.parseISODate(todayStr)!)}
          </Text>
        </View>

        <TouchableOpacity onPress={() => changeDate(1)} className="p-2">
          <ChevronRight color={isDark ? '#FFFFFF' : '#1A1A1A'} size={24} />
        </TouchableOpacity>
      </View>

      {/* active workout status bar */}
      {activeWorkoutDay && (
        <TouchableOpacity 
          onPress={() => router.push('/active-workout')}
          className="mx-4 mt-4 bg-brand-accent-light p-4 rounded-2xl flex-row justify-between items-center shadow-lg"
        >
          <View className="flex-row items-center gap-3">
            <Dumbbell color="#FFFFFF" size={24} />
            <View>
              <Text className="text-white font-bold">Workout Session Active</Text>
              <Text className="text-white/80 text-xs">Tap to resume logging sets</Text>
            </View>
          </View>
          <ChevronRight color="#FFFFFF" size={20} />
        </TouchableOpacity>
      )}

      {/* Workout Module */}
      <View className={`mx-4 mt-4 p-5 rounded-3xl border ${isDark ? 'bg-brand-card-dark border-brand-border-dark' : 'bg-brand-card-light border-brand-border-light'}`}>
        <View className="flex-row justify-between items-center mb-4">
          <View className="flex-row items-center gap-2">
            <Dumbbell color={isDark ? '#FF9F0A' : '#C96A40'} size={22} />
            <Text className={`text-xl font-bold ${isDark ? 'text-white' : 'text-brand-primaryText-light'}`}>Workout Log</Text>
          </View>
          {workoutDay && workoutDay.entries && workoutDay.entries.length > 0 && (
            <Text className="text-brand-secondaryText-light text-xs font-semibold">
              {(workoutDay.entries?.flatMap(e => e.sets || []).filter(s => s.isDone).length || 0)} / {(workoutDay.entries?.flatMap(e => e.sets || []).length || 0)} sets
            </Text>
          )}
        </View>

        {workoutDay ? (
          workoutDay.isSkipped ? (
            <View className="py-4 items-center">
              <Text className={`font-semibold text-center ${isDark ? 'text-white/40' : 'text-brand-secondaryText-light'}`}>
                Session Skipped ({workoutDay.title})
              </Text>
              <TouchableOpacity 
                onPress={async () => {
                  await WorkoutScheduler.unskip(workoutDay);
                  loadData();
                }}
                className="mt-3 bg-brand-accent-light/10 px-4 py-2 rounded-xl"
              >
                <Text className="text-brand-accent-light font-bold text-sm">Undo Skip</Text>
              </TouchableOpacity>
            </View>
          ) : workoutDay.entries && workoutDay.entries.length > 0 ? (
            <View>
              <Text className={`text-lg font-bold ${isDark ? 'text-white' : 'text-brand-primaryText-light'}`}>
                {workoutDay.title || 'Logged Workout'}
              </Text>
              <Text className={`text-sm mb-4 ${isDark ? 'text-white/60' : 'text-brand-secondaryText-light'}`}>
                {workoutDay.entries.length} Exercises • ~{Math.max(0, Math.round(workoutDay.entries.flatMap(e => e.sets || []).length * 2.5))} min duration
              </Text>

              {workoutDay.entries.slice(0, 3).map((ent, idx) => (
                <View key={ent.id} className="flex-row justify-between items-center py-2 border-b border-brand-hairline-light/20">
                  <Text className={`font-medium flex-1 mr-2 ${isDark ? 'text-white' : 'text-brand-primaryText-light'}`} numberOfLines={1}>
                    {ent.exerciseName}
                  </Text>
                  <Text className={`text-xs ${isDark ? 'text-white/60' : 'text-brand-secondaryText-light'}`}>
                    {ent.sets?.filter(s => s.isDone).length} / {ent.sets?.length} sets
                  </Text>
                </View>
              ))}

              {workoutDay.entries.length > 3 && (
                <Text className={`text-xs mt-2 text-center ${isDark ? 'text-white/60' : 'text-brand-secondaryText-light'}`}>
                  + {workoutDay.entries.length - 3} more exercises
                </Text>
              )}

              {/* Start/Resume button */}
              <TouchableOpacity
                onPress={() => {
                  startWorkout(workoutDay);
                  router.push('/active-workout');
                }}
                className="mt-4 bg-brand-accent-light py-3 rounded-2xl flex-row justify-center items-center gap-2 shadow"
              >
                <Dumbbell color="#FFFFFF" size={18} />
                <Text className="text-white font-bold">
                  {workoutDay.entries.flatMap(e => e.sets || []).some(s => s.isDone) ? 'Resume Session' : 'Start Workout'}
                </Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View className="py-4 items-center">
              <Text className={`text-center mb-4 ${isDark ? 'text-white/60' : 'text-brand-secondaryText-light'}`}>
                No workouts logged or scheduled for today.
              </Text>
              <TouchableOpacity 
                onPress={() => router.push('/workouts')}
                className="bg-brand-accent-light/10 border border-brand-accent-light/30 px-6 py-2.5 rounded-2xl"
              >
                <Text className="text-brand-accent-light font-bold text-sm">Schedule a Template</Text>
              </TouchableOpacity>
            </View>
          )
        ) : null}
      </View>

      {/* Nutrition Module */}
      <View className={`mx-4 mt-4 p-5 rounded-3xl border ${isDark ? 'bg-brand-card-dark border-brand-border-dark' : 'bg-brand-card-light border-brand-border-light'}`}>
        <View className="flex-row justify-between items-center mb-5">
          <View className="flex-row items-center gap-2">
            <Apple color={isDark ? '#30D158' : '#5B8A6A'} size={22} />
            <Text className={`text-xl font-bold ${isDark ? 'text-white' : 'text-brand-primaryText-light'}`}>Nutrition Progress</Text>
          </View>
          <TouchableOpacity 
            onPress={() => router.push({ pathname: '/(tabs)/profile', params: { autoOpenNutritionPicker: 'true' } })}
            className="p-1"
          >
            <Plus color={isDark ? '#0A84FF' : '#007AFF'} size={24} />
          </TouchableOpacity>
        </View>

        {/* Macro bars */}
        <View className="gap-4 mb-5">
          {/* Calories bar */}
          <View>
            <View className="flex-row justify-between items-center mb-1.5">
              <Text className={`font-semibold ${isDark ? 'text-white/80' : 'text-brand-primaryText-light'}`}>Calories</Text>
              <Text className={`font-bold ${isDark ? 'text-white' : 'text-brand-primaryText-light'}`}>
                {Math.round(totalKcal)} / {kcalTarget} kcal ({kcalPercent}%)
              </Text>
            </View>
            <View className={`w-full h-3 rounded-full overflow-hidden ${isDark ? 'bg-brand-inputBg-dark' : 'bg-brand-inputBg-light'}`}>
              <View 
                className="h-full bg-brand-accent-light rounded-full" 
                style={{ width: `${kcalPercent}%` }} 
              />
            </View>
          </View>

          {/* Protein bar */}
          <View>
            <View className="flex-row justify-between items-center mb-1.5">
              <Text className={`font-semibold ${isDark ? 'text-white/80' : 'text-brand-primaryText-light'}`}>Protein</Text>
              <Text className={`font-bold ${isDark ? 'text-white' : 'text-brand-primaryText-light'}`}>
                {totalProtein.toFixed(1)} / {proteinTarget}g ({proteinPercent}%)
              </Text>
            </View>
            <View className={`w-full h-3 rounded-full overflow-hidden ${isDark ? 'bg-brand-inputBg-dark' : 'bg-brand-inputBg-light'}`}>
              <View 
                className="h-full bg-brand-green-light rounded-full" 
                style={{ width: `${proteinPercent}%` }} 
              />
            </View>
          </View>
        </View>

        {/* Eaten foods list */}
        <View className="border-t border-brand-hairline-light/20 pt-4">
          <Text className={`font-bold mb-3 ${isDark ? 'text-white' : 'text-brand-primaryText-light'}`}>Logged Foods</Text>
          {foodEntries.length > 0 ? (
            foodEntries.map(f => (
              <View key={f.id} className="flex-row justify-between items-center py-2.5 border-b border-brand-hairline-light/10">
                <View className="flex-1 mr-4">
                  <Text className={`font-medium ${isDark ? 'text-white' : 'text-brand-primaryText-light'}`}>{f.productName}</Text>
                  <Text className={`text-xs ${isDark ? 'text-white/60' : 'text-brand-secondaryText-light'}`}>
                    {Math.round(f.grams)}g • {Math.round(f.kcal)} kcal • {f.proteinG.toFixed(1)}g protein
                  </Text>
                </View>
                <TouchableOpacity onPress={() => handleDeleteFood(f.id)} className="p-1">
                  <Trash2 color={isDark ? '#FF453A' : '#FF3B30'} size={18} />
                </TouchableOpacity>
              </View>
            ))
          ) : (
            <Text className={`text-sm italic text-center py-3 ${isDark ? 'text-white/40' : 'text-brand-secondaryText-light/60'}`}>
              No food logged yet.
            </Text>
          )}
        </View>
      </View>

      {/* Bodyweight Module */}
      <View className={`mx-4 mt-4 p-5 rounded-3xl border ${isDark ? 'bg-brand-card-dark border-brand-border-dark' : 'bg-brand-card-light border-brand-border-light'}`}>
        <View className="flex-row justify-between items-center mb-4">
          <View className="flex-row items-center gap-2">
            <Scale color={isDark ? '#40C8E0' : '#4A8A96'} size={22} />
            <Text className={`text-xl font-bold ${isDark ? 'text-white' : 'text-brand-primaryText-light'}`}>Bodyweight</Text>
          </View>
          <TouchableOpacity 
            onPress={() => setShowWeightInput(!showWeightInput)}
            className="bg-brand-accent-light/10 px-4 py-1.5 rounded-xl"
          >
            <Text className="text-brand-accent-light font-bold text-sm">
              {bodyweight ? 'Edit Weight' : 'Log Weight'}
            </Text>
          </TouchableOpacity>
        </View>

        {bodyweight ? (
          <View className="py-2 flex-row justify-between items-center">
            <View>
              <Text className={`text-3xl font-extrabold ${isDark ? 'text-white' : 'text-brand-primaryText-light'}`}>
                {weightUnit === 'lb' 
                  ? `${(bodyweight.weightKg * 2.20462).toFixed(1)} lb` 
                  : `${bodyweight.weightKg.toFixed(1)} kg`}
              </Text>
              <Text className={`text-xs ${isDark ? 'text-white/60' : 'text-brand-secondaryText-light'}`}>
                Recorded on {bodyweight.date}
              </Text>
            </View>
          </View>
        ) : (
          <Text className={`text-sm italic py-2 ${isDark ? 'text-white/40' : 'text-brand-secondaryText-light/60'}`}>
            No weight recorded for today.
          </Text>
        )}

        {/* Inline form */}
        {showWeightInput && (
          <View className="mt-4 pt-4 border-t border-brand-hairline-light/20 flex-row gap-3 items-center">
            <TextInput
              className={`flex-1 p-3 rounded-xl border text-base ${isDark ? 'bg-brand-inputBg-dark text-white border-brand-border-dark' : 'bg-brand-inputBg-light text-brand-primaryText-light border-brand-border-light'}`}
              placeholder={`Weight in ${weightUnit}`}
              placeholderTextColor={isDark ? '#7A7A7A' : '#9E9E9E'}
              keyboardType="decimal-pad"
              value={weightInput}
              onChangeText={setWeightInput}
              autoFocus
            />
            <TouchableOpacity 
              onPress={handleWeightSubmit}
              className="bg-brand-accent-light px-5 py-3.5 rounded-xl shadow-sm"
            >
              <Text className="text-white font-bold">Save</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    </ScrollView>
  );
}
