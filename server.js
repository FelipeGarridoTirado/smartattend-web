const express = require('express');
const session = require('express-session');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const app = express();
const PORT = 3000;

// --- 1. CONFIGURACIÓN DE MIDDLEWARES Y EJS ---
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

app.use(session({
    secret: 'secreto_smartattend',
    resave: false,
    saveUninitialized: false
}));

// --- 2. CONEXIÓN A LA BASE DE DATOS Y AUTOLLENADO ---
const db = new sqlite3.Database('./db/smartattend.db', (err) => {
    if (err) {
        console.error('Error conectando a SQLite:', err.message);
    } else {
        console.log('Conectado a la base de datos SQLite.');
        
        db.serialize(() => {
            db.run(`CREATE TABLE IF NOT EXISTS alumnos (id INTEGER PRIMARY KEY AUTOINCREMENT, nombre TEXT, email TEXT)`);
            db.run(`CREATE TABLE IF NOT EXISTS asistencia (id INTEGER PRIMARY KEY AUTOINCREMENT, alumno_id INT, fecha TEXT)`);
            db.run(`CREATE TABLE IF NOT EXISTS usuarios (id INTEGER PRIMARY KEY AUTOINCREMENT, username TEXT, password TEXT, rol TEXT, alumno_id INT)`);
            
            db.get("SELECT COUNT(*) AS count FROM usuarios", (err, row) => {
                if (row && row.count === 0) {
                    // 1. Insertar Alumnos
                    db.run("INSERT INTO alumnos (nombre, email) VALUES ('Felipe Garrido', 'felipe@email.com')");
                    db.run("INSERT INTO alumnos (nombre, email) VALUES ('María López', 'maria@email.com')");
                    db.run("INSERT INTO alumnos (nombre, email) VALUES ('Carlos Gómez', 'carlos@email.com')");
                    
                    // 2. Insertar Usuarios (1 Admin, y 3 Alumnos enlazados)
                    db.run("INSERT INTO usuarios (username, password, rol) VALUES ('admin', '1234', 'admin')");
                    db.run("INSERT INTO usuarios (username, password, rol, alumno_id) VALUES ('felipegarrido', '1234', 'alumno', 1)");
                    db.run("INSERT INTO usuarios (username, password, rol, alumno_id) VALUES ('marialopez', '1234', 'alumno', 2)");
                    db.run("INSERT INTO usuarios (username, password, rol, alumno_id) VALUES ('carlosgomez', '1234', 'alumno', 3)");
                    
                    // 3. Insertar Asistencia de prueba para Felipe
                    db.run("INSERT INTO asistencia (alumno_id, fecha) VALUES (1, '2023-10-25 08:00:00')");
                    db.run("INSERT INTO asistencia (alumno_id, fecha) VALUES (1, '2023-10-26 08:05:00')");
                    
                    console.log('¡Base de datos poblada con usuarios y alumnos de prueba!');
                }
            });
        });
    }
});

// --- 3. RUTAS DE LA APLICACIÓN ---

app.get('/', (req, res) => {
    if (req.session.loggedin) {
        return req.session.rol === 'admin' ? res.redirect('/admin') : res.redirect('/perfil');
    }
    res.render('login', { error: null });
});

app.post('/login', (req, res) => {
    const { username, password } = req.body;
    db.get('SELECT * FROM usuarios WHERE username = ? AND password = ?', [username, password], (err, row) => {
        if (err) return res.render('login', { error: 'Error interno del servidor.' });

        if (row) {
            req.session.loggedin = true;
            req.session.username = row.username;
            req.session.rol = row.rol;               
            req.session.alumno_id = row.alumno_id;   
            res.redirect(row.rol === 'admin' ? '/admin' : '/perfil');
        } else {
            res.render('login', { error: 'Usuario o contraseña incorrectos.' });
        }
    });
});

app.get('/admin', (req, res) => {
    if (!req.session.loggedin || req.session.rol !== 'admin') {
        return res.status(401).send(`<h1>401 Unauthorized</h1><p>Solo administradores.</p><a href="/">Volver</a>`);
    }

    const searchQuery = req.query.q;
    let sql = 'SELECT * FROM alumnos ORDER BY nombre ASC'; 
    let params = [];

    if (searchQuery) {
        sql = 'SELECT * FROM alumnos WHERE nombre LIKE ? ORDER BY nombre ASC';
        params = [`%${searchQuery}%`];
    }

    db.all(sql, params, (err, rows) => {
        res.render('admin', { alumnos: rows, searchQuery: searchQuery });
    });
});

app.post('/admin/add', (req, res) => {
    if (!req.session.loggedin || req.session.rol !== 'admin') return res.redirect('/');
    db.run('INSERT INTO alumnos (nombre, email) VALUES (?, ?)', [req.body.nombre, req.body.email], () => res.redirect('/admin'));
});

app.post('/admin/update/:id', (req, res) => {
    if (!req.session.loggedin || req.session.rol !== 'admin') return res.redirect('/');
    db.run('UPDATE alumnos SET nombre = ?, email = ? WHERE id = ?', [req.body.nombre, req.body.email, req.params.id], () => res.redirect('/admin'));
});

app.post('/admin/delete/:id', (req, res) => {
    if (!req.session.loggedin || req.session.rol !== 'admin') return res.redirect('/');
    db.run('DELETE FROM alumnos WHERE id = ?', [req.params.id], () => res.redirect('/admin'));
});

app.get('/perfil', (req, res) => {
    if (!req.session.loggedin || req.session.rol !== 'alumno') {
        return res.status(401).send(`<h1>401 Unauthorized</h1><p>Solo alumnos.</p><a href="/">Volver</a>`);
    }

    db.all('SELECT * FROM asistencia WHERE alumno_id = ? ORDER BY fecha DESC', [req.session.alumno_id], (err, rows) => {
        res.render('alumno', { username: req.session.username, asistencias: rows });
    });
});

app.get('/logout', (req, res) => {
    req.session.destroy(); 
    res.redirect('/');     
});

app.listen(PORT, () => {
    console.log(`Servidor corriendo en http://localhost:${PORT}`);
});

module.exports = app;