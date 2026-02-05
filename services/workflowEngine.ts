
import { App, Component } from '../types/schema';
import { getAppById, proxyRequest, proxyStreamRequest } from './storage';

export interface ExecutionResult {
    success: boolean;
    data?: any;
    error?: string;
    duration: number;
    headers?: any;
}

// --- CONFIGURATION ---
const ENABLE_MOCK_MODE = false; 

// --- HELPERS ---

export const mergeParameters = (component: Component, userInputs: Record<string, any>): Record<string, any> => {
    const merged: Record<string, any> = {};
    component.parameters.forEach(p => {
        if (userInputs[p.key] !== undefined && userInputs[p.key] !== null) {
            merged[p.key] = userInputs[p.key];
        } else if (p.value !== undefined && p.value !== null) {
            merged[p.key] = String(p.value);
        } else {
            merged[p.key] = "";
        }
    });
    return merged;
};

// Simple string replacement (For URLs, Headers)
export const interpolateString = (template: string, values: Record<string, any>): string => {
    if (!template) return '';
    let result = template;
    Object.keys(values).forEach(key => {
        const safeKey = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const regex = new RegExp(`{{\\s*${safeKey}\\s*}}`, 'g');
        const val = values[key];
        
        const replacement = (typeof val === 'object' && val !== null) ? JSON.stringify(val) : String(val ?? '');
        result = result.replace(regex, replacement);
    });
    return result;
};

// Robust JSON Interpolation with Object Substitution
const interpolateJSON = (templateStr: string, values: Record<string, any>): string => {
    try {
        const root = JSON.parse(templateStr);

        const walk = (node: any): any => {
            if (typeof node === 'string') {
                // Exact Match Substitution (e.g. "{{$messages}}")
                const exactMatch = node.match(/^\s*{{\s*([a-zA-Z0-9-_$]+)\s*}}\s*$/);
                if (exactMatch) {
                    const key = exactMatch[1];
                    if (values[key] !== undefined) {
                        return values[key]; 
                    }
                }
                return interpolateString(node, values);
            } else if (Array.isArray(node)) {
                return node.map(walk);
            } else if (node !== null && typeof node === 'object') {
                const newObj: any = {};
                for (const key in node) {
                    newObj[key] = walk(node[key]);
                }
                return newObj;
            }
            return node;
        };

        const processed = walk(root);
        return JSON.stringify(processed);
    } catch (e) {
        console.warn("InterpolateJSON failed to parse template, falling back to string replacement", e);
        return interpolateString(templateStr, values);
    }
};

// --- EXECUTION LOGIC ---

