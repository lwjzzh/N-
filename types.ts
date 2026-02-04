// Data Models - LEGACY (Deprecated, use types/schema.ts)
// Kept only for NavigationState compatibility with App.tsx

// Legacy App Configuration for services/storage.ts
export interface AppConfig {
  id: string;
  name: string;
  description: string;
  method: string;
  url: string;
  headers: { id: string; key: string; value: string }[];
  bodyType: string;
  bodyTemplate: string;
  inputs: { id: string; key: string; label: string; type: string; placeholder: string }[];
  createdAt: number;
}

// Navigation Types
export type ViewState = 'dashboard' | 'builder' | 'runner';

export interface NavigationState {
  view: ViewState;
  activeAppId?: string;
}