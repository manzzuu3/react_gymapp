import React, { useState, useEffect } from 'react';
import { 
  View, Text, ScrollView, TouchableOpacity, Alert, 
  Dimensions, useColorScheme, FlatList 
} from 'react-native';
import { useApp } from '../../context/AppContext';
import { WorkoutStore } from '../../database/WorkoutStore';
import { BodyweightStore } from '../../database/BodyweightStore';
import { WorkoutStats, WeekStat, MuscleVolume, MuscleWeeklyVolume, PersonalRecord, TrendPoint, BodyweightSeries } from '../../utils/WorkoutStats';
import { StrengthScore } from '../../utils/StrengthScore';
import { WorkoutDay, Workout, TrainingPlan } from '../../database/types';
import { router, useFocusEffect } from 'expo-router';
import { 
  Plus, Calendar, Award, ChevronRight, BarChart2, 
  Settings, Clock, Sparkles, Flame, Percent, Dumbbell 
} from 'lucide-react-native';
import Svg, { Path, Circle, Rect, Line, Text as SvgText } from 'react-native-svg';
import { DateHelpers } from '../../utils/DateHelpers';

export default function WorkoutsScreen() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const { weightUnit } = useApp();

  const [activeTab, setActiveTab] = useState<'templates' | 'insights'>('templates');

  // Templates Data
  const [workouts, setWorkouts] = useState<Workout[]>([]);
  
  // Insights Data
  const [weeklyVol, setWeeklyVol] = useState<WeekStat[]>([]);
  const [consistency, setConsistency] = useState<any>(null);
  const [muscleSplit, setMuscleSplit] = useState<MuscleVolume[]>([]);
  const [weeklyMuscleVol, setWeeklyMuscleVol] = useState<MuscleWeeklyVolume[]>([]);
  const [records, setRecords] = useState<PersonalRecord[]>([]);
  const [selectedLift, setSelectedLift] = useState<string>('');
  const [liftTrend, setLiftTrend] = useState<TrendPoint[]>([]);
  const [strengthScore, setStrengthScore] = useState<any>(null);
  const [availableLifts, setAvailableLifts] = useState<string[]>([]);

  const loadData = async () => {
    try {
      // 1. Fetch workouts & templates
      const wList = await WorkoutStore.fetchWorkouts();
      setWorkouts(wList);

      // 2. Fetch all days for statistics
      const allDays = await WorkoutStore.fetchWorkoutDaysRange('2020-01-01', '2099-12-31');
      
      // Load entries for stats
      const daysWithEntries: WorkoutDay[] = [];
      for (const d of allDays) {
        const fullDay = await WorkoutStore.fetchWorkoutDayWithEntries(d.date);
        if (fullDay) daysWithEntries.push(fullDay);
      }

      // Load bodyweight lookup
      const weightEntries = await BodyweightStore.fetchBodyweightEntries();
      const bwSeries = new BodyweightSeries(weightEntries.map(w => ({ date: w.date, kg: w.weightKg })));

      // 3. Compute stats
      const weekStats = WorkoutStats.weeklyTotals(daysWithEntries);
      setWeeklyVol(weekStats);

      const todayStr = DateHelpers.toISODateString(new Date());
      const consist = WorkoutStats.consistency(daysWithEntries, undefined, todayStr);
      setConsistency(consist);

      const split = WorkoutStats.muscleBreakdown(daysWithEntries);
      setMuscleSplit(split);

      const weeklyMuscle = WorkoutStats.weeklyMuscleVolume(daysWithEntries);
      setWeeklyMuscleVol(weeklyMuscle);

      const prs = WorkoutStats.personalRecords(daysWithEntries, bwSeries);
      setRecords(prs);

      const mostTrained = WorkoutStats.mostTrainedLifts(daysWithEntries, 10);
      setAvailableLifts(mostTrained);

      let activeLift = selectedLift;
      if (!activeLift && mostTrained.length > 0) {
        activeLift = mostTrained[0];
        setSelectedLift(activeLift);
      }

      if (activeLift) {
        const trend = WorkoutStats.oneRMProgression(activeLift, daysWithEntries, bwSeries);
        setLiftTrend(trend);
      }

      // Compute Strength Score
      const latestBw = weightEntries.length > 0 ? weightEntries[weightEntries.length - 1].weightKg : 0;
      if (latestBw > 0) {
        const score = StrengthScore.compute(prs, latestBw, 'male');
        setStrengthScore(score);
      } else {
        setStrengthScore(null);
      }

    } catch (err) {
      console.error('Error loading workouts screen data:', err);
    }
  };

  useFocusEffect(
    React.useCallback(() => {
      loadData();
    }, [selectedLift, weightUnit])
  );

  // SVG Line Chart Component
  const renderLineChart = (data: TrendPoint[], height: number = 140) => {
    if (data.length < 2) {
      return (
        <View style={{ height }} className="items-center justify-center">
          <Text className={`text-xs italic ${isDark ? 'text-white/40' : 'text-brand-secondaryText-light/60'}`}>
            Not enough data points to plot trend.
          </Text>
        </View>
      );
    }

    const screenWidth = Dimensions.get('window').width - 64; // Margin padding
    const yValues = data.map(d => d.value);
    const yMax = Math.max(...yValues) * 1.05;
    const yMin = Math.min(...yValues) * 0.95;
    const yRange = yMax - yMin || 1;

    // Map to SVG coordinates
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
          {/* Grid lines */}
          <Line x1={0} y1={10} x2={screenWidth} y2={10} stroke={isDark ? '#3A3A3C' : '#EAEAEA'} strokeWidth={1} strokeDasharray="4,4" />
          <Line x1={0} y1={height / 2} x2={screenWidth} y2={height / 2} stroke={isDark ? '#3A3A3C' : '#EAEAEA'} strokeWidth={1} strokeDasharray="4,4" />
          <Line x1={0} y1={height - 10} x2={screenWidth} y2={height - 10} stroke={isDark ? '#3A3A3C' : '#EAEAEA'} strokeWidth={1} strokeDasharray="4,4" />
          
          {/* Main Path */}
          <Path d={pathD} fill="none" stroke="#007AFF" strokeWidth={3} />
          
          {/* Circle markers */}
          {points.map((p, idx) => (
            <Circle key={idx} cx={p.x} cy={p.y} r={4} fill={isDark ? '#2C2C2E' : '#FFFFFF'} stroke="#007AFF" strokeWidth={2} />
          ))}
        </Svg>
        <View className="flex-row justify-between mt-2 px-1">
          <Text className={`text-[10px] ${isDark ? 'text-white/40' : 'text-brand-secondaryText-light'}`}>
            {DateHelpers.medium(DateHelpers.parseISODate(data[0].date)!)}
          </Text>
          <Text className={`text-[10px] ${isDark ? 'text-white/40' : 'text-brand-secondaryText-light'}`}>
            {DateHelpers.medium(DateHelpers.parseISODate(data[data.length - 1].date)!)}
          </Text>
        </View>
      </View>
    );
  };

  // SVG Bar Chart Component for Muscle Volume split
  const renderMuscleVolumeSplit = (data: MuscleVolume[]) => {
    if (data.length === 0) {
      return <Text className={`text-xs italic text-center py-4 ${isDark ? 'text-white/40' : 'text-brand-secondaryText-light/60'}`}>No volume data recorded.</Text>;
    }

    const maxSets = Math.max(...data.map(d => d.sets));
    const containerWidth = Dimensions.get('window').width - 64;

    return (
      <View className="gap-3">
        {data.slice(0, 5).map(item => {
          const barWidth = maxSets > 0 ? (item.sets / maxSets) * (containerWidth - 100) : 0;
          return (
            <View key={item.group} className="flex-row items-center justify-between">
              <Text className={`w-24 text-xs font-semibold uppercase ${isDark ? 'text-white/80' : 'text-brand-primaryText-light'}`} numberOfLines={1}>
                {item.group}
              </Text>
              <View className="flex-1 flex-row items-center gap-2">
                <View className={`h-4 rounded-full bg-brand-accent-light`} style={{ width: Math.max(8, barWidth) }} />
                <Text className={`text-xs font-bold ${isDark ? 'text-white' : 'text-brand-primaryText-light'}`}>
                  {item.sets.toFixed(1)} sets
                </Text>
              </View>
            </View>
          );
        })}
      </View>
    );
  };

  return (
    <View className={`flex-1 ${isDark ? 'bg-brand-background-dark' : 'bg-brand-background-light'}`}>
      {/* Segmented Tab Picker */}
      <View className={`flex-row p-1.5 mx-4 mt-4 rounded-2xl ${isDark ? 'bg-brand-card-dark' : 'bg-brand-inputBg-light'}`}>
        <TouchableOpacity 
          onPress={() => setActiveTab('templates')}
          className={`flex-1 py-2.5 rounded-xl ${activeTab === 'templates' ? (isDark ? 'bg-brand-inputBg-dark shadow' : 'bg-white shadow-sm') : ''}`}
        >
          <Text className={`text-center font-bold text-sm ${activeTab === 'templates' ? (isDark ? 'text-white' : 'text-brand-primaryText-light') : (isDark ? 'text-white/40' : 'text-brand-secondaryText-light')}`}>
            Templates
          </Text>
        </TouchableOpacity>
        <TouchableOpacity 
          onPress={() => setActiveTab('insights')}
          className={`flex-1 py-2.5 rounded-xl ${activeTab === 'insights' ? (isDark ? 'bg-brand-inputBg-dark shadow' : 'bg-white shadow-sm') : ''}`}
        >
          <Text className={`text-center font-bold text-sm ${activeTab === 'insights' ? (isDark ? 'text-white' : 'text-brand-primaryText-light') : (isDark ? 'text-white/40' : 'text-brand-secondaryText-light')}`}>
            Insights & Analytics
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: 40 }} className="flex-1 mt-2">
        {activeTab === 'templates' ? (
          // TEMPLATES VIEW
          <View className="px-4 gap-4">
            <View className="flex-row justify-between items-center mt-2">
              <Text className={`text-base font-bold ${isDark ? 'text-white/60' : 'text-brand-secondaryText-light'}`}>
                Routine Templates ({workouts.length})
              </Text>
              <TouchableOpacity 
                onPress={() => router.push('/workout-detail')}
                className="flex-row items-center gap-1 bg-brand-accent-light/10 border border-brand-accent-light/20 px-3 py-1.5 rounded-xl"
              >
                <Plus color={isDark ? '#0A84FF' : '#007AFF'} size={16} />
                <Text className="text-brand-accent-light font-bold text-xs">New Template</Text>
              </TouchableOpacity>
            </View>

            {workouts.length > 0 ? (
              workouts.map(w => (
                <TouchableOpacity
                  key={w.id}
                  onPress={() => router.push({ pathname: '/workout-detail', params: { workoutId: w.id } })}
                  className={`p-5 rounded-3xl border flex-row justify-between items-center ${isDark ? 'bg-brand-card-dark border-brand-border-dark' : 'bg-brand-card-light border-brand-border-light'}`}
                >
                  <View className="flex-1 mr-4">
                    <Text className={`text-lg font-bold ${isDark ? 'text-white' : 'text-brand-primaryText-light'}`}>{w.name}</Text>
                    <Text className={`text-xs mt-1 font-semibold ${isDark ? 'text-white/60' : 'text-brand-secondaryText-light'}`}>
                      {w.exercises?.length || 0} Exercises • {w.notes || 'No description notes'}
                    </Text>
                    
                    <View className="flex-row items-center gap-1.5 mt-3">
                      <Calendar color={isDark ? '#40C8E0' : '#4A8A96'} size={14} />
                      <Text className={`text-xs ${isDark ? 'text-white/40' : 'text-brand-secondaryText-light'}`}>
                        {w.planId ? 'Scheduled plan' : 'Not scheduled'}
                      </Text>
                    </View>
                  </View>
                  <ChevronRight color={isDark ? '#FFFFFF' : '#1A1A1A'} size={20} />
                </TouchableOpacity>
              ))
            ) : (
              <View className={`py-12 items-center rounded-3xl border border-dashed ${isDark ? 'border-brand-border-dark' : 'border-brand-border-light'}`}>
                <Dumbbell color={isDark ? 'rgba(255,255,255,0.2)' : '#D8D4CE'} size={48} />
                <Text className={`text-sm mt-3 ${isDark ? 'text-white/40' : 'text-brand-secondaryText-light'}`}>
                  No workout templates found. Create one to get started!
                </Text>
              </View>
            )}
          </View>
        ) : (
          // INSIGHTS VIEW
          <View className="px-4 gap-4">
            
            {/* Strength Score Card */}
            {strengthScore && (
              <View className={`p-5 rounded-3xl border ${isDark ? 'bg-brand-card-dark border-brand-border-dark' : 'bg-brand-card-light border-brand-border-light'}`}>
                <View className="flex-row justify-between items-center">
                  <View>
                    <Text className={`text-xs font-semibold ${isDark ? 'text-white/60' : 'text-brand-secondaryText-light'}`}>STRENGTH RATING</Text>
                    <Text className={`text-3xl font-extrabold ${isDark ? 'text-white' : 'text-brand-primaryText-light'}`}>
                      Score: {strengthScore.overall.toFixed(1)}
                    </Text>
                    <Text className="text-brand-green-light font-bold text-sm mt-1">{strengthScore.level} Standard</Text>
                  </View>
                  <Award color={isDark ? '#FFD60A' : '#8A6A3A'} size={36} />
                </View>
              </View>
            )}

            {/* Consistency Statistics */}
            {consistency && (
              <View className={`p-5 rounded-3xl border ${isDark ? 'bg-brand-card-dark border-brand-border-dark' : 'bg-brand-card-light border-brand-border-light'}`}>
                <Text className={`text-xs font-semibold mb-4 ${isDark ? 'text-white/60' : 'text-brand-secondaryText-light'}`}>TRAINING CONSISTENCY</Text>
                
                <View className="flex-row justify-between items-center">
                  <View className="items-center flex-1 border-r border-brand-hairline-light/20">
                    <View className="flex-row items-center gap-1.5">
                      <Flame color="#FF9F0A" size={16} />
                      <Text className={`text-2xl font-extrabold ${isDark ? 'text-white' : 'text-brand-primaryText-light'}`}>
                        {consistency.currentStreak}
                      </Text>
                    </View>
                    <Text className={`text-[10px] text-center mt-1 ${isDark ? 'text-white/40' : 'text-brand-secondaryText-light'}`}>Current Week Streak</Text>
                  </View>

                  <View className="items-center flex-1 border-r border-brand-hairline-light/20">
                    <Text className={`text-2xl font-extrabold ${isDark ? 'text-white' : 'text-brand-primaryText-light'}`}>
                      {consistency.longestStreak}
                    </Text>
                    <Text className={`text-[10px] text-center mt-1 ${isDark ? 'text-white/40' : 'text-brand-secondaryText-light'}`}>Longest Streak</Text>
                  </View>

                  <View className="items-center flex-1">
                    <Text className={`text-2xl font-extrabold ${isDark ? 'text-white' : 'text-brand-primaryText-light'}`}>
                      {consistency.totalSessions}
                    </Text>
                    <Text className={`text-[10px] text-center mt-1 ${isDark ? 'text-white/40' : 'text-brand-secondaryText-light'}`}>Total Workouts</Text>
                  </View>
                </View>
              </View>
            )}

            {/* Volume Trend Line Chart */}
            <View className={`p-5 rounded-3xl border ${isDark ? 'bg-brand-card-dark border-brand-border-dark' : 'bg-brand-card-light border-brand-border-light'}`}>
              <Text className={`text-xs font-semibold mb-4 ${isDark ? 'text-white/60' : 'text-brand-secondaryText-light'}`}>WEEKLY TONNAGE (KG)</Text>
              {weeklyVol.length > 0 ? (
                renderLineChart(
                  weeklyVol.map(w => ({ date: w.weekStart, value: w.volumeKg }))
                )
              ) : (
                <Text className={`text-xs italic text-center py-4 ${isDark ? 'text-white/40' : 'text-brand-secondaryText-light/60'}`}>No tonnage logged.</Text>
              )}
            </View>

            {/* Muscle Group Split (Sets Breakdown) */}
            <View className={`p-5 rounded-3xl border ${isDark ? 'bg-brand-card-dark border-brand-border-dark' : 'bg-brand-card-light border-brand-border-light'}`}>
              <Text className={`text-xs font-semibold mb-4 ${isDark ? 'text-white/60' : 'text-brand-secondaryText-light'}`}>MUSCLE VOLUME SPLIT</Text>
              {renderMuscleVolumeSplit(muscleSplit)}
            </View>

            {/* Lift Progression Chart */}
            <View className={`p-5 rounded-3xl border ${isDark ? 'bg-brand-card-dark border-brand-border-dark' : 'bg-brand-card-light border-brand-border-light'}`}>
              <View className="flex-row justify-between items-center mb-4">
                <Text className={`text-xs font-semibold ${isDark ? 'text-white/60' : 'text-brand-secondaryText-light'}`}>ESTIMATED 1RM STRENGTH</Text>
                
                {availableLifts.length > 0 && (
                  <View className="flex-row gap-1">
                    {availableLifts.slice(0, 3).map(lift => (
                      <TouchableOpacity 
                        key={lift}
                        onPress={() => setSelectedLift(lift)}
                        className={`px-2.5 py-1 rounded-lg border ${selectedLift === lift ? 'bg-brand-accent-light/10 border-brand-accent-light/30' : (isDark ? 'border-brand-border-dark bg-brand-inputBg-dark' : 'border-brand-border-light bg-brand-inputBg-light')}`}
                      >
                        <Text className={`text-[10px] font-bold ${selectedLift === lift ? 'text-brand-accent-light' : (isDark ? 'text-white/60' : 'text-brand-secondaryText-light')}`} numberOfLines={1}>
                          {lift.substring(0, 8)}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                )}
              </View>

              {liftTrend.length > 0 ? (
                <View>
                  <Text className={`text-base font-bold mb-3 ${isDark ? 'text-white' : 'text-brand-primaryText-light'}`}>{selectedLift}</Text>
                  {renderLineChart(liftTrend)}
                </View>
              ) : (
                <Text className={`text-xs italic text-center py-4 ${isDark ? 'text-white/40' : 'text-brand-secondaryText-light/60'}`}>No strength history for the selected lift.</Text>
              )}
            </View>

            {/* Personal Records List */}
            <View className={`p-5 rounded-3xl border ${isDark ? 'bg-brand-card-dark border-brand-border-dark' : 'bg-brand-card-light border-brand-border-light'}`}>
              <Text className={`text-xs font-semibold mb-3 ${isDark ? 'text-white/60' : 'text-brand-secondaryText-light'}`}>PERSONAL BEST RECORDS</Text>
              {records.length > 0 ? (
                records.map(rec => (
                  <View key={rec.exerciseName} className="flex-row justify-between items-center py-2.5 border-b border-brand-hairline-light/10">
                    <View className="flex-1 mr-4">
                      <Text className={`font-semibold text-sm ${isDark ? 'text-white' : 'text-brand-primaryText-light'}`}>{rec.exerciseName}</Text>
                      <Text className={`text-[11px] ${isDark ? 'text-white/40' : 'text-brand-secondaryText-light'}`}>Achieved on {rec.bestOneRMDate}</Text>
                    </View>
                    <View className="items-end">
                      <Text className={`font-bold text-sm ${isDark ? 'text-brand-green-dark' : 'text-brand-green-light'}`}>
                        {weightUnit === 'lb' 
                          ? `${Math.round(rec.heaviestKg * 2.20462)} lb` 
                          : `${Math.round(rec.heaviestKg)} kg`}
                      </Text>
                      <Text className={`text-[10px] ${isDark ? 'text-white/40' : 'text-brand-secondaryText-light'}`}>
                        e1RM: {weightUnit === 'lb' ? `${Math.round(rec.bestOneRMKg * 2.20462)} lb` : `${Math.round(rec.bestOneRMKg)} kg`}
                      </Text>
                    </View>
                  </View>
                ))
              ) : (
                <Text className={`text-xs italic text-center py-4 ${isDark ? 'text-white/40' : 'text-brand-secondaryText-light/60'}`}>No records logged.</Text>
              )}
            </View>

          </View>
        )}
      </ScrollView>
    </View>
  );
}
