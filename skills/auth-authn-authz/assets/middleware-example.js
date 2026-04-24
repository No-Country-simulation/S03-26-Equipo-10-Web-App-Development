/**
 * Ejemplo de Middleware de Autorización basado en Roles (RBAC)
 * 
 * Este middleware asume que el objeto `req.user` ha sido poblado por un 
 * middleware previo de autenticación (AuthN).
 */

const isAuthorized = (allowedRoles) => {
  return (req, res, next) => {
    // 1. Verificar si el usuario existe
    if (!req.user) {
      return res.status(401).json({ 
        error: 'No autenticado',
        message: 'Debes iniciar sesión para acceder a este recurso.' 
      });
    }

    // 2. Verificar si el rol del usuario está en la lista permitida
    const hasRole = allowedRoles.includes(req.user.role);

    if (!hasRole) {
      return res.status(403).json({ 
        error: 'No autorizado',
        message: 'No tienes los permisos necesarios para realizar esta acción.' 
      });
    }

    // 3. Continuar si todo está correcto
    next();
  };
};

module.exports = isAuthorized;

/* 
Uso recomendado:
app.get('/admin/users', isAuthorized(['admin']), (req, res) => { ... });
app.post('/post/edit', isAuthorized(['admin', 'editor']), (req, res) => { ... });
*/
