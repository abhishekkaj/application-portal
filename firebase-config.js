// Public web configuration only. Never place service-account or mail secrets here.
export const portalConfig = Object.freeze({
  enabled: false,
  firebase: {apiKey:'', authDomain:'', projectId:'', storageBucket:'', messagingSenderId:'', appId:''},
  appCheckSiteKey: '',
  region: 'asia-south1',
  studentAccounts: false,
  privacyUrl: '',
});
