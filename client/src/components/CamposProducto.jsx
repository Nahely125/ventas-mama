import { useCallback, useState } from "react";
import { calcularGanancias, porDocena, sumaColores, textoCostoUnitario } from "../producto.js";
import { moneda } from "../api.js";
import CampoFoto from "./CampoFoto.jsx";
import Escaner from "./Escaner.jsx";
import { iconoTema, useSecciones } from "../secciones.js";
import { sugerirCategoria } from "../categoriasAuto.js";

// Ganancia que deja cada precio (se actualiza mientras se escribe).
function ResumenGanancia({ ganancias, es2025 }) {
    if (!ganancias) {
        return <p className="ayuda-campo">Escribe el costo de compra para ver la ganancia de cada precio.</p>;
    }

    const filas = [
        { texto: "Por unidad", valor: ganancias.unidad, margen: ganancias.margenUnidad },
        { texto: "Al mínimo por unidad", valor: ganancias.minimo, margen: ganancias.margenMinimo },
        { texto: "Por unidad en la docena", valor: ganancias.unidadDocena, margen: ganancias.margenDocena },
        { texto: "Por docena (12 u.)", valor: ganancias.docena }
    ];

    const filasCaja = [
        { texto: "Por unidad", valor: ganancias.cajaUnidad },
        { texto: "Al mínimo por unidad", valor: ganancias.cajaMinimo },
        { texto: "Por docenas", valor: ganancias.cajaDocena }
    ];

    const lista = (items, clase) => (
        <dl className={clase}>
            {items.map((fila) => (
                <div key={fila.texto} className={fila.valor !== null && fila.valor < 0 ? "perdida" : ""}>
                    <dt>{fila.texto}</dt>
                    <dd>
                        {fila.valor === null ? "—" : moneda(fila.valor)}
                        {fila.margen != null && Number.isFinite(fila.margen) && <small> ({fila.margen.toFixed(0)}%)</small>}
                    </dd>
                </div>
            ))}
        </dl>
    );

    return (
        <div className="resumen-ganancia" aria-live="polite">
            <h4>💰 Ganancia al vender</h4>
            {lista(filas)}
            <h4>📦 Ganancia por caja ({ganancias.unidades} u.) si la vendes toda</h4>
            {lista(filasCaja, "ganancia-caja")}
            {ganancias.todoElStock !== null && (
                <p className="ganancia-total-stock">
                    Si vendes todo el stock por unidad: <strong>{moneda(ganancias.todoElStock)}</strong>
                    {es2025 && <small> (mercadería 2025: todo es ganancia del inventario 2025)</small>}
                </p>
            )}
            {[...filas, ...filasCaja].some((f) => f.valor !== null && f.valor < 0) && (
                <p className="texto-error">⚠️ Algún precio está por debajo del costo: venderías con pérdida.</p>
            )}
        </div>
    );
}

/* Colores del producto (opcional): se activan con la casilla. Cada fila es un color y su
   cantidad; el stock del producto pasa a ser la suma. */
