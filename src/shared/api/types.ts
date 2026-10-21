// Formas de las respuestas de rizomas-backend. Los Decimal de Prisma llegan
// como texto ("1.20"); las fechas como ISO.

export type Decimal = string | number

export type FarmType = 'CONVENCIONAL' | 'EN_TRANSICION' | 'REGENERATIVA'

export type Crop = {
  id: string
  lotId: string
  species: string
  variety: string | null
  plantingDate: string | null
  status: string | null
  createdAt: string
}

export type Lot = {
  id: string
  farmId: string
  name: string
  identifier: string | null
  areaHa: Decimal | null
  createdAt: string
  crops?: Crop[]
}

export type LaborType =
  | 'SIEMBRA'
  | 'COSECHA'
  | 'COMPRA'
  | 'VENTA'
  | 'MANEJO_AGRONOMICO'
  | 'APLICACION_BIOINSUMO'
  | 'PROCESO_CAFE'
  | 'OTRO'

export type AgronomicManagementType =
  | 'LIMPIEZA'
  | 'PODA'
  | 'ABONO'
  | 'REVISION'
  | 'RIEGO'
  | 'FERTILIZACION'
  | 'CONTROL_PLAGAS'
  | 'OTRO'

export type Labor = {
  id: string
  farmId: string
  lotId: string | null
  cropId: string | null
  type: LaborType
  name: string
  startDate: string
  endDate: string | null
  durationMin: number | null
  observations: string | null
  lot?: Pick<Lot, 'id' | 'name'> | null
  crop?: Pick<Crop, 'id' | 'species' | 'variety' | 'lotId'> | null
  harvest?: { id?: string; quantity: Decimal; unit: string; quality?: string | null } | null
  management?: { type: AgronomicManagementType; quantity: Decimal | null } | null
}

export type Farm = {
  id: string
  name: string
  identifier: string | null
  municipality: string | null
  region: string | null
  areaHa: Decimal | null
  climate: string | null
  farmType: FarmType
  createdAt: string
  lots?: Lot[]
  owner?: { id: string; name: string } | null
}

export type LotWithCrops = Omit<Lot, 'crops'> & { crops: Crop[] }

export type FarmDetail = Omit<Farm, 'lots'> & {
  lots: LotWithCrops[]
  labors: Labor[]
  soilAnalyses?: { id: string; date: string; lotId: string | null; laboratory: string | null }[]
}

export type LotDetail = Lot & {
  farm: Pick<Farm, 'id' | 'name'>
  crops: Crop[]
  labors: Labor[]
}

export type ReferenceRange = {
  id: string
  parameter: string
  crop: string
  unit: string | null
  min: Decimal | null
  max: Decimal | null
  source: string | null
  notes: string | null
  updatedAt: string
}

export type Role =
  | 'ADMIN_CUMBRES'
  | 'ADMIN_FINCA'
  | 'TECNICO'
  | 'AGRICULTOR'
  | 'PROVEEDOR'
  | 'COMPRADOR_CERTIFICADORA'
  | 'CLIENTE'
  | 'PUBLICO'

export type AppUser = {
  id: string
  name: string
  email: string
  role: Role
  active: boolean
  createdAt: string
  farmMembers?: { role: Role; farm: Pick<Farm, 'id' | 'name'> }[]
  ownedFarms?: Pick<Farm, 'id' | 'name'>[]
}

/** BAJO | OPTIMO | ALTO | SIN_REFERENCIA (RF-11). */
export type DiagnosisStatus = 'BAJO' | 'OPTIMO' | 'ALTO' | 'SIN_REFERENCIA'

export type Recommendation = {
  id: string
  diagnosisId: string | null
  type: 'PRACTICA' | 'BIOINSUMO'
  description: string
  automatic: boolean
  createdAt: string
  bioinput?: { id: string; name: string } | null
}

export type Diagnosis = {
  id: string
  parameter: string
  value: Decimal | null
  unit: string | null
  referenceMin: Decimal | null
  referenceMax: Decimal | null
  status: DiagnosisStatus | string
  recommendations: Recommendation[]
}

export type SoilAnalysis = {
  id: string
  farmId: string
  lotId: string | null
  date: string
  laboratory: string | null
  observations: string | null
  lot?: { id: string; name: string } | null
  diagnostics: Diagnosis[]
}

export type Ingredient = { name: string; quantity?: number; unit?: string }

export type Bioinput = {
  id: string
  farmId: string
  name: string
  ingredients: Ingredient[] | null
  preparation: string | null
  producedAt: string | null
  quantity: Decimal | null
  unit: string | null
  createdAt: string
  _count?: { applications: number }
}

export type BioinputApplication = {
  id: string
  lotId: string
  appliedAt: string
  quantity: Decimal | null
  unit: string | null
  observations: string | null
  lot?: { id: string; name: string }
  labor?: { id: string; name: string; startDate: string } | null
}

export type BioinputDetail = Bioinput & { applications: BioinputApplication[] }

export type Certification = { id: string; certifier: string; status: string }

export type ProductFinal = {
  id: string
  finalizedAt: string | null
  destination: string | null
  certifications?: Certification[]
}

