/**
 * Configuración Recomendada de Cookies para Producción
 * 
 * Basado en las recomendaciones de OWASP y el Skill SKL-SEC-001.
 */

const sessionOptions = {
  // Solo accesible a través del protocolo HTTP(S), no por JavaScript
  // Previene el robo de sesión mediante ataques XSS
  httpOnly: true,

  // Solo se envía sobre conexiones HTTPS cifradas
  secure: process.env.NODE_ENV === 'production',

  // Restringe el envío de la cookie a peticiones del mismo sitio
  // 'Strict' ofrece la máxima protección contra CSRF
  sameSite: 'strict',

  // Tiempo de vida de la cookie (ej: 24 horas)
  maxAge: 24 * 60 * 60 * 1000,

  // Ruta para la cual la cookie es válida
  path: '/',

  // Dominio (opcional, por defecto es el actual)
  // domain: 'example.com'
};

module.exports = sessionOptions;
