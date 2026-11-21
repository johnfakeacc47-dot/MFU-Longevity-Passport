// Single source of truth for the app's (state-based) routes. Existing keys are
// unchanged; `coach` and `ai-report` are new screens from ui_ref2.
export type PageType =
  | 'login' | 'home'
  | 'eating' | 'eating-food-log' | 'eating-macros' | 'eating-water' | 'eating-schedule' | 'eating-history'
  | 'dashboard' | 'ai-report' | 'coach'
  | 'team'
  | 'profile' | 'edit-profile' | 'activity' | 'sleep' | 'mental-health'
  | 'user-management' | 'privacy-settings' | 'set-goals'
  | 'about-tracker' | 'about-garden' | 'about-us' | 'settings';
