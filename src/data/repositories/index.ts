export {
  createPreferencesRepository,
  migrateAndNormalize,
  DEFAULT_PREFERENCES,
  PREFERENCES_MIGRATIONS,
  PREFERENCES_SCHEMA_VERSION,
  type Preferences,
  type PreferencesRepository,
  type ThemePreference,
} from './preferencesRepository'

export {
  createOnboardingDraftRepository,
  migrateAndNormalizeDraft,
  ONBOARDING_DRAFT_MIGRATIONS,
  type OnboardingDraftRepository,
} from './onboardingDraftRepository'
