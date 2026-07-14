import { FAQ_ITEMS } from '@/content/faq';

export interface FaqSectionProps {
  className?: string;
}

/**
 * FAQ о воздухе в Алматы: нативный аккордеон <details>/<summary> без JS.
 * Серверный компонент; те же ответы уходят в JSON-LD FAQPage — источник
 * единый, src/content/faq.ts.
 */
export function FaqSection({ className = '' }: FaqSectionProps) {
  return (
    <section aria-labelledby="faq-heading" className={className}>
      <h2 id="faq-heading" className="text-lg font-semibold tracking-tight">
        Вопросы о воздухе в Алматы
      </h2>
      <div className="mt-4 space-y-3">
        {FAQ_ITEMS.map((item) => (
          <details
            key={item.question}
            className="group card-lift rounded-2xl border border-border bg-card"
          >
            <summary className="flex cursor-pointer list-none items-center justify-between gap-3 rounded-2xl p-4 text-sm font-semibold leading-snug [&::-webkit-details-marker]:hidden">
              {item.question}
              {/* Шеврон: поворачивается при раскрытии, чисто на CSS */}
              <svg
                viewBox="0 0 16 16"
                className="h-4 w-4 shrink-0 text-muted group-open:rotate-180 motion-safe:transition-transform motion-safe:duration-200 motion-safe:ease-[cubic-bezier(0.2,0,0,1)]"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M3.5 6l4.5 4.5L12.5 6" />
              </svg>
            </summary>
            <p className="faq-answer px-4 pb-4 text-sm leading-relaxed text-muted">
              {item.answer}
            </p>
          </details>
        ))}
      </div>
    </section>
  );
}
