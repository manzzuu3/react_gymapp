import React, { useState, useEffect } from 'react';
import { 
  View, Text, ScrollView, TouchableOpacity, Alert, 
  useColorScheme, Dimensions 
} from 'react-native';
import { WorkoutStore } from '../database/WorkoutStore';
import { BodyweightStore } from '../database/BodyweightStore';
import { WorkoutStats, TrendPoint, BodyweightSeries } from '../utils/WorkoutStats';
import { Exercise, WorkoutDay, ExerciseEntry } from '../database/types';
import { router, useLocalSearchParams } from 'expo-router';
import { 
  X, Award, Calendar, Trash2, 
  TrendingUp, Activity, HelpCircle 
} from 'lucide-react-native';
import Svg, { Path, Circle, Line } from 'react-native-svg';
import { useApp } from '../context/AppContext';
import { DateHelpers } from '../utils/DateHelpers';
import { cssInterop } from 'react-native-css-interop';

cssInterop(Svg, { className: 'style' });
cssInterop(Path, {
  className: {
    target: 'style',
    nativeStyleToProp: {
      fill: true,
      stroke: true,
    },
  } as any
});
cssInterop(Circle, {
  className: {
    target: 'style',
    nativeStyleToProp: {
      fill: true,
      stroke: true,
    },
  } as any
});
cssInterop(Line, {
  className: {
    target: 'style',
    nativeStyleToProp: {
      fill: true,
      stroke: true,
    },
  } as any
});

