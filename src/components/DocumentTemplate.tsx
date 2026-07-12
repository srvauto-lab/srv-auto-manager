"use client";

type Seller = {
  name: string;
  legalForm?: string;
  capital?: string;
  address: string;
  siren?: string;
  siret: string;
  rcs?: string;
  ape?: string;
  tva?: string;
  phone?: string;
  email?: string;
  website?: string;
  iban?: string;
  bic?: string;
  bankName?: string;
  logoUrl?: string;
  signatureUrl?: string;
  stampUrl?: string;
  managerName?: string;
  whatsapp?: string;
  instagram?: string;
  tvaRate: number;
  vatMention?: string;
  invoiceFooter?: string;
  devisFooter?: string;
  workOrderFooter?: string;
  paymentTerms?: string;
  warrantyTerms?: string;
  latePenaltyTerms?: string;
  recoveryTerms?: string;
  customLegalText?: string;
};

type Labels = Record<string, string>;

type Props = {
  title: string;
  documentNumber: string;
  date: string;
  dueDate?: string;
  validUntil?: string;
  seller: Seller;
  order: any;
  laborItems: any[];
  partItems: any[];
  labels: Labels;
  totals: {
    ht: number;
    tva: number;
    ttc: number;
    paid?: number;
    remaining?: number;
  };
  type: string;
  signature?: any | null;
  photos?: any[];
  recommendations?: any[];
  payments?: any[];
};

function money(value: unknown) {
  return `${Number(value || 0).toFixed(2)} €`;
}

function safeText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function photoUrl(photo: any) {
  return (
    photo?.public_url ||
    photo?.photo_url ||
    photo?.url ||
    photo?.image_url ||
    ""
  );
}

function photoLabel(photo: any) {
  return (
    photo?.label ||
    photo?.category ||
    photo?.caption ||
    "Photo véhicule"
  );
}

function documentFooterText(type: string, seller: Seller) {
  if (type === "facture") return safeText(seller.invoiceFooter);
  if (type === "devis") return safeText(seller.devisFooter);
  return safeText(seller.workOrderFooter);
}

