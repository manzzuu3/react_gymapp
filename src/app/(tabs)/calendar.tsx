import React, { useState } from 'react';
import { 
  View, Text, TouchableOpacity, useColorScheme, Platform 
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useApp } from '../../context/AppContext';
import { WorkoutStore } from '../../database/WorkoutStore';
import { DateHelpers } from '../../utils/DateHelpers';
import { WorkoutDay } from '../../database/types';
import { router, useFocusEffect } from 'expo-router';
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, Edit2, Play } from 'lucide-react-native';

export default function CalendarScreen() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const insets = useSafeAreaInsets();
  const { weekStartsMonday } = useApp();

  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [calendarMode, setCalendarMode] = useState<'week' | 'month'>('month');
  const [monthDays, setMonthDays] = useState<(Date | null)[]>([]);
  const [weekDays, setWeekDays] = useState<Date[]>([]);
  const [workoutDaysMap, setWorkoutDaysMap] = useState<Record<string, WorkoutDay>>({});
  const [selectedDayWorkout, setSelectedDayWorkout] = useState<WorkoutDay | null>(null);

  // Load calendar data (days and their workout status)
  const loadCalendarData = async () => {
    try {
      const year = selectedDate.getFullYear();
      const month = selectedDate.getMonth();
      
      // Fetch 3 months of workout days to cover overlap
      const startDateStr = DateHelpers.toISODateString(new Date(year, month - 1, 1));
      const endDateStr = DateHelpers.toISODateString(new Date(year, month + 2, 0));
      
      const list = await WorkoutStore.fetchWorkoutDaysRange(startDateStr, endDateStr);
      const map: Record<string, WorkoutDay> = {};
      for (const d of list) {
        // Load details for set counts
        const fullDay = await WorkoutStore.fetchWorkoutDayWithEntries(d.date);
        if (fullDay) map[d.date] = fullDay;
        else map[d.date] = d;
      }
      setWorkoutDaysMap(map);

      // Build grids
      setMonthDays(DateHelpers.monthGrid(selectedDate, weekStartsMonday));
      setWeekDays(DateHelpers.week(selectedDate, weekStartsMonday));

      // Selected day preview
      const selStr = DateHelpers.toISODateString(selectedDate);
      const selDay = await WorkoutStore.fetchWorkoutDayWithEntries(selStr);
      setSelectedDayWorkout(selDay);
    } catch (err) {
      console.error('Error loading calendar data:', err);
    }
  };

  useFocusEffect(
    React.useCallback(() => {
      loadCalendarData();
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [selectedDate, weekStartsMonday])
  );

  const handleDateSelect = (date: Date) => {
    setSelectedDate(date);
  };

  const navigateMonth = (months: number) => {
    setSelectedDate(DateHelpers.addMonths(selectedDate, months));
  };

  const navigateWeek = (weeks: number) => {
    setSelectedDate(DateHelpers.addDays(selectedDate, weeks * 7));
  };

  const selectedDateStr = DateHelpers.toISODateString(selectedDate);
  const weekdaySymbols = DateHelpers.weekdayHeaderSymbols(weekStartsMonday);

  return (
    <View 
      style={{ paddingBottom: Platform.OS === 'ios' ? insets.bottom + 72 : 80 }}
      className={`flex-1 ${isDark ? 'bg-brand-background-dark' : 'bg-brand-background-light'}`}
    >
      
      {/* Calendar View Mode Segmented Picker */}
      <View className={`flex-row p-1 mx-4 mt-4 rounded-xl ${isDark ? 'bg-brand-card-dark' : 'bg-brand-inputBg-light'}`}>
        <TouchableOpacity 
          onPress={() => setCalendarMode('week')}
          className={`flex-1 py-1.5 rounded-lg ${calendarMode === 'week' ? (isDark ? 'bg-brand-inputBg-dark shadow' : 'bg-white shadow-sm') : ''}`}
        >
          <Text className={`text-center font-semibold text-xs ${calendarMode === 'week' ? (isDark ? 'text-white' : 'text-brand-primaryText-light') : (isDark ? 'text-white/40' : 'text-brand-secondaryText-light')}`}>
            Week View
          </Text>
        </TouchableOpacity>
        <TouchableOpacity 
          onPress={() => setCalendarMode('month')}
          className={`flex-1 py-1.5 rounded-lg ${calendarMode === 'month' ? (isDark ? 'bg-brand-inputBg-dark shadow' : 'bg-white shadow-sm') : ''}`}
        >
          <Text className={`text-center font-semibold text-xs ${calendarMode === 'month' ? (isDark ? 'text-white' : 'text-brand-primaryText-light') : (isDark ? 'text-white/40' : 'text-brand-secondaryText-light')}`}>
            Month View
          </Text>
        </TouchableOpacity>
      </View>

      {/* Navigation Header */}
      <View className="flex-row justify-between items-center px-6 py-4">
        <TouchableOpacity 
          onPress={() => calendarMode === 'month' ? navigateMonth(-1) : navigateWeek(-1)}
          className="p-1"
        >
          <ChevronLeft color={isDark ? '#FFFFFF' : '#1A1A1A'} size={24} />
        </TouchableOpacity>

        <Text className={`text-base font-extrabold ${isDark ? 'text-white' : 'text-brand-primaryText-light'}`}>
          {calendarMode === 'month' 
            ? DateHelpers.monthYear(selectedDate) 
            : `Week of ${DateHelpers.medium(weekDays[0])}`}
        </Text>

        <TouchableOpacity 
          onPress={() => calendarMode === 'month' ? navigateMonth(1) : navigateWeek(1)}
          className="p-1"
        >
          <ChevronRight color={isDark ? '#FFFFFF' : '#1A1A1A'} size={24} />
        </TouchableOpacity>
      </View>

      {/* Weekday headers */}
      <View className="flex-row px-4 mb-2">
        {weekdaySymbols.map((sym, idx) => (
          <Text 
            key={idx} 
            className={`flex-1 text-center font-bold text-[11px] ${isDark ? 'text-white/40' : 'text-brand-secondaryText-light'}`}
          >
            {sym}
          </Text>
        ))}
      </View>

      {/* CALENDAR BODY */}
      <View className="px-4">
        {calendarMode === 'month' ? (
          // MONTH GRID
          <View className="flex-row flex-wrap">
            {monthDays.map((d, index) => {
              if (d === null) {
                return <View key={`empty-${index}`} style={{ width: '14.28%', height: 44 }} />;
              }

              const dStr = DateHelpers.toISODateString(d);
              const isSelected = dStr === selectedDateStr;
              const isToday = DateHelpers.isToday(d);
              const workout = workoutDaysMap[dStr];

              // Check if workout has completed sets
              const setsDone = workout?.entries?.flatMap(e => e.sets || []).some(s => s.isDone);
              const isSkipped = workout?.isSkipped;

              let dotColorClass = '';
              if (setsDone) {
                dotColorClass = 'bg-brand-green-light'; // Completed workout
              } else if (isSkipped) {
                dotColorClass = 'bg-brand-orange-light'; // Skipped
              } else if (workout?.entries && workout.entries.length > 0) {
                dotColorClass = 'bg-brand-accent-light'; // Planned workout
              }

              return (
                <TouchableOpacity
                  key={dStr}
                  onPress={() => handleDateSelect(d)}
                  style={{ width: '14.28%', height: 46 }}
                  className="items-center justify-center relative"
                >
                  <View 
                    className={`w-8 h-8 rounded-full items-center justify-center ${isSelected ? 'bg-brand-accent-light' : (isToday ? (isDark ? 'bg-brand-inputBg-dark' : 'bg-brand-inputBg-light') : '')}`}
                  >
                    <Text 
                      className={`text-xs font-semibold ${isSelected ? 'text-white font-extrabold' : (isToday ? 'text-brand-accent-light font-bold' : (isDark ? 'text-white' : 'text-brand-primaryText-light'))}`}
                    >
                      {d.getDate()}
                    </Text>
                  </View>

                  {/* Dot indicator */}
                  {dotColorClass !== '' && (
                    <View className={`w-1.5 h-1.5 rounded-full absolute bottom-1 ${dotColorClass}`} />
                  )}
                </TouchableOpacity>
              );
            })}
          </View>
        ) : (
          // WEEK STRIP
          <View className="flex-row">
            {weekDays.map(d => {
              const dStr = DateHelpers.toISODateString(d);
              const isSelected = dStr === selectedDateStr;
              const isToday = DateHelpers.isToday(d);
              const workout = workoutDaysMap[dStr];

              const setsDone = workout?.entries?.flatMap(e => e.sets || []).some(s => s.isDone);
              const isSkipped = workout?.isSkipped;

              let dotColorClass = '';
              if (setsDone) dotColorClass = 'bg-brand-green-light';
              else if (isSkipped) dotColorClass = 'bg-brand-orange-light';
              else if (workout?.entries && workout.entries.length > 0) dotColorClass = 'bg-brand-accent-light';

              return (
                <TouchableOpacity
                  key={dStr}
                  onPress={() => handleDateSelect(d)}
                  className="flex-1 items-center justify-center py-2"
                >
                  <View 
                    className={`w-9 h-9 rounded-full items-center justify-center ${isSelected ? 'bg-brand-accent-light' : (isToday ? (isDark ? 'bg-brand-inputBg-dark' : 'bg-brand-inputBg-light') : '')}`}
                  >
                    <Text 
                      className={`text-xs font-semibold ${isSelected ? 'text-white font-extrabold' : (isToday ? 'text-brand-accent-light font-bold' : (isDark ? 'text-white' : 'text-brand-primaryText-light'))}`}
                    >
                      {d.getDate()}
                    </Text>
                  </View>
                  {dotColorClass !== '' && (
                    <View className={`w-1.5 h-1.5 rounded-full mt-1.5 ${dotColorClass}`} />
                  )}
                </TouchableOpacity>
              );
            })}
          </View>
        )}
      </View>

      {/* DAY PREVIEW CARD */}
      <View className="flex-1 px-4 mt-6">
        <Text className={`text-xs font-bold uppercase mb-3 ${isDark ? 'text-white/40' : 'text-brand-secondaryText-light'}`}>
          Preview ({selectedDateStr})
        </Text>
        
        {selectedDayWorkout && !selectedDayWorkout.isSkipped && selectedDayWorkout.entries && selectedDayWorkout.entries.length > 0 ? (
          <View className={`p-5 rounded-3xl border ${isDark ? 'bg-brand-card-dark border-brand-border-dark' : 'bg-brand-card-light border-brand-border-light'}`}>
            <View className="flex-row justify-between items-start mb-2">
              <View className="flex-1 mr-4">
                <Text className={`text-lg font-bold ${isDark ? 'text-white' : 'text-brand-primaryText-light'}`}>
                  {selectedDayWorkout.title || 'Workout Session'}
                </Text>
                <Text className={`text-xs uppercase font-semibold mt-0.5 ${isDark ? 'text-white/40' : 'text-brand-secondaryText-light'}`}>
                  Type: {selectedDayWorkout.typeRaw}
                </Text>
              </View>
              <View className="bg-brand-accent-light/10 border border-brand-accent-light/20 px-3 py-1 rounded-xl">
                <Text className="text-brand-accent-light font-bold text-xs">
                  {selectedDayWorkout.entries.flatMap(e => e.sets || []).filter(s => s.isDone).length} / {selectedDayWorkout.entries.flatMap(e => e.sets || []).length} Sets
                </Text>
              </View>
            </View>

            {selectedDayWorkout.notes ? (
              <Text className={`text-xs italic mb-4 ${isDark ? 'text-white/60' : 'text-brand-secondaryText-light'}`} numberOfLines={2}>
                Notes: {selectedDayWorkout.notes}
              </Text>
            ) : null}

            {/* List short snippet */}
            <View className="gap-2 border-t border-brand-hairline-light/10 pt-3.5 mb-4">
              {selectedDayWorkout.entries.slice(0, 3).map((ent, idx) => (
                <View key={ent.id} className="flex-row justify-between items-center">
                  <Text className={`text-xs flex-1 mr-2 ${isDark ? 'text-white/80' : 'text-brand-primaryText-light'}`} numberOfLines={1}>
                    {ent.exerciseName}
                  </Text>
                  <Text className={`text-xs ${isDark ? 'text-white/40' : 'text-brand-secondaryText-light'}`}>
                    {ent.targetSets}s x {ent.targetReps}r
                  </Text>
                </View>
              ))}
              {selectedDayWorkout.entries.length > 3 && (
                <Text className={`text-[10px] italic ${isDark ? 'text-white/40' : 'text-brand-secondaryText-light'}`}>
                  + {selectedDayWorkout.entries.length - 3} more exercises
                </Text>
              )}
            </View>

            <View className="flex-row gap-3">
              <TouchableOpacity
                onPress={() => router.push({ pathname: '/workout-detail', params: { date: selectedDateStr } })}
                className={`flex-1 py-3 rounded-2xl flex-row justify-center items-center gap-1.5 border ${isDark ? 'bg-brand-inputBg-dark border-brand-border-dark' : 'bg-brand-inputBg-light border-brand-border-light'}`}
              >
                <Edit2 color={isDark ? '#FFFFFF' : '#1A1A1A'} size={14} />
                <Text className={`font-bold text-xs ${isDark ? 'text-white' : 'text-brand-primaryText-light'}`}>Edit Plan</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => {
                  router.push('/active-workout');
                }}
                className="flex-1 bg-brand-accent-light py-3 rounded-2xl flex-row justify-center items-center gap-1.5 shadow"
              >
                <Play color="#FFFFFF" size={14} fill="#FFFFFF" />
                <Text className="text-white font-bold text-xs">Start Workout</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          <View className={`p-6 items-center justify-center rounded-3xl border border-dashed ${isDark ? 'bg-brand-card-dark/40 border-brand-border-dark' : 'bg-white/40 border-brand-border-light'}`}>
            <CalendarIcon color={isDark ? 'rgba(255,255,255,0.2)' : '#D8D4CE'} size={40} />
            <Text className={`text-xs text-center mt-3 mb-4 ${isDark ? 'text-white/40' : 'text-brand-secondaryText-light'}`}>
              Rest Day. No workout scheduled.
            </Text>
            <TouchableOpacity 
              onPress={() => router.push({ pathname: '/workout-detail', params: { date: selectedDateStr } })}
              className="bg-brand-accent-light/10 border border-brand-accent-light/20 px-6 py-2.5 rounded-2xl"
            >
              <Text className="text-brand-accent-light font-bold text-xs">Create Plan for Day</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    </View>
  );
}
