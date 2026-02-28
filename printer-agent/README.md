# Hostea Printer Agent

Agente local para imprimir tickets termicos desde la cola `print_jobs`.

## Requisitos

- Node.js 18+
- Impresora termica instalada/emparejada en el mini PC
- Variables de entorno de Supabase (`SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`)

## Configuracion

1. Copia `.env.example` a `.env`.
2. Completa credenciales y, si queres, `PRINTER_INTERFACE`.
3. Instala dependencias:

```bash
cd printer-agent
npm install
```

## Ejecutar

```bash
npm start
```

El agente:

- consulta `admin_settings` para saber si la impresion automatica esta activa
- lee trabajos `pending` en `print_jobs`
- imprime y marca `printed`
- reintenta hasta `MAX_ATTEMPTS`, luego marca `failed`

## Modo prueba sin impresora

```bash
DRY_RUN=true npm start
```

Imprime el ticket en consola y marca trabajos como `printed`.
