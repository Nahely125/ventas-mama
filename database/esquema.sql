-- =====================================================================
-- Ventas Mamá · Estructura de la base de datos (PostgreSQL 13 o superior)
--
-- Crear la base desde cero:
--   1) createdb -U postgres ventas_mama
--   2) psql -U postgres -d ventas_mama -f database/esquema.sql
--   3) Configurar .env (DB_HOST, DB_PORT, DB_NAME, DB_USER, DB_PASSWORD, SESSION_SECRET)
--   4) node crear-jefe.js      (crea la primera cuenta de jefe)
--
-- Es seguro ejecutarlo varias veces: todo usa IF NOT EXISTS.
-- El servidor (src/migraciones.js) además agrega al arrancar las columnas
-- nuevas a bases de datos creadas con versiones anteriores.
-- =====================================================================

BEGIN;

-- ---------------------------------------------------------------------
-- usuarios: cuentas que pueden iniciar sesión.
--   rol 'jefe'       → acceso completo (precios mínimos, costos, gastos, inversión, empleados)
--   rol 'trabajador' → registra ventas y consulta el inventario
--   activo = FALSE   → la cuenta no puede iniciar sesión (se conserva su historial)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS usuarios (
    id              SERIAL PRIMARY KEY,
    usuario         VARCHAR(50)  NOT NULL UNIQUE,
    nombre          VARCHAR(100) NOT NULL,
    password_hash   TEXT         NOT NULL,              -- bcrypt, nunca la contraseña en texto plano
    rol             VARCHAR(20)  NOT NULL CHECK (rol IN ('jefe', 'trabajador')),
    activo          BOOLEAN      NOT NULL DEFAULT TRUE,
    fecha_creacion  TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- ---------------------------------------------------------------------
-- productos: inventario.
--   precio_compra guarda el COSTO POR UNIDAD (el formulario recibe el costo
--   de la caja y el servidor lo divide entre unidades_por_caja).
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS productos (
    id                 SERIAL PRIMARY KEY,
    codigo             VARCHAR(50),
    nombre             VARCHAR(150)  NOT NULL,
    precio             NUMERIC(10,2) NOT NULL CHECK (precio >= 0),          -- precio de venta por unidad
    precio_minimo      NUMERIC(10,2) NOT NULL CHECK (precio_minimo >= 0),   -- no se puede vender por debajo
    precio_docena      NUMERIC(10,2) NOT NULL CHECK (precio_docena >= 0),   -- por defecto precio_minimo × 12
    precio_compra      NUMERIC(10,2) CHECK (precio_compra >= 0),            -- costo por unidad
    unidades_por_caja  INTEGER       NOT NULL DEFAULT 1 CHECK (unidades_por_caja >= 1),
    stock              INTEGER       NOT NULL CHECK (stock >= 0),           -- siempre en unidades
    CHECK (precio >= precio_minimo)
);

-- El código no se puede repetir (sin distinguir mayúsculas/minúsculas).
CREATE UNIQUE INDEX IF NOT EXISTS productos_codigo_unico
    ON productos (LOWER(codigo))
    WHERE codigo IS NOT NULL;

-- ---------------------------------------------------------------------
-- ventas: cada venta registrada.
--   cantidad siempre en UNIDADES (una venta de 2 docenas guarda 24).
--   costo_unitario es una copia del costo del producto al momento de vender,
--   para que la ganancia histórica no cambie si luego se edita el producto.
--   ganancia = total - costo_unitario × cantidad
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS ventas (
    id               SERIAL PRIMARY KEY,
    producto_id      INTEGER       NOT NULL REFERENCES productos(id),   -- impide borrar productos con ventas
    usuario_id       INTEGER       REFERENCES usuarios(id),             -- quién vendió
    cantidad         INTEGER       NOT NULL CHECK (cantidad > 0),
    modalidad        VARCHAR(10)   NOT NULL DEFAULT 'unidad',           -- 'unidad' o 'docena'
    precio_unitario  NUMERIC(10,2) NOT NULL CHECK (precio_unitario >= 0),
    costo_unitario   NUMERIC(10,2),
    total            NUMERIC(10,2) NOT NULL CHECK (total >= 0),
    metodo_pago      VARCHAR(20)   NOT NULL DEFAULT 'efectivo',         -- efectivo, yape, plin, transferencia
    comprobante_url  TEXT,                                              -- en desuso (antigua foto del comprobante)
    fecha            TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP   -- hora de Lima
);

CREATE INDEX IF NOT EXISTS ventas_fecha_idx ON ventas (fecha);

-- ---------------------------------------------------------------------
-- gastos: gastos del negocio (transporte, alquiler, etc.).
--   Se restan de la ganancia de las ventas para obtener la ganancia neta.
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS gastos (
    id           SERIAL PRIMARY KEY,
    descripcion  VARCHAR(200)  NOT NULL,
    categoria    VARCHAR(50)   NOT NULL,
    monto        NUMERIC(10,2) NOT NULL CHECK (monto > 0),
    fecha        DATE          NOT NULL,
    usuario_id   INTEGER       REFERENCES usuarios(id),
    creado_en    TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- ---------------------------------------------------------------------
-- inversiones: dinero puesto en el negocio.
--   Falta recuperar = inversión total - ganancia neta acumulada.
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS inversiones (
    id           SERIAL PRIMARY KEY,
    descripcion  VARCHAR(200)  NOT NULL,
    monto        NUMERIC(12,2) NOT NULL CHECK (monto > 0),
    fecha        DATE          NOT NULL,
    usuario_id   INTEGER       REFERENCES usuarios(id),
    creado_en    TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP
);

COMMIT;
