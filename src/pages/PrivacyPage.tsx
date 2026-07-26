import { Link } from 'react-router-dom';
import { ArrowLeft, Shield } from 'lucide-react';
import { PRIVACY } from '@/lib/privacy';

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-2">
      <h2 className="font-display font-black text-base text-white uppercase tracking-wide">{title}</h2>
      <div className="text-sm text-white/60 leading-relaxed space-y-2">{children}</div>
    </section>
  );
}

export function PrivacyPage() {
  return (
    <div className="min-h-screen">
      <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">
        <header className="space-y-3">
          <Link
            to="/login"
            className="inline-flex items-center gap-2 text-xs text-white/40 hover:text-white/70 transition-colors"
          >
            <ArrowLeft size={14} /> Indietro
          </Link>
          <div className="flex items-center gap-2">
            <Shield size={22} className="text-primary-400" />
            <h1 className="page-title">Informativa Privacy</h1>
          </div>
          <p className="text-xs text-white/40">
            Ultimo aggiornamento: {PRIVACY.lastUpdated} — Versione {PRIVACY.version}
          </p>
        </header>

        <div className="glass-card p-5 space-y-6">
          <Section title="1. Titolare del trattamento">
            <p>
              Il titolare del trattamento è <strong className="text-white/80">{PRIVACY.controller.name}</strong>.
            </p>
            <p>
              Per esercitare i tuoi diritti o per qualsiasi domanda sui tuoi dati puoi scrivere a{' '}
              <a href={`mailto:${PRIVACY.controller.email}`} className="text-primary-400 hover:text-primary-300 font-bold">
                {PRIVACY.controller.email}
              </a>
              .
            </p>
          </Section>

          <Section title="2. Quali dati raccogliamo">
            <ul className="list-disc list-inside space-y-1">
              <li><strong className="text-white/80">Indirizzo email</strong> — necessario per creare e recuperare l'account.</li>
              <li><strong className="text-white/80">Nome utente</strong> — mostrato nelle classifiche e nelle leghe.</li>
              <li><strong className="text-white/80">Dati di gioco</strong> — pronostici, punteggi, gettoni, cronologia delle partite e delle transazioni.</li>
              <li><strong className="text-white/80">Dati tecnici</strong> — indirizzo IP e informazioni sul dispositivo, trattati dai nostri fornitori per erogare e proteggere il servizio.</li>
            </ul>
            <p>
              Non raccogliamo dati di pagamento, non trattiamo categorie particolari di dati (art. 9 GDPR) e non
              effettuiamo profilazione né decisioni automatizzate con effetti giuridici.
            </p>
          </Section>

          <Section title="3. Perché li trattiamo e con quale base giuridica">
            <div className="overflow-x-auto">
              <table className="w-full text-xs border-collapse">
                <thead>
                  <tr className="text-left text-white/40 uppercase tracking-wide">
                    <th className="py-2 pr-3 font-bold">Finalità</th>
                    <th className="py-2 pr-3 font-bold">Dati</th>
                    <th className="py-2 font-bold">Base giuridica</th>
                  </tr>
                </thead>
                <tbody className="text-white/60">
                  {PRIVACY.processing.map(p => (
                    <tr key={p.purpose} className="border-t border-white/5 align-top">
                      <td className="py-2 pr-3">{p.purpose}</td>
                      <td className="py-2 pr-3">{p.data}</td>
                      <td className="py-2">{p.legalBasis}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Section>

          <Section title="4. Per quanto tempo li conserviamo">
            <ul className="list-disc list-inside space-y-1">
              <li>Dati dell'account: finché l'account resta attivo.</li>
              <li>
                Alla cancellazione dell'account i dati personali sono eliminati entro{' '}
                <strong className="text-white/80">{PRIVACY.retention.afterDeletionDays} giorni</strong>.
              </li>
              <li>
                Log tecnici e diagnostici: massimo{' '}
                <strong className="text-white/80">{PRIVACY.retention.logsDays} giorni</strong>.
              </li>
              <li>
                Le copie di backup vengono sovrascritte entro{' '}
                <strong className="text-white/80">{PRIVACY.retention.backupDays} giorni</strong>.
              </li>
            </ul>
          </Section>

          <Section title="5. Chi tratta i dati per nostro conto">
            <p>Ci avvaliamo dei seguenti responsabili del trattamento (art. 28 GDPR):</p>
            <ul className="list-disc list-inside space-y-1">
              {PRIVACY.processors.map(p => (
                <li key={p.name}>
                  <strong className="text-white/80">{p.name}</strong> — {p.role} ({p.location})
                </li>
              ))}
            </ul>
            <p>
              I trasferimenti verso paesi terzi avvengono sulla base delle Clausole Contrattuali Standard e del
              Data Privacy Framework UE-USA, dove applicabile.
            </p>
          </Section>

          <Section title="6. Cookie e tecnologie simili">
            <p>
              Usiamo esclusivamente archiviazione locale <strong className="text-white/80">tecnica</strong>, necessaria
              a mantenere attiva la sessione di accesso e le preferenze dell'applicazione. Non impieghiamo cookie di
              profilazione, pubblicitari o di analisi di terze parti: per questo non è richiesto alcun banner di consenso.
            </p>
          </Section>

          <Section title="7. I tuoi diritti">
            <p>
              Puoi in ogni momento esercitare i diritti previsti dagli articoli 15-22 del GDPR: accesso, rettifica,
              cancellazione, limitazione, portabilità e opposizione.
            </p>
            <p>
              Due di questi diritti sono esercitabili direttamente dall'app, senza bisogno di scriverci: dalla pagina{' '}
              <strong className="text-white/80">Account</strong> puoi <strong className="text-white/80">scaricare
              tutti i tuoi dati</strong> in formato JSON ed <strong className="text-white/80">eliminare
              definitivamente l'account</strong>.
            </p>
            <p>
              Hai inoltre il diritto di proporre reclamo al Garante per la protezione dei dati personali
              (<a href="https://www.garanteprivacy.it" target="_blank" rel="noreferrer noopener" className="text-primary-400 hover:text-primary-300">garanteprivacy.it</a>).
            </p>
          </Section>

          <Section title="8. Sicurezza">
            <p>
              I dati sono cifrati in transito (TLS) e a riposo. L'accesso è protetto da autenticazione e le operazioni
              che modificano punteggi, gettoni e schedine sono eseguite esclusivamente lato server con controlli di
              autorizzazione. Effettuiamo backup periodici e ne verifichiamo il ripristino.
            </p>
          </Section>

          <Section title="9. Età minima">
            <p>
              Il servizio è riservato ai maggiorenni. FantaSchedina è un gioco con valuta virtuale senza alcun valore
              economico: non è consentita la conversione dei gettoni in denaro e non si tratta di gioco d'azzardo.
            </p>
          </Section>

          <Section title="10. Modifiche">
            <p>
              Eventuali modifiche sostanziali a questa informativa verranno comunicate in app prima della loro
              entrata in vigore.
            </p>
          </Section>
        </div>

        <p className="text-center text-[10px] text-white/20 pb-4">
          FantaSchedina — Solo maggiorenni — Valuta virtuale senza valore economico
        </p>
      </div>
    </div>
  );
}
