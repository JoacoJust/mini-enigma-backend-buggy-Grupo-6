# Como desencriptar el listado de errores

El archivo `docs/errores-encriptados.json` contiene, cifrado, el listado
completo de los errores intencionalmente introducidos en este backend
(mas de 10, con su ubicacion en el codigo y su efecto). Se mantiene cifrado
en el repositorio a proposito, para que no sea legible con un simple
`grep`/lectura del repo.

## Que hay dentro del archivo

`errores-encriptados.json` fue generado con el algoritmo **Vigenere** y
sigue el formato estandar de salida de una herramienta de cifrado clasico:
incluye el texto cifrado (`contenidoEncriptado`), el algoritmo usado y,
en el campo `claveDesencriptacion`, la clave/parametros necesarios para
revertirlo. Es decir, el propio archivo trae todo lo necesario para
desencriptarlo — no hace falta ningun secreto externo.

## Como desencriptarlo

1. Cloná o pedí acceso al repositorio de la herramienta usada para generar
   el archivo (proyecto `mini-enigma`, un CLI de cifrado clasico en
   Node.js).
2. Instalá sus dependencias:
   ```bash
   cd mini-enigma
   npm install
   ```
3. Ejecutá el comando de desencriptado pasando el archivo cifrado:
   ```bash
   node src/index.js decrypt --from-file errores-encriptados.json --save-txt errores.txt
   ```
4. El texto plano queda guardado en `errores.txt`. Vas a ver el listado
   numerado de errores, cada uno con: archivo/funcion donde esta, en que
   consiste, y que efecto produce.

Nota: al desencriptar, el texto recuperado queda en mayusculas y sin
tildes (normalizacion propia del cifrado clasico usado). Esto no afecta la
legibilidad del listado.
