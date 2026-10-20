import { useState } from "react";
import { moneda } from "../api.js";
import { BILLETERAS, CUENTAS_BANCARIAS } from "../datosPago.js";

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
