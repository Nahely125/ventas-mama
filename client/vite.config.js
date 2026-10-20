import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// En desarrollo, las peticiones a /api y /imagenes van al servidor Express.
export default defineConfig({
    plugins: [react()],
    server: {
        port: 5173,
        proxy: {
            "/api": "http://localhost:3000",
            "/imagenes": "http://localhost:3000"
        }
    }
});
