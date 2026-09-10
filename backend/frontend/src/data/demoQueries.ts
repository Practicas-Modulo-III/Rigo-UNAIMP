import type { BookDoc } from '@/types';

export interface DemoQuery {
  question: string;
  answer: string;
  sources: BookDoc[];
}

/** Preguntas de ejemplo para los chips de sugerencias del kiosco. */
export const SUGGESTED_QUESTIONS: string[] = [
  '¿Dónde encuentro el tratado de pintura de Leonardo?',
  '¿Qué libro tienen sobre técnicas mixtas?',
  'Busco una biografía de Giotto.',
  '¿Tienen tesis sobre pintura mural piurana?',
  '¿Qué obras hay de Ignacio Merino?',
  '¿Dónde hallo información sobre los sombreros de paja toquilla?',
  '¿Qué libro tienen sobre escultura virreinal?',
  '¿Tienen algo sobre la historia de Piura?',
  '¿Dónde encuentro libros sobre la cerámica de Chulucanas?',
];

/**
 * Catálogo ficticio de respaldo: mientras el fondo bibliográfico indexado en
 * el backend crece, RIGO responde con estos ejemplares para siempre mostrar
 * al menos 3 resultados similares a la consulta del usuario.
 */
const MOCK_CATALOG: BookDoc[] = [
  {
    id: '750.01',
    title: 'Tratado de la Pintura y del Paisaje',
    author: 'Leonardo Da Vinci',
    category: 'Talleres y Plástica',
    year: 1978,
    location: { pasillo: 1, estante: 'Estante 2', tagCode: 'P1-E2' },
    page: 1,
    rigoSummary:
      'Tratado clásico sobre composición, perspectiva y técnicas del paisaje. Reúne los apuntes de Leonardo sobre luz, sombra, proporción y atmósfera, con ejercicios prácticos de encuadre para estudiantes de talleres de pintura. Incluye anexo comparativo con técnicas del paisajismo renacentista italiano.',
    status: 'available',
  },
  {
    id: '750.02',
    title: 'Temas Varios: Técnicas Mixtas',
    author: 'José María Parramón',
    category: 'Talleres y Plástica',
    year: 1985,
    location: { pasillo: 1, estante: 'Estante 2', tagCode: 'P1-E2' },
    page: 1,
    rigoSummary:
      'Manual práctico de acuarela, óleo, collage y técnicas mixtas orientado a talleres de nivel intermedio. Detalla procedimientos paso a paso, combinación de materiales y mantenimiento de herramientas, con ejemplos fotográficos de cada etapa del proceso creativo.',
    status: 'available',
  },
  {
    id: 'BIOG.01',
    title: 'Forma y Color. Giotto los Frescos de Asís',
    author: 'Sadea Ed.',
    category: 'Biografías',
    year: 1975,
    location: { pasillo: 2, estante: 'Estante A', tagCode: 'P2-EA' },
    page: 1,
    rigoSummary:
      'Análisis biográfico y visual de los frescos de Giotto en la Basílica de Asís. Recorre su evolución estilística, el contexto religioso del encargo y su influencia decisiva en la pintura occidental posterior, con reproducciones a color de los principales ciclos murales.',
    status: 'available',
  },
  {
    id: 'TESIS.14',
    title: 'El Mural Contemporáneo en Piura: Técnica y Discurso Visual',
    author: 'Rosa Elena Chunga Timaná',
    category: 'Tesis',
    year: 2019,
    location: { pasillo: 0, estante: 'Archivo de Tesis', tagCode: 'ARCH-TESIS' },
    page: 1,
    rigoSummary:
      'Tesis de licenciatura sobre el muralismo contemporáneo en la ciudad de Piura, con énfasis en la técnica de aerosol y acrílico sobre fachada. Analiza el discurso visual de seis colectivos artísticos locales y su relación con la identidad urbana piurana entre 2010 y 2018.',
    status: 'available',
  },
  {
    id: 'PP.07',
    title: 'Ignacio Merino: Vida y Obra del Pintor Piurano',
    author: 'Instituto Nacional de Cultura',
    category: 'Pintura Piurana',
    year: 1990,
    location: { pasillo: 2, estante: 'Estante B', tagCode: 'P2-EB' },
    page: 1,
    rigoSummary:
      'Estudio biográfico y catálogo de obras del pintor piurano Ignacio Merino, referente de la pintura académica peruana del siglo XIX. Documenta su formación en Europa, sus principales encargos oficiales y el paradero actual de sus obras conservadas en Piura y Lima.',
    status: 'available',
  },
  {
    id: 'ART.09',
    title: 'Simbilá: Tradición del Sombrero de Paja Toquilla',
    author: 'Carlos Robles Rázuri',
    category: 'Artesanías y Folclore',
    year: 2004,
    location: { pasillo: 1, estante: 'Estante B', tagCode: 'P1-EB' },
    page: 1,
    rigoSummary:
      'Historia y técnica del tejido de sombreros de paja toquilla en el caserío de Simbilá. Describe el proceso completo desde la selección de la fibra hasta el tejido fino, así como el rol económico y cultural del oficio en las familias artesanas de la zona.',
    status: 'available',
  },
  {
    id: 'ESC.03',
    title: 'Imaginería y Retablos del Virreinato en el Norte del Perú',
    author: 'Fray Martín de Ojeda',
    category: 'Escultura',
    year: 1982,
    location: { pasillo: 3, estante: 'Estante A', tagCode: 'P3-EA' },
    page: 1,
    rigoSummary:
      'Catálogo de imaginería religiosa y retablos tallados del periodo virreinal en el norte del Perú. Incluye fichas técnicas de talla, dorado y policromía, además de un mapa de talleres coloniales activos entre los siglos XVII y XVIII en la región de Piura.',
    status: 'available',
  },
  {
    id: 'HIST.11',
    title: 'Piura: Cinco Siglos de Historia Regional',
    author: 'Instituto de Estudios Regionales',
    category: 'Historia Regional',
    year: 1998,
    location: { pasillo: 3, estante: 'Estante B', tagCode: 'P3-EB' },
    page: 1,
    rigoSummary:
      'Recuento histórico de Piura desde la fundación española hasta el siglo XX. Aborda los principales hitos económicos, sociales y culturales de la región, con especial atención al desarrollo urbano de la ciudad y su rol como puerta de entrada del norte peruano.',
    status: 'available',
  },
  {
    id: 'CER.05',
    title: 'Cerámica de Chulucanas: Origen y Técnica del Paleteado',
    author: 'Max Inga Chapoñán',
    category: 'Cerámica',
    year: 2011,
    location: { pasillo: 1, estante: 'Estante A', tagCode: 'P1-EA' },
    page: 1,
    rigoSummary:
      'Documenta el origen prehispánico y la técnica del paleteado y ahumado en la cerámica de Chulucanas. Explica el proceso de negativo y positivo característico de la escuela vicús-tallán, con entrevistas a maestros ceramistas contemporáneos del distrito.',
    status: 'available',
  },
  {
    id: 'TESIS.02',
    title: 'Nivel de Expresión Corporal en Estudiantes de Educación Artística',
    author: 'Bryam Amaya Paiva',
    category: 'Tesis',
    year: 2021,
    location: { pasillo: 0, estante: 'Archivo de Tesis', tagCode: 'ARCH-TESIS' },
    page: 1,
    rigoSummary:
      'Investigación sobre el nivel de expresión corporal en estudiantes de cuarto de secundaria y su relación con el aprendizaje artístico. Aplica un instrumento validado a tres instituciones educativas de Piura y propone estrategias didácticas de reforzamiento escénico.',
    status: 'available',
  },
  {
    id: 'PP.12',
    title: 'Acuarelistas Piuranos del Siglo XX',
    author: 'Ana Lucía Peña Ordinola',
    category: 'Pintura Piurana',
    year: 2008,
    location: { pasillo: 2, estante: 'Estante B', tagCode: 'P2-EB' },
    page: 1,
    rigoSummary:
      'Panorama de la acuarela piurana entre 1920 y 1990, con semblanzas de doce artistas regionales y análisis de su técnica de veladuras sobre papel. Incluye un glosario de términos propios de la acuarela y recomendaciones de conservación para obras en clima cálido.',
    status: 'available',
  },
  {
    id: 'CER.08',
    title: 'Escuelas de Alfarería del Bajo Piura',
    author: 'Teodora Silva Namuche',
    category: 'Cerámica',
    year: 2015,
    location: { pasillo: 1, estante: 'Estante A', tagCode: 'P1-EA' },
    page: 1,
    rigoSummary:
      'Estudio comparativo de las escuelas alfareras del Bajo Piura, sus repertorios formales y técnicas de cocción a cielo abierto. Contrasta la producción utilitaria con la ornamental y documenta el traspaso generacional del oficio en talleres familiares.',
    status: 'available',
  },
];

