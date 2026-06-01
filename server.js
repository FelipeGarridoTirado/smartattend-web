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

// Conexión a la Base de Datos SQLite
const db = new sqlite3.Database('./db/smartattend.db', (err) => {
    if (err) {
        console.error("Error conectando a la base de datos:", err.message);
    } else {
        console.log("Conectado a la base de datos SQLite.");
        
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

            db.run(`CREATE TABLE IF NOT EXISTS asistencias (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                username TEXT,
                fecha TEXT,
                estado TEXT
            )`);

            // Sembrar Usuarios
            db.get("SELECT * FROM usuarios WHERE username = 'admin'", (err, row) => {
                if (!row) db.run("INSERT INTO usuarios (username, password, rol) VALUES ('admin', 'admin123', 'admin')");
            });

            db.get("SELECT * FROM usuarios WHERE username = 'felipe'", (err, row) => {
                if (!row) db.run("INSERT INTO usuarios (username, password, rol) VALUES ('felipe', 'alumno123', 'alumno')");
            });

            // Sembrar Alumnos
            db.get("SELECT COUNT(*) as count FROM alumnos", (err, row) => {
                if (row && row.count === 0) {
                    db.run("INSERT INTO alumnos (nombre, email) VALUES ('Felipe Garrido', 'felipe@email.com')");
                    db.run("INSERT INTO alumnos (nombre, email) VALUES ('María López', 'maria@email.com')");
                    db.run("INSERT INTO alumnos (nombre, email) VALUES ('Carlos Gómez', 'carlos@email.com')");
                }
            });

            // Sembrar Asistencias
            db.get("SELECT COUNT(*) as count FROM asistencias", (err, row) => {
                if (row && row.count === 0) {
                    db.run("INSERT INTO asistencias (username, fecha, estado) VALUES ('felipe', '2024-05-20', 'Presente')");
                    db.run("INSERT INTO asistencias (username, fecha, estado) VALUES ('felipe', '2024-05-21', 'Presente')");
                    db.run("INSERT INTO asistencias (username, fecha, estado) VALUES ('felipe', '2024-05-22', 'Falta')");
                    db.run("INSERT INTO asistencias (username, fecha, estado) VALUES ('felipe', '2024-05-23', 'Retraso')");
                    db.run("INSERT INTO asistencias (username, fecha, estado) VALUES ('felipe', '2024-05-24', 'Presente')");
                }
            });
        });
    }
});

// --- RUTAS DE AUTENTICACIÓN ---

app.get('/', (req, res) => {
    res.render('login', { error: null });
});

app.post('/login', (req, res) => {
    const { username, password } = req.body;
    db.get("SELECT * FROM usuarios WHERE username = ? AND password = ?", [username, password], (err, row) => {
        if (err) return res.status(500).send("Error en la base de datos");
        
        if (row) {
            req.session.usuario = row;
            if (row.rol === 'admin') res.redirect('/admin');
            else res.redirect('/alumno');
        } else {
            res.render('login', { error: "Usuario o contraseña incorrectos. Inténtalo de nuevo." });
        }
    });
});

app.get('/logout', (req, res) => {
    req.session.destroy();
    res.redirect('/');
});

// --- RUTAS DEL ADMINISTRADOR ---

app.get('/admin', (req, res) => {
    if (!req.session.usuario || req.session.usuario.rol !== 'admin') {
        return res.status(401).send('401 Unauthorized: Área restringida');
    }

    const { search, sort, order } = req.query;
    let query = "SELECT * FROM alumnos";
    let queryParams = [];

    if (search) {
        query += " WHERE nombre LIKE ?";
        queryParams.push('%' + search + '%');
    }

    const columnasValidas = ['id', 'nombre', 'email'];
    const ordenesValidos = ['ASC', 'DESC'];
    const columnaOrden = columnasValidas.includes(sort) ? sort : 'id';
    const tipoOrden = ordenesValidos.includes(order) ? order : 'ASC';

    query += ` ORDER BY ${columnaOrden} ${tipoOrden}`;

    db.all(query, queryParams, (err, alumnos) => {
        if (err) return res.status(500).send("Error en la base de datos");
        res.render('admin', { alumnos: alumnos, search: search });
    });
});

app.post('/admin/add', (req, res) => {
    if (!req.session.usuario || req.session.usuario.rol !== 'admin') return res.status(401).send('401 Unauthorized');
    const { nombre, email } = req.body;
    db.run("INSERT INTO alumnos (nombre, email) VALUES (?, ?)", [nombre, email], (err) => {
        if (err) console.error(err);
        res.redirect('/admin');
    });
});

// NUEVA RUTA: Editar Alumno
app.post('/admin/edit/:id', (req, res) => {
    if (!req.session.usuario || req.session.usuario.rol !== 'admin') return res.status(401).send('401 Unauthorized');
    const { id } = req.params;
    const { nombre, email } = req.body;
    
    db.run("UPDATE alumnos SET nombre = ?, email = ? WHERE id = ?", [nombre, email, id], (err) => {
        if (err) console.error(err);
        res.redirect('/admin');
    });
});

app.post('/admin/delete/:id', (req, res) => {
    if (!req.session.usuario || req.session.usuario.rol !== 'admin') return res.status(401).send('401 Unauthorized');
    const { id } = req.params;
    db.run("DELETE FROM alumnos WHERE id = ?", [id], (err) => {
        if (err) console.error(err);
        res.redirect('/admin');
    });
});

// --- RUTA DEL ALUMNO ---

app.get('/alumno', (req, res) => {
    if (!req.session.usuario || req.session.usuario.rol !== 'alumno') {
        return res.status(401).send('401 Unauthorized: Área restringida para alumnos');
    }
    
    const username = req.session.usuario.username;
    db.all("SELECT * FROM asistencias WHERE username = ? ORDER BY fecha DESC", [username], (err, asistencias) => {
        if (err) return res.status(500).send("Error obteniendo asistencias");
        res.render('alumno', { usuario: req.session.usuario, asistencias: asistencias });
    });
});

app.listen(PORT, () => {
    console.log(`Servidor corriendo en el puerto ${PORT}`);
});

module.exports = app;