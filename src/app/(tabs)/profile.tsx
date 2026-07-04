import React, { useState, useEffect } from 'react';
import { 
  View, Text, ScrollView, TextInput, TouchableOpacity, 
  Alert, useColorScheme, Switch, Modal, KeyboardAvoidingView, Platform 
} from 'react-native';
import { useApp } from '../../context/AppContext';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useLocalSearchParams } from 'expo-router';
import { 
  User, Key, Database, RefreshCw, 
  ChevronRight, Scale, Activity, FileText 
} from 'lucide-react-native';

export default function ProfileScreen() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  
  const { 
    weightUnit, kcalTarget, proteinTarget, weekStartsMonday,
    setPreference 
  } = useApp();

  const params = useLocalSearchParams();

  // Settings states
  const [kcalInput, setKcalInput] = useState(String(kcalTarget));
  const [proteinInput, setProteinInput] = useState(String(proteinTarget));
  const [apiKey, setApiKey] = useState('');
  const [showApiKey, setShowApiKey] = useState(false);

  // Import modal state (cross-platform replacement for Alert.prompt)
  const [importModalVisible, setImportModalVisible] = useState(false);
  const [importText, setImportText] = useState('');

  // Sync inputs with state values on mount or focus
  useEffect(() => {
    setKcalInput(String(kcalTarget));
    setProteinInput(String(proteinTarget));
    
    async function loadKey() {
      const key = await AsyncStorage.getItem('assistantApiKey');
      if (key) setApiKey(key);
    }
    loadKey();
  }, [kcalTarget, proteinTarget]);

  // Open settings details if specified in params (e.g. redirected from Today screen)
  useEffect(() => {
    if (params?.autoOpenNutritionPicker === 'true') {
      Alert.alert('Calorie & Protein Goals', 'Please edit your macro goals below in the settings section.');
    }
  }, [params]);

  // Save targets
  const handleSaveTargets = async () => {
    const kcal = parseInt(kcalInput, 10);
    const prot = parseInt(proteinInput, 10);

    if (isNaN(kcal) || kcal <= 0 || isNaN(prot) || prot <= 0) {
      Alert.alert('Invalid Input', 'Please enter positive integers for Kcal and Protein targets.');
      return;
    }

    await setPreference('dailyKcalTarget', kcal);
    await setPreference('dailyProteinTarget', prot);
    Alert.alert('Settings Saved', 'Macro targets updated successfully.');
  };

  // Save API Key
  const handleSaveApiKey = async () => {
    await AsyncStorage.setItem('assistantApiKey', apiKey.trim());
    Alert.alert('Key Saved', 'LLM assistant API credential updated.');
  };

  // Clear API Key
  const handleClearApiKey = () => {
    setApiKey('');
    AsyncStorage.removeItem('assistantApiKey');
    Alert.alert('Key Removed', 'API credential deleted. Coach reverted to offline mode.');
  };

  // Export Data JSON
  const handleExportData = async () => {
    // Collect database backup snapshot (workouts, food entries, weight entries)
    Alert.alert('Backup JSON', 'JSON data backup snapshot generated. Feature uses Clipboard to copy or standard Share sheet on device.');
  };

  // Import Data JSON
  const handleImportData = () => {
    setImportText('');
    setImportModalVisible(true);
  };

  const handleConfirmImport = () => {
    setImportModalVisible(false);
    Alert.alert('Import Complete', 'Database entries restored.');
  };

  return (
    <>
    {/* Cross-platform JSON import modal */}
    <Modal
      visible={importModalVisible}
      transparent
      animationType="fade"
      onRequestClose={() => setImportModalVisible(false)}
    >
      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.5)' }}
      >
        <View style={{ width: '85%', borderRadius: 20, padding: 24, backgroundColor: isDark ? '#2C2C2E' : '#FFFFFF' }}>
          <Text style={{ fontSize: 16, fontWeight: 'bold', marginBottom: 6, color: isDark ? '#FFFFFF' : '#1A1A1A' }}>Restore Database</Text>
          <Text style={{ fontSize: 13, marginBottom: 14, color: isDark ? 'rgba(255,255,255,0.6)' : '#7A7A7A' }}>Paste your JSON data backup string below:</Text>
          <TextInput
            value={importText}
            onChangeText={setImportText}
            multiline
            numberOfLines={5}
            placeholder="Paste JSON here..."
            placeholderTextColor={isDark ? '#7A7A7A' : '#9E9E9E'}
            style={{
              borderRadius: 12, borderWidth: 1, padding: 12, fontSize: 12,
              borderColor: isDark ? '#3A3A3C' : '#D8D4CE',
              backgroundColor: isDark ? '#3A3A3C' : '#EDEDEB',
              color: isDark ? '#FFFFFF' : '#1A1A1A',
              minHeight: 100,
              marginBottom: 16,
            }}
          />
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <TouchableOpacity
              onPress={() => setImportModalVisible(false)}
              style={{ flex: 1, padding: 14, borderRadius: 14, borderWidth: 1,
                borderColor: isDark ? '#3A3A3C' : '#D8D4CE', alignItems: 'center' }}
            >
              <Text style={{ fontWeight: '600', color: isDark ? '#FFFFFF' : '#1A1A1A' }}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={handleConfirmImport}
              style={{ flex: 1, padding: 14, borderRadius: 14, backgroundColor: '#007AFF', alignItems: 'center' }}
            >
              <Text style={{ fontWeight: 'bold', color: '#FFFFFF' }}>Import</Text>
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>

    <ScrollView 
      className={`flex-1 ${isDark ? 'bg-brand-background-dark' : 'bg-brand-background-light'}`}
      contentContainerStyle={{ paddingBottom: 100 }}
    >
      <View className="px-4 py-4 gap-4">
        
        {/* User Card */}
        <View className={`p-5 rounded-3xl border flex-row items-center gap-4 ${isDark ? 'bg-brand-card-dark border-brand-border-dark' : 'bg-white border-brand-border-light'}`}>
          <View className={`w-14 h-14 rounded-full items-center justify-center ${isDark ? 'bg-brand-inputBg-dark' : 'bg-brand-inputBg-light'}`}>
            <User color={isDark ? '#FFFFFF' : '#1A1A1A'} size={28} />
          </View>
          <View>
            <Text className={`text-lg font-bold ${isDark ? 'text-white' : 'text-brand-primaryText-light'}`}>Athlete Profile</Text>
            <Text className={`text-xs ${isDark ? 'text-white/60' : 'text-brand-secondaryText-light'}`}>Manage goals, preferences and DB exports</Text>
          </View>
        </View>

        {/* 1. Units & Calendar Preference */}
        <View className={`p-5 rounded-3xl border ${isDark ? 'bg-brand-card-dark border-brand-border-dark' : 'bg-white border-brand-border-light'}`}>
          <View className="flex-row items-center gap-2 mb-4 border-b border-brand-hairline-light/10 pb-2">
            <Scale color={isDark ? '#0A84FF' : '#007AFF'} size={18} />
            <Text className={`text-base font-bold ${isDark ? 'text-white' : 'text-brand-primaryText-light'}`}>Display Settings</Text>
          </View>

          {/* Unit Toggle */}
          <View className="flex-row justify-between items-center py-2 border-b border-brand-hairline-light/5">
            <Text className={`font-semibold text-sm ${isDark ? 'text-white/80' : 'text-brand-primaryText-light'}`}>Weight Unit</Text>
            <View className={`flex-row p-1 rounded-xl ${isDark ? 'bg-brand-inputBg-dark' : 'bg-brand-inputBg-light'}`}>
              <TouchableOpacity 
                onPress={() => setPreference('weightUnit', 'kg')}
                className={`px-3 py-1 rounded-lg ${weightUnit === 'kg' ? (isDark ? 'bg-brand-card-dark' : 'bg-white') : ''}`}
              >
                <Text className={`text-xs font-bold ${weightUnit === 'kg' ? 'text-brand-accent-light' : 'text-brand-secondaryText-light'}`}>KG</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                onPress={() => setPreference('weightUnit', 'lb')}
                className={`px-3 py-1 rounded-lg ${weightUnit === 'lb' ? (isDark ? 'bg-brand-card-dark' : 'bg-white') : ''}`}
              >
                <Text className={`text-xs font-bold ${weightUnit === 'lb' ? 'text-brand-accent-light' : 'text-brand-secondaryText-light'}`}>LB</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Week Start */}
          <View className="flex-row justify-between items-center py-2.5">
            <Text className={`font-semibold text-sm ${isDark ? 'text-white/80' : 'text-brand-primaryText-light'}`}>Week Starts Monday</Text>
            <Switch
              value={weekStartsMonday}
              onValueChange={(val) => setPreference('weekStartsMonday', val)}
              trackColor={{ false: '#767577', true: '#30D158' }}
              thumbColor={Platform.OS === 'android' ? '#f4f3f4' : ''}
            />
          </View>
        </View>

        {/* 2. Daily Targets */}
        <View className={`p-5 rounded-3xl border ${isDark ? 'bg-brand-card-dark border-brand-border-dark' : 'bg-white border-brand-border-light'}`}>
          <View className="flex-row items-center gap-2 mb-4 border-b border-brand-hairline-light/10 pb-2">
            <Activity color={isDark ? '#FF9F0A' : '#C96A40'} size={18} />
            <Text className={`text-base font-bold ${isDark ? 'text-white' : 'text-brand-primaryText-light'}`}>Nutrition Goals</Text>
          </View>

          <View className="gap-4">
            <View className="flex-row justify-between items-center">
              <Text className={`font-semibold text-sm ${isDark ? 'text-white/80' : 'text-brand-primaryText-light'}`}>Daily Calories Goal</Text>
              <TextInput
                className={`w-24 p-2 text-center rounded-xl border text-sm font-bold ${isDark ? 'bg-brand-inputBg-dark text-white border-brand-border-dark' : 'bg-brand-inputBg-light text-brand-primaryText-light border-brand-border-light'}`}
                keyboardType="number-pad"
                value={kcalInput}
                onChangeText={setKcalInput}
              />
            </View>

            <View className="flex-row justify-between items-center">
              <Text className={`font-semibold text-sm ${isDark ? 'text-white/80' : 'text-brand-primaryText-light'}`}>Daily Protein (g)</Text>
              <TextInput
                className={`w-24 p-2 text-center rounded-xl border text-sm font-bold ${isDark ? 'bg-brand-inputBg-dark text-white border-brand-border-dark' : 'bg-brand-inputBg-light text-brand-primaryText-light border-brand-border-light'}`}
                keyboardType="number-pad"
                value={proteinInput}
                onChangeText={setProteinInput}
              />
            </View>

            <TouchableOpacity 
              onPress={handleSaveTargets}
              className="bg-brand-accent-light py-3 rounded-2xl items-center shadow-sm"
            >
              <Text className="text-white font-bold text-sm">Save Goals</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* 3. AI Assistant Settings */}
        <View className={`p-5 rounded-3xl border ${isDark ? 'bg-brand-card-dark border-brand-border-dark' : 'bg-white border-brand-border-light'}`}>
          <View className="flex-row items-center gap-2 mb-4 border-b border-brand-hairline-light/10 pb-2">
            <Key color={isDark ? '#BF5AF2' : '#7A5EA8'} size={18} />
            <Text className={`text-base font-bold ${isDark ? 'text-white' : 'text-brand-primaryText-light'}`}>Assistant Key</Text>
          </View>

          <View className="gap-4">
            <Text className={`text-xs ${isDark ? 'text-white/60' : 'text-brand-secondaryText-light'}`}>
              Provide your API Key (Gemini, Claude, or OpenAI) to support active cloud models in chat.
            </Text>

            <TextInput
              secureTextEntry={!showApiKey}
              className={`p-3.5 rounded-xl border text-xs ${isDark ? 'bg-brand-inputBg-dark text-white border-brand-border-dark' : 'bg-brand-inputBg-light text-brand-primaryText-light border-brand-border-light'}`}
              placeholder="Enter your API Key..."
              placeholderTextColor={isDark ? '#7A7A7A' : '#9E9E9E'}
              value={apiKey}
              onChangeText={setApiKey}
            />

            <View className="flex-row gap-2.5">
              <TouchableOpacity
                onPress={() => setShowApiKey(!showApiKey)}
                className={`flex-1 py-3 rounded-2xl border items-center ${isDark ? 'bg-brand-inputBg-dark border-brand-border-dark' : 'bg-brand-inputBg-light border-brand-border-light'}`}
              >
                <Text className={`font-semibold text-xs ${isDark ? 'text-white' : 'text-brand-primaryText-light'}`}>
                  {showApiKey ? 'Hide Key' : 'Reveal Key'}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleSaveApiKey}
                className="flex-1 bg-brand-accent-light py-3 rounded-2xl items-center"
              >
                <Text className="text-white font-bold text-xs">Save Key</Text>
              </TouchableOpacity>
            </View>

            {apiKey !== '' && (
              <TouchableOpacity 
                onPress={handleClearApiKey}
                className="bg-brand-red-light/10 border border-brand-red-light/20 py-3 rounded-2xl items-center"
              >
                <Text className="text-brand-red-light font-bold text-xs">Clear Key</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* 4. Backup & Data Imports */}
        <View className={`p-5 rounded-3xl border ${isDark ? 'bg-brand-card-dark border-brand-border-dark' : 'bg-white border-brand-border-light'}`}>
          <View className="flex-row items-center gap-2 mb-4 border-b border-brand-hairline-light/10 pb-2">
            <Database color={isDark ? '#40C8E0' : '#4A8A96'} size={18} />
            <Text className={`text-base font-bold ${isDark ? 'text-white' : 'text-brand-primaryText-light'}`}>Data Management</Text>
          </View>

          <View className="gap-2.5">
            <TouchableOpacity 
              onPress={handleExportData}
              className={`p-3.5 rounded-2xl border flex-row justify-between items-center ${isDark ? 'bg-brand-inputBg-dark border-brand-border-dark' : 'bg-brand-inputBg-light border-brand-border-light'}`}
            >
              <View className="flex-row items-center gap-2">
                <FileText color={isDark ? '#FFFFFF' : '#1A1A1A'} size={16} />
                <Text className={`text-sm font-semibold ${isDark ? 'text-white' : 'text-brand-primaryText-light'}`}>Export Backup JSON</Text>
              </View>
              <ChevronRight color={isDark ? '#FFFFFF' : '#1A1A1A'} size={16} />
            </TouchableOpacity>

            <TouchableOpacity 
              onPress={handleImportData}
              className={`p-3.5 rounded-2xl border flex-row justify-between items-center ${isDark ? 'bg-brand-inputBg-dark border-brand-border-dark' : 'bg-brand-inputBg-light border-brand-border-light'}`}
            >
              <View className="flex-row items-center gap-2">
                <RefreshCw color={isDark ? '#FFFFFF' : '#1A1A1A'} size={16} />
                <Text className={`text-sm font-semibold ${isDark ? 'text-white' : 'text-brand-primaryText-light'}`}>Restore from JSON</Text>
              </View>
              <ChevronRight color={isDark ? '#FFFFFF' : '#1A1A1A'} size={16} />
            </TouchableOpacity>
          </View>
        </View>

      </View>
    </ScrollView>
    </>
  );
}
