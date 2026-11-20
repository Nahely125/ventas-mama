import { useState } from "react";
import { pedir } from "../api.js";

export default function Login({ onIngresar }) {
    const [usuario, setUsuario] = useState("");
    const [password, setPassword] = useState("");
    const [mantener, setMantener] = useState(true);
    const [mensaje, setMensaje] = useState("");
    const [enviando, setEnviando] = useState(false);

    async function enviar(evento) {
        evento.preventDefault();
        setMensaje("");
        setEnviando(true);

        try {
            const resultado = await pedir("/api/login", {
                method: "POST",
                cuerpo: { usuario: usuario.trim(), password, mantener }
            });

            onIngresar(resultado.usuario);
        } catch (error) {
            setMensaje(
                error.estado
                    ? error.message
                    : "No se pudo conectar con el servidor."
            );
            setEnviando(false);
        }
    }

    return (
        <div className="pagina-login">
            <main className="login-card">
                <div className="login-icono" aria-hidden="true">📦</div>

                <h1>Mil Deseos</h1>
                <p className="login-subtitulo">
                    Ingresa tus credenciales para continuar
                </p>

                <form onSubmit={enviar} className="formulario">
                    <label htmlFor="usuario">Usuario</label>
                    <input
                        type="text"
                        id="usuario"
                        autoComplete="username"
                        value={usuario}
                        onChange={(e) => setUsuario(e.target.value)}
                        required
                    />

                    <label htmlFor="password">Contraseña</label>
                    <input
                        type="password"
                        id="password"
                        autoComplete="current-password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                    />

                    <label className="casilla-mantener">
                        <input
                            type="checkbox"
                            checked={mantener}
                            onChange={(e) => setMantener(e.target.checked)}
                        />
                        <span>
                            Mantener sesión iniciada
                            <small>Desmárcalo si usas un celular o computadora que no es tuyo.</small>
                        </span>
                    </label>

                    <button type="submit" className="boton-principal" disabled={enviando}>
                        {enviando ? "Verificando..." : "Iniciar sesión"}
                    </button>

                    {mensaje && (
                        <p className="mensaje mensaje-error" role="alert">{mensaje}</p>
                    )}
                </form>
            </main>
        </div>
    );
}
