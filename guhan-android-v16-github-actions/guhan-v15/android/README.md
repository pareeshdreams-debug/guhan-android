# G.U.H.A.N. Android V16

Minimal dark assistant UI with the V10 system-assistant entry point, voice input, local memory, native Android handoffs, and the V16 AI-agent connection layer.

## Setup
1. Open the project in Android Studio.
2. Build/install the debug APK on an Android device.
3. Open G.U.H.A.N. and set the HTTPS AI server URL with:
   `set AI server URL https://your-project.vercel.app`
4. If desired, select G.U.H.A.N. as the device's digital assistant in Android settings.
5. Enable G.U.H.A.N.'s Accessibility Service manually only if you want the optional visible-text/global navigation automation.

## V16 AI server
The agent uses Vercel AI SDK's `ToolLoopAgent` with GPT-5.6 Sol and an 8-step tool loop. If `EXA_API_KEY` is configured, it also gets real-time web research through Exa. Without that key, the agent can still hand off browser searches to Android.

The server key stays on the server; it is never embedded in the Android app.

## Safety model
Consequential actions are returned as `confirmation: required`. The Android client asks before executing those actions. The app does not silently send messages, place calls, purchase, order, request rides, delete data, or bypass permissions/authentication/payment/age/safety controls.


## V16
- Persistent local conversation history across app restarts.
- User-controlled persistent memory with explicit remember/forget commands.
- Streaming AI responses through `/api/stream`.
- Android device context: battery/charging, network availability, locale/timezone, screen dimensions, assistant state, accessibility state.
- Device context is sent only when the AI request is made and does not include precise location or the contents of other apps.

## V13 — Visible Voice Session

V13 adds a user-controlled Android foreground voice-session coordinator. Starting voice mode shows a visible G.U.H.A.N. notification with a Stop action. The implementation uses Android's bounded `shortService` foreground-service type and does not run a hidden always-on microphone.

The voice session starts when the user explicitly taps the microphone or invokes the assistant, and stops when speech recognition ends or the user stops it from the notification.


## V16 Unified Command Center
Voice, typed chat, system-assistant invocation, memory, tools, confirmations, and Android actions now pass through a single client command queue. Consequential actions remain confirmation-gated, and command state is surfaced as received, pending, approved/cancelled, or failed.
