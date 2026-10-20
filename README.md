# Ventas Mamá
This project was created to help my mother with the inventory.

App web (React + Express + PostgreSQL) para controlar inventario, ventas, gastos e inversión.

## Desarrollo local

```bash
npm install
cp .env.example .env      # completar los datos de la base de datos
npm run build             # compila el frontend (client/)
npm start                 # http://localhost:3000
```

Mientras programas el frontend, `npm run dev:client` abre Vite con recarga automática en http://localhost:5173.

- Estructura de la base de datos: [database/esquema.sql](database/esquema.sql)
- Publicar en internet: [DESPLIEGUE.md](DESPLIEGUE.md)
