import { useState } from "react";
import { moneda } from "../api.js";
import { BILLETERAS, CUENTAS_BANCARIAS, RECARGO_TARJETA, cobroConTarjeta } from "../datosPago.js";

function BotonCopiar({ texto, etiqueta }) {
    const [copiado, setCopiado] = useState(false);

    async function copiar() {
        try {
            await navigator.clipboard.writeText(texto);
            setCopiado(true);
            setTimeout(() => setCopiado(false), 2000);
        } catch {
            alert(`No se pudo copiar. ${etiqueta}: ${texto}`);
        }
    }

    return (
        <button
            type="button"
            className="boton-copiar"
            onClick={copiar}
            aria-label={`Copiar ${etiqueta}`}
        >
            {copiado ? "✓ Copiado" : "Copiar"}
        </button>
    );
}

// Información para cobrar según el método de pago elegido.
export default function DatosPago({ metodoPago, total }) {
    const [qrFallido, setQrFallido] = useState({});

    const billetera = BILLETERAS[metodoPago];

    if (billetera) {
        return (
            <div className="contenedor-qr-yape" key={metodoPago}>
                <h3>{billetera.icono} Paga con {billetera.nombre}</h3>
                {qrFallido[metodoPago] ? (
                    <p>El código QR no está disponible. Pide al cliente que pague al número del negocio.</p>
                ) : (
                    <>
                        <p>Escanea este código QR con {billetera.aplicacion}.</p>
                        <img
                            src={billetera.qr}
                            alt={`Código QR de ${billetera.nombre} para realizar el pago`}
                            className="imagen-qr-yape"
                            onError={() => setQrFallido((anterior) => ({ ...anterior, [metodoPago]: true }))}
                        />
                    </>
                )}
                <p className="texto-qr-yape">
                    Importe a pagar: <strong>{moneda(total)}</strong>
                </p>
                <p className="ayuda-comprobante">Verifica el importe antes de confirmar el pago.</p>
            </div>
        );
    }

    if (metodoPago === "tarjeta") {
        const { base, recargo, cobrar } = cobroConTarjeta(total);

        return (
            <div className="contenedor-qr-yape aviso-tarjeta">
                <h3>💳 Cobra con el POS de Izipay</h3>
                <p className="monto-pos">
                    Marca en la maquinita
                    <strong>{moneda(cobrar)}</strong>
                </p>
                <dl className="detalle-recargo">
                    <div>
                        <dt>Total de la venta</dt>
                        <dd>{moneda(base)}</dd>
                    </div>
                    <div>
                        <dt>+ {RECARGO_TARJETA}% por pago con tarjeta (Izipay)</dt>
                        <dd>{moneda(recargo)}</dd>
                    </div>
                    <div className="total-pos">
                        <dt>Total a cobrar en el POS</dt>
                        <dd>{moneda(cobrar)}</dd>
                    </div>
                </dl>
                <p className="ayuda-comprobante">
                    Avísale al cliente antes de cobrar que con tarjeta se suma el {RECARGO_TARJETA}%. Entrega los productos
                    cuando el POS muestre el pago aprobado. La venta se guarda por {moneda(base)}: el {RECARGO_TARJETA}% es lo que se queda Izipay.
                </p>
            </div>
        );
    }

    if (metodoPago === "fiado") {
        return (
            <div className="contenedor-qr-yape aviso-fiado">
                <h3>📝 Venta fiada</h3>
                <p>
                    El cliente se lleva los productos ahora y paga después. Los <strong>{moneda(total)}</strong> se
                    suman a su deuda en «Clientes y fiados», donde podrás registrar sus pagos.
                </p>
            </div>
        );
    }

    if (metodoPago === "transferencia") {
        return (
            <div className="contenedor-qr-yape datos-transferencia">
                <h3>🏦 Paga por transferencia</h3>

                {CUENTAS_BANCARIAS.map((cuenta) => (
                    <dl className="cuenta-bancaria" key={cuenta.cuenta}>
                        <div className="cuenta-banco">
                            <dt>Banco</dt>
                            <dd>{cuenta.banco} · Cuenta en {cuenta.moneda}</dd>
                        </div>
                        <div>
                            <dt>Número de cuenta</dt>
                            <dd>
                                <span className="numero-cuenta">{cuenta.cuenta}</span>
                                <BotonCopiar texto={cuenta.cuenta} etiqueta="número de cuenta" />
                            </dd>
                        </div>
                        <div>
                            <dt>Cuenta interbancaria (CCI)</dt>
                            <dd>
                                <span className="numero-cuenta">{cuenta.cci}</span>
                                <BotonCopiar texto={cuenta.cci} etiqueta="cuenta interbancaria" />
                            </dd>
                        </div>
                    </dl>
                ))}

                <p className="texto-qr-yape">
                    Importe a pagar: <strong>{moneda(total)}</strong>
                </p>
                <p className="ayuda-comprobante">
                    Desde otro banco se usa el número interbancario (CCI). Confirma que el dinero llegó antes de entregar.
                </p>
            </div>
        );
    }

    return null;
}
