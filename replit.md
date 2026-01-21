# Vaiform Mobile

## Overview

Vaiform Mobile is a React Native/Expo mobile client that connects to an existing Vaiform backend. The app enables users to access their content library, view and play media (shorts/videos), manage settings, and handle authentication. It follows a professional, editorial design aesthetic with clean typography and purposeful use of color.

The mobile app is **client-only** - all business logic resides on the backend. The app consumes REST APIs from the Vaiform backend using Firebase Authentication for identity management.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture

- **Framework**: Expo (React Native) with TypeScript
- **Navigation**: React Navigation v7 with Native Stack and Bottom Tabs
  - Root Stack Navigator handles auth flow (Login vs Main)
  - Main Tab Navigator with 3 tabs: Home, Library, Settings
  - Each tab has its own Stack Navigator for nested screens
- **State Management**: 
  - React Context for auth state (AuthContext) and toast notifications (ToastContext)
  - TanStack React Query for server state and data fetching
- **Styling**: StyleSheet API with themed components, supporting light/dark mode
- **Animation**: React Native Reanimated for fluid transitions and micro-interactions

### Backend Architecture

- **Server**: Express.js with TypeScript
- **Purpose**: Primarily serves as a proxy/gateway on Replit - the main business logic lives on the external Vaiform backend
- **Database**: PostgreSQL via Drizzle ORM (schema defined but storage currently uses in-memory implementation)
- **API Pattern**: RESTful endpoints prefixed with `/api`

### Authentication

- **Provider**: Firebase Authentication
- **Methods**: Email/password and Google Sign-In (OAuth)
- **Token Management**: Firebase ID tokens with caching (1-hour expiration)
- **Persistence**: AsyncStorage for React Native persistence on native platforms

### API Client Design

- Centralized API client (`client/api/client.ts`) handles:
  - Automatic Firebase token injection in Authorization header
  - Response normalization for different envelope formats (`{success: true}` vs `{ok: true}`)
  - Error classification (auth errors, rate limiting)
  - Token caching with automatic refresh

### Key Design Patterns

1. **Screen Layout Pattern**: Screens use safe area insets, header height, and tab bar height for proper content positioning
2. **Themed Components**: `ThemedText`, `ThemedView`, `Card` provide consistent styling across light/dark modes
3. **Keyboard Handling**: `KeyboardAwareScrollViewCompat` provides cross-platform keyboard avoidance
4. **Error Boundaries**: Class-based error boundary with development-mode debugging

### Project Structure

```
client/           # React Native/Expo frontend
├── api/          # API client and type definitions
├── components/   # Reusable UI components
├── contexts/     # React Context providers (Auth, Toast)
├── hooks/        # Custom hooks (useTheme, useScreenOptions)
├── navigation/   # React Navigation setup
├── screens/      # Screen components
├── lib/          # Firebase and query client setup
└── constants/    # Theme colors, spacing, typography

server/           # Express backend
├── routes.ts     # API route definitions
├── storage.ts    # Data storage interface
└── templates/    # HTML templates

shared/           # Shared code between client/server
└── schema.ts     # Drizzle database schema
```

## External Dependencies

### Authentication & Identity
- **Firebase**: Authentication (Google OAuth, email/password), configured via environment variables (`EXPO_PUBLIC_FIREBASE_*`)

### Database
- **PostgreSQL**: Primary database (connection via `DATABASE_URL`)
- **Drizzle ORM**: Type-safe database queries and schema management

### Key NPM Packages
- **expo-av**: Video/audio playback for shorts
- **expo-auth-session**: OAuth flow handling
- **expo-web-browser**: OAuth redirect handling
- **react-native-reanimated**: Animations
- **@tanstack/react-query**: Server state management

### Environment Variables Required
```
DATABASE_URL                           # PostgreSQL connection string
EXPO_PUBLIC_FIREBASE_API_KEY          # Firebase config
EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN      # Firebase config
EXPO_PUBLIC_FIREBASE_PROJECT_ID       # Firebase config
EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET   # Firebase config
EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID
EXPO_PUBLIC_FIREBASE_APP_ID
EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID      # Google OAuth client ID
EXPO_PUBLIC_API_BASE_URL              # Backend API URL
EXPO_PUBLIC_DOMAIN                    # Replit domain for API calls
```

### External Services
- **Vaiform Backend**: Primary API server (configured via `EXPO_PUBLIC_API_BASE_URL`)
- **Firebase Storage**: Media file hosting (videos, images referenced in shorts)