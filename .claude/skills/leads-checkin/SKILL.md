---
name: leads-checkin
description: >-
  Recopila los números de salud de tu equipo para el check-in async de leads —
  flujo de bugs (creados vs resueltos), composición del backlog abierto, SLOs rotos,
  action items de post-mortems y hallazgos de seguridad — y redacta la respuesta en el
  formato que pide el head de engineering. Recibe la project key como argumento
  (`/leads-checkin ABCD`), así que sirve para cualquier equipo.
  Read-only contra todas las fuentes; prepara un BORRADOR, nunca publica.
  Triggers: leads checkin, check-in de leads, bugs de mi equipo, tendencia de bugs,
  status async para la reunión de leads, cuántos bugs abiertos tenemos, /leads-checkin.
---

# Leads check-in — los números de un equipo, con la respuesta redactada

> **Modelo sugerido: Sonnet.** Recopilar de fuentes conocidas con JQL fijo y redactar el
> borrador — síntesis rutinaria, no juicio abierto.

`/leads-checkin <PROJECT_KEY>` — por defecto `{{JIRA_PROJECT_KEY}}`. Sin argumento y sin ese token
relleno, **pregunta** qué equipo: correrlo sobre el proyecto equivocado produce un informe seguro
y falso delante de todo engineering.

## Para qué es

Cada cierto tiempo el head de engineering pide a todos los leads lo mismo, en async, en
`#engineering-leads` (`C08E0SK5PR7`): cuántos bugs abiertos, si la tendencia es positiva, qué
estáis haciendo, y qué está roto. Esta skill recopila esos números **para un equipo** y redacta la
respuesta.

No es un dashboard. El dashboard de la org es la referencia compartida que todos están mirando;
tu trabajo es **reconciliar** contra él y añadir el contexto que solo tiene el lead.

## Configuración

Los valores **por equipo** los rellena `/setup`. Si alguno sigue como `{{...}}`, pregúntalo antes
de correr — no lo adivines.

| Qué                        | Valor                                                                       |
| -------------------------- | --------------------------------------------------------------------------- |
| Equipo                     | {{TEAM}}                                                                    |
| Project key (Jira)         | {{JIRA_PROJECT_KEY}}                                                        |
| Tag de observabilidad      | {{DATADOG_TEAM_TAG}}                                                        |
| Servicio propio del squad  | {{DATADOG_SERVICE}}                                                         |
| Repos del squad            | {{TEAM_REPOS}}                                                              |

Y los que son **iguales para toda la org**, ya rellenados:

| Qué                          | Valor                                                                  |
| ---------------------------- | ---------------------------------------------------------------------- |
| `cloudId`                    | `feverup.atlassian.net`                                                |
| Proyecto de seguridad        | `CYSEC` (lo lleva el equipo de security)                               |
| Label de post-mortems        | `post-mortem`                                                          |
| Label de vulnerabilidades    | `vulnerability`                                                        |
| Dashboard SLA post-mortems   | `https://feverup.atlassian.net/jira/dashboards/12109`                  |
| Dashboard SLA cybersecurity  | `https://feverup.atlassian.net/jira/dashboards/11187`                  |
| SLOs rotos (Datadog)         | `app.datadoghq.com/slo/manage?query=tags:*engineering_leads state:breached` |

Lo que no esté configurado se reporta como **no comprobado**, nunca como cero.

> Los ejemplos numéricos de esta skill vienen de un squad real (Distribution-Resellers, agosto
> 2026). Están para enseñar **la forma del razonamiento**, no como valores por defecto: tus
> números serán otros. Ninguno debe acabar en tu borrador.

## Paso 0 — Reconciliar con las cifras publicadas, ANTES de nada

El head publica un gráfico (`bugs-by-team-<org>-<meses>.png`). Reproduce sus números **para tu
equipo** con tu propia query y confirma que cuadran. `searchResultMode: "count"` — quieres totales,
no issues.

