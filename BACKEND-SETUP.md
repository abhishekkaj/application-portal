# Firebase activation

Code author: recorded in package metadata and Git commits, not in the frontend.

## Current status
Firebase code is prepared but disabled until a real project is configured. The GitHub Pages preview remains functional. No Firebase resources, phone SMS, user accounts or outgoing emails are created by this source change.

## New project
1. Create a project in https://console.firebase.google.com/ under the organisation's account. Choose and confirm the desired billing arrangement in the console; Cloud Functions, storage and SMS may require billing. Do not paste service-account JSON or passwords into chat.
2. Register a Web app. Copy its PUBLIC firebaseConfig to dist/firebase-config.js.
3. Enable Authentication: Email/Password, Google, Phone, and Anonymous (for the one-time direct form). Add abhishekkaj.github.io to authorised domains. Set the Google support email and approved SMS destination policy for India/Nepal. Use Firebase fictional phone numbers during testing.
4. Create Firestore and Cloud Storage in the organisation's approved region. Functions default to asia-south1; match the frontend region if changed.
5. Configure Firebase App Check with reCAPTCHA v3 for the web app; add its PUBLIC site key to firebase-config.js. All backend callables enforce App Check. Users must solve phone reCAPTCHA themselves.
6. Set the approved published privacy URL in firebase-config.js. Confirm provisional programme document requirements before receiving real applications.
7. Install Firebase CLI from the official npm package and log in locally. From this repository:
   - npm --prefix functions ci
   - firebase use --add (choose the newly created project)
   - firebase functions:secrets:set SMTP_PASSWORD
   - firebase deploy --only functions,firestore:rules,storage
8. Set server environment parameters SMTP_HOST, SMTP_PORT, SMTP_USER, MAIL_FROM. Sender is info@rclmumbai.com. A real mail provider/account and verified sender/domain are still required. Store SMTP_PASSWORD in Secret Manager, never frontend files.
9. Using an authorised service identity through Application Default Credentials, run node functions/admin.mjs configure. It enables the anonymous direct form, keeps agency approval required, and leaves student accounts and email disabled.
10. After mail service verification, set configuration/portal.emailEnabled=true in Firestore. Configure TTL on rateLimits.expiresAt. Review audit retention, backups, document malware scanning and monitoring before real admissions use.
11. Set enabled:true in dist/firebase-config.js after a deployed-project acceptance test. Commit only public web configuration. Publish dist to GitHub Pages again.

## Account policy
Default: approved agencies have accounts; direct students use Firebase anonymous sessions without a registration screen. Anonymous identities exist internally to protect their application/documents. This does not create a student password/login experience. Do not enable studentRegistrationEnabled until the business changes the earlier no-student-login requirement.

Email/password registrations require email verification. Google users have the provider's verified identity. Phone users prove possession by OTP. New agencies are pending, even after successful sign-in. Approval is a server operation:
node functions/admin.mjs approve-agent UID AGENCY_ID AGENCY_NAME RECRUITER_UID RECRUITER_NAME

Use a real agency/recruiter mapping. The client cannot choose or override the agency scope. No admin privileges are granted through signup.

## Backend contracts
- portalBootstrap: creates a server-owned profile with a restricted role.
- portalRecords: returns records for the authenticated scope only.
- portalSaveApplication: validates fields/documents, derives channel/ownership, deduplicates submission, writes application + audit + email outbox atomically.
- portalUpload / portalFile: server validation and scope checks, private storage without permanent download URLs; 10 MB per file.
- portalSendMessage: stores scoped application messages. A staff inbox/CRM adapter is a separate integration.
- deliverApplicationEmail: sends an acknowledgement through SMTP only when emailEnabled=true. Does not send attachments or sensitive disclosures.

Application records now persist server-side when enabled; preview IndexedDB records are not migrated or uploaded. CRM lead creation, staff workflow screens, offers/payments and enrolment integrations remain separate from the Firebase application repository.

## Email operations
Outbox states: pending, configuration_required, sending, sent, failed. Email failure does not discard a submitted application. Retry after configuration/review with node functions/admin.mjs retry-email JOB_ID. A sending job whose worker crashed requires manual reconciliation with the provider, to avoid duplicate messages. 'sent' means SMTP acceptance, not confirmed inbox delivery. Delivery/bounce webhooks depend on the eventual email service.

## Verification
- npm test: original application validation tests.
- npm --prefix functions test: server scope and field-sanitisation tests.
- Integration acceptance still requires an actual Firebase project or Emulator Suite with App Check testing configured.
- Test signup, verification, pending/approved agency access, Google popup, OTP failure/expiry, guest direct submission, cross-agency denial, private files, duplicate submission, mail success/failure, and sign-out.
- No real email or SMS is sent during local unit tests.

## Official references
https://firebase.google.com/docs/auth/web/phone-auth
https://firebase.google.com/docs/auth/web/google-signin
https://firebase.google.com/docs/functions/callable
https://firebase.google.com/docs/functions/config-env