export default function DocumentTemplate({
  title,
  documentNumber,
  date,
  dueDate,
  validUntil,
  seller,
  order,
  laborItems,
  partItems,
  labels,
  totals,
  type,
  signature,
  photos = [],
  recommendations = [],
  payments = [],
}: Props) {
  const isDevis = type === "devis";
  const isFacture = type === "facture";
  const isOrder = type === "order";

  const footerText = documentFooterText(type, seller);

  const defaultPaymentTerms =
    "Paiement comptant à réception, sauf accord écrit contraire.";

  const defaultLatePenalty =
    "Pénalités de retard : trois fois le taux d’intérêt légal, exigibles sans rappel dès le lendemain de l’échéance.";

  const defaultRecovery =
    "Indemnité forfaitaire pour frais de recouvrement : 40 € due par tout client professionnel en cas de retard de paiement.";

  const defaultDevisText =
    "Le présent devis devient contractuel après signature précédée de la mention « Bon pour accord ». Toute prestation supplémentaire fera l’objet de l’accord préalable du client.";

  const defaultOrderText =
    "Le client autorise l’exécution des travaux et opérations décrits sur le présent ordre de réparation.";

  return (
    <main className="min-h-screen bg-zinc-200 p-4 text-zinc-950 print:bg-white print:p-0">
      <div className="mx-auto max-w-[210mm] bg-white p-8 shadow-xl print:max-w-none print:p-0 print:shadow-none">
        <div className="mb-6 flex justify-end print:hidden">
          <button
            type="button"
            onClick={() => window.print()}
            className="rounded-lg bg-zinc-900 px-5 py-3 font-bold text-white"
          >
            Imprimer / PDF
          </button>
        </div>

        <header className="document-header border-b-4 border-emerald-600 pb-6">
          <div className="flex items-start justify-between gap-8">
            <div className="min-w-0 flex-1">
              {seller.logoUrl ? (
                <img
                  src={seller.logoUrl}
                  alt={seller.name}
                  className="max-h-20 max-w-[240px] object-contain"
                />
              ) : (
                <div className="text-3xl font-black tracking-tight text-emerald-700">
                  {seller.name || "SRV AUTO"}
                </div>
              )}

              <p className="mt-1 text-sm font-semibold text-zinc-600">
                Entretien et réparation automobile
              </p>

              <div className="mt-4 space-y-1 text-xs leading-5 text-zinc-700">
                <p className="break-words font-bold">{seller.name}</p>
                {seller.legalForm && <p>{seller.legalForm}</p>}
                {seller.capital && <p>Capital social : {seller.capital}</p>}
                <p className="break-words">{seller.address}</p>
                {seller.siren && <p>SIREN : {seller.siren}</p>}
                <p>SIRET : {seller.siret}</p>
                {seller.rcs && <p>{seller.rcs}</p>}
                {seller.ape && <p>Code APE : {seller.ape}</p>}
                {seller.tva && <p>TVA intracommunautaire : {seller.tva}</p>}
                {seller.phone && <p>Tél. : {seller.phone}</p>}
                {seller.email && <p className="break-all">E-mail : {seller.email}</p>}
                {seller.website && <p className="break-all">Web : {seller.website}</p>}
              </div>
            </div>

            <div className="min-w-[250px] max-w-[300px] rounded-xl border border-zinc-300 p-5 text-right">
              <h1 className="break-words text-3xl font-black uppercase">
                {title}
              </h1>
              <p className="mt-3 break-all text-sm">
                <span className="text-zinc-500">N°</span>{" "}
                <span className="font-bold">{documentNumber}</span>
              </p>
              <p className="mt-1 text-sm">
                <span className="text-zinc-500">{labels.date || "Date"} :</span>{" "}
                <span className="font-semibold">{date}</span>
              </p>

              {isFacture && dueDate && (
                <p className="mt-1 text-sm">
                  <span className="text-zinc-500">Échéance :</span>{" "}
                  <span className="font-semibold">{dueDate}</span>
                </p>
              )}

              {isDevis && validUntil && (
                <p className="mt-1 text-sm">
                  <span className="text-zinc-500">Validité :</span>{" "}
                  <span className="font-semibold">jusqu’au {validUntil}</span>
                </p>
              )}
            </div>
          </div>
        </header>

        <section className="avoid-break mt-6 grid grid-cols-2 gap-5">
          <div className="rounded-xl border border-zinc-300 p-5">
            <h2 className="text-sm font-black uppercase text-emerald-700">
              {labels.client || "Client"}
            </h2>

            <div className="mt-3 space-y-1 text-sm">
              <p className="break-words font-bold">
                {order.clients?.full_name || "-"}
              </p>
              {order.clients?.address && (
                <p className="break-words">{order.clients.address}</p>
              )}
              {order.clients?.phone && <p>Tél. : {order.clients.phone}</p>}
              {order.clients?.email && (
                <p className="break-all">E-mail : {order.clients.email}</p>
              )}
              {order.clients?.siren && <p>SIREN : {order.clients.siren}</p>}
            </div>
          </div>

          <div className="rounded-xl border border-zinc-300 p-5">
            <h2 className="text-sm font-black uppercase text-emerald-700">
              {labels.vehicle || "Véhicule"}
            </h2>

            <div className="mt-3 space-y-1 text-sm">
              <p className="break-words font-bold">
                {order.vehicles?.brand || "-"} {order.vehicles?.model || ""}
              </p>
              <p className="break-words">
                Immatriculation : {order.vehicles?.plate || "-"}
              </p>
              <p className="break-all">VIN : {order.vehicles?.vin || "-"}</p>
              <p>
                {labels.mileage || "Kilométrage"} : {order.mileage || "-"} km
              </p>
            </div>
          </div>
        </section>

        {(safeText(order.customer_complaint) || safeText(order.notes)) && (
          <section className="avoid-break mt-5 rounded-xl border border-zinc-300 p-5">
            {safeText(order.customer_complaint) && (
              <>
                <h2 className="text-sm font-black uppercase text-emerald-700">
                  {labels.complaint || "Demande client"}
                </h2>
                <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-6">
                  {order.customer_complaint}
                </p>
              </>
            )}

            {safeText(order.notes) && (
              <>
                <h2 className="mt-4 text-sm font-black uppercase text-emerald-700">
                  Observations
                </h2>
                <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-6">
                  {order.notes}
                </p>
              </>
            )}
          </section>
        )}

        <section className="mt-6">
          <table className="document-table w-full border-collapse text-sm">
            <thead>
              <tr className="bg-zinc-900 text-white">
                <th className="border border-zinc-700 px-3 py-3 text-left">
                  Désignation
                </th>
                <th className="w-20 border border-zinc-700 px-3 py-3 text-right">
                  {labels.qty || "Qté"}
                </th>
                <th className="w-28 border border-zinc-700 px-3 py-3 text-right">
                  Prix unitaire HT
                </th>
                <th className="w-28 border border-zinc-700 px-3 py-3 text-right">
                  Montant HT
                </th>
              </tr>
            </thead>

            <tbody>
              {laborItems.map((item) => (
                <tr key={`labor-${item.id}`} className="table-row">
                  <td className="break-words border border-zinc-300 px-3 py-3 align-top">
                    <span className="mr-2 inline-block rounded bg-emerald-100 px-2 py-1 text-[10px] font-bold text-emerald-800">
                      MO
                    </span>
                    <span className="whitespace-pre-wrap">
                      {safeText(item.description) || "-"}
                    </span>
                  </td>

                  <td className="border border-zinc-300 px-3 py-3 text-right align-top">
                    {Number(item.quantity || 0)}
                  </td>

                  <td className="border border-zinc-300 px-3 py-3 text-right align-top">
                    {money(item.unit_price)}
                  </td>

                  <td className="border border-zinc-300 px-3 py-3 text-right align-top font-semibold">
                    {money(
                      item.total ??
                        Number(item.quantity || 0) *
                          Number(item.unit_price || 0)
                    )}
                  </td>
                </tr>
              ))}

              {partItems.map((item) => (
                <tr key={`part-${item.id}`} className="table-row">
                  <td className="break-words border border-zinc-300 px-3 py-3 align-top">
                    <span className="mr-2 inline-block rounded bg-blue-100 px-2 py-1 text-[10px] font-bold text-blue-800">
                      PIÈCE
                    </span>
                    <span className="whitespace-pre-wrap">
                      {safeText(item.name) || "-"}
                    </span>

                    {item.reference && (
                      <span className="ml-2 break-all text-xs text-zinc-500">
                        Réf. {item.reference}
                      </span>
                    )}
                  </td>

                  <td className="border border-zinc-300 px-3 py-3 text-right align-top">
                    {Number(item.quantity || 0)}
                  </td>

                  <td className="border border-zinc-300 px-3 py-3 text-right align-top">
                    {money(item.unit_price)}
                  </td>

                  <td className="border border-zinc-300 px-3 py-3 text-right align-top font-semibold">
                    {money(
                      item.total ??
                        Number(item.quantity || 0) *
                          Number(item.unit_price || 0)
                    )}
                  </td>
                </tr>
              ))}

              {!laborItems.length && !partItems.length && (
                <tr className="table-row">
                  <td
                    colSpan={4}
                    className="border border-zinc-300 px-3 py-8 text-center text-zinc-500"
                  >
                    Aucune ligne.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </section>

        <section className="avoid-break mt-6 flex justify-end">
          <div className="w-full max-w-sm rounded-xl border border-zinc-300 p-5">
            <div className="flex justify-between gap-6 py-1 text-sm">
              <span>{labels.totalHt || "Total HT"}</span>
              <strong>{money(totals.ht)}</strong>
            </div>

            <div className="flex justify-between gap-6 py-1 text-sm">
              <span>
                {labels.tva || "TVA"} ({Math.round(seller.tvaRate * 100)} %)
              </span>
              <strong>{money(totals.tva)}</strong>
            </div>

            <div className="mt-2 flex justify-between gap-6 border-t-2 border-zinc-900 pt-3 text-xl">
              <span className="font-black">
                {labels.totalTtc || "Total TTC"}
              </span>
              <strong className="text-emerald-700">{money(totals.ttc)}</strong>
            </div>

            {isFacture && (
              <>
                <div className="mt-3 flex justify-between gap-6 text-sm">
                  <span>Déjà réglé</span>
                  <strong>{money(totals.paid)}</strong>
                </div>

                <div className="flex justify-between gap-6 text-sm">
                  <span>Net à payer</span>
                  <strong
                    className={
                      Number(totals.remaining || 0) > 0
                        ? "text-orange-700"
                        : "text-emerald-700"
                    }
                  >
                    {money(totals.remaining)}
                  </strong>
                </div>
              </>
            )}
          </div>
        </section>

        {payments.length > 0 && isFacture && (
          <section className="avoid-break mt-6">
            <h2 className="text-sm font-black uppercase text-emerald-700">
              Règlements enregistrés
            </h2>

            <div className="mt-2 overflow-hidden rounded-lg border border-zinc-300">
              {payments.map((payment) => (
                <div
                  key={payment.id}
                  className="grid grid-cols-[1fr_1fr_auto] gap-3 border-b border-zinc-200 px-4 py-3 text-sm last:border-b-0"
                >
                  <span>
                    {new Date(payment.payment_date).toLocaleDateString("fr-FR")}
                  </span>
                  <span>{payment.payment_method || "-"}</span>
                  <strong>{money(payment.amount)}</strong>
                </div>
              ))}
            </div>
          </section>
        )}

        {recommendations.length > 0 && (
          <section className="mt-6 rounded-xl border border-amber-300 bg-amber-50 p-5">
            <h2 className="text-sm font-black uppercase text-amber-800">
              Recommandations
            </h2>

            <div className="mt-3 space-y-3">
              {recommendations.map((item) => (
                <article
                  key={item.id}
                  className="avoid-break rounded-lg border border-amber-200 bg-white p-4"
                >
                  <p className="font-bold text-amber-900">
                    {safeText(item.title) || "Recommandation"}
                  </p>

                  {safeText(item.description) && (
                    <p className="mt-1 whitespace-pre-wrap break-words text-sm text-zinc-700">
                      {item.description}
                    </p>
                  )}

                  {(item.due_mileage || item.due_date) && (
                    <p className="mt-2 text-xs text-zinc-500">
                      {item.due_mileage
                        ? `Échéance kilométrique : ${item.due_mileage} km`
                        : ""}
                      {item.due_mileage && item.due_date ? " · " : ""}
                      {item.due_date
                        ? `Date conseillée : ${new Date(
                            item.due_date
                          ).toLocaleDateString("fr-FR")}`
                        : ""}
                    </p>
                  )}
                </article>
              ))}
            </div>
          </section>
        )}

        {photos.length > 0 && (
          <section className="photos-section mt-6">
            <h2 className="text-sm font-black uppercase text-emerald-700">
              Photographies du véhicule
            </h2>

            <div className="mt-4 grid grid-cols-2 gap-4">
              {photos.map((photo) => {
                const url = photoUrl(photo);
                if (!url) return null;

                return (
                  <figure
                    key={photo.id}
                    className="photo-card avoid-break overflow-hidden rounded-lg border border-zinc-300"
                  >
                    <img
                      src={url}
                      alt={photoLabel(photo)}
                      className="h-48 w-full object-cover"
                    />
                    <figcaption className="break-words p-2 text-xs text-zinc-600">
                      {photoLabel(photo)}
                    </figcaption>
                  </figure>
                );
              })}
            </div>
          </section>
        )}

        <section className="avoid-break mt-8 grid grid-cols-2 gap-6">
          <div className="rounded-xl border border-zinc-300 p-5">
            <h2 className="text-sm font-black uppercase text-emerald-700">
              Conditions
            </h2>

            <div className="mt-3 space-y-2 whitespace-pre-wrap break-words text-[11px] leading-4 text-zinc-700">
              {seller.vatMention && <p>{seller.vatMention}</p>}

              <p>
                Catégorie d’opération : prestations de services et ventes de
                biens.
              </p>

              {isFacture && (
                <>
                  <p>{safeText(seller.paymentTerms) || defaultPaymentTerms}</p>
                  <p>Escompte pour paiement anticipé : néant.</p>
                  <p>
                    {safeText(seller.latePenaltyTerms) || defaultLatePenalty}
                  </p>
                  <p>{safeText(seller.recoveryTerms) || defaultRecovery}</p>
                </>
              )}

              {isDevis && (
                <p>
                  {safeText(seller.customLegalText) || defaultDevisText}
                </p>
              )}

              {isOrder && (
                <p>
                  {safeText(seller.customLegalText) || defaultOrderText}
                </p>
              )}

              {safeText(seller.warrantyTerms) && (
                <p>{seller.warrantyTerms}</p>
              )}

              {safeText(seller.customLegalText) && isFacture && (
                <p>{seller.customLegalText}</p>
              )}

              {footerText && <p>{footerText}</p>}
            </div>

            {(seller.iban || seller.bic || seller.bankName) && (
              <div className="mt-4 border-t border-zinc-200 pt-3 text-[11px] leading-4 text-zinc-700">
                <p className="font-bold">Coordonnées bancaires</p>
                {seller.bankName && <p>Banque : {seller.bankName}</p>}
                {seller.iban && <p className="break-all">IBAN : {seller.iban}</p>}
                {seller.bic && <p>BIC : {seller.bic}</p>}
              </div>
            )}
          </div>

          <div className="rounded-xl border border-zinc-300 p-5">
            <h2 className="text-sm font-black uppercase text-emerald-700">
              Accord et signature
            </h2>

            {signature?.signature_url ? (
              <div className="mt-4">
                <img
                  src={signature.signature_url}
                  alt="Signature client"
                  className="h-24 w-full object-contain"
                />
                <p className="mt-2 text-xs">
                  Signataire : {signature.signer_name || "-"}
                </p>
                <p className="text-xs">
                  Signé le{" "}
                  {signature.signed_at
                    ? new Date(signature.signed_at).toLocaleString("fr-FR")
                    : "-"}
                </p>
              </div>
            ) : (
              <div className="mt-4 text-xs text-zinc-600">
                <p>
                  {isDevis ? "Bon pour accord :" : "Signature du client :"}
                </p>
                <div className="mt-12 border-b border-zinc-400" />
              </div>
            )}

            {(seller.signatureUrl || seller.stampUrl) && (
              <div className="mt-6 grid grid-cols-2 gap-3 border-t border-zinc-200 pt-4">
                {seller.signatureUrl && (
                  <div>
                    <p className="mb-2 text-[10px] font-bold uppercase text-zinc-500">
                      Signature garage
                    </p>
                    <img
                      src={seller.signatureUrl}
                      alt="Signature garage"
                      className="h-20 w-full object-contain"
                    />
                  </div>
                )}

                {seller.stampUrl && (
                  <div>
                    <p className="mb-2 text-[10px] font-bold uppercase text-zinc-500">
                      Cachet
                    </p>
                    <img
                      src={seller.stampUrl}
                      alt="Cachet de l’entreprise"
                      className="h-20 w-full object-contain"
                    />
                  </div>
                )}
              </div>
            )}
          </div>
        </section>

        <footer className="document-footer mt-8 border-t border-zinc-300 pt-4 text-center text-[10px] leading-4 text-zinc-500">
          <p>
            Document établi par {seller.name} — {seller.siret}
            {seller.rcs ? ` — ${seller.rcs}` : ""}
          </p>
          <p>
            Les factures doivent être conservées conformément aux obligations
            comptables et fiscales applicables.
          </p>
        </footer>
      </div>

      <style jsx global>{`
        @page {
          size: A4;
          margin: 12mm;
        }

        .document-table {
          table-layout: fixed;
        }

        .document-table thead {
          display: table-header-group;
        }

        .table-row,
        .avoid-break,
        .photo-card {
          break-inside: avoid;
          page-break-inside: avoid;
        }

        .photos-section {
          break-before: auto;
        }

        @media print {
          html,
          body {
            background: white !important;
          }

          * {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }

          .document-header {
            break-inside: avoid;
            page-break-inside: avoid;
          }

          .document-table thead {
            display: table-header-group;
          }

          .document-table tfoot {
            display: table-footer-group;
          }

          .table-row {
            break-inside: avoid;
            page-break-inside: avoid;
          }

          .photos-section {
            break-before: page;
          }

          .document-footer {
            break-inside: avoid;
            page-break-inside: avoid;
          }
        }
      `}</style>
    </main>
  );
}