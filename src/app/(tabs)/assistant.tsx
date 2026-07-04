import React, { useState, useEffect, useRef } from 'react';
import { 
  View, Text, FlatList, TextInput, TouchableOpacity, 
  KeyboardAvoidingView, Platform, useColorScheme, ActivityIndicator, Alert 
} from 'react-native';
import { useApp } from '../../context/AppContext';
import { ChatTurnStore } from '../../database/ChatTurnStore';
import { executeAgentTool } from '../../utils/AgentTools';
import { ChatTurn } from '../../database/types';
import { Send, Mic, Trash2, ShieldAlert, MessageSquare } from 'lucide-react-native';
import { useFocusEffect } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';

export default function AssistantScreen() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const { dbReady } = useApp();

  const [messages, setMessages] = useState<ChatTurn[]>([]);
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  
  // Tool log state to show visual indicator of databases matching
  const [toolExecutingName, setToolExecutingName] = useState<string | null>(null);

  const flatListRef = useRef<FlatList>(null);

  const loadChatHistory = async () => {
    try {
      const history = await ChatTurnStore.fetchChatTurns();
      setMessages(history);
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 100);
    } catch (err) {
      console.error('Error loading chat turns:', err);
    }
  };

  useFocusEffect(
    React.useCallback(() => {
      loadChatHistory();
    }, [])
  );

  // Clear chat
  const handleClearChat = async () => {
    await ChatTurnStore.clearChatTurns();
    setMessages([]);
  };

  // Simple local NLP regex parser for rule-based mock execution
  // Automatically maps common request phrases to matching AgentTools
  const parseLocalNLP = (text: string): { toolName: string; args: any } | null => {
    const t = text.toLowerCase();
    
    // Set daily calorie targets
    const kcalMatch = t.match(/set (?:kcal|calories) to (\d+)/i) || t.match(/(?:target) (\d+) kcal/i);
    const proteinMatch = t.match(/set protein to (\d+)/i) || t.match(/(\d+)g protein/i);
    if (kcalMatch || proteinMatch) {
      const kcal = kcalMatch ? parseInt(kcalMatch[1], 10) : undefined;
      const protein = proteinMatch ? parseInt(proteinMatch[1], 10) : undefined;
      return { toolName: 'set_targets', args: { kcal, protein } };
    }

    // Skip workout
    if (t.includes('skip') && (t.includes('workout') || t.includes('today') || t.includes('plan'))) {
      const slides = t.includes('slide') || t.includes('defer');
      return { toolName: 'skip_workout', args: { slides } };
    }

    // Log food
    // e.g. "log 150g chicken breast" or "logged 200g banana"
    const foodMatch = t.match(/log(?:ged)? (\d+)g (?:of )?([a-zA-Z0-9\s\-]+)/i) || 
                      t.match(/add (\d+)g (?:of )?([a-zA-Z0-9\s\-]+)/i);
    if (foodMatch) {
      const grams = parseFloat(foodMatch[1]);
      const name = foodMatch[2].trim();
      return { toolName: 'log_food', args: { food_name: name, grams } };
    }

    // Add exercise to day
    // e.g. "add bench press 4 sets 8 reps 80kg" or "add squat"
    const exerciseMatch = t.match(/add exercise ([a-zA-Z0-9\s\-]+)/i) ||
                          t.match(/add ([a-zA-Z0-9\s\-]+) (?:to my workout|today)/i);
    if (exerciseMatch) {
      const name = exerciseMatch[1].trim();
      const sets = t.match(/(\d+) sets/i) ? parseInt(t.match(/(\d+) sets/i)![1], 10) : 3;
      const reps = t.match(/(\d+) reps/i) ? parseInt(t.match(/(\d+) reps/i)![1], 10) : 10;
      const weight = t.match(/(\d+)kg/i) ? parseFloat(t.match(/(\d+)kg/i)![1]) : 0;
      return { toolName: 'add_exercise', args: { exercise_name: name, target_sets: sets, target_reps: reps, target_weight: weight } };
    }

    // Schedule workout template
    const scheduleMatch = t.match(/schedule ([a-zA-Z0-9\s\-]+) (?:workout|today|tomorrow)/i);
    if (scheduleMatch) {
      const name = scheduleMatch[1].trim();
      return { toolName: 'schedule_workout', args: { workout_name: name } };
    }

    // Undo last change
    if (t.includes('undo') || t.includes('revert') || t.includes('cancel last')) {
      return { toolName: 'undo_last_change', args: {} };
    }

    // Search food
    const searchFoodMatch = t.match(/search food ([a-zA-Z0-9\s\-]+)/i) || t.match(/(?:how many calories in|macros for) ([a-zA-Z0-9\s\-]+)/i);
    if (searchFoodMatch) {
      return { toolName: 'search_food', args: { query: searchFoodMatch[1].trim() } };
    }

    // Search exercise
    const searchExMatch = t.match(/search exercise ([a-zA-Z0-9\s\-]+)/i) || t.match(/find exercise ([a-zA-Z0-9\s\-]+)/i);
    if (searchExMatch) {
      return { toolName: 'search_exercise', args: { query: searchExMatch[1].trim() } };
    }

    // Get day summary
    if (t.includes('summary') || t.includes('totals') || t.includes('log today') || t.includes('how much did i eat')) {
      return { toolName: 'get_day_summary', args: {} };
    }

    return null;
  };

  const handleSendMessage = async () => {
    const text = inputText.trim();
    if (!text) return;

    setInputText('');
    setIsLoading(true);

    // Save user turn
    const userTurn = await ChatTurnStore.addChatTurn('user', text);
    setMessages(prev => [...prev, userTurn]);
    setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);

    // Process using API Key or Local Engine
    try {
      const apiKey = await AsyncStorage.getItem('assistantApiKey');
      let responseText = '';

      if (apiKey) {
        // AI API Key exists: call OpenAI / Gemini (Simulated API Client wrapper)
        setToolExecutingName('LLM API Call');
        
        // Wait 1.5s to simulate remote API call
        await new Promise(resolve => setTimeout(resolve, 1500));
        
        // Match using local NLP for tool selection to execute real changes
        const toolRequest = parseLocalNLP(text);
        if (toolRequest) {
          setToolExecutingName(toolRequest.toolName);
          const toolResult = await executeAgentTool(toolRequest.toolName, toolRequest.args);
          responseText = `[AI Assistant processed tool call: ${toolRequest.toolName}]\n${toolResult}`;
        } else {
          responseText = `Hello! I received your query. To configure my full capability, please note that I am executing local DB routines. I understood: "${text}". You can ask me to:
- "Log 150g chicken breast"
- "Add 4 sets of 10 reps bench press"
- "Schedule my Push Day workout today"
- "Skip today's workout"
- "Give me today's summary"
- "Undo my last change"`;
        }
      } else {
        // Offline Mock Engine: Parse and execute tool immediately
        const toolRequest = parseLocalNLP(text);
        if (toolRequest) {
          setToolExecutingName(toolRequest.toolName);
          const toolResult = await executeAgentTool(toolRequest.toolName, toolRequest.args);
          responseText = toolResult;
        } else {
          responseText = `I didn't recognize a specific write command. I am running offline in Local Helper Mode. You can command me to do database updates by typing:
- "Log 150g oats"
- "Add squats (3 sets, 10 reps)"
- "Schedule Push Day template today"
- "Skip today's workout"
- "Give me my summary today"
- "Undo my last change"

To connect me to a cloud brain, enter your API key in Settings (Profile tab).`;
        }
      }

      // Add assistant turn
      const assistantTurn = await ChatTurnStore.addChatTurn('assistant', responseText);
      setMessages(prev => [...prev, assistantTurn]);
      setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);

    } catch (err) {
      console.error(err);
      const errTurn = await ChatTurnStore.addChatTurn('assistant', 'Error executing assistant command.');
      setMessages(prev => [...prev, errTurn]);
    } finally {
      setToolExecutingName(null);
      setIsLoading(false);
    }
  };

  // Mock Voice Recording animation
  const startRecordingMock = () => {
    setInputText('Log 150g chicken breast');
    Alert.alert('Speech Captured (Simulated)', 'Transcribed: "Log 150g chicken breast"');
  };

  return (
    <KeyboardAvoidingView 
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
      className={`flex-1 ${isDark ? 'bg-brand-background-dark' : 'bg-brand-background-light'}`}
    >
      {/* Header Utilities */}
      <View className={`px-4 py-2 border-b flex-row justify-between items-center ${isDark ? 'bg-brand-card-dark border-brand-border-dark' : 'bg-white border-brand-border-light'}`}>
        <Text className={`text-xs font-semibold ${isDark ? 'text-white/60' : 'text-brand-secondaryText-light'}`}>
          Local DB Agent Seam
        </Text>
        {messages.length > 0 && (
          <TouchableOpacity onPress={handleClearChat} className="flex-row items-center gap-1.5 p-1 bg-brand-red-light/10 rounded-xl px-3 py-1">
            <Trash2 color={isDark ? '#FF453A' : '#FF3B30'} size={14} />
            <Text className="text-brand-red-light text-xs font-bold">Clear Chat</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Messages List */}
      <FlatList
        ref={flatListRef}
        data={messages}
        keyExtractor={item => item.id}
        contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 16, paddingBottom: 20, gap: 12 }}
        renderItem={({ item }) => {
          const isUser = item.roleRaw === 'user';
          return (
            <View className={`max-w-[80%] p-4 rounded-2xl ${isUser ? 'self-end bg-brand-accent-light' : 'self-start ' + (isDark ? 'bg-brand-card-dark border border-brand-border-dark' : 'bg-white border border-brand-border-light')}`}>
              <Text className={`text-sm ${isUser ? 'text-white font-medium' : (isDark ? 'text-white' : 'text-brand-primaryText-light')}`}>
                {item.text}
              </Text>
              <Text className={`text-[9px] mt-1.5 self-end ${isUser ? 'text-white/60' : 'text-brand-secondaryText-light'}`}>
                {new Date(item.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </Text>
            </View>
          );
        }}
        ListEmptyComponent={() => (
          <View className="py-12 items-center px-6">
            <MessageSquare color={isDark ? 'rgba(255,255,255,0.1)' : '#D8D4CE'} size={50} />
            <Text className={`text-center text-sm mt-3 ${isDark ? 'text-white/40' : 'text-brand-secondaryText-light'}`}>
              Start chatting with your AI gym coach. Type a log command to edit your calorie goals, log food servings, schedule workouts, or record sets.
            </Text>
          </View>
        )}
      />

      {/* Database/Tool executing status display */}
      {toolExecutingName && (
        <View className="mx-4 mb-2 p-2 rounded-xl bg-brand-accent-light/10 border border-brand-accent-light/20 flex-row items-center justify-between">
          <Text className="text-brand-accent-light text-xs font-semibold">
            Executing: {toolExecutingName}...
          </Text>
          <ActivityIndicator size="small" color="#007AFF" />
        </View>
      )}

      {/* Input Bar */}
      <View className={`p-4 border-t flex-row items-center gap-3 ${isDark ? 'bg-brand-card-dark border-brand-border-dark' : 'bg-white border-brand-border-light'}`}>
        <TouchableOpacity 
          onPress={startRecordingMock}
          className={`w-11 h-11 rounded-full items-center justify-center ${isDark ? 'bg-brand-inputBg-dark' : 'bg-brand-inputBg-light'}`}
        >
          <Mic color={isDark ? '#0A84FF' : '#007AFF'} size={20} />
        </TouchableOpacity>

        <TextInput
          className={`flex-1 p-3 rounded-2xl text-sm border ${isDark ? 'bg-brand-inputBg-dark text-white border-brand-border-dark' : 'bg-brand-inputBg-light text-brand-primaryText-light border-brand-border-light'}`}
          placeholder="Ask AI Coach to log chicken or bench press..."
          placeholderTextColor={isDark ? '#7A7A7A' : '#9E9E9E'}
          value={inputText}
          onChangeText={setInputText}
          onSubmitEditing={handleSendMessage}
        />

        <TouchableOpacity 
          onPress={handleSendMessage}
          disabled={!inputText.trim() || isLoading}
          className={`w-11 h-11 rounded-full items-center justify-center ${inputText.trim() && !isLoading ? 'bg-brand-accent-light' : (isDark ? 'bg-brand-inputBg-dark/50' : 'bg-brand-inputBg-light')}`}
        >
          <Send color={inputText.trim() && !isLoading ? '#FFFFFF' : (isDark ? 'rgba(255,255,255,0.2)' : '#B0B0B0')} size={18} />
        </TouchableOpacity>
      </View>

    </KeyboardAvoidingView>
  );
}
