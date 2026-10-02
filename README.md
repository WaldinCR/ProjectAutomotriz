# SGI Automotriz — Proyecto Ceballos

Sistema de Gestión Integral para Repuestos Automotrices y Taller Mecánico.

## Cómo iniciar

```bash
# 1. Instalar dependencias
npm install

# 2. Generar la base de datos
npx prisma migrate dev --name init

# 3. Correr en modo desarrollo
npm run dev
```

## Stack
- Electron v28 + React 18 + Node.js v20
- SQLite (Prisma ORM)
- Tailwind CSS + Zustand