function CamposColores({ valores, onCambio, prefijo }) {
    const colores = valores.colores ?? [];

    const cambiarColores = (cambio) => onCambio((anteriores) => ({ ...anteriores, colores: cambio(anteriores.colores ?? []) }));

    function activar(marcado) {
        onCambio((anteriores) => ({
            ...anteriores,
            usaColores: marcado,
            // Al activarlos, el stock que ya estaba escrito pasa al primer color.
            colores: marcado && (anteriores.colores ?? []).length === 0
                ? [{ nombre: "", stock: anteriores.stock ?? "" }]
                : anteriores.colores ?? []
        }));
    }

    return (
        <div className={`campos-colores ${valores.usaColores ? "activos" : ""}`}>
            <label className="casilla">
                <input type="checkbox" checked={Boolean(valores.usaColores)} onChange={(e) => activar(e.target.checked)} />
                <span>🎨 Este producto tiene colores</span>
            </label>

            {valores.usaColores && (
                <>
                    <ul className="lista-colores">
                        {colores.map((color, indice) => (
                            <li key={color.id ?? `nuevo-${indice}`} className="fila-color">
                                <div className="campo">
                                    <label htmlFor={`${prefijo}-color-${indice}`}>Color</label>
                                    <input
                                        type="text"
                                        id={`${prefijo}-color-${indice}`}
                                        maxLength={40}
                                        placeholder="Ej. Rojo"
                                        value={color.nombre}
                                        onChange={(e) => {
                                            const nombre = e.target.value;
                                            cambiarColores((lista) => lista.map((c, i) => (i === indice ? { ...c, nombre } : c)));
                                        }}
                                    />
                                </div>
                                <div className="campo">
                                    <label htmlFor={`${prefijo}-color-cantidad-${indice}`}>Cantidad</label>
                                    <input
                                        type="number"
                                        id={`${prefijo}-color-cantidad-${indice}`}
                                        min="0"
                                        step="1"
                                        inputMode="numeric"
                                        placeholder="0"
                                        value={color.stock}
                                        onChange={(e) => {
                                            const stock = e.target.value;
                                            cambiarColores((lista) => lista.map((c, i) => (i === indice ? { ...c, stock } : c)));
                                        }}
                                    />
                                </div>
                                <button
                                    type="button"
                                    className="boton-icono"
                                    onClick={() => cambiarColores((lista) => lista.filter((_, i) => i !== indice))}
                                    aria-label={`Quitar el color ${color.nombre || indice + 1}`}
                                    title="Quitar color"
                                >
                                    ✕
                                </button>
                            </li>
                        ))}
                    </ul>
                    <button
                        type="button"
                        className="boton-secundario boton-pequeno"
                        onClick={() => cambiarColores((lista) => [...lista, { nombre: "", stock: "" }])}
                    >
                        ＋ Agregar color
                    </button>
                </>
            )}
        </div>
    );
}

// Valor del selector de ubicación: "c<id>" (categoría), "s<id>" (sección sin categoría) o "".
function valorUbicacion(valores) {
    if (valores.categoriaId) return `c${valores.categoriaId}`;
    if (valores.seccionId) return `s${valores.seccionId}`;
    return "";
}

/* Campos compartidos por el formulario de registro y el modal de edición.
   La docena = precio por unidad en la docena × 12, y ese es también el mínimo por docena.
   valores.es2025: casilla de mercadería sobrante del año pasado (todo su stock cuenta como 2025).
   valores.foto: data URL nueva, null para quitarla, undefined para dejarla igual.
   valores.fotoActual: URL de la foto ya guardada (solo al editar). */
