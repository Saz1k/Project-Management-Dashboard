import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      "/auth": "http://127.0.0.1:8000",
      "/boards": "http://127.0.0.1:8000",
      "/columns": "http://127.0.0.1:8000",
      "/tasks": "http://127.0.0.1:8000",
      "/comments": "http://127.0.0.1:8000",
      "/labels": "http://127.0.0.1:8000",
      "/checklist": "http://127.0.0.1:8000",
      "/invitations": "http://127.0.0.1:8000"
    }
  }
});
