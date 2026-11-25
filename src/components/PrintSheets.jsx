import { fmtDate, fmtMoney } from '../lib/format.js'
import { docT, docDept } from '../lib/i18n.jsx'

const ONES = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen']
const TENS = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety']

function twoDigits(n) {
  if (n < 20) return ONES[n]
  return [TENS[Math.floor(n / 10)], ONES[n % 10]].filter(Boolean).join(' ')
}

function threeDigits(n) {
  const h = Math.floor(n / 100)
  const r = n % 100
  return [h ? `${ONES[h]} Hundred` : '', r ? twoDigits(r) : ''].filter(Boolean).join(' ')
}

export function rupeesInWords(amount) {
  let n = Math.floor(Number(amount) || 0)
  if (!n) return 'Zero Rupees Only'
  const parts = []
  const crore = Math.floor(n / 10000000); n %= 10000000
  const lakh = Math.floor(n / 100000); n %= 100000
  const thousand = Math.floor(n / 1000); n %= 1000
  if (crore) parts.push(`${twoDigits(crore)} Crore`)
  if (lakh) parts.push(`${twoDigits(lakh)} Lakh`)
  if (thousand) parts.push(`${twoDigits(thousand)} Thousand`)
  if (n) parts.push(threeDigits(n))
  return `${parts.join(' ')} Rupees Only`
}

function ageLabel(p) {
  if (p.dob) {
    const b = new Date(p.dob + 'T00:00:00')
    const n = new Date()
    let a = n.getFullYear() - b.getFullYear()
    if (n.getMonth() < b.getMonth() || (n.getMonth() === b.getMonth() && n.getDate() < b.getDate())) a--
    return a
  }
  return p.age
}

export function Paper({ children, lang, a4 }) {
  return <div className={`paper${a4 ? ' paper-a4' : ''}${lang && lang !== 'en' ? ' doc-ta' : ''}`}>{children}</div>
}

export function Letterhead({ profile, title }) {
  return (
    <div>
      <div className="flex items-start gap-[4mm]">
        <img src="./icons/crest.png" alt="" className="h-[22mm] w-[22mm] object-contain" />
        <div className="min-w-0 flex-1 pt-[1mm]">
          <p className="font-display text-[23px] font-bold leading-none text-[#4a1470]">{(profile.clinicName || 'Gayathri Multi Speciality Clinic').replace(/\s+Multi.*$/i, '') || 'Gayathri'}</p>
          <p className="mt-[1.2mm] text-[8.5px] font-bold uppercase tracking-[.26em] text-[#a77d1c]">Multi Speciality Clinic</p>
          <p className="mt-[1mm] text-[8px] tracking-[.12em] text-[#6b5a7a]">Homoeopathy · Acupuncture · Cosmetology</p>
        </div>
        <div className="pt-[1mm] text-right">
          {profile.doctor && <p className="font-display text-[15px] font-bold leading-tight text-[#2a0a3d]">{profile.doctor}</p>}
          {profile.qualification && <p className="text-[8.5px] font-semibold text-[#6b5a7a]">{profile.qualification}</p>}
          {profile.regNo && <p className="text-[8px] text-[#6b5a7a]">Reg. No. {profile.regNo}</p>}
        </div>
      </div>
      <div className="mt-[3mm] h-[1.4px] bg-gradient-to-r from-[#4a1470] via-[#d4a537] to-[#4a1470]" />
      {title && (
        <p className="mt-[2.5mm] text-center text-[9px] font-bold uppercase tracking-[.4em] text-[#a77d1c]">{title}</p>
      )}
    </div>
  )
}

function Footer({ profile }) {
  const bits = [profile.clinicAddress, profile.clinicPhone && `Ph: ${profile.clinicPhone}`].filter(Boolean)
  return (
    <div className="mt-auto pt-[4mm]">
      <div className="h-px bg-gradient-to-r from-transparent via-[#d4a537] to-transparent" />
      <p className="mt-[1.8mm] text-center text-[7.5px] tracking-wide text-[#6b5a7a]">{bits.length ? bits.join('  ·  ') : 'Gayathri Multi Speciality Clinic'}</p>
    </div>
  )
}