```
project = <KEY> AND issuetype = Bug AND created >= "<inicio>" AND created <= "<fin>"
project = <KEY> AND issuetype = Bug AND resolutiondate >= "<inicio>" AND resolutiondate <= "<fin>"
```

Cuando cuadran, **dilo en el borrador**: es lo que hace creíble todo lo demás. Significa que tu
metodología *es* la de la org, y que cualquier extensión (otro mes, un desglose) es directamente
comparable.

_Ejemplo de calibración:_ para un squad y la ventana May–Jul 2026 estas dos queries dieron
**54 creados / 48 resueltos → neto −6**, idéntico al gráfico del head.

Si **no** cuadran, para y averigua por qué antes de redactar. Publicar un número que contradice el
gráfico compartido sin explicar la diferencia se lee como error o como maquillaje, y ambos cuestan
más que la discrepancia.

## Paso 1 — Flujo de bugs: la tendencia, no el total

Un solo neto trimestral esconde la forma. Saca **por mes**, más el mes en curso (MTD):

| Mes | Creados | Resueltos | Neto |
| --- | ------- | --------- | ---- |

Un trimestre en negativo **por un solo mes malo**, con los siguientes en break-even o positivo, es
una situación distinta de un deterioro sostenido — y la pregunta "qué estáis haciendo" tiene una
respuesta muy diferente en cada caso.

El **MTD es la señal más actual que tienes** y normalmente no está en el gráfico de la org.
Inclúyelo siempre.

## Paso 2 — Composición del backlog: stock, no solo flujo

```
project = <KEY> AND issuetype = Bug AND statusCategory != Done ORDER BY created ASC
```

Este resultado es grande (~70k caracteres para 14 bugs con todos los campos). Pide **solo** `key`,
`summary`, `status`, `priority`, `created`, `assignee`; si aún desborda, guárdalo en un fichero y
post-procésalo con `jq` en vez de meterlo dos veces en contexto.

Reporta:

- **Buckets de edad** — `≤30d` / `31–90d` / `91–180d` / `>180d`. La cola larga es lo accionable.
- **Split de prioridad**, y nombra cada High/Critical individualmente con su edad.
- **Cuántos sin asignar.** Suele ser el número más accionable de todo el informe.
- **Los más viejos**, con key, edad y dueño.

Flujo y stock cuentan historias distintas. Un equipo puede estar **en rojo de flujo teniendo uno de
los backlogs más pequeños de la org**. Si es tu caso, dilo con la comparación: el gráfico solo no
lo muestra.

## Paso 3 — SLOs rotos

```
search_datadog_slos(query="{{DATADOG_TEAM_TAG}} state:breached")
```

Por cada uno: nombre, **target vs real**, y **error budget consumido**. El budget es la cifra que
ordena la lista — un SLO a −126% y otro a −27% no son el mismo problema aunque los dos digan
"breached".

⚠️ **El MCP de Datadog se desconecta a menudo** (no siempre es el token: el servidor entero puede
desaparecer a mitad de sesión). Si no responde: re-auth **una vez** vía `/mcp` y ya. Si sigue
caído es un **hueco a reportar**, no un cero — escribe "no recuperado — <razón>" y pasa el link
para sacarlo a mano. Nunca hagas retry-storm contra un token muerto.

Comprueba una vez si tienes ruta alternativa (`DD_API_KEY`/`DD_APP_KEY` en el entorno, entrada
`datadoghq` en `~/.netrc`). Si no la hay, anótalo y no la vuelvas a buscar cada vez; `WebFetch` no
sirve porque la URL requiere auth.

### Dos lecturas que valen más que la lista

**1. Error budgets idénticos = una sola causa, no N problemas.** Si dos SLOs comparten el consumo
de budget **al decimal**, están quemando budget en los mismos momentos. Convierte "3 SLOs rotos"
en "2 causas raíz", que es una respuesta bastante mejor a "qué vais a hacer".

_Ejemplo real:_ *Registration funnel latency* y *Reservation creation notification timing*
estaban los dos exactamente a **−27,314814814819144% / −708s**, ambos time-slice sobre el mismo
servicio compartido.

