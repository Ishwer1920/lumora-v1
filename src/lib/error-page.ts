export function renderErrorPage(error?: unknown) {
  return `
    <html>
      <body style="background:#0B0F19;color:white;font-family:sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;">
        <div>
          <h1>Lumora Error</h1>
          <pre>${String(error ?? "Unknown Error")}</pre>
        </div>
      </body>
    </html>
  `;
}