function PatientStrip({ patient, date, extra, L }) {
  const line = [patient.dob || patient.age ? `${ageLabel(patient)} ${L('years')}` : '', patient.gender].filter(Boolean).join(' / ')
  return (
    <div className="mt-[3mm] grid grid-cols-[1fr_auto] gap-x-[4mm] gap-y-[1mm] rounded-[2mm] border border-[#e8d9b0] bg-[#fbf7ec] px-[3.5mm] py-[2.5mm] text-[9.5px]">
      <p><span className="text-[#8a7a98]">{L('patient')} </span><span className="font-bold text-[#2a0a3d]">{patient.name}</span></p>
      <p className="text-right"><span className="text-[#8a7a98]">{L('date')} </span><span className="font-semibold text-[#2a0a3d]">{fmtDate(date)}</span></p>
      <p><span className="text-[#8a7a98]">{L('id')} </span><span className="font-semibold text-[#2a0a3d]">{patient.code}</span>{line && <span className="text-[#2a0a3d]">{'  ·  '}{line}</span>}</p>
      <p className="text-right text-[#2a0a3d]">{extra}</p>
    </div>
  )
}

function Section({ label, children }) {
  if (!children) return null
  return (
    <div className="mt-[2.5mm]">
      <p className="text-[7.5px] font-bold uppercase tracking-[.2em] text-[#a77d1c]">{label}</p>
      <p className="mt-[0.6mm] whitespace-pre-line text-[10px] leading-snug text-[#2a0a3d]">{children}</p>
    </div>
  )
}

function Signature({ profile, L }) {
  return (
    <div className="mt-[8mm] flex justify-end">
      <div className="w-[45mm] text-center">
        <div className="h-px bg-[#2a0a3d]/50" />
        <p className="mt-[1mm] text-[8.5px] font-semibold text-[#2a0a3d]">{profile.doctor || L('doctor')}</p>
        <p className="text-[7.5px] text-[#6b5a7a]">{L('signature')}</p>
      </div>
    </div>
  )
}

