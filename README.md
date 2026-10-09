## Firebase integration update

Firebase authentication, backend functions, private document storage and SMTP email outbox are now included. Live mode remains disabled until project setup is complete. See [BACKEND-SETUP.md](BACKEND-SETUP.md). Agency registration, Google sign-in and phone OTP are available in the account screens when configured.

# RCL Mumbai application portal — first implementation

Scope follows the application questionnaire; the broader CRM SRS is context only. Intake months July and October were confirmed in chat. Intake years and deadlines remain unspecified.

## Run
Requires Node.js. No package installation.
```
npm start
npm test
```
Open http://127.0.0.1:4173 for the agent preview, /#apply for the direct form, or /#login for the agency-access placeholder.

## Implemented
- Responsive agency overview, application list, search, status/intake filters and CSV export.
- Five-step B2B and direct application forms for three approved programmes.
- Age 18+ validation; India/Nepal residence; education and conviction declarations.
- Mandatory passport, certificates, transcripts; conditional English, work experience and SOP evidence.
- PDF/JPEG/PNG upload with size/type/signature checks, browser-persisted files, replacement version metadata.
- Agent drafts, independent application references, duplicate submission checks.
- Status history, document centre, sample offers and plan downloads, local message drafts.
- One-time direct submission confirmation and downloadable test receipt; no student account.
- Consent capture with optional marketing consent.
- HTML escaping and CSV formula escaping.

## Explicit preview boundaries
This is a functional browser-local frontend, not a production admissions system. IndexedDB stores test entries/files on this device. Sample records are fictional. No actual lead is created, no recruiter receives messages, and no email or payment is sent. Private Sites access protects the hosted review link, but is NOT agency authentication or record-level authorisation. Do not use real applicant data.

Production needs server-backed relational records and private object storage; individual agency accounts; server-side agency scoping and validation; virus scanning; immutable audit events; retention/deletion controls; duplicate/idempotency handling; delivery retries and real CRM/email connections. Browser history is demonstrative, not an immutable audit log. Removing a document reference retains its existing blob; production retention rules are not implemented. IndexedDB draft quota limits and device clearing can remove test data.

Live offers, official letters, fees and payment plans must come from Admissions/Finance; sample download files have no official status. Intake years/deadlines, exact programme-specific evidence rules, fee values, templates, policies, authorised agencies and recruiter mappings remain to be supplied. Authentication UI deliberately does not collect credentials before a real identity service exists.

## Intended integration contracts
- Direct submission: create student/application + Direct Lead, assign Direct Team Lead, acknowledge via approved email; the lead assigns one of four recruiters.
- Agency submission: authenticate agency, derive agency/recruiter on server, create linked B2B Lead and application.
- Eligibility/documents: Admissions role verifies and returns visible remarks.
- Registration payment: Admissions confirmation gates conditional-offer release.
- Recruiter selects payment plan after offer; enrolment follows payment completion as required.
- Expose only agency-authorised status, remarks, notifications and downloadable documents.

## Deferred CRM scope
Lead distribution screens, admissions decision workspace, finance reconciliation, agent commission, marketing, visa/compliance, and management analytics are not built.

## Source
dist/index.html, dist/styles.css, dist/app.js, dist/domain.js are the buildless site. server.mjs is a loopback-only local preview server. tests/domain.test.js verifies business-rule boundaries.
