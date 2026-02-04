import { App } from '../types/schema';

// Helper to access Wails backend
const getBackend = () => (window as any).go?.main?.App;

// Storage Logic (Hybrid: Backend > LocalStorage)
export const getApps = async (): Promise<App[]> => {
  try {
    const backend = getBackend();
    if (backend) {
      // Backend returns array of JSON strings
      const jsonList: string[] = await backend.GetApps();
      return jsonList.map(json => JSON.parse(json));
    }
    
    // Fallback
    const raw = localStorage.getItem('omniflow_apps_v2');
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    console.error("Failed to load apps:", e);
    return [];
  }
};

export const saveApp = async (app: App): Promise<void> => {
  try {
    const backend = getBackend();
    if (backend) {
      await backend.SaveApp(JSON.stringify(app));
      return;
    }

    // Fallback
    const apps = await getApps();
    const idx = apps.findIndex(a => a.id === app.id);
    if (idx >= 0) apps[idx] = app;
    else apps.push(app);
    localStorage.setItem('omniflow_apps_v2', JSON.stringify(apps));
  } catch (e) {
    console.error("Failed to save app:", e);
  }
};

export const deleteApp = async (id: string): Promise<void> => {
  try {
    const backend = getBackend();
    if (backend) {
      await backend.DeleteApp(id);
      return;
    }

    // Fallback
    const apps = await getApps();
    const newApps = apps.filter(a => a.id !== id);
    localStorage.setItem('omniflow_apps_v2', JSON.stringify(newApps));
  } catch (e) {
    console.error("Failed to delete app:", e);
  }
};

export const getAppById = async (id: string): Promise<App | undefined> => {
  const apps = await getApps();
  return apps.find(a => a.id === id);
};

// --- Backend Proxy Helper ---
export const proxyRequest = async (method: string, url: string, headers: Record<string, string>, body: string) => {
    const backend = getBackend();
    if (backend) {
        return await backend.ProxyRequest(method, url, headers, body);
    }
    throw new Error("Wails backend not connected.");
};