export function RxSheet({ profile, patient, visit }) {
  const L = k => docT(profile.docLang, k)
  const vitals = [visit.bp && `BP ${visit.bp}`, visit.pulse && `Pulse ${visit.pulse}`, visit.weight && `Wt ${visit.weight} kg`].filter(Boolean).join('  ·  ')
  return (
    <Paper lang={profile.docLang}>
      <Letterhead profile={profile} title={profile.docLang && profile.docLang !== 'en' ? L('prescription') : ''} />
      <PatientStrip patient={patient} date={visit.date} extra={docDept(profile.docLang, visit.department)} L={L} />
      {patient.allergies && (
        <p className="mt-[2mm] rounded-[1.5mm] bg-[#fdecec] px-[3mm] py-[1.2mm] text-[8.5px] font-semibold text-[#9b1c1c]">{L('allergies')}: {patient.allergies}</p>
      )}
      {vitals && <p className="mt-[2mm] text-[9px] text-[#4a3a58]">{vitals}</p>}
      <div className="grid grid-cols-2 gap-x-[5mm]">
        <Section label={L('complaints')}>{visit.complaints}</Section>
        <Section label={L('diagnosis')}>{visit.diagnosis}</Section>
      </div>
      <Section label={L('findings')}>{visit.findings}</Section>

      {visit.rx?.length > 0 && (
        <div className="mt-[3.5mm]">
          <p className="font-display text-[26px] font-bold leading-none text-[#4a1470]">℞</p>
          <table className="mt-[1.5mm] w-full border-collapse text-[10px]">
            <thead>
              <tr className="border-b border-[#d4a537] text-left text-[7.5px] uppercase tracking-[.16em] text-[#a77d1c]">
                <th className="w-[6mm] py-[1mm] font-bold">#</th>
                <th className="py-[1mm] font-bold">{L('medicine')}</th>
                <th className="py-[1mm] font-bold">{L('dosage')}</th>
                <th className="py-[1mm] text-right font-bold">{L('duration')}</th>
              </tr>
            </thead>
            <tbody>
              {visit.rx.map((r, i) => (
                <tr key={i} className="border-b border-[#efe6cc] align-top">
                  <td className="py-[1.6mm] text-[#8a7a98]">{i + 1}</td>
                  <td className="py-[1.6mm] font-bold text-[#2a0a3d]">{r.medicine} <span className="font-semibold text-[#a77d1c]">{r.potency}</span></td>
                  <td className="py-[1.6mm] text-[#2a0a3d]">{r.dosage}</td>
                  <td className="py-[1.6mm] text-right text-[#2a0a3d]">{r.duration}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Section label={L('points')}>{visit.points}</Section>
      <Section label={L('session')}>{[visit.sessionNo, visit.sessionMins && `${visit.sessionMins} mins`].filter(Boolean).join('  ·  ')}</Section>
      <Section label={L('procedure')}>{[visit.procedure, visit.area].filter(Boolean).join(' — ')}</Section>
      <Section label={L('products')}>{visit.products}</Section>
      <Section label={L('advice')}>{visit.advice}</Section>

      {visit.followUp && (
        <p className="mt-[3.5mm] self-start rounded-full border border-[#d4a537] px-[3mm] py-[1mm] text-[9px] font-semibold text-[#4a1470]">{L('nextVisit')}: {fmtDate(visit.followUp)}</p>
      )}

      <Signature profile={profile} L={L} />
      <Footer profile={profile} />
    </Paper>
  )
}

export function ReceiptSheet({ profile, patient, visit }) {
  const L = k => docT(profile.docLang, k)
  const pending = visit.payMode === 'Pending'
  return (
    <Paper lang={profile.docLang}>
      <Letterhead profile={profile} title={L('receipt')} />
      <div className="mt-[3mm] flex justify-between text-[9.5px] text-[#2a0a3d]">
        <p><span className="text-[#8a7a98]">{L('receiptNo')} </span><span className="font-bold">{visit.receiptNo || '—'}</span></p>
        <p><span className="text-[#8a7a98]">{L('paidOn')} </span><span className="font-semibold">{fmtDate(pending ? '' : visit.paidOn || visit.date)}</span></p>
      </div>
      <PatientStrip patient={patient} date={visit.date} extra={patient.phone} L={L} />

      <table className="mt-[4mm] w-full border-collapse text-[10px]">
        <thead>
          <tr className="border-b border-[#d4a537] text-left text-[7.5px] uppercase tracking-[.16em] text-[#a77d1c]">
            <th className="py-[1.2mm] font-bold">{L('description')}</th>
            <th className="py-[1.2mm] text-right font-bold">{L('amount')}</th>
          </tr>
        </thead>
        <tbody>
          <tr className="border-b border-[#efe6cc]">
            <td className="py-[2.2mm] text-[#2a0a3d]">
              <p className="font-bold">{docDept(profile.docLang, visit.department)} {L('consultation')}</p>
              {(visit.procedure || visit.sessionNo) && <p className="text-[8.5px] text-[#6b5a7a]">{[visit.procedure, visit.sessionNo && `${L('session')} ${visit.sessionNo}`].filter(Boolean).join(' · ')}</p>}
            </td>
            <td className="py-[2.2mm] text-right font-semibold text-[#2a0a3d]">{fmtMoney(visit.fee || 0)}</td>
          </tr>
        </tbody>
      </table>

      <div className="mt-[3mm] flex items-center justify-between rounded-[2mm] bg-gradient-to-r from-[#2a0a3d] to-[#4a1470] px-[4mm] py-[3mm] text-white">
        <span className="text-[8px] font-bold uppercase tracking-[.24em] text-[#f3dc9b]">{L('total')}</span>
        <span className="font-display text-[22px] font-bold text-[#f3dc9b]">{fmtMoney(visit.fee || 0)}</span>
      </div>
      <p className="mt-[2mm] text-[8.5px] italic text-[#4a3a58]">{rupeesInWords(visit.fee)}</p>

      <div className="mt-[4mm] flex items-center gap-[3mm]">
        <span className={`rounded-full border px-[3mm] py-[1mm] text-[8.5px] font-bold uppercase tracking-[.16em] ${pending ? 'border-[#c0392b] text-[#c0392b]' : 'border-[#1f7a4d] text-[#1f7a4d]'}`}>
          {pending ? L('pending') : `${L('paid')} · ${visit.payMode}`}
        </span>
      </div>

      <Signature profile={profile} L={L} />
      <p className="mt-[3mm] text-center font-display text-[13px] italic text-[#4a1470]">{L('thanks')}</p>
      <Footer profile={profile} />
    </Paper>
  )
}

export function ClosingSheet({ profile, date, summary }) {
  const L = k => docT(profile.docLang, k)
  return (
    <Paper lang={profile.docLang}>
      <Letterhead profile={profile} title={L('closing')} />
      <p className="mt-[3mm] text-center font-display text-[17px] font-bold text-[#2a0a3d]">{fmtDate(date)}</p>
      <div className="mt-[3mm] grid grid-cols-4 gap-[2mm] text-center">
        {['Cash', 'UPI', 'Card'].map(m => (
          <div key={m} className="rounded-[2mm] border border-[#e8d9b0] bg-[#fbf7ec] py-[2mm]">
            <p className="text-[7px] font-bold uppercase tracking-[.2em] text-[#a77d1c]">{m}</p>
            <p className="mt-[0.5mm] text-[11px] font-bold text-[#2a0a3d]">{fmtMoney(summary.byMode[m] || 0)}</p>
          </div>
        ))}
        <div className="rounded-[2mm] bg-[#2a0a3d] py-[2mm]">
          <p className="text-[7px] font-bold uppercase tracking-[.2em] text-[#f3dc9b]">{L('total')}</p>
          <p className="mt-[0.5mm] text-[11px] font-bold text-white">{fmtMoney(summary.collected)}</p>
        </div>
      </div>
      <table className="mt-[4mm] w-full border-collapse text-[8.5px]">
        <thead>
          <tr className="border-b border-[#d4a537] text-left text-[7px] uppercase tracking-[.14em] text-[#a77d1c]">
            <th className="py-[1mm] font-bold">{L('patient')}</th>
            <th className="py-[1mm] font-bold">{L('dept')}</th>
            <th className="py-[1mm] font-bold">{L('mode')}</th>
            <th className="py-[1mm] text-right font-bold">{L('amount')}</th>
          </tr>
        </thead>
        <tbody>
          {summary.rows.map(r => (
            <tr key={r.id} className="border-b border-[#efe6cc]">
              <td className="py-[1.2mm] text-[#2a0a3d]"><span className="font-semibold">{r.patient?.name}</span>{r.collectedLater && r.date !== date && <span className="text-[#8a7a98]"> · {L('dueOf')} {fmtDate(r.date)}</span>}</td>
              <td className="py-[1.2mm] text-[#2a0a3d]">{docDept(profile.docLang, r.department)}</td>
              <td className={`py-[1.2mm] ${r.payMode === 'Pending' ? 'font-semibold text-[#c0392b]' : 'text-[#2a0a3d]'}`}>{r.payMode}</td>
              <td className="py-[1.2mm] text-right font-semibold text-[#2a0a3d]">{fmtMoney(r.fee || 0)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="mt-[3mm] flex justify-between text-[9px] text-[#2a0a3d]">
        <span>{summary.consults} {L('consults')}</span>
        <span className="font-semibold text-[#c0392b]">{L('pendingToday')}: {fmtMoney(summary.pending)}</span>
      </div>
      {summary.expenses?.length > 0 && (
        <table className="mt-[4mm] w-full border-collapse text-[8.5px]">
          <thead>
            <tr className="border-b border-[#d4a537] text-left text-[7px] uppercase tracking-[.14em] text-[#a77d1c]">
              <th className="py-[1mm] font-bold">{L('expense')}</th>
              <th className="py-[1mm] font-bold">{L('mode')}</th>
              <th className="py-[1mm] text-right font-bold">{L('amount')}</th>
            </tr>
          </thead>
          <tbody>
            {summary.expenses.map(e => (
              <tr key={e.id} className="border-b border-[#efe6cc] text-[#2a0a3d]">
                <td className="py-[1.2mm]">{e.category}{e.note ? ` · ${e.note}` : ''}</td>
                <td className="py-[1.2mm]">{e.mode}</td>
                <td className="py-[1.2mm] text-right font-semibold">{fmtMoney(e.amount)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <div className="mt-[3mm] flex items-center justify-between rounded-[2mm] bg-[#f1faf5] px-[3.5mm] py-[2mm] text-[9.5px] text-[#2a0a3d]">
        <span>{L('cashCollected')} {fmtMoney(summary.byMode.Cash || 0)} − {L('cashSpent')} {fmtMoney(summary.cashSpent || 0)}</span>
        <span className="font-bold text-[#1f7a4d]">{L('cashInHand')}: {fmtMoney(summary.cashInHand ?? summary.byMode.Cash ?? 0)}</span>
      </div>
      <Signature profile={profile} L={L} />
      <Footer profile={profile} />
    </Paper>
  )
}

function CaseRow({ label, children }) {
  if (!children || (Array.isArray(children) && !children.length)) return null
  return (
    <div className="grid grid-cols-[34mm_1fr] gap-x-[4mm] border-b border-[#efe6cc] py-[1.6mm] text-[9.5px]">
      <p className="font-bold uppercase tracking-[.12em] text-[#a77d1c]">{label}</p>
      <p className="whitespace-pre-line text-[#2a0a3d]">{children}</p>
    </div>
  )
}

function CaseBlock({ title, children }) {
  return (
    <div className="mt-[4mm]" style={{ breakInside: 'avoid' }}>
      <p className="font-display text-[15px] font-bold text-[#4a1470]">{title}</p>
      <div className="mt-[1mm] h-px bg-[#d4a537]" />
      {children}
    </div>
  )
}

export function CaseSheetDoc({ profile, patient, sheet, visits, reps = [] }) {
  const c = sheet || {}
  const join = arr => (arr || []).join(', ')
  return (
    <Paper a4>
      <Letterhead profile={profile} title="Homoeopathic Case Sheet" />
      <div className="mt-[3mm] grid grid-cols-4 gap-[2mm] rounded-[2mm] border border-[#e8d9b0] bg-[#fbf7ec] px-[3.5mm] py-[2.5mm] text-[9.5px] text-[#2a0a3d]">
        <p className="col-span-2"><span className="text-[#8a7a98]">Patient </span><span className="font-bold">{patient.name}</span></p>
        <p><span className="text-[#8a7a98]">ID </span><span className="font-semibold">{patient.code}</span></p>
        <p className="text-right"><span className="text-[#8a7a98]">Printed </span>{fmtDate(new Date().toISOString().slice(0, 10))}</p>
        <p><span className="text-[#8a7a98]">Age / Sex </span>{[ageLabel(patient), patient.gender].filter(Boolean).join(' / ') || '—'}</p>
        <p><span className="text-[#8a7a98]">Blood </span>{patient.bloodGroup || '—'}</p>
        <p className="col-span-2"><span className="text-[#8a7a98]">Mobile </span>{patient.phone || '—'}</p>
        {patient.occupation && <p className="col-span-2"><span className="text-[#8a7a98]">Occupation </span>{patient.occupation}</p>}
        {patient.address && <p className="col-span-2"><span className="text-[#8a7a98]">Address </span>{[patient.address, patient.city].filter(Boolean).join(', ')}</p>}
      </div>
      {patient.allergies && <p className="mt-[2mm] rounded-[1.5mm] bg-[#fdecec] px-[3mm] py-[1.2mm] text-[9px] font-semibold text-[#9b1c1c]">Allergies: {patient.allergies}</p>}

      <CaseBlock title="Presenting complaint">
        <CaseRow label="Location">{c.location}</CaseRow>
        <CaseRow label="Sensation">{c.sensation}</CaseRow>
        <CaseRow label="Modalities">{c.modalities}</CaseRow>
        <CaseRow label="Concomitants">{c.concomitants}</CaseRow>
      </CaseBlock>
      <CaseBlock title="Mind">
        <CaseRow label="Rubrics">{join(c.mind)}</CaseRow>
        <CaseRow label="In own words">{c.mindNotes}</CaseRow>
      </CaseBlock>
      <CaseBlock title="Physical generals">
        <CaseRow label="Thermal">{c.thermal}</CaseRow>
        <CaseRow label="Appetite">{c.appetite}</CaseRow>
        <CaseRow label="Thirst">{c.thirst}</CaseRow>
        <CaseRow label="Cravings">{join(c.cravings)}</CaseRow>
        <CaseRow label="Aversions">{c.aversions}</CaseRow>
        <CaseRow label="Stool">{c.stool}</CaseRow>
        <CaseRow label="Urine">{c.urine}</CaseRow>
        <CaseRow label="Perspiration">{c.perspiration}</CaseRow>
        <CaseRow label="Sleep">{c.sleep}</CaseRow>
        <CaseRow label="Dreams">{c.dreams}</CaseRow>
        <CaseRow label="Menses">{c.menses}</CaseRow>
      </CaseBlock>
      <CaseBlock title="History">
        <CaseRow label="Past">{c.pastHistory || patient.history}</CaseRow>
        <CaseRow label="Family">{c.familyHistory}</CaseRow>
      </CaseBlock>
      <CaseBlock title="Analysis">
        <CaseRow label="Miasm">{c.miasm}</CaseRow>
        <CaseRow label="Constitutional">{c.constitutional}</CaseRow>
        <CaseRow label="Totality">{c.totality}</CaseRow>
      </CaseBlock>

      {visits.length > 0 && (
        <CaseBlock title="Consultation summary">
          <table className="mt-[1mm] w-full border-collapse text-[8.5px]">
            <thead>
              <tr className="border-b border-[#d4a537] text-left text-[7px] uppercase tracking-[.12em] text-[#a77d1c]">
                <th className="w-[20mm] py-[1mm] font-bold">Date</th>
                <th className="w-[22mm] py-[1mm] font-bold">Dept</th>
                <th className="py-[1mm] font-bold">Diagnosis</th>
                <th className="py-[1mm] font-bold">Prescription / treatment</th>
                <th className="w-[18mm] py-[1mm] text-right font-bold">Next</th>
              </tr>
            </thead>
            <tbody>
              {visits.map(v => (
                <tr key={v.id} className="border-b border-[#efe6cc] align-top text-[#2a0a3d]">
                  <td className="py-[1.2mm]">{fmtDate(v.date)}</td>
                  <td className="py-[1.2mm]">{v.department}</td>
                  <td className="py-[1.2mm]">{v.diagnosis || v.complaints}</td>
                  <td className="py-[1.2mm]">{(v.rx || []).map(r => [r.medicine, r.potency].filter(Boolean).join(' ')).join(', ') || [v.points, v.procedure].filter(Boolean).join(' · ') || '—'}</td>
                  <td className="py-[1.2mm] text-right">{v.followUp ? fmtDate(v.followUp).slice(0, 6) : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </CaseBlock>
      )}
      {reps.map(r => (
        <CaseBlock key={r.id} title={`Repertorisation · ${fmtDate(r.date)}${r.visitId ? ' · consultation' : ''}`}>
          <ol className="mt-[1mm] text-[8.5px] text-[#2a0a3d]">
            {r.rubrics.map((p, i) => (
              <li key={i} className="flex gap-[2mm] py-[0.4mm]"><span className="w-[4mm] font-bold text-[#a77d1c]">{i + 1}.</span><span className="flex-1">{p.path}</span><span className="text-[#8a7a98]">×{p.intensity || 1}</span></li>
            ))}
          </ol>
          <table className="mt-[1.5mm] w-full border-collapse text-[8px]">
            <thead>
              <tr className="border-b border-[#d4a537] text-left text-[7px] uppercase tracking-[.12em] text-[#a77d1c]">
                <th className="py-[0.8mm] font-bold">Remedy</th>
                <th className="py-[0.8mm] text-right font-bold">Score</th>
                <th className="py-[0.8mm] pr-[2mm] text-right font-bold">Rubrics</th>
                {r.rubrics.map((p, i) => <th key={i} className="w-[4mm] py-[0.8mm] text-center font-bold">{i + 1}</th>)}
              </tr>
            </thead>
            <tbody>
              {(r.results || r.top).slice(0, 12).map((t, i) => (
                <tr key={t.abbrev} className="border-b border-[#efe6cc] text-[#2a0a3d]">
                  <td className={`py-[0.8mm] ${i < 3 ? 'font-bold' : ''}`}>{t.abbrev} <span className="text-[#8a7a98]">{t.name}</span></td>
                  <td className="py-[0.8mm] text-right">{t.score}</td>
                  <td className="py-[0.8mm] pr-[2mm] text-right">{t.count}/{r.rubrics.length}</td>
                  {r.rubrics.map((p, c) => <td key={c} className="py-[0.8mm] text-center">{t.grades ? t.grades[c] || '·' : ''}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
          {r.prescribed && <p className="mt-[1mm] text-[8.5px] text-[#2a0a3d]"><span className="text-[#8a7a98]">Prescribed </span><span className="font-bold">{r.prescribed.name}</span></p>}
          {r.note && <p className="mt-[1mm] text-[8.5px] italic text-[#2a0a3d]">{r.note}</p>}
        </CaseBlock>
      ))}
      <Signature profile={profile} L={k => docT('en', k)} />
      <Footer profile={profile} />
    </Paper>
  )
}

function Tile({ label, value, dark }) {
  return (
    <div className={`rounded-[2mm] py-[2.5mm] text-center ${dark ? 'bg-[#2a0a3d]' : 'border border-[#e8d9b0] bg-[#fbf7ec]'}`}>
      <p className={`text-[7px] font-bold uppercase tracking-[.18em] ${dark ? 'text-[#f3dc9b]' : 'text-[#a77d1c]'}`}>{label}</p>
      <p className={`mt-[0.8mm] font-display text-[17px] font-bold ${dark ? 'text-white' : 'text-[#2a0a3d]'}`}>{value}</p>
    </div>
  )
}

function MiniTable({ head, rows, right = [] }) {
  return (
    <table className="mt-[1.5mm] w-full border-collapse text-[8.5px]">
      <thead>
        <tr className="border-b border-[#d4a537] text-left text-[7px] uppercase tracking-[.12em] text-[#a77d1c]">
          {head.map((h, i) => <th key={h} className={`py-[1mm] font-bold ${right.includes(i) ? 'text-right' : ''}`}>{h}</th>)}
        </tr>
      </thead>
      <tbody>
        {rows.map((r, i) => (
          <tr key={i} className="border-b border-[#efe6cc] text-[#2a0a3d]">
            {r.map((c, j) => <td key={j} className={`py-[1.1mm] ${right.includes(j) ? 'text-right font-semibold' : ''}`}>{c}</td>)}
          </tr>
        ))}
        {!rows.length && <tr><td colSpan={head.length} className="py-[2mm] text-center text-[#8a7a98]">No records</td></tr>}
      </tbody>
    </table>
  )
}

export function MonthlyReportDoc({ profile, data }) {
  const d = data
  return (
    <Paper a4>
      <Letterhead profile={profile} title="Monthly Report" />
      <p className="mt-[3mm] text-center font-display text-[20px] font-bold text-[#2a0a3d]">{d.monthLabel}</p>
      <div className="mt-[3mm] grid grid-cols-3 gap-[2mm]">
        <Tile label="Collected" value={fmtMoney(d.revenue)} dark />
        <Tile label="Expenses" value={fmtMoney(d.spent || 0)} />
        <Tile label="Net profit" value={fmtMoney(d.profit ?? d.revenue)} dark />
      </div>
      <div className="mt-[2mm] grid grid-cols-4 gap-[2mm]">
        <Tile label="Consultations" value={d.consults} />
        <Tile label="New patients" value={d.newPatients} />
        <Tile label="Avg. fee" value={fmtMoney(d.avgFee)} />
        <Tile label="Pending" value={fmtMoney(d.pending)} />
      </div>
      <div className="mt-[5mm] grid grid-cols-2 gap-x-[6mm]">
        <div>
          <p className="font-display text-[14px] font-bold text-[#4a1470]">Departments</p>
          <MiniTable head={['Department', 'Visits', 'Share', 'Revenue']} right={[1, 2, 3]} rows={d.depts.map(x => [x.key, x.consults, `${x.share}%`, fmtMoney(x.revenue)])} />
        </div>
        <div>
          <p className="font-display text-[14px] font-bold text-[#4a1470]">Payment modes</p>
          <MiniTable head={['Mode', 'Payments', 'Amount']} right={[1, 2]} rows={d.modes.map(x => [x.mode, x.count, fmtMoney(x.amount)])} />
        </div>
        <div className="mt-[5mm]">
          <p className="font-display text-[14px] font-bold text-[#4a1470]">Top diagnoses</p>
          <MiniTable head={['Diagnosis', 'Visits']} right={[1]} rows={d.topDx.map(x => [x.label, x.value])} />
        </div>
        <div className="mt-[5mm]">
          <p className="font-display text-[14px] font-bold text-[#4a1470]">Top remedies</p>
          <MiniTable head={['Remedy', 'Prescribed']} right={[1]} rows={d.topRx.map(x => [x.label, x.value])} />
        </div>
        {d.expCats?.length > 0 && (
          <div className="col-span-2 mt-[5mm]">
            <p className="font-display text-[14px] font-bold text-[#4a1470]">Expenses by category</p>
            <MiniTable head={['Category', 'Amount']} right={[1]} rows={d.expCats.map(x => [x.label, fmtMoney(x.value)])} />
          </div>
        )}
      </div>
      <div className="mt-[5mm]">
        <p className="font-display text-[14px] font-bold text-[#4a1470]">Daily collections</p>
        <MiniTable head={['Date', 'Consultations', 'Cash', 'UPI', 'Card', 'Total']} right={[1, 2, 3, 4, 5]} rows={d.days.map(x => [fmtDate(x.date), x.consults, fmtMoney(x.Cash), fmtMoney(x.UPI), fmtMoney(x.Card), fmtMoney(x.total)])} />
      </div>
      <Signature profile={profile} L={k => docT('en', k)} />
      <Footer profile={profile} />
    </Paper>
  )
}
