# AXIOM PULSE — Android testing build

Standalone Expo/React Native project for automotive delivery coordination.

## Current workflow
- FSM signs in and sees all dealership deliveries.
- Salesperson signs in and sees assigned deliveries.
- FSM creates a delivery, assigns a salesperson, lender/lessor, and collection requirements.
- Requirements include void cheque, trade release, ownership, refunds, money due, or custom notes.
- Backend queues server-side reminders.
- Salesperson cannot mark delivered while requirements remain incomplete.

## Android testing
1. Copy `.env.example` to `.env` and add the Supabase anon key.
2. Run `npm install`.
3. Run `npx expo start --android` for an emulator/device development test.

An actual installable APK/AAB requires Expo/EAS or another Android build service with authenticated credentials.