export default function CamposProducto({ valores, onCambio, prefijo, etiquetaCompra }) {
    const [escaneando, setEscaneando] = useState(false);
    const secciones = useSecciones();

    const codigoLeido = useCallback((codigo) => {
        setEscaneando(false);
        onCambio((anteriores) => ({ ...anteriores, codigo }));
    }, [onCambio]);

    function cambiar(evento) {
        const { name, value } = evento.target;

        onCambio((anteriores) => {
            const nuevos = { ...anteriores, [name]: value };

            // Mientras no se elija la ubicación a mano, se sugiere la categoría según el nombre
            // (por ejemplo, "Pino nevado" → Árboles y pinos; "Reno de luces" → Renos de luces).
            if (name === "nombre" && !anteriores.ubicacionManual) {
                const sugerida = sugerirCategoria(value, secciones);

                if (sugerida) {
                    if (anteriores.ubicacionPrevia === undefined) {
                        nuevos.ubicacionPrevia = { seccionId: anteriores.seccionId, categoriaId: anteriores.categoriaId };
                    }
                    nuevos.categoriaId = String(sugerida.id);
                    nuevos.seccionId = String(sugerida.seccionId);
                } else if (anteriores.ubicacionPrevia !== undefined) {
                    nuevos.seccionId = anteriores.ubicacionPrevia.seccionId;
                    nuevos.categoriaId = anteriores.ubicacionPrevia.categoriaId;
                    nuevos.ubicacionPrevia = undefined;
                }
            }

            return nuevos;
        });
    }

    function cambiarUbicacion(evento) {
        const valor = evento.target.value;
        const tipo = valor.charAt(0);
        const numero = valor.slice(1);
        const seccionDeCategoria = secciones.find((s) => s.categorias.some((cat) => String(cat.id) === numero));

        onCambio((anteriores) => ({
            ...anteriores,
            ubicacionManual: true,
            ubicacionPrevia: undefined,
            categoriaId: tipo === "c" ? numero : "",
            seccionId: tipo === "c" ? String(seccionDeCategoria?.id ?? "") : tipo === "s" ? numero : ""
        }));
    }

    const id = (campo) => `${prefijo}-${campo}`;

    return (
        <>
            <div className="fila-campos fila-codigo">
                <div className="campo">
                    <label htmlFor={id("codigo")}>Código del producto</label>
                    <div className="campo-con-boton">
                        <input
                            type="text"
                            id={id("codigo")}
                            name="codigo"
                            placeholder="Escanéalo o escríbelo"
                            maxLength={50}
                            autoCapitalize="characters"
                            autoComplete="off"
                            spellCheck={false}
                            value={valores.codigo}
                            onChange={cambiar}
                            required
                        />
                        <button
                            type="button"
                            className="boton-escanear"
                            onClick={() => setEscaneando(true)}
                            aria-label="Escanear código con la cámara"
                            title="Escanear código"
                        >
                            📷
                        </button>
                    </div>
                </div>

                <div className="campo">
                    <label htmlFor={id("nombre")}>Nombre del producto</label>
                    <input
                        type="text"
                        id={id("nombre")}
                        name="nombre"
                        placeholder="Ej. Cinta navideña"
                        maxLength={150}
                        value={valores.nombre}
                        onChange={cambiar}
                        required
                    />
                </div>

                <div className="campo">
                    <label htmlFor={id("ubicacion")}>Ubicación en el catálogo</label>
                    <select
                        id={id("ubicacion")}
                        value={valorUbicacion(valores)}
                        onChange={cambiarUbicacion}
                    >
                        <option value="">Sin sección</option>
                        {secciones.map((seccion) => (
                            <optgroup
                                key={seccion.id}
                                label={`${iconoTema(seccion.tema)} ${seccion.nombre}${seccion.visible ? "" : " (oculta)"}`}
                            >
                                {seccion.categorias.map((categoria) => (
                                    <option key={categoria.id} value={`c${categoria.id}`}>
                                        {categoria.icono} {categoria.nombre}
                                    </option>
                                ))}
                                <option value={`s${seccion.id}`}>
                                    {seccion.categorias.length ? `Otros de ${seccion.nombre}` : seccion.nombre}
                                </option>
                            </optgroup>
                        ))}
                    </select>
                    {!valores.ubicacionManual && valores.categoriaId && (
                        <span className="ayuda-campo">✨ Sugerida por el nombre. Puedes cambiarla.</span>
                    )}
                </div>
            </div>

            <fieldset className="grupo-campos">
                <legend>Compra y stock</legend>

                <div className="fila-campos">
                    <div className="campo">
                        <label htmlFor={id("precioCompra")}>{etiquetaCompra}</label>
                        <input
                            type="number"
                            id={id("precioCompra")}
                            name="precioCompra"
                            min="0"
                            step="0.0001"
                            inputMode="decimal"
                            placeholder="48.00"
                            value={valores.precioCompra}
                            onChange={cambiar}
                            required
                        />
                    </div>

                    <div className="campo">
                        <label htmlFor={id("unidadesPorCaja")}>Unidades por caja</label>
                        <input
                            type="number"
                            id={id("unidadesPorCaja")}
                            name="unidadesPorCaja"
                            min="1"
                            step="1"
                            inputMode="numeric"
                            value={valores.unidadesPorCaja}
                            onChange={cambiar}
                            required
                        />
                    </div>

                    <div className="campo">
                        <label htmlFor={id("stock")}>Stock (unidades)</label>
                        {valores.usaColores ? (
                            <input
                                type="text"
                                id={id("stock")}
                                value={sumaColores(valores.colores) ?? "—"}
                                readOnly
                                aria-describedby={id("stock-colores")}
                            />
                        ) : (
                            <input
                                type="number"
                                id={id("stock")}
                                name="stock"
                                min="0"
                                step="1"
                                inputMode="numeric"
                                placeholder="24"
                                value={valores.stock}
                                onChange={cambiar}
                                required
                            />
                        )}
                        {valores.usaColores && (
                            <span className="ayuda-campo" id={id("stock-colores")}>Es la suma de los colores.</span>
                        )}
                    </div>
                </div>

                <p className="costo-calculado">
                    {textoCostoUnitario(valores.precioCompra, valores.unidadesPorCaja)}
                </p>

                <CamposColores valores={valores} onCambio={onCambio} prefijo={prefijo} />

                <label className={`casilla casilla-2025 ${valores.es2025 ? "marcada" : ""}`}>
                    <input
                        type="checkbox"
                        checked={Boolean(valores.es2025)}
                        onChange={(e) => onCambio((anteriores) => ({ ...anteriores, es2025: e.target.checked }))}
                    />
                    <span>
                        <strong>📦 Mercadería sobrante del año pasado (2025)</strong>
                        <small>
                            Ya se pagó el año pasado: al venderla, todo lo cobrado va a la <strong>ganancia del
                            inventario 2025</strong> (ganancia neta) y no cuenta para recuperar la inversión de este año.
                        </small>
                        {valores.es2025 && valores.es2025Inicial && valores.stock2025Inicial < valores.stockInicial && (
                            <small className="dato-calculado">
                                Solo <strong>{Math.min(valores.stock2025Inicial, Number(valores.stock) || 0)}</strong> unidades
                                son del 2025; el resto es mercadería nueva.
                            </small>
                        )}
                    </span>
                </label>
            </fieldset>

            <fieldset className="grupo-campos">
                <legend>Precios de venta</legend>

                <div className="fila-campos tabla-precios">
                    <div className="campo">
                        <label htmlFor={id("precio")}>Precio por unidad (S/)</label>
                        <input
                            type="number"
                            id={id("precio")}
                            name="precio"
                            min="0"
                            step="0.01"
                            inputMode="decimal"
                            placeholder="3.00"
                            value={valores.precio}
                            onChange={cambiar}
                            required
                        />
                    </div>

                    <div className="campo">
                        <label htmlFor={id("precioMinimo")}>Precio mínimo por unidad (S/)</label>
                        <input
                            type="number"
                            id={id("precioMinimo")}
                            name="precioMinimo"
                            min="0"
                            step="0.01"
                            inputMode="decimal"
                            placeholder="2.50"
                            value={valores.precioMinimo}
                            onChange={cambiar}
                            required
                        />
                    </div>

                    <div className="campo">
                        <label htmlFor={id("precioUnidadDocena")}>Precio por unidad en la docena (S/)</label>
                        <input
                            type="number"
                            id={id("precioUnidadDocena")}
                            name="precioUnidadDocena"
                            min="0"
                            step="0.01"
                            inputMode="decimal"
                            placeholder="2.50"
                            value={valores.precioUnidadDocena}
                            onChange={cambiar}
                            required
                        />
                        <span className="ayuda-campo">A cuánto sale cada unidad cuando compran por docena.</span>
                    </div>

                </div>

                <p className="costo-calculado precio-docena-calculado">
                    La docena se vende a: <strong>S/ {porDocena(valores.precioUnidadDocena) || "0.00"}</strong>
                    <small>
                        {" "}= {valores.precioUnidadDocena || "0.00"} × 12 · Es el mínimo por docena: un empleado no puede cobrar menos.
                    </small>
                </p>

                <ResumenGanancia
                    ganancias={calcularGanancias(valores.usaColores ? { ...valores, stock: String(sumaColores(valores.colores) ?? "") } : valores)}
                    es2025={Boolean(valores.es2025)}
                />
            </fieldset>

            <CampoFoto
                id={id("foto")}
                foto={valores.foto}
                fotoActual={valores.fotoActual}
                onCambio={(foto, fotoEditada = false) => onCambio((anteriores) => ({ ...anteriores, foto, fotoEditada }))}
                onProcesando={(fotoProcesando) => onCambio((anteriores) => ({ ...anteriores, fotoProcesando }))}
            />

            {escaneando && (
                <Escaner onLeido={codigoLeido} onCerrar={() => setEscaneando(false)} />
            )}
        </>
    );
}
