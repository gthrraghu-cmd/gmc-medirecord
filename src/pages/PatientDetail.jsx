import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { motion } from 'framer-motion'
import { ArrowLeft, Pencil, Trash2, Plus, Phone, MapPin, Droplet, AlertTriangle, CalendarClock, Stethoscope, Pill, IndianRupee, FileText, ReceiptText, Wallet, CalendarPlus, CalendarCheck, ClipboardList, BookOpenText, Package, Images, FolderOpen } from 'lucide-react'
import { db, deletePatient, deleteVisit, ensureReceiptNo, bookFollowUp } from '../lib/db.js'
import { ageFrom, fmtDate, fmtMoney, fmtTime, todayISO } from '../lib/format.js'
import { rxText, receiptText, waLink } from '../lib/share.js'
import { Avatar, DeptChip, Empty, Modal, useToast } from '../components/ui.jsx'
import { RxSheet, ReceiptSheet } from '../components/PrintSheets.jsx'
import DocPreview from '../components/DocPreview.jsx'
import MarkPaid from '../components/MarkPaid.jsx'
import CaseSheet from '../components/patient/CaseSheet.jsx'
import Packages from '../components/patient/Packages.jsx'
import Photos from '../components/patient/Photos.jsx'
import Documents from '../components/patient/Documents.jsx'
import PatientForm from './PatientForm.jsx'
import VisitForm from './VisitForm.jsx'
import { useT } from '../lib/i18n.jsx'

const TABS = [
  { key: 'visits', label: 'patient.tab.visits', icon: ClipboardList },
  { key: 'case', label: 'patient.tab.case', icon: BookOpenText },
  { key: 'packages', label: 'patient.tab.packages', icon: Package },
  { key: 'photos', label: 'patient.tab.photos', icon: Images },
  { key: 'docs', label: 'patient.tab.docs', icon: FolderOpen }
]

function Info({ icon: Icon, label, value, warn }) {
  if (!value) return null
  return (
    <div className={`rounded-xl border p-3 ${warn ? 'border-rose-400/25 bg-rose-500/5' : 'border-gold-500/10 bg-night-950/40'}`}>
      <p className={`flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[.16em] ${warn ? 'text-rose-300/80' : 'text-gold-400/70'}`}>
        <Icon size={12} /> {label}
      </p>
      <p className="mt-1 whitespace-pre-line text-sm text-gold-200/85">{value}</p>
    </div>
  )
}

function Block({ label, children }) {
  if (!children) return null
  return (
    <div>
      <p className="text-[10px] font-semibold uppercase tracking-[.16em] text-gold-400/70">{label}</p>
      <p className="mt-0.5 whitespace-pre-line text-sm text-gold-200/85">{children}</p>
    </div>
  )
}

function Confirm({ open, onClose, onYes, title, text }) {
  const { tx } = useT()
  return (
    <Modal open={open} onClose={onClose} title={title}>
      <p className="text-sm text-gold-200/70">{text}</p>
      <div className="mt-6 flex justify-end gap-2">
        <button onClick={onClose} className="btn-ghost">{tx('Cancel')}</button>
        <button onClick={onYes} className="btn-danger"><Trash2 size={15} /> {tx('Delete')}</button>
      </div>
    </Modal>
  )
}

