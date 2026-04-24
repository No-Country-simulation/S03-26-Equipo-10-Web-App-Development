# Arquitectura "Zero-Trust" en el Código

Esta referencia detalla el enfoque estratégico de seguridad profunda aplicado al desarrollo de software (Skill **SKL-SEC-002**).

## 1. El Concepto de "Fronteras de Confianza"
En lugar de validar datos en cada función, establecemos perímetros claros donde el sistema se comunica con el exterior (APIs, Bases de Datos, Archivos).

### Estrategia:
1. **Entrada Externas:** Todo dato que cruza la frontera es tratado como `unknown` y validado inmediatamente con un esquema (ej: Zod).
2. **Transformación:** Una vez validado, se transforma en un objeto de dominio inmutable y tipado.
3. **Interior del Sistema:** Las funciones internas confían plenamente en los tipos, reduciendo el ruido de validaciones repetitivas.

## 2. Blindaje de la Cadena de Suministro (Supply Chain)
Las dependencias son el mayor vector de ataque actual. 

### Reglas de Oro:
- **pnpm audit:** Ejecutar en cada commit mediante Git Hooks.
- **Versiones fijas:** No permitir que un `npm install` traiga una versión diferente a la testeada originalmente.
- **Hoisting selectivo:** pnpm evita que los paquetes accedan a dependencias que no declararon explícitamente.

## 3. Inmutabilidad y Fail-Fast
- **Inmutabilidad:** Usar `readonly` en TypeScript y `Object.freeze()` si es necesario para asegurar que la configuración no cambie en runtime.
- **Fail-Fast:** Si una variable de entorno falta o es incorrecta, la aplicación debe fallar en el arranque (`crash at startup`), nunca en mitad de una transacción de usuario.

---

## Checklist de Robustez
- [ ] ¿TypeScript tiene el flag `strict` en true?
- [ ] ¿Se usa un validador de esquemas para las variables de entorno?
- [ ] ¿Los logs están en formato JSON (Pino/Winston)?
- [ ] ¿Helmet y CSP están activos con políticas restrictivas?
