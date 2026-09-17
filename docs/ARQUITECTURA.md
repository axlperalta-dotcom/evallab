# Decisiones de EvalLab v0.1

## Una sola aplicación local

Python sirve la interfaz y la API. La biblioteca estándar evita exigir cuentas, contenedores o dependencias de ejecución para este primer laboratorio. SQLite guarda datos persistentes; cada petición abre y cierra su conexión. Las mutaciones se ejecutan con `BEGIN IMMEDIATE` para evitar que una ejecución capture una mezcla de definiciones editadas concurrentemente.

`http.server` se utiliza como servidor local de prototipo; no se plantea como servidor público de producción. La interfaz usa JavaScript sin framework para mantener la superficie de esta primera aplicación pequeña. Node y Playwright son herramientas de prueba, no de ejecución. El rediseño incorpora selección y filtros en memoria del navegador, sin cambiar el esquema ni los comandos de escritura. La comparación lee respuestas y reglas de las copias históricas, no del caso editable. [Decisiones de interfaz](DISENO.md).

## Evaluación separada de persistencia

`evaluator.py` recibe una definición y una respuesta y devuelve un resultado serializable. Nunca ejecuta código contenido en la respuesta ni llama a servicios externos.

1. Valida la configuración: reglas conocidas, valores dentro de límites y sin tipos repetidos.
2. Ejecuta cada comprobación determinista.
3. Distingue un incumplimiento de respuesta de un error de configuración o una excepción del motor.
4. Resume los resultados conservando la cantidad de errores fuera del denominador de cumplimiento.

Las pruebas inyectan un fallo del motor y una configuración heredada inválida para comprobar la diferencia. El formulario rechaza configuraciones inválidas nuevas. Los errores no se simulan como parte de las respuestas de demostración.

## Historial reproducible

Cada resultado conserva el título, instrucción, reglas, respuesta y comprobaciones usadas. Eliminar el caso original no elimina esa copia. Las revisiones humanas son un registro separado que se puede actualizar; se conserva la última revisión y su fecha, no un historial de todas sus ediciones.

Una firma SHA-256 incluye los identificadores de casos, instrucciones y reglas, ordenados por identificador. Excluye respuestas y títulos: permite comparar distintas respuestas bajo los mismos criterios. Cambiar el orden de las reglas se trata conservadoramente como un cambio de configuración. No se declara equivalencia semántica entre instrucciones distintas.

Las comparaciones se calculan a partir de las copias almacenadas. Se inhibe el cambio global de porcentaje si las firmas difieren, si se selecciona la misma ejecución o si hay errores del evaluador. Se muestran los resultados por caso incluso cuando la comparación global no corresponde.

## Persistencia y seguridad

- Datos del prototipo en SQLite; casos con consultas parametrizadas.
- Semilla con marcador `seed-v1`, insertada una sola vez en una transacción; no reaparece después de eliminar casos.
- Respuestas HTTP `no-store`; cabeceras de tipo y CSP para evitar cargar contenido externo.
- Lecturas limitadas a rutas conocidas; la base y el código Python no se sirven como archivos.
- Solo escucha en loopback; restringe Host y Origin y exige JSON en comandos.
- Límite de cuerpo de 150000 bytes, 200 casos y límites de longitud por campo.
- El texto de casos y respuestas se escapa al renderizar. Puede incluir ejemplos adversariales sin interpretarlos como código.

No hay autenticación, cifrado de aplicación ni aislamiento entre usuarios. Se conserva la base local de la persona que ejecuta el proceso. No admite uso remoto, exposición pública ni múltiples procesos modificando el esquema. La comprobación de origen no reemplaza control de acceso.

## Límites y deuda consciente

El esquema inicial usa `CREATE TABLE IF NOT EXISTS`; los siguientes cambios de columnas necesitarán un sistema explícito de migraciones. La biblioteca y la lista de ejecuciones se cargan completas, sin paginación. No hay poda automática del historial ni garantías de creación exactamente una vez ante interrupciones de red: si una respuesta de guardado se pierde, revisa el historial antes de repetir.

Las reglas de texto no entienden contexto; las de JSON comprueban presencia, no corrección. El porcentaje no es una medida de calidad general. La siguiente decisión de producto debe basarse en los casos y discrepancias que detecte el usuario antes de introducir un juez LLM o puntuaciones ponderadas.
