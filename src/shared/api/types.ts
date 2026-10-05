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
  harvest?: { quantity: Decimal; unit: string } | null
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
}

export type LotWithCrops = Omit<Lot, 'crops'> & { crops: Crop[] }

export type FarmDetail = Omit<Farm, 'lots'> & {
  lots: LotWithCrops[]
  labors: Labor[]
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
