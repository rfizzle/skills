# Outbound integrations

## Contents

- [Webhooks: sending](#webhooks-sending)
- [Webhooks: receiving](#webhooks-receiving)
- [Email](#email)
- [Object storage](#object-storage)

Every outbound side effect is a job (the outbox in SKILL.md), never a call
made inside a request or a database transaction. Each adapter lives in
`internal/platform/<capability>/` and is reached through a port the
consuming module declares (go-project-layout).

## Webhooks: sending

The model:

- An endpoint row per subscriber: id, URL, one or two secrets, the event
  types it wants, `disabled_at`. Secrets are 32 random bytes from
  `crypto/rand`, shown to the subscriber once, stored encrypted at rest
  (golang-security), never put in a job payload or a log.
- The business write enqueues one `webhooks.deliver` job per matching
  endpoint in its own transaction, with the event body snapshotted into the
  payload. Every attempt sends the same bytes; the event id inside the body
  is the receiver's dedup key.
- Signature: HMAC-SHA256 over `<unix timestamp>.<body>`, sent as
  `Webhook-Signature: t=<ts>,v1=<hex>`, plus `Webhook-Id: <event id>`. The
  timestamp is signed, so a receiver can refuse replays outside a window
  (5 minutes).
- Rotation: the endpoint holds a new and a previous secret; the sender
  signs with both (two `v1` entries) until the subscriber confirms the new
  one or 24 hours pass, then drops the old.
- Retries use the queue's backoff and `max_attempts`; then dead, and the
  subscriber's delivery log shows it. Several consecutive dead deliveries,
  or a 410, disable the endpoint and tell its owner; a disabled endpoint's
  queued jobs go dead at once.

```go
// Sign returns the Webhook-Signature value for body sent at t: the
// timestamp and one v1 entry per active secret, so a receiver holding
// either secret verifies during a rotation.
func Sign(body []byte, t time.Time, secrets [][]byte) string {
	ts := strconv.FormatInt(t.Unix(), 10)
	parts := []string{"t=" + ts}
	for _, s := range secrets {
		parts = append(parts, "v1="+hex.EncodeToString(mac(s, ts, body)))
	}
	return strings.Join(parts, ",")
}

// Verify checks a Webhook-Signature value against the raw body. It rejects
// a timestamp more than window from now, then accepts any v1 entry that
// matches any of the receiver's secrets.
func Verify(header string, body []byte, secrets [][]byte, now time.Time, window time.Duration) error {
	var ts string
	var sigs [][]byte
	for part := range strings.SplitSeq(header, ",") {
		k, v, _ := strings.Cut(strings.TrimSpace(part), "=")
		switch k {
		case "t":
			ts = v
		case "v1":
			if b, err := hex.DecodeString(v); err == nil {
				sigs = append(sigs, b)
			}
		}
	}
	sec, err := strconv.ParseInt(ts, 10, 64)
	if err != nil {
		return errors.New("webhook: missing or malformed timestamp")
	}
	if age := now.Sub(time.Unix(sec, 0)); age > window || age < -window {
		return errors.New("webhook: timestamp outside the replay window")
	}
	for _, s := range secrets {
		want := mac(s, ts, body)
		for _, got := range sigs {
			if hmac.Equal(got, want) {
				return nil
			}
		}
	}
	return errors.New("webhook: no valid signature")
}

func mac(secret []byte, ts string, body []byte) []byte {
	m := hmac.New(sha256.New, secret)
	m.Write([]byte(ts))
	m.Write([]byte("."))
	m.Write(body)
	return m.Sum(nil)
}
```

```go
// KindDeliver sends one event to one endpoint.
const KindDeliver = "webhooks.deliver"

// Delivery is the job payload. The body is the event as it was when the
// business write committed, so every attempt sends the same bytes.
type Delivery struct {
	EndpointID string `json:"endpointId"`
	EventID    string `json:"eventId"`
	Body       []byte `json:"body"`
}

type Endpoint struct {
	URL      string
	Secrets  [][]byte // the current secret, plus the previous one during a rotation
	Disabled bool
}

type endpointGetter interface {
	Endpoint(ctx context.Context, id string) (Endpoint, error)
}

type Deliverer struct {
	endpoints endpointGetter
	client    *http.Client // httpx.NewUserURLClient(15 * time.Second) in production; the test server's client in tests
	now       func() time.Time
}

func NewDeliverer(endpoints endpointGetter, client *http.Client, now func() time.Time) *Deliverer {
	return &Deliverer{endpoints: endpoints, client: client, now: now}
}

// Deliver posts one event. 2xx is done; 408, 429, 5xx and network errors
// retry; any other status, a redirect included, is permanent.
func (d *Deliverer) Deliver(ctx context.Context, job jobs.Job, p Delivery) error {
	ep, err := d.endpoints.Endpoint(ctx, p.EndpointID)
	if errors.Is(err, domain.ErrNotFound) {
		return jobs.Permanent(err)
	}
	if err != nil {
		return err
	}
	if ep.Disabled {
		return jobs.Permanent(fmt.Errorf("endpoint %s is disabled", p.EndpointID))
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, ep.URL, bytes.NewReader(p.Body))
	if err != nil {
		return jobs.Permanent(err)
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Webhook-Id", p.EventID)
	req.Header.Set("Webhook-Signature", Sign(p.Body, d.now(), ep.Secrets))

	resp, err := d.client.Do(req)
	if err != nil {
		return fmt.Errorf("deliver %s: %w", p.EventID, err)
	}
	defer resp.Body.Close()
	snippet, _ := io.ReadAll(io.LimitReader(resp.Body, 512))

	code := resp.StatusCode
	err = fmt.Errorf("deliver %s: status %d: %q", p.EventID, code, snippet)
	switch {
	case code >= 200 && code < 300:
		return nil
	case code == http.StatusRequestTimeout, code == http.StatusTooManyRequests, code >= 500:
		if s, perr := strconv.Atoi(resp.Header.Get("Retry-After")); perr == nil && s > 0 {
			return jobs.RetryAfter(err, time.Duration(s)*time.Second)
		}
		return err
	default:
		return jobs.Permanent(err)
	}
}

// The delivery client is go-http-server's NewUserURLClient (its
// streaming-and-clients reference): no proxy, no redirects, and a dialer
// that refuses loopback, private, link-local and CGNAT addresses after DNS.
```

SSRF: the subscriber chooses the URL, so the server is making requests on
an outsider's behalf. The rules are golang-security's (its injection
reference, SSRF section): `https` only, no user info, validated when the
endpoint is registered. Validation at registration is not enough on its own,
because DNS can change after it: `NewUserURLClient` checks the address
actually dialled, keeps the proxy off and never follows a redirect; either
one would send the request somewhere the guard never saw.

## Webhooks: receiving

For a provider that calls the service:

1. Cap the body with `http.MaxBytesReader` (1 MiB unless the provider
   documents more) and read it raw.
2. Verify the signature over the raw bytes before parsing, with the
   provider's scheme and a timestamp window; failure is 401 with no detail.
3. In one transaction, insert the provider's event id into a table with a
   unique constraint and enqueue a job to process it. A duplicate id is
   already handled: answer 200.
4. Answer 2xx at once. The processing is the job's work, so a slow
   downstream never makes the provider retry.

## Email

A port, an adapter per transport, and a job per message.

```go
// Message is what a module asks the platform to send.
type Message struct {
	To, Subject    string
	Text, HTML     string
	IdempotencyKey string // the job id; providers that support it drop a resend
}
```

- The consuming module declares `type mailer interface { Send(ctx
  context.Context, m email.Message) error }`. `internal/platform/email`
  provides the adapters; config chooses one (`EMAIL_TRANSPORT`).
- Dev sinks: `log` writes recipient, subject and the text body as one slog
  line; `dir` writes each message as an `.eml` file under a configured
  directory for a person to open. Both are refused at startup when the
  environment is production: a sign-in link in a log is a credential leak.
- The provider adapter speaks the provider's HTTP API (or SMTP with
  STARTTLS through `net/smtp` when that is all there is), with a client
  timeout, and maps its answer: accepted is done; an invalid address or a
  suppressed recipient is `jobs.Permanent`; 429, 5xx and network errors
  retry.
- The module enqueues `<module>.send_<what>` with ids in the payload and
  renders in the handler, from `html/template` and `text/template` files
  embedded with `//go:embed`. A value the email must show as it was at the
  moment of the write (a price, a one-time link) goes in the payload.
- At least once: a crash after the provider accepts and before the job
  completes sends the message twice unless the provider honours the
  idempotency key. That is the accepted cost; the handler's doc comment says
  so.

## Object storage

Files go between the browser and the bucket directly; the service signs
and checks.

1. Upload request: the client sends filename, content type and size. The
   service rejects a size over the limit or a type outside the allowlist
   for that use, creates an `uploads` row (`pending`, owner, declared size
   and type, original filename) and a key it generates
   (`uploads/<random id>`). The stored key is never a user-supplied path or
   filename.
2. It returns a presigned `PUT` URL valid for 15 minutes with the content
   type and length signed in, or a presigned `POST` policy with
   `content-length-range`, so the store refuses a different file.
3. Completion: the client reports the upload; the service `HEAD`s the
   object, requires the size and type to match the row, then enqueues a
   processing job (sniff the first bytes with `http.DetectContentType`,
   scan, derive thumbnails) that marks the row `ready`. Nothing serves the
   file before that.
4. Download: a presigned `GET` valid for minutes, with
   `response-content-disposition=attachment` and the original filename
   encoded by `mime.FormatMediaType`. User content is never served inline
   from the application's origin; an uploaded HTML or SVG file would run as
   the application.
5. A scheduled job deletes `pending` rows older than a day and their
   objects. The bucket is private, with CORS allowing `PUT` from the
   application's origin only.

Object-storage calls are network I/O: never inside a database transaction
(golang-database).
