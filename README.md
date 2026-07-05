# WorkoutLog RN 🏋️

A React Native  WorkoutLog app. Tracks workouts, nutrition, bodyweight, and includes an AI fitness assistant in Sqlite.

---
## Prerequisites

Make sure you have the following installed before starting:

- **Node.js** v18 or later — [nodejs.org](https://nodejs.org)
- **npm** v9 or later (comes with Node)
- **Expo Go** Install app on your phone from google play store or app store
  - [iOS App Store](https://apps.apple.com/app/expo-go/id982107779)
  - [Google Play Store](https://play.google.com/store/apps/details?id=host.exp.exponent)

---

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
| `w` | Open in **Web Browser** (localhost:8081) |
| Scan QR | Open in **Expo Go** on your physical device |


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
