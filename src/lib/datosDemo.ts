// Registro de los datos de demostración que traían las primeras versiones de
// Solibook. La aplicación ya NO siembra datos de ejemplo (ver AppContext), pero
// los equipos donde alcanzaron a sincronizarse necesitan poder retirarlos.
//
// Solo se listan los identificadores exactos que usaba la demostración. Los
// registros reales se crean con marcas de tiempo (`int-<hora>`, `ev-<hora>`,
// `as-<hora>-…`, `doce-<hora>`, …), así que esta limpieza nunca borra
// información ingresada por el ministerio.

export const IDS_DATOS_DEMO = {
  integrantes: [
    'int-01',
    'int-02',
    'int-03',
    'int-04',
    'int-05',
    'int-06',
    'int-07',
    'int-08',
    'int-09',
    'int-10'
  ],
  eventos: ['ev-01', 'ev-02', 'ev-03', 'ev-04'],
  asistencias: ['as-01', 'as-02', 'as-03', 'as-04'],
  cartas: ['car-01', 'car-02'],
  actas: ['act-01'],
  justificaciones: ['just-01'],
  notificaciones: ['notif-01', 'notif-02'],
  documentos: [],
  documentosEvento: []
} as const;

export type ColeccionConDemo = keyof typeof IDS_DATOS_DEMO;

export const idsDemoDe = (coleccion: ColeccionConDemo): string[] => [
  ...IDS_DATOS_DEMO[coleccion]
];

export const esIdDemo = (coleccion: ColeccionConDemo, id: string): boolean =>
  (IDS_DATOS_DEMO[coleccion] as readonly string[]).includes(id);

// Quita de una lista los registros que pertenecían a la demostración.
export const filtrarDatosDemo = <T extends { id: string }>(
  coleccion: ColeccionConDemo,
  items: T[]
): T[] => items.filter(item => !esIdDemo(coleccion, item.id));
