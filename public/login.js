
const formularioLogin = document.querySelector("#form-login");
const campoUsuario = document.querySelector("#usuario");
const campoPassword = document.querySelector("#password");
const mensajeLogin = document.querySelector("#mensaje-login");
const botonLogin = document.querySelector("#btn-login");

formularioLogin.addEventListener("submit", async (evento) => {
    evento.preventDefault();

    mensajeLogin.textContent = "";
    botonLogin.disabled = true;
    botonLogin.textContent = "Verificando...";

    try {
        const respuesta = await fetch("/api/login", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                usuario: campoUsuario.value.trim(),
                password: campoPassword.value
            })
        });

        const resultado = await respuesta.json();

        if (!respuesta.ok) {
            mensajeLogin.textContent =
                resultado.error || "No se pudo iniciar sesión.";
            return;
        }

        window.location.href = "/";
    } catch (error) {
        console.error("Error al iniciar sesión:", error);

        mensajeLogin.textContent =
            "No se pudo conectar con el servidor.";
    } finally {
        botonLogin.disabled = false;
        botonLogin.textContent = "Iniciar sesión";
    }
});