export const executeComponent = async (
    component: Component, 
    inputs: Record<string, any>,
    context: Record<string, any> = {},
    onStream?: (partialData: string) => void
): Promise<ExecutionResult> => {
    const startTime = Date.now();
    
    // Merge inputs
    const mergedInputs = { ...mergeParameters(component, inputs), ...context };

    // --- MOCK MODE ---
    if (ENABLE_MOCK_MODE) {
        await new Promise(r => setTimeout(r, 1000));
        return { success: true, data: { text: "Mock Data" }, duration: 1000 };
    }

    // --- REAL MODE ---
    try {
        const { url, method, headers, bodyTemplate, bodyType, stream } = component.apiConfig;

        // 1. Interpolate
        const finalUrl = interpolateString(url, mergedInputs);
        const finalHeaders: Record<string, string> = {};
        headers.forEach(h => {
            if (h.key) finalHeaders[h.key] = interpolateString(h.value, mergedInputs);
        });

        let finalBody = "";
        if (method !== 'GET') {
            if (bodyType === 'json' && bodyTemplate) {
                finalBody = interpolateJSON(bodyTemplate, mergedInputs);
            } else if (bodyType === 'form-data' && bodyTemplate) {
                try {
                    const parsed = JSON.parse(bodyTemplate);
                    const entries: {key: string, value: string}[] = Array.isArray(parsed) ? parsed : [];
                    const interpolatedEntries = entries.map(entry => ({
                        key: entry.key,
                        value: interpolateString(entry.value, mergedInputs) 
                    }));
                    finalBody = JSON.stringify(interpolatedEntries);
                    finalHeaders['Content-Type'] = 'multipart/form-data';
                } catch (e) {
                     throw new Error("Invalid Form Data configuration.");
                }
            }
        }

        // 4. Call Backend (Stream vs Standard)
        let bodyData: any;
        let responseHeaders: any;

        if (stream && onStream) {
            // STREAMING EXECUTION
            let fullRawText = "";
            let sseAccumulator = ""; 
            
            // SSE Parsing Buffer State
            let streamBuffer = ""; 
            
            await proxyStreamRequest(method, finalUrl, finalHeaders, finalBody, (chunk) => {
                fullRawText += chunk;
                streamBuffer += chunk;

                // Simple Heuristic: If it starts with "data:", treat as SSE
                // We check the accumulated buffer start or if we have already successfully extracted SSE data
                const isSSE = streamBuffer.trimStart().startsWith('data:') || sseAccumulator.length > 0;

                if (isSSE) {
                    // Process complete lines only
                    const lines = streamBuffer.split('\n');
                    // Save the last line back to buffer (it might be incomplete)
                    streamBuffer = lines.pop() || "";

                    for (const line of lines) {
                        const trimmed = line.trim();
                        if (trimmed.startsWith('data: ') && trimmed !== 'data: [DONE]') {
                            try {
                                const jsonStr = trimmed.substring(6);
                                const json = JSON.parse(jsonStr);
                                
                                let content = "";
                                // Standard OpenAI/Compatible Formats
                                if (json.choices?.[0]?.delta?.content) content = json.choices[0].delta.content;
                                else if (json.content) content = json.content;
                                else if (json.response) content = json.response; // Ollama

                                if (content) {
                                    sseAccumulator += content;
                                    onStream(sseAccumulator);
                                }
                            } catch (e) {
                                // Ignore json parse errors for individual lines (keep stream alive)
                            }
                        }
                    }
                } else {
                    // Raw Streaming (e.g. standard chunks) - Just pass through
                    // If it's not SSE, we assume the full raw text is the content
                    onStream(fullRawText);
                }
            });

            // Final Result Determination
            if (sseAccumulator) {
                bodyData = sseAccumulator;
            } else {
                try {
                    // FIX: trim() before checking for JSON
                    if (fullRawText.trim().startsWith('{') || fullRawText.trim().startsWith('[')) {
                        bodyData = JSON.parse(fullRawText);
                    } else {
                        bodyData = fullRawText;
                    }
                } catch(e) { bodyData = fullRawText; }
            }

        } else {
            // STANDARD EXECUTION
            const response = await proxyRequest(method, finalUrl, finalHeaders, finalBody);
            
            if (!response.success) {
                throw new Error(response.error || `HTTP ${response.status} Error`);
            }

            bodyData = response.body;
            responseHeaders = response.headers;

            try {
                // FIX: trim() before checking for JSON
                if (bodyData && (bodyData.trim().startsWith('{') || bodyData.trim().startsWith('['))) {
                    bodyData = JSON.parse(bodyData);
                }
            } catch (e) { /* ignore */ }

            if (response.status >= 400) {
                throw new Error(`HTTP ${response.status}: ${typeof bodyData === 'string' ? bodyData : JSON.stringify(bodyData)}`);
            }
        }

        return {
            success: true,
            data: bodyData,
            duration: Date.now() - startTime,
            headers: responseHeaders
        };

    } catch (e: any) {
        return {
            success: false,
            error: e.message,
            duration: Date.now() - startTime
        };
    }
};

export const executeApp = async (
    appId: string,
    userInputs: Record<string, Record<string, any>>, 
    onStepUpdate?: (componentId: string, status: 'running' | 'success' | 'error', result?: any, error?: string) => void,
    context: Record<string, any> = {}
): Promise<void> => {
    
    const app = await getAppById(appId);
    if (!app) throw new Error(`App ${appId} not found`);

    const pipelineContext: Record<string, any> = {};

    for (const comp of app.components) {
        onStepUpdate?.(comp.id, 'running', undefined);

        try {
            const stepInputs = { ...(userInputs[comp.id] || {}) };

            // Logic: Replace {{stepID.response}} with actual data
            Object.keys(stepInputs).forEach(key => {
                let val = stepInputs[key];
                if (typeof val === 'string') {
                    const exactRefMatch = val.match(/^\s*{{([a-zA-Z0-9-_]+)\.response}}\s*$/);
                    if (exactRefMatch) {
                        const refId = exactRefMatch[1];
                        if (pipelineContext[refId] !== undefined) {
                            stepInputs[key] = pipelineContext[refId];
                            return; 
                        }
                    }

                    val = val.replace(/{{([a-zA-Z0-9-_]+)\.response}}/g, (match, refId) => {
                        const refData = pipelineContext[refId];
                        if (refData === undefined) return ''; 
                        if (typeof refData === 'object') return JSON.stringify(refData);
                        return String(refData);
                    });
                    stepInputs[key] = val;
                }
            });

            // Handle Stream Callback
            const handleStream = (partialData: string) => {
                // We update the 'running' status with partial result
                onStepUpdate?.(comp.id, 'running', partialData);
            };

            const result = await executeComponent(comp, stepInputs, context, handleStream);

            if (result.success) {
                pipelineContext[comp.id] = result.data;
                onStepUpdate?.(comp.id, 'success', result.data);
            } else {
                onStepUpdate?.(comp.id, 'error', undefined, result.error);
                break; 
            }

        } catch (e: any) {
            onStepUpdate?.(comp.id, 'error', undefined, e.message);
            break;
        }
    }
};
