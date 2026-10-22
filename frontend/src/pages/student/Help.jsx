import { PageHeading, Card } from '../../components/Ui'

const faqs = [
  {
    q: 'Which browser should I use?',
    a: 'Chrome or Edge on a laptop. Live transcription uses the Web Speech API, which Firefox does not support yet — the audio still records there, and you can type the details instead.',
  },
  {
    q: 'Can I complain in Hindi or Marathi?',
    a: 'Yes. Pick the language above the microphone before you start recording, then speak normally.',
  },
  {
    q: 'What evidence should I attach?',
    a: 'Photos or a short video of the problem. Up to six files, 25 MB each. Clear, well-lit photos get complaints resolved faster than long descriptions.',
  },
  {
    q: 'Who sees my complaint?',
    a: 'The student cell, and the department it is routed to. Your name is attached so the department can follow up with you directly.',
  },
  {
    q: 'How do I track a complaint?',
    a: 'Every complaint gets an ID like GRV1021. Open it from My complaints to see the progress timeline.',
  },
]

export default function Help() {
  return (
    <>
      <PageHeading title="Help centre" subtitle="Short answers to the questions students ask most." />
      <div className="grid gap-4 lg:max-w-3xl">
        {faqs.map(({ q, a }) => (
          <Card key={q} className="p-6">
            <h2 className="font-semibold text-ink">{q}</h2>
            <p className="mt-2 text-sm leading-relaxed text-ink-soft">{a}</p>
          </Card>
        ))}
      </div>
    </>
  )
}
