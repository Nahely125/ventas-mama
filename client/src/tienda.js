import { useEffect, useState } from "react";
import { pedir } from "./api.js";
import { WHATSAPP_NEGOCIO } from "./datosPago.js";

const CLAVE_CUPON = "mil-deseos-cupon";

// Información de la página web (quiénes somos, valores, empresa, promociones).
export function useTienda() {
    const [tienda, setTienda] = useState(null);

    useEffect(() => {
        pedir("/api/tienda")
            .then(setTienda)
            .catch(() => setTienda(null));
    }, []);

    return tienda;
}

// Cupón que el cliente aplicó a su pedido (se recuerda en este navegador).
export function useCupon() {
    const [cupon, setCupon] = useState(() => {
        try {
            return localStorage.getItem(CLAVE_CUPON) ?? "";
        } catch {
            return "";
        }
    });

    function cambiar(codigo) {
        setCupon(codigo);
        try {
            if (codigo) localStorage.setItem(CLAVE_CUPON, codigo);
            else localStorage.removeItem(CLAVE_CUPON);
        } catch {
            // Sin almacenamiento: el cupón dura mientras la página esté abierta.
        }
    }

    return [cupon, cambiar];
}

// ¿El código escrito es el cupón vigente de la tienda?
export function cuponValido(tienda, codigo) {
    const cupon = tienda?.cupon;
    return Boolean(cupon?.activo && codigo && codigo.trim().toUpperCase() === cupon.codigo);
}

const redondear = (valor) => Math.round(valor * 100) / 100;

/* Totales del pedido: subtotal, descuento del cupón, total y envío gratis.
   El envío gratis se cuenta sobre el total ya con descuento ("compras mayores a S/ ..."). */
export function totalesPedido(subtotal, tienda, codigo) {
    const conCupon = cuponValido(tienda, codigo);
    const descuento = conCupon ? redondear((subtotal * tienda.cupon.porcentaje) / 100) : 0;
    const total = redondear(subtotal - descuento);
    const envio = tienda?.envio;
    const envioGratis = Boolean(envio?.activo && total > envio.gratisDesde);

    return {
        subtotal: redondear(subtotal),
        conCupon,
        descuento,
        total,
        envioActivo: Boolean(envio?.activo),
        envioGratis,
        faltaEnvio: envio?.activo && !envioGratis ? redondear(envio.gratisDesde - total) : 0
    };
}

// "51904979273" → "+51 904 979 273"
export function telefonoLegible(numero = WHATSAPP_NEGOCIO) {
    const digitos = String(numero).replace(/\D/g, "");
    return digitos.startsWith("51") && digitos.length === 11
        ? `+51 ${digitos.slice(2, 5)} ${digitos.slice(5, 8)} ${digitos.slice(8)}`
        : `+${digitos}`;
}

export function enlaceWhatsApp(mensaje) {
    return `https://wa.me/${WHATSAPP_NEGOCIO}${mensaje ? `?text=${encodeURIComponent(mensaje)}` : ""}`;
}
