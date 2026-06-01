const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const bodyParser = require('body-parser');
const session = require('express-session');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Configuración de EJS y Middlewares
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.static(path.join(__dirname, 'public')));
app.use(bodyParser.urlencoded({ extended: true }));

// Configuración de Sesiones
app.use(session({
    secret: 'smartattend_secreto_super_seguro',
    resave: false,
    saveUninitialized: false
}));

// Conexión a la Base de Datos SQLite (Con auto-creación de tablas)
const db = new sqlite3.Database('./db/smartattend.db', (err) => {
    if (err) {
        console.error("Error conectando a la base de datos:", err.message);
    } else {
        console.log("Conectado a la base de datos SQLite.");
        
        // Crear las tablas automáticamente si no existen
        db.serialize(() => {
            db.run(`CREATE TABLE IF NOT EXISTS usuarios (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                username TEXT UNIQUE,
                password TEXT,
                rol TEXT
            )`);
            
            db.run(`CREATE TABLE IF NOT EXISTS alumnos (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                nombre TEXT,
                email TEXT
            )`);

            // Crear un administrador por defecto (si la tabla estaba vacía)
            db.get("SELECT * FROM usuarios WHERE username = 'admin'", (err, row) => {
                if (!row) {
                    db.run("INSERT INTO usuarios (username, password, rol) VALUES ('admin', 'admin123', 'admin')");
                    console.log("Usuario admin creado por defecto.");
                }
            });

            // Crear un alumno de prueba por defecto
            db.get("SELECT * FROM usuarios WHERE username = 'felipe'", (err, row) => {
                if (!row) {
                    db.run("INSERT INTO usuarios (username, password, rol) VALUES ('felipe', 'alumno123', 'alumno')");
                    console.log("Usuario alumno creado por defecto.");
                }
            });
        });
    }
});

// --- RUTAS DE AUTENTICACIÓN ---

// Página de inicio (Login) - Responde 200 OK para el Test
app.get('/', (req, res) => {
    // Le enviamos error: null para que EJS no crashee al cargar la primera vez
    res.render('login', { error: null });
});

// Procesar el Login
app.post('/login', (req, res) => {
    const { username, password } = req.body;
    
    // Consulta para verificar el usuario
    db.get("SELECT * FROM usuarios WHERE username = ? AND password = ?", [username, password], (err, row) => {
        if (err) return res.status(500).send("Error en la base de datos");
        
        if (row) {
            // Guardar sesión
            req.session.usuario = row;
            if (row.rol === 'admin') {
                res.redirect('/admin');
            } else {
                res.redirect('/alumno');
            }
        } else {
            // Si falla la contraseña, recarga el login pero ahora sí envía el mensaje de error
            res.render('login', { error: "Usuario o contraseña incorrectos. Inténtalo de nuevo." });
        }
    });
});

// Cerrar sesión
app.get('/logout', (req, res) => {
    req.session.destroy();
    res.redirect('/');
});

// --- RUTAS DEL ADMINISTRADOR (CRUD y Filtros) ---

// Ver panel de administrador (Leer)
app.get('/admin', (req, res) => {
    // Protección de ruta - Responde 401 para el Test
    if (!req.session.usuario || req.session.usuario.rol !== 'admin') {
        return res.status(401).send('401 Unauthorized: Área restringida');
    }

    const { search, sort, order } = req.query;
    
    let query = "SELECT * FROM alumnos";
    let queryParams = [];

    // Si hay búsqueda, añadimos el WHERE
    if (search) {
        query += " WHERE nombre LIKE ?";
        queryParams.push('%' + search + '%');
    }

    // Validación de columnas y orden para evitar inyecciones SQL
    const columnasValidas = ['id', 'nombre', 'email'];
    const ordenesValidos = ['ASC', 'DESC'];
    
    const columnaOrden = columnasValidas.includes(sort) ? sort : 'id';
    const tipoOrden = ordenesValidos.includes(order) ? order : 'ASC';

    query += ` ORDER BY ${columnaOrden} ${tipoOrden}`;

    // Ejecutamos la consulta
    db.all(query, queryParams, (err, alumnos) => {
        if (err) return res.status(500).send("Error en la base de datos");
        res.render('admin', { alumnos: alumnos, search: search });
    });
});

// Crear Alumno
app.post('/admin/add', (req, res) => {
    if (!req.session.usuario || req.session.usuario.rol !== 'admin') return res.status(401).send('401 Unauthorized');
    const { nombre, email } = req.body;
    db.run("INSERT INTO alumnos (nombre, email) VALUES (?, ?)", [nombre, email], (err) => {
        if (err) console.error(err);
        res.redirect('/admin');
    });
});

// Eliminar Alumno
app.post('/admin/delete/:id', (req, res) => {
    if (!req.session.usuario || req.session.usuario.rol !== 'admin') return res.status(401).send('401 Unauthorized');
    const { id } = req.params;
    db.run("DELETE FROM alumnos WHERE id = ?", [id], (err) => {
        if (err) console.error(err);
        res.redirect('/admin');
    });
});

// --- RUTA DEL ALUMNO ---
// Vista del alumno (Solo para que no dé error 404 al entrar como 'felipe')
app.get('/alumno', (req, res) => {
    if (!req.session.usuario || req.session.usuario.rol !== 'alumno') {
        return res.status(401).send('401 Unauthorized: Área restringida para alumnos');
    }
    res.render('alumno', { usuario: req.session.usuario });
});

// Iniciar el servidor
app.listen(PORT, () => {
    console.log(`Servidor corriendo en el puerto ${PORT}`);
});

// Exportar para Jest (Pruebas)
module.exports = app;