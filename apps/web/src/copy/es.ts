import type { Confidence, ErrorCode } from "@ghoststock/contracts";

const plural = (n: number, one: string, many: string) => (n === 1 ? one : many);

/** Every user-visible string of the app, in Spanish (Colombia). One place, easy to review. */
export const copy = {
  brand: {
    name: "GhostStock",
    tagline: "Trae tu inventario de vuelta de la muerte.",
  },
  cta: {
    invoke: "Invocar inventario",
  },
  nav: {
    label: "Navegación principal",
    dashboard: "Almacén",
    invoke: "Invocar",
    inventory: "Inventario",
    settings: "Ajustes",
    skipToContent: "Saltar al contenido",
    commandHint: "Buscar o saltar a...",
  },
  command: {
    title: "Paleta de comandos",
    description: "Busca productos por nombre, marca, SKU o categoría, o salta a una pantalla.",
    placeholder: "Busca un producto, una marca, un SKU o una pantalla",
    empty: "Nada por aquí. Ni un fantasma.",
    screens: "Pantallas",
    products: "Productos",
    open: "Abrir la paleta de comandos",
  },
  common: {
    retry: "Reintentar",
    cancel: "Cancelar",
    save: "Guardar",
    saving: "Guardando...",
    close: "Cerrar",
    loading: "Cargando...",
    lowStock: "Stock bajo",
    noPhoto: "Sin foto",
    otherPhoto: "Elegir otra foto",
    units: (n: number) => `${n} ${plural(n, "unidad", "unidades")}`,
  },
  notFound: {
    eyebrow: "Error 404",
    title: "Este pasillo no existe",
    body: "La página que buscas se desvaneció en la niebla.",
    back: "Volver al almacén",
  },
  categories: {
    all: "Todas",
  },
  confidence: {
    high: "Confianza alta",
    medium: "Confianza media",
    low: "Confianza baja",
  } satisfies Record<Confidence, string>,
  errors: {
    VALIDATION_ERROR: "Algunos datos no son válidos. Revisa los campos e intenta de nuevo.",
    UNSUPPORTED_MEDIA_TYPE: "Ese formato no sirve. Usa una foto JPG, PNG o WebP.",
    IMAGE_TOO_LARGE: "La foto es demasiado pesada, incluso después de reducirla. Prueba con otra.",
    IMAGE_NOT_FOUND: "La foto expiró antes de analizarla. Vuelve a intentarlo para subirla de nuevo.",
    NOT_FOUND: "Ese producto ya no existe. Puede que alguien lo haya eliminado.",
    MODEL_UNAVAILABLE: "El modelo de IA no está disponible en este momento. Intenta más tarde.",
    MODEL_THROTTLED: "Hay mucha demanda en este momento. Espera unos segundos y reintenta.",
    MODEL_INVALID_OUTPUT: "La IA respondió algo que no pudimos entender. Reintenta el análisis.",
    STORAGE_ERROR: "No pudimos guardar la información. Intenta de nuevo.",
    INTERNAL_ERROR: "Algo salió mal de nuestro lado. Intenta de nuevo en un momento.",
    NETWORK: "Sin conexión con el servidor. Revisa tu internet e intenta de nuevo.",
    UNEXPECTED: "El servidor no respondió como esperábamos. Intenta de nuevo.",
  } satisfies Record<ErrorCode | "NETWORK" | "UNEXPECTED", string>,
  showcase: {
    eyebrow: "Sistema de diseño",
    title: "Tokens del almacén",
    description: "Colores, tipografía y piezas base de GhostStock.",
    palette: "Paleta",
    type: "Tipografía",
    components: "Componentes",
    sample: "Café molido de origen Huila 500 g",
    sampleBody: "Bolsa de café tostado y molido, empaque kraft con válvula.",
    emptyTitle: "Tu almacén está en silencio. Invoca tu primer producto.",
    inputLabel: "Nombre del producto",
    confidence: "Confianza",
  },
} as const;
