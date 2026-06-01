-- Creación de la tabla de alumnos
CREATE TABLE IF NOT EXISTS alumnos (
    id INTEGER PRIMARY KEY AUTOINCREMENT, 
    nombre TEXT NOT NULL, 
    email TEXT NOT NULL
);

-- Creación de la tabla de asistencia
CREATE TABLE IF NOT EXISTS asistencia (
    id INTEGER PRIMARY KEY AUTOINCREMENT, 
    alumno_id INT NOT NULL, 
    fecha TEXT NOT NULL,
    FOREIGN KEY(alumno_id) REFERENCES alumnos(id)
);

-- Creación de la tabla de usuarios con roles
CREATE TABLE IF NOT EXISTS usuarios (
    id INTEGER PRIMARY KEY AUTOINCREMENT, 
    username TEXT NOT NULL, 
    password TEXT NOT NULL, 
    rol TEXT NOT NULL, 
    alumno_id INT,
    FOREIGN KEY(alumno_id) REFERENCES alumnos(id)
);