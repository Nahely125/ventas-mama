# Publicar Mil Deseos en internet

La app queda en internet con dos servicios que tienen plan gratuito:

- **Neon**: la base de datos PostgreSQL en la nube.
- **Render**: el servidor de la app. Se actualiza solo cada vez que subes cambios a la rama `develop` de GitHub.

Tiempo aproximado: 30 minutos.

---

## 1. Crear la base de datos en Neon

1. Entra a <https://neon.tech> y crea una cuenta. Puedes usar tu cuenta de GitHub.
2. Crea un proyecto:
   - **Project name**: `ventas-mama`
   - **Postgres version**: **18**, la misma versión que tienes en tu PC. Si no aparece, elige la más alta disponible.
   - **Region**: **AWS São Paulo (sa-east-1)**, la más cercana a Perú.
3. Al terminar, Neon muestra la **cadena de conexión** (*Connection string*). Tiene esta forma:

   ```
   postgresql://usuario:clave@ep-xxxx.sa-east-1.aws.neon.tech/neondb?sslmode=require
   ```

   Cópiala y guárdala en un lugar seguro. **No la publiques**: contiene la contraseña.

## 2. Copiar tus datos de la PC a Neon

Abre **PowerShell** en la carpeta del proyecto y ejecuta estos comandos.

**a) Sacar un respaldo de tu base local.** Te pedirá la contraseña de `postgres`:

```powershell
& "C:\Program Files\PostgreSQL\18\bin\pg_dump.exe" -U postgres -d ventas_mama -Fc --no-owner --no-privileges -f ventas_mama.dump
```

**b) Restaurar el respaldo en Neon.** Pega tu cadena de conexión entre las comillas:

```powershell
& "C:\Program Files\PostgreSQL\18\bin\pg_restore.exe" --no-owner --no-privileges -d "PEGA_AQUI_TU_CADENA_DE_NEON" ventas_mama.dump
```

**c) Comprobar que llegaron los datos:**

```powershell
& "C:\Program Files\PostgreSQL\18\bin\psql.exe" "PEGA_AQUI_TU_CADENA_DE_NEON" -c "SELECT count(*) AS productos FROM productos;"
```

El archivo `ventas_mama.dump` no se sube a GitHub, porque está en `.gitignore`. Puedes borrarlo cuando termines.

> A partir de aquí, **la base de datos real es la de Neon**. Si sigues registrando ventas en la app de tu PC, esas ventas no aparecerán en internet.

## 3. Publicar la app en Render

1. Entra a <https://render.com> y crea una cuenta **con GitHub**.
2. Haz clic en **New → Blueprint** y elige el repositorio `Nahely125/ventas-mama`, rama `develop`.
3. Render lee el archivo `render.yaml` del proyecto y te pide un valor:
   - **DATABASE_URL** → pega la cadena de conexión de Neon.

   `SESSION_SECRET` se genera sola y `NODE_ENV` ya viene configurada.
4. Haz clic en **Apply**. La primera vez tarda entre 3 y 5 minutos en instalar y compilar.
5. Cuando diga **Live**, tu app estará en una dirección parecida a:

   ```
   https://ventas-mama.onrender.com
   ```

Al arrancar, el servidor actualiza la estructura de la base de datos en Neon (columnas nuevas, tablas `gastos`, `inversiones` y `session`). No tienes que ejecutar nada más.

## 4. Probar

1. Abre la dirección desde el celular, con datos móviles o WiFi.
2. Inicia sesión con **el mismo usuario y contraseña de siempre**, porque los usuarios se copiaron con la base de datos.
3. Revisa que aparezcan tus productos y ventas.

**Tip:** en el celular, abre el menú del navegador → **"Agregar a pantalla de inicio"**. Así la app queda como un ícono más.

## 5. Antes de empezar a usarla, ten en cuenta

- **Plan gratuito de Render**: si nadie usa la app durante 15 minutos, se "duerme". La siguiente vez que alguien la abra tardará entre 30 y 60 segundos en cargar; después funciona normal. Para evitarlo, Render tiene un plan pagado de unos 7 USD al mes.
- **Plan gratuito de Neon**: incluye 0.5 GB, más que suficiente para años de ventas.
- **Actualizaciones**: cada `git push` a `develop` vuelve a publicar la app automáticamente.
- **Respaldos**: de vez en cuando saca un respaldo de Neon con el mismo `pg_dump` del paso 2a, cambiando `-U postgres -d ventas_mama` por tu cadena de conexión entre comillas.

## Código QR de Yape

El QR está en `public/imagenes/qr-yape.png` y se publica junto con la app. Para cambiarlo, reemplaza ese archivo (con el mismo nombre) y haz `git push`.

## Problemas comunes

| Síntoma | Solución |
|---|---|
| En Render sale `Falta la variable SESSION_SECRET` | En el servicio → **Environment**, agrega `SESSION_SECRET` con un texto largo y aleatorio. |
| `No se pudo actualizar la base de datos: ... certificate` | Agrega la variable `DB_SSL` con el valor `no-verificar`. |
| `pg_restore: error: unsupported version` | En Neon, elige la versión 18 de Postgres al crear el proyecto. |
| No puedo iniciar sesión en internet | Revisa que el paso 2 (copiar los datos) haya terminado sin errores: los usuarios están en la base de datos. |
