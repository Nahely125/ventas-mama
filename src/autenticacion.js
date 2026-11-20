const pool = require("./db");

/* Las cuentas se recuerdan un minuto: así cada clic no consulta la base solo para revisar
   que la cuenta siga activa. Al editar, desactivar o eliminar una cuenta se olvida al instante. */
const RECORDAR_CUENTA_MS = 60 * 1000;
const cuentasRecordadas = new Map(); // id → { cuenta, hasta }

function olvidarCuenta(id) {
    cuentasRecordadas.delete(Number(id));
}

async function leerCuenta(id) {
    const recordada = cuentasRecordadas.get(id);
    if (recordada && recordada.hasta > Date.now()) return recordada.cuenta;

    const resultado = await pool.query(
        `SELECT id, usuario, nombre, rol, activo
         FROM usuarios
         WHERE id = $1`,
        [id]
    );
    const cuenta = resultado.rows[0] ?? null;
    cuentasRecordadas.set(id, { cuenta, hasta: Date.now() + RECORDAR_CUENTA_MS });
    return cuenta;
}

async function usuarioVigente(req) {
    if (!req.session.usuario) {
        return null;
    }

    const cuenta = await leerCuenta(req.session.usuario.id);

    if (!cuenta || !cuenta.activo) {
        await new Promise((resolver) => req.session.destroy(resolver));
        return null;
    }

    req.session.usuario = {
        id: cuenta.id,
        usuario: cuenta.usuario,
        nombre: cuenta.nombre,
        rol: cuenta.rol
    };

    return req.session.usuario;
}

function crearVerificador(soloJefe) {
    return async (req, res, next) => {
        try {
            const usuario = await usuarioVigente(req);

            if (!usuario) {
                return res.status(401).json({
                    error: "Debes iniciar sesión para continuar."
                });
            }

            if (soloJefe && usuario.rol !== "jefe") {
                return res.status(403).json({
                    error: "No tienes permisos para realizar esta acción."
                });
            }

            next();
        } catch (error) {
            console.error("Error al verificar la sesión:", error.message);

            res.status(500).json({
                error: "No se pudo verificar la sesión."
            });
        }
    };
}

const requiereSesion = crearVerificador(false);
const requiereJefe = crearVerificador(true);

// Lee un ID numérico de la URL. Devuelve null si no es válido.
function leerId(req) {
    const id = Number(req.params.id);
    return Number.isInteger(id) && id > 0 ? id : null;
}

module.exports = { usuarioVigente, olvidarCuenta, requiereSesion, requiereJefe, leerId };