**Pero no te quedes en la correlación — mira la serie.** El budget idéntico dice *que* comparten
causa; solo la métrica dice *cuál*. Ver el Paso 3b.

**2. ¿El servicio es nuestro o compartido?** Mira los `service_tags`. Los SLOs propios del squad
son `service:{{DATADOG_SERVICE}}`; si el SLO mide un servicio de plataforma compartido, la causa
raíz puede ser de otro equipo aunque el SLO y la instrumentación sean tuyos (mira `creator`).

Dilo en el borrador antes de comprometer fechas. Reclamar un SLO compartido como propio y
desentenderse de uno que sí es tuyo están mal en las dos direcciones.

## Paso 3b — Investiga la serie: "roto" no dice qué está roto

**Un SLO roto no es un hallazgo, es una pregunta.** El head no pregunta cuáles están rotos — eso
lo ve él en su link. Pregunta *qué medidas vas a tomar*, y eso depende enteramente de la **forma**
de la degradación. Saca la métrica del SLO a 30 días y mírala:

```
get_datadog_metric(
  queries=["avg:<métrica>{*}.rollup(max, 86400)"],
  from="now-30d", raw_data=true)
```

`rollup(max, 86400)` = un punto por día, el peor del día. El rollup va **dentro** del string de
query; pasarlo como parámetro raíz da `unexpected additional properties`.

Luego calcula la **mediana** y saca los días que la superan por bastante. Hay tres formas, y cada
una lleva a una medida distinta:

| Forma                | Cómo se ve                     | Medida que toca                                             |
| -------------------- | ------------------------------ | ----------------------------------------------------------- |
| **Picos periódicos** | mismo día de la semana         | ⚠️ cruza con volumen ANTES: puede ser artefacto, no carga    |
| **Eventos aislados** | 1–2 días a 50–100x, mediana OK | RCA de esos eventos; escalar no arregla nada                 |
| **Deriva**           | la mediana sube sola           | regresión de rendimiento; busca el deploy                    |

_Ejemplo real,_ donde tres SLOs rotos eran **dos problemas distintos**:

- Dos de ellos se disparaban **los mismos sábados** (25-jul, 01-ago, 08-ago), subiendo 2,1x → 2,4x
  → **2,9x** la mediana en tres sábados consecutivos. La pendiente era el hallazgo, no el nivel.
- El tercero tenía la mediana perfectamente sana (7,2s) y quemó su −126% de budget en **dos días**
  (375.859ms y 786.670ms). Ahí escalar no arregla nada; toca RCA de esos dos eventos.

Sin este paso el borrador habría dicho "3 SLOs rotos, vamos a mirarlo". Con él dice qué son, cuál
atacas primero y por qué — que es lo que preguntaban.

### Antes de culpar al servicio: cruza latencia contra VOLUMEN

**Este es el paso que más veces evita una conclusión falsa.** Un SLO sobre una métrica `.avg`
puede romperse sin que el servicio se haya degradado nada.

```
sum:<métrica>.count{*}.rollup(sum, 86400)      # volumen/día
avg:<métrica>.median{*}.rollup(max, 86400)     # mediana
avg:<métrica>.avg{*}.rollup(max, 86400)        # media
```

Y calcula la **correlación volumen ↔ latencia**:

- **Correlación positiva** → saturación de verdad. Más carga, más lento. Toca capacidad.
- **Correlación negativa** → **artefacto de pocas muestras**. A menos tráfico, más latencia
  _medida_. No es el servicio: es el SLI.

Dos confirmaciones de que es artefacto:

1. Los días pico están entre los de **menor volumen**.
2. **Mediana y media coinciden al decimal** en esos días → el bucket que dispara el SLO tenía
   prácticamente **una sola muestra**.