const STOPWORDS = new Set([
  'de', 'la', 'el', 'los', 'las', 'un', 'una', 'unos', 'unas', 'que', 'donde', 'dónde', 'como', 'cómo',
  'y', 'o', 'a', 'en', 'por', 'para', 'con', 'sin', 'sobre', 'del', 'al', 'es', 'son', 'hay', 'tiene',
  'tienen', 'tengo', 'busco', 'quiero', 'me', 'mi', 'su', 'sus', 'se', 'lo', 'le', 'les', 'algo', 'alguna',
  'algun', 'algún', 'informacion', 'información', 'libro', 'libros', 'obra', 'obras', 'sobre',
]);

function normalize(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLocaleLowerCase('es-PE')
    .replace(/[^a-z0-9\s]/g, ' ');
}

function keywords(value: string): string[] {
  return normalize(value)
    .split(/\s+/)
    .filter((word) => word.length >= 3 && !STOPWORDS.has(word));
}

function scoreBook(book: BookDoc, questionWords: string[]): number {
  const title = normalize(book.title);
  const author = normalize(book.author);
  const category = normalize(book.category);
  const summary = normalize(book.rigoSummary);
  let score = 0;
  for (const word of questionWords) {
    if (title.includes(word)) score += 4;
    if (category.includes(word)) score += 3;
    if (author.includes(word)) score += 2;
    if (summary.includes(word)) score += 1;
  }
  return score;
}

