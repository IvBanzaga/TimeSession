
# ⏱️ TimeSession

TimeSession es una extensión para Chrome que te ayuda a gestionar y registrar el tiempo que dedicas a tus tareas, clientes y descansos, detectando automáticamente la inactividad y pausando el conteo cuando no estás usando el navegador.


## ✨ Características principales

- Inicio rápido de sesiones de trabajo y descansos.
- Registro de tareas por tipo (personal, cliente, aprendizaje, programación).
- Detección automática de inactividad: pausa la sesión si no hay actividad en el navegador durante el intervalo configurado.
- Modal configurable al abrir el navegador para preguntar qué vas a hacer.
- Panel de control (dashboard) para visualizar y gestionar sesiones y clientes.
- Configuración personalizable: intervalo de validación, modo oscuro, etc.


## 🛠️ Instalación y uso

1. Clona el repositorio o descarga los archivos.
2. Ve a `chrome://extensions/` y activa el modo de desarrollador.
3. Haz clic en "Cargar descomprimida" y selecciona la carpeta del proyecto.
4. Configura tus preferencias en la página de opciones.
5. ¡Empieza a registrar tu tiempo!



## 📁 Estructura del proyecto

- `manifest.json`: Manifest de la extensión.
- `js/`: Scripts principales (background, content, popup, dashboard, validación, librerías).
- `css/`: Estilos para las distintas vistas.
- `html/`: Archivos HTML para opciones, dashboard y popup.
- `img/`: Iconos de la extensión.


## 🖼️ Iconos

La extensión incluye los siguientes iconos en la carpeta `img/`:

| Icono      | Tamaño   | Imagen |
|------------|----------|--------|
| icon16.png | 16x16    | ![icon16](img/icon16.png) |
| icon24.png | 24x24    | ![icon24](img/icon24.png) |
| icon32.png | 32x32    | ![icon32](img/icon32.png) |
| icon48.png | 48x48    | ![icon48](img/icon48.png) |
| icon64.png | 64x64    | ![icon64](img/icon64.png) |
| icon128.png| 128x128  | ![icon128](img/icon128.png) |

Puedes personalizar los iconos editando los archivos en la carpeta `img/`.


## 🚦 Detección de inactividad

La extensión detecta la inactividad del usuario mediante eventos de interacción (mouse, teclado, scroll, etc.). Si no hay actividad durante el intervalo configurado, la sesión activa se pausa automáticamente.


## 🤝 Contribuir

¡Las contribuciones son bienvenidas! Puedes abrir issues o enviar pull requests para mejorar la funcionalidad, corregir errores o proponer nuevas características.


## 📄 Licencia

Este proyecto está bajo la licencia MIT.
