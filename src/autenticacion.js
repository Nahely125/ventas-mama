const pool = require("./db");

// Vuelve a leer el usuario de la base de datos en cada petición.
// Así, si el jefe desactiva o elimina a un empleado, su sesión deja de funcionar al instante.
async function usuarioVigente(req) {
    if (!req.session.usuario) {
        return null;
    }

    const resultado = await pool.query(
        `SELECT id, usuario, nombre, rol, activo
         FROM usuarios
         WHERE id = $1`,
        [req.session.usuario.id]
    );

    const cuenta = resultado.rows[0];

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

module.exports = { usuarioVigente, requiereSesion, requiereJefe, leerId };
