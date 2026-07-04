import { Platform } from 'react-native';

// Try to resolve react-native-haptic-feedback first
let RNHaptics: any = null;
try {
  RNHaptics = require('react-native-haptic-feedback').default;
} catch {
  // Silent fallback
}

// Try to resolve expo-haptics as backup for Expo Go/compatibility
let ExpoHaptics: any = null;
try {
  ExpoHaptics = require('expo-haptics');
} catch {
  // Silent fallback
}

const options = {
  enableVibrateFallback: true,
  ignoreAndroidSystemSettings: false,
};

export const Haptics = {
  selection: () => {
    if (Platform.OS === 'web') return;
    if (RNHaptics) {
      try {
        RNHaptics.trigger('selection', options);
        return;
      } catch {
        // Fallback
      }
    }
    if (ExpoHaptics) {
      try {
        ExpoHaptics.selectionAsync().catch(() => {});
      } catch {
        // Fallback
      }
    }
  },
  light: () => {
    if (Platform.OS === 'web') return;
    if (RNHaptics) {
      try {
        RNHaptics.trigger('impactLight', options);
        return;
      } catch {
        // Fallback
      }
    }
    if (ExpoHaptics) {
      try {
        ExpoHaptics.impactAsync(ExpoHaptics.ImpactFeedbackStyle.Light).catch(() => {});
      } catch {
        // Fallback
      }
    }
  },
  medium: () => {
    if (Platform.OS === 'web') return;
    if (RNHaptics) {
      try {
        RNHaptics.trigger('impactMedium', options);
        return;
      } catch {
        // Fallback
      }
    }
    if (ExpoHaptics) {
      try {
        ExpoHaptics.impactAsync(ExpoHaptics.ImpactFeedbackStyle.Medium).catch(() => {});
      } catch {
        // Fallback
      }
    }
  },
  heavy: () => {
    if (Platform.OS === 'web') return;
    if (RNHaptics) {
      try {
        RNHaptics.trigger('impactHeavy', options);
        return;
      } catch {
        // Fallback
      }
    }
    if (ExpoHaptics) {
      try {
        ExpoHaptics.impactAsync(ExpoHaptics.ImpactFeedbackStyle.Heavy).catch(() => {});
      } catch {
        // Fallback
      }
    }
  },
  success: () => {
    if (Platform.OS === 'web') return;
    if (RNHaptics) {
      try {
        RNHaptics.trigger('notificationSuccess', options);
        return;
      } catch {
        // Fallback
      }
    }
    if (ExpoHaptics) {
      try {
        ExpoHaptics.notificationAsync(ExpoHaptics.NotificationFeedbackType.Success).catch(() => {});
      } catch {
        // Fallback
      }
    }
  },
  warning: () => {
    if (Platform.OS === 'web') return;
    if (RNHaptics) {
      try {
        RNHaptics.trigger('notificationWarning', options);
        return;
      } catch {
        // Fallback
      }
    }
    if (ExpoHaptics) {
      try {
        ExpoHaptics.notificationAsync(ExpoHaptics.NotificationFeedbackType.Warning).catch(() => {});
      } catch {
        // Fallback
      }
    }
  },
  error: () => {
    if (Platform.OS === 'web') return;
    if (RNHaptics) {
      try {
        RNHaptics.trigger('notificationError', options);
        return;
      } catch {
        // Fallback
      }
    }
    if (ExpoHaptics) {
      try {
        ExpoHaptics.notificationAsync(ExpoHaptics.NotificationFeedbackType.Error).catch(() => {});
      } catch {
        // Fallback
      }
    }
  }
};