/** Recorta un título largo a una frase breve para citarlo dentro de la respuesta corta. */
function shortTitle(title: string, maxLength = 38): string {
  if (title.length <= maxLength) return title;
  return `${title.slice(0, maxLength - 1).trimEnd()}…`;
}

function buildAnswer(_questionWords: string[], matches: BookDoc[]): string {
  if (matches.length === 0) {
    return 'No encontré coincidencias en el catálogo. Prueba con otro título, autor o tema.';
  }
  if (matches.length === 1) {
    const [book] = matches;
    return `Se recuperó «${shortTitle(book.title)}» (${book.id}). Consulta la ficha para ver autor, año y disponibilidad.`;
  }
  const list = matches.map((book) => `«${shortTitle(book.title)}» (${book.id})`).join(', ');
  return `Se recuperaron ${matches.length} resultados: ${list}. Consulta cada ficha para ver autor, año y disponibilidad.`;
}

export interface LibraryMatch {
  answer: string;
  sources: BookDoc[];
}

const MIN_RESULTS = 3;

/**
 * Busca en el catálogo ficticio los libros más afines a la pregunta y arma
 * una respuesta breve. Siempre devuelve al menos MIN_RESULTS ejemplares
 * (rellenando con los más populares si no hay suficientes coincidencias),
 * de modo que cada consulta muestre varias fichas para comparar.
 */
export function matchLibraryQuery(question: string): LibraryMatch {
  const questionWords = keywords(question);
  const scored = MOCK_CATALOG.map((book) => ({ book, score: scoreBook(book, questionWords) }))
    .sort((a, b) => b.score - a.score);

  const withScore = scored.filter((entry) => entry.score > 0).map((entry) => entry.book);
  const fillers = scored.filter((entry) => entry.score === 0).map((entry) => entry.book);
  const sources = [...withScore, ...fillers].slice(0, Math.max(MIN_RESULTS, withScore.length >= MIN_RESULTS ? withScore.length : MIN_RESULTS));

  return { answer: buildAnswer(questionWords, sources), sources };
}
