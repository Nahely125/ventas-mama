# Mil Deseos
This project was created to help my mother with the inventory.

App web (React + Express + PostgreSQL) para controlar inventario, ventas, gastos e inversión, con un catálogo público por secciones.

## Desarrollo local

```bash
npm install
cp .env.example .env      # completar los datos de la base de datos
npm run build             # compila el frontend (client/)
npm start                 # http://localhost:3000
```

Mientras programas el frontend, `npm run dev:client` abre Vite con recarga automática en http://localhost:5173.

La primera cuenta de jefe se crea con `node crear-jefe.js`. Los empleados se crean desde la app (sección Empleados).

- Estructura de la base de datos: [database/esquema.sql](database/esquema.sql). Al arrancar, el servidor agrega solo las tablas y columnas que falten.

## Publicar en internet

La app está en Render (configuración en [render.yaml](render.yaml)) con la base de datos en Neon. Cada `git push` a `develop` publica una nueva versión.
Variables necesarias: `DATABASE_URL`, `SESSION_SECRET` y `NODE_ENV=production`.