export default function PatientDetail({ id, go, profile }) {
  const { tx } = useT()
  const toast = useToast()
  const [editP, setEditP] = useState(false)
  const [visitModal, setVisitModal] = useState(null)
  const [confirm, setConfirm] = useState(null)
  const [doc, setDoc] = useState(null)
  const [collectId, setCollectId] = useState(null)
  const [tab, setTab] = useState('visits')
  const { t: tr } = useT()
  const patient = useLiveQuery(() => db.patients.get(id).then(p => p || null), [id])
  const appts = useLiveQuery(() => db.appointments.where('patientId').equals(id).toArray(), [id])
  const visits = useLiveQuery(() => db.visits.where('patientId').equals(id).toArray().then(a => a.sort((x, y) => (y.date + y.createdAt).localeCompare(x.date + x.createdAt))), [id])

  if (patient === undefined || visits === undefined || appts === undefined) return null
  if (patient === null || !patient) {
    return <Empty icon={AlertTriangle} title={tx('Patient not found')} text={tx('This record may have been deleted.')} action={<button className="btn-gold" onClick={() => go({ name: 'patients' })}>{tx('Back to patients')}</button>} />
  }

  const total = visits.reduce((s, v) => s + (Number(v.fee) || 0), 0)
  const nextFU = visits.find(v => v.followUp)?.followUp
  const today = todayISO()

  const docVisit = doc ? visits.find(v => v.id === doc.id) : null
  const collectVisit = collectId ? visits.find(v => v.id === collectId) : null

  const openAppts = appts.filter(a => ['booked', 'waiting', 'in'].includes(a.status) && a.date >= today).sort((a, b) => (a.date + (a.time || '')).localeCompare(b.date + (b.time || '')))
  const nextAppt = openAppts[0]
  const isBooked = date => openAppts.some(a => a.date === date)

  const doBookFollowUp = async v => {
    const r = await bookFollowUp(v)
    toast(r.existed ? `Already booked for ${fmtDate(v.followUp)}` : `Follow-up booked for ${fmtDate(v.followUp)}`)
  }

  const openReceipt = async v => {
    await ensureReceiptNo(v.id)
    setDoc({ kind: 'receipt', id: v.id })
  }

  const doDelete = async () => {
    if (confirm.type === 'patient') {
      await deletePatient(id)
      toast(tx('Patient record deleted'))
      go({ name: 'patients' })
    } else {
      await deleteVisit(confirm.id)
      toast(tx('Consultation deleted'))
    }
    setConfirm(null)
  }

  return (
    <div>
      <button onClick={() => go({ name: 'patients' })} className="mb-4 flex items-center gap-1.5 text-sm font-semibold text-gold-400 hover:text-gold-300">
        <ArrowLeft size={16} /> {tr('patient.all')}
      </button>

      <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} className="glass relative overflow-hidden p-5 sm:p-7">
        <div className="absolute -right-16 -top-20 h-60 w-60 rounded-full bg-royal-500/25 blur-3xl" />
        <div className="relative flex flex-col gap-5 sm:flex-row sm:items-center">
          <Avatar name={patient.name} gender={patient.gender} size="h-20 w-20 text-2xl" />
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-semibold tracking-[.2em] text-gold-500/90">{patient.code}</p>
            <h1 className="font-display text-4xl font-semibold leading-tight gold-text">{patient.name}</h1>
            <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-gold-200/60">
              <span>{[ageFrom(patient) && `${ageFrom(patient)} years`, patient.gender].filter(Boolean).join(' · ')}</span>
              <DeptChip dept={patient.department} />
              {patient.bloodGroup && <span className="chip border-rose-300/25 text-rose-200"><Droplet size={11} />{patient.bloodGroup}</span>}
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <button onClick={() => setVisitModal({})} className="btn-gold"><Plus size={16} /> {tr('patient.consultation')}</button>
            <button onClick={() => setEditP(true)} className="btn-ghost"><Pencil size={15} /> {tr('patient.edit')}</button>
            <button onClick={() => setConfirm({ type: 'patient' })} className="btn-danger px-3" aria-label={tx('Delete patient')}><Trash2 size={15} /></button>
          </div>
        </div>

        <div className="hairline my-5" />

        <div className="relative grid grid-cols-3 gap-3 text-center">
          <div>
            <p className="font-display text-3xl font-bold gold-text">{visits.length}</p>
            <p className="text-[10px] uppercase tracking-[.16em] text-gold-200/45">{tr('patient.stat.visits')}</p>
          </div>
          <div>
            <p className="font-display text-3xl font-bold gold-text">{fmtMoney(total)}</p>
            <p className="text-[10px] uppercase tracking-[.16em] text-gold-200/45">{tr('patient.stat.billed')}</p>
          </div>
          <div>
            <p className={`font-display text-3xl font-bold ${nextFU && nextFU < today ? 'text-rose-300' : 'gold-text'}`}>{nextFU ? fmtDate(nextFU).slice(0, 6) : '—'}</p>
            <p className="text-[10px] uppercase tracking-[.16em] text-gold-200/45">{tr('patient.stat.next')}</p>
          </div>
        </div>
      </motion.div>

      <div className="mt-5 flex gap-2 overflow-x-auto pb-1">
        {TABS.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)} className={`flex shrink-0 items-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-semibold transition ${tab === t.key ? 'border-gold-400 bg-gold-500/15 text-gold-200' : 'border-gold-500/15 text-gold-200/50 hover:border-gold-500/35'}`}>
            <t.icon size={16} /> {tr(t.label)}
          </button>
        ))}
      </div>

      {tab === 'case' && <div className="mt-5"><CaseSheet patient={patient} profile={profile} /></div>}
      {tab === 'packages' && <div className="mt-5"><Packages patient={patient} /></div>}
      {tab === 'photos' && <div className="mt-5"><Photos patient={patient} /></div>}
      {tab === 'docs' && <div className="mt-5"><Documents patient={patient} /></div>}

      {tab === 'visits' && (
      <div className="mt-5 grid gap-5 lg:grid-cols-3">
        <div className="space-y-3 lg:col-span-1">
          {nextAppt && (
            <button onClick={() => go({ name: 'schedule' })} className="flex w-full items-center gap-3 rounded-xl border border-gold-400/35 bg-gold-500/10 p-3 text-left transition hover:bg-gold-500/15">
              <CalendarCheck size={20} className="shrink-0 text-gold-400" />
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[.16em] text-gold-400/80">{tx('Next appointment')}</p>
                <p className="text-sm font-semibold text-gold-200">{fmtDate(nextAppt.date)} · {fmtTime(nextAppt.time)}</p>
                <p className="text-xs text-gold-200/50">{nextAppt.purpose || 'Consultation'}{nextAppt.token ? ` · Token ${nextAppt.token}` : ''}</p>
              </div>
            </button>
          )}
          <Info icon={AlertTriangle} label={tx('Allergies')} value={patient.allergies} warn />
          <Info icon={Phone} label={tx('Contact')} value={[patient.phone, patient.altPhone, patient.email].filter(Boolean).join('\n')} />
          <Info icon={MapPin} label={tx('Address')} value={[patient.address, patient.city].filter(Boolean).join(', ')} />
          <Info icon={Stethoscope} label={tx('Medical history')} value={patient.history} />
          <Info icon={Pill} label={tx('Occupation · Referred by')} value={[patient.occupation, patient.referredBy && `Ref: ${patient.referredBy}`].filter(Boolean).join(' · ')} />
          <Info icon={Pencil} label={tx('Notes')} value={patient.notes} />
          <p className="px-1 text-[11px] text-gold-200/35">Registered {fmtDate(new Date(patient.createdAt).toISOString().slice(0, 10))}</p>
        </div>

        <div className="lg:col-span-2">
          <h3 className="mb-3 font-display text-2xl font-semibold text-gold-200">{tr('patient.history')}</h3>
          {visits.length === 0 ? (
            <div className="glass">
              <Empty icon={Stethoscope} title={tx('No consultations yet')} text={tx('Record the first consultation for this patient.')} action={<button onClick={() => setVisitModal({})} className="btn-gold"><Plus size={16} /> {tx('Consultation')}</button>} />
            </div>
          ) : (
            <ol className="relative space-y-4 border-l border-gold-500/20 pl-6">
              {visits.map((v, i) => (
                <motion.li key={v.id} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.05 }} className="relative">
                  <span className="absolute -left-[31px] top-5 h-3.5 w-3.5 rounded-full border-2 border-night-900 bg-gradient-to-br from-gold-300 to-gold-600 shadow-gold" />
                  <div className="glass p-4 sm:p-5">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <p className="font-display text-xl font-semibold text-gold-200">{fmtDate(v.date)}</p>
                        <DeptChip dept={v.department} />
                      </div>
                      <div className="flex items-center gap-1">
                        <button onClick={() => setVisitModal({ visit: v })} className="rounded-lg p-2 text-gold-300/60 hover:bg-night-600/50 hover:text-gold-200" aria-label={tx('Edit')}><Pencil size={15} /></button>
                        <button onClick={() => setConfirm({ type: 'visit', id: v.id })} className="rounded-lg p-2 text-gold-300/60 hover:bg-rose-500/10 hover:text-rose-300" aria-label={tx('Delete')}><Trash2 size={15} /></button>
                      </div>
                    </div>

                    {(v.bp || v.pulse || v.weight) && (
                      <div className="mt-2 flex flex-wrap gap-2">
                        {v.bp && <span className="chip border-gold-500/20 text-gold-200/70">BP {v.bp}</span>}
                        {v.pulse && <span className="chip border-gold-500/20 text-gold-200/70">Pulse {v.pulse}</span>}
                        {v.weight && <span className="chip border-gold-500/20 text-gold-200/70">{v.weight} kg</span>}
                      </div>
                    )}

                    <div className="mt-3 grid gap-3 sm:grid-cols-2">
                      <Block label={tx('Complaints')}>{v.complaints}</Block>
                      <Block label={tx('Diagnosis')}>{v.diagnosis}</Block>
                      <Block label={tx('Findings')}>{v.findings}</Block>
                      <Block label={tx('Acupuncture points')}>{v.points}</Block>
                      <Block label={tx('Session')}>{[v.sessionNo, v.sessionMins && `${v.sessionMins} mins`].filter(Boolean).join(' · ')}</Block>
                      <Block label={tx('Procedure')}>{[v.procedure, v.area].filter(Boolean).join(' — ')}</Block>
                      <Block label={tx('Products')}>{v.products}</Block>
                    </div>

                    {v.rx?.length > 0 && (
                      <div className="mt-3 overflow-hidden rounded-xl border border-gold-500/15">
                        <div className="bg-gold-500/10 px-3 py-1.5 font-display text-lg font-semibold text-gold-300">℞</div>
                        <table className="w-full text-sm">
                          <tbody>
                            {v.rx.map((r, j) => (
                              <tr key={j} className="border-t border-gold-500/10">
                                <td className="px-3 py-2 font-semibold text-gold-200">{r.medicine} <span className="text-gold-400">{r.potency}</span></td>
                                <td className="px-3 py-2 text-gold-200/60">{r.dosage}</td>
                                <td className="px-3 py-2 text-right text-gold-200/60">{r.duration}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}

                    {v.advice && <div className="mt-3"><Block label={tx('Advice')}>{v.advice}</Block></div>}

                    <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-gold-500/10 pt-3 text-xs">
                      {v.fee !== '' && v.fee !== undefined && (
                        <span className={`chip ${v.payMode === 'Pending' ? 'border-rose-300/30 text-rose-200' : 'border-emerald-300/25 text-emerald-200'}`}>
                          <IndianRupee size={11} />{Number(v.fee).toLocaleString('en-IN')} · {v.payMode}
                        </span>
                      )}
                      {v.followUp && (
                        <span className={`chip ${v.followUp < today ? 'border-rose-300/30 text-rose-200' : 'border-gold-500/25 text-gold-300'}`}>
                          <CalendarClock size={11} />Follow-up {fmtDate(v.followUp)}
                        </span>
                      )}
                      <div className="ml-auto flex w-full flex-wrap justify-end gap-1.5 pt-2 sm:w-auto sm:pt-0">
                        {v.followUp && v.followUp >= today && (isBooked(v.followUp) ? (
                          <span className="chip border-emerald-300/30 py-1.5 text-emerald-200"><CalendarCheck size={13} /> {tx('Booked')}</span>
                        ) : (
                          <button onClick={() => doBookFollowUp(v)} className="btn-ghost px-2.5 py-1.5 text-xs"><CalendarPlus size={14} /> {tx('Book follow-up')}</button>
                        ))}
                        {v.payMode === 'Pending' && Number(v.fee) > 0 && (
                          <button onClick={() => setCollectId(v.id)} className="btn-ghost px-2.5 py-1.5 text-xs text-rose-200"><Wallet size={14} /> {tx('Collect')}</button>
                        )}
                        <button onClick={() => setDoc({ kind: 'rx', id: v.id })} className="btn-ghost px-2.5 py-1.5 text-xs"><FileText size={14} /> {tx('Prescription')}</button>
                        {Number(v.fee) > 0 && (
                          <button onClick={() => openReceipt(v)} className="btn-ghost px-2.5 py-1.5 text-xs"><ReceiptText size={14} /> {tx('Receipt')}</button>
                        )}
                      </div>
                    </div>
                  </div>
                </motion.li>
              ))}
            </ol>
          )}
        </div>
      </div>
      )}

      <DocPreview
        open={!!docVisit}
        onClose={() => setDoc(null)}
        title={doc?.kind === 'receipt' ? tx('Payment receipt') : tx('Prescription')}
        subtitle={docVisit ? `${patient.name} · ${fmtDate(docVisit.date)}${doc?.kind === 'receipt' && docVisit.receiptNo ? ` · ${docVisit.receiptNo}` : ''}` : ''}
        sheet={docVisit && (doc.kind === 'receipt' ? <ReceiptSheet profile={profile} patient={patient} visit={docVisit} /> : <RxSheet profile={profile} patient={patient} visit={docVisit} />)}
        waHref={docVisit && patient.phone ? waLink(patient.phone, doc.kind === 'receipt' ? receiptText(profile, patient, docVisit) : rxText(profile, patient, docVisit)) : null}
        waDisabledReason="Add a mobile number to share on WhatsApp"
      />
      <MarkPaid visit={collectVisit} patient={patient} onClose={() => setCollectId(null)} />
      <PatientForm open={editP} onClose={() => setEditP(false)} patient={patient} />
      <VisitForm open={!!visitModal} onClose={() => setVisitModal(null)} patient={patient} visit={visitModal?.visit} />
      <Confirm
        open={!!confirm}
        onClose={() => setConfirm(null)}
        onYes={doDelete}
        title={confirm?.type === 'patient' ? tx('Delete patient?') : tx('Delete consultation?')}
        text={confirm?.type === 'patient' ? `This permanently removes ${patient.name} and all ${visits.length} consultation(s) from this device. Take a backup first if unsure.` : tx('This consultation will be permanently removed from this device.')}
      />
    </div>
  )
}
