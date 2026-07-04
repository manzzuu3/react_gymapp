# WorkoutLog RN 🏋️

A React Native / Expo port of the WorkoutLog iOS app. Tracks workouts, nutrition, bodyweight, and includes an AI fitness assistant — all powered by local SQLite with no cloud dependency.

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | [Expo](https://expo.dev) (SDK 57) with [Expo Router](https://expo.github.io/router) |
| Language | TypeScript |
| Styling | [NativeWind v4](https://nativewind.dev) (Tailwind CSS for React Native) |
| Database | [expo-sqlite](https://docs.expo.dev/versions/latest/sdk/sqlite/) (local, on-device) |
| State | React Context + AsyncStorage |
| Icons | [lucide-react-native](https://lucide.dev) |

---

## Prerequisites

Make sure you have the following installed before starting:

- **Node.js** v18 or later — [nodejs.org](https://nodejs.org)
- **npm** v9 or later (comes with Node)
- **Expo Go** app on your phone (optional, for physical device testing)
  - [iOS App Store](https://apps.apple.com/app/expo-go/id982107779)
  - [Google Play Store](https://play.google.com/store/apps/details?id=host.exp.exponent)

For running on **iOS Simulator** or **Android Emulator**:
- macOS + Xcode 15+ (iOS Simulator)
- Android Studio with an AVD configured (Android Emulator)

---

## Installation

```bash
# 1. Clone or navigate to the project
cd WorkoutLogRN

# 2. Install all dependencies
npm install
```

---

## Running the App

### Start the development server

```bash
npm run start
```

Once Metro starts, press one of the following keys in the terminal:

| Key | Action |
|-----|--------|
| `i` | Open in **iOS Simulator** (macOS only) |
| `a` | Open in **Android Emulator** |
| `w` | Open in **Web Browser** (localhost:8081) |
| Scan QR | Open in **Expo Go** on your physical device |

### Platform-specific shortcuts

```bash
npm run ios        # Launch iOS Simulator directly
npm run android    # Launch Android Emulator directly
npm run web        # Launch in browser directly
```

### Reset Metro cache (if you see stale bundle errors)

```bash
npx expo start --clear
```

---

## Project Structure

```
WorkoutLogRN/
├── src/
│   ├── app/                  # Expo Router screens (file-based routing)
│   │   ├── (tabs)/           # Bottom tab screens
│   │   │   ├── index.tsx     # Today's Hub
│   │   │   ├── workouts.tsx  # Workout templates & schedule
│   │   │   ├── calendar.tsx  # Training calendar
│   │   │   ├── library.tsx   # Exercise library
│   │   │   ├── assistant.tsx # AI fitness assistant
│   │   │   └── profile.tsx   # Settings & preferences
│   │   ├── active-workout.tsx
│   │   ├── workout-detail.tsx
│   │   ├── exercise-detail.tsx
│   │   └── onboarding.tsx
│   ├── database/             # SQLite stores & types
│   ├── context/              # App-wide state (AppContext)
│   └── utils/                # Helpers, scheduler, AI tools
├── assets/
│   ├── Exercises.json        # Bundled exercise catalog (~800 exercises)
│   └── foods.sqlite          # Bundled food nutrition database
├── babel.config.js           # NativeWind v4 Babel config
├── metro.config.js           # Metro bundler config with NativeWind
└── tailwind.config.js        # Tailwind/NativeWind theme tokens
```

---

## Key Features

- 📅 **Today's Hub** — daily workout, nutrition, and bodyweight overview
- 🏋️ **Workout Logger** — template-based training with set/rep tracking and rest timer
- 🥗 **Nutrition Tracking** — food logging with macro progress bars (calories, protein)
- 📆 **Training Calendar** — monthly view of training history
- 📚 **Exercise Library** — searchable catalog with muscle group filters
- 🤖 **AI Assistant** — offline fitness coach with natural language tool calls
- ⚙️ **Settings** — KG/LB unit toggle, calorie/protein goals, week start day

---

## Notes

- **No internet required** — all data is stored locally on-device via SQLite
- **Weight storage** — always stored in kg internally; converted to lbs in the UI if selected
- The `.expo/` folder is gitignored and auto-generated on first `expo start`
