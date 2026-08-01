# Guía de seguridad

## Autenticación

**Contraseñas.** bcrypt con coste 12. Se exige longitud (10 caracteres) antes que complejidad
artificial: una frase larga es más segura y más fácil de recordar que ocho caracteres con símbolos.
Se rechazan contraseñas puramente numéricas y las que contienen palabras previsibles.

**Sesiones.** La cookie `tl_session` contiene dos partes: un JWT firmado con HS256 que lleva el
identificador de sesión, y un token aleatorio de 32 bytes. En base de datos solo se guarda el
SHA-256 del token. Una filtración de la base de datos no permite suplantar sesiones.

La cookie es `httpOnly` (inaccesible desde JavaScript), `sameSite=lax` (protege contra CSRF en
peticiones de terceros) y `secure` en producción. Caducidad de 30 días.

**Revocación.** Cada sesión es una fila. `revokeAllSessions` cierra todas salvo la actual, y el
usuario puede hacerlo desde su perfil. Las sesiones revocadas o caducadas se rechazan aunque el JWT
siga siendo válido.

**Pendiente antes de producción**: verificación de correo (el modelo tiene `emailVerifiedAt`) y MFA
(tiene `mfaEnabled` y `mfaSecret`). Falta el envío real y el flujo TOTP.

## Autorización

`lib/rbac.ts` define 28 permisos con forma `recurso:acción` asignados a ocho roles. No hay herencia
implícita entre roles: si un rol necesita un permiso, se escribe en su lista. Es más verboso y menos
propenso a conceder privilegios por accidente.

Cada sección administrativa declara el permiso que la protege y lo comprueba en el servidor. La
navegación solo muestra las secciones accesibles, pero eso es cortesía: el control está en la página.

Los derechos de plan se comprueban en `lib/entitlements.ts`, en cada endpoint, nunca solo en la
interfaz.

## Limitación de frecuencia

`lib/rate-limit.ts` usa ventanas fijas respaldadas por base de datos. El inicio de sesión tiene
límite doble —por IP y por dirección de correo— para dificultar tanto el barrido como el ataque
dirigido a una cuenta concreta.

**En producción con varias instancias**, sustituir el contador por Redis. Solo hay que reimplementar
`consume`; la interfaz `enforce(key, config)` no cambia.

## Validación de entrada

Toda entrada se valida con Zod antes de tocar nada. Los esquemas viven en `lib/validation.ts` y
`packages/simulation-engine/validation.ts`. Los errores devuelven 422 con detalle por campo.

Datos que **nunca** se aceptan del cliente:

- La puntuación de la evaluación inicial: se calcula en el servidor a partir de los índices elegidos.
- Las respuestas correctas de un cuestionario: nunca salen del servidor antes de responder.
- El precio de entrada o salida de una simulación: lo determina el proveedor a través del motor.
- El resultado de una simulación: lo calcula el motor determinístico.
- El inventario publicitario: la selección ocurre íntegramente en el servidor.

## Protección del endpoint de IA

Cuatro capas:

1. **Autenticación y cuota** del plan, más limitación de frecuencia.
2. **Saneado** de la entrada: se neutralizan intentos de inyección de instrucciones (`ignora las
   instrucciones anteriores`, etiquetas `<system>`, prefijos de rol) y se recorta la longitud.
3. **Moderación** del proveedor sobre el texto del usuario.
4. **Guardarraíles de salida** sobre cada respuesta, incluida la del motor determinístico.

La clave de API vive solo en el servidor. No existe ninguna ruta que la devuelva ni ninguna variable
`NEXT_PUBLIC_` que la contenga. El contexto enviado al modelo no incluye identificadores, nombre,
correo, país, plan, historial ni saldo.

## Cabeceras

Configuradas en `next.config.ts` para todas las rutas:

- **Content-Security-Policy** sin `unsafe-eval`. Los únicos orígenes externos permitidos son las
  fuentes de Google. `frame-ancestors 'none'`, `object-src 'none'`, `base-uri 'self'`,
  `form-action 'self'`.
- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: DENY`
- `Referrer-Policy: strict-origin-when-cross-origin`
- `Permissions-Policy` desactivando cámara, micrófono, geolocalización y pago.
- `Strict-Transport-Security` con dos años, subdominios y preload.

**Antes de producción**: sustituir `'unsafe-inline'` en `script-src` por nonce por petición. Está en
la CSP porque el runtime de Next.js lo requiere en modo desarrollo.

## Idempotencia en pagos

Dos mecanismos independientes:

1. **Checkout**: el cliente genera una clave de idempotencia. Si ya existe un pago con esa clave, no
   se crea otro.
2. **Webhooks**: `processWebhook` registra el evento por `(proveedor, identificador externo)` con
   restricción de unicidad y marca `processedAt` solo si el manejador termina bien. Reprocesar el
   mismo evento devuelve `duplicate: true` sin volver a aplicarlo.

La firma del webhook se verifica con HMAC-SHA256 y comparación en tiempo constante
(`timingSafeEqual`) antes de interpretar el contenido. En producción sin `STRIPE_WEBHOOK_SECRET`
configurado, el endpoint devuelve 503 en lugar de aceptar eventos sin firmar.

## Datos personales

- **IP**: nunca se almacena en claro. Se guarda un hash SHA-256 con sal, truncado a 32 caracteres,
  suficiente para correlacionar sin poder revertir.
- **Contraseñas**: solo el hash bcrypt.
- **Tokens de sesión**: solo el hash SHA-256.
- **Analítica**: `lib/analytics.ts` filtra claves potencialmente identificadoras (`email`, `name`,
  `phone`, `ip`, `address`, `token`, `password`) antes de escribir el evento.
- **Registro de auditoría**: guarda el estado anterior y posterior, sin datos sensibles.
- **Portabilidad**: `/api/me/export` devuelve todo lo del usuario en JSON, sin el hash de la
  contraseña ni identificadores internos de sesión.

## Auditoría administrativa

`lib/analytics.ts` expone `audit()`. Cada acción administrativa que modifica datos debe registrarse
con autor, rol, acción, entidad, identificador y diferencia. `/admin/auditoria` lo muestra de forma
inmutable.

## Integridad del saldo virtual

El saldo es un valor derivado; la verdad está en el libro mayor. `verifyLedger` recalcula desde cero
y compara. `/admin/simulaciones` lo ejecuta sobre una muestra en cada carga y avisa si hay
divergencia. Ninguna escritura ocurre fuera de `lib/demo-account.ts`, y siempre en transacción.

## Dependencias

Superficie deliberadamente pequeña: Next.js, React, Prisma, Zod, bcryptjs, jose, Tailwind,
lucide-react y utilidades de clases. Sin bibliotecas de gráficos, sin SDK de pagos en el cliente,
sin bibliotecas de fechas pesadas.

```bash
npm audit --omit=dev     # antes de cada despliegue
npm outdated
```

## Lista de verificación antes de producción

- [ ] `AUTH_SECRET` de al menos 48 bytes aleatorios, distinto por entorno.
- [ ] `FIELD_ENCRYPTION_KEY` generada si se van a cifrar campos sensibles.
- [ ] HTTPS obligatorio; HSTS activo.
- [ ] `'unsafe-inline'` sustituido por nonce en la CSP.
- [ ] Limitación de frecuencia migrada a Redis.
- [ ] PostgreSQL con copias de seguridad automáticas y recuperación probada.
- [ ] Verificación de correo activa.
- [ ] MFA disponible para roles administrativos.
- [ ] WAF delante de la aplicación.
- [ ] Alertas de errores conectadas (Sentry u equivalente).
- [ ] `npm audit` sin vulnerabilidades altas o críticas.
- [ ] Prueba de penetración sobre autenticación, autorización y endpoints de IA.
- [ ] Revisión de que ningún secreto aparece en el paquete del cliente:
      `grep -r "OPENAI_API_KEY\|STRIPE_SECRET" .next/static/` debe devolver vacío.
