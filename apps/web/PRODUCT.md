# Product

<!-- impeccable:product-schema 1 -->

## Platform

Web, incluido navegador móvil. Monorepo Testimonial CMS, Next.js 15 y NestJS 11.

## Users and Purpose

Administradores y editores de tenants gestionan testimonios. El administrador contrata acceso al CMS. El operador de plataforma administra catálogo y operaciones financieras con autorización separada por BD.

## Confirmed Scope

Decisiones confirmadas en el plan HITL de pagos del 2026-10-20 y su ACK de fase 4: Stripe/USD y Mercado Pago Argentina/ARS, períodos mensuales/anuales, compra manual o renovación automática, prueba una vez sin tarjeta, catálogo versionado y cuotas almacenadas. El navegador muestra confirmaciones del backend. Cambios mediante nueva adhesión al vencer el período; sin prorrateos. Control comercial opt-in, apagado por defecto. Producción y aceptación sandbox externa no se afirman.

## Constraints

Conservar sesión, identidad visual y navegación actuales. Facturación para admin, estado comercial mínimo para editor y panel independiente para operador. Formularios accesibles por teclado, foco visible, móvil, estados pendientes y errores recuperables. No secretos ni tarjetas en frontend. Estas decisiones reutilizan la solicitud y el plan aprobados, sin reabrir preferencias ya confirmadas.
