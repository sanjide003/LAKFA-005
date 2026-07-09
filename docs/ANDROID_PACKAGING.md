# Android Packaging Foundation

The Android app packages the existing `lakfa-erp` Firebase-backed PWA as a WebView wrapper. The source of truth remains the web app under `lakfa-erp/`; Gradle copies it into `app/src/main/assets/lakfa-erp` before builds.

## Package and version

- Application ID: `com.lakfa.erp`
- Version code: `8`
- Version name: `1.0.8`
- Web entry point: `file:///android_asset/lakfa-erp/index.html`

## WebView behavior

- JavaScript, DOM storage, image loading, and content access are enabled for Firebase web SDK usage.
- Local bundled assets are loaded from Android assets while Firebase/Auth/Firestore network calls use `INTERNET` permission.
- The Android back button first navigates WebView history; it closes the app only when no web history exists.
- File chooser support is enabled for image uploads used by company profile logo/signature fields.
- Cache mode is `LOAD_DEFAULT`; offline shell behavior comes from bundled Android assets and the web app service worker remains used for web/Vercel deployments.

## Release checklist

1. Run `node scripts/qa-audit.mjs`.
2. Run `./gradlew :app:assembleRelease` in an Android build environment with a valid keystore.
3. Verify Firebase Auth login for admin and investor accounts.
4. Verify Firestore role redirects: admin → manager, investor → investor dashboard.
5. Verify company profile image upload through Android file chooser.
6. Verify Android back button returns to the previous web page/tab before closing.
7. Verify Reports/Invoice print/export actions in an Android WebView-compatible flow.
8. Confirm `lakfa-erp` and `app/src/main/assets/lakfa-erp` are synced before release.

## Keystore environment variables

Release signing reads:

- `KEYSTORE_PATH`
- `STORE_PASSWORD`
- `KEY_PASSWORD`

Do not commit production keystores or passwords.
