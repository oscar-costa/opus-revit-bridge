import { createServer } from "./server.js";

const port = Number.parseInt(process.env.PORT ?? "3781", 10);
const app = createServer();

app.listen(port, "127.0.0.1", () => {
  process.stderr.write(
    `[opus-revit-bridge] service listening on http://127.0.0.1:${port}\n`
  );
});
