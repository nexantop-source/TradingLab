# QA de sesiones y cierres — 20 de septiembre de 2026

## Cambios

- Acciones, ETF e índices con sesión US_EQUITY: horario regular 09:30–16:00 America/New_York, con cambio automático de horario de verano. Festivos bursátiles, fechas observadas y cierres anticipados a las 13:00. Los festivos muestran «Mercado cerrado · festivo».
- Forex: ventana semanal de referencia domingo 17:00 a viernes 17:00 Nueva York, con ajuste de horario de verano. No se aplica el calendario NYSE a un mercado OTC global. Disponibilidad efectiva subordinada a cotización vigente y sesión informada por la fuente.
- Criptomonedas: calendario 24/7; no heredan festivos de la bolsa. Continúan vigentes los controles de datos ausentes o desactualizados.
- Todo el catálogo no 24/7 conserva el cierre de sábado. Metales, energía y otras plazas conservan sus sesiones específicas de referencia; cuando Yahoo entrega currentTradingPeriod, sus límites pueden cerrar antes un instrumento aunque la última cotización sea reciente.
- Al intentar operar, una cotización conservada en caché como OPEN no puede superar un cierre ya determinado por el calendario. Se conserva el precio real recibido; no se generan movimientos ficticios.

## Verificación

586 pruebas aprobadas en 50 archivos. Los nuevos casos contrastan todas las fechas publicadas de NYSE para 2026–2028, cierres anticipados, horario de verano/invierno, festivos bancarios que no cierran bolsa, Año Nuevo en sábado, última sesión anterior y próxima apertura exacta. Se recorre todo el catálogo para comprobar sábado cerrado excepto 24/7. Integración Yahoo: cierre anticipado de un futuro con cotización reciente. Validación TypeScript y compilación de producción.

Consulta real a Yahoo el 21/09/2026 a las 01:29 UTC (domingo por la noche en Colombia): AAPL y SPY cerrados con última cotización del viernes; EURUSD y XAUUSD abiertos tras reapertura semanal; BTCUSD abierto. Todas las respuestas fueron no sintéticas. No se crearon operaciones.

## Fuentes y alcance

- NYSE: https://www.nyse.com/trade/hours-calendars
- Forex, horarios de referencia: https://www.oanda.com/us-en/trading/hours-of-operation/
- Futuros, calendarios por producto: https://www.cmegroup.com/trading-hours.html

El calendario implementado de feriados y medias sesiones corresponde a bolsa estadounidense al contado, no a todos los contratos CME/ICE ni bolsas extranjeras. Sus cierres especiales se restringen adicionalmente con la sesión entregada por Yahoo y la antigüedad del dato; si la fuente no comunica la sesión, sigue siendo una referencia, no una certificación de su calendario completo. Cierres extraordinarios futuros deben incorporarse cuando los anuncie la bolsa. La API de Yahoo no constituye un calendario oficial de todas las plazas.

## USD/COP y etiquetas compartidas

Se corrigió USD/COP para usar la sesión de referencia spot local 08:00–13:00 Colombia, con festivos colombianos y fin de semana. Esta ventana no representa el mercado offshore NDF ni los horarios de registro. Fuentes: https://icap.com.co/?download_id=22635&sdm_process_download=1 y https://www1.funcionpublica.gov.co/eva/gestornormativo/norma.php?i=4954 .

Las etiquetas compartidas priorizan CLOSED/HOLIDAY/PRE_OPEN sobre DELAYED y muestran «Mercado cerrado · última referencia». El detalle conserva la fecha real del precio. Una sesión abierta con datos diferidos conserva su advertencia: retraso no significa cierre.

595 pruebas aprobadas en 51 archivos, incluyendo render de etiquetas contradictorias, horario y festivos colombianos, bloqueo de una cotización OPEN guardada fuera de sesión y respuesta Yahoo reciente durante domingo. Consulta real posterior: USDCOP CLOSED/MARKET_CLOSED, AAPL CLOSED/MARKET_CLOSED, EURUSD y BTCUSD OPEN/REALTIME; ningún dato sintético ni operación creada.
