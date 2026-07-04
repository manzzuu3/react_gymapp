import React, { useState, useEffect } from 'react';
import { 
  View, Text, ScrollView, TouchableOpacity, TextInput, 
  Alert, useColorScheme, Switch, Modal, FlatList, KeyboardAvoidingView, Platform 
} from 'react-native';
import { WorkoutStore } from '../database/WorkoutStore';
import { WorkoutScheduler } from '../utils/WorkoutScheduler';
import { Workout, Exercise, TrainingPlan, WorkoutDay } from '../database/types';
import { router, useLocalSearchParams } from 'expo-router';
import { 
  X, Plus, Trash2, Calendar, Save
} from 'lucide-react-native';
import { useApp } from '../context/AppContext';
import { DateHelpers } from '../utils/DateHelpers';

export default function WorkoutDetailScreen() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const { weightUnit } = useApp();

  const params = useLocalSearchParams();
  const workoutId = params.workoutId as string | undefined;
  const dateStr = params.date as string | undefined; // If passed, editing a specific day's plan

  const [workout, setWorkout] = useState<Workout | null>(null);
  const [plan, setPlan] = useState<TrainingPlan | null>(null);
  const [day, setDay] = useState<WorkoutDay | null>(null);

  // Form Fields
  const [name, setName] = useState('');
  const [notes, setNotes] = useState('');
  const [exercises, setExercises] = useState<any[]>([]);

  // Schedule Fields
  const [isScheduled, setIsScheduled] = useState(false);
  const [weekdaysMask, setWeekdaysMask] = useState(0); // bitmask: Mon=1, Tue=2, Wed=4...
  const [durationRaw, setDurationRaw] = useState<'weeks' | 'untilDate' | 'ongoing'>('ongoing');
  const [weeksLength, setWeeksLength] = useState('6');
  const [endDateStr, setEndDateStr] = useState('');

  // Exercise Picker Modal
  const [showPicker, setShowPicker] = useState(false);
  const [allCatalog, setAllCatalog] = useState<Exercise[]>([]);

  const loadData = async () => {
    try {
      const catalog = await WorkoutStore.fetchExercises();
      setAllCatalog(catalog);

      if (dateStr) {
        // Edit specific calendar day plan
        let dayObj = await WorkoutStore.fetchWorkoutDayWithEntries(dateStr);
        if (!dayObj) {
          dayObj = await WorkoutScheduler.dayFor(DateHelpers.parseISODate(dateStr)!);
        }
        if (dayObj) {
          setDay(dayObj);
          setName(dayObj.title || 'Custom Workout Day');
          setNotes(dayObj.notes || '');
          setExercises(dayObj.entries || []);
        }
      } else if (workoutId) {
        // Edit existing workout template
        const w = await WorkoutStore.fetchWorkoutDetail(workoutId);
        if (w) {
          setWorkout(w);
          setName(w.name);
          setNotes(w.notes);
          setExercises(w.exercises || []);

          if (w.planId) {
            const p = await WorkoutStore.fetchTrainingPlan(w.planId);
            if (p) {
              setPlan(p);
              setIsScheduled(p.scheduleWeekdaysMask > 0);
              setWeekdaysMask(p.scheduleWeekdaysMask);
              setDurationRaw(p.scheduleDurationRaw);
              setWeeksLength(String(p.scheduleWeeks));
              setEndDateStr(p.scheduleEnd || '');
            }
          }
        }
      } else {
        // New template workout
        setName('New Workout');
      }
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workoutId, dateStr]);

  // Target input updates
  const handleExerciseTargetChange = (idx: number, field: string, val: string) => {
    const updated = [...exercises];
    if (field === 'sets') updated[idx].targetSets = parseInt(val, 10) || 0;
    if (field === 'reps') updated[idx].targetReps = parseInt(val, 10) || 0;
    if (field === 'weight') {
      const parsed = parseFloat(val);
      updated[idx].targetWeightKg = isNaN(parsed) ? 0 : (weightUnit === 'lb' ? parsed / 2.20462 : parsed);
    }
    if (field === 'note') updated[idx].note = val;
    setExercises(updated);
  };

  // Add exercise from picker
  const handleAddExerciseFromPicker = (ex: Exercise) => {
    const newEx = {
      exerciseId: ex.id,
      exerciseName: ex.name,
      muscleGroupRaw: ex.muscleGroupRaw,
      secondaryMuscleGroupsRaw: ex.secondaryMusclesText,
      targetSets: 3,
      targetReps: 10,
      targetWeightKg: 0,
      orderIndex: exercises.length
    };
    setExercises([...exercises, newEx]);
    setShowPicker(false);
  };

  // Delete exercise from plan
  const handleDeleteExercise = (idx: number) => {
    const updated = [...exercises];
    updated.splice(idx, 1);
    // Re-index
    for (let i = 0; i < updated.length; i++) {
      updated[i].orderIndex = i;
    }
    setExercises(updated);
  };

  // Save Workout Template or Day Override
  const handleSave = async () => {
    const trimmedName = name.trim();
    if (!trimmedName) {
      Alert.alert('Missing Name', 'Please enter a name.');
      return;
    }

    try {
      if (dateStr && day) {
        // Save calendar day plan override
        const edits = {
          title: trimmedName,
          typeRaw: day.typeRaw,
          notes: notes,
          isOverridden: true
        };

        // Format sets for saving
        const formattedEntries = exercises.map(ex => ({
          id: ex.id,
          exerciseId: ex.exerciseId,
          exerciseName: ex.exerciseName,
          muscleGroupRaw: ex.muscleGroupRaw,
          secondaryMuscleGroupsRaw: ex.secondaryMuscleGroupsRaw,
          orderIndex: ex.orderIndex,
          targetSets: ex.targetSets,
          targetReps: ex.targetReps,
          targetWeightKg: ex.targetWeightKg,
          note: ex.note,
          supersetGroup: ex.supersetGroup,
          sets: ex.sets || Array.from({ length: ex.targetSets }, (_, i) => ({
            setNumber: i + 1,
            isDone: false,
            isWarmup: false
          }))
        }));

        await WorkoutStore.saveDayEdits(day.id, edits, formattedEntries);
        Alert.alert('Plan Updated', 'Saved day overrides.');
        router.back();
      } else {
        // Save/Create workout template
        let targetWorkoutId = workoutId;
        if (!targetWorkoutId) {
          const created = await WorkoutStore.createWorkout(trimmedName, 'other', notes);
          targetWorkoutId = created.id;
        } else if (workout) {
          workout.name = trimmedName;
          workout.notes = notes;
          await WorkoutStore.updateWorkout(workout);
        }

        // Save template exercises
        await WorkoutStore.saveWorkoutTemplates(targetWorkoutId, exercises);

        // Handle Schedule Rules
        if (isScheduled && weekdaysMask > 0) {
          let p: TrainingPlan;
          const planData = {
            scheduleWeekdaysMask: weekdaysMask,
            scheduleStart: plan?.scheduleStart || new Date().toISOString(),
            scheduleDurationRaw: durationRaw,
            scheduleWeeks: parseInt(weeksLength, 10) || 6,
            scheduleEnd: endDateStr || undefined,
            skipEvents: plan?.skipEvents || []
          };

          if (workout?.planId) {
            p = { ...planData, id: workout.planId };
            await WorkoutStore.updateTrainingPlan(p);
          } else {
            p = await WorkoutStore.createTrainingPlan(planData);
            await WorkoutStore.linkWorkoutToPlan(targetWorkoutId, p.id, 0);
          }

          // Trigger Materializer
          const workoutsList = await WorkoutStore.fetchWorkouts();
          p.rotation = workoutsList.filter(w => w.planId === p.id);
          await WorkoutScheduler.schedulePlan(p);
        } else if (workout?.planId) {
          // Unlink schedule plan
          await WorkoutStore.linkWorkoutToPlan(targetWorkoutId, null, 0);
          await WorkoutStore.deleteTrainingPlan(workout.planId);
        }

        Alert.alert('Template Saved', 'Successfully updated workout.');
        router.back();
      }
    } catch (err) {
      console.error(err);
      Alert.alert('Database Error', 'Failed to save workout plan.');
    }
  };

  const toggleWeekday = (bitIdx: number) => {
    setWeekdaysMask(prev => prev ^ (1 << bitIdx));
  };

  const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

  return (
    <KeyboardAvoidingView 
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      className={`flex-1 ${isDark ? 'bg-brand-background-dark' : 'bg-brand-background-light'}`}
    >
      {/* HEADER BAR */}
      <View className={`px-4 pt-12 pb-4 border-b flex-row justify-between items-center ${isDark ? 'bg-brand-card-dark border-brand-border-dark' : 'bg-white border-brand-border-light'}`}>
        <TouchableOpacity onPress={() => router.back()} className="p-1">
          <X color={isDark ? '#FFFFFF' : '#1A1A1A'} size={24} />
        </TouchableOpacity>
        
        <Text className={`text-base font-extrabold ${isDark ? 'text-white' : 'text-brand-primaryText-light'}`}>
          {dateStr ? 'Edit Day Plan' : (workoutId ? 'Edit Template' : 'New Template')}
        </Text>

        <TouchableOpacity onPress={handleSave} className="p-1 flex-row items-center gap-1">
          <Save color={isDark ? '#0A84FF' : '#007AFF'} size={20} />
          <Text className="text-brand-accent-light font-bold text-sm">Save</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: 40 }} className="flex-1 px-4 py-4 gap-4">
        
        {/* Plan Header details */}
        <View className={`p-5 rounded-3xl border ${isDark ? 'bg-brand-card-dark border-brand-border-dark' : 'bg-white border-brand-border-light'}`}>
          <TextInput
            className={`p-3 rounded-xl border font-bold text-lg mb-3 ${isDark ? 'bg-brand-inputBg-dark text-white border-brand-border-dark' : 'bg-brand-inputBg-light text-brand-primaryText-light border-brand-border-light'}`}
            placeholder="Routine Title"
            placeholderTextColor={isDark ? '#7A7A7A' : '#9E9E9E'}
            value={name}
            onChangeText={setName}
          />
          <TextInput
            multiline
            numberOfLines={2}
            className={`p-3 rounded-xl border text-sm text-left align-top ${isDark ? 'bg-brand-inputBg-dark text-white border-brand-border-dark' : 'bg-brand-inputBg-light text-brand-primaryText-light border-brand-border-light'}`}
            placeholder="Plan notes / instructions..."
            placeholderTextColor={isDark ? '#7A7A7A' : '#9E9E9E'}
            value={notes}
            onChangeText={setNotes}
          />
        </View>

        {/* RECURRING PLAN SCHEDULER SECTION (Templates only) */}
        {!dateStr && (
          <View className={`p-5 rounded-3xl border ${isDark ? 'bg-brand-card-dark border-brand-border-dark' : 'bg-white border-brand-border-light'}`}>
            <View className="flex-row justify-between items-center mb-3">
              <View className="flex-row items-center gap-2">
                <Calendar color={isDark ? '#0A84FF' : '#007AFF'} size={18} />
                <Text className={`text-base font-bold ${isDark ? 'text-white' : 'text-brand-primaryText-light'}`}>
                  Schedule Recurrence
                </Text>
              </View>
              <Switch
                value={isScheduled}
                onValueChange={setIsScheduled}
                trackColor={{ false: '#767577', true: '#30D158' }}
              />
            </View>

            {isScheduled && (
              <View className="mt-4 gap-4 border-t border-brand-hairline-light/10 pt-4">
                <Text className={`text-xs font-semibold ${isDark ? 'text-white/60' : 'text-brand-secondaryText-light'}`}>REPEAT ON WEEKDAYS</Text>
                
                <View className="flex-row justify-between">
                  {DAYS.map((dayName, idx) => {
                    const active = (weekdaysMask & (1 << idx)) !== 0;
                    return (
                      <TouchableOpacity
                        key={dayName}
                        onPress={() => toggleWeekday(idx)}
                        className={`w-9 h-9 rounded-full items-center justify-center border ${active ? 'bg-brand-accent-light border-brand-accent-light' : (isDark ? 'bg-brand-inputBg-dark border-brand-border-dark' : 'bg-brand-inputBg-light border-brand-border-light')}`}
                      >
                        <Text className={`text-[10px] font-bold ${active ? 'text-white' : (isDark ? 'text-white/60' : 'text-brand-secondaryText-light')}`}>
                          {dayName.substring(0, 1)}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>

                {/* Duration settings */}
                <View className="mt-2">
                  <Text className={`text-xs font-semibold mb-2 ${isDark ? 'text-white/60' : 'text-brand-secondaryText-light'}`}>DURATION</Text>
                  
                  <View className="flex-row gap-2">
                    {['ongoing', 'weeks'].map(d => {
                      const isSel = durationRaw === d;
                      return (
                        <TouchableOpacity
                          key={d}
                          onPress={() => setDurationRaw(d as any)}
                          className={`flex-1 py-2 rounded-xl border items-center ${isSel ? 'bg-brand-accent-light border-brand-accent-light' : (isDark ? 'bg-brand-inputBg-dark border-brand-border-dark' : 'bg-brand-inputBg-light border-brand-border-light')}`}
                        >
                          <Text className={`text-xs font-bold capitalize ${isSel ? 'text-white' : (isDark ? 'text-white/60' : 'text-brand-secondaryText-light')}`}>
                            {d}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>

                  {durationRaw === 'weeks' && (
                    <View className="mt-3 flex-row justify-between items-center">
                      <Text className={`text-xs ${isDark ? 'text-white/80' : 'text-brand-primaryText-light'}`}>Number of Weeks</Text>
                      <TextInput
                        className={`w-20 p-2 text-center rounded-xl border text-sm font-bold ${isDark ? 'bg-brand-inputBg-dark text-white border-brand-border-dark' : 'bg-brand-inputBg-light text-brand-primaryText-light border-brand-border-light'}`}
                        keyboardType="number-pad"
                        value={weeksLength}
                        onChangeText={setWeeksLength}
                      />
                    </View>
                  )}
                </View>
              </View>
            )}
          </View>
        )}

        {/* EXERCISES AND TARGETS LIST */}
        <View className="gap-3">
          <View className="flex-row justify-between items-center">
            <Text className={`text-base font-bold ${isDark ? 'text-white/60' : 'text-brand-secondaryText-light'}`}>
              Exercises ({exercises.length})
            </Text>
            <TouchableOpacity 
              onPress={() => setShowPicker(true)}
              className="flex-row items-center gap-1 bg-brand-accent-light/10 border border-brand-accent-light/20 px-3 py-1.5 rounded-xl"
            >
              <Plus color={isDark ? '#0A84FF' : '#007AFF'} size={14} />
              <Text className="text-brand-accent-light font-bold text-xs">Add Exercise</Text>
            </TouchableOpacity>
          </View>

          {exercises.map((ex, idx) => {
            const weightVal = ex.targetWeightKg > 0 
              ? (weightUnit === 'lb' ? Math.round(ex.targetWeightKg * 2.20462).toString() : ex.targetWeightKg.toString()) 
              : '';

            return (
              <View 
                key={ex.id || `temp-${idx}`} 
                className={`p-4 rounded-3xl border ${isDark ? 'bg-brand-card-dark border-brand-border-dark' : 'bg-white border-brand-border-light'}`}
              >
                <View className="flex-row justify-between items-center mb-3">
                  <Text className={`font-bold text-sm flex-1 mr-2 ${isDark ? 'text-white' : 'text-brand-primaryText-light'}`} numberOfLines={1}>
                    {ex.exerciseName}
                  </Text>
                  <TouchableOpacity onPress={() => handleDeleteExercise(idx)} className="p-1">
                    <Trash2 color={isDark ? '#FF453A' : '#FF3B30'} size={16} />
                  </TouchableOpacity>
                </View>

                {/* Targets Grid */}
                <View className="flex-row gap-3">
                  <View className="flex-1">
                    <Text className={`text-[10px] font-bold mb-1 ${isDark ? 'text-white/40' : 'text-brand-secondaryText-light'}`}>SETS</Text>
                    <TextInput
                      className={`p-2 text-center rounded-xl border text-xs font-bold ${isDark ? 'bg-brand-inputBg-dark text-white border-brand-border-dark' : 'bg-brand-inputBg-light text-brand-primaryText-light border-brand-border-light'}`}
                      keyboardType="number-pad"
                      placeholder="3"
                      value={String(ex.targetSets)}
                      onChangeText={(val) => handleExerciseTargetChange(idx, 'sets', val)}
                    />
                  </View>

                  <View className="flex-1">
                    <Text className={`text-[10px] font-bold mb-1 ${isDark ? 'text-white/40' : 'text-brand-secondaryText-light'}`}>REPS</Text>
                    <TextInput
                      className={`p-2 text-center rounded-xl border text-xs font-bold ${isDark ? 'bg-brand-inputBg-dark text-white border-brand-border-dark' : 'bg-brand-inputBg-light text-brand-primaryText-light border-brand-border-light'}`}
                      keyboardType="number-pad"
                      placeholder="10"
                      value={String(ex.targetReps)}
                      onChangeText={(val) => handleExerciseTargetChange(idx, 'reps', val)}
                    />
                  </View>

                  <View className="flex-1">
                    <Text className={`text-[10px] font-bold mb-1 ${isDark ? 'text-white/40' : 'text-brand-secondaryText-light'}`}>{weightUnit.toUpperCase()}</Text>
                    <TextInput
                      className={`p-2 text-center rounded-xl border text-xs font-bold ${isDark ? 'bg-brand-inputBg-dark text-white border-brand-border-dark' : 'bg-brand-inputBg-light text-brand-primaryText-light border-brand-border-light'}`}
                      keyboardType="decimal-pad"
                      placeholder="—"
                      value={weightVal}
                      onChangeText={(val) => handleExerciseTargetChange(idx, 'weight', val)}
                    />
                  </View>
                </View>

                {/* Optional Exercise-specific note */}
                <TextInput
                  className={`p-2 rounded-lg border text-xs mt-3 ${isDark ? 'bg-brand-inputBg-dark text-white border-brand-border-dark' : 'bg-brand-inputBg-light text-brand-primaryText-light border-brand-border-light'}`}
                  placeholder="Tap to add a lift note..."
                  placeholderTextColor={isDark ? '#7A7A7A' : '#9E9E9E'}
                  value={ex.note || ''}
                  onChangeText={(val) => handleExerciseTargetChange(idx, 'note', val)}
                />
              </View>
            );
          })}
        </View>
      </ScrollView>

      {/* EXERCISE CATALOG PICKER MODAL */}
      <Modal visible={showPicker} animationType="slide">
        <View className={`flex-1 pt-12 ${isDark ? 'bg-brand-background-dark' : 'bg-brand-background-light'}`}>
          <View className="flex-row justify-between items-center px-4 pb-4 border-b border-brand-hairline-light/20">
            <Text className={`text-lg font-bold ${isDark ? 'text-white' : 'text-brand-primaryText-light'}`}>Select Exercise</Text>
            <TouchableOpacity onPress={() => setShowPicker(false)} className="p-1">
              <X color={isDark ? '#FFFFFF' : '#1A1A1A'} size={24} />
            </TouchableOpacity>
          </View>

          <FlatList
            data={allCatalog}
            keyExtractor={item => item.id}
            contentContainerStyle={{ padding: 16, gap: 10 }}
            renderItem={({ item }) => (
              <TouchableOpacity
                onPress={() => handleAddExerciseFromPicker(item)}
                className={`p-4 rounded-2xl border flex-row justify-between items-center ${isDark ? 'bg-brand-card-dark border-brand-border-dark' : 'bg-white border-brand-border-light'}`}
              >
                <View>
                  <Text className={`font-bold text-sm ${isDark ? 'text-white' : 'text-brand-primaryText-light'}`}>{item.name}</Text>
                  <Text className={`text-[10px] uppercase font-semibold text-brand-secondaryText-light`}>{item.muscleGroupRaw}</Text>
                </View>
                <Plus color={isDark ? '#0A84FF' : '#007AFF'} size={18} />
              </TouchableOpacity>
            )}
          />
        </View>
      </Modal>

    </KeyboardAvoidingView>
  );
}
