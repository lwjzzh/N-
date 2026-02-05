
package main

import (
	"bufio"
	"bytes"
	"context"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"io"
	"mime/multipart"
	"net/http"
	"net/textproto"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"time"

	"github.com/wailsapp/wails/v2/pkg/runtime"
)

// App struct
type App struct {
	ctx        context.Context
	dataDir    string
	sessionDir string
	client     *http.Client
	// Mutex to ensure thread safety during file writes (Prevent race conditions on Auto-Save)
	mu sync.Mutex
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

// FormDataEntry represents a field in the multipart request defined by frontend
type FormDataEntry struct {
	Key   string `json:"key"`
	Value string `json:"value"` // Can be plain text or Data URI (data:image/png;base64,...)
}

// NewApp creates a new App application struct
func NewApp() *App {
	configDir, err := os.UserConfigDir()
	if err != nil {
		configDir, _ = os.Getwd()
	}
	baseDir := filepath.Join(configDir, ".omniflow")
	dataDir := filepath.Join(baseDir, "apps")
	sessionDir := filepath.Join(baseDir, "sessions")

	return &App{
		dataDir:    dataDir,
		sessionDir: sessionDir,
		client: &http.Client{
			Timeout: 120 * time.Second, // Increased timeout for file uploads
		},
	}
}

func (a *App) startup(ctx context.Context) {
	a.ctx = ctx
	if err := os.MkdirAll(a.dataDir, 0755); err != nil {
		runtime.LogErrorf(a.ctx, "Failed to create apps directory: %v", err)
	}
	if err := os.MkdirAll(a.sessionDir, 0755); err != nil {
		runtime.LogErrorf(a.ctx, "Failed to create sessions directory: %v", err)
	}
}

// atomicWriteFile writes data to a temp file first, then renames it to the destination.
// This ensures the file is either fully written or not updated at all (prevents corruption).
func (a *App) atomicWriteFile(filename string, data []byte) error {
	a.mu.Lock()
	defer a.mu.Unlock()

	dir := filepath.Dir(filename)
	tmpFile, err := os.CreateTemp(dir, "tmp-*")
	if err != nil {
		return err
	}
	defer os.Remove(tmpFile.Name()) // Clean up if something fails before rename

	if _, err := tmpFile.Write(data); err != nil {
		tmpFile.Close()
		return err
	}
	if err := tmpFile.Close(); err != nil {
		return err
	}

	// Atomic rename
	return os.Rename(tmpFile.Name(), filename)
}

// --- App Management ---

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
	return a.atomicWriteFile(filePath, []byte(appJson))
}

func (a *App) GetApps() ([]string, error) {
	// Read operations typically don't need a lock unless we are worried about
	// reading a file *while* it's being renamed, but OS file systems handle that reasonably well.
	return a.readJsonFiles(a.dataDir)
}

func (a *App) DeleteApp(id string) error {
	a.mu.Lock()
	defer a.mu.Unlock()
	filePath := filepath.Join(a.dataDir, id+".json")
	return os.Remove(filePath)
}

// --- Session Management ---

func (a *App) SaveSession(sessionJson string) error {
	var partial struct {
		ID string `json:"id"`
	}
	if err := json.Unmarshal([]byte(sessionJson), &partial); err != nil {
		return fmt.Errorf("invalid json: %v", err)
	}
	if partial.ID == "" {
		return fmt.Errorf("session id is missing")
	}

	filePath := filepath.Join(a.sessionDir, partial.ID+".json")
	return a.atomicWriteFile(filePath, []byte(sessionJson))
}

func (a *App) GetSessions() ([]string, error) {
	return a.readJsonFiles(a.sessionDir)
}

func (a *App) DeleteSession(id string) error {
	a.mu.Lock()
	defer a.mu.Unlock()
	filePath := filepath.Join(a.sessionDir, id+".json")
	return os.Remove(filePath)
}

// Helper to read all json files in a dir
func (a *App) readJsonFiles(dir string) ([]string, error) {
	entries, err := os.ReadDir(dir)
	if err != nil {
		if os.IsNotExist(err) {
			return []string{}, nil
		}
		return nil, err
	}

	var results []string
	for _, entry := range entries {
		if !entry.IsDir() && strings.HasSuffix(entry.Name(), ".json") {
			content, err := os.ReadFile(filepath.Join(dir, entry.Name()))
			if err == nil {
				results = append(results, string(content))
			} else {
				runtime.LogErrorf(a.ctx, "Failed to read file %s: %v", entry.Name(), err)
			}
		}
	}
	return results, nil
}

// --- System Dialogs ---
func (a *App) SelectDirectory() (string, error) {
	return runtime.OpenDirectoryDialog(a.ctx, runtime.OpenDialogOptions{
		Title: "Select Save Directory",
	})
}

// --- Proxy Request ---