_Caso real:_ dos métricas daban correlación **−0,42** y **−0,26**. El peor día de latencia
(705ms) fue el de **menor volumen del mes (n=59)**, y los días de más tráfico (n=498, n=467)
tenían latencia normal (~555ms). El tráfico B2B cae a un tercio el fin de semana; una petición
lenta *es* la media del bucket de 10s, el time-slice marca la ventana como mala y se come el
budget. Escalar no habría cambiado nada. La medida correcta era **arreglar el SLI**.

> **La lección general:** que dos SLOs compartan error budget dice *que* comparten causa, nunca
> *cuál*. La forma de la serie tampoco basta — "picos los sábados" parecía saturación y era lo
> contrario. **Solo el volumen distingue degradación de artefacto.** No propongas una medida
> hasta haber cruzado ese eje.

⚠️ **Y al revés: no uses esto como excusa.** "El SLI está mal definido" es una afirmación fuerte
delante de tu VP y se parece mucho a maquillar la métrica. Solo es legítima con los tres datos
delante (correlación negativa, picos en días de bajo volumen, mediana==media), y el SLO corregido
tiene que **seguir detectando degradación real**. Si la corrección solo hace que deje de sonar,
es maquillaje.

### Valida la hipótesis contra las FECHAS antes de escribirla

Una firma en una métrica **sugiere** una causa; no la demuestra. Antes de poner una causa en el
borrador, busca la métrica que tendría que confirmarla y comprueba que **los días cuadran**.

_Caso real,_ tercera corrección seguida de la misma investigación: una métrica marcaba `.max` de
**58 días** y **46 días** en dos fechas. Firma clásica de reprocesamiento de cola antigua — la
historia encajaba perfectamente. Pero la métrica de edad de cola daba:

```
                    métrica .max      edad de cola .max
fecha 1                58,1 días             10,0 días    ✗
fecha 2                46,3 días              1,0 día     ✗✗
```

Si fuese drenaje de backlog, la edad de cola tendría que ser **al menos** tan grande. En la
segunda fecha era **46 veces menor**. Y el pico real de edad de cola (76 días) no cae en un día de
breach. Hipótesis descartada.

Comprueba también que la métrica de control **cubre** el sistema que investigas: si el flujo no
pasa por ese worker, no cuadrarían nunca y el "no cuadra" no significaría nada. Descartar por la
fuente equivocada es tan malo como confirmar por ella.

> **Escribe "causa abierta" sin complejo.** Un RCA honesto con el siguiente paso definido
> ("trazas de esas dos ventanas") vale más ante un VP que una causa plausible que se cae en
> cuanto alguien la comprueba. Y se caerá: la persona que la revise tiene los mismos dashboards.

### El patrón de esta investigación, que es el que hay que romper

Esta misma pregunta se respondió mal **tres veces** antes de acertar, y cada respuesta era
coherente y accionable:

| Ronda | Evidencia                        | Conclusión                       | Por qué era falsa               |
| ----- | -------------------------------- | -------------------------------- | ------------------------------- |
| 1     | error budgets idénticos          | "una sola ventana de degradación" | correlación ≠ causa             |
| 2     | picos los mismos sábados         | "saturación de finde, escalar"   | el volumen era el **más bajo**  |
| 3     | `.max` de 58 días                | "drenaje de cola"                | las fechas no cuadraban         |

Cada ronda usó evidencia real y sacó la conclusión equivocada, y la ronda 2 habría comprometido
públicamente a un trabajo de capacidad que no arreglaba nada. **La regla:** en cada ronda,
pregúntate qué dato *refutaría* tu conclusión, y ve a buscarlo antes de escribirla. Si no se te
ocurre ninguno, no tienes una conclusión — tienes una historia.

**Cruza con incidencias declaradas** (`search_datadog_incidents`) para los días pico. Ojo: si esa
búsqueda devuelve **0 incidencias en toda la org en 30 días**, es mucho más probable que signifique
"aquí no se usa Datadog Incidents" que "no hubo ninguna". No lo reportes como "nadie declaró
incidencia" — eso es una acusación construida sobre una query vacía.

