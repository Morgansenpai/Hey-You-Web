# Hey You Companion

A browser-based voice workspace built with Firebase Authentication and ElevenLabs text-to-speech.

## Deployment

Deploy this repository to **Vercel**. The static app is served from the repository root, and `api/text-to-speech.js` runs as a server-side function. A static-only host such as GitHub Pages cannot run this API function, so voice generation will not work there.

## Required environment variables

Set these in **Vercel → Project Settings → Environment Variables**. Never put these values in source files or commit them to Git.

- `ELEVENLABS_API_KEY`: a valid ElevenLabs API key.
- `FIREBASE_SERVICE_ACCOUNT_JSON`: the complete JSON contents of a Firebase service-account key for the same Firebase project used by the app.
- `ELEVENLABS_VOICE_ID` (optional): a voice ID. The app uses its existing default voice ID when this variable is omitted.

After setting the variables, redeploy the project. Keep the Firebase service-account JSON and ElevenLabs API key server-side only.

## Firebase setup

In the Firebase console, enable Email/Password under Authentication → Sign-in method, and add your deployed Vercel domain under Authentication → Settings → Authorized domains. Generate a service-account key from Project settings → Service accounts and paste its complete JSON into `FIREBASE_SERVICE_ACCOUNT_JSON`. Do not commit that JSON file.

## Security and data notes

- Voice requests are sent to the server endpoint, which verifies the Firebase ID token before calling ElevenLabs.
- The endpoint rejects scripts over 5,000 characters and applies a basic per-user in-memory request limit. Because serverless instances can scale independently, this limit is a guardrail rather than a durable global quota; configure persistent rate limiting for production billing protection.
- Drafts and recent scripts remain in browser local storage and are separated by signed-in user on that browser. They are not synced to the cloud.
- Password reset is available from the sign-in screen.
- Firebase client configuration in `index.html` is public web-app configuration, not a server credential. Restrict the Firebase API key in Google Cloud as appropriate for your deployed domains.

## Local development

Use a Vercel-compatible local runtime (for example, the Vercel CLI) to test both the static page and the `/api/text-to-speech` endpoint. The API function requires the same environment variables as deployment.
