# HTTP Handler Testing

Use `httptest` package for testing HTTP handlers without starting a server.
Assert with the standard library: compare, then `t.Errorf` or `t.Fatalf` with the
request, the got value and the want value. Use `cmp.Diff` for structured bodies only when
`github.com/google/go-cmp` is already in `go.mod`; otherwise decode the body and compare
the fields the contract names.

## Basic Handler Test

```go
func TestCreateUserHandler(t *testing.T) {
    tests := []struct {
        name           string
        body           string
        expectedStatus int
    }{
        {
            name:           "valid request",
            body:           `{"name": "Alice", "email": "alice@example.com"}`,
            expectedStatus: http.StatusCreated,
        },
        {
            name:           "invalid JSON",
            body:           `invalid json`,
            expectedStatus: http.StatusBadRequest,
        },
    }

    for _, tt := range tests {
        t.Run(tt.name, func(t *testing.T) {
            req := httptest.NewRequest(http.MethodPost, "/users", strings.NewReader(tt.body))
            req.Header.Set("Content-Type", "application/json")

            w := httptest.NewRecorder()
            handler := http.HandlerFunc(CreateUserHandler)
            handler.ServeHTTP(w, req)

            if w.Code != tt.expectedStatus {
                t.Errorf("POST /users status = %d, want %d; body: %s", w.Code, tt.expectedStatus, w.Body)
            }
        })
    }
}
```

## Query Parameters and Headers

```go
func TestListUsersHandler(t *testing.T) {
    tests := []struct {
        name           string
        query          string
        authHeader     string
        expectedStatus int
    }{
        {
            name:           "paginated results",
            query:          "?page=1&limit=10",
            authHeader:     "Bearer token123",
            expectedStatus: http.StatusOK,
        },
        {
            name:           "missing auth",
            query:          "?page=1",
            authHeader:     "",
            expectedStatus: http.StatusUnauthorized,
        },
    }

    for _, tt := range tests {
        t.Run(tt.name, func(t *testing.T) {
            req := httptest.NewRequest(http.MethodGet, "/users"+tt.query, nil)
            if tt.authHeader != "" {
                req.Header.Set("Authorization", tt.authHeader)
            }

            w := httptest.NewRecorder()
            handler := AuthMiddleware(ListUsersHandler)
            handler.ServeHTTP(w, req)

            if w.Code != tt.expectedStatus {
                t.Errorf("GET /users%s status = %d, want %d", tt.query, w.Code, tt.expectedStatus)
            }
        })
    }
}
```
