const express = require("express");
const pool = require("../db");
const { requiereJefe } = require("../autenticacion");

/* Página web del catálogo: "¿Quiénes somos?", valores, información corporativa
   y promociones (cupón de primera compra y envío gratis). La edita el jefe. */
const router = express.Router();

// Textos iniciales: el jefe los cambia desde la app (Catálogo → Página web).
const TIENDA_INICIAL = {
    quienesSomos:
        "Mil Deseos es un negocio familiar que nació con un deseo sencillo: que cada celebración se viva con ilusión. " +
        "Elegimos con cariño adornos navideños, luces, árboles, útiles escolares y regalos para que tu casa, tu salón " +
        "o tu negocio luzcan como lo imaginaste, con precios por unidad, media docena y docena.",
    mision:
        "Hacer realidad los deseos de nuestros clientes con productos bonitos, de buena calidad y a precios justos, " +
        "atendiendo siempre con calidez y cercanía.",
    vision:
        "Ser la tienda de confianza de las familias y emprendedores para cada temporada del año.",
    valores: [
        { titulo: "Cercanía", texto: "Te atendemos como en familia: escuchamos lo que buscas y te ayudamos a elegir." },
        { titulo: "Calidad", texto: "Revisamos cada producto para que llegue a tus manos tal como lo ves en el catálogo." },
        { titulo: "Precios justos", texto: "Precios claros por unidad, media docena y docena, para comprar al por menor o por mayor." },
        { titulo: "Confianza", texto: "Cumplimos lo que ofrecemos y te confirmamos cada pedido antes de entregarlo." },
        { titulo: "Ilusión", texto: "Nos encanta ser parte de tus celebraciones y de los momentos especiales de tu familia." }
    ],
    empresa: {
        razonSocial: "",
        ruc: "",
        direccion: "",
        horario: "",
        telefono: "",
        correo: "",
        facebook: "",
        instagram: "",
        tiktok: ""
    },
    cupon: {
        activo: true,
        codigo: "BIENVENIDA20",
        porcentaje: 20,
        condiciones: "Válido solo para tu primera compra. No acumulable con otras promociones."
    },
    envio: {
        activo: true,
        gratisDesde: 600,
        condiciones: "Envío gratis en compras mayores a S/ 600 (después del descuento). Para montos menores, el costo del envío se coordina por WhatsApp."
    }
};

const LIMITE_TEXTO = 1200;
const LIMITE_CORTO = 150;

function texto(valor, limite = LIMITE_CORTO) {
    return typeof valor === "string" ? valor.trim().slice(0, limite) : "";
}

function esEnlace(valor) {
    return valor === "" || /^https:\/\/[^\s]+$/i.test(valor);
}

// Revisa y limpia lo que envía el jefe. Devuelve { datos } o { error }.
function validarTienda(cuerpo) {
    const empresa = cuerpo?.empresa ?? {};
    const cupon = cuerpo?.cupon ?? {};
    const envio = cuerpo?.envio ?? {};

    const datos = {
        quienesSomos: texto(cuerpo?.quienesSomos, LIMITE_TEXTO),
        mision: texto(cuerpo?.mision, LIMITE_TEXTO),
        vision: texto(cuerpo?.vision, LIMITE_TEXTO),
        valores: (Array.isArray(cuerpo?.valores) ? cuerpo.valores : [])
            .map((v) => ({ titulo: texto(v?.titulo, 60), texto: texto(v?.texto, 300) }))
            .filter((v) => v.titulo),
        empresa: {
            razonSocial: texto(empresa.razonSocial),
            ruc: texto(empresa.ruc, 11),
            direccion: texto(empresa.direccion, 200),
            horario: texto(empresa.horario),
            telefono: texto(empresa.telefono, 30),
            correo: texto(empresa.correo, 120),
            facebook: texto(empresa.facebook, 200),
            instagram: texto(empresa.instagram, 200),
            tiktok: texto(empresa.tiktok, 200)
        },
        cupon: {
            activo: cupon.activo === true,
            codigo: texto(cupon.codigo, 20).toUpperCase(),
            porcentaje: Number(cupon.porcentaje),
            condiciones: texto(cupon.condiciones, 300)
        },
        envio: {
            activo: envio.activo === true,
            gratisDesde: Number(envio.gratisDesde),
            condiciones: texto(envio.condiciones, 300)
        }
    };

    if (datos.valores.length > 8) {
        return { error: "Puedes poner hasta 8 valores." };
    }

    if (datos.empresa.ruc && !/^\d{11}$/.test(datos.empresa.ruc)) {
        return { error: "El RUC debe tener 11 números." };
    }

    if (datos.empresa.correo && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(datos.empresa.correo)) {
        return { error: "Revisa el correo: no parece válido." };
    }

    for (const red of ["facebook", "instagram", "tiktok"]) {
        if (!esEnlace(datos.empresa[red])) {
            return { error: `El enlace de ${red} debe empezar con https://` };
        }
    }

    if (!/^[A-Z0-9-]{3,20}$/.test(datos.cupon.codigo)) {
        return { error: "El código del cupón debe tener de 3 a 20 letras, números o guiones (sin espacios)." };
    }

    if (!Number.isInteger(datos.cupon.porcentaje) || datos.cupon.porcentaje < 1 || datos.cupon.porcentaje > 90) {
        return { error: "El descuento del cupón debe ser un número entero entre 1 y 90 (%)." };
    }

    if (!Number.isFinite(datos.envio.gratisDesde) || datos.envio.gratisDesde < 0 || datos.envio.gratisDesde > 100000) {
        return { error: "Escribe un monto válido para el envío gratis." };
    }

    datos.envio.gratisDesde = Number(datos.envio.gratisDesde.toFixed(2));
    return { datos };
}

// Datos guardados combinados con los iniciales (si falta algo, se usa lo inicial).
async function leerTienda() {
    const resultado = await pool.query(`SELECT datos FROM tienda WHERE id = 1`);
    const guardado = resultado.rows[0]?.datos ?? {};

    return {
        ...TIENDA_INICIAL,
        ...guardado,
        empresa: { ...TIENDA_INICIAL.empresa, ...guardado.empresa },
        cupon: { ...TIENDA_INICIAL.cupon, ...guardado.cupon },
        envio: { ...TIENDA_INICIAL.envio, ...guardado.envio }
    };
}

// Pública: la usa la página web del catálogo.
router.get("/", async (req, res) => {
    try {
        res.json(await leerTienda());
    } catch (error) {
        console.error("Error al leer la página web:", error.message);
        res.status(500).json({ error: "No se pudo cargar la información de la tienda." });
    }
});

router.put("/", requiereJefe, async (req, res) => {
    const { datos, error } = validarTienda(req.body);

    if (error) {
        return res.status(400).json({ error });
    }

    try {
        await pool.query(
            `INSERT INTO tienda (id, datos, actualizado) VALUES (1, $1, CURRENT_TIMESTAMP)
             ON CONFLICT (id) DO UPDATE SET datos = EXCLUDED.datos, actualizado = CURRENT_TIMESTAMP`,
            [datos]
        );
        res.json({ mensaje: "Página web guardada.", tienda: await leerTienda() });
    } catch (err) {
        console.error("Error al guardar la página web:", err.message);
        res.status(500).json({ error: "No se pudo guardar la página web." });
    }
});

module.exports = router;