## Paso 4 — Action items de post-mortems

Los post-mortems son un **label transversal**, no un proyecto propio. Query el label, scoped a tu
proyecto:

```
project = <KEY> AND labels = "post-mortem"
project = <KEY> AND labels = "post-mortem" AND statusCategory != Done
```

Reporta **los dos**: total histórico y abiertos ahora. "12 en total, 0 abiertos" es mucho más
fuerte que "0 abiertos" a secas, porque demuestra que el proceso se usa, no que se ignora. Añade
el total org-wide para dar escala — un 0 propio contra decenas de la org dice algo; un 0 solo, no.

✅ **Esto NO es un proxy.** El dashboard 12109 se apoya en el filtro guardado **24112
`[Metrics] Open Post-Mortem Actions`**, cuyo JQL es literalmente
`labels = "post-mortem" AND statusCategory != Done`. Es exactamente la query de arriba. Puedes
afirmar el número como el del dashboard, sin coletilla defensiva.

## Paso 5 — Hallazgos de seguridad

El dashboard 11187 es *Pentesting&Bugbounty Stats* y **no** mira `CYSEC`: mira el label
`vulnerability` en cualquier proyecto. Los SLAs de resolución son por severidad, medidos sobre la
**antigüedad**:

```
labels in (vulnerability) AND statusCategory != Done AND project = <KEY>          # abiertas
labels in ("vulnerability") and status NOT IN (close,closed,done) and priority IN (Highest) and created <= -2d   # Critical, SLA roto
labels in ("vulnerability") and status NOT IN (close,closed,done) and priority IN (High)    and created <= -7d   # High
labels in ("vulnerability") and status NOT IN (close,closed,done) and priority IN (Medium)  and created <= -60d  # Medium
```

⚠️ **La trampa: `Low` no tiene SLA de resolución.** El dashboard solo define umbrales para
Critical / High / Medium. Así que una vulnerabilidad `Low` **nunca** aparece como SLA roto por
vieja que sea, y "0 SLA rotos ✅" puede estar tapando algo abierto desde hace un año.

Comprueba siempre la **edad** de las abiertas, no solo si incumplen. _Caso real:_ un squad tenía 0
SLA rotos y, a la vez, una vulnerabilidad abierta desde hacía **287 días** (acceso a órdenes ajenas
conociendo el `reservation_id`), `Low` y asignada al propio lead. Reportar solo el verde habría
sido exactamente el "verde no ganado" que esta skill prohíbe — y se cae solo en cuanto alguien
abre el ticket.

Buscar en `CYSEC` por repo es **otra cosa**: son hallazgos internos (secretos, offsec), no
pentesting, y no los mide el 11187. No los mezcles.

## Paso 6 — Redactar la respuesta

**Formato e idioma de quien pregunta.** El head pide literalmente un mensaje con `Equipo <x> 🧵` y
los items dentro del hilo, "para tenerlo ordenadito". Úsalo exactamente: un lead que reformatea la
petición crea trabajo a quien recopila. **En español.**

Por eje: **el número → la tendencia → la medida**.

### El ejemplo canónico — cópiale el registro, no solo la estructura

Mensaje real de un lead (squad Distribution-Resellers, 2026-08-10). **Es la calibración de esta
skill.** Son ~200 palabras y cuatro bullets. La primera versión que generó esta skill tenía ~900 y
seis secciones, y era inservible por larga.

````
• *Bugs — en rojo en el trimestre (−6), pero la tendencia ya giró*
May–Jul: *54 creados / 48 resueltos → neto −6*. Reproduzco exactamente el gráfico con JQL, así que todo lo de abajo es comparable.

El −6 es prácticamente todo junio:

```Mes              Creados  Resueltos   Neto
Mayo                  20         19     -1
Junio                 14          9     -5
Julio                 20         20      0
Agosto (1-10)          4          5     +1```
Julio cerró en break-even y *agosto va en positivo*. Backlog abierto hoy: *14 bugs* (el gráfico marca 17, es un corte anterior).

