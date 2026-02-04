package main

import (
	"context"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/wailsapp/wails/v2/pkg/runtime"
)

// App struct
type App struct {
	ctx     context.Context
	dataDir string
	client  *http.Client
}

// ProxyResponse defines the structure returned to frontend
type ProxyResponse struct {
	Success    bool              `json:"success"`
	Status     int               `json:"status"`
	StatusText string            `json:"statusText"`
	Headers    map[string]string `json:"headers"`
	Body       string            `json:"body"`
	Error      string            `json:"error"`
}

// NewApp creates a new App application struct
func NewApp() *App {
	// Use user config directory for persistence
	configDir, err := os.UserConfigDir()
	if err != nil {
		configDir, _ = os.Getwd()
	}
	// Store data in ~/.omniflow/apps
	dataDir := filepath.Join(configDir, ".omniflow", "apps")

	return &App{
		dataDir: dataDir,
		client: &http.Client{
			Timeout: 60 * time.Second,
		},
	}
}

// startup is called when the app starts. The context is saved
// so we can call the runtime methods
func (a *App) startup(ctx context.Context) {
	a.ctx = ctx
	// Ensure data directory exists
	if err := os.MkdirAll(a.dataDir, 0755); err != nil {
		runtime.LogErrorf(a.ctx, "Failed to create data directory: %v", err)
	}
}

// SaveApp saves the app configuration to a JSON file
func (a *App) SaveApp(appJson string) error {
	var partial struct {
		ID string `json:"id"`
	}
	if err := json.Unmarshal([]byte(appJson), &partial); err != nil {
		return fmt.Errorf("invalid json: %v", err)
	}
	if partial.ID == "" {
		return fmt.Errorf("app id is missing")
	}

	filePath := filepath.Join(a.dataDir, partial.ID+".json")
	return os.WriteFile(filePath, []byte(appJson), 0644)
}

// GetApps returns a list of all saved apps as JSON strings
func (a *App) GetApps() ([]string, error) {
	entries, err := os.ReadDir(a.dataDir)
	if err != nil {
		if os.IsNotExist(err) {
			return []string{}, nil
		}
		return nil, err
	}

	var apps []string
	for _, entry := range entries {
		if !entry.IsDir() && strings.HasSuffix(entry.Name(), ".json") {
			content, err := os.ReadFile(filepath.Join(a.dataDir, entry.Name()))
			if err == nil {
				apps = append(apps, string(content))
			}
		}
	}
	return apps, nil
}

// DeleteApp deletes an app by ID
func (a *App) DeleteApp(id string) error {
	filePath := filepath.Join(a.dataDir, id+".json")
	return os.Remove(filePath)
}

// ProxyRequest executes an HTTP request from the backend to avoid CORS
func (a *App) ProxyRequest(method string, urlStr string, headers map[string]string, bodyStr string) ProxyResponse {
	var bodyReader io.Reader
	if bodyStr != "" {
		bodyReader = strings.NewReader(bodyStr)
	}

	req, err := http.NewRequest(method, urlStr, bodyReader)
	if err != nil {
		return ProxyResponse{Success: false, Error: err.Error()}
	}

	for k, v := range headers {
		req.Header.Set(k, v)
	}

	resp, err := a.client.Do(req)
	if err != nil {
		return ProxyResponse{Success: false, Error: err.Error()}
	}
	defer resp.Body.Close()

	bodyBytes, err := io.ReadAll(resp.Body)
	if err != nil {
		return ProxyResponse{Success: false, Status: resp.StatusCode, Error: err.Error()}
	}

	respHeaders := make(map[string]string)
	for k, v := range resp.Header {
		respHeaders[k] = strings.Join(v, ", ")
	}

	// Handle binary data (images, etc) by converting to Data URI if needed
	contentType := resp.Header.Get("Content-Type")
	bodyOutput := string(bodyBytes)
	
	// Simple check for binary content to base64 encode it
	if isBinaryContent(contentType) {
		b64 := base64.StdEncoding.EncodeToString(bodyBytes)
		bodyOutput = fmt.Sprintf("data:%s;base64,%s", contentType, b64)
	}

	return ProxyResponse{
		Success:    true,
		Status:     resp.StatusCode,
		StatusText: resp.Status,
		Headers:    respHeaders,
		Body:       bodyOutput,
	}
}

func isBinaryContent(ct string) bool {
	ct = strings.ToLower(ct)
	return strings.Contains(ct, "image") || strings.Contains(ct, "audio") || strings.Contains(ct, "video") || strings.Contains(ct, "pdf")
}