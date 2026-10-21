import { useCallback, useEffect, useState } from "react";
import { pedir } from "./api.js";
import Login from "./components/Login.jsx";
import Panel from "./components/Panel.jsx";
import Catalogo from "./components/Catalogo.jsx";
import Boleta from "./components/Boleta.jsx";

// Páginas públicas: no piden iniciar sesión.
export default function App() {
    const ruta = window.location.pathname;
    const boleta = /^\/boleta\/([^/]+)\/?$/.exec(ruta);

    if (/^\/catalogo\/?$/.test(ruta)) {
        return <Catalogo />;
    }

    if (boleta) {
        return <Boleta token={decodeURIComponent(boleta[1])} />;
    }

    return <AppPrivada />;
}

function AppPrivada() {
    const [usuario, setUsuario] = useState(null);
    const [cargando, setCargando] = useState(true);

    const consultarSesion = useCallback(
        () => pedir("/api/sesion")
            .then((resultado) => setUsuario(resultado.usuario || resultado))
            .catch(() => setUsuario(null)),
        []
    );

    useEffect(() => {
        consultarSesion().finally(() => setCargando(false));
    }, [consultarSesion]);

    if (cargando) {
        return (
            <div className="pantalla-carga" role="status">
                <span className="spinner" aria-hidden="true"></span>
                Cargando...
            </div>
        );
    }

    if (!usuario) {
        return <Login onIngresar={setUsuario} />;
    }

    return (
        <Panel
            usuario={usuario}
            onSalir={() => setUsuario(null)}
            onActualizarUsuario={consultarSesion}
        />
    );
}
