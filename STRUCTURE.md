# Backend Structure

```
src/
├── config/              # Configuration files
│   └── database.js      # Database config
├── controllers/         # Request handlers
│   └── example.controller.js
├── middlewares/         # Express middlewares
│   ├── auth.middleware.js
│   └── error.middleware.js
├── models/              # Data models
│   └── example.model.js
├── routes/              # Route definitions
│   └── index.js
├── services/            # Business logic
│   └── example.service.js
├── utils/               # Helper functions
│   └── helpers.js
├── validators/          # Input validation
│   └── example.validator.js
├── app.js              # Express app setup
└── index.js            # Server entry point
```

## Architecture Pattern
- **Controllers**: Handle HTTP requests and responses
- **Services**: Contain business logic
- **Models**: Define data structures
- **Routes**: Define API endpoints
- **Middlewares**: Handle cross-cutting concerns
- **Validators**: Validate input data
- **Utils**: Helper functions

## How to use:
1. Create route files in `routes/`
2. Create controllers in `controllers/`
3. Create services in `services/`
4. Create models in `models/`
5. Add middlewares in `middlewares/`
6. Add validators in `validators/`
