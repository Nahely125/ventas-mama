// Datos para cobrar. Para cambiarlos, edita este archivo y vuelve a compilar.

export const BILLETERAS = {
    yape: {
        nombre: "Yape",
        icono: "💜",
        qr: "/imagenes/qr-yape.png",
        aplicacion: "Yape"
    },
    plin: {
        nombre: "Plin",
        icono: "💚",
        qr: "/imagenes/qr-plin.png",
        aplicacion: "Plin o la app de tu banco"
    }
};

export const CUENTAS_BANCARIAS = [
    {
        banco: "BCP",
        moneda: "Soles",
        cuenta: "19105552991080",
        cci: "00219110555299108057"
    }
];

// Recargo por pagar con tarjeta en el POS de Izipay (lo que cobra Izipay), en %.
export const RECARGO_TARJETA = 5;

// Lo que se marca en el POS: el total más el recargo, redondeado al céntimo.
export function cobroConTarjeta(total) {
    const base = Number(total) || 0;
    const recargo = Math.round(base * RECARGO_TARJETA) / 100;
    return { base, recargo, cobrar: Math.round((base + recargo) * 100) / 100 };
}

// WhatsApp del negocio (con código de país 51): recibe los pedidos del catálogo.
export const WHATSAPP_NEGOCIO = "51904979273";
