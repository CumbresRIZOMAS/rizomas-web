import { useState, type FormEvent } from 'react'
import { useApiMutation, useApiQuery } from '../../shared/api/hooks'
import type { Ledger, Supplier } from '../../shared/api/types'
import { formatMoney, formatMoneyShort, formatNumber, formatShortDate, optionalText, parseOptionalNumber, toNumber } from '../../shared/format'
import { Button, Card, CardTitle, Chip, Empty, ErrorNotice, FormCard, Icon, Kpi, Loading, SelectField, TextField } from '../../shared/ui'

type Filtro = 'todos' | 'compras' | 'ventas'
type Movimiento = { id: string; date: string; tipo: 'Compra' | 'Venta'; concepto: string; tercero: string; cantidad: string; valor: number | null }

/** Compras y ventas de una finca (RF-16). El backend solo responde a roles autorizados (ASR-14). */
export function ComercialPanel({ farmId }: { farmId: string }) {
  const { data, error, loading, reload } = useApiQuery<Ledger>(`/commercial/farms/${farmId}/ledger`)
  const [filtro, setFiltro] = useState<Filtro>('todos')
  const [registrando, setRegistrando] = useState(false)

  const movimientos: Movimiento[] = [
    ...(data?.purchases ?? []).map((p) => ({
      id: p.id,
      date: p.date,
      tipo: 'Compra' as const,
      concepto: p.itemName + (p.isBioinput ? ' (bioinsumo)' : ''),
      tercero: p.supplier?.name ?? '—',
      cantidad: `${formatNumber(p.quantity)} ${p.unit ?? ''}`.trim(),
      valor: toNumber(p.value),
    })),
    ...(data?.sales ?? []).map((s) => ({
      id: s.id,
      date: s.date,
      tipo: 'Venta' as const,
      concepto: s.productName,
      tercero: s.buyer ?? '—',
      cantidad: `${formatNumber(s.quantity)} ${s.unit ?? ''}`.trim(),
      valor: toNumber(s.value),
    })),
  ].sort((a, b) => b.date.localeCompare(a.date))

  const ingresos = movimientos.filter((m) => m.tipo === 'Venta').reduce((s, m) => s + (m.valor ?? 0), 0)
  const egresos = movimientos.filter((m) => m.tipo === 'Compra').reduce((s, m) => s + (m.valor ?? 0), 0)
  const visibles = movimientos.filter((m) => filtro === 'todos' || (filtro === 'compras' ? m.tipo === 'Compra' : m.tipo === 'Venta'))

  return (
    <div className="stack">
      <div className="private-banner">
        <Icon name="lock" />
        <span>Solo usuarios autorizados pueden consultar valores, proveedores y compradores.</span>
      </div>
      {loading && !data && <Loading />}
      {error && <ErrorNotice message={error} onRetry={reload} />}
      {data && (
        <div className="kpi-grid commerce-kpis">
          <Kpi label="Ingresos" value={formatMoneyShort(ingresos)} detail={`${data.sales.length} ventas registradas`} icon="report" tone="moss" />
          <Kpi
            label="Egresos"
            value={formatMoneyShort(egresos)}
            detail={ingresos > 0 ? `${Math.round((egresos / ingresos) * 100)}% de los ingresos` : `${data.purchases.length} compras registradas`}
            icon="wallet"
            tone="coffee"
          />
          <Kpi label="Balance" value={formatMoneyShort(ingresos - egresos)} detail={ingresos - egresos >= 0 ? 'Resultado positivo' : 'Resultado negativo'} icon="sync" tone="blue" />
        </div>
      )}
      {registrando && (
        <MovimientoForm
          farmId={farmId}
          onCancel={() => setRegistrando(false)}
          onSaved={() => {
            setRegistrando(false)
            reload()
          }}
        />
      )}
      <Card className="card-pad">
        <CardTitle title="Movimientos" subtitle="Compras y ventas de la finca">
          <div className="actions" style={{ display: 'flex', gap: 8 }}>
            <select aria-label="Filtrar movimientos" value={filtro} onChange={(e) => setFiltro(e.target.value as Filtro)} style={{ width: 'auto' }}>
              <option value="todos">Todos</option>
              <option value="compras">Compras</option>
              <option value="ventas">Ventas</option>
            </select>
            {!registrando && (
              <Button icon="plus" onClick={() => setRegistrando(true)}>
                Registrar movimiento
              </Button>
            )}
          </div>
        </CardTitle>
        {data && visibles.length === 0 && <Empty title="Sin movimientos registrados" />}
        {visibles.length > 0 && (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Tipo</th>
                  <th>Concepto</th>
                  <th>Tercero</th>
                  <th>Cantidad</th>
                  <th>Valor</th>
                </tr>
              </thead>
              <tbody>
                {visibles.map((m) => (
                  <tr key={m.id}>
                    <td>{formatShortDate(m.date)}</td>
                    <td>
                      <Chip tone={m.tipo === 'Venta' ? 'green' : 'coffee'}>{m.tipo}</Chip>
                    </td>
                    <td>{m.concepto}</td>
                    <td>{m.tercero}</td>
                    <td className="num">{m.cantidad}</td>
                    <td className="num">
                      <strong>{formatMoney(m.valor)}</strong>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  )
}

function hoy(): string {
  return new Date().toISOString().slice(0, 10)
}

export function MovimientoForm({
  farmId,
  tipoInicial = 'compra',
  onSaved,
  onCancel,
}: {
  farmId: string
  tipoInicial?: 'compra' | 'venta'
  onSaved: () => void
  onCancel: () => void
}) {
  const { mutate, saving, error } = useApiMutation()
  const proveedores = useApiQuery<Supplier[]>('/commercial/suppliers')
  const [tipo, setTipo] = useState<'compra' | 'venta'>(tipoInicial)
  const [date, setDate] = useState(hoy())
  const [concepto, setConcepto] = useState('')
  const [tercero, setTercero] = useState('')
  const [isBioinput, setIsBioinput] = useState(false)
  const [quantity, setQuantity] = useState('')
  const [unit, setUnit] = useState('kg')
  const [value, setValue] = useState('')
  const cantidad = parseOptionalNumber(quantity)

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    const base = { farmId, date, quantity: cantidad, unit: optionalText(unit), value: parseOptionalNumber(value) }
    const ok =
      tipo === 'compra'
        ? await mutate('/commercial/purchases', 'POST', { ...base, itemName: concepto.trim(), isBioinput, supplierName: optionalText(tercero) })
        : await mutate('/commercial/sales', 'POST', { ...base, productName: concepto.trim(), buyer: optionalText(tercero) })
    if (ok) onSaved()
  }

  return (
    <FormCard title="Registrar movimiento">
      <form onSubmit={onSubmit}>
        <div className="form-grid three">
          <SelectField label="Tipo *" value={tipo} onChange={(e) => setTipo(e.target.value as 'compra' | 'venta')}>
            <option value="compra">Compra</option>
            <option value="venta">Venta</option>
          </SelectField>
          <TextField label="Fecha *" type="date" required value={date} onChange={(e) => setDate(e.target.value)} />
          <TextField
            label={tipo === 'compra' ? 'Insumo o servicio *' : 'Producto *'}
            required
            value={concepto}
            onChange={(e) => setConcepto(e.target.value)}
            placeholder={tipo === 'compra' ? 'Ej. Melaza y minerales' : 'Ej. Café cereza'}
          />
          {tipo === 'venta' && <TextField label="Comprador" optional value={tercero} onChange={(e) => setTercero(e.target.value)} />}
          {tipo === 'compra' && (
            <TextField
              label="Proveedor"
              optional
              list="proveedores"
              value={tercero}
              onChange={(e) => setTercero(e.target.value)}
              hint="Si no está en la lista, se agrega al catálogo."
            />
          )}
          <datalist id="proveedores">
            {(proveedores.data ?? []).map((p) => (
              <option key={p.id} value={p.name} />
            ))}
          </datalist>
          <TextField label="Cantidad *" required inputMode="decimal" value={quantity} onChange={(e) => setQuantity(e.target.value)} />
          <TextField label="Unidad" optional value={unit} onChange={(e) => setUnit(e.target.value)} />
          <TextField label="Valor (COP)" optional inputMode="decimal" value={value} onChange={(e) => setValue(e.target.value)} />
        </div>
        {tipo === 'compra' && (
          <label className="check-row">
            <input type="checkbox" checked={isBioinput} onChange={(e) => setIsBioinput(e.target.checked)} />
            <span>
              <strong>Es un bioinsumo</strong>
              <small>Cuenta para el indicador de compras de bioinsumos.</small>
            </span>
          </label>
        )}
        {error && <ErrorNotice message={error} />}
        <div className="form-actions">
          <Button variant="ghost" onClick={onCancel}>
            Cancelar
          </Button>
          <Button type="submit" icon="check" disabled={saving || !concepto.trim() || cantidad === undefined}>
            {saving ? 'Guardando…' : 'Guardar movimiento'}
          </Button>
        </div>
      </form>
    </FormCard>
  )
}
