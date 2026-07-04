import React, { useState } from 'react';
import { 
  View, Text, ScrollView, TouchableOpacity, TextInput, 
  Alert, useColorScheme 
} from 'react-native';
import { useApp } from '../context/AppContext';
import { router } from 'expo-router';
import { Sparkles, Check } from 'lucide-react-native';

const ACTIVITY_MULTIPLIERS = {
  sedentary: { label: 'Sedentary (Office job)', value: 1.2 },
  lightly: { label: 'Lightly Active (1-3 days/wk)', value: 1.375 },
  moderately: { label: 'Moderately Active (3-5 days/wk)', value: 1.55 },
  highly: { label: 'Highly Active (6-7 days/wk)', value: 1.725 },
  extremely: { label: 'Extremely Active (Athletic)', value: 1.9 }
};

const GOALS = {
  lose: { label: 'Fat Loss (-500 kcal)', offset: -500 },
  maintain: { label: 'Maintenance (0 kcal)', offset: 0 },
  gain: { label: 'Muscle Gain (+300 kcal)', offset: 300 }
};

export default function OnboardingScreen() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const { weightUnit, setPreference } = useApp();

  // Inputs
  const [age, setAge] = useState('25');
  const [gender, setGender] = useState<'male' | 'female'>('male');
  const [heightCm, setHeightCm] = useState('175');
  const [weightInput, setWeightInput] = useState('70');
  const [activity, setActivity] = useState<keyof typeof ACTIVITY_MULTIPLIERS>('moderately');
  const [fitnessGoal, setFitnessGoal] = useState<keyof typeof GOALS>('maintain');

  const handleCalculate = async () => {
    const ageVal = parseInt(age, 10);
    const heightVal = parseFloat(heightCm);
    const weightVal = parseFloat(weightInput);

    if (isNaN(ageVal) || isNaN(heightVal) || isNaN(weightVal) || ageVal <= 0 || heightVal <= 0 || weightVal <= 0) {
      Alert.alert('Missing Info', 'Please enter valid numbers for age, height and weight.');
      return;
    }

    const weightKg = weightUnit === 'lb' ? weightVal / 2.20462 : weightVal;

    // Mifflin-St Jeor Equation
    let bmr = 0;
    if (gender === 'male') {
      bmr = 10 * weightKg + 6.25 * heightVal - 5 * ageVal + 5;
    } else {
      bmr = 10 * weightKg + 6.25 * heightVal - 5 * ageVal - 161;
    }

    const multiplier = ACTIVITY_MULTIPLIERS[activity].value;
    const tdee = bmr * multiplier;
    const surplus = GOALS[fitnessGoal].offset;

    const kcalTarget = Math.round(tdee + surplus);
    const proteinTarget = Math.round(weightKg * 2.0); // 2g per kg

    // Save to settings
    await setPreference('dailyKcalTarget', kcalTarget);
    await setPreference('dailyProteinTarget', proteinTarget);
    await setPreference('hasCompletedOnboarding', 'true');

    Alert.alert(
      'Onboarding Complete',
      `Targets calculated:\n- Calories: ${kcalTarget} kcal\n- Protein: ${proteinTarget}g\n\nSettings saved.`,
      [
        { 
          text: 'Get Started', 
          onPress: () => {
            router.replace('/(tabs)');
          } 
        }
      ]
    );
  };

  return (
    <ScrollView 
      className={`flex-1 ${isDark ? 'bg-brand-background-dark' : 'bg-brand-background-light'}`}
      contentContainerStyle={{ paddingBottom: 40 }}
    >
      <View className="px-4 py-8 gap-5">
        
        {/* Header */}
        <View className="items-center py-4">
          <View className="w-12 h-12 bg-brand-accent-light rounded-2xl items-center justify-center mb-3">
            <Sparkles color="#FFFFFF" size={24} />
          </View>
          <Text className={`text-2xl font-extrabold text-center ${isDark ? 'text-white' : 'text-brand-primaryText-light'}`}>
            Calculate Targets
          </Text>
          <Text className={`text-xs text-center mt-1 px-4 ${isDark ? 'text-white/60' : 'text-brand-secondaryText-light'}`}>
            Configure your bodybuilding daily macro goals using Mifflin-St Jeor standard equations.
          </Text>
        </View>

        {/* Inputs Questionnaire */}
        <View className={`p-5 rounded-3xl border gap-4.5 ${isDark ? 'bg-brand-card-dark border-brand-border-dark' : 'bg-white border-brand-border-light'}`}>
          
          {/* Gender */}
          <View>
            <Text className={`text-xs font-semibold mb-2 ${isDark ? 'text-white/60' : 'text-brand-secondaryText-light'}`}>GENDER</Text>
            <View className="flex-row gap-3">
              <TouchableOpacity
                onPress={() => setGender('male')}
                className={`flex-1 py-3 rounded-xl border items-center ${gender === 'male' ? 'bg-brand-accent-light border-brand-accent-light' : (isDark ? 'bg-brand-inputBg-dark border-brand-border-dark' : 'bg-brand-inputBg-light border-brand-border-light')}`}
              >
                <Text className={`text-xs font-bold ${gender === 'male' ? 'text-white' : (isDark ? 'text-white/60' : 'text-brand-secondaryText-light')}`}>
                  Male
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => setGender('female')}
                className={`flex-1 py-3 rounded-xl border items-center ${gender === 'female' ? 'bg-brand-accent-light border-brand-accent-light' : (isDark ? 'bg-brand-inputBg-dark border-brand-border-dark' : 'bg-brand-inputBg-light border-brand-border-light')}`}
              >
                <Text className={`text-xs font-bold ${gender === 'female' ? 'text-white' : (isDark ? 'text-white/60' : 'text-brand-secondaryText-light')}`}>
                  Female
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Age, Height, Weight row */}
          <View className="flex-row gap-3">
            <View className="flex-1">
              <Text className={`text-xs font-semibold mb-1.5 ${isDark ? 'text-white/60' : 'text-brand-secondaryText-light'}`}>AGE</Text>
              <TextInput
                className={`p-3 text-center rounded-xl border text-sm font-bold ${isDark ? 'bg-brand-inputBg-dark text-white border-brand-border-dark' : 'bg-brand-inputBg-light text-brand-primaryText-light border-brand-border-light'}`}
                keyboardType="number-pad"
                value={age}
                onChangeText={setAge}
              />
            </View>
            <View className="flex-1">
              <Text className={`text-xs font-semibold mb-1.5 ${isDark ? 'text-white/60' : 'text-brand-secondaryText-light'}`}>HEIGHT (CM)</Text>
              <TextInput
                className={`p-3 text-center rounded-xl border text-sm font-bold ${isDark ? 'bg-brand-inputBg-dark text-white border-brand-border-dark' : 'bg-brand-inputBg-light text-brand-primaryText-light border-brand-border-light'}`}
                keyboardType="number-pad"
                value={heightCm}
                onChangeText={setHeightCm}
              />
            </View>
            <View className="flex-1">
              <Text className={`text-xs font-semibold mb-1.5 ${isDark ? 'text-white/60' : 'text-brand-secondaryText-light'}`}>WEIGHT ({weightUnit.toUpperCase()})</Text>
              <TextInput
                className={`p-3 text-center rounded-xl border text-sm font-bold ${isDark ? 'bg-brand-inputBg-dark text-white border-brand-border-dark' : 'bg-brand-inputBg-light text-brand-primaryText-light border-brand-border-light'}`}
                keyboardType="decimal-pad"
                value={weightInput}
                onChangeText={setWeightInput}
              />
            </View>
          </View>

          {/* Activity Level */}
          <View>
            <Text className={`text-xs font-semibold mb-2 ${isDark ? 'text-white/60' : 'text-brand-secondaryText-light'}`}>ACTIVITY MULTIPLIER</Text>
            <View className="gap-2">
              {Object.keys(ACTIVITY_MULTIPLIERS).map(key => {
                const isSel = activity === key;
                const act = ACTIVITY_MULTIPLIERS[key as keyof typeof ACTIVITY_MULTIPLIERS];
                return (
                  <TouchableOpacity
                    key={key}
                    onPress={() => setActivity(key as any)}
                    className={`p-3.5 rounded-xl border flex-row justify-between items-center ${isSel ? 'bg-brand-accent-light/10 border-brand-accent-light/30' : (isDark ? 'bg-brand-inputBg-dark border-brand-border-dark' : 'bg-brand-inputBg-light border-brand-border-light')}`}
                  >
                    <Text className={`text-xs font-bold ${isSel ? 'text-brand-accent-light' : (isDark ? 'text-white/80' : 'text-brand-primaryText-light')}`}>
                      {act.label}
                    </Text>
                    <Text className={`text-[10px] ${isSel ? 'text-brand-accent-light font-extrabold' : (isDark ? 'text-white/40' : 'text-brand-secondaryText-light')}`}>
                      x{act.value}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          {/* Fitness Goal */}
          <View className="mb-4">
            <Text className={`text-xs font-semibold mb-2 ${isDark ? 'text-white/60' : 'text-brand-secondaryText-light'}`}>FITNESS GOAL</Text>
            <View className="gap-2">
              {Object.keys(GOALS).map(key => {
                const isSel = fitnessGoal === key;
                const g = GOALS[key as keyof typeof GOALS];
                return (
                  <TouchableOpacity
                    key={key}
                    onPress={() => setFitnessGoal(key as any)}
                    className={`p-3.5 rounded-xl border flex-row justify-between items-center ${isSel ? 'bg-brand-accent-light/10 border-brand-accent-light/30' : (isDark ? 'bg-brand-inputBg-dark border-brand-border-dark' : 'bg-brand-inputBg-light border-brand-border-light')}`}
                  >
                    <Text className={`text-xs font-bold ${isSel ? 'text-brand-accent-light' : (isDark ? 'text-white/80' : 'text-brand-primaryText-light')}`}>
                      {g.label}
                    </Text>
                    {isSel && <Check color="#007AFF" size={16} />}
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          <TouchableOpacity
            onPress={handleCalculate}
            className="bg-brand-accent-light py-4 rounded-2xl items-center shadow-sm"
          >
            <Text className="text-white font-bold text-sm">Save & Calculate Targets</Text>
          </TouchableOpacity>
        </View>

      </View>
    </ScrollView>
  );
}
