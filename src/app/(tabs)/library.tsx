import React, { useState } from 'react';
import { 
  View, Text, FlatList, TextInput, TouchableOpacity, 
  Alert, useColorScheme, KeyboardAvoidingView, Platform 
} from 'react-native';
import { WorkoutStore } from '../../database/WorkoutStore';
import { Exercise } from '../../database/types';
import { router, useFocusEffect } from 'expo-router';
import { Search, Plus, Dumbbell, ChevronRight, X } from 'lucide-react-native';

const MUSCLE_GROUPS = [
  'all', 'chest', 'back', 'shoulders', 'quadriceps', 'hamstrings', 
  'biceps', 'triceps', 'abdominals', 'calves', 'glutes', 'forearms'
];

export default function LibraryScreen() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedMuscle, setSelectedMuscle] = useState('all');

  // Custom Exercise Creation
  const [showAddModal, setShowAddModal] = useState(false);
  const [customName, setCustomName] = useState('');
  const [customMuscle, setCustomMuscle] = useState('chest');
  const [customEquipment, setCustomEquipment] = useState('barbell');

  const loadExercises = async () => {
    try {
      const list = await WorkoutStore.fetchExercises();
      setExercises(list);
    } catch (err) {
      console.error('Error loading exercises catalogue:', err);
    }
  };

  useFocusEffect(
    React.useCallback(() => {
      loadExercises();
    }, [])
  );

  const handleCreateCustom = async () => {
    const trimmed = customName.trim();
    if (!trimmed) {
      Alert.alert('Missing Name', 'Please enter a name for the custom exercise.');
      return;
    }

    try {
      const created = await WorkoutStore.createCustomExercise(
        trimmed,
        customMuscle,
        'compound',
        customEquipment
      );
      Alert.alert('Success', `Created exercise "${created.name}"`);
      setCustomName('');
      setShowAddModal(false);
      loadExercises();
    } catch (err) {
      console.error('Failed to create custom exercise:', err);
    }
  };

  // Filtering
  const filteredExercises = exercises.filter(ex => {
    const matchesSearch = ex.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesMuscle = selectedMuscle === 'all' || ex.muscleGroupRaw.toLowerCase() === selectedMuscle.toLowerCase();
    return matchesSearch && matchesMuscle;
  });

  return (
    <View className={`flex-1 ${isDark ? 'bg-brand-background-dark' : 'bg-brand-background-light'}`}>
      
      {/* Search Input */}
      <View className="px-4 mt-4">
        <View className={`flex-row items-center px-3.5 py-2.5 rounded-2xl border ${isDark ? 'bg-brand-card-dark border-brand-border-dark' : 'bg-white border-brand-border-light'}`}>
          <Search color={isDark ? 'rgba(255,255,255,0.4)' : '#7A7A7A'} size={18} />
          <TextInput
            className={`flex-1 ml-2 text-sm ${isDark ? 'text-white' : 'text-brand-primaryText-light'}`}
            placeholder="Search exercises..."
            placeholderTextColor={isDark ? '#7A7A7A' : '#9E9E9E'}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          {searchQuery !== '' && (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <X color={isDark ? '#FFFFFF' : '#1A1A1A'} size={16} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Muscle Group Chips */}
      <View className="mt-3.5">
        <FlatList
          horizontal
          showsHorizontalScrollIndicator={false}
          data={MUSCLE_GROUPS}
          keyExtractor={item => item}
          contentContainerStyle={{ paddingHorizontal: 16, gap: 8 }}
          renderItem={({ item }) => {
            const isSelected = selectedMuscle === item;
            return (
              <TouchableOpacity
                onPress={() => setSelectedMuscle(item)}
                className={`px-4 py-2 rounded-xl border ${isSelected ? 'bg-brand-accent-light border-brand-accent-light' : (isDark ? 'bg-brand-card-dark border-brand-border-dark' : 'bg-white border-brand-border-light')}`}
              >
                <Text 
                  className={`text-xs font-bold uppercase ${isSelected ? 'text-white' : (isDark ? 'text-white/60' : 'text-brand-secondaryText-light')}`}
                >
                  {item}
                </Text>
              </TouchableOpacity>
            );
          }}
        />
      </View>

      {/* EXERCISES LIST */}
      <FlatList
        data={filteredExercises}
        keyExtractor={item => item.id}
        contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 16, paddingBottom: 100, gap: 10 }}
        renderItem={({ item }) => (
          <TouchableOpacity
            onPress={() => router.push({ pathname: '/exercise-detail', params: { exerciseId: item.id } })}
            className={`p-4.5 rounded-3xl border flex-row justify-between items-center ${isDark ? 'bg-brand-card-dark border-brand-border-dark' : 'bg-white border-brand-border-light'}`}
          >
            <View className="flex-1 mr-4 flex-row items-center gap-3">
              <View className={`w-9 h-9 rounded-xl items-center justify-center ${isDark ? 'bg-brand-inputBg-dark' : 'bg-brand-inputBg-light'}`}>
                <Dumbbell color={isDark ? '#FFD60A' : '#8A6A3A'} size={18} />
              </View>
              <View className="flex-1">
                <Text className={`font-bold text-sm ${isDark ? 'text-white' : 'text-brand-primaryText-light'}`}>{item.name}</Text>
                <Text className={`text-[10px] uppercase font-semibold mt-0.5 ${isDark ? 'text-white/40' : 'text-brand-secondaryText-light'}`}>
                  {item.muscleGroupRaw} • {item.equipment || 'barbell'}
                </Text>
              </View>
            </View>
            <ChevronRight color={isDark ? '#FFFFFF' : '#1A1A1A'} size={16} />
          </TouchableOpacity>
        )}
        ListEmptyComponent={() => (
          <View className="py-12 items-center">
            <Text className={`text-sm italic ${isDark ? 'text-white/40' : 'text-brand-secondaryText-light'}`}>
              No exercises match your search query.
            </Text>
            <TouchableOpacity 
              onPress={() => {
                setCustomName(searchQuery);
                setShowAddModal(true);
              }}
              className="mt-4 bg-brand-accent-light/10 border border-brand-accent-light/20 px-6 py-2.5 rounded-2xl flex-row items-center gap-1.5"
            >
              <Plus color={isDark ? '#0A84FF' : '#007AFF'} size={16} />
              <Text className="text-brand-accent-light font-bold text-xs">Create Custom Exercise</Text>
            </TouchableOpacity>
          </View>
        )}
      />

      {/* Floating Add Button */}
      {!showAddModal && (
        <TouchableOpacity
          onPress={() => {
            setCustomName('');
            setShowAddModal(true);
          }}
          className="absolute bottom-6 right-6 w-14 h-14 bg-brand-accent-light rounded-full items-center justify-center shadow-lg"
        >
          <Plus color="#FFFFFF" size={28} />
        </TouchableOpacity>
      )}

      {/* Custom Exercise Bottom Modal Overlay */}
      {showAddModal && (
        <KeyboardAvoidingView 
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          className="absolute inset-0 bg-black/60 items-center justify-end z-50"
        >
          <View className={`w-full p-6 rounded-t-3xl ${isDark ? 'bg-brand-card-dark' : 'bg-white'}`}>
            <View className="flex-row justify-between items-center mb-5">
              <Text className={`text-lg font-bold ${isDark ? 'text-white' : 'text-brand-primaryText-light'}`}>
                Create Custom Exercise
              </Text>
              <TouchableOpacity onPress={() => setShowAddModal(false)} className="p-1">
                <X color={isDark ? '#FFFFFF' : '#1A1A1A'} size={20} />
              </TouchableOpacity>
            </View>

            <View className="gap-4">
              <View>
                <Text className={`text-xs font-semibold mb-1.5 ${isDark ? 'text-white/60' : 'text-brand-secondaryText-light'}`}>EXERCISE NAME</Text>
                <TextInput
                  className={`p-3.5 rounded-xl border text-sm ${isDark ? 'bg-brand-inputBg-dark text-white border-brand-border-dark' : 'bg-brand-inputBg-light text-brand-primaryText-light border-brand-border-light'}`}
                  placeholder="e.g. Incline DB Bench Press"
                  placeholderTextColor={isDark ? '#7A7A7A' : '#9E9E9E'}
                  value={customName}
                  onChangeText={setCustomName}
                />
              </View>

              <View>
                <Text className={`text-xs font-semibold mb-1.5 ${isDark ? 'text-white/60' : 'text-brand-secondaryText-light'}`}>PRIMARY MUSCLE</Text>
                <View className="flex-row flex-wrap gap-2">
                  {MUSCLE_GROUPS.filter(m => m !== 'all').map(muscle => {
                    const isSel = customMuscle === muscle;
                    return (
                      <TouchableOpacity
                        key={muscle}
                        onPress={() => setCustomMuscle(muscle)}
                        className={`px-3 py-1.5 rounded-lg border ${isSel ? 'bg-brand-accent-light border-brand-accent-light' : (isDark ? 'bg-brand-inputBg-dark border-brand-border-dark' : 'bg-brand-inputBg-light border-brand-border-light')}`}
                      >
                        <Text className={`text-[10px] font-bold uppercase ${isSel ? 'text-white' : (isDark ? 'text-white/60' : 'text-brand-secondaryText-light')}`}>
                          {muscle}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>

              <View className="mb-4">
                <Text className={`text-xs font-semibold mb-1.5 ${isDark ? 'text-white/60' : 'text-brand-secondaryText-light'}`}>EQUIPMENT</Text>
                <View className="flex-row gap-2">
                  {['barbell', 'dumbbell', 'machine', 'body only'].map(equip => {
                    const isSel = customEquipment === equip;
                    return (
                      <TouchableOpacity
                        key={equip}
                        onPress={() => setCustomEquipment(equip)}
                        className={`px-3 py-1.5 rounded-lg border ${isSel ? 'bg-brand-accent-light border-brand-accent-light' : (isDark ? 'bg-brand-inputBg-dark border-brand-border-dark' : 'bg-brand-inputBg-light border-brand-border-light')}`}
                      >
                        <Text className={`text-[10px] font-bold uppercase ${isSel ? 'text-white' : (isDark ? 'text-white/60' : 'text-brand-secondaryText-light')}`}>
                          {equip}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>

              <TouchableOpacity
                onPress={handleCreateCustom}
                className="bg-brand-accent-light py-4 rounded-2xl items-center shadow-sm"
              >
                <Text className="text-white font-bold text-sm">Save Custom Exercise</Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      )}
    </View>
  );
}
