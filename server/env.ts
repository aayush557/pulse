import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";

// Load .env with an explicit absolute path so Node v24's built-in
// dotenvx does not shadow the file and all env vars (including
// ANTHROPIC_API_KEY) are available before any other modules execute.
const __envFilename = fileURLToPath(import.meta.url);
const __envDirname = path.dirname(__envFilename);
dotenv.config({ path: path.resolve(__envDirname, "../.env"), override: true });