• *SLOs rotos — 3, todos de latencia/timing*
```SLO                                              Target   Real    Budget
Booking agent - Registration funnel latency       99.9%   99.87%   -27%
Reservation creation notification timing          99.9%   99.87%   -27%
Booking agent purchase confirmation notification    99%   97.74%  -126%```
Los tres teníamos el SLI desactualizado. Se han arreglado dos. El tercero en camino

• *SLAs de Post Mortems*
*12 action items de post-mortem, 0 abiertos.* Ninguno incumpliendo SLA, y ningún cambio de proceso pendiente por este punto.

• *SLAs de Cybersecurity*
*1 abierta.* Ninguna incumple SLA (Critical >2d: 0 · High >7d: 0 · Medium >60d: 0).
````

Las reglas que salen de ahí, y que no son negociables:

- **`•` por punto, y el titular lleva el veredicto, no el tema.** *"Bugs — en rojo en el trimestre
  (−6), pero la tendencia ya giró"*, no *"Bugs"*. Quien lee ocho hilos seguidos solo lee los
  titulares; si el tuyo dice el tema, no ha dicho nada.
- **mrkdwn de Slack, no Markdown.** `*negrita*` con **un** asterisco. `**esto**` sale literal y
  canta.
- **Las tablas van en bloque de código**, que es lo único que preserva la alineación en Slack.
- **Una a tres frases por punto.** Todo el contexto que no quepa ahí, no va.
- **Cada número trae su comparación** cuando la tiene: *"el gráfico marca 17, es un corte
  anterior"*, *"el backlog más pequeño del grupo"*. Un número solo no dice si es bueno.

### Lo que NO va dentro del mensaje

**Nada de `⚠️ PENDIENTE` en el texto que se publica.** Los huecos van visibles en el borrador que
le pasas al lead (§ siguiente) y **fuera** del mensaje. Un `PENDIENTE` publicado delante de todo
engineering no es honestidad, es dejar el deber a medias en público.

Cuando una medida no está decidida hay dos salidas honestas y ninguna es un placeholder:

- **Decir el estado real** — *"los tres teníamos el SLI desactualizado, se han arreglado dos, el
  tercero en camino"* cierra el punto sin comprometer una fecha inventada.
- **Decir que sigues en ello, con el porqué** — *"la evidencia apunta a SLI, pero los sábados
  empeoran solos y eso no lo explica; sigo antes de tocarlo"*. Una causa abierta con el siguiente
  paso nombrado es una respuesta completa.

Fuera del mensaje, en el borrador, sí listas las decisiones que necesitas del lead.

**Cruza los ejes antes de redactar.** El mismo ticket puede aparecer en dos sitios, y presentarlo
como dos problemas infla tu propio informe y se nota. _Caso real:_ un ticket era a la vez uno de
los dos bugs de >180d (punto 1) y la única vulnerabilidad abierta (punto 4) — una sola decisión,
referenciada desde ambos puntos.

### La regla que más importa: nunca inventes las medidas

Los números se recopilan. **Las medidas son decisión del lead** — una pasada de asignación, un
slot de bugs por sprint, cerrar la cola larga como won't-fix. Escribir una medida plausible en el
borrador compromete a {{NAME}}, delante de su VP, con algo que no ha acordado. Es lo más dañino
que esta skill podría hacer.

Por tanto:

1. Recopila y presenta todos los números.
2. **Pregunta** cuáles son las medidas, nombrando las decisiones concretas que los datos plantean —
   el montón sin asignar, los más viejos, cualquier High que lleve tiempo parado.
3. Marca lo que siga sin decidir como `⚠️ PENDIENTE` **visible en el borrador, nunca en el mensaje
   publicado** (ver arriba). Un hueco visible para el lead está bien; un compromiso inventado no; y
   un `PENDIENTE` delante de todo engineering, tampoco.

Puedes **proponer** medidas, claramente etiquetadas como propuestas y ancladas en los números. No
puedes escribirlas como si estuvieran decididas.

