import { SCOPES, type Scope } from "./scopes";

// Server-rendered pages for the authorization flow (H2). The order is
// consent → login: the seller first sees WHO is asking and WHAT they will be
// allowed to do, and only after clicking Allow is asked for credentials.
// Every form carries a single opaque `txn` id; the OAuth parameters live
// server-side in the pending-auth record, never in hidden fields.

export function escape(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

// ─── Shared chrome ────────────────────────────────────────────────────────────

const STYLES = `
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: "Public Sans", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      background: #f4f6f8; display: flex; align-items: center; justify-content: center;
      min-height: 100vh; color: #1c252e;
    }
    .card {
      background: #fff; border-radius: 16px; padding: 48px 40px 40px; width: 100%; max-width: 420px;
      box-shadow: 0 0 2px rgba(145,158,171,.2), 0 12px 24px -4px rgba(145,158,171,.12);
    }
    .logo { display: flex; align-items: center; margin-bottom: 20px; }
    .head { margin-bottom: 28px; }
    .head h1 { font-size: 22px; font-weight: 700; margin-bottom: 8px; line-height: 1.3; }
    .head p { font-size: 14px; color: #637381; }
    .head strong { color: #1c252e; }
    .alert-error {
      display: flex; align-items: flex-start; gap: 10px; font-size: 13.5px; color: #b71c1c;
      background: #fff5f5; border: 1px solid #ffcdd2; border-radius: 10px; padding: 12px 14px;
      margin-bottom: 20px; line-height: 1.45;
    }
    .client {
      display: flex; flex-direction: column; gap: 2px; padding: 12px 14px; margin-bottom: 20px;
      background: #f9fafb; border: 1px solid #e5e8eb; border-radius: 10px;
    }
    .client .name { font-weight: 700; font-size: 15px; }
    .client .host { font-size: 12.5px; color: #637381; word-break: break-all; }
    .perms { list-style: none; margin-bottom: 24px; }
    .perms li { display: flex; gap: 10px; align-items: flex-start; font-size: 14px; padding: 8px 0; border-top: 1px solid #f0f2f4; }
    .perms li:first-child { border-top: 0; }
    .perms .dot { width: 8px; height: 8px; border-radius: 50%; background: #e8642c; margin-top: 6px; flex-shrink: 0; }
    .field { margin-bottom: 20px; }
    .field label { display: block; font-size: 13px; font-weight: 600; color: #454f5b; margin-bottom: 6px; }
    .input-wrap { position: relative; }
    .input-wrap input {
      width: 100%; padding: 11px 42px 11px 14px; border: 1.5px solid #dde1e6; border-radius: 10px;
      font-size: 14px; color: #1c252e; background: #fff; outline: none; font-family: inherit;
      transition: border-color .15s, box-shadow .15s;
    }
    .input-wrap input::placeholder { color: #b0b8c1; }
    .input-wrap input:focus { border-color: #e8642c; box-shadow: 0 0 0 3px rgba(232,100,44,.12); }
    .input-wrap input[type=password]::-ms-reveal, .input-wrap input[type=password]::-ms-clear { display: none; }
    .toggle-pw {
      position: absolute; right: 10px; top: 50%; transform: translateY(-50%); background: none; border: none;
      cursor: pointer; padding: 4px; color: #919eab; display: flex; align-items: center; border-radius: 6px;
    }
    .toggle-pw:hover { color: #1c252e; }
    .actions { display: flex; gap: 10px; margin-top: 4px; }
    .btn { flex: 1; padding: 12px; border: none; border-radius: 10px; font-size: 15px; font-weight: 700; cursor: pointer; font-family: inherit; transition: background .15s, opacity .15s; }
    .btn-primary { background: #1c252e; color: #fff; }
    .btn-primary:hover { background: #2d3a45; }
    .btn-primary[disabled] { opacity: .6; cursor: not-allowed; }
    .btn-secondary { background: #f4f6f8; color: #1c252e; border: 1.5px solid #dde1e6; }
    .btn-secondary:hover { background: #e9edf1; }
    .fine { font-size: 12px; color: #919eab; margin-top: 16px; text-align: center; }
`;

const LOGO = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 854.34 189.9" height="36" aria-label="Shiprocket">
        <style>.st0{fill-rule:evenodd;clip-rule:evenodd;fill:#46237A;}.st1{fill:#18F040;}.st2{fill:#353535;}</style>
        <g><g>
          <path class="st0" d="M65.29,132.47l50.13-28.94c6.63-3.83,6.63-13.39,0-17.21L66.37,58c-8.82-5.09-15.74,1.6-15.74,8.13v57.59C50.63,130.66,57.94,136.24,65.29,132.47L65.29,132.47z M73.79,45.71l64.34,37.15c4.05,2.34,9.05,2.34,13.1,0l0.44-0.26c6.63-3.82,6.63-13.39,0-17.21L66.36,16.14c-7.7-4.94-15.74,0.84-15.74,8.13v0.96c0,1.78-1.92,2.89-3.46,2l-9.31-5.37c-0.86-0.49-1.31-1.48-1.12-2.45C39.91,3.13,58.74-5.5,73.78,3.85l85.07,49.12c16.13,9.31,16.18,32.57,0.17,41.98v0.01L57.61,153.5c-4.33,2.5-7,7.12-7,12.12l0,0c0,7.29,8.04,13.08,15.74,8.13l85.31-49.25c6.63-3.82,6.63-13.39,0-17.21l-0.83-0.48c-1.54-0.89-1.54-3.11,0-4l9.29-5.37c0.86-0.49,1.94-0.39,2.68,0.26c12.08,10.59,10.76,30.73-3.96,39.23l-85.07,49.11c-16.41,10.21-37.36-1.01-37.51-20.21l-0.01,0.01V47.74c0-4.41-2.35-8.48-6.16-10.68l0,0c-7.7-4.94-15.74,0.84-15.74,8.13v99.46c0,7.29,8.04,13.08,15.74,8.13l0,0c1.54-0.89,3.46,0.22,3.46,2v10.69c0,1-0.63,1.88-1.58,2.2C16.68,172.74,0,161.87,0,144.65V45.19C0,26.34,19.99,15.1,36.26,24.03C48.78,31.26,61.28,38.48,73.79,45.71z"/>
          <path class="st1" d="M63.82,113c0,2.69,2.96,4.82,5.8,3l31.45-18.15c2.44-1.41,2.44-4.94,0-6.35L69.62,73.35c-2.84-1.82-5.8,0.31-5.8,3V113z"/>
        </g><g>
          <path class="st2" d="M251.49,57.3l-13.11,7.77c-2.45-4.25-4.79-7.03-7.01-8.32c-2.31-1.48-5.29-2.22-8.95-2.22c-4.49,0-8.21,1.27-11.17,3.81c-2.96,2.5-4.44,5.64-4.44,9.43c0,5.23,3.88,9.43,11.65,12.62l10.68,4.37c8.69,3.51,15.05,7.8,19.07,12.87c4.02,5.06,6.03,11.27,6.03,18.62c0,9.85-3.28,17.99-9.85,24.41c-6.61,6.47-14.82,9.71-24.62,9.71c-9.29,0-16.97-2.75-23.03-8.25c-5.96-5.5-9.69-13.25-11.17-23.23l16.37-3.61c0.74,6.29,2.03,10.64,3.88,13.04c3.33,4.62,8.18,6.94,14.56,6.94c5.04,0,9.22-1.69,12.55-5.06c3.33-3.37,4.99-7.65,4.99-12.83c0-2.08-0.29-3.99-0.87-5.72s-1.48-3.33-2.7-4.79c-1.23-1.46-2.81-2.82-4.75-4.09s-4.25-2.48-6.94-3.64l-10.33-4.3c-14.66-6.2-21.99-15.26-21.99-27.19c0-8.05,3.07-14.77,9.22-20.18c6.15-5.46,13.8-8.18,22.96-8.18C234.92,39.27,244.56,45.28,251.49,57.3z"/>
          <path class="st2" d="M270.77,31.29h15.61V86.5c5.55-4.99,11.67-7.49,18.38-7.49c7.63,0,13.73,2.47,18.31,7.42c3.88,4.3,5.83,11.17,5.83,20.6v41.41h-15.61v-39.95c0-5.41-0.96-9.33-2.88-11.76s-5.01-3.64-9.26-3.64c-5.46,0-9.29,1.69-11.51,5.06c-2.17,3.42-3.26,9.29-3.26,17.62v32.67h-15.61L270.77,31.29L270.77,31.29z"/>
          <path class="st2" d="M346.3,52.79c0-2.73,0.99-5.09,2.98-7.07c1.99-1.99,4.37-2.98,7.14-2.98c2.82,0,5.22,0.99,7.21,2.98c1.99,1.94,2.98,4.32,2.98,7.14s-0.99,5.23-2.98,7.21c-1.94,1.99-4.32,2.98-7.14,2.98s-5.23-0.99-7.21-2.98C347.3,58.09,346.3,55.66,346.3,52.79z M364.26,80.88v67.55h-15.61V80.88H364.26z"/>
          <path class="st2" d="M399.64,185.2h-15.61V80.88h15.61v7.35c6.15-6.15,13.13-9.22,20.95-9.22c9.29,0,16.95,3.42,22.96,10.26c6.1,6.8,9.16,15.37,9.16,25.73c0,10.13-3.03,18.56-9.09,25.31c-6.01,6.7-13.59,10.06-22.75,10.06c-7.91,0-14.98-3.17-21.22-9.5V185.2H399.64z M436.74,115.08c0-6.47-1.76-11.74-5.27-15.81c-3.56-4.11-8.05-6.17-13.46-6.17c-5.73,0-10.38,1.99-13.94,5.96c-3.56,3.98-5.34,9.2-5.34,15.67c0,6.34,1.78,11.56,5.34,15.67c3.51,4.02,8.14,6.03,13.87,6.03c5.41,0,9.87-2.03,13.39-6.1C434.94,126.27,436.74,121.18,436.74,115.08z"/>
          <path class="st2" d="M469.2,80.88h15.61v6.03c2.87-3.01,5.41-5.06,7.63-6.17c2.26-1.16,4.95-1.73,8.05-1.73c4.11,0,8.41,1.34,12.9,4.02l-7.14,14.29c-2.96-2.13-5.85-3.19-8.67-3.19c-8.51,0-12.76,6.43-12.76,19.28v35.02H469.2V80.88H469.2z"/>
          <path class="st2" d="M517.89,114.17c0-9.76,3.49-18.06,10.47-24.9s15.49-10.26,25.52-10.26c10.08,0,18.63,3.45,25.66,10.33c6.94,6.89,10.4,15.35,10.4,25.38c0,10.13-3.49,18.61-10.47,25.45c-7.03,6.8-15.65,10.2-25.87,10.2c-10.13,0-18.61-3.47-25.45-10.4C521.31,133.13,517.89,124.53,517.89,114.17z M533.84,114.45c0,6.75,1.8,12.09,5.41,16.02c3.7,3.98,8.58,5.96,14.63,5.96c6.1,0,10.98-1.96,14.63-5.9c3.65-3.93,5.48-9.18,5.48-15.74c0-6.57-1.83-11.81-5.48-15.74c-3.7-3.98-8.58-5.96-14.63-5.96c-5.96,0-10.8,1.99-14.5,5.96C535.69,103.03,533.84,108.16,533.84,114.45z"/>
          <path class="st2" d="M659.03,83.8v20.74c-3.56-4.35-6.75-7.33-9.57-8.95c-2.77-1.66-6.03-2.5-9.78-2.5c-5.87,0-10.75,2.06-14.63,6.17c-3.88,4.12-5.83,9.27-5.83,15.47c0,6.34,1.87,11.54,5.62,15.61c3.79,4.07,8.62,6.1,14.5,6.1c3.75,0,7.05-0.81,9.92-2.43c2.77-1.57,6.03-4.62,9.78-9.16v20.6c-6.34,3.28-12.67,4.92-19,4.92c-10.45,0-19.19-3.37-26.22-10.13c-7.03-6.8-10.54-15.23-10.54-25.32c0-10.08,3.56-18.59,10.68-25.52c7.12-6.94,15.86-10.4,26.22-10.4C646.82,79.01,653.11,80.61,659.03,83.8z"/>
          <path class="st2" d="M693.43,31.29v71.44l21.99-21.85h20.95l-29.34,28.37l31.49,39.19h-20.25l-22.33-28.51l-2.5,2.5v26.01h-15.61V31.29H693.43z"/>
          <path class="st2" d="M807.8,118.34h-48.41c0.42,5.55,2.22,9.96,5.41,13.25c3.19,3.24,7.28,4.85,12.28,4.85c3.88,0,7.1-0.92,9.64-2.77c2.5-1.85,5.34-5.27,8.53-10.26l13.18,7.35c-2.04,3.47-4.19,6.44-6.45,8.91c-2.27,2.47-4.69,4.51-7.28,6.1c-2.59,1.6-5.39,2.76-8.39,3.5c-3.01,0.74-6.27,1.11-9.78,1.11c-10.08,0-18.17-3.24-24.27-9.71c-6.1-6.52-9.16-15.17-9.16-25.94c0-10.68,2.96-19.33,8.88-25.94c5.96-6.52,13.87-9.78,23.72-9.78c9.94,0,17.8,3.17,23.58,9.5c5.73,6.29,8.6,15,8.6,26.15L807.8,118.34z M791.78,105.57c-2.17-8.32-7.42-12.48-15.74-12.48c-1.9,0-3.68,0.29-5.34,0.87c-1.66,0.58-3.18,1.41-4.54,2.5s-2.53,2.39-3.5,3.92c-0.97,1.53-1.71,3.26-2.22,5.2h31.34V105.57z"/>
          <path class="st2" d="M842.2,95.45v52.99h-15.61V95.45h-6.66V80.88h6.66V56.12h15.61v24.76h12.14v14.56L842.2,95.45L842.2,95.45z"/>
        </g></g>
      </svg>`;

const ERROR_ICON = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink:0"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>`;

function shell(title: string, body: string, script = ""): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escape(title)}</title>
  <style>${STYLES}</style>
</head>
<body>
  <div class="card">
    <div class="logo">${LOGO}</div>
${body}
  </div>${script}
</body>
</html>`;
}

function alert(message?: string): string {
  return message ? `<div class="alert-error">${ERROR_ICON}<span>${escape(message)}</span></div>` : "";
}

function clientCard(clientName: string, redirectHost: string): string {
  return `    <div class="client">
      <span class="name">${escape(clientName)}</span>
      <span class="host">will receive access at ${escape(redirectHost)}</span>
    </div>`;
}

// ─── Consent page ─────────────────────────────────────────────────────────────

export interface ConsentPageParams {
  txn: string;
  clientName: string;
  redirectHost: string;
  scopes: Iterable<Scope>;
}

/** Step 1: who is asking, what they get, Allow / Deny. No credentials yet. */
export function consentPage({ txn, clientName, redirectHost, scopes }: ConsentPageParams): string {
  const perms = [...scopes]
    .map((s) => `      <li><span class="dot"></span><span>${escape(SCOPES[s])}</span></li>`)
    .join("\n");

  return shell(
    "Authorize access to Shiprocket",
    `    <div class="head">
      <h1>Authorize <strong>${escape(clientName)}</strong></h1>
      <p>This application is asking for permission to use your Shiprocket account.</p>
    </div>
${clientCard(clientName, redirectHost)}
    <ul class="perms">
${perms}
    </ul>
    <form method="POST" action="/oauth/consent">
      <input type="hidden" name="txn" value="${escape(txn)}" />
      <div class="actions">
        <button type="submit" class="btn btn-secondary" name="decision" value="deny">Deny</button>
        <button type="submit" class="btn btn-primary" name="decision" value="allow">Allow</button>
      </div>
    </form>
    <p class="fine">You will be asked to sign in to Shiprocket after clicking Allow.</p>`
  );
}

// ─── Login page ───────────────────────────────────────────────────────────────

export interface LoginPageParams {
  txn: string;
  clientName: string;
}

/** Step 2: credentials. Only reachable after consent; carries just the txn. */
export function loginPage({ txn, clientName }: LoginPageParams, error?: string): string {
  const script = `
  <script>
    (function () {
      var btn = document.getElementById('toggle-pw');
      var input = document.getElementById('password');
      var eyeOff = document.getElementById('icon-eye-off');
      var eye = document.getElementById('icon-eye');
      var visible = false;
      btn.addEventListener('click', function () {
        visible = !visible;
        input.type = visible ? 'text' : 'password';
        eyeOff.style.display = visible ? 'none' : '';
        eye.style.display = visible ? '' : 'none';
      });
    })();
    document.getElementById('login-form').addEventListener('submit', function () {
      var btn = document.getElementById('submit-btn');
      btn.disabled = true;
      btn.textContent = 'Signing in…';
    });
  </script>`;

  return shell(
    "Sign in to Shiprocket",
    `    <div class="head">
      <h1>Sign in to Shiprocket</h1>
      <p>to finish connecting <strong>${escape(clientName)}</strong></p>
    </div>
    ${alert(error)}
    <form method="POST" action="/oauth/authorize" id="login-form">
      <input type="hidden" name="txn" value="${escape(txn)}" />
      <div class="field">
        <label for="email">Email address</label>
        <div class="input-wrap">
          <input type="email" id="email" name="email" required autofocus placeholder="you@example.com" autocomplete="email" />
        </div>
      </div>
      <div class="field">
        <label for="password">Password</label>
        <div class="input-wrap">
          <input type="password" id="password" name="password" required placeholder="••••••••" autocomplete="current-password" />
          <button type="button" class="toggle-pw" id="toggle-pw" aria-label="Toggle password visibility">
            <svg id="icon-eye-off" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
            <svg id="icon-eye" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" style="display:none"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
          </button>
        </div>
      </div>
      <div class="actions">
        <button type="submit" class="btn btn-primary" id="submit-btn">Login</button>
      </div>
    </form>`,
    script
  );
}

// ─── Error page ───────────────────────────────────────────────────────────────

/** Terminal error (invalid client, bad redirect, expired txn). Never redirects. */
export function errorPage(message: string): string {
  return shell(
    "Something went wrong",
    `    <div class="head">
      <h1>Something went wrong</h1>
    </div>
    ${alert(message)}`
  );
}
