# Guía de Hoisting en Monorepositorios

Esta referencia explica cómo funciona la gestión de dependencias centralizada (Skill **SKL-PRO-001**).

## 1. ¿Qué es el Hoisting?
El hoisting es el proceso por el cual las dependencias de los subpaquetes se "elevan" al directorio `node_modules` de la raíz del monorepositorio.

### Beneficios:
- **Ahorro de espacio:** No se duplican librerías comunes (como `typescript` o `react`) en cada subcarpeta.
- **Velocidad:** Las instalaciones son más rápidas porque se comparten paquetes cacheados.
- **Consistencia:** Todos los paquetes usan la misma versión de una dependencia compartida.

## 2. Conflictos de Versión
Si el Paquete A requiere `lodash@4.0.0` y el Paquete B requiere `lodash@3.0.0`, el gestor de paquetes (npm/pnpm/yarn) tendrá que decidir cuál elevar. Generalmente:
- Una versión se eleva a la raíz.
- La otra versión se mantiene dentro del `node_modules` específico del paquete (Nested `node_modules`).

## 3. Prácticas Recomendadas
- **Dependencias de Desarrollo:** Casi todas las herramientas de build (`jest`, `eslint`, `typescript`) deberían estar solo en la raíz.
- **Scripts Orquestadores:** Usa el flag `--workspace` de npm para ejecutar comandos sin entrar en las subcarpetas.
- **Evitar No-Hoisting:** A menos que sea estrictamente necesario por compatibilidad de alguna librería legacy, permite siempre el hoisting para mantener el repo limpio.

---

## Estructura Visual
```text
/root
  package.json (workspaces definidos)
  node_modules/ (aquí vive el 90% de las dependencias)
  apps/
    api/
      package.json
    web/
      package.json
  packages/
    shared-ui/
      package.json
```
