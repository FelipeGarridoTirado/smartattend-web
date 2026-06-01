const request = require('supertest');
const app = require('../server'); // Importamos tu servidor

describe('Pruebas de Integración - SmartAttend', () => {

    test('1. La página de inicio debe responder con 200 OK', async () => {
        const response = await request(app).get('/');
        // Verifica que el código de estado sea 200
        expect(response.statusCode).toBe(200); 
    });

    test('2. La zona admin debe responder con 401 Unauthorized sin login', async () => {
        const response = await request(app).get('/admin');
        // Verifica que el código de estado sea 401 por no tener sesión
        expect(response.statusCode).toBe(401); 
        // Verifica que el texto del error esté presente en la respuesta
        expect(response.text).toContain('401 Unauthorized'); 
    });

});