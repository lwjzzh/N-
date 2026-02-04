// API Configuration Model
export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
export type BodyType = 'json' | 'form-data' | 'none';

export interface ApiHeader {
  id: string;
  key: string;
  value: string;
}

export interface ApiConfig {
  url: string;
  method: HttpMethod;
  headers: ApiHeader[]; // Changed from Record to Array for better UI editing
  bodyType: BodyType;
  bodyTemplate?: string; // JSON string with {{variable}} placeholders
}

// UI Field Model
export type FieldType = 'string' | 'number' | 'select' | 'file' | 'textarea' | 'password';

export interface UIField {
  id: string;
  key: string; // The variable name used in API template or logic
  label: string;
  type: FieldType;
  defaultValue?: any;
  placeholder?: string;
  options?: { label: string; value: string }[]; // For select type
  required?: boolean;
}

// Component Model (Encapsulates an API call and its UI)
export interface Component {
  id: string;
  name: string;
  description?: string;
  apiConfig: ApiConfig;
  inputFields: UIField[];
  outputMapping?: string; // Placeholder for future response handling logic
}

// Application Model (The top-level container)
export interface App {
  id: string;
  name: string;
  description: string;
  components: Component[];
  layoutConfig?: {
    direction: 'vertical' | 'horizontal';
    gap: number;
  };
  createdAt: number;
  updatedAt: number;
}