### La ausencia de evidencia no es evidencia

Una fuente que no pudiste alcanzar, una query que no devolvió nada, y un resultado genuinamente
limpio son tres hallazgos distintos que se ven idénticos en un resumen.

- Query corrió, vacía de verdad → "0 abiertos, verificado con `<query>`".
- Fuente caída → "no recuperado — <razón>", más el link.
- Sin configurar → "no comprobado".

Nunca dejes que el segundo o el tercero se lean como el primero. Esto es un informe de status a un
manager: un verde no ganado es peor que un hueco honesto, y es el modo de fallo que sobrevive más
tiempo antes de que lo pillen.

## Read-only, y solo borrador

Todas las fuentes son de lectura: sin transiciones, sin comentarios, sin editar issues, sin tocar
monitores. La respuesta se **deja como borrador** para que {{NAME}} la revise y la envíe —
publicar en un canal donde está todo engineering es del lead, no de la skill.

### El mensaje se entrega AQUÍ, en el chat, listo para copiar

Nada de ficheros ni de buscar el hilo. El lead ya está en el canal: lo que necesita es el texto
final delante, en **un solo bloque de código**, para seleccionarlo y pegarlo.

- **Un bloque, y dentro solo el mensaje.** Ni encabezados, ni notas, ni instrucciones. Todo lo que
  esté dentro del bloque se va a pegar en Slack, así que si no va en Slack, no va dentro.
- **Ya en mrkdwn de Slack** — `*negrita*` con un asterisco, tablas en su propio bloque. Lo que se
  copia es lo que se publica; no dejes conversión pendiente.
- **Las decisiones que necesitas van fuera del bloque**, después, en texto normal.

*(Esta sección sustituye a una versión que buscaba el hilo en Slack y adjuntaba el permalink. Se
retiró el 2026-08-11: añadía una dependencia del MCP de Slack y un modo de fallo real — la query
buscaba el emoji `🧵` en vez de `:thread:` y devolvía cero contra un hilo que existía — para
ahorrar un clic a quien ya tiene el canal abierto.)*

## Apéndice — Cómo averiguar qué mide un dashboard de Jira

El MCP de Atlassian **no expone dashboards**. Pero el token de `~/.netrc` sí llega a la REST API
(`GET /rest/api/3/myself` → 200), y con eso se decodifica cualquier dashboard en tres pasos. Es la
diferencia entre reportar un proxy y reportar el número del dashboard.

```bash
# 1. Qué es el dashboard y qué gadgets tiene
curl -s -n "https://feverup.atlassian.net/rest/api/3/dashboard/<ID>"
curl -s -n "https://feverup.atlassian.net/rest/api/3/dashboard/<ID>/gadget"

# 2. Los gadgets se apoyan en filtros guardados — búscalos por nombre, con su JQL
curl -s -n --get "https://feverup.atlassian.net/rest/api/3/filter/search" \
  --data-urlencode "filterName=<texto>" --data-urlencode "expand=jql"

# 3. Cuenta con la JQL del filtro, scoped a tu proyecto
curl -s -n -X POST "https://feverup.atlassian.net/rest/api/3/search/approximate-count" \
  -H "Content-Type: application/json" --data '{"jql":"<jql> AND project = <KEY>"}'
```

Tres cosas que cuestan tiempo si no las sabes:

- **`/rest/api/3/search/jql` NO devuelve `total`.** Para contar usa
  `/rest/api/3/search/approximate-count` (POST), o el MCP con `searchResultMode: "count"`.
- Los gadgets **no** exponen su JQL en `/items/<id>/properties` (devuelve vacío). La ruta que
  funciona es buscar el filtro por nombre con `expand=jql`.
- Los dashboards de esta org filtran por **label transversal**, no por proyecto — por eso no
  aparecen buscando proyectos. `post-mortem` para el 12109, `vulnerability` para el 11187.

Nunca eches el token por pantalla: `curl -n` lo lee de `~/.netrc` solo.
