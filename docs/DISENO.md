# Un laboratorio con identidad propia

Revisión de diseño: 17 de septiembre de 2026.

## El problema observado

La primera revisión manual confirmó que las funciones se entendían y funcionaban. El usuario señaló que la estructura repetía demasiado CareerOps: barra lateral, tarjetas y una variación de color. Solicitó investigar referentes actuales con adopción comprobable y cambiar la experiencia, conservando una apariencia sobria.

## Investigación y criterio

Las siguientes cifras son señales de adopción, no valoraciones de usuarios ni garantías de calidad. Se consultaron fuentes primarias; no se usaron listas patrocinadas de plantillas.

| Referencia                                                                                                    | Evidencia consultada                                                                                                                                                                                                                                                      | Decisión para EvalLab                                                                                                         |
| ------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| [Linear: A calmer interface for a product in motion](https://linear.app/now/behind-the-latest-design-refresh) | Artículo del equipo de diseño, 12 de marzo de 2026. Describe menos protagonismo de navegación, iconos y separadores.                                                                                                                                                      | Navegación superior discreta, contenido como foco y pocos acentos de color.                                                   |
| [Carbon de IBM: Data table](https://carbondesignsystem.com/components/data-table/usage/)                      | Guía de tablas con búsqueda, filtros y expansión progresiva de filas.                                                                                                                                                                                                     | Buscar y filtrar casos; desplegar evidencia dentro de la comparación sin abandonar el contexto.                               |
| [shadcn/ui](https://github.com/shadcn-ui/ui)                                                                  | Aproximadamente 124.1 mil estrellas en la página consultada de GitHub. Componentes abiertos y personalizables.                                                                                                                                                            | Tomar la composición de controles como referencia; crear una identidad propia en lugar de reproducir un dashboard de ejemplo. |
| [TanStack Table](https://github.com/TanStack/table)                                                           | Aproximadamente 28.4 mil estrellas en la página consultada. La [API oficial de npm](https://api.npmjs.org/downloads/point/2026-09-05:2026-09-11/@tanstack/react-table) devolvió 15,029,341 descargas de `@tanstack/react-table` entre el 5 y el 11 de septiembre de 2026. | Separar selección, búsqueda y presentación. Reservar una biblioteca de tablas para necesidades de escala más complejas.       |

GitHub presenta cifras redondeadas que pueden cambiar. Las descargas de npm incluyen instalaciones automatizadas y repetidas; no son un recuento de personas ni empresas. La ventana de npm es la que devolvió el servicio, no una proyección de la semana actual.

Son referencias de interacción, **no dependencias instaladas ni código copiado**. EvalLab conserva HTML, CSS y JavaScript propios: su tamaño y límite de 200 casos permiten resolver estos comportamientos sin incorporar React, una compilación o descargas externas. La tendencia se aplica a problemas concretos, no como requisito estético.

## La nueva experiencia

- **Casos:** índice seleccionable junto a una ficha de lectura; instrucción, respuestas A/B y criterios visibles en el mismo lugar. Editar es una acción explícita.
- **Búsqueda:** nombre, instrucción y reglas, ignorando mayúsculas y acentos; filtros de activos y pausados. No modifica ni pausa los casos.
- **Ejecución:** la barra inferior aclara que se evalúan todos los casos activos, aunque un filtro los oculte.
- **Resultados:** hoja de puntuación con desglose y explicación del denominador, seguida por resultados desplegables y revisión humana.
- **Comparación:** cada fila revela las respuestas, instrucciones y reglas congeladas de ambas ejecuciones. Las letras R/C indican referencia/comparación; los selectores conservan la variante A/B original.
- **Identidad:** papel cálido, texto oscuro, títulos con tipografía serif y anotaciones monoespaciadas. Verde tenue para selección y cumplimiento; ámbar para incumplimientos. El estado siempre incluye texto.

## Adaptación y comprobación

En escritorio, la lista y la ficha comparten espacio. En móvil se apilan; elegir un caso lleva a su ficha. La lista tiene desplazamiento limitado para bibliotecas grandes. Las respuestas extensas conservan saltos de línea y pueden desplazarse dentro de su panel.

Se usan controles nativos de formulario, `dialog` y `details`, foco visible, acceso directo al contenido y botones con selección anunciada. No se añaden animaciones, fuentes remotas ni llamadas de terceros. Esto no equivale a una certificación de accesibilidad.

Las pruebas de navegador cubren el recorrido original, búsqueda sin perder el foco, selección con teclado, filtros vacíos, conservación de datos, evidencia de comparación y anchos de 320 a 390 píxeles con fuente alternativa. Las pruebas usan bases separadas. La aprobación visual de esta nueva versión corresponde a la siguiente revisión del usuario.
