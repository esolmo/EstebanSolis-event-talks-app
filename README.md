# BigQuery Release Notes Hub & Tweet Composer

Una aplicación web moderna construida con **Python Flask** en el backend y **HTML5, CSS3 y JavaScript (Vanilla)** en el frontend. Su función principal es descargar, analizar y clasificar las notas de lanzamiento oficiales de Google Cloud BigQuery, ofreciendo además una herramienta interactiva para formatear y redactar tweets sobre cualquier actualización específica.

---

## 🚀 Características Principales

1. **Análisis Granular de Actualizaciones**: El backend parsea el feed Atom y divide las publicaciones diarias que contienen múltiples anuncios (usando las etiquetas `<h3>`) en tarjetas independientes. Esto permite compartir anuncios puntuales sin exceder el límite de caracteres de Twitter.
2. **Tweet Composer Simulado**:
   - Panel de edición que simula el tema oscuro oficial de Twitter/X.
   - **Corrección de longitud de enlaces**: Calcula correctamente la longitud de los enlaces de acuerdo a las reglas de Twitter (cualquier enlace HTTP/HTTPS se cuenta exactamente como 23 caracteres).
   - **Anillo de progreso SVG**: Un contador circular que cambia de color dinámicamente de azul (seguro) a amarillo (advertencia) y rojo (límite excedido).
   - Integración directa con **Twitter Web Intent** para abrir la ventana oficial de compartición de Twitter sin necesidad de configurar APIs complejas o credenciales OAuth.
3. **Copiado Rápido al Portapapeles**: Cada tarjeta de actualización incluye un botón "Copy" que copia instantáneamente el texto limpio de la nota de lanzamiento (sin tags HTML ni metadatos de tweets), con un estado visual de confirmación temporal ("Copied!") tras el éxito del copiado.
4. **Exportación Flexible a CSV**: Un botón global "Export CSV" en los controles del feed permite descargar en lote las notas visibles en ese momento, respetando los filtros por categoría y búsquedas textuales activos. El archivo CSV generado cumple con el estándar RFC 4180 (campos entrecomillados y comillas internas correctamente escapadas).
5. **Caché en Memoria Inteligente**: Almacena en caché los datos del feed durante 5 minutos para evitar peticiones repetitivas innecesarias a los servidores de Google, con opción de forzar la recarga desde la interfaz.
6. **Diseño Visual Premium**: Interfaz responsive construida sobre una paleta oscura basada en los colores de Google Cloud (tonos pizarra y azul cian), con efectos de elevación, animaciones suaves y cargadores tipo *shimmer skeleton* durante la obtención de datos.
7. **Independencia de Dependencias Complejas**: Todo el sistema de parseo se gestiona con librerías nativas de Python (`xml.etree.ElementTree` y `urllib.request`).

---

## 📁 Estructura del Proyecto

```text
agy-cli-projects/
├── app.py                  # Servidor Flask y lógica de backend
├── requirements.txt        # Dependencias de Python (Flask y requests)
├── .gitignore              # Archivos y directorios excluidos del control de versiones
├── templates/
│   └── index.html          # Interfaz de usuario HTML
└── static/
    ├── css/
    │   └── style.css       # Estilos globales y responsive de la interfaz
    └── js/
        └── app.js          # Lógica del cliente, renderizado, filtrado e interactividad
```

---

## 🛠️ Explicación de `app.py`

El archivo `app.py` gestiona el procesamiento de datos del feed en el backend. A continuación se detallan sus componentes clave:

* **Manejo de Caché**: Define un objeto global `_cache` y un tiempo de expiración (`CACHE_EXPIRY_SECONDS = 300` / 5 minutos). Si hay datos recientes, sirve directamente de allí para optimizar el rendimiento.
* **`clean_html_to_text(html_str)`**: Limpia el código HTML incrustado en el feed utilizando expresiones regulares y `html.unescape()` para producir un texto plano limpio para la previsualización del Tweet.
* **`parse_release_content(content_html)`**: Las entradas del feed de Google Cloud suelen agrupar varias novedades bajo un mismo día usando encabezados `<h3>`. Esta función busca etiquetas `<h3>...</h3>` y segmenta el HTML en bloques individuales agrupados por tipo (ej. *Feature*, *Fix*, *Issue*, *Announcement*, *Changed*).
* **`fetch_and_parse_feed(force_refresh)`**: Se encarga de descargar el archivo XML del feed oficial empleando `urllib.request` y decodificarlo a nivel de árbol de nodos a través de `xml.etree.ElementTree`. Tras analizar los nodos Atom, reconstruye los datos y actualiza el caché.
* **Ruta `/`**: Devuelve la plantilla HTML principal (`templates/index.html`).
* **Ruta `/api/releases`**: Devuelve los datos estructurados en formato JSON. Soporta el parámetro `/api/releases?refresh=true` para forzar la omisión del caché. Cuenta con tolerancia a fallos: si falla la conexión y hay un caché guardado en memoria, sirve los datos del caché en lugar de retornar un error HTTP 500.

---

## 💻 Instalación y Uso Local

Sigue los siguientes pasos para ejecutar el proyecto en tu entorno local:

### 1. Clonar o descargar el proyecto
Asegúrate de que estás situado en el directorio raíz del proyecto:
```bash
cd C:\develop\antigravity\agy-cli-projects
```

### 2. Configurar el Entorno Virtual de Python
Crea y activa un entorno virtual para aislar las dependencias:
```powershell
# Crear el entorno virtual
python -m venv venv

# Activar el entorno virtual (en Windows PowerShell)
.\venv\Scripts\Activate.ps1
```

### 3. Instalar Dependencias
Instala los paquetes necesarios declarados en `requirements.txt`:
```bash
pip install -r requirements.txt
```

### 4. Ejecutar el Servidor
Arranca la aplicación web local de Flask:
```bash
python app.py
```
El servidor comenzará a ejecutarse por defecto en **[http://127.0.0.1:5000](http://127.0.0.1:5000)**.

### 5. Acceder en el Navegador
Abre tu navegador de preferencia y navega a [http://127.0.0.1:5000](http://127.0.0.1:5000).