export default function ExerciseDetailScreen() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const { weightUnit } = useApp();

  const params = useLocalSearchParams();
  const exerciseId = params.exerciseId as string;

  const [exercise, setExercise] = useState<Exercise | null>(null);
  const [history, setHistory] = useState<{ date: string; entry: ExerciseEntry }[]>([]);
  const [personalBest, setPersonalBest] = useState<any>(null);
  const [trendData, setTrendData] = useState<TrendPoint[]>([]);

  const loadData = async () => {
    try {
      const ex = await WorkoutStore.fetchExerciseById(exerciseId);
      if (!ex) {
        router.back();
        return;
      }
      setExercise(ex);

      // Load all day history
      const allDays = await WorkoutStore.fetchWorkoutDaysRange('2020-01-01', '2099-12-31');
      const histList: { date: string; entry: ExerciseEntry }[] = [];
      const daysWithEntries: WorkoutDay[] = [];

      for (const d of allDays) {
        const fullDay = await WorkoutStore.fetchWorkoutDayWithEntries(d.date);
        if (fullDay && fullDay.entries) {
          daysWithEntries.push(fullDay);
          const match = fullDay.entries.find(e => e.exerciseName === ex.name);
          if (match) {
            histList.push({ date: d.date, entry: match });
          }
        }
      }
      // Sort history reverse chronological (most recent first)
      setHistory(histList.sort((a, b) => b.date.localeCompare(a.date)));

      // Load bodyweight lookup
      const weightEntries = await BodyweightStore.fetchBodyweightEntries();
      const bwSeries = new BodyweightSeries(weightEntries.map(w => ({ date: w.date, kg: w.weightKg })));

      // Compute Trend & PRs
      const trend = WorkoutStats.oneRMProgression(ex.name, daysWithEntries, bwSeries);
      setTrendData(trend);

      const prs = WorkoutStats.personalRecords(daysWithEntries, bwSeries);
      const myPr = prs.find(p => p.exerciseName === ex.name);
      setPersonalBest(myPr || null);

    } catch (err) {
      console.error('Error loading exercise details:', err);
    }
  };

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [exerciseId, weightUnit]);

  // Handle delete if custom
  const handleDeleteCustom = () => {
    if (!exercise || !exercise.isCustom) return;
    
    Alert.alert(
      'Delete Exercise?',
      'Are you sure you want to delete this custom exercise? History on days will be preserved.',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Delete', 
          style: 'destructive',
          onPress: async () => {
            await WorkoutStore.deleteCustomExercise(exercise.id);
            Alert.alert('Deleted', 'Custom exercise removed.');
            router.back();
          }
        }
      ]
    );
  };

  // SVG Line Chart Component
  const renderLineChart = (data: TrendPoint[], height: number = 130) => {
    if (data.length < 2) {
      return (
        <View style={{ height }} className="items-center justify-center">
          <Text className={`text-xs italic ${isDark ? 'text-white/40' : 'text-brand-secondaryText-light/60'}`}>
            Log at least 2 sessions to see strength trends.
          </Text>
        </View>
      );
    }

    const screenWidth = Dimensions.get('window').width - 64; // Margin padding
    const yValues = data.map(d => d.value);
    const yMax = Math.max(...yValues) * 1.05;
    const yMin = Math.min(...yValues) * 0.95;
    const yRange = yMax - yMin || 1;

    const points = data.map((d, index) => {
      const x = (index / (data.length - 1)) * screenWidth;
      const y = height - ((d.value - yMin) / yRange) * (height - 20) - 10;
      return { x, y };
    });

    let pathD = `M ${points[0].x} ${points[0].y}`;
    for (let i = 1; i < points.length; i++) {
      pathD += ` L ${points[i].x} ${points[i].y}`;
    }

    return (
      <View>
        <Svg width={screenWidth} height={height}>
          <Line x1={0} y1={10} x2={screenWidth} y2={10} stroke={isDark ? '#3A3A3C' : '#EAEAEA'} strokeWidth={1} strokeDasharray="4,4" />
          <Line x1={0} y1={height / 2} x2={screenWidth} y2={height / 2} stroke={isDark ? '#3A3A3C' : '#EAEAEA'} strokeWidth={1} strokeDasharray="4,4" />
          <Line x1={0} y1={height - 10} x2={screenWidth} y2={height - 10} stroke={isDark ? '#3A3A3C' : '#EAEAEA'} strokeWidth={1} strokeDasharray="4,4" />
          <Path d={pathD} fill="none" stroke="#007AFF" strokeWidth={3} />
          {points.map((p, idx) => (
            <Circle key={idx} cx={p.x} cy={p.y} r={4} fill={isDark ? '#2C2C2E' : '#FFFFFF'} stroke="#007AFF" strokeWidth={2} />
          ))}
        </Svg>
        <View className="flex-row justify-between mt-1 px-1">
          <Text className={`text-[9px] ${isDark ? 'text-white/40' : 'text-brand-secondaryText-light'}`}>
            {DateHelpers.medium(DateHelpers.parseISODate(data[0].date)!)}
          </Text>
          <Text className={`text-[9px] ${isDark ? 'text-white/40' : 'text-brand-secondaryText-light'}`}>
            {DateHelpers.medium(DateHelpers.parseISODate(data[data.length - 1].date)!)}
          </Text>
        </View>
      </View>
    );
  };

  if (!exercise) return null;

  return (
    <View className={`flex-1 ${isDark ? 'bg-brand-background-dark' : 'bg-brand-background-light'}`}>
      
      {/* HEADER */}
      <View className={`px-4 pt-12 pb-4 border-b flex-row justify-between items-center ${isDark ? 'bg-brand-card-dark border-brand-border-dark' : 'bg-white border-brand-border-light'}`}>
        <TouchableOpacity onPress={() => router.back()} className="p-1">
          <X color={isDark ? '#FFFFFF' : '#1A1A1A'} size={24} />
        </TouchableOpacity>
        
        <Text className={`text-base font-extrabold ${isDark ? 'text-white' : 'text-brand-primaryText-light'}`} numberOfLines={1}>
          Exercise Details
        </Text>

        {exercise.isCustom ? (
          <TouchableOpacity onPress={handleDeleteCustom} className="p-1">
            <Trash2 color={isDark ? '#FF453A' : '#FF3B30'} size={20} />
          </TouchableOpacity>
        ) : (
          <View style={{ width: 24 }} />
        )}
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: 40 }} className="flex-1 px-4 py-4 gap-4">
        
        {/* Name Card */}
        <View className={`p-5 rounded-3xl border ${isDark ? 'bg-brand-card-dark border-brand-border-dark' : 'bg-white border-brand-border-light'}`}>
          <Text className={`text-2xl font-extrabold ${isDark ? 'text-white' : 'text-brand-primaryText-light'}`}>
            {exercise.name}
          </Text>
          <Text className={`text-xs uppercase font-bold mt-1 ${isDark ? 'text-white/40' : 'text-brand-secondaryText-light'}`}>
            {exercise.muscleGroupRaw} • {exercise.equipment || 'barbell'} • {exercise.mechanicRaw}
          </Text>
        </View>

        {/* PR Card */}
        {personalBest && (
          <View className={`p-5 rounded-3xl border flex-row justify-between items-center ${isDark ? 'bg-brand-card-dark border-brand-border-dark' : 'bg-white border-brand-border-light'}`}>
            <View>
              <Text className={`text-[10px] font-semibold uppercase ${isDark ? 'text-white/40' : 'text-brand-secondaryText-light'}`}>PERSONAL BEST ESTIMATED 1RM</Text>
              <Text className={`text-3xl font-extrabold mt-1.5 ${isDark ? 'text-white' : 'text-brand-primaryText-light'}`}>
                {weightUnit === 'lb' 
                  ? `${Math.round(personalBest.bestOneRMKg * 2.20462)} lb` 
                  : `${Math.round(personalBest.bestOneRMKg)} kg`}
              </Text>
              <Text className={`text-[10px] mt-1 ${isDark ? 'text-white/40' : 'text-brand-secondaryText-light'}`}>
                Achieved on {personalBest.bestOneRMDate}
              </Text>
            </View>
            <Award color={isDark ? '#FFD60A' : '#8A6A3A'} size={32} />
          </View>
        )}

        {/* 1RM Trend Line Chart */}
        <View className={`p-5 rounded-3xl border ${isDark ? 'bg-brand-card-dark border-brand-border-dark' : 'bg-white border-brand-border-light'}`}>
          <View className="flex-row items-center gap-2 mb-4">
            <TrendingUp color={isDark ? '#0A84FF' : '#007AFF'} size={16} />
            <Text className={`text-xs font-bold uppercase ${isDark ? 'text-white/60' : 'text-brand-secondaryText-light'}`}>1-REP MAX PROGRESSION</Text>
          </View>
          {renderLineChart(trendData)}
        </View>

        {/* Instructions */}
        {exercise.instructionsText ? (
          <View className={`p-5 rounded-3xl border ${isDark ? 'bg-brand-card-dark border-brand-border-dark' : 'bg-white border-brand-border-light'}`}>
            <View className="flex-row items-center gap-2 mb-3">
              <Activity color={isDark ? '#BF5AF2' : '#7A5EA8'} size={16} />
              <Text className={`text-xs font-bold uppercase ${isDark ? 'text-white/60' : 'text-brand-secondaryText-light'}`}>INSTRUCTIONS</Text>
            </View>
            <View className="gap-2.5">
              {exercise.instructionsText.split('\n').map((step, idx) => (
                <View key={idx} className="flex-row items-start">
                  <Text className={`text-xs font-bold mr-2 ${isDark ? 'text-white/60' : 'text-brand-primaryText-light'}`}>{idx + 1}.</Text>
                  <Text className={`text-xs flex-1 ${isDark ? 'text-white/80' : 'text-brand-primaryText-light'}`}>{step}</Text>
                </View>
              ))}
            </View>
          </View>
        ) : null}

        {/* Training Log History */}
        <View className="gap-3">
          <View className="flex-row items-center gap-2">
            <Calendar color={isDark ? '#30D158' : '#5B8A6A'} size={16} />
            <Text className={`text-xs font-bold uppercase ${isDark ? 'text-white/60' : 'text-brand-secondaryText-light'}`}>TRAINING HISTORY</Text>
          </View>

          {history.length > 0 ? (
            history.map(item => (
              <View 
                key={item.date} 
                className={`p-4 rounded-3xl border ${isDark ? 'bg-brand-card-dark border-brand-border-dark' : 'bg-white border-brand-border-light'}`}
              >
                <Text className={`font-bold text-sm mb-2.5 ${isDark ? 'text-white' : 'text-brand-primaryText-light'}`}>
                  {DateHelpers.long(DateHelpers.parseISODate(item.date)!)}
                </Text>
                
                {/* Sets rows */}
                <View className="gap-1 border-t border-brand-hairline-light/10 pt-2">
                  {item.entry.sets?.map(set => (
                    <View key={set.id} className="flex-row justify-between items-center py-1">
                      <Text className={`text-xs ${set.isWarmup ? 'text-brand-orange-light font-semibold' : (isDark ? 'text-white/60' : 'text-brand-secondaryText-light')}`}>
                        Set {set.setNumber} {set.isWarmup ? '(Warmup)' : ''}
                      </Text>
                      <Text className={`text-xs font-bold ${isDark ? 'text-white' : 'text-brand-primaryText-light'}`}>
                        {set.isDone ? (
                          set.weightKg !== undefined && set.weightKg !== null ? (
                            weightUnit === 'lb' 
                              ? `${Math.round(set.weightKg * 2.20462)} lb x ${set.reps}` 
                              : `${set.weightKg} kg x ${set.reps}`
                          ) : `${set.reps} reps`
                        ) : '—'}
                      </Text>
                    </View>
                  ))}
                </View>
              </View>
            ))
          ) : (
            <View className={`py-8 items-center rounded-3xl border border-dashed ${isDark ? 'border-brand-border-dark bg-brand-card-dark/20' : 'border-brand-border-light bg-white/20'}`}>
              <HelpCircle color={isDark ? 'rgba(255,255,255,0.2)' : '#D8D4CE'} size={32} />
              <Text className={`text-xs mt-2 ${isDark ? 'text-white/40' : 'text-brand-secondaryText-light'}`}>
                No training history logged for this exercise.
              </Text>
            </View>
          )}
        </View>

      </ScrollView>
    </View>
  );
}
