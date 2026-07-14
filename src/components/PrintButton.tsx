"use client";

export default function PrintButton() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="rounded bg-green-600 px-5 py-3 font-bold text-white print:hidden"
    >
      Печать / PDF
    </button>
  );
}