export type CoffeeProcess = {
  id: string
  farmId: string
  harvestId: string | null
  currentStage: string
  startedAt: string
  finishedAt: string | null
  notes: string | null
  lotId?: string | null
  lot?: { id: string; name: string; crops?: Crop[] } | null
  harvest?: { id: string; quantity: Decimal; unit: string } | null
  events?: CoffeeProcessEvent[]
  products: ProductFinal[]
}

export type CoffeeProcessEvent = { id: string; stage: string; recordedAt: string; inputKg: Decimal | null; outputKg: Decimal | null; waterLiters: Decimal | null; wastewaterLiters: Decimal | null; compostReuse: boolean; durationHours: Decimal | null; method: string | null; brix: Decimal | null; ph: Decimal | null; moisturePercent: Decimal | null; scaScore: Decimal | null; notes: string | null }

export type Supplier = { id: string; name: string; inputType: string | null }

export type Purchase = {
  id: string
  date: string
  itemName: string
  isBioinput: boolean
  quantity: Decimal
  unit: string | null
  value: Decimal | null
  supplier?: { name: string } | null
}

export type Sale = {
  id: string
  date: string
  productName: string
  buyer: string | null
  quantity: Decimal
  unit: string | null
  value: Decimal | null
}

export type Ledger = { purchases: Purchase[]; sales: Sale[] }

export type EvidenceStatus = 'PENDIENTE' | 'EN_REVISION' | 'APROBADA' | 'RECHAZADA' | 'CUARENTENA'

export type Evidence = {
  id: string
  farmId: string | null
  lotId: string | null
  laborId: string | null
  objectKey: string
  capturedAt: string | null
  status: EvidenceStatus
  visibility: 'PRIVADA' | 'FINCA' | 'ORGANIZACION' | 'PUBLICA'
  moderationScore: Decimal | null
  moderationEngine: string | null
  rejectionReason: string | null
  geolocation: unknown
  createdAt: string
}

export type SignedUrl = { objectKey?: string; url: string; expiresIn: number }

export type ProductionReport = {
  type: 'production'
  farmId?: string
  totals: { labors: number; harvestEvents: number; harvestedQuantity: number; purchaseValue: number; saleValue: number }
}

/** Respuesta de GET /traceability/farms/:id (vista interna). */
export type FarmTraceability = Omit<Farm, 'lots'> & {
  lots: (Lot & {
    crops: (Crop & { harvests: { id: string; quantity: Decimal; unit: string }[] })[]
    soilAnalyses: { id: string; date: string; laboratory: string | null; diagnostics: Diagnosis[] }[]
    bioinputApplications: { id: string; appliedAt: string; quantity: Decimal | null; unit: string | null; bioinput: { id: string; name: string } }[]
  })[]
  labors: Labor[]
  coffeeProcesses: CoffeeProcess[]
}

/** Publicación pública (RF-18): sin datos personales, comerciales ni coordenadas exactas. */
export type Publication = {
  id: string
  title: string
  farmName?: string
  isPublished?: boolean
  description?: string | null
  municipality?: string | null
  region: string | null
  quantity: Decimal | null
  unit: string | null
  publicLocation?: { latitude?: number; longitude?: number } | null
  publishedAt: string | null
  evidences: { evidence: { id: string; capturedAt: string | null } }[]
}

/** Publicación vista desde el panel (GET /publications/farms/:id), activa o no. */
export type FarmPublication = {
  id: string
  title: string
  description?: string | null
  region: string | null
  quantity: Decimal | null
  unit: string | null
  publicLocation?: { latitude?: number; longitude?: number } | null
  active: boolean
  publishedAt: string | null
  harvest: { id: string; quantity: Decimal; unit: string; labor: { startDate: string; name: string } } | null
  evidences: { evidenceId: string }[]
}

/** Foto aprobada y autorizada como pública que se puede poner en una publicación. */
export type PhotoCandidate = { id: string; objectKey: string; capturedAt: string | null; laborId: string | null; linked: boolean }

/** GET /publications/:id/traceability: read model público, sin datos privados. */
export type PublicTraceability = {
  publication: { id: string; title: string; region: string | null; quantity: string | null; unit: string | null; publishedAt: string | null }
  origin: { region: string | null; farmType: FarmType | null }
  crop: { species: string; variety: string | null } | null
  harvest: { date: string; quantity: string; unit: string; quality: string | null } | null
  practices: { laborsByType: Partial<Record<LaborType, number>>; soilAnalyses: number; bioinputApplications: number; recommendations: number }
  processes: {
    stage: string
    startedAt: string
    finishedAt: string | null
    events: { stage: string; recordedAt: string; inputKg: Decimal | null; outputKg: Decimal | null }[]
    products: { finalizedAt: string | null; destination: string | null; certifications: { certifier: string; status: string }[] }[]
  }[]
}

/** Etapas públicas de una finca del mapa, incluso sin publicación activa. */
export type PublicFarmTraceability = {
  origin: { region: string | null; farmType: FarmType | null }
  crop: PublicTraceability['crop']
  harvest: PublicTraceability['harvest']
  practices: PublicTraceability['practices']
  lotsCount: number
  cropsCount: number
  harvestsCount: number
  processes: PublicTraceability['processes']
}
