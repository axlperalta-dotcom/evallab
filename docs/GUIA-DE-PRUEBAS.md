# Tu primera sesión con EvalLab

No necesitas programar. Tu papel es revisar si el resultado tiene sentido y si la aplicación permite entender por qué ocurrió.

La pestaña **Guía** de la aplicación reúne estas instrucciones con un ejemplo, el significado de las reglas y las condiciones de privacidad y uso. Puedes consultarla sin modificar los casos ni las ejecuciones.

## Recorrido de diez minutos

1. Abre http://127.0.0.1:3001. En el índice, selecciona un caso: su ficha muestra instrucción, A/B y reglas. Usa **Editar caso** para modificarlo. Prueba la búsqueda y el filtro de estado; no alteran qué casos se evalúan.
2. En «Una respuesta breve y útil», compara A y B. La respuesta B no incluye «datos».
3. Ejecuta A y abre sus resultados. Dos casos cumplen y dos no cumplen: 50%.
4. Abre «Evitar promesas absolutas». La respuesta dice «no garantiza cero errores», pero la regla encuentra el fragmento excluido. Marca **Estoy en desacuerdo** y explica por qué.
5. Recarga, entra a Ejecuciones y vuelve a abrir el resultado: tu revisión debe seguir ahí y el resultado automático no debe haber cambiado.
6. Ejecuta B con los mismos casos. En Comparar verás otro 50%, pero en casos distintos. Despliega una fila para ver las respuestas originales de ambas ejecuciones. Comprueba que ahora se entiende por qué un empate no basta.
7. Modifica una regla, guarda y ejecuta otra vez. Al comparar con una ejecución anterior, debe aparecer un aviso de criterios diferentes.
8. Crea un caso propio, prueba guardarlo sin reglas y confirma que te pide corregirlo sin perder lo escrito.
9. Pausa ese caso y comprueba que la siguiente ejecución no lo incluya. Elimínalo si ya no lo necesitas; las ejecuciones anteriores deben conservarlo.
10. Prueba una ventana estrecha, Tab y Escape. La navegación y los formularios deben seguir siendo utilizables.

Los errores del motor se comprueban mediante pruebas automatizadas; los cuatro ejemplos iniciales tienen reglas válidas. No necesitas provocar un fallo técnico para revisar el producto.

## Un caso propio sencillo

- Nombre: Respuesta para una entrevista.
- Instrucción: Explica el objetivo de CareerOps usando las palabras vacantes y proyectos, en no más de 150 caracteres.
- Respuesta A: CareerOps organiza vacantes y proyectos para reunir evidencia de trabajo.
- Respuesta B: Es una aplicación útil para organizar cosas.
- Reglas: debe incluir `vacantes, proyectos`; longitud máxima `150`.

Es un ejercicio de coincidencia de texto. No califica tu preparación para una entrevista ni la calidad completa de la explicación.

## Qué reportar

```text
Pantalla: Casos / Ejecuciones / Comparar / Guía
Qué hice:
Qué esperaba:
Qué ocurrió:
¿Puedo repetirlo?:
Impacto: me bloquea / me dificulta / detalle visual
```

También sirven observaciones como «no entiendo qué cuenta este porcentaje», «no encuentro dónde cambiar una respuesta» o «esta regla está calificando algo distinto de lo que quiero». Esas decisiones guían la siguiente versión.

## Comprobar español e inglés

1. Cambia **Idioma → English** en el encabezado. Revisa Cases, Runs, Compare y Guide.
2. Abre un caso existente: su contenido original debe permanecer igual, aunque los controles estén en inglés.
3. Recarga: la interfaz debe seguir en inglés. Vuelve a **Language → Español** para recuperar el español.
4. Escribe una revisión sin guardarla, cambia de idioma y comprueba que la nota y la valoración se conservan.
5. Prueba el selector en una ventana estrecha. Si tu navegador bloquea el almacenamiento, la aplicación debe permitir cambiar de idioma y avisar que no pudo guardar la preferencia.
