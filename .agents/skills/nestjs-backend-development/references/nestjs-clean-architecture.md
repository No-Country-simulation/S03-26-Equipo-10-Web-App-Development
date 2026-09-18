# Clean Architecture en NestJS

Esta referencia detalla cómo estructurar un proyecto NestJS siguiendo los principios de Clean Architecture y SOLID (Skill **SKL-JS-001**).

## 1. Capas del Sistema

- **Módulos (`@Module`)**: Definen los límites del dominio y orquestan la inyección de dependencias.
- **Controladores (`@Controller`)**: Capa de infraestructura que maneja las peticiones HTTP. Solo delegan al servicio.
- **Servicios (`@Injectable`)**: Contienen la lógica de negocio (Casos de Uso). No deben conocer detalles de HTTP o base de datos directamente.
- **Repositorios**: Abstracción de la persistencia. Los servicios usan interfaces de repositorios para cumplir con el principio de Inversión de Dependencia.

## 2. Inyección de Dependencias (DI)

NestJS facilita el cumplimiento de SOLID mediante su contenedor de IoC:
- **Single Responsibility**: Cada servicio debe tener una sola razón para cambiar.
- **Interface Segregation**: Los servicios deben depender de interfaces/abstracciones, no de implementaciones concretas (cuando sea posible).

## 3. Validación y Transformación

- **DTOs (Data Transfer Objects)**: Definen la forma de los datos que entran al sistema.
- **Pipes**: Validan y transforman los DTOs antes de que lleguen al controlador.
- **Guards**: Manejan la autorización de forma declarativa.

---

## Estructura de Carpetas Recomendada

```text
src/
├── core/               # Lógica compartida (interceptors, filters, guards)
├── modules/            # Dominios funcionales
│   ├── users/
│   │   ├── dto/        # Validación de entrada
│   │   ├── entities/   # Modelos de dominio
│   │   ├── users.controller.ts
│   │   ├── users.service.ts
│   │   └── users.module.ts
└── main.ts             # Punto de entrada de la aplicación
```