// prepareRequest handles body parsing and multipart setup shared by ProxyRequest and ProxyStreamRequest
func (a *App) prepareRequest(method string, urlStr string, headers map[string]string, bodyStr string) (*http.Request, error) {
	var bodyReader io.Reader
	var contentType string

	isMultipart := false
	for k, v := range headers {
		if strings.EqualFold(k, "Content-Type") && strings.Contains(strings.ToLower(v), "multipart/form-data") {
			isMultipart = true
			break
		}
	}

	if isMultipart {
		bodyBuffer := &bytes.Buffer{}
		writer := multipart.NewWriter(bodyBuffer)

		var entries []FormDataEntry
		if err := json.Unmarshal([]byte(bodyStr), &entries); err != nil {
			return nil, fmt.Errorf("failed to parse form data: %v", err)
		}

		for _, entry := range entries {
			if strings.HasPrefix(entry.Value, "data:") && strings.Contains(entry.Value, ";base64,") {
				parts := strings.SplitN(entry.Value, ",", 2)
				if len(parts) != 2 {
					continue
				}
				meta := parts[0]
				dataB64 := parts[1]
				
				mimeType := "application/octet-stream"
				if strings.Contains(meta, ":") && strings.Contains(meta, ";") {
					mimeType = strings.TrimSuffix(strings.Split(strings.Split(meta, ":")[1], ";")[0], "")
				}

				ext := "bin"
				if strings.Contains(mimeType, "/") {
					ext = strings.Split(mimeType, "/")[1]
				}
				filename := fmt.Sprintf("file_%s.%s", entry.Key, ext)

				h := make(textproto.MIMEHeader)
				h.Set("Content-Disposition", fmt.Sprintf(`form-data; name="%s"; filename="%s"`, entry.Key, filename))
				h.Set("Content-Type", mimeType)
				
				part, err := writer.CreatePart(h)
				if err != nil {
					return nil, err
				}

				decoded, err := base64.StdEncoding.DecodeString(dataB64)
				if err != nil {
					return nil, err
				}
				part.Write(decoded)
			} else {
				writer.WriteField(entry.Key, entry.Value)
			}
		}

		if err := writer.Close(); err != nil {
			return nil, err
		}

		bodyReader = bodyBuffer
		contentType = writer.FormDataContentType()
		delete(headers, "Content-Type") 
		delete(headers, "content-type")
	} else {
		if bodyStr != "" {
			bodyReader = strings.NewReader(bodyStr)
		}
	}

	req, err := http.NewRequest(method, urlStr, bodyReader)
	if err != nil {
		return nil, err
	}

	for k, v := range headers {
		req.Header.Set(k, v)
	}
	
	if isMultipart {
		req.Header.Set("Content-Type", contentType)
	}

	return req, nil
}

// ProxyRequest executes an HTTP request and waits for the full response.
func (a *App) ProxyRequest(method string, urlStr string, headers map[string]string, bodyStr string) ProxyResponse {
	req, err := a.prepareRequest(method, urlStr, headers, bodyStr)
	if err != nil {
		return ProxyResponse{Success: false, Error: err.Error()}
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

	respContentType := resp.Header.Get("Content-Type")
	bodyOutput := string(bodyBytes)
	
	if isBinaryContent(respContentType) {
		b64 := base64.StdEncoding.EncodeToString(bodyBytes)
		bodyOutput = fmt.Sprintf("data:%s;base64,%s", respContentType, b64)
	}

	return ProxyResponse{
		Success:    true,
		Status:     resp.StatusCode,
		StatusText: resp.Status,
		Headers:    respHeaders,
		Body:       bodyOutput,
	}
}

// ProxyStreamRequest executes an HTTP request and streams the response body via Wails Events.
// It uses a requestId to namespace the events: "stream:data:{id}", "stream:error:{id}", "stream:end:{id}"
func (a *App) ProxyStreamRequest(requestId string, method string, urlStr string, headers map[string]string, bodyStr string) {
	// Run in goroutine to not block the frontend call
	go func() {
		req, err := a.prepareRequest(method, urlStr, headers, bodyStr)
		if err != nil {
			runtime.EventsEmit(a.ctx, "stream:error:"+requestId, err.Error())
			return
		}

		resp, err := a.client.Do(req)
		if err != nil {
			runtime.EventsEmit(a.ctx, "stream:error:"+requestId, err.Error())
			return
		}
		defer resp.Body.Close()

		if resp.StatusCode >= 400 {
			bodyBytes, _ := io.ReadAll(resp.Body)
			runtime.EventsEmit(a.ctx, "stream:error:"+requestId, fmt.Sprintf("HTTP %d: %s", resp.StatusCode, string(bodyBytes)))
			return
		}

		reader := bufio.NewReader(resp.Body)
		buf := make([]byte, 1024) 

		for {
			n, err := reader.Read(buf)
			if n > 0 {
				// IMPORTANT: Encode to Base64 to safely transport binary or split-UTF8 chunks across Wails/JS bridge
				chunkB64 := base64.StdEncoding.EncodeToString(buf[:n])
				runtime.EventsEmit(a.ctx, "stream:data:"+requestId, chunkB64)
			}
			if err != nil {
				if err == io.EOF {
					break
				}
				runtime.EventsEmit(a.ctx, "stream:error:"+requestId, err.Error())
				return
			}
		}

		runtime.EventsEmit(a.ctx, "stream:end:"+requestId, "DONE")
	}()
}

func isBinaryContent(ct string) bool {
	ct = strings.ToLower(ct)
	return strings.Contains(ct, "image") || strings.Contains(ct, "audio") || strings.Contains(ct, "video") || strings.Contains(ct, "pdf") || strings.Contains(ct, "octet-stream")
}
