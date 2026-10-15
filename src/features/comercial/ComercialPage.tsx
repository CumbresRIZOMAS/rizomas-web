import { RequireFarm } from '../../shared/farm/RequireFarm'
import { PageHeader } from '../../shared/ui'
import { ComercialPanel } from './ComercialPanel'

export function ComercialPage() {
  return (
    <RequireFarm>
      {(farm) => (
        <div>
          <PageHeader eyebrow="Información privada" title="Compras y ventas" subtitle={`Control comercial de la finca ${farm.name}.`} />
          <ComercialPanel farmId={farm.id} />
        </div>
      )}
    </RequireFarm>
  )